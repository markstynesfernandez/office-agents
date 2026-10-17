// R3 spike: the baked Design room's assets match the live floor plan, stay inside the size budget and carry what the
// page needs (a lightmap UV set, the unlit LED material, both lightmaps). The page uses the baked room only behind
// ?scene=baked and only while the spec matches (office.js); these tests catch a layout change that would make the
// committed bake stale.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLayout, bakedRoomSpec } from '../src/web/scene/layout.js';
import { ASSET_DIR, BUDGET_BYTES, designSpec, assetJail } from '../scripts/build-design-room.mjs';
import { createOfficeServer } from '../src/server/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ASSET_DIR, 'manifest.json'), 'utf8'));
const glbJson = (f) => { const b = fs.readFileSync(f); assert.equal(b.readUInt32LE(0), 0x46546c67, 'glTF magic'); const len = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + len).toString('utf8')); };

test('the committed bake matches the engine office layout (config/agents)', () => {
  assert.deepEqual(manifest.spec, designSpec());
});

test('the committed bake matches the legacy fixtures layout (the view the captures use)', async () => {
  const log = { read() {}, written() {}, info() {}, warn() {}, error() {}, counts: {} };
  const { server } = createOfficeServer({ fixtures: true, log });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const snap = await (await fetch('http://127.0.0.1:' + server.address().port + '/api/office/snapshot')).json();
    const depts = snap.departments.map((d) => ({ key: d.key, agents: d.agents.slice() }));
    assert.deepEqual(bakedRoomSpec(computeLayout(depts, snap.services), 'design'), manifest.spec);
  } finally { server.close(); }
});

test('assets exist and stay under the 6 MB budget', () => {
  const files = [manifest.files.glb, manifest.lightmaps.day.file, manifest.lightmaps.evening.file];
  const total = files.reduce((s, f) => s + fs.statSync(path.join(ASSET_DIR, f)).size, 0);
  assert.ok(total <= BUDGET_BYTES, 'room assets ' + total + ' bytes > ' + BUDGET_BYTES);
  for (const k of ['day', 'evening']) assert.ok(manifest.lightmaps[k].scale > 0, k + ' lightmap scale');
  assert.match(manifest.build.blender, /Blender 5\.2\.\d+/, 'built with the pinned Blender series');
});

test('the glb has a lightmap UV set on every lit primitive and an unlit LED material', () => {
  const j = glbJson(path.join(ASSET_DIR, manifest.files.glb));
  const names = j.materials.map((m) => m.name);
  assert.ok(names.includes('led'), 'led material');
  for (const mesh of j.meshes) for (const p of mesh.primitives) {
    const name = j.materials[p.material].name;
    if (name === 'led') continue;
    assert.ok('TEXCOORD_1' in p.attributes, mesh.name + '/' + name + ' has no lightmap UVs');
  }
  assert.ok(!j.meshes.some((m) => /occluder/i.test(m.name)), 'bake-only occluders are not exported');
});

test('the page loads the baked room only behind ?scene=baked', () => {
  const main = fs.readFileSync(path.join(ROOT, 'src', 'web', 'main.js'), 'utf8'), office = fs.readFileSync(path.join(ROOT, 'src', 'web', 'scene', 'office.js'), 'utf8');
  assert.match(main, /scene: q\.get\('scene'\) === 'baked' \? 'baked' : 'default'/);
  assert.match(office, /want: options\.scene === 'baked'/);
  assert.match(office, /if \(baked\.want\) loadBakedRoom\(\)/);
});

test('the build script writes only inside src/web/assets/design-room/', () => {
  assert.throws(() => assetJail('../x.txt'), /refusing to write/);
  assert.throws(() => assetJail(path.join(ROOT, 'data', 'x')), /refusing to write/);
  assert.ok(assetJail('manifest.json').startsWith(ASSET_DIR + path.sep));
});
