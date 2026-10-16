// PORTED from Virtual-workers/station/scripts/lib/style-ref.mjs (the owner's own code) at 16/10/2026 19:42 Irish time (re-ported: it changed after 19:16), source sha256 961703edc7a7fe57dda8f75e0ece01047a1ca4b7ed66db074e7284212a5409db.
//   change: only usesStyleRef, recordFile, FIRST_NAME, readStyleRef, approvedRef, styleRefProblems are ported (read-only)
//   change: the first-file run, the review images and the decision record are NOT ported: a style-reference product fails closed
//   change: job folders are data/jobs/<id>/ with outbox/ inside (were room1-etsy/work/<id>/ and outbox/<id>/)
// Everything else is the source unchanged. PORTED.md lists every ported file; npm run port-drift checks the source.
import fs from 'node:fs';
import path from 'node:path';
import { sha256 } from './common.mjs';

export const usesStyleRef = (product) => !!(product && product.styleReference && product.styleReference.ownerOk === true);
export const recordFile = (roomDir, id) => path.join(roomDir, 'jobs', id, 'style-ref.json');
export const FIRST_NAME = /^01-[a-z0-9][a-z0-9-]*\.png$/;

// { ok, record, current }: current = the latest decision ({ set, name, file, sha256, status: approved|rejected, decidedBy, date, reason? }) or null
export function readStyleRef(roomDir, id) {
  const f = recordFile(roomDir, id); if (!fs.existsSync(f)) return { ok: true, record: null, current: null };
  let rec; try { rec = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return { ok: false, reason: 'jobs/' + id + '/style-ref.json is not valid JSON' }; }
  const ds = Array.isArray(rec.decisions) ? rec.decisions : [];
  return { ok: true, record: rec, current: ds.length ? ds[ds.length - 1] : null };
}

// the approved reference, checked against the bytes on disk: { ok, ref } or { ok: false, reason }
export function approvedRef(roomDir, id) {
  const r = readStyleRef(roomDir, id); if (!r.ok) return r;
  if (!r.current) return { ok: false, reason: 'no style reference decision for ' + id + ': run node scripts/run-line.mjs ' + id + ' --first-file, then the owner decides (node scripts/style-ref.mjs ' + id + ' --approve | --reject "reason")' };
  if (r.current.status !== 'approved' || r.current.decidedBy !== 'owner') return { ok: false, reason: 'the latest style reference decision is "' + r.current.status + '"' + (r.current.reason ? ' (' + r.current.reason + ')' : '') + ': run --first-file again for a new file 1' };
  const f = path.join(roomDir, r.current.file);
  if (!fs.existsSync(f) || sha256(fs.readFileSync(f)) !== r.current.sha256) return { ok: false, reason: r.current.file + ' is missing or differs from the file the owner approved (style-ref.json sha256)' };
  return { ok: true, ref: r.current };
}

// package gate: a product with a style reference delivers the approved file 1 (the build's inputs carry its raw sha256)
export function styleRefProblems({ roomDir, id, product, build }) {
  if (!usesStyleRef(product)) return [];
  const a = approvedRef(roomDir, id); if (!a.ok) return [a.reason];
  const inp = ((build && build.inputs) || []).find((x) => x.name === a.ref.name);
  if (!inp) return ['the build has no ' + a.ref.name + ': file 1 must be the owner-approved style reference'];
  if (inp.sha256 !== a.ref.sha256) return [a.ref.name + ' in the build is not the file the owner approved (sha256 differs)'];
  return [];
}

// NOT PORTED: firstFileOf, makeReviewImages, recordDecision, ensureStyleRefInSet (the first-file run mode, the review images built with
// Real-ESRGAN, and the owner's decision record). Nothing in the engine writes style-ref.json, so styleRefProblems refuses every
// style-reference product at the package gate: it fails closed until the owner decides how this workflow runs in the engine.
