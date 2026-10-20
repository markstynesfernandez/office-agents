// e6-c-owner.test.mjs — the owner decisions of 17/10/2026 (DECISIONS.md "E6 step c: owner brief path, research floor, scout
// paused"), station code only, no model, no network:
//   1 the research line (DEMAND-RESEARCHER's Etsy briefs) uses the genre-scout floor rule: the full range recorded, and the brief
//     passes on 3+ top-5 prices at or above the floor (cheaper rows never fail it, and may not be left out of the Price range)
//   5 an owner brief goes through intake with evidence level "owner" (no demand evidence claimed), every originality, IP,
//     blocklist and format check applies, and the approval card shows "Evidence: OWNER BRIEF — no market evidence"; LISTER
//     proposes the price within the owner bounds and the owner sets the final price at approval
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempRoot } from './helpers/engine.mjs';
import { createEngine } from '../src/engine/engine.mjs';
import { loadConfig } from '../src/engine/config.mjs';
import { APP_ROOT } from '../src/engine/store/jail.mjs';
import { checkBrief, floorRowsResearch } from '../src/engine/lib/brief-check.mjs';
import { validateOwnerBrief, checkOwnerBrief, isOwnerBrief, ownerBounds, proposalProblem } from '../src/engine/lib/owner-brief.mjs';
import { digitalPricing } from '../src/engine/lib/digital-prices.mjs';
import { evidenceLevelOf } from '../src/engine/lib/scout-brief.mjs';
import { isScoutBrief } from '../src/engine/lib/scouting.mjs';
import { buildEngineSnapshot } from '../src/server/engine-model.mjs';
import { evidenceBanner } from '../src/web/ui/evidence.js';

const CONFIG = path.join(APP_ROOT, 'config'), PROMPTS = path.join(APP_ROOT, 'prompts');
const CFG = loadConfig({ configDir: CONFIG, promptsDir: PROMPTS }), ST = CFG.station;
const PACK = CFG.products.find((p) => p.key === 'pngtuber-prop-pack');
const TODAY = new Date('2026-10-17T12:00:00Z');

// ---- decision 1: the research floor

// a research brief in the ported Etsy demand-evidence format with the given top-5 price cells and Price range
function researchBrief(prices, range, id = '2026-10-17--research-floor') {
  const rows = prices.map((p, i) => '| ' + (i + 1) + ' | Desk props ' + (i + 1) + ' | Shop' + (i + 1) + ' | ' + p + ' | ' + (100 * (i + 1)) + ' | no | https://www.etsy.com/listing/40' + (i + 1) + ' |');
  return ['---', 'id: ' + id, 'status: verified', 'product_type: pngtuber-prop-pack', 'audience_segment: streamers', '---', '# Niche', 'Cosy desk props for streamers', '',
    '## Demand evidence', 'search phrase: pngtuber desk props', 'checked: 2026-10-17', 'search URL: https://www.etsy.com/search?q=pngtuber+desk+props', 'competitor count: 1,240', 'saturation: medium — 1,240 results, top five 100-500 reviews',
    '| # | listing (short title) | shop | price | reviews | bestseller | URL |', '|---|---|---|---|---|---|---|', ...rows, '',
    '## Keywords', ...['pngtuber props', 'desk props png', 'stream desk props', 'vtuber desk assets', 'cosy desk props'].map((k, i) => '- ' + k + ' — https://www.etsy.com/listing/40' + (i + 1)), '',
    '## Sources', ...[1, 2, 3, 4, 5].map((n) => '- https://www.etsy.com/listing/40' + n), '',
    '## Price range', range + ' (https://www.etsy.com/listing/401)', '', '## Design direction', 'Original cosy desk props, soft outlines, no text.', ''].join('\n');
}
const rcheck = (t) => checkBrief(t, { products: CFG.products, cfg: ST, today: TODAY });

test('decision 1: a research brief passes on 3+ top-5 prices at or above the floor, cheap rows recorded in the full range', () => {
  const ok = rcheck(researchBrief(['USD 0.99', 'USD 1.50', 'USD 3.50', 'USD 4.99', 'USD 12.00'], 'USD 0.99–12.00'));
  assert.equal(ok.ok, true, ok.reasons.join('; ')); assert.match(ok.price.reason, /^3 of 5 top-5 prices at or above the floor USD 3\.5$/);
  // only 2 at or above the floor fails, whatever the high end
  const few = rcheck(researchBrief(['USD 0.99', 'USD 1.50', 'USD 3.49', 'USD 4.99', 'USD 12.00'], 'USD 0.99–12.00'));
  assert.equal(few.ok, false); assert.match(few.reasons[0], /^price: 2 of 5 top-5 prices at or above the floor USD 3\.5, needs at least 3 \(cheaper listings stay/);
  // a Price range that leaves out the cheap rows fails (the full range, never hidden)
  const hid = rcheck(researchBrief(['USD 0.99', 'USD 1.50', 'USD 3.50', 'USD 4.99', 'USD 12.00'], 'USD 3.50–12.00'));
  assert.equal(hid.ok, false); assert.match(hid.reasons[0], /^price: the Price range USD 3\.5–12 must be the full range of the top-5 prices, USD 0\.99–12\.00 \(cheap rows included/);
  // EUR rows count at the station rate (EUR 3.13 = USD 3.50 at 0.893256, to the cent)
  const eur = rcheck(researchBrief(['EUR 0.89', 'EUR 3.13', 'EUR 4.00', 'EUR 5.00', 'EUR 1.00'], 'USD 1.00–5.60'));
  assert.equal(eur.ok, true, eur.reasons.join('; '));
  assert.deepEqual(floorRowsResearch({ rows: [{ price: { currency: 'EUR', amount: 3.12 } }, { price: { currency: 'GBP', amount: 9 } }] }, 3.5, ST), { at: 0, of: 1, ok: false, min: 3.49, max: 3.49 });
  // the owner price line still replaces the rule (DESK-PROPS-01's brief)
  const owner = rcheck(researchBrief(['USD 0.99', 'USD 1.00', 'USD 1.10', 'USD 1.20', 'USD 1.30'], 'USD 0.99–1.30').replace('(https://www.etsy.com/listing/401)', '(https://www.etsy.com/listing/401)\nowner price: EUR 7.00–12.00 (recorded by owner, 2026-10-17)'));
  assert.equal(owner.ok, true, owner.reasons.join('; ')); assert.match(owner.price.reason, /^owner price EUR 7\.00–12\.00/);
});

test('decision 1: the prompts state the 3-price rule for both lines; EVIDENCE-CHECKER stays at most 14,000 chars', async () => {
  const skill = fs.readFileSync(path.join(PROMPTS, 'skills', 'price-rules-brief.md'), 'utf8');
  // E7a (owner decision 1, 19/10/2026): the prices are the cited non-Etsy results' (no Etsy top-5), or "owner sets price"
  assert.match(skill, /A brief passes when at least 3 of its cited result prices .* are at or above the BRIEF FLOOR/);
  assert.match(skill, /cheaper ones included; never drop, raise or round a price to pass/);
  assert.match(skill, /OWNER SETS PRICE: when no cited result shows a price/);
  assert.doesNotMatch(skill, /LOWEST price/);
  assert.match(fs.readFileSync(path.join(PROMPTS, 'skills', 'price-floor.md'), 'utf8'), /at least 3 sourced current prices in a brief must be at or above it/);
  assert.match(fs.readFileSync(path.join(PROMPTS, 'agents', 'demand-researcher.md'), 'utf8'), /PRICE: at least 3 cited prices must clear the BRIEF FLOOR/);
  const { buildAgentPrompt } = await import('../src/engine/prompts.mjs');
  const ec = buildAgentPrompt(CFG.agents['evidence-checker'], { promptsDir: PROMPTS });
  assert.ok(ec.chars <= 14000, 'evidence-checker is ' + ec.chars + ' chars');
  assert.match(ec.text, /Floor: the BRIEF FLOOR rule \(cheaper rows stay\)/);
});

// ---- decision 5: the owner brief

const OWNER_FILE = path.join(APP_ROOT, 'fixtures', 'engine', 'owner-brief.md');
const OWNER = fs.readFileSync(OWNER_FILE, 'utf8').replace(/\r\n/g, '\n');
const ocheck = (t) => checkOwnerBrief(t, { products: CFG.products, cfg: ST });

test('decision 5: an owner brief is accepted with evidence level "owner"; intake creates the job; saving is once and idempotent', (t) => {
  assert.equal(isOwnerBrief(OWNER), true); assert.equal(isScoutBrief(OWNER), false);
  assert.deepEqual(validateOwnerBrief(OWNER), []);
  const c = ocheck(OWNER);
  assert.equal(c.ok, true, c.reasons.join('; ')); assert.equal(c.evidence.level, 'owner'); assert.equal(evidenceLevelOf(OWNER), 'owner');
  assert.deepEqual(c.price.bounds, { min: 3.5, max: 9, date: '2026-10-17' });
  const r = tempRoot('c-owner'); t.after(r.cleanup);
  const e = createEngine({ J: r.J, log: r.log, configDir: CONFIG, promptsDir: PROMPTS, startScheduler: false }); t.after(() => e.close());
  const s = e.orchestrator.saveOwnerBrief({ text: OWNER, by: 'test' });
  assert.equal(s.ok, true, (s.reasons || []).join('; ')); assert.equal(s.changed, true); assert.equal(s.file, 'research/briefs/2026-10-17--cozy-autumn-desk-props.md');
  assert.equal(e.orchestrator.saveOwnerBrief({ text: OWNER, by: 'test' }).changed, false, 'the same text again: unchanged');
  const other = e.orchestrator.saveOwnerBrief({ text: OWNER.replace('A small pumpkin.', 'A large pumpkin.'), by: 'test' });
  assert.equal(other.ok, false); assert.match(other.reasons.join(' '), /already exists with other text/);
  // a routine never picks it up (status "owner", not "verified"); the owner starts it
  assert.equal(e.orchestrator.verifiedBriefs().find((b) => b.id === s.id).status, 'owner');
  const j = e.orchestrator.createJob({ briefText: fs.readFileSync(path.join(r.dataRoot, s.file), 'utf8'), by: 'test' });
  assert.equal(j.ok, true, (j.reasons || []).join('; ')); assert.equal(j.job.product_key, 'pngtuber-prop-pack');
  assert.match(e.store.stagesOf(j.id)[0].reason, /owner brief checked \(evidence level owner: no market evidence\)/);
  assert.equal(e.orchestrator.saveOwnerBrief({ text: OWNER, by: 'test' }).ok, true, 'saving the same brief again after its job: still unchanged');
  // the approval card: the engine snapshot carries the level, the banner says it
  const snap = buildEngineSnapshot(e).jobs.find((x) => x.id === j.id);
  assert.equal(snap.evidenceLevel, 'owner');
  const html = evidenceBanner(snap.evidenceLevel);
  assert.match(html, /class="evidence-banner evidence-owner"/); assert.match(html, /<strong>Evidence: OWNER BRIEF — no market evidence<\/strong>/);
  assert.match(fs.readFileSync(path.join(APP_ROOT, 'src', 'web', 'styles.css'), 'utf8'), /\.evidence-owner \{/);
});

test('decision 5: an owner brief naming a game, brand or character is refused (whole brief, every category); nothing is saved', (t) => {
  const named = (s) => OWNER.replace('A brass lantern.', s);
  const game = ocheck(named('A Minecraft lantern.')), brand = ocheck(named('A Nike lantern.')), character = ocheck(OWNER.replace('A cozy desk lamp.', 'A Hello Kitty desk lamp.'));
  for (const [c, word] of [[game, 'minecraft'], [brand, 'nike'], [character, 'hello kitty']]) { assert.equal(c.ok, false, word); assert.match(c.reasons.join(' '), new RegExp('^originality: owner brief text: .*' + word, 'i')); }
  // a name outside the Design direction is caught too (the whole brief is screened)
  assert.equal(ocheck(OWNER.replace('# Niche\n', '# Niche\nFor Pokemon fans. ')).ok, false);
  // derivative wording
  assert.match(ocheck(named('A lantern in the style of a famous artist.')).reasons.join(' '), /derivative/);
  // a game the scouts found (the scouting blocklist) is refused at save and at intake
  const r = tempRoot('c-owner-scouted'); t.after(r.cleanup);
  const e = createEngine({ J: r.J, log: r.log, configDir: CONFIG, promptsDir: PROMPTS, startScheduler: false }); t.after(() => e.close());
  const scouted = (e.cfg.station.sloganScreen.lists['scouted-games'] = ['glimmerfall quest']);
  assert.ok(scouted.length);
  const s = e.orchestrator.saveOwnerBrief({ text: named('A Glimmerfall Quest lantern.'), by: 'test' });
  assert.equal(s.ok, false); assert.match(s.reasons.join(' '), /scouted game/);
  assert.ok(!fs.existsSync(path.join(r.dataRoot, 'research', 'briefs', '2026-10-17--cozy-autumn-desk-props.md')));
  assert.equal(e.orchestrator.createJob({ briefText: named('A Glimmerfall Quest lantern.'), by: 'test' }).ok, false);
});

test('decision 5: the owner brief format: no evidence claimed, status "owner", owner bounds at or above the floor', () => {
  const p = (t) => validateOwnerBrief(t).join(' | ');
  assert.match(p(OWNER.replace('status: owner', 'status: verified')), /status must be "owner"/);
  assert.match(p(OWNER.replace('evidence level: owner', 'evidence level: indicative')), /must say "evidence level: owner"/);
  assert.match(p(OWNER.replace('evidence level: owner', 'evidence level: owner\nhttps://www.etsy.com/search?q=autumn')), /cites nothing/);
  assert.match(p(OWNER.replace('evidence level: owner', 'evidence level: owner\nmost sell at USD 4.99')), /claims no price/);
  assert.match(p(OWNER.replace('evidence level: owner', 'evidence level: owner\ncompetitor count: 1,000+')), /no Etsy evidence fields/);
  assert.match(p(OWNER.replace('## Design direction', '## Design notes')), /heading "## Design direction" is missing/);
  assert.match(p(OWNER.replace(/^owner bounds:.*$/m, 'owner bounds: about four dollars')), /owner bounds must read/);
  assert.match(p(OWNER.replace('id: 2026-10-17--cozy-autumn-desk-props', 'id: 2026-10-16--cozy-autumn-desk-props')), /date must be YYYY-MM-DD and match/);
  const low = ocheck(OWNER.replace('USD 3.50–9.00', 'USD 3.49–9.00'));
  assert.equal(low.ok, false); assert.match(low.reasons[0], /^price: owner bounds USD 3\.49–9\.00: the minimum is BELOW the floor USD 3\.5/);
  // the brief as saved for step c (fixtures/engine/owner-brief.md) states the owner's content
  for (const s of ['Cozy Autumn Desk Props for PNGTuber and VTuber streams', 'cream, terracotta, sage, soft brown', 'autumn oranges and deep reds', 'A small original ghost plush: round and friendly, with no resemblance to any existing character.', 'No text, letters, logos, brands, characters or real people in any image.', 'owner bounds: USD 3.50–9.00 (owner brief, 2026-10-17)', 'The owner sets the final price at approval.', 'AI use is disclosed, as on DESK-PROPS-01']) assert.ok(OWNER.includes(s), s);
  assert.equal((OWNER.match(/^\d+\. /gm) || []).length, 12);
});

test('decision 5: the price fill lists an owner brief at LISTER\'s proposal within the bounds, never below the floor; other briefs unchanged', () => {
  const b = ownerBounds(OWNER);
  assert.equal(proposalProblem({ usd: 5.5, reason: 'a 12-prop matched set at the middle of the owner bounds' }, b), null);
  assert.match(proposalProblem(null, b), /LISTER wrote no priceProposal/);
  assert.match(proposalProblem({ usd: 9.5, reason: 'a 12-prop matched set' }, b), /outside the owner bounds USD 3\.50–9\.00/);
  assert.match(proposalProblem({ usd: 3.4, reason: 'a 12-prop matched set' }, b), /outside the owner bounds/);
  assert.match(proposalProblem({ usd: 5.555, reason: 'a 12-prop matched set' }, b), /at most 2 decimals/);
  assert.match(proposalProblem({ usd: 5.5, reason: '' }, b), /reason/);
  const pr = digitalPricing({ product: PACK, briefText: OWNER, cfg: ST, proposal: { usd: 5.5, reason: 'a 12-prop matched set at the middle of the owner bounds' } });
  assert.equal(pr.problem, null); assert.equal(pr.basis, 'LISTER proposal');
  assert.equal(pr.priceEur, 4.92); assert.deepEqual(pr.ladder.map((l) => l.proposedEur), [4.92]); assert.deepEqual(pr.suggestion, { min: 3.13, max: 8.04 });
  // at the floor: USD 3.50 x 0.893256 = 3.1264, rounded UP to EUR 3.13 = the owner floor in EUR (never a cent below)
  const atFloor = digitalPricing({ product: PACK, briefText: OWNER, cfg: ST, proposal: { usd: 3.5, reason: 'the lowest price the owner allows' } });
  assert.equal(atFloor.priceEur, 3.13); assert.ok(atFloor.ladder.every((l) => l.proposedEur >= l.floorEur));
  const none = digitalPricing({ product: PACK, briefText: OWNER, cfg: ST });
  assert.match(none.problem, /LISTER wrote no priceProposal/); assert.equal(none.listingPriceEur, null);
  // a research brief without the proposal is priced as before (the brief high)
  const rb = researchBrief(['USD 0.99', 'USD 1.50', 'USD 3.50', 'USD 4.99', 'USD 12.00'], 'USD 0.99–12.00');
  assert.equal(digitalPricing({ product: PACK, briefText: rb, cfg: ST, proposal: { usd: 5.5, reason: 'ignored for research briefs' } }).basis, 'brief high');
  // LISTER is told to write the proposal for an owner brief, and still no price in the listing text
  const ls = fs.readFileSync(path.join(PROMPTS, 'skills', 'price-rules-lister.md'), 'utf8');
  assert.match(ls, /OWNER BRIEF \(`origin: owner`.*"priceProposal": \{"usd": <a price within the brief's owner bounds, 2 decimals>, "reason":/);
  assert.match(ls, /the owner sets the final price at approval\. Still no price in the listing text/);
});
