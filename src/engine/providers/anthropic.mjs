// providers/anthropic.mjs — the live text provider (E6 step a0): Anthropic Messages through the official SDK
// (@anthropic-ai/sdk, pinned in package.json, licence in ASSETS.md). Same create(params, { signal, ctx }) shape as the
// mock (providers/mock.mjs), so the runtime and the spend guard treat both alike.
//   - Built only when STATION_PROVIDER=live is in this process's environment, never in demo mode, and only with
//     ANTHROPIC_API_KEY set. The key is read once here and kept in this closure: it is never logged, returned, put on
//     an error or written anywhere. Every message that leaves this module goes through redact().
//   - Only the models config/engine.json gives to an anthropic tier (and prices) may run; anything else is refused
//     before any network call. The e-stop and the abort signal are checked before the call.
//   - One HTTP attempt per create(): the SDK's own retries are off (maxRetries 0). Retries belong to the guarded call
//     (runtime.mjs guardedTextCall), which reserves again for every attempt. Errors come back as LiveProviderError with
//     status, type, requestId and `retryable` (429, 5xx, network); 400/401/403 are final.
//   - Nothing is added to the request: no tools, no prompt caching, no system prompt. The caller's own tools pass through
//     (client tools only: a server or MCP tool is refused; none is allowed in a0), and the agent's effort maps to
//     output_config.effort.
import Anthropic from '@anthropic-ai/sdk';

export const BASE_URL = 'https://api.anthropic.com';
// server-side tool types allowed through (b0 adds the web tools); client tools (name + input_schema, no type) always pass
export const SERVER_TOOLS_ALLOWED = [];

export class LiveProviderError extends Error {
  constructor(message, { code, status = undefined, type = null, requestId = null, retryable = false, retryAfterMs = null } = {}) {
    super(message);
    this.name = 'LiveProviderError';
    Object.assign(this, { code, status, type, requestId, retryable, retryAfterMs });
  }
}

// the models the live provider may call: every anthropic tier in config/engine.json that also has a price
export function allowedModels(engineCfg) {
  const priced = (engineCfg.pricing && engineCfg.pricing.anthropic && engineCfg.pricing.anthropic.models) || {};
  return [...new Set(Object.values(engineCfg.tiers || {}).filter((t) => t.provider === 'anthropic' && priced[t.model]).map((t) => t.model))];
}

// strip the key (and anything shaped like a key or an auth header) from a string
export function makeRedactor(secrets = []) {
  const keys = secrets.filter((s) => typeof s === 'string' && s.length > 8);
  return (s) => {
    let t = String(s ?? '');
    for (const k of keys) t = t.split(k).join('<redacted>');
    return t.replace(/sk-ant-[A-Za-z0-9_-]+/g, '<redacted>').replace(/\b(x-api-key|authorization)(["']?\s*[:=]\s*["']?)(Bearer\s+)?[^\s"',}]+/gi, '$1$2<redacted>');
  };
}

const HINT = {
  400: 'the request was refused as invalid; check the model, max_tokens and the message shape',
  401: 'authentication failed; check that ANTHROPIC_API_KEY holds a valid key for the station workspace',
  403: 'permission denied; check the key\'s workspace and the model\'s availability'
};

// SDK error -> LiveProviderError (key-free). Retryable: 429, 5xx, network and timeouts; 408/409 are left to the caller
// as final in a0 (the SDK would retry them; the station keeps the list to the brief's).
export function normaliseError(e, redact) {
  if (e instanceof LiveProviderError) return e;
  if (e instanceof Anthropic.APIConnectionError) {
    const timeout = e instanceof Anthropic.APIConnectionTimeoutError;
    return new LiveProviderError('Anthropic API ' + (timeout ? 'request timed out' : 'connection failed') + ': ' + redact(e.message), { code: timeout ? 'TIMEOUT' : 'NETWORK', retryable: true });
  }
  if (e instanceof Anthropic.APIError && typeof e.status === 'number') {
    const s = e.status, retryable = s === 429 || s >= 500;
    const raw = e.headers && typeof e.headers.get === 'function' ? e.headers.get('retry-after') : null;
    const ra = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
    const type = e.type || null, requestId = e.requestID || null;
    const msg = 'Anthropic API ' + s + (type ? ' ' + type : '') + ': ' + (HINT[s] || redact(e.message)) + (requestId ? ' (request ' + requestId + ')' : '');
    return new LiveProviderError(msg, { code: 'HTTP_' + s, status: s, type, requestId, retryable, retryAfterMs: Number.isFinite(ra) && ra >= 0 ? ra * 1000 : null });
  }
  return new LiveProviderError('Anthropic call failed: ' + redact(e && e.message ? e.message : e), { code: 'UNKNOWN' });
}

function checkTools(params) {
  if (params.mcp_servers) throw new LiveProviderError('MCP servers are not allowed on the live provider', { code: 'TOOLS' });
  for (const t of params.tools || []) {
    if (t && t.type && t.type !== 'custom' && !SERVER_TOOLS_ALLOWED.includes(t.type)) throw new LiveProviderError('server tool ' + t.type + ' is not allowed on the live provider', { code: 'TOOLS' });
  }
}

// createAnthropicText({ engineCfg, env, demo, halt, log, client, timeoutMs }) — `client` is injected by tests only
export function createAnthropicText({ engineCfg, env = process.env, demo = false, halt = null, log = null, client = null, timeoutMs = null } = {}) {
  if (demo) throw new LiveProviderError('the live provider never runs in demo mode', { code: 'DEMO' });
  if (env.STATION_PROVIDER !== 'live') throw new LiveProviderError('the live provider needs STATION_PROVIDER=live in this process\'s environment (it is "' + (env.STATION_PROVIDER || 'unset') + '")', { code: 'NOT_LIVE' });
  if (!engineCfg) throw new LiveProviderError('the live provider needs config/engine.json', { code: 'CONFIG' });
  const key = env.ANTHROPIC_API_KEY;
  if (typeof key !== 'string' || !key.trim()) throw new LiveProviderError('ANTHROPIC_API_KEY is not set: the live provider cannot start', { code: 'NO_KEY' });
  const models = allowedModels(engineCfg);
  if (!models.length) throw new LiveProviderError('no anthropic model with a price in config/engine.json', { code: 'CONFIG' });
  const live = engineCfg.live || {};
  const timeout = timeoutMs ?? live.timeoutMs;
  if (!(timeout > 0)) throw new LiveProviderError('config/engine.json live.timeoutMs is not set', { code: 'CONFIG' });
  const efforts = engineCfg.effortLevels || [];
  const redact = makeRedactor([key]);
  // explicit apiKey, no auth token, fixed base URL: the environment cannot redirect the key or add a second credential
  const sdk = client || new Anthropic({ apiKey: key, authToken: null, baseURL: BASE_URL, maxRetries: 0, timeout, logLevel: 'off' });
  let calls = 0;

  return {
    id: 'anthropic',
    models,
    get calls() { return calls; },
    async create(params, { signal, ctx = {} } = {}) {
      if (halt && halt.isHalted()) throw new LiveProviderError('e-stop is on: no call made', { code: 'HALT' });
      if (signal && signal.aborted) throw signal.reason || new LiveProviderError('aborted before the call', { code: 'ABORTED' });
      if (!models.includes(params.model)) throw new LiveProviderError('model ' + params.model + ' is not in config/engine.json (allowed: ' + models.join(', ') + ')', { code: 'MODEL' });
      if (!(params.max_tokens > 0)) throw new LiveProviderError('max_tokens must be set', { code: 'BAD_PARAMS' });
      checkTools(params);
      const body = { ...params };
      if (ctx.effort && efforts.includes(ctx.effort) && !body.output_config) body.output_config = { effort: ctx.effort };
      const t0 = Date.now();
      calls++;
      let msg;
      try { msg = await sdk.messages.create(body, { signal, timeout }); }
      catch (e) {
        if (signal && signal.aborted) throw e;   // the caller's e-stop / Stop path settles it
        const err = normaliseError(e, redact);
        log && log.warn('anthropic call failed', { model: body.model, status: err.status ?? null, code: err.code, type: err.type, requestId: err.requestId, retryable: err.retryable, ms: Date.now() - t0, agent: ctx.agentKey || null, jobId: ctx.jobId || null });
        throw err;
      }
      const requestId = msg._request_id || null;
      const u = msg.usage || {};
      log && log.info('anthropic call', { model: msg.model || body.model, requestId, messageId: msg.id, stop: msg.stop_reason, usage: { in: u.input_tokens || 0, out: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0 }, ms: Date.now() - t0, agent: ctx.agentKey || null, jobId: ctx.jobId || null });
      return { id: msg.id, type: msg.type, role: msg.role, model: msg.model, content: msg.content, stop_reason: msg.stop_reason, stop_details: msg.stop_details ?? null, usage: { input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0, cache_creation_input_tokens: u.cache_creation_input_tokens || 0, cache_read_input_tokens: u.cache_read_input_tokens || 0 }, request_id: requestId };
    }
  };
}
