// ui/floors.js — B0 (owner, 21/10/2026): the Station is one building; each business is a floor, and the shared services (Finance,
// Compliance, OVERSEER) and the lounge are floor 0. Pure (tests/b0.test.mjs): what one floor of the engine snapshot shows, and every
// floor's totals for the whole-building view. A snapshot without a building (the legacy and fixtures views) is shown as it is.

export const floorsOf = (snap) => (snap && snap.building && Array.isArray(snap.building.floors) ? snap.building.floors : []);
// the floor to open: the remembered one if it still exists, else the first business floor, else floor 0
export function pickFloor(snap, want) {
  const fl = floorsOf(snap); if (!fl.length) return null;
  if (want != null && fl.some((f) => f.floor === Number(want))) return Number(want);
  const biz = fl.find((f) => !f.shared); return (biz || fl[0]).floor;
}

// one floor's view of the snapshot: its departments and agents (the 3D office and the labels), its jobs, routines and calendar entries
// (the task list, the board, the calendar), and its spend (the top bar); the services sit on the shared floor. floorView tells the
// office which floor it draws and whether the lounge is on it.
export function floorSnapshot(snap, floor) {
  const fl = floorsOf(snap).find((f) => f.floor === floor); if (!fl) return snap;
  const on = (x) => x && x.floor === floor;
  const jobs = (snap.jobs || []).filter(on), ids = new Set(jobs.map((j) => j.id));
  const routines = (snap.routines || []).filter(on), rids = new Set(routines.map((r) => r.id));
  const keep = (list) => (list || []).filter((id) => ids.has(id));
  const board = snap.board ? { columns: snap.board.columns.map((c) => ({ ...c, jobIds: keep(c.jobIds) })), lanes: Object.fromEntries(Object.entries(snap.board.lanes || {}).map(([k, v]) => [k, keep(v)])) } : snap.board;
  const biz = ((snap.spend && snap.spend.byBusiness) || []).find((b) => b.id === fl.id) || null;
  return {
    ...snap,
    departments: (snap.departments || []).filter(on),
    agents: (snap.agents || []).filter(on),
    services: fl.shared ? snap.services : [],
    jobs, board, routines,
    events: (snap.events || []).filter((e) => (e.jobId ? ids.has(e.jobId) : e.routineId ? rids.has(e.routineId) : true)),
    floorView: { floor: fl.floor, id: fl.id, name: fl.name, shared: !!fl.shared, lounge: !!fl.lounge, empty: !!fl.empty, spend: biz }
  };
}

// every floor's totals: jobs by state, routines on, agents, spend today and this month against the budget
export function buildingTotals(snap) {
  const byBiz = Object.fromEntries((((snap && snap.spend) || {}).byBusiness || []).map((b) => [b.id, b]));
  return floorsOf(snap).map((fl) => {
    const jobs = (snap.jobs || []).filter((j) => j.floor === fl.floor && j.kind !== 'legacy' && j.status !== 'archived');
    const n = (pred) => jobs.filter(pred).length, sp = byBiz[fl.id] || null;
    return {
      floor: fl.floor, id: fl.id, name: fl.name, shared: !!fl.shared, empty: !!fl.empty, lounge: !!fl.lounge,
      departments: (snap.departments || []).filter((d) => d.floor === fl.floor).map((d) => d.name),
      agents: (snap.agents || []).filter((a) => a.floor === fl.floor).length, lines: fl.lines || [],
      jobs: { running: n((j) => j.status === 'in_progress'), waiting: n((j) => j.status === 'backlog' || j.status === 'waiting'), blocked: n((j) => j.lane === 'blocked'), done: n((j) => j.status === 'done') },
      routinesOn: (snap.routines || []).filter((r) => r.floor === fl.floor && r.enabled).length,
      todayUsd: sp ? sp.todayUsd : 0, monthUsd: sp ? sp.monthUsd : 0, budgetUsd: sp ? sp.budgetUsd : null, month: sp ? sp.month : null
    };
  });
}
