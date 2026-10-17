// smoke-live.mjs — E6 step a: ONE live call to the Anthropic API, through the engine's spend guard and ledger.
// Run only with the owner's go-ahead, and only as a per-process override (.env keeps STATION_PROVIDER=mock):
//   PowerShell: $env:STATION_PROVIDER='live'; npm run smoke:live; Remove-Item Env:STATION_PROVIDER
// The call: claude-haiku-5-5, max_tokens 32, a one-line system prompt, one user message, no tools, no caching, no
// retries; the run cap is USD 0.01 (below the per-run cap). It refuses unless this process's own environment says live,
// refuses on the e-stop (the guard refuses too), and needs the server stopped (the engine lock). The key is read from
// the environment by the provider only; .env is loaded without overriding the shell, and no value from it is printed.
// Prints the reply, the request id, the usage, the settled USD, the ledger row and today's ledger total.
import path from 'node:path';
import { loadEnv } from '../src/lib/legacy-readers/common.mjs';
import { createEngine } from '../src/engine/engine.mjs';
import { guardedTextCall, estimateTokens } from '../src/engine/runtime.mjs';
import { createJail, APP_ROOT } from '../src/engine/store/jail.mjs';
import { makeLogger } from '../src/server/log.mjs';
import { dublinDay } from '../src/engine/time.mjs';

const SMOKE ={ model: 'claude-haiku-5-5', maxTokens: 32, runCapUsd: 0.01, retries: 0, system: 'You are the station engine\'s connectivity check.', user: 'Reply with the single word: ready' };

if (process.env.STATION_PROVIDER !== 'live') {
  console.error('smoke-live refused: this process\'s STATION_PROVIDER is "' + (process.env.STATION_PROVIDER || 'unset') + '". Run it as: $env:STATION_PROVIDER=\'live\'; npm run smoke:live; Remove-Item Env:STATION_PROVIDER');
  process.exit(2);
}
loadEnv(path.join(APP_ROOT, '.env'));   // fills only what the shell has not set; the logger below redacts the key names' values
const J = createJail(), log = makeLogger({ dir: path.join(APP_ROOT, 'logs'), name: 'smoke-live', jail: J });
const out = (s) => console.log(log.redact(s));

let engine;
try { engine = createEngine({ J, log, startScheduler: false, resume: false }); }
catch (e) { console.error(log.redact('smoke-live: the engine did not start: ' + e.message + (e.code === 'LOCKED' ? ' (stop the server first)' : ''))); process.exit(1); }
try {
  if (engine.providers.mode !== 'live') throw new Error('the engine is not on the live provider (' + engine.providers.mode + ')');
  if (engine.halt.isHalted()) throw new Error('e-stop is on: no call made');
  const params = { model: SMOKE.model, max_tokens: SMOKE.maxTokens, system: SMOKE.system, messages: [{ role: 'user', content: SMOKE.user }] };
  const runId = 'smoke_' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const call = { provider: 'anthropic', model: SMOKE.model, kind: 'text', runId, jobId: null, agentKey: null, line: null, inputTokens: estimateTokens({ system: params.system, messages: params.messages }), maxOutputTokens: SMOKE.maxTokens, runCapUsd: SMOKE.runCapUsd };
  log.info('smoke-live: one call', { model: SMOKE.model, maxTokens: SMOKE.maxTokens, runCapUsd: SMOKE.runCapUsd, runId });
  const { resp, row } = await guardedTextCall({ guard: engine.guard, halt: engine.halt, providers: engine.providers, call, params, retry: { retries: SMOKE.retries }, log, note: 'E6 step a: smoke call (scripts/smoke-live.mjs)' });
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const day = dublinDay(Date.now());
  out(JSON.stringify({
    reply: text, stopReason: resp.stop_reason, model: resp.model, requestId: resp.request_id, messageId: resp.id,
    usage: resp.usage, settledUsd: row.usd, reservedUsd: row.reservedUsd, ledgerRow: row,
    ledgerToday: { day, usd: engine.ledger.spent.day(day), rows: engine.ledger.rows().filter((r) => dublinDay(r.ts) === day).length }
  }, null, 1));
} catch (e) {
  console.error(log.redact('smoke-live failed (no retry): ' + (e.message || e) + (e.status ? ' [status ' + e.status + ']' : '') + (e.requestId ? ' [request ' + e.requestId + ']' : '')));
  process.exitCode = 1;
} finally { engine.close(); }
