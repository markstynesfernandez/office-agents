// spend.mjs — L2: the spend confirmation behind every page action that can spend (owner brief, 19/10/2026). Before such an action
// the page asks for a quote (POST /api/spend/quote): the line, the agents and their models, the job cap, today's spend against the
// daily cap (with the worst case of every running and queued job counted), the line's day cap, the Anthropic Console's monthly limit
// if the owner configured it (config/engine.json outerLimits), and on the mock provider "mock: $0". A quote with no refusal carries a
// confirm token: random, single use, bound to the action and its parameters, valid runtime.confirmTtlMs. The action itself is then
// refused, server-side, when the e-stop is on (HALTED), when no valid token came with it (CONFIRM_REQUIRED), or when the daily caps
// would be exceeded at that moment (DAY_CAP). The guard still checks every call as before; this adds a gate in front of the start.
// Caps are read from config only, never changed here. Tokens live in memory: a server restart drops them (the page asks again).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dublinDay } from './time.mjs';
import { effectiveAgent } from './runtime.mjs';

const r6 = (n) => Math.round((n || 0) * 1e6) / 1e6;
const err = (msg, code) => Object.assign(new Error(msg), { code });
const usd = (n) => 'USD ' + Number(n || 0).toFixed(2);

// the parameters each spending action is bound to (the token covers exactly these)
export const SPEND_ACTIONS = {
  'start-line': { label: 'Start line on brief', params: ['file'] },
  research: { label: 'Research this', params: ['text'] },
  restart: { label: 'Resume the job', params: ['jobId'] },
  'rerun-listing': { label: 'Re-run the listing', params: ['jobId'] },
  'qa-only': { label: 'QA-only run', params: ['jobId', 'set', 'maxUsd'] },
  'listing-only': { label: 'Listing-only run', params: ['jobId', 'maxUsd'] },
  'agent-on-duty': { label: 'Put the agent back on duty (its waiting jobs start)', params: ['agentKey'] }
};
const bind = (action, body) => JSON.stringify([action, ...SPEND_ACTIONS[action].params.map((k) => (body[k] == null ? null : String(body[k])))]);

export function createSpendDesk(engine, { ttlMs = null, now = () => Date.now() } = {}) {
  const { cfg, store, ledger, halt, guard } = engine;
  const caps = cfg.engine.caps, ttl = ttlMs ?? (cfg.engine.runtime || {}).confirmTtlMs ?? 600000;
  const tokens = new Map();   // token -> { bound, exp }
  const O = () => engine.orchestrator;
  const jobCapOf = (line) => ((caps.perJobUsdByLine || {})[line] ?? caps.perJobUsd);
  const lineDayCapOf = (line) => ((caps.perLineDayUsd || {})[line] ?? (caps.perLineDayUsd || {}).default ?? 0);
  // the worst case still open on a job: its cap less what it has spent
  const remaining = (j) => Math.max(0, jobCapOf(j.line) - ledger.spent.job(j.id));
  // jobs that may still spend today without another click: running, and queued to start by themselves (next, or after a restart)
  const committedJobs = (exceptId) => store.listJobs({ states: ['running', 'queued'] }).filter((j) => j.id !== exceptId && !j.legacy && (j.state === 'running' || O().isActive(j.id) || (j.data && j.data.autoStart && !j.data.waitingFor)));

  function lineAgents(lineId) {
    const L = cfg.lines[lineId]; if (!L) return [];
    const keys = [...new Set(Object.values(L.steps).filter((s) => s.kind === 'agent').map((s) => s.agent))];
    const mock = engine.providers.mode === 'mock';
    return keys.map((k) => { const a = effectiveAgent(engine, k), t = cfg.engine.tiers[a.tier] || {}; return { agent: k, name: (cfg.agents[k] || {}).name || k, model: (mock ? 'mock (' + t.model + ')' : t.model) || null, effort: a.effort, onDuty: a.enabled, images: !!(a.limits && a.limits.maxImages) }; });
  }

  // what the action would start: { line, jobId, headroomUsd, what, refuse[] } (refuse: reasons it cannot start at all)
  function target(action, body) {
    const p = (k) => (body[k] == null ? '' : String(body[k]));
    if (action === 'start-line') {
      const file = p('file'); if (!/^[A-Za-z0-9._-]+\.md$/.test(file)) throw err('pick a brief', 'BAD_REQUEST');
      if (!fs.existsSync(path.join(engine.J.dataRoot, 'research', 'briefs', file))) throw err('no such brief: ' + file, 'BAD_REQUEST');
      return { line: 'room1-digital', jobId: null, headroomUsd: jobCapOf('room1-digital'), what: 'a new job on the Room 1 line from research/briefs/' + file };
    }
    if (action === 'research') { const text = p('text').trim(); if (text.length < 3) throw err('describe what to research', 'BAD_REQUEST'); return { line: 'research', jobId: null, headroomUsd: jobCapOf('research'), what: 'a new research job: "' + text.slice(0, 120) + (text.length > 120 ? '…' : '') + '"' }; }
    if (action === 'agent-on-duty') {
      const key = p('agentKey'); if (!cfg.agents[key]) throw err('no such agent: ' + key, 'BAD_REQUEST');
      const waiting = store.listJobs({ states: ['queued'] }).filter((j) => j.data && j.data.waitingFor === key);
      if (!waiting.length) return null;
      return { line: waiting[0].line, jobId: null, headroomUsd: r6(waiting.reduce((s, j) => s + remaining(j), 0)), what: waiting.length + ' waiting job(s) start: ' + waiting.map((j) => j.id).join(', '), jobs: waiting.map((j) => j.id) };
    }
    const j = store.getJob(p('jobId')); if (!j) throw err('no such job: ' + p('jobId'), 'BAD_REQUEST');
    const rest = remaining(j), refuse = rest <= 0 ? ['job cap reached: ' + usd(ledger.spent.job(j.id)) + ' of ' + usd(jobCapOf(j.line)) + ' spent on this job'] : [];
    if (action === 'qa-only' || action === 'listing-only') { const m = Number(body.maxUsd); return { line: j.line, jobId: j.id, headroomUsd: r6(Math.min(rest, m > 0 ? m : rest)), what: SPEND_ACTIONS[action].label + ' on ' + j.id + ' within your cap ' + usd(m), refuse }; }
    return { line: j.line, jobId: j.id, headroomUsd: r6(rest), what: (action === 'restart' ? 'job ' + j.id + ' runs on from ' + (j.step || 'its start') : 'LISTER and QA LISTING again on ' + j.id), refuse };
  }

  // the quote (no token): every figure the dialog shows, and why it cannot go ahead (refusals)
  function assess(action, body) {
    if (!SPEND_ACTIONS[action]) throw err('unknown spending action: ' + action, 'BAD_REQUEST');
    const t = target(action, body || {}); if (!t) return null;
    const day = dublinDay(now()), g = guard.status(), mock = engine.providers.mode === 'mock';
    const others = committedJobs(t.jobId).filter((j) => !(t.jobs || []).includes(j.id));
    const committed = r6(others.reduce((s, j) => s + remaining(j), 0)), lineCommitted = r6(others.filter((j) => j.line === t.line).reduce((s, j) => s + remaining(j), 0));
    const spentToday = r6(g.spentToday), lineSpent = r6(ledger.spent.lineDay(t.line, day)), lineCap = lineDayCapOf(t.line);
    const worst = r6(spentToday + committed + t.headroomUsd), lineWorst = r6(lineSpent + lineCommitted + t.headroomUsd);
    const refusals = [...(t.refuse || [])];
    if (halt.isHalted()) refusals.unshift('e-stop is on: nothing starts until you resume');
    if (!g.ledgerOk) refusals.push('the ledger is unreadable: every paid call is refused');
    if (worst > caps.perDayUsd + 1e-9) refusals.push('the daily cap would be exceeded: spent today ' + usd(spentToday) + ' + open jobs up to ' + usd(committed) + ' + this up to ' + usd(t.headroomUsd) + ' = ' + usd(worst) + ', over ' + usd(caps.perDayUsd));
    if (lineCap > 0 && lineWorst > lineCap + 1e-9) refusals.push('the ' + t.line + ' line\'s daily cap would be exceeded: ' + usd(lineWorst) + ' worst case, over ' + usd(lineCap));
    const ol = cfg.engine.outerLimits || {}, month = day.slice(0, 7);
    const consoleUsed = r6(ledger.rows().filter((r) => String(r.provider || '').startsWith('anthropic') && dublinDay(r.ts).slice(0, 7) === month).reduce((s, r) => s + (Number(r.usd) || 0), 0));
    const running = store.listJobs({ states: ['running'] }).map((j) => j.id), max = engine.maxRunningJobs || null;
    const waitsAsNext = !!max && running.filter((x) => x !== t.jobId).length >= max;
    return {
      action, label: SPEND_ACTIONS[action].label, what: t.what, line: t.line, lineLabel: (cfg.lines[t.line] || {}).label || t.line, jobId: t.jobId,
      provider: engine.providers.mode, mock, mockNote: mock ? 'mock: $0 (no model is called and nothing is charged)' : null,
      agents: lineAgents(t.line), imageModel: lineAgents(t.line).some((a) => a.images) ? (mock ? 'mock (' + cfg.engine.image.allowedModels.join(', ') + ')' : cfg.engine.image.allowedModels.join(', ')) : null,
      job: { capUsd: jobCapOf(t.line), spentUsd: t.jobId ? r6(ledger.spent.job(t.jobId)) : 0, headroomUsd: t.headroomUsd, perRunUsd: caps.perRunUsd },
      day: { date: day, spentUsd: spentToday, openJobsUsd: committed, worstUsd: worst, capUsd: caps.perDayUsd, line: { spentUsd: lineSpent, worstUsd: lineWorst, capUsd: lineCap } },
      console: ol.anthropicConsoleMonthlyUsd > 0 ? { configured: true, month, limitUsd: ol.anthropicConsoleMonthlyUsd, usedUsd: consoleUsed, leftUsd: r6(ol.anthropicConsoleMonthlyUsd - consoleUsed), note: 'the limit set in the Anthropic Console less this month\'s Anthropic rows in the station ledger (other use of the workspace is not seen)' } : { configured: false, month, usedUsd: consoleUsed, note: 'not configured (config/engine.json outerLimits.anthropicConsoleMonthlyUsd)' },
      openrouterDailyUsd: ol.openrouterDailyUsd ?? null,
      queue: { running, maxRunning: max, startsAsNext: waitsAsNext },
      refusals
    };
  }

  function quote(action, body = {}) {
    const q = assess(action, body);
    if (!q) return { action, label: SPEND_ACTIONS[action].label, needed: false, refusals: [] };
    for (const [k, v] of tokens) if (v.exp < now()) tokens.delete(k);
    if (q.refusals.length) return { ...q, needed: true, token: null };
    const token = crypto.randomBytes(18).toString('hex'), exp = now() + ttl;
    tokens.set(token, { bound: bind(action, body), exp });
    return { ...q, needed: true, token, expiresAt: exp };
  }

  // the server-side gate in front of the action: the e-stop, the confirm token, the day caps now. Consumes the token.
  function gate(action, body = {}) {
    if (halt.isHalted()) throw err('e-stop is on: ' + SPEND_ACTIONS[action].label.toLowerCase() + ' refused until you resume', 'HALTED');
    const q = assess(action, body); if (!q) return null;   // nothing would spend (an agent with no waiting job)
    const tok = String(body.confirmToken || ''), rec = tokens.get(tok);
    if (!tok || !rec) throw err('confirm first: this action can spend, and it needs the confirm step (ask for the spend dialog again)', 'CONFIRM_REQUIRED');
    if (rec.exp < now()) { tokens.delete(tok); throw err('the confirmation has expired: confirm again', 'CONFIRM_REQUIRED'); }
    if (rec.bound !== bind(action, body)) throw err('the confirmation was for a different action or different settings: confirm again', 'CONFIRM_REQUIRED');
    tokens.delete(tok);
    if (q.refusals.length) throw err('refused: ' + q.refusals.join('; '), /e-stop/.test(q.refusals[0]) ? 'HALTED' : 'DAY_CAP');
    return q;
  }
  return { quote, gate, assess, pending: () => tokens.size };
}
