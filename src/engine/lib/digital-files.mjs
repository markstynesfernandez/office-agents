// PORTED from Virtual-workers/station/scripts/lib/digital-files.mjs (the owner's own code) at 16/10/2026 19:16 Irish time, source sha256 57bff4f9fd0ca0f88dc88eb6685782ef06a27c73ce58b1c4725163c1d8ac518a.
//   change: none (sha256 from ./common.mjs, which is the engine's)
// Everything else is the source unchanged. PORTED.md lists every ported file; npm run port-drift checks the source.
// digital-files.mjs (lib) — measure a digital deliverable set: format from the file's own bytes (never the extension alone), pixel size
// for PNG/JPEG from the headers, byte size and sha256; a zip's entries are read (lib/zip.mjs) and measured the same way. Pure, synchronous,
// no model call, no dependency. Used by digital-prep (manifest) and digital-gate (re-measures the files to prove the manifest still describes
// what is on disk).
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './common.mjs';
import { readZip } from './zip.mjs';

// format from magic bytes; 'unknown' when not recognised
export function formatOf(buf) {
  const b = (i) => buf[i], s = (i, n) => buf.subarray(i, i + n).toString('latin1');
  if (buf.length >= 8 && b(0) === 0x89 && s(1, 3) === 'PNG') return 'png';
  if (buf.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return 'jpg';
  if (s(0, 5) === '%PDF-') return 'pdf';
  if (b(0) === 0x50 && b(1) === 0x4b && (b(2) === 3 || b(2) === 5 || b(2) === 7)) return 'zip';
  if (s(0, 4) === 'wOFF') return 'woff';
  if (s(0, 4) === 'wOF2') return 'woff2';
  if (s(0, 4) === 'OTTO') return 'otf';
  if (buf.length >= 4 && b(0) === 0 && b(1) === 1 && b(2) === 0 && b(3) === 0) return 'ttf';
  return 'unknown';
}

// { widthPx, heightPx } for PNG (IHDR) and baseline/progressive JPEG (first SOFn marker); nulls when not measurable
export function imageSize(buf, format = formatOf(buf)) {
  if (format === 'png' && buf.length >= 24 && buf.subarray(12, 16).toString('latin1') === 'IHDR') return { widthPx: buf.readUInt32BE(16), heightPx: buf.readUInt32BE(20) };
  if (format === 'jpg') {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { i += m === 0xff ? 1 : 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { widthPx: buf.readUInt16BE(i + 7), heightPx: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return { widthPx: null, heightPx: null };
}

// one file's measurement from its bytes; a zip also lists every entry inside it, measured the same way (zipProblems: what the reader refused)
export function measureBuffer(name, buf, { inZip = false } = {}) {
  const format = formatOf(buf), out = { name, format, bytes: buf.length, ...imageSize(buf, format), sha256: sha256(buf) };
  if (format === 'zip' && !inZip) {
    const z = readZip(buf);
    out.entries = z.entries.map((e) => measureBuffer(e.name, e.data, { inZip: true }));
    out.zipProblems = z.problems;
  }
  return out;
}
export const measureFile = (file) => measureBuffer(path.basename(file), fs.readFileSync(file));

// every regular file directly inside dir, measured, sorted by name (sub-folders are not deliverables and are reported)
export function measureDir(dir) {
  if (!fs.existsSync(dir)) return { files: [], subfolders: [] };
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  return { files: ents.filter((e) => e.isFile()).map((e) => measureFile(path.join(dir, e.name))).sort((a, b) => (a.name < b.name ? -1 : 1)), subfolders: ents.filter((e) => e.isDirectory()).map((e) => e.name) };
}

// the buyer-facing description of one file (what the listing must state exactly); a zip also states its contents
export const publicView = (f) => {
  const inner = Array.isArray(f.entries) ? f.entries : Array.isArray(f.contents) ? f.contents : null;   // measured zip, or a listing's stated zip
  return { name: f.name, format: f.format, widthPx: f.widthPx, heightPx: f.heightPx, ...(inner ? { contents: inner.map(publicView) } : {}) };
};
