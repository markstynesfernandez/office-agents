// r7b-office.test.mjs — R7b (owner, 02/11/2026): the 3D office items R7a left out (RESTRUCTURE.md §7).
//   1 product colours: each product's config colour (#rrggbb, checked at start), in the company model; a job and an agent's current job
//     carry their product
//   2 the CI wall: per product of the engineering line, from that product's jobs only
//   3 the lobby lounge: a seat on every couch, armchair and bench cushion; each walk leaves the lift door, keeps clear of the furniture
//     and ends on its seat; every hired agent not on a step sits there, top floor first
//   4 the page's colour tags: a board card and a request card lead with the product's tag; a monitor's job line names the product
//   5 the page (Playwright, headless): the lobby shows a person on a seat for each hired agent; one that gets a step walks to the lift
//     and is no longer drawn, and walks back to its seat when free; no page error (R7B_SHOTS=<dir>: lobby and CI wall screenshots)
// Mock provider, temp data roots, no model call, $0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempRoot } from './helpers/engine.mjs';
import { createEngine } from '../src/engine/engine.mjs';
import { createEngineServer } from '../src/server/engine-server.mjs';
import { buildEngineSnapshot } from '../src/server/engine-model.mjs';
import { APP_ROOT } from '../src/engine/store/jail.mjs';
import { validateCompany } from '../src/engine/building.mjs';
import { planFloor, lobbyLounge, LIFT_DOOR, SLAB, screenContent } from '../src/web/scene/towerplan.js';
import { productOf, productTag } from '../src/web/ui/format.js';

function engineOn(t, tag) {
  const r = tempRoot(tag), engine = createEngine({ archiveSandbox: true, J: r.J, log: r.log, startScheduler: false });
  t.after(() => { try { engine.close(); } catch (_) {} r.cleanup(); });
  return engine;
}
const products = () => fs.readdirSync(path.join(APP_ROOT, 'config', 'products')).filter((f) => f.endsWith('.json') && !f.startsWith('_')).map((f) => JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'config', 'products', f), 'utf8')));

test('1: every product has its colour, checked at start and in the company model; jobs and current jobs carry their product', (t) => {
  const P = products();
  for (const p of P) assert.match(p.color, /^#[0-9a-f]{6}$/i, p.id + ': a #rrggbb colour');
  assert.equal(new Set(P.filter((p) => p.status === 'active').map((p) => p.color.toLowerCase())).size, P.filter((p) => p.status === 'active').length, 'no two active products share a colour');
  const bad = validateCompany({ company: { products: [{ id: 'replydesk', name: 'ReplyDesk', status: 'active', monthlyBudgetUsd: 80, dataDir: 'products/replydesk/', color: 'teal' }], departments: [] } });
  assert.ok(bad.some((x) => /color must be #rrggbb/.test(x)), 'a colour that is not #rrggbb stops the engine');
  assert.ok(!validateCompany({ company: { products: [{ id: 'replydesk', name: 'ReplyDesk', status: 'active', monthlyBudgetUsd: 80, dataDir: 'products/replydesk/' }], departments: [] } }).some((x) => /color/.test(x)), 'the colour is optional');
  const engine = engineOn(t, 'r7b1'), s = buildEngineSnapshot(engine);
  assert.deepEqual(Object.fromEntries(s.company.products.map((p) => [p.id, p.color])), Object.fromEntries(P.map((p) => [p.id, p.color])));
  engine.store.insertJob({ id: 'r7b-eng-1', line: 'engineering', kind: 'engineering', title: 'Colour me', state: 'queued', productId: 'replydesk', departmentId: 'engineering' });
  const j = buildEngineSnapshot(engine).jobs.find((x) => x.id === 'r7b-eng-1');
  assert.equal(j.productId, 'replydesk');
  const src = fs.readFileSync(path.join(APP_ROOT, 'src', 'server', 'engine-model.mjs'), 'utf8');
  assert.match(src, /currentJob: liveJob \? \{[^}]*productId: liveJob\.productId \|\| null \}/, 'an agent\'s current job carries its product');
});

test('2: the CI wall: per product of the engineering line, from that product\'s jobs only', (t) => {
  const engine = engineOn(t, 'r7b2');
  engine.store.insertJob({ id: 'r7b-eng-2', line: 'engineering', kind: 'engineering', title: 'Lint the views', state: 'blocked', productId: 'replydesk', departmentId: 'engineering', data: { checks: [{ check: 'test', passed: true }, { check: 'lint', passed: true }], checksPass: 3 } });
  engine.store.insertJob({ id: 'r7b-eng-3', line: 'engineering', kind: 'engineering', title: 'Someone else\'s', state: 'blocked', productId: 'emty-inbox', departmentId: 'engineering', data: { checks: [{ check: 'test', passed: false }] } });
  const s = buildEngineSnapshot(engine), bp = s.engineering.byProduct;
  assert.deepEqual(bp.map((p) => [p.id, p.name, p.color]), [['replydesk', 'ReplyDesk', '#2a9d8f']], 'the engineering line\'s products only');
  assert.deepEqual([bp[0].lastChecks.jobId, bp[0].lastChecks.pass, bp[0].lastChecks.results], ['r7b-eng-2', 3, [{ check: 'test', passed: true }, { check: 'lint', passed: true }]], 'ReplyDesk\'s own job, not another product\'s');
  const wall = screenContent('checks', s);
  assert.deepEqual([wall.title, wall.rows.map((r) => [r.label, r.value, r.tone])], ['CI wall', [['ReplyDesk', 'passing', 'ok'], ['test · pass 3', 'passed', 'ok'], ['lint · pass 3', 'passed', 'ok']]]);
  assert.equal(wall.rows[0].swatch, '#2a9d8f');
});

// rough footprints of the lobby's furniture (x0, z0, x1, z1) for the walk check
function footprint(p) {
  const rot = (w, d) => (Math.abs(Math.sin(p.yaw || 0)) > 0.7 ? [d, w] : [w, d]);
  const box = (w, d) => { const [a, b] = rot(w, d); return { x0: p.x - a / 2, z0: p.z - b / 2, x1: p.x + a / 2, z1: p.z + b / 2 }; };
  switch (p.kind) {
    case 'couch': return box(p.len || 3.2, 0.92);
    case 'armchair': return box(0.9, 0.86);
    case 'bench': return box(p.len || 2.4, 0.5);
    case 'coffeeTable': return box(p.w || 1.8, p.d || 0.9);
    case 'pool': return box(p.w || 4, p.d || 2);
    case 'reception': return box(4.4, 1.6);
    case 'cabinet': return box(p.w || 6, 0.72);
    case 'plant': return box(0.8, 0.8);
    case 'floorLamp': return box(0.45, 0.45);
    default: return null;
  }
}
test('3: the lobby lounge: a seat per cushion, each walk from the lift door clear of the furniture, the hired agents seated top floor first', (t) => {
  const s = buildEngineSnapshot(engineOn(t, 'r7b3')), plan = planFloor(s, 'G'), L = plan.lounge;
  assert.ok(L, 'the lobby has its lounge');
  assert.equal(planFloor(s, '4').lounge, null, 'no other floor has one');
  const sofas = plan.props.filter((p) => ['couch', 'armchair', 'bench'].includes(p.kind));
  assert.equal(L.seats.length, sofas.reduce((n, p) => n + (p.kind === 'armchair' ? 1 : p.kind === 'bench' ? 2 : (p.len || 2.4) > 2.4 ? 3 : 2), 0), 'one seat per cushion');
  for (const [i, st] of L.seats.entries()) {
    assert.deepEqual(st.path[0], LIFT_DOOR, 'seat ' + i + ': the walk starts at the lift door');
    assert.deepEqual(st.path[st.path.length - 1], { x: st.x, z: st.z }, 'seat ' + i + ': and ends on the seat');
    const own = sofas.find((p) => { const f = footprint(p); return st.x >= f.x0 && st.x <= f.x1 && st.z >= f.z0 && st.z <= f.z1; });
    assert.ok(own, 'seat ' + i + ': on a couch, an armchair or a bench');
    // every step but the last (sitting down) keeps 0.25 clear of every piece of furniture and on the slab
    for (let k = 1; k < st.path.length - 1; k++) {
      const a = st.path[k - 1], b = st.path[k], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.05);
      for (let m = 0; m <= n; m++) {
        const q = { x: a.x + (b.x - a.x) * m / n, z: a.z + (b.z - a.z) * m / n };
        assert.ok(q.x > SLAB.x0 && q.x < SLAB.x1 && q.z > SLAB.z0 && q.z < SLAB.z1, 'seat ' + i + ': on the slab');
        for (const p of plan.props) { const f = footprint(p); if (!f) continue; assert.ok(!(q.x > f.x0 - 0.25 && q.x < f.x1 + 0.25 && q.z > f.z0 - 0.25 && q.z < f.z1 + 0.25), 'seat ' + i + ': step ' + k + ' at ' + q.x.toFixed(2) + ',' + q.z.toFixed(2) + ' clear of the ' + p.kind); }
      }
    }
  }
  // who: every hired agent with a person drawn, top floor first, one seat each
  const hired = ['6', '5', '4', '3'].flatMap((f) => planFloor(s, f).seats.filter((x) => x.state === 'hired' && x.drawn).map((x) => x.agentId));
  assert.ok(hired.length > 0 && hired.length <= L.seats.length);
  assert.deepEqual(L.visitors.map((v) => [v.agentId, v.seat]), hired.map((id, i) => [id, i]));
  assert.ok(L.visitors.every((v) => v.here), 'nobody is on a step: everyone sits in the lounge');
  const busy = { ...s, agents: s.agents.map((a) => (a.id === hired[0] ? { ...a, onStep: true } : a)) };
  assert.deepEqual(lobbyLounge(busy, plan.props).visitors.filter((v) => !v.here).map((v) => v.agentId), [hired[0]], 'an agent on a step is at its desk, not in the lounge');
  // more hired agents than seats: the rest are counted, not seated
  const many = JSON.parse(JSON.stringify(s)), eng = many.company.floors.find((d) => d.id === 'engineering');
  for (let i = 0; i < 20; i++) { eng.agents.push({ id: 'extra-' + i, name: 'EXTRA-' + i, status: 'active', label: 'hired' }); many.agents.push({ id: 'extra-' + i, name: 'EXTRA-' + i, status: 'idle', onStep: false }); }
  const ml = lobbyLounge(many, plan.props);
  assert.deepEqual([ml.visitors.length, ml.unseated], [L.seats.length, hired.length + 20 - L.seats.length]);
});

test('4: the colour tags in the page: a board card, a request card and a monitor name the product in its colour', (t) => {
  const s = buildEngineSnapshot(engineOn(t, 'r7b4'));
  assert.equal(productTag(productOf(s, 'replydesk')), '<span class="ptag" title="product: ReplyDesk"><i style="background:#2a9d8f"></i>ReplyDesk</span>');
  assert.match(productTag(productOf(s, 'gone')), /background:#9aa3ad.*>gone</, 'an unknown product: its id, grey');
  assert.equal(productTag(productOf(s, null)), '', 'no product, no tag');
  assert.equal(productTag({ name: 'x', color: 'red;background:url(x)' }).includes('url('), false, 'only a #rrggbb colour reaches the style');
  const web = (f) => fs.readFileSync(path.join(APP_ROOT, 'src', 'web', f), 'utf8');
  assert.match(web('ui/board.js'), /legacyTag\(j\) \+ productTag\(productOf\(lastSnap, j\.productId\)\)/, 'a board card');
  assert.match(web('ui/building.js'), /prod\(r\.productId\)/, 'a request card');
  assert.match(web('scene/monitor.js'), /prod\.name \+ ' · ' \+ job/, 'a monitor\'s job line');
  assert.match(web('scene/office.js'), /s\.tex\.draw\(a, theme, productOfAgent\(a\)\)/);
});

// ---- 5. the page in a real (headless) browser
test('5: the page: the lobby lounge shows every hired agent seated, no page error', { timeout: 180000 }, async (t) => {
  let launch;
  try { ({ launch } = await import('../scripts/screenshots.mjs')); } catch (e) { t.skip('Playwright is not available: ' + e.message); return; }
  const r = tempRoot('r7b5'), engine = createEngine({ archiveSandbox: true, J: r.J, log: r.log, startScheduler: false });
  const es = createEngineServer({ engine, log: r.log });
  await new Promise((res) => es.server.listen(0, '127.0.0.1', res));
  let browser = null;
  t.after(async () => { if (browser) await browser.close(); es.closeAll(); await new Promise((res) => es.server.close(res)); try { engine.close(); } catch (_) {} r.cleanup(); });
  try { ({ browser } = await launch({ headed: false })); } catch (e) { t.skip('no WebGL-capable browser: ' + e.message); return; }
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 }), problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console.error: ' + m.text()); });
  const base = 'http://127.0.0.1:' + es.server.address().port;
  await page.goto(base + '/?anim=0&quality=default&theme=light&floor=G', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__office && window.__office.ready(), null, { timeout: 60000 });
  const settle = () => page.waitForFunction(() => window.__office.settled(), null, { timeout: 15000 });
  for (const theme of ['light', 'dark']) {
    await page.evaluate((th) => window.__office.setTheme(th), theme); await settle();
    const st = await page.evaluate(() => window.__office.office.towerState());
    const plan = planFloor(await page.evaluate(() => window.__office.snapshot()), 'G');
    assert.equal(st.floor, 'G');
    assert.deepEqual(st.lounge.map((v) => [v.agentId, v.place]), plan.lounge.visitors.map((v) => [v.agentId, 'seat']), theme + ': every hired agent on its seat');
    if (process.env.R7B_SHOTS) await page.screenshot({ path: path.join(process.env.R7B_SHOTS, 'lobby-' + theme + '.png') });
  }
  // an agent that gets a step walks from its seat to the lift and is no longer drawn; free again, it walks back to its seat
  const walk = await page.evaluate(async () => {
    const o = window.__office.office, v = JSON.parse(JSON.stringify(window.__office.view())), id = v.plan.lounge.visitors[0].agentId, at = () => o.towerState().lounge.find((x) => x.agentId === id).place;
    const until = async (want) => { for (let i = 0; i < 150 && at() !== want; i++) await new Promise((r) => setTimeout(r, 100)); return at(); };
    o.setAnimate(true);
    Object.assign(v.plan.lounge.visitors[0], { onStep: true, here: false, status: 'working' }); o.setData(v);
    const out = [at(), await until('away')];
    Object.assign(v.plan.lounge.visitors[0], { onStep: false, here: true, status: 'idle' }); o.setData(v);
    out.push(at(), await until('seat'));
    o.setAnimate(false);
    return out;
  });
  assert.deepEqual(walk, ['walking', 'away', 'walking', 'seat']);
  // the other floors still draw only their desks
  await page.evaluate(() => window.__office.setFloor('4')); await settle();
  assert.deepEqual((await page.evaluate(() => window.__office.office.towerState())).lounge, []);
  if (process.env.R7B_SHOTS) {   // for the reviewer's eye: the CI wall with a sample pass (not asserted)
    await page.evaluate(async () => {
      const { planFloor } = await import('/scene/towerplan.js'), s = JSON.parse(JSON.stringify(window.__office.snapshot())), v = JSON.parse(JSON.stringify(window.__office.view()));
      s.engineering.byProduct = [{ id: 'replydesk', name: 'ReplyDesk', color: '#2a9d8f', current: { jobId: 'x', title: 'Lock approved replies', state: 'running', step: 'tester' }, lastChecks: { jobId: 'x', pass: 2, results: [{ check: 'test', passed: true }, { check: 'lint', passed: false }] } }];
      v.plan = planFloor(s, '4'); window.__office.office.setData(v);
      window.__office.office.focus({ x: -9.5, z: -2.8 }, 2.6);
    });
    await settle(); await page.screenshot({ path: path.join(process.env.R7B_SHOTS, 'ci-wall.png') });
  }
  assert.deepEqual(problems, []);
});
