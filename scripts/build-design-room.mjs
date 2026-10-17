// build-design-room.mjs — R3 spike: builds the baked Design room with Blender, headless and reproducible.
//   npm run build-design-room                      -> full build (2048 lightmaps, 1024 samples, GPU)
//   node scripts/build-design-room.mjs --quick     -> a fast look (1024 lightmaps, 128 samples)
// Steps: (1) the room spec from the live floor plan (layout.js, bakedRoomSpec) for the station's departments; (2) Blender
// runs scripts/blender/build-design-room.py, which models the room, bakes a day and an evening lightmap in Cycles and
// exports design-room.glb with two UV sets (textures, lightmap); (3) the lightmaps become WebP (sharp); (4) the manifest
// (spec, files, lightmap scales, build info) and the sizes are written. Every file this script writes goes through
// assetJail() (src/web/assets/design-room/ only); Blender writes only into that folder too (the Python script checks).
// Blender: BLENDER_EXE, else the default install path. The pinned version is in ASSETS.md; another version is refused
// unless --any-blender is given. No network, no secrets, mock data only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { computeLayout, bakedRoomSpec } from '../src/web/scene/layout.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ASSET_DIR = path.join(ROOT, 'src', 'web', 'assets', 'design-room');
// the only way this script writes: a path inside src/web/assets/design-room/
export function assetJail(p) { const f = path.resolve(ASSET_DIR, p); if (!f.startsWith(ASSET_DIR + path.sep)) throw new Error('refusing to write outside src/web/assets/design-room/: ' + p); return f; }
export const BLENDER_PIN = '5.2';                 // series pinned in ASSETS.md (5.2 LTS)
const DEFAULT_BLENDER = 'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe';
const TEXTURES = path.join(ROOT, 'assets-src', 'polyhaven');
const PY = path.join(ROOT, 'scripts', 'blender', 'build-design-room.py');
export const BUDGET_BYTES = 6 * 1024 * 1024;     // the room's assets, compressed (owner's R3 brief)

// The station's departments in the order the server gives them (research, design, office). Only the Design room's own
// desk count and the back row's depth matter to its spec; tests/baked-room.test.mjs checks the fixtures and engine views
// give the same spec as the committed manifest.
export function stationDepartments() {
  const dir = path.join(ROOT, 'config', 'agents'), byDept = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) { const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); const k = String(a.department || 'office').toLowerCase(); (byDept[k] = byDept[k] || []).push(a.key); }
  return ['research', 'design', 'office'].filter((k) => byDept[k]).map((k) => ({ key: k, agents: byDept[k] }));
}
export function designSpec() { return bakedRoomSpec(computeLayout(stationDepartments(), [{ id: 's0' }, { id: 's1' }, { id: 's2' }, { id: 's3' }]), 'design'); }

function sizesOf(files) {
  const rows = files.map((f) => { const buf = fs.readFileSync(path.join(ASSET_DIR, f)); return { file: f, bytes: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length, brotli: zlib.brotliCompressSync(buf).length }; });
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  return { files: rows, total: { bytes: sum('bytes'), gzip: sum('gzip'), brotli: sum('brotli') }, budgetBytes: BUDGET_BYTES, note: 'bytes = as served (glb with JPEG textures, WebP lightmaps: already compressed formats); gzip/brotli = what HTTP compression would add on top' };
}

async function main() {
  const argv = process.argv.slice(2), has = (f) => argv.includes(f), arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const quick = has('--quick');
  const size = Number(arg('--size', quick ? 1024 : 2048)), samples = Number(arg('--samples', quick ? 128 : 1024));
  const blender = process.env.BLENDER_EXE || DEFAULT_BLENDER;
  if (!fs.existsSync(blender)) throw new Error('Blender not found at ' + blender + ' (set BLENDER_EXE)');
  const ver = spawnSync(blender, ['--version'], { encoding: 'utf8' });
  const version = ((ver.stdout || '').match(/Blender\s+(\d+\.\d+\.\d+)[^\n]*/) || [])[0] || 'unknown';
  console.log('[build] blender:', version, '|', blender);
  if (!version.includes(' ' + BLENDER_PIN + '.') && !has('--any-blender')) throw new Error('Blender ' + BLENDER_PIN + '.x is pinned (ASSETS.md); found ' + version + ' (pass --any-blender to override)');

  fs.mkdirSync(assetJail('.build'), { recursive: true });
  const spec = designSpec();
  fs.writeFileSync(assetJail('.build/spec.json'), JSON.stringify(spec, null, 2) + '\n');
  console.log('[build] spec: design room', spec.w + ' x ' + spec.d, '|', spec.desks.length, 'desks |', size + 'px lightmaps,', samples, 'samples');

  const t0 = Date.now();
  const run = spawnSync(blender, ['-b', '--factory-startup', '--python-exit-code', '3', '--python', PY, '--', '--spec', assetJail('.build/spec.json'), '--out', ASSET_DIR, '--textures', TEXTURES, '--size', String(size), '--samples', String(samples)], { stdio: 'inherit' });
  const blenderSeconds = (Date.now() - t0) / 1000;
  if (run.status !== 0) throw new Error('Blender exited with ' + run.status);
  const bake = JSON.parse(fs.readFileSync(assetJail('.build/bake.json'), 'utf8'));

  // lightmaps: 8-bit PNG (sRGB-encoded, scaled by k) -> WebP
  const lightmaps = {};
  for (const [key, lm] of Object.entries(bake.lightmaps)) {
    const file = 'lightmap-' + key + '.webp';
    await sharp(assetJail('.build/' + lm.png)).webp({ quality: 90, effort: 6 }).toFile(assetJail(file));
    lightmaps[key] = { file, scale: lm.scale, coverage: lm.coverage, p995: lm.p995, max: lm.max };
  }
  const files = ['design-room.glb', ...Object.values(lightmaps).map((l) => l.file)];
  const sizes = sizesOf(files);
  const manifest = {
    version: 1, room: 'design', spec, files: { glb: 'design-room.glb' }, lightmaps,
    leds: bake.leds, materials: bake.materials,
    build: { at: new Date().toISOString(), blender: version, device: bake.device, size, samples, blenderSeconds: +blenderSeconds.toFixed(1), phases: bake.phases, triangles: bake.triangles, script: 'scripts/blender/build-design-room.py' },
    sizes: { total: sizes.total, budgetBytes: BUDGET_BYTES }
  };
  fs.writeFileSync(assetJail('manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(assetJail('sizes.json'), JSON.stringify(sizes, null, 2) + '\n');
  fs.rmSync(assetJail('.build'), { recursive: true, force: true });
  console.log('[build] done in', blenderSeconds.toFixed(1) + ' s (Blender) |', (sizes.total.bytes / 1048576).toFixed(2) + ' MB as served |', sizes.total.bytes <= BUDGET_BYTES ? 'within' : 'OVER', 'the 6 MB budget');
  for (const r of sizes.files) console.log('   ', r.file.padEnd(26), (r.bytes / 1024).toFixed(0).padStart(6) + ' KB');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error('[build] failed:', e.message); process.exit(1); });
