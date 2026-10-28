// ui/floormenu.js — the Floors button on the stage (owner, 28/10/2026): one clear way to reach every department. F (or the button)
// opens a list of the floors, top floor first, each with its departments; a floor goes to that floor, a department goes to its floor
// and flies the camera to it. Esc or F again closes it. Rows come from floors.js floorMenu (pure).
import { esc } from './format.js';
import { floorMenu } from './floors.js';

export function createFloorMenu({ button, root, onFloor = () => {}, onDept = () => {} }) {
  let open = false, rows = [], cur = null;
  function render() {
    root.innerHTML = '<div class="fm-head">Floors <span class="muted">click a department to go there · F or Esc to close</span></div>' + rows.map((r) => '<div class="fm-floor' + (r.floor === cur ? ' fm-cur' : '') + '">'
      + (r.floor == null ? '<div class="fm-name">' + esc(r.name) + '</div>' : '<button class="fm-go" data-floor="' + r.floor + '"><span class="fm-n">' + r.floor + '</span><span class="fm-name">' + esc(r.name) + '</span>' + (r.floor === cur ? '<span class="muted">you are here</span>' : '') + '</button>')
      + '<div class="fm-depts">' + (r.departments.length ? r.departments.map((d) => '<button class="chip" data-floor="' + (r.floor == null ? '' : r.floor) + '" data-dept="' + esc(d.key) + '">' + esc(d.name) + '</button>').join('') : '<span class="muted">' + (r.empty ? 'empty floor: no lines yet' : 'no departments') + '</span>') + '</div></div>').join('');
    root.querySelectorAll('[data-floor]').forEach((el) => el.addEventListener('click', () => {
      const n = el.dataset.floor === '' ? null : Number(el.dataset.floor), dept = el.dataset.dept || null;
      hide();
      if (n != null && n !== cur) onFloor(n);
      if (dept) onDept(dept);
    }));
  }
  function setData(snap, floor) { rows = floorMenu(snap); cur = floor; button.classList.toggle('hidden', !rows.some((r) => r.departments.length || r.floor != null)); if (open) render(); }
  function show() { open = true; render(); root.classList.remove('hidden'); button.setAttribute('aria-expanded', 'true'); }
  function hide() { open = false; root.classList.add('hidden'); button.setAttribute('aria-expanded', 'false'); }
  button.addEventListener('click', (e) => { e.currentTarget.blur(); if (open) hide(); else show(); });
  return { setData, show, hide, toggle: () => (open ? hide() : show()), isOpen: () => open };
}
