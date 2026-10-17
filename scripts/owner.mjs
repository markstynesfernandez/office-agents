// owner.mjs — the owner's decisions and owner-started steps on a job, from a terminal (port batch before E6, 17/10/2026). The same
// engine actions as the page's /api/owner/* and /api/jobs/{qa-only,listing-only,package} routes: it starts the engine on the data root
// (the engine lock refuses while the server is running: use the page then, or stop the server), checks the job's version, runs the action,
// waits for any run it started and closes. Every write goes through the engine's data jail. No model is called except by a run mode,
// which runs on the engine's configured provider within the owner's cap (mock in this phase).
//   node scripts/owner.mjs <action> <job-id> '<json args>'      e.g.
//   node scripts/owner.mjs file-decision 2026-..--x '{"set":4,"name":"03-x.png","decision":"keep","qaPass":2,"qaSaid":"...","reason":"..."}'
//   actions: file-decision, set-approval, listing-approval, edit-set, fix-listing-text, listing-photos, style-ref, qa-only, listing-only,
//            package, resume, show
// The job's current version is used (expectedVersion), so a decision made in a page tab at the same moment still wins or is refused.
import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../src/engine/engine.mjs';
import { createJail, APP_ROOT } from '../src/engine/store/jail.mjs';
import { makeLogger } from '../src/server/log.mjs';

const [action, id, json = '{}'] = process.argv.slice(2);
const ACTIONS = { 'file-decision': 'recordFileDecision', 'set-approval': 'approveSet', 'listing-approval': 'approveListing', 'edit-set': 'editSet', 'fix-listing-text': 'fixListingText', 'listing-photos': 'makeListingPhotos', 'style-ref': 'styleRefDecision' };
// resume (E6 c0): a job the owner released (e.g. after the file 1 decision) runs on from its step, as the page's Restart
const MODES = { 'qa-only': 'qaOnly', 'listing-only': 'listingOnly', package: 'packageJob', resume: 'restartJob' };
if (!action || !id || !(ACTIONS[action] || MODES[action] || action === 'show')) { console.error('usage: node scripts/owner.mjs <' + [...Object.keys(ACTIONS), ...Object.keys(MODES), 'show'].join('|') + '> <job-id> [json args]'); process.exit(2); }
let args; try { args = JSON.parse(json); } catch (e) { console.error('the args are not valid JSON: ' + e.message); process.exit(2); }
// the photo plan of a product may be named instead of pasted: {"planFile":"config/listing-photos/pngtuber-prop-pack.json"}
if (args.planFile) { const f = path.resolve(APP_ROOT, args.planFile); if (path.relative(path.join(APP_ROOT, 'config'), f).startsWith('..')) { console.error('planFile must be under config/'); process.exit(2); } args.plan = JSON.parse(fs.readFileSync(f, 'utf8')); delete args.planFile; }

const J = createJail(), log = makeLogger({ dir: path.join(APP_ROOT, 'logs'), name: 'owner', jail: J });
let engine;
try { engine = createEngine({ J, log, startScheduler: false, resume: false }); }
catch (e) { console.error('the engine did not start: ' + e.message + (e.code === 'LOCKED' ? ' (stop the server first, or use the page)' : '')); process.exit(1); }
try {
  const j = engine.store.getJob(id); if (!j) throw new Error('no such job: ' + id);
  if (action === 'show') console.log(JSON.stringify({ state: j.state, step: j.step, reason: j.reason, version: j.version, owner: engine.owner.summary(id) }, null, 1));
  else {
    // a job that ran on the live provider is resumed live only (npm run line:live -- --resume <id>), never on the mock
    if (action === 'resume' && engine.providers.mode === 'mock' && engine.ledger.rowsForJob(id).some((r) => r.provider !== 'mock')) throw new Error('this job has live ledger rows: resume it with npm run line:live -- --resume ' + id + ' (live, per-process override), not on the mock');
    const out = ACTIONS[action] ? await engine.owner[ACTIONS[action]](id, { ...args, expectedVersion: j.version }) : engine.orchestrator[MODES[action]](id, { ...args, expectedVersion: j.version, by: 'owner (cli)' });
    if (out && out.run) await out.run;
    const after = engine.store.getJob(id);
    console.log(JSON.stringify({ ...out, job: { state: after.state, step: after.step, reason: after.reason, version: after.version } }, null, 1));
  }
} catch (e) { console.error(action + ' refused: ' + e.message); process.exitCode = 1; }
finally { engine.close(); }
