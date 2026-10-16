// scene/layout.js — the office floor plan (Redesign R1). Pure data, no Three.js, so it can be unit-tested in Node.
// One floor slab seen from the isometric camera (which looks from +x/+z): three department rooms and a lounge sit in the
// four corners round a central atrium with the memory core; a small server closet sits at the back between the two back
// rooms. Every room is a cutaway: two back walls (on its -x and -z sides), an open front, no ceiling. Rooms in the same
// column share a width and rooms in the same row share a depth, so the outer back walls run in one line along the slab.
// Idle agents walk desk -> lounge seat along precomputed waypoint paths (no pathfinding, no physics): inside the room
// to its exit, round a ring of points about the core, then into the lounge through one of its two gaps.

export const DESK_DX = 3.8, DESK_DZ = 3.5;     // desk pitch (x across a row, z between rows)
export const FLOOR = 0.46;                       // floor height (top of the slab)
export const WALL_H = 2.7, WALL_T = 0.18;        // back-wall height and thickness
export const AZ = 3.4;                           // half-depth of the atrium between the back and front rows
export const RING_R = 3.3;                       // walking ring about the memory core
export const CORE_R = 2.5;                       // core plinth radius (the ring stays outside it)
export const SLOT_KINDS = ['research', 'design', 'office'];   // room styles; any other key is furnished as an office
const SLOTS = ['back', 'right', 'left'];         // department order from the server -> corner (the lounge takes the front)
const PAD = {                                     // room padding round the desk block: left (-x wall), back (-z wall), right, front
  research: { left: 3.4, back: 2.4, right: 1.6, front: 2.8 },   // left: the reading nook
  design: { left: 2.2, back: 2.4, right: 1.6, front: 2.8 },
  office: { left: 2.0, back: 2.4, right: 1.6, front: 2.8 }
};
export const LOUNGE = { w: 7.6, d: 7.6 };
const CLOSET = { pitch: 0.86, margin: 0.6, d: 3.0, gapLeft: 1.0, gapRight: 2.8 };   // gapRight clears the wall shadow of the right room

const kindOf = (key) => (SLOT_KINDS.includes(key) ? key : 'office');

// departments: [{ key, agents: [agentId, ...] }] (desk order); services: [{ id }]
export function computeLayout(departments, services = []) {
  const depts = departments.slice(0, 3);             // three corners; extra departments are not drawn (flagged in the result)
  const rooms = depts.map((d, i) => {
    const kind = kindOf(d.key), n = d.agents.length, cols = Math.min(2, Math.max(1, n)), rows = Math.max(1, Math.ceil(n / cols)), p = PAD[kind];
    return { key: d.key, kind, slot: SLOTS[i], agents: d.agents.slice(), cols, rows, pad: p,
      w: p.left + 2.1 + (cols - 1) * DESK_DX + p.right, d: p.back + (rows - 1) * DESK_DZ + p.front };
  });
  const bySlot = (s) => rooms.find((r) => r.slot === s);
  const back = bySlot('back'), right = bySlot('right'), left = bySlot('left');
  const closetW = Math.max(3.2, services.length * CLOSET.pitch + 2 * CLOSET.margin);
  // shared column widths and row depths
  const leftW = Math.max(back ? back.w : 0, left ? left.w : 0, 8);
  const rightW = Math.max(right ? right.w : 0, LOUNGE.w);
  const backD = Math.max(back ? back.d : 0, right ? right.d : 0, CLOSET.d + 1.6, 5);
  const frontD = Math.max(left ? left.d : 0, LOUNGE.d);
  // x: [left column][gap][closet][gap][right column]; z: [back row][atrium][front row]
  const xL1 = 0, xL0 = xL1 - leftW;
  const closet = { x0: xL1 + CLOSET.gapLeft, d: CLOSET.d };
  closet.x1 = closet.x0 + closetW;
  const xR0 = closet.x1 + CLOSET.gapRight, xR1 = xR0 + rightW;
  const zB1 = -AZ, zB0 = zB1 - backD, zF0 = AZ, zF1 = zF0 + frontD;
  const coreX = (xL1 + xR0) / 2;
  const sx = -coreX;                                   // shift so the core sits at the origin
  const rect = (x0, x1, z0, z1) => ({ x0: x0 + sx, x1: x1 + sx, z0, z1, cx: (x0 + x1) / 2 + sx, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 });
  const place = { back: rect(xL0, xL1, zB0, zB1), right: rect(xR0, xR1, zB0, zB1), left: rect(xL0, xL1, zF0, zF1) };
  for (const r of rooms) Object.assign(r, place[r.slot], { exit: r.slot === 'left' ? '+x' : '+z' });
  Object.assign(closet, rect(closet.x0, closet.x1, zB0, zB0 + CLOSET.d));
  const lounge = rect(xR0, xR1, zF0, zF1);
  const base = rect(xL0, xR1, zB0, zF1);
  const core = { x: 0, z: 0 };
  const atrium = { x0: xL1 + sx, x1: xR0 + sx, z0: -AZ, z1: AZ };

  // desks: rows from the back wall, columns from the left wall; the first desk of each row is L-shaped
  for (const r of rooms) {
    r.desks = r.agents.map((id, i) => {
      const col = i % r.cols, row = Math.floor(i / r.cols);
      const x = r.x0 + r.pad.left + 1.05 + col * DESK_DX, z = r.z0 + r.pad.back + row * DESK_DZ;
      return { agentId: id, x, z, col, row, lshape: col === 0, chair: { x, z: z + 0.98 }, lane: { x, z: z + 1.7 } };
    });
    // one rug per desk cluster (a row of desks)
    r.clusters = [];
    for (let row = 0; row < r.rows; row++) {
      const ds = r.desks.filter((d) => d.row === row); if (!ds.length) continue;
      r.clusters.push({ x0: Math.min(...ds.map((d) => d.x)) - 1.55, x1: Math.max(...ds.map((d) => d.x)) + 1.55, z0: ds[0].z - 0.95, z1: ds[0].z + 1.55 });
    }
    r.aisleX = r.cols > 1 ? (r.desks[0].x + r.desks[1].x) / 2 : r.x0 + r.pad.left - 0.5;
    r.corner = { x: r.x0 + WALL_T + 0.55, z: r.z0 + WALL_T + 0.55 };   // card anchor: the back corner, on the wall top
  }

  // services: one cabinet per service against the closet's back wall
  closet.cabinets = services.map((s, i) => ({ id: s.id, x: closet.x0 + CLOSET.margin + CLOSET.pitch / 2 + i * CLOSET.pitch, z: closet.z0 + WALL_T + 0.45 }));

  // lounge: an L of two three-seat sofas on its back sides (facing the camera), two armchairs at the front, a coffee table
  // in the middle; two gaps (gates) at its left and right corners. yaw: 0 faces -z, PI faces +z, -PI/2 faces +x, PI/2 faces -x.
  const lc = { x: lounge.cx, z: lounge.cz }, L = (lx, lz) => ({ x: lc.x + lx, z: lc.z + lz });
  lounge.furniture = {
    sofaA: { ...L(0.3, -2.55), len: 3.3, yaw: Math.PI },          // along the back (-z) side, facing +z
    sofaB: { ...L(-2.55, 0.3), len: 3.3, yaw: -Math.PI / 2 },     // along the left (-x) side, facing +x
    chair1: { ...L(2.75, 0.55), yaw: Math.PI / 2 },               // front right, facing -x
    chair2: { ...L(0.55, 2.75), yaw: 0 },                         // front left, facing -z
    table: { ...L(0.35, 0.35), w: 1.5, d: 1.1 },
    lamp: L(-2.75, -2.75), plants: [L(3.25, 3.25), L(-3.3, 1.9)], rug: { x0: lc.x - 3.4, x1: lc.x + 3.4, z0: lc.z - 3.4, z1: lc.z + 3.4 }
  };
  const gates = { right: { at: L(3.05, -1.45), out: { x: lc.x + 3.05, z: lounge.z0 - 0.7 } }, left: { at: L(-1.45, 3.05), out: { x: lounge.x0 - 0.7, z: lc.z + 3.05 } } };
  const seats = [];
  for (const lx of [-0.8, 0.3, 1.4]) seats.push({ ...L(lx, -2.45), yaw: Math.PI, approach: L(lx, -1.55), gate: 'right' });
  for (const lz of [-0.8, 0.3, 1.4]) seats.push({ ...L(-2.45, lz), yaw: -Math.PI / 2, approach: L(-1.55, lz), gate: 'left' });
  seats.push({ ...L(2.65, 0.55), yaw: Math.PI / 2, approach: L(1.85, 0.55), gate: 'right' });
  seats.push({ ...L(0.55, 2.65), yaw: 0, approach: L(0.55, 1.85), gate: 'left' });
  lounge.seats = seats; lounge.gates = gates;

  // the walking ring about the core
  const RING_N = 16, ring = Array.from({ length: RING_N }, (_, i) => ({ x: Math.cos((i / RING_N) * Math.PI * 2) * RING_R, z: Math.sin((i / RING_N) * Math.PI * 2) * RING_R }));
  const nearest = (p) => ring.reduce((b, q, i) => (dist(p, q) < dist(p, ring[b]) ? i : b), 0);
  function ringWalk(i, j) {
    const out = [ring[i]]; if (i === j) return out;
    const fwd = (j - i + RING_N) % RING_N, step = fwd <= RING_N / 2 ? 1 : -1;
    for (let k = i; k !== j;) { k = (k + step + RING_N) % RING_N; out.push(ring[k]); }
    return out;
  }

  // paths: agent k (department order, then desk order) gets lounge seat k; agents beyond the seat count stay at their desk
  const paths = {};
  let k = 0;
  for (const r of rooms) for (const d of r.desks) {
    const seatIx = k < seats.length ? k : null; k++;
    if (seatIx == null) { paths[d.agentId] = { seat: null, toLounge: null }; continue; }
    const s = seats[seatIx], g = gates[s.gate];
    const pts = [d.chair, d.lane];
    if (r.exit === '+z') {
      const front = d.row === r.rows - 1;
      if (!front) pts.push({ x: r.aisleX, z: d.lane.z });
      const ex = front ? d.x : r.aisleX;
      pts.push({ x: ex, z: r.z1 + 0.8 });
    } else pts.push({ x: r.x1 + 0.8, z: d.lane.z });
    const exit = pts[pts.length - 1];
    pts.push(...ringWalk(nearest(exit), nearest(g.out)));
    pts.push(g.out, g.at, s.approach, { x: s.x, z: s.z });
    paths[d.agentId] = { seat: seatIx, toLounge: dedupe(pts) };
  }

  // plants (kept here so the path test can check the walkers keep clear of them): every room has two
  const plants = [];
  for (const r of rooms) {
    if (r.kind === 'research') plants.push({ x: r.x1 - 0.7, z: r.z1 - 0.7, kind: 'tall' }, { x: r.x0 + 0.75, z: r.z1 - 0.7, kind: 'tall' });
    else if (r.kind === 'design') plants.push({ x: r.x1 - 0.7, z: r.z0 + 0.95, kind: 'tall' }, { x: r.x0 + 0.75, z: r.z1 - 0.7, kind: 'small' });
    else plants.push({ x: r.x0 + 0.75, z: r.z1 - 0.7, kind: 'tall' }, { x: r.x1 - 0.7, z: r.z0 + 0.95, kind: 'small' });
  }
  for (const p of lounge.furniture.plants) plants.push({ ...p, kind: 'tall' });
  plants.push({ x: base.x0 + 0.7, z: -1.9, kind: 'tall' }, { x: base.x0 + 0.7, z: 1.9, kind: 'small' }, { x: closet.x1 + 0.55, z: closet.z1 + 0.35, kind: 'tall' }, { x: -0.6, z: base.z1 - 0.75, kind: 'tall' });

  // walls: { axis: 'x' (a wall in the plane x = at, running along z) | 'z', at, from, to, h, owner }. Each room has two
  // back walls; the atrium's outer edge is walled too (behind the closet and between the two left-hand rooms), so the
  // back of the slab reads as one building. The closet has a full back wall and a low partition on its left.
  const walls = [];
  for (const r of rooms) walls.push({ axis: 'x', at: r.x0, from: r.z0, to: r.z1, h: WALL_H, owner: r.key }, { axis: 'z', at: r.z0, from: r.x0, to: r.x1, h: WALL_H, owner: r.key });
  const backRoom = rooms.find((r) => r.slot === 'back'), rightRoom = rooms.find((r) => r.slot === 'right');
  walls.push({ axis: 'z', at: base.z0, from: backRoom ? backRoom.x1 : base.x0, to: rightRoom ? rightRoom.x0 : base.x1, h: WALL_H, owner: 'atrium' });
  walls.push({ axis: 'x', at: base.x0, from: backRoom ? backRoom.z1 : base.z0, to: AZ, h: WALL_H, owner: 'atrium' });
  walls.push({ axis: 'x', at: closet.x0, from: closet.z0, to: closet.z1, h: 1.1, owner: 'closet' });

  return { rooms, closet, lounge, base, core, atrium, ring, paths, walls, plants, dropped: departments.slice(3).map((d) => d.key) };
}

export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function dedupe(pts) { const out = []; for (const p of pts) if (!out.length || dist(out[out.length - 1], p) > 1e-6) out.push({ x: p.x, z: p.z }); return out; }
export function pathLength(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]); return s; }
// a point at distance s along a polyline, with the heading of that segment (yaw: 0 faces -z)
export function pointAt(pts, s) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], l = dist(a, b);
    if (s <= l || i === pts.length - 1) { const t = l ? Math.min(1, Math.max(0, s / l)) : 1; return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, yaw: Math.atan2(-(b.x - a.x), -(b.z - a.z)) }; }
    s -= l;
  }
  const p = pts[pts.length - 1]; return { x: p.x, z: p.z, yaw: 0 };
}
