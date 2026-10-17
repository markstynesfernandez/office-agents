// R3a: the baked rooms (Design and Office) match the live floor plan and the page's look, stay inside the office's
// 10 MB asset budget, share their textures, and carry what the page needs (a lightmap UV set, the unlit LED material,
// both lightmap atlases). The page draws them by default and falls back to the procedural room, one room at a time,
// when a room's spec no longer matches (office.js); these tests catch a layout, palette or atlas change that would make
// the committed bake stale.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLayout, bakedRoomSpec } from '../src/web/scene/layout.js';
import { BAKED_ROOMS, bakedLook } from '../src/web/scene/bakedlook.js';
import { ASSET_DIR, BUDGET_BYTES, officeSpecs, stationDepartments, assetJail, sizesOf } from '../scripts/build-office.mjs';
import { createOfficeServer } from '../src/server/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ASSET_DIR, 'manifest.json'), 'utf8'));
const gltf = JSON.parse(fs.readFileSync(path.join(ASSET_DIR, manifest.files.gltf), 'utf8'));

test('the committed bake has the phase-1 rooms and matches the engine office layout (config/agents)', () => {
  assert.deepEqual(Object.keys(manifest.rooms), BAKED_ROOMS);
  const specs = officeSpecs();
  for (const k of BAKED_ROOMS) assert.deepEqual(manifest.rooms[k].spec, specs[k], k);
});

test('the committed bake matches the legacy fixtures layout (the view the captures use)', async () => {
  const log = { read() {}, written() {}, info() {}, warn() {}, error() {}, counts: {} };
  const { server } = createOfficeServer({ fixtures: true, log });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const snap = await (await fetch('http://127.0.0.1:' + server.address().port + '/api/office/snapshot')).json();
    const L = computeLayout(snap.departments.map((d) => ({ key: d.key, agents: d.agents.slice() })), snap.services);
    for (const k of BAKED_ROOMS) assert.deepEqual(bakedRoomSpec(L, k), manifest.rooms[k].spec, k);
  } finally { server.close(); }
});

test('a layout change makes only the changed room stale (the page falls back for that room alone)', () => {
  const depts = stationDepartments().map((d) => (d.key === 'office' ? { ...d, agents: [...d.agents, 'EXTRA-AGENT'] } : d));
  const L = computeLayout(depts, [{ id: 's0' }, { id: 's1' }, { id: 's2' }, { id: 's3' }]);
  assert.notDeepEqual(bakedRoomSpec(L, 'office'), manifest.rooms.office.spec, 'a fifth Office desk changes the Office spec');
  assert.deepEqual(bakedRoomSpec(L, 'design'), manifest.rooms.design.spec, 'the Design room is unaffected');
  const office = fs.readFileSync(path.join(ROOT, 'src', 'web', 'scene', 'office.js'), 'utf8');
  assert.match(office, /JSON\.stringify\(br\.spec\) === JSON\.stringify\(bakedRoomSpec\(L, key\)\)/, 'office.js compares each room on its own');
});

test('the bake used the page\'s current look: one oak floor, palette wall colours, atlas regions', () => {
  assert.deepEqual(manifest.look, bakedLook());
  assert.ok(fs.existsSync(path.join(ASSET_DIR, manifest.look.floor.texture)), 'the shared floor texture the procedural rooms load');
  const day = manifest.look.themed.day, eve = manifest.look.themed.evening;
  for (const k of BAKED_ROOMS) assert.ok(lum(day['wall_' + k]) > 0.7 && lum(eve['wall_' + k]) < 0.35, k + ': warm-white walls by day, dark by evening');
});
const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };

test('the whole asset folder stays under the 10 MB office budget, built with the pinned Blender', () => {
  const s = sizesOf();
  assert.ok(s.total.bytes <= BUDGET_BYTES, 'baked assets ' + s.total.bytes + ' bytes > ' + BUDGET_BYTES);
  assert.equal(BUDGET_BYTES, 10 * 1000 * 1000);
  for (const k of ['day', 'evening']) { assert.ok(manifest.lightmaps[k].scale > 0, k + ' lightmap scale'); assert.ok(fs.existsSync(path.join(ASSET_DIR, manifest.lightmaps[k].file))); }
  assert.match(manifest.build.blender, /Blender 5\.2\.\d+/, 'built with the pinned Blender series');
});

test('the glTF: lightmap UVs on every lit primitive, shared textures written once, no bake-only occluders', () => {
  const names = gltf.materials.map((m) => m.name);
  for (const n of ['led', 'decal', 'floor', ...manifest.materials.themed]) assert.ok(names.includes(n), 'material ' + n);
  assert.equal(new Set(names).size, names.length, 'one material per name, shared by every room');
  for (const mesh of gltf.meshes) for (const p of mesh.primitives) {
    const name = gltf.materials[p.material].name;
    if (name === 'led') continue;
    assert.ok('TEXCOORD_1' in p.attributes, mesh.name + '/' + name + ' has no lightmap UVs');
  }
  const uris = gltf.images.map((i) => i.uri);
  assert.equal(new Set(uris).size, uris.length, 'each texture once');
  for (const u of uris) { assert.match(u, /^textures\/[a-z]+\.jpg$/); assert.ok(fs.existsSync(path.join(ASSET_DIR, u)), u); }
  const nodes = gltf.nodes.map((n) => n.name);
  for (const k of BAKED_ROOMS) { assert.ok(nodes.includes(manifest.rooms[k].node), k + ' node'); assert.ok(nodes.includes(manifest.rooms[k].leds), k + ' LED node'); }
  assert.ok(!nodes.some((n) => /^occ_/.test(n)), 'bake-only occluders are not exported');
});

test('the page draws the baked rooms by default; ?scene=procedural turns them off', () => {
  const main = fs.readFileSync(path.join(ROOT, 'src', 'web', 'main.js'), 'utf8'), office = fs.readFileSync(path.join(ROOT, 'src', 'web', 'scene', 'office.js'), 'utf8');
  assert.match(main, /scene: q\.get\('scene'\) === 'procedural' \? 'procedural' : 'baked'/);
  assert.match(office, /want: options\.scene !== 'procedural'/);
  assert.match(office, /if \(baked\.want\) loadBakedOffice\(/);
});

test('the build script writes only inside src/web/assets/office/', () => {
  assert.throws(() => assetJail('../x.txt'), /refusing to write/);
  assert.throws(() => assetJail(path.join(ROOT, 'data', 'x')), /refusing to write/);
  assert.ok(assetJail('manifest.json').startsWith(ASSET_DIR + path.sep));
});
