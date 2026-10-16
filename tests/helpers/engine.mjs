// helpers/engine.mjs — a throwaway data root and a quiet logger for engine tests. Every test engine runs on the mock
// provider in its own temp folder; nothing touches office-agents/data or the legacy build.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJail } from '../../src/engine/store/jail.mjs';
import { makeLogger } from '../../src/server/log.mjs';

export function tempRoot(tag = 'engine') {
  const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'station-' + tag + '-')));
  const dataRoot = path.join(base, 'data'), logs = path.join(base, 'logs');
  const J = createJail({ dataRoot, extraRoots: [logs] });
  const log = makeLogger({ dir: logs, name: 'test', quiet: true, jail: J });
  // cleanup never throws, so a failing assertion is not hidden behind a locked temp file
  return { base, dataRoot, logs, J, log, cleanup: () => { try { fs.rmSync(base, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 }); } catch (_) { /* left in the temp folder */ } } };
}

export const CAPS = { perRunUsd: 1, perJobUsd: 1, perDayUsd: 10, perLineDayUsd: { default: 10 }, perAgentDayUsd: { default: 0 }, imagesPerDay: 0, maxHops: 12 };
export const PRICING = {
  test: { models: { 'cheap-model': { inPerM: 1, outPerM: 5 }, 'img-model': { perImage: 0.05 }, 'web-model': { perCall: 0.01 } } },
  mock: { models: { '*': { inPerM: 0, outPerM: 0, perImage: 0, perCall: 0 } } }
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function until(fn, { timeout = 5000, every = 25 } = {}) { const t0 = Date.now(); for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > timeout) throw new Error('timed out waiting'); await sleep(every); } }
