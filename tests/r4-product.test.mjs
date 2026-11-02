// R4 tests (RESTRUCTURE.md §2.2, §3.1, §8 R4): Product & Design. Mock provider only ($0), the real config and prompts, a throwaway data
// root and a fixture clone of ReplyDesk (the engine only reads it). Nothing leaves the building.
//   1 the config: PRODUCT-MANAGER (Sonnet) and DESIGNER (Haiku) hired with fs tools only; three lines; ReplyDesk's UI paths; DESIGNER has
//     no path to a live site (site.change is the owner's, no tool performs it)
//   2 the roadmap: the inputs carry the owner's ideas and no request text; a draft that does not hold is NOT written; the draft becomes a
//     roadmap.approve request; the owner's approval writes roadmap.md (a hand edit is no longer approved); a newer draft voids an older one
//   3 issues: refused without an approved roadmap; an issue for an item not on it is NOT written; the issues on it are approved without a
//     second approval and the CTO may queue them; an item that leaves the roadmap takes its issues off (the CTO cannot assign them); the
//     owner's off-roadmap issue stays assignable; the owner can reject a PRODUCT-MANAGER issue
//   4 the design spec: the UI snapshot from main (UI files only), DESIGNER writes only design.md in its folder, a spec that does not hold is
//     NOT written; the spec reaches TECH-LEAD's input when the issue starts
//   5 the page: the spend quote (the product's Product & Design cap, the plan's estimate), the confirm token, the owner's session, the idea
//     (free, checked), a script's engine starts nothing
//   6 the views: the Owner's office, the Engineering panel, floor 3's boards and task box, the CEO's inputs
//   7 the records (pure): the roadmap parser, the issues check, the design check, the issue states
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { until, tempRoot } from './helpers/engine.mjs';
import { engineOn, serve, CONFIG, PROMPTS } from './helpers/r1.mjs';
import { tempBase, fixtureClone, fakeDocker, G, cloneState } from './helpers/r2.mjs';
import { loadConfig } from '../src/engine/config.mjs';
import { createEngine } from '../src/engine/engine.mjs';
import { TOOL_ACTIONS } from '../src/engine/policy.mjs';
import { buildEngineSnapshot } from '../src/server/engine-model.mjs';
import { createBuildingView } from '../src/web/ui/building.js';
import { panelHtml } from '../src/web/ui/eng-view.js';
import { screenContent, planFloor } from '../src/web/scene/towerplan.js';
import { floorWork } from '../src/web/ui/taskpanel.js';
import { ceoInputs } from '../src/engine/lib/exec-inputs.mjs';
import { parseRoadmap, approvedRoadmap, pmIssuesProblems, designProblems, onRoadmap, roadmapFile, productDir, designDir } from '../src/engine/lib/product-records.mjs';
import { composeIssue, readIssue, issueState, listIssues, devQueueProblems, queueFile } from '../src/engine/lib/eng-records.mjs';
import { dublinDay } from '../src/engine/time.mjs';

const REAL = loadConfig({ configDir: CONFIG, promptsDir: PROMPTS });

// ---- the mock Product & Design (one script; `opts` choose what each run does). env.dataRoot is set once the engine is open
const tool = (id, name, input) => ({ type: 'tool_use', id: 'tu_' + id, name, input });
const text = (t) => ({ type: 'text', text: t });
const turnOf = (params) => params.messages.filter((m) => m.role === 'assistant').length;
const lastResults = (params) => { const m = params.messages[params.messages.length - 1]; return Array.isArray(m.content) ? m.content.filter((b) => b.type === 'tool_result').map((b) => ({ id: b.tool_use_id, error: !!b.is_error, text: String(b.content) })) : []; };
// a roadmap draft: items [horizon, title], numbered RM1.. in order across Now, Next, Later
export function roadmap(name, items = [['Now', 'Faster first reply'], ['Next', 'Weekly digest email']]) {
  const out = ['# Roadmap ' + name]; let n = 0;
  for (const h of ['Now', 'Next', 'Later']) {
    const mine = items.filter((i) => i[0] === h); out.push('## ' + h);
    if (!mine.length) out.push('(nothing)');
    for (const [, title] of mine) out.push('### RM' + (++n) + ': ' + title, 'Why: owners wait too long for a first draft reply.', 'Outcome: a draft reply is ready within a minute.', 'Size: medium');
  }
  return out.join('\n') + '\n';
}
const issuesDraft = (pid, list) => JSON.stringify({ product: pid, issues: list.map(([item, title]) => ({ roadmapItem: item, title, problem: 'Owners wait for the first draft reply; this slows the whole flow for them.', acceptance: 'A draft appears within a minute\nThe owner can edit it before sending' })) });
const design = (title, { copy = true } = {}) => ['# Design: ' + title, '## Flow', '1. The owner opens a review.', '2. The draft appears.', '## States', 'Loading, ready, error.', ...(copy ? ['## Copy', 'Button: "Use this reply"'] : []), '## Acceptance notes', 'The button shows once the draft is ready.'].join('\n') + '\n';
function pdScript(env, opts = {}) {
  const seen = env.seen = [], inputs = env.inputs = {};
  return async (ctx, params) => {
    const t = turnOf(params), k = ctx.agentKey, job = ctx.job || { data: {} };
    for (const r of lastResults(params)) seen.push({ agent: k, turn: t, ...r });
    if (t === 0) inputs[job.id] = JSON.stringify(params.messages[0]);
    const pick = (fn, dflt) => { const steps = fn ? fn({ job, env }) : dflt; return { content: steps[Math.min(t, steps.length - 1)] }; };
    if (k === 'product-manager' && job.kind === 'pm-roadmap') return pick(opts.roadmap, [[tool('r', 'fs_read', { path: job.data.inputs })], [tool('w', 'fs_write', { path: 'roadmap-draft.md', content: env.nextRoadmap || roadmap('ReplyDesk') })], [text('Done.')]]);
    if (k === 'product-manager' && job.kind === 'pm-issues') return pick(opts.issues, [[tool('r', 'fs_read', { path: job.data.inputs })], [tool('w', 'fs_write', { path: 'issues-draft.json', content: issuesDraft('replydesk', [['RM1', 'Show the draft reply sooner']]) })], [text('Done.')]]);
    if (k === 'ux-designer') return pick(opts.design, [[tool('m', 'fs_read', { path: 'ui/manifest.json' })], [tool('w', 'fs_write', { path: 'design.md', content: design(env.issueTitle) })], [text('Done.')]]);
    if (k === 'tech-lead') return pick(null, [[tool('b', 'report_blocked', { reason: 'test: stop after reading the input' })], [text('Done.')]]);
    return { content: [text('nothing to do')] };
  };
}
async function station(t, { opts = {}, tag = 'r4', clone = null, docker = null } = {}) {
  const env = {};
  const { engine, r } = engineOn(t, { tag, script: pdScript(env, opts), engineering: { ...(docker ? { checks: docker.checks } : {}), env: clone ? { REPLYDESK_REPO: clone } : {} } });
  env.dataRoot = r.dataRoot;
  const h = await serve(t, engine, r.log), owner = { kind: 'owner', session: h.token };
  const quote = async (action, params = {}) => { const x = await h.post('/api/spend/quote', { action, params }); assert.equal(x.status, 200, x.text); return x.json.result; };
  const settled = (id) => until(() => !engine.engineering.isActive(id) && ['done', 'blocked', 'incomplete', 'stopped', 'approval'].includes(engine.store.getJob(id).state), { timeout: 30000 });
  const run = async (k, args = {}) => { const s = engine.product.start(k, { productId: 'replydesk', ...args }, { actor: owner }); await s.promise; await settled(s.jobId); return engine.store.getJob(s.jobId); };
  const decide = async (requestId, decision, words = 'ok') => { const rq = engine.requests.get(requestId); const x = await h.post('/api/requests/decide', { id: requestId, decision, words, expectedVersion: rq.version }); assert.equal(x.status, 200, x.text); return x.json.result; };
  const err = (id) => env.seen.find((x) => x.id === 'tu_' + id) || {};
  return { engine, r, h, owner, env, quote, settled, run, decide, err };
}
// a roadmap approved by the owner through the page (the draft, the request, the decision)
async function approveRoadmap(S, content = null) {
  if (content) S.env.nextRoadmap = content;
  const j = await S.run('roadmap');
  assert.equal(j.state, 'approval', j.reason);
  await S.decide(j.data.requestId, 'approve', 'Good: go with this.');
  return { job: S.engine.store.getJob(j.id), requestId: j.data.requestId };
}
// the fixture clone with ReplyDesk-like UI files (templates/, static/) on main
function uiClone(t) {
  const base = tempBase(t, 'r4-clone'), dir = fixtureClone(base);
  fs.mkdirSync(path.join(dir, 'templates'), { recursive: true }); fs.mkdirSync(path.join(dir, 'static', 'img'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'templates', 'index.html'), '<html><body><button id="use-reply">Use</button></body></html>\n');
  fs.writeFileSync(path.join(dir, 'static', 'app.js'), 'document.getElementById("use-reply");\n');
  fs.writeFileSync(path.join(dir, 'static', 'style.css'), 'button { color: teal; }\n');
  fs.writeFileSync(path.join(dir, 'static', 'img', 'logo.png'), 'not really a png');
  G(dir, 'add', '-A'); G(dir, 'commit', '-q', '-m', 'ui'); G(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  return dir;
}

// ---- 1. the config

test('1: PRODUCT-MANAGER (Sonnet) and DESIGNER (Haiku) are hired with fs tools only; three Product & Design lines; ReplyDesk\'s UI paths; DESIGNER has no path to a live site', (t) => {
  const A = REAL.agents;
  assert.deepEqual([A['product-manager'].status, A['product-manager'].hired, A['product-manager'].tier, A['product-manager'].effort, A['product-manager'].thinking, A['product-manager'].enabled], ['active', 'R4', 'strong', 'medium', 'off', true]);
  assert.deepEqual([A['ux-designer'].status, A['ux-designer'].hired, A['ux-designer'].tier, A['ux-designer'].effort, A['ux-designer'].thinking, A['ux-designer'].enabled], ['active', 'R4', 'cheap', 'medium', 'off', true]);
  assert.equal(REAL.engine.tiers.strong.model, 'claude-sonnet-5-5'); assert.equal(REAL.engine.tiers.cheap.model, 'claude-haiku-5-5');
  for (const k of ['product-manager', 'ux-designer']) assert.deepEqual(A[k].tools, ['fs_read', 'fs_list', 'fs_write'], k);
  assert.deepEqual([A['product-manager'].limits.runCapUsd, A['product-manager'].limits.maxOutputTokens, A['ux-designer'].limits.runCapUsd, A['ux-designer'].limits.maxOutputTokens], [0.4, 8000, 0.1, 6000]);
  for (const k of ['product-manager', 'ux-designer']) assert.ok(fs.existsSync(path.join(PROMPTS, 'agents', k + '.md')), k);
  for (const [id, kind, products, agent] of [['pm-roadmap', 'pm-roadmap', ['replydesk', 'emty-inbox'], 'product-manager'], ['pm-issues', 'pm-issues', ['replydesk'], 'product-manager'], ['design-spec', 'design-spec', ['replydesk'], 'ux-designer']]) {
    const L = REAL.lines[id];
    assert.deepEqual([L.kind, L.products, Object.values(L.steps).filter((s) => s.kind === 'agent').map((s) => s.agent)], [kind, products, [agent]], id);
  }
  assert.deepEqual([REAL.lines['pm-roadmap'].estimateUsd.job, REAL.lines['pm-issues'].estimateUsd.job, REAL.lines['design-spec'].estimateUsd.job], [0.15, 0.3, 0.01], 'the plan\'s estimates (RESTRUCTURE.md §8 R4)');
  assert.deepEqual(REAL.company.departments.find((d) => d.id === 'product-design').lines, ['pm-roadmap', 'pm-issues', 'design-spec']);
  assert.deepEqual(REAL.company.products.find((p) => p.id === 'replydesk').uiPaths, ['templates', 'static']);
  // site.change: the owner's, and no tool performs it; the levels R4 relies on
  assert.ok(!Object.values(TOOL_ACTIONS).includes('site.change'), 'no tool performs site.change');
  assert.deepEqual(['site.change', 'roadmap.approve', 'backlog.write', 'draft.write', 'design.write'].map((a) => REAL.policy.levels[a]), ['owner', 'owner', 'auto', 'auto', 'auto']);
  assert.ok(!REAL.routines.some((x) => /pm-|design-spec|product-manager|ux-designer/.test(x.target)), 'no Product & Design routine in R4');
  const { engine } = engineOn(t, { tag: 'r4cfg' });
  assert.ok(!engine.routineTargets.some((x) => ['line:pm-roadmap', 'line:pm-issues', 'line:design-spec'].includes(x.id)), 'the side lines are no routine targets');
});

// ---- 2. the roadmap

test('2: the roadmap: inputs with the owner\'s idea and no request text; a draft that does not hold is not written; it becomes a request; the approval writes roadmap.md; a hand edit or a newer draft', async (t) => {
  const S = await station(t, { tag: 'r4rm', opts: { roadmap: ({ job, env }) => [
    [tool('r', 'fs_read', { path: job.data.inputs })],
    [tool('w1', 'fs_write', { path: 'roadmap-draft.md', content: '# Roadmap ReplyDesk\n## Now\n### RM1: Something\nWhy: x\n' }), tool('w2', 'fs_write', { path: 'roadmap.md', content: roadmap('ReplyDesk') }), tool('w3', 'fs_write', { path: '../backlog/x.md', content: 'x' })],
    [tool('w4', 'fs_write', { path: 'roadmap-draft.md', content: env.nextRoadmap || roadmap('ReplyDesk') })],
    [text('Done.')]] } });
  // a request whose summary names a person and an address, and an idea of the owner's
  S.engine.requests.file({ action: 'dependency.add', productId: 'replydesk', departmentId: 'engineering', summary: 'Reply to Jane Doe at 1 Main Street', payload: 'secret payload text', actor: { kind: 'engine' } });
  const idea = await S.h.post('/api/product/idea', { productId: 'replydesk', text: 'A weekly digest of new reviews for busy owners' });
  assert.equal(idea.status, 200, idea.text); assert.equal(idea.json.result.id, 'I1');
  const j = await S.run('roadmap');
  assert.equal(j.state, 'approval', j.reason); assert.match(j.reason, /^waiting for the owner: roadmap request req_\w+ in the Owner's office \(2 items\)/);
  assert.deepEqual([j.line, j.kind, j.product_id, j.department_id], ['pm-roadmap', 'pm-roadmap', 'replydesk', 'product-design']);
  const inputs = fs.readFileSync(path.join(productDir(S.r.dataRoot, 'replydesk'), j.data.inputs), 'utf8');
  assert.ok(inputs.includes('A weekly digest of new reviews'), 'the owner\'s idea is in the inputs');
  for (const x of ['Jane Doe', '1 Main Street', 'secret payload text']) assert.ok(!inputs.includes(x), 'no request text in the inputs: ' + x);
  assert.ok(S.err('w1').error && /was NOT written.*## Next" is missing.*RM1 needs "Outcome/.test(S.err('w1').text), S.err('w1').text);
  assert.ok(S.err('w2').error && /your role may not write roadmap\.md/.test(S.err('w2').text), 'PRODUCT-MANAGER never writes the approved roadmap');
  assert.ok(S.err('w3').error, 'nothing outside the product folder');
  assert.equal(approvedRoadmap(S.r.dataRoot, 'replydesk'), null, 'a draft is not a roadmap');
  // the request: roadmap.approve, the draft as its payload
  const rq = S.engine.requests.get(j.data.requestId);
  assert.deepEqual([rq.action, rq.status, rq.product_id, rq.department_id, rq.job_id], ['roadmap.approve', 'pending', 'replydesk', 'product-design', j.id]);
  assert.equal(fs.readFileSync(path.join(S.r.dataRoot, rq.payload_file), 'utf8'), roadmap('ReplyDesk'));
  // the owner approves it through the page: roadmap.md is the payload, the job approved
  await S.decide(rq.id, 'approve', 'Good: go with this.');
  const rm = approvedRoadmap(S.r.dataRoot, 'replydesk');
  assert.ok(rm); assert.deepEqual(rm.items.map((i) => [i.id, i.horizon, i.title]), [['RM1', 'Now', 'Faster first reply'], ['RM2', 'Next', 'Weekly digest email']]);
  assert.deepEqual([rm.requestId, rm.words], [rq.id, 'Good: go with this.']);
  assert.equal(S.engine.store.getJob(j.id).state, 'approved');
  // a hand edit of roadmap.md is not an approved roadmap
  const f = roadmapFile(S.r.dataRoot, 'replydesk'), approvedText = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(f, approvedText.replace('Faster first reply', 'Something else'));
  assert.equal(approvedRoadmap(S.r.dataRoot, 'replydesk'), null, 'edited by hand: not approved');
  fs.writeFileSync(f, approvedText);
  // two drafts: the newer voids the older pending request, whose job is archived as superseded; a rejection keeps the approved roadmap
  S.env.nextRoadmap = roadmap('ReplyDesk', [['Now', 'Faster first reply'], ['Later', 'Mobile layout']]);
  const j2 = await S.run('roadmap'), j3 = await S.run('roadmap');
  assert.equal(S.engine.requests.get(j2.data.requestId).status, 'void');
  assert.match(S.engine.store.getJob(j2.id).state + ' ' + S.engine.store.getJob(j2.id).reason, /^archived superseded: a newer roadmap draft/);
  await S.decide(j3.data.requestId, 'reject', 'Not yet.');
  assert.equal(S.engine.store.getJob(j3.id).state, 'rejected_by_owner');
  assert.deepEqual(approvedRoadmap(S.r.dataRoot, 'replydesk').items.map((i) => i.title), ['Faster first reply', 'Weekly digest email'], 'the approved roadmap stands');
  assert.ok(S.engine.bus.recent(400).some((e) => e.type === 'roadmap.decided' && e.data.decision === 'approve'));
});

// ---- 3. issues

test('3: issues: refused without an approved roadmap; one off the roadmap is not written; on it they need no second approval and the CTO may queue them; an item that leaves the roadmap takes them off', async (t) => {
  const S = await station(t, { tag: 'r4iss', opts: { issues: ({ job }) => [
    [tool('r', 'fs_read', { path: job.data.inputs })],
    [tool('w1', 'fs_write', { path: 'issues-draft.json', content: issuesDraft('replydesk', [['RM9', 'Something not on the roadmap']]) })],
    [tool('w2', 'fs_write', { path: 'issues-draft.json', content: issuesDraft('replydesk', [['RM1', 'Show the draft reply sooner'], ['RM2', 'Send the weekly digest']]) })],
    [text('Done.')]] } });
  assert.match(S.engine.product.startProblems('issues', { productId: 'replydesk' }).join('; '), /ReplyDesk has no approved roadmap/);
  assert.throws(() => S.engine.product.start('issues', { productId: 'replydesk' }, { actor: S.owner }), /no approved roadmap/);
  assert.match(S.engine.product.startProblems('issues', { productId: 'emty-inbox' }).join('; '), /does not serve emty-inbox/, 'issues only where the engineering line works');
  await approveRoadmap(S);
  const j = await S.run('issues');
  assert.equal(j.state, 'done', j.reason); assert.match(j.reason, /^2 issue\(s\) in the backlog of ReplyDesk/);
  assert.ok(S.err('w1').error && /roadmapItem must be an item of the approved roadmap \(RM1, RM2\)/.test(S.err('w1').text), S.err('w1').text);
  const iss = listIssues(S.r.dataRoot, 'replydesk');
  assert.deepEqual(iss.map((i) => [i.title, i.by, i.roadmapItem && i.roadmapItem.id, i.state, i.via]), [['Send the weekly digest', 'product-manager', 'RM2', 'approved', 'roadmap'], ['Show the draft reply sooner', 'product-manager', 'RM1', 'approved', 'roadmap']]);
  // the CTO may queue them
  const q = (ids) => JSON.stringify({ product: 'replydesk', queue: ids.map((id, i) => ({ issue: id, order: i + 1, size: 'small' })) });
  const [digest, sooner] = iss.map((i) => i.id);
  assert.deepEqual(devQueueProblems(q([sooner, digest]), { dataRoot: S.r.dataRoot, productId: 'replydesk' }), []);
  // the owner's off-roadmap issue (written and approved by the owner) is assignable too
  const own = S.engine.engineering.writeIssue({ productId: 'replydesk', title: 'Fix the footer link', problem: 'The footer link to the privacy page is broken on every page.' }, { actor: S.owner });
  await S.engine.engineering.decideIssue({ productId: 'replydesk', issueId: own.issueId, decision: 'approve', words: 'yes' }, { actor: S.owner });
  assert.deepEqual(devQueueProblems(q([own.issueId]), { dataRoot: S.r.dataRoot, productId: 'replydesk' }), [], 'the owner\'s own issue needs no roadmap item');
  // a new roadmap without the digest item: its issue is off the roadmap and the CTO cannot assign it; the other stays (same id and title)
  S.env.nextRoadmap = roadmap('ReplyDesk', [['Now', 'Faster first reply'], ['Next', 'Mobile layout']]);
  await approveRoadmap(S);
  const st = Object.fromEntries(listIssues(S.r.dataRoot, 'replydesk').map((i) => [i.id, i.state]));
  assert.deepEqual([st[sooner], st[digest], st[own.issueId]], ['approved', 'off-roadmap', 'approved']);
  assert.match(devQueueProblems(q([digest]), { dataRoot: S.r.dataRoot, productId: 'replydesk' }).join('; '), /is off-roadmap, not approved: the CTO assigns only approved issues/);
  assert.match(S.engine.engineering.startProblems('replydesk', digest).problems.join('; '), /the issue is off-roadmap: only an approved issue/);
  // the owner can still reject a PRODUCT-MANAGER issue on the roadmap
  await S.engine.engineering.decideIssue({ productId: 'replydesk', issueId: sooner, decision: 'reject', words: 'not this one' }, { actor: S.owner });
  assert.equal(listIssues(S.r.dataRoot, 'replydesk').find((i) => i.id === sooner).state, 'rejected');
  // an edited PRODUCT-MANAGER issue is no longer approved
  const f = path.join(S.r.dataRoot, 'products', 'replydesk', 'backlog', 'issues', digest + '.md');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8') + '\nedited\n');
  assert.equal(listIssues(S.r.dataRoot, 'replydesk').find((i) => i.id === digest).state, 'stale');
});

// ---- 4. the design spec

test('4: the design spec: the UI files from main, DESIGNER writes only design.md, a spec that does not hold is not written; TECH-LEAD gets it when the issue starts', async (t) => {
  const clone = uiClone(t), before = cloneState(clone), d = fakeDocker();
  const S = await station(t, { tag: 'r4des', clone, docker: d, opts: { design: ({ env }) => [
    [tool('m', 'fs_read', { path: 'ui/manifest.json' }), tool('i', 'fs_read', { path: 'ui/templates/index.html' })],
    [tool('w1', 'fs_write', { path: 'design.md', content: design(env.issueTitle, { copy: false }) }), tool('w2', 'fs_write', { path: 'ui/templates/index.html', content: '<p>changed</p>' }), tool('w3', 'fs_write', { path: '../../backlog/issues/x.md', content: 'x' })],
    [tool('w4', 'fs_write', { path: 'design.md', content: design(env.issueTitle) })],
    [text('Done.')]] } });
  const own = S.engine.engineering.writeIssue({ productId: 'replydesk', title: 'Show the reply button sooner', problem: 'The reply button appears only after the whole page loads; owners miss it.' }, { actor: S.owner });
  S.env.issueTitle = 'Show the reply button sooner';
  const j = await S.run('design', { issueId: own.issueId });
  assert.equal(j.state, 'done', j.reason); assert.match(j.reason, /^design spec written for /);
  assert.deepEqual([j.id, j.line, j.kind, j.department_id], ['design-' + own.issueId, 'design-spec', 'design-spec', 'product-design']);
  const dir = designDir(S.r.dataRoot, 'replydesk', j.id), man = JSON.parse(fs.readFileSync(path.join(dir, 'ui', 'manifest.json'), 'utf8'));
  assert.deepEqual(man.files.map((f) => f.path), ['templates/index.html', 'static/app.js', 'static/style.css']);
  assert.ok(man.skipped.some((x) => x.path === 'static/img/logo.png' && /not a UI text file/.test(x.why)));
  assert.equal(man.commit, G(clone, 'rev-parse', 'refs/remotes/origin/main'));
  assert.ok(fs.existsSync(path.join(dir, 'issue.md')) && fs.existsSync(path.join(dir, 'design.md')));
  assert.equal(fs.readFileSync(path.join(dir, 'ui', 'templates', 'index.html'), 'utf8'), '<html><body><button id="use-reply">Use</button></body></html>\n', 'the snapshot is untouched');
  assert.ok(S.err('w1').error && /was NOT written.*"## Copy" is missing/.test(S.err('w1').text), S.err('w1').text);
  assert.ok(S.err('w2').error && /only \.md, \.json and \.txt files can be written|may not write/.test(S.err('w2').text), S.err('w2').text);
  assert.ok(S.err('w3').error, 'nothing outside the design job folder');
  assert.deepEqual(cloneState(clone), before, 'the owner\'s clone is only read');
  // the issue starts: TECH-LEAD gets the spec (design.md in the job folder, its text in the input)
  await S.engine.engineering.decideIssue({ productId: 'replydesk', issueId: own.issueId, decision: 'approve', words: 'yes' }, { actor: S.owner });
  fs.writeFileSync(queueFile(S.r.dataRoot, 'replydesk'), JSON.stringify({ product: 'replydesk', queue: [{ issue: own.issueId, order: 1, size: 'small' }] }));
  const e = S.engine.engineering.startIssue({ productId: 'replydesk', issueId: own.issueId }, { actor: S.owner });
  await e.promise; await until(() => !S.engine.engineering.isActive(e.jobId) && S.engine.store.getJob(e.jobId).state !== 'running', { timeout: 30000 });
  const ej = S.engine.store.getJob(e.jobId);
  assert.equal(ej.data.designJob, j.id); assert.equal(ej.data.designStale, false);
  assert.equal(fs.readFileSync(path.join(S.r.dataRoot, 'products', 'replydesk', 'eng', e.jobId, 'design.md'), 'utf8'), design('Show the reply button sooner'));
  const input = S.env.inputs[e.jobId] || '';
  assert.ok(input.includes("DESIGNER'S SPEC for this issue (design.md, from job " + j.id + ')'), 'the spec reaches TECH-LEAD\'s input');
  assert.ok(input.includes('Button: \\"Use this reply\\"'), 'with its copy');
  // a design job is refused for a rejected issue and when the clone is not configured
  await S.engine.engineering.decideIssue({ productId: 'replydesk', issueId: own.issueId, decision: 'reject', words: 'no' }, { actor: S.owner });
  assert.match(S.engine.product.startProblems('design', { productId: 'replydesk', issueId: own.issueId }).join('; '), /the issue is rejected/);
});

// ---- 5. the page

test('5: the page: the quote (the product\'s Product & Design cap, the plan\'s estimate), the confirm token, the owner\'s session, the idea (free, checked); a script starts nothing', async (t) => {
  const S = await station(t, { tag: 'r4page' });
  const q = await S.quote('pm-roadmap', { productId: 'replydesk' });
  assert.deepEqual([q.line, q.estimate.usd, q.refusals.length], ['pm-roadmap', 0.15, 0]);
  assert.match(JSON.stringify(q), /0\.5/, 'the ReplyDesk Product & Design cap (USD 0.50) bounds the run');
  const qi = await S.quote('pm-issues', { productId: 'replydesk' });
  assert.match(qi.refusals.join('; '), /no approved roadmap/);
  const qd = await S.quote('design-spec', { productId: 'replydesk', issueId: '2026-11-02--nope' });
  assert.match(qd.refusals.join('; '), /no such issue/);
  // no confirm token: refused, nothing started
  const no = await S.h.post('/api/product/roadmap', { productId: 'replydesk' });
  assert.ok(no.status >= 400 && /confirm first/.test(no.text), no.text);
  assert.equal(S.engine.store.listJobs().filter((j) => j.kind === 'pm-roadmap').length, 0);
  const ok = await S.h.post('/api/product/roadmap', { productId: 'replydesk', confirmToken: q.token });
  assert.equal(ok.status, 200, ok.text); await S.settled(ok.json.result.jobId);
  assert.equal(S.engine.store.getJob(ok.json.result.jobId).state, 'approval');
  // the idea: the owner's session only; checked (length, another company's data)
  assert.equal((await S.h.post('/api/product/idea', { productId: 'replydesk', text: 'An idea without a session' }, { token: null })).status, 403);
  const short = await S.h.post('/api/product/idea', { productId: 'replydesk', text: 'short' });
  assert.ok(short.status >= 400 && /10 to 2000 characters/.test(short.text), short.text);
  const marker = (REAL.building.foreignDataMarkers || [])[0];
  if (marker) { const fd = await S.h.post('/api/product/idea', { productId: 'replydesk', text: 'Copy what ' + marker + ' does for its tenants' }); assert.ok(fd.status >= 400 && /names another company/.test(fd.text), fd.text); }
  const other = await S.h.post('/api/product/idea', { productId: 'station', text: 'An idea for a product with no roadmap line' });
  assert.ok(other.status >= 400 && /does not draft a roadmap for station/.test(other.text));
  // only the owner starts a run; a script's engine starts none
  assert.throws(() => S.engine.product.start('roadmap', { productId: 'replydesk' }, { actor: { kind: 'engine' } }), (e) => e.code === 'LOCKED');
  const r = tempRoot('r4script'); t.after(r.cleanup);
  const e2 = createEngine({ J: r.J, log: r.log, startScheduler: false, scriptRun: { purpose: 'test', startsJobs: false } }); t.after(() => e2.close());
  assert.throws(() => e2.product.start('roadmap', { productId: 'replydesk' }, { actor: { kind: 'owner', session: 'x'.repeat(32) } }), (e) => e.code === 'LOCKED' || e.code === 'SCRIPT');
});

// ---- 6. the views

test('6: the views: the Owner\'s office (the draft\'s text with Approve and Reject), the Engineering panel (who wrote an issue, its item, the spec button), floor 3\'s boards and task box, the CEO\'s inputs', async (t) => {
  const S = await station(t, { tag: 'r4views' });
  const j = await S.run('roadmap');
  let snap = buildEngineSnapshot(S.engine), pd = snap.company.ownersOffice.productDesign;
  const rd = pd.products.find((p) => p.id === 'replydesk');
  assert.deepEqual([rd.pending.requestId, rd.pending.items.length, rd.roadmap, rd.jobCapUsd], [j.data.requestId, 2, null, 0.5]);
  assert.ok(rd.pending.text.startsWith('# Roadmap ReplyDesk'));
  assert.deepEqual(pd.products.map((p) => p.id), ['replydesk', 'emty-inbox']);
  const body = { innerHTML: '', querySelectorAll: () => [] }, root = { querySelector: () => body, classList: { add() {}, remove() {}, contains: () => true } };
  createBuildingView({ root }).render(snap);
  for (const x of ['Product &amp; Design · roadmaps and backlog', 'Waiting for you: the roadmap draft', 'data-req="' + j.data.requestId + '" data-decision="approve"', '### RM1: Faster first reply', 'data-pd-run="roadmap" data-product="replydesk"', 'data-pd-run="idea"']) assert.ok(body.innerHTML.includes(x), x);
  assert.equal(screenContent('roadmap', snap).rows[0].value, 'draft waiting for you');
  await S.decide(j.data.requestId, 'approve');
  await S.run('issues');
  snap = buildEngineSnapshot(S.engine);
  const board = screenContent('roadmap', snap);
  assert.deepEqual(board.rows.slice(0, 2).map((r) => [r.label, r.value]), [['ReplyDesk RM1 Faster first reply', 'Now'], ['ReplyDesk RM2 Weekly digest email', 'Next']]);
  const bl = screenContent('backlog', snap);
  assert.deepEqual(bl.rows.map((r) => [r.label, r.value]), [['ReplyDesk approved', '1'], ['ReplyDesk waiting for you', '0'], ['ReplyDesk from PRODUCT-MANAGER', '1']]);
  // floor 3's task box
  const f3 = { ...snap, floorView: { tower: true, floor: '3' } };
  assert.equal(floorWork(f3).kind, 'product');
  assert.ok(planFloor(snap, '3').screens.some((s) => s.kind === 'backlog'));
  // the Engineering panel
  const html = panelHtml(S.engine.engineering.view());
  for (const x of ['on the approved roadmap', 'PRODUCT-MANAGER · RM1 Faster first reply', 'data-eng-design="']) assert.ok(html.includes(x), x);
  // the CEO reads the approved roadmaps
  const ci = ceoInputs(S.engine);
  assert.equal(ci.roadmaps.status, 'active');
  assert.deepEqual(ci.roadmaps.products.find((p) => p.productId === 'replydesk').approved.items.map((i) => i.id), ['RM1', 'RM2']);
});

// ---- 7. the records (pure)

test('7: the records: the roadmap parser, the issues check, the design check, the issue states', () => {
  const ok = parseRoadmap(roadmap('ReplyDesk'), { product: 'ReplyDesk' });
  assert.ok(ok.ok, ok.problems.join('; ')); assert.deepEqual(ok.items.map((i) => [i.id, i.horizon, i.size]), [['RM1', 'Now', 'medium'], ['RM2', 'Next', 'medium']]);
  assert.match(parseRoadmap(roadmap('ReplyDesk'), { product: 'emty-inbox' }).problems.join('; '), /first line must be "# Roadmap emty-inbox"/);
  assert.match(parseRoadmap(roadmap('X').replace('### RM2:', '### RM5:'), {}).problems.join('; '), /item 2 must be headed "### RM2: <title>"/);
  assert.match(parseRoadmap('# Roadmap X\n## Now\n(nothing)\n## Next\n(nothing)\n## Later\n(nothing)\n', {}).problems.join('; '), /at least one item/);
  assert.match(parseRoadmap(roadmap('X', Array.from({ length: 16 }, (_, i) => ['Later', 'Item number ' + i])), {}).problems.join('; '), /16 items: at most 15/);
  assert.match(parseRoadmap(roadmap('X').replace('Size: medium', 'Size: huge'), {}).problems.join('; '), /RM1 needs "Size: small"/);
  const rm = { items: ok.items, sha256: 'x' };
  assert.deepEqual(pmIssuesProblems(issuesDraft('replydesk', [['RM1', 'Show the draft reply sooner']]), { productId: 'replydesk', roadmap: rm }), []);
  assert.match(pmIssuesProblems('{}', { productId: 'replydesk', roadmap: null }).join('; '), /no approved roadmap/);
  assert.match(pmIssuesProblems(issuesDraft('replydesk', Array.from({ length: 6 }, (_, i) => ['RM1', 'Issue number ' + i])), { productId: 'replydesk', roadmap: rm }).join('; '), /6 issues: at most 5/);
  assert.match(pmIssuesProblems(issuesDraft('replydesk', [['RM1', 'Duplicate title']]), { productId: 'replydesk', roadmap: rm, existing: [{ title: 'duplicate  TITLE', state: 'approved' }] }).join('; '), /an open issue is already titled/);
  assert.deepEqual(designProblems(design('T'), { title: 'T' }), []);
  assert.match(designProblems(design('T', { copy: false }), { title: 'T' }).join('; '), /"## Copy" is missing/);
  // the issue states: an owner's issue, a PRODUCT-MANAGER issue on and off the roadmap, edited
  const day = dublinDay(), c = composeIssue({ title: 'Show the draft sooner', problem: 'x'.repeat(30), productId: 'replydesk', day, by: 'product-manager', roadmapItem: { id: 'RM1', title: 'Faster first reply' } });
  const dir = tempRoot('r4states'); try {
    fs.mkdirSync(path.join(dir.dataRoot, 'products', 'replydesk', 'backlog', 'issues'), { recursive: true });
    fs.writeFileSync(path.join(dir.dataRoot, 'products', 'replydesk', 'backlog', 'issues', c.id + '.md'), c.text);
    const iss = readIssue(dir.dataRoot, 'replydesk', c.id), filed = [{ issueId: c.id, decision: 'filed', sha256: iss.sha256 }];
    assert.deepEqual([iss.by, iss.roadmapItem], ['product-manager', { id: 'RM1', title: 'Faster first reply' }]);
    assert.equal(issueState(iss, filed, rm).state, 'approved'); assert.equal(issueState(iss, filed, rm).via, 'roadmap');
    assert.equal(issueState(iss, filed, null).state, 'off-roadmap', 'no approved roadmap');
    assert.equal(issueState(iss, filed, { items: [{ ...ok.items[0], title: 'Another title' }] }).state, 'off-roadmap', 'same id, another title');
    assert.equal(issueState(iss, [{ issueId: c.id, decision: 'filed', sha256: 'other' }], rm).state, 'stale');
    assert.equal(issueState(iss, [], rm).state, 'draft', 'not filed by the engine: a draft');
    assert.ok(onRoadmap({ id: 'RM1', title: ' faster  FIRST reply ' }, rm));
  } finally { dir.cleanup(); }
});
