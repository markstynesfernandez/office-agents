// log.mjs — the station's logger: JSON lines in <dir>/<name>-<date>.log plus a console mirror.
// Every read source, every error, every model/tool call, state change, cap decision, schedule fire and e-stop goes
// through here. Every write goes through the data jail (src/engine/store/jail.mjs). Secret values (API keys, read from
// the environment by name) are redacted from every line before it is written or printed.
import path from 'node:path';
import { createJail } from '../engine/store/jail.mjs';

export const SECRET_ENV = ['ANTHROPIC_API_KEY', 'OPENROUTER_API_KEY'];
export function secretsFromEnv(env = process.env) { return SECRET_ENV.map((k) => env[k]).filter((v) => typeof v === 'string' && v.length > 8); }

export function makeLogger({ dir, name = 'station', secret = '', secrets = [], quiet = false, jail = null }) {
  const J = jail || createJail({ dataRoot: dir, extraRoots: [] });
  const all = [...new Set([secret, ...secrets, ...secretsFromEnv()].filter((s) => s && s.length > 8))];
  const redact = (s) => all.reduce((t, k) => t.split(k).join('<redacted>'), String(s));
  const day = () => new Date().toISOString().slice(0, 10);
  const counts = { info: 0, warn: 0, error: 0, read: 0, write: 0 };
  function write(level, msg, data) {
    const rec = { ts: new Date().toISOString(), level, src: name, msg };
    if (data !== undefined) rec.data = data;
    counts[level] = (counts[level] || 0) + 1;
    const line = redact(JSON.stringify(rec));
    try { J.add(path.join(dir, name + '-' + day() + '.log'), line + '\n'); } catch (_) { /* logging must never crash the server */ }
    if (!quiet && ((level !== 'read' && level !== 'write') || process.env.STATION_LOG_READS === '1')) {
      const out = '[' + name + '] ' + level.toUpperCase().padEnd(5) + ' ' + msg + (data !== undefined ? ' ' + redact(JSON.stringify(data)) : '');
      (level === 'error' ? console.error : console.log)(out);
    }
  }
  return {
    dir, counts, redact,
    info: (m, d) => write('info', m, d),
    warn: (m, d) => write('warn', m, d),
    error: (m, d) => write('error', m, d),
    // one line per source read (file path); kept out of the console by default, always in the file
    read: (source, d) => write('read', source, d),
    // one line per file written; file only, like read()
    written: (target, d) => write('write', target, d)
  };
}
