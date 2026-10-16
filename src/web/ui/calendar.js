// ui/calendar.js — week/month calendar (W/M). One entry per job, on the day of its latest stage change, with a stage
// chip; clicking it opens the job. Routines come only from cron.jobs.json: enabled ones are projected forward; paused ones
// (enabled:false) are listed as "paused · waits for my OK" and appear on the grid only, ghosted, when the owner turns on
// "show where paused routines would run". The day popover is a PREVIEW ONLY in v1: it sends nothing.
import { esc, hhmm, when, ymd, dmy, MONTHS, DOW, money } from './format.js';
import { PALETTE } from '../config/palette.js';

export function createCalendar({ root, onOpenJob }) {
  const body = root.querySelector('#calendar-body');
  const state = { mode: 'month', cursor: null, dept: null, routines: true, ghosts: false, done: true, q: '', snap: null, popover: null };
  const startOfWeek = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); return x; };
  const doneKinds = new Set(['done', 'rejected', 'blocked']);

  function eventsFor(dateStr) {
    const s = state.snap; if (!s) return [];
    let evs = s.events.filter((e) => e.date === dateStr);
    if (state.ghosts) for (const r of s.routines) for (const t of r.ghostRuns || []) if (ymd(new Date(t)) === dateStr) evs.push({ date: dateStr, at: t, kind: 'ghost', routineId: r.id, title: r.name, dept: r.dept, agent: r.agentName });
    return evs
      .filter((e) => !state.dept || e.dept === state.dept)
      .filter((e) => state.routines || !(e.kind === 'routine' || e.kind === 'routine-run' || e.kind === 'ghost'))
      .filter((e) => state.done || !(e.kind === 'job' && doneKinds.has(e.stage)))
      .filter((e) => !state.q || (e.title + ' ' + (e.jobId || '') + ' ' + (e.agent || '')).toLowerCase().includes(state.q.toLowerCase()))
      .sort((a, b) => a.at - b.at);
  }
  const chip = (e) => (e.kind === 'job' ? '<span class="stage stage-' + esc(e.stage) + '">' + esc(e.stageLabel) + '</span>' : e.kind === 'ghost' ? '<span class="stage stage-ghost">paused</span>' : e.kind === 'routine-run' ? '<span class="stage">ran</span>' : '<span class="stage">↻</span>');
  const evHtml = (e) => '<div class="ev ev-' + esc(e.kind) + (e.kind === 'job' ? ' ev-stage-' + esc(e.stage) : '') + '" title="' + esc(e.title + (e.jobId ? '\n' + e.jobId : '') + '\n' + (e.stageLabel || e.kind) + (e.agent ? ' · ' + e.agent : '') + ' · ' + hhmm(e.at) + (e.reason ? '\n' + e.reason : '') + (e.kind === 'ghost' ? '\npaused routine: would run here once enabled (waits for my OK)' : '') + (e.synthetic ? '\nsynthetic test state' : '')) + '"' + (e.jobId ? ' data-job="' + esc(e.jobId) + '"' : '') + '>' + chip(e) + (e.synthetic ? '<span class="syn">syn</span>' : '') + '<span class="t">' + esc(e.title) + '</span></div>';

  function render(snap) {
    if (snap) state.snap = snap; const s = state.snap; if (!s) return;
    const nowMs = s.generatedAt || Date.now(), today = ymd(new Date(nowMs));
    if (!state.cursor) state.cursor = new Date(nowMs);
    const c = state.cursor;
    let gridHtml = '', title = '';
    if (state.mode === 'month') {
      const first = new Date(c.getFullYear(), c.getMonth(), 1), start = startOfWeek(first);
      title = MONTHS[c.getMonth()] + ' ' + c.getFullYear();
      const cells = [];
      for (let i = 0; i < 42; i++) { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i); const ds = ymd(d); const evs = eventsFor(ds); cells.push('<div class="day' + (d.getMonth() !== c.getMonth() ? ' other' : '') + (ds === today ? ' today' : '') + '" data-date="' + ds + '"><div class="d"><span>' + d.getDate() + '</span>' + (evs.length > 3 ? '<span class="n">' + evs.length + '</span>' : '') + '</div>' + evs.slice(0, 3).map(evHtml).join('') + (evs.length > 3 ? '<div class="more">+' + (evs.length - 3) + ' more</div>' : '') + '</div>'); }
      gridHtml = '<div class="cal-dows">' + DOW.map((d) => '<div>' + d + '</div>').join('') + '</div><div class="cal-grid">' + cells.join('') + '</div>';
    } else {
      const start = startOfWeek(c), end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
      title = dmy(start.getTime()) + ' – ' + dmy(end.getTime());
      const cells = [];
      for (let i = 0; i < 7; i++) { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i); const ds = ymd(d); const evs = eventsFor(ds); cells.push('<div class="day' + (ds === today ? ' today' : '') + '" data-date="' + ds + '"><div class="d"><span>' + DOW[i] + ' ' + dmy(d.getTime()).slice(0, 5) + '</span><span class="n">' + (evs.length || '') + '</span></div>' + evs.map(evHtml).join('') + '</div>'); }
      gridHtml = '<div class="week">' + cells.join('') + '</div>';
    }
    const chips = s.departments.map((d) => '<button class="ctl chip ' + (state.dept === d.key ? 'chip-on' : '') + '" data-dept="' + esc(d.key) + '" style="border-color:' + (PALETTE.departments[d.key] || '#ccc') + '">' + esc(d.name) + '</button>').join('');
    const paused = s.routines.filter((r) => !r.enabled), enabled = s.routines.filter((r) => r.enabled);
    const routineHtml = (r) => '<div class="routine' + (r.enabled ? '' : ' paused') + '"><div class="n" title="' + esc(r.name) + '">' + (r.live ? '● ' : '↻ ') + esc(r.name) + '</div>'
      + '<div class="m">' + esc(r.scheduleWords) + ' · ' + esc(r.agentName) + '</div>'
      + (r.enabled ? '<div class="m">next: ' + (r.nextRun ? esc(when(r.nextRun, nowMs)) + (r.nextRunIsProjection ? ' · projected from the cron expression' : '') : '—') + '</div><div class="m"><span class="badge badge-on">enabled</span></div>'
        : '<div class="m"><span class="badge badge-warn">paused · waits for my OK</span></div><div class="m">not scheduled: it will not run until it is enabled</div>')
      + (r.lastRunAt ? '<div class="m">last run ' + esc(when(r.lastRunAt, nowMs)) + ' · ' + money(r.lastUsd) + '</div>' : '<div class="m">never run</div>') + '</div>';
    const side = '<aside class="cal-side"><h3>Routines (' + s.routines.length + ')</h3>'
      + (s.routines.length ? enabled.map(routineHtml).join('') + paused.map(routineHtml).join('') : '<div class="muted">No routines in cron.jobs.json.</div>')
      + (paused.length ? '<label class="ghost-toggle"><input type="checkbox" data-ghosts ' + (state.ghosts ? 'checked' : '') + '> show where paused routines would run</label>' : '')
      + '<div class="srcnote">source: ' + esc((s.routines[0] && s.routines[0].source) || 'routines') + ' · "waits for my OK" = enabled:false</div></aside>';
    body.innerHTML = '<div class="cal-wrap">' + side
      + '<div class="cal-main"><div class="cal-tools"><h2>' + esc(title) + '</h2>'
      + '<span class="grp"><button class="ctl" data-nav="-1" title="previous">‹</button><button class="ctl" data-nav="0" title="today (T)">Today</button><button class="ctl" data-nav="1" title="next">›</button></span>'
      + '<span class="grp"><button class="ctl chip ' + (state.mode === 'week' ? 'chip-on' : '') + '" data-mode="week" title="W">Week</button><button class="ctl chip ' + (state.mode === 'month' ? 'chip-on' : '') + '" data-mode="month" title="M">Month</button></span>'
      + '<span class="grp">' + chips + '</span><span class="grp"><button class="ctl chip ' + (state.routines ? 'chip-on' : '') + '" data-toggle="routines">routines</button><button class="ctl chip ' + (state.done ? 'chip-on' : '') + '" data-toggle="done">finished</button></span>'
      + '<input class="ctl" type="search" placeholder="search jobs, agents…" value="' + esc(state.q) + '"></div>'
      + gridHtml + '<div class="cal-foot muted">one entry per job, on the day of its latest stage change · click a day to draft a schedule (preview only, nothing is sent) · Esc to close</div></div></div>';
    body.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => { const n = Number(b.dataset.nav); if (n === 0) state.cursor = new Date(nowMs); else if (state.mode === 'month') state.cursor = new Date(c.getFullYear(), c.getMonth() + n, 1); else state.cursor = new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7 * n); render(); }));
    body.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { state.mode = b.dataset.mode; render(); }));
    body.querySelectorAll('[data-dept]').forEach((b) => b.addEventListener('click', () => { state.dept = state.dept === b.dataset.dept ? null : b.dataset.dept; render(); }));
    body.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => { state[b.dataset.toggle] = !state[b.dataset.toggle]; render(); }));
    body.querySelector('[data-ghosts]')?.addEventListener('change', (e) => { state.ghosts = e.target.checked; render(); });
    const search = body.querySelector('input[type=search]'); search.addEventListener('input', () => { state.q = search.value; const pos = search.selectionStart; render(); const s2 = body.querySelector('input[type=search]'); s2.focus(); s2.setSelectionRange(pos, pos); });
    body.querySelectorAll('.ev[data-job]').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); onOpenJob(el.dataset.job); }));
    body.querySelectorAll('.day').forEach((el) => el.addEventListener('click', (e) => openPopover(el, el.dataset.date, e)));
  }

  function openPopover(dayEl, dateStr) {
    closePopover();
    const s = state.snap; const pop = document.createElement('div'); pop.className = 'popover';
    const depts = s.departments.map((d) => '<option value="' + esc(d.key) + '">' + esc(d.name) + '</option>').join('');
    const [y, m, d] = dateStr.split('-');
    pop.innerHTML = '<h3>Schedule for ' + esc(d + '/' + m + '/' + y) + '<span class="badge badge-preview">preview · not connected</span></h3>'
      + '<label>Department</label><select>' + depts + '</select>'
      + '<label>Time (24h)</label><input type="time" value="09:00">'
      + '<label>Model</label><select><option>claude-haiku-5-5 (cheap tier)</option><option>claude-sonnet-5-5 (strong tier)</option></select>'
      + '<label>Task</label><textarea rows="3" placeholder="What should the department do? (nothing is sent in v1)"></textarea>'
      + '<label>Repeat</label><select><option>once</option><option>daily</option><option>weekly (same weekday)</option><option>monthly</option></select>'
      + '<div class="foot"><label class="chk" style="margin:0"><input type="checkbox" checked disabled> needs my OK</label><button class="btn" disabled>Schedule (disabled in v1)</button></div>';
    const r = dayEl.getBoundingClientRect(), host = root.getBoundingClientRect();
    pop.style.left = Math.min(r.left - host.left + 10, host.width - 340) + 'px'; pop.style.top = Math.min(r.top - host.top + 10, host.height - 330) + 'px';
    pop.addEventListener('click', (e) => e.stopPropagation());
    root.appendChild(pop); state.popover = pop;
    setTimeout(() => document.addEventListener('click', closePopover, { once: true }), 0);
  }
  function closePopover() { if (state.popover) { state.popover.remove(); state.popover = null; } }
  function toggleMode(m) { state.mode = m; render(); }
  function today() { state.cursor = new Date(state.snap ? state.snap.generatedAt : Date.now()); render(); }
  return { render, show: () => { root.classList.remove('hidden'); render(); }, hide: () => { closePopover(); root.classList.add('hidden'); }, isOpen: () => !root.classList.contains('hidden'), toggleMode, today, closePopover, hasPopover: () => !!state.popover, setGhosts: (v) => { state.ghosts = v; render(); } };
}
