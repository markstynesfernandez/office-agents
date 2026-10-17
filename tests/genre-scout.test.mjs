// genre-scout.test.mjs — the genre-trend scouting line (DECISIONS.md "Genre-trend scouting") on the mock provider with
// the FIXTURE scouting data (fixtures/engine/scout-script.mjs; invented game titles only): the scouting blocklist fills
// itself from the notes, a brief / design / listing / image prompt naming a scouted game fails, the notes never reach
// a later agent, and the engine enforces TREND-SCOUT's 12 web calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempRoot } from './helpers/engine.mjs';
import { createEngine } from '../src/engine/engine.mjs';
import { runAgent } from '../src/engine/runtime.mjs';
import { createToolbox } from '../src/engine/tools/index.mjs';
import { dublinDay } from '../src/engine/time.mjs';
import { screenListing, screenDigitalSet, screenText } from '../src/engine/lib/originality.mjs';
import { validateNotes, readBlocklist, SCOUTED, WORDING } from '../src/engine/lib/scouting.mjs';
import { buildEngineSnapshot } from '../src/server/engine-model.mjs';
import { createScoutScript, genreBrief, FIXTURE_GAMES, BAD_BRIEF_GAME } from '../fixtures/engine/scout-script.mjs';

const ALL_NAMES = FIXTURE_GAMES.flatMap((g) => [g.game, g.studio, ...g.alsoBlock]);
const lower = (s) => String(s).toLowerCase();
const mentions = (s) => ALL_NAMES.filter((n) => lower(s).includes(lower(n)));
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);

function boot(t, { script = createScoutScript(), J = null, log = null, root = null } = {}) {
  const r = root || tempRoot('scout');
  const e = createEngine({ J: J || r.J, log: log || r.log, script, startScheduler: false });
  t.after(() => { try { e.close(); } catch (_) {} if (!root) r.cleanup(); });
  return { e, r };
}
async function scout(e, opts = {}) {
  const c = e.orchestrator.createResearchJob({ line: 'genre-scout', by: 'test', ...opts });
  await e.orchestrator.startJob(c.id);
  return e.store.getJob(c.id);
}
const research = (e, ...p) => path.join(e.J.dataRoot, 'research', ...p);

test('the scout line runs on the mock: 4 genre briefs verified, the brief naming a game blocked before EVIDENCE-CHECKER', async (t) => {
  const { e } = boot(t);
  const j = await scout(e), day = dublinDay();
  assert.equal(j.state, 'research-done', j.reason);
  const briefs = fs.readdirSync(research(e, 'briefs')).sort();
  assert.deepEqual(briefs, ['candlelit-dark-fantasy', 'cozy-farming', 'neon-cyberpunk', 'survival-camp'].map((s) => day + '--genre-' + s + '-desk-props.md'));
  for (const f of briefs) { const b = fs.readFileSync(research(e, 'briefs', f), 'utf8'); assert.match(b, /^status: verified$/m); assert.match(b, /^origin: genre-scout$/m); assert.deepEqual(mentions(b), [], f + ' names no scouted game, studio or related name'); }
  const bad = day + '--genre-cozy-farming-named-desk-props.md';
  assert.ok(!fs.existsSync(research(e, 'drafts', day, bad)), 'moved out of drafts/');
  assert.ok(!fs.existsSync(research(e, 'briefs', bad)));
  assert.ok(!fs.existsSync(research(e, 'rejected', bad)), 'not in rejected/: it names a game, so it stays in scouting/');
  // outside scouting/, nothing in the research folder names a scouted game
  for (const f of walk(research(e)).filter((x) => !path.relative(research(e), x).startsWith('scouting'))) assert.deepEqual(mentions(fs.readFileSync(f, 'utf8')), [], path.relative(research(e), f));
  const rej = fs.readFileSync(research(e, 'scouting', 'blocked', day, bad), 'utf8');
  assert.match(rej, /## Station scouting screen/);
  assert.match(rej, /"parsnip hollow" matches scouted-games "Parsnip Hollow"/i);
  assert.match(rej, /^status: candidate$/m, 'blocked before EVIDENCE-CHECKER could verify it');
  assert.match(e.store.getJob(j.id).data.scouting.drafts.join(' | '), /named-desk-props\.md: BLOCKED/);
  // the job record (shown on the office page) never carries a scouted name, even from a file name
  assert.deepEqual(mentions(JSON.stringify(e.store.getJob(j.id)) + JSON.stringify(e.store.listJobs())), []);
});

test('a blocked draft whose FILE NAME names a game is masked in the job record the office page shows', async (t) => {
  const { e } = boot(t, { script: createScoutScript({ badSlug: 'parsnip-hollow' }) });
  const j = await scout(e), day = dublinDay();
  assert.equal(j.state, 'research-done', j.reason);
  assert.ok(fs.existsSync(research(e, 'scouting', 'blocked', day, day + '--genre-parsnip-hollow-desk-props.md')));
  assert.match(j.data.scouting.drafts.join(' | '), /\(a draft whose file name names a scouted game\): BLOCKED/);
  assert.deepEqual(mentions(JSON.stringify(e.store.listJobs()) + JSON.stringify(e.store.stagesOf(j.id))), []);
});

test('every name the scout records is added to the scouting blocklist automatically, once', async (t) => {
  const { e } = boot(t);
  await scout(e);
  const bl = readBlocklist(research(e));
  assert.deepEqual(bl.terms.map((x) => x.term).sort(), ALL_NAMES.slice().sort());
  assert.deepEqual(bl.terms.filter((x) => x.kind === 'game').map((x) => x.term).sort(), FIXTURE_GAMES.map((g) => g.game).sort());
  const before = fs.readFileSync(research(e, 'scouting', 'blocklist.json'), 'utf8');
  const j2 = await scout(e);
  assert.equal(j2.state, 'research-done', j2.reason);
  assert.equal(j2.data.scouting.added, 0, 'a re-run adds nothing');
  assert.equal(fs.readFileSync(research(e, 'scouting', 'blocklist.json'), 'utf8'), before);
  // the engine's originality lists now carry them (every screen reads cfg.station)
  assert.deepEqual(e.cfg.station.sloganScreen.lists[SCOUTED].slice().sort(), ALL_NAMES.slice().sort());
  assert.ok(e.cfg.station.sloganScreen.lists[WORDING].includes('fan'));
});

test('scouting notes are refused unless they hold 2 AAA + 2 indie entries with https evidence and dates', () => {
  const day = '2026-10-17', ok = { day, entries: FIXTURE_GAMES.map((g) => ({ ...g, evidence: [{ url: 'https://x.example/a', signal: 's' }], date: day })) };
  assert.equal(validateNotes(ok, { day }).ok, true);
  assert.match(validateNotes({ ...ok, entries: ok.entries.slice(1) }, { day }).problems.join(';'), /2 aaa entries \(has 1\)/);
  assert.match(validateNotes({ ...ok, entries: ok.entries.map((x, i) => (i ? x : { ...x, evidence: [{ url: 'http://x' }] })) }, { day }).problems.join(';'), /https/);
  assert.match(validateNotes({ day }, { day }).problems.join(';'), /entries/);
});

test('a brief naming a scouted game, studio or related name fails the brief check and intake; a clean genre brief passes', async (t) => {
  const { e } = boot(t);
  await scout(e);
  const day = dublinDay(), g = { slug: 'lofi-study', genre: 'lofi study', segment: 'streamers who play relaxing puzzle games', props: 'a desk lamp, a stack of notebooks, a mug of tea, a cassette player, a potted fern and a sleeping cat bed', palette: 'dusty rose, cream and teal', price: 9 };
  const clean = genreBrief(day, g).replace(/^status: candidate$/m, 'status: verified');
  const variants = {
    'game in the buyer persona': clean.replace('who buys transparent PNG props', 'who streams ' + 'Chromehold 2091' + ' and buys transparent PNG props'),
    'studio in the keywords': clean.replace('- pngtuber props —', '- gravemoor interactive props —'),
    'character in the design direction': clean.replace('a sleeping cat bed', 'a statue of the Ashen Warden'),
    'game in the id (and file name)': clean.replace(/^id: (\S+)$/m, 'id: ' + day + '--cinderpine-desk-props'),
    '"fan" wording in a genre brief': clean.replace('FIXTURE: a streamer', 'FIXTURE: a fan of the genre and a streamer')
  };
  for (const [what, b] of Object.entries(variants)) {
    const c = e.orchestrator.createJob({ briefText: b, by: 'test' });
    assert.equal(c.ok, false, what + ' must fail');
    assert.match(c.reasons.join('; '), /originality: brief/, what);
  }
  const ok = e.orchestrator.createJob({ briefText: clean, by: 'test' });
  assert.equal(ok.ok, true, (ok.reasons || []).join('; '));
});

test('a listing, a design and an image prompt naming a scouted game fail the originality gate', async (t) => {
  const { e, r } = boot(t);
  await scout(e);
  const cfg = e.cfg.station, id = dublinDay() + '--genre-cozy-farming-desk-props';
  const listing = { title: 'Cozy farming desk props for streamers, 12 PNG', tags: ['cozy desk props', 'pngtuber props'], description: 'Twelve original props.', altText: 'A watering can and a jar of jam.' };
  assert.equal(screenListing({ listing, id, cfg }).result, 'clear');
  for (const [field, v] of [['title', 'Parsnip Hollow desk props'], ['tags', ['cozy desk props', 'parsnip hollow']], ['description', 'Perfect for Lanternfall Requiem streams.'], ['altText', 'Old Mabel\'s watering can']]) {
    const s = screenListing({ listing: { ...listing, [field]: v }, id, cfg });
    assert.equal(s.result, 'hit', field); assert.equal(s.hits[0].category, SCOUTED, field);
  }
  for (const w of ['For fans of farming games.', 'A tribute to farm life.', 'Inspired by your favourite farm game.', 'A dupe of the classic set.']) assert.equal(screenListing({ listing: { ...listing, description: w }, id, cfg }).result, 'hit', w);
  assert.equal(screenDigitalSet({ designMd: '# set-v1\n\n## 01-mug.png\nImage prompt (exact): a mug with the Vigil Keep crest\n', fileNames: ['01-mug.png'], cfg }).result, 'hit', 'design.md');
  assert.equal(screenDigitalSet({ designMd: '# set-v1\n', fileNames: ['01-chromehold-2091-can.png'], cfg }).result, 'hit', 'a file name');
  // the image tool refuses the prompt before any call (the same screen image_generate runs)
  const job = { id }, folder = path.join(e.J.dataRoot, 'jobs', id); fs.mkdirSync(folder, { recursive: true });
  const box = createToolbox({ J: e.J, folder, agent: e.cfg.agents.designer, job, cfg: { ...e.cfg }, guard: e.guard, providers: e.providers, run: { runId: 'run_t' }, halt: e.halt, log: r.log, bus: e.bus, line: 'room1-digital' });
  await assert.rejects(box.call('image_generate', { path: 'set-v1/files/01-can.png', prompt: 'a soda can from Chromehold 2091', transparent: true }), /ORIGINALITY HARD FAIL/);
  assert.equal(e.providers.image.calls, 0, 'no image call was made');
  assert.equal(screenText('a dented watering can, soft sage palette', cfg).result, 'clear');
});

test('the scouting notes never reach EVIDENCE-CHECKER, DESIGNER, LISTER or the QA agents; only brief.md goes to a job', async (t) => {
  const seen = [];
  const base = createScoutScript();
  const script = (ctx, params) => { if (ctx.agentKey !== 'trend-scout') seen.push({ agent: ctx.agentKey, text: JSON.stringify(params.system) + JSON.stringify(params.messages) }); return base(ctx, params); };
  script.web = base.web;
  const { e, r } = boot(t, { script });
  await scout(e);
  const day = dublinDay();
  // EVIDENCE-CHECKER tried: its listing hides scouting/ and its read was refused
  const ec = seen.filter((s) => s.agent === 'evidence-checker').map((s) => s.text).join('\n');
  assert.match(ec, /the scouting notes are internal to TREND-SCOUT/);
  assert.deepEqual(mentions(ec), [], 'EVIDENCE-CHECKER saw no scouted name');
  // the tool fence, for every agent but TREND-SCOUT
  const rdir = research(e);
  for (const key of ['evidence-checker', 'demand-researcher', 'designer', 'lister', 'qa-design', 'qa-listing']) {
    const box = createToolbox({ J: e.J, folder: rdir, agent: e.cfg.agents[key], job: { id: day + '--genre-scout-1' }, cfg: { ...e.cfg }, guard: e.guard, providers: e.providers, run: { runId: 'run_f' }, halt: e.halt, log: r.log, bus: e.bus, line: 'genre-scout' });
    const tools = e.cfg.agents[key].tools;
    if (tools.includes('fs_read')) await assert.rejects(box.call('fs_read', { path: 'scouting/' + day + '/notes.json' }), /internal to TREND-SCOUT/, key);
    if (tools.includes('fs_read')) await assert.rejects(box.call('fs_read', { path: 'Scouting/blocklist.json' }), /internal to TREND-SCOUT/, key + ' (case)');
    if (tools.includes('fs_list')) { await assert.rejects(box.call('fs_list', { path: 'scouting' }), /internal/, key); assert.doesNotMatch(await box.call('fs_list', { path: '.' }), /scouting/, key); }
  }
  // a job from a verified genre brief: its folder holds the brief only, and no later agent's prompt carries a scouted name
  const brief = day + '--genre-cozy-farming-desk-props.md';
  const { jobId } = e.orchestrator.startBrief(brief, { by: 'test' });
  for (let i = 0; i < 200 && e.orchestrator.isActive(jobId); i++) await new Promise((res) => setTimeout(res, 25));
  const jdir = path.join(e.J.dataRoot, 'jobs', jobId);
  for (const f of walk(jdir)) if (/\.(md|json|txt)$/.test(f)) assert.deepEqual(mentions(fs.readFileSync(f, 'utf8')), [], path.relative(jdir, f));
  const job = e.store.getJob(jobId);
  for (const key of ['lister', 'qa-design', 'qa-listing']) await runAgent(e, { agentKey: key, job, step: key, pass: 1, folder: jdir, folderLabel: 'the job folder of ' + jobId, input: 'Review.\n```\nLISTING_ID: ' + jobId + '\n```', line: 'room1-digital' });
  const later = seen.filter((s) => ['designer', 'lister', 'qa-design', 'qa-listing'].includes(s.agent));
  assert.deepEqual([...new Set(later.map((s) => s.agent))].sort(), ['designer', 'lister', 'qa-design', 'qa-listing']);
  for (const s of later) { assert.deepEqual(mentions(s.text), [], s.agent); assert.doesNotMatch(s.text, /scouting\/|notes\.json|blocklist\.json/, s.agent); }
});

test('TREND-SCOUT gets 12 web calls a run, enforced by the engine (the 13th is refused, not priced)', async (t) => {
  const results = [];
  const base = createScoutScript();
  const script = (ctx, params) => { if (ctx.agentKey === 'trend-scout') { const last = params.messages[params.messages.length - 1]; if (Array.isArray(last.content)) results.push(...last.content.filter((b) => b.type === 'tool_result')); } return base(ctx, params); };
  script.web = base.web;
  const { e } = boot(t, { script });
  assert.equal(e.cfg.agents['trend-scout'].limits.maxWebCalls, 12);
  assert.deepEqual(e.cfg.agents['trend-scout'].tools.filter((x) => x.startsWith('web_')).sort(), ['web_fetch', 'web_search']);
  const j = await scout(e);
  assert.equal(j.state, 'research-done', j.reason);
  const web = e.ledger.rows().filter((x) => x.agentKey === 'trend-scout' && x.kind === 'web');
  assert.equal(web.length, 12, '12 web calls reached the ledger');
  const refused = results.find((x) => x.tool_use_id === 'tu_x');
  assert.ok(refused && refused.is_error, 'the 13th call came back as an error');
  assert.match(refused.content, /web call limit for this run reached \(12, enforced by the engine\)/);
});

test('"Weekly genre scout" is seeded disabled, once; a deleted seed stays deleted; it runs the genre-scout line', async (t) => {
  const r = tempRoot('scout-routine');
  t.after(() => r.cleanup());
  let { e } = { e: createEngine({ J: r.J, log: r.log, script: createScoutScript(), startScheduler: false }) };
  const id = 'rt_seed_weekly-genre-scout';
  let rt = e.store.getRoutine(id);
  assert.ok(rt, 'seeded');
  assert.equal(rt.name, 'Weekly genre scout'); assert.equal(rt.enabled, false); assert.equal(rt.target, 'line:genre-scout');
  assert.ok(e.routineTargets.some((x) => x.id === 'line:genre-scout'));
  const fired = await e.scheduler.fire(rt);
  assert.match(fired.skipped, /disabled/);
  const out = await e.runRoutine(rt);
  assert.equal(out.state, 'research-done', out.reason);
  assert.equal(out.line, 'genre-scout');
  e.close();
  e = createEngine({ J: r.J, log: r.log, startScheduler: false });
  assert.equal(e.store.listRoutines().filter((x) => x.id === id).length, 1, 'not seeded twice');
  e.routines.remove(id, { expectedVersion: e.store.getRoutine(id).version });
  e.close();
  e = createEngine({ J: r.J, log: r.log, startScheduler: false });
  assert.equal(e.store.getRoutine(id), null, 'a deleted seed is not brought back');
  e.close();
});

test('TREND-SCOUT has a desk in the Research room, wired like the others', async (t) => {
  const { e } = boot(t);
  const snap = buildEngineSnapshot(e);
  const dept = snap.departments.find((d) => d.key === 'research');
  assert.deepEqual(dept.agents.slice().sort(), ['demand-researcher', 'evidence-checker', 'trend-scout']);
  const a = snap.agents.find((x) => x.id === 'trend-scout' || x.key === 'trend-scout');
  assert.ok(a, 'in the snapshot');
  assert.equal(a.desk.roomId, 'research');
  assert.ok(!JSON.stringify(snap.warnings || []).includes('TREND-SCOUT has no desk'));
});
