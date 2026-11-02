// product.mjs — R4 (RESTRUCTURE.md §2.2, §3.1, §8 R4): Product & Design at work, on floor 3. Three one-agent lines, run by the engineering
// module's side-line runner (engineering.mjs addRunner: start, stop, resume, archive and the running-jobs limit are the CTO triage's):
//   pm-roadmap   PRODUCT-MANAGER drafts a product's roadmap: the engine writes inputs-<stamp>.json (the approved roadmap, the backlog, the
//                owner's ideas, the CEO's priorities for the product; no request text, ticket or named contact), PRODUCT-MANAGER writes
//                roadmap-draft.md (checked on write: lib/product-records.mjs parseRoadmap), and the engine files it as a roadmap.approve
//                request (its text the payload). The job waits in "approval"; the owner decides it in the Owner's office. On approval the
//                engine writes the payload as the product's roadmap.md (its sha256 recorded); a newer draft voids an older pending one
//   pm-issues    PRODUCT-MANAGER writes backlog issues for items of the approved roadmap (issues-draft.json, checked on write); the engine
//                writes each into the backlog (backlog.write, auto) with a "filed" record. Owner, 02/11/2026: such an issue needs no
//                second approval while its item stays on the approved roadmap; the CTO may assign it; the owner may reject or withdraw it
//   design-spec  DESIGNER writes design.md for one issue from the issue and a read-only snapshot of the product's UI files at main (the
//                engine fetches the mirror and copies config/products/<id>.json uiPaths into ui/); TECH-LEAD gets the latest spec of
//                its issue in the engineering job's input (engineering.mjs startIssue). DESIGNER has no path to a live site: its tools
//                are fs_read, fs_list and fs_write in the design job's folder (site.change stays the owner's and no tool performs it)
// Who starts one: the owner on the page, behind the spend confirmation (no routine in R4). The owner's ideas for PRODUCT-MANAGER are free
// (addIdea). Every call goes through the spend guard, the e-stop, the policy and the locked rules (runtime.mjs).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { runAgent, effectiveAgent } from './runtime.mjs';
import { dublinDay } from './time.mjs';
import { fetchMirror, showAtMain, listAtMain } from './lib/repo.mjs';
import { composeIssue, readIssue, listIssues, stateOf, issueFile, decisionsFile } from './lib/eng-records.mjs';
import { PD_KINDS, parseRoadmap, approvedRoadmap, readRoadmapDecisions, roadmapFile, roadmapDecisionsFile, pmIssuesProblems, readIdeas, ideasFile, designProblems, productDir, designDir, ROADMAP_DRAFT, ISSUES_DRAFT, DESIGN_FILE, MAX_IDEA_CHARS } from './lib/product-records.mjs';
import { MEMOS_DIR } from './lib/exec-inputs.mjs';
import { secretContentHits, secretPathHit } from './lib/secrets.mjs';
import { foreignDataHits } from './business.mjs';

export const PD = {
  roadmap: { kind: 'pm-roadmap', line: 'pm-roadmap', agent: 'product-manager', title: 'Roadmap draft' },
  issues: { kind: 'pm-issues', line: 'pm-issues', agent: 'product-manager', title: 'Backlog issues' },
  design: { kind: 'design-spec', line: 'design-spec', agent: 'ux-designer', title: 'Design spec' }
};
export const DEPT = 'product-design';
// the UI snapshot DESIGNER reads (proposals, R4): text files with these extensions only, each at most UI_FILE_CHARS, all at most UI_TOTAL_CHARS
export const UI_EXT = /\.(html?|css|js|mjs|jinja2?|j2|svg)$/i, UI_FILE_CHARS = 60000, UI_TOTAL_CHARS = 200000, UI_MAX_FILES = 40;
const refuse = (msg, code = 'PRODUCT') => Object.assign(new Error(msg), { code });
const sha256 = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
const readText = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch (_) { return null; } };
const clip = (t, n) => (t == null ? null : t.length > n ? t.slice(0, n) + '\n… [' + (t.length - n) + ' more characters in the file]' : t);
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const r6 = (n) => Math.round((n || 0) * 1e6) / 1e6;

export function createProductDesign(engine, { now = () => Date.now(), env = process.env, git = {} } = {}) {
  const { store, bus, log, cfg, J, halt, ledger } = engine, C = engine.company, E = engine.engineering, dataRoot = J.dataRoot;
  const GIT = { runner: git.runner, timeoutMs: git.timeoutMs, fetchTimeoutMs: git.fetchTimeoutMs };
  const owner = (actor) => !!(engine.requests && engine.requests.isOwner(actor));
  const kindOf = (job) => Object.keys(PD).find((k) => PD[k].kind === job.kind) || null;
  const agentName = (k) => (cfg.agents[k] || {}).name || k;
  const lineProducts = (k) => ((cfg.lines[PD[k].line] || {}).products || []);
  const jobCapOf = (pid) => { const p = C.product(pid) || {}, base = cfg.engine.caps.perJobUsd, dc = (p.jobCapUsdByDepartment || {})[DEPT]; return dc > 0 && dc < base ? dc : base; };
  const pendingRoadmap = (pid) => (engine.requests ? engine.requests.list({ status: 'pending', limit: 500 }).filter((r) => r.action === 'roadmap.approve' && r.product_id === pid) : []);

  // ---- why a run cannot start now -> problems[] (empty: it can)
  function startProblems(k, { productId, issueId = null } = {}) {
    const x = PD[k]; if (!x) return ['no such Product & Design run: ' + k];
    const out = [], st = C.agentStatus(x.agent), name = agentName(x.agent), p = C.product(productId);
    if (st !== 'active') out.push(name + ' is ' + (st === 'not-hired' ? 'not hired yet' : st));
    else if (!effectiveAgent(engine, x.agent).enabled) out.push(name + ' is off duty');
    if (!cfg.lines[x.line]) return [...out, 'no ' + x.line + ' line in config/lines'];
    if (!p) return [...out, 'no such product: ' + productId];
    if (p.status !== 'active') out.push(p.name + ' is ' + p.status);
    if (!lineProducts(k).includes(p.id)) out.push('the ' + x.line + ' line does not serve ' + p.name + ' (config/lines/' + x.line + '.json products)');
    const hold = engine.lineHold ? engine.lineHold(x.line) : null; if (hold) out.push(hold);
    const open = store.listJobs({ states: ['queued', 'running'] }).find((j) => j.kind === x.kind && j.product_id === p.id && (k !== 'design' || (j.data && j.data.issueId === issueId)));
    if (open) out.push(name + '\'s job ' + open.id + ' is already ' + open.state);
    if (k === 'issues' && !approvedRoadmap(dataRoot, p.id)) out.push(p.name + ' has no approved roadmap: draft one and approve it in the Owner\'s office first');
    if (k === 'design') {
      const iss = readIssue(dataRoot, p.id, issueId);
      if (!iss) out.push('no such issue: ' + issueId);
      else { const s = stateOf(dataRoot, p.id, iss).state; if (['rejected', 'withdrawn'].includes(s)) out.push('the issue is ' + s); }
      if (!(p.uiPaths || []).length) out.push(p.name + ' has no uiPaths in config/products/' + p.id + '.json: DESIGNER has no UI to read');
      if (!p.localRepoEnv || !env[p.localRepoEnv]) out.push((p.localRepoEnv || 'localRepoEnv') + ' is not set: the Station has no clone of ' + (p.repo || p.id) + ' to read the UI from');
    }
    return out;
  }

  // ---- a start: the owner on the page only (no routine in R4); a script starts none unless it starts jobs
  function start(k, { productId, issueId = null, by = 'owner (office)' } = {}, { actor } = {}) {
    const x = PD[k]; if (!x) throw refuse('no such Product & Design run: ' + k, 'BAD_REQUEST');
    if (!owner(actor)) throw refuse('a ' + x.title.toLowerCase() + ' run is started by the owner, on the page', 'LOCKED');
    if (halt.isHalted()) throw refuse('e-stop is on', 'HALTED');
    if (engine.scriptRun && !engine.scriptRun.startsJobs) throw refuse('no job starts from this script (' + engine.scriptRun.purpose + ')', 'SCRIPT');
    const probs = startProblems(k, { productId, issueId }); if (probs.length) throw refuse('the ' + x.title.toLowerCase() + ' cannot start: ' + probs.join('; '), /not hired/.test(probs[0]) ? 'NOT_HIRED' : 'BAD_REQUEST');
    const p = C.product(productId), t = now(), st = stamp(t);
    let id = k === 'design' ? 'design-' + issueId : x.line + '-' + p.id + '-' + st, n = 2; while (store.getJob(id)) id = (k === 'design' ? 'design-' + issueId : x.line + '-' + p.id + '-' + st) + '-' + n++;
    const title = x.title + ' · ' + (k === 'design' ? readIssue(dataRoot, p.id, issueId).title : p.name);
    store.insertJob({ id, line: x.line, kind: x.kind, title, state: 'queued', step: cfg.lines[x.line].start, product_id: p.id, department_id: C.deptOfAgent(x.agent) || DEPT, data: { pd: k, productId: p.id, issueId, stamp: st, createdBy: by } });
    bus.emit('job.created', { jobId: id, data: { line: x.line, title, by } });
    log.info('product & design job created', { id, run: k, productId: p.id, issueId, by });
    if (engine.scriptRun) engine.scriptRun.own.add(id);
    return { jobId: id, promise: E.start(id) };
  }

  // ---- what PRODUCT-MANAGER sees: the engine's records about one product (no request text, ticket, customer record or named contact)
  function pmInputs(p, k) {
    const rm = approvedRoadmap(dataRoot, p.id), pend = pendingRoadmap(p.id)[0] || null;
    const issues = listIssues(dataRoot, p.id).map((i) => ({ id: i.id, title: i.title, state: i.state, by: i.by, roadmapItem: i.roadmapItem }));
    const js = store.listJobs().filter((j) => j.product_id === p.id && ['engineering', 'eng-triage'].includes(j.kind) && j.state !== 'archived'), byState = {};
    for (const j of js) byState[j.state] = (byState[j.state] || 0) + 1;
    // the CEO's priorities for this product: its "### <product>" block of the latest memo
    const mdir = path.join(dataRoot, MEMOS_DIR), memos = fs.existsSync(mdir) ? fs.readdirSync(mdir).filter((n) => /^\d{4}-W\d{2}(-\d+)?\.md$/.test(n)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) : [];
    let ceo = null;
    if (memos.length) { const ls = (readText(path.join(mdir, memos[memos.length - 1])) || '').split('\n'), i = ls.findIndex((l) => l.trim().toLowerCase() === '### ' + p.name.toLowerCase()); if (i >= 0) { const j = ls.findIndex((l, n) => n > i && /^#{2,3} /.test(l)); ceo = { memo: memos[memos.length - 1].slice(0, -3), text: clip(ls.slice(i + 1, j < 0 ? undefined : j).join('\n').trim(), 3000) }; } }
    const status = (key, phase, what) => (C.agentStatus(key) === 'active' ? { status: 'active', note: what } : { status: 'none yet', note: agentName(key) + ' is hired in ' + phase });
    return {
      run: k, product: { id: p.id, name: p.name, status: p.status, repo: p.repo || null, engineering: ((cfg.lines.engineering || {}).products || []).includes(p.id) }, generatedAt: new Date(now()).toISOString(),
      approvedRoadmap: rm ? { text: rm.text, items: rm.items, approvedAt: rm.approvedAt } : null, pendingRoadmap: pend ? { requestId: pend.id, filedAt: new Date(pend.filed_at).toISOString() } : null,
      issues, engineeringJobs: { byState, waitingForOwner: js.filter((j) => j.state === 'approval').length },
      ideas: readIdeas(dataRoot, p.id).slice(-30).map((i) => ({ id: i.id, at: i.at, text: i.text })), ceoPriorities: ceo,
      customerSuccess: status('support-drafter', 'R6', 'support and onboarding signals'), analyst: status('analyst', 'R6', 'aggregates'),
      excluded: 'never here: a request\'s text or payload, support tickets, customer records, outreach drafts or any named contact'
    };
  }

  // ---- the run (engineering.mjs calls it with its kit: setJob, block, stopFrom, agentWait, mockOnLive)
  async function run(id, signal, kit) {
    let job = kit.setJob(id, { state: 'running', started_at: store.getJob(id).started_at || now(), reason: null, data: { next: false } }, 'job.stage', { step: store.getJob(id).step });
    const k = kindOf(job); if (!k) return kit.block(job, 'not a Product & Design job: ' + job.kind);
    const x = PD[k], L = cfg.lines[x.line], p = C.product(job.product_id);
    if (!p) return kit.block(job, 'no such product: ' + job.product_id);
    const dir = k === 'design' ? designDir(dataRoot, p.id, id) : productDir(dataRoot, p.id);
    // 1. the engine's step (no model, no cost): the inputs file, or the design job's folder (the issue and the UI snapshot)
    const inStep = L.start, inDef = L.steps[inStep] || {};
    const sid = store.tx(() => { const s = store.openStage(id, inStep, 1); store.updateJob(id, { step: inStep }); return s; });
    bus.emit('job.stage', { jobId: id, data: { step: inStep, pass: 1, kind: 'mechanical' } });
    let prep;
    try { prep = k === 'design' ? await designFolder(job, p, dir, signal) : pmFolder(job, p, k, dir); }
    catch (e) { const why = e && e.code === 'GIT_TIMEOUT' ? 'git timeout: ' + e.message : e.message; store.closeStage(sid, 'blocked', why); return kit.block(store.getJob(id), (k === 'design' ? 'the UI could not be read: ' : 'the inputs could not be gathered: ') + why); }
    if (prep.blocked) { store.closeStage(sid, 'blocked', prep.blocked); return kit.block(store.getJob(id), prep.blocked); }
    store.closeStage(sid, 'done', prep.note);
    store.updateJob(id, { data: prep.data });
    // 2. the agent
    const step = inDef.next, def = L.steps[step] || {};
    job = store.updateJob(id, { step });
    const wait = kit.agentWait(job, def.agent); if (wait) return wait;
    if (kit.mockOnLive(id)) return kit.setJob(id, { state: 'stopped', reason: 'stopped before ' + step + ': the job has live spend and this engine runs the mock provider', ended_at: now() }, 'job.stopped');
    const file = k === 'roadmap' ? ROADMAP_DRAFT : k === 'issues' ? ISSUES_DRAFT : DESIGN_FILE, abs = path.join(dir, file), before = fs.existsSync(abs) ? fs.statSync(abs).mtimeMs : 0;
    const sid2 = store.tx(() => store.openStage(id, step, 1));
    bus.emit('job.stage', { jobId: id, agentKey: def.agent, data: { step, pass: 1, kind: 'agent' } });
    const issueTitle = k === 'design' ? (readIssue(dataRoot, p.id, job.data.issueId) || {}).title : null;
    const check = (t) => { const fd = foreignDataHits(t, cfg); return fd.length ? ['the text names another company (' + fd.join(', ') + '); its data never enters the Station'] : []; };
    const validators = { [file]: k === 'roadmap' ? (t) => [...parseRoadmap(t, { product: p.name }).problems, ...check(t)] : k === 'issues' ? (t) => [...pmIssuesProblems(t, { productId: p.id, roadmap: approvedRoadmap(dataRoot, p.id), existing: listIssues(dataRoot, p.id) }), ...check(t)] : (t) => [...designProblems(t, { title: issueTitle }), ...check(t)] };
    const input = inputFor(k, p, prep, file, issueTitle);
    const contract = { tool: 'fs_write', partialOk: false, hint: 'Write ' + file + ' with fs_write (it is checked when written).', check: () => (fs.existsSync(abs) && fs.statSync(abs).mtimeMs > before ? { want: 1, have: 1, missing: [] } : { want: 1, have: 0, missing: [file] }) };
    const folderLabel = k === 'design' ? 'the design job folder of ' + id + ' (issue.md, ui/: the product\'s UI files at main, read only, and your ' + DESIGN_FILE + ')' : 'the product folder of ' + p.name + ' (products/' + p.id + '/product: the engine\'s inputs-<stamp>.json, the approved roadmap.md, your ' + file + ')';
    const r = await runAgent(engine, { agentKey: def.agent, job: store.getJob(id), step, pass: 1, folder: dir, folderLabel, input, line: job.line, runCapUsd: null, stopSignal: signal, contract, exec: { writeAction: k === 'design' ? 'design.write' : 'draft.write', wrapper: 'product' }, validators, writes: [file] });
    const stop = kit.stopFrom(r, agentName(def.agent));
    store.closeStage(sid2, stop ? (stop.stopped ? 'stopped' : stop.incomplete ? 'incomplete' : 'blocked') : 'done', stop ? stop.stopped || stop.blocked || stop.incomplete : file + ' written');
    if (stop) { if (stop.stopped) return kit.setJob(id, { state: 'stopped', reason: stop.stopped, ended_at: now() }, 'job.stopped'); return kit.block(store.getJob(id), stop.blocked || stop.incomplete, { state: stop.incomplete ? 'incomplete' : 'blocked' }); }
    // 3. the record as written, checked once more (a file changed outside the run is caught here), then the engine's part
    const text = readText(abs) || '', probs = validators[file](text);
    if (probs.length) return kit.block(store.getJob(id), file + ' does not hold: ' + probs.join('; '));
    if (k === 'roadmap') return fileRoadmap(id, p, text, kit);
    if (k === 'issues') return writeIssues(id, p, text, kit);
    bus.emit('design.written', { jobId: id, agentKey: def.agent, data: { productId: p.id, issueId: job.data.issueId, file: path.relative(dataRoot, abs).split(path.sep).join('/') } });
    return kit.setJob(id, { state: 'done', reason: 'design spec written for ' + job.data.issueId + ': TECH-LEAD gets it when the issue starts', ended_at: now(), data: { design: DESIGN_FILE, designSha256: sha256(text), costUsd: ledger.spent.job(id) } }, 'job.stage', { step: 'done' });
  }

  // the roadmap and issues runs: the engine's inputs file in the product folder
  function pmFolder(job, p, k, dir) {
    const inputs = pmInputs(p, k), text = JSON.stringify(inputs, null, 2) + '\n', sh = secretContentHits(text);
    if (sh.length) return { blocked: 'refused by a locked rule (secrets-refused): the inputs hold what looks like a secret (' + sh.join(', ') + '); nothing was given to PRODUCT-MANAGER' };
    if (k === 'issues' && !inputs.approvedRoadmap) return { blocked: p.name + ' has no approved roadmap (it changed after the start): nothing was given to PRODUCT-MANAGER' };
    const rel = 'inputs-' + job.data.stamp + '.json';
    J.put(path.join(dir, rel), text);
    return { note: rel, data: { inputs: rel }, inputs, rel };
  }
  // the design run: the mirror fetched, the issue and the UI files at main copied into the job folder (read only for DESIGNER)
  async function designFolder(job, p, dir, signal) {
    const iss = readIssue(dataRoot, p.id, job.data.issueId); if (!iss) return { blocked: 'no such issue: ' + job.data.issueId };
    const engineActor = { kind: 'engine' }, sig = AbortSignal.any([halt.signal, signal]);
    const f = await engine.actions.perform({ action: 'repo.fetch', actor: engineActor, productId: p.id, departmentId: job.department_id, jobId: job.id, summary: 'fetch ' + p.id + ' main into the Station\'s mirror (the UI for DESIGNER)', execute: () => fetchMirror({ J, product: p, signal: sig, env, ...GIT }) });
    const head = f.result.head, files = [], skipped = [];
    let total = 0;
    const walk = async (rel, depth) => {
      const entries = await listAtMain({ J, productId: p.id, dir: rel, signal: sig, ...GIT });
      if (entries == null) { skipped.push({ path: rel, why: 'not a folder at main' }); return; }
      for (const e of entries) {
        const pth = rel + '/' + e.replace(/\/$/, '');
        if (e.endsWith('/')) { if (depth < 3) await walk(pth, depth + 1); else skipped.push({ path: pth + '/', why: 'deeper than 3 folders' }); continue; }
        if (!UI_EXT.test(pth)) { skipped.push({ path: pth, why: 'not a UI text file' }); continue; }
        if (secretPathHit(pth)) { skipped.push({ path: pth, why: 'a secret file by its path' }); continue; }
        if (files.length >= UI_MAX_FILES) { skipped.push({ path: pth, why: 'over ' + UI_MAX_FILES + ' files' }); continue; }
        const t = await showAtMain({ J, productId: p.id, file: pth, signal: sig, ...GIT });
        if (t == null) { skipped.push({ path: pth, why: 'not readable at main' }); continue; }
        if (t.length > UI_FILE_CHARS) { skipped.push({ path: pth, why: t.length + ' characters, over ' + UI_FILE_CHARS }); continue; }
        if (total + t.length > UI_TOTAL_CHARS) { skipped.push({ path: pth, why: 'over the ' + UI_TOTAL_CHARS + ' characters of the snapshot' }); continue; }
        if (secretContentHits(t).length || foreignDataHits(t, cfg).length) { skipped.push({ path: pth, why: 'holds what looks like a secret or another company\'s data' }); continue; }
        J.put(path.join(dir, 'ui', ...pth.split('/')), t); files.push({ path: pth, chars: t.length }); total += t.length;
      }
    };
    for (const u of p.uiPaths || []) { const rel = String(u).replace(/^\/+|\/+$/g, ''); if (!rel || rel.includes('..')) { skipped.push({ path: String(u), why: 'not a path inside the repo' }); continue; } await walk(rel, 1); }
    if (!files.length) return { blocked: 'no UI file to read at main (' + (p.uiPaths || []).join(', ') + '): ' + (skipped.map((s) => s.path + ' ' + s.why).join('; ') || 'nothing found') };
    J.put(path.join(dir, 'issue.md'), iss.text);
    J.put(path.join(dir, 'ui', 'manifest.json'), JSON.stringify({ product: p.id, commit: head, uiPaths: p.uiPaths, files, skipped, at: new Date(now()).toISOString() }, null, 2) + '\n');
    return { note: files.length + ' UI file(s) at ' + head.slice(0, 10) + (skipped.length ? ', ' + skipped.length + ' skipped' : ''), data: { commit: head, uiFiles: files.length, issueSha256: iss.sha256 }, files, skipped, head };
  }
  function inputFor(k, p, prep, file, issueTitle) {
    if (k === 'roadmap') return ['Roadmap draft for ' + p.name + '. The engine wrote ' + prep.rel + ' (read it first; it is your only source: the approved roadmap if there is one, the backlog, the owner\'s ideas, the CEO\'s priorities for ' + p.name + ').',
      'Write ' + file + ' with fs_write. The first line is "# Roadmap ' + p.name + '", then ## Now, ## Next and ## Later (write "(nothing)" under an empty one), each item "### RM<n>: <title>" numbered RM1, RM2 … in order across the sections, with the lines "Why: …", "Outcome: …" and "Size: small | medium | large". You may add ## Notes. At most 15 items.',
      'The owner approves the roadmap in the Owner\'s office; until then it is a draft. Never invent figures, customers or deadlines: write only what the inputs support, and say what is not known.',
      prep.inputs.approvedRoadmap ? 'There is an approved roadmap (in the inputs): keep the items that still stand with the same titles, so the issues written for them stay on the roadmap; say under ## Notes what you changed and why.' : 'There is no approved roadmap yet: this is the first draft.'].join('\n');
    if (k === 'issues') return ['Backlog issues for ' + p.name + ' from its approved roadmap. The engine wrote ' + prep.rel + ' (read it first: the approved roadmap and its items, the backlog as it is, the owner\'s ideas).',
      'Write ' + file + ' with fs_write: { "product": "' + p.id + '", "issues": [ { "roadmapItem": "RM<n>", "title": "…", "problem": "what and why, for whom", "acceptance": "acceptance hints, one per line", "notes": "optional" } ] }. 1 to 5 issues, each for an item of the approved roadmap (' + prep.inputs.approvedRoadmap.items.map((i) => i.id + ' ' + i.title).join('; ') + '), each small enough for one engineering job, none a copy of an open issue.',
      'An issue you write goes into the backlog without a second approval while its item stays on the approved roadmap; the CTO orders it and the owner starts each job. Write only what the roadmap and the inputs support.'].join('\n');
    return ['Design spec for the issue "' + issueTitle + '" on ' + p.name + '. issue.md is the issue. ui/ holds the product\'s current UI files at main (' + prep.head.slice(0, 10) + '), read only: ' + prep.files.map((f) => f.path).join(', ') + ' (ui/manifest.json lists them and what was left out).',
      'Read issue.md and the UI files it concerns. Write ' + file + ' with fs_write: the first line "# Design: ' + issueTitle + '", then ## Flow (the steps the user takes), ## States (empty, loading, error, success …), ## Copy (the exact words on screen), ## Acceptance notes (what TECH-LEAD can turn into acceptance criteria). You may add ## Open questions.',
      'A spec is a draft for Engineering: you change no code and no site. Keep to what the issue asks; name any decision only the owner can make under ## Open questions.'].join('\n');
  }

  // ---- the roadmap draft becomes a request in the Owner's office (a newer draft voids an older pending one)
  async function fileRoadmap(id, p, text, kit) {
    const items = parseRoadmap(text).items;
    for (const r of pendingRoadmap(p.id)) engine.requests.void(r.id, 'a newer roadmap draft for ' + p.name + ' was filed (job ' + id + ')');
    const res = await engine.actions.perform({ action: 'roadmap.approve', actor: { kind: 'engine' }, productId: p.id, departmentId: DEPT, jobId: id, summary: 'Roadmap for ' + p.name + ': ' + items.length + ' item' + (items.length === 1 ? '' : 's') + ' (PRODUCT-MANAGER\'s draft)', payload: text });
    if (!res.waiting) return kit.block(store.getJob(id), 'the roadmap request was not filed as a request waiting for the owner');
    return kit.setJob(id, { state: 'approval', reason: 'waiting for the owner: roadmap request ' + res.requestId + ' in the Owner\'s office (' + items.length + ' items)', ended_at: now(), data: { requestId: res.requestId, draftSha256: sha256(text), items: items.length, costUsd: ledger.spent.job(id) } }, 'job.queued-for-approval', { requests: [{ action: 'roadmap.approve', requestId: res.requestId }] });
  }
  // ---- PRODUCT-MANAGER's issues into the backlog (backlog.write, auto): each a file and its "filed" record
  async function writeIssues(id, p, text, kit) {
    const q = JSON.parse(text), rm = approvedRoadmap(dataRoot, p.id), day = dublinDay(now()), written = [];
    for (const x of q.issues) {
      const it = rm.items.find((i) => i.id === x.roadmapItem);
      const c = composeIssue({ title: x.title, problem: x.problem, acceptance: x.acceptance, notes: x.notes || '', model: 'default', productId: p.id, day, by: 'product-manager', roadmapItem: { id: it.id, title: it.title } });
      if (!c.ok) return kit.block(store.getJob(id), 'issue "' + x.title + '" does not hold: ' + c.problems.join('; ') + (written.length ? ' (written before it: ' + written.join(', ') + ')' : ''));
      const sh = secretContentHits(c.text); if (sh.length) return kit.block(store.getJob(id), 'refused by a locked rule (secrets-refused): issue "' + x.title + '" holds what looks like a secret (' + sh.join(', ') + ')' + (written.length ? ' (written before it: ' + written.join(', ') + ')' : ''));
      let iid = c.id, n = 2; while (fs.existsSync(issueFile(dataRoot, p.id, iid))) iid = c.id.slice(0, 60) + '-' + n++;
      const t = iid === c.id ? c.text : c.text.replace('id: ' + c.id, 'id: ' + iid);
      const rec = { at: new Date(now()).toISOString(), issueId: iid, productId: p.id, decision: 'filed', sha256: sha256(t), by: 'product-manager', roadmapItem: { id: it.id, title: it.title }, roadmapSha256: rm.sha256, jobId: id, words: 'written by PRODUCT-MANAGER for ' + it.id + ' of the approved roadmap' };
      await engine.actions.perform({ action: 'backlog.write', actor: { kind: 'agent', key: 'product-manager' }, productId: p.id, departmentId: DEPT, jobId: id, summary: 'issue ' + iid + ' for ' + it.id, payload: t, execute: () => { J.put(issueFile(dataRoot, p.id, iid), t); J.add(decisionsFile(dataRoot, p.id), JSON.stringify(rec) + '\n', { fsync: true }); } });
      bus.emit('issue.written', { jobId: id, agentKey: 'product-manager', data: { productId: p.id, issueId: iid, title: String(x.title).trim(), by: 'product-manager', roadmapItem: it.id } });
      written.push(iid);
    }
    log.info('issues written by PRODUCT-MANAGER', { jobId: id, productId: p.id, issues: written });
    return kit.setJob(id, { state: 'done', reason: written.length + ' issue(s) in the backlog of ' + p.name + ' (on the approved roadmap: no second approval; you can reject or withdraw any): ' + written.join(', '), ended_at: now(), data: { issues: written, costUsd: ledger.spent.job(id) } }, 'job.stage', { step: 'done' });
  }

  // ---- the owner's decision on a roadmap request: approved -> roadmap.md (the payload as approved); rejected or void -> the job ends
  function onDecided(ev) {
    const isVoid = ev.type === 'request.void';
    if (!(ev.type === 'request.decided' || isVoid) || !ev.data) return;
    const req = engine.requests.get(ev.data.requestId); if (!req || req.action !== 'roadmap.approve' || !req.job_id) return;
    const j = store.getJob(req.job_id); if (!j || j.kind !== PD.roadmap.kind || j.state !== 'approval' || !j.data || j.data.requestId !== req.id) return;
    const p = C.product(j.product_id), at = new Date(now()).toISOString();
    try {
      if (isVoid) { setJob(j.id, { state: 'archived', reason: 'superseded: ' + (ev.data.reason || 'the request was voided'), data: { autoStart: false } }, 'job.stage', { step: 'archived' }); return; }
      if (req.status === 'approved') {
        const text = readText(path.join(dataRoot, req.payload_file));
        if (text == null || sha256(text) !== req.payload_sha256) { blockJob(j, 'the approved roadmap\'s payload no longer matches its sha256: roadmap.md was not written'); return; }
        J.put(roadmapFile(dataRoot, p.id), text);
        J.add(roadmapDecisionsFile(dataRoot, p.id), JSON.stringify({ at, decision: 'approve', requestId: req.id, jobId: j.id, sha256: req.payload_sha256, words: req.decision_words || null, by: 'owner (office)' }) + '\n', { fsync: true });
        log.info('roadmap approved by the owner', { productId: p.id, requestId: req.id, jobId: j.id });
        bus.emit('roadmap.decided', { jobId: j.id, data: { productId: p.id, requestId: req.id, decision: 'approve' } });
        setJob(j.id, { state: 'approved', reason: 'the owner approved the roadmap (request ' + req.id + '): it is the roadmap of ' + p.name + ' now', ended_at: now() }, 'job.decided', { action: 'roadmap.approve', status: 'approved' });
      } else if (req.status === 'rejected') {
        J.add(roadmapDecisionsFile(dataRoot, p.id), JSON.stringify({ at, decision: 'reject', requestId: req.id, jobId: j.id, sha256: req.payload_sha256, words: req.decision_words || null, by: 'owner (office)' }) + '\n', { fsync: true });
        bus.emit('roadmap.decided', { jobId: j.id, data: { productId: p.id, requestId: req.id, decision: 'reject' } });
        setJob(j.id, { state: 'rejected_by_owner', reason: 'the owner rejected the roadmap draft (request ' + req.id + ')', ended_at: now() }, 'job.rejected', { action: 'roadmap.approve', status: 'rejected' });
      }
    } catch (e) { log.warn('roadmap decision not recorded on the job', { jobId: j.id, error: e.message }); }
  }
  // a job's state outside its run (the owner's decision arrives later): written first, event after, as engineering.mjs's setJob and block
  function setJob(id, patch, event, data = {}) { const j = store.updateJob(id, patch); if (event) bus.emit(event, { jobId: id, data: { state: j.state, step: j.step, reason: j.reason, ...data } }); return j; }
  function blockJob(job, reason) { log.warn('product & design job blocked', { jobId: job.id, reason }); return setJob(job.id, { state: 'blocked', reason, ended_at: now() }, 'job.blocked'); }
  const unsub = bus.subscribe(onDecided);

  // ---- the owner's idea for PRODUCT-MANAGER (free: nothing runs; it goes into the next run's inputs)
  function addIdea({ productId, text } = {}, { actor } = {}) {
    if (!owner(actor)) throw refuse('an idea for PRODUCT-MANAGER is the owner\'s, on the page', 'LOCKED');
    const p = C.product(productId); if (!p || !lineProducts('roadmap').includes(p.id)) throw refuse('PRODUCT-MANAGER does not draft a roadmap for ' + productId + ' (config/lines/pm-roadmap.json products)', 'BAD_REQUEST');
    const t = String(text || '').replace(/\r\n/g, '\n').trim();
    if (t.length < 10 || t.length > MAX_IDEA_CHARS) throw refuse('an idea of 10 to ' + MAX_IDEA_CHARS + ' characters', 'BAD_REQUEST');
    const fd = foreignDataHits(t, cfg); if (fd.length) throw refuse('refused by a building rule: the idea names another company (' + fd.join(', ') + '); its data never enters the Station', 'BAD_REQUEST');
    const sh = secretContentHits(t); if (sh.length) throw refuse('the idea holds what looks like a secret (' + sh.join(', ') + '): write it without it', 'BAD_REQUEST');
    const rec = { at: new Date(now()).toISOString(), id: 'I' + (readIdeas(dataRoot, p.id).length + 1), productId: p.id, text: t, by: 'owner (office)' };
    J.add(ideasFile(dataRoot, p.id), JSON.stringify(rec) + '\n', { fsync: true });
    log.info('idea added by the owner', { productId: p.id, id: rec.id });
    bus.emit('idea.added', { data: { productId: p.id, id: rec.id } });
    return rec;
  }

  // ---- the latest design spec of an issue (a done design job), for TECH-LEAD and the page -> { jobId, text, at, issueSha256, stale } | null
  function designFor(productId, issueId) {
    const j = store.listJobs().filter((x) => x.kind === PD.design.kind && x.product_id === productId && x.data && x.data.issueId === issueId && x.state === 'done').sort((a, b) => (b.ended_at || 0) - (a.ended_at || 0))[0];
    if (!j) return null;
    const text = readText(path.join(designDir(dataRoot, productId, j.id), DESIGN_FILE)); if (text == null) return null;
    const iss = readIssue(dataRoot, productId, issueId);
    return { jobId: j.id, text, at: j.ended_at || j.updated_at, issueSha256: j.data.issueSha256 || null, stale: !!(iss && j.data.issueSha256 && iss.sha256 !== j.data.issueSha256) };
  }

  // ---- the Owner's office and floor 3: per product, the approved roadmap, the draft waiting for the owner (its text), the ideas, the jobs
  function view({ maxChars = 16000 } = {}) {
    const who = (key) => { const a = cfg.agents[key] || {}; return { agent: key, name: a.name || key, status: a.status || null, onDuty: a.status === 'active' ? effectiveAgent(engine, key).enabled : false }; };
    const est = (k) => ((cfg.lines[PD[k].line] || {}).estimateUsd || {}).job ?? null;
    const products = [...new Set([...lineProducts('roadmap'), ...lineProducts('issues')])].map((pid) => C.product(pid)).filter(Boolean).map((p) => {
      const rm = approvedRoadmap(dataRoot, p.id), pend = pendingRoadmap(p.id)[0] || null, eng = lineProducts('issues').includes(p.id);
      const ptext = pend ? readText(path.join(dataRoot, pend.payload_file)) : null;
      const issues = eng ? listIssues(dataRoot, p.id) : [], count = {}; for (const i of issues) count[i.state] = (count[i.state] || 0) + 1;
      return {
        id: p.id, name: p.name, jobCapUsd: jobCapOf(p.id),
        roadmap: rm ? { items: rm.items, approvedAt: rm.approvedAt, requestId: rm.requestId, words: rm.words, text: clip(rm.text, maxChars) } : null,
        pending: pend ? { requestId: pend.id, version: pend.version, filedAt: pend.filed_at, jobId: pend.job_id, items: ptext ? parseRoadmap(ptext).items : [], text: clip(ptext, maxChars) } : null,
        decisions: readRoadmapDecisions(dataRoot, p.id).slice(-5),
        ideas: readIdeas(dataRoot, p.id).slice(-10).reverse(),
        backlog: eng ? { byState: count, fromPm: issues.filter((i) => i.by === 'product-manager').length, onRoadmap: issues.filter((i) => i.state === 'approved' && i.decision && i.decision.decision === 'filed').length } : null,
        canDraft: startProblems('roadmap', { productId: p.id }), canIssues: eng ? startProblems('issues', { productId: p.id }) : null,
        estimateUsd: { roadmap: est('roadmap'), issues: est('issues'), design: est('design') }
      };
    });
    const jobs = store.listJobs().filter((j) => PD_KINDS.includes(j.kind)).slice(0, 12).map((j) => ({ id: j.id, kind: j.kind, title: j.title, state: j.state, step: j.step, reason: j.reason, version: j.version, productId: j.product_id, issueId: (j.data || {}).issueId || null, costUsd: r6(ledger.spent.job(j.id)), updatedAt: j.updated_at, running: E.isActive(j.id) }));
    return { pm: who('product-manager'), designer: who('ux-designer'), products, jobs };
  }

  for (const k of Object.keys(PD)) E.addRunner(PD[k].kind, run);
  return { start, startProblems, addIdea, designFor, view, jobCapOf, lineOf: (k) => (PD[k] ? PD[k].line : null), kinds: PD, close: () => unsub() };
}
