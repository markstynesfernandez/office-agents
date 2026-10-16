// guard.mjs — the spend guard (ENGINE-PLAN.md §5.1). The ONE choke point every paid call passes:
//   reserve()  before the call: estimate the call's maximum cost and check it, plus what is already spent and what
//              other calls have reserved, against every cap (per run, per job, per agent per day, per line per day,
//              per station per day, images per day). Any cap that would be passed refuses the call (CapError).
//              The e-stop and an unreadable ledger refuse every call. An unknown price refuses the call.
//   settle()   after the call: write the real cost to the ledger (fsync) and drop the reservation.
//   release()  when a call never reached the provider: drop the reservation, nothing is charged.
// A reservation is also written to data/ledger/pending/ before the call. If the process dies mid-call, the next start
// charges that call at its reserved maximum (marked estimated), so a crash can never hide spend.
// Days are Europe/Dublin calendar days. Caps come from config/engine.json only (DECISIONS.md Q7).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { dublinDay } from './time.mjs';

export class CapError extends Error {
  constructor({ cap, limit, spent, next, unit = 'usd' }) {
    const f = (n) => (unit === 'usd' ? Number(n).toFixed(2) : String(n));
    super('cap: ' + cap + ' ' + f(limit) + ' reached (spent ' + f(spent) + ', next call up to ' + f(next) + ')');
    Object.assign(this, { code: 'CAP', cap, limit, spent, next, unit });
  }
}
export class GuardRefusal extends Error { constructor(msg, code) { super(msg); this.code = code; } }

const r6 = (n) => Math.round(n * 1e6) / 1e6;
const EPS = 1e-9;

// price entry for a provider/model; a provider may give a '*' entry (the mock). Missing = null (the caller refuses).
export function priceOf(pricing, provider, model) {
  const p = pricing && pricing[provider] && pricing[provider].models; if (!p) return null;
  return p[model] || p['*'] || null;
}

// USD for a text response's usage (Anthropic usage shape), from a price entry in USD per million tokens.
// Cache writes and reads default to Anthropic's multipliers of the input price (1.25x and 0.1x; confirm at E6).
export function textCost(price, usage = {}) {
  const inP = price.inPerM, outP = price.outPerM, cw = price.cacheWritePerM ?? inP * 1.25, cr = price.cacheReadPerM ?? inP * 0.1;
  return r6(((usage.input_tokens || 0) * inP + (usage.output_tokens || 0) * outP + (usage.cache_creation_input_tokens || 0) * cw + (usage.cache_read_input_tokens || 0) * cr) / 1e6);
}
// the most a text call can cost: every input token at the dearest input rate, plus the full output allowance
export function textMax(price, inputTokens, maxOutputTokens) {
  const inMax = Math.max(price.inPerM, price.cacheWritePerM ?? price.inPerM * 1.25);
  return r6((inputTokens * inMax + maxOutputTokens * price.outPerM) / 1e6);
}

export function createGuard({ J, ledger, halt, caps, pricing, log, bus, clock = Date.now }) {
  const reserved = new Map();
  const pendingDir = path.join(J.dataRoot, 'ledger', 'pending');
  const warned = new Set();

  // ---- crash recovery: charge calls that were in flight when the process died, at their reserved maximum
  function recoverPending() {
    const d = J.dataJail(pendingDir); if (!fs.existsSync(d)) return [];
    const out = [];
    for (const n of fs.readdirSync(d).filter((x) => x.endsWith('.json'))) {
      const f = path.join(d, n);
      let res = null; try { res = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { log && log.error('pending reservation unreadable; left for a person to check', { file: f }); continue; }
      const row = ledger.append({ entryId: 'recovered-' + res.id, ts: clock(), jobId: res.jobId ?? null, runId: res.runId || null, agentKey: res.agentKey || null, line: res.line || null, provider: res.provider, model: res.model, kind: res.kind, count: res.count || 1, usd: res.maxUsd, estimated: true, priceSource: 'reserved-maximum', note: 'call in flight when the engine stopped; charged at its reserved maximum' });
      J.remove(f); out.push(row);
      log && log.warn('in-flight call charged at its reserved maximum after a restart', { reservation: res.id, usd: res.maxUsd, jobId: res.jobId });
    }
    return out;
  }

  const agentCap = (k) => { const a = caps.perAgentDayUsd || {}; return a[k] ?? a.default ?? 0; };
  const lineCap = (l) => { const a = caps.perLineDayUsd || {}; return a[l] ?? a.default ?? 0; };
  const reservedWhere = (pred, field = 'maxUsd') => [...reserved.values()].filter(pred).reduce((s, r) => s + (r[field] || 0), 0);

  // the caps a call is checked against, with what is spent and reserved against each
  function checks(call, day) {
    const S = ledger.spent, out = [];
    const runCap = call.runCapUsd != null ? Math.min(caps.perRunUsd, call.runCapUsd) : caps.perRunUsd;
    out.push({ cap: 'perRun', limit: runCap, used: S.run(call.runId) + reservedWhere((r) => r.runId === call.runId), required: true });
    if (call.jobId) out.push({ cap: 'perJob', limit: caps.perJobUsd, used: S.job(call.jobId) + reservedWhere((r) => r.jobId === call.jobId), required: true });
    if (call.agentKey && agentCap(call.agentKey) > 0) out.push({ cap: 'perAgentDay[' + call.agentKey + ']', limit: agentCap(call.agentKey), used: S.agentDay(call.agentKey, day) + reservedWhere((r) => r.agentKey === call.agentKey) });
    if (call.line && lineCap(call.line) > 0) out.push({ cap: 'perLineDay[' + call.line + ']', limit: lineCap(call.line), used: S.lineDay(call.line, day) + reservedWhere((r) => r.line === call.line) });
    out.push({ cap: 'perDay', limit: caps.perDayUsd, used: S.day(day) + reservedWhere(() => true), required: true });
    return out;
  }

  function reserve(call) {
    const now = clock(), day = dublinDay(now);
    if (halt && halt.isHalted()) throw new GuardRefusal('e-stop is on: no paid call can start', 'HALT');
    if (!ledger.state.ok) throw new GuardRefusal('the ledger is unreadable, so spend cannot be checked: ' + ledger.state.error, 'LEDGER');
    if (!call.provider || !call.model || !call.kind) throw new GuardRefusal('a call must name its provider, model and kind', 'BAD_CALL');
    const price = priceOf(pricing, call.provider, call.model);
    if (!price) throw new GuardRefusal('no price in config/engine.json for ' + call.provider + ' ' + call.model + ': call refused', 'PRICE');
    let maxUsd;
    if (call.kind === 'text') { if (price.inPerM == null || price.outPerM == null) throw new GuardRefusal('no token price for ' + call.model, 'PRICE'); maxUsd = textMax(price, call.inputTokens || 0, call.maxOutputTokens || 0); }
    else if (call.kind === 'image') { if (price.perImage == null) throw new GuardRefusal('no per-image price for ' + call.model, 'PRICE'); maxUsd = r6(price.perImage * (call.count || 1)); }
    else if (call.kind === 'web') { if (price.perCall == null) throw new GuardRefusal('no per-call price for ' + call.model + ' (web price to be confirmed)', 'PRICE'); maxUsd = r6(price.perCall * (call.count || 1)); }
    else throw new GuardRefusal('unknown call kind ' + call.kind, 'BAD_CALL');
    if (call.extraUsd) maxUsd = r6(maxUsd + call.extraUsd);
    for (const c of ['perRunUsd', 'perJobUsd', 'perDayUsd']) if (!(caps[c] > 0)) throw new GuardRefusal('cap ' + c + ' is not set in config/engine.json: every call is refused', 'CAPS');
    for (const c of checks(call, day)) {
      if (c.used + maxUsd > c.limit + EPS) {
        const err = new CapError({ cap: c.cap, limit: c.limit, spent: r6(c.used), next: maxUsd });
        log && log.warn('cap refused a call', { cap: c.cap, limit: c.limit, used: r6(c.used), next: maxUsd, jobId: call.jobId, runId: call.runId, agent: call.agentKey, model: call.model });
        bus && bus.emit('cap.hit', { jobId: call.jobId || null, agentKey: call.agentKey || null, data: { cap: c.cap, limit: c.limit, spent: r6(c.used), next: maxUsd, message: err.message } });
        throw err;
      }
    }
    if (call.kind === 'image' && caps.imagesPerDay > 0) {
      const used = ledger.spent.imagesDay(day) + reservedWhere((r) => r.kind === 'image', 'count');
      if (used + (call.count || 1) > caps.imagesPerDay) { const err = new CapError({ cap: 'imagesPerDay', limit: caps.imagesPerDay, spent: used, next: call.count || 1, unit: 'images' }); bus && bus.emit('cap.hit', { jobId: call.jobId || null, agentKey: call.agentKey || null, data: { cap: 'imagesPerDay', message: err.message } }); throw err; }
    }
    const res = { id: crypto.randomUUID(), at: now, runId: call.runId || null, jobId: call.jobId ?? null, agentKey: call.agentKey || null, line: call.line || null, provider: call.provider, model: call.model, kind: call.kind, count: call.count || 1, maxUsd, price };
    J.put(path.join(pendingDir, res.id + '.json'), JSON.stringify(res), { fsync: true });
    reserved.set(res.id, res);
    return res;
  }

  function drop(res) { reserved.delete(res.id); try { J.remove(path.join(pendingDir, res.id + '.json')); } catch (e) { log && log.error('pending reservation not removed', { id: res.id, error: e.message }); } }

  // settle a reservation with the real cost: `usd` given (provider-reported / image price) or computed from `usage`
  function settle(res, { usd, usage, priceSource, estimated = false, note } = {}) {
    if (!reserved.has(res.id)) throw new Error('unknown or already settled reservation ' + res.id);
    const cost = usd != null ? r6(usd) : textCost(res.price, usage || {});
    const row = ledger.append({ ts: clock(), jobId: res.jobId, runId: res.runId, agentKey: res.agentKey, line: res.line, provider: res.provider, model: res.model, kind: res.kind, count: res.count,
      tokens: usage ? { in: usage.input_tokens || 0, out: usage.output_tokens || 0, cacheRead: usage.cache_read_input_tokens || 0, cacheWrite: usage.cache_creation_input_tokens || 0 } : null,
      usd: cost, priceSource: priceSource || (res.provider === 'mock' ? 'mock' : 'config/engine.json'), estimated: !!estimated, reservedUsd: res.maxUsd, ...(note ? { note } : {}) });
    drop(res);
    bus && bus.emit('spend.row', { jobId: res.jobId, agentKey: res.agentKey, data: { entryId: row.entryId, usd: row.usd, kind: row.kind, model: row.model, provider: row.provider } });
    warnNear(res);
    return row;
  }
  function release(res, reason) { if (!reserved.has(res.id)) return; drop(res); log && log.info('reservation released (call not made)', { id: res.id, reason }); }

  // one warning per cap per day at 80% (the office turns the spend figure amber)
  function warnNear(res) {
    const day = dublinDay(clock());
    for (const c of checks({ ...res, runCapUsd: null }, day)) {
      if (!(c.limit > 0) || c.used < 0.8 * c.limit) continue;
      const k = c.cap + '|' + (c.cap === 'perJob' ? res.jobId : c.cap === 'perRun' ? res.runId : day);
      if (warned.has(k)) continue; warned.add(k);
      bus && bus.emit('cap.warn', { jobId: res.jobId, agentKey: res.agentKey, data: { cap: c.cap, limit: c.limit, spent: r6(c.used) } });
    }
  }

  function status() {
    const day = dublinDay(clock()), S = ledger.spent;
    return { day, caps, spentToday: r6(S.day(day)), reservedNow: r6(reservedWhere(() => true)), inFlight: reserved.size, imagesToday: S.imagesDay(day), ledgerOk: ledger.state.ok, ledgerError: ledger.state.error, halted: halt ? halt.isHalted() : false };
  }

  return { reserve, settle, release, recoverPending, status, reservations: () => [...reserved.values()] };
}
