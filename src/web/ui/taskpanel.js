// ui/taskpanel.js — right-hand task panel: department dropdown + task input (preview only until E5, nothing is sent),
// an "Active" chip (the default since R2: in progress + waiting for my OK + backlog + blocked), status chips whose
// counts add up to All, scope toggle, and the task list. Active jobs (in progress / waiting) show a
// progress %; blocked, rejected, done and backlog jobs show a status pill, and blocked/rejected show the status reason.
import { esc, duration, jobStatusLabel, statusPill, synthTag } from './format.js';

// every job has exactly one of these statuses, so the status chip counts add up to All; Active groups the open ones
const ACTIVE = ['in_progress', 'waiting', 'backlog', 'blocked'];
const FILTERS = [['active', 'Active'], ['all', 'All'], ['in_progress', 'In progress'], ['waiting', 'Waiting for my OK'], ['backlog', 'Backlog'], ['done', 'Done'], ['blocked', 'Blocked'], ['rejected', 'Rejected'], ['parked', 'Parked']];

// agent · department · stage, leaving out what is unknown (lane jobs show their stage as the pill instead)
const meta = (j) => [j.agentName, j.dept, j.lane ? null : j.stageLabel].filter(Boolean).join(' · ') || j.id;

export function createTaskPanel({ root, onOpenJob }) {
  const sel = root.querySelector('#task-dept'), input = root.querySelector('#task-input'), submit = root.querySelector('#task-submit');
  const filtersEl = root.querySelector('#task-filters'), list = root.querySelector('#task-list');
  const state = { filter: 'active', scope: 'office', dept: null, snap: null };
  submit.addEventListener('click', (e) => { e.preventDefault(); });   // v1: UI only, no request is made
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) e.preventDefault(); });
  root.querySelectorAll('.scope .chip').forEach((b) => b.addEventListener('click', () => { state.scope = b.dataset.scope; root.querySelectorAll('.scope .chip').forEach((x) => x.classList.toggle('chip-on', x === b)); render(); }));
  sel.addEventListener('change', () => { state.dept = sel.value || null; render(); });

  function setSnapshot(snap) {
    state.snap = snap;
    const cur = sel.value;
    sel.innerHTML = snap.departments.map((d) => '<option value="' + esc(d.key) + '">' + esc(d.name) + '</option>').join('');
    if (cur && snap.departments.some((d) => d.key === cur)) sel.value = cur; state.dept = sel.value || null;
    render();
  }
  function setDept(key) { if (state.snap && state.snap.departments.some((d) => d.key === key)) { sel.value = key; state.dept = key; render(); } }
  const scoped = () => { const s = state.snap; return state.scope === 'dept' && state.dept ? s.jobs.filter((j) => j.dept === state.dept) : s.jobs; };
  const matches = (j, f) => (f === 'all' ? true : f === 'active' ? ACTIVE.includes(j.status) : j.status === f);
  function counts() { const base = scoped(); return Object.fromEntries(FILTERS.map(([k]) => [k, base.filter((j) => matches(j, k)).length])); }
  function render() {
    if (!state.snap) return;
    const c = counts();
    filtersEl.innerHTML = FILTERS.map(([k, l]) => '<button class="chip ' + (state.filter === k ? 'chip-on' : '') + (c[k] === 0 && k !== 'all' && k !== 'active' ? ' chip-zero' : '') + (k === 'active' ? ' chip-active' : '') + '" data-f="' + k + '">' + l + '<b>' + c[k] + '</b></button>').join('');
    filtersEl.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => { state.filter = b.dataset.f; render(); }));
    const jobs = scoped().filter((j) => matches(j, state.filter));
    list.innerHTML = jobs.length ? jobs.map((j) => {
      const active = j.progress != null;
      const left = active ? '<div class="pct">' + j.progress + '%</div>' : '<div class="pct">' + statusPill(j) + '</div>';
      const reason = (j.lane || j.flag === 'error') && j.statusReason ? '<div class="reason" title="' + esc(j.statusReason) + '">' + esc(j.statusReason) + '</div>' : '';
      const warn = j.warnings && j.warnings.length ? '<span class="warn-dot" title="' + esc(j.warnings.join('\n')) + '">⚠</span>' : '';
      return '<div class="task st-' + j.status + (j.lane ? ' lane-' + j.lane : '') + '" data-id="' + esc(j.id) + '">'
        + left
        + '<div class="body"><div class="title-row"><span class="title" title="' + esc(j.title + '\n' + j.id + (j.niche ? '\n' + j.niche : '')) + '">' + esc(j.title) + '</span>' + warn + (j.flag === 'error' ? '<span class="tag tag-err">error</span>' : '') + synthTag(j) + '</div>'
        + '<div class="meta" title="' + esc(meta(j) + ' · ' + (jobStatusLabel[j.status] || j.status)) + '">' + esc(meta(j)) + '</div>' + reason + '</div>'
        + '<div class="elapsed" title="elapsed since the job started">' + (j.elapsedMs != null ? duration(j.elapsedMs) : '—') + '</div>'
        + (active ? '<div class="bar"><i style="width:' + j.progress + '%"></i></div>' : '') + '</div>';
    }).join('') : '<div class="muted" style="padding:10px">No tasks match this filter.</div>';
    list.querySelectorAll('.task').forEach((el) => el.addEventListener('click', () => onOpenJob(el.dataset.id)));
  }
  return { setSnapshot, setDept, render };
}
