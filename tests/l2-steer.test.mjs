// l2-steer.test.mjs — L2: driving the line from the Station page (owner brief, 19/10/2026), through the real HTTP server on a temp data
// root and the mock provider ($0, no keys). The owner brief form (composed, then the same intake checks as the CLI), the spend
// confirmation and its server-side refusals (e-stop, daily caps, missing or reused or mismatched confirm token), the job limit (a second
// start waits as "next"), steering from the job panel (resume, owner amendment, set rejection, the file-1 decision's controls), the live
// status, the Design card fix and the Real-ESRGAN status, and one end-to-end run: a brief from the form, Start line, the approval queue,
// Approve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { tempRoot, until } from './helpers/engine.mjs';
import { createEngine } from '../src/engine/engine.mjs';
import { createEngineServer } from '../src/server/engine-server.mjs';
import { buildEngineSnapshot, eventText } from '../src/server/engine-model.mjs';
import { loadConfig } from '../src/engine/config.mjs';
import { APP_ROOT } from '../src/engine/store/jail.mjs';
import { dublinDay } from '../src/engine/time.mjs';
import { composeOwnerBrief, formProducts, slugOf } from '../src/engine/lib/owner-brief-form.mjs';
import { checkOwnerBrief } from '../src/engine/lib/owner-brief.mjs';
import { upscalerStatus } from '../src/engine/lib/upscaler-status.mjs';
import { spendHtml } from '../src/web/ui/controls.js';
import { createDryRunScript, JOB_A } from '../fixtures/engine/mock-script.mjs';

const FIX = path.join(APP_ROOT, 'fixtures', 'engine');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const OVERRIDES = { productsFile: readJson(path.join(FIX, 'products.json')), stationSet: readJson(path.join(FIX, 'station-config-patch.json')).set };
const REAL = loadConfig({ configDir: path.join(APP_ROOT, 'config'), promptsDir: path.join(APP_ROOT, 'prompts') });
const briefText = (id) => fs.readFileSync(path.join(FIX, 'briefs', id + '.md'), 'utf8').replace(/\{\{TODAY\}\}/g, dublinDay());
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const ITEMS = ['a red cap mushroom with a tiny door', 'a brown mushroom cluster', 'an acorn house mushroom', 'a tall moss cap mushroom', 'a tiny window mushroom'];

// the dry-run mock script; for an owner brief LISTER also writes its priceProposal within the bounds (as the live LISTER is told to)
const withProposal = (usd) => (script) => async (ctx, params) => {
  const out = await script(ctx, params);
  if (ctx.agentKey !== 'lister' || !ctx.jobId || ctx.jobId === JOB_A) return out;
  for (const b of out.content || []) if (b.type === 'tool_use' && b.name === 'fs_write' && /listing\.json$/.test(b.input.path)) { const L = JSON.parse(b.input.content); L.productKey = 'dry-run-sticker-pack-5'; L.priceProposal = { usd, reason: 'Five matching stickers at the lower end of the owner bounds for a first listing.' }; b.input = { ...b.input, content: JSON.stringify(L, null, 2) }; }
  return out;
};

async function boot(t, { mockDelayMs = 0, tag = 'l2', proposalUsd = null, limitJobs = true } = {}) {
  const r = tempRoot(tag);
  const station = loadConfig({ configDir: path.join(APP_ROOT, 'config'), promptsDir: path.join(APP_ROOT, 'prompts'), overrides: OVERRIDES }).station;
  const base = createDryRunScript({ cfg: station });
  const engine = createEngine({ J: r.J, log: r.log, script: proposalUsd != null ? withProposal(proposalUsd)(base) : base, overrides: OVERRIDES, startScheduler: false, mockDelayMs, limitJobs });
  r.J.put(path.join(r.dataRoot, 'research', 'briefs', JOB_A + '.md'), briefText(JOB_A));
  const es = createEngineServer({ engine, log: r.log });
  await new Promise((res) => es.server.listen(0, '127.0.0.1', res));
  const port = es.server.address().port, origin = 'http://127.0.0.1:' + port;
  t.after(async () => { es.closeAll(); await new Promise((res) => es.server.close(res)); try { engine.close(); } catch (_) {} r.cleanup(); });
  const raw = (method, p, { headers = {}, body = null } = {}) => new Promise((res, rej) => {
    const q = http.request({ host: '127.0.0.1', port, method, path: p, headers }, (s) => { const parts = []; s.on('data', (c) => parts.push(c)); s.on('end', () => { const text = Buffer.concat(parts).toString('utf8'); let json = null; try { json = JSON.parse(text); } catch (_) {} res({ status: s.statusCode, json, text }); }); });
    q.on('error', rej); if (body != null) q.write(body); q.end();
  });
  const post = (p, body = {}, { key = crypto.randomUUID() } = {}) => raw('POST', p, { headers: { 'content-type': 'application/json', origin, 'x-station-action': es.token, 'x-idempotency-key': key }, body: JSON.stringify(body) });
  const quote = async (action, params) => { const q = await post('/api/spend/quote', { action, params }); assert.equal(q.status, 200, q.text); return q.json.result; };
  const confirmed = async (p, action, body) => { const q = await quote(action, body); assert.ok(q.token, 'a token: ' + JSON.stringify(q.refusals)); return post(p, { ...body, confirmToken: q.token }); };
  const snap = async () => (await raw('GET', '/api/office/snapshot?fresh')).json;
  const job = (id) => engine.store.getJob(id);
  const settled = (id) => until(() => { const j = job(id); return j && !engine.orchestrator.isActive(id) && !['running'].includes(j.state) && !(j.state === 'queued' && j.data.autoStart) && j; }, { timeout: 30000 });
  return { engine, r, raw, post, quote, confirmed, snap, job, settled };
}
const form = (over = {}) => ({ title: 'Woodland Mushroom Stickers', theme: 'Five round woodland mushrooms with tiny doors and windows, a soft autumn palette of rust, moss and cream, thick clean outlines.', audience: 'planner and journal decorators', productKey: 'dry-run-sticker-pack-5', items: ITEMS, ownerFile1: false, ...over });

// ---- 1. the owner brief form

test('owner brief form: composes a brief the intake accepts; the item count comes from the spec, the bounds from the floor', () => {
  const P = formProducts(REAL.products, REAL.station), pack = P.find((p) => p.key === 'pngtuber-prop-pack');
  assert.deepEqual([pack.files, pack.floorUsd, pack.styleReference], [12, 3.5, true]);
  const items = ['a small pumpkin', 'a stack of three books', 'a mug of hot cider with steam', 'a beeswax candle', 'a maple leaf scatter', 'a knitted throw', 'a brass lantern', 'a jar of cinnamon sticks', 'an acorn and pinecone cluster', 'a steaming teapot', 'a small friendly ghost plush', 'a cozy desk lamp'];
  const c = composeOwnerBrief({ title: 'Cozy Autumn Desk Props', theme: 'A warm autumn study desk in a soft painted look.', audience: 'PNGTuber and VTuber streamers', productKey: 'pngtuber-prop-pack', items, minUsd: 3.5, maxUsd: 9, ownerFile1: true }, { products: REAL.products, cfg: REAL.station, today: '2026-10-19' });
  assert.ok(c.ok, c.problems.join('; '));
  assert.equal(c.id, '2026-10-19--cozy-autumn-desk-props');
  assert.match(c.text, /^ownerFile1: true$/m); assert.match(c.text, /^owner bounds: USD 3\.50–9\.00 \(owner brief, 2026-10-19\)$/m); assert.match(c.text, /^12\. A cozy desk lamp\.$/m);
  const chk = checkOwnerBrief(c.text, { products: REAL.products, cfg: REAL.station });
  assert.ok(chk.ok, (chk.reasons || []).join('; '));
  // the form's own refusals: the count from the spec, the floor, the bounds, the product
  const bad = (o) => composeOwnerBrief({ title: 'Cozy Autumn Desk Props', theme: 'A warm autumn study desk.', audience: 'streamers', productKey: 'pngtuber-prop-pack', items, minUsd: 3.5, maxUsd: 9, ...o }, { products: REAL.products, cfg: REAL.station, today: '2026-10-19' });
  assert.match(bad({ items: items.slice(0, 11) }).problems.join(), /has 12 files: give exactly 12 items \(got 11\)/);
  assert.match(bad({ minUsd: 3.49 }).problems.join(), /below the floor USD 3\.50/);
  assert.match(bad({ minUsd: 9.5 }).problems.join(), /lowest price is above the highest/);
  assert.match(bad({ productKey: 'nope' }).problems.join(), /pick a product/);
  assert.equal(bad({ ownerFile1: false }).text.includes('ownerFile1'), false, 'no pause line unless the owner asks for it');
  assert.equal(slugOf('Café Props: Autumn!'), 'cafe-props-autumn');
});

test('owner brief from the page: saved through the intake checks (no confirm: saving spends nothing); a refused brief saves nothing', async (t) => {
  const { post, r, snap } = await boot(t, { tag: 'l2form' });
  const s0 = await snap(), P = s0.ownerBriefForm.products.find((p) => p.key === 'dry-run-sticker-pack-5');
  assert.equal(P.files, 5); assert.ok(P.floorUsd > 0);
  const ok = await post('/api/tasks/owner-brief', form({ minUsd: P.floorUsd, maxUsd: P.floorUsd + 3 }));
  assert.equal(ok.status, 200, ok.text);
  const id = dublinDay() + '--woodland-mushroom-stickers';
  assert.deepEqual([ok.json.result.id, ok.json.result.file], [id, id + '.md']);
  assert.ok(fs.existsSync(path.join(r.dataRoot, 'research', 'briefs', id + '.md')));
  const listed = (await snap()).briefs.find((b) => b.id === id); assert.equal(listed.status, 'owner');
  // a brief naming a brand or character is refused by the originality screen of the whole brief: nothing is saved
  const ip = await post('/api/tasks/owner-brief', form({ title: 'Mickey Mouse Mushroom Stickers', minUsd: P.floorUsd, maxUsd: P.floorUsd + 3 }));
  assert.equal(ip.status, 400); assert.match(ip.json.error, /refused at intake .*originality/);
  assert.equal(fs.existsSync(path.join(r.dataRoot, 'research', 'briefs', dublinDay() + '--mickey-mouse-mushroom-stickers.md')), false);
  // the form's own checks: below the floor, wrong item count
  const low = await post('/api/tasks/owner-brief', form({ title: 'Low Price Mushrooms', minUsd: Math.max(0.01, P.floorUsd - 0.5), maxUsd: P.floorUsd + 3 }));
  assert.equal(low.status, 400); assert.match(low.json.error, /below the floor/);
  const few = await post('/api/tasks/owner-brief', form({ title: 'Too Few Mushrooms', items: ITEMS.slice(0, 4), minUsd: P.floorUsd, maxUsd: P.floorUsd + 3 }));
  assert.equal(few.status, 400); assert.match(few.json.error, /give exactly 5 items/);
});

// ---- 2. the spend confirmation and its refusals

test('spend quote: line, models, job cap, today against the daily cap, the Console limit if configured; "mock: $0" on the mock', async (t) => {
  const { quote, engine } = await boot(t, { tag: 'l2quote' });
  const q = await quote('start-line', { file: JOB_A + '.md' });
  assert.equal(q.mock, true); assert.match(q.mockNote, /^mock: \$0/);
  assert.equal(q.line, 'room1-digital');
  assert.ok(q.agents.some((a) => a.agent === 'designer' && /^mock \(/.test(a.model)));
  assert.deepEqual([q.job.capUsd, q.day.capUsd, q.day.spentUsd, q.day.worstUsd], [REAL.engine.caps.perJobUsd, REAL.engine.caps.perDayUsd, 0, REAL.engine.caps.perJobUsd]);
  assert.equal(q.console.configured, false); assert.match(q.console.note, /not configured/);
  assert.match(q.token, /^[0-9a-f]{36}$/); assert.deepEqual(q.refusals, []);
  assert.match(spendHtml(q), /mock: \$0/); assert.match(spendHtml(q), /monthly limit not configured/);
  // the Console limit when the owner sets it: the limit less this Dublin month's Anthropic rows in the ledger
  engine.cfg.engine.outerLimits = { ...engine.cfg.engine.outerLimits, anthropicConsoleMonthlyUsd: 20 };
  engine.ledger.append({ ts: Date.now(), jobId: null, runId: 'r-test', agentKey: 'lister', line: 'room1-digital', provider: 'anthropic', model: 'claude-haiku-5-5', kind: 'text', count: 1, usd: 1.25 });
  const q2 = await quote('research', { text: 'cosy autumn sticker niches' });
  assert.deepEqual([q2.console.configured, q2.console.limitUsd, q2.console.usedUsd, q2.console.leftUsd], [true, 20, 1.25, 18.75]);
  assert.equal(q2.day.spentUsd, 1.25);
  assert.match(spendHtml(q2), /USD 18\.75 left of the monthly limit USD 20\.00/);
});

test('every spending endpoint refuses without the confirm step, with a reused or mismatched token, under the e-stop and over the daily cap', async (t) => {
  const { post, quote, confirmed, engine, job, settled } = await boot(t, { tag: 'l2refuse' });
  const jobsBefore = engine.store.listJobs().length;
  // no token: nothing starts
  for (const [p, body] of [['/api/tasks/brief', { file: JOB_A + '.md' }], ['/api/tasks/research', { text: 'woodland niches' }]]) {
    const r = await post(p, body); assert.equal(r.status, 428, p + ' ' + r.text); assert.equal(r.json.code, 'CONFIRM_REQUIRED');
  }
  assert.equal(engine.store.listJobs().length, jobsBefore, 'no job created without the confirm step');
  // a token for other settings, a made-up token
  const qA = await quote('research', { text: 'woodland niches' });
  assert.equal((await post('/api/tasks/research', { text: 'something else', confirmToken: qA.token })).status, 428);
  assert.equal((await post('/api/tasks/research', { text: 'woodland niches', confirmToken: 'f'.repeat(36) })).status, 428);
  // the right token works once; the same token again is refused (single use)
  const first = await post('/api/tasks/research', { text: 'woodland niches', confirmToken: qA.token }); assert.equal(first.status, 200, first.text);
  const again = await post('/api/tasks/research', { text: 'woodland niches', confirmToken: qA.token }); assert.equal(again.status, 428);
  await settled(first.json.result.jobId);
  // the e-stop: the quote says so and has no token; a token taken before the e-stop is refused (423)
  const qB = await quote('start-line', { file: JOB_A + '.md' });
  await post('/api/engine/halt', { reason: 'test' });
  const qH = await quote('start-line', { file: JOB_A + '.md' }); assert.equal(qH.token, null); assert.match(qH.refusals[0], /e-stop is on/);
  const h = await post('/api/tasks/brief', { file: JOB_A + '.md', confirmToken: qB.token }); assert.equal(h.status, 423); assert.equal(engine.store.getJob(JOB_A), undefined);
  await post('/api/engine/resume', { confirm: 'RESUME', expectedVersion: engine.halt.state.at || 0 });
  assert.equal(engine.halt.isHalted(), false);
  // the daily cap: a quote that would take today over it has no token; a token taken before the spend moved is refused (422)
  const qC = await quote('start-line', { file: JOB_A + '.md' });
  engine.ledger.append({ ts: Date.now(), jobId: null, runId: 'r-cap', agentKey: 'designer', line: 'room1-digital', provider: 'openrouter', model: 'openai/gpt-5-image-mini', kind: 'image', count: 1, usd: 6 });
  const qD = await quote('start-line', { file: JOB_A + '.md' }); assert.equal(qD.token, null); assert.match(qD.refusals.join(), /daily cap would be exceeded: spent today USD 6\.00 \+ open jobs up to USD 0\.00 \+ this up to USD 5\.00 = USD 11\.00, over USD 10\.00/);
  const capped = await post('/api/tasks/brief', { file: JOB_A + '.md', confirmToken: qC.token }); assert.equal(capped.status, 422, capped.text); assert.equal(capped.json.code, 'DAY_CAP');
  assert.equal(engine.store.getJob(JOB_A), undefined, 'nothing started over the cap');
  // resume (restart) and the run modes go through the same gate
  engine.store.insertJob({ id: '2026-10-19--l2-stopped', line: 'room1-digital', kind: 'line', title: 'stopped', state: 'stopped', step: 'designer', data: {} });
  const rs = await post('/api/jobs/restart', { jobId: '2026-10-19--l2-stopped', expectedVersion: job('2026-10-19--l2-stopped').version }); assert.equal(rs.status, 428);
  const qo = await post('/api/jobs/qa-only', { jobId: '2026-10-19--l2-stopped', set: 1, maxUsd: 1, expectedVersion: job('2026-10-19--l2-stopped').version }); assert.equal(qo.status, 428);
  const lo = await post('/api/jobs/listing-only', { jobId: '2026-10-19--l2-stopped', maxUsd: 1, expectedVersion: job('2026-10-19--l2-stopped').version }); assert.equal(lo.status, 428);
  const rl = await post('/api/tasks/rerun-listing', { jobId: '2026-10-19--l2-stopped', expectedVersion: job('2026-10-19--l2-stopped').version }); assert.equal(rl.status, 428);
  // an agent back on duty with a waiting job: the same gate (with nothing waiting it spends nothing and needs none)
  const off = await post('/api/agents/update', { agentKey: 'lister', expectedVersion: 0, enabled: false }); assert.equal(off.status, 200);
  const on = await post('/api/agents/update', { agentKey: 'lister', expectedVersion: off.json.result.version, enabled: true }); assert.equal(on.status, 200, 'nothing waits: no confirm needed');
  void confirmed;
});

// ---- 3. the job limit

test('at most one job runs at a time on an instance; a second start waits as "next" and starts when the first ends', async (t) => {
  const { confirmed, snap, job, settled, engine, quote } = await boot(t, { tag: 'l2next', mockDelayMs: 60 });
  const a = await confirmed('/api/tasks/brief', 'start-line', { file: JOB_A + '.md' }); assert.equal(a.status, 200, a.text);
  await until(() => job(JOB_A).state === 'running');
  const q = await quote('research', { text: 'woodland niches' }); assert.equal(q.queue.startsAsNext, true); assert.deepEqual(q.queue.running, [JOB_A]);
  assert.equal(q.day.openJobsUsd, REAL.engine.caps.perJobUsd, 'the running job\'s cap counts towards the day');
  const b = await confirmed('/api/tasks/research', 'research', { text: 'woodland niches' }); assert.equal(b.status, 200, b.text);
  const bid = b.json.result.jobId;
  assert.equal(job(bid).state, 'queued'); assert.match(job(bid).reason, /^next: waiting for 2026-10-16--dry-run-mushroom-stickers \(at most 1 job running at a time\)/);
  const s = await snap(), sj = s.jobs.find((x) => x.id === bid);
  assert.equal(sj.next, true); assert.deepEqual(s.jobLimit, { maxRunning: 1, running: [JOB_A], next: [bid] });
  // the live status of the running job: stage, agent at work, spend against the cap, its last 5 events
  const live = s.jobs.find((x) => x.id === JOB_A).liveStatus;
  assert.equal(live.running, true); assert.equal(live.capUsd, REAL.engine.caps.perJobUsd); assert.ok(live.events.length > 0 && live.events.length <= 5);
  assert.ok(live.events.every((e) => typeof e.text === 'string' && e.text.length));
  assert.equal(engine.orchestrator.active().length, 1);
  await settled(JOB_A);
  await until(() => job(bid).state !== 'queued' || !job(bid).data.next, { timeout: 20000 });
  await settled(bid);
  assert.notEqual(job(bid).state, 'queued', 'the next job started by itself'); assert.equal(job(bid).data.next, false);
});

// ---- 4. steering from the job panel

test('steering: amendment, set rejection, the file-1 decision\'s controls; the region-fix tools stay CLI', async (t) => {
  const { post, snap, job, r, engine } = await boot(t, { tag: 'l2steer' });
  const ID = '2026-10-19--l2-steer';
  engine.store.insertJob({ id: ID, line: 'room1-digital', kind: 'line', title: 'L2 steer', product_key: 'dry-run-sticker-pack-5', state: 'blocked', step: 'qa-design', data: {} });
  r.J.put(path.join(r.dataRoot, 'jobs', ID, 'brief.md'), briefText(JOB_A).replace(JOB_A, ID));
  r.J.put(path.join(r.dataRoot, 'jobs', ID, 'set-v1', 'design.md'), '# set-v1\n');
  r.J.put(path.join(r.dataRoot, 'jobs', ID, 'qa', 'design-pass1.json'), JSON.stringify({ stage: 'design', verdict: 'revise', reasons: ['x'] }));
  let c = (await snap()).jobs.find((x) => x.id === ID).controls;
  assert.equal(c.amend, true); assert.deepEqual(c.setDecision, { set: 1 }); assert.deepEqual(c.fixTools, { set: 1 }); assert.equal(c.file1, null);
  const am = await post('/api/owner/amend', { jobId: ID, text: 'Item 3 now reads: an acorn house with a round door.', date: dublinDay(), expectedVersion: job(ID).version });
  assert.equal(am.status, 200, am.text);
  assert.ok(fs.readdirSync(path.join(r.dataRoot, 'jobs', ID, 'amendments')).some((f) => /^001-\d{4}-\d{2}-\d{2}\.md$/.test(f)));
  const stale = await post('/api/owner/set-rejection', { jobId: ID, set: 1, words: 'not cohesive', expectedVersion: job(ID).version - 1 }); assert.equal(stale.status, 409);
  const rj = await post('/api/owner/set-rejection', { jobId: ID, set: 1, words: 'the five do not read as one set', expectedVersion: job(ID).version });
  assert.equal(rj.status, 200, rj.text);
  assert.equal(job(ID).state, 'rejected'); assert.match(job(ID).reason, /^owner rejected set-v1 \(\d{4}-\d{2}-\d{2}\): the five do not read as one set$/);
  assert.match(fs.readFileSync(path.join(r.dataRoot, 'jobs', ID, 'owner-decisions.jsonl'), 'utf8'), /"kind":"set-rejection"/);
  // a job waiting for the owner's decision on file 1 offers it, with the review images
  const W = '2026-10-19--l2-file1';
  engine.store.insertJob({ id: W, line: 'room1-digital', kind: 'line', title: 'L2 file 1', product_key: 'dry-run-sticker-pack-5', state: 'queued', step: 'designer', data: { waitingFor: 'owner-style-ref', autoStart: false, styleRef: { awaiting: { set: 2 } } } });
  r.J.put(path.join(r.dataRoot, 'jobs', W, 'brief.md'), 'x'); r.J.put(path.join(r.dataRoot, 'jobs', W, 'set-v2', 'review', '01-pumpkin-on-white.png'), 'png');
  const sw = (await snap()).jobs.find((x) => x.id === W);
  assert.deepEqual(sw.controls.file1, { set: 2 }); assert.equal(sw.controls.restart, false, 'it resumes only after the decision');
  assert.deepEqual(sw.file1Review.images.map((i) => i.url), ['/api/office/image/job/' + W + '/set-v2/review/01-pumpkin-on-white.png']);
  // the page offers it all; the region-fix commands are shown, not run
  const sp = fs.readFileSync(path.join(APP_ROOT, 'src', 'web', 'ui', 'sidepanel.js'), 'utf8');
  for (const s of ["'/api/owner/amend'", "'/api/owner/style-ref'", "'/api/owner/set-approval'", "'/api/owner/set-rejection'", "spendAct('restart'", 'npm run owner -- edit-set ', 'npm run owner -- rebuild ']) assert.ok(sp.includes(s), s);
});

// ---- 5. the Design card, the Real-ESRGAN status, 127.0.0.1 only

test('Design card: sets and the QA pass rate come from every line job (a packaged set\'s zip counts; file-1 checks count)', (t) => {
  const r = tempRoot('l2design');
  const engine = createEngine({ J: r.J, log: r.log, startScheduler: false, resume: false });
  t.after(() => { try { engine.close(); } catch (_) {} r.cleanup(); });
  const ID = '2026-10-17--cozy-autumn-like', jd = path.join(r.dataRoot, 'jobs', ID);
  engine.store.insertJob({ id: ID, line: 'room1-digital', kind: 'line', title: 'like the autumn job', product_key: 'pngtuber-prop-pack', state: 'approval', step: 'package', data: {} });
  for (const v of [2, 4]) { r.J.put(path.join(jd, 'set-v' + v, 'files', 'pack.zip'), 'zip'); r.J.put(path.join(jd, 'set-v' + v, 'build', '01-small-pumpkin.png'), 'png'); }
  r.J.put(path.join(jd, 'set-v1', 'raw', '01-small-pumpkin.png'), 'png'); r.J.put(path.join(jd, 'set-v3', 'raw', '02-x.png'), 'png');
  r.J.put(path.join(jd, 'qa', 'design-pass1.json'), JSON.stringify({ verdict: 'revise' })); r.J.put(path.join(jd, 'qa', 'design-pass2.json'), JSON.stringify({ verdict: 'revise' })); r.J.put(path.join(jd, 'qa', 'file1-pass1.json'), JSON.stringify({ verdict: 'approved' }));
  const s = buildEngineSnapshot(engine), d = s.departments.find((x) => x.key === 'design');
  assert.deepEqual(d.metrics.map((m) => [m.label, m.value]), [['sets made', 2], ['QA pass rate', '33% (1 of 3)']]);
  const j = s.jobs.find((x) => x.id === ID);
  assert.deepEqual(j.images.map((i) => i.file), ['set-v2/build/01-small-pumpkin.png', 'set-v4/build/01-small-pumpkin.png'], 'a packaged set shows its built PNGs');
  const svc = s.services.find((x) => x.id === 'realesrgan');
  assert.doesNotMatch(svc.detail, /not wired/); assert.ok(['configured', 'offline'].includes(svc.status));
  if (svc.status === 'offline') assert.ok(svc.reason, 'a red pill always carries its reason');
});

test('Real-ESRGAN status: green only when the pinned files match and the Vulkan loader is there; otherwise red with the reason', (t) => {
  const r = tempRoot('l2esr'); t.after(() => r.cleanup());
  const root = path.join(r.base, 'app'), bin = path.join(root, 'tools', 'realesrgan', 'realesrgan-ncnn-vulkan.exe');
  fs.mkdirSync(path.join(path.dirname(bin), 'models'), { recursive: true });
  fs.writeFileSync(bin, 'binary'); fs.writeFileSync(path.join(path.dirname(bin), 'vcomp140.dll'), 'dll'); fs.writeFileSync(path.join(path.dirname(bin), 'models', 'm.bin'), 'model');
  const pin = { binary: 'tools/realesrgan/realesrgan-ncnn-vulkan.exe', sha256: sha(bin), files: { 'vcomp140.dll': sha(path.join(path.dirname(bin), 'vcomp140.dll')), 'models/m.bin': sha(path.join(path.dirname(bin), 'models', 'm.bin')) } };
  const sys = path.join(r.base, 'win'); fs.mkdirSync(path.join(sys, 'System32'), { recursive: true });
  const noVk = upscalerStatus(pin, { root, platform: 'win32', env: { SystemRoot: sys } });
  assert.equal(noVk.status, 'offline'); assert.match(noVk.reason, /no Vulkan loader/);
  fs.writeFileSync(path.join(sys, 'System32', 'vulkan-1.dll'), 'vk');
  const ok = upscalerStatus(pin, { root, platform: 'win32', env: { SystemRoot: sys } });
  assert.equal(ok.status, 'configured', ok.detail); assert.equal(ok.reason, null); assert.match(ok.detail, /sha256 match/);
  fs.writeFileSync(path.join(path.dirname(bin), 'models', 'm.bin'), 'changed model');
  const bad = upscalerStatus(pin, { root, platform: 'win32', env: { SystemRoot: sys } });
  assert.equal(bad.status, 'offline'); assert.match(bad.reason, /models\/m\.bin is missing or differs from its sha256/);
  assert.match(upscalerStatus({ ...pin, binary: 'tools/realesrgan/none.exe' }, { root, platform: 'win32', env: { SystemRoot: sys } }).reason, /not installed/);
});

test('the Station page is served on 127.0.0.1 only, and the live status reads the engine\'s events', () => {
  const src = fs.readFileSync(path.join(APP_ROOT, 'src', 'server', 'index.mjs'), 'utf8');
  const listens = src.match(/\.listen\([^)]*\)/g) || [];
  assert.ok(listens.length >= 2); for (const l of listens) assert.match(l, /'127\.0\.0\.1'/, l);
  assert.equal(eventText({ type: 'run.end', agentKey: 'designer', data: { status: 'done', usd: 0.0123, turns: 4 } }, { designer: 'DESIGNER' }), 'DESIGNER done · USD 0.0123 · 4 turns');
  assert.equal(eventText({ type: 'job.stage', data: { waiting: 'owner-style-ref' } }), 'waits for your decision on file 1');
});

// ---- 6. end to end on the mock: a brief from the form, Start line, the approval queue, Approve

test('end to end (mock): owner brief from the form -> confirm -> Start line -> approval queue -> Approve', async (t) => {
  const probe = formProducts(OVERRIDES.productsFile.products, loadConfig({ configDir: path.join(APP_ROOT, 'config'), promptsDir: path.join(APP_ROOT, 'prompts'), overrides: OVERRIDES }).station).find((p) => p.key === 'dry-run-sticker-pack-5');
  const lo = probe.floorUsd, hi = Math.round((lo + 3) * 100) / 100;
  const { post, quote, snap, job, settled, r, engine } = await boot(t, { tag: 'l2e2e', proposalUsd: lo });
  const saved = await post('/api/tasks/owner-brief', form({ minUsd: lo, maxUsd: hi }));
  assert.equal(saved.status, 200, saved.text);
  const file = saved.json.result.file, id = saved.json.result.id;
  assert.ok((await snap()).briefs.some((b) => b.file === file && b.status === 'owner' && !b.jobId));
  const q = await quote('start-line', { file });
  assert.equal(q.mock, true); assert.deepEqual(q.refusals, []); assert.equal(q.queue.startsAsNext, false);
  const st = await post('/api/tasks/brief', { file, confirmToken: q.token });
  assert.equal(st.status, 200, st.text); assert.equal(st.json.result.jobId, id);
  const end = await settled(id);
  assert.equal(end.state, 'approval', end.reason);
  const s = await snap(), sj = s.jobs.find((x) => x.id === id);
  assert.equal(sj.evidenceLevel, 'owner'); assert.equal(sj.queue.status, 'pending'); assert.equal(sj.controls.approve, true);
  assert.ok(fs.existsSync(path.join(r.dataRoot, 'jobs', id, 'package', 'MANIFEST.json')));
  assert.equal(engine.ledger.rowsForJob(id).reduce((x, row) => x + row.usd, 0), 0, 'mock: $0');
  const ap = await post('/api/approvals/decide', { jobId: id, action: 'approve', expectedVersion: sj.queue.version });
  assert.equal(ap.status, 200, ap.text);
  assert.equal(engine.store.getApproval(id).status, 'approved');
  assert.equal((await snap()).jobs.find((x) => x.id === id).status, 'done');
  void job;
});
