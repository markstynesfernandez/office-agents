// engine.mjs — assembles one engine (ENGINE-PLAN.md §1.1): jail, lock, store, ledger, bus, e-stop, spend guard,
// scheduler, providers, and (E3) the agent runtime and the line orchestrator. One engine per data root: data/.lock
// holds the pid; a second engine on the same root refuses to start. Restart is safe: state is written before its
// event; on start, in-flight runs become `interrupted`, calls that were in flight are charged at their reserved
// maximum, and each interrupted job goes back to the start of its step at most `resumeOnRestart` times, then `blocked`.
import fs from 'node:fs';
import path from 'node:path';
import { createJail, APP_ROOT } from './store/jail.mjs';
import { openStore } from './store/db.mjs';
import { createLedger } from './ledger.mjs';
import { createBus } from './bus.mjs';
import { createHalt } from './halt.mjs';
import { createGuard } from './guard.mjs';
import { createScheduler } from './scheduler.mjs';
import { createProviders } from './providers/index.mjs';
import { loadConfig, demoMarkers } from './config.mjs';
import { useJail } from './store/active.mjs';
import { createOrchestrator } from './orchestrator.mjs';
import { effectiveAgent } from './runtime.mjs';
import { validSchedule } from './scheduler.mjs';

export class LockError extends Error { constructor(msg) { super(msg); this.code = 'LOCKED'; } }
export class DemoConfigError extends Error { constructor(msg) { super(msg); this.code = 'DEMO_CONFIG'; } }
const sameOrInside = (a, b) => { const n = (p) => (process.platform === 'win32' ? p.toLowerCase() : p); const x = n(a), y = n(b); return x === y || x.startsWith(y.endsWith(path.sep) ? y : y + path.sep); };

// DEMO values (demo/station-patch.json, demo/products.json) are for the demo engine only (scripts/demo.mjs passes
// demo: true on its own root, data-demo/). A real engine refuses to start with any of them in its config, and a demo
// engine refuses the station's data root.
export function checkDemoConfig(cfg, { demo, dataRoot }) {
  const marks = demoMarkers(cfg);
  if (!demo && marks.length) throw new DemoConfigError('refusing to start: DEMO values are in the config (' + marks.slice(0, 6).join(', ') + (marks.length > 6 ? ', …' : '') + '); they apply only to the demo engine (npm run demo)');
  if (demo) for (const r of [path.join(APP_ROOT, 'data'), process.env.STATION_DATA_ROOT].filter(Boolean)) if (sameOrInside(dataRoot, path.resolve(r)) || sameOrInside(path.resolve(r), dataRoot)) throw new DemoConfigError('refusing to start a demo engine on the station data root (' + dataRoot + ')');
  return marks;
}
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

export function takeLock(J, log) {
  const f = path.join(J.dataRoot, '.lock');
  try {
    const cur = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (cur.pid && cur.pid !== process.pid && alive(cur.pid)) throw new LockError('another engine (pid ' + cur.pid + ', started ' + new Date(cur.startedAt).toISOString() + ') holds ' + f);
    if (cur.pid && cur.pid !== process.pid) log && log.warn('stale engine lock replaced', { stalePid: cur.pid });
  } catch (e) { if (e.code === 'LOCKED') throw e; /* no lock or unreadable: take it */ }
  J.put(f, JSON.stringify({ pid: process.pid, startedAt: Date.now() }) + '\n', { fsync: true });
  return () => { try { const cur = JSON.parse(fs.readFileSync(f, 'utf8')); if (cur.pid === process.pid) J.remove(f); } catch (_) { /* gone */ } };
}

// in-flight work at the last stop: runs -> interrupted, open stages -> interrupted, jobs -> resume once or blocked
export function recover({ store, bus, log, resumeOnRestart = 1 }) {
  const out = { runs: 0, jobs: [] };
  store.tx(() => {
    for (const r of store.runningRuns()) { store.finishRun(r.run_id, { status: 'interrupted', endReason: 'engine stopped mid-run', usd: r.usd, tokensIn: r.tokens_in, tokensOut: r.tokens_out, turns: r.turns }); out.runs++; }
    for (const s of store.openStages()) store.closeStage(s.id, 'interrupted', 'engine stopped mid-step');
    for (const j of store.listJobs({ states: ['running'] })) {
      if ((j.resumes || 0) < resumeOnRestart) { store.updateJob(j.id, { state: 'queued', resumes: (j.resumes || 0) + 1, reason: 'interrupted by an engine restart; resumes at the start of ' + j.step }); out.jobs.push({ id: j.id, action: 'resume', step: j.step }); }
      else { store.updateJob(j.id, { state: 'blocked', reason: 'interrupted by an engine restart again (resumeOnRestart ' + resumeOnRestart + ' used); restart it by hand', ended_at: Date.now() }); out.jobs.push({ id: j.id, action: 'blocked', step: j.step }); }
    }
  });
  if (out.runs || out.jobs.length) { log.warn('recovered after an unclean stop', out); bus.emit('engine.recovered', { data: out }); }
  return out;
}

export function createEngine({ dataRoot, configDir = path.join(APP_ROOT, 'config'), promptsDir = path.join(APP_ROOT, 'prompts'), log, providers = null, script = null, mockDelayMs = 0, clock = Date.now, startScheduler = true, resume = true, hooks = {}, overrides = null, J = null, demo = false } = {}) {
  J = J || createJail({ dataRoot });
  const unlock = takeLock(J, log);
  useJail(J);   // the ported station modules write through this engine's jail
  try {
    const cfg = loadConfig({ configDir, promptsDir, overrides });
    checkDemoConfig(cfg, { demo, dataRoot: J.dataRoot });
    if (overrides) log.warn('config overrides in use (dry run and demo only)', { products: overrides.productsFile ? overrides.productsFile.products.map((p) => p.key) : null, stationSet: overrides.stationSet ? Object.keys(overrides.stationSet) : null });
    const store = openStore({ J, log });
    const ledger = createLedger({ J, store, log });
    const bus = createBus({ J, log });
    const halt = createHalt({ J, bus, log });
    const guard = createGuard({ J, ledger, halt, caps: cfg.engine.caps, pricing: cfg.engine.pricing, log, bus, clock });
    const recovered = guard.recoverPending();
    const rec = recover({ store, bus, log, resumeOnRestart: cfg.engine.runtime.resumeOnRestart });
    const prov = providers || createProviders({ mode: process.env.STATION_PROVIDER || cfg.engine.provider, script, delayMs: mockDelayMs, log });
    const engine = { J, cfg, store, ledger, bus, halt, guard, providers: prov, log, clock, recovered: { charged: recovered, ...rec } };
    engine.orchestrator = createOrchestrator(engine, { hooks });
    // a routine fires a line (verified briefs, up to its daily limit) or a research batch; created disabled, enabled by the owner only
    engine.runRoutine = async (routine) => {
      const cap = routine.per_run_cap_usd ?? null;
      if (routine.target === 'line:research') { const r = engine.orchestrator.createResearchJob({ input: routine.input, by: 'routine ' + routine.id }); store.updateJob(r.id, { data: { routineId: routine.id, ...(cap != null ? { runCapUsd: cap } : {}) } }); return engine.orchestrator.startJob(r.id); }
      if (routine.target === 'line:room1-digital') {
        // the oldest verified brief that has no job yet (owner Q13: once the owner enables a line routine)
        const b = engine.orchestrator.verifiedBriefs().find((x) => x.status === 'verified' && x.id && !x.jobId);
        if (!b) return { skipped: 'no verified brief is waiting' };
        const c = engine.orchestrator.createJob({ briefText: fs.readFileSync(path.join(J.dataRoot, 'research', 'briefs', b.file), 'utf8'), by: 'routine ' + routine.id });
        if (!c.ok) return { skipped: 'brief ' + b.file + ' refused at intake: ' + c.reasons.join('; ') };
        store.updateJob(c.id, { data: { routineId: routine.id, ...(cap != null ? { runCapUsd: cap } : {}) } });
        return engine.orchestrator.startJob(c.id);
      }
      throw new Error('routine target not supported: ' + routine.target);
    };
    // routines the page may create (ENGINE-PLAN.md §5.4); an off-duty first agent makes its line's routines skip
    engine.routineTargets = Object.values(cfg.lines).map((l) => ({ id: 'line:' + l.id, label: l.id === 'research' ? 'Research batch (research line)' : 'Next verified brief (' + l.id + ' line)', firstAgent: firstAgentOf(l) }));
    const routineHold = (routine) => {
      const t = engine.routineTargets.find((x) => x.id === routine.target); if (!t || !t.firstAgent) return null;
      return effectiveAgent(engine, t.firstAgent).enabled ? null : ((cfg.agents[t.firstAgent] || {}).name || t.firstAgent) + ' is off duty';
    };
    engine.scheduler = createScheduler({ store, halt, ledger, caps: cfg.engine.caps, bus, log, clock, hold: routineHold, run: (routine) => (engine.runRoutine ? engine.runRoutine(routine) : Promise.reject(new Error('no routine runner'))) });
    if (startScheduler) engine.scheduler.start();
    engine.routines = routineAdmin(engine);
    engine.updateAgent = (key, patch, opts) => updateAgent(engine, key, patch, opts);
    // jobs interrupted by the last stop resume at the start of their step, once (resumeOnRestart)
    if (resume && !halt.isHalted()) for (const j of rec.jobs.filter((x) => x.action === 'resume')) { try { engine.orchestrator.startJob(j.id); } catch (e) { log.warn('interrupted job not resumed', { id: j.id, error: e.message }); } }
    bus.emit('engine.start', { data: { pid: process.pid, provider: prov.mode, dataRoot: J.dataRoot, ledgerOk: ledger.state.ok, halted: halt.isHalted() } });
    log.info('engine started', { dataRoot: J.dataRoot, provider: prov.mode, store: store.backend, ledgerRows: ledger.totals.rows, halted: halt.isHalted() });
    engine.close = () => { try { engine.scheduler.stop(); } catch (_) {} halt.close(); store.close(); useJail(null); unlock(); log.info('engine closed'); };
    return engine;
  } catch (e) { unlock(); throw e; }
}

const firstAgentOf = (l) => { let step = l.start, seen = 0; while (step && seen++ < 20) { const d = l.steps[step]; if (!d) return null; if (d.kind === 'agent') return d.agent; step = d.next; } return null; };

// ---- the owner's changes from the office (E5). Each takes the record's expectedVersion; a stale tab is refused.
function routineAdmin(engine) {
  const { store, cfg, bus, log, scheduler } = engine;
  const caps = cfg.engine.caps;
  function clean(b, cur = {}) {
    const r = {
      name: b.name != null ? String(b.name).trim() : cur.name, target: b.target != null ? String(b.target) : cur.target, input: b.input != null ? String(b.input).replace(/\r\n/g, '\n').trim() : (cur.input || ''),
      schedule: b.schedule != null ? String(b.schedule).trim().replace(/\s+/g, ' ') : cur.schedule,
      max_runs_per_day: b.maxRunsPerDay != null ? Number(b.maxRunsPerDay) : (cur.max_runs_per_day ?? 1),
      per_run_cap_usd: b.perRunCapUsd !== undefined ? (b.perRunCapUsd === null || b.perRunCapUsd === '' ? null : Number(b.perRunCapUsd)) : (cur.per_run_cap_usd ?? null)
    };
    const bad = [];
    if (!r.name || r.name.length > 80) bad.push('a name of 1 to 80 characters');
    if (!engine.routineTargets.some((t) => t.id === r.target)) bad.push('a target the engine can run (' + engine.routineTargets.map((t) => t.id).join(', ') + ')');
    if (r.input.length > 2000) bad.push('an input under 2,000 characters');
    if (!validSchedule(r.schedule)) bad.push('a 5-field cron schedule (Europe/Dublin), e.g. "0 9 * * 1-5"');
    if (!Number.isInteger(r.max_runs_per_day) || r.max_runs_per_day < 1 || r.max_runs_per_day > 24) bad.push('max runs a day between 1 and 24');
    if (r.per_run_cap_usd != null && !(r.per_run_cap_usd > 0 && r.per_run_cap_usd <= caps.perRunUsd)) bad.push('a per-run cap above 0 and at most the engine cap of ' + caps.perRunUsd.toFixed(2) + ' (caps are raised in config only)');
    if (bad.length) throw new Error('the routine needs ' + bad.join('; '));
    return r;
  }
  const emit = (id, what, r) => { bus.emit('routine.changed', { data: { routineId: id, what, name: r ? r.name : null, enabled: r ? r.enabled : false } }); log.info('routine ' + what, { id, name: r && r.name }); };
  const needVersion = (v) => { if (v == null || !Number.isInteger(v)) throw new Error('expectedVersion is required'); };
  const notLegacy = (r) => { if (r.legacy) throw new Error('an imported legacy routine is read only (a re-import would bring it back)'); };
  return {
    // created disabled, always (ENGINE-PLAN.md §5.4)
    create(b) {
      const r = clean(b), id = 'rt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      const out = store.insertRoutine({ id, ...r });
      emit(id, 'created', out); return out;
    },
    update(id, b, { expectedVersion } = {}) {
      needVersion(expectedVersion);
      const cur = store.getRoutine(id); if (!cur) throw new Error('no such routine: ' + id); notLegacy(cur);
      const out = store.updateRoutine(id, clean(b, cur), { expectedVersion });
      scheduler.refresh(id); emit(id, 'edited (left disabled: enable it again to approve the change)', out); return out;
    },
    // enabling is the only approval; a legacy or unsupported routine cannot be enabled
    enable(id, enabled, { expectedVersion } = {}) {
      needVersion(expectedVersion);
      const cur = store.getRoutine(id); if (!cur) throw new Error('no such routine: ' + id);
      if (enabled) { notLegacy(cur); if (!engine.routineTargets.some((t) => t.id === cur.target)) throw new Error('this routine\'s target cannot run: ' + cur.target); }
      const out = store.setRoutineEnabled(id, !!enabled, { expectedVersion });
      scheduler.refresh(id); emit(id, enabled ? 'enabled' : 'disabled', out); return out;
    },
    remove(id, { expectedVersion } = {}) {
      needVersion(expectedVersion);
      const cur = store.getRoutine(id); if (!cur) throw new Error('no such routine: ' + id); notLegacy(cur);
      store.deleteRoutine(id, { expectedVersion });
      scheduler.refresh(id); emit(id, 'deleted', null); return { id, deleted: true };
    }
  };
}

// on/off duty, tier and effort: an overlay in SQLite on top of config/agents/<key>.json, read at the start of every run,
// so a change applies at the next run with no restart. Tier and effort only from the lists in config/engine.json.
export function updateAgent(engine, key, patch = {}, { expectedVersion } = {}) {
  const { cfg, store, bus, log } = engine;
  if (!cfg.agents[key]) throw new Error('no such agent: ' + key);
  if (expectedVersion == null || !Number.isInteger(expectedVersion)) throw new Error('expectedVersion is required');
  const p = {};
  if (patch.enabled !== undefined) { if (typeof patch.enabled !== 'boolean') throw new Error('enabled must be true or false'); p.enabled = patch.enabled; }
  if (patch.tier !== undefined) { if (!cfg.engine.tiers[patch.tier]) throw new Error('tier must be one of ' + Object.keys(cfg.engine.tiers).join(', ')); p.tier = patch.tier; }
  if (patch.effort !== undefined) { const lv = cfg.engine.effortLevels || []; if (!lv.includes(patch.effort)) throw new Error('effort must be one of ' + lv.join(', ')); p.effort = patch.effort; }
  if (!Object.keys(p).length) throw new Error('nothing to change');
  const out = store.setAgentState(key, p, { expectedVersion });
  const eff = effectiveAgent(engine, key);
  bus.emit('agent.updated', { agentKey: key, data: { enabled: eff.enabled, tier: eff.tier, effort: eff.effort, appliesAt: 'next run' } });
  log.info('agent updated', { agent: key, ...p, version: out.version });
  const woke = p.enabled === true ? engine.orchestrator.wakeWaiting(key) : [];
  return { agentKey: key, version: out.version, enabled: eff.enabled, tier: eff.tier, effort: eff.effort, started: woke };
}
