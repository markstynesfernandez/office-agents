// engine-model.mjs — turns the engine's own state (SQLite, ledger, job folders, config) into the office snapshot the page
// renders: the same shape the legacy view produces (model.mjs), so the 3D office, board, calendar and panels work on
// both. Read-only. Prompts, keys and provider responses never reach the snapshot.
import fs from 'node:fs';
import path from 'node:path';
import { dublinDay, dublinDayStart, dmyOfDay } from '../engine/time.mjs';
import { nextRuns } from '../engine/scheduler.mjs';
import { cronWords } from './model.mjs';
import { latestSet } from '../engine/lib/digital-prep.mjs';

const PROGRESS = { brief: 0.08, design: 0.25, 'qa-design': 0.42, listing: 0.6, 'qa-listing': 0.75, 'approval-queue': 0.9, done: 1 };
const r6 = (n) => Math.round((n || 0) * 1e6) / 1e6;
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return null; } };
const COLUMN_LABEL = { brief: 'brief', design: 'design', 'qa-design': 'qa-design', listing: 'listing', 'qa-listing': 'qa-listing', 'approval-queue': 'approval queue', done: 'done' };

function listFiles(dir, base = dir, out = [], max = 200) {
  if (!fs.existsSync(dir) || out.length >= max) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(f, base, out, max); else out.push(path.relative(base, f).replace(/\\/g, '/'));
    if (out.length >= max) break;
  }
  return out;
}

export function buildEngineSnapshot(engine, { now = Date.now(), host = {} } = {}) {
  const { store, ledger, cfg, halt, guard, J, providers } = engine;
  const warnings = [];
  const day = dublinDay(now), dayStart = dublinDayStart(now);
  const L = cfg.lines['room1-digital'];
  const agentsCfg = Object.values(cfg.agents);
  const nameOf = Object.fromEntries(agentsCfg.map((a) => [a.key, a.name]));
  const stepDef = (job, step) => { const l = cfg.lines[job.line]; return l && l.steps[step]; };
  const runs = store.runsOf({ limit: 500 });
  const running = runs.filter((r) => r.status === 'running');
  const halted = halt.isHalted();

  // ---- departments and desks: config/office.json (the owner's floor plan)
  const departments = (cfg.office.departments || []).map((d) => ({ id: d.key, key: d.key, name: d.name, rect: d.rect, agents: agentsCfg.filter((a) => String(a.department).toLowerCase() === d.key).map((a) => a.key), warnings: [], metrics: [], counts: { doing: 0, next: 0, done: 0 } }));
  const deptOf = Object.fromEntries(departments.flatMap((d) => d.agents.map((k) => [k, d])));

  // ---- columns: the line's agent stages in order, with the owner's column names
  const columns = [{ key: 'brief', label: 'brief', agentName: 'intake (brief checks)' }];
  for (const [step, def] of Object.entries(L.steps)) if (def.kind === 'agent' && def.column !== 'rejected' && !columns.some((c) => c.key === def.column)) columns.push({ key: def.column, label: COLUMN_LABEL[def.column] || def.column, agentName: nameOf[def.agent] || def.agent, agentId: def.agent, dock: null });
  columns.push({ key: 'approval-queue', label: 'approval queue', agentName: 'owner' }, { key: 'done', label: 'done', agentName: 'approved / published' });

  // ---- jobs
  const approvals = Object.fromEntries(store.listApprovals().map((a) => [a.job_id, a]));
  const jobs = store.listJobs().map((j) => {
    const dir = path.join(J.dataRoot, j.kind === 'research' ? 'research' : 'jobs', j.kind === 'research' ? '' : j.id);
    const def = stepDef(j, j.step) || {};
    const myRuns = runs.filter((r) => r.job_id === j.id).sort((a, b) => a.started_at - b.started_at);
    const out = { id: j.id, title: j.title || j.id, niche: null, slogan: null, briefStatus: null, priceRange: null, stage: def.column || 'brief', lane: null, status: 'backlog', flag: null, statusReason: j.reason, agentId: def.agent || null, hops: [], files: [], images: [], costUsd: r6(ledger.spent.job(j.id)), startedAt: j.started_at || j.created_at, updatedAt: j.updated_at, endedAt: j.ended_at || null, tracker: null, queue: null, warnings: [], synthetic: false, line: j.line, kind: j.kind, state: j.state, step: j.step, loops: j.loops, version: j.version };
    const brief = j.kind === 'research' ? '' : (() => { try { return fs.readFileSync(path.join(dir, 'brief.md'), 'utf8'); } catch (_) { return ''; } })();
    out.niche = (/^# Niche\s*\n([^\n]+)/m.exec(brief) || [])[1] || null;
    out.briefStatus = (/^status:\s*(\S+)/m.exec(brief) || [])[1] || null;
    if (j.state === 'running') out.status = 'in_progress';
    else if (j.state === 'queued') { out.status = 'backlog'; out.stage = j.step === 'intake' || !def.column ? 'brief' : def.column; }
    else if (j.state === 'approval') { out.stage = 'approval-queue'; out.status = 'waiting'; out.agentId = null; }
    else if (['approved', 'published', 'retired', 'research-done'].includes(j.state)) { out.stage = j.state === 'research-done' ? 'brief' : 'done'; out.status = 'done'; }
    else if (j.state === 'blocked' || j.state === 'stopped') { out.lane = 'blocked'; out.stage = 'blocked'; out.status = 'blocked'; out.flag = j.state === 'stopped' ? 'stopped' : null; out.qaPassedGateFailed = /^QA passed, package gate failed/.test(j.reason || ''); }
    else if (j.state === 'rejected' || j.state === 'rejected_by_owner') { out.lane = 'rejected'; out.stage = 'rejected'; out.status = 'rejected'; out.rejectedBy = j.state === 'rejected' ? 'rejects-desk' : 'owner'; }
    else if (j.state === 'parked') { out.lane = 'parked'; out.stage = 'parked'; out.status = 'parked'; }
    out.hops = myRuns.map((r, i) => ({ i, agentId: r.agent_key, agentName: nameOf[r.agent_key] || r.agent_key, stage: (stepDef(j, r.step) || {}).column || r.step, pass: r.pass, verdict: null, usd: r6(r.usd), ms: r.ended_at ? r.ended_at - r.started_at : null, output: r.status !== 'done' && r.status !== 'running' ? r.status + ': ' + (r.end_reason || r.error || '') : null, live: r.status === 'running', at: r.ended_at || r.started_at, runId: r.run_id }));
    const qa = (sub, re) => (fs.existsSync(path.join(dir, sub)) ? fs.readdirSync(path.join(dir, sub)).map((f) => re.exec(f)).filter(Boolean).map((m) => ({ n: Number(m[1]), rec: readJson(path.join(dir, sub, m[0])) })).sort((a, b) => a.n - b.n).map((p) => ({ pass: p.n, verdict: p.rec && p.rec.verdict, reasons: ((p.rec && p.rec.reasons) || []).slice(0, 3) })) : []);
    if (j.kind !== 'research') {
      out.qaDesign = qa('qa', /^design-pass(\d+)\.json$/); out.qaListing = qa('qa-listing', /^pass(\d+)\.json$/);
      // QA verdicts onto their hops, in order
      for (const [agent, list] of [['qa-design', out.qaDesign], ['qa-listing', out.qaListing]]) { let k = 0; for (const h of out.hops) if (h.agentId === agent && !h.live && list[k]) h.verdict = list[k++].verdict; }
      out.files = listFiles(dir).map((f) => 'jobs/' + j.id + '/' + f);
      const n = latestSet(J.dataRoot, j.id);
      for (let v = 1; v <= n; v++) { const fd = path.join(dir, 'set-v' + v, 'files'); if (fs.existsSync(fd)) for (const f of fs.readdirSync(fd).filter((x) => /\.(png|jpg)$/i.test(x)).sort()) out.images.push({ url: '/api/office/image/job/' + j.id + '/set-v' + v + '/' + f, file: 'set-v' + v + '/' + f, n: v, at: fs.statSync(path.join(fd, f)).mtimeMs }); }
      const lj = readJson(path.join(dir, 'outbox', 'listing.json'));
      if (lj) out.listing = { title: lj.title, tags: (lj.tags || []).length, priceEur: lj.listingPriceEur ?? null };
      const tr = store.getTracker(j.id); if (tr) out.tracker = { status: tr.status, status_reason: tr.status_reason, packaged_at: tr.packaged_at, cost_usd: tr.cost_usd, updated_at: tr.updated_at };
      const ap = approvals[j.id]; if (ap) { const mf = readJson(path.join(dir, 'package', 'MANIFEST.json')); out.queue = { status: ap.status, queuedAt: ap.queued_at, version: ap.version, costUsd: mf ? mf.costUsd : null, files: mf ? mf.files.length : null, folder: 'jobs/' + j.id + '/package/' }; }
    }
    const live = out.hops.find((h) => h.live);
    if (live) { out.agentId = live.agentId; out.statusReason = (nameOf[live.agentId] || live.agentId) + ' working, pass ' + live.pass; }
    else if (j.state === 'running' && def.kind === 'mechanical') out.statusReason = 'station step: ' + j.step + ' (no model)';
    out.progress = out.status === 'in_progress' || out.status === 'waiting' ? Math.round(100 * ((PROGRESS[out.stage] ?? 0.05) + (live ? 0.06 : 0))) : null;
    const stages = store.stagesOf(j.id); const lastStage = stages[stages.length - 1];
    // the newest closed stage and its note (the presenter's captions: why a job went back, was blocked or moved on)
    const closed = stages.filter((s) => s.status !== 'running').pop();
    out.lastStage = closed ? { step: closed.step, pass: closed.pass, status: closed.status, note: closed.reason || null, at: closed.ended_at } : null;
    const prod = cfg.products.find((x) => x.key === j.product_key);
    out.productFiles = prod && prod.deliverables && prod.deliverables.files ? prod.deliverables.files.length : null;
    out.stageChangedAt = (out.lane || out.status === 'done' || out.status === 'waiting' ? j.ended_at : null) || (lastStage ? lastStage.started_at : j.created_at);
    out.elapsedMs = out.startedAt ? Math.max(0, (j.ended_at || now) - out.startedAt) : null;
    out.agentName = out.agentId ? (nameOf[out.agentId] || out.agentId) : null;
    out.dept = out.agentId && deptOf[out.agentId] ? deptOf[out.agentId].key : null;
    out.stageLabel = COLUMN_LABEL[out.stage] || out.stage;
    out.folder = j.kind === 'research' ? 'research/' : 'jobs/' + j.id + '/';
    return out;
  }).sort((a, b) => (b.stageChangedAt || 0) - (a.stageChangedAt || 0));

  const board = { columns: columns.map((c) => ({ ...c, jobIds: jobs.filter((j) => !j.lane && j.stage === c.key).map((j) => j.id) })), lanes: { blocked: jobs.filter((j) => j.lane === 'blocked').map((j) => j.id), rejected: jobs.filter((j) => j.lane === 'rejected').map((j) => j.id), parked: jobs.filter((j) => j.lane === 'parked').map((j) => j.id) } };

  // ---- agents
  const rows = ledger.rows();
  const agents = agentsCfg.map((a) => {
    const st = store.agentState(a.key) || {}, enabled = st.enabled == null ? a.enabled !== false : !!st.enabled, tier = st.tier || a.tier, effort = st.effort || a.effort;
    const t = cfg.engine.tiers[tier] || {}, myRuns = runs.filter((r) => r.agent_key === a.key), last = myRuns[0] || null, live = running.find((r) => r.agent_key === a.key);
    const todayRows = rows.filter((r) => r.agentKey === a.key && dublinDay(r.ts) === day);
    let status = 'idle', statusText = enabled ? 'idle' : 'off duty';
    const liveJob = live ? jobs.find((j) => j.id === live.job_id) : null;
    if (live) { status = 'working'; statusText = 'working · ' + ((liveJob && liveJob.stageLabel) || live.step || '') + ' pass ' + (live.pass || 1); }
    else if (last && ['failed', 'refused', 'cap', 'max-turns'].includes(last.status)) { status = 'error'; statusText = 'error · ' + last.status + ': ' + String(last.end_reason || last.error || '').slice(0, 80); }
    const desk = cfg.office.desks && cfg.office.desks[a.key] ? { propId: a.key, ...cfg.office.desks[a.key], roomId: deptOf[a.key] ? deptOf[a.key].key : null, roomName: deptOf[a.key] ? deptOf[a.key].name : null } : null;
    if (!desk) warnings.push(a.name + ' has no desk in config/office.json');
    const myJobs = jobs.filter((j) => j.hops.some((h) => h.agentId === a.key));
    const imgJob = a.key === 'designer' ? myJobs.find((j) => j.images.length) : null;
    return {
      id: a.key, name: a.name, model: providers.mode === 'mock' ? 'mock (' + t.model + ')' : t.model, provider: providers.mode === 'mock' ? 'mock' : t.provider, role: a.role || '', modelSource: 'config/agents/' + a.key + '.json + config/engine.json tiers',
      color: a.color || null, gear: a.tools, tier, effort, enabled, warnings: [], dept: deptOf[a.key] ? deptOf[a.key].key : null, deptName: deptOf[a.key] ? deptOf[a.key].name : null, desk, status, statusText,
      since: live ? live.started_at : last ? (last.ended_at || last.started_at) : null, services: live ? [providers.mode === 'mock' ? 'mock' : t.provider] : [], synthetic: false, syntheticWhat: null,
      currentJob: liveJob ? { id: liveJob.id, stage: liveJob.stage, stageLabel: liveJob.stageLabel, status: liveJob.status, pass: live.pass } : null,
      lastOutput: last && last.status !== 'running' ? { text: last.status + (last.end_reason ? ' · ' + last.end_reason : '') + ' · ' + last.turns + ' turns · tools: ' + (last.tools.join(', ') || 'none'), at: last.ended_at, jobId: last.job_id } : null,
      spendToday: { usd: r6(todayRows.reduce((s, r) => s + r.usd, 0)), runs: new Set(todayRows.map((r) => r.runId)).size, date: day, label: 'calendar day ' + dmyOfDay(day) + ' (Dublin)' },
      lastRun: last ? { at: last.ended_at || last.started_at, reason: last.status, title: (last.step || '') + ' · ' + (last.job_id || ''), usd: last.usd } : null,
      recentJobs: myJobs.slice(0, 8).map((j) => j.id), latestImage: imgJob ? { ...imgJob.images[imgJob.images.length - 1], jobId: imgJob.id } : null, runsTotal: myRuns.length,
      overseer: a.key === 'overseer' ? { report: null, note: 'No report yet' } : null
    };
  });

  for (const d of departments) {
    d.agentCount = d.agents.length;
    d.counts.doing = jobs.filter((j) => j.status === 'in_progress' && j.dept === d.key).length;
    d.counts.next = jobs.filter((j) => (j.status === 'backlog' || j.status === 'waiting') && j.dept === d.key).length;
    d.counts.done = jobs.filter((j) => (j.status === 'done' || j.lane) && j.dept === d.key).length;
    const lineJobs = jobs.filter((j) => j.kind !== 'research');
    if (d.key === 'research') d.metrics = [{ label: 'research jobs', value: jobs.filter((j) => j.kind === 'research').length, source: 'engine store' }, { label: 'verified briefs', value: fs.existsSync(path.join(J.dataRoot, 'research', 'briefs')) ? fs.readdirSync(path.join(J.dataRoot, 'research', 'briefs')).length : 0, source: 'data/research/briefs' }];
    else if (d.key === 'design') { const all = lineJobs.flatMap((j) => j.qaDesign || []); d.metrics = [{ label: 'sets made', value: lineJobs.reduce((s, j) => s + new Set(j.images.map((i) => i.n)).size, 0), source: 'jobs/*/set-vN' }, { label: 'QA pass rate', value: all.length ? Math.round(100 * all.filter((p) => p.verdict === 'approved').length / all.length) + '%' : 'n/a', source: 'jobs/*/qa/design-passN.json' }]; }
    else d.metrics = [{ label: 'listings drafted', value: lineJobs.filter((j) => j.listing).length, source: 'jobs/*/outbox/listing.json' }, { label: 'approval queue', value: jobs.filter((j) => j.state === 'approval').length, source: 'approvals' }];
  }

  // ---- spend: the Dublin calendar day, from the engine's ledger, against the caps in config/engine.json
  const g = guard.status(), caps = cfg.engine.caps;
  const todayRows = rows.filter((r) => dublinDay(r.ts) === day);
  const spend = {
    today: { date: day, label: 'calendar day ' + dmyOfDay(day) + ' (Europe/Dublin)', usd: r6(g.spentToday), runs: new Set(todayRows.map((r) => r.runId)).size, rows: todayRows.length, byAgent: Object.fromEntries(agents.map((a) => [a.name, a.spendToday.usd])), source: ledger.label, mock: providers.mode === 'mock' },
    trailing24h: null, lineToday: [{ lineId: 'room1-digital', usd: r6(ledger.spent.lineDay('room1-digital', day)), day, label: 'line room1-digital, Dublin day' }],
    caps: { perDay: caps.perDayUsd, perJob: caps.perJobUsd, perRun: caps.perRunUsd, perLineDay: caps.perLineDayUsd, imagesPerDay: caps.imagesPerDay, source: 'config/engine.json' }, lineLimits: { maxHops: caps.maxHops },
    reservedNow: g.reservedNow, ledgerOk: g.ledgerOk, ledgerError: g.ledgerError,
    last7days: Array.from({ length: 7 }, (_, i) => { const d = dublinDay(dayStart - (6 - i) * 86400000 + 3600000); return { date: d, usd: r6(ledger.spent.day(d)) }; })
  };
  if (!g.ledgerOk) warnings.push('LEDGER UNREADABLE: every paid call is refused. ' + g.ledgerError);
  if (halted) warnings.unshift('E-STOP ON since ' + new Date(halt.state.at || now).toISOString() + ' (by ' + (halt.state.by || 'unknown') + '): no call can start');

  // ---- routines and the calendar (one entry per job, on the day of its latest stage change)
  const routines = store.listRoutines().map((r) => { const up = r.enabled ? nextRuns(r.schedule, 6, new Date(now)) : []; return { id: r.id, name: r.name, prompt: String(r.input || '').slice(0, 200), schedule: r.schedule, scheduleWords: cronWords(r.schedule) + ' (Dublin)', scheduleDisplay: r.schedule, agentId: r.target, agentName: r.target, dept: null, enabled: r.enabled, state: r.enabled ? 'scheduled' : 'paused', needsOk: !r.enabled, nextRun: up[0] || null, nextRunIsProjection: false, upcoming: up, ghostRuns: r.enabled ? [] : nextRuns(r.schedule, 6, new Date(now)), lastRunAt: r.last_fire_at, lastStatus: r.last_status, lastUsd: 0, live: false, version: r.version, source: 'engine routines' }; });
  const events = [];
  for (const j of jobs) if (j.stageChangedAt) events.push({ date: dublinDay(j.stageChangedAt), at: j.stageChangedAt, kind: 'job', jobId: j.id, title: j.title, stage: j.lane || j.stage, stageLabel: j.lane || j.stageLabel, status: j.status, dept: j.dept, agent: j.agentName, reason: j.statusReason, synthetic: false });
  for (const r of routines) for (const t of r.upcoming) events.push({ date: dublinDay(t), at: t, kind: 'routine', routineId: r.id, title: r.name, dept: null, agent: r.agentName, projected: false });
  events.sort((a, b) => a.at - b.at);

  // ---- services
  const mock = providers.mode === 'mock';
  const services = [
    { id: 'mock', label: 'Mock provider', kind: 'model', status: mock ? 'configured' : 'offline', detail: mock ? 'scripted replies and procedural images, $0; no key is read (E1–E5)' : 'not in use', source: 'STATION_PROVIDER' },
    { id: 'anthropic', label: 'Anthropic', kind: 'model', status: mock ? 'offline' : 'configured', detail: mock ? 'locked until E6 (owner go-ahead: billing Q1, caps Q2, products Q3)' : 'text and vision', source: 'config/engine.json tiers' },
    { id: 'openrouter', label: 'OpenRouter', kind: 'image', status: mock ? 'offline' : 'configured', detail: mock ? 'locked until E6' : 'image generation: ' + cfg.engine.image.allowedModels.join(', '), source: 'config/engine.json image' },
    { id: 'realesrgan', label: 'Real-ESRGAN', kind: 'local', status: 'offline', detail: 'not wired in the engine yet (packaged products fail closed; owner decision at E6)', source: 'PORTED.md' },
    { id: 'etsy', label: 'Etsy', kind: 'market', status: 'manual', detail: 'no API key; the owner publishes approved packages by hand', source: 'ENGINE-PLAN.md §5.3' }
  ];

  const lastRow = rows[rows.length - 1];
  const hub = { label: 'Station memory', notebooks: { entries: 0, byAgent: {}, lastRecalledBy: null, lastRecalledAt: null, source: 'none: agent memory is the prompt and the job folder (owner Q9)' }, ledger: { rows: rows.length, last: lastRow ? { at: lastRow.ts, agent: nameOf[lastRow.agentKey] || lastRow.agentKey, usd: lastRow.usd, model: lastRow.model } : null, source: ledger.label }, recent: [] };

  return {
    generatedAt: now, warnings, errors: [], sourcesRead: 0,
    source: { mode: 'engine', root: 'data/', snapshotAt: null, synthetic: [], legacy: false },
    engine: { state: halted ? 'halted' : 'running', label: halted ? 'E-STOP ON' : 'engine · ' + (mock ? 'mock provider' : 'live'), detail: halted ? 'every call is refused until you resume (typed confirmation)' : 'Station engine, data root ' + J.dataRoot + '; provider ' + providers.mode, halted, haltedBy: halted ? halt.state.by || null : null, provider: providers.mode, inFlight: g.inFlight, seq: engine.bus.seq, overridden: !!cfg.overridden },
    station: { name: 'Station', runtime: 'Station engine (Node ' + process.version + ')', host: host.label || null, provider: providers.mode },
    services, departments, agents, hub, jobs, board, stages: columns.filter((c) => !['brief', 'approval-queue', 'done'].includes(c.key)), columns, routines, events, spend
  };
}

