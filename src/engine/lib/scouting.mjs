// scouting.mjs — the genre-trend scouting line's IP fence (DECISIONS.md "Genre-trend scouting"). Station code, no model.
// TREND-SCOUT reads public popularity signals (top streamed categories, store charts) and writes two things into the
// research folder: internal scouting notes at scouting/<day>/notes.json (games, studios, evidence links: the ONLY place a
// game title may appear) and up to 4 genre briefs in drafts/<day>/ (genre and aesthetic only, `origin: genre-scout`).
//   - every title the scout records (plus its studio and any `alsoBlock` names: characters, locations, items) goes into
//     the scouting blocklist, scouting/blocklist.json, written by the engine only (never by an agent)
//   - the engine puts that list into the originality lists (category "scouted-games") together with extra derivative
//     wording ("fan", "fandom", "homage", "tribute"); so the brief check, intake, the image-prompt screen, the design-set
//     screen and the listing/package gates all refuse a scouted name, wherever it appears
//   - a brief is screened WHOLE against the scouted names (not only its Design direction); a genre-scout brief is also
//     screened whole for derivative wording
//   - a genre-scout draft that fails that screen is moved to scouting/blocked/<day>/ (it names a game, so it stays there)
//   - scouting/ is invisible to every agent but TREND-SCOUT (tools/index.mjs: agent config `scoutingNotes: true`), and a
//     job folder only ever receives brief.md, so DESIGNER, LISTER and the QA agents never see the notes
import fs from 'node:fs';
import path from 'node:path';
import { screenText, hitLine } from './originality.mjs';

export const SCOUT_DIR = 'scouting';                       // inside data/research/
export const SCOUTED = 'scouted-games', WORDING = 'derivative-wording';
export const ORIGIN = 'genre-scout';
// on top of the station's own derivative list (in the style of, inspired by, dupe, fan art, homage to, unofficial, ...)
export const DERIVATIVE_WORDING = ['fan', 'fandom', 'fanbase', 'fan favourite', 'fan favorite', 'homage', 'tribute', 'dupes'];
export const NOTES_KINDS = { aaa: 2, indie: 2 };           // owner: 2 popular AAA titles and 2 indie titles per run

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
export const notesFile = (researchDir, day) => path.join(researchDir, SCOUT_DIR, day, 'notes.json');
export const blocklistFile = (researchDir) => path.join(researchDir, SCOUT_DIR, 'blocklist.json');
export const isScoutPath = (rel) => String(rel || '').replace(/\\/g, '/').replace(/^\.\//, '').split('/')[0].toLowerCase() === SCOUT_DIR;

// -> { ok, problems: [], entries: [{ game, kind, genre, studio, alsoBlock, evidence: [{ url, signal }], date }] }
export function validateNotes(notes, { day } = {}) {
  const problems = [], entries = [];
  if (!notes || typeof notes !== 'object' || !Array.isArray(notes.entries)) return { ok: false, problems: ['notes.json must be { "day", "entries": [...] }'], entries };
  if (day && notes.day !== day) problems.push('notes.day must be ' + day);
  const count = { aaa: 0, indie: 0 };
  notes.entries.forEach((e, i) => {
    const at = 'entry ' + (i + 1), game = clean(e && e.game), kind = clean(e && e.kind).toLowerCase(), genre = clean(e && e.genre);
    if (!game || game.length < 2) problems.push(at + ': game is required');
    if (!(kind in NOTES_KINDS)) problems.push(at + ': kind must be "aaa" or "indie"'); else count[kind]++;
    if (!genre) problems.push(at + ': genre is required');
    const ev = Array.isArray(e && e.evidence) ? e.evidence : [];
    if (!ev.length) problems.push(at + ': at least one evidence link is required');
    for (const x of ev) if (!/^https:\/\/\S+$/.test(String(x && x.url))) problems.push(at + ': evidence url must be https: ' + (x && x.url));
    if (!DAY_RE.test(String(e && e.date))) problems.push(at + ': date must be YYYY-MM-DD');
    const also = Array.isArray(e && e.alsoBlock) ? e.alsoBlock.map(clean).filter(Boolean) : [];
    entries.push({ game, kind, genre, studio: clean(e && e.studio) || null, alsoBlock: also, evidence: ev.map((x) => ({ url: String(x && x.url), signal: clean(x && x.signal) })), date: String(e && e.date) });
  });
  for (const [k, n] of Object.entries(NOTES_KINDS)) if (count[k] !== n) problems.push('needs exactly ' + n + ' ' + k + ' entries (has ' + count[k] + ')');
  return { ok: problems.length === 0, problems, entries };
}

// every name a run's notes put on the blocklist: the title, the studio, and the alsoBlock names
export const termsOf = (entries) => entries.flatMap((e) => [{ term: e.game, kind: 'game' }, ...(e.studio ? [{ term: e.studio, kind: 'studio' }] : []), ...e.alsoBlock.map((t) => ({ term: t, kind: 'related' }))]).filter((x) => clean(x.term).length >= 2);

export function readBlocklist(researchDir) {
  try { const b = JSON.parse(fs.readFileSync(blocklistFile(researchDir), 'utf8')); return Array.isArray(b.terms) ? b : { terms: [] }; } catch (_) { return { terms: [] }; }
}
// idempotent: a term already listed (any case) is not added again; nothing is ever removed by the engine
export function addToBlocklist(J, researchDir, terms, { day, jobId }) {
  const cur = readBlocklist(researchDir), have = new Set(cur.terms.map((t) => t.term.toLowerCase())), added = [];
  for (const t of terms) { const term = clean(t.term); if (!term || have.has(term.toLowerCase())) continue; have.add(term.toLowerCase()); added.push({ term, kind: t.kind, day, jobId }); }
  if (added.length) {
    const terms2 = [...cur.terms, ...added].sort((a, b) => a.term.localeCompare(b.term));
    J.put(blocklistFile(researchDir), JSON.stringify({ $comment: 'Scouting blocklist: written by the engine from TREND-SCOUT notes only. Every name here hard-fails the brief check, intake, image prompts, the design set and the listing. Internal: never shown to DESIGNER, LISTER or QA. The owner may add names by hand; the engine never removes one.', terms: terms2 }, null, 1) + '\n');
  }
  return added;
}

// the scouted names, re-read when the file changes (the engine reads this on every screen)
const termCache = new Map();
export function scoutedTerms(researchDir) {
  const f = blocklistFile(researchDir);
  let m = 0; try { m = fs.statSync(f).mtimeMs; } catch (_) { return []; }
  const c = termCache.get(f); if (c && c.m === m) return c.terms;
  const terms = readBlocklist(researchDir).terms.map((t) => clean(t.term)).filter(Boolean);
  termCache.set(f, { m, terms });
  return terms;
}

// the station config with the scouting lists added to the originality lists (memoised per term list, so the
// originality module's compile cache, keyed by the sloganScreen object, still works)
const stationCache = new WeakMap();
export function withScouting(station, terms) {
  const key = terms.join('\u0001');
  let per = stationCache.get(station); if (!per) { per = new Map(); stationCache.set(station, per); }
  if (per.has(key)) return per.get(key);
  const ss = station.sloganScreen || {};
  const out = { ...station, sloganScreen: { ...ss, lists: { ...(ss.lists || {}), [SCOUTED]: terms.slice(), [WORDING]: DERIVATIVE_WORDING.slice() } } };
  per.clear(); per.set(key, out);
  return out;
}

// the whole-brief screen: scouted names anywhere in the brief; derivative wording too when the brief is a genre-scout one
export const isScoutBrief = (t) => new RegExp('^origin:[ \\t]*' + ORIGIN + '[ \\t]*$', 'm').test(String(t || ''));
export function scoutingBriefProblems(text, station) {
  const lists = (station && station.sloganScreen && station.sloganScreen.lists) || {};
  const only = { [SCOUTED]: lists[SCOUTED] || [], ...(isScoutBrief(text) ? { [WORDING]: lists[WORDING] || [], derivative: lists.derivative || [] } : {}) };
  const sc = screenText(text, { sloganScreen: { lists: only, nearMissAllow: (station.sloganScreen || {}).nearMissAllow } });
  return sc.hits.map((h) => 'originality: brief ' + hitLine({ field: 'text', ...h }) + (h.category === SCOUTED ? ' (a scouted game: game names stay in the internal scouting notes)' : ''));
}
