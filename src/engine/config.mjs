// config.mjs — loads the engine's config files (ENGINE-PLAN.md §1.2). Read-only. Config is edited as files in the
// repository (DECISIONS.md Q7, Q8); the page can only change an agent's on/off, tier and effort (an overlay in SQLite).
//   config/engine.json            caps, tiers, prices, providers, runtime
//   config/station.config.json    business settings ported from the station (fees, digital terms, originality lists)
//   config/products.json          digital product specs (one entry per product type; nothing in code names a product)
//   config/agents/<key>.json      one file per agent
//   config/lines/<id>.json        the written line specs
//   config/office.json            the office layout (departments and desks)
//   config/routines.json          routines the station ships with (seeded once per data root, always disabled)
//   config/businesses/<id>.json   B0: the businesses of the building (one floor each; _template.json is never loaded), checked
//                                 against the lines, agents and office departments: a bad business stops the engine
//   config/building.json          B0: the building rules' data (foreignDataMarkers: another company's data never enters the Station)
import fs from 'node:fs';
import path from 'node:path';
import { readBusinesses, validateBusinesses, withDefaults } from './business.mjs';

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const readDir = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((n) => n.endsWith('.json')).sort().map((n) => readJson(path.join(d, n))) : []);

export function validateEngine(e) {
  const bad = [];
  for (const k of ['perRunUsd', 'perJobUsd', 'perDayUsd']) if (!(e.caps && e.caps[k] > 0)) bad.push('caps.' + k + ' must be a positive number');
  if (!e.tiers || !e.tiers.cheap || !e.tiers.strong) bad.push('tiers.cheap and tiers.strong are required');
  if (!e.pricing) bad.push('pricing is required');
  if (!e.runtime) bad.push('runtime is required');
  return bad;
}

// overrides (the dry run only): { productsFile: {products:[...]}, stationSet: { 'dotted.key': value } } on top of the files
export function applySet(obj, set) { const out = structuredClone(obj); for (const [k, v] of Object.entries(set || {})) { const parts = k.split('.'); let o = out; for (const p of parts.slice(0, -1)) { if (!o[p] || typeof o[p] !== 'object') throw new Error('override path not found: ' + k); o = o[p]; } if (!(parts[parts.length - 1] in o)) throw new Error('override key not found: ' + k); o[parts[parts.length - 1]] = v; } return out; }

// demo values (demo/station-patch.json, demo/products.json) carry the word DEMO in capitals or a `demo-` product key.
// They apply to the demo engine only: a real engine refuses to start if any is in its config (engine.mjs).
const DEMO_WORD = /\bDEMO\b/;
export function demoMarkers(cfg) {
  const out = [];
  const walk = (v, at) => {
    if (typeof v === 'string') { if (DEMO_WORD.test(v)) out.push(at); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, at + '[' + i + ']'));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== '$comment') walk(x, at ? at + '.' + k : k);
  };
  walk(cfg.station || {}, 'station');
  for (const p of cfg.products || []) { if (/^demo-/i.test(String(p.key || ''))) out.push('products.' + p.key + ' (demo product key)'); walk(p, 'products.' + p.key); }
  return [...new Set(out)];
}

export function loadConfig({ configDir, promptsDir, overrides = null }) {
  const engine = readJson(path.join(configDir, 'engine.json'));
  const bad = validateEngine(engine); if (bad.length) throw new Error('config/engine.json: ' + bad.join('; '));
  const opt = (f) => (fs.existsSync(path.join(configDir, f)) ? readJson(path.join(configDir, f)) : null);
  const agents = Object.fromEntries(readDir(path.join(configDir, 'agents')).map((a) => [a.key, a]));
  const lines = Object.fromEntries(readDir(path.join(configDir, 'lines')).map((l) => [l.id, l]));
  const products = overrides && overrides.productsFile ? overrides.productsFile : opt('products.json');
  const bl = path.join(configDir, 'blocklist.txt');
  const blocklist = fs.existsSync(bl) ? fs.readFileSync(bl, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) : [];
  const routines = opt('routines.json');
  const office = opt('office.json') || { departments: [] }, businesses = readBusinesses(configDir);
  const bb = validateBusinesses({ businesses, engine, lines, agents, office }); if (bb.length) throw new Error('config/businesses: ' + bb.join('; '));
  return { configDir, promptsDir, engine, blocklist, routines: (routines && routines.routines) || [], station: overrides && overrides.stationSet ? applySet(opt('station.config.json') || {}, overrides.stationSet) : (opt('station.config.json') || {}), overridden: !!overrides, products: (products && products.products) || [], productsFile: products, agents, lines, office, businesses: businesses.map(({ file, ...b }) => withDefaults(b)), building: opt('building.json') || { foreignDataMarkers: [] } };
}
