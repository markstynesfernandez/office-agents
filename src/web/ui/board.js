// ui/board.js — jobs by stage, using the line's stage names (the column subtitle names the agent that owns the stage), plus the
// rejected and blocked lanes. Active jobs show progress; lane jobs show a status pill and the status reason.
import { esc, money, duration, when, statusPill, synthTag, legacyTag } from './format.js';
import { PALETTE } from '../config/palette.js';

export function createBoard({ root, onOpenJob }) {
  const body = root.querySelector('#board-body');
  function card(j, agents, now) {
    const a = agents.find((x) => x.id === j.agentId);
    const head = (j.progress != null ? '<span class="pct">' + j.progress + '%</span>' : statusPill(j)) + legacyTag(j);
    return '<div class="card' + (j.lane ? ' card-' + j.lane : '') + '" data-id="' + esc(j.id) + '"><div class="top">' + head + synthTag(j) + (j.warnings && j.warnings.length ? '<span class="warn-dot" title="' + esc(j.warnings.join('\n')) + '">⚠</span>' : '') + '</div>'
      + '<div class="t" title="' + esc(j.title + (j.niche ? '\n' + j.niche : '')) + '">' + esc(j.title) + '</div><div class="id">' + esc(j.id) + '</div>'
      + (j.statusReason ? '<div class="r" title="' + esc(j.statusReason) + '">' + esc(j.statusReason) + '</div>' : '')
      + '<div class="agent"><i style="background:' + (a ? (PALETTE.status[a.status] || '#999') : '#bbb') + '"></i>' + esc(j.agentName || '—') + (j.costUsd != null ? ' · ' + money(j.costUsd) : '') + (j.progress != null && j.elapsedMs != null ? ' · ' + duration(j.elapsedMs) : '') + '</div>'
      + '<div class="when">' + esc(when(j.stageChangedAt, now)) + '</div></div>';
  }
  function render(snap) {
    const now = snap.generatedAt || Date.now();
    const byId = Object.fromEntries(snap.jobs.map((j) => [j.id, j]));
    const cols = snap.board.columns.map((c) => '<div class="col"><h3>' + esc(c.label) + '<b>' + c.jobIds.length + '</b></h3><div class="sub">' + esc(c.dock ? c.agentName + ' · ' + c.dock : c.agentName || '') + '</div>' + (c.jobIds.map((id) => card(byId[id], snap.agents, now)).join('') || '<div class="empty">empty</div>') + '</div>').join('');
    const lane = (key, label, sub, ids) => '<div class="col lane ' + key + '"><h3>' + label + '<b>' + ids.length + '</b></h3><div class="sub">' + sub + '</div><div class="lane-cards">' + (ids.map((id) => card(byId[id], snap.agents, now)).join('') || '<div class="empty">none</div>') + '</div></div>';
    body.innerHTML = '<div class="board">' + cols + '</div><div class="lanes">'
      + lane('blocked', 'blocked', 'blocked or stopped, with the reason · incl. QA passed, gate failed', snap.board.lanes.blocked)
      + lane('rejected', 'rejected', 'REJECTS-DESK · rejected/ · rejected_by_owner', snap.board.lanes.rejected)
      + (snap.board.lanes.parked ? lane('parked', 'parked', 'kept, not publishing (owner Q11): not in the approval queue', snap.board.lanes.parked) : '') + '</div>';
    body.querySelectorAll('.card').forEach((el) => el.addEventListener('click', () => onOpenJob(el.dataset.id)));
  }
  return { render, show: () => root.classList.remove('hidden'), hide: () => root.classList.add('hidden'), isOpen: () => !root.classList.contains('hidden') };
}
