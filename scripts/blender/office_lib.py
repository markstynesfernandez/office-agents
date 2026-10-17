# office_lib.py — R3a: the shared Blender library for the baked office. Every baked room (office_rooms.py) is built
# from these pieces, so a desk, a chair or a plant is the same model in every room, and every room uses the same few
# materials and textures (one oak floor for the whole office). Nothing here is room-specific.
#   materials  solid / leaf (vertex colour), oak, walnut, floor, fabric, rug (shared photo textures), decal (the page's
#              canvas atlas: mood board, whiteboard, framed pictures), themed: wall_<room>, cap, skirting (one colour
#              per theme, set by the page and by the bake mode), led (unlit, real-time on the page)
#   furniture  desk (with drawer pedestals, optional L return), task chair, desk lamp, rug, shelves with binders, a
#              wall shelf with books and a trailing plant, lockers, credenza, meeting table with stools, easel
#   plants     fiddle-leaf fig (tall), small pot plant, trailing shelf plant
#   wall items slat panel, mood board, whiteboard, framed picture (decals from the page's atlas), LED strips
# Coordinates: a room's own frame as in layout.js (x along the back wall, y up, z towards the open front; the two back
# walls are the planes x = 0 and z = 0, inner faces at WT). Converted to Blender's z-up only when vertices are written.
# Seeded throughout, so a rebuild gives the same rooms. Licence of the outputs: this project; textures CC0 (ASSETS.md).
import bpy, math, os, random
import numpy as np
from mathutils import Vector, Matrix

# ---------------------------------------------------------------- colours and transforms
def srgb(h): return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
def lin1(x): return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
def lin(h): return tuple(lin1(c) for c in srgb(h))
def T(x=0, y=0, z=0, ry=0, rx=0, rz=0):         # translation * Ry * Rx * Rz (three.js Euler 'YXZ')
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(rz, 4, 'Z')
def to_bl(p): return (p[0], -p[2], p[1])        # three (x, y, z) -> Blender (x, -z, y)

# shared photo textures: file, real-world tile size (scene units ~ metres), target average colour (None: as photographed).
# The floor's tile size and colour come from the look (build-office.mjs), because the page's procedural rooms use the
# same floor texture at the same scale.
TEX = {
    'oak':    ['oak_veneer_01_diff_1k.jpg', 1.2, None],              # slats, shelves, frames, easel, office desk tops
    'walnut': ['walnut_veneer_diff_1k.jpg', 1.6, None],              # design desk tops, drawer fronts, credenza
    'floor':  ['wood_floor_diff_1k.jpg', 2.2, '#a47f58'],            # one mid-tone oak floor for the whole office
    'fabric': ['poly_wool_herringbone_diff_1k.jpg', 0.4, '#34353a'], # chair upholstery (charcoal)
    'rug':    ['hessian_230_diff_1k.jpg', 0.45, '#b7a487'],          # rugs (oatmeal)
}
TEX_PX = 512
C = {
    'backing': '#141416', 'pedestal': '#2a2b2f', 'metal': '#1b1c1f', 'handle': '#8d8a84', 'pot': '#38342f', 'potRim': '#4a443d',
    'soil': '#2f261e', 'trunk': '#5f4a38', 'potSmall': '#c9b8a3', 'lamp': '#1c1c1f', 'canvas': '#ece6da', 'label': '#ece6da',
    'rugBorder': '#4a3b2c', 'caster': '#111113', 'frame': '#2a2a2d', 'mat': '#ece6da', 'locker': '#8e9096', 'seam': '#3a3b3f',
    'whiteboardFrame': '#b9bcc1', 'credenza': '#2e2f33', 'leather': '#6b4a35', 'mug': '#d8d2c8', 'box': '#c9bfae', 'vase': '#c2b8a8',
}
BINDERS = ['#1f3b5c', '#3a3a3c', '#8c2f2f', '#4a6a8a', '#e3ddd2', '#2f5d50', '#b5533c', '#d9b26f']
BOOKS = ['#7b2d26', '#2f4858', '#3d5a40', '#8c6d46', '#5b5f97', '#b5533c', '#d9b26f', '#e8e1d4', '#3b3b3b', '#6b4e71', '#9a8f7a', '#2e5e6e']
LEAVES = ['#36612f', '#2f5a2b', '#3e6d35', '#2b5126']
TRAIL = ['#4f7f45', '#3e6d35', '#5d8c4f']
LED_W_PER_M = {'shelf': 16.0, 'cove': 14.0, 'board': 18.0}

# ---------------------------------------------------------------- mesh builder (three.js-style frame)
class MB:
    def __init__(s, rng): s.v = []; s.f = []; s.m = []; s.uv = []; s.col = []; s.rng = rng
    def face(s, pts, mat, col='#ffffff', uvoff=(0, 0), uvs=None):
        pts = [Vector(p) for p in pts]
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if n.length < 1e-12: return
        if uvs is None:      # planar UVs on the dominant axis, in tile units; the grain runs up walls and along x on floors
            n.normalize(); ax = max(range(3), key=lambda i: abs(n[i]))
            scale = TEX[mat][1] if mat in TEX else 1.0
            uvs = []
            for p in pts:
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
        off = uvoff if uvoff is not None else (s.rng.random(), s.rng.random())
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
    # a quad facing local +z (w x h, centred), with UVs from a region of the page's atlas (three.js convention, v up);
    # Blender's v is flipped here because the glTF exporter flips it back, so the page samples the region as drawn
    def decal(s, w, h, M, region):
        u0, v0, u1, v1 = region; x, y = w / 2, h / 2
        P = lambda a, b: tuple(M @ Vector((a, b, 0)))
        s.face([P(-x, -y), P(x, -y), P(x, y), P(-x, y)], 'decal', '#ffffff', uvs=[(u0, 1 - v0), (u1, 1 - v0), (u1, 1 - v1), (u0, 1 - v1)])

# ---------------------------------------------------------------- a room being built: its meshes, LEDs and lamp bulbs
class Kit:
    """one room: room (baked), em (unlit LED strips and bulbs), occ (bake-only occluders for the real-time monitors
    and keyboards). S: the room spec (layout.js bakedRoomSpec), look: the shared look (build-office.mjs)."""
    def __init__(s, spec, look, seed):
        s.S, s.look, s.key = spec, look, spec['key']
        s.rng = random.Random(seed)
        s.room, s.em, s.occ = MB(s.rng), MB(s.rng), MB(s.rng)
        s.leds, s.bulbs = [], []
        s.W, s.D, s.FLOOR, s.WH, s.WT = spec['w'], spec['d'], spec['floor'], spec['wallH'], spec['wallT']
        s.PT = s.FLOOR + 0.02                    # top of the wood floor (office.js PT)
        s.DESK_Y = s.PT + 0.73                   # desk top centre (office.js deskY)
        s.wall = 'wall_' + s.key
        for w in spec['walls']:
            if abs(w['at']) > 1e-6: raise RuntimeError(s.key + ': the library expects the back walls at x = 0 and z = 0')
    # placement on a back wall: 'z' (the back wall, faces +z) or 'x' (the left wall, faces +x); u along the wall, v out
    def on_wall(s, axis, u, y, v, rz=0):
        return T(u, y, s.WT + v, 0, 0, rz) if axis == 'z' else T(s.WT + v, y, u, math.pi / 2, 0, rz)

def led(k, a, b, emit, kind, thick=(0.014, 0.012)):
    """an LED strip from a to b (room frame), emitting along emit; drawn as a thin unlit box, lit in the evening bake"""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length; mid = (a + b) / 2
    ry = math.atan2(-d.z, d.x) if abs(d.x) + abs(d.z) > 1e-6 else 0
    k.em.box(L, thick[0], thick[1], T(mid.x, mid.y, mid.z, ry), 'led', '#ffffff', skip=('ny',))
    k.leds.append({'a': [round(v, 4) for v in a], 'b': [round(v, 4) for v in b], 'emit': [round(v, 4) for v in Vector(emit).normalized()], 'kind': kind})

# ---------------------------------------------------------------- shell: floor, walls (themed), caps, skirting, coves
def shell(k):
    W, D, PT, FLOOR, WH, WT = k.W, k.D, k.PT, k.FLOOR, k.WH, k.WT
    k.room.face([(0, PT, D), (W, PT, D), (W, PT, 0), (0, PT, 0)], 'floor', uvoff=(0.13, 0.41))
    k.room.face([(0, FLOOR, D), (W, FLOOR, D), (W, PT, D), (0, PT, D)], 'skirting')     # floor edge, front
    k.room.face([(W, FLOOR, D), (W, FLOOR, 0), (W, PT, 0), (W, PT, D)], 'skirting')     # floor edge, right
    for w in k.S['walls']:
        L, mid = w['to'] - w['from'], (w['from'] + w['to']) / 2
        if w['axis'] == 'x':   # the left wall (plane x = 0), inner face +x; its front end is open (a cut, in the cap colour)
            k.room.box(WT, WH, L, T(WT / 2, FLOOR + WH / 2, mid), k.wall, skip=('nx', 'nz', 'ny', 'py', 'pz'))
            k.room.box(WT + 0.04, WH, 0.04, T(WT / 2, FLOOR + WH / 2, w['to'] - 0.02), 'cap', skip=('nx', 'ny', 'py', 'nz'))
            k.room.box(WT + 0.04, 0.05, L, T(WT / 2, FLOOR + WH + 0.025, mid), 'cap', skip=('nx', 'ny', 'nz'))
            k.room.box(0.03, 0.1, L - WT, T(WT + 0.015, PT + 0.05, mid + WT / 2), 'skirting', skip=('nx', 'ny', 'nz'))
        else:                  # the back wall (plane z = 0), inner face +z; its right end is open (a cut)
            k.room.box(L, WH, WT, T(mid, FLOOR + WH / 2, WT / 2), k.wall, skip=('nz', 'nx', 'ny', 'py', 'px'))
            k.room.box(0.04, WH, WT + 0.04, T(w['to'] - 0.02, FLOOR + WH / 2, WT / 2), 'cap', skip=('nz', 'ny', 'py', 'nx'))
            k.room.box(L, 0.05, WT + 0.04, T(mid, FLOOR + WH + 0.025, WT / 2), 'cap', skip=('nz', 'ny', 'nx'))
            k.room.box(L - WT, 0.1, 0.03, T(mid + WT / 2, PT + 0.05, WT + 0.015), 'skirting', skip=('nz', 'ny', 'nx'))
    # cove LEDs where the floor meets both back walls (they wash up the walls in the evening)
    zb = xl = WT + 0.045
    led(k, (WT + 0.05, PT + 0.012, zb), (W - 0.05, PT + 0.012, zb), (0, 1, -0.35), 'cove')
    led(k, (xl, PT + 0.012, WT + 0.05), (xl, PT + 0.012, D - 0.05), (-0.35, 1, 0), 'cove')

# ---------------------------------------------------------------- wall pieces
def slat_panel(k, x0, x1, h=2.42):
    """a warm oak slat panel on the back wall from x0 to x1, on a dark backing"""
    zf, PT = k.WT, k.PT
    k.room.box(x1 - x0, h, 0.02, T((x0 + x1) / 2, PT + h / 2 + 0.04, zf + 0.01), 'solid', C['backing'], skip=('nz', 'ny'))
    SLAT, GAPW = 0.046, 0.024
    for i in range(int((x1 - x0 - 0.02) / (SLAT + GAPW))):
        x = x0 + 0.035 + i * (SLAT + GAPW) + SLAT / 2
        k.room.box(SLAT, h, 0.03, T(x, PT + h / 2 + 0.04, zf + 0.035), 'oak', skip=('nz', 'ny'), uvoff=(k.rng.random() * 4, k.rng.random() * 4))
    return zf + 0.05                                            # the panel's front face

def binders(k, x0, x1, y, depth_z, seed):
    r = random.Random(seed); x = x0
    while x < x1 - 0.1:
        roll = r.random()
        if roll < 0.12: x += 0.1 + r.random() * 0.15; continue
        if roll < 0.22 and x1 - x > 0.34:                  # a flat stack
            for i in range(2 + int(r.random() * 3)):
                k.room.box(0.28 - i * 0.015, 0.045, 0.22, T(x + 0.15, y + 0.0225 + i * 0.047, depth_z), 'solid', r.choice(BINDERS), skip=('ny',))
            x += 0.34; continue
        if roll < 0.3:                                        # a small vase
            k.room.cyl(0.05, 0.045, 0.16, 10, T(x + 0.07, y + 0.08, depth_z), 'solid', C['vase'], caps=(False, True)); x += 0.16; continue
        c = r.choice(BINDERS)
        for i in range(2 + int(r.random() * 4)):              # a run of binders, spines out, with blank label patches (no text)
            if x > x1 - 0.1: break
            h = 0.3 if r.random() < 0.7 else 0.24
            k.room.box(0.072, h, 0.24, T(x + 0.036, y + h / 2, depth_z), 'solid', c, skip=('ny', 'nz'))
            k.room.box(0.045, 0.06, 0.004, T(x + 0.036, y + h * 0.3, depth_z + 0.122), 'solid', C['label'], skip=('nz',))
            x += 0.076
        x += 0.02

def binder_shelf(k, x0, x1, y, z_wall, seed, depth=0.27):
    """an oak shelf on the back wall with binders, stacks and vases, and an LED strip under its front edge"""
    zc = z_wall + depth / 2
    k.room.box(x1 - x0, 0.045, depth, T((x0 + x1) / 2, y, zc), 'oak', skip=('nz',))
    led(k, (x0 + 0.05, y - 0.03, z_wall + depth - 0.035), (x1 - 0.05, y - 0.03, z_wall + depth - 0.035), (0, -1, -0.45), 'shelf')
    binders(k, x0 + 0.06, x1 - 0.06, y + 0.0225, zc - 0.005, seed)

def trailing_plant(k, M):
    """a trailing plant in a small pot (M: the pot's base): a leafy crown and strands hanging forward (local +z)"""
    r = k.rng
    k.room.cyl(0.075, 0.058, 0.13, 10, M @ T(0, 0.065, 0), 'solid', C['potSmall'], caps=(False, True))
    k.room.sphere(0.11, M @ T(0, 0.17, 0), 'leaf', LEAVES[2], 6, 4)
    for du, n in ((-0.07, 4), (0.05, 6), (0.11, 3)):
        for i in range(n):
            k.room.sphere(0.045 + r.random() * 0.02, M @ T(du + (r.random() - 0.5) * 0.04, 0.1 - i * 0.075, 0.1 + min(i, 2) * 0.012), 'leaf', TRAIL[(i + n) % len(TRAIL)], 5, 3)

def wall_shelf(k, axis, u, length, y, seed):
    """a short oak wall shelf with upright books, a box and a trailing plant, and an LED strip under it"""
    r = random.Random(seed)
    k.room.box(length, 0.04, 0.26, k.on_wall(axis, u, y, 0.13), 'oak', skip=('nz',))
    a = k.on_wall(axis, u - length / 2 + 0.04, y - 0.026, 0.235).to_translation(); b = k.on_wall(axis, u + length / 2 - 0.04, y - 0.026, 0.235).to_translation()
    out = k.on_wall(axis, u, 0, 0).to_3x3() @ Vector((0, -1, 0.45))
    led(k, tuple(a), tuple(b), tuple(out), 'shelf')
    cu = u - length / 2 + 0.12
    for i in range(4 + int(r.random() * 4)):
        w, h = 0.035 + r.random() * 0.035, 0.18 + r.random() * 0.1
        k.room.box(w, h, 0.18, k.on_wall(axis, cu + w / 2, y + 0.02 + h / 2, 0.14), 'solid', r.choice(BOOKS), skip=('ny', 'nz')); cu += w + 0.004
    k.room.box(0.22, 0.12, 0.16, k.on_wall(axis, u + length * 0.12, y + 0.08, 0.13), 'solid', C['box'], skip=('ny', 'nz'))
    trailing_plant(k, k.on_wall(axis, u + length / 2 - 0.2, y + 0.02, 0.14))

def frame(k, axis, u, y, w, h, region):
    """a framed picture: dark frame, a pale mat and the picture (a decal from the page's atlas: abstract, no text)"""
    k.room.box(w, h, 0.04, k.on_wall(axis, u, y, 0.02), 'solid', C['frame'], skip=('nz',))
    k.room.box(w - 0.07, h - 0.07, 0.004, k.on_wall(axis, u, y, 0.042), 'solid', C['mat'], skip=('nz', 'nx', 'px', 'ny', 'py'))
    k.room.decal(w - 0.24, h - 0.24, k.on_wall(axis, u, y, 0.046), region)

def mood_board(k, axis, u, y, w, h, region, v0=0.0):
    """a pinboard / mood board in an oak frame (its content is the page's procedural board: swatches, sketches, cards)"""
    k.room.box(w + 0.1, h + 0.1, 0.05, k.on_wall(axis, u, y, v0 + 0.025), 'oak', skip=('nz',))
    k.room.decal(w, h, k.on_wall(axis, u, y, v0 + 0.052), region)

def whiteboard(k, axis, u, y, w, h, region):
    """a whiteboard with an aluminium frame and a marker tray (its content: the page's procedural whiteboard)"""
    k.room.box(w + 0.08, h + 0.08, 0.04, k.on_wall(axis, u, y, 0.02), 'solid', C['whiteboardFrame'], skip=('nz',))
    k.room.decal(w, h, k.on_wall(axis, u, y, 0.042), region)
    k.room.box(w * 0.6, 0.04, 0.08, k.on_wall(axis, u, y - h / 2 - 0.1, 0.06), 'solid', C['whiteboardFrame'])
    for i, c in enumerate(('#2f5d8a', '#b5533c', '#3d5a40')):
        k.room.box(0.12, 0.018, 0.018, k.on_wall(axis, u - w * 0.2 + i * 0.16, y - h / 2 - 0.07, 0.07), 'solid', c, skip=('ny',))

def board_light(k, axis, u, y, length, v=0.09):
    """a warm LED strip along the top of a board (v out from the wall), washing down over it"""
    a = k.on_wall(axis, u - length / 2, y, v).to_translation(); b = k.on_wall(axis, u + length / 2, y, v).to_translation()
    out = k.on_wall(axis, u, 0, 0).to_3x3() @ Vector((0, -1, -0.7))
    led(k, tuple(a), tuple(b), tuple(out), 'board')

def locker(k, axis, u, w=0.9, h=1.9):
    """a tall two-door locker against a wall"""
    PT = k.PT
    k.room.box(w, h, 0.5, k.on_wall(axis, u, PT + h / 2, 0.25), 'solid', C['locker'], skip=('ny', 'nz'))
    k.room.box(0.01, h - 0.08, 0.004, k.on_wall(axis, u, PT + h / 2, 0.502), 'solid', C['seam'], skip=('nz',))
    for s in (-1, 1): k.room.box(0.02, 0.16, 0.02, k.on_wall(axis, u + s * 0.06, PT + h * 0.55, 0.51), 'solid', C['handle'], skip=('nz',))
    for i in range(1, 4): k.room.box(w - 0.06, 0.006, 0.004, k.on_wall(axis, u, PT + h * i / 4, 0.502), 'solid', C['seam'], skip=('nz',))
    for i in range(3):    # vent slots near the top of each door
        for s in (-1, 1): k.room.box(0.22, 0.008, 0.004, k.on_wall(axis, u + s * 0.22, PT + h - 0.12 - i * 0.03, 0.502), 'solid', C['seam'], skip=('nz',))

def credenza(k, axis, u, length, seed):
    """a low dark credenza with a walnut top, a few books, a small vase and a small plant on it"""
    PT, r = k.PT, random.Random(seed)
    k.room.box(length, 0.62, 0.45, k.on_wall(axis, u, PT + 0.33, 0.24), 'solid', C['credenza'], skip=('ny', 'nz'))
    k.room.box(length + 0.04, 0.04, 0.48, k.on_wall(axis, u, PT + 0.66, 0.24), 'walnut', skip=('nz',))
    n = max(2, round(length / 0.6))
    for i in range(1, n): k.room.box(0.008, 0.54, 0.004, k.on_wall(axis, u - length / 2 + length * i / n, PT + 0.33, 0.466), 'solid', C['seam'], skip=('nz',))
    for i in range(3): k.room.box(0.3 - i * 0.02, 0.05, 0.22, k.on_wall(axis, u - length * 0.28, PT + 0.705 + i * 0.05, 0.22), 'solid', r.choice(BOOKS), skip=('ny',))
    k.room.cyl(0.06, 0.05, 0.24, 10, k.on_wall(axis, u + length * 0.05, PT + 0.8, 0.2), 'solid', C['vase'], caps=(False, True))
    small_plant(k, k.on_wall(axis, u + length * 0.3, PT + 0.68, 0.22), r.randint(1, 10 ** 6), scale=0.6)

# ---------------------------------------------------------------- floor pieces
def rug(k, x0, x1, z0, z1):
    PT = k.PT
    k.room.box(x1 - x0, 0.012, z1 - z0, T((x0 + x1) / 2, PT + 0.006, (z0 + z1) / 2), 'solid', C['rugBorder'], skip=('ny',))
    k.room.box(x1 - x0 - 0.2, 0.01, z1 - z0 - 0.2, T((x0 + x1) / 2, PT + 0.017, (z0 + z1) / 2), 'rug', skip=('ny',), uvoff=(0.3, 0.7))

def drawers(k, M, w, h, d, face):          # a drawer pedestal; face: the local side the drawers open to ('pz' or 'nx')
    k.room.box(w, h, d, M, 'solid', C['pedestal'], skip=('ny',))
    n = 3; gap = 0.012; fh = (h - 0.04 - gap * (n + 1)) / n
    for i in range(n):
        y = -h / 2 + 0.02 + gap + fh / 2 + i * (fh + gap)
        if face == 'pz':
            k.room.box(w - 0.03, fh, 0.016, M @ T(0, y, d / 2 + 0.008), 'walnut', skip=('nz',))
            k.room.box(0.16, 0.014, 0.022, M @ T(0, y + fh * 0.28, d / 2 + 0.027), 'solid', C['handle'], skip=('nz',))
        else:
            k.room.box(0.016, fh, d - 0.03, M @ T(-w / 2 - 0.008, y, 0), 'walnut', skip=('px',))
            k.room.box(0.022, 0.014, 0.16, M @ T(-w / 2 - 0.027, y + fh * 0.28, 0), 'solid', C['handle'], skip=('px',))

def desk_lamp(k, x, z):
    M = T(x - 0.82, k.DESK_Y + 0.03, z - 0.12, -0.5)
    k.room.cyl(0.095, 0.1, 0.025, 16, M @ T(0, 0.0125, 0), 'solid', C['lamp'], caps=(False, True))
    k.room.cyl(0.012, 0.012, 0.42, 6, M @ T(0, 0.21, 0.07, 0, 0.35), 'solid', C['lamp'], caps=(False, False))
    k.room.cyl(0.012, 0.012, 0.32, 6, M @ T(0, 0.46, 0.0, 0, -1.0), 'solid', C['lamp'], caps=(False, False))
    k.room.cyl(0.085, 0.03, 0.14, 14, M @ T(0, 0.5, -0.17, 0, 0.5), 'solid', C['lamp'], caps=(False, True))
    bulb = M @ T(0, 0.45, -0.19)
    k.em.sphere(0.034, bulb, 'led', '#ffffff')
    k.bulbs.append(bulb.to_translation())

def chair(k, x, z):                     # an ergonomic task chair facing the desk (local -z); seat top at PT + 0.49
    M = T(x, k.PT, z)
    for i in range(5):
        R = M @ T(0, 0, 0, i * 2 * math.pi / 5)
        k.room.box(0.05, 0.035, 0.31, R @ T(0, 0.075, 0.155), 'solid', C['metal'], skip=('ny',))
        k.room.sphere(0.03, R @ T(0, 0.03, 0.3), 'solid', C['caster'], 6, 4)
    k.room.cyl(0.05, 0.05, 0.06, 10, M @ T(0, 0.08, 0), 'solid', C['metal'], caps=(False, True))
    k.room.cyl(0.028, 0.028, 0.3, 8, M @ T(0, 0.25, 0), 'solid', '#8f8f93', caps=(False, False))
    k.room.box(0.22, 0.05, 0.22, M @ T(0, 0.405, 0.02), 'solid', C['metal'], skip=('py',))
    k.room.box(0.52, 0.07, 0.5, M @ T(0, 0.455, 0), 'fabric')
    k.room.box(0.06, 0.46, 0.04, M @ T(0, 0.62, 0.29, 0, 0.12), 'solid', C['metal'])                     # spine
    B = M @ T(0, 0.93, 0.31, 0, 0.15)                                                              # back, leaning back
    k.room.box(0.47, 0.6, 0.03, B, 'fabric')
    for sx in (-1, 1): k.room.box(0.03, 0.62, 0.045, B @ T(sx * 0.245, 0, 0), 'solid', C['metal'])
    k.room.box(0.5, 0.03, 0.045, B @ T(0, 0.31, 0), 'solid', C['metal']); k.room.box(0.5, 0.03, 0.045, B @ T(0, -0.31, 0), 'solid', C['metal'])
    k.room.box(0.4, 0.11, 0.04, B @ T(0, -0.16, -0.03), 'fabric')                                 # lumbar pad
    k.room.box(0.3, 0.12, 0.05, M @ T(0, 1.36, 0.36, 0, 0.15), 'fabric')                          # headrest
    k.room.box(0.03, 0.14, 0.03, M @ T(0, 1.25, 0.35, 0, 0.15), 'solid', C['metal'])
    for sx in (-1, 1):
        k.room.box(0.035, 0.2, 0.035, M @ T(sx * 0.27, 0.56, 0.06), 'solid', C['metal'])
        k.room.box(0.075, 0.03, 0.27, M @ T(sx * 0.27, 0.675, 0.03), 'solid', '#2a2a2d')

def desk(k, dk, top='walnut'):
    """a desk at the spec's desk position (top 2.1 x 0.95, drawer pedestal, modesty panel; L return on the first desk
    of a row), its lamp, its chair and the bake-only occluders of the real-time monitor and keyboard"""
    x, z, PT, DY = dk['x'], dk['z'], k.PT, k.DESK_Y
    k.room.box(2.1, 0.06, 0.95, T(x, DY, z), top)
    drawers(k, T(x - 0.74, PT + 0.35, z + 0.02), 0.46, 0.68, 0.82, 'pz')
    k.room.box(0.04, 0.7, 0.84, T(x + 0.98, PT + 0.35, z), 'solid', C['metal'], skip=('ny',))
    k.room.box(1.4, 0.34, 0.02, T(x + 0.15, PT + 0.5, z - 0.4), 'solid', C['metal'])
    if dk['lshape']:
        k.room.box(0.6, 0.06, 0.95, T(x + 0.75, DY, z + 0.95), top)
        drawers(k, T(x + 0.79, PT + 0.35, z + 1.0), 0.48, 0.68, 0.8, 'nx')
    desk_lamp(k, x, z)
    chair(k, dk['chair']['x'], dk['chair']['z'])
    k.occ.box(1.3, 0.82, 0.05, T(x, DY + 0.03 + 0.72, z - 0.24, 20 * math.pi / 180), 'solid', '#202022')
    k.occ.box(0.46, 0.04, 0.26, T(x, DY + 0.05, z - 0.24, 20 * math.pi / 180), 'solid', '#202022')
    k.occ.box(0.56, 0.025, 0.18, T(x - 0.05, DY + 0.045, z + 0.14), 'solid', '#202022')

def meeting(k, pr):
    """the round meeting table with two stools (layout.js prop 'meeting'), a few papers and a mug"""
    PT, M = k.PT, T(pr['x'], k.PT, pr['z'], pr['yaw'])
    k.room.cyl(0.5, 0.5, 0.04, 28, M @ T(0, 0.74, 0), 'oak')
    k.room.cyl(0.035, 0.035, 0.7, 8, M @ T(0, 0.37, 0), 'solid', C['metal'], caps=(False, False))
    k.room.cyl(0.26, 0.28, 0.025, 16, M @ T(0, 0.013, 0), 'solid', C['metal'], caps=(False, True))
    for sx in (-0.8, 0.8):
        k.room.cyl(0.19, 0.19, 0.05, 16, M @ T(sx, 0.48, 0.05), 'solid', C['leather'])
        k.room.cyl(0.025, 0.025, 0.45, 8, M @ T(sx, 0.23, 0.05), 'solid', C['metal'], caps=(False, False))
        k.room.cyl(0.16, 0.17, 0.02, 14, M @ T(sx, 0.01, 0.05), 'solid', C['metal'], caps=(False, True))
    k.room.box(0.3, 0.012, 0.22, M @ T(-0.12, 0.766, 0.05, 0.3), 'solid', C['label'], skip=('ny',))
    k.room.cyl(0.04, 0.035, 0.09, 10, M @ T(0.2, 0.805, -0.1), 'solid', C['mug'], caps=(False, True))

def easel(k, pr, region):
    """the easel (layout.js prop 'easel') with an abstract picture from the page's atlas"""
    M = T(pr['x'], k.PT, pr['z'], pr['yaw'])
    for sx in (-0.28, 0.28): k.room.box(0.035, 1.6, 0.035, M @ T(sx, 0.8, 0, 0, -0.08, -0.1 if sx > 0 else 0.1), 'oak')
    k.room.box(0.035, 1.5, 0.035, M @ T(0, 0.75, 0.32, 0, 0.35), 'oak')
    k.room.box(0.7, 0.035, 0.08, M @ T(0, 0.62, -0.06), 'oak')
    Bd = M @ T(0, 0.93, -0.03, 0, -0.08)
    k.room.box(0.7, 0.55, 0.03, Bd, 'solid', C['canvas'])
    k.room.decal(0.64, 0.49, Bd @ T(0, 0, -0.017, math.pi), region)

# ---------------------------------------------------------------- plants
LEAF = [(0, 0), (0.28, 0.12), (0.42, 0.38), (0.34, 0.55), (0.46, 0.78), (0.3, 0.96), (0, 1.0), (-0.3, 0.96), (-0.46, 0.78), (-0.34, 0.55), (-0.42, 0.38), (-0.28, 0.12)]
def leaf(k, base, az, elev, length, width, roll, col):
    d = Vector((math.cos(elev) * math.cos(az), math.sin(elev), -math.cos(elev) * math.sin(az)))
    side = Vector((0, 1, 0)).cross(d).normalized(); up = d.cross(side).normalized()
    side = (side * math.cos(roll) + up * math.sin(roll)).normalized(); up = d.cross(side).normalized()
    pts = []
    for (sx, sz) in LEAF:
        sag = -0.12 * (sz ** 2) * length                       # the tip droops a little
        pts.append(tuple(Vector(base) + d * (sz * length) + side * (sx * width) + up * sag))
    k.room.face(list(reversed(pts)), 'leaf', col)           # wound so the face normal is the leaf's upper side

def fig(k, x, z, seed):
    """a fiddle-leaf fig in a tall dark pot (layout.js plant 'tall')"""
    r, PT = random.Random(seed), k.PT
    k.room.cyl(0.26, 0.2, 0.5, 18, T(x, PT + 0.25, z), 'solid', C['pot'], caps=(False, False))
    k.room.cyl(0.265, 0.265, 0.03, 18, T(x, PT + 0.5, z), 'solid', C['potRim'], caps=(False, True))
    k.room.cyl(0.24, 0.24, 0.01, 14, T(x, PT + 0.47, z), 'solid', C['soil'], caps=(False, True))
    pts = [Vector((x, PT + 0.45, z)), Vector((x + 0.03, PT + 1.0, z - 0.02)), Vector((x - 0.02, PT + 1.5, z + 0.03)), Vector((x + 0.02, PT + 1.95, z))]
    for a, b in zip(pts, pts[1:]):
        d = b - a; L = d.length; mid = (a + b) / 2
        k.room.cyl(0.026, 0.02, L, 6, T(mid.x, mid.y, mid.z, 0, math.atan2(d.z, d.y), -math.atan2(d.x, d.y)), 'solid', C['trunk'], caps=(False, False))
    n = 34
    for i in range(n):
        t = i / (n - 1); y = PT + 1.0 + t * 1.0
        az = i * 2.39996 + r.random() * 0.3
        j = min(2, int(t * 3)); a, b = pts[j], pts[j + 1]; f = (y - a.y) / max(1e-6, b.y - a.y)
        c = a + (b - a) * max(0, min(1, f))
        elev = 0.55 - 0.75 * (1 - t) + (r.random() - 0.5) * 0.3
        leaf(k, (c.x + math.cos(az) * 0.04, y, c.z - math.sin(az) * 0.04), az, elev, 0.26 + r.random() * 0.1 + 0.06 * (1 - t), 0.19 + r.random() * 0.04, (r.random() - 0.5) * 0.6, LEAVES[i % len(LEAVES)])

def small_plant(k, M, seed, scale=1.0):
    """a small pot plant (layout.js plant 'small'); M: the pot's base"""
    r = random.Random(seed); s = scale
    k.room.cyl(0.19 * s, 0.15 * s, 0.32 * s, 14, M @ T(0, 0.16 * s, 0), 'solid', C['potSmall'], caps=(False, False))
    k.room.cyl(0.175 * s, 0.175 * s, 0.01, 12, M @ T(0, 0.3 * s, 0), 'solid', C['soil'], caps=(False, True))
    o = M.to_translation()
    for i in range(16):
        az = i * 2.39996; elev = 0.9 - (i % 4) * 0.22 + (r.random() - 0.5) * 0.2
        leaf(k, (o.x + math.cos(az) * 0.03 * s, o.y + (0.33 + (i % 3) * 0.04) * s, o.z - math.sin(az) * 0.03 * s), az, elev, (0.2 + r.random() * 0.06) * s, 0.12 * s, (r.random() - 0.5) * 0.5, LEAVES[(i + 1) % len(LEAVES)])

def plants(k, seed0=31):
    """every plant the layout puts in the room (layout.js plants: 'tall' -> fig, otherwise a small pot plant)"""
    for i, p in enumerate(k.S['plants']):
        if p['kind'] == 'tall': fig(k, p['x'], p['z'], seed0 + i)
        else: small_plant(k, T(p['x'], k.PT, p['z']), seed0 + i)

# ---------------------------------------------------------------- Blender side: textures, materials, objects
def configure(look):
    """the floor's tile size and colour come from the look, because the page's procedural rooms use the same floor"""
    TEX['floor'][1] = look['floor']['tile']; TEX['floor'][2] = look['floor']['colour']

def load_textures(tex_dir):
    """the shared photo textures at 512 px, shifted to their target colours; packed, so the exporter writes them once"""
    out = {}
    for name, (fname, _scale, target) in TEX.items():
        src = bpy.data.images.load(os.path.join(tex_dir, fname), check_existing=True)
        src.scale(TEX_PX, TEX_PX)
        px = np.empty(TEX_PX * TEX_PX * 4, np.float32); src.pixels.foreach_get(px); px = px.reshape(-1, 4)
        if target:
            mean = px[:, :3].mean(axis=0); tgt = np.array(srgb(target), np.float32)
            px[:, :3] = np.clip(px[:, :3] / np.maximum(mean, 1e-3) * tgt, 0, 1)
        img = bpy.data.images.new(name, TEX_PX, TEX_PX, alpha=False); img.colorspace_settings.name = 'sRGB'
        img.pixels.foreach_set(px.ravel()); img.update(); img.pack()
        out[name] = img
        if src.users == 0: bpy.data.images.remove(src)
    return out

def make_material(name, teximg, colour=None):
    m = bpy.data.materials.new(name)
    try: m.use_nodes = True
    except Exception: pass
    nt = m.node_tree; bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 0.85
    if 'Specular IOR Level' in bsdf.inputs: bsdf.inputs['Specular IOR Level'].default_value = 0.25
    m.use_backface_culling = name != 'leaf'
    if name in ('solid', 'leaf'):
        vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
        nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    elif name == 'led':
        bsdf.inputs['Base Color'].default_value = (1, 0.85, 0.65, 1)
        bsdf.inputs['Emission Color'].default_value = (1, 0.72, 0.42, 1); bsdf.inputs['Emission Strength'].default_value = 0.0
    elif name in teximg:
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = teximg[name]
        uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'UVMap'
        nt.links.new(uvn.outputs['UV'], tex.inputs['Vector']); nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    else:                     # flat colour: decal (bake stand-in) and the themed wall/cap/skirting (set per bake mode)
        bsdf.inputs['Base Color'].default_value = (*(colour or lin('#9a958d')), 1)
    return m

def set_colour(m, hexcol):
    m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = (*lin(hexcol), 1)

def make_object(scene, name, mb, mats, lightmap):
    me = bpy.data.meshes.new(name)
    me.from_pydata([to_bl(p) for p in mb.v], [], mb.f); me.update()
    used = sorted(set(mb.m), key=lambda n: list(mats.keys()).index(n))
    for n in used: me.materials.append(mats[n])
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

def triangles(ob): return sum(len(p.vertices) - 2 for p in ob.data.polygons)
