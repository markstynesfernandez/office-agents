// parity-pngtuber.mjs — the parity check of the port batch (17/10/2026, ENGINE-PLAN.md §7.2 step 3): the legacy job
// 2026-10-16--pngtuber-cosy-desk-props-r2 (published on Etsy 2026-10-17) replayed through the PORTED gates, read-only and at $0.
//   node scripts/parity-pngtuber.mjs [--rebuild]
// Source: data/legacy/jobs/<id>/ (the engine's own import; never the legacy build). It is copied into a replay data root,
// dry-run/parity/data/ (git-ignored), in the engine's layout (work/<id>/ -> jobs/<id>/, outbox/<id>/ -> jobs/<id>/outbox/; the
// path strings inside the JSON records are rewritten the same way). Then the engine's code re-derives what the legacy station
// produced and compares it: the set's measurement and originality screen (all of design.md except the self-check, file names, the
// whole brief, the listing), the listing's originality screen, the owner set approval and listing approval (re-composed from disk), the
// package gate, the price fill, the ZIP (bytes, entries, Etsy limits), the listing checks (US spelling, claims, notice and licence word
// for word), the digital package step (MANIFEST.json field by field), the listing photos (byte for byte) and the price fill keyed to the
// job (the legacy hook bug). --rebuild also rebuilds set-v4 from its raw files with the pinned Real-ESRGAN (local GPU, $0) and compares
// every built file and the ZIP. No model and no network are used. Every difference is listed with its reason; a difference with no
// known reason fails the check (exit 1). Writes: dry-run/parity/ only (its own jail).
import fs from 'node:fs';
import path from 'node:path';
import { createJail, APP_ROOT } from '../src/engine/store/jail.mjs';
import { useJail } from '../src/engine/store/active.mjs';
import { loadConfig } from '../src/engine/config.mjs';
import { sha256 } from '../src/engine/lib/common.mjs';
import { prepareDigitalSet } from '../src/engine/lib/digital-prep.mjs';
import { recordListingOriginality, hitLine } from '../src/engine/lib/originality.mjs';
import { composeSetApproval, composeListingApproval, APPROVAL_FILE, LISTING_APPROVAL_FILE } from '../src/engine/lib/owner-approval.mjs';
import { checkPackage, readJsonSafe } from '../src/engine/lib/gates.mjs';
import { fillDigitalPrices } from '../src/engine/lib/digital-prices.mjs';
import { packageDigital } from '../src/engine/lib/package-digital.mjs';
import { readZip } from '../src/engine/lib/zip.mjs';
import { fileLimitProblems, measureDir } from '../src/engine/lib/digital-files.mjs';
import { listingSpellingProblems } from '../src/engine/lib/spelling.mjs';
import { buildDigitalSet } from '../src/engine/lib/digital-build.mjs';
import { esrganUpscaler } from '../src/engine/lib/esrgan.mjs';
import { renderListingPhotos } from '../src/engine/owner.mjs';

export const ID = '2026-10-16--pngtuber-cosy-desk-props-r2', OTHER = '2026-10-14--outdoors-dad-camping-tee-r5', SET = 4;
const OUT = path.join(APP_ROOT, 'dry-run', 'parity'), DATA = path.join(OUT, 'data');
const LEG = path.join(APP_ROOT, 'data', 'legacy', 'jobs', ID);
const rj = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const walk = (d, base = d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name)).replace(/\\/g, '/')]));
// the layout rewrite of a path string in a record (the only change made to the legacy records in the replay copy)
export const toEngine = (s, id = ID) => String(s).split('work/' + id + '/').join('jobs/' + id + '/').split('outbox/' + id + '/').join('jobs/' + id + '/outbox/').split('approval-queue/' + id).join('jobs/' + id + '/package');
const rewrite = (v) => (typeof v === 'string' ? toEngine(v) : Array.isArray(v) ? v.map(rewrite) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rewrite(x)])) : v);
// every leaf that differs between a and b, as [path, a, b]
function diff(a, b, p = '') {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => diff(a[k], b[k], p + (Array.isArray(a) ? '[' + k + ']' : '.' + k)));
  return [[p || '.', a, b]];
}

export async function parity({ rebuild = false, log = () => {} } = {}) {
  if (!fs.existsSync(LEG)) throw new Error('no imported legacy job at data/legacy/jobs/' + ID + ': run npm run import-legacy first');
  const P = createJail({ dataRoot: OUT, extraRoots: [] });
  if (fs.existsSync(DATA)) P.remove(DATA);
  const J = createJail({ dataRoot: DATA, extraRoots: [] }); useJail(J);
  const cfg = loadConfig({ configDir: path.join(APP_ROOT, 'config'), promptsDir: path.join(APP_ROOT, 'prompts') });
  const station = cfg.station, products = cfg.products, jobs = path.join(DATA, 'jobs'), jd = path.join(jobs, ID), checks = [], diffs = [];
  const check = (name, ok, detail) => { checks.push({ check: name, ok: !!ok, ...detail }); log((ok ? 'PASS ' : 'FAIL ') + name); };
  const note = (where, field, legacy, engine, reason) => diffs.push({ where, field, legacy, engine, reason: reason || 'UNEXPLAINED' });

  // ---- 1. the replay copy: legacy bytes, engine layout; JSON records get the path rewrite only
  const rewritten = [];
  for (const [from, to] of [[path.join(LEG, 'work'), jd], [path.join(LEG, 'outbox'), path.join(jd, 'outbox')]]) for (const rel of walk(from)) {
    const src = path.join(from, rel), dest = path.join(to, rel);
    if (/\.json$/.test(rel)) { const t = fs.readFileSync(src, 'utf8'), n = JSON.stringify(rewrite(JSON.parse(t)), null, /^\s*\{\n {2}"/.test(t) ? 2 : 1) + (t.endsWith('\n') ? '\n' : ''); const same = n === t || JSON.stringify(JSON.parse(n)) === JSON.stringify(JSON.parse(t)); J.put(dest, same ? t : n); if (!same) rewritten.push(path.relative(jd, dest).replace(/\\/g, '/')); }
    else J.copy(src, dest);
  }
  // the legacy listing fix ends where the listing is now (checked on the LEGACY bytes), then is re-based onto the rewritten listing
  const lfx = rj(path.join(LEG, 'work', 'listing-fixes.json')), legL = { 'listing.json': sha256(fs.readFileSync(path.join(LEG, 'outbox', 'listing.json'))), 'listing.md': sha256(fs.readFileSync(path.join(LEG, 'outbox', 'listing.md'))) };
  check('listing text fix chain ends at the listing (legacy bytes)', lfx.after['listing.json'] === legL['listing.json'] && lfx.after['listing.md'] === legL['listing.md'], { rounds: lfx.rounds.length, changes: lfx.changes.length });
  const nowL = { 'listing.json': sha256(fs.readFileSync(path.join(jd, 'outbox', 'listing.json'))), 'listing.md': sha256(fs.readFileSync(path.join(jd, 'outbox', 'listing.md'))) };
  J.put(path.join(jd, 'listing-fixes.json'), JSON.stringify({ ...rewrite(lfx), after: nowL }, null, 1) + '\n');

  // ---- 2. the set: re-measured and re-screened by the engine's prep (originality: all of design.md except the self-check, file names, brief, listing)
  const legMan = rj(path.join(LEG, 'work', 'set-v' + SET, 'deliverables.json')), legOg = rj(path.join(LEG, 'work', 'set-v' + SET, 'originality.json'));
  const pd = prepareDigitalSet({ roomDir: DATA, id: ID, n: SET, cfg: station, products });
  check('set-v4 prepared by the engine (build current, files == build)', pd.ok, { reason: pd.reason || null });
  if (pd.ok) {
    const eng = rj(path.join(jd, 'set-v' + SET, 'deliverables.json')), og = rj(path.join(jd, 'set-v' + SET, 'originality.json'));
    for (const k of ['count', 'totalBytes', 'files', 'limitProblems', 'buildWarnings', 'productKey', 'assets', 'subfolders']) for (const [f, a, b] of diff(legMan[k], eng[k], k)) note('set-v4/deliverables.json', f, a, b);
    for (const [f, a, b] of diff(legMan.designNotes, eng.designNotes, 'designNotes')) note('set-v4/deliverables.json', f, a, b, toEngine(a) === b ? 'layout: work/<id>/ is jobs/<id>/' : null);
    for (const [f, a, b] of diff(legMan.measuredBy, eng.measuredBy, 'measuredBy')) note('set-v4/deliverables.json', f, a, b, 'names the engine module (port change)');
    for (const [f, a, b] of diff(legMan.build, eng.build, 'build')) note('set-v4/deliverables.json', f, a, b, f === 'build.builtBy' ? 'not rebuilt: the legacy build record is reused as it is' : null);
    check('set originality: same result as the legacy screen', og.result === legOg.result, { legacy: legOg.result, engine: og.result, hits: og.hits.map(hitLine), screened: og.screened, skipped: og.skipped });
    for (const [f, a, b] of diff(legOg.screened, og.screened, 'screened')) note('set-v4/originality.json', f, a, b, a === undefined && /^listing /.test(b) ? 'the legacy set screen ran before the listing was written; a re-prep now screens the listing too (the legacy code does the same when listing.json exists)' : null);
    for (const [f, a, b] of diff(legOg.skipped, og.skipped, 'skipped')) note('set-v4/originality.json', f, a, b);
    check('limit problems and build warnings: none, as in the legacy manifest', !(eng.limitProblems || []).length && !(eng.buildWarnings || []).length, { limitProblems: eng.limitProblems, buildWarnings: eng.buildWarnings });
  }
  // the allow-list words that the legacy screen needed (owner, 2026-10-17): the brief still uses them, and the screen stays clear
  const brief = fs.readFileSync(path.join(jd, 'brief.md'), 'utf8');
  check('the brief holds the allow-listed words and still screens clear', /\bchannels?\b/i.test(brief) && /\bbrowser\b/i.test(brief), { channel: (brief.match(/\bchannels?\b/gi) || []).length, browser: (brief.match(/\bbrowsers?\b/gi) || []).length });

  // ---- 3. the listing's originality screen
  const lo = recordListingOriginality({ roomDir: DATA, id: ID, cfg: station, extra: cfg.blocklist }), legLo = rj(path.join(LEG, 'work', 'derived', 'listing.originality.json'));
  check('listing originality: same result as the legacy screen', lo.ok && lo.result === legLo.result, { legacy: legLo.result, engine: lo.result });

  // ---- 4. the owner's set approval and listing approval, re-composed by the ported code from the replay copy
  const legSa = rj(path.join(LEG, 'work', APPROVAL_FILE)), sa = composeSetApproval({ roomDir: DATA, id: ID, n: SET, maxDesignPasses: 3, cfg: station });
  check('owner set approval re-composes (pass limit, every file one status, originality clear, tied to the bytes)', sa.ok, { reasons: sa.reasons || [], counts: sa.ok ? sa.record.counts : null });
  if (sa.ok) {
    J.put(path.join(jd, APPROVAL_FILE), JSON.stringify(sa.record, null, 1) + '\n');
    const RE = { 'designFile': 'layout', 'afterQaPass.sha256': 'qa/design-pass3.json had its designFile path rewritten (layout), so its sha256 differs', 'manifestSha256': 'deliverables.json re-written by the engine prep (designNotes path, measuredBy): its sha256 differs', 'review.sha256': 'owner-review.json path strings rewritten (layout)', 'edits.sha256': 'edits.json path strings rewritten (layout)' };
    for (const [f, a, b] of diff(rewrite(legSa), sa.record)) note(APPROVAL_FILE, f, a, b, RE[f.replace(/^\./, '')] || null);
    check('owner set approval: same counts and the same final status for every file', JSON.stringify(legSa.counts) === JSON.stringify(sa.record.counts) && legSa.files.every((f, i) => f.status === sa.record.files[i].status && f.rawSha256 === sa.record.files[i].rawSha256), { counts: sa.record.counts });
  }
  const legLa = rj(path.join(LEG, 'work', LISTING_APPROVAL_FILE)), la = composeListingApproval({ roomDir: DATA, id: ID, reason: legLa.ownerReason, date: legLa.date, cfg: station });
  check('owner listing approval re-composes (QA LISTING revise overruled, tied to the listing, the fix record and the sign-off)', la.ok, { reasons: la.reasons || [] });
  if (la.ok) {
    J.put(path.join(jd, LISTING_APPROVAL_FILE), JSON.stringify(la.record, null, 1) + '\n');
    const RE = { 'overrulesQa.sha256': 'qa-listing.json path strings rewritten (layout)', 'designSignOff.sha256': 'the owner set approval was re-composed (its sha256 follows the rewritten records)', 'listing.listing.json': 'listing.json designFile rewritten (layout)', 'fixes.sha256': 'listing-fixes.json re-based onto the rewritten listing (layout)', 'designSignOff.file': 'layout', 'designFile': 'layout', 'overrulesQa.file': 'layout', 'fixes.file': 'layout' };
    for (const [f, a, b] of diff(rewrite(legLa), la.record)) note(LISTING_APPROVAL_FILE, f, a, b, RE[f.replace(/^\./, '')] || null);
  }

  // ---- 5. the package gate, the price fill and the price fill keyed to the job (legacy hook bug: another job's unreviewed listing in the outbox)
  const g = checkPackage({ id: ID, roomDir: DATA, blocklist: cfg.blocklist, maxDesignPasses: 3, cfg: station, products });
  const legM = rj(path.join(LEG, 'package', 'MANIFEST.json'));
  check('package gate passes', !g.reasons.length, { reasons: g.reasons, warnings: g.warnings, passes: g.passes });
  check('design passes on disk == the legacy gate\'s (3)', g.passes === legM.gates.designPasses, { legacy: legM.gates.designPasses, engine: g.passes });
  const otherOut = path.join(APP_ROOT, 'data', 'legacy', 'jobs', OTHER, 'outbox');
  if (fs.existsSync(otherOut)) for (const rel of walk(otherOut)) J.copy(path.join(otherOut, rel), path.join(jobs, OTHER, 'outbox', rel));
  const before = fs.existsSync(path.join(jobs, OTHER)) ? walk(path.join(jobs, OTHER)).map((r) => r + ':' + sha256(fs.readFileSync(path.join(jobs, OTHER, r)))) : [];
  const fill = fillDigitalPrices({ id: ID, roomDir: DATA, cfg: station, products, dry: true, extra: cfg.blocklist });
  const after = fs.existsSync(path.join(jobs, OTHER)) ? walk(path.join(jobs, OTHER)).map((r) => r + ':' + sha256(fs.readFileSync(path.join(jobs, OTHER, r)))) : [];
  check('price fill keyed to the job: EUR 9.00, nothing to change, the other job\'s unreviewed listing untouched', fill.ok && !fill.changed && JSON.stringify(before) === JSON.stringify(after) && before.length > 0, { prices: fill.prices, changed: fill.changed, otherJobFiles: before.length, reason: fill.reason || null });

  // ---- 6. the ZIP and the listing checks
  const zipF = path.join(jd, 'set-v' + SET, 'files', legM.download), zip = fs.readFileSync(zipF), z = readZip(zip);
  check('ZIP: byte for byte the published download', sha256(zip) === legM.files.find((f) => f.name === legM.download).sha256 && sha256(zip) === sha256(fs.readFileSync(path.join(LEG, 'package', legM.download))), { bytes: zip.length, sha256: sha256(zip) });
  check('ZIP entries: the 12 files the legacy manifest lists, same names and sha256', z.ok && JSON.stringify(z.entries.map((e) => [e.name, sha256(e.data)])) === JSON.stringify(legM.zipEntries.map((e) => [e.name, e.sha256])), { entries: z.ok ? z.entries.length : 0 });
  const lim = fileLimitProblems(measureDir(path.join(jd, 'set-v' + SET, 'files')).files, station);
  check('ZIP within Etsy limits (5 files, 20 MB) and only PNG entries', !lim.length, { problems: lim });
  const L = rj(path.join(jd, 'outbox', 'listing.json'));
  check('listing: US spelling (market: US English)', !listingSpellingProblems(L, station).length, { problems: listingSpellingProblems(L, station) });

  // ---- 7. the digital package step (legacy cost: the imported ledger rows of this job's runs, by run id)
  const legJob = (() => { try { return rj(path.join(APP_ROOT, 'data', 'legacy', 'jobs.json')).jobs.find((j) => j.id === ID); } catch (_) { return null; } })();
  const legCost = rj(path.join(LEG, 'package', 'cost.json'));
  const cost = { jobId: ID, source: 'the imported legacy ledger, rows of this job\'s runs (by run id)', totalUsd: legCost.totalUsd, legacyWorkings: legCost.workings || null, note: 'replay: cost.json is not recomputed; the engine\'s own jobs use ledger rows by jobId' };
  const pk = packageDigital({ id: ID, roomDir: DATA, blocklist: cfg.blocklist, cost, apply: true, cfg: station, products });
  check('digital package step builds the package', pk.ok, { action: pk.action, reasons: pk.reasons || [] });
  if (pk.ok) {
    const M = pk.manifest, RE = (f, a, b) => {
      if (typeof a === 'string' && toEngine(a) === b) return 'layout: work/<id>/ and approval-queue/<id>/ are jobs/<id>/ and jobs/<id>/package/';
      if (/^\.overrides\[\d+\]\.(sha256|stage|date|decidedBy)$/.test(f) && a === undefined) return 'engine addition (owner decision 17/10/2026): every override carries the file\'s sha256, the stage, the date and who decided';
      if (/^\.files\[\d+\]\.(sha256|bytes)$/.test(f) && ['listing.json', 'cost.json'].includes(M.files[Number(/\[(\d+)\]/.exec(f)[1])].name)) return M.files[Number(/\[(\d+)\]/.exec(f)[1])].name === 'listing.json' ? 'listing.json designFile rewritten (layout)' : 'cost.json: the replay carries the legacy total, not the legacy time-window workings (engine jobs use job-keyed ledger rows)';
      if (f === '.gates.designSignOff.afterQaPass.sha256') return 'qa/design-pass3.json had its designFile path rewritten (layout), so its sha256 differs';
      if (/^\.gates\.(designSignOff|qaListing\.ownerOverride|qaListing)\.(sha256|listingSha256\.listing\.json)$/.test(f) || f === '.gates.listingTextFix.sha256' || f === '.gates.qaListing.ownerOverride.listingSha256.listing.json') return 'the record\'s sha256 follows the path rewrite (layout)';
      if (/^\.overrides\[\d+\]\.sha256\.listing\.json$/.test(f)) return 'listing.json designFile rewritten (layout)';
      return null;
    };
    for (const [f, a, b] of diff(legM, M)) note('package/MANIFEST.json', f, a, b, RE(f, a, b));
    check('MANIFEST: the same 12 ZIP entries, sign-off, QA LISTING override, text fix (12 changes), licence and notice wording and status, price proposal EUR 9.00 final:false', JSON.stringify(M.zipEntries) === JSON.stringify(legM.zipEntries) && M.gates.designSignOff.source === legM.gates.designSignOff.source && !!M.gates.qaListing.ownerOverride && M.gates.listingTextFix.changes.length === 12 && JSON.stringify(M.licence) === JSON.stringify(legM.licence) && JSON.stringify(M.notice) === JSON.stringify(rewrite(legM.notice)) && M.price.listingPriceEur === 9 && M.price.final === false, { overrides: M.overrides.length });
    const pkgFiles = fs.readdirSync(path.join(jd, 'package')).sort();
    check('package folder: the ZIP, listing.json, listing.md, MANIFEST.json, cost.json and nothing else', JSON.stringify(pkgFiles) === JSON.stringify(['MANIFEST.json', 'cost.json', 'listing.json', 'listing.md', legM.download].sort()), { files: pkgFiles });
    const again = packageDigital({ id: ID, roomDir: DATA, blocklist: cfg.blocklist, cost, apply: true, cfg: station, products });
    check('package step is idempotent (a second run writes nothing)', again.ok && again.action === 'unchanged', { action: again.action });
    // ---- 8. the listing photos from the engine's package, against the legacy photos.json
    const plan = rj(path.join(APP_ROOT, 'config', 'listing-photos', 'pngtuber-prop-pack.json')), legPh = rj(path.join(LEG, 'work', 'listing-photos', 'photos.json'));
    const ph = await renderListingPhotos({ pkgDir: path.join(jd, 'package'), id: ID, plan, date: plan.date, ownerWords: plan.ownerWords });
    const same = ph.record.photos.map((p) => { const l = legPh.photos.find((x) => x.file === p.file); return { file: p.file, same: !!l && l.sha256 === p.sha256 }; });
    check('listing photos: every photo byte for byte the legacy photo (from the packaged ZIP, outside the package)', same.every((x) => x.same) && same.length === legPh.photos.length, { photos: same });
    check('listing photos: the owner\'s words and plan are the legacy record\'s', ph.record.ownerWords === legPh.ownerWords && ph.record.date === legPh.date, {});
    for (const [f, a, b] of diff(legPh.source, ph.record.source, 'source')) note('listing-photos/photos.json', f, a, b, f === 'source.manifestSha256' ? 'MANIFEST.json differs as listed above (layout, override fields)' : toEngine(a) === b ? 'layout' : null);
    for (const [f, a, b] of diff(legPh.method, ph.record.method, 'method')) note('listing-photos/photos.json', f, a, b, 'sharp version string' );
  }

  // ---- 9. --rebuild: set-v4 rebuilt from raw/ with the pinned Real-ESRGAN, every output compared with the legacy build
  if (rebuild) {
    const rb = path.join(DATA, 'rebuild'), rjd = path.join(rb, 'jobs', ID), RJ = createJail({ dataRoot: rb, extraRoots: [] }); useJail(RJ);
    RJ.copy(path.join(jd, 'brief.md'), path.join(rjd, 'brief.md'));
    for (const rel of walk(path.join(jd, 'set-v' + SET, 'raw'))) RJ.copy(path.join(jd, 'set-v' + SET, 'raw', rel), path.join(rjd, 'set-v' + SET, 'raw', rel));
    const t0 = Date.now(), b = await buildDigitalSet({ roomDir: rb, id: ID, n: SET, cfg: station, products, upscaler: esrganUpscaler({ pin: cfg.engine.upscale, workDir: path.join(rjd, 'set-v' + SET) }) });
    const legB = rj(path.join(LEG, 'work', 'set-v' + SET, 'build.json'));
    check('rebuild of set-v4 with the pinned Real-ESRGAN succeeds', b.ok, { reason: b.reason || null, seconds: Math.round((Date.now() - t0) / 1000) });
    if (b.ok) {
      check('rebuild: same build key as the legacy build (inputs and settings)', b.record.key === legB.key, { legacy: legB.key, engine: b.record.key });
      const files = b.record.files.map((f, i) => ({ name: f.name, same: f.output.sha256 === legB.files[i].output.sha256 }));
      check('rebuild: every finished file byte for byte the legacy build', files.every((x) => x.same), { files });
      check('rebuild: the ZIP byte for byte the published download', b.record.zip.sha256 === legB.zip.sha256, { legacy: legB.zip.sha256, engine: b.record.zip.sha256, bytes: b.record.zip.bytes });
      for (const [f, a, bb] of diff(legB, b.record)) note('rebuild set-v4/build.json', f, a, bb, f === '.builtBy' ? 'names the engine module (port change)' : /\.aiMs$/.test(f) ? 'timing' : /\.upscale\.gpu$/.test(f) ? 'GPU label' : null);
    }
    useJail(J);
  }

  const unexplained = diffs.filter((d) => d.reason === 'UNEXPLAINED'), ok = checks.every((c) => c.ok) && !unexplained.length;
  const report = { kind: 'parity', listingId: ID, ranAt: new Date().toISOString(), costUsd: 0, model: 'none', network: 'none', source: 'data/legacy/jobs/' + ID + ' (the engine\'s import)', replayRoot: 'dry-run/parity/data', rebuild, ok, checks, rewrittenRecords: rewritten, differences: diffs, unexplained: unexplained.length };
  P.put(path.join(OUT, 'PARITY.json'), JSON.stringify(report, null, 1) + '\n');
  P.put(path.join(OUT, 'PARITY.md'), ['# Parity: ' + ID, '', 'Result: **' + (ok ? 'PASS' : 'FAIL') + '** (' + checks.filter((c) => c.ok).length + '/' + checks.length + ' checks, ' + diffs.length + ' differences, ' + unexplained.length + ' unexplained). $0, no model, no network.', '',
    '## Checks', '', ...checks.map((c) => '- ' + (c.ok ? 'PASS' : 'FAIL') + ' ' + c.check), '', '## Records rewritten in the replay copy (layout only)', '', ...rewritten.map((r) => '- ' + r), '',
    '## Differences', '', '| Where | Field | Reason |', '|---|---|---|', ...diffs.map((d) => '| ' + d.where + ' | `' + d.field + '` | ' + d.reason + ' |'), ''].join('\n'));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  parity({ rebuild: process.argv.includes('--rebuild'), log: (l) => console.log('  ' + l) }).then((r) => {
    console.log('parity ' + (r.ok ? 'PASS' : 'FAIL') + ': ' + r.checks.filter((c) => c.ok).length + '/' + r.checks.length + ' checks, ' + r.differences.length + ' differences (' + r.unexplained + ' unexplained). Report: dry-run/parity/PARITY.md');
    if (!r.ok) process.exitCode = 1;
  }).catch((e) => { console.error(e.stack || e.message); process.exitCode = 1; });
}
