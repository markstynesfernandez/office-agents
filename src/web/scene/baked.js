// scene/baked.js — the baked rooms (R3 spike: Design; R3a: Design and Office, the default scene; ?scene=procedural
// turns them off). Loads office.gltf, which scripts/build-office.mjs made in Blender from the shared library, plus the
// two lightmap atlases every room shares (day for light mode, evening for dark mode). Every lit surface becomes an
// unlit MeshBasicMaterial: albedo (shared texture, vertex colour or themed colour) x lightmap on the second UV set, so
// the rooms cost no real-time lights, shadows or PBR. Themed materials (walls, caps, skirting) take the manifest's
// colour for the theme: warm white by day, dark by evening. The decals (mood board, whiteboard, pictures) take the
// page's own procedural atlas. The LED strips and lamp bulbs stay unlit and real-time: dim profiles in light mode,
// bright HDR warm light in dark mode (above 1.0, so the half-resolution glow pass in office.js picks them out). People,
// monitors, keyboards and status lights are not in the glTF: office.js draws them.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FLOOR_OAK } from './bakedlook.js';

export const BAKED_BASE = '/assets/office/';
const LED = { light: { colour: '#efeae2', gain: 1 }, dark: { colour: '#ffd394', gain: 2.6 } };   // light: palette.led (light)
// lightmap brightness per theme on top of the baked scale: the evening rooms are lifted so desks, people and screens
// read at overview zoom, and the rooms are no darker overall than the procedural ones (R3a; measured, see DECISIONS)
export const LM_GAIN = { light: 1.0, dark: 1.15 };

// the shared oak floor, also used by the procedural rooms (one wood across the office)
export function loadFloorTexture(base = BAKED_BASE) {
  return new THREE.TextureLoader().loadAsync(base + FLOOR_OAK.texture).then((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; return t; });
}

export async function loadBakedOffice({ base = BAKED_BASE, decalMap = null } = {}) {
  const res = await fetch(base + 'manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('manifest.json: HTTP ' + res.status);
  const manifest = await res.json();
  const tl = new THREE.TextureLoader();
  const [gltf, day, evening] = await Promise.all([new GLTFLoader().loadAsync(base + manifest.files.gltf), tl.loadAsync(base + manifest.lightmaps.day.file), tl.loadAsync(base + manifest.lightmaps.evening.file)]);
  for (const t of [day, evening]) { t.flipY = false; t.channel = 1; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; }
  const maps = { light: { tex: day, scale: manifest.lightmaps.day.scale }, dark: { tex: evening, scale: manifest.lightmaps.evening.scale } };
  const themedNames = new Set(manifest.materials.themed || []);
  const lit = [], themed = [], leds = [], cache = new Map();   // one page material per glTF material, shared by every room
  function pageMaterial(src) {
    if (cache.has(src)) return cache.get(src);
    const name = src.name || '';
    let m;
    if (name === 'led') { m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); leds.push(m); }
    else {
      const map = name === 'decal' ? decalMap : src.map || null;
      if (map && map !== decalMap) map.anisotropy = 4;
      m = new THREE.MeshBasicMaterial({ map, color: src.color ? src.color.clone() : 0xffffff, vertexColors: !!src.vertexColors, side: src.side, lightMap: day, lightMapIntensity: 1 });
      lit.push(m); if (themedNames.has(name)) themed.push(m);
    }
    m.name = name; cache.set(src, m); return m;
  }
  const rooms = {};
  for (const [key, r] of Object.entries(manifest.rooms)) {
    const group = new THREE.Group(); group.name = 'baked:' + key;
    const node = gltf.scene.getObjectByName(r.node), ledNode = gltf.scene.getObjectByName(r.leds);
    if (!node) throw new Error('office.gltf has no node ' + r.node);
    group.add(node); if (ledNode) group.add(ledNode);
    const ledMeshes = [];
    group.traverse((o) => {
      if (!o.isMesh) return;
      const src = o.material; o.material = pageMaterial(src);
      src.dispose();   // the glTF material (its textures live on in the page material)
      o.castShadow = o.material.name !== 'led'; o.receiveShadow = false;
      if (o.material.name === 'led') ledMeshes.push(o);
    });
    rooms[key] = { key, spec: r.spec, group, ledMeshes };
  }
  function setTheme(theme) {
    const t = theme === 'dark' ? 'dark' : 'light', m = maps[t], k = Math.PI * m.scale * LM_GAIN[t];   // basic material: albedo x lightmap x intensity / PI
    for (const mat of lit) { mat.lightMap = m.tex; mat.lightMapIntensity = k; }
    const colours = manifest.look.themed[t === 'dark' ? 'evening' : 'day'];
    for (const mat of themed) mat.color.set(colours[mat.name] || '#888888');
    const l = LED[t];
    for (const mat of leds) mat.color.set(l.colour).multiplyScalar(l.gain);
  }
  function dispose() {
    const seen = new Set();
    for (const r of Object.values(rooms)) r.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    for (const m of cache.values()) { if (m.map && m.map !== decalMap && !seen.has(m.map)) { seen.add(m.map); m.map.dispose(); } m.dispose(); }
    day.dispose(); evening.dispose();
  }
  return { manifest, rooms, setTheme, dispose };
}
