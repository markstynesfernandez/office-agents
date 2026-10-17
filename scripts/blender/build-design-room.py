# build-design-room.py — R3 spike: the Design room, modelled, lit and baked in Blender (headless). Run it through
# scripts/build-design-room.mjs, which passes the room spec (layout.js, bakedRoomSpec) and the output folder:
#   blender -b --factory-startup --python scripts/blender/build-design-room.py -- --spec S --out DIR --textures DIR
# Everything is modelled here from the spec (no model files); the only inputs are the spec and five CC0 Poly Haven
# textures in assets-src/polyhaven/ (ASSETS.md). Seeded, so a rebuild gives the same room.
# Outputs (only into --out, checked): design-room.glb (two UV sets: UVMap for textures, LightMap for the bake; the
# LED strips and lamp bulbs are a separate unlit mesh), .build/lightmap-day.png and .build/lightmap-evening.png (8-bit,
# sRGB-encoded, scaled by 1/k; k in bake.json), .build/bake.json (scales, timings, device, LED strips, triangles).
# Coordinates: the room's own frame as in layout.js (x along the back wall, y up, z towards the open front), converted
# to Blender's z-up when vertices are written; the glTF exporter converts back to y-up, so the glb is in the same frame.
import bpy, sys, os, json, math, time, argparse, random
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--spec', required=True); ap.add_argument('--out', required=True); ap.add_argument('--textures', required=True)
ap.add_argument('--size', type=int, default=2048); ap.add_argument('--samples', type=int, default=1024)
A = ap.parse_args(argv)
OUT = os.path.realpath(A.out)
def out_path(name):
    p = os.path.realpath(os.path.join(OUT, name))
    if not p.startswith(OUT + os.sep): raise RuntimeError('refusing to write outside ' + OUT + ': ' + name)
    return p
def log(*a): print('[blender]', *a, flush=True)
T0 = time.perf_counter(); PHASES = {}
def phase(name, t): PHASES[name] = round(time.perf_counter() - t, 2); log(name, PHASES[name], 's')

S = json.load(open(A.spec, encoding='utf-8'))
W, D, FLOOR, WH, WT = S['w'], S['d'], S['floor'], S['wallH'], S['wallT']
PT = FLOOR + 0.02                                   # top of the wood floor (office.js PT)
DESK_Y = PT + 0.73                                  # desk top centre (office.js deskY)
RNG = random.Random(20261017)

# ---------------------------------------------------------------- colours, materials
def srgb(h): return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
def lin1(x): return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
def lin(h): return tuple(lin1(c) for c in srgb(h))
# textured materials: file, real-world tile size (scene units ~ metres), target average colour (None: as photographed)
TEX = {
    'oak':      ('oak_veneer_01_diff_1k.jpg', 1.2, None),           # slats, shelves, easel
    'walnut':   ('walnut_veneer_diff_1k.jpg', 1.6, None),           # desk tops, drawer fronts
    'floor':    ('wood_floor_diff_1k.jpg', 2.2, '#8a6446'),         # floor (a little deeper than the photo)
    'pad':      ('poly_wool_herringbone_diff_1k.jpg', 0.5, '#7a4a39'),   # fabric wall pads (muted rust)
    'chairfab': ('poly_wool_herringbone_diff_1k.jpg', 0.4, '#34353a'),   # chair seat and back
    'rug':      ('hessian_230_diff_1k.jpg', 0.45, '#b7a487'),       # textured rug (oatmeal)
}
MAT_ORDER = ['solid', 'leaf', 'oak', 'walnut', 'floor', 'pad', 'chairfab', 'rug']   # 'solid' and 'leaf' use vertex colours
C = {
    'wall': '#34373d', 'cap': '#222327', 'skirting': '#1d1e21', 'backing': '#141416', 'pedestal': '#2a2b2f', 'metal': '#1b1c1f',
    'handle': '#8d8a84', 'pot': '#38342f', 'potRim': '#4a443d', 'soil': '#2f261e', 'trunk': '#5f4a38', 'potSmall': '#c9b8a3',
    'lamp': '#1c1c1f', 'canvas': '#ece6da', 'label': '#ece6da', 'rugBorder': '#4a3b2c', 'caster': '#111113',
}
BINDERS = ['#1f3b5c', '#3a3a3c', '#8c2f2f', '#4a6a8a', '#e3ddd2', '#2f5d50', '#b5533c', '#d9b26f']
LEAVES = ['#36612f', '#2f5a2b', '#3e6d35', '#2b5126']

# ---------------------------------------------------------------- mesh builder (three.js-style frame)
def T(x=0, y=0, z=0, ry=0, rx=0, rz=0):         # translation * Ry * Rx * Rz (three.js Euler 'YXZ')
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(rz, 4, 'Z')
def to_bl(p): return (p[0], -p[2], p[1])        # three (x, y, z) -> Blender (x, -z, y)

class MB:
    def __init__(s): s.v = []; s.f = []; s.m = []; s.uv = []; s.col = []
    def face(s, pts, mat, col='#ffffff', uvoff=(0, 0)):
        pts = [Vector(p) for p in pts]
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if n.length < 1e-12: return
        n.normalize(); ax = max(range(3), key=lambda i: abs(n[i]))
        scale = TEX[mat][1] if mat in TEX else 1.0
        uvs = []
        for p in pts:   # planar UVs on the dominant axis, in tile units; the grain runs up walls and along x on floors
            u, v = (p.z, p.y) if ax == 0 else ((p.x, -p.z) if ax == 1 else (p.x, p.y))
            uvs.append((u / scale + uvoff[0], v / scale + uvoff[1]))
        base = len(s.v); s.v.extend(pts); s.f.append(list(range(base, base + len(pts)))); s.m.append(mat); s.uv.append(uvs)
        s.col.append(lin(col) if isinstance(col, str) else col)
    # an axis box centred at the local origin, transformed by M; skip: faces left out ('px','nx','py','ny','pz','nz')
    def box(s, w, h, d, M, mat, col='#ffffff', skip=(), uvoff=None):
        x, y, z = w / 2, h / 2, d / 2
        P = lambda a, b, c: tuple(M @ Vector((a, b, c)))
        faces = {'px': [(x, -y, z), (x, -y, -z), (x, y, -z), (x, y, z)], 'nx': [(-x, -y, -z), (-x, -y, z), (-x, y, z), (-x, y, -z)],
                 'py': [(-x, y, z), (x, y, z), (x, y, -z), (-x, y, -z)], 'ny': [(-x, -y, -z), (x, -y, -z), (x, -y, z), (-x, -y, z)],
                 'pz': [(-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)], 'nz': [(x, -y, -z), (-x, -y, -z), (-x, y, -z), (x, y, -z)]}
        off = uvoff if uvoff is not None else (RNG.random(), RNG.random())
        for k, q in faces.items():
            if k not in skip: s.face([P(*c) for c in q], mat, col, off)
    # a cylinder along local y, centred at the origin (r0 bottom, r1 top), n sides
    def cyl(s, r0, r1, h, n, M, mat, col='#ffffff', caps=(True, True)):
        P = lambda a, b, c: tuple(M @ Vector((a, b, c)))
        ring = lambda r, y: [(math.cos(2 * math.pi * i / n) * r, y, -math.sin(2 * math.pi * i / n) * r) for i in range(n)]
        lo, hi = ring(r0, -h / 2), ring(r1, h / 2)
        for i in range(n):
            j = (i + 1) % n; s.face([P(*lo[i]), P(*lo[j]), P(*hi[j]), P(*hi[i])], mat, col)
        if caps[1]: s.face([P(*p) for p in hi], mat, col)
        if caps[0]: s.face([P(*p) for p in reversed(lo)], mat, col)
    def sphere(s, r, M, mat, col, ws=8, hs=6):
        P = lambda a, b, c: tuple(M @ Vector((a, b, c)))
        pt = lambda i, j: (math.sin(math.pi * j / hs) * math.cos(2 * math.pi * i / ws) * r, math.cos(math.pi * j / hs) * r, -math.sin(math.pi * j / hs) * math.sin(2 * math.pi * i / ws) * r)
        for j in range(hs):
            for i in range(ws):
                q = [pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)]
                if j == 0: q = [q[0], q[1], q[2]]
                elif j == hs - 1: q = [q[0], q[1], q[3]]
                s.face([P(*p) for p in q], mat, col)
    # a pad: a back box and a chamfered front (the front face inset by c), for upholstered panels
    def pad(s, w, h, d, c, M, mat):
        P = lambda a, b, cc: tuple(M @ Vector((a, b, cc)))
        x, y = w / 2, h / 2; xi, yi = x - c, y - c; z0, z1 = 0.0, d
        b = [(-x, -y, z0), (x, -y, z0), (x, y, z0), (-x, y, z0)]; f = [(-xi, -yi, z1), (xi, -yi, z1), (xi, yi, z1), (-xi, yi, z1)]
        s.face([P(*p) for p in f], mat)
        for i in range(4):
            j = (i + 1) % 4; s.face([P(*b[i]), P(*b[j]), P(*f[j]), P(*f[i])], mat)

room, em, occ = MB(), MB(), MB()       # baked room / unlit LED strips and bulbs / bake-only occluders (real-time items)
LEDS = []                              # strips: {a, b, emit, kind} in the room frame (three.js axes)

# ---------------------------------------------------------------- the shell: floor, walls, caps, skirting
room.face([(0, PT, D), (W, PT, D), (W, PT, 0), (0, PT, 0)], 'floor', uvoff=(0.13, 0.41))
room.face([(0, FLOOR, D), (W, FLOOR, D), (W, PT, D), (0, PT, D)], 'solid', C['skirting'])          # floor edge (front)
for w in S['walls']:
    if w['axis'] == 'x':   # the left wall (plane x = at), inner face +x; its front end is open (a cut, in the cap colour)
        L, mid = w['to'] - w['from'], (w['from'] + w['to']) / 2
        room.box(WT, WH, L, T(w['at'] + WT / 2, FLOOR + WH / 2, mid), 'solid', C['wall'], skip=('nx', 'nz', 'ny', 'py', 'pz'))
        room.box(WT + 0.04, WH, 0.04, T(w['at'] + WT / 2, FLOOR + WH / 2, w['to'] - 0.02), 'solid', C['cap'], skip=('nx', 'ny', 'py', 'nz'))
        room.box(WT + 0.04, 0.05, L, T(w['at'] + WT / 2, FLOOR + WH + 0.025, mid), 'solid', C['cap'], skip=('nx', 'ny', 'nz'))
        room.box(0.03, 0.1, L - WT, T(w['at'] + WT + 0.015, PT + 0.05, mid + WT / 2), 'solid', C['skirting'], skip=('nx', 'ny', 'nz'))
    else:                  # the back wall (plane z = at), inner face +z; its right end is the slab edge (a cut)
        L, mid = w['to'] - w['from'], (w['from'] + w['to']) / 2
        room.box(L, WH, WT, T(mid, FLOOR + WH / 2, w['at'] + WT / 2), 'solid', C['wall'], skip=('nz', 'nx', 'ny', 'py', 'px'))
        room.box(0.04, WH, WT + 0.04, T(w['to'] - 0.02, FLOOR + WH / 2, w['at'] + WT / 2), 'solid', C['cap'], skip=('nz', 'ny', 'py', 'nx'))
        room.box(L, 0.05, WT + 0.04, T(mid, FLOOR + WH + 0.025, w['at'] + WT / 2), 'solid', C['cap'], skip=('nz', 'ny', 'nx'))
        room.box(L - WT, 0.1, 0.03, T(mid + WT / 2, PT + 0.05, w['at'] + WT + 0.015), 'solid', C['skirting'], skip=('nz', 'ny', 'nx'))

def led(a, b, emit, kind, thick=(0.014, 0.012)):
    """an LED strip from a to b (room frame), emitting along emit; drawn as a thin unlit box"""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length; mid = (a + b) / 2
    ry = math.atan2(-d.z, d.x) if abs(d.x) + abs(d.z) > 1e-6 else 0
    em.box(L, thick[0], thick[1], T(mid.x, mid.y, mid.z, ry), 'led', '#ffffff', skip=('ny',))
    LEDS.append({'a': [round(v, 4) for v in a], 'b': [round(v, 4) for v in b], 'emit': [round(v, 4) for v in Vector(emit).normalized()], 'kind': kind})

# floor-edge LED: a cove strip where the floor meets the back and left walls (washes up the wall)
zb, xl = WT + 0.045, WT + 0.045
led((WT + 0.05, PT + 0.012, zb), (W - 0.05, PT + 0.012, zb), (0, 1, -0.35), 'cove')
led((xl, PT + 0.012, WT + 0.05), (xl, PT + 0.012, D - 0.05), (-0.35, 1, 0), 'cove')

# ---------------------------------------------------------------- back wall: wood slat panel, shelves with binders
desk_xs = [d['x'] for d in S['desks']]
px0, px1 = min(desk_xs) - 1.1, max(desk_xs) + 1.3            # the slat panel spans the desk block
zf = WT                                                      # inner face of the back wall
room.box(px1 - px0, 2.42, 0.02, T((px0 + px1) / 2, PT + 1.25, zf + 0.01), 'solid', C['backing'], skip=('nz', 'ny'))
SLAT, GAPW = 0.046, 0.024
n_slats = int((px1 - px0 - 0.02) / (SLAT + GAPW))
for i in range(n_slats):
    x = px0 + 0.035 + i * (SLAT + GAPW) + SLAT / 2
    room.box(SLAT, 2.42, 0.03, T(x, PT + 1.25, zf + 0.035), 'oak', skip=('nz', 'ny'), uvoff=(RNG.random() * 4, RNG.random() * 4))

def binders(x0, x1, y, depth_z, seed):
    r = random.Random(seed); x = x0
    while x < x1 - 0.1:
        roll = r.random()
        if roll < 0.12: x += 0.1 + r.random() * 0.15; continue
        if roll < 0.22 and x1 - x > 0.34:                  # a flat stack
            for k in range(2 + int(r.random() * 3)):
                room.box(0.28 - k * 0.015, 0.045, 0.22, T(x + 0.15, y + 0.0225 + k * 0.047, depth_z), 'solid', r.choice(BINDERS), skip=('ny',))
            x += 0.34; continue
        if roll < 0.3:                                        # a small vase
            room.cyl(0.05, 0.045, 0.16, 10, T(x + 0.07, y + 0.08, depth_z), 'solid', '#c2b8a8', caps=(False, True)); x += 0.16; continue
        c = r.choice(BINDERS)
        for k in range(2 + int(r.random() * 4)):              # a run of binders, spines out, with blank label patches
            if x > x1 - 0.1: break
            h = 0.3 if r.random() < 0.7 else 0.24
            room.box(0.072, h, 0.24, T(x + 0.036, y + h / 2, depth_z), 'solid', c, skip=('ny', 'nz'))
            room.box(0.045, 0.06, 0.004, T(x + 0.036, y + h * 0.3, depth_z + 0.122), 'solid', C['label'], skip=('nz',))
            x += 0.076
        x += 0.02

def shelf(x0, x1, y, z_wall, seed, depth=0.27):
    zc = z_wall + depth / 2
    room.box(x1 - x0, 0.045, depth, T((x0 + x1) / 2, y, zc), 'oak', skip=('nz',))
    led((x0 + 0.05, y - 0.03, z_wall + depth - 0.035), (x1 - 0.05, y - 0.03, z_wall + depth - 0.035), (0, -1, -0.45), 'shelf')
    binders(x0 + 0.06, x1 - 0.06, y + 0.0225, zc - 0.005, seed)

slat_front = zf + 0.05
shelf(min(desk_xs) - 0.55, max(desk_xs) + 0.75, PT + 1.93, slat_front, 11)
shelf(WT + 0.32, px0 - 0.25, PT + 1.42, WT, 13, depth=0.26)
shelf(WT + 0.32, px0 - 0.25, PT + 1.92, WT, 17, depth=0.26)

# ---------------------------------------------------------------- left wall: fabric pads
for k, z in enumerate([1.05, 1.68, 2.31, 2.94, 3.57]):
    for j, y in enumerate([PT + 1.12, PT + 1.75]):
        if z + 0.3 > D - 0.6: continue
        room.pad(0.6, 0.6, 0.05, 0.025, T(WT, y, z, math.pi / 2), 'pad')

# ---------------------------------------------------------------- rug under the desk block
rx0, rx1 = min(desk_xs) - 1.55, max(desk_xs) + 1.55
rz0, rz1 = S['desks'][0]['z'] - 0.95, S['desks'][0]['z'] + 1.55
room.box(rx1 - rx0, 0.012, rz1 - rz0, T((rx0 + rx1) / 2, PT + 0.006, (rz0 + rz1) / 2), 'solid', C['rugBorder'], skip=('ny',))
room.box(rx1 - rx0 - 0.2, 0.01, rz1 - rz0 - 0.2, T((rx0 + rx1) / 2, PT + 0.012 + 0.005, (rz0 + rz1) / 2), 'rug', skip=('ny',), uvoff=(0.3, 0.7))

# ---------------------------------------------------------------- desks (positions from the spec), drawers, lamps, chairs
def drawers(M, w, h, d, face):          # a drawer pedestal; face: the local side the drawers open to ('pz' or 'nx')
    room.box(w, h, d, M, 'solid', C['pedestal'], skip=('ny',))
    n = 3; gap = 0.012; fh = (h - 0.04 - gap * (n + 1)) / n
    for i in range(n):
        y = -h / 2 + 0.02 + gap + fh / 2 + i * (fh + gap)
        if face == 'pz':
            room.box(w - 0.03, fh, 0.016, M @ T(0, y, d / 2 + 0.008), 'walnut', skip=('nz',))
            room.box(0.16, 0.014, 0.022, M @ T(0, y + fh * 0.28, d / 2 + 0.027), 'solid', C['handle'], skip=('nz',))
        else:
            room.box(0.016, fh, d - 0.03, M @ T(-w / 2 - 0.008, y, 0), 'walnut', skip=('px',))
            room.box(0.022, 0.014, 0.16, M @ T(-w / 2 - 0.027, y + fh * 0.28, 0), 'solid', C['handle'], skip=('px',))

def desk_lamp(x, z):
    M = T(x - 0.82, DESK_Y + 0.03, z - 0.12, -0.5)
    room.cyl(0.095, 0.1, 0.025, 16, M @ T(0, 0.0125, 0), 'solid', C['lamp'], caps=(False, True))
    room.cyl(0.012, 0.012, 0.42, 6, M @ T(0, 0.21, 0.07, 0, 0.35), 'solid', C['lamp'], caps=(False, False))
    room.cyl(0.012, 0.012, 0.32, 6, M @ T(0, 0.46, 0.0, 0, -1.0), 'solid', C['lamp'], caps=(False, False))
    room.cyl(0.085, 0.03, 0.14, 14, M @ T(0, 0.5, -0.17, 0, 0.5), 'solid', C['lamp'], caps=(False, True))
    bulb = M @ T(0, 0.45, -0.19)
    em.sphere(0.034, bulb, 'led', '#ffffff')
    return bulb.to_translation()

def chair(x, z):                        # an ergonomic task chair facing the desk (local -z); seat top at PT + 0.49
    M = T(x, PT, z)
    for i in range(5):
        R = M @ T(0, 0, 0, i * 2 * math.pi / 5)
        room.box(0.05, 0.035, 0.31, R @ T(0, 0.075, 0.155), 'solid', C['metal'], skip=('ny',))
        room.sphere(0.03, R @ T(0, 0.03, 0.3), 'solid', C['caster'], 6, 4)
    room.cyl(0.05, 0.05, 0.06, 10, M @ T(0, 0.08, 0), 'solid', C['metal'], caps=(False, True))
    room.cyl(0.028, 0.028, 0.3, 8, M @ T(0, 0.25, 0), 'solid', '#8f8f93', caps=(False, False))
    room.box(0.22, 0.05, 0.22, M @ T(0, 0.405, 0.02), 'solid', C['metal'], skip=('py',))
    room.box(0.52, 0.07, 0.5, M @ T(0, 0.455, 0), 'chairfab')
    room.box(0.06, 0.46, 0.04, M @ T(0, 0.62, 0.29, 0, 0.12), 'solid', C['metal'])                      # spine
    B = M @ T(0, 0.93, 0.31, 0, 0.15)                                                               # back, leaning back
    room.box(0.47, 0.6, 0.03, B, 'chairfab')
    for sx in (-1, 1): room.box(0.03, 0.62, 0.045, B @ T(sx * 0.245, 0, 0), 'solid', C['metal'])
    room.box(0.5, 0.03, 0.045, B @ T(0, 0.31, 0), 'solid', C['metal']); room.box(0.5, 0.03, 0.045, B @ T(0, -0.31, 0), 'solid', C['metal'])
    room.box(0.4, 0.11, 0.04, B @ T(0, -0.16, -0.03), 'chairfab')                                   # lumbar pad
    room.box(0.3, 0.12, 0.05, M @ T(0, 1.36, 0.36, 0, 0.15), 'chairfab')                            # headrest
    room.box(0.03, 0.14, 0.03, M @ T(0, 1.25, 0.35, 0, 0.15), 'solid', C['metal'])
    for sx in (-1, 1):
        room.box(0.035, 0.2, 0.035, M @ T(sx * 0.27, 0.56, 0.06), 'solid', C['metal'])
        room.box(0.075, 0.03, 0.27, M @ T(sx * 0.27, 0.675, 0.03), 'solid', '#2a2a2d')

bulbs = []
for dk in S['desks']:
    x, z = dk['x'], dk['z']
    room.box(2.1, 0.06, 0.95, T(x, DESK_Y, z), 'walnut')
    drawers(T(x - 0.74, PT + 0.35, z + 0.02), 0.46, 0.68, 0.82, 'pz')
    room.box(0.04, 0.7, 0.84, T(x + 0.98, PT + 0.35, z), 'solid', C['metal'], skip=('ny',))
    room.box(1.4, 0.34, 0.02, T(x + 0.15, PT + 0.5, z - 0.4), 'solid', C['metal'])
    if dk['lshape']:
        room.box(0.6, 0.06, 0.95, T(x + 0.75, DESK_Y, z + 0.95), 'walnut')
        drawers(T(x + 0.79, PT + 0.35, z + 1.0), 0.48, 0.68, 0.8, 'nx')
    bulbs.append(desk_lamp(x, z))
    chair(dk['chair']['x'], dk['chair']['z'])
    # bake-only occluders: the real-time monitor and keyboard (office.js), so the desk gets their contact shading
    occ.box(1.3, 0.82, 0.05, T(x, DESK_Y + 0.03 + 0.72, z - 0.24, 20 * math.pi / 180), 'solid', '#202022')
    occ.box(0.46, 0.04, 0.26, T(x, DESK_Y + 0.05, z - 0.24, 20 * math.pi / 180), 'solid', '#202022')
    occ.box(0.56, 0.025, 0.18, T(x - 0.05, DESK_Y + 0.045, z + 0.14), 'solid', '#202022')

# ---------------------------------------------------------------- plants: a fiddle-leaf fig and a small pot plant
LEAF = [(0, 0), (0.28, 0.12), (0.42, 0.38), (0.34, 0.55), (0.46, 0.78), (0.3, 0.96), (0, 1.0), (-0.3, 0.96), (-0.46, 0.78), (-0.34, 0.55), (-0.42, 0.38), (-0.28, 0.12)]
def leaf(base, az, elev, length, width, roll, col):
    d = Vector((math.cos(elev) * math.cos(az), math.sin(elev), -math.cos(elev) * math.sin(az)))
    side = Vector((0, 1, 0)).cross(d).normalized(); up = d.cross(side).normalized()
    side = (side * math.cos(roll) + up * math.sin(roll)).normalized(); up = d.cross(side).normalized()
    pts = []
    for (sx, sz) in LEAF:
        sag = -0.12 * (sz ** 2) * length                       # the tip droops a little
        p = Vector(base) + d * (sz * length) + side * (sx * width) + up * sag
        pts.append(tuple(p))
    room.face(list(reversed(pts)), 'leaf', col)      # wound so the face normal is the leaf's upper side

def fig(x, z, seed):
    r = random.Random(seed)
    room.cyl(0.26, 0.2, 0.5, 18, T(x, PT + 0.25, z), 'solid', C['pot'], caps=(False, False))
    room.cyl(0.265, 0.265, 0.03, 18, T(x, PT + 0.5, z), 'solid', C['potRim'], caps=(False, True))
    room.cyl(0.24, 0.24, 0.01, 14, T(x, PT + 0.47, z), 'solid', C['soil'], caps=(False, True))
    pts = [Vector((x, PT + 0.45, z)), Vector((x + 0.03, PT + 1.0, z - 0.02)), Vector((x - 0.02, PT + 1.5, z + 0.03)), Vector((x + 0.02, PT + 1.95, z))]
    for a, b in zip(pts, pts[1:]):
        d = b - a; L = d.length; mid = (a + b) / 2
        rx = math.atan2(d.z, d.y); rz = -math.atan2(d.x, d.y)
        room.cyl(0.026, 0.02, L, 6, T(mid.x, mid.y, mid.z, 0, rx, rz), 'solid', C['trunk'], caps=(False, False))
    n = 34
    for i in range(n):
        t = i / (n - 1); y = PT + 1.0 + t * 1.0
        az = i * 2.39996 + r.random() * 0.3
        k = min(2, int(t * 3)); a, b = pts[k], pts[k + 1]; f = (y - a.y) / max(1e-6, b.y - a.y)
        c = a + (b - a) * max(0, min(1, f))
        base = (c.x + math.cos(az) * 0.04, y, c.z - math.sin(az) * 0.04)
        elev = 0.55 - 0.75 * (1 - t) + (r.random() - 0.5) * 0.3
        leaf(base, az, elev, 0.26 + r.random() * 0.1 + 0.06 * (1 - t), 0.19 + r.random() * 0.04, (r.random() - 0.5) * 0.6, LEAVES[i % len(LEAVES)])

def small_plant(x, z, seed):
    r = random.Random(seed)
    room.cyl(0.19, 0.15, 0.32, 14, T(x, PT + 0.16, z), 'solid', C['potSmall'], caps=(False, False))
    room.cyl(0.175, 0.175, 0.01, 12, T(x, PT + 0.3, z), 'solid', C['soil'], caps=(False, True))
    for i in range(16):
        az = i * 2.39996; elev = 0.9 - (i % 4) * 0.22 + (r.random() - 0.5) * 0.2
        leaf((x + math.cos(az) * 0.03, PT + 0.33 + (i % 3) * 0.04, z - math.sin(az) * 0.03), az, elev, 0.2 + r.random() * 0.06, 0.12, (r.random() - 0.5) * 0.5, LEAVES[(i + 1) % len(LEAVES)])

for i, p in enumerate(S['plants']):
    (fig if p['kind'] == 'tall' else small_plant)(p['x'], p['z'], 31 + i)

# ---------------------------------------------------------------- the easel (layout.js prop), with an abstract picture
for pr in S['props']:
    if pr['kind'] != 'easel': continue
    M = T(pr['x'], PT, pr['z'], pr['yaw'])
    for sx in (-0.28, 0.28): room.box(0.035, 1.6, 0.035, M @ T(sx, 0.8, 0, 0, -0.08, -0.1 if sx > 0 else 0.1), 'oak')
    room.box(0.035, 1.5, 0.035, M @ T(0, 0.75, 0.32, 0, 0.35), 'oak')
    room.box(0.7, 0.035, 0.08, M @ T(0, 0.62, -0.06), 'oak')
    Bd = M @ T(0, 0.93, -0.03, 0, -0.08)
    room.box(0.7, 0.55, 0.03, Bd, 'solid', C['canvas'])
    for (bx, by, bw, bh, c) in [(-0.14, 0.06, 0.3, 0.3, '#c26a3d'), (0.12, -0.08, 0.26, 0.2, '#2f5d5a'), (0.16, 0.13, 0.12, 0.12, '#d9b26f'), (-0.05, -0.17, 0.5, 0.05, '#3a3a3c')]:
        room.box(bw, bh, 0.004, Bd @ T(bx, by, -0.017), 'solid', c, skip=('pz',))

phase('model', T0)

# ---------------------------------------------------------------- Blender scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def material(name):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    nt = m.node_tree; bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 0.85
    if 'Specular IOR Level' in bsdf.inputs: bsdf.inputs['Specular IOR Level'].default_value = 0.25
    m.use_backface_culling = name not in ('leaf',)
    if name in ('solid', 'leaf'):
        vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
        nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    elif name == 'led':
        bsdf.inputs['Base Color'].default_value = (1, 0.85, 0.65, 1)
        bsdf.inputs['Emission Color'].default_value = (1, 0.72, 0.42, 1); bsdf.inputs['Emission Strength'].default_value = 0.0
    else:
        img = TEXIMG[name]
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
        uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'UVMap'
        nt.links.new(uvn.outputs['UV'], tex.inputs['Vector']); nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return m

# textures: 1k photo -> 512 px, optionally shifted to a target average colour, packed (the exporter writes JPEG)
t = time.perf_counter(); TEXIMG = {}
for name, (fname, _scale, target) in TEX.items():
    src = bpy.data.images.load(os.path.join(A.textures, fname), check_existing=True)
    src.scale(512, 512)
    px = np.empty(512 * 512 * 4, np.float32); src.pixels.foreach_get(px); px = px.reshape(-1, 4)
    if target:
        mean = px[:, :3].mean(axis=0); tgt = np.array(srgb(target), np.float32)
        px[:, :3] = np.clip(px[:, :3] / np.maximum(mean, 1e-3) * tgt, 0, 1)
    img = bpy.data.images.new(name, 512, 512, alpha=False); img.colorspace_settings.name = 'sRGB'
    img.pixels.foreach_set(px.ravel()); img.update(); img.pack()
    TEXIMG[name] = img
    bpy.data.images.remove(src) if src.users == 0 else None
phase('textures', t)

MATS = {n: material(n) for n in MAT_ORDER + ['led']}

def make_object(name, mb, order, lightmap):
    me = bpy.data.meshes.new(name)
    me.from_pydata([to_bl(p) for p in mb.v], [], mb.f); me.update()
    used = [n for n in order if n in set(mb.m)]
    for n in used: me.materials.append(MATS[n])
    me.polygons.foreach_set('material_index', [used.index(n) for n in mb.m])
    uv = me.uv_layers.new(name='UVMap'); flat = []
    for f in mb.uv:
        for (u, v) in f: flat += [u, v]
    uv.data.foreach_set('uv', flat)
    ca = me.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='CORNER'); cols = []
    for f, c in zip(mb.f, mb.col): cols += [c[0], c[1], c[2], 1.0] * len(f)
    ca.data.foreach_set('color', cols)
    if lightmap: me.uv_layers.new(name='LightMap')
    me.uv_layers.active_index = 0
    for p in me.polygons: p.use_smooth = False
    me.update()
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    return ob

t = time.perf_counter()
room_ob = make_object('design_room', room, MAT_ORDER, True)
led_ob = make_object('design_leds', em, ['led'], False)
occ_ob = make_object('bake_occluders', occ, ['solid'], False)
TRIS = sum(len(p.vertices) - 2 for p in room_ob.data.polygons) + sum(len(p.vertices) - 2 for p in led_ob.data.polygons)
log('triangles (exported):', TRIS)

# lightmap UVs: smart projection on the LightMap layer, then a tighter pack
bpy.ops.object.select_all(action='DESELECT'); room_ob.select_set(True); bpy.context.view_layer.objects.active = room_ob
room_ob.data.uv_layers.active = room_ob.data.uv_layers['LightMap']
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
margin = 4.0 / A.size
try: bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, margin_method='FRACTION', margin=margin, shape_method='CONCAVE')
except TypeError: bpy.ops.uv.pack_islands(rotate=True, margin=margin)
bpy.ops.object.mode_set(mode='OBJECT')
room_ob.data.uv_layers.active = room_ob.data.uv_layers['UVMap']
phase('uv', t)

# ---------------------------------------------------------------- lights: day (sun + sky) and evening (LEDs, lamps)
def add_light(name, kind, loc3, energy, color, **kw):
    li = bpy.data.lights.new(name, kind); li.energy = energy; li.color = color
    for k, v in kw.items(): setattr(li, k, v)
    ob = bpy.data.objects.new(name, li); scene.collection.objects.link(ob); ob.location = to_bl(loc3); return ob
def aim(ob, emit3, along3=None):     # a light emits along its local -Z; along: its local X (area light length)
    z = -Vector(to_bl(emit3)).normalized()
    x = Vector(to_bl(along3)).normalized() if along3 else z.orthogonal().normalized()
    x = (x - z * x.dot(z)).normalized(); y = z.cross(x)
    ob.rotation_euler = Matrix((x, y, z)).transposed().to_euler()

sun_dir = Vector((22, 17, 11)).normalized()       # office.js SUN_POS (R2): the same light direction as the live scene
sun = add_light('sun', 'SUN', (0, 0, 0), 2.6, lin('#ffefd8'), angle=math.radians(4))
aim(sun, tuple(-sun_dir))
DAY = [sun]
EVE = []
LED_W_PER_M = {'shelf': 16.0, 'cove': 14.0}
for s in LEDS:
    a, b = Vector(s['a']), Vector(s['b']); L = (b - a).length; e = Vector(s['emit'])
    ob = add_light('led_' + s['kind'], 'AREA', tuple((a + b) / 2 + e * 0.01), LED_W_PER_M[s['kind']] * L, lin('#ffb466'), shape='RECTANGLE', size=L, size_y=0.025)
    ob.data.spread = math.radians(150)
    aim(ob, tuple(e), tuple(b - a)); EVE.append(ob)
for i, bp in enumerate(bulbs):
    ob = add_light('lamp_%d' % i, 'SPOT', (bp.x, bp.y, bp.z), 25.0, lin('#ffc684'), spot_size=math.radians(115), spot_blend=0.6, shadow_soft_size=0.04)
    aim(ob, (0.12, -1, -0.25)); EVE.append(ob)

world = bpy.data.worlds.new('world'); scene.world = world
try: world.use_nodes = True
except Exception: pass
bg = world.node_tree.nodes.get('Background')
MODES = {'day': {'world': (lin('#dfe6f0'), 0.55), 'on': DAY}, 'evening': {'world': (lin('#8088a0'), 0.8), 'on': EVE}}
def set_mode(mode):
    m = MODES[mode]
    bg.inputs['Color'].default_value = (*m['world'][0], 1); bg.inputs['Strength'].default_value = m['world'][1]
    for ob in DAY + EVE: ob.hide_render = ob not in m['on']

# ---------------------------------------------------------------- Cycles on the GPU (OptiX, else CUDA, else CPU)
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
DEVICE = 'CPU'
for kind in ('OPTIX', 'CUDA'):
    try:
        prefs.compute_device_type = kind; prefs.refresh_devices()
        devs = [d for d in prefs.devices if d.type == kind]
        if devs:
            for d in prefs.devices: d.use = d.type == kind
            DEVICE = kind + ': ' + ', '.join(d.name for d in devs); break
    except Exception as e: log('device', kind, 'unavailable:', e)
scene.cycles.device = 'GPU' if DEVICE != 'CPU' else 'CPU'
scene.cycles.samples = A.samples
scene.cycles.max_bounces = 6; scene.cycles.diffuse_bounces = 4; scene.cycles.glossy_bounces = 1
scene.render.bake.margin = 6; scene.render.bake.margin_type = 'EXTEND'
log('device:', DEVICE, '| samples:', A.samples, '| lightmap:', A.size)

def bake(mode):
    set_mode(mode)
    img = bpy.data.images.new('lm_' + mode, A.size, A.size, alpha=True, float_buffer=True)
    img.generated_color = (0, 0, 0, 0)
    nodes = []
    for m in room_ob.data.materials:
        n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = img; m.node_tree.nodes.active = n; nodes.append((m, n))
    bpy.ops.object.select_all(action='DESELECT'); room_ob.select_set(True); bpy.context.view_layer.objects.active = room_ob
    t = time.perf_counter()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, uv_layer='LightMap', margin=6, margin_type='EXTEND', use_clear=True, target='IMAGE_TEXTURES')
    phase('bake_' + mode, t)
    for m, n in nodes: m.node_tree.nodes.remove(n)
    px = np.empty(A.size * A.size * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(-1, 4)
    return px

def write_lightmap(mode, px):
    cov = px[:, 3] > 0.5
    lum = (px[:, :3] * np.array([0.2126, 0.7152, 0.0722], np.float32)).sum(axis=1)
    p995 = float(np.percentile(lum[cov], 99.5)) if cov.any() else 1.0
    k = max(1e-4, p995 / 0.92)                      # stored = light / k, so 99.5% of texels keep headroom below white
    v = np.clip(px[:, :3] / k, 0, 1)
    v = np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)   # sRGB-encode: more steps in the dark
    out = np.ones((px.shape[0], 4), np.float32); out[:, :3] = v
    img = bpy.data.images.new('lm8_' + mode, A.size, A.size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(out.ravel()); img.filepath_raw = out_path('.build/lightmap-' + mode + '.png'); img.file_format = 'PNG'; img.save()
    return {'png': 'lightmap-' + mode + '.png', 'scale': round(k, 6), 'p995': round(p995, 5), 'max': round(float(lum.max()), 4), 'coverage': round(float(cov.mean()), 4)}

LM = {}
for mode in ('day', 'evening'): LM[mode] = write_lightmap(mode, bake(mode))

# ---------------------------------------------------------------- export: the room and the LED mesh (not the occluders)
t = time.perf_counter()
bpy.ops.object.select_all(action='DESELECT'); room_ob.select_set(True); led_ob.select_set(True)
for ob in DAY + EVE: ob.hide_render = True
opts = dict(filepath=out_path('design-room.glb'), export_format='GLB', use_selection=True, export_image_format='JPEG', export_jpeg_quality=82,
            export_texcoords=True, export_normals=True, export_materials='EXPORT', export_vertex_color='MATERIAL', export_lights=False,
            export_cameras=False, export_yup=True, export_apply=False, export_extras=False)
try: bpy.ops.export_scene.gltf(**opts)
except TypeError as e:
    log('exporter option not accepted, retrying with the basics:', e)
    bpy.ops.export_scene.gltf(filepath=opts['filepath'], export_format='GLB', use_selection=True, export_image_format='JPEG', export_vertex_color='MATERIAL')
phase('export', t)

info = {'device': DEVICE, 'samples': A.samples, 'size': A.size, 'lightmaps': LM, 'triangles': TRIS, 'phases': PHASES,
        'leds': LEDS, 'materials': {'textured': list(TEX.keys()), 'vertexColour': ['solid', 'leaf'], 'unlit': ['led']},
        'seconds': round(time.perf_counter() - T0, 2)}
with open(out_path('.build/bake.json'), 'w', encoding='utf-8') as f: json.dump(info, f, indent=2)
log('done in', info['seconds'], 's')
