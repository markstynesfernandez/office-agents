// PORTED from Virtual-workers/station/scripts/lib/digital-prep.mjs (the owner's own code) at 16/10/2026 19:16 Irish time, source sha256 361d8ac33e12c8ffafe8fcf7901d2f6023a7c9fce50768ee045b629315d8ec53.
//   change: file writes go through the engine's data jail (dataJail from ../store/active.mjs)
//   change: job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/)
//   change: measuredBy names the engine module
// Everything else is the source unchanged. PORTED.md lists every ported file; npm run port-drift checks the source.
// digital-prep.mjs (lib) — gets a DIGITAL deliverable set ready for QA DESIGN (productType "digital"), the digital counterpart of
// design-prep.mjs. Before QA DESIGN's model call (design hook) it measures work/<id>/set-vN/files/* and writes, with no model and no clock:
//   set-vN/deliverables.json  the manifest: every file's format (from its bytes), pixel size, byte size, sha256; the assets the set used
//   set-vN/originality.json   the originality screen of set-vN/design.md (the Designer's prompts and notes), with design.md's sha256
// Same inputs -> same bytes -> nothing written (idempotent). QA DESIGN judges from these records; the package gate re-measures the files.
// A PACKAGED product (products.json deliverables.package: one zip + a preview) is built from set-vN/raw/ by lib/digital-build.mjs first; this
// refuses a set whose build is missing or stale and copies the build record (clean-up, upscale, padding per file) into the manifest.
import fs from 'node:fs';
import path from 'node:path';
import { config as defaultConfig, isListingId, sha256 } from './common.mjs';
import { measureDir } from './digital-files.mjs';
import { screenText, hitLine, SOFT_CATEGORIES } from './originality.mjs';
import { buildStatus, isPackaged, productFor } from './digital-build.mjs';
import { dataJail } from '../store/active.mjs';

export const setDir = (roomDir, id, n) => path.join(roomDir, 'jobs', id, 'set-v' + n);
export const manifestRel = (id, n) => 'jobs/' + id + '/set-v' + n + '/deliverables.json';
export const MANIFEST_RE = (id) => new RegExp('^jobs/' + id + '/set-v(\\d+)/deliverables\\.json$');

export function latestSet(roomDir, id) {
  const dir = path.join(roomDir, 'jobs', id); if (!fs.existsSync(dir)) return 0;
  return Math.max(0, ...fs.readdirSync(dir).map((f) => /^set-v(\d+)$/.exec(f)).filter(Boolean).map((m) => Number(m[1])));
}

// the newest set (across listings) whose files are newer than its manifest, or that has none: { id, n } or null
export function pendingSet(roomDir) {
  const root = path.join(roomDir, 'jobs'); if (!fs.existsSync(root)) return null;
  let best = null;
  for (const id of fs.readdirSync(root)) {
    if (!isListingId(id)) continue;
    const n = latestSet(roomDir, id); if (!n) continue;
    const sd = setDir(roomDir, id, n), dirs = ['files', 'raw'].map((d) => path.join(sd, d)).filter((d) => fs.existsSync(d)); if (!dirs.length) continue;
    const newest = Math.max(...dirs.flatMap((d) => [fs.statSync(d).mtimeMs, ...fs.readdirSync(d).map((f) => fs.statSync(path.join(d, f)).mtimeMs)]), ...['design.md', 'assets.json', 'build.json'].filter((f) => fs.existsSync(path.join(sd, f))).map((f) => fs.statSync(path.join(sd, f)).mtimeMs));
    const mf = path.join(sd, 'deliverables.json');
    if (fs.existsSync(mf) && fs.statSync(mf).mtimeMs >= newest) continue;
    if (!best || newest > best.t) best = { id, n, t: newest };
  }
  return best && { id: best.id, n: best.n };
}

// assets a set used: the image generator (the only one the OpenRouter guardrail allows), fonts named in typeset records, and any the Designer declared
export function assetsOf(sd, cfg = defaultConfig) {
  const keys = new Set(((cfg.imagePolicy || {}).allowedModels || []).map((m) => 'generator:' + m));
  for (const f of fs.existsSync(sd) ? fs.readdirSync(sd) : []) {
    if (!/\.typeset\.json$/.test(f)) continue;
    try { const r = JSON.parse(fs.readFileSync(path.join(sd, f), 'utf8')); if (r.font) keys.add('font:' + r.font); } catch (_) { keys.add('unreadable-typeset-record:' + f); }
  }
  const af = path.join(sd, 'assets.json');
  if (fs.existsSync(af)) { try { for (const k of JSON.parse(fs.readFileSync(af, 'utf8')).assets || []) keys.add(String(k)); } catch (_) { keys.add('unreadable:assets.json'); } }
  return [...keys].sort();
}

const write = (file, obj) => { const text = JSON.stringify(obj, null, 1) + '\n'; if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return 'unchanged'; fs.writeFileSync(dataJail(file), text); return 'written'; };

export function prepareDigitalSet({ roomDir, id, n, cfg = defaultConfig, products = null, log = { info() {}, warn() {}, error() {} } }) {
  const sd = setDir(roomDir, id, n), fd = path.join(sd, 'files'), dm = path.join(sd, 'design.md');
  // a packaged product (zip + preview) is built by the station from raw/ first; this only checks the build is current (hashes, no image work)
  const { key: productKey, product } = productFor(roomDir, id, products);
  let build = null;
  if (isPackaged(product)) {
    const st = buildStatus({ roomDir, id, n, product, cfg });
    if (!st.current) return { ok: false, reason: 'the station build of set-v' + n + ' is not current (' + st.reason + '): run node scripts/build-digital-set.mjs ' + id + ' (run-line does this between DESIGNER and QA DESIGN)' };
    build = st.record;
  }
  if (!fs.existsSync(fd)) return { ok: false, reason: 'jobs/' + id + '/set-v' + n + '/files/ is missing: no deliverables' };
  if (!fs.existsSync(dm)) return { ok: false, reason: 'jobs/' + id + '/set-v' + n + '/design.md is missing: the prompts and notes are required for the originality screen' };
  const m = measureDir(fd);
  const manifest = { listingId: id, set: n, productKey, count: m.files.length, totalBytes: m.files.reduce((s, f) => s + f.bytes, 0), files: m.files, subfolders: m.subfolders,
    assets: assetsOf(sd, cfg), designNotes: 'jobs/' + id + '/set-v' + n + '/design.md', measuredBy: 'engine prep step, src/engine/lib/digital-prep.mjs (file bytes; no model)', ...(build ? { build } : {}) };
  const text = fs.readFileSync(dm, 'utf8'), sc = screenText(text, cfg, { ignore: SOFT_CATEGORIES });
  const orig = { stage: 'design-originality', listingId: id, set: n, designNotesSha256: sha256(text), result: sc.hits.length ? 'hit' : 'clear', hits: sc.hits.map((h) => ({ field: 'design.md', ...h })), note: 'local deterministic screen: a clear result is not clearance, judge the files and anything the lists cannot know' };
  const a1 = write(path.join(sd, 'deliverables.json'), manifest), a2 = write(path.join(sd, 'originality.json'), orig);
  // the manifest's sha256 for QA DESIGN to copy into its record (agents cannot hash; the gate compares it with the manifest on disk)
  { const sf = path.join(sd, 'deliverables.sha256'), h = sha256(fs.readFileSync(path.join(sd, 'deliverables.json'))) + '\n'; if (!fs.existsSync(sf) || fs.readFileSync(sf, 'utf8') !== h) fs.writeFileSync(dataJail(sf), h); }
  log.info('digital set prepared ' + id + '/set-v' + n, { files: m.files.length, manifest: a1, originality: orig.result + ' (' + a2 + ')', hits: orig.hits.map(hitLine) });
  return { ok: true, manifest, originality: orig, designFile: manifestRel(id, n), productKey };
}

// the design hook's answer in digital mode: block QA DESIGN with the reason when the newest set cannot be prepared
export function runDigitalDesignHook({ payload, roomDir, qaDesignAgentId, cfg = defaultConfig, log = { info() {}, warn() {}, error() {} }, prepare = prepareDigitalSet }) {
  if (!payload || payload.hook_event_name !== 'pre_llm_call') return null;
  if (!qaDesignAgentId || !payload.extra || payload.extra.agent_id !== qaDesignAgentId) return null;
  const pend = pendingSet(roomDir); if (!pend) return null;
  try {
    const r = prepare({ roomDir, id: pend.id, n: pend.n, cfg, log });
    if (!r.ok) { log.error('digital set preparation failed; QA DESIGN blocked', { id: pend.id, reason: r.reason }); return { decision: 'block', reason: 'Station could not prepare set-v' + pend.n + ' for ' + pend.id + ': ' + r.reason + '. QA DESIGN must not review a deliverable set that has not been measured.' }; }
  } catch (e) { return { decision: 'block', reason: 'Station digital set preparation crashed for ' + pend.id + ': ' + e.message }; }
  return null;
}
