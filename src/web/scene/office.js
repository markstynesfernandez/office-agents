// scene/office.js — the isometric office (Redesign R1). One floor slab, seen as a dollhouse cutaway: three department
// rooms (Research library, Design studio, Office desk floor) and a lounge round a central atrium with the memory core,
// plus a small server closet. Floor plan and walking paths: layout.js; static rooms: rooms.js; textures: textures.js.
// Everything is procedural Three.js geometry and canvas textures (no model or image files). Data comes in through
// setData(snapshot); the public API (anchors, obstacles, project, focus, ...) is unchanged, so the cards, desk labels,
// leader lines and their collision avoidance work as before.
// Idle agents walk to a lounge seat and sit; any other status walks them back to their desk (precomputed paths,
// tweened along the polyline; no physics, no pathfinding).
// Performance: render on demand only (camera move, data change, animation tick, walking), idle animation at a low tick
// and paused while the tab is hidden, devicePixelRatio capped at 1.5, GTAO at half resolution (skipped while the camera
// moves), shadows baked (the shadow map is drawn only when the static scene changes; people cast no shadow, they get a
// soft blob instead), repeated furniture instanced, static geometry merged per room.
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
import { computeLayout, pointAt, pathLength, FLOOR, WALL_H, CORE_R } from './layout.js';
import { buildRooms } from './rooms.js';
import { woodTexture, tileTexture, glowTexture, atlasTexture, GLOW_UV } from './textures.js';

const DEG = Math.PI / 180;
const PITCH = 35 * DEG, YAW = 45 * DEG;
const PT = FLOOR + 0.02;               // top of the wood floors
const MON_YAW = 20 * DEG;              // monitors angled a little towards the viewer
export const TEXT_ZOOM = 1.8;          // monitors show their canvas text from this zoom (or when the desk is selected)
const ANIM_HZ = 12;                    // ambient animation tick (idle bob, typing, dashed lines, crystal)
const WALK_SPEED = 2.9;                // world units per second
const SUN_POS = new THREE.Vector3(22, 17, 11);  // R2: lower and more to the front than R1 (20, 30, 3): longer, clearer shadows
const CORE_Y = FLOOR + 2.2;            // memory core crystal centre (R2: smaller core)

const rbox = (w, h, d, r = 0.08, seg = 1) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2));   // one bevel segment: furniture is small on screen
const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.82, metalness: 0.02, ...opts });
const clean = (g) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; };
const merge = (list) => mergeGeometries(list.map(clean));
function roundedRectShape(w, h, r) { const s = new THREE.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; }
function ringGeo(w, h, r, t) { const s = roundedRectShape(w, h, r); s.holes.push(roundedRectShape(w - 2 * t, h - 2 * t, Math.max(0.01, r - t))); const g = new THREE.ShapeGeometry(s, 6); g.rotateX(-Math.PI / 2); return g; }
// people's looks (R2): skin tones, hair colours and trousers, picked per agent from its id; the shirt is the agent's colour
const SKIN = ['#f3d5bf', '#e8bf9c', '#d29e78', '#b07a55', '#8c5a3c', '#6a432d'];
const HAIR = ['#2a2420', '#4b3426', '#6e4a2f', '#a57a4c', '#d3b07c', '#1d1d21', '#8f8a84', '#7c3b22'];
const TROUSERS = ['#3a3f4b', '#4c4f57', '#2e3440', '#5a5248', '#3f4a42', '#6b6f78'];
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const angLerp = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

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
// Overlays (glows, blob shadows, selection ring, activity lines) are hidden during its normal/depth pre-pass so they
// cannot create AO halos; they are already in the frame from the main render pass.
// The AO is multiplied straight onto the frame in the read buffer (no swap), which saves the full-screen copy GTAOPass's
// default output makes first (~1 ms a frame on the iGPU).
// R2: the AO is cached. Everything that moves or changes on its own (people, screens, glows, lines, the crystal) is left
// out of the pre-pass, so the AO depends only on the static scene and the camera: it is computed again only when the
// camera has moved, the canvas is resized or the static scene or theme changes (aoDirty), and every other frame (idle
// animation, people walking) only multiplies the cached AO onto the frame.
class HalfResGTAOPass extends GTAOPass {
  constructor(...a) { super(...a); this.needsSwap = false; this.aoDirty = true; this.aoRuns = 0; }
  setSize(w, h) { super.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2))); this.aoDirty = true; }
  render(renderer, writeBuffer, readBuffer, dt, mask) {
    if (this.aoDirty) {
      const hidden = (this.hideDuringAO ? this.hideDuringAO() : []).filter((o) => o && o.visible);
      for (const o of hidden) o.visible = false;
      const output = this.output; this.output = GTAOPass.OUTPUT.Off;          // AO + denoise only
      try { super.render(renderer, writeBuffer, readBuffer, dt, mask); this.aoDirty = false; this.aoRuns++; } finally { this.output = output; for (const o of hidden) o.visible = true; }
    }
    this.blendMaterial.uniforms.intensity.value = this.blendIntensity;
    this.blendMaterial.uniforms.tDiffuse.value = this.pdRenderTarget.texture;
    this._renderPass(renderer, this.blendMaterial, readBuffer);
  }
}

export function createOffice({ canvas, theme = 'light', onPick = () => {}, options = {} }) {
  const P = () => PALETTE[theme];
  // the canvas is transparent where nothing is drawn: the backdrop gradient is the canvas's CSS background, so the
  // browser composites it (premultiplied alpha) instead of the GPU filling a full-screen plane in the MSAA target
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;      // soft edges via shadow.radius
  renderer.shadowMap.autoUpdate = false;             // baked: refreshed only when the static scene changes
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 400);
  scene.add(camera);
  const HOME = new THREE.Vector3(-1.6, 0, -0.6);
  const view = { target: HOME.clone(), zoom: 1, wantTarget: HOME.clone(), wantZoom: 1, frustumH: 25.5, ease: 0.0005 };   // ease: fraction left after 1 s (the presenter tour uses a gentler one)
  const bounds = { minX: -22, maxX: 20, minZ: -16, maxZ: 18, minZoom: 0.55, maxZoom: 4.2 };

  // ---- backdrop: a soft vertical gradient behind the transparent canvas (CSS)
  function paintBackdrop() { canvas.style.background = 'linear-gradient(' + P().background[0] + ', ' + P().background[1] + ')'; }

  // ---- lights: hemisphere + one sun from the right-hand side (soft daylight, baked shadows)
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.copy(SUN_POS); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 4, far: 80 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.025; sun.shadow.radius = 6;   // R2: softer edges (same tap count)
  scene.add(sun); scene.add(sun.target);

  // ---- ground: a soft drop shadow under the slab, thrown away from the sun (a full-screen shadow catcher cost ~2 ms a
  // frame on the iGPU); people get small round blobs (they cast no shadow into the baked map)
  const dropCanvas = document.createElement('canvas'); dropCanvas.width = dropCanvas.height = 128;
  { const g = dropCanvas.getContext('2d'); g.filter = 'blur(10px)'; g.fillStyle = '#000'; g.beginPath(); g.roundRect(18, 18, 92, 92, 6); g.fill(); }
  const dropMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(dropCanvas), color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const drop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), dropMat); drop.renderOrder = -1; scene.add(drop);
  const blobCanvas = document.createElement('canvas'); blobCanvas.width = blobCanvas.height = 64;
  { const g = blobCanvas.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.5, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }
  const blobMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobCanvas), color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });

  // ---- textures and materials (kept so the theme can recolour them)
  const TX = { wood: woodTexture(), tile: tileTexture(), glow: glowTexture(), atlas: atlasTexture() };
  const M = {
    static: std('#fff', { vertexColors: true, roughness: 0.86, metalness: 0 }),
    wood: std('#fff', { map: TX.wood, roughness: 0.62, metalness: 0 }),
    tile: std('#fff', { map: TX.tile, roughness: 0.34, metalness: 0 }),   // polished concrete (R2)
    decal: std('#fff', { map: TX.atlas, roughness: 0.92, metalness: 0 }),
    emissive: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    glow: new THREE.MeshBasicMaterial({ map: TX.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    glowInst: new THREE.MeshBasicMaterial({ map: TX.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    deskTop: std('#ddb', { roughness: 0.6 }), deskMetal: std('#222', { roughness: 0.5, metalness: 0.3 }), chair: std('#444', { roughness: 0.7 }), monitorFrame: std('#333', { roughness: 0.45 }), keyboard: std('#ddd', { roughness: 0.6 }),
    potTall: std('#c9b8a3'), potSmall: std('#c9b8a3'), leafTall: std('#9fc49a', { roughness: 0.9, flatShading: true }), leafSmall: std('#9fc49a', { roughness: 0.9, flatShading: true }),
    shirt: std('#fff', { roughness: 0.85 }), skin: std('#fff', { roughness: 0.8 }), hair: std('#fff', { roughness: 0.75 }), trousers: std('#fff', { roughness: 0.85 }), shoe: std('#2a2a2e', { roughness: 0.6 }),
    light: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    terminal: std('#eee', { roughness: 0.5, metalness: 0.15 }), termScreen: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    crystal: new THREE.MeshStandardMaterial({ color: new THREE.Color('#bcd9fa'), emissive: new THREE.Color('#5f9fe6'), emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.05, flatShading: true }),
    coreRing: new THREE.MeshBasicMaterial({ color: new THREE.Color('#8fc0f2'), toneMapped: false }),
    select: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })
  };
  const poolGeo = (() => { const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); const [u0, v0, u1, v1] = GLOW_UV.pool, uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); return g; })();

  // ---- people (R2): simple stylised low-poly figures, one instanced mesh per body part. Each part's origin is its
  // upper joint (hip, knee, shoulder, elbow, wrist, ankle; the waist for the torso, the neck for the head and hair), so a
  // pose is a set of joint angles (see poseWorkers). The figure faces local -z. Shirt, skin, hair and trousers colours
  // are per instance.
  const PERSON = (() => {
    const sph = (r, ws, hs, ...a) => new THREE.SphereGeometry(r, ws, hs, ...a);
    const head = merge([new THREE.CylinderGeometry(0.052, 0.06, 0.12, 8).translate(0, 0.05, 0), sph(0.148, 10, 8).scale(0.95, 1.1, 1).translate(0, 0.24, 0), rbox(0.04, 0.055, 0.04, 0.015).translate(0, 0.22, -0.145), sph(0.03, 6, 4).scale(0.6, 1, 1).translate(-0.142, 0.235, 0), sph(0.03, 6, 4).scale(0.6, 1, 1).translate(0.142, 0.235, 0)]);
    const cap = (k = 1) => sph(0.162 * k, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(0.97, 1.08, 1.02).rotateX(-0.28).translate(0, 0.25, 0.02);
    const FRONT = Math.PI * 1.5, CUT = 0.95;   // the face (local -z) is left open in the longer styles
    const hair = [
      merge([cap()]),                                                                                             // short crop
      merge([cap(1.04), sph(0.17, 12, 8, FRONT + CUT, Math.PI * 2 - 2 * CUT, Math.PI * 0.32, Math.PI * 0.42).scale(0.98, 1.12, 1.03).translate(0, 0.25, 0.01)]),   // bob
      merge([cap(), sph(0.075, 8, 6).translate(0, 0.36, 0.12)]),                                                  // bun
      merge([cap(0.98), ...Array.from({ length: 9 }, (_, i) => new THREE.IcosahedronGeometry(0.055, 0).translate(Math.cos(i * 2.4) * 0.1, 0.36 + (i % 3) * 0.015, Math.sin(i * 2.4) * 0.1 + 0.02))])   // curls
    ];
    return {
      // limbs are six-sided prisms and plain boxes (low-poly on purpose: about 900 triangles a person)
      pelvis: rbox(0.34, 0.17, 0.22, 0.07),
      torso: merge([rbox(0.34, 0.3, 0.21, 0.08).translate(0, 0.15, 0), rbox(0.42, 0.24, 0.24, 0.1).translate(0, 0.37, 0)]),
      head, hair,
      upperArm: new THREE.CylinderGeometry(0.056, 0.05, 0.31, 6).translate(0, -0.14, 0),
      forearm: new THREE.CylinderGeometry(0.046, 0.04, 0.27, 6).translate(0, -0.13, 0),
      hand: new THREE.BoxGeometry(0.07, 0.1, 0.05).translate(0, -0.05, 0),
      thigh: new THREE.CylinderGeometry(0.085, 0.07, 0.44, 6).translate(0, -0.2, 0),
      shin: new THREE.CylinderGeometry(0.065, 0.055, 0.43, 6).translate(0, -0.21, 0),
      shoe: new THREE.BoxGeometry(0.12, 0.08, 0.25).translate(0, -0.04, -0.06)
    };
  })();
  // ---- shared geometries (merged per object, then instanced)
  const leg = (x, z) => rbox(0.05, 0.72, 0.05, 0.015).translate(x, 0.36, z);
  const G = {
    deskTop: rbox(2.1, 0.06, 0.95, 0.025),
    deskReturn: rbox(0.6, 0.06, 0.95, 0.025),
    deskFrame: merge([leg(-0.98, -0.38), leg(-0.98, 0.38), leg(0.98, -0.38), leg(0.98, 0.38), rbox(0.05, 0.04, 0.86, 0.015).translate(-0.98, 0.02, 0), rbox(0.05, 0.04, 0.86, 0.015).translate(0.98, 0.02, 0), rbox(1.9, 0.05, 0.04, 0.015).translate(0, 0.68, -0.38)]),
    returnFrame: merge([leg(-0.22, 0), leg(0.22, 0), rbox(0.5, 0.04, 0.05, 0.015).translate(0, 0.02, 0)]),
    monitor: merge([rbox(0.46, 0.04, 0.26, 0.02).translate(0, 0.02, 0), rbox(0.12, 0.34, 0.1, 0.02).translate(0, 0.19, 0), rbox(1.3, 0.82, 0.05, 0.03).translate(0, 0.72, 0)]),
    screen: new THREE.PlaneGeometry(1.2, 0.73),
    keyboard: merge([rbox(0.56, 0.025, 0.18, 0.01), rbox(0.08, 0.025, 0.12, 0.01).translate(0.42, 0, 0.02)]),
    lamp: merge([new THREE.CylinderGeometry(0.09, 0.1, 0.025, 14).translate(0, 0.012, 0), new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6).rotateX(0.35).translate(0, 0.21, 0.07), new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6).rotateX(-1.0).translate(0, 0.46, 0.0), new THREE.ConeGeometry(0.085, 0.14, 14, 1, true).rotateX(0.5).translate(0, 0.5, -0.17)]),
    bulb: new THREE.SphereGeometry(0.035, 8, 6),
    chair: merge([...[0, 1, 2, 3, 4].map((i) => new THREE.BoxGeometry(0.05, 0.035, 0.3).translate(0, 0.04, 0.15).rotateY((i * Math.PI * 2) / 5)), new THREE.CylinderGeometry(0.035, 0.035, 0.36, 8).translate(0, 0.24, 0), rbox(0.52, 0.08, 0.5, 0.035).translate(0, 0.45, 0), rbox(0.5, 0.62, 0.07, 0.035).translate(0, 0.86, 0.25), rbox(0.05, 0.05, 0.3, 0.02).translate(-0.27, 0.64, 0.02), rbox(0.05, 0.05, 0.3, 0.02).translate(0.27, 0.64, 0.02), new THREE.BoxGeometry(0.04, 0.17, 0.04).translate(-0.27, 0.55, 0.06), new THREE.BoxGeometry(0.04, 0.17, 0.04).translate(0.27, 0.55, 0.06)]),
    ...PERSON,
    light: new THREE.SphereGeometry(0.075, 10, 8),
    potTall: new THREE.CylinderGeometry(0.27, 0.21, 0.5, 14), potSmall: new THREE.CylinderGeometry(0.19, 0.15, 0.32, 12),
    leavesTall: merge([new THREE.CylinderGeometry(0.025, 0.03, 1.0, 6).translate(0, 0.75, 0), ...[0, 1, 2, 3, 4, 5, 6].map((i) => { const g = new THREE.IcosahedronGeometry(0.26 + (i % 3) * 0.04, 0); g.scale(1, 0.7, 1.25); g.rotateY(i * 1.9); const a = i * 2.4, rr = 0.18 + (i % 2) * 0.12; return g.translate(Math.cos(a) * rr, 0.75 + i * 0.13, Math.sin(a) * rr); })]),
    leavesSmall: merge([0, 1, 2].map((i) => { const g = new THREE.IcosahedronGeometry(0.25, 0); g.rotateX(i); g.rotateY(i * 0.7); return g.translate((i - 1) * 0.11, 0.42 + (i % 2) * 0.13, i === 1 ? -0.09 : 0.07); })),
    blob: new THREE.PlaneGeometry(0.95, 0.95).rotateX(-Math.PI / 2),
    terminal: merge([rbox(0.74, 2.0, 0.8, 0.04).translate(0, 1.0, 0), rbox(0.66, 1.2, 0.02, 0.01).translate(0, 0.95, 0.41)]),
    termScreen: new THREE.PlaneGeometry(0.5, 0.16), termLight: new THREE.SphereGeometry(0.07, 12, 10)
  };

  const world = new THREE.Group(); scene.add(world);
  const pickRoot = new THREE.Group();           // pick boxes: never rendered, raycast only
  const anchors = { depts: {}, deptCorners: {}, agents: {}, desks: {}, hub: new THREE.Vector3(0, CORE_Y + 1.15, 0), services: {}, rack: new THREE.Vector3(), lounge: new THREE.Vector3() };
  let L = null, data = null, structureKey = null, selectedId = null;
  let statics = [], inst = {}, screens = [], workers = [], lines = [], terminals = [], pickables = [];
  const dummy = new THREE.Object3D();

  // ---- the memory core: crystal on its pedestal, accent ring, soft glow sprite that pulses on a new ledger row
  const hub = new THREE.Group(); world.add(hub);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.56, 0).scale(1, 1.7, 1), M.crystal); crystal.position.y = CORE_Y; crystal.castShadow = true; hub.add(crystal);
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.045, 8, 48), M.coreRing); coreRing.rotation.x = Math.PI / 2; coreRing.position.y = FLOOR + 0.45; hub.add(coreRing);
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 128;
  { const g = glowCanvas.getContext('2d'); const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCanvas), color: new THREE.Color('#8fc0f2'), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.position.y = CORE_Y - 0.1; glow.scale.set(2.4, 2.4, 1); hub.add(glow);   // R2: about half the R1 size
  const hubPick = new THREE.Mesh(new THREE.CylinderGeometry(CORE_R, CORE_R, 3.6, 12)); hubPick.position.y = FLOOR + 1.8; pickRoot.add(hubPick);
  const selectRing = new THREE.Mesh(ringGeo(2.7, 2.7, 0.35, 0.07), M.select); selectRing.visible = false; world.add(selectRing);

  // ---- static rooms (rebuilt on structure or theme change)
  let glowMesh = null;
  function buildStatic() {
    if (gtao) gtao.aoDirty = true;   // the cached AO (R2) follows the static scene
    for (const s of statics) { world.remove(s); s.geometry.dispose(); }
    statics = []; glowMesh = null;
    const R = buildRooms(L, P(), PALETTE.departments);
    const add = (geo, mat, { cast = true, receive = true, order = 0, name } = {}) => { if (!geo) return null; const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; m.renderOrder = order; m.name = name || ''; world.add(m); statics.push(m); return m; };
    for (const s of R.statics) add(s.geo, M.static, { name: 'room:' + s.key });
    add(R.tile, M.tile, { cast: false, name: 'tile' });
    add(R.wood, M.wood, { cast: false, name: 'wood' });
    add(R.decals, M.decal, { cast: false, name: 'decals' });
    add(R.emissive, M.emissive, { cast: false, receive: false, name: 'emissive' });
    glowMesh = add(R.glow, M.glow, { cast: false, receive: false, order: 2, name: 'glow' });
  }

  // ---- instanced furniture, people, plants, server cabinets (rebuilt when the structure changes)
  function makeInst(name, geo, material, count, { shadow = true, receive = false } = {}) {
    if (inst[name]) { world.remove(inst[name]); inst[name].dispose(); }
    const m = new THREE.InstancedMesh(geo, material, Math.max(1, count)); m.count = count; m.name = name; m.castShadow = shadow; m.receiveShadow = receive; m.frustumCulled = false; world.add(m); inst[name] = m; return m;
  }
  function setInst(m, i, x, y, z, ry = 0, rx = 0, s = 1, rz = 0) { dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz, 'YXZ'); dummy.scale.setScalar(s); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); }

  function buildFurniture(snap) {
    pickables = []; while (pickRoot.children.length > 1) pickRoot.remove(pickRoot.children[pickRoot.children.length - 1]);
    pickables.push({ object: hubPick, kind: 'hub', id: 'hub' });
    anchors.depts = {}; anchors.deptCorners = {}; anchors.agents = {}; anchors.desks = {};
    const desks = L.rooms.flatMap((r) => r.desks.map((d) => ({ ...d, room: r, a: snap.agents.find((x) => x.id === d.agentId) }))).filter((d) => d.a);
    for (const r of L.rooms) {
      anchors.depts[r.key] = new THREE.Vector3(r.cx, PT, r.cz);
      anchors.deptCorners[r.key] = new THREE.Vector3(r.corner.x, FLOOR + WALL_H + 0.05, r.corner.z);
      const pick = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.6, r.d)); pick.position.set(r.cx, FLOOR, r.cz); pickRoot.add(pick); pickables.push({ object: pick, kind: 'dept', id: r.key });
    }
    anchors.lounge.set(L.lounge.cx, PT, L.lounge.cz);
    const n = desks.length, lsh = desks.filter((d) => d.lshape);
    const top = makeInst('deskTop', G.deskTop, M.deskTop, n, { receive: true }), frame = makeInst('deskFrame', G.deskFrame, M.deskMetal, n);
    const ret = makeInst('deskReturn', G.deskReturn, M.deskTop, lsh.length, { receive: true }), retFrame = makeInst('returnFrame', G.returnFrame, M.deskMetal, lsh.length);
    const mon = makeInst('monitor', G.monitor, M.monitorFrame, n), kb = makeInst('keyboard', G.keyboard, M.keyboard, n), lamp = makeInst('lamp', G.lamp, M.deskMetal, n), bulb = makeInst('bulb', G.bulb, M.light, n, { shadow: false });
    const chair = makeInst('chair', G.chair, M.chair, n), light = makeInst('light', G.light, M.light, n, { shadow: false });
    // people: one mesh per part (two per person for arms and legs); hair: one mesh per style
    const person = (name, geo, mat, per = 1) => makeInst(name, geo, mat, n * per, { shadow: false });
    const parts = { pelvis: person('pelvis', G.pelvis, M.trousers), torso: person('torso', G.torso, M.shirt), head: person('head', G.head, M.skin), upperArm: person('upperArm', G.upperArm, M.shirt, 2), forearm: person('forearm', G.forearm, M.skin, 2), hand: person('hand', G.hand, M.skin, 2), thigh: person('thigh', G.thigh, M.trousers, 2), shin: person('shin', G.shin, M.trousers, 2), shoe: person('shoe', G.shoe, M.shoe, 2) };
    const styleOf = (id) => hash(id + ':hair') % G.hair.length, styleCount = G.hair.map((_, s) => desks.filter((d) => styleOf(d.agentId) === s).length);
    parts.hair = G.hair.map((g, s) => makeInst('hair' + s, g, M.hair, styleCount[s], { shadow: false }));
    const styleIx = G.hair.map(() => 0);
    const blobs = makeInst('blobs', G.blob, blobMat, n, { shadow: false }); blobs.renderOrder = 1;
    const screenPool = makeInst('screenPool', poolGeo, M.glowInst, n, { shadow: false }), lampPool = makeInst('lampPool', poolGeo, M.glowInst, n, { shadow: false });
    screenPool.renderOrder = lampPool.renderOrder = 2;
    for (const s of screens) { world.remove(s.mesh); s.texMat.dispose(); s.glowMat.dispose(); s.tex.texture.dispose(); }
    screens = []; workers = [];
    let li = 0;
    const deskY = PT + 0.73, onTop = deskY + 0.03;
    desks.forEach(({ a, x, z, lshape, chair: ch, agentId }, i) => {
      setInst(top, i, x, deskY, z); setInst(frame, i, x, PT, z);
      if (lshape) { setInst(ret, li, x + 0.75, deskY, z + 0.95); setInst(retFrame, li, x + 0.75, PT, z + 1.3); li++; }
      setInst(mon, i, x, onTop, z - 0.24, MON_YAW); setInst(kb, i, x - 0.05, onTop + 0.012, z + 0.14);
      setInst(lamp, i, x - 0.82, onTop, z - 0.12, -0.5); setInst(bulb, i, x - 0.82 + 0.17 * Math.sin(-0.5) * -1, onTop + 0.46, z - 0.12 - 0.17 * Math.cos(-0.5));
      setInst(lampPool, i, x - 0.72, onTop + 0.004, z - 0.02, 0, 0, 1.0); setInst(screenPool, i, x + 0.12, onTop + 0.006, z + 0.12, MON_YAW, 0, 1.2);
      setInst(chair, i, ch.x, PT, ch.z);
      // looks: the shirt takes the agent's colour; skin, hair, hair style and trousers are picked from the agent id
      const shirt = new THREE.Color(a.color || '#8fa3b8').lerp(new THREE.Color('#ffffff'), 0.12), skin = new THREE.Color(SKIN[hash(agentId + ':skin') % SKIN.length]);
      const hairC = new THREE.Color(HAIR[hash(agentId + ':hc') % HAIR.length]), legs = new THREE.Color(TROUSERS[hash(agentId + ':tr') % TROUSERS.length]);
      const style = styleOf(agentId), hairI = styleIx[style]++;
      parts.torso.setColorAt(i, shirt); parts.head.setColorAt(i, skin); parts.pelvis.setColorAt(i, legs); parts.hair[style].setColorAt(hairI, hairC);
      for (const j of [0, 1]) { parts.upperArm.setColorAt(i * 2 + j, shirt); parts.forearm.setColorAt(i * 2 + j, skin); parts.hand.setColorAt(i * 2 + j, skin); parts.thigh.setColorAt(i * 2 + j, legs); parts.shin.setColorAt(i * 2 + j, legs); }
      setInst(light, i, x + 0.9, onTop + 0.05, z + 0.34);
      const path = L.paths[agentId] || { seat: null, toLounge: null };
      workers.push({ agentId, i, x, z, chair: ch, seat: path.seat != null ? L.lounge.seats[path.seat] : null, path: path.toLounge, len: path.toLounge ? pathLength(path.toLounge) : 0, phase: (i * 1.7) % (Math.PI * 2), status: a.status, place: 'desk', walk: null, yaw: 0, pick: null, style, hairI });
      // the screen: its own mesh (own texture), glow material at overview, canvas text when zoomed in or selected
      const tex = makeMonitorTexture();
      const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      const texMat = new THREE.MeshBasicMaterial({ map: tex.texture, toneMapped: false });
      const mesh = new THREE.Mesh(G.screen, glowMat);
      const off = new THREE.Vector3(0, 0, 0.031).applyAxisAngle(new THREE.Vector3(0, 1, 0), MON_YAW);
      mesh.position.set(x + off.x, onTop + 0.72, z - 0.24 + off.z); mesh.rotation.y = MON_YAW; world.add(mesh);
      screens.push({ agentId, mesh, tex, glowMat, texMat, textured: false });
      anchors.agents[agentId] = new THREE.Vector3(x, PT + 2.25, z - 0.2);
      anchors.desks[agentId] = { x, z, min: new THREE.Vector3(x - 1.15, PT, z - 0.65), max: new THREE.Vector3(x + 1.15, PT + 2.15, z + 1.4) };
      const pick = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.3, 2.7)); pick.position.set(x, PT + 1.1, z + 0.35); pickRoot.add(pick); pickables.push({ object: pick, kind: 'agent', id: agentId });
      // a second pick box that follows the person (lounge, walking)
      const wp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.7, 0.9)); pickRoot.add(wp); pickables.push({ object: wp, kind: 'agent', id: agentId }); workers[workers.length - 1].pick = wp;
    });
    // plants
    const tall = L.plants.filter((p) => p.kind === 'tall'), small = L.plants.filter((p) => p.kind !== 'tall');
    const potT = makeInst('potTall', G.potTall, M.potTall, tall.length), leafT = makeInst('leafTall', G.leavesTall, M.leafTall, tall.length);
    const potS = makeInst('potSmall', G.potSmall, M.potSmall, small.length), leafS = makeInst('leafSmall', G.leavesSmall, M.leafSmall, small.length);
    tall.forEach((p, i) => { setInst(potT, i, p.x, PT + 0.25, p.z); setInst(leafT, i, p.x, PT, p.z, i * 1.3); });
    small.forEach((p, i) => { setInst(potS, i, p.x, PT + 0.16, p.z); setInst(leafS, i, p.x, PT + 0.12, p.z, i * 1.7); });
    for (const m of Object.values(inst)) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    syncPlaces(true); poseWorkers(0);
    pickRoot.updateMatrixWorld(true);
  }

  function buildServices(services) {
    const n = services.length, body = makeInst('terminal', G.terminal, M.terminal, n), scr = makeInst('termScreen', G.termScreen, M.termScreen, n, { shadow: false }), lt = makeInst('termLight', G.termLight, M.light, n, { shadow: false });
    terminals = []; anchors.services = {};
    const c = L.closet;
    anchors.rack.set(c.x0 + 0.75, FLOOR + 2.55, c.cz);
    // R2: the cabinets face +x (towards the core); their geometry faces +z, so each is turned a quarter turn
    services.forEach((s, i) => {
      const cab = c.cabinets[i]; if (!cab) return;
      const { x, z } = cab, ry = cab.yaw + Math.PI;
      setInst(body, i, x, FLOOR + 0.012, z, ry); setInst(scr, i, x + 0.425, FLOOR + 1.72, z, ry); setInst(lt, i, x + 0.3, FLOOR + 2.08, z - 0.22, ry);
      terminals.push({ id: s.id, i, x, z, status: s.status });
      anchors.services[s.id] = new THREE.Vector3(x + 0.2, FLOOR + 2.2, z);
      const pick = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.8)); pick.position.set(x, FLOOR + 1.05, z); pickRoot.add(pick); pickables.push({ object: pick, kind: 'service', id: s.id });
    });
    for (const m of [body, scr, lt]) m.instanceMatrix.needsUpdate = true;
    pickRoot.updateMatrixWorld(true);
  }
  function colourServices() {
    const p = P(), scr = inst.termScreen, lt = inst.termLight; if (!scr) return;
    for (const t of terminals) { scr.setColorAt(t.i, new THREE.Color(PALETTE.services[t.id] || '#9aa3ad').multiplyScalar(p.terminalScreen)); lt.setColorAt(t.i, new THREE.Color(PALETTE.serviceStatus[t.status] || PALETTE.serviceStatus.unknown)); }
    if (scr.instanceColor) scr.instanceColor.needsUpdate = true; if (lt.instanceColor) lt.instanceColor.needsUpdate = true;
  }

  // ---- people: where each one should be (idle -> lounge seat, anything else -> desk) and the walk between
  function wantPlace(w) { return w.status === 'idle' && w.seat && w.path ? 'lounge' : 'desk'; }
  function syncPlaces(snap) {
    for (const w of workers) {
      const want = wantPlace(w);
      if (snap || !animate) { w.place = want; w.walk = null; continue; }
      if (w.walk) { if (w.walk.to !== want) { w.walk.to = want; w.walk.dir = want === 'lounge' ? 1 : -1; } continue; }
      if (w.place !== want) w.walk = { to: want, dir: want === 'lounge' ? 1 : -1, s: want === 'lounge' ? 0 : w.len };
    }
  }
  const walking = () => workers.some((w) => w.walk);
  function stepWalkers(dt) {
    for (const w of workers) {
      if (!w.walk) continue;
      w.walk.s += w.walk.dir * WALK_SPEED * dt;
      if ((w.walk.dir > 0 && w.walk.s >= w.len) || (w.walk.dir < 0 && w.walk.s <= 0)) { w.place = w.walk.to; w.walk = null; }
    }
  }
  // ---- poses (R2). A limb part hangs along -y from its joint; angle a swings it forward (towards the person's front,
  // local -z) and d turns that swing sideways, so it points along (-sin a sin d, -cos a, -sin a cos d). Seated people
  // sit with their hips on the chair seat or the sofa cushion; the shin angle is solved so the feet rest on the floor.
  // Poses: typing at the desk (small forearm and hand motion while working), relaxed in the lounge (leaning back, hands
  // on the lap), walking (legs and arms swing, the hips ride on the supporting leg).
  const SEG = { thigh: 0.42, shin: 0.42, upper: 0.3, fore: 0.26, ankle: 0.08, waist: 0.06, shoulderY: 0.45, shoulderX: 0.24, hipX: 0.09, neckY: 0.48 };
  const CHAIR_TOP = PT + 0.49;                              // the desk chair's seat
  const PEOPLE_PARTS = ['pelvis', 'torso', 'head', 'upperArm', 'forearm', 'hand', 'thigh', 'shin', 'shoe', 'hair0', 'hair1', 'hair2', 'hair3'];
  const PARTS = [...PEOPLE_PARTS, 'blobs'];
  const dirOf = (a, d = 0) => [-Math.sin(a) * Math.sin(d), -Math.cos(a), -Math.sin(a) * Math.cos(d)];
  const add = (p, d, l) => [p[0] + d[0] * l, p[1] + d[1] * l, p[2] + d[2] * l];
  function poseWorkers(t) {
    const q = inst; if (!q.torso) return;
    for (const w of workers) {
      let x, z, yaw, mode;
      if (w.walk) { const p = pointAt(w.path, w.walk.s); x = p.x; z = p.z; const want = w.walk.dir > 0 ? p.yaw : p.yaw + Math.PI; w.yaw = angLerp(w.yaw, want, 0.35); yaw = w.yaw; mode = 'walk'; }
      else if (w.place === 'lounge') { x = w.seat.x; z = w.seat.z; yaw = w.yaw = w.seat.yaw; mode = 'sofa'; }
      else { x = w.x; z = w.chair.z - 0.15; yaw = w.yaw = 0; mode = 'desk'; }
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const wx = (p) => [x + p[0] * c + p[2] * s, p[1], z - p[0] * s + p[2] * c];   // person-local -> world
      const k = w.i, typing = animate && w.status === 'working' && mode === 'desk';
      const breathe = animate && mode !== 'walk' ? Math.sin(t * 1.6 + w.phase) * 0.006 : 0;
      let hipY, lean, legs, arms, turn = 0, nod = 0;
      if (mode === 'walk') {
        const ph = w.walk.s * 3.6;
        legs = [0, 1].map((j) => { const a1 = Math.sin(ph + j * Math.PI) * 0.42; return [a1, a1 < 0 ? a1 * 1.9 : a1 * 0.45]; });
        hipY = PT + SEG.ankle + Math.max(...legs.map(([a1, a2]) => SEG.thigh * Math.cos(a1) + SEG.shin * Math.cos(a2)));
        lean = 0.05;
        arms = [0, 1].map((j) => { const a1 = -Math.sin(ph + j * Math.PI) * 0.38; return [a1, 0, a1 + 0.35, 0]; });
      } else {
        hipY = (mode === 'desk' ? CHAIR_TOP : w.seat.cushion.top) + 0.075;
        const a1 = Math.PI / 2 - (mode === 'desk' ? 0.06 : 0.1);
        const knee = hipY - SEG.thigh * Math.cos(a1), drop = Math.min(SEG.shin, Math.max(0.05, knee - PT - SEG.ankle));
        const a2 = Math.acos(drop / SEG.shin);                  // the feet reach the floor, a little forward of the knees
        legs = [[a1, a2], [a1, a2]];
        if (mode === 'desk') {                                  // hands on the keyboard; fingers tap while working
          lean = 0.2;
          arms = [0, 1].map((j) => { const sd = j ? 1 : -1, tap = typing ? Math.sin(t * 9 + w.phase + j * 2.3) * 0.06 : 0; return [0.75, sd * 0.08, 1.42 + tap, sd * 0.3]; });
          nod = 0.06 + (typing ? Math.sin(t * 4 + w.phase) * 0.015 : 0);
          if (animate && !typing) turn = Math.sin(t * 0.5 + w.phase) * 0.15;
        } else {                                                // leaning back, hands on the lap
          lean = -0.22;
          arms = [0, 1].map((j) => { const sd = j ? 1 : -1; return [0.28, sd * 0.05, 1.3, sd * 0.38]; });
          turn = animate ? Math.sin(t * 0.4 + w.phase) * 0.25 : 0; nod = -0.04;
        }
      }
      const waist = [0, hipY + SEG.waist + breathe, 0], up = [0, Math.cos(lean), -Math.sin(lean)], neck = add(waist, up, SEG.neckY);
      setInst(q.pelvis, k, ...wx([0, hipY, 0]), yaw);
      setInst(q.torso, k, ...wx(waist), yaw, -lean);
      setInst(q.head, k, ...wx(neck), yaw + turn, -(lean * 0.4 + nod));
      setInst(q['hair' + w.style], w.hairI, ...wx(neck), yaw + turn, -(lean * 0.4 + nod));
      for (const j of [0, 1]) {
        const side = j ? 1 : -1, ix = k * 2 + j;
        const [t1, t2] = legs[j], hip = [side * SEG.hipX, hipY, 0], kneeP = add(hip, dirOf(t1), SEG.thigh), ankle = add(kneeP, dirOf(t2), SEG.shin);
        setInst(q.thigh, ix, ...wx(hip), yaw, t1); setInst(q.shin, ix, ...wx(kneeP), yaw, t2); setInst(q.shoe, ix, ...wx(ankle), yaw);
        const [u1, ud, f1, fd] = arms[j], sh = add(add(waist, up, SEG.shoulderY), [side * SEG.shoulderX, 0, 0], 1);
        const elbow = add(sh, dirOf(u1, ud), SEG.upper), wrist = add(elbow, dirOf(f1, fd), SEG.fore);
        setInst(q.upperArm, ix, ...wx(sh), yaw + ud, u1); setInst(q.forearm, ix, ...wx(elbow), yaw + fd, f1); setInst(q.hand, ix, ...wx(wrist), yaw + fd, f1);
      }
      setInst(q.blobs, k, x, PT + 0.012, z, 0, 0, mode === 'walk' ? 0.85 : 1.1);
      if (w.pick) { w.pick.visible = false; w.pick.position.set(x, PT + 0.85, z); w.pick.scale.setScalar(mode === 'desk' ? 0.001 : 1); w.pick.updateMatrixWorld(true); }
    }
    for (const n of PARTS) if (q[n]) q[n].instanceMatrix.needsUpdate = true;
  }

  // activity lines: dashed arcs from a working desk to the services it is using in the server closet
  function buildLines(agents) {
    for (const l of lines) { world.remove(l); l.geometry.dispose(); l.material.dispose(); } lines = [];
    for (const a of agents) {
      if (a.status !== 'working' || !a.services || !a.services.length) continue;
      const d = anchors.desks[a.id]; if (!d) continue;
      for (const sid of a.services) {
        const t = terminals.find((x) => x.id === sid); if (!t) continue;
        const start = new THREE.Vector3(d.x, PT + 1.95, d.z - 0.25), end = new THREE.Vector3(t.x + 0.3, FLOOR + 2.15, t.z);
        const mid = start.clone().lerp(end, 0.5); mid.y += 3.4;
        const geo = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(start, mid, end).getPoints(48));
        const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: new THREE.Color(PALETTE.services[sid] || '#888'), dashSize: 0.35, gapSize: 0.25, transparent: true, opacity: 0.95, toneMapped: false }));
        line.computeLineDistances(); world.add(line); lines.push(line);
      }
    }
  }

  // monitors: status-colour glow at overview zoom; canvas text when zoomed in or selected
  function updateScreens() {
    const textual = view.zoom >= TEXT_ZOOM, p = P(), sp = inst.screenPool;
    for (const s of screens) {
      const a = data && data.agents.find((x) => x.id === s.agentId); if (!a) continue;
      const want = textual || s.agentId === selectedId;
      if (want) s.tex.draw(a, theme);
      const c = new THREE.Color(PALETTE.status[a.status] || PALETTE.status.idle);
      s.glowMat.color.copy(theme === 'dark' ? c : c.clone().lerp(new THREE.Color('#ffffff'), 0.12));
      if (want !== s.textured) { s.mesh.material = want ? s.texMat : s.glowMat; s.textured = want; }
      const w = workers.find((x) => x.agentId === s.agentId);
      if (sp && w) sp.setColorAt(w.i, c.clone().multiplyScalar(p.screenPool));
    }
    if (sp && sp.instanceColor) sp.instanceColor.needsUpdate = true;
  }

  // ---- public: data in. Rebuild only when the structure (departments, desks, services) changes; otherwise update
  // statuses, screens and lines in place.
  let lastLedgerRows = null;
  function setData(snap) {
    data = snap;
    const key = JSON.stringify([snap.departments.map((d) => [d.key, d.agents]), snap.services.map((s) => s.id)]);
    if (key !== structureKey) {
      structureKey = key;
      const depts = snap.departments.map((d) => ({ key: d.key, agents: d.agents.map((id) => snap.agents.find((a) => a.id === id)).filter(Boolean).sort((a, b) => (a.desk && b.desk ? (a.desk.y - b.desk.y) || (a.desk.x - b.desk.x) : 0)).map((a) => a.id) }));
      L = computeLayout(depts, snap.services);
      if (L.dropped.length) console.warn('office: only three department rooms are drawn; not drawn:', L.dropped.join(', '));
      buildStatic(); buildFurniture(snap); buildServices(snap.services);
      const b = L.base; drop.scale.set(b.w * 1.2, 1, b.d * 1.2); drop.position.set(b.cx - 0.6, 0.004, b.cz + 0.2);
      renderer.shadowMap.needsUpdate = true;
    }
    for (const w of workers) { const a = snap.agents.find((x) => x.id === w.agentId); if (a) { w.status = a.status; inst.light.setColorAt(w.i, new THREE.Color(PALETTE.status[a.status] || PALETTE.status.idle)); } }
    if (inst.light && inst.light.instanceColor) inst.light.instanceColor.needsUpdate = true;
    syncPlaces(false); poseWorkers(performance.now() / 1000);
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
    if (rebuild && L) buildStatic();
    M.wood.color.set(p.wood); M.tile.color.set(p.tile);
    M.deskTop.color.set(p.deskTop); M.deskMetal.color.set(p.deskMetal); M.chair.color.set(p.chair); M.monitorFrame.color.set(p.monitorFrame); M.keyboard.color.set(p.keyboard);
    M.potTall.color.set(p.plantPotTall); M.potSmall.color.set(p.plantPot); M.leafTall.color.set(p.plantLeafTall); M.leafSmall.color.set(p.plantLeaf);
    M.terminal.color.set(p.terminal);
    M.crystal.emissive.set(p.hubCore); M.coreRing.color.set(p.hubCore); glow.material.color.set(p.hubCore);
    dropMat.opacity = p.shadowOpacity * 2; blobMat.opacity = p.blobOpacity;
    hemi.color.set(p.hemiSky); hemi.groundColor.set(p.hemiGround); hemi.intensity = p.hemiIntensity; sun.intensity = p.sunIntensity; sun.color.set(p.sunColour);
    renderer.toneMappingExposure = p.exposure;
    // dark mode: LED washes, lamp and screen pools; light mode: none of them (LED strips read as plain profiles)
    const lit = p.ledGlow > 0;
    if (glowMesh) glowMesh.visible = lit;
    if (inst.lampPool) { inst.lampPool.visible = lit; for (let i = 0; i < inst.lampPool.count; i++) inst.lampPool.setColorAt(i, new THREE.Color(p.lampGlow).multiplyScalar(p.lampPool)); if (inst.lampPool.instanceColor) inst.lampPool.instanceColor.needsUpdate = true; }
    if (inst.screenPool) inst.screenPool.visible = lit;
    if (inst.bulb) { for (let i = 0; i < inst.bulb.count; i++) inst.bulb.setColorAt(i, new THREE.Color(p.bulb)); if (inst.bulb.instanceColor) inst.bulb.instanceColor.needsUpdate = true; }
    if (gtao) gtao.blendIntensity = p.aoBlend;
    colourServices(); updateScreens(); paintBackdrop(); setHubGlow(0);
    for (const s of screens) if (s.textured) { const a = data && data.agents.find((x) => x.id === s.agentId); if (a) s.tex.draw(a, theme); }
    if (gtao) gtao.aoDirty = true;
    renderer.shadowMap.needsUpdate = true; invalidate(2);
  }
  function setTheme(t) { theme = t; applyTheme(true); }

  // ---- hub pulse (a new ledger row): crystal and glow brighten briefly
  let pulseAt = -1;
  function pulseHub() { pulseAt = performance.now(); invalidate(1); }
  function setHubGlow(k) { const p = P(); glow.material.opacity = Math.min(1, p.hubGlow * (0.55 + 0.9 * k)); glow.scale.setScalar(2.4 + 1.0 * k); M.crystal.emissiveIntensity = (theme === 'dark' ? 0.9 : 0.55) + 1.4 * k; }

  // ---- selection
  function setSelected(id) {
    selectedId = id || null;
    const d = selectedId && anchors.desks[selectedId];
    selectRing.visible = !!d; if (d) { selectRing.position.set(d.x, PT + 0.045, d.z + 0.4); M.select.color.set(theme === 'dark' ? '#ffd394' : '#2b2a28'); M.select.opacity = theme === 'dark' ? 0.8 : 0.55; }
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
        const aq = options.aoQuality || { samples: 6, pdSamples: 4, rings: 1 };   // R1: 8/8/2 -> 6/4/1 (frame budget; looks the same at this scale)
        gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1, thickness: 1, scale: 1, samples: aq.samples, distanceFallOff: 1, screenSpaceRadius: false });
        gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: aq.rings, samples: aq.pdSamples });
        gtao.blendIntensity = P().aoBlend;
        // left out of the AO pre-pass: overlays (they would make halos) and small details that gain nothing from AO
        // R2: the people are left out too (small, they move, and they have blob shadows): 15 fewer draws in the pre-pass
        gtao.hideDuringAO = () => [...PEOPLE_PARTS.map((n) => inst[n]), crystal, coreRing, glow, glowMesh, drop, inst.blobs, inst.screenPool, inst.lampPool, selectRing, ...lines, inst.keyboard, inst.bulb, inst.light, inst.lamp, inst.termScreen, inst.termLight, ...statics.filter((m) => m.name === 'decals' || m.name === 'emissive'), ...screens.map((x) => x.mesh)];
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
    const k = 1 - Math.pow(view.ease, dt);
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
  // screen-space rectangles of every desk cluster, the core, the closet and the lounge (obstacles for the label layout)
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  function boxRect(min, max) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, k = 0;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) { const p = project(corners[k++].set(x, y, z)); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    return { x0, y0, x1, y1 };
  }
  function obstacles() {
    const out = Object.entries(anchors.desks).map(([id, d]) => ({ kind: 'desk', id, ...boxRect(d.min, d.max) }));
    out.push({ kind: 'hub', ...boxRect(new THREE.Vector3(-0.8, FLOOR + 0.4, -0.8), new THREE.Vector3(0.8, CORE_Y + 1.05, 0.8)) });
    if (L && terminals.length) { const c = L.closet; out.push({ kind: 'rack', ...boxRect(new THREE.Vector3(c.x0 + 0.25, FLOOR, c.z0 + 0.4), new THREE.Vector3(c.x0 + 1.1, FLOOR + 2.1, c.z1 - 0.2)) }); }
    if (L) { const r = L.lounge.furniture.rug; out.push({ kind: 'lounge', ...boxRect(new THREE.Vector3(r.x0 + 0.3, FLOOR, r.z0 + 0.3), new THREE.Vector3(r.x1 - 0.3, FLOOR + 1.4, r.z1 - 0.3)) }); }
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
    // walking: every frame (smooth), not on the low ambient tick
    if (walking() && !document.hidden) { stepWalkers(dt); poseWorkers(t); dirty = Math.max(dirty, 1); if (!cameraChanged) stats.mode = 'walking'; }
    if (animate && !document.hidden && now - lastAnim >= 1000 / ANIM_HZ) {
      lastAnim = now; poseWorkers(t);
      for (const l of lines) l.material.dashOffset = -t * 1.2;
      for (const w of workers) if (w.status === 'error' || w.status === 'waiting') { inst.light.setColorAt(w.i, new THREE.Color(PALETTE.status[w.status]).multiplyScalar(w.status === 'error' ? 0.55 + 0.45 * Math.abs(Math.sin(t * 3)) : 0.7 + 0.3 * Math.sin(t * 2))); inst.light.instanceColor.needsUpdate = true; }
      crystal.rotation.y = t * 0.25;
      dirty = Math.max(dirty, 1); if (!cameraChanged && !walking()) stats.mode = 'animating';
    }
    if (pulseAt >= 0) { const k = (now - pulseAt) / 1600; if (k >= 1) { pulseAt = -1; setHubGlow(0); } else setHubGlow(Math.sin(Math.PI * k)); dirty = Math.max(dirty, 1); }
    if (now < benchUntil) dirty = Math.max(dirty, 1);
    // AO is skipped while the camera moves (the frame budget goes to smooth motion) and fades back in once it settles
    if (gtao) {
      if (cameraChanged) { gtao.aoDirty = true; if (gtao.enabled) { gtao.enabled = false; aoFadeAt = -1; } }
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
  function getStats() { return { fps: stats.renders.length, cpuMs: +avg(stats.cpu.slice(-30)).toFixed(2), frameMs: +avg(stats.intervals.slice(-30)).toFixed(2), calls: stats.calls, tris: stats.tris, mode: stats.mode, dpr: renderer.getPixelRatio(), ao: gtao ? (gtao.enabled ? 'half-res, cached' : 'skipped while moving') : 'off', aoRuns: gtao ? gtao.aoRuns : 0, textual: view.zoom >= TEXT_ZOOM, walking: workers.filter((w) => w.walk).length }; }
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
  function setAnimate(v) { animate = v; if (!animate) { syncPlaces(true); poseWorkers(0); } invalidate(1); }
  // nothing renders while an overlay covers the stage (board, calendar, ledger)
  function setPaused(v) { paused = !!v; if (!paused) { cameraDirty = true; invalidate(1); } }
  // people: where each one is now (read-only; for the screenshot script and tests)
  function people() { return workers.map((w) => ({ agentId: w.agentId, status: w.status, place: w.walk ? 'walking' : w.place, seat: w.seat ? L.lounge.seats.indexOf(w.seat) : null })); }

  resize(); updateCamera(0); paintBackdrop();
  return { renderer, scene, camera, setData, setTheme, resize, tick, invalidate, pan, zoomBy, resetView, focus, project, obstacles, setSelected, pulseHub, anchors, getStats, bench, setAnimate, setPaused, people, get view() { return view; }, get selected() { return selectedId; }, get size() { return size; } };
}
