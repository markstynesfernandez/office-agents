// scene/baked.js — R3 spike: the baked Design room (behind ?scene=baked). Loads the glb that
// scripts/build-design-room.mjs made in Blender, plus its two lightmaps (day for light mode, evening for dark mode).
// Every lit surface becomes an unlit MeshBasicMaterial: albedo map (or vertex colour) x lightmap on the second UV set,
// so the room costs no real-time lights, shadows or PBR. The LED strips and lamp bulbs stay unlit and real-time: dim
// profiles in light mode, bright HDR warm light in dark mode (above 1.0, so the optional half-resolution glow pass in
// office.js picks them out). People, monitors, keyboards and status lights are not in the glb: office.js draws them.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const BAKED_BASE = '/assets/design-room/';
const LED = { light: { colour: '#efeae2', gain: 1 }, dark: { colour: '#ffd394', gain: 2.6 } };   // light: palette.led (light)
const LM_GAIN = { light: 1.0, dark: 1.0 };   // spare knob: lightmap brightness per theme on top of the baked scale

export async function loadBakedRoom(base = BAKED_BASE) {
  const res = await fetch(base + 'manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('manifest.json: HTTP ' + res.status);
  const manifest = await res.json();
  const tl = new THREE.TextureLoader();
  const [gltf, day, evening] = await Promise.all([new GLTFLoader().loadAsync(base + manifest.files.glb), tl.loadAsync(base + manifest.lightmaps.day.file), tl.loadAsync(base + manifest.lightmaps.evening.file)]);
  for (const t of [day, evening]) { t.flipY = false; t.channel = 1; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; }
  const maps = { light: { tex: day, scale: manifest.lightmaps.day.scale }, dark: { tex: evening, scale: manifest.lightmaps.evening.scale } };
  const group = gltf.scene; group.name = 'baked:design';
  const lit = [], leds = [], ledMeshes = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material, name = src.name || '';
    if (name === 'led') {
      o.material = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }); o.material.name = 'led';
      o.castShadow = false; leds.push(o.material); ledMeshes.push(o);
    } else {
      o.material = new THREE.MeshBasicMaterial({ name, map: src.map || null, color: src.color ? src.color.clone() : 0xffffff, vertexColors: !!src.vertexColors, side: src.side, lightMap: day, lightMapIntensity: 1 });
      o.castShadow = true; lit.push(o.material);
    }
    o.receiveShadow = false;
    src.dispose();
  });
  function setTheme(theme) {
    const m = maps[theme === 'dark' ? 'dark' : 'light'], k = Math.PI * m.scale * LM_GAIN[theme === 'dark' ? 'dark' : 'light'];   // basic material: albedo x lightmap x intensity / PI
    for (const mat of lit) { mat.lightMap = m.tex; mat.lightMapIntensity = k; }
    const l = LED[theme === 'dark' ? 'dark' : 'light'];
    for (const mat of leds) mat.color.set(l.colour).multiplyScalar(l.gain);
  }
  function dispose() {
    group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    day.dispose(); evening.dispose();
  }
  return { manifest, group, ledMeshes, setTheme, dispose };
}
