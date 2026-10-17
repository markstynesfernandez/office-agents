// build-office.mjs — R3a: builds the baked office rooms with Blender, headless and reproducible (phase 1: Design, Office).
//   npm run build-office                      -> full build (3072 px lightmap atlases, 1024 samples, GPU)
//   node scripts/build-office.mjs --quick     -> a fast look (1536 px, 128 samples)
// Steps: (1) the room specs from the live floor plan (layout.js, bakedRoomSpec) for the station's departments, and the
// shared look (bakedlook.js: the oak floor, the themed wall colours from the palette, the decal atlas regions); (2)
// Blender runs scripts/blender/build-office.py, which builds every room from the shared library (office_lib.py,
// office_rooms.py), packs all their lightmap UVs into one atlas, bakes a day and an evening atlas in Cycles and exports
// office.gltf + office.bin + textures/ (each shared texture once); (3) the atlases become WebP (sharp); (4) the
// manifest (per-room spec, look, lightmap scales, build info) and the sizes are written. Blender writes into a staging
// folder; only a successful build replaces the published assets. Every file this script writes goes through
// assetJail() (src/web/assets/office/ only); Blender writes only into the staging folder there (the Python checks).
// Blender: BLENDER_EXE, else the default install path. The pinned version is in ASSETS.md; another version is refused
// unless --any-blender is given. No network, no secrets, mock data only.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { computeLayout, bakedRoomSpec } from '../src/web/scene/layout.js';
import { BAKED_ROOMS, bakedLook } from '../src/web/scene/bakedlook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ASSET_DIR = path.join(ROOT, 'src', 'web', 'assets', 'office');
// the only way this script writes: a path inside src/web/assets/office/
export function assetJail(p) { const f = path.resolve(ASSET_DIR, p); if (!f.startsWith(ASSET_DIR + path.sep)) throw new Error('refusing to write outside src/web/assets/office/: ' + p); return f; }
export const BLENDER_PIN = '5.2';                 // series pinned in ASSETS.md (5.2 LTS)
const DEFAULT_BLENDER = 'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe';
const TEXTURES = path.join(ROOT, 'assets-src', 'polyhaven');
const PY = path.join(ROOT, 'scripts', 'blender', 'build-office.py');
export const BUDGET_BYTES = 10 * 1000 * 1000;    // the whole office's baked assets, compressed (owner, R3a): 10 MB
// bake lighting (not shared with the page): day = sun + sky; evening = LED strips, desk lamps and a cool sky fill.
// Evening fill raised from the spike's 0.8 so the rooms read at overview zoom (owner, R3a).
export const BAKE_LIGHT = { day: { sun: 2.6, sky: '#dfe6f0', skyStrength: 0.55 }, evening: { sky: '#8a90a4', skyStrength: 1.5, ledGain: 1.0, lamp: 25.0 } };

// The station's departments in the order the server gives them (research, design, office). tests/baked-room.test.mjs
// checks the fixtures and engine views give the same specs as the committed manifest.
export function stationDepartments() {
  const dir = path.join(ROOT, 'config', 'agents'), byDept = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) { const a = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); const k = String(a.department || 'office').toLowerCase(); (byDept[k] = byDept[k] || []).push(a.key); }
  return ['research', 'design', 'office'].filter((k) => byDept[k]).map((k) => ({ key: k, agents: byDept[k] }));
}
export function officeSpecs() { const L = computeLayout(stationDepartments(), [{ id: 's0' }, { id: 's1' }, { id: 's2' }, { id: 's3' }]); return Object.fromEntries(BAKED_ROOMS.map((k) => [k, bakedRoomSpec(L, k)])); }

function listFiles(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith('.')) continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...listFiles(dir, r)); else out.push(r);
  }
  return out;
}
export function sizesOf(dir = ASSET_DIR) {
  const rows = listFiles(dir).filter((f) => f !== 'sizes.json').map((f) => { const buf = fs.readFileSync(path.join(dir, f)); return { file: f, bytes: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length, brotli: zlib.brotliCompressSync(buf).length }; });
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  return { files: rows, total: { bytes: sum('bytes'), gzip: sum('gzip'), brotli: sum('brotli') }, budgetBytes: BUDGET_BYTES, budgetNote: '10 MB (10,000,000 bytes) for the whole baked office, compressed (owner, R3a); checked against bytes as served', note: 'bytes = as served (JPEG textures, WebP lightmaps: already compressed; the glTF JSON and geometry are not); gzip/brotli = what HTTP compression would give' };
}

async function main() {
  const argv = process.argv.slice(2), has = (f) => argv.includes(f), arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const quick = has('--quick');
  const size = Number(arg('--size', quick ? 1536 : 3072)), samples = Number(arg('--samples', quick ? 128 : 1024));
  const blender = process.env.BLENDER_EXE || DEFAULT_BLENDER;
  if (!fs.existsSync(blender)) throw new Error('Blender not found at ' + blender + ' (set BLENDER_EXE)');
  const ver = spawnSync(blender, ['--version'], { encoding: 'utf8' });
  const version = (((ver.stdout || '').match(/Blender\s+(\d+\.\d+\.\d+)[^\r\n]*/) || [])[0] || 'unknown').trim();
  console.log('[build] blender:', version, '|', blender);
  if (!version.includes(' ' + BLENDER_PIN + '.') && !has('--any-blender')) throw new Error('Blender ' + BLENDER_PIN + '.x is pinned (ASSETS.md); found ' + version + ' (pass --any-blender to override)');

  const tStart = Date.now();
  fs.rmSync(assetJail('.build'), { recursive: true, force: true });
  fs.mkdirSync(assetJail('.build/stage/.build'), { recursive: true });
  const specs = officeSpecs(), look = bakedLook();
  fs.writeFileSync(assetJail('.build/input.json'), JSON.stringify({ look: { ...look, ...BAKE_LIGHT }, rooms: BAKED_ROOMS.map((k) => specs[k]) }, null, 2) + '\n');
  for (const k of BAKED_ROOMS) console.log('[build] room', k.padEnd(7), specs[k].w + ' x ' + specs[k].d, '|', specs[k].desks.length, 'desks');
  console.log('[build]', size + 'px lightmap atlases,', samples, 'samples');

  const t0 = Date.now();
  const run = spawnSync(blender, ['-b', '--factory-startup', '--python-exit-code', '3', '--python', PY, '--', '--input', assetJail('.build/input.json'), '--out', assetJail('.build/stage'), '--textures', TEXTURES, '--size', String(size), '--samples', String(samples)], { stdio: 'inherit' });
  const blenderSeconds = (Date.now() - t0) / 1000;
  if (run.status !== 0) throw new Error('Blender exited with ' + run.status);
  const stage = assetJail('.build/stage');
  const bake = JSON.parse(fs.readFileSync(path.join(stage, '.build', 'bake.json'), 'utf8'));
  if (!fs.existsSync(path.join(stage, look.floor.texture))) throw new Error('the export has no ' + look.floor.texture + ' (the procedural rooms use it)');

  // lightmap atlases: 8-bit PNG (sRGB-encoded, scaled by k) -> WebP
  const lightmaps = {};
  for (const [key, lm] of Object.entries(bake.lightmaps)) {
    const file = 'lightmap-' + key + '.webp';
    await sharp(path.join(stage, '.build', lm.png)).webp({ quality: 90, effort: 6 }).toFile(assetJail('.build/stage/' + file));
    lightmaps[key] = { file, scale: lm.scale, coverage: lm.coverage, p995: lm.p995, max: lm.max };
  }
  fs.rmSync(assetJail('.build/stage/.build'), { recursive: true, force: true });
  // publish: replace everything in the asset folder (but .build) with the staged build
  for (const e of fs.readdirSync(ASSET_DIR)) if (e !== '.build') fs.rmSync(assetJail(e), { recursive: true, force: true });
  for (const e of fs.readdirSync(stage)) fs.renameSync(path.join(stage, e), assetJail(e));
  const sizes0 = sizesOf();
  const rooms = Object.fromEntries(BAKED_ROOMS.map((k) => [k, { spec: specs[k], node: bake.rooms[k].node, leds: bake.rooms[k].leds, strips: bake.rooms[k].strips, triangles: bake.triangles[k] }]));
  const manifest = {
    version: 2, files: { gltf: 'office.gltf' }, look, rooms, lightmaps, materials: bake.materials,
    build: { at: new Date().toISOString(), blender: version, device: bake.device, size, samples, blenderSeconds: +blenderSeconds.toFixed(1), phases: bake.phases, script: 'scripts/blender/build-office.py', library: 'scripts/blender/office_lib.py', light: BAKE_LIGHT },
    sizes: { total: sizes0.total, budgetBytes: BUDGET_BYTES }
  };
  fs.writeFileSync(assetJail('manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  manifest.build.totalSeconds = +((Date.now() - tStart) / 1000).toFixed(1);
  const sizes = sizesOf(); manifest.sizes.total = sizes.total;
  fs.writeFileSync(assetJail('manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(assetJail('sizes.json'), JSON.stringify(sizesOf(), null, 2) + '\n');
  fs.rmSync(assetJail('.build'), { recursive: true, force: true });
  const s = sizesOf().total;
  console.log('[build] done in', manifest.build.totalSeconds + ' s (Blender ' + blenderSeconds.toFixed(1) + ' s) |', (s.bytes / 1e6).toFixed(2) + ' MB as served,', (s.brotli / 1e6).toFixed(2) + ' MB with brotli |', s.bytes <= BUDGET_BYTES ? 'within' : 'OVER', 'the 10 MB budget');
  for (const r of sizesOf().files) console.log('   ', r.file.padEnd(30), (r.bytes / 1024).toFixed(0).padStart(6) + ' KB');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error('[build] failed:', e.message); process.exit(1); });
