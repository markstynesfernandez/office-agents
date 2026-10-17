// runtime.mjs — one agent run = the model–tool loop for one agent on one job step (ENGINE-PLAN.md §2.3). The engine's
// own loop, so the spend guard and the e-stop sit in front of EVERY model call:
//   reserve (worst case, every cap) -> call with the e-stop's AbortSignal -> settle the real cost to the ledger (fsync)
//   -> run the tool calls -> repeat
// A run ends when the agent stops calling tools, hits maxTurns, a cap refuses the next call, or the e-stop fires. Each
// run records the sha256 of its exact prompt. The page never sees prompts or provider responses.
import crypto from 'node:crypto';
import { buildAgentPrompt, engineWrapper } from './prompts.mjs';
import { createToolbox, ToolError } from './tools/index.mjs';
import { CapError, GuardRefusal } from './guard.mjs';

export class RunStopped extends Error { constructor(reason, cause) { super(reason); this.code = 'STOPPED'; this.cause = cause; } }

// the effective agent: config file + the page's overlay (on/off, tier, effort) from SQLite
export function effectiveAgent(engine, key) {
  const base = engine.cfg.agents[key]; if (!base) throw new Error('no agent config for ' + key);
  const o = engine.store.agentState(key) || {};
  return { ...base, enabled: o.enabled == null ? base.enabled !== false : !!o.enabled, tier: o.tier || base.tier, effort: o.effort || base.effort };
}

export const estimateTokens = (obj) => Math.ceil(JSON.stringify(obj).length / 3);   // conservative (~3 chars per token)

const abortableSleep = (ms, signal) => new Promise((res, rej) => { if (signal && signal.aborted) return rej(signal.reason || new Error('aborted')); const t = setTimeout(res, ms); if (signal) signal.addEventListener('abort', () => { clearTimeout(t); rej(signal.reason || new Error('aborted')); }, { once: true }); });
// wait before attempt n+1: a server retry-after when given, else backoffMs x 2^n; capped at backoffMaxMs
export function backoffDelay(retry = {}, attempt = 0, retryAfterMs = null) {
  const base = retry.backoffMs ?? 2000, max = retry.backoffMaxMs ?? 30000;
  return Math.min(max, retryAfterMs != null ? retryAfterMs : base * 2 ** attempt);
}

// One priced model call through the spend guard (E6 a0; the runtime's loop, image_analyze and scripts/smoke-live.mjs):
//   reserve (every cap; the e-stop refuses) -> call with the e-stop's signal -> settle the real cost from the usage.
// A refused reservation throws before any call. On a retryable provider error (429, 5xx, network: `retryable`), it
// waits and tries again up to retry.retries times; EVERY attempt reserves again. A provider error with a status is
// released (not billed); one without a usage report is charged at the reserved maximum, marked estimated.
export async function guardedTextCall({ guard, halt, providers, call, params, ctx = {}, stopSignal = null, retry = {}, log = null, note = null, sleep = abortableSleep }) {
  const retries = Math.max(0, Math.floor(retry.retries || 0));
  for (let attempt = 0; ; attempt++) {
    const res = guard.reserve(call);
    const signal = stopSignal ? AbortSignal.any([halt.signal, stopSignal]) : halt.signal;
    let resp;
    try { resp = await providers.text.create(params, { signal, ctx: attempt ? { ...ctx, attempt } : ctx }); }
    catch (e) {
      if (halt.signal.aborted) { guard.settle(res, { usd: res.maxUsd, estimated: true, note: 'aborted by the e-stop mid-call; charged at the reserved maximum' }); throw new RunStopped('e-stop', e); }
      if (stopSignal && stopSignal.aborted) { guard.settle(res, { usd: res.maxUsd, estimated: true, note: 'stopped by the owner mid-call; charged at the reserved maximum' }); throw new RunStopped('stopped by the owner', e); }
      if (e && e.status) guard.release(res, 'provider error ' + e.status); else guard.settle(res, { usd: res.maxUsd, estimated: true, note: 'call failed without a usage report; charged at the reserved maximum' });
      if (!(e && e.retryable) || attempt >= retries) throw e;
      const waitMs = backoffDelay(retry, attempt, e.retryAfterMs);
      log && log.warn('provider call failed; retrying with a new reservation', { model: call.model, status: e.status ?? null, code: e.code || null, attempt: attempt + 1, retries, waitMs, runId: call.runId || null, jobId: call.jobId ?? null });
      try { await sleep(waitMs, signal); } catch (_) { throw new RunStopped(halt.signal.aborted ? 'e-stop' : 'stopped by the owner'); }
      continue;
    }
    const row = guard.settle(res, { usage: resp.usage, ...(resp.request_id ? { requestId: resp.request_id, messageId: resp.id } : {}), ...(note ? { note } : {}) });
    return { resp, row, attempts: attempt + 1 };
  }
}

// stopSignal (E5): the owner's Stop on this job; it aborts the call in flight like the e-stop, for this job only
export async function runAgent(engine, { agentKey, job = null, step = null, pass = 1, folder, folderLabel, input, loopNote = null, line = null, runCapUsd = null, hooks = {}, stopSignal = null }) {
  const { store, guard, providers, halt, bus, log, cfg } = engine;
  const agent = effectiveAgent(engine, agentKey);
  if (!agent.enabled) throw new RunStopped(agent.name + ' is off duty');
  const tier = cfg.engine.tiers[agent.tier]; if (!tier) throw new Error('unknown tier ' + agent.tier);
  const provider = providers.mode === 'mock' ? 'mock' : tier.provider, model = tier.model;
  const prompt = buildAgentPrompt(agent, { promptsDir: cfg.promptsDir, budgets: cfg.station.promptBudgetChars || {} });
  const runId = 'run_' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '_' + crypto.randomBytes(3).toString('hex');
  const run = { runId, runCapUsd };
  let verdict = null;
  const ctx = { J: engine.J, folder, agent, job, cfg: { ...cfg, blocklist: cfg.blocklist }, guard, providers, run, halt, log, bus, line, onVerdict: (v) => { verdict = v; }, callModel: null };
  const box = createToolbox(ctx);
  const wrapper = engineWrapper({ agent, job, step, pass, tools: box.defs.map((d) => d.name), folderLabel, isQa: !!agent.verdict, loopNote });
  const system = [{ type: 'text', text: prompt.soul + '\n' + prompt.text, ...(cfg.engine.runtime.promptCaching ? { cache_control: { type: 'ephemeral' } } : {}) }, { type: 'text', text: wrapper }];
  const promptSha256 = crypto.createHash('sha256').update(JSON.stringify(system)).digest('hex');
  store.insertRun({ runId, jobId: job ? job.id : null, agentKey, step, pass, model, provider, promptSha256 });
  bus.emit('run.start', { jobId: job ? job.id : null, agentKey, data: { runId, step, pass, model, provider, effort: agent.effort } });
  log.info('run start', { runId, agent: agentKey, jobId: job && job.id, step, pass, model, provider, effort: agent.effort, promptSha256, promptChars: prompt.chars });
  if (hooks.onRunStart) { try { await hooks.onRunStart({ runId, agentKey, job, step, pass }); } catch (e) { log.warn('hook failed (ignored)', { hook: 'onRunStart', runId, error: e.message }); } }

  const totals = { usd: 0, tokensIn: 0, tokensOut: 0, turns: 0, tools: [] };
  // one priced model call through the guard (used by the loop and by image_analyze)
  async function callModel({ messages, tools, maxOutputTokens, purpose = 'turn', extraCtx = {} }) {
    const params = { model, max_tokens: maxOutputTokens, system, messages, ...(tools && tools.length ? { tools } : {}) };
    const { resp, row } = await guardedTextCall({ guard, halt, providers, stopSignal, log, params,
      call: { provider, model, kind: 'text', runId, jobId: job ? job.id : null, agentKey, line, inputTokens: estimateTokens({ system, messages, tools }), maxOutputTokens, runCapUsd },
      ctx: { agentKey, jobId: job && job.id, job, step, pass, purpose, turn: totals.turns, effort: agent.effort, ...extraCtx },
      retry: providers.mode === 'live' ? cfg.engine.live || {} : {} });
    totals.usd += row.usd; totals.tokensIn += resp.usage.input_tokens || 0; totals.tokensOut += resp.usage.output_tokens || 0;
    if (purpose === 'image_analyze') return resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return resp;
  }
  ctx.callModel = callModel;

  const messages = [{ role: 'user', content: String(input) }];
  let status = 'done', endReason = 'end_turn', error = null, lastText = '';
  try {
    for (;;) {
      if (halt.isHalted()) throw new RunStopped('e-stop');
      if (stopSignal && stopSignal.aborted) throw new RunStopped('stopped by the owner');
      if (totals.turns >= agent.limits.maxTurns) { status = 'max-turns'; endReason = 'maxTurns ' + agent.limits.maxTurns + ' reached'; break; }
      totals.turns++;
      const resp = await callModel({ messages, tools: box.defs, maxOutputTokens: agent.limits.maxOutputTokens });
      messages.push({ role: 'assistant', content: resp.content });
      lastText = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n') || lastText;
      const uses = resp.content.filter((b) => b.type === 'tool_use');
      if (resp.stop_reason !== 'tool_use' || !uses.length) { endReason = resp.stop_reason || 'end_turn'; break; }
      const results = [];
      for (const u of uses) {
        totals.tools.push(u.name);
        let out, isError = false;
        try { out = await box.call(u.name, u.input); }
        catch (e) {
          if (e instanceof CapError || e instanceof GuardRefusal || e instanceof RunStopped) throw e;
          if (halt.signal.aborted) throw new RunStopped('e-stop', e);
          if (stopSignal && stopSignal.aborted) throw new RunStopped('stopped by the owner', e);
          isError = true; out = (e instanceof ToolError ? '' : 'tool failed: ') + e.message;
          log.warn('tool error', { runId, agent: agentKey, tool: u.name, error: e.message });
        }
        log.info('tool', { runId, agent: agentKey, tool: u.name, error: isError || undefined });
        results.push({ type: 'tool_result', tool_use_id: u.id, content: String(out).slice(0, 20000), ...(isError ? { is_error: true } : {}) });
      }
      messages.push({ role: 'user', content: results });
    }
  } catch (e) {
    if (e instanceof CapError) { status = 'cap'; endReason = e.message; }
    else if (e instanceof GuardRefusal) { status = e.code === 'HALT' ? 'stopped' : 'refused'; endReason = e.message; }
    else if (e instanceof RunStopped) { status = 'stopped'; endReason = e.message; }
    else { status = 'failed'; endReason = 'error'; error = String(e && e.message || e); log.error('run failed', { runId, agent: agentKey, error: String(e && e.stack || e) }); }
  }
  store.finishRun(runId, { status, usd: totals.usd, tokensIn: totals.tokensIn, tokensOut: totals.tokensOut, turns: totals.turns, endReason, error, tools: totals.tools });
  bus.emit('run.end', { jobId: job ? job.id : null, agentKey, data: { runId, status, endReason, usd: Math.round(totals.usd * 1e6) / 1e6, turns: totals.turns, tools: totals.tools.length } });
  log.info('run end', { runId, agent: agentKey, status, endReason, usd: totals.usd, turns: totals.turns, images: box.counters.images, web: box.counters.web });
  return { runId, status, endReason, error, verdict, text: lastText, ...totals, counters: box.counters, promptSha256 };
}
