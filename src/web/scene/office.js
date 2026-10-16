// scene/office.js — the isometric diorama. Own design: three department platforms round a central "station memory"
// core, walkways, a services rack on its own mini platform, white desks with monitors, simple low-poly workers.
// Everything is procedural Three.js geometry (no external assets). Data comes in through setData(snapshot).
// Performance (review round 1): render on demand only (camera move, data change, animation tick), idle animation at a
// low tick and paused while the tab is hidden, devicePixelRatio capped at 1.5, GTAO at half resolution, shadows baked
// (the shadow map updates only when the scene changes), repeated furniture/people/plants instanced, static geometry
// merged into one vertex-coloured mesh.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { PALETTE } from '../config/palette.js';
import { makeMonitorTexture } from './monitor.js';

const DEG = Math.PI / 180;
const PITCH = 35 * DEG, YAW = 45 * DEG;
const DESK_DX = 3.8, DESK_DZ = 3.5;
const PT = 0.52;                       // platform top
const RACK = { x: 7.5, z: -14.5, w: 8.6, d: 3.0, top: 0.42 };
const SLOTS = [[-7.5, -7.5], [10.5, -1.5], [-5.5, 9.5]];
const HUB_TOP = 0.56;
const MON_YAW = 20 * DEG;              // monitors angled a little towards the viewer
export const TEXT_ZOOM = 1.8;          // monitors show their canvas text from this zoom (or when the desk is selected)
const ANIM_HZ = 12;                    // ambient animation tick (idle bob, typing, dashed lines, crystal)
const SUN_POS = new THREE.Vector3(-10, 26, 14);

const rbox = (w, h, d, r = 0.08, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2));
const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.82, metalness: 0.02, ...opts });
const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);
// a geometry ready for merging: transformed, non-indexed, position + normal + a flat vertex colour
function part(geo, color, m) {
  let g = geo.clone(); if (m) g.applyMatrix4(m);
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const T = (x, y, z, ry = 0, rx = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new THREE.Vector3(1, 1, 1));
function roundedRectShape(w, h, r) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
function ringGeo(w, h, r, t) { const s = roundedRectShape(w, h, r); s.holes.push(roundedRectShape(w - 2 * t, h - 2 * t, Math.max(0.01, r - t))); const g = new THREE.ShapeGeometry(s, 6); g.rotateX(-Math.PI / 2); return g; }

// The scene is rendered into its own 4x MSAA target and resolved once into the composer's (non-multisampled) buffer, so
// the AO copy/blend passes and the output pass run on plain buffers. (MSAA on every composer buffer cost ~14 ms a frame
// on the Intel iGPU.)
class MSAARenderPass extends Pass {
  constructor(scene, camera, samples) {
    super(); this.scene = scene; this.camera = camera; this.needsSwap = true;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { samples, type: THREE.HalfFloatType });
    this.copy = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms), vertexShader: CopyShader.vertexShader, fragmentShader: CopyShader.fragmentShader, depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.copy);
  }
  setSize(w, h) { this.rt.setSize(w, h); }
  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.rt); renderer.clear(); renderer.render(this.scene, this.camera);
    this.copy.uniforms.tDiffuse.value = this.rt.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer);
  }
}
// GTAO at half resolution: the AO and its normal/depth pre-pass run at half size, the blend upsamples onto the full frame.
// Overlays (glow sprite, drop-shadow blobs, rim lines, selection ring, activity lines) are hidden during its normal/depth
// pre-pass so they cannot create AO halos; they are already in the frame from the main render pass.
class HalfResGTAOPass extends GTAOPass {
  setSize(w, h) { super.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2))); }
  render(renderer, writeBuffer, readBuffer, dt, mask) {
    const hidden = (this.hideDuringAO ? this.hideDuringAO() : []).filter((o) => o && o.visible);
    for (const o of hidden) o.visible = false;
    try { super.render(renderer, writeBuffer, readBuffer, dt, mask); } finally { for (const o of hidden) o.visible = true; }
  }
}

export function createOffice({ canvas, theme = 'light', onPick = () => {}, options = {} }) {
  const P = () => PALETTE[theme];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;      // soft edges via shadow.radius
  renderer.shadowMap.autoUpdate = false;             // baked: refreshed only when the scene changes
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
  scene.add(camera);
  const HOME = new THREE.Vector3(-1.2, 0, -3.4);
  const view = { target: HOME.clone(), zoom: 1, wantTarget: HOME.clone(), wantZoom: 1, frustumH: 31 };
  const bounds = { minX: -20, maxX: 22, minZ: -22, maxZ: 18, minZoom: 0.55, maxZoom: 4.2 };

  // ---- backdrop: soft vertical gradient on a camera-attached plane (always fills the view)
  const bgCanvas = document.createElement('canvas'); bgCanvas.width = 4; bgCanvas.height = 256;
  const bgTex = new THREE.CanvasTexture(bgCanvas); bgTex.colorSpace = THREE.SRGBColorSpace;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ map: bgTex, depthWrite: false, toneMapped: false }));
  backdrop.position.set(0, 0, -150); backdrop.renderOrder = -10; camera.add(backdrop);
  function paintBackdrop() { const g = bgCanvas.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, 256); grad.addColorStop(0, P().background[0]); grad.addColorStop(1, P().background[1]); g.fillStyle = grad; g.fillRect(0, 0, 4, 256); bgTex.needsUpdate = true; }

  // ---- lights: hemisphere + sun (shadows) + a cool rim light from behind (dark mode, so edges read)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.copy(SUN_POS); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 4, far: 70 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  const rimLight = new THREE.DirectionalLight(0x9fb6e0, 0); rimLight.position.set(-18, 9, -22); scene.add(rimLight);

  // ---- ground: an invisible shadow catcher over the backdrop + soft drop-shadow blobs under the platforms
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.16 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const blobCanvas = document.createElement('canvas'); blobCanvas.width = blobCanvas.height = 128;
  { const g = blobCanvas.getContext('2d'); g.filter = 'blur(14px)'; g.fillStyle = '#000'; g.beginPath(); g.roundRect(24, 24, 80, 80, 18); g.fill(); }
  const blobTex = new THREE.CanvasTexture(blobCanvas);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });

  // ---- materials (kept so the theme can recolour them)
  const M = {
    static: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.0 }),
    rim: new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    desk: std('#fff', { roughness: 0.55 }), deskLeg: std('#ddd'), chair: std('#ccc'), monitorFrame: std('#333', { roughness: 0.45 }),
    glass: new THREE.MeshStandardMaterial({ color: new THREE.Color('#dbe9ee'), transparent: true, opacity: 0.34, roughness: 0.15, metalness: 0.0, depthWrite: false }),
    pot: std('#c9b8a3'), leaf: std('#9fc49a', { roughness: 0.9, flatShading: true }), body: std('#fff', { roughness: 0.85 }), head: std('#e8d8c8', { roughness: 0.9 }),
    light: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    terminal: std('#eee', { roughness: 0.5 }), termScreen: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    crystal: new THREE.MeshStandardMaterial({ color: new THREE.Color('#bcd9fa'), emissive: new THREE.Color('#5f9fe6'), emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.05, flatShading: true }),
    coreRing: new THREE.MeshBasicMaterial({ color: new THREE.Color('#8fc0f2'), toneMapped: false }),
    select: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })
  };

  // ---- shared geometries (merged per object, then instanced)
  const G = {
    deskTop: rbox(2.1, 0.08, 0.95, 0.03),
    deskLegs: mergeGeometries([rbox(0.08, 0.72, 0.85, 0.02).translate(-0.98, 0, 0), rbox(0.08, 0.72, 0.85, 0.02).translate(0.98, 0, 0)]),
    monitor: mergeGeometries([rbox(0.46, 0.04, 0.26, 0.02).translate(0, 0.02, 0), rbox(0.12, 0.34, 0.1, 0.02).translate(0, 0.19, 0), rbox(1.3, 0.82, 0.05, 0.03).translate(0, 0.72, 0)].map((g) => (g.index ? g.toNonIndexed() : g))),
    screen: new THREE.PlaneGeometry(1.2, 0.73),
    chair: mergeGeometries([new THREE.CylinderGeometry(0.27, 0.27, 0.05, 14).translate(0, 0.03, 0), new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8).translate(0, 0.23, 0), rbox(0.52, 0.08, 0.52, 0.03).translate(0, 0.45, 0), rbox(0.52, 0.52, 0.07, 0.03).translate(0, 0.74, 0.25)].map((g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; })),
    body: new THREE.CapsuleGeometry(0.22, 0.42, 4, 10), head: new THREE.SphereGeometry(0.19, 14, 12), arm: rbox(0.1, 0.1, 0.42, 0.04),
    light: new THREE.SphereGeometry(0.075, 10, 8),
    divider: rbox(0.05, 1.05, 2.5, 0.02),
    pot: new THREE.CylinderGeometry(0.21, 0.16, 0.34, 10),
    leaves: mergeGeometries([0, 1, 2].map((i) => { const g = new THREE.IcosahedronGeometry(0.27, 0); g.rotateX(i); g.rotateY(i * 0.7); g.translate((i - 1) * 0.12, 0.5 + (i % 2) * 0.14, i === 1 ? -0.1 : 0.08); return g; })),
    terminal: rbox(0.95, 1.0, 0.62, 0.06), termScreen: new THREE.PlaneGeometry(0.76, 0.5), termLight: new THREE.SphereGeometry(0.1, 12, 10)
  };

  const world = new THREE.Group(); scene.add(world);
  const pickRoot = new THREE.Group();           // pick boxes: never rendered, raycast only
  const anchors = { depts: {}, deptCorners: {}, agents: {}, desks: {}, hub: new THREE.Vector3(0, 3.1, 0), services: {}, rack: new THREE.Vector3(RACK.x - RACK.w / 2 + 0.6, RACK.top, RACK.z - RACK.d / 2 + 0.6) };
  let layout = null, data = null, structureKey = null, selectedId = null;
  let staticMesh = null, rimMesh = null, blobMesh = null, inst = {}, screens = [], workers = [], lines = [], terminals = [], pickables = [];
  const dummy = new THREE.Object3D();

  // ---- the memory core (hub): crystal on a pedestal, accent ring, soft glow sprite that pulses on a new ledger row
  const hub = new THREE.Group(); world.add(hub);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 0).scale(1, 1.7, 1), M.crystal); crystal.position.y = 2.3; crystal.castShadow = true; hub.add(crystal);
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 8, 48), M.coreRing); coreRing.rotation.x = Math.PI / 2; coreRing.position.y = HUB_TOP + 0.01; hub.add(coreRing);
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128;
  { const g = glowCanvas.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas), color: new THREE.Color('#8fc0f2'), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.position.y = 2.1; glow.scale.set(4.2, 4.2, 1); hub.add(glow);
  const hubPick = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 3.2, 12)); hubPick.position.y = 1.6; pickRoot.add(hubPick);
  const selectRing = new THREE.Mesh(ringGeo(2.7, 2.7, 0.35, 0.07), M.select); selectRing.visible = false; world.add(selectRing);

  // ---- layout: department platform centres and sizes (our own design), order from the server
  function layoutDepartments(depts) {
    return depts.map((d, i) => {
      const n = d.agents.length, cols = Math.min(2, Math.max(1, n)), rows = Math.max(1, Math.ceil(n / cols));
      const [cx, cz] = SLOTS[i % SLOTS.length];
      return { ...d, cx, cz, w: cols * DESK_DX + 2.4, d: rows * DESK_DZ + 2.2, cols, rows };
    });
  }

  // ---- static geometry: every platform, walkway and plinth merged into one vertex-coloured mesh (rebuilt on theme change)
  function buildStatic() {
    const p = P(), parts = [], rims = [], blobs = [];
    const sd = new THREE.Vector2(-SUN_POS.x, -SUN_POS.z).normalize().multiplyScalar(0.45);
    const blob = (cx, cz, w, d) => blobs.push(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(cx + sd.x, 0.012, cz + sd.y));
    for (const d of layout.depts) {
      const accent = PALETTE.departments[d.key] || PALETTE.departments.default;
      parts.push(part(rbox(d.w, PT - 0.08, d.d, 0.26, 4), mix(p.platformEdge, accent, p.platformTint * 0.9), T(d.cx, (PT - 0.08) / 2, d.cz)));
      parts.push(part(rbox(d.w - 0.34, 0.14, d.d - 0.34, 0.16, 3), mix(p.platform, accent, p.platformTint), T(d.cx, PT - 0.07, d.cz)));
      rims.push(part(ringGeo(d.w - 0.34, d.d - 0.34, 0.16, 0.05), mix(p.rim, accent, 0.35), T(d.cx, PT + 0.004, d.cz)));
      blob(d.cx, d.cz, d.w + 2.4, d.d + 2.4);
      // walkway from the hub to the platform, a little lower and darker than the platforms
      const dir = new THREE.Vector3(d.cx, 0, d.cz), len = dir.length(); dir.normalize();
      const start = 2.7, inset = Math.min(d.w, d.d) / 2 * 0.85, wl = Math.max(1, len - start - inset);
      const mid = dir.clone().multiplyScalar(start + wl / 2);
      parts.push(part(rbox(wl + 0.8, 0.28, 1.5, 0.12, 2), p.walkway, T(mid.x, 0.14, mid.z, -Math.atan2(dir.z, dir.x))));
    }
    // services rack platform (neutral, no department tint)
    parts.push(part(rbox(RACK.w, RACK.top - 0.08, RACK.d, 0.22, 3), p.platformEdge, T(RACK.x, (RACK.top - 0.08) / 2, RACK.z)));
    parts.push(part(rbox(RACK.w - 0.3, 0.12, RACK.d - 0.3, 0.14, 3), p.platform, T(RACK.x, RACK.top - 0.06, RACK.z)));
    rims.push(part(ringGeo(RACK.w - 0.3, RACK.d - 0.3, 0.14, 0.05), p.rim, T(RACK.x, RACK.top + 0.004, RACK.z)));
    blob(RACK.x, RACK.z, RACK.w + 2, RACK.d + 2);
    // hub plinth: octagonal base, lighter top tier, hex pedestal
    parts.push(part(new THREE.CylinderGeometry(2.55, 2.75, 0.42, 8), p.plinthEdge, T(0, 0.21, 0, Math.PI / 8)));
    parts.push(part(new THREE.CylinderGeometry(2.2, 2.35, 0.16, 8), p.plinth, T(0, HUB_TOP - 0.08, 0, Math.PI / 8)));
    parts.push(part(new THREE.CylinderGeometry(0.62, 0.8, 0.55, 6), p.plinthEdge, T(0, HUB_TOP + 0.27, 0)));
    blob(0, 0, 7.4, 7.4);
    for (const m of [staticMesh, rimMesh, blobMesh]) if (m) { world.remove(m); m.geometry.dispose(); }
    staticMesh = new THREE.Mesh(mergeGeometries(parts), M.static); staticMesh.castShadow = staticMesh.receiveShadow = true; world.add(staticMesh);
    rimMesh = new THREE.Mesh(mergeGeometries(rims), M.rim); rimMesh.renderOrder = 1; world.add(rimMesh);
    blobMesh = new THREE.Mesh(mergeGeometries(blobs), blobMat); blobMesh.renderOrder = -1; world.add(blobMesh);
    for (const g of [...parts, ...rims, ...blobs]) g.dispose();
  }

  // ---- instanced furniture, people, plants, terminals (rebuilt when the structure changes)
  function makeInst(name, geo, material, count, { shadow = true, receive = false } = {}) {
    if (inst[name]) { world.remove(inst[name]); inst[name].dispose(); }
    const m = new THREE.InstancedMesh(geo, material, Math.max(1, count)); m.count = count; m.castShadow = shadow; m.receiveShadow = receive; m.frustumCulled = false; world.add(m); inst[name] = m; return m;
  }
  function setInst(m, i, x, y, z, ry = 0, rx = 0, s = 1) { dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }

  function buildFurniture(snap) {
    const desks = [], plants = [], dividers = [];
    pickables = []; while (pickRoot.children.length > 1) pickRoot.remove(pickRoot.children[pickRoot.children.length - 1]);
    pickables.push({ object: hubPick, kind: 'hub', id: 'hub' });
    anchors.depts = {}; anchors.deptCorners = {}; anchors.agents = {}; anchors.desks = {};
    for (const d of layout.depts) {
      const agents = d.agents.map((id) => snap.agents.find((a) => a.id === id)).filter(Boolean).sort((a, b) => (a.desk && b.desk ? (a.desk.y - b.desk.y) || (a.desk.x - b.desk.x) : 0));
      agents.forEach((a, i) => {
        const col = i % d.cols, row = Math.floor(i / d.cols);
        const x = d.cx + (col - (d.cols - 1) / 2) * DESK_DX, z = d.cz + (row - (d.rows - 1) / 2) * DESK_DZ - 0.3;
        desks.push({ a, x, z });
        if (col === 0 && d.cols > 1 && agents.length > i + 1) dividers.push([d.cx, z + 0.25]);
      });
      plants.push([d.cx - d.w / 2 + 0.6, PT, d.cz + d.d / 2 - 0.6], [d.cx + d.w / 2 - 0.6, PT, d.cz - d.d / 2 + 0.6]);
      anchors.depts[d.key] = new THREE.Vector3(d.cx, PT, d.cz);
      anchors.deptCorners[d.key] = new THREE.Vector3(d.cx - d.w / 2 + 0.7, PT, d.cz - d.d / 2 + 0.7);
      const pick = new THREE.Mesh(new THREE.BoxGeometry(d.w, PT, d.d)); pick.position.set(d.cx, PT / 2, d.cz); pickRoot.add(pick); pickables.push({ object: pick, kind: 'dept', id: d.key });
    }
    plants.push([-2.0, HUB_TOP, 1.6], [1.8, HUB_TOP, -1.8], [RACK.x + RACK.w / 2 - 0.45, RACK.top, RACK.z + 0.6]);
    const n = desks.length;
    const top = makeInst('deskTop', G.deskTop, M.desk, n, { receive: true }), legs = makeInst('deskLegs', G.deskLegs, M.deskLeg, n), mon = makeInst('monitor', G.monitor, M.monitorFrame, n), chair = makeInst('chair', G.chair, M.chair, n);
    const body = makeInst('body', G.body, M.body, n), head = makeInst('head', G.head, M.head, n), arms = makeInst('arms', G.arm, M.body, n * 2), light = makeInst('light', G.light, M.light, n, { shadow: false });
    const div = makeInst('divider', G.divider, M.glass, dividers.length, { shadow: false }), pot = makeInst('pot', G.pot, M.pot, plants.length), leaves = makeInst('leaves', G.leaves, M.leaf, plants.length);
    for (const s of screens) { world.remove(s.mesh); s.texMat.dispose(); s.glowMat.dispose(); s.tex.texture.dispose(); }
    screens = []; workers = [];
    desks.forEach(({ a, x, z }, i) => {
      setInst(top, i, x, PT + 0.76, z); setInst(legs, i, x, PT + 0.36, z); setInst(mon, i, x, PT + 0.8, z - 0.24, MON_YAW); setInst(chair, i, x, PT, z + 0.98);
      const tint = new THREE.Color(a.color || '#d8cfc4').lerp(new THREE.Color('#ffffff'), 0.35);
      body.setColorAt(i, tint); arms.setColorAt(i * 2, tint); arms.setColorAt(i * 2 + 1, tint);
      setInst(light, i, x + 0.9, PT + 0.87, z + 0.34);
      workers.push({ agentId: a.id, i, x, z, phase: (i * 1.7) % (Math.PI * 2), status: a.status });
      // the screen: its own mesh (own texture), glow material at overview, canvas text when zoomed in or selected
      const tex = makeMonitorTexture();
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      const texMat = new THREE.MeshBasicMaterial({ map: tex.texture, toneMapped: false });
      const mesh = new THREE.Mesh(G.screen, glowMat);
      const off = new THREE.Vector3(0, 0, 0.031).applyAxisAngle(new THREE.Vector3(0, 1, 0), MON_YAW);
      mesh.position.set(x + off.x, PT + 0.8 + 0.72, z - 0.24 + off.z); mesh.rotation.y = MON_YAW; world.add(mesh);
      screens.push({ agentId: a.id, mesh, tex, glowMat, texMat, textured: false });
      anchors.agents[a.id] = new THREE.Vector3(x, PT + 2.25, z - 0.2);
      anchors.desks[a.id] = { x, z, min: new THREE.Vector3(x - 1.15, PT, z - 0.65), max: new THREE.Vector3(x + 1.15, PT + 2.15, z + 1.4) };
      const pick = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.3, 2.7)); pick.position.set(x, PT + 1.1, z + 0.35); pickRoot.add(pick); pickables.push({ object: pick, kind: 'agent', id: a.id });
    });
    dividers.forEach(([x, z], i) => setInst(div, i, x, PT + 0.54, z));
    plants.forEach(([x, y, z], i) => { setInst(pot, i, x, y + 0.17, z); setInst(leaves, i, x, y, z, i * 1.3); });
    for (const m of [top, legs, mon, chair, light, div, pot, leaves, body, arms]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    poseWorkers(0);
    pickRoot.updateMatrixWorld(true);
  }

  function buildServices(services) {
    const n = services.length, body = makeInst('terminal', G.terminal, M.terminal, n), scr = makeInst('termScreen', G.termScreen, M.termScreen, n, { shadow: false }), lt = makeInst('termLight', G.termLight, M.light, n, { shadow: false });
    terminals = []; anchors.services = {};
    services.forEach((s, i) => {
      const x = RACK.x + (i - (n - 1) / 2) * 1.5, z = RACK.z - 0.1;
      setInst(body, i, x, RACK.top + 0.5, z); setInst(scr, i, x, RACK.top + 0.72, z + 0.33, 0, -14 * DEG); setInst(lt, i, x + 0.34, RACK.top + 1.1, z + 0.12);
      terminals.push({ id: s.id, i, x, z, status: s.status });
      anchors.services[s.id] = new THREE.Vector3(x, RACK.top + 1.25, z);
      const pick = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1)); pick.position.set(x, RACK.top + 0.7, z); pickRoot.add(pick); pickables.push({ object: pick, kind: 'service', id: s.id });
    });
    for (const m of [body, scr, lt]) m.instanceMatrix.needsUpdate = true;
    pickRoot.updateMatrixWorld(true);
  }
  function colourServices() {
    const p = P(), scr = inst.termScreen, lt = inst.termLight; if (!scr) return;
    for (const t of terminals) { scr.setColorAt(t.i, new THREE.Color(PALETTE.services[t.id] || '#9aa3ad').multiplyScalar(p.terminalScreen)); lt.setColorAt(t.i, new THREE.Color(PALETTE.serviceStatus[t.status] || PALETTE.serviceStatus.unknown)); }
    scr.instanceColor.needsUpdate = true; lt.instanceColor.needsUpdate = true;
  }

  // worker pose: seated, gentle idle bob, typing arms when working (instance matrices only; no geometry churn)
  function poseWorkers(t) {
    const body = inst.body, head = inst.head, arms = inst.arms; if (!body) return;
    for (const w of workers) {
      const s = w.status === 'working' ? 1 : 0, bx = w.x, by = PT + 0.48, bz = w.z + 0.85;
      const bob = animate ? Math.sin(t * 1.6 + w.phase) * 0.012 : 0;
      setInst(body, w.i, bx, by + 0.42 + bob, bz);
      setInst(head, w.i, bx, by + 0.98 + bob, bz, animate ? Math.sin(t * 0.5 + w.phase) * 0.12 : 0, animate ? Math.sin(t * 0.9 + w.phase) * 0.05 + s * Math.sin(t * 6 + w.phase) * 0.03 : 0);
      const lift = animate ? s * Math.abs(Math.sin(t * 7 + w.phase)) * 0.05 : 0, lift2 = animate ? s * Math.abs(Math.cos(t * 7 + w.phase)) * 0.05 : 0;
      setInst(arms, w.i * 2, bx - 0.2, by + 0.56 + lift + bob, bz - 0.15, 0, -0.25); setInst(arms, w.i * 2 + 1, bx + 0.2, by + 0.56 + lift2 + bob, bz - 0.15, 0, -0.25);
    }
    body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = arms.instanceMatrix.needsUpdate = true;
  }

  // activity lines: dashed arcs from a working desk to the services it is using on the rack
  function buildLines(agents) {
    for (const l of lines) { world.remove(l); l.geometry.dispose(); l.material.dispose(); } lines = [];
    for (const a of agents) {
      if (a.status !== 'working' || !a.services || !a.services.length) continue;
      const d = anchors.desks[a.id]; if (!d) continue;
      for (const sid of a.services) {
        const t = terminals.find((x) => x.id === sid); if (!t) continue;
        const start = new THREE.Vector3(d.x, PT + 1.95, d.z - 0.25), end = new THREE.Vector3(t.x, RACK.top + 1.2, t.z + 0.1);
        const mid = start.clone().lerp(end, 0.5); mid.y += 3;
        const geo = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(start, mid, end).getPoints(48));
        const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: new THREE.Color(PALETTE.services[sid] || '#888'), dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.95, toneMapped: false }));
        line.computeLineDistances(); world.add(line); lines.push(line);
      }
    }
  }

  // monitors: status-colour glow at overview zoom; canvas text when zoomed in or selected
  function updateScreens() {
    const p = P(), textual = view.zoom >= TEXT_ZOOM;
    for (const s of screens) {
      const a = data && data.agents.find((x) => x.id === s.agentId); if (!a) continue;
      const want = textual || s.agentId === selectedId;
      if (want) s.tex.draw(a, theme);
      const c = new THREE.Color(PALETTE.status[a.status] || PALETTE.status.idle);
      s.glowMat.color.copy(theme === 'dark' ? c : c.lerp(new THREE.Color('#ffffff'), 0.12));
      if (want !== s.textured) { s.mesh.material = want ? s.texMat : s.glowMat; s.textured = want; }
    }
    void p;
  }

  // ---- public: data in. Rebuild only when the structure (departments, desks, services) changes; otherwise update
  // statuses, screens and lines in place.
  let lastLedgerRows = null;
  function setData(snap) {
    data = snap;
    const key = JSON.stringify([snap.departments.map((d) => [d.key, d.agents]), snap.services.map((s) => s.id)]);
    if (key !== structureKey) {
      structureKey = key;
      layout = { depts: layoutDepartments(snap.departments) };
      buildStatic(); buildFurniture(snap); buildServices(snap.services);
      renderer.shadowMap.needsUpdate = true;
    }
    for (const w of workers) { const a = snap.agents.find((x) => x.id === w.agentId); if (a) { w.status = a.status; inst.light.setColorAt(w.i, new THREE.Color(PALETTE.status[a.status] || PALETTE.status.idle)); } }
    if (inst.light && inst.light.instanceColor) inst.light.instanceColor.needsUpdate = true;
    for (const t of terminals) { const s = snap.services.find((x) => x.id === t.id); if (s) t.status = s.status; }
    colourServices(); buildLines(snap.agents); updateScreens();
    const rows = snap.hub && snap.hub.ledger ? snap.hub.ledger.rows : null;
    if (lastLedgerRows != null && rows != null && rows > lastLedgerRows) pulseHub();
    lastLedgerRows = rows;
    applyTheme(false);
    invalidate(2);
  }

  function applyTheme(rebuild = true) {
    const p = P();
    if (rebuild && layout) buildStatic();
    M.desk.color.set(p.desk); M.deskLeg.color.set(p.deskLeg); M.chair.color.set(p.chair); M.monitorFrame.color.set(p.monitorFrame);
    M.glass.color.set(p.glass); M.glass.opacity = p.glassOpacity; M.pot.color.set(p.plantPot); M.leaf.color.set(p.plantLeaf); M.head.color.set(p.worker); M.terminal.color.set(p.terminal);
    M.rim.opacity = p.rimOpacity; if (rimMesh) rimMesh.visible = p.rimOpacity > 0;
    M.crystal.emissive.set(p.hubCore); M.coreRing.color.set(p.hubCore); glow.material.color.set(p.hubCore);
    groundMat.opacity = p.shadowOpacity; blobMat.opacity = p.blobOpacity;
    hemi.color.set(p.hemiSky); hemi.groundColor.set(p.hemiGround); hemi.intensity = p.hemiIntensity; sun.intensity = p.sunIntensity; sun.color.set(p.sunColour); rimLight.intensity = p.rimLight;
    renderer.toneMappingExposure = p.exposure;
    if (gtao) gtao.blendIntensity = p.aoBlend;
    colourServices(); updateScreens(); paintBackdrop(); setHubGlow(0);
    for (const s of screens) if (s.textured) { const a = data && data.agents.find((x) => x.id === s.agentId); if (a) s.tex.draw(a, theme); }
    renderer.shadowMap.needsUpdate = true; invalidate(2);
  }
  function setTheme(t) { theme = t; applyTheme(true); }

  // ---- hub pulse (a new ledger row): crystal and glow brighten briefly
  let pulseAt = -1;
  function pulseHub() { pulseAt = performance.now(); invalidate(1); }
  function setHubGlow(k) { const p = P(); glow.material.opacity = Math.min(1, p.hubGlow * (0.55 + 0.9 * k)); glow.scale.setScalar(4.2 + 1.6 * k); M.crystal.emissiveIntensity = (theme === 'dark' ? 0.9 : 0.55) + 1.4 * k; }

  // ---- selection
  function setSelected(id) {
    selectedId = id || null;
    const d = selectedId && anchors.desks[selectedId];
    selectRing.visible = !!d; if (d) { selectRing.position.set(d.x, PT + 0.006, d.z + 0.4); M.select.color.set(theme === 'dark' ? '#f4f7ff' : '#2b2a28'); M.select.opacity = theme === 'dark' ? 0.75 : 0.55; }
    updateScreens(); invalidate(1);
  }

  // ---- post-processing: MSAA target + half-resolution GTAO + output (ACES + sRGB)
  const size = new THREE.Vector2();
  let composer = null, gtao = null;
  function setupComposer(w, h) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, rt);
    const samples = options.msaa === false ? 0 : (options.msaaSamples || 4);
    composer.addPass(samples ? new MSAARenderPass(scene, camera, samples) : new RenderPass(scene, camera));
    if (options.ao !== false) {
      try {
        gtao = new HalfResGTAOPass(scene, camera, Math.round(w / 2), Math.round(h / 2));
        gtao.output = GTAOPass.OUTPUT.Default;
        const aq = options.aoQuality || { samples: 8, pdSamples: 8, rings: 2 };
        gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1, thickness: 1, scale: 1, samples: aq.samples, distanceFallOff: 1, screenSpaceRadius: false });
        gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: aq.rings, samples: aq.pdSamples });
        gtao.blendIntensity = P().aoBlend;
        gtao.hideDuringAO = () => [glow, blobMesh, rimMesh, selectRing, ...lines];
        composer.addPass(gtao);
      } catch (e) { console.warn('GTAO unavailable, continuing without AO', e); gtao = null; }
    }
    composer.addPass(new OutputPass());
  }

  function resize() {
    const w = canvas.clientWidth || 800, h = canvas.clientHeight || 500;
    renderer.setSize(w, h, false);
    const aspect = w / h, fh = view.frustumH;
    camera.left = -fh * aspect / 2; camera.right = fh * aspect / 2; camera.top = fh / 2; camera.bottom = -fh / 2; camera.updateProjectionMatrix();
    if (!composer) setupComposer(w, h); else composer.setSize(w, h);
    size.set(w, h); cameraDirty = true; invalidate(1);
  }

  // ---- camera: true isometric angle, smooth zoom/pan clamped to the office bounds
  const camDir = new THREE.Vector3(Math.cos(PITCH) * Math.sin(YAW), Math.sin(PITCH), Math.cos(PITCH) * Math.cos(YAW));
  let cameraDirty = true;
  function updateCamera(dt) {
    const k = 1 - Math.pow(0.0005, dt);
    const dist = view.target.distanceTo(view.wantTarget), dz = Math.abs(view.wantZoom - view.zoom);
    if (dist < 1e-4 && dz < 1e-5 && !cameraDirty) return false;
    if (dist < 0.002 && dz < 0.0005) { view.target.copy(view.wantTarget); view.zoom = view.wantZoom; } else { view.target.lerp(view.wantTarget, k); view.zoom += (view.wantZoom - view.zoom) * k; }
    camera.position.copy(view.target).addScaledVector(camDir, 80); camera.lookAt(view.target); camera.zoom = view.zoom; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    cameraDirty = false; return true;
  }
  const clampTarget = () => { view.wantTarget.x = THREE.MathUtils.clamp(view.wantTarget.x, bounds.minX, bounds.maxX); view.wantTarget.z = THREE.MathUtils.clamp(view.wantTarget.z, bounds.minZ, bounds.maxZ); view.wantZoom = THREE.MathUtils.clamp(view.wantZoom, bounds.minZoom, bounds.maxZoom); };
  const right = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW)), up = new THREE.Vector3(-Math.sin(YAW), 0, -Math.cos(YAW));
  const unitsPerPx = (zoom = view.wantZoom) => view.frustumH / (size.y || 1) / zoom;
  function pan(dxPx, dyPx) { const u = unitsPerPx(); view.wantTarget.addScaledVector(right, -dxPx * u).addScaledVector(up, dyPx * u / Math.sin(PITCH)); clampTarget(); invalidate(1); }
  function zoomBy(f, anchorPx) { const before = anchorPx ? screenToGround(anchorPx.x, anchorPx.y) : null; view.wantZoom *= f; clampTarget(); if (before) { view.zoom = view.wantZoom; cameraDirty = true; updateCamera(0); const after = screenToGround(anchorPx.x, anchorPx.y); if (after) { view.wantTarget.add(before.sub(after)); view.target.copy(view.wantTarget); clampTarget(); cameraDirty = true; } } invalidate(1); }
  function resetView() { view.wantTarget.copy(HOME); view.wantZoom = 1; invalidate(1); }
  // Put a ground point at a given screen position (px from the canvas's top-left) at the given zoom.
  function focus(worldPos, zoom = 1.6, screenPx = null) {
    view.wantZoom = THREE.MathUtils.clamp(zoom, bounds.minZoom, bounds.maxZoom);
    const t = new THREE.Vector3(worldPos.x, 0, worldPos.z);
    if (screenPx) { const u = unitsPerPx(view.wantZoom), ox = screenPx.x - size.x / 2, oy = screenPx.y - size.y / 2; t.addScaledVector(right, -ox * u).addScaledVector(up, oy * u / Math.sin(PITCH)); }
    view.wantTarget.copy(t); clampTarget(); invalidate(1);
  }
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster();
  function screenToGround(px, py) { const ndc = new THREE.Vector2((px / size.x) * 2 - 1, -(py / size.y) * 2 + 1); ray.setFromCamera(ndc, camera); const out = new THREE.Vector3(); return ray.ray.intersectPlane(groundPlane, out) ? out : null; }
  function pick(px, py) { const ndc = new THREE.Vector2((px / size.x) * 2 - 1, -(py / size.y) * 2 + 1); ray.setFromCamera(ndc, camera); const hits = ray.intersectObjects(pickables.map((p) => p.object), false); if (!hits.length) return null; const order = { agent: 0, service: 1, hub: 2, dept: 3 }; hits.sort((a, b) => order[pickables.find((p) => p.object === a.object).kind] - order[pickables.find((p) => p.object === b.object).kind] || a.distance - b.distance); const p = pickables.find((q) => q.object === hits[0].object); return p ? { kind: p.kind, id: p.id } : null; }
  const _v = new THREE.Vector3();
  function project(v) { _v.copy(v).project(camera); return { x: (_v.x + 1) / 2 * size.x, y: (1 - _v.y) / 2 * size.y, visible: _v.z < 1 && _v.z > -1 }; }
  // screen-space rectangles of every desk cluster (obstacles for the label layout)
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  function boxRect(min, max) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, k = 0;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) { const p = project(corners[k++].set(x, y, z)); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    return { x0, y0, x1, y1 };
  }
  function obstacles() {
    const out = Object.entries(anchors.desks).map(([id, d]) => ({ kind: 'desk', id, ...boxRect(d.min, d.max) }));
    out.push({ kind: 'hub', ...boxRect(new THREE.Vector3(-1, HUB_TOP, -1), new THREE.Vector3(1, 3.1, 1)) });
    if (terminals.length) out.push({ kind: 'rack', ...boxRect(new THREE.Vector3(RACK.x - RACK.w / 2 + 0.3, RACK.top, RACK.z - 0.5), new THREE.Vector3(RACK.x + RACK.w / 2 - 0.3, RACK.top + 1.25, RACK.z + 0.5)) });
    return out;
  }

  // ---- pointer: drag to pan, click to pick, wheel to zoom
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; if (drag.moved) { pan(dx, dy); drag.x = e.clientX; drag.y = e.clientY; } });
  canvas.addEventListener('pointerup', (e) => { if (drag && !drag.moved) { const r = canvas.getBoundingClientRect(); onPick(pick(e.clientX - r.left, e.clientY - r.top)); } drag = null; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); const r = canvas.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, { x: e.clientX - r.left, y: e.clientY - r.top }); }, { passive: false });

  // ---- render on demand
  let dirty = 2, animate = options.animate !== false, lastAnim = 0, lastTextual = null, benchUntil = 0, benchMove = null, paused = false, aoFadeAt = -1;
  function invalidate(n = 1) { dirty = Math.max(dirty, n); }
  const stats = { renders: [], cpu: [], intervals: [], lastRenderAt: 0, calls: 0, tris: 0, mode: 'idle' };
  let lastTick = performance.now();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { lastTick = performance.now(); invalidate(1); } });
  // returns { rendered, cameraChanged } so the caller can re-layout the labels only when needed
  function tick() {
    const now = performance.now(), dt = Math.min(0.05, (now - lastTick) / 1000), t = now / 1000; lastTick = now;
    if (paused) return { rendered: false, cameraChanged: false };
    if (benchMove) { const a = (now - benchMove.t0) / 1000 * 1.5; view.wantTarget.set(benchMove.x + Math.cos(a) * 0.8, 0, benchMove.z + Math.sin(a) * 0.8); }
    const cameraChanged = updateCamera(dt);
    if (cameraChanged) { dirty = Math.max(dirty, 1); stats.mode = 'moving'; }
    const textual = view.zoom >= TEXT_ZOOM; if (textual !== lastTextual) { lastTextual = textual; updateScreens(); dirty = Math.max(dirty, 1); }
    if (animate && !document.hidden && now - lastAnim >= 1000 / ANIM_HZ) {
      lastAnim = now; poseWorkers(t);
      for (const l of lines) l.material.dashOffset = -t * 1.2;
      for (const w of workers) if (w.status === 'error' || w.status === 'waiting') { inst.light.setColorAt(w.i, new THREE.Color(PALETTE.status[w.status]).multiplyScalar(w.status === 'error' ? 0.55 + 0.45 * Math.abs(Math.sin(t * 3)) : 0.7 + 0.3 * Math.sin(t * 2))); inst.light.instanceColor.needsUpdate = true; }
      crystal.rotation.y = t * 0.25;
      dirty = Math.max(dirty, 1); if (!cameraChanged) stats.mode = 'animating';
    }
    if (pulseAt >= 0) { const k = (now - pulseAt) / 1600; if (k >= 1) { pulseAt = -1; setHubGlow(0); } else setHubGlow(Math.sin(Math.PI * k)); dirty = Math.max(dirty, 1); }
    if (now < benchUntil) dirty = Math.max(dirty, 1);
    // AO is skipped while the camera moves (the frame budget goes to smooth motion) and fades back in once it settles
    if (gtao) {
      if (cameraChanged) { if (gtao.enabled) { gtao.enabled = false; aoFadeAt = -1; } }
      else if (!gtao.enabled) { gtao.enabled = true; aoFadeAt = now; dirty = Math.max(dirty, 1); }
      if (aoFadeAt >= 0) { const k = Math.min(1, (now - aoFadeAt) / 220); gtao.blendIntensity = P().aoBlend * k; if (k < 1) dirty = Math.max(dirty, 1); else aoFadeAt = -1; }
    }
    if (dirty <= 0) { if (!animate && !cameraChanged) stats.mode = 'idle'; return { rendered: false, cameraChanged }; }
    dirty--;
    renderer.info.reset();
    const c0 = performance.now(); composer.render(); const c1 = performance.now();
    if (renderer.shadowMap.needsUpdate) renderer.shadowMap.needsUpdate = false;
    stats.calls = renderer.info.render.calls; stats.tris = renderer.info.render.triangles;
    if (stats.lastRenderAt) stats.intervals.push(c0 - stats.lastRenderAt);
    stats.lastRenderAt = c0; stats.renders.push(c0); stats.cpu.push(c1 - c0); if (stats.onRender) stats.onRender(c0, c1 - c0);
    while (stats.renders.length && c0 - stats.renders[0] > 1000) stats.renders.shift();
    if (stats.cpu.length > 120) stats.cpu.shift(); if (stats.intervals.length > 120) stats.intervals.shift();
    return { rendered: true, cameraChanged };
  }
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  function getStats() { return { fps: stats.renders.length, cpuMs: +avg(stats.cpu.slice(-30)).toFixed(2), frameMs: +avg(stats.intervals.slice(-30)).toFixed(2), calls: stats.calls, tris: stats.tris, mode: stats.mode, dpr: renderer.getPixelRatio(), ao: gtao ? (gtao.enabled ? 'half-res' : 'skipped while moving') : 'off', textual: view.zoom >= TEXT_ZOOM }; }
  // continuous rendering for `ms` (as if the camera were moving every frame): average fps and frame times
  // (the page's own loop keeps calling tick(); while benchUntil is in the future every tick renders)
  // move: true orbits the target a little every frame (the real camera-motion path: AO off while moving)
  function bench(ms = 3000, { move = false } = {}) {
    if (paused) {   // scene paused behind an overlay: report the page's own frame rate (DOM only, no 3D frames)
      return new Promise((resolve) => { const t0 = performance.now(), times = []; let last = t0; const f = (now) => { times.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(f); else resolve({ move: false, paused: true, frames: times.length, seconds: +((now - t0) / 1000).toFixed(2), fps: +(times.length / ((now - t0) / 1000)).toFixed(1), avgFrameMs: +avg(times).toFixed(2), p95FrameMs: +([...times].sort((a, b) => a - b)[Math.floor(times.length * 0.95)] || 0).toFixed(2), avgCpuMs: 0, calls: 0, tris: 0, dpr: renderer.getPixelRatio() }); }; requestAnimationFrame(f); });
    }
    return new Promise((resolve) => {
      const t0 = performance.now(), times = [], cpu = []; let last = 0;
      const home = view.wantTarget.clone();
      benchUntil = t0 + ms; if (move) benchMove = { t0, x: home.x, z: home.z };
      stats.onRender = (at, cpuMs) => { if (last) times.push(at - last); last = at; cpu.push(cpuMs); };
      setTimeout(() => {
        stats.onRender = null; benchUntil = 0; if (benchMove) { benchMove = null; view.wantTarget.copy(home); invalidate(1); }
        const secs = (performance.now() - t0) / 1000, sorted = [...times].sort((a, b) => a - b);
        resolve({ move, frames: times.length + 1, seconds: +secs.toFixed(2), fps: +((times.length + 1) / secs).toFixed(1), avgFrameMs: +avg(times).toFixed(2), p95FrameMs: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(2), avgCpuMs: +avg(cpu).toFixed(2), calls: stats.calls, tris: stats.tris, dpr: renderer.getPixelRatio() });
      }, ms + 20);
    });
  }
  function setAnimate(v) { animate = v; invalidate(1); }
  // nothing renders while an overlay covers the stage (board, calendar, ledger)
  function setPaused(v) { paused = !!v; if (!paused) { cameraDirty = true; invalidate(1); } }

  resize(); updateCamera(0); paintBackdrop();
  return { renderer, scene, camera, setData, setTheme, resize, tick, invalidate, pan, zoomBy, resetView, focus, project, obstacles, setSelected, pulseHub, anchors, getStats, bench, setAnimate, setPaused, get view() { return view; }, get selected() { return selectedId; }, get size() { return size; } };
}
