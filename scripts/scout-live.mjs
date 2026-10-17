// scout-live.mjs — E6 step b: ONE genre-scout run on the live provider (Anthropic text + server-side web search), then
// exit. Run only with the owner's go-ahead, and only as a per-process override (.env keeps STATION_PROVIDER=mock):
//   PowerShell: $env:STATION_PROVIDER='live'; npm run scout:live; Remove-Item Env:STATION_PROVIDER
// - Refuses unless this process's own environment says live; refuses on the e-stop; needs the server stopped (the
//   engine lock). No scheduler, no resumed jobs, no routine: one genre-scout job, started here, run to its end.
// - Caps are the engine's own (config/engine.json): perJob[genre-scout] USD 0.50 for the whole run, the per-agent-run
//   cap, the daily caps, each agent's maxWebCalls; retries are live.retries. This script changes none of them; it
//   refuses to start if the scout run cap is not USD 0.50.
// - Before any model call it asks the Models API (free metadata, no tokens) whether the web relay model accepts the web
//   search tool, and refuses if it does not say yes.
// - Prints one pre-run line, then a key-free report: the briefs (verified, rejected, blocked by the scouting screen and
//   whether intake would refuse them; no blocked brief is offered to intake, so no job can be created), the web calls,
//   every ledger row of the run (request id, cost), the cost by model and in search fees, today's ledger total, the
//   names added to the internal scouting blocklist, and a check that no brief outside scouting/ names a scouted game or
//   hits the station's originality lists.
// The key is read from the environment by the provider only; .env is loaded without overriding the shell, and no value
// from it is printed.
import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from '../src/lib/legacy-readers/common.mjs';
import { createEngine } from '../src/engine/engine.mjs';
import { effectiveAgent } from '../src/engine/runtime.mjs';
import { createJail, APP_ROOT } from '../src/engine/store/jail.mjs';
import { makeLogger } from '../src/server/log.mjs';
import { dublinDay } from '../src/engine/time.mjs';
import { readBlocklist, scoutingBriefProblems, SCOUT_DIR } from '../src/engine/lib/scouting.mjs';
import { screenText } from '../src/engine/lib/originality.mjs';

const LINE = 'genre-scout', RUN_CAP_USD = 0.5;
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const field = (t, k) => (new RegExp('^' + k + ':[ \\t]*(.+)$', 'm').exec(t) || [])[1] || '';
const niche = (t) => (/^# Niche\s*\n(.+)$/m.exec(t) || [])[1] || '';
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);

if (process.env.STATION_PROVIDER !== 'live') {
  console.error('scout-live refused: this process\'s STATION_PROVIDER is "' + (process.env.STATION_PROVIDER || 'unset') + '". Run it as: $env:STATION_PROVIDER=\'live\'; npm run scout:live; Remove-Item Env:STATION_PROVIDER');
  process.exit(2);
}
loadEnv(path.join(APP_ROOT, '.env'));   // fills only what the shell has not set; the logger redacts the key names' values
const J = createJail(), log = makeLogger({ dir: path.join(APP_ROOT, 'logs'), name: 'scout-live', jail: J });
const out = (s) => console.log(log.redact(s));

let engine;
try { engine = createEngine({ J, log, startScheduler: false, resume: false }); }
catch (e) { console.error(log.redact('scout-live: the engine did not start: ' + e.message + (e.code === 'LOCKED' ? ' (the Station server holds the engine lock: stop it first)' : ''))); process.exit(1); }
try {
  const { cfg, providers, halt, ledger, store, orchestrator } = engine;
  if (providers.mode !== 'live') throw new Error('the engine is not on the live provider (' + providers.mode + ')');
  if (halt.isHalted()) throw new Error('e-stop is on: no call made');
  const L = cfg.lines[LINE]; if (!L) throw new Error('no ' + LINE + ' line in config');
  const capUsd = (cfg.engine.caps.perJobUsdByLine || {})[LINE];
  if (capUsd !== RUN_CAP_USD) throw new Error('config/engine.json perJobUsdByLine.' + LINE + ' is ' + capUsd + ', not ' + RUN_CAP_USD.toFixed(2) + ': refused (caps change only with the owner)');
  const W = providers.web.settings;
  const agents = Object.values(L.steps).filter((s) => s.kind === 'agent').map((s) => { const a = effectiveAgent(engine, s.agent), t = cfg.engine.tiers[a.tier]; return { key: a.key, enabled: a.enabled, model: t.model, effort: a.effort, maxWebCalls: a.limits.maxWebCalls || 0, maxTurns: a.limits.maxTurns, maxOutputTokens: a.limits.maxOutputTokens }; });
  const off = agents.filter((a) => !a.enabled); if (off.length) throw new Error('agent(s) off duty: ' + off.map((a) => a.key).join(', '));
  const sup = await providers.text.webSearchSupported(W.model);
  if (!sup.supported) throw new Error('the Models API does not report web search support for ' + W.model + (sup.reported ? ' (supported: false)' : ' (field missing)') + ': no model call made');
  const pre = 'scout-live: line=' + LINE + ' agents=' + agents.map((a) => a.key + ':' + a.model + '/effort ' + a.effort).join(',') + ' web_relay=' + W.model + '/effort ' + (W.effort || 'default') + ' (' + W.tools.web_search + ', ' + W.tools.web_fetch + ', max_uses=' + W.maxUsesPerRequest + ')' +
    ' web_call_cap=' + agents.map((a) => a.key + ' ' + a.maxWebCalls).join(',') + ' run_cap_usd=' + capUsd.toFixed(2) + ' agent_run_cap_usd=' + cfg.engine.caps.perRunUsd.toFixed(2) + ' retries=' + (cfg.engine.live.retries ?? 0) + ' web_search_supported=yes';
  log.info('scout-live: one run', { line: LINE, agents, webRelay: W.model, maxUses: W.maxUsesPerRequest, runCapUsd: capUsd, retries: cfg.engine.live.retries });
  out(pre);

  const rdir = path.join(J.dataRoot, 'research');
  const before = new Set(readBlocklist(rdir).terms.map((t) => t.kind + '|' + t.term));
  const t0 = Date.now();
  const c = orchestrator.createResearchJob({ line: LINE, by: 'owner (scripts/scout-live.mjs, E6 step b)' });
  await orchestrator.startJob(c.id);
  const job = store.getJob(c.id), day = job.data.day || dublinDay(t0);

  const fresh = (f) => fs.statSync(f).mtimeMs >= t0 - 1000;
  const genre = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.startsWith(day + '--genre-') && fresh(path.join(d, f))).sort() : []);
  const read = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');
  const verified = genre(path.join(rdir, 'briefs')).map((f) => { const t = read(path.join(rdir, 'briefs'), f); return { file: f, status: field(t, 'status'), niche: niche(t), segment: field(t, 'audience_segment') }; });
  const rejected = genre(path.join(rdir, 'rejected')).map((f) => { const t = read(path.join(rdir, 'rejected'), f); return { file: f, status: field(t, 'status'), niche: niche(t), reasons: (t.split('## Station brief check')[1] || t.split('## Evidence check')[1] || '').split('\n').filter((l) => /^- /.test(l)).map((l) => l.slice(2)).slice(0, 6) }; });
  const bdir = path.join(rdir, SCOUT_DIR, 'blocked', day);
  const blocked = genre(bdir).map((f) => { const t = read(bdir, f); const asVerified = t.replace(/^status: .*$/m, 'status: verified').replace(/\n## Station scouting screen[\s\S]*$/, '\n'); return { file: f, reasons: t.split('\n').filter((l) => /^- originality/.test(l)).map((l) => l.slice(2)), intakeWouldRefuse: scoutingBriefProblems(asVerified, cfg.station) }; });

  // customer-facing check: every file this run wrote outside scouting/ (the briefs and drafts), against the scouted names
  // and the station's originality lists (brands, characters, people, derivative wording)
  const terms = readBlocklist(rdir).terms, lower = (s) => String(s).toLowerCase();
  const outside = walk(rdir).filter((f) => !path.relative(rdir, f).split(path.sep)[0].toLowerCase().startsWith(SCOUT_DIR) && fresh(f) && /\.(md|json|txt)$/.test(f));
  const facing = outside.map((f) => { const t = fs.readFileSync(f, 'utf8'); return { file: path.relative(rdir, f).split(path.sep).join('/'), scoutedNames: terms.filter((x) => lower(t).includes(lower(x.term))).map((x) => x.kind), scoutingScreen: scoutingBriefProblems(t, cfg.station).length, originality: screenText(t, cfg.station).hits.map((h) => h.category + ': ' + h.phrase) }; });

  const rows = ledger.rows().filter((r) => r.jobId === job.id);
  const byModel = {}; let searchFees = 0, searches = 0, fetches = 0;
  for (const r of rows) {
    if (r.kind === 'web') { const fee = r6((r.searches || 0) * W.fees.web_search + (r.fetches || 0) * W.fees.web_fetch); searchFees = r6(searchFees + fee); searches += r.searches || 0; fetches += r.fetches || 0; const m = (r.via || r.model) + ' (web relay tokens)'; byModel[m] = r6((byModel[m] || 0) + r.usd - fee); }
    else byModel[r.model] = r6((byModel[r.model] || 0) + r.usd);
  }
  const added = readBlocklist(rdir).terms.filter((t) => !before.has(t.kind + '|' + t.term)).map((t) => ({ term: t.term, kind: t.kind }));
  const today = dublinDay(Date.now());
  out(JSON.stringify({
    job: { id: job.id, state: job.state, reason: job.reason, day, minutes: r6((Date.now() - t0) / 60000) },
    steps: (job.data.scouting || {}).drafts || [],
    briefs: { verified, rejected, blocked },
    web: { requests: rows.filter((r) => r.kind === 'web').length, searches, fetches, byAgent: Object.fromEntries(agents.map((a) => [a.key, { rows: rows.filter((r) => r.kind === 'web' && r.agentKey === a.key).length, cap: a.maxWebCalls }])) },
    cost: { totalUsd: r6(rows.reduce((s, r) => s + r.usd, 0)), byModel, searchFeesUsd: searchFees, capUsd, estimatedRows: rows.filter((r) => r.estimated).length },
    ledgerRows: rows.map((r) => ({ entryId: r.entryId, requestId: r.requestId || null, agent: r.agentKey, kind: r.kind, model: r.model, ...(r.kind === 'web' ? { via: r.via, searches: r.searches, fetches: r.fetches } : {}), tokens: r.tokens, usd: r.usd, estimated: !!r.estimated })),
    ledgerToday: { day: today, usd: ledger.spent.day(today), rows: ledger.rows().filter((r) => dublinDay(r.ts) === today).length },
    blocklistAdded: { file: 'research/scouting/blocklist.json (internal)', names: added },
    customerFacingCheck: { files: facing.length, clean: facing.every((f) => !f.scoutedNames.length && !f.scoutingScreen && !f.originality.length), detail: facing }
  }, null, 1));
} catch (e) {
  console.error(log.redact('scout-live failed (no rerun): ' + (e.message || e) + (e.status ? ' [status ' + e.status + ']' : '') + (e.requestId ? ' [request ' + e.requestId + ']' : '')));
  process.exitCode = 1;
} finally { engine.close(); }
