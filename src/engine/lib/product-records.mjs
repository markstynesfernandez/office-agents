// lib/product-records.mjs — R4 (RESTRUCTURE.md §2.2, §3.1, §8 R4): Product & Design's records, checked by the engine. Pure, no model,
// no network. Every file is under data/products/<id>/product/ (the roadmap and the owner's ideas) or products/<id>/design/<job-id>/.
//   roadmap draft     PRODUCT-MANAGER's roadmap-draft.md, checked when it is written (parseRoadmap): the heading, ## Now, ## Next and
//                     ## Later, items RM1..RMn in order, each with Why, Outcome and Size. The engine files it as a roadmap.approve request
//                     (its text is the payload; the owner decides it in the Owner's office)
//   approved roadmap  roadmap.md, written by the engine from the approved request's payload, and roadmap-decisions.jsonl (each owner
//                     decision with the text's sha256). A roadmap is approved only while roadmap.md is the text of the latest approval
//                     (approvedRoadmap; a hand edit is no longer approved)
//   issues draft      PRODUCT-MANAGER's issues-draft.json (pmIssuesProblems): 1..MAX_PM_ISSUES issues, each on an item of the approved
//                     roadmap; the engine writes each into the backlog (lib/eng-records.mjs composeIssue, by product-manager)
//   ideas             the owner's ideas for PRODUCT-MANAGER, ideas.jsonl (append only; the owner's page session)
//   design spec       DESIGNER's design.md in a design job's folder (designProblems): flow, states, copy and acceptance notes
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const PD_KINDS = ['pm-roadmap', 'pm-issues', 'design-spec'];
export const HORIZONS = ['Now', 'Next', 'Later'];
export const SIZES = ['small', 'medium', 'large'];
export const DESIGN_SECTIONS = ['Flow', 'States', 'Copy', 'Acceptance notes'];
// proposals (R4): the most items a roadmap holds, the most issues one PRODUCT-MANAGER run writes, the records' sizes
export const MAX_ITEMS = 15, MAX_PM_ISSUES = 5, MAX_ROADMAP_CHARS = 20000, MAX_DESIGN_CHARS = 30000, MAX_IDEA_CHARS = 2000;
const sha256 = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const norm = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
const lines = (t) => String(t || '').replace(/\r\n/g, '\n').split('\n');

export const productDir = (dataRoot, productId) => path.join(dataRoot, 'products', productId, 'product');
export const roadmapFile = (dataRoot, productId) => path.join(productDir(dataRoot, productId), 'roadmap.md');
export const roadmapDecisionsFile = (dataRoot, productId) => path.join(productDir(dataRoot, productId), 'roadmap-decisions.jsonl');
export const ideasFile = (dataRoot, productId) => path.join(productDir(dataRoot, productId), 'ideas.jsonl');
export const designDir = (dataRoot, productId, jobId) => path.join(dataRoot, 'products', productId, 'design', jobId);
export const ROADMAP_DRAFT = 'roadmap-draft.md', ISSUES_DRAFT = 'issues-draft.json', DESIGN_FILE = 'design.md';

const readJsonl = (f) => { if (!fs.existsSync(f)) return []; return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean); };

// ---- the roadmap: -> { ok, problems, items: [{ id, title, horizon, why, outcome, size }] }
export function parseRoadmap(text, { product = null } = {}) {
  const t = String(text || ''), ls = lines(t), bad = [], items = [];
  if (t.length > MAX_ROADMAP_CHARS) bad.push('the roadmap is ' + t.length + ' characters; keep it under ' + MAX_ROADMAP_CHARS);
  if (product && ls[0].trim() !== '# Roadmap ' + product) bad.push('the first line must be "# Roadmap ' + product + '"');
  const heads = ls.map((l, i) => ({ l: l.trim(), i })).filter((x) => /^## /.test(x.l));
  for (const h of HORIZONS) if (!heads.some((x) => x.l === '## ' + h)) bad.push('the section "## ' + h + '" is missing (write "(nothing)" under it when it is empty)');
  for (const h of heads) {
    const name = h.l.slice(3).trim(); if (!HORIZONS.includes(name)) continue;
    const end = (heads.find((x) => x.i > h.i) || { i: ls.length }).i, part = ls.slice(h.i + 1, end);
    const blocks = []; for (const l of part) { if (/^### /.test(l.trim())) blocks.push({ head: l.trim().slice(4).trim(), body: [] }); else if (blocks.length) blocks[blocks.length - 1].body.push(l); }
    for (const b of blocks) {
      const want = 'RM' + (items.length + 1), m = /^RM(\d+):\s*(.+)$/.exec(b.head);
      if (!m || 'RM' + m[1] !== want) { bad.push('item ' + (items.length + 1) + ' must be headed "### ' + want + ': <title>" (items are numbered in order, across the sections)'); items.push({ id: want, title: '', horizon: name, why: '', outcome: '', size: null }); continue; }
      const field = (k) => { const x = b.body.find((l) => new RegExp('^' + k + ':', 'i').test(l.trim())); return x ? x.trim().slice(k.length + 1).trim() : ''; };
      const it = { id: want, title: m[2].trim(), horizon: name, why: field('Why'), outcome: field('Outcome'), size: field('Size').toLowerCase() };
      if (it.title.length < 3 || it.title.length > 100) bad.push(want + ': a title of 3 to 100 characters');
      if (!it.why || it.why.length > 600) bad.push(want + ' needs "Why: …" (1 to 600 characters: the problem, for whom)');
      if (!it.outcome || it.outcome.length > 600) bad.push(want + ' needs "Outcome: …" (1 to 600 characters: what is true when it is done)');
      if (!SIZES.includes(it.size)) bad.push(want + ' needs "Size: small", "Size: medium" or "Size: large"');
      items.push(it);
    }
  }
  if (!items.length) bad.push('at least one item ("### RM1: <title>" under ## Now, ## Next or ## Later)');
  if (items.length > MAX_ITEMS) bad.push(items.length + ' items: at most ' + MAX_ITEMS + ' (a roadmap is a short list of outcomes, not a backlog)');
  const dup = items.map((i) => norm(i.title)).filter((x, i, a) => x && a.indexOf(x) !== i); if (dup.length) bad.push('two items have the same title: ' + [...new Set(dup)].join(', '));
  return { ok: !bad.length, problems: bad, items };
}
export const readRoadmapDecisions = (dataRoot, productId) => readJsonl(roadmapDecisionsFile(dataRoot, productId));
// the approved roadmap of a product, or null: roadmap.md must be the text of the latest approval (its sha256)
export function approvedRoadmap(dataRoot, productId) {
  const f = roadmapFile(dataRoot, productId); if (!fs.existsSync(f)) return null;
  const text = fs.readFileSync(f, 'utf8'), d = readRoadmapDecisions(dataRoot, productId).filter((x) => x.decision === 'approve').pop();
  if (!d || d.sha256 !== sha256(text)) return null;
  return { text, sha256: d.sha256, items: parseRoadmap(text).items, requestId: d.requestId || null, jobId: d.jobId || null, approvedAt: d.at, words: d.words || null };
}
// is an issue's roadmap item ({ id, title }) on this approved roadmap (same id, same title)?
export const onRoadmap = (item, roadmap) => !!(item && roadmap && roadmap.items.some((i) => i.id === item.id && norm(i.title) === norm(item.title)));

// ---- PRODUCT-MANAGER's issues: { product, issues: [{ roadmapItem, title, problem, acceptance, notes }] } -> problems[] (empty: it holds)
export function pmIssuesProblems(text, { productId, roadmap = null, existing = [] } = {}) {
  let q; try { q = JSON.parse(text); } catch (e) { return [ISSUES_DRAFT + ' is not valid JSON: ' + e.message]; }
  if (!roadmap) return ['there is no approved roadmap for ' + productId + ': issues are written only for items on the roadmap the owner approved'];
  const bad = [];
  if (!q || typeof q !== 'object' || Array.isArray(q)) return [ISSUES_DRAFT + ' must be an object: { "product", "issues": [ { "roadmapItem", "title", "problem", "acceptance", "notes" } ] }'];
  if (q.product !== productId) bad.push('"product" must be "' + productId + '"');
  if (!Array.isArray(q.issues) || !q.issues.length) return [...bad, '"issues" must be a list of 1 to ' + MAX_PM_ISSUES + ' issues'];
  if (q.issues.length > MAX_PM_ISSUES) bad.push(q.issues.length + ' issues: at most ' + MAX_PM_ISSUES + ' in one run');
  const taken = new Set(existing.filter((i) => !['rejected', 'withdrawn'].includes(i.state)).map((i) => norm(i.title)));
  q.issues.forEach((x, i) => {
    const at = 'issues[' + i + ']';
    if (!x || typeof x !== 'object' || Array.isArray(x)) { bad.push(at + ' must be an object'); return; }
    for (const k of Object.keys(x)) if (!['roadmapItem', 'title', 'problem', 'acceptance', 'notes'].includes(k)) bad.push(at + ' has an unknown field "' + k + '"');
    const it = roadmap.items.find((r) => r.id === x.roadmapItem);
    if (!it) bad.push(at + '.roadmapItem must be an item of the approved roadmap (' + roadmap.items.map((r) => r.id).join(', ') + '), not ' + JSON.stringify(x.roadmapItem));
    const t = String(x.title || '').replace(/\s+/g, ' ').trim(), p = String(x.problem || '').trim(), a = String(x.acceptance || '').trim(), n = String(x.notes || '').trim();
    if (t.length < 5 || t.length > 120) bad.push(at + '.title: 5 to 120 characters');
    else if (taken.has(norm(t))) bad.push(at + ': an open issue is already titled "' + t + '"'); else taken.add(norm(t));
    if (p.length < 20 || p.length > 6000) bad.push(at + '.problem: what and why, 20 to 6,000 characters');
    if (!a || a.length > 4000) bad.push(at + '.acceptance: acceptance hints, one per line (1 to 4,000 characters; TECH-LEAD turns them into AC1, AC2 …)');
    if (n.length > 4000) bad.push(at + '.notes: under 4,000 characters');
  });
  return bad;
}

// ---- the owner's ideas
export const readIdeas = (dataRoot, productId) => readJsonl(ideasFile(dataRoot, productId));

// ---- DESIGNER's spec -> problems[] (empty: it holds)
export function designProblems(text, { title = null } = {}) {
  const t = String(text || ''), bad = [];
  if (t.length > MAX_DESIGN_CHARS) bad.push('the spec is ' + t.length + ' characters; keep it under ' + MAX_DESIGN_CHARS);
  if (title && lines(t)[0].trim() !== '# Design: ' + title) bad.push('the first line must be "# Design: ' + title + '"');
  const have = lines(t).filter((l) => /^## /.test(l)).map((l) => l.slice(3).trim());
  for (const s of DESIGN_SECTIONS) if (!have.includes(s)) bad.push('the section "## ' + s + '" is missing');
  return bad;
}
