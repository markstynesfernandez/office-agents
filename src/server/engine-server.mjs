// engine-server.mjs — the Station server in engine mode: the page, the office JSON built from the engine's own state,
// the live event stream (SSE), and the engine's write actions. Bound to 127.0.0.1 only.
// Every write request must (ENGINE-PLAN.md §6): come from the page's own origin, carry the per-launch action token the
// page got from /api/session, and send JSON. Records the owner can change carry an expectedVersion (stale tabs are
// refused) and creates carry an idempotency key (E5). E2–E3 writes: the e-stop and its typed resume.
// The page never receives keys, prompts or provider responses.
// ext (demo mode only, scripts/demo.mjs): extra POST actions behind the same origin/token/JSON checks, and extra fields
// merged into each snapshot response. `handler` and `dispose` let the demo swap engines behind one listening server.
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { send, sendJson, serveStatic } from './index.mjs';
import { buildEngineSnapshot } from './engine-model.mjs';
import { RESUME_WORD } from '../engine/halt.mjs';

const MAX_BODY = 16 * 1024;

export function createEngineServer({ engine, log, snapshotTtlMs = 300, ext = null }) {
  const token = crypto.randomBytes(24).toString('hex');   // per launch; only the page on our own origin can read it
  const hostLabel = 'Node ' + process.version + ' · ' + os.platform() + ' ' + os.release() + ' (station host)';
  let cache = { at: 0, seq: -1, snap: null };
  const clients = new Set();
  const thumbs = new Map();

  function snapshot(force = false) {
    const now = Date.now();
    if (!force && cache.snap && cache.seq === engine.bus.seq && now - cache.at < snapshotTtlMs * 20) return cache.snap;
    cache = { at: now, seq: engine.bus.seq, snap: buildEngineSnapshot(engine, { now, host: { label: hostLabel } }) };
    return cache.snap;
  }
  // SSE: every bus event goes to every page; a reconnecting page gets what it missed (Last-Event-ID)
  const unsub = engine.bus.subscribe((ev) => { for (const c of clients) writeEvent(c, ev); });
  function writeEvent(res, ev) { try { res.write('id: ' + ev.seq + '\nevent: ' + ev.type + '\ndata: ' + JSON.stringify({ seq: ev.seq, ts: ev.ts, type: ev.type, jobId: ev.jobId, agentKey: ev.agentKey, data: ev.data }) + '\n\n'); } catch (_) { clients.delete(res); } }
  const beat = setInterval(() => { for (const c of clients) { try { c.write(': beat\n\n'); } catch (_) { clients.delete(c); } } }, 15000); beat.unref();

  const sameOrigin = (req) => { const host = req.headers.host || ''; const o = req.headers.origin; return !!o && (o === 'http://' + host) && /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host); };
  function readBody(req) { return new Promise((resolve, reject) => { let n = 0; const parts = []; req.on('data', (c) => { n += c.length; if (n > MAX_BODY) { reject(new Error('body too large')); req.destroy(); } else parts.push(c); }); req.on('end', () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {}); } catch (e) { reject(new Error('body is not JSON')); } }); req.on('error', reject); }); }

  async function thumb(id, set, file) {
    const key = id + '/' + set + '/' + file; if (thumbs.has(key)) return thumbs.get(key);
    const f = path.join(engine.J.dataRoot, 'jobs', id, set, 'files', file);
    if (!fs.existsSync(f)) return null;
    const { default: sharp } = await import('sharp');
    const buf = await sharp(f).resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    thumbs.set(key, buf); if (thumbs.size > 300) thumbs.delete(thumbs.keys().next().value);
    return buf;
  }

  const ACTIONS = {
    'POST /api/engine/halt': (body) => engine.halt.press({ by: 'owner (office button)', reason: String(body.reason || '').slice(0, 200) }),
    'POST /api/engine/resume': (body) => engine.halt.resume({ by: 'owner (office, typed confirmation)', confirm: body.confirm }),
    ...((ext && ext.actions) || {})
  };

  const handler = async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const p = decodeURIComponent(url.pathname);
    try {
      if (req.method === 'POST') {
        const act = ACTIONS['POST ' + p];
        if (!act) return sendJson(res, { error: 'unknown action' }, 404);
        if (!sameOrigin(req)) { log.warn('write refused: not same-origin', { path: p, origin: req.headers.origin || null }); return sendJson(res, { error: 'same-origin requests only' }, 403); }
        if (req.headers['x-station-action'] !== token) { log.warn('write refused: bad action token', { path: p }); return sendJson(res, { error: 'missing or stale action token: reload the page' }, 403); }
        if (!/^application\/json\b/.test(req.headers['content-type'] || '')) return sendJson(res, { error: 'JSON only' }, 415);
        const body = await readBody(req);
        try { const out = act(body); log.info('action', { path: p }); return sendJson(res, { ok: true, result: out }); }
        catch (e) { log.warn('action refused', { path: p, error: e.message }); return sendJson(res, { error: e.message, code: e.code || null }, e.code === 'STALE' ? 409 : 400); }
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed', 'text/plain');
      if (p === '/api/session') {
        // the token goes only to a same-origin page request (a cross-site page cannot read it)
        if (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin') return sendJson(res, { error: 'same-origin only' }, 403);
        return sendJson(res, { actionToken: token, resumeWord: RESUME_WORD });
      }
      if (p === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write('retry: 2000\n\n');
        const last = Number(req.headers['last-event-id'] || url.searchParams.get('since') || NaN);
        if (Number.isFinite(last)) for (const ev of engine.bus.since(last)) writeEvent(res, ev);
        clients.add(res); req.on('close', () => clients.delete(res));
        return;
      }
      if (p === '/api/office/health') { const g = engine.guard.status(); return sendJson(res, { ok: true, view: 'engine', provider: engine.providers.mode, halted: engine.halt.isHalted(), ledgerOk: g.ledgerOk, spentToday: g.spentToday, inFlight: g.inFlight, seq: engine.bus.seq, logs: log.counts, uptimeS: Math.round(process.uptime()) }); }
      if (p === '/api/office/snapshot') return sendJson(res, ext && ext.snapshotExtra ? { ...snapshot(url.searchParams.has('fresh')), ...ext.snapshotExtra() } : snapshot(url.searchParams.has('fresh')));
      if (p === '/api/office/ledger') { const rows = engine.ledger.rows().slice(-Math.min(500, Number(url.searchParams.get('limit')) || 100)).reverse().map((r) => ({ at: r.ts, agent: r.agentKey, runId: r.runId, jobId: r.jobId, model: r.model, provider: r.provider, kind: r.kind, tokens: r.tokens ? r.tokens.in + r.tokens.out : null, usd: r.usd, estimated: !!r.estimated })); return sendJson(res, { total: engine.ledger.totals.rows, rows, source: engine.ledger.label }); }
      let m;
      if ((m = /^\/api\/office\/jobs\/([^/]+)$/.exec(p))) { const job = snapshot().jobs.find((j) => j.id === m[1]); if (!job) return sendJson(res, { error: 'no such job' }, 404); const cost = job.kind === 'research' ? null : engine.orchestrator.costRecord(job.id); return sendJson(res, { ...job, cost: cost && { totalUsd: cost.totalUsd, rows: cost.rows, byKind: cost.byKind, mock: cost.mock } }); }
      if ((m = /^\/api\/office\/agents\/([^/]+)$/.exec(p))) { const s = snapshot(); const a = s.agents.find((x) => x.id === m[1]); if (!a) return sendJson(res, { error: 'no such agent' }, 404); const runs = engine.store.runsOf({ agentKey: a.id, limit: 12 }).map((r) => ({ at: r.ended_at || r.started_at, title: (r.step || '') + ' pass ' + (r.pass || 1) + ' · ' + (r.job_id || ''), reason: r.status === 'done' ? 'done' : r.status, usd: r.usd, tokens: r.tokens_in + r.tokens_out, durationMs: r.ended_at ? r.ended_at - r.started_at : null, failureCode: ['failed', 'cap', 'refused'].includes(r.status) ? r.status : null })); const jobs = a.recentJobs.map((id) => s.jobs.find((j) => j.id === id)).filter(Boolean); return sendJson(res, { ...a, runs, jobs }); }
      if ((m = /^\/api\/office\/image\/job\/([^/]+)\/(set-v\d+)\/([a-z0-9][a-z0-9._-]*\.(?:png|jpg))$/.exec(p))) { const buf = await thumb(m[1], m[2], m[3]); return buf ? send(res, 200, buf, 'image/png', { 'Cache-Control': 'public, max-age=60' }) : send(res, 404, 'no such image', 'text/plain'); }
      if (p.startsWith('/api/')) return sendJson(res, { error: 'unknown route' }, 404);
      return serveStatic(res, p);
    } catch (e) {
      log.error('request failed', { path: p, error: String(e && e.stack || e) });
      return sendJson(res, { error: 'server error', detail: String(e && e.message || e) }, 500);
    }
  };
  const server = http.createServer(handler);
  server.on('clientError', (err, socket) => { try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (_) {} });
  const closeAll = () => { for (const c of clients) { try { c.end(); } catch (_) {} } clients.clear(); };
  const dispose = () => { clearInterval(beat); unsub(); closeAll(); };
  server.on('close', dispose);
  return { server, handler, snapshot, token, closeAll, dispose };
}
