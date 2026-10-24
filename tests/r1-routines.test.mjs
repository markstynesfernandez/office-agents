// r1-routines.test.mjs — R1.1 (owner, R1 follow-up 24/10/2026): how the routines of a data root shaped like live after B0 behave once
// npm run migrate:products has run (tests/helpers/post-b0-fixture.mjs: the weekly genre scout, 2 legacy routines and "Weekday research",
// the last ENABLED as the worst case). On the archived Etsy lines:
//   - an enabled routine stays armed in the scheduler after the migration (the data is not changed), and every firing skips with
//     "archived" before any job, reservation or ledger row; the owner can disable it, and nothing can enable one again
//   - with every Etsy routine enabled (the worst case beyond live), none starts a job or spends
//   - the COO's report routine is seeded disabled and cannot be armed while the COO is not hired
// Mock only, $0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempRoot } from './helpers/engine.mjs';
import { buildPostB0Root } from './helpers/post-b0-fixture.mjs';
import { CONFIG, PROMPTS } from './helpers/r1.mjs';
import { createEngine } from '../src/engine/engine.mjs';
import { loadConfig } from '../src/engine/config.mjs';
import { openStore } from '../src/engine/store/db.mjs';
import { migrateProducts } from '../src/engine/lib/migrate-products.mjs';

const REAL = loadConfig({ configDir: CONFIG, promptsDir: PROMPTS });
const NOW = () => Date.parse('2026-10-23T08:00:00Z');   // a Friday, 09:00 Dublin: the weekday research routine's own hour
const ETSY_LINES = ['research', 'genre-scout', 'room1-digital'];

function migrated(t, tag, { enableAll = false } = {}) {
  const r = tempRoot(tag); t.after(() => r.cleanup());
  buildPostB0Root({ J: r.J, log: r.log });
  if (enableAll) { const s = openStore({ J: r.J, log: null }); s.db.exec('UPDATE routines SET enabled = 1'); s.close(); }
  const m = migrateProducts({ J: r.J, cfg: REAL, log: null, apply: true, now: NOW });
  assert.equal(m.applied, true); assert.deepEqual(m.unmapped, []);
  return r;
}
// the engine as live starts it (the scheduler on), and every routine fired once; what each firing did, and what was spent
async function fireAll(r) {
  const e = createEngine({ J: r.J, log: r.log, clock: NOW, resume: false });
  try {
    const before = { jobs: e.store.listJobs().length, ledger: e.ledger.totals.rows, usd: e.ledger.spent.day('2026-10-23') };
    const armed = e.scheduler.armed().sort();
    const out = {};
    for (const rt of e.store.listRoutines()) {
      const res = await e.scheduler.fire(rt);
      out[rt.id] = { target: rt.target, product: rt.product_id + '/' + rt.department_id, enabled: !!rt.enabled, armed: armed.includes(rt.id), result: res.skipped ? 'skipped: ' + res.skipped : res.error ? 'error: ' + res.error : 'STARTED ' + JSON.stringify(res) };
    }
    const after = { jobs: e.store.listJobs().length, ledger: e.ledger.totals.rows, usd: e.ledger.spent.day('2026-10-23') };
    return { e, armed, out, before, after };
  } catch (err) { e.close(); throw err; }
}

test('after migrate:products on a live-shaped root: only the enabled "Weekday research" is armed, every firing on the archived Etsy lines skips with "archived", no job, no reservation, no spend', async (t) => {
  const r = migrated(t, 'r1rt');
  const { e, armed, out, before, after } = await fireAll(r);
  try {
    assert.deepEqual(armed, ['rt_fix_weekday-research'], 'the one enabled before R1 stays armed: the migration changes no routine');
    assert.match(out['rt_fix_weekday-research'].result, /^skipped: archived: the research line is in the Etsy archive/);
    assert.equal(out['rt_fix_weekday-research'].product, 'etsy-shop/etsy');
    for (const id of ['rt_seed_weekly-genre-scout', 'legacy-r0', 'legacy-r1', 'rt_seed_coo-daily-report']) assert.equal(out[id].result, 'skipped: routine is disabled', id);
    assert.equal(out['rt_seed_coo-daily-report'].product, 'station/hq');
    assert.deepEqual(after, before, 'no job, no ledger row, no spend');
    assert.equal(e.guard.reservations().length, 0, 'no reservation'); assert.equal(e.guard.status().inFlight, 0);
    // the owner can disable it (no spend confirmation for that); nothing can enable an Etsy routine again
    const wr = e.store.getRoutine('rt_fix_weekday-research');
    e.routines.enable(wr.id, false, { expectedVersion: wr.version });
    assert.equal(e.store.getRoutine(wr.id).enabled, false); assert.deepEqual(e.scheduler.armed(), []);
    for (const id of ['rt_fix_weekday-research', 'rt_seed_weekly-genre-scout']) { const x = e.store.getRoutine(id); assert.throws(() => e.routines.enable(id, true, { expectedVersion: x.version }), (err) => err.code === 'ARCHIVED' && /cannot be armed: archived/.test(err.message), id); }
    const coo = e.store.getRoutine('rt_seed_coo-daily-report');
    assert.throws(() => e.routines.enable(coo.id, true, { expectedVersion: coo.version }), (err) => err.code === 'ARCHIVED' && /COO is not hired yet/.test(err.message));
  } finally { e.close(); }
});

test('worst case beyond live: every Etsy routine enabled before the migration; each is armed, none starts a job or spends', async (t) => {
  const r = migrated(t, 'r1rtall', { enableAll: true });
  const { e, armed, out, before, after } = await fireAll(r);
  try {
    assert.deepEqual(armed, ['legacy-r0', 'legacy-r1', 'rt_fix_weekday-research', 'rt_seed_weekly-genre-scout']);
    for (const [id, o] of Object.entries(out)) {
      assert.doesNotMatch(o.result, /^STARTED/, id);
      const line = (/^line:(.+)$/.exec(o.target) || [])[1];
      if (ETSY_LINES.includes(line)) assert.match(o.result, new RegExp('^skipped: archived: the ' + line + ' line is in the Etsy archive'), id);
    }
    assert.match(out['legacy-r0'].result, /^error: routine target not supported: legacy:agent:/, 'a legacy routine has no runner: nothing starts');
    assert.equal(out['rt_seed_coo-daily-report'].result, 'skipped: routine is disabled');
    assert.deepEqual(after, before, 'no job, no ledger row, no spend');
  } finally { e.close(); }
});
