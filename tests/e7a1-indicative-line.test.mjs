// e7a1-indicative-line.test.mjs — E7a.1 follow-up: with legacy Etsy-format briefs refused (owner decision 4, 20/10/2026) and the
// dry-run fixtures restated as owner briefs, these keep the indicative path covered end to end on the mock ($0):
//   - a verified indicative brief of each origin (genre-scout from the scout line, research from the research line) goes from
//     Start line through intake and the whole design line (DESIGNER, QA DESIGN with one rework, LISTER, QA LISTING, the package
//     gate) into the approval queue, priced from the brief's cited range
//   - the 3-price floor at intake on an indicative brief (owner, 17/10/2026; E7a): 3 cited current prices at or above USD 3.50
//     pass, 2 fail; a EUR row counts at the station rate (fx.usdToEur, to the cent), under it it does not
// The indicative fixture is e7a-scout's (fixtures/engine/scout-script.mjs researchBrief and the scout's genre briefs); the design
// line replies are the dry run's (fixtures/engine/mock-script.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempRoot } from './helpers/engine.mjs';
import { createEngine } from '../src/engine/engine.mjs';
import { loadConfig } from '../src/engine/config.mjs';
import { APP_ROOT } from '../src/engine/store/jail.mjs';
import { dublinDay } from '../src/engine/time.mjs';
import { isIndicativeBrief } from '../src/engine/lib/scout-brief.mjs';
import { createScoutScript, researchBrief, researchQuery, listingUrl } from '../fixtures/engine/scout-script.mjs';
import { createDryRunScript } from '../fixtures/engine/mock-script.mjs';

const FIX = path.join(APP_ROOT, 'fixtures', 'engine'), CONFIG = path.join(APP_ROOT, 'config'), PROMPTS = path.join(APP_ROOT, 'prompts');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
// the real products (pngtuber-prop-pack, floor USD 3.50) and the dry run's 5-sticker pack (what the dry-run design replies deliver)
const OVERRIDES = { productsFile: { products: [...readJson(path.join(CONFIG, 'archive', 'etsy', 'products.json')).products, ...readJson(path.join(FIX, 'products.json')).products] }, stationSet: readJson(path.join(FIX, 'station-config-patch.json')).set };
const STICKERS = 'dry-run-sticker-pack-5';
const DAY = dublinDay();
const LOFI = { slug: 'lofi-study', genre: 'lofi study', segment: 'students who stream study sessions', props: 'a desk lamp, a stack of notebooks, a mug of tea, a cassette player, a potted fern and a sleeping cat bed', palette: 'dusty rose, cream and teal', price: 9 };
const DESIGN_LINE = ['designer', 'qa-design', 'lister', 'qa-listing', 'rejects-desk'];
const research = (e, ...p) => path.join(e.J.dataRoot, 'research', ...p);
const idle = async (e) => { for (let i = 0; i < 800 && e.orchestrator.active().length; i++) await new Promise((r) => setTimeout(r, 25)); };

// research agents answer from the scout fixture, the design line from the dry run's; DEMAND-RESEARCHER runs `searches` (one turn),
// then writes `draft`; web: extra FIXTURE search results by query (else the scout fixture's)
function boot(t, { draft = null, searches = [], web = {} } = {}) {
  const r = tempRoot('e7a1-ind'), scout = createScoutScript();
  const line = createDryRunScript({ cfg: loadConfig({ configDir: CONFIG, promptsDir: PROMPTS, overrides: OVERRIDES }).station });
  const script = (ctx, params) => {
    if (ctx.purpose === 'image_analyze' || DESIGN_LINE.includes(ctx.agentKey)) return line(ctx, params);
    if (ctx.agentKey === 'demand-researcher' && draft) {
      const n = params.messages.filter((m) => m.role === 'assistant').length;
      return n === 0 ? { content: searches.map((q, i) => ({ type: 'tool_use', id: 'tu_s' + i, name: 'web_search', input: { query: q } })) }
        : n === 1 ? { content: [{ type: 'tool_use', id: 'tu_d', name: 'fs_write', input: { path: 'drafts/' + DAY + '/' + /^id: (\S+)$/m.exec(draft)[1] + '.md', content: draft } }] } : { content: [{ type: 'text', text: 'done' }] };
    }
    return scout(ctx, params);
  };
  script.web = (name, args) => (name === 'web_search' && web[args.query]) || scout.web(name, args);
  const e = createEngine({ archiveSandbox: true, J: r.J, log: r.log, script, configDir: CONFIG, overrides: OVERRIDES, startScheduler: false });
  t.after(async () => { await idle(e); try { e.close(); } catch (_) {} r.cleanup(); });
  return { e, r };
}
async function runLine(e, opts) { const c = e.orchestrator.createResearchJob({ by: 'test', ...opts }); await e.orchestrator.startJob(c.id); const j = e.store.getJob(c.id); assert.equal(j.state, 'research-done', j.reason); return j; }

test('an indicative brief of each origin (genre-scout, research) goes from Start line through intake and the whole design line into the approval queue ($0 mock)', async (t) => {
  const { e } = boot(t, { draft: researchBrief(DAY, LOFI).replace(/^product_type: .*$/m, 'product_type: ' + STICKERS), searches: [researchQuery(LOFI)] });
  await runLine(e, { line: 'genre-scout', productKey: STICKERS });
  await runLine(e, {});
  const files = { 'genre-scout': DAY + '--genre-cozy-farming-desk-props.md', research: DAY + '--genre-lofi-study-desk-props.md' };
  for (const [origin, f] of Object.entries(files)) {
    const text = fs.readFileSync(research(e, 'briefs', f), 'utf8');
    assert.match(text, new RegExp('^origin: ' + origin + '$', 'm')); assert.ok(isIndicativeBrief(text), f);
    assert.match(text, /^product_type: dry-run-sticker-pack-5$/m);
    assert.match(text, /^- citations: \d+, all returned by web calls in job \S+ \(transcript\)$/m, 'verified with the station citation record');
    const { jobId } = e.orchestrator.startBrief(f, { by: 'test' });
    await idle(e);
    const job = e.store.getJob(jobId);
    assert.equal(job.state, 'approval', origin + ': ' + job.reason);
    assert.equal(job.step, 'package');
    assert.match(e.store.stagesOf(jobId)[0].reason, /^brief checked: demand evidence/, origin + ': through intake');
    assert.deepEqual(job.loops, { design: 1 }, origin + ': one QA DESIGN rework');
    assert.ok(e.store.getApproval(jobId), origin + ': in the approval queue');
    const listing = readJson(path.join(e.J.dataRoot, 'jobs', jobId, 'package', 'listing.json'));
    assert.match(listing.priceSuggestion.source, /^brief\.md ## Price range, USD /, origin + ': priced from the brief\'s cited range, not an owner proposal');
    const cost = e.orchestrator.costRecord(jobId);
    assert.ok(cost.mock && cost.rows > 0 && cost.totalUsd === 0, origin + ': every row the $0 mock');
  }
});

test('the 3-price floor at intake on an indicative brief: 3 cited prices at or above USD 3.50 pass, 2 fail; a EUR row counts at the station rate', async (t) => {
  const FLOOR = { slug: 'floor-test', genre: 'floor test', segment: 'streamers', props: 'a desk lamp, a mug of tea and a potted fern', palette: 'sage and cream', price: 2.5 };
  const fx = loadConfig({ configDir: CONFIG, promptsDir: PROMPTS }).station.fx.usdToEur;
  // EUR at the floor (rounded up to the cent: counts) and one cent under it (does not count)
  const eurAt = (Math.ceil(3.5 * fx * 100) / 100).toFixed(2), eurUnder = ((Math.ceil(3.5 * fx * 100) - 1) / 100).toFixed(2);
  const main = researchQuery(FLOOR), eurQuery = 'floor test desk props png eur';
  const web = {
    [main]: 'FIXTURE search results for "' + main + '" (no real data):\nResults:\n' + [1, 2, 3, 4, 5].map((i) => '- FIXTURE listing ' + i + ' floor test desk props | ' + listingUrl(FLOOR.slug, i) + ' | USD ' + (2.5 + (i - 1) * 0.5).toFixed(2)).join('\n'),
    [eurQuery]: 'FIXTURE search results for "' + eurQuery + '" (no real data):\nResults:\n- FIXTURE EUR listing 1 | ' + listingUrl('floor-test-eur', 1) + ' | EUR ' + eurAt + '\n- FIXTURE EUR listing 2 | ' + listingUrl('floor-test-eur', 2) + ' | EUR ' + eurUnder
  };
  // rows USD 2.50, 3.00, 3.50, 4.00, 4.50: three at or above the floor
  const { e } = boot(t, { draft: researchBrief(DAY, FLOOR), searches: [main, eurQuery], web });
  await runLine(e, {});
  const V = fs.readFileSync(research(e, 'briefs', DAY + '--genre-floor-test-desk-props.md'), 'utf8');
  assert.match(V, /^- citations: \d+, all returned by web calls in job \S+ \(transcript\)$/m);
  const as = (text, slug) => text.replace(/^id: \S+$/m, 'id: ' + DAY + '--' + slug);
  // two at or above: row 5 at USD 3.00 (a price the search showed), the range's high end 4.00
  const two = V.replace(/\| USD 4\.50 \|/, '| USD 3.00 |').replace(/^USD 2\.50–4\.50 — /m, 'USD 2.50–4.00 — ');
  // the same, row 5 a EUR price the job's other search showed
  const eur = (v) => two.replace(/(\| 5 \| [^|]+\| )USD 3\.00( \|)/, '$1EUR ' + v + '$2');
  const intake = (text, slug) => e.orchestrator.createJob({ briefText: as(text, slug), by: 'test' });
  const r2 = intake(two, 'floor-two'), rEurUnder = intake(eur(eurUnder), 'floor-eur-under');
  for (const [r, at] of [[r2, 2], [rEurUnder, 2]]) {
    assert.equal(r.ok, false);
    assert.deepEqual(r.reasons, ['price: ' + at + ' of 5 cited listings show a current price at or above the floor USD 3.5, needs at least 3 (cheaper listings stay in the brief and never fail it)']);
  }
  const r3 = intake(V, 'floor-three'), rEurAt = intake(eur(eurAt), 'floor-eur-at');
  assert.equal(r3.ok, true, (r3.reasons || []).join('; '));
  assert.equal(rEurAt.ok, true, (rEurAt.reasons || []).join('; '));
  assert.match(e.store.stagesOf(r3.id)[0].reason, /^brief checked: demand evidence/);
});
