// ui/evidence.js — the brief's evidence level on the approval card (owner decision 2, 17/10/2026; DECISIONS.md "E6 step
// b2: owner decisions, part 2"). The approval queue is the only human gate before an Etsy listing, so a brief whose
// demand evidence is "indicative" (genre-scout briefs: web search results only, competitor count not measured, until
// the Etsy Open API) says so prominently there. No DOM: the panel inserts the returned HTML (tested in node).
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function evidenceBanner(level) {
  if (!level) return '';
  if (level === 'indicative') return '<div class="evidence-banner evidence-indicative" role="note"><strong>Evidence: INDICATIVE</strong> — demand from web search results only (titles, prices and keywords as the results showed them); competitor count not measured; no Etsy page was opened.</div>';
  return '<div class="evidence-banner" role="note"><strong>Evidence: ' + esc(level.toUpperCase()) + '</strong></div>';
}
