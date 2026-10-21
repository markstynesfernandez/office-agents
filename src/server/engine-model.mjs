// engine-model.mjs — turns the engine's own state (SQLite, ledger, job folders, config) into the office snapshot the page
// renders: the same shape the legacy view produces (model.mjs), so the 3D office, board, calendar and panels work on
// both. Read-only. Prompts, keys and provider responses never reach the snapshot.
import fs from 'node:fs';
import path from 'node:path';
import { building, SHARED, DEFAULT_BUSINESS } from '../engine/business.mjs';
import { dublinDay, dublinDayStart, dmyOfDay, dublinDateTime } from '../engine/time.mjs';
import { nextRuns } from '../engine/scheduler.mjs';
import { cronWords } from './model.mjs';
import { latestSet } from '../engine/lib/digital-prep.mjs';
import { loadLegacy, legacyJobView, legacyMemory } from './legacy-view.mjs';
import { roleLabel } from '../web/ui/role.js';
import { evidenceLevelOf, ownerSetsPriceOf } from '../engine/lib/scout-brief.mjs';
import { upscalerStatus } from '../engine/lib/upscaler-status.mjs';
import { formProducts } from '../engine/lib/owner-brief-form.mjs';

// L2: one line per engine event for a job's live status (the last 5 events in the job panel)
export function eventText(ev, nameOf = {}) {
  const d = ev.data || {}, who = ev.agentKey ? (nameOf[ev.agentKey] || ev.agentKey) : 'station', usd = (n) => 'USD ' + Number(n || 0).toFixed(4);
  switch (ev.type) {
    case 'job.created': return 'job created' + (d.by ? ' by ' + d.by : '');
    case 'job.stage': return d.waiting ? 'waits for ' + (d.waiting === 'owner-style-ref' ? 'your decision on file 1' : d.waiting) : d.restart ? 'restarted at ' + d.step : 'stage ' + (d.step || '?') + (d.pass > 1 ? ' pass ' + d.pass : '');
    case 'run.start': return who + ' started' + (d.step ? ' ' + d.step : '') + (d.pass > 1 ? ' pass ' + d.pass : '') + (d.model ? ' · ' + d.model : '');
    case 'run.tool': return who + ' · ' + (d.tool || 'tool') + (d.path ? ' ' + d.path : '');
    case 'run.end': return who + ' ' + (d.status || 'finished') + ' · ' + usd(d.usd) + (d.turns != null ? ' · ' + d.turns + ' turns' : '');
    case 'spend.row': return 'spend ' + usd(d.usd) + ' · ' + (d.kind || '') + (d.model ? ' · ' + d.model : '');
    case 'job.blocked': return 'blocked: ' + String(d.reason || '').slice(0, 160);
    case 'job.stopped': return 'stopped: ' + String(d.reason || '').slice(0, 160);
    case 'job.rejected': return 'rejected' + (d.by ? ' by ' + d.by : '');
    case 'job.queued-for-approval': return 'packaged: in the approval queue';
    case 'job.decided': return 'owner decision: ' + (d.action || '') + ' (' + (d.status || '') + ')';
    case 'owner.action': return 'owner: ' + (d.action || '');
    case 'action.refused': return 'refused: ' + String(d.error || '').slice(0, 160);
    case 'action.done': return 'done: ' + String(d.action || '').replace(/^\/api\//, '');
    default: return ev.type;
  }
}

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
  // B0 (owner, 21/10/2026): the building: each department, agent, job and routine carries its business and floor (the shared floor: 0)
  const B = engine.building || building(cfg), floorOf = (bid) => (bid === SHARED ? (B.shared.floor ?? 0) : (B.get(bid) || {}).floor ?? null);
  for (const d of departments) { d.businessId = B.ofDept(d.key); d.floor = floorOf(d.businessId); }

  // ---- columns: the line's agent stages in order, with the owner's column names
  const columns = [{ key: 'brief', label: 'brief', agentName: 'intake (brief checks)' }];
  for (const [step, def] of Object.entries(L.steps)) if (def.kind === 'agent' && def.column !== 'rejected' && !columns.some((c) => c.key === def.column)) columns.push({ key: def.column, label: COLUMN_LABEL[def.column] || def.column, agentName: nameOf[def.agent] || def.agent, agentId: def.agent, dock: null });
  columns.push({ key: 'approval-queue', label: 'approval queue', agentName: 'owner' }, { key: 'done', label: 'done', agentName: 'approved / published' });

  // ---- jobs
  const approvals = Object.fromEntries(store.listApprovals().map((a) => [a.job_id, a]));
  const recentByJob = {};   // L2: each job's newest engine events (the bus's ring buffer)
  for (const ev of (engine.bus && engine.bus.recent ? engine.bus.recent(1000) : [])) if (ev.jobId) (recentByJob[ev.jobId] = recentByJob[ev.jobId] || []).push(ev);
  const jobCapOf = (line) => ((cfg.engine.caps.perJobUsdByLine || {})[line] ?? cfg.engine.caps.perJobUsd);
  const LEG = loadLegacy(J.dataRoot);   // the imported legacy station (E4), or null before the first import
  const jobs = store.listJobs().map((j) => {
    if (j.legacy) return LEG ? legacyJobView(j, LEG, { nameOf, deptOf }) : null;
    const dir = path.join(J.dataRoot, j.kind === 'research' ? 'research' : 'jobs', j.kind === 'research' ? '' : j.id);
    const def = stepDef(j, j.step) || {};
    const myRuns = runs.filter((r) => r.job_id === j.id).sort((a, b) => a.started_at - b.started_at);
    const bizId = j.business_id || B.ofLine(j.line) || (j.legacy ? DEFAULT_BUSINESS : SHARED);
    const out = { businessId: bizId, floor: floorOf(bizId), id: j.id, title: j.title || j.id, niche: null, slogan: null, briefStatus: null, priceRange: null, stage: def.column || 'brief', lane: null, status: 'backlog', flag: null, statusReason: j.reason, agentId: def.agent || null, hops: [], files: [], images: [], costUsd: r6(ledger.spent.job(j.id)), startedAt: j.started_at || j.created_at, updatedAt: j.updated_at, endedAt: j.ended_at || null, tracker: null, queue: null, warnings: [], synthetic: false, line: j.line, kind: j.kind, state: j.state, step: j.step, loops: j.loops, version: j.version };
    const brief = j.kind === 'research' ? '' : (() => { try { return fs.readFileSync(path.join(dir, 'brief.md'), 'utf8'); } catch (_) { return ''; } })();
    out.niche = (/^# Niche\s*\n([^\n]+)/m.exec(brief) || [])[1] || null;
    out.briefStatus = (/^status:\s*(\S+)/m.exec(brief) || [])[1] || null;
    out.evidenceLevel = evidenceLevelOf(brief);   // owner decision 2 (17/10/2026): shown on the approval card ("indicative": genre briefs)
    out.ownerSetsPrice = ownerSetsPriceOf(brief);   // E7a (owner, 19/10/2026): "owner sets price" on the approval card
    if (j.state === 'running') out.status = 'in_progress';
    else if (j.state === 'queued') { out.status = 'backlog'; out.stage = j.step === 'intake' || !def.column ? 'brief' : def.column; }
    else if (j.state === 'approval') {
      // the owner's decision lives in the approvals row only (E5: a decision writes no job row)
      const ap = approvals[j.id], d = (ms) => dmyOfDay(dublinDay(ms));
      if (ap && ap.status === 'approved') { out.stage = 'done'; out.status = 'done'; out.agentId = null; out.statusReason = 'approved by the owner ' + d(ap.decided_at) + '; publish on Etsy by hand'; }
      else if (ap && ap.status === 'published') { out.stage = 'done'; out.status = 'done'; out.agentId = null; out.statusReason = 'published ' + d(ap.published_at) + (ap.etsy_url ? ' · ' + ap.etsy_url : ''); }
      else if (ap && ap.status === 'rejected_by_owner') { out.lane = 'rejected'; out.stage = 'rejected'; out.status = 'rejected'; out.rejectedBy = 'owner'; out.agentId = null; out.statusReason = 'rejected by the owner: ' + (ap.reason || ''); }
      else { out.stage = 'approval-queue'; out.status = 'waiting'; out.agentId = null; }
    }
    else if (['approved', 'published', 'retired', 'research-done'].includes(j.state)) { out.stage = j.state === 'research-done' ? 'brief' : 'done'; out.status = 'done'; }
    else if (j.state === 'blocked' || j.state === 'stopped' || j.state === 'incomplete') { out.lane = 'blocked'; out.stage = 'blocked'; out.status = j.state === 'incomplete' ? 'incomplete' : 'blocked'; out.flag = j.state === 'stopped' ? 'stopped' : j.state === 'incomplete' ? 'incomplete' : null; out.qaPassedGateFailed = /^QA passed, package gate failed/.test(j.reason || ''); }
    else if (j.state === 'rejected' || j.state === 'rejected_by_owner') { out.lane = 'rejected'; out.stage = 'rejected'; out.status = 'rejected'; out.rejectedBy = j.state === 'rejected' ? 'rejects-desk' : 'owner'; }
    else if (j.state === 'parked') { out.lane = 'parked'; out.stage = 'parked'; out.status = 'parked'; }
    else if (j.state === 'archived') { out.stage = 'archived'; out.status = 'archived'; out.agentId = null; }
    out.hops = myRuns.map((r, i) => ({ i, agentId: r.agent_key, agentName: nameOf[r.agent_key] || r.agent_key, stage: (stepDef(j, r.step) || {}).column || r.step, pass: r.pass, verdict: null, usd: r6(r.usd), ms: r.ended_at ? r.ended_at - r.started_at : null, output: r.status !== 'done' && r.status !== 'running' ? r.status + ': ' + (r.end_reason || r.error || '') : null, live: r.status === 'running', at: r.ended_at || r.started_at, runId: r.run_id }));
    const qa = (sub, re) => (fs.existsSync(path.join(dir, sub)) ? fs.readdirSync(path.join(dir, sub)).map((f) => re.exec(f)).filter(Boolean).map((m) => ({ n: Number(m[1]), rec: readJson(path.join(dir, sub, m[0])) })).sort((a, b) => a.n - b.n).map((p) => ({ pass: p.n, verdict: p.rec && p.rec.verdict, reasons: ((p.rec && p.rec.reasons) || []).slice(0, 3) })) : []);
    if (j.kind !== 'research') {
      out.qaDesign = qa('qa', /^design-pass(\d+)\.json$/); out.qaListing = qa('qa-listing', /^pass(\d+)\.json$/); out.qaFile1 = qa('qa', /^file1-pass(\d+)\.json$/);
      // QA verdicts onto their hops, in order
      for (const [agent, list] of [['qa-design', out.qaDesign], ['qa-listing', out.qaListing]]) { let k = 0; for (const h of out.hops) if (h.agentId === agent && !h.live && list[k]) h.verdict = list[k++].verdict; }
      out.files = listFiles(dir).map((f) => 'jobs/' + j.id + '/' + f);
      const n = latestSet(J.dataRoot, j.id);
      // L2: a packaged product's set-vN/files/ holds its zip, so its pictures are the built PNGs in set-vN/build/; setsBuilt counts every set
      // the station built (a files/ folder with anything in it), whatever the product
      out.setsBuilt = 0;
      for (let v = 1; v <= n; v++) {
        const fd = path.join(dir, 'set-v' + v, 'files'), bd = path.join(dir, 'set-v' + v, 'build'), inFiles = fs.existsSync(fd) ? fs.readdirSync(fd) : [];
        if (inFiles.length) out.setsBuilt++;
        const pics = inFiles.filter((x) => /\.(png|jpg)$/i.test(x)).sort(), useBuild = !pics.length && fs.existsSync(bd), from = useBuild ? bd : fd, sub = useBuild ? 'build/' : '';
        for (const f of (useBuild ? fs.readdirSync(bd).filter((x) => /^[a-z0-9][a-z0-9._-]*\.png$/.test(x)).sort() : pics)) out.images.push({ url: '/api/office/image/job/' + j.id + '/set-v' + v + '/' + sub + f, file: 'set-v' + v + '/' + sub + f, n: v, at: fs.statSync(path.join(from, f)).mtimeMs });
      }
      // W4 (owner, 21/10/2026): the job panel's Designs show every file of the newest built set (thumbnails with their names)
      const nb = out.images.reduce((m, im) => Math.max(m, im.n), 0);
      out.designSet = nb ? { set: nb, images: out.images.filter((im) => im.n === nb).map((im) => ({ url: im.url, file: im.file, name: im.file.split('/').pop() })) } : null;
      const lj = readJson(path.join(dir, 'outbox', 'listing.json'));
      if (lj) out.listing = { title: lj.title, tags: (lj.tags || []).length, priceEur: lj.listingPriceEur ?? null };
      const tr = store.getTracker(j.id); if (tr) out.tracker = { status: tr.status, status_reason: tr.status_reason, packaged_at: tr.packaged_at, cost_usd: tr.cost_usd, updated_at: tr.updated_at };
      const ap = approvals[j.id]; if (ap) { const mf = readJson(path.join(dir, 'package', 'MANIFEST.json')); out.queue = { status: ap.status, queuedAt: ap.queued_at, decidedAt: ap.decided_at || null, reason: ap.reason || null, publishedAt: ap.published_at || null, etsyUrl: ap.etsy_url || null, version: ap.version, costUsd: mf ? mf.costUsd : null, files: mf ? mf.files.length : null, folder: 'jobs/' + j.id + '/package/', folderAbs: path.join(J.dataRoot, 'jobs', j.id, 'package') }; }
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
    // the buttons this job offers on the page (each action checks again on the server)
    out.controls = engine.orchestrator ? engine.orchestrator.controlsFor(j) : {};
    // the owner's decisions (overrides of QA verdicts per file with date and reason, set and listing approvals): shown on the job
    if (!j.legacy && j.kind === 'line' && engine.owner) { try { out.owner = engine.owner.summary(j.id); } catch (_) { out.owner = null; } }
    if (j.state === 'archived') out.statusReason = j.reason;
    if (j.state === 'queued' && j.data && j.data.waitingFor) out.waitingFor = j.data.waitingFor;
    // L2: queued to start by itself when a running job ends (at most runtime.maxRunningJobs at once)
    out.next = j.state === 'queued' && !!(j.data && j.data.next && j.data.autoStart && !j.data.waitingFor);
    // L2: the live status: the stage, the agent at work, spend so far against the job's cap, the last 5 events
    if (j.kind !== 'legacy') out.liveStatus = { running: j.state === 'running', stage: out.stageLabel, step: j.step, agent: live ? live.agentName : (def.kind === 'mechanical' && j.state === 'running' ? 'station step (no model)' : null), spendUsd: out.costUsd, capUsd: jobCapOf(j.line), events: (recentByJob[j.id] || []).slice(-5).map((e) => ({ seq: e.seq, at: e.ts, type: e.type, text: eventText(e, nameOf) })) };
    // L2: the owner's decision on file 1 (ownerFile1): the review images of the set it waits on
    const aw = j.state === 'queued' && j.data && j.data.waitingFor === 'owner-style-ref' && j.data.styleRef && j.data.styleRef.awaiting;
    if (aw) { const rd = path.join(dir, 'set-v' + aw.set, 'review'); out.file1Review = { set: aw.set, images: fs.existsSync(rd) ? fs.readdirSync(rd).filter((x) => /^[a-z0-9][a-z0-9._-]*\.png$/.test(x)).sort().map((f) => ({ url: '/api/office/image/job/' + j.id + '/set-v' + aw.set + '/review/' + f, file: 'set-v' + aw.set + '/review/' + f })) : [] }; }
    return out;
  }).filter(Boolean).sort((a, b) => (b.stageChangedAt || 0) - (a.stageChangedAt || 0));

  // E5 item 0b: imported legacy jobs never sit in a stage column (an unfinished legacy job is not in progress here) or in
  // the engine's lanes; they all go to the Legacy lane. Archived engine jobs leave the board (the task list's Archived chip).
  const own = jobs.filter((j) => j.kind !== 'legacy' && j.state !== 'archived');
  const board = { columns: columns.map((c) => ({ ...c, jobIds: own.filter((j) => !j.lane && j.stage === c.key).map((j) => j.id) })), lanes: { blocked: own.filter((j) => j.lane === 'blocked').map((j) => j.id), rejected: own.filter((j) => j.lane === 'rejected').map((j) => j.id), parked: own.filter((j) => j.lane === 'parked').map((j) => j.id), legacy: jobs.filter((j) => j.kind === 'legacy').map((j) => j.id) } };

  // ---- agents
  const rows = ledger.rows();
  // L3 (owner, 20/10/2026): two jobs may run at once (one per line). An agent with a step in ANY running job (its live run, or the job's
  // current agent step) sits at its desk; the lounge is for agents with no step in any running job (the office's wantPlace)
  const stepJobs = {};
  for (const j of jobs.filter((x) => x.kind !== 'legacy' && x.state === 'running')) {
    const def = stepDef(j, j.step) || {}, keys = new Set([...(def.kind === 'agent' && def.agent ? [def.agent] : []), ...j.hops.filter((h) => h.live).map((h) => h.agentId)]);
    for (const k of keys) (stepJobs[k] = stepJobs[k] || []).push(j.id);
  }
  const agents = agentsCfg.map((a) => {
    const st = store.agentState(a.key) || {}, version = st.version || 0, enabled = st.enabled == null ? a.enabled !== false : !!st.enabled, tier = st.tier || a.tier, effort = st.effort || a.effort;
    const t = cfg.engine.tiers[tier] || {}, myRuns = runs.filter((r) => r.agent_key === a.key), last = myRuns[0] || null, live = running.find((r) => r.agent_key === a.key), lives = running.filter((r) => r.agent_key === a.key);
    const todayRows = rows.filter((r) => r.agentKey === a.key && dublinDay(r.ts) === day);
    let status = 'idle', statusText = enabled ? 'idle' : 'off duty';
    const liveJob = live ? jobs.find((j) => j.id === live.job_id) : null;
    if (live) { status = 'working'; statusText = 'working · ' + ((liveJob && liveJob.stageLabel) || live.step || '') + ' pass ' + (live.pass || 1); }
    else if (last && ['failed', 'refused', 'cap', 'max-turns'].includes(last.status)) { status = 'error'; statusText = 'error · ' + last.status + ': ' + String(last.end_reason || last.error || '').slice(0, 80); }
    const desk = cfg.office.desks && cfg.office.desks[a.key] ? { propId: a.key, ...cfg.office.desks[a.key], roomId: deptOf[a.key] ? deptOf[a.key].key : null, roomName: deptOf[a.key] ? deptOf[a.key].name : null } : null;
    if (!desk) warnings.push(a.name + ' has no desk in config/office.json');
    const myJobs = jobs.filter((j) => j.hops.some((h) => h.agentId === a.key));
    const imgJob = a.key === 'designer' ? myJobs.find((j) => j.images.length) : null;
    const aBiz = B.ofAgent(a.key) || SHARED;
    return {
      businessId: aBiz, floor: floorOf(aBiz),
      id: a.key, name: a.name, model: providers.mode === 'mock' ? 'mock (' + t.model + ')' : t.model, provider: providers.mode === 'mock' ? 'mock' : t.provider, role: roleLabel(a.role, { dept: deptOf[a.key] ? deptOf[a.key].name : null, name: a.name }), modelSource: 'config/agents/' + a.key + '.json + config/engine.json tiers',
      color: a.color || null, gear: a.tools, tier, effort, enabled, version, tierModel: t.model || null, warnings: [], dept: deptOf[a.key] ? deptOf[a.key].key : null, deptName: deptOf[a.key] ? deptOf[a.key].name : null, desk, status, statusText,
      since: live ? live.started_at : last ? (last.ended_at || last.started_at) : null, services: live ? [providers.mode === 'mock' ? 'mock' : t.provider] : [], synthetic: false, syntheticWhat: null,
      currentJob: liveJob ? { id: liveJob.id, stage: liveJob.stage, stageLabel: liveJob.stageLabel, status: liveJob.status, pass: live.pass } : null,
      // L3: every running job this agent has a step in (EVIDENCE-CHECKER can work on the research and the genre-scout line at once)
      currentJobs: lives.map((r) => r.job_id).filter(Boolean), onStep: !!stepJobs[a.key], stepJobs: stepJobs[a.key] || [], place: stepJobs[a.key] ? 'desk' : 'lounge',
      lastOutput: last && last.status !== 'running' ? { text: last.status + (last.end_reason ? ' · ' + last.end_reason : '') + ' · ' + last.turns + ' turns · tools: ' + (last.tools.join(', ') || 'none'), at: last.ended_at, jobId: last.job_id } : null,
      spendToday: { usd: r6(todayRows.reduce((s, r) => s + r.usd, 0)), runs: new Set(todayRows.map((r) => r.runId)).size, date: day, label: 'calendar day ' + dmyOfDay(day) + ' (Dublin)' },
      lastRun: last ? { at: last.ended_at || last.started_at, reason: last.status, title: (last.step || '') + ' · ' + (last.job_id || ''), usd: last.usd } : null,
      recentJobs: myJobs.slice(0, 8).map((j) => j.id), latestImage: imgJob ? { ...imgJob.images[imgJob.images.length - 1], jobId: imgJob.id } : null, runsTotal: myRuns.length,
      overseer: a.key === 'overseer' ? { report: null, note: 'No report yet' } : null
    };
  });

  for (const d of departments) {
    d.agentCount = d.agents.length;
    const ownJobs = jobs.filter((j) => j.kind !== 'legacy');   // current work only; legacy history is on the board and in the job panels
    d.counts.doing = ownJobs.filter((j) => j.status === 'in_progress' && j.dept === d.key).length;
    d.counts.next = ownJobs.filter((j) => (j.status === 'backlog' || j.status === 'waiting') && j.dept === d.key).length;
    d.counts.done = ownJobs.filter((j) => (j.status === 'done' || j.lane) && j.dept === d.key).length;
    const lineJobs = jobs.filter((j) => j.kind !== 'research' && j.kind !== 'legacy');   // engine work only; legacy history is not counted here
    if (d.key === 'research') d.metrics = [{ label: 'research jobs', value: jobs.filter((j) => j.kind === 'research').length, source: 'engine store' }, { label: 'verified', value: fs.existsSync(path.join(J.dataRoot, 'research', 'briefs')) ? fs.readdirSync(path.join(J.dataRoot, 'research', 'briefs')).length : 0, source: 'data/research/briefs' }];
    else if (d.key === 'design') {
      // L2 fix: sets counted from set-vN/files/ whatever it holds (a packaged product's zip too: the card showed 0 sets with the autumn job
      // done), and the QA pass rate over every QA DESIGN verdict on disk, set reviews and file-1 checks, from all line jobs
      const all = lineJobs.flatMap((j) => [...(j.qaDesign || []), ...(j.qaFile1 || [])]), ok = all.filter((p) => p.verdict === 'approved').length;
      d.metrics = [{ label: 'sets made', value: lineJobs.reduce((s, j) => s + (j.setsBuilt || 0), 0), source: 'jobs/*/set-vN/files (built sets)' }, { label: 'QA pass rate', value: all.length ? Math.round(100 * ok / all.length) + '% (' + ok + ' of ' + all.length + ')' : 'n/a', source: 'jobs/*/qa/design-passN.json + file1-passN.json' }];
    }
    // B0: the shared floor's departments: Finance (the station's spend this Dublin month, the businesses' budgets), Compliance (the
    // screens every business inherits), OVERSEER (its daily reports)
    else if (d.key === 'finance') { const mo = day.slice(0, 7); d.metrics = [{ label: 'month (station)', value: '$' + r6(rows.filter((x) => dublinDay(x.ts).slice(0, 7) === mo).reduce((s, x) => s + (Number(x.usd) || 0), 0)).toFixed(2), source: ledger.label }, { label: 'budgets', value: B.list.length + ' business' + (B.list.length === 1 ? '' : 'es'), source: 'config/businesses' }]; }
    else if (d.key === 'compliance') d.metrics = [{ label: 'blocklist terms', value: (cfg.blocklist || []).length, source: 'config/blocklist.txt' }, { label: 'other-company markers', value: ((cfg.building || {}).foreignDataMarkers || []).length, source: 'config/building.json' }];
    else if (d.key === 'overseer') d.metrics = [{ label: 'daily reports', value: 0, source: 'none yet' }, { label: 'businesses', value: B.list.length, source: 'config/businesses' }];
    else d.metrics = [{ label: 'listings drafted', value: lineJobs.filter((j) => j.listing).length, source: 'jobs/*/outbox/listing.json' }, { label: 'approval queue', value: jobs.filter((j) => j.state === 'approval').length, source: 'approvals' }];
  }

  // ---- spend: the Dublin calendar day, from the engine's ledger, against the caps in config/engine.json
  const g = guard.status(), caps = cfg.engine.caps;
  const todayRows = rows.filter((r) => dublinDay(r.ts) === day);
  const spend = {
    today: { date: day, label: 'calendar day ' + dmyOfDay(day) + ' (Europe/Dublin)', usd: r6(g.spentToday), runs: new Set(todayRows.map((r) => r.runId)).size, rows: todayRows.length, byAgent: Object.fromEntries(agents.map((a) => [a.name, a.spendToday.usd])), source: ledger.label, mock: providers.mode === 'mock' },
    trailing24h: null, lineToday: [{ lineId: 'room1-digital', usd: r6(ledger.spent.lineDay('room1-digital', day)), day, label: 'line room1-digital, Dublin day' }],
    caps: { perDay: caps.perDayUsd, perJob: caps.perJobUsd, perJobByLine: caps.perJobUsdByLine || {}, perRun: caps.perRunUsd, perLineDay: caps.perLineDayUsd, imagesPerDay: caps.imagesPerDay, source: 'config/engine.json' }, lineLimits: { maxHops: caps.maxHops },
    reservedNow: g.reservedNow, ledgerOk: g.ledgerOk, ledgerError: g.ledgerError,
    // live spend against each cap that applies today; warn from 80% (config/engine.json; caps are edited there only)
    capStatus: [{ cap: 'perDay', label: 'station day', used: r6(g.spentToday), limit: caps.perDayUsd }, ...Object.keys(cfg.lines).map((l) => ({ cap: 'perLineDay[' + l + ']', label: 'line ' + l + ' day', used: r6(ledger.spent.lineDay(l, day)), limit: (caps.perLineDayUsd || {})[l] ?? (caps.perLineDayUsd || {}).default ?? 0 }))].filter((c) => c.limit > 0).map((c) => ({ ...c, pct: Math.round(1000 * c.used / c.limit) / 10, level: c.used >= c.limit ? 'hit' : c.used >= 0.8 * c.limit ? 'warn' : 'ok' })),
    last7days: Array.from({ length: 7 }, (_, i) => { const d = dublinDay(dayStart - (6 - i) * 86400000 + 3600000); return { date: d, usd: r6(ledger.spent.day(d)) }; })
  };
  // B0: spend per business: today (Dublin day) and this Dublin month against its monthly budget (and its own day cap, when set)
  const month = day.slice(0, 7);
  spend.byBusiness = [...B.list.map((b) => ({ id: b.id, name: b.name, floor: b.floor, todayUsd: r6(ledger.spent.businessDay(b.id, day)), monthUsd: r6(ledger.spent.businessMonth(b.id, month)), budgetUsd: b.monthlyBudgetUsd, dayCapUsd: b.dailyCapUsd || null, month })),
    { id: SHARED, name: B.shared.name || 'Shared services', floor: B.shared.floor ?? 0, todayUsd: r6(ledger.spent.businessDay(SHARED, day)), monthUsd: r6(ledger.spent.businessMonth(SHARED, month)), budgetUsd: null, dayCapUsd: null, month }];
  for (const b of spend.byBusiness) if (b.budgetUsd && b.monthUsd >= 0.8 * b.budgetUsd) warnings.push((b.monthUsd >= b.budgetUsd ? 'BUDGET REACHED: ' : 'Budget warning: ') + b.name + ' ' + b.monthUsd.toFixed(2) + ' of ' + b.budgetUsd.toFixed(2) + ' USD this month');
  if (!g.ledgerOk) warnings.push('LEDGER UNREADABLE: every paid call is refused. ' + g.ledgerError);
  for (const c of spend.capStatus) if (c.level !== 'ok') warnings.push((c.level === 'hit' ? 'CAP REACHED: ' : 'Cap warning: ') + c.label + ' ' + c.used.toFixed(2) + ' of ' + c.limit.toFixed(2) + ' USD (' + c.pct + '%)' + (c.level === 'hit' ? '; new calls on it are refused' : ''));
  // the legacy station's spend: imported history on its own keys, never counted in the engine's caps
  spend.legacy = LEG ? { rows: LEG.ledger.length, usd: LEG.ledgerUsd, source: 'data/legacy/ledger.jsonl (imported ' + (LEG.importedAt || '?') + ')', note: 'legacy station spend; not counted in the engine caps' } : null;
  const legacyConflicts = jobs.filter((j) => j.kind === 'legacy' && j.warnings.length).length;
  if (legacyConflicts) warnings.push(legacyConflicts + ' legacy job' + (legacyConflicts > 1 ? 's have' : ' has') + ' sources that disagree (tracker vs rejected/), imported as they are; open a job for details');
  if (halted) warnings.unshift('E-STOP ON since ' + dublinDateTime(halt.state.at || now) + ' (by ' + (halt.state.by || 'unknown') + '): no call can start');

  // ---- routines and the calendar (one entry per job, on the day of its latest stage change)
  const routines = store.listRoutines().map((r) => { const up = r.enabled ? nextRuns(r.schedule, 6, new Date(now)) : []; const rb = r.business_id || B.ofLine((/^line:(.+)$/.exec(r.target || '') || [])[1]) || (r.legacy ? DEFAULT_BUSINESS : SHARED); return { businessId: rb, floor: floorOf(rb), id: r.id, name: r.name, prompt: String(r.input || '').slice(0, 200), input: String(r.input || '').slice(0, 2000), target: r.target, maxRunsPerDay: r.max_runs_per_day, perRunCapUsd: r.per_run_cap_usd, legacy: r.legacy, runnable: !r.legacy && (engine.routineTargets || []).some((t) => t.id === r.target), schedule: r.schedule, scheduleWords: cronWords(r.schedule) + ' (Dublin)', scheduleDisplay: r.schedule, agentId: r.target, agentName: r.legacy && /^legacy:agent:/.test(r.target) ? (nameOf[r.target.slice(13)] || r.target.slice(13)) + ' (legacy)' : r.target, dept: null, enabled: r.enabled, state: r.enabled ? 'scheduled' : 'paused', needsOk: !r.enabled, nextRun: up[0] || null, nextRunIsProjection: false, upcoming: up, ghostRuns: r.enabled ? [] : nextRuns(r.schedule, 6, new Date(now)), lastRunAt: r.last_fire_at, lastStatus: r.last_status, lastUsd: 0, live: false, version: r.version, source: 'engine routines' }; });
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
    // L2: from the pin, the Vulkan loader and the GPU pick (lib/upscaler-status.mjs); the reason is in the tooltip when it is red
    (() => { const u = upscalerStatus({ ...(cfg.engine.upscale || {}), gpuId: ((cfg.station && cfg.station.upscale) || {}).gpuId ?? null }); return { id: 'realesrgan', label: 'Real-ESRGAN', kind: 'local', status: u.status, detail: u.detail, reason: u.reason, source: 'config/engine.json upscale (pinned)' }; })(),
    { id: 'etsy', label: 'Etsy', kind: 'market', status: 'manual', detail: 'own shop, read only (E7a): connect and list the live listings from the Etsy button; the owner publishes approved packages by hand', source: 'ENGINE-PLAN.md §5.3; DECISIONS.md E7a' }
  ];

  const lastRow = rows[rows.length - 1];
  // engine agents keep no memory beyond the prompt and the job folder (owner Q9); the notebooks shown are the imported
  // legacy history, read only
  const mem = legacyMemory(LEG);
  const hub = { label: 'Station memory', notebooks: mem ? { entries: mem.entries, byAgent: mem.byAgent, lastRecalledBy: mem.lastRecalledBy, lastRecalledAt: mem.lastRecalledAt, source: mem.source + '; engine agents: none (owner Q9)', legacy: true } : { entries: 0, byAgent: {}, lastRecalledBy: null, lastRecalledAt: null, source: 'none: agent memory is the prompt and the job folder (owner Q9)' }, ledger: { rows: rows.length, last: lastRow ? { at: lastRow.ts, agent: nameOf[lastRow.agentKey] || lastRow.agentKey, usd: lastRow.usd, model: lastRow.model } : null, source: ledger.label }, legacyLedger: LEG ? { rows: LEG.ledger.length, usd: LEG.ledgerUsd, source: 'data/legacy/ledger.jsonl' } : null, recent: mem ? mem.recent : [] };

  return {
    generatedAt: now, warnings, errors: [], sourcesRead: 0,
    // L1: which Station this is (live | dev) and the commit it runs; null for an engine not started by npm start (demo, dry run)
    instance: engine.instance ? { name: engine.instance.name, commit: engine.instance.commit } : null,
    source: { mode: 'engine', root: 'data/', snapshotAt: null, synthetic: [], legacy: false },
    engine: { state: halted ? 'halted' : 'running', label: halted ? 'E-STOP ON' : 'engine · ' + (mock ? 'mock provider' : 'live'), detail: halted ? 'every call is refused until you resume (typed confirmation)' : 'Station engine, data root ' + J.dataRoot + '; provider ' + providers.mode, halted, haltedBy: halted ? halt.state.by || null : null, haltedAt: halted ? halt.state.at || null : null, provider: providers.mode, inFlight: g.inFlight, seq: engine.bus.seq, overridden: !!cfg.overridden },
    station: { name: 'Station', runtime: 'Station engine (Node ' + process.version + ')', host: host.label || null, provider: providers.mode },
    // B0: the building: its floors (the shared floor 0 with the lounge, then one per business) and what each floor holds
    building: { floors: B.floors().map((fl) => ({ ...fl, lounge: !!fl.shared && (B.shared.lounge !== false), lines: fl.shared ? [] : ((B.get(fl.id) || {}).lines || []), agents: agents.filter((a) => a.businessId === fl.id).map((a) => a.id), empty: !fl.shared && !((B.get(fl.id) || {}).lines || []).length })), sharedId: SHARED },
    services, departments, agents, hub, jobs, board, stages: columns.filter((c) => !['brief', 'approval-queue', 'done'].includes(c.key)), columns, routines, events, spend,
    // E5: what the page's controls may offer (the server checks every action again)
    controls: { live: true, haltVersion: halt.state.at || 0, tiers: Object.entries(cfg.engine.tiers).map(([k, t]) => ({ key: k, model: t.model })), effortLevels: cfg.engine.effortLevels || [], routineTargets: (engine.routineTargets || []).map((t) => ({ id: t.id, label: t.label })), perRunCapUsd: caps.perRunUsd, today: day },
    briefs: engine.orchestrator ? engine.orchestrator.verifiedBriefs().map((b) => ({ file: b.file, id: b.id, niche: b.niche, status: b.status, product: b.product, jobId: b.jobId, legacy: b.legacy })) : [],
    // L2: the owner brief form (products.json: the file count from the spec, the floor, whether file 1 is a style reference) and the job limit
    ownerBriefForm: { products: formProducts(cfg.products, cfg.station), today: day },
    jobLimit: { maxRunning: engine.maxRunningJobs || null, perLine: Object.fromEntries(Object.values(cfg.lines).map((l) => [l.id, l.maxConcurrentJobs || 1])), running: jobs.filter((j) => j.kind !== 'legacy' && j.state === 'running').map((j) => j.id), next: jobs.filter((j) => j.next).map((j) => j.id) }
  };
}

