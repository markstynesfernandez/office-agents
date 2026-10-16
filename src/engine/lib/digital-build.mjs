// PORTED from Virtual-workers/station/scripts/lib/digital-build.mjs (the owner's own code) at 16/10/2026 20:04 Irish time (re-ported: it changed after 19:42), source sha256 b99fcc6fbd3052a25bece1ba74246c14866eb1d9ca2172d9c958a91f9a68ca51.
//   change: only BUILD_VERSION, zipNameFor, isPackaged, previewDirOf, noticeFor, productFor, buildInputs, buildStatus are ported (read-only)
//   change: esrganCfg copied in from esrgan.mjs; the build itself (Real-ESRGAN through a child process) is NOT ported: packaged products fail closed
//   change: job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/)
// Everything else is the source unchanged. PORTED.md lists every ported file; npm run port-drift checks the source.
import fs from 'node:fs';
import path from 'node:path';
import { config as defaultConfig, sha256, productsFile } from './common.mjs';
// from esrgan.mjs (same port moment): the upscale settings that are part of a build's key
const esrganCfg = (cfg = defaultConfig) => ({ method: 'lanczos', nativeScale: 4, model: 'realesrgan-x4plus', binary: null, ...(cfg.upscale || {}) });
export const BUILD_VERSION = 3;   // bump when the processing changes, so earlier builds are redone (3: enclosed background made transparent)
const setDirOf = (roomDir, id, n) => path.join(roomDir, 'jobs', id, 'set-v' + n);
export const zipNameFor = (id) => String(id).replace(/^\d{4}-\d{2}-\d{2}--/, '') + '.zip';
export const isPackaged = (product) => !!(product && product.deliverables && product.deliverables.package && product.deliverables.package.kind === 'zip');
// where the listing preview lives: set-vN/<preview.dir>/<preview.name>, outside files/ (it is a listing photo, not a download)
export const previewDirOf = (cfg = defaultConfig) => ((cfg.digital.build.preview || {}).dir || 'listing');

// the digital-download notice a listing states word for word: the product's own (products.json listingNotice, it names the files) or the config default
export function noticeFor(product, cfg = defaultConfig) {
  const own = product && product.listingNotice, d = cfg.digital || {};
  return own && own.text ? { text: own.text, status: own.status || '', where: 'products.json ' + product.key + '.listingNotice' } : { text: d.listingNotice, status: d.listingNoticeStatus || '', where: 'config.digital.listingNotice' };
}

// the product a listing's brief names (work/<id>/brief.md product_type), from the digital products.json
export function productFor(roomDir, id, products = null) {
  const bf = path.join(roomDir, 'jobs', id, 'brief.md');
  const key = fs.existsSync(bf) ? ((/^product_type:\s*(\S+)/m.exec(fs.readFileSync(bf, 'utf8')) || [])[1] || null) : null;
  let list = products; if (!list) { try { list = JSON.parse(fs.readFileSync(productsFile('digital'), 'utf8')).products; } catch (_) { list = []; } }
  return { key, product: list.find((x) => x.key === key) || null };
}

// the raw files and the settings that decide the build: same key -> same build
export function buildInputs({ roomDir, id, n, product, cfg = defaultConfig }) {
  const rd = path.join(setDirOf(roomDir, id, n), 'raw');
  const names = fs.existsSync(rd) ? fs.readdirSync(rd, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name).sort() : [];
  const inputs = names.map((name) => ({ name, sha256: sha256(fs.readFileSync(path.join(rd, name))) }));
  const spec = (product.deliverables.files || []).map((f) => ({ format: f.format, widthPx: f.widthPx, heightPx: f.heightPx }));
  const u = esrganCfg(cfg), settings = { version: BUILD_VERSION, cleanup: cfg.digital.build.cleanup, paddingPct: cfg.digital.build.paddingPct, preview: cfg.digital.build.preview,
    upscale: { method: u.method, model: u.model, nativeScale: u.nativeScale, alphaMethod: u.alphaMethod || 'lanczos' }, spec, zipName: zipNameFor(id), prep: product.deliverables.prep || null };
  return { rawDir: rd, inputs, settings, key: sha256(JSON.stringify({ inputs, settings })) };
}

// cheap: is set-vN's build current for its raw files and settings, with every output still on disk as recorded? (hashes, no image work)
export function buildStatus({ roomDir, id, n, product, cfg = defaultConfig }) {
  const sd = setDirOf(roomDir, id, n), bf = path.join(sd, 'build.json');
  if (!fs.existsSync(bf)) return { current: false, reason: 'set-v' + n + ' has not been built (no build.json)' };
  let rec; try { rec = JSON.parse(fs.readFileSync(bf, 'utf8')); } catch (_) { return { current: false, reason: 'build.json is not valid JSON' }; }
  const { key } = buildInputs({ roomDir, id, n, product, cfg });
  if (rec.key !== key) return { current: false, reason: 'the raw files or build settings changed since set-v' + n + ' was built', record: rec };
  const outs = [...(rec.files || []).map((f) => [path.join(sd, 'build', f.name), f.output.sha256]), [path.join(sd, 'files', rec.zip.name), rec.zip.sha256], [path.join(sd, rec.preview.path || path.join('files', rec.preview.name)), rec.preview.sha256]];
  for (const [f, h] of outs) if (!fs.existsSync(f) || sha256(fs.readFileSync(f)) !== h) return { current: false, reason: path.relative(sd, f).replace(/\\/g, '/') + ' is missing or differs from build.json', record: rec };
  return { current: true, record: rec };
}

// NOT PORTED: cleanAlpha, processFile, buildPreview, buildDigitalSet (they clean up, upscale with Real-ESRGAN through a child process, and
// zip). A packaged product therefore fails closed at prep with this reason until the owner decides on the build step (E6, §4.3 item 11).
export async function buildDigitalSet({ id, n }) { return { ok: false, reason: 'the station build step (clean-up, Real-ESRGAN upscale, zip) is not ported to the engine yet: packaged products cannot run (owner decision at E6)', id, n }; }
