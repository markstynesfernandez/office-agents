// PORTED from Virtual-workers/station/tests/originality.test.mjs at 16/10/2026 19:16 Irish time, source sha256 d78a1a53ac71a05f534b6c73933025367bbe1d2f51e86e9ac32d3d8675264d6e.
//   change: imports point at src/engine/lib; job folders are jobs/<id>/
//   change: the saturated-list test now expects a hit on titles and tags (owner Q5)
//   change: not ported: screenSlogan (POD slogan flow), the POD package-gate tests (archived tee room) and the StarNet COMMS/BRIDGE guards (no StarNet in the engine)
//   change: each temp folder is the data root of a data jail
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { screenText, screenFields, screenListing, screenDesign, imagePromptOf, recordDesignOriginality, recordListingOriginality, readings } from '../../src/engine/lib/originality.mjs';
import { createJail } from '../../src/engine/store/jail.mjs';
import { useJail } from '../../src/engine/store/active.mjs';
const ID = '2026-10-15--gate-test-tee';
const cat = (t) => screenText(t).hits.map((h) => h.category);

// one known-bad example per protected class, plus the evasion forms
const BAD = [
  ['trademark / brand', 'Nike Dad', 'brands'], ['brand, case + punctuation', 'N.I.K.E. dad!', 'brands'], ['brand, spaced letters', 'n i k e', 'brands'], ['brand, digit swap', 'N1KE dad', 'brands'],
  ['brand, plural', 'Nikes for Dad', 'brands'], ['brand, possessive', "Disney's Finest Dad", 'brands'], ['brand, misspelt', 'Addidas Dad', 'brands'], ['brand, misspelt long', 'Starbuks Dad', 'brands'],
  ['logo mark', 'The Swoosh Dad', 'brands'],
  ['character', 'Pikachu Dad', 'characters'], ['character, compound', 'Spiderman Dad', 'characters'], ['character, hyphen', 'Spider-Man Dad', 'characters'], ['character, accent', 'Pokémon Dad', 'characters'],
  ['franchise', 'Star Trek Dad', 'franchises'], ['franchise (film)', 'The Big Lebowski Dad', 'franchises'],
  ['real person', 'Taylor Swift Dad', 'people'], ['real person (sport)', 'Lebron Dad', 'people'], ['real person, misspelt', 'Cristiano Ronalldo Dad', 'people'],
  ['song lyric', 'We Will Rock You Dad', 'lyrics-and-quotes'], ['film quote', 'Yippee Ki Yay Dad', 'lyrics-and-quotes'], ['book / TV quote', 'You Know Nothing Jon Snow', 'lyrics-and-quotes'],
  ['well-known slogan', 'Just Do It Dad', 'catchphrases'], ['well-known slogan, shouted', 'JUST DO IT!!!', 'catchphrases'], ['advertising slogan', 'Finger Lickin Good Dad', 'lyrics-and-quotes'],
  ['sports team', 'Dallas Cowboys Dad', 'teams-and-leagues'], ['sports league', 'Premier League Dad', 'teams-and-leagues'], ['sports team, club', 'Man Utd Dad', 'teams-and-leagues'],
  ['named artist', 'Banksy Dad', 'artists'], ['artist style', 'In the style of Van Gogh', 'artists'], ['style wording', 'in the manner of a famous painter', 'derivative'],
  ['inspired by a product', 'Inspired by the Yeti Rambler', 'derivative'], ['dupe / copy wording', 'A dupe of the bestseller', 'derivative'], ['fan art wording', 'Fan art dad shirt', 'derivative'],
  ['stock template (slogans only)', 'Grill Sergeant', 'saturated']
];
for (const [what, text, category] of BAD) test('FAILS: ' + what + ' — "' + text + '"', () => { assert.ok(cat(text).includes(category), text + ' -> ' + JSON.stringify(screenText(text).hits)); });

const GOOD = ['Smoke signals: dad is grilling', 'Tongs up', 'Fully loaded dad', 'Camp dad', 'Toddler wrangler', 'Cowboy dad spurs', 'Uber dad', 'Eagle eyed dad', 'Pineapple on pizza', 'Afford it', 'Chocolate dad',
  'I fix things and know things', 'Dad, but make it quiet', 'Reel tired', 'Bad at golf, great at dad', 'Dink responsibly'];
for (const t of GOOD) test('PASSES: "' + t + '"', () => { const r = screenText(t); assert.equal(r.result, 'clear', JSON.stringify(r.hits)); });

test('plurals are matched one way only: the text word may be plural, the listed team name is not loosened', () => {
  assert.equal(screenText('Eagle').result, 'clear'); assert.equal(screenText('Eagles').result, 'hit'); assert.equal(screenText('Disneys').result, 'hit');
});
test('readings: the plain text plus the digit/symbol readings (1 as i and as l)', () => {
  const v = readings('N1KE').map((r) => r.tokens.join(' ')); assert.ok(v.includes('n1ke') && v.includes('nike'), JSON.stringify(v));
});

// ---- listing text: title, tags, description, alt text ----
const L = (o = {}) => ({ title: 'Garden Gnome Tee', tags: ['gnome tee', 'garden gift'], description: 'A tee, designed with AI.', altText: 'A gnome on a tee', ...o });
test('listing: known-bad titles, tags, descriptions and alt text each fail and name the field', () => {
  for (const [field, o] of [['title', { title: 'Nike Style Dad Tee' }], ['tags[2]', { tags: ['dad tee', 'pokemon gift'] }], ['description', { description: 'Inspired by the Yeti Rambler. Made with AI.' }], ['altText', { altText: 'A Taylor Swift fan' }]]) {
    const r = screenListing({ listing: L(o) }); assert.equal(r.result, 'hit', field); assert.ok(r.hits.some((h) => h.field === field), JSON.stringify(r.hits));
  }
});
test('listing: a clean listing passes; the stock-template (saturated) list now applies to titles and tags too (owner Q5)', () => {
  assert.equal(screenListing({ listing: L() }).result, 'clear'); const r = screenListing({ listing: L({ title: 'Dad Bod Tee', tags: ['dad bod'] }) }); assert.equal(r.result, 'hit'); assert.ok(r.hits.every((h) => h.category === 'saturated'), JSON.stringify(r.hits));
});

// ---- design notes: the exact image prompt, not the self-check ----
const MD = '# design-v1\n\n## Image prompt (exact)\nFlat vector illustration of a camp mug, no text, no letters.\n\n## Originality self-check\n1. Copied work? No. 2. Trademarks? No Disney, no Nike. 3. Named style? No.\n';
test('imagePromptOf returns only the prompt section, so "no Disney" in the self-check never trips the screen', () => {
  assert.match(imagePromptOf(MD), /camp mug/); assert.ok(!/Disney/.test(imagePromptOf(MD)));
});
function designDir(over = {}) {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'og-'))); useJail(createJail({ dataRoot: dir, extraRoots: [] })); const w = path.join(dir, 'jobs', ID); fs.mkdirSync(w, { recursive: true });
  const opts = ['Tongs up', 'Smoke signals', 'Fully loaded dad', 'Camp dad', 'Dink responsibly'];
  fs.writeFileSync(path.join(w, 'design-v1.slogan.json'), JSON.stringify({ options: opts, optionReasons: opts, chosen: opts[0], reason: 'r', picture: 'A pair of tongs', ...over.slogan }));
  fs.writeFileSync(path.join(w, 'design-v1.md'), over.md || MD);
  return dir;
}
test('design: a clean design is clear; a branded option, a named-artist prompt and a "style of" picture each fail', () => {
  assert.equal(screenDesign({ roomDir: designDir(), id: ID }).result, 'clear');
  const bad1 = screenDesign({ roomDir: designDir({ slogan: { options: ['Nike Dad', 'Smoke signals', 'Fully loaded dad', 'Camp dad', 'Dink responsibly'] } }), id: ID }); assert.ok(bad1.hits.some((h) => h.field === 'sloganOptions[1]'));
  const bad2 = screenDesign({ roomDir: designDir({ md: MD.replace('camp mug', 'camp mug in the style of Banksy') }), id: ID }); assert.ok(bad2.hits.some((h) => h.field === 'imagePrompt'), JSON.stringify(bad2.hits));
  const bad3 = screenDesign({ roomDir: designDir({ slogan: { picture: 'A grill, inspired by Weber' } }), id: ID }); assert.ok(bad3.hits.some((h) => h.field === 'picture'));
});
test('records are idempotent: the second run writes nothing, and the file says hit or clear', () => {
  const dir = designDir(), a = recordDesignOriginality({ roomDir: dir, id: ID }), b = recordDesignOriginality({ roomDir: dir, id: ID });
  assert.equal(a.action, 'written'); assert.equal(b.action, 'unchanged'); assert.equal(JSON.parse(fs.readFileSync(a.file, 'utf8')).result, 'clear');
  fs.mkdirSync(path.join(dir, 'jobs', ID, 'outbox'), { recursive: true }); fs.writeFileSync(path.join(dir, 'jobs', ID, 'outbox', 'listing.json'), JSON.stringify(L({ tags: ['nike tee'] })));
  const l1 = recordListingOriginality({ roomDir: dir, id: ID, extra: [] }), l2 = recordListingOriginality({ roomDir: dir, id: ID, extra: [] });
  assert.equal(l1.result, 'hit'); assert.equal(l1.action, 'written'); assert.equal(l2.action, 'unchanged');
});

