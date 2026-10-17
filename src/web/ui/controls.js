// ui/controls.js — the page's write path (E5, ENGINE-PLAN.md §6) and its dialogs. Every write goes to the server with
// the per-launch action token (from /api/session), JSON, an idempotency key and, for an existing record, the version the
// page loaded (expectedVersion, set by the caller). The idempotency key comes from the intent, not the click: the same
// record, version and action (or the same create form) gives the same key, so a double click is one write. A stale tab
// gets the server's "changed since you loaded it" message, and the snapshot is reloaded. Nothing here keeps a secret
// beyond this page load.
import { esc } from './format.js';

const NONCE = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const fnv = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
// a key for one intent: the parts that make two clicks "the same request"
export const intentKey = (...parts) => { const s = parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join('|'); return 'k' + NONCE + '-' + fnv(s) + fnv(s + '#'); };

export function createControls({ root, toastRoot, onRefresh = () => {} }) {
  let session = null;
  async function getSession() { if (!session) session = await (await fetch('/api/session')).json(); return session; }

  // ---- toasts: success fades; a refusal stays until it is closed
  function toast(msg, kind = 'ok', { stay = kind !== 'ok' } = {}) {
    const el = document.createElement('div');
    el.className = 'toast toast-' + kind;
    el.innerHTML = '<span class="toast-ico">' + (kind === 'ok' ? '✓' : kind === 'stale' ? '↻' : '!') + '</span><span class="toast-msg">' + esc(msg) + '</span><button class="toast-x" title="close">×</button>';
    el.querySelector('.toast-x').addEventListener('click', () => el.remove());
    toastRoot.appendChild(el);
    while (toastRoot.children.length > 3) toastRoot.firstChild.remove();
    if (!stay) setTimeout(() => el.remove(), 5000);
    return el;
  }

  // ---- one write; resolves the result, or null when it was refused (the refusal is shown)
  async function act(pathname, body, { key, ok = null, quiet = false } = {}) {
    const s = await getSession();
    const k = key || intentKey(pathname, body);
    let r, j;
    try {
      r = await fetch(pathname, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-station-action': s.actionToken, 'x-idempotency-key': k }, body: JSON.stringify(body || {}) });
      j = await r.json().catch(() => ({}));
    } catch (e) { toast('Not sent: the station server did not answer (' + e.message + ')', 'err'); return null; }
    if (r.ok) { if (ok && !quiet) toast(typeof ok === 'function' ? ok(j.result) : ok, 'ok'); onRefresh(); return j.result ?? {}; }
    if (r.status === 409) { toast(j.error || 'Not saved: this changed since you loaded it.', 'stale'); onRefresh(true); return null; }
    if (r.status === 403 && /token/.test(j.error || '')) session = null;
    toast((r.status === 423 ? '' : 'Not done: ') + (j.error || 'HTTP ' + r.status), 'err');
    return null;
  }

  // ---- a modal dialog: fields -> values, or null when cancelled. typed: the confirm button waits for that exact word.
  let open = null;
  function dialog({ title, intro = '', fields = [], confirm = 'OK', danger = false, typed = null, note = '' }) {
    close(null);
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'dlg-wrap';
      const f = (x) => {
        const id = 'dlg-' + x.name, req = x.required ? ' required' : '';
        const lab = '<label for="' + id + '">' + esc(x.label) + (x.required ? ' <span class="req">required</span>' : '') + '</label>';
        if (x.type === 'textarea') return lab + '<textarea id="' + id + '" name="' + x.name + '" rows="' + (x.rows || 3) + '" placeholder="' + esc(x.placeholder || '') + '"' + req + '>' + esc(x.value || '') + '</textarea>' + (x.hint ? '<div class="hint">' + esc(x.hint) + '</div>' : '');
        if (x.type === 'select') return lab + '<select id="' + id + '" name="' + x.name + '">' + x.options.map((o) => '<option value="' + esc(o.value) + '"' + (String(o.value) === String(x.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select>' + (x.hint ? '<div class="hint">' + esc(x.hint) + '</div>' : '');
        return lab + '<input id="' + id + '" name="' + x.name + '" type="' + (x.type || 'text') + '" value="' + esc(x.value ?? '') + '" placeholder="' + esc(x.placeholder || '') + '"' + (x.min != null ? ' min="' + x.min + '"' : '') + (x.max != null ? ' max="' + x.max + '"' : '') + (x.step != null ? ' step="' + x.step + '"' : '') + req + ' autocomplete="off">' + (x.hint ? '<div class="hint">' + esc(x.hint) + '</div>' : '');
      };
      wrap.innerHTML = '<form class="dlg' + (danger ? ' dlg-danger' : '') + '" novalidate><h3>' + esc(title) + '</h3>' + (intro ? '<div class="dlg-intro">' + intro + '</div>' : '')
        + fields.map(f).join('')
        + (typed ? '<label for="dlg-typed">Type <b>' + esc(typed) + '</b> to confirm</label><input id="dlg-typed" name="__typed" autocomplete="off" spellcheck="false">' : '')
        + '<div class="dlg-err hidden"></div>' + (note ? '<div class="dlg-note">' + note + '</div>' : '')
        + '<div class="dlg-foot"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok' + (typed ? ' disabled' : '') + '>' + esc(confirm) + '</button></div></form>';
      const form = wrap.querySelector('form'), okBtn = wrap.querySelector('[data-ok]'), err = wrap.querySelector('.dlg-err');
      const finish = (v) => { wrap.remove(); if (open && open.wrap === wrap) open = null; resolve(v); };
      open = { wrap, finish };
      if (typed) { const t = wrap.querySelector('#dlg-typed'); t.addEventListener('input', () => { okBtn.disabled = t.value.trim() !== typed; }); }
      wrap.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) finish(null); });
      wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); finish(null); } });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const vals = {};
        for (const x of fields) { const el = form.elements[x.name]; vals[x.name] = el.value; if (x.required && !String(el.value).trim()) { err.textContent = x.label + ' is required.'; err.classList.remove('hidden'); el.focus(); return; } }
        if (typed && form.elements.__typed.value.trim() !== typed) return;
        finish(vals);
      });
      root.appendChild(wrap);
      const first = wrap.querySelector('textarea, input, select'); if (first) first.focus(); else okBtn.focus();
    });
  }
  function close(v) { if (open) open.finish(v); }
  return { act, dialog, toast, isDialogOpen: () => !!open, closeDialog: () => close(null), session: getSession };
}
