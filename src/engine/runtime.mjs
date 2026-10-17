// runtime.mjs — one agent run = the model–tool loop for one agent on one job step (ENGINE-PLAN.md §2.3). The engine's
// own loop, so the spend guard and the e-stop sit in front of EVERY model call:
//   reserve (worst case, every cap) -> call with the e-stop's AbortSignal -> settle the real cost to the ledger (fsync)
//   -> run the tool calls -> repeat
// A run ends when the agent stops calling tools, hits maxTurns, a cap refuses the next call, or the e-stop fires. Each
// run records the sha256 of its exact prompt. The page never sees prompts or provider responses.
// E6 b1: every model call of a job is appended to data/jobs/<id>/transcript.jsonl (key-redacted; internal, never logs/
// or git). An output contract (the line step's `outputs`, built by the orchestrator) is checked when the agent ends its
// turn: missing outputs get a follow-up message naming the tool, with tool_choice requiring a call, at most
// MAX_NUDGES times; still missing -> status `incomplete` (or `done` with a shortfall when the contract allows partial).
// E6 b2 (owner D2): report_blocked(reason) is the "cannot produce" outcome: it satisfies the contract and ends the run at
// once (no nudge): `incomplete` with that reason when nothing was written, a recorded shortfall when a partial set exists
// and the contract allows partials (owner decision 3); a nudge offers exactly fs_write or report_blocked.
// E6 c0: the agent's thinking setting (config/agents/<key>.json thinking, owner D2) rides on every call's ctx; image_analyze is
// reserved as vision tokens (the image's own size, lib/vision.mjs), not as the length of its base64 text; the orchestrator's image
// policy (style-reference run modes, ctx.image), the QA verdict kind (the file-1 check) and the per-file image attempt count (job
// data imageAttempts, against the QA loop limit) reach the toolbox. A provider refusal raised before the network is never billed.
import crypto from 'node:crypto';
import path from 'node:path';
import { buildAgentPrompt, engineWrapper } from './prompts.mjs';
import { createToolbox, ToolError, PRE_NETWORK } from './tools/index.mjs';
import { CapError, GuardRefusal } from './guard.mjs';
import { makeRedactor } from './providers/anthropic.mjs';
import { urlsIn } from './lib/web-sources.mjs';

export const MAX_NUDGES = 2;
export const TRANSCRIPT_RESULT_CHARS = 2000;

export class RunStopped extends Error { constructor(reason, cause) { super(reason); this.code = 'STOPPED'; this.cause = cause; } }

// the effective agent: config file + the page's overlay (on/off, tier, effort) from SQLite
export function effectiveAgent(engine, key) {
  const base = engine.cfg.agents[key]; if (!base) throw new Error('no agent config for ' + key);
  const o = engine.store.agentState(key) || {};
  return { ...base, enabled: o.enabled == null ? base.enabled !== false : !!o.enabled, tier: o.tier || base.tier, effort: o.effort || base.effort };
}

export const estimateTokens = (obj) => Math.ceil(JSON.stringify(obj).length / 3);   // conservative (~3 chars per token)
// the messages with every image's base64 data left out (an image is counted as vision tokens instead: lib/vision.mjs)
export const withoutImageData = (messages) => messages.map((m) => (Array.isArray(m.content) ? { ...m, content: m.content.map((b) => (b && b.type === 'image' && b.source && b.source.data ? { ...b, source: { ...b.source, data: '' } } : b)) } : m));

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
      if (e && e.status) guard.release(res, 'provider error ' + e.status);
      else if (e && PRE_NETWORK.includes(e.code)) guard.release(res, 'refused before the network: ' + e.code);
      else guard.settle(res, { usd: res.maxUsd, estimated: true, note: 'call failed without a usage report; charged at the reserved maximum' });
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
// image / verdictKind / file1 / imageAttemptLimit (E6 c0, the style-reference set): the orchestrator's run mode for image_generate,
// the QA verdict kind when it is not the agent's own (the file-1 check), the file that check is about, and the per-file attempt limit
export async function runAgent(engine, { agentKey, job = null, step = null, pass = 1, folder, folderLabel, input, loopNote = null, line = null, runCapUsd = null, hooks = {}, stopSignal = null, contract = null, image = null, verdictKind = null, file1 = null, imageAttemptLimit = null }) {
  const { store, guard, providers, halt, bus, log, cfg } = engine;
  const agent = effectiveAgent(engine, agentKey);
  if (!agent.enabled) throw new RunStopped(agent.name + ' is off duty');
  const tier = cfg.engine.tiers[agent.tier]; if (!tier) throw new Error('unknown tier ' + agent.tier);
  const provider = providers.mode === 'mock' ? 'mock' : tier.provider, model = tier.model;
  const prompt = buildAgentPrompt(agent, { promptsDir: cfg.promptsDir, budgets: cfg.station.promptBudgetChars || {} });
  const runId = 'run_' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '_' + crypto.randomBytes(3).toString('hex');
  const run = { runId, runCapUsd };
  let verdict = null, blockedReason = null;
  // failed image attempts per file name, kept on the job (a content refusal counts as a failed attempt, owner E6 c0)
  const imageAttempts = job ? {
    count: (name) => (((store.getJob(job.id) || {}).data || {}).imageAttempts || {})[name] ? store.getJob(job.id).data.imageAttempts[name].length : 0,
    add: (name, why) => { const cur = (((store.getJob(job.id) || {}).data || {}).imageAttempts) || {}; const list = [...(cur[name] || []), { at: Date.now(), why: String(why || '') }]; store.updateJob(job.id, { data: { imageAttempts: { ...cur, [name]: list } } }); return list.length; }
  } : null;
  const ctx = { J: engine.J, folder, agent, job, model, cfg: { ...cfg, blocklist: cfg.blocklist }, guard, providers, run, halt, log, bus, line, contract, image, verdictKind, file1, imageAttempts, imageAttemptLimit, sleep: engine.sleep || null, onVerdict: (v) => { verdict = v; }, onBlocked: (r) => { blockedReason = r; }, callModel: null };
  const box = createToolbox(ctx);
  const wrapper = engineWrapper({ agent, job, step, pass, tools: box.defs.map((d) => d.name), folderLabel, isQa: !!agent.verdict, loopNote });
  const system = [{ type: 'text', text: prompt.soul + '\n' + prompt.text, ...(cfg.engine.runtime.promptCaching ? { cache_control: { type: 'ephemeral' } } : {}) }, { type: 'text', text: wrapper }];
  const promptSha256 = crypto.createHash('sha256').update(JSON.stringify(system)).digest('hex');
  store.insertRun({ runId, jobId: job ? job.id : null, agentKey, step, pass, model, provider, promptSha256 });
  bus.emit('run.start', { jobId: job ? job.id : null, agentKey, data: { runId, step, pass, model, provider, effort: agent.effort, thinking: agent.thinking || 'default', ...(image && image.mode ? { imageMode: image.mode } : {}) } });
  log.info('run start', { runId, agent: agentKey, jobId: job && job.id, step, pass, model, provider, effort: agent.effort, thinking: agent.thinking || 'default', ...(image && image.mode ? { imageMode: image.mode, set: image.set, from: image.from, to: image.to } : {}), ...(verdictKind ? { verdictKind } : {}), promptSha256, promptChars: prompt.chars });
  if (hooks.onRunStart) { try { await hooks.onRunStart({ runId, agentKey, job, step, pass }); } catch (e) { log.warn('hook failed (ignored)', { hook: 'onRunStart', runId, error: e.message }); } }

  const totals = { usd: 0, tokensIn: 0, tokensOut: 0, turns: 0, tools: [] };
  // one priced model call through the guard (used by the loop and by image_analyze)
  // visionTokens (image_analyze): the image's visual tokens from its pixel size, added to the text estimate of everything else
  async function callModel({ messages, tools, maxOutputTokens, purpose = 'turn', extraCtx = {}, toolChoice = null, visionTokens = 0 }) {
    const params = { model, max_tokens: maxOutputTokens, system, messages, ...(tools && tools.length ? { tools } : {}), ...(toolChoice && tools && tools.length ? { tool_choice: toolChoice } : {}) };
    const inputTokens = estimateTokens({ system, messages: withoutImageData(messages), tools }) + (visionTokens || 0);
    const { resp, row } = await guardedTextCall({ guard, halt, providers, stopSignal, log, params,
      call: { provider, model, kind: 'text', runId, jobId: job ? job.id : null, agentKey, line, inputTokens, maxOutputTokens, runCapUsd },
      ctx: { agentKey, jobId: job && job.id, job, step, pass, purpose, turn: totals.turns, effort: agent.effort, thinking: agent.thinking || 'default', ...extraCtx },
      retry: providers.mode === 'live' ? cfg.engine.live || {} : {} });
    totals.usd += row.usd; totals.tokensIn += resp.usage.input_tokens || 0; totals.tokensOut += resp.usage.output_tokens || 0;
    if (purpose === 'image_analyze') return resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return resp;
  }
  ctx.callModel = callModel;

  // the job's transcript (E6 b1): one JSON line per model call, every line through the key redaction, inside data/ only
  const redactKey = makeRedactor([]), redact = (t) => redactKey(log && log.redact ? log.redact(t) : t);
  const transcriptFile = job ? path.join(engine.J.dataRoot, 'jobs', job.id, 'transcript.jsonl') : null;
  const addLine = (rec) => { if (!transcriptFile) return; try { engine.J.add(transcriptFile, redact(JSON.stringify(rec)) + '\n'); } catch (e) { log.warn('transcript write failed (ignored)', { runId, error: e.message }); } };
  // E6 b2 (owner D1): the URLs each web call returned are kept IN FULL (returnedUrls; searchUrls = the web_search part), so a
  // fetch or a citation can be checked against what the web really gave this job, whatever the excerpt length
  const transcript = (resp, uses, results, extra = {}, web = null) => addLine({ at: new Date().toISOString(), runId, agent: agentKey, step, pass, turn: totals.turns, requestId: resp.request_id || null, stop_reason: resp.stop_reason || null,
    text: resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n'), toolCalls: uses.map((u) => ({ name: u.name, input: u.input })),
    toolResults: results.map((r) => ({ tool_use_id: r.tool_use_id, is_error: !!r.is_error, content: String(r.content).slice(0, TRANSCRIPT_RESULT_CHARS) })),
    ...(web && web.all.size ? { returnedUrls: [...web.all], searchUrls: [...web.search] } : {}), ...extra });

  const messages = [{ role: 'user', content: String(input) }];
  let status = 'done', endReason = 'end_turn', error = null, lastText = '', nudges = 0, toolChoice = null, shortfall = null, missing = null, nudgeOnly = null;
  try {
    for (;;) {
      if (halt.isHalted()) throw new RunStopped('e-stop');
      if (stopSignal && stopSignal.aborted) throw new RunStopped('stopped by the owner');
      if (totals.turns >= agent.limits.maxTurns) { status = 'max-turns'; endReason = 'maxTurns ' + agent.limits.maxTurns + ' reached'; break; }
      totals.turns++;
      const after = toolChoice ? { afterNudge: nudges } : {};
      const resp = await callModel({ messages, tools: box.defs, maxOutputTokens: agent.limits.maxOutputTokens, toolChoice });
      const only = toolChoice ? nudgeOnly : null;   // the reply to a nudge may call only the two tools the nudge offered
      toolChoice = null; nudgeOnly = null;
      messages.push({ role: 'assistant', content: resp.content });
      lastText = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n') || lastText;
      const uses = resp.content.filter((b) => b.type === 'tool_use');
      if (resp.stop_reason !== 'tool_use' || !uses.length) {
        endReason = resp.stop_reason || 'end_turn';
        transcript(resp, [], [], after);
        // the output contract: an agent that ends its turn with neither its required outputs nor report_blocked is nudged, at
        // most MAX_NUDGES times; each nudge is one more model call, reserved and capped like any other. The nudge offers
        // exactly two ways out (owner D2): write the outputs, or report_blocked with the reason they cannot be produced.
        const c = contract ? contract.check() : null;
        if (c && c.missing.length && nudges < MAX_NUDGES && !['max_tokens', 'refusal'].includes(endReason)) {
          nudges++;
          const msg = '[STATION: required outputs missing, reminder ' + nudges + ' of ' + MAX_NUDGES + '] You ended your turn without: ' + c.missing.join('; ') + '. Do exactly one of two things now: call ' + contract.tool + ' (one call per missing file) if you can produce them with evidence, or call report_blocked with the reason you cannot. Never write an output without its evidence.' + (contract.hint ? ' ' + contract.hint : '');
          messages.push({ role: 'user', content: msg });
          // tool_choice (claude-api skill, read 17/10/2026): `any` = the model must call at least one of the request's tools;
          // there is no "one of these two" choice, so the engine refuses any other tool in the reply (nudgeOnly). Claude
          // Haiku 5.5 accepts a forced choice; Claude Sonnet 5.5 returns a 400 for `any` and `tool`, so its tier sets
          // forcedToolChoice false and the message alone carries the instruction (auto).
          toolChoice = tier.forcedToolChoice === false ? { type: 'auto' } : { type: 'any' };
          nudgeOnly = new Set([contract.tool, 'report_blocked']);
          log.warn('required outputs missing: nudge', { runId, agent: agentKey, jobId: job && job.id, nudge: nudges, missing: c.missing, toolChoice: toolChoice.type, offered: [...nudgeOnly] });
          addLine({ at: new Date().toISOString(), runId, agent: agentKey, step, pass, nudge: nudges, message: msg, tool_choice: toolChoice, offered: [...nudgeOnly] });
          continue;
        }
        if (c && c.missing.length) {
          if (contract.partialOk && c.have >= 1) { shortfall = { have: c.have, want: c.want, missing: c.missing }; endReason = 'shortfall: ' + c.have + ' of ' + c.want + ' (' + c.missing.join('; ') + ')'; }
          else { status = 'incomplete'; missing = c.missing; endReason = 'missing outputs: ' + c.missing.join('; '); }
        }
        break;
      }
      const results = [], web = { all: new Set(), search: new Set() };
      for (const u of uses) {
        totals.tools.push(u.name);
        let out, isError = false;
        try {
          if (only && !only.has(u.name)) throw new ToolError(u.name + ' refused: answer the reminder with ' + [...only].join(' or ') + ' only');
          out = await box.call(u.name, u.input);
          if (u.name === 'web_search' || u.name === 'web_fetch') for (const x of urlsIn(out)) { web.all.add(x); if (u.name === 'web_search') web.search.add(x); }
        }
        catch (e) {
          if (e instanceof CapError || e instanceof GuardRefusal || e instanceof RunStopped) { transcript(resp, uses, results, { ...after, error: e.message }); throw e; }
          if (halt.signal.aborted) throw new RunStopped('e-stop', e);
          if (stopSignal && stopSignal.aborted) throw new RunStopped('stopped by the owner', e);
          isError = true; out = (e instanceof ToolError ? '' : 'tool failed: ') + e.message;
          log.warn('tool error', { runId, agent: agentKey, tool: u.name, error: e.message });
        }
        log.info('tool', { runId, agent: agentKey, tool: u.name, error: isError || undefined });
        results.push({ type: 'tool_result', tool_use_id: u.id, content: String(out).slice(0, 20000), ...(isError ? { is_error: true } : {}) });
      }
      transcript(resp, uses, results, after, web);
      messages.push({ role: 'user', content: results });
      // report_blocked (owner D2): the agent says it cannot produce its outputs; that satisfies the contract and ends the
      // run (no nudge, no further call): status incomplete with the agent's reason, so the job ends incomplete
      // Owner decision 3 (17/10/2026, after b2a): with a partial-allowed contract and at least 1 output already written
      // (drafts are schema-checked on write, so each one is valid), report_blocked records the shortfall and its reason
      // and the line continues with what exists; only report_blocked with 0 outputs (or a contract without partials)
      // ends the run incomplete
      if (blockedReason) {
        const c = contract ? contract.check() : null;
        if (c && contract.partialOk && c.have >= 1) { shortfall = { have: c.have, want: c.want, missing: c.missing, reason: blockedReason }; endReason = 'shortfall: ' + c.have + ' of ' + c.want + ', reported blocked: ' + blockedReason; }
        else { status = 'incomplete'; endReason = 'reported blocked: ' + blockedReason; }
        log.warn('agent reported blocked', { runId, agent: agentKey, jobId: job && job.id, reason: blockedReason, have: c ? c.have : null, continues: status !== 'incomplete' });
        break;
      }
    }
  } catch (e) {
    if (e instanceof CapError) { status = 'cap'; endReason = e.message; }
    else if (e instanceof GuardRefusal) { status = e.code === 'HALT' ? 'stopped' : 'refused'; endReason = e.message; }
    else if (e instanceof RunStopped) { status = 'stopped'; endReason = e.message; }
    else { status = 'failed'; endReason = 'error'; error = String(e && e.message || e); log.error('run failed', { runId, agent: agentKey, error: String(e && e.stack || e) }); }
  }
  store.finishRun(runId, { status, usd: totals.usd, tokensIn: totals.tokensIn, tokensOut: totals.tokensOut, turns: totals.turns, endReason, error, tools: totals.tools });
  bus.emit('run.end', { jobId: job ? job.id : null, agentKey, data: { runId, status, endReason, usd: Math.round(totals.usd * 1e6) / 1e6, turns: totals.turns, tools: totals.tools.length } });
  log.info('run end', { runId, agent: agentKey, status, endReason, usd: totals.usd, turns: totals.turns, nudges, images: box.counters.images, web: box.counters.web });
  return { runId, status, endReason, error, verdict, text: lastText, ...totals, nudges, shortfall, missing, reportedBlocked: blockedReason, counters: box.counters, promptSha256 };
}
