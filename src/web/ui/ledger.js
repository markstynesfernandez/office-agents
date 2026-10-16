// ui/ledger.js — the hub's viewer: notebook memory (entries, last recalled by) and the spend ledger (newest first).
import { esc, money, dateTime, when } from './format.js';

export function createLedgerView({ root }) {
  const body = root.querySelector('#ledger-body');
  async function render(snap) {
    const h = snap.hub;
    let rows = [];
    try { const r = await fetch('/api/office/ledger?limit=60'); if (r.ok) rows = (await r.json()).rows; } catch (_) { rows = []; }
    const byAgent = Object.entries(h.notebooks.byAgent).map(([n, c]) => '<tr><td>' + esc(n) + '</td><td class="m">' + c + '</td></tr>').join('');
    const recent = h.recent.map((n) => '<tr><td>' + esc(n.agent) + '</td><td>' + esc(n.kind) + '</td><td>' + esc(n.body) + '</td><td class="m">' + (n.lastUsedAt ? dateTime(n.lastUsedAt) : '—') + '</td><td class="m">' + n.useCount + '</td></tr>').join('');
    const led = rows.map((r) => '<tr><td class="m">' + dateTime(r.at) + '</td><td>' + esc(r.agent) + '</td><td class="m">' + esc(r.model || '') + '</td><td class="m">' + (r.tokens ?? '—') + '</td><td class="m">' + money(r.usd) + '</td></tr>').join('');
    body.innerHTML = '<div class="ledger-grid"><div><h3 class="muted" style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Notebooks · ' + h.notebooks.entries + ' entries · last recalled by ' + esc(h.notebooks.lastRecalledBy || '—') + (h.notebooks.lastRecalledAt ? ' · ' + esc(when(h.notebooks.lastRecalledAt, snap.generatedAt)) : '') + '</h3>'
      + '<table class="tbl"><tr><th>agent</th><th>entries</th></tr>' + byAgent + '</table><div class="muted" style="font-size:10.5px;margin:4px 0 12px">source: ' + esc(h.notebooks.source) + '</div>'
      + '<table class="tbl"><tr><th>agent</th><th>kind</th><th>record</th><th>last used</th><th>uses</th></tr>' + recent + '</table></div>'
      + '<div><h3 class="muted" style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Ledger · ' + h.ledger.rows + ' rows · last ' + (h.ledger.last ? esc(h.ledger.last.agent) + ' ' + esc(when(h.ledger.last.at, snap.generatedAt)) + ' ' + money(h.ledger.last.usd) : '—') + '</h3>'
      + '<table class="tbl"><tr><th>finished</th><th>agent</th><th>model</th><th>tokens</th><th>usd</th></tr>' + led + '</table><div class="muted" style="font-size:10.5px;margin-top:4px">source: ' + esc(h.ledger.source) + ' · newest 60 of ' + h.ledger.rows + '</div></div></div>';
  }
  return { render, show: () => root.classList.remove('hidden'), hide: () => root.classList.add('hidden'), isOpen: () => !root.classList.contains('hidden') };
}
