// lib/strict-cleanup.mjs — the stricter deterministic clean-up of a raw prop (owner decision 3, 18/10/2026; DECISIONS.md "E6 step c:
// redraw-only mode, cleanup pass, mock guard"). $0, no model, run by the station before a redraw-only set is drawn (orchestrator
// prepareRedraw). It removes the disconnected regions outside the drawing that the build's own clean-up (digital-build.mjs cleanAlpha:
// specks of 48 px or less) leaves: faint smudges, specks and glow fragments. Pure on RGBA pixels:
//   - pixels under alphaFloor (12, the build's own alpha floor, which clears them anyway) are cleared first and never join parts
//   - parts: 8-connected regions of the remaining pixels
//   - the main part is the one with the most solid pixels (alpha >= solidAlpha); it is always kept
//   - another part is kept only when it is a real piece of the drawing: a mean alpha of at least faintMeanAlpha, at least minSolidPx
//     solid pixels, and not a pale low-ink smudge (mean luminance >= paleMinLum with fewer solid pixels than paleMaxShare of the main
//     part's). Anything else is removed (alpha and colour set to 0), with the reason: "faint", "small" or "pale" (the first that applies).
// A glow or shadow ATTACHED to the drawing is part of it and is never touched here (the owner's redraw list covers what this cannot fix).
import fs from 'node:fs';
import sharp from 'sharp';
import { dataJail } from '../store/active.mjs';
import { sha256 } from './common.mjs';

export const STRICT_DEFAULTS = { alphaFloor: 12, solidAlpha: 200, minSolidPx: 150, faintMeanAlpha: 115, paleMinLum: 235, paleMaxShare: 0.1 };
const lum = (d, i) => 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];

// data: RGBA Buffer/Uint8Array, changed in place -> { flooredPx, removedPx, removed: [{ px, solidPx, meanAlpha, meanLum, box, why }], partsKept, mainSolidPx, opts }
export function strictCleanData(data, W, H, opts = {}) {
  const o = { ...STRICT_DEFAULTS, ...opts }, n = W * H, label = new Int32Array(n).fill(-1), stack = new Int32Array(n), parts = [];
  let flooredPx = 0;
  for (let i = 0; i < n; i++) { const a = data[i * 4 + 3]; if (a > 0 && a < o.alphaFloor) { data[i * 4] = 0; data[i * 4 + 1] = 0; data[i * 4 + 2] = 0; data[i * 4 + 3] = 0; flooredPx++; } }
  for (let s = 0; s < n; s++) {
    if (label[s] !== -1 || data[s * 4 + 3] === 0) continue;
    const id = parts.length, members = []; let top = 0, solid = 0, aSum = 0, lSum = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
    stack[top++] = s; label[s] = id;
    while (top) {
      const i = stack[--top], a = data[i * 4 + 3], x = i % W, y = (i - x) / W; members.push(i);
      aSum += a; lSum += lum(data, i); if (a >= o.solidAlpha) solid++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; if (xx < 0 || xx >= W || (!dx && !dy)) continue;
          const j = yy * W + xx; if (label[j] === -1 && data[j * 4 + 3] !== 0) { label[j] = id; stack[top++] = j; } } }
    }
    parts.push({ members, px: members.length, solidPx: solid, meanAlpha: Math.round(aSum / members.length), meanLum: Math.round(lSum / members.length), box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] });
  }
  if (!parts.length) return { flooredPx, removedPx: 0, removed: [], partsKept: 0, mainSolidPx: 0, opts: o };
  const main = parts.reduce((a, b) => (b.solidPx > a.solidPx ? b : a));
  const removed = []; let kept = 0;
  for (const p of parts) {
    let why = null;
    if (p !== main) {
      if (p.meanAlpha < o.faintMeanAlpha) why = 'faint';
      else if (p.solidPx < o.minSolidPx) why = 'small';
      else if (p.meanLum >= o.paleMinLum && p.solidPx < main.solidPx * o.paleMaxShare) why = 'pale';
    }
    if (!why) { kept++; continue; }
    for (const i of p.members) { data[i * 4] = 0; data[i * 4 + 1] = 0; data[i * 4 + 2] = 0; data[i * 4 + 3] = 0; }
    removed.push({ px: p.px, solidPx: p.solidPx, meanAlpha: p.meanAlpha, meanLum: p.meanLum, box: p.box, why });
  }
  removed.sort((a, b) => b.px - a.px);
  return { flooredPx, removedPx: removed.reduce((s, r) => s + r.px, 0), removed, partsKept: kept, mainSolidPx: main.solidPx, opts: o };
}

// one raw file -> its strictly cleaned copy (written only when the bytes differ); -> the record for set-vN/cleanup.json
export async function strictCleanFile({ input, output, opts = {} }) {
  const inBuf = fs.readFileSync(input), { data, info } = await sharp(inBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const r = strictCleanData(data, info.width, info.height, opts);
  const out = r.removedPx || r.flooredPx ? await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer() : inBuf;
  const action = fs.existsSync(output) && fs.readFileSync(output).equals(out) ? 'unchanged' : (fs.writeFileSync(dataJail(output), out), 'written');
  return { input: { sha256: sha256(inBuf), widthPx: info.width, heightPx: info.height }, output: { sha256: sha256(out) }, flooredPx: r.flooredPx, removedPx: r.removedPx, regionsRemoved: r.removed.length, removed: r.removed.slice(0, 20), partsKept: r.partsKept, mainSolidPx: r.mainSolidPx, params: r.opts, action };
}

// a built (delivered-size) PNG flattened onto each review background, for the owner: <dir>/<base>-on-<label>.png -> { label: { file, action } }
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); if (!m) throw new Error('not a #rrggbb colour: ' + h); return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) }; };
export async function writeFlattened({ buf, dir, base, backgrounds, rel }) {
  const out = {};
  fs.mkdirSync(dataJail(dir), { recursive: true });
  for (const [label, hex] of Object.entries(backgrounds)) {
    const png = await sharp(buf).flatten({ background: hexRgb(hex) }).png({ compressionLevel: 9 }).toBuffer(), name = base + '-on-' + label + '.png', file = dir + '/' + name;
    out[label] = { file: rel + '/' + name, action: fs.existsSync(file) && fs.readFileSync(file).equals(png) ? 'unchanged' : (fs.writeFileSync(dataJail(file), png), 'written') };
  }
  return out;
}
