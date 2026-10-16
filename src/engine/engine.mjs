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
      if (routine.target === 'line:research') { const r = engine.orchestrator.createResearchJob({ input: routine.input, by: 'routine ' + routine.id }); return engine.orchestrator.startJob(r.id); }
      throw new Error('routine target not supported yet: ' + routine.target);
    };
    engine.scheduler = createScheduler({ store, halt, ledger, caps: cfg.engine.caps, bus, log, clock, run: (routine) => (engine.runRoutine ? engine.runRoutine(routine) : Promise.reject(new Error('no routine runner'))) });
    if (startScheduler) engine.scheduler.start();
    // jobs interrupted by the last stop resume at the start of their step, once (resumeOnRestart)
    if (resume && !halt.isHalted()) for (const j of rec.jobs.filter((x) => x.action === 'resume')) { try { engine.orchestrator.startJob(j.id); } catch (e) { log.warn('interrupted job not resumed', { id: j.id, error: e.message }); } }
    bus.emit('engine.start', { data: { pid: process.pid, provider: prov.mode, dataRoot: J.dataRoot, ledgerOk: ledger.state.ok, halted: halt.isHalted() } });
    log.info('engine started', { dataRoot: J.dataRoot, provider: prov.mode, store: store.backend, ledgerRows: ledger.totals.rows, halted: halt.isHalted() });
    engine.close = () => { try { engine.scheduler.stop(); } catch (_) {} halt.close(); store.close(); useJail(null); unlock(); log.info('engine closed'); };
    return engine;
  } catch (e) { unlock(); throw e; }
}
