// bus.mjs — the in-process event bus (ENGINE-PLAN.md §1.4). Every event gets a sequence number, is appended to
// data/events/<Dublin day>.jsonl (the audit trail), kept in a ring buffer for replay, and fanned out to subscribers
// (the SSE stream). Callers write their state change first and emit after, so an event never describes a change that
// was not stored. Event names are the engine's own.
import fs from 'node:fs';
import path from 'node:path';
import { dublinDay } from './time.mjs';

export const EVENT_TYPES = ['job.created', 'job.stage', 'job.blocked', 'job.queued-for-approval', 'job.decided', 'job.stopped', 'job.rejected',
  'run.start', 'run.tool', 'run.end', 'spend.row', 'cap.warn', 'cap.hit', 'routine.fire', 'routine.skip', 'halt.on', 'halt.off', 'agent.updated', 'engine.start', 'engine.recovered',
  'routine.changed', 'action.done', 'action.refused'];

export function createBus({ J, dir = path.join(J.dataRoot, 'events'), log, ringSize = 1000 }) {
  const ring = [], subs = new Set();
  // carry the sequence on across restarts: the last line of the newest events file
  let seq = 0;
  try {
    const d = J.dataJail(dir);
    if (fs.existsSync(d)) {
      const last = fs.readdirSync(d).filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)).sort().pop();
      if (last) { const lines = fs.readFileSync(path.join(d, last), 'utf8').trim().split('\n'); for (let i = lines.length - 1; i >= 0; i--) { try { seq = JSON.parse(lines[i]).seq || 0; break; } catch (_) { /* torn line */ } } }
    }
  } catch (e) { log && log.warn('event sequence not recovered', { error: e.message }); }

  function emit(type, { jobId = null, agentKey = null, data = {} } = {}) {
    if (!EVENT_TYPES.includes(type)) throw new Error('unknown event type: ' + type);
    const ev = { seq: ++seq, ts: Date.now(), type, jobId, agentKey, data };
    try { J.add(path.join(dir, dublinDay(ev.ts) + '.jsonl'), JSON.stringify(ev) + '\n'); } catch (e) { log && log.error('event not written', { type, error: e.message }); }
    ring.push(ev); if (ring.length > ringSize) ring.shift();
    for (const fn of subs) { try { fn(ev); } catch (e) { log && log.warn('event subscriber failed', { type, error: e.message }); } }
    return ev;
  }
  return {
    emit,
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    // events after `afterSeq` still in the ring (SSE replay on reconnect)
    since: (afterSeq) => ring.filter((e) => e.seq > afterSeq),
    recent: (n = 50) => ring.slice(-n),
    get seq() { return seq; }
  };
}
