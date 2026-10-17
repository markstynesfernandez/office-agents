# office_rooms.py — R3a, R3b: the baked areas, each a recipe of office_lib.py pieces placed from the area's spec (layout.js
# bakedRoomSpec: footprint, desks, chairs, plants and props in the area's own frame; the lounge's furniture and seats;
# the atrium's floor, walls, closet and props). R3a: Design and Office; R3b: Research, the lounge and the atrium.
# Decals (mood board, whiteboard, pictures) use regions of the page's own procedural atlas (textures.js ATLAS), passed
# in the look as UV rectangles, so the baked rooms show the same abstract artwork as the procedural ones.
import math
import office_lib as lib

def clusters(S):
    """one rug per row of desks, as layout.js draws them"""
    rows = {}
    for d in S['desks']: rows.setdefault(round(d['z'], 3), []).append(d)
    return [(min(d['x'] for d in ds) - 1.55, max(d['x'] for d in ds) + 1.55, ds[0]['z'] - 0.95, ds[0]['z'] + 1.55) for _, ds in sorted(rows.items())]

def research(k):
    """the Research library: a tall bookcase along the back wall, a reading nook on the left wall (leather armchair, arc
    floor lamp, side table, a framed picture and a lit wall shelf), oak desks on their rug, two figs"""
    S, A, PT = k.S, k.look['atlas'], k.PT
    lib.shell(k)
    lib.bookcase(k, 0.35, k.W - 1.2, 31 + int(k.W * 10))
    nook = {'x': 1.25, 'z': 2.75, 'yaw': -math.pi * 0.62}
    lib.armchair(k, nook, {'w': 0.9, 'cushionW': 0.66, 'cushionD': 0.66, 'cushionZ': -0.05, 'top': k.FLOOR + 0.45})
    lib.floor_lamp(k, 0.55, 1.55, nook['x'], nook['z'])
    lib.side_table(k, 2.25, 3.55)
    lib.frame(k, 'x', 2.9, PT + 1.75, 0.95, 1.2, A['art'][0])
    lib.wall_shelf(k, 'x', 1.35, 1.2, PT + 1.55, 41)
    for c in clusters(S): lib.rug(k, *c)
    for dk in S['desks']: lib.desk(k, dk)
    lib.plants(k)

def design(k):
    """dark-evening studio: an oak slat panel with the mood board over the desks, binder shelves, a gallery of framed
    abstract pictures over a credenza on the left wall, the easel, a fig and a small plant. R3b: the slat backing, the
    desk tops, drawer fronts and credenza are themed, so the light-mode room is brighter (pale backing and credenza, oak
    tops) while the evening keeps the dark backing, walnut and the dark credenza"""
    S, A, PT, WT = k.S, k.look['atlas'], k.PT, k.WT
    k.role.update({'deskTop': 'design_wood', 'drawer': 'design_wood', 'credenzaTop': 'design_wood', 'credenza': 'design_credenza', 'backing': 'design_backing'})
    lib.shell(k)
    xs = [d['x'] for d in S['desks']]
    px0, px1 = min(xs) - 1.1, max(xs) + 1.3
    front = lib.slat_panel(k, px0, px1)
    bu = (min(xs) + max(xs)) / 2
    lib.mood_board(k, 'z', bu, PT + 1.68, 3.8, 1.35, A['board'], v0=front - WT)
    lib.board_light(k, 'z', bu, PT + 2.43, 3.6, front - WT + 0.1)
    lib.binder_shelf(k, WT + 0.32, px0 - 0.25, PT + 1.42, WT, 13, depth=0.26)
    lib.binder_shelf(k, WT + 0.32, px0 - 0.25, PT + 1.92, WT, 17, depth=0.26)
    # left wall: a gallery of three framed pictures over a credenza
    lib.credenza(k, 'x', 2.6, 2.2, 47)
    lib.frame(k, 'x', 1.45, PT + 1.65, 1.05, 1.3, A['art'][1])
    lib.frame(k, 'x', 2.75, PT + 1.75, 0.8, 1.0, A['art'][2])
    if k.D > 4.6: lib.frame(k, 'x', 3.95, PT + 1.7, 0.7, 0.9, A['art'][4])
    for c in clusters(S): lib.rug(k, *c)
    for dk in S['desks']: lib.desk(k, dk)
    lib.plants(k)
    for pr in S['props']:
        if pr['kind'] == 'easel': lib.easel(k, pr, A['art'][3])

def office(k):
    """the Office: lockers and a framed picture on the left wall, the whiteboard and two lit book shelves on the back
    wall, oak desks in two rows on their rugs, the round meeting table with two stools, a fig and a small plant"""
    S, A, PT = k.S, k.look['atlas'], k.PT
    lib.shell(k)
    lib.locker(k, 'x', 1.05); lib.locker(k, 'x', 1.98)
    if k.D > 6:
        lib.frame(k, 'x', 4.4, PT + 1.68, 0.9, 1.15, A['art'][5])
        lib.wall_shelf(k, 'x', 6.6, 1.4, PT + 1.58, 61)
    xs = [d['x'] for d in S['desks']]
    u0, u1 = min(xs) - 1.05, max(xs) + 1.05
    wbw = min(3.0, u1 - u0 - 1.6); wbu = (u0 + u1) / 2 - 0.6
    lib.whiteboard(k, 'z', wbu, PT + 1.6, wbw, 1.3, A['white'])
    lib.wall_shelf(k, 'z', wbu + wbw / 2 + 1.0, 1.3, PT + 1.43, 53)
    lib.wall_shelf(k, 'z', wbu + wbw / 2 + 1.0, 1.3, PT + 2.03, 59)
    for c in clusters(S): lib.rug(k, *c)
    for dk in S['desks']: lib.desk(k, dk)
    lib.plants(k)
    for pr in S['props']:
        if pr['kind'] == 'meeting': lib.meeting(k, pr)

def lounge(k):
    """the lounge: the oak floor (no walls: it sits at the slab's front corner), a dark rug, an L of two three-seat sofas,
    two leather armchairs, the coffee table, an arc floor lamp and three figs. The seats are built from the layout's
    SOFA and ARMCHAIR numbers, so every cushion stays where the walkers sit (the seat-bounds test reads them back)"""
    S, F, PT, W, D = k.S, k.FLOOR, k.PT, k.W, k.D
    f = S['furniture']
    k.room.face([(0, PT, D), (W, PT, D), (W, PT, 0), (0, PT, 0)], 'floor', uvoff=(0.37, 0.19))
    k.room.face([(0, F, D), (W, F, D), (W, PT, D), (0, PT, D)], 'skirting')                 # floor edge, front
    k.room.face([(W, F, D), (W, F, 0), (W, PT, 0), (W, PT, D)], 'skirting')                 # floor edge, right
    r = f['rug']; lib.rug(k, r['x0'], r['x1'], r['z0'], r['z1'])
    lib.sofa(k, f['sofaA'], S['sofa']); lib.sofa(k, f['sofaB'], S['sofa'])
    lib.armchair(k, f['chair1'], S['armchair']); lib.armchair(k, f['chair2'], S['armchair'])
    lib.coffee_table(k, f['table'])
    lib.floor_lamp(k, f['lamp']['x'], f['lamp']['z'], f['table']['x'], f['table']['z'])
    lib.plants(k, 51)

def atrium(k):
    """the atrium: the slab, polished concrete outside the rooms and the lounge, the memory core's plinth (the crystal
    and its glow stay real-time), the atrium walls with a picture, a lit shelf and two clocks, the printer and the water
    cooler, five benches, plants, and the services closet (its cabinets and status lights stay real-time). The walls of
    the rooms round it are bake-only occluders, so they still shade the atrium floor"""
    S, A, F = k.S, k.look['atlas'], k.FLOOR
    lib.slab(k)
    lib.concrete_floor(k, S['floorRects'])
    lib.plinth(k, S['core']['x'], S['core']['z'], S['coreR'])
    for w in S['walls']:
        if w['owner'] == 'atrium': lib.wall_run(k, w, k.wall, F)
    for w in S['occluders']: lib.occluder_wall(k, w)
    pr = {p['kind']: p for p in S['props'] if p['kind'] in ('printer', 'cooler')}
    if 'printer' in pr:
        lib.frame(k, 'z', pr['printer']['x'], F + 2.08, 0.72, 0.5, A['art'][4])
        lib.wall_shelf(k, 'z', pr['printer']['x'], 1.0, F + 1.36, 67)
    if 'cooler' in pr: lib.clock(k, 'z', pr['cooler']['x'] + 0.05, F + 2.05)
    left = next((w for w in S['walls'] if w['owner'] == 'atrium' and w['axis'] == 'x'), None)
    if left:
        um = (left['from'] + left['to']) / 2
        lib.frame(k, 'x', um - 0.25, F + 1.6, 1.1, 0.75, A['art'][5])
        lib.clock(k, 'x', um + 0.95, F + 1.95)
    for p in S['props']: {'bench': lib.bench, 'printer': lib.printer, 'cooler': lib.cooler}[p['kind']](k, p)
    lib.plants(k, 71, F)
    lib.closet(k, S['closet'], next(w for w in S['walls'] if w['owner'] == 'closet'))

RECIPES = {'research': research, 'design': design, 'office': office, 'lounge': lounge, 'atrium': atrium}
