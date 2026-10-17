// lib/scout-brief.mjs — the ONE genre-scout brief schema (owner D3, 17/10/2026; DECISIONS.md "E6 step b2: owner
// decisions"), with the "indicative" demand evidence of owner D1. Station code, no model. Used in three places, the same
// function every time:
//   - fs_write (tools/index.mjs): a draft written into a genre-scout drafts folder is validated before it is written; an
//     invalid one is refused with the problems, so the agent can fix and rewrite it (a normal tool error, one turn)
//   - the scout-notes screen (orchestrator.mjs): every draft in the drafts folder is checked against it
//   - brief-check and intake (checkScoutBrief): a verified genre-scout brief is judged on this schema instead of the
//     ported Etsy demand-evidence format, which needs Etsy pages the agents may no longer open (D1)
// Naming (D3): the existing brief convention, the one intake checks (common.mjs isListingId, skills/brief-format.md):
// id `YYYY-MM-DD--<slug>` (a-z, 0-9, hyphens, at most 60 characters, the date = the drafts folder's day), file
// `scout-drafts/<day>/<id>.md`.
// D1: the demand evidence comes from web search results only (listing titles, prices and keywords as the results show
// them); the competitor count is "not measured" and the evidence level "indicative" until the Etsy Open API is in place.
// Keywords and the price range each need at least MIN_CITED_RESULTS distinct cited results, and every URL anywhere in
// the brief must be one a web call of the job returned (citationProblems; the job transcript keeps them).
import { briefField, designDirectionOf } from './brief-check.mjs';
import { keywordSourceProblems, ownerPrice } from './demand-evidence.mjs';
import { briefUsdRange } from './gates.mjs';
import { briefPriceCheck, variantLadder } from './etsy-fees.mjs';
import { imagePolicyProblem } from './image-policy.mjs';
import { screenText, hitLine, SOFT_CATEGORIES } from './originality.mjs';
import { isListingId } from './common.mjs';
import { urlsIn } from './web-sources.mjs';

export const ORIGIN = 'genre-scout';
export const EVIDENCE_LEVEL = 'indicative';
export const COUNT_NOT_MEASURED = 'not measured';
export const MIN_CITED_RESULTS = 3, MIN_RESULT_ROWS = 3, MAX_AGE_DAYS = 30;
export const STATUSES = ['candidate', 'verified', 'rejected'];
export const HEADINGS = ['# Niche', '## Buyer persona', '## Demand evidence', '## Genre trend evidence', '## Keywords', '## Price range', '## Seasonality', '## Design direction', '## Risks', '## Sources'];
const FRONT = ['id', 'date', 'status', 'product_type', 'audience_segment', 'origin'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
// a placeholder where a fact should be: never written into a brief (and never put on the blocklist: scouting.mjs)
// (the upper-case markers only, so "an unknown land" in a Design direction is not one; the phrases in any case)
const MARKER_RE = /\b(?:UNKNOWN|TBD|TBA|N\/A)(?![\w/])/, PHRASE_RE = /\b(?:to be confirmed|needs? owner check)\b/i;
export const placeholderIn = (t) => { const m = MARKER_RE.exec(t) || PHRASE_RE.exec(t); return m ? m[0] : null; };
// E6 c (owner, 17/10/2026, "prices as shown"): a Demand evidence price is the raw string the search result showed, in one of
// three forms: one price "USD 4.99"; a sale "USD 7.49 (was 9.99)" (the current price, the original kept alongside); a range
// "USD 4.50–18.75" (both ends kept). The current price (a range: the low end) is what the floor and the price range use.
const CUR = '(USD|EUR|GBP|CAD|AUD)', NUM = '(\\d+(?:\\.\\d{1,2})?)';
const SINGLE_RE = new RegExp('^' + CUR + '\\s*' + NUM + '$', 'i');
const SALE_RE = new RegExp('^' + CUR + '\\s*' + NUM + '\\s*\\(\\s*was\\s+(?:' + CUR + '\\s*)?' + NUM + '\\s*\\)$', 'i');
const RANGE_RE = new RegExp('^' + CUR + '\\s*' + NUM + '\\s*(?:–|—|-|to)\\s*(?:' + CUR + '\\s*)?' + NUM + '$', 'i');
export const PRICE_FORMS = '"USD 4.99", a sale "USD 7.49 (was 9.99)" or a range "USD 4.50–18.75", exactly as the result showed it';
// -> { ok, kind: single|sale|range, currency, current (the floor price: a range's low end), high, was, numbers } or { ok: false, problem }
export function parsePrice(cell) {
  const c = String(cell || '').trim(); let m;
  if ((m = SINGLE_RE.exec(c))) { const v = Number(m[2]); return { ok: true, kind: 'single', currency: m[1].toUpperCase(), current: v, high: v, was: null, numbers: [v] }; }
  if ((m = SALE_RE.exec(c))) {
    const cur = m[1].toUpperCase(), v = Number(m[2]), was = Number(m[4]);
    if (m[3] && m[3].toUpperCase() !== cur) return { ok: false, problem: 'a sale price and its original must be in one currency' };
    if (!(was > v)) return { ok: false, problem: 'a sale\'s original ("was") price must be above the current price' };
    return { ok: true, kind: 'sale', currency: cur, current: v, high: v, was, numbers: [v, was] };
  }
  if ((m = RANGE_RE.exec(c))) {
    const cur = m[1].toUpperCase(), lo = Number(m[2]), hi = Number(m[4]);
    if (m[3] && m[3].toUpperCase() !== cur) return { ok: false, problem: 'both ends of a range must be in one currency' };
    if (!(lo < hi)) return { ok: false, problem: 'a range runs from its low end to a higher end' };
    return { ok: true, kind: 'range', currency: cur, current: lo, high: hi, was: null, numbers: [lo, hi] };
  }
  return { ok: false, problem: 'price must be ' + PRICE_FORMS };
}
const demandRows = (de) => (de || '').split('\n').filter((l) => /^\s*\|\s*\d+\s*\|/.test(l)).map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((x) => x.trim()));
// owner correction, 17/10/2026 (replaces the low-end floor wording): the floor is our minimum listing price, not a rule that
// the market has no cheaper listings. A genre brief records the full range as shown, cheap rows included, and passes the floor
// when at least MIN_FLOOR_ROWS cited listings (Demand evidence rows with a result URL, in USD) show a CURRENT price at or above
// it (a sale counts at its current price; a range counts when its low end clears the floor, i.e. every option it sells does).
export const MIN_FLOOR_ROWS = 3;
export function floorRows(text, floorUsd) {
  const rows = demandRows(section(norm(text), '## Demand evidence')).filter((r) => r.length >= 4 && urlsIn(r[3]).length).map((r) => parsePrice(r[2])).filter((p) => p.ok && p.currency === 'USD');
  const at = rows.filter((p) => p.current >= floorUsd - 1e-9).length;
  return { at, of: rows.length, ok: at >= MIN_FLOOR_ROWS };
}
const normQuery = (q) => String(q || '').toLowerCase().replace(/\s+/g, ' ').trim();
// a brief may not hide a cheaper result it was given: every price under the floor that the brief's own searches (its
// "search queries" line, matched to the job's web_search calls) returned must appear in a Demand evidence price; every named
// query must be one a web search of the job ran. searches: [{ query, prices }] from the transcript (web-sources searchPrices)
export function hiddenRowProblems(text, searches, floorUsd) {
  const de = section(norm(text), '## Demand evidence'), named = (line(de, 'search queries') || '').split(';').map(normQuery).filter(Boolean);
  const ran = new Set((searches || []).map((s) => normQuery(s.query))), notRun = named.filter((q) => !ran.has(q));
  if (!named.length || notRun.length) return ['Demand evidence: search queries not run by any web search in this job: ' + (notRun.length ? notRun.map((q) => '"' + q + '"').join('; ') : '(none named)') + ' (name the exact queries the rows come from)'];
  const shown = new Set(demandRows(de).flatMap((r) => { const p = parsePrice(r[2]); return p.ok ? p.numbers.map((n) => n.toFixed(2)) : []; }));
  const hidden = [...new Set((searches || []).filter((s) => named.includes(normQuery(s.query))).flatMap((s) => s.prices))].filter((p) => Number(p) < floorUsd - 1e-9 && !shown.has(p)).sort((a, b) => Number(a) - Number(b));
  return hidden.length ? ['Demand evidence hides results its searches showed below the floor USD ' + floorUsd + ': ' + hidden.map((p) => 'USD ' + p).join(', ') + ' (record every result as shown, cheaper ones included: they never fail the floor)'] : [];
}
// the floor in USD of a product (the owner floor, else the fee model), as briefPriceCheck has it
export const briefFloorUsd = (prod, cfg) => briefPriceCheck(null, prod, cfg).floorUsd;

// owner, 17/10/2026: Seasonality is "not measured (no source)" (as the competitor count is "not measured"), or a season or
// "evergreen" that a cited result supports
export const SEASON_NOT_MEASURED = 'not measured (no source)';

const norm = (t) => String(t || '').replace(/\r\n/g, '\n');
function section(t, heading) {
  const i = t.search(new RegExp('^' + heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[ \\t]*$', 'm'));
  if (i < 0) return null;
  const rest = t.slice(i).split('\n').slice(1).join('\n'), j = rest.search(/^#{1,2} /m);
  return j < 0 ? rest : rest.slice(0, j);
}
const line = (sec, name) => { const m = new RegExp('^' + name + ':[ \\t]*(.*)$', 'mi').exec(sec || ''); return m ? m[1].trim() : null; };
export const isScoutDraftPath = (rel, draftsDir = 'scout-drafts') => new RegExp('^' + draftsDir + '/\\d{4}-\\d{2}-\\d{2}/[^/]+\\.md$').test(String(rel || '').replace(/\\/g, '/'));

// the format, as the agents are told it on a refused write (prompts/skills/scout-brief-format.md has the full template)
export const FORMAT_HINT = 'Genre brief format (skills/scout-brief-format.md): front matter id, date, status, product_type, audience_segment and origin: genre-scout, each on its own line; headings ' + HEADINGS.join(', ') + ' (and ## Evidence check once verified or rejected); Demand evidence with "evidence level: indicative", "checked: YYYY-MM-DD", "search queries: ...", "competitor count: not measured" and a | # | listing title | price | result URL | table of at least ' + MIN_RESULT_ROWS + ' search results.';

// agent: the text comes from an agent's write (the owner's own marker lines are refused then, allowed in an owner's edit)
// -> { ok, problems: [], id, status, day, cited: [every URL in the brief, canonical] }
// productKey: the job's product key (owner, 17/10/2026, "product key as data"): product_type must be exactly that key
export function validateScoutBrief(text, { day = null, file = null, agent = false, productKey = null } = {}) {
  const t = norm(text), problems = [];
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(t);
  if (!fm) problems.push('front matter (--- ... ---) missing at the top');
  const head = fm ? fm[1] : '', f = Object.fromEntries(FRONT.map((k) => [k, line(head, k)]));
  for (const k of FRONT) if (!f[k]) problems.push('front matter: ' + k + ' missing (one "' + k + ': ..." line each)');
  if (f.origin != null && f.origin !== ORIGIN) problems.push('front matter: origin must be "' + ORIGIN + '"');
  if (productKey && f.product_type && f.product_type !== productKey) problems.push('front matter: product_type must be this run\'s product_key, ' + productKey + ' (got ' + f.product_type + ')');
  if (/\borigin:/i.test(f.audience_segment || '')) problems.push('front matter: origin must be its own line, not part of audience_segment');
  if (f.id && !isListingId(f.id)) problems.push('id must be YYYY-MM-DD--<slug> (a-z, 0-9, hyphens, at most 60 characters): ' + f.id);
  if (f.id && f.date && f.id.slice(0, 10) !== f.date) problems.push('id must start with the brief date ' + f.date);
  if (f.date && !DAY_RE.test(f.date)) problems.push('date must be YYYY-MM-DD');
  if (day && f.date && f.date !== day) problems.push('date must be today, ' + day);
  if (file && f.id && String(file).replace(/\\/g, '/').split('/').pop() !== f.id + '.md') problems.push('file name must be <id>.md (' + f.id + '.md)');
  if (f.status && !STATUSES.includes(f.status)) problems.push('status must be candidate, verified or rejected');
  if (f.status && f.status !== 'candidate' && section(t, '## Evidence check') === null) problems.push('a ' + f.status + ' brief needs its "## Evidence check" section');
  // a rejected brief records the verdict: only its front matter and Evidence check are required (it never moves on)
  if (f.status === 'rejected') return { ok: problems.length === 0, problems, id: f.id, status: f.status, day: f.date, cited: urlsIn(t) };
  for (const h of HEADINGS) if (section(t, h) === null) problems.push('heading "' + h + '" missing');
  const ph = placeholderIn(t); if (ph) problems.push('placeholder "' + ph + '": every item must be what a source showed; with no evidence, write no brief (report_blocked)');
  if (agent && /recorded by owner/i.test(t)) problems.push('"recorded by owner" is the owner\'s marker: an agent never writes it');
  if (agent && (/^## Station /m.test(t) || STATION_CITATIONS_RE.test(t))) problems.push('"## Station ..." sections and the citation record are written by the station only');

  const de = section(t, '## Demand evidence');
  if (de !== null) {
    if ((line(de, 'evidence level') || '').toLowerCase() !== EVIDENCE_LEVEL) problems.push('Demand evidence: "evidence level: ' + EVIDENCE_LEVEL + '" (web search results only, until the Etsy Open API)');
    if ((line(de, 'competitor count') || '').toLowerCase() !== COUNT_NOT_MEASURED) problems.push('Demand evidence: "competitor count: ' + COUNT_NOT_MEASURED + '" (no Etsy page is opened)');
    const checked = line(de, 'checked');
    if (!checked || !DAY_RE.test(checked)) problems.push('Demand evidence: "checked: YYYY-MM-DD" missing');
    if (!line(de, 'search queries')) problems.push('Demand evidence: "search queries: ..." (the web searches the rows come from) missing');
    const rows = demandRows(de);
    if (rows.length < MIN_RESULT_ROWS) problems.push('Demand evidence: ' + rows.length + ' search-result row(s), needs at least ' + MIN_RESULT_ROWS + ' (| # | listing title | price | result URL |)');
    rows.forEach((r, i) => {
      const [, title, price, url] = r;
      if (r.length < 4) { problems.push('Demand evidence row ' + (i + 1) + ': needs 4 cells (#, listing title, price, result URL)'); return; }
      if (!title) problems.push('Demand evidence row ' + (i + 1) + ': listing title missing');
      const pp = parsePrice(price);
      if (!pp.ok) problems.push('Demand evidence row ' + (i + 1) + ': ' + pp.problem + ' (got "' + price + '")');
      if (!urlsIn(url).length) problems.push('Demand evidence row ' + (i + 1) + ': result URL missing');
    });
  }
  const gt = section(t, '## Genre trend evidence');
  if (gt !== null && !urlsIn(gt).length) problems.push('Genre trend evidence: at least one source URL (a genre-level article, roundup or discussion)');
  const kw = keywordSourceProblems(t);
  if (section(t, '## Keywords') !== null && !kw.ok) problems.push('Keywords: ' + kw.problems.join('; '));
  const kwUrls = new Set(urlsIn(kw.keywords.filter((k) => k.sourced).map((k) => k.source).join('\n')));
  if (section(t, '## Keywords') !== null && kwUrls.size < MIN_CITED_RESULTS) problems.push('Keywords: supported by ' + kwUrls.size + ' distinct cited result(s), needs at least ' + MIN_CITED_RESULTS);
  const pr = section(t, '## Price range');
  if (pr !== null) {
    if (!briefUsdRange(t)) problems.push('Price range: "USD <low>–<high>" missing');
    const n = urlsIn(pr).length;
    if (n < MIN_CITED_RESULTS) problems.push('Price range: supported by ' + n + ' distinct cited result(s), needs at least ' + MIN_CITED_RESULTS);
    // owner, 17/10/2026: the price range uses the current prices (a range: its low and high ends), never a "was" price
    const range = briefUsdRange(t), usd = demandRows(de).map((r) => parsePrice(r[2])).filter((x) => x.ok && x.currency === 'USD');
    if (range && usd.length) {
      const lo = Math.min(...usd.map((x) => x.current)), hi = Math.max(...usd.map((x) => x.high));
      if (Math.abs(range.min - lo) > 0.005 || Math.abs(range.max - hi) > 0.005) problems.push('Price range: must be USD ' + lo.toFixed(2) + '–' + hi.toFixed(2) + ', the lowest and highest current prices of the Demand evidence rows (a sale counts at its current price, a range at its ends; never a "was" price), got USD ' + range.min + '–' + range.max);
    }
  }
  const se = section(t, '## Seasonality');
  if (se !== null) {
    const v = se.split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
    if (!v) problems.push('Seasonality: write "' + SEASON_NOT_MEASURED + '", or the season with a cited result that supports it');
    else if (v.replace(/\.$/, '').toLowerCase() !== SEASON_NOT_MEASURED && !urlsIn(se).length) problems.push('Seasonality: a season (or "evergreen") needs a cited result that supports it (its URL); with none, write "' + SEASON_NOT_MEASURED + '"');
  }
  const src = section(t, '## Sources');
  if (src !== null) {
    const listed = new Set(urlsIn(src));
    const used = urlsIn([de, gt, section(t, '## Keywords'), pr, se].filter(Boolean).join('\n'));
    const missing = used.filter((u) => !listed.has(u));
    if (missing.length) problems.push('Sources: every cited URL must be listed under ## Sources; not listed: ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? ' (+' + (missing.length - 5) + ' more)' : ''));
  }
  return { ok: problems.length === 0, problems, id: f.id, status: f.status, day: f.date, cited: urlsIn(t) };
}

// owner, 17/10/2026 ("prices as shown"): every number in every Demand evidence price must be one a web call of the job
// returned (returnedPrices: a Set of 2-decimal strings, lib/web-sources.mjs)
export function priceStringProblems(text, returnedPrices) {
  const bad = [];
  demandRows(section(norm(text), '## Demand evidence')).forEach((r, i) => { const pp = parsePrice(r[2]); if (pp.ok) { const miss = pp.numbers.filter((n) => !returnedPrices.has(n.toFixed(2))); if (miss.length) bad.push('row ' + (i + 1) + ' "' + r[2] + '" (' + miss.map((n) => n.toFixed(2)).join(', ') + ')'); } });
  return bad.length ? ['prices not shown by any web call in this job: ' + bad.slice(0, 5).join('; ') + (bad.length > 5 ? ' (+' + (bad.length - 5) + ' more)' : '')] : [];
}

// D1: every URL in the brief must be one that a web call of the job returned (returned: a Set of canonical URLs)
export function citationProblems(text, returned) {
  const missing = urlsIn(text).filter((u) => !returned.has(u));
  return missing.length ? ['citations not returned by any web call in this job: ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? ' (+' + (missing.length - 5) + ' more)' : '')] : [];
}

// a genre-scout brief at brief-check and intake: the schema (status verified), its age, the citations against the
// job's returned URLs (when given), every Demand evidence price figure against the job's returned prices (when given:
// owner, 17/10/2026, "prices as shown"), then the same checks in the same order as brief-check.mjs checkBrief after its
// demand-evidence step: a digital product, the originality of the Design direction, the image policy, the price floor
// (or the owner price line). -> { ok, reasons, key, product, evidence, price }
export function checkScoutBrief(text, { products = [], cfg, returned = null, returnedPrices = null, searches = null, today = new Date(), productKey = null } = {}) {
  const t = norm(text), key = briefField(t, 'product_type'), prod = products.find((x) => x.key === key) || null;
  const v = validateScoutBrief(t, { productKey });
  if (!v.ok) return { ok: false, reasons: ['genre brief format: ' + v.problems.join('; ')], key, product: prod };
  const checked = line(section(t, '## Demand evidence'), 'checked'), age = (today - new Date(checked + 'T00:00:00Z')) / 86400000;
  if (age > MAX_AGE_DAYS) return { ok: false, reasons: ['demand evidence: ' + Math.floor(age) + ' days old (max ' + MAX_AGE_DAYS + ')'], key, product: prod };
  if (age < -1) return { ok: false, reasons: ['demand evidence: checked date is in the future'], key, product: prod };
  if (returned) { const c = citationProblems(t, returned); if (c.length) return { ok: false, reasons: c, key, product: prod }; }
  if (returnedPrices) { const c = priceStringProblems(t, returnedPrices); if (c.length) return { ok: false, reasons: c, key, product: prod }; }
  const evidence = { level: EVIDENCE_LEVEL, competitorCount: COUNT_NOT_MEASURED, checked, cited: v.cited.length };
  if (!(prod && prod.digital === true)) return { ok: false, reasons: ['product_type ' + key + ' is not a digital product in products.json'], key, product: prod };
  const og = screenText(designDirectionOf(t), cfg, { ignore: SOFT_CATEGORIES });
  if (og.result === 'hit') return { ok: false, reasons: ['originality: Design direction ' + og.hits.map((h) => hitLine({ field: 'concept', ...h })).join('; ')], key, product: prod, originality: og };
  const policy = imagePolicyProblem(prod, cfg); if (policy) return { ok: false, reasons: [policy], key, product: prod };
  // owner correction, 17/10/2026: the floor passes on MIN_FLOOR_ROWS cited listings at or above it (floorRows), never on the
  // range's low end; the brief must not hide a cheaper result its searches showed (hiddenRowProblems, when the transcript is given)
  const range = briefUsdRange(t), bp = briefPriceCheck((range || {}).min ?? null, prod, cfg, range), fr = floorRows(t, bp.floorUsd);
  if (searches) { const h = hiddenRowProblems(t, searches, bp.floorUsd); if (h.length) return { ok: false, reasons: h, key, product: prod }; }
  const r = { ...bp, ok: fr.ok, reason: fr.at + ' of ' + fr.of + ' cited listings show a current price at or above the floor USD ' + bp.floorUsd + (fr.ok ? '' : ', needs at least ' + MIN_FLOOR_ROWS + ' (cheaper listings stay in the brief and never fail it)') };
  const op = ownerPrice(t);
  if (op && op.problem) { r.ok = false; r.reason = op.problem; }
  else if (op) {
    r.ladder = variantLadder(prod, range, cfg, { priceEur: op.point != null ? op.point : op.min });
    r.ok = op.min >= r.floorEur - 1e-9 && (op.point == null || op.point >= r.floorEur - 1e-9);
    r.reason = 'owner price EUR ' + op.min.toFixed(2) + '–' + op.max.toFixed(2) + ' (recorded by owner, ' + op.date + ') ' + (op.min >= r.floorEur - 1e-9 ? '>=' : 'is BELOW') + ' the floor EUR ' + r.floorEur.toFixed(2);
  }
  const reasons = r.ok ? [] : ['price: ' + r.reason];
  return { ok: reasons.length === 0, reasons, key, product: prod, evidence, price: { ok: r.ok, reason: r.reason, floorEur: r.floorEur } };
}

// the station's record of the citation check, appended at brief-check to a verified genre brief; intake reads the job id
// back and checks the citations again against that job's transcript
export const STATION_CITATIONS_RE = /^- citations: (\d+), all returned by web calls in job (\S+) \(transcript\)$/m;
export const stationCitationLine = (n, jobId) => '- citations: ' + n + ', all returned by web calls in job ' + jobId + ' (transcript)';

// the evidence level a brief declares in its Demand evidence ("indicative" for genre briefs until the Etsy Open API), or
// null; the office page shows it on the approval card (owner decision 2, 17/10/2026)
export const evidenceLevelOf = (text) => { const v = line(section(norm(text), '## Demand evidence'), 'evidence level'); return v ? v.toLowerCase() : null; };
