// ui/taskpanel.js — right-hand task panel. The task box (E5, live in engine mode): "Research this" (text -> a research
// job), "Start line on brief" (a verified brief from research/briefs/ -> a job on the Room 1 line), "Re-run listing" (a
// QA-approved design -> LISTER again; the old listing moves to rerun-archive-*). The legacy view is read only.
// Below it: an "Active" chip (the default since R2: in progress + waiting for my OK + backlog + blocked), status chips
// whose counts add up to All, scope toggle, and the task list. Active jobs show a progress %; the others a status pill.
import { esc, duration, jobStatusLabel, statusPill, synthTag } from './format.js';
import { intentKey } from './controls.js';

// L2: research briefs are indicative until the Etsy Open API is in (E7); shown in the pane and in the spend dialog
export const RESEARCH_NOTE = 'Demand evidence from research is indicative until the Etsy API (E7): search-result prices and keywords as shown, no measured competitor count.';
const RESEARCH_NOTE_HTML = '<div class="dlg-note">' + RESEARCH_NOTE + '</div>';

// every job has exactly one of these statuses, so the status chip counts add up to All; Active groups the open ones
const ACTIVE = ['in_progress', 'waiting', 'backlog', 'blocked'];
// E5 item 0b: imported legacy jobs are only under the Legacy chip (off by default), never in Active, All or a status
// chip; archived engine jobs only under Archived. So the status chips still add up to All.
const FILTERS = [['active', 'Active'], ['all', 'All'], ['in_progress', 'In progress'], ['waiting', 'Waiting for my OK'], ['backlog', 'Backlog'], ['done', 'Done'], ['blocked', 'Blocked'], ['rejected', 'Rejected'], ['parked', 'Parked'], ['archived', 'Archived'], ['legacy', 'Legacy']];
const SIDE = { legacy: (j) => j.kind === 'legacy', archived: (j) => j.kind !== 'legacy' && j.state === 'archived' };
// pure (tests/live-ui.test.mjs): does job j show under filter f
export const matchesFilter = (j, f) => (SIDE[f] ? SIDE[f](j) : Object.values(SIDE).some((x) => x(j)) ? false : f === 'all' ? true : f === 'active' ? ACTIVE.includes(j.status) : j.status === f);

// agent · department · stage, leaving out what is unknown (lane jobs show their stage as the pill instead)
const meta = (j) => [j.agentName, j.dept, j.lane ? null : j.stageLabel].filter(Boolean).join(' · ') || j.id;

export function createTaskPanel({ root, onOpenJob, ctl = null }) {
  const sel = root.querySelector('#task-dept');
  const filtersEl = root.querySelector('#task-filters'), list = root.querySelector('#task-list');
  const research = root.querySelector('#task-research'), briefSel = root.querySelector('#task-brief'), rerunSel = root.querySelector('#task-rerun'), productSel = root.querySelector('#task-product');
  const state = { filter: 'active', scope: 'office', dept: null, snap: null, tab: 'research', form: 1, busy: false, pickBrief: null };
  const live = () => !!(state.snap && state.snap.controls && state.snap.controls.live);

  // ---- the task box
  function setTab(t) {
    state.tab = t;
    root.querySelectorAll('.tp-tabs .chip').forEach((b) => b.classList.toggle('chip-on', b.dataset.tab === t));
    root.querySelectorAll('.tp-pane').forEach((p) => p.classList.toggle('hidden', p.dataset.pane !== t));
  }
  root.querySelectorAll('.tp-tabs .chip').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  research.addEventListener('input', () => { state.form++; });   // a new text is a new request
  async function go(kind) {
    if (!ctl || !live() || state.busy) return;
    const btn = root.querySelector('[data-go="' + kind + '"]');
    state.busy = true; btn.disabled = true;
    try {
      if (kind === 'research') {
        const text = research.value.trim(); if (text.length < 3) { ctl.toast('Describe what to research first.', 'err'); return; }
        const r = await ctl.spendAct('research', '/api/tasks/research', { text }, { key: intentKey('research', text, state.form), ok: (x) => 'Research job ' + x.jobId + ' created', extra: RESEARCH_NOTE_HTML });
        if (r) { research.value = ''; state.form++; }
      } else if (kind === 'brief') {
        const file = briefSel.value; if (!file) { ctl.toast('No verified brief is waiting.', 'err'); return; }
        await ctl.spendAct('start-line', '/api/tasks/brief', { file }, { key: intentKey('brief', file), ok: (x) => 'Job ' + x.jobId + ' created on the line' });
      } else if (kind === 'owner-brief') {
        await ownerBriefForm();
      } else if (kind === 'rerun') {
        const j = (state.snap.jobs || []).find((x) => x.id === rerunSel.value); if (!j) { ctl.toast('No QA-approved design to re-list.', 'err'); return; }
        const extra = '<div class="dlg-note"><b>' + esc(j.title) + '</b> <span class="mono">' + esc(j.id) + '</span>: the current listing, its QA-LISTING records and the package move to <span class="mono">jobs/' + esc(j.id) + '/rerun-archive-*</span> (nothing is deleted).' + (j.queue && j.queue.status === 'pending' ? ' The job leaves the approval queue until the new package is ready.' : '') + '</div>';
        await ctl.spendAct('rerun-listing', '/api/tasks/rerun-listing', { jobId: j.id, expectedVersion: j.version }, { ok: 'Listing re-run started for ' + j.id, extra });
      }
    } finally { state.busy = false; btn.disabled = !live(); }
  }
  // L2: an owner brief from a form: title, theme, audience, the items (as many as the product spec has files), price bounds at or above the
  // floor, and whether the owner approves file 1. Saved through the same intake checks as the CLI; a refusal reopens the form with the reasons
  async function ownerBriefForm() {
    const F = state.snap.ownerBriefForm || { products: [] }, prod = F.products.find((p) => p.key === productSel.value) || F.products[0];
    if (!prod) { ctl.toast('No digital product in products.json to brief.', 'err'); return; }
    let vals = { title: '', theme: '', audience: '', minUsd: prod.floorUsd != null ? prod.floorUsd.toFixed(2) : '', maxUsd: '', ownerFile1: 'false' }, why = '';
    for (;;) {
      const fields = [{ name: 'title', label: 'Title', required: true, value: vals.title, placeholder: 'e.g. Cozy Winter Desk Props' },
        { name: 'theme', label: 'Theme', type: 'textarea', required: true, rows: 3, value: vals.theme, placeholder: 'the look and feel: palette, mood, style (no brands, characters or named artists)' },
        { name: 'audience', label: 'Audience', required: true, value: vals.audience, placeholder: 'e.g. PNGTuber and VTuber streamers' },
        ...Array.from({ length: prod.files }, (_, i) => ({ name: 'item' + (i + 1), label: 'Item ' + (i + 1) + (i === 0 && prod.styleReference ? ' (the style reference)' : ''), required: true, value: vals['item' + (i + 1)] || '' })),
        { name: 'minUsd', label: 'Lowest price (USD)', type: 'number', required: true, min: prod.floorUsd ?? 0.2, step: 0.01, value: vals.minUsd, hint: prod.floorUsd != null ? 'at or above the floor USD ' + prod.floorUsd.toFixed(2) : '' },
        { name: 'maxUsd', label: 'Highest price (USD)', type: 'number', required: true, min: prod.floorUsd ?? 0.2, step: 0.01, value: vals.maxUsd },
        ...(prod.styleReference ? [{ name: 'ownerFile1', label: 'File 1 (the style reference)', type: 'select', value: vals.ownerFile1, options: [{ value: 'false', label: 'QA DESIGN’s pass approves file 1; the set follows (default)' }, { value: 'true', label: 'Pause for my decision on file 1 (ownerFile1)' }] }] : [])];
      const v = await ctl.dialog({ title: 'New owner brief · ' + prod.key, intro: (why ? '<div class="spend-refused">' + esc(why) + '</div>' : '') + 'An owner brief claims no market evidence (the approval card says so). ' + prod.files + ' items, one per file of the product spec. It is saved to <span class="mono">research/briefs/</span> after the same checks as <span class="mono">npm run owner-brief</span>: format, originality of the whole brief, the scouting blocklist, the image policy and your bounds against the floor. Saving spends nothing.', fields, confirm: 'Save brief' });
      if (!v) return;
      vals = v;
      const body = { title: v.title, theme: v.theme, audience: v.audience, productKey: prod.key, items: Array.from({ length: prod.files }, (_, i) => v['item' + (i + 1)]), minUsd: Number(v.minUsd), maxUsd: Number(v.maxUsd), ownerFile1: v.ownerFile1 === 'true' };
      const s = await ctl.session();
      const r = await fetch('/api/tasks/owner-brief', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-station-action': s.actionToken, 'x-idempotency-key': intentKey('owner-brief', body) }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { ctl.toast('Owner brief saved: research/briefs/' + j.result.file + (j.result.changed ? '' : ' (unchanged)') + '. Start the line when you are ready.', 'ok'); state.pickBrief = j.result.file; return; }
      why = j.error || 'HTTP ' + r.status;
    }
  }
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); go(b.dataset.go); }));
  research.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go('research'); } });

  function renderBox() {
    const s = state.snap, on = live();
    root.querySelector('#task-mode').textContent = on ? (s.engine && s.engine.halted ? 'E-STOP on: nothing starts' : 'live · ' + (s.engine ? s.engine.provider : '') + ' provider') : 'legacy view · read only';
    root.querySelectorAll('[data-go], #task-research, #task-brief, #task-rerun, #task-product').forEach((el) => { el.disabled = !on || (s.engine && s.engine.halted && el.dataset.go !== undefined); });
    research.placeholder = on ? 'What should DEMAND-RESEARCHER look into? e.g. cosy autumn sticker niches with steady demand' : 'The legacy view is read only: start the engine (npm start) to create tasks';
    // verified briefs without a job yet
    // verified research briefs and owner briefs (L2: written in the form or with npm run owner-brief), without a job yet
    const briefs = (s.briefs || []).filter((b) => (b.status === 'verified' || b.status === 'owner') && !b.jobId), cur = state.pickBrief || briefSel.value;
    briefSel.innerHTML = briefs.length ? briefs.map((b) => '<option value="' + esc(b.file) + '">' + esc((b.status === 'owner' ? 'OWNER · ' : '') + (b.niche || b.id || b.file) + (b.product ? ' · ' + b.product : '')) + '</option>').join('') : '<option value="">no brief waiting</option>';
    if (briefs.some((b) => b.file === cur)) { briefSel.value = cur; state.pickBrief = null; }
    const F = s.ownerBriefForm || { products: [] }, curP = productSel.value;
    productSel.innerHTML = F.products.map((p) => '<option value="' + esc(p.key) + '">' + esc(p.key + ' · ' + p.files + ' files' + (p.floorUsd != null ? ' · floor USD ' + p.floorUsd.toFixed(2) : '')) + '</option>').join('');
    if (F.products.some((p) => p.key === curP)) productSel.value = curP;
    const used = (s.briefs || []).filter((b) => b.jobId).length;
    root.querySelector('#task-brief-note').textContent = briefs.length + ' brief' + (briefs.length === 1 ? '' : 's') + ' waiting' + (used ? ' · ' + used + ' already started' : '') + (s.jobLimit && s.jobLimit.maxRunning ? ' · at most ' + s.jobLimit.maxRunning + ' running' + (s.jobLimit.next.length ? ', ' + s.jobLimit.next.length + ' next' : '') : '');
    // QA-approved designs that can be re-listed
    const rr = (s.jobs || []).filter((j) => j.controls && j.controls.rerunListing), cur2 = rerunSel.value;
    rerunSel.innerHTML = rr.length ? rr.map((j) => '<option value="' + esc(j.id) + '">' + esc(j.title + ' · ' + (j.lane || jobStatusLabel[j.status] || j.status)) + '</option>').join('') : '<option value="">no QA-approved design to re-list</option>';
    if (rr.some((j) => j.id === cur2)) rerunSel.value = cur2;
    if (!briefs.length) root.querySelector('[data-go="brief"]').disabled = true;
    if (!F.products.length) root.querySelector('[data-go="owner-brief"]').disabled = true;
    if (!rr.length) root.querySelector('[data-go="rerun"]').disabled = true;
  }

  // ---- the list
  root.querySelectorAll('.scope .chip').forEach((b) => b.addEventListener('click', () => { state.scope = b.dataset.scope; root.querySelectorAll('.scope .chip').forEach((x) => x.classList.toggle('chip-on', x === b)); render(); }));
  sel.addEventListener('change', () => { state.dept = sel.value || null; render(); });

  function setSnapshot(snap) {
    state.snap = snap;
    const cur = sel.value;
    sel.innerHTML = snap.departments.map((d) => '<option value="' + esc(d.key) + '">' + esc(d.name) + '</option>').join('');
    if (cur && snap.departments.some((d) => d.key === cur)) sel.value = cur; state.dept = sel.value || null;
    renderBox(); render();
  }
  function setDept(key) { if (state.snap && state.snap.departments.some((d) => d.key === key)) { sel.value = key; state.dept = key; render(); } }
  const scoped = () => { const s = state.snap; return state.scope === 'dept' && state.dept ? s.jobs.filter((j) => j.dept === state.dept) : s.jobs; };
  function counts() { const base = scoped(); return Object.fromEntries(FILTERS.map(([k]) => [k, base.filter((j) => matchesFilter(j, k)).length])); }
  function render() {
    if (!state.snap) return;
    const c = counts();
    // the Legacy and Archived chips only where there is something under them (the legacy view has neither)
    const shown = FILTERS.filter(([k]) => !SIDE[k] || c[k] > 0 || state.filter === k);
    filtersEl.innerHTML = shown.map(([k, l]) => '<button class="chip ' + (state.filter === k ? 'chip-on' : '') + (c[k] === 0 && k !== 'all' && k !== 'active' ? ' chip-zero' : '') + (k === 'active' ? ' chip-active' : '') + (SIDE[k] ? ' chip-side' : '') + '" data-f="' + k + '">' + l + '<b>' + c[k] + '</b></button>').join('');
    filtersEl.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => { state.filter = b.dataset.f; render(); }));
    const jobs = scoped().filter((j) => matchesFilter(j, state.filter));
    list.innerHTML = jobs.length ? jobs.map((j) => {
      const active = j.progress != null && !j.next;
      const left = active ? '<div class="pct">' + j.progress + '%</div>' : j.next ? '<div class="pct"><span class="pill pill-next" title="' + esc(j.statusReason || '') + '">next</span></div>' : '<div class="pct">' + statusPill(j) + '</div>';
      // L2: a running job's agent and its spend against the job cap, in place
      const ls = j.liveStatus && j.liveStatus.running ? '<div class="reason live-line">' + esc((j.liveStatus.agent || j.liveStatus.stage || '') + ' · USD ' + Number(j.liveStatus.spendUsd || 0).toFixed(4) + ' of ' + Number(j.liveStatus.capUsd || 0).toFixed(2)) + '</div>' : '';
      const reason = (j.lane || j.flag === 'error' || j.waitingFor || j.next || j.state === 'archived') && j.statusReason ? '<div class="reason" title="' + esc(j.statusReason) + '">' + esc(j.statusReason) + '</div>' : '';
      const warn = j.warnings && j.warnings.length ? '<span class="warn-dot" title="' + esc(j.warnings.join('\n')) + '">⚠</span>' : '';
      return '<div class="task st-' + j.status + (j.lane ? ' lane-' + j.lane : '') + '" data-id="' + esc(j.id) + '">'
        + left
        + '<div class="body"><div class="title-row"><span class="title" title="' + esc(j.title + '\n' + j.id + (j.niche ? '\n' + j.niche : '')) + '">' + esc(j.title) + '</span>' + warn + (j.flag === 'error' ? '<span class="tag tag-err">error</span>' : '') + synthTag(j) + '</div>'
        + '<div class="meta" title="' + esc(meta(j) + ' · ' + (jobStatusLabel[j.status] || j.status)) + '">' + esc(meta(j)) + '</div>' + ls + reason + '</div>'
        + '<div class="elapsed" title="elapsed since the job started">' + (j.elapsedMs != null ? duration(j.elapsedMs) : '—') + '</div>'
        + (active ? '<div class="bar"><i style="width:' + j.progress + '%"></i></div>' : '') + '</div>';
    }).join('') : '<div class="muted" style="padding:10px">No tasks match this filter.</div>';
    list.querySelectorAll('.task').forEach((el) => el.addEventListener('click', () => onOpenJob(el.dataset.id)));
  }
  return { setSnapshot, setDept, render, setTab, setFilter: (f) => { state.filter = f; render(); } };
}
