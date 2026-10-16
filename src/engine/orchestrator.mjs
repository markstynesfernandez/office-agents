// orchestrator.mjs — runs the lines written in config/lines/*.json (ENGINE-PLAN.md §3). A job moves step by step;
// every move is written to SQLite (job row + stage row, one transaction) before its event goes out.
//   agent steps       one run of one agent (runtime.mjs); QA steps route on the verdict from submit_verdict (one channel)
//   mechanical steps  station code, no model, no cost, fail closed: intake, prep, price fill, package gate, package
//   loops             design: max 2 sends back (3 reviews), then REJECTS-DESK; listing: max 1, then REJECTS-DESK (owner Q4)
//   hops              agent steps entered outside a loop count; maxHops from the line; a non-loop re-entry is refused
// No job starts from a file appearing anywhere: only startJob() (the owner's click, an enabled routine, or a re-run).
// One job per line at a time (owner Q12); a second one waits in `queued`.
import fs from 'node:fs';
import path from 'node:path';
import { runAgent } from './runtime.mjs';
import { checkBrief, briefField } from './lib/brief-check.mjs';
import { prepareDigitalSet, latestSet } from './lib/digital-prep.mjs';
import { fillDigitalPrices } from './lib/digital-prices.mjs';
import { checkPackage } from './lib/gates.mjs';
import { isListingId, sha256 } from './lib/common.mjs';
import { hitLine } from './lib/originality.mjs';
import { publicView } from './lib/digital-files.mjs';
import { canonicalDesignFile } from './tools/index.mjs';
import { COLUMNS as LEGACY_COLUMNS } from '../lib/legacy-readers/tracker.mjs';
import { dublinDay } from './time.mjs';

// the listing record: the legacy listings.csv columns, with print_files renamed deliverables (ENGINE-PLAN.md §4.1)
export const TRACKER_COLUMNS = LEGACY_COLUMNS.map((c) => (c === 'print_files' ? 'deliverables' : c));
export const TERMINAL = ['approval', 'blocked', 'rejected', 'stopped', 'approved', 'rejected_by_owner', 'published', 'parked', 'retired', 'research-done'];

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return null; } };
const niche = (t) => { const m = /^# Niche\s*\n([^\n]+)/m.exec(t || ''); return m ? m[1].trim() : ''; };
const titleOf = (id) => id.slice(12).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function createOrchestrator(engine, { hooks = {} } = {}) {
  const { store, bus, log, cfg, J, halt, ledger } = engine;
  // observer hooks (the dry run's screenshots): a failing hook is logged and never changes the job
  const callHook = async (name, arg) => { if (!hooks[name]) return; try { await hooks[name](arg); } catch (e) { log.warn('hook failed (ignored)', { hook: name, error: e.message }); } };
  const dataRoot = J.dataRoot;
  const jobDir = (id) => path.join(dataRoot, 'jobs', id);
  const active = new Map();   // line id -> { jobId, promise }

  function lineOf(id) { const l = cfg.lines[id]; if (!l) throw new Error('no such line: ' + id); return l; }
  function trackerRow(job, patch) {
    const cur = store.getTracker(job.id) || {};
    const brief = readBrief(job.id);
    const row = { ...Object.fromEntries(TRACKER_COLUMNS.map((c) => [c, ''])), ...cur, listing_id: job.id, room: job.line, niche: niche(brief), product_key: job.product_key || '', brief_date: job.id.slice(0, 10), cost_usd: String(ledger.spent.job(job.id).toFixed(6)), updated_at: new Date().toISOString(), ...patch };
    delete row.legacy;
    store.upsertTracker(job.id, row);
  }
  const readBrief = (id) => { try { return fs.readFileSync(path.join(jobDir(id), 'brief.md'), 'utf8'); } catch (_) { return ''; } };

  // ---- state changes: written first, event after
  function setJob(id, patch, event, data = {}) {
    const j = store.updateJob(id, patch);
    if (event) bus.emit(event, { jobId: id, agentKey: data.agentKey || null, data: { state: j.state, step: j.step, reason: j.reason, ...data } });
    return j;
  }
  function block(job, reason, extra = {}) {
    log.warn('job blocked', { jobId: job.id, step: job.step, reason });
    const j = setJob(job.id, { state: 'blocked', reason, ended_at: Date.now() }, 'job.blocked', extra);
    if (job.kind !== 'research') trackerRow(j, { status: 'blocked', status_reason: reason });
    return j;
  }

  // ---- intake: a verified brief becomes a job (or is refused with its reasons; no job is created then)
  function createJob({ briefText, line = 'room1-digital', by = 'owner', idempotencyKey = null }) {
    if (idempotencyKey) { const prev = store.idem.get('createJob:' + idempotencyKey); if (prev) return prev; }
    const L = lineOf(line), t = String(briefText || '').replace(/\r\n/g, '\n'), id = briefField(t, 'id'), reasons = [];
    if (!isListingId(id)) reasons.push('the brief has no valid id (YYYY-MM-DD--slug)');
    if (briefField(t, 'status') !== 'verified') reasons.push('the brief status is "' + (briefField(t, 'status') || 'missing') + '", not "verified"');
    const chk = checkBrief(t, { products: cfg.products, cfg: cfg.station });
    if (!chk.ok) reasons.push(...chk.reasons);
    if (id && store.getJob(id)) reasons.push('a job with id ' + id + ' already exists (a re-run needs a new -rN id)');
    if (reasons.length) { log.warn('intake refused a brief', { id, reasons, by }); return { ok: false, id, reasons }; }
    const job = store.tx(() => {
      const j = store.insertJob({ id, line, kind: 'line', title: titleOf(id), product_key: chk.key, state: 'queued', step: L.start, data: { createdBy: by, brief: 'jobs/' + id + '/brief.md' } });
      const sid = store.openStage(id, 'intake', 1); store.closeStage(sid, 'done', 'brief checked: demand evidence, keyword sources, product, originality, image policy, price');
      return j;
    });
    J.put(path.join(jobDir(id), 'brief.md'), t);
    bus.emit('job.created', { jobId: id, data: { line, title: job.title, product: chk.key, by } });
    log.info('job created', { id, line, product: chk.key, by });
    const out = { ok: true, id, job };
    if (idempotencyKey) store.idem.put('createJob:' + idempotencyKey, out);
    return out;
  }

  // ---- start: one job per line at a time; returns the run promise (or null when it has to wait)
  function startJob(id) {
    const job = store.getJob(id); if (!job) throw new Error('no such job: ' + id);
    if (!['queued'].includes(job.state)) throw new Error('job ' + id + ' is ' + job.state + ', not queued');
    if (halt.isHalted()) throw new Error('e-stop is on');
    const L = lineOf(job.line), cur = active.get(L.id);
    if (cur && (L.maxConcurrentJobs || 1) <= 1) { setJob(id, { reason: 'waiting: ' + cur.jobId + ' is on the line (one job at a time)', data: { autoStart: true } }); return null; }
    const promise = runJob(id).catch((e) => { log.error('job crashed', { id, error: String(e && e.stack || e) }); try { block(store.getJob(id), 'engine error: ' + e.message); } catch (_) { /* store gone */ } }).finally(() => { active.delete(L.id); const next = store.listJobs({ states: ['queued'] }).filter((j) => j.line === L.id && !/^interrupted/.test(j.reason || '')).pop(); if (next && !halt.isHalted() && next.data && next.data.autoStart) startJob(next.id); });
    active.set(L.id, { jobId: id, promise });
    return promise;
  }

  async function runJob(id) {
    let job = setJob(id, { state: 'running', started_at: store.getJob(id).started_at || Date.now(), reason: null }, 'job.stage', { step: store.getJob(id).step });
    const L = lineOf(job.line);
    let step = job.step === 'intake' ? L.steps.intake.next : job.step;
    while (step) {
      job = store.getJob(id);
      if (halt.isHalted()) { setJob(id, { state: 'stopped', reason: 'stopped by the e-stop at ' + step, ended_at: Date.now() }, 'job.stopped'); return store.getJob(id); }
      const def = L.steps[step]; if (!def) { block(job, 'line ' + L.id + ' has no step "' + step + '"'); return store.getJob(id); }
      const pass = def.kind === 'agent' ? passFor(job, step) : 1;
      if (def.kind === 'agent' && pass === 1 && step !== 'rejects-desk') {
        const visited = (job.data.visited || []);
        if (visited.includes(step)) { block(job, 'step ' + step + ' would run twice outside a loop'); return store.getJob(id); }
        if (job.hops + 1 > (L.maxHops || cfg.engine.caps.maxHops)) { block(job, 'maxHops ' + (L.maxHops || cfg.engine.caps.maxHops) + ' reached'); return store.getJob(id); }
        job = store.updateJob(id, { hops: job.hops + 1, data: { visited: [...visited, step] } });
      }
      const sid = store.tx(() => { const s = store.openStage(id, step, pass); store.updateJob(id, { step }); return s; });
      bus.emit('job.stage', { jobId: id, agentKey: def.agent || null, data: { step, column: def.column, pass, kind: def.kind } });
      await callHook('onStep', { job: store.getJob(id), step, def, pass, phase: 'start' });
      let r;
      try { r = def.kind === 'agent' ? await agentStep(store.getJob(id), step, def, pass) : await mechStep(store.getJob(id), step, def); }
      catch (e) { r = { blocked: 'engine error in ' + step + ': ' + e.message }; log.error('step crashed', { id, step, error: String(e && e.stack || e) }); }
      store.closeStage(sid, r.blocked ? 'blocked' : r.stopped ? 'stopped' : 'done', r.blocked || r.stopped || r.note || null);
      job = store.updateJob(id, { data: { costUsd: ledger.spent.job(id) } });
      await callHook('onStep', { job, step, def, pass, phase: 'end', result: r });
      if (r.stopped) { setJob(id, { state: 'stopped', reason: r.stopped, ended_at: Date.now() }, 'job.stopped'); return store.getJob(id); }
      if (r.blocked) { block(store.getJob(id), r.blocked); return store.getJob(id); }
      if (r.end === 'rejected') { setJob(id, { state: 'rejected', reason: r.reason, ended_at: Date.now() }, 'job.rejected'); return store.getJob(id); }
      if (r.end === 'approval') { setJob(id, { state: 'approval', reason: 'packaged, waiting for the owner\'s decision', ended_at: Date.now() }, 'job.queued-for-approval'); return store.getJob(id); }
      if (r.end === 'research-done') { setJob(id, { state: 'research-done', reason: r.reason, ended_at: Date.now() }, 'job.stage', { step: 'done' }); return store.getJob(id); }
      step = r.next;
    }
    return store.getJob(id);
  }

  // the pass number of an agent step: design = 1 + sends back + prep retries; listing = 1 + sends back
  function passFor(job, step) {
    const l = job.loops || {};
    if (step === 'designer' || step === 'qa-design') return 1 + (l.design || 0) + (step === 'designer' ? (l.prep || 0) : 0);
    if (step === 'lister' || step === 'qa-listing') return 1 + (l.listing || 0);
    return 1;
  }
  const stopFrom = (run, who) => (run.status === 'stopped' ? { stopped: who + ' run stopped: ' + run.endReason } : run.status === 'cap' ? { blocked: run.endReason } : run.status === 'refused' ? { blocked: who + ' run refused: ' + run.endReason } : run.status === 'failed' ? { blocked: who + ' run failed: ' + run.error } : run.status === 'max-turns' ? { blocked: who + ' run hit ' + run.endReason } : null);

  function handoff(job, extra = []) { const n = latestSet(dataRoot, job.id); return ['```', 'LISTING_ID: ' + job.id, 'BRIEF: work/' + job.id + '/brief.md', ...(n ? ['DESIGN: work/' + job.id + '/set-v' + n + '/deliverables.json'] : []), ...extra, '```'].join('\n'); }

  async function agentStep(job, step, def, pass) {
    const L = lineOf(job.line), research = job.kind === 'research', folder = research ? path.join(dataRoot, 'research') : jobDir(job.id), l = job.loops || {}, max = research ? 0 : (L.steps['qa-design'].onRevise || {}).max ?? 2;
    let input, loopNote = null;
    if (research) { J.makeDir(path.join(folder, 'drafts', job.data.day)); input = (job.data.input || 'Run your standing orders for this batch.') + '\nToday (Dublin) is ' + job.data.day + '. Drafts for this batch: drafts/' + job.data.day + '/.'; }
    else if (step === 'designer') {
      const n = latestSet(dataRoot, job.id) + 1;
      if (pass === 1) input = 'New verified brief for the Room 1 line. Write set-v' + n + '.\n\n' + readBrief(job.id) + '\n\n' + handoff(job);
      else if (job.data.prepFailure && (l.prep || 0) > 0 && !job.data.prepFailureSeen) { input = '[STATION — the set could not be prepared] ' + job.data.prepFailure + '\nWrite a corrected set-v' + n + '.\n\n' + handoff(job); store.updateJob(job.id, { data: { prepFailureSeen: true } }); }
      else { const q = readJson(path.join(folder, 'qa', 'design-pass' + (l.design || 0) + '.json')) || {}; input = '[LOOP — pass ' + pass + ' of ' + (max + 1) + '] QA DESIGN asked for a revise. Write set-v' + n + ' and fix EVERY reason:\n' + (q.reasons || []).map((x, i) => (i + 1) + '. ' + x).join('\n') + '\n\n' + handoff(job); }
    } else if (step === 'qa-design') input = 'Review the newest set.' + (pass > 1 ? ' [LOOP — pass ' + pass + ' of ' + (max + 1) + ']' : '') + '\n\n' + handoff(job);
    else if (step === 'lister') { const q = pass > 1 ? readJson(path.join(folder, 'qa-listing', 'pass' + (l.listing || 0) + '.json')) || {} : null; input = (q ? '[LOOP — pass ' + pass + '] QA LISTING asked for a revise:\n' + (q.reasons || []).map((x, i) => (i + 1) + '. ' + x).join('\n') + '\n\n' : 'Write the listing for the QA-approved set.\n\n') + handoff(job); }
    else if (step === 'qa-listing') input = 'Review the listing.' + (pass > 1 ? ' [LOOP — pass ' + pass + ']' : '') + '\n\n' + handoff(job);
    else if (step === 'rejects-desk') { input = '[LOOP — escalated] ' + (job.data.escalation || 'the work was not approved') + '\nRecord why in REJECTED.md.\n\n' + handoff(job); loopNote = 'This job is being stopped: write REJECTED.md only.'; }
    else input = handoff(job);
    const run = await runAgent(engine, { agentKey: def.agent, job, step, pass, folder, folderLabel: research ? 'the research folder (drafts/, briefs/, rejected/)' : 'the job folder of ' + job.id, input, loopNote, line: job.line, hooks: { onRunStart: hooks.onRunStart } });
    const stop = stopFrom(run, def.agent.toUpperCase());
    if (stop) return stop;
    if (def.verdict) return routeVerdict(store.getJob(job.id), step, def, pass, run);
    if (step === 'rejects-desk') {
      const rf = path.join(folder, 'REJECTED.md');
      if (!fs.existsSync(rf)) J.put(rf, '# REJECTED: ' + job.id + '\n\n' + (job.data.escalation || 'not approved') + '\n\n(written by the engine: REJECTS-DESK ended without writing this file)\n');
      trackerRow(job, { status: '', status_reason: 'rejected by QA: ' + (job.data.escalation || '') });
      return { end: 'rejected', reason: 'refused by QA, recorded by REJECTS-DESK: ' + firstLine(fs.readFileSync(rf, 'utf8')) };
    }
    return { next: def.next };
  }
  const firstLine = (t) => (String(t || '').split('\n').map((x) => x.replace(/^#+\s*/, '').trim()).filter(Boolean)[0] || '');

  // one verdict channel: the record from submit_verdict is written by the engine and routes the job
  function routeVerdict(job, step, def, pass, run) {
    const folder = jobDir(job.id), kind = def.verdict;
    const dir = kind === 'design' ? 'qa' : 'qa-listing', prefix = kind === 'design' ? 'design-pass' : 'pass';
    const n = (fs.existsSync(path.join(folder, dir)) ? fs.readdirSync(path.join(folder, dir)).filter((f) => new RegExp('^' + prefix + '\\d+\\.json$').test(f)).length : 0) + 1;
    let rec = run.verdict;
    if (!rec) rec = { stage: kind, listingId: job.id, pass: n, verdict: 'revise', checks: {}, reasons: ['the QA run ended without a valid verdict (counts as revise)'], reviewer: def.agent.toUpperCase(), recordedBy: 'engine' };
    rec = { ...rec, pass: n };
    J.put(path.join(folder, dir, prefix + n + '.json'), JSON.stringify(rec, null, 1) + '\n');
    if (rec.verdict === 'approved') J.put(path.join(folder, 'outbox', kind === 'design' ? 'qa-design.json' : 'qa-listing.json'), JSON.stringify(rec, null, 1) + '\n');
    log.info('verdict', { jobId: job.id, step, pass: n, verdict: rec.verdict, reasons: rec.reasons });
    if (rec.verdict === 'approved') return { next: def.onApproved, note: 'approved (pass ' + n + ')' };
    const o = def.onRevise, used = (job.loops || {})[o.loop] || 0;
    if (used < o.max) { store.updateJob(job.id, { loops: { [o.loop]: used + 1 } }); return { next: o.back, note: 'revise (pass ' + n + '): back to ' + o.back }; }
    const why = (kind === 'design' ? 'QA DESIGN' : 'QA LISTING') + ' did not approve after ' + (used + 1) + ' review(s) (' + o.loop + ' loop limit ' + o.max + '): ' + (rec.reasons || []).join('; ');
    store.updateJob(job.id, { data: { escalation: why } });
    return { next: o.escalate, note: 'loop exhausted: escalated to ' + o.escalate };
  }

  // ---- mechanical steps (fail closed)
  async function mechStep(job, step, def) {
    const fn = MECH[def.fn]; if (!fn) return { blocked: 'no mechanical step "' + def.fn + '"' };
    const r = await fn(job, def);
    log.info('mechanical step', { jobId: job.id, step, ok: !r.blocked, next: r.next || r.end || null, reason: r.blocked || r.note || undefined });
    return r;
  }
  const MECH = {
    prep(job, def) {
      const n = latestSet(dataRoot, job.id);
      let reason = null;
      if (!n) reason = 'DESIGNER wrote no set-v<N> folder';
      else {
        const files = path.join(jobDir(job.id), 'set-v' + n, 'files');
        if (!fs.existsSync(files) || !fs.readdirSync(files).length) reason = 'set-v' + n + '/files/ is empty: no deliverables';
        else {
          const r = prepareDigitalSet({ roomDir: dataRoot, id: job.id, n, cfg: cfg.station, products: cfg.products, log });
          if (!r.ok) reason = r.reason;
          else if (r.originality.result === 'hit') reason = 'ORIGINALITY HARD FAIL in set-v' + n + '/design.md: ' + r.originality.hits.map((h) => hitLine(h)).join('; ');
        }
      }
      if (!reason) return { next: def.next, note: 'set-v' + n + ' measured; originality clear' };
      const used = (job.loops || {}).prep || 0;
      if (used < (def.onFail ? def.onFail.max : 0)) { store.updateJob(job.id, { loops: { prep: used + 1 }, data: { prepFailure: reason, prepFailureSeen: false } }); return { next: def.onFail.back, note: 'prep failed, back to ' + def.onFail.back + ' once: ' + reason }; }
      return { blocked: 'prep failed' + (used ? ' again after one retry' : '') + ': ' + reason };
    },
    priceFill(job, def) {
      const lf = path.join(jobDir(job.id), 'outbox', 'listing.json'), L = readJson(lf);
      if (!L) return { blocked: 'LISTER wrote no valid outbox/listing.json' };
      // the prompt files name the legacy path; the gate wants the engine's (jobs/<id>/set-vN/deliverables.json)
      const df = canonicalDesignFile(L.designFile, job.id);
      if (df && df !== L.designFile) { J.put(lf, JSON.stringify({ ...L, designFile: df }, null, 2) + '\n'); log.info('listing designFile normalised', { jobId: job.id, from: L.designFile, to: df }); }
      const r = fillDigitalPrices({ id: job.id, roomDir: dataRoot, cfg: cfg.station, products: cfg.products, extra: cfg.blocklist, log });
      if (!r.ok) return { blocked: 'price fill: ' + r.reason };
      if (r.originality && r.originality.error) return { blocked: 'listing originality record failed: ' + r.originality.error };
      const og = readJson(path.join(jobDir(job.id), 'derived', 'listing.originality.json'));
      if (!og) return { blocked: 'listing originality record missing' };
      if (og.result === 'hit') return { blocked: 'ORIGINALITY HARD FAIL in the listing: ' + og.hits.map((h) => hitLine(h)).join('; ') };
      return { next: def.next, note: 'prices and facts filled: ' + r.prices.map((p) => p.variant + ' EUR ' + p.priceEur).join(', ') };
    },
    packageGate(job, def) {
      const r = checkPackage({ id: job.id, roomDir: dataRoot, blocklist: cfg.blocklist, cfg: cfg.station, products: cfg.products });
      store.updateJob(job.id, { data: { gate: { ok: r.ok, reasons: r.reasons, at: Date.now() } } });
      if (!r.ok) return { blocked: 'QA passed, package gate failed: ' + r.reasons.join('; ') };
      return { next: def.next, note: 'package gate passed' };
    },
    package(job) { return buildPackage(job); },
    briefCheck(job) { return researchBriefCheck(job); }
  };

  // ---- the package: what the owner uploads by hand (idempotent on the inputs' hash)
  function buildPackage(job) {
    const dir = jobDir(job.id), out = path.join(dir, 'package');
    const L = readJson(path.join(dir, 'outbox', 'listing.json')), qd = readJson(path.join(dir, 'outbox', 'qa-design.json')), ql = readJson(path.join(dir, 'outbox', 'qa-listing.json'));
    const n = Number(/set-v(\d+)/.exec(qd.designFile)[1]), setDir = path.join(dir, 'set-v' + n), manifest = readJson(path.join(setDir, 'deliverables.json'));
    const files = fs.readdirSync(path.join(setDir, 'files')).sort();
    const history = [...(fs.existsSync(path.join(dir, 'qa')) ? fs.readdirSync(path.join(dir, 'qa')).map((f) => 'qa/' + f) : []), ...(fs.existsSync(path.join(dir, 'qa-listing')) ? fs.readdirSync(path.join(dir, 'qa-listing')).map((f) => 'qa-listing/' + f) : [])].sort();
    const inputs = [...files.map((f) => 'set-v' + n + '/files/' + f), 'outbox/listing.json', 'outbox/qa-design.json', 'outbox/qa-listing.json', 'brief.md', ...history];
    const inputHash = sha256(inputs.map((r) => r + ':' + sha256(fs.readFileSync(path.join(dir, r)))).join('\n'));
    const old = readJson(path.join(out, 'MANIFEST.json'));
    const cost = costRecord(job.id);
    if (!(old && old.inputHash === inputHash)) {
      if (fs.existsSync(out)) J.move(out, path.join(dir, 'package-replaced-' + Date.now()));
      for (const f of files) J.copy(path.join(setDir, 'files', f), path.join(out, 'files', f));
      J.put(path.join(out, 'listing.json'), JSON.stringify(L, null, 2) + '\n');
      J.put(path.join(out, 'listing.md'), listingMd(L));
      J.put(path.join(out, 'qa-design.json'), JSON.stringify(qd, null, 1) + '\n');
      J.put(path.join(out, 'qa-listing.json'), JSON.stringify(ql, null, 1) + '\n');
      for (const h of history) J.copy(path.join(dir, h), path.join(out, 'qa-history', h.replace('/', '-')));
      J.copy(path.join(dir, 'brief.md'), path.join(out, 'brief.md'));
      const mf = {
        listingId: job.id, line: job.line, productKey: L.productKey, packagedAt: new Date().toISOString(), inputHash,
        gates: { packageGate: 'pass', checkedAt: new Date((job.data.gate || {}).at || Date.now()).toISOString(), reasons: [] },
        designFile: qd.designFile, deliverables: manifest.files.map(publicView), files: manifest.files.map((f) => ({ name: 'files/' + f.name, bytes: f.bytes, sha256: f.sha256 })),
        licence: L.licence, delivery: L.delivery, prices: { listingPriceEur: L.listingPriceEur, variantPricesEur: L.variantPricesEur, marginEstimate: L.marginEstimate, priceSuggestion: L.priceSuggestion },
        qa: { design: { pass: qd.pass, verdict: qd.verdict }, listing: { pass: ql.pass, verdict: ql.verdict }, history: history.length },
        ownerTodo: [...(L.ownerTodo || []), 'trademark clearance: a clear originality screen is not trademark clearance; check before publishing', 'upload the files in files/ to the Etsy listing by hand'],
        costUsd: cost.totalUsd, provider: engine.providers.mode, note: engine.providers.mode === 'mock' ? 'MOCK RUN: every model and image call was the mock provider; no model was called and nothing was charged' : undefined
      };
      J.put(path.join(out, 'MANIFEST.json'), JSON.stringify(mf, null, 2) + '\n');
    }
    J.put(path.join(out, 'cost.json'), JSON.stringify(cost, null, 2) + '\n');
    store.queueApproval(job.id);
    trackerRow(job, { status: 'packaged', status_reason: '', packaged_at: new Date().toISOString(), design_file: qd.designFile, deliverables: String(files.length), qa_design: 'approved', qa_listing: 'approved' });
    return { end: 'approval', note: 'packaged in jobs/' + job.id + '/package/' };
  }

  // cost.json: the ledger rows of THIS job (by jobId, not by time window), with workings; text, image and web apart
  function costRecord(id) {
    const rows = ledger.rowsForJob(id).map((r) => ({ entryId: r.entryId, at: new Date(r.ts).toISOString(), agent: r.agentKey, runId: r.runId, kind: r.kind, provider: r.provider, model: r.model, tokens: r.tokens, count: r.count, usd: r.usd, estimated: !!r.estimated, priceSource: r.priceSource }));
    const by = (k) => Math.round(rows.filter((r) => r.kind === k).reduce((s, r) => s + r.usd, 0) * 1e6) / 1e6;
    const total = Math.round(rows.reduce((s, r) => s + r.usd, 0) * 1e6) / 1e6;
    return { jobId: id, source: ledger.label + ' rows with jobId = ' + id, mock: rows.every((r) => r.provider === 'mock'), rows: rows.length, byKind: { text: by('text'), image: by('image'), web: by('web') }, totalUsd: total, workings: rows.length ? rows.map((r) => r.usd.toFixed(6)).join(' + ') + ' = ' + total.toFixed(6) : 'no rows = 0', detail: rows };
  }
  function listingMd(L) {
    return ['# ' + L.title, '', '**Tags:** ' + (L.tags || []).join(', '), '', '**Price:** EUR ' + L.listingPriceEur + ' · delivery: ' + L.delivery + ' · licence: ' + L.licence, '', '## Description', '', L.description || '', '', '## Alt text', '', L.altText || '', '', '## Files', '', ...(L.deliverables || []).map((d) => '- ' + d.name + ' (' + d.format + ', ' + d.widthPx + 'x' + d.heightPx + ' px)'), '', '## Owner to-do', '', ...(L.ownerTodo || []).map((t) => '- ' + t), ''].join('\n');
  }

  // ---- the research line's brief check: a draft that passes goes to research/briefs/ (verified), else research/rejected/
  function researchBriefCheck(job) {
    const day = job.data.day || dublinDay(), drafts = path.join(dataRoot, 'research', 'drafts', day), out = [];
    for (const f of fs.existsSync(drafts) ? fs.readdirSync(drafts).filter((x) => x.endsWith('.md')) : []) {
      const t = fs.readFileSync(path.join(drafts, f), 'utf8'), st = briefField(t, 'status');
      if (st !== 'verified') { out.push(f + ': ' + (st || 'no status') + ' (not moved)'); continue; }
      const c = checkBrief(t, { products: cfg.products, cfg: cfg.station });
      if (c.ok) { J.put(path.join(dataRoot, 'research', 'briefs', f), t); out.push(f + ': verified -> briefs/'); }
      else { J.put(path.join(dataRoot, 'research', 'rejected', f), t + '\n\n## Station brief check\n' + c.reasons.map((r) => '- ' + r).join('\n') + '\n'); out.push(f + ': rejected -> ' + c.reasons.join('; ')); }
    }
    return { end: 'research-done', reason: out.join(' | ') || 'no drafts for ' + day };
  }

  // ---- research jobs
  function createResearchJob({ input = 'Run your standing orders for this batch.', by = 'owner' } = {}) {
    const day = dublinDay(), n = store.listJobs().filter((j) => j.kind === 'research' && j.id.startsWith(day)).length + 1, id = day + '--research-' + n;
    store.insertJob({ id, line: 'research', kind: 'research', title: 'Research batch ' + n, state: 'queued', step: 'demand-researcher', data: { day, input, createdBy: by } });
    bus.emit('job.created', { jobId: id, data: { line: 'research', by } });
    return { ok: true, id };
  }

  // ---- the owner's decisions in the approval queue (E5 wires the buttons; the rules live here)
  function decide(jobId, { action, reason = '', etsyUrl = '', expectedVersion, by = 'owner' }) {
    const a = store.getApproval(jobId); if (!a) throw new Error('not in the approval queue: ' + jobId);
    const now = Date.now();
    if (action === 'approve') { store.decideApproval(jobId, { status: 'approved', decided_at: now, reason }, { expectedVersion }); setJob(jobId, { state: 'approved', reason: 'approved by the owner; publish on Etsy by hand' }, 'job.decided', { action }); trackerRow(store.getJob(jobId), { status: 'approved', owner_decision_at: new Date(now).toISOString() }); }
    else if (action === 'reject') { if (!String(reason).trim()) throw new Error('a rejection needs a reason'); store.decideApproval(jobId, { status: 'rejected_by_owner', decided_at: now, reason }, { expectedVersion }); setJob(jobId, { state: 'rejected_by_owner', reason }, 'job.decided', { action }); trackerRow(store.getJob(jobId), { status: 'rejected_by_owner', status_reason: reason, owner_decision_at: new Date(now).toISOString() }); }
    else if (action === 'published') { if (!/^https:\/\/(www\.)?etsy\.com\/listing\/\d+/.test(etsyUrl)) throw new Error('paste the Etsy listing URL (https://www.etsy.com/listing/...)'); store.decideApproval(jobId, { status: 'published', published_at: now, etsy_url: etsyUrl }, { expectedVersion }); setJob(jobId, { state: 'published', reason: 'published ' + new Date(now).toISOString().slice(0, 10) }, 'job.decided', { action }); trackerRow(store.getJob(jobId), { status: 'published', published_at: new Date(now).toISOString(), etsy_listing_url: etsyUrl }); }
    else throw new Error('unknown decision ' + action);
    log.info('owner decision', { jobId, action, by });
    return store.getApproval(jobId);
  }

  return { createJob, startJob, runJob, createResearchJob, decide, costRecord, active: () => [...active.values()].map((a) => a.jobId), jobDir };
}
