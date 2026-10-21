// ui/building.js — B0 (owner, 21/10/2026): the whole-building view: one card per floor (the shared floor 0 and each business), with its
// jobs, routines, agents and spend (today, this month against the budget). A business with no lines yet shows as an empty, labelled
// floor. Clicking a card opens that floor. The 3D office is paused while this view covers it (main.js syncPause).
import { esc, money } from './format.js';
import { buildingTotals } from './floors.js';

export function createBuildingView({ root, onFloor = () => {} }) {
  const body = root.querySelector('#building-body');
  function render(snap) {
    const rows = buildingTotals(snap).slice().sort((a, b) => b.floor - a.floor);   // top floor first, like a building
    const total = rows.reduce((s, r) => s + (r.todayUsd || 0), 0), month = rows.reduce((s, r) => s + (r.monthUsd || 0), 0);
    body.innerHTML = '<div class="bldg">' + rows.map((r) => '<button class="bldg-floor" data-floor="' + r.floor + '">'
      + '<span class="fl-num">' + r.floor + '</span><span><span class="fl-name">' + esc(r.name) + '</span>'
      + (r.shared ? ' <span class="tag">shared services' + (r.lounge ? ' · lounge' : '') + '</span>' : '') + (r.empty ? ' <span class="tag tag-warn">empty floor: no lines yet</span>' : '')
      + '<div class="muted" style="font-size:11px">' + esc(r.departments.join(' · ') || 'no departments') + ' · ' + r.agents + ' agent' + (r.agents === 1 ? '' : 's') + (r.lines.length ? ' · lines ' + esc(r.lines.join(', ')) : '') + '</div>'
      + '<div class="fl-stats"><span><span class="m">running</span> ' + r.jobs.running + '</span><span><span class="m">waiting</span> ' + r.jobs.waiting + '</span><span><span class="m">blocked</span> ' + r.jobs.blocked + '</span><span><span class="m">done</span> ' + r.jobs.done + '</span><span><span class="m">routines on</span> ' + r.routinesOn + '</span>'
      + '<span><span class="m">today</span> ' + money(r.todayUsd) + '</span><span><span class="m">this month</span> ' + money(r.monthUsd) + (r.budgetUsd ? ' of ' + money(r.budgetUsd) + ' budget' : '') + '</span></div></span></button>').join('')
      + '<div class="bldg-total muted">Whole building: today ' + money(total) + ' of the station\'s daily cap ' + money(snap.spend && snap.spend.caps ? snap.spend.caps.perDay : 0) + ' · this month ' + money(month) + ' · station caps stay the outer limit</div></div>';
    body.querySelectorAll('[data-floor]').forEach((el) => el.addEventListener('click', () => onFloor(Number(el.dataset.floor))));
  }
  return { render, show: () => root.classList.remove('hidden'), hide: () => root.classList.add('hidden'), isOpen: () => !root.classList.contains('hidden') };
}
