# office_rooms.py — R3a: the baked rooms, each a recipe of office_lib.py pieces placed from the room's spec (layout.js
# bakedRoomSpec: footprint, desks, chairs, plants and props in the room's own frame). Phase 1: Design and Office.
# Decals (mood board, whiteboard, pictures) use regions of the page's own procedural atlas (textures.js ATLAS), passed
# in the look as UV rectangles, so the baked rooms show the same abstract artwork as the procedural ones.
import office_lib as lib

def clusters(S):
    """one rug per row of desks, as layout.js draws them"""
    rows = {}
    for d in S['desks']: rows.setdefault(round(d['z'], 3), []).append(d)
    return [(min(d['x'] for d in ds) - 1.55, max(d['x'] for d in ds) + 1.55, ds[0]['z'] - 0.95, ds[0]['z'] + 1.55) for _, ds in sorted(rows.items())]

def design(k):
    """dark-evening studio: an oak slat panel with the mood board over the desks, binder shelves, a gallery of framed
    abstract pictures over a credenza on the left wall, walnut desks, the easel, a fig and a small plant"""
    S, A, PT, WT = k.S, k.look['atlas'], k.PT, k.WT
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
    for dk in S['desks']: lib.desk(k, dk, top='walnut')
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
    for dk in S['desks']: lib.desk(k, dk, top='oak')
    lib.plants(k)
    for pr in S['props']:
        if pr['kind'] == 'meeting': lib.meeting(k, pr)

RECIPES = {'design': design, 'office': office}
