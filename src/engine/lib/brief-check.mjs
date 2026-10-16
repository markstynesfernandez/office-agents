// PORTED from Virtual-workers/station/scripts/check-briefs.mjs (the owner's own code) at 16/10/2026 19:16 Irish time, source sha256 8420733387ad9c3a3928ba1e7ff71be5f35310e05c5c84a0aa8db9f9b2702416.
//   change: the per-brief checks of the digital branch become one function, checkBrief(), used by the research line's brief-check step
//           and by the line's intake step (a "verified" brief is checked again before a job starts; the engine never trusts a status alone)
//   change: no CLI, no folder walk, no console output; products, config and today are passed in
//   change: the saturated list applies to the Design direction too (owner Q5, via SOFT_CATEGORIES = [])
// The rules and their order are the source's: demand evidence first, then a digital product, the originality of the Design direction,
// the image policy, then the price floor (or the owner price line).
import { briefUsdRange } from './gates.mjs';
import { briefPriceCheck, variantLadder } from './etsy-fees.mjs';
import { imagePolicyProblem } from './image-policy.mjs';
import { screenText, hitLine, SOFT_CATEGORIES } from './originality.mjs';
import { demandEvidenceProblems, ownerPrice } from './demand-evidence.mjs';
import { config as defaultConfig } from './common.mjs';

export const designDirectionOf = (t) => (/^## Design direction[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(String(t || '').replace(/\r\n/g, '\n')) || [])[1] || '';
export const briefField = (t, k) => { const m = new RegExp('^' + k + ':[ \\t]*(\\S+)', 'm').exec(String(t || '')); return m ? m[1] : null; };

// -> { ok, reasons: [], key, product, evidence, price }
export function checkBrief(text, { products = [], cfg = defaultConfig, today = new Date() } = {}) {
  const t = String(text || '').replace(/\r\n/g, '\n'), reasons = [];
  const key = briefField(t, 'product_type'), prod = products.find((x) => x.key === key) || null;
  const de = demandEvidenceProblems(t, { today });
  if (!de.ok) return { ok: false, reasons: ['demand evidence: ' + de.problems.join('; ')], key, product: prod };
  if (!(prod && prod.digital === true)) return { ok: false, reasons: ['product_type ' + key + ' is not a digital product in products.json'], key, product: prod };
  const og = screenText(designDirectionOf(t), cfg, { ignore: SOFT_CATEGORIES });
  if (og.result === 'hit') return { ok: false, reasons: ['originality: Design direction ' + og.hits.map((h) => hitLine({ field: 'concept', ...h })).join('; ')], key, product: prod, originality: og };
  const policy = imagePolicyProblem(prod, cfg); if (policy) return { ok: false, reasons: [policy], key, product: prod };
  const range = briefUsdRange(t), r = briefPriceCheck((range || {}).min ?? null, prod, cfg, range);
  const op = ownerPrice(t);
  if (op && op.problem) { r.ok = false; r.reason = op.problem; }
  else if (op) {
    r.ladder = variantLadder(prod, range, cfg, { priceEur: op.point != null ? op.point : op.min });
    r.ok = op.min >= r.floorEur - 1e-9 && (op.point == null || op.point >= r.floorEur - 1e-9);
    r.reason = 'owner price EUR ' + op.min.toFixed(2) + '–' + op.max.toFixed(2) + ' (recorded by owner, ' + op.date + ') ' + (op.min >= r.floorEur - 1e-9 ? '>=' : 'is BELOW') + ' the floor EUR ' + r.floorEur.toFixed(2);
  }
  if (!r.ok) reasons.push('price: ' + r.reason);
  return { ok: reasons.length === 0, reasons, key, product: prod, evidence: de.evidence, price: { ok: r.ok, reason: r.reason, floorEur: r.floorEur } };
}
