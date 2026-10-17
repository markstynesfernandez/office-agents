// ui/sidepanel.js — the slide-in panel for a desk (agent: role, model, recent jobs, outputs, costs, latest design) or a
// job. Model, provider and role come from the roster; the system prompt is never sent to the page, and a prompt-like
// role is shown as a short label (ui/role.js; R2).
import { esc, money, price, when, duration, statusLabel, jobStatusLabel, statusPill, synthTag, legacyTag } from './format.js';
import { PALETTE } from '../config/palette.js';
import { roleLabel } from './role.js';

export function createSidePanel({ root, onOpenJob, onOpenAgent, onClose = () => {}, getNow = () => Date.now() }) {
  const body = root.querySelector('#sidepanel-body');
  let current = null;
  function close() { root.classList.add('hidden'); current = null; onClose(); }
  function open(html) { body.innerHTML = html; root.classList.remove('hidden'); body.querySelector('.close')?.addEventListener('click', close); body.querySelectorAll('[data-job]').forEach((el) => el.addEventListener('click', () => onOpenJob(el.dataset.job))); body.querySelectorAll('[data-agent]').forEach((el) => el.addEventListener('click', () => onOpenAgent(el.dataset.agent))); root.scrollTop = 0; }
  const dot = (status) => '<i style="background:' + (PALETTE.status[status] || '#999') + '"></i>';
  const imgs = (list) => (list && list.length ? '<div class="design">' + list.slice(-2).map((im) => '<img src="' + esc(im.url) + '" alt="' + esc(im.file) + '" title="' + esc(im.file) + '">').join('') + '</div>' : '');
  const warnBox = (list) => (list && list.length ? '<div class="warnbox">' + list.map((w) => '<div>⚠ ' + esc(w) + '</div>').join('') + '</div>' : '');
  // a legacy job: where each part came from in the legacy station, imported as it was (read only)
  const legacyBox = (j, now) => (j.legacy ? '<div class="legbox"><b>Legacy record</b> · imported ' + esc(when(Date.parse(j.legacy.importedAt), now)) + ', read only' + Object.entries(j.legacy.sources || {}).map(([k, v]) => '<br><span class="m">' + esc(k) + '</span> ' + esc(v)).join('') + (j.legacy.trackerStatus ? '<br><span class="m">tracker</span> ' + esc(j.legacy.trackerStatus) : '') + '<br><span class="muted">' + j.legacy.runs + ' legacy run' + (j.legacy.runs === 1 ? '' : 's') + ' attributed · data/' + esc(j.folder) + '</span></div>' : '');
  const synthBox = (o) => (o && o.synthetic ? '<div class="synthbox"><b>synthetic test state</b> · ' + esc(o.syntheticWhat || '') + '<br><span class="muted">fixtures/synthetic/overlay.json, not real data</span></div>' : '');

  async function showAgent(id) {
    current = { kind: 'agent', id };
    const r = await fetch('/api/office/agents/' + encodeURIComponent(id)); if (!r.ok) return;
    const a = await r.json(); const now = getNow();
    const jobsHtml = (a.jobs || []).length ? a.jobs.map((j) => '<div class="row" data-job="' + esc(j.id) + '" style="cursor:pointer"><span class="ell"><b title="' + esc(j.title) + '">' + esc(j.title) + '</b>' + synthTag(j) + '<br><span class="m">' + esc(j.id) + '</span></span><span class="m">' + (j.progress != null ? j.progress + '%' : statusPill(j)) + '<br>' + money(j.costUsd) + '</span></div>').join('') : '<div class="muted">No jobs recorded for this agent.</div>';
    const runsHtml = (a.runs || []).length ? a.runs.map((r) => '<div class="row"><span class="ell" title="' + esc(r.title) + '">' + esc(r.title) + (r.failureCode ? ' <span class="tag tag-err">' + esc(r.failureCode) + '</span>' : r.reason !== 'done' ? ' <span class="tag">' + esc(r.reason) + '</span>' : '') + synthTag(r) + '</span><span class="m">' + esc(when(r.at, now)) + ' · ' + money(r.usd) + '</span></div>').join('') : '<div class="muted">No finished runs in runs.jsonl.</div>';
    const overseer = a.overseer ? '<h4>Daily report</h4>' + (a.overseer.report ? '<div class="quote">' + esc(a.overseer.report.text) + '</div><div class="srcnote">overseer/reports/' + esc(a.overseer.report.file) + ' · ' + esc(when(a.overseer.report.at, now)) + '</div>' : '<div class="quote">No report yet</div><div class="srcnote">overseer/reports/ is empty</div>') : '';
    open('<div class="sp">'
      + '<div class="sp-head"><div class="ell"><h2>' + esc(a.name) + synthTag(a) + '</h2><div class="sp-sub">' + esc(a.deptName || '') + (a.gear.length ? ' · gear: ' + esc(a.gear.join(', ')) : '') + '</div></div><span class="close btn-icon" title="close (Esc)">×</span></div>'
      + '<div class="sp-status">' + dot(a.status) + esc(a.statusText || statusLabel[a.status]) + '</div>'
      + synthBox(a) + warnBox(a.warnings)
      + '<dl class="kv"><dt>role</dt><dd class="role" title="' + esc(roleLabel(a.role, { dept: a.deptName, name: a.name })) + '">' + esc(roleLabel(a.role, { dept: a.deptName, name: a.name }) || '—') + '</dd>'
      + '<dt>model</dt><dd>' + esc(a.model || '—') + ' <span class="muted">(' + esc(a.modelSource) + ')</span></dd><dt>provider</dt><dd>' + esc(a.provider || '—') + (a.tier ? ' <span class="muted">· tier ' + esc(a.tier) + ' in station.config.json</span>' : '') + '</dd>'
      + '<dt>current job</dt><dd>' + (a.currentJob ? '<a data-job="' + esc(a.currentJob.id) + '" class="lnk">' + esc(a.currentJob.id) + '</a> · ' + esc(a.currentJob.stageLabel) + (a.currentJob.pass ? ' pass ' + a.currentJob.pass : '') : '—') + '</dd>'
      + '<dt>today</dt><dd>' + money(a.spendToday.usd) + ' · ' + a.spendToday.runs + ' runs <span class="muted">(' + esc(a.spendToday.label) + ', ledger)</span></dd>'
      + '<dt>last run</dt><dd>' + (a.lastRun ? esc(a.lastRun.reason) + ' · ' + esc(when(a.lastRun.at, now)) : '—') + '</dd>'
      + '<dt>runs on record</dt><dd>' + a.runsTotal + '</dd></dl>'
      + (a.lastOutput ? '<h4>Last output</h4><div class="quote">' + esc(a.lastOutput.text) + '</div><div class="srcnote">' + (a.lastOutput.jobId ? esc(a.lastOutput.jobId) + ' · ' : '') + esc(when(a.lastOutput.at, now)) + '</div>' : '')
      + (a.latestImage ? '<h4>Latest design</h4>' + imgs([a.latestImage]) + '<div class="srcnote">' + esc(a.latestImage.jobId) + ' / ' + esc(a.latestImage.file) + ' (thumbnail)</div>' : '')
      + overseer
      + '<h4>Recent jobs</h4>' + jobsHtml
      + '<h4>Recent runs</h4>' + runsHtml
      + '</div>');
  }

  async function showJob(id) {
    current = { kind: 'job', id };
    const r = await fetch('/api/office/jobs/' + encodeURIComponent(id)); if (!r.ok) return;
    const j = await r.json(); const now = getNow();
    const hops = j.hops.length ? j.hops.map((h) => '<div class="hop"><span class="i">' + (h.i + 1) + '</span><span><b data-agent="' + esc(h.agentId) + '" class="lnk">' + esc(h.agentName) + '</b> · ' + esc(h.stage || '') + (h.pass != null ? ' pass ' + h.pass : h.run ? ' · run ' + h.run : '') + (h.verdict ? ' · <span class="tag ' + (h.verdict === 'approved' ? 'tag-ok' : 'tag-warn') + '">' + esc(h.verdict) + '</span>' : '') + (h.live ? ' <span class="tag tag-ok">live</span>' : '') + '</span><span class="m">' + (h.live ? '…' : money(h.usd) + ' · ' + duration(h.ms)) + '</span>' + (h.output ? '<span class="o">' + esc(h.output) + '</span>' : '') + '</div>').join('') : '<div class="muted">No line hops recorded (not started on the line).</div>';
    const qa = (list, label) => (list && list.length ? '<h4>' + label + '</h4>' + list.map((p) => '<div class="row"><span>pass ' + p.pass + ' <span class="tag ' + (p.verdict === 'approved' ? 'tag-ok' : 'tag-warn') + '">' + esc(p.verdict || '?') + '</span><br><span class="muted" style="font-size:11px">' + esc((p.reasons || []).join(' · ')) + '</span></span></div>').join('') : '');
    const active = j.progress != null;
    open('<div class="sp">'
      + '<div class="sp-head"><div class="ell"><h2 class="ell" title="' + esc(j.title) + '">' + esc(j.title) + synthTag(j) + legacyTag(j) + '</h2><div class="sp-sub mono">' + esc(j.id) + '</div></div><span class="close btn-icon" title="close (Esc)">×</span></div>'
      + '<div class="sp-status">' + (active ? esc(j.stageLabel) + ' · ' + esc(jobStatusLabel[j.status] || j.status) + ' · ' + j.progress + '%' : statusPill(j) + ' <span class="muted">' + esc(j.stageLabel) + '</span>') + (j.flag === 'error' ? ' <span class="tag tag-err">error</span>' : '') + '</div>'
      + (j.statusReason ? '<div class="quote" style="margin-top:6px">' + esc(j.statusReason) + '</div>' : '')
      + (j.qaPassedGateFailed ? '<div class="srcnote">both QA stages approved; the deterministic package gate blocked it (tracker status_reason)</div>' : '')
      + synthBox(j) + warnBox(j.warnings) + legacyBox(j, now)
      + '<dl class="kv"><dt>agent</dt><dd>' + (j.agentId ? '<a data-agent="' + esc(j.agentId) + '" class="lnk">' + esc(j.agentName) + '</a>' : '—') + ' · ' + esc(j.dept || '—') + '</dd>'
      + '<dt>slogan</dt><dd>' + esc(j.slogan || '—') + '</dd><dt>cost</dt><dd>' + money(j.costUsd) + ' <span class="muted">(' + (j.costSource || (j.queue ? 'approval-queue cost' : j.hops.length ? 'line session total' : 'tracker')) + ')</span></dd>'
      + '<dt>started</dt><dd>' + esc(when(j.startedAt, now)) + '</dd><dt>stage changed</dt><dd>' + esc(when(j.stageChangedAt, now)) + '</dd>' + (j.elapsedMs != null ? '<dt>elapsed</dt><dd>' + duration(j.elapsedMs) + '</dd>' : '') + (j.endedAt ? '<dt>ended</dt><dd>' + esc(when(j.endedAt, now)) + '</dd>' : '')
      + (j.priceRange ? '<dt>brief price</dt><dd>' + price('USD ' + j.priceRange.min + (j.priceRange.max !== j.priceRange.min ? ' – ' + j.priceRange.max : '')) + '</dd>' : '')
      + (j.listing ? '<dt>listing</dt><dd>' + esc(j.listing.title) + ' · ' + j.listing.tags + ' tags · ' + price('EUR ' + (j.listing.priceEur ?? '—')) + '</dd>' : '')
      + (j.queue ? '<dt>approval</dt><dd>' + esc(j.queue.status) + ' · ' + esc(j.queue.folder) + (j.queue.files != null ? ' · ' + j.queue.files + ' files' : '') + '</dd>' : '')
      + (j.tracker ? '<dt>tracker</dt><dd>' + esc(j.tracker.status) + (j.tracker.etsy_listing_url ? ' · ' + esc(j.tracker.etsy_listing_url) : '') + '</dd>' : '')
      + '</dl>'
      + (j.images.length ? '<h4>Designs</h4>' + imgs(j.images) : '')
      + '<h4>Line hops</h4>' + hops
      + qa(j.qaDesign, 'QA design') + qa(j.qaListing, 'QA listing')
      + (j.files.length ? '<h4>Files (' + j.files.length + ')</h4><div class="files">' + j.files.slice(0, 30).map((f) => '<div title="' + esc(f) + '">' + esc(f) + '</div>').join('') + (j.files.length > 30 ? '<div>…</div>' : '') + '</div>' : '')
      + '</div>');
  }
  return { showAgent, showJob, close, isOpen: () => !root.classList.contains('hidden'), current: () => current };
}
