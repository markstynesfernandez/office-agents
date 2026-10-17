# build-office.py — R3a: the baked office rooms, modelled from the shared library, lit and baked in Blender (headless).
# Run it through scripts/build-office.mjs, which passes the room specs (layout.js bakedRoomSpec), the shared look
# (floor, themed wall colours, atlas regions; from the page's own palette and textures.js) and the output folder:
#   blender -b --factory-startup --python scripts/blender/build-office.py -- --input I --out DIR --textures DIR
# Steps: each room is built from office_lib.py pieces by its recipe in office_rooms.py; the rooms' lightmap UVs are
# packed together into one atlas (one texel density for every room); a day and an evening atlas are baked in Cycles
# (each room baked on its own, far from the others, so they do not light or shade each other); then office.gltf,
# office.bin and the shared textures (textures/, written once for every room) are exported.
# Outputs (only into --out, checked): office.gltf, office.bin, textures/*.jpg, .build/lightmap-day.png and
# .build/lightmap-evening.png (8-bit, sRGB-encoded, scaled by 1/k; k in bake.json), .build/bake.json.
import bpy, sys, os, json, math, time, argparse
import numpy as np
from mathutils import Vector, Matrix

sys.dont_write_bytecode = True        # no __pycache__ next to the library
HERE = os.path.dirname(os.path.realpath(__file__))
if HERE not in sys.path: sys.path.insert(0, HERE)
import office_lib as lib
from office_rooms import RECIPES

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--input', required=True); ap.add_argument('--out', required=True); ap.add_argument('--textures', required=True)
ap.add_argument('--size', type=int, default=3072); ap.add_argument('--samples', type=int, default=1024)
A = ap.parse_args(argv)
OUT = os.path.realpath(A.out)
def out_path(name):
    p = os.path.realpath(os.path.join(OUT, name))
    if not p.startswith(OUT + os.sep): raise RuntimeError('refusing to write outside ' + OUT + ': ' + name)
    return p
def log(*a): print('[blender]', *a, flush=True)
T0 = time.perf_counter(); PHASES = {}
def phase(name, t): PHASES[name] = round(time.perf_counter() - t, 2); log(name, PHASES[name], 's')

IN = json.load(open(A.input, encoding='utf-8'))
LOOK, SPECS = IN['look'], IN['rooms']
lib.configure(LOOK)

# ---------------------------------------------------------------- model every room from the library (pure Python)
kits = []
for i, spec in enumerate(SPECS):
    if spec['kind'] not in RECIPES: raise RuntimeError('no recipe for room kind ' + spec['kind'])
    k = lib.Kit(spec, LOOK, 20261017 + 101 * i); RECIPES[spec['kind']](k); kits.append(k)
    log('modelled', spec['key'], '|', len(k.room.f), 'faces |', len(k.leds), 'LED strips |', len(k.bulbs), 'lamps')
phase('model', T0)

# ---------------------------------------------------------------- Blender scene: textures, materials, objects
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
t = time.perf_counter()
TEXIMG = lib.load_textures(A.textures)
phase('textures', t)
THEMED = ['cap', 'skirting'] + ['wall_' + k.key for k in kits]
MAT_ORDER = ['solid', 'leaf', 'oak', 'walnut', 'floor', 'fabric', 'rug', 'decal'] + THEMED + ['led']
MATS = {n: lib.make_material(n, TEXIMG) for n in MAT_ORDER}

SPACING = 60.0                     # rooms are baked far apart (directional sun: the light is the same for each)
rooms = []
t = time.perf_counter()
for i, k in enumerate(kits):
    off = Vector(lib.to_bl((i * SPACING, 0, 0)))
    ob = lib.make_object(scene, 'room_' + k.key, k.room, MATS, True); ob.location = off
    em = lib.make_object(scene, 'leds_' + k.key, k.em, MATS, False); em.location = off
    oc = lib.make_object(scene, 'occ_' + k.key, k.occ, MATS, False); oc.location = off
    rooms.append({'kit': k, 'ob': ob, 'em': em, 'occ': oc, 'off': i * SPACING})
TRIS = {r['kit'].key: lib.triangles(r['ob']) + lib.triangles(r['em']) for r in rooms}
log('triangles (exported):', TRIS)

# lightmap UVs: every room's LightMap layer unwrapped and packed together into one 0..1 atlas
bpy.ops.object.select_all(action='DESELECT')
for r in rooms:
    r['ob'].data.uv_layers.active = r['ob'].data.uv_layers['LightMap']; r['ob'].select_set(True)
bpy.context.view_layer.objects.active = rooms[0]['ob']
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
margin = 4.0 / A.size
try: bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, margin_method='FRACTION', margin=margin, shape_method='CONCAVE')
except TypeError: bpy.ops.uv.pack_islands(rotate=True, margin=margin)
bpy.ops.object.mode_set(mode='OBJECT')
for r in rooms: r['ob'].data.uv_layers.active = r['ob'].data.uv_layers['UVMap']
phase('uv', t)

# ---------------------------------------------------------------- lights: day (sun + sky), evening (LEDs, lamps, fill)
def add_light(name, kind, loc3, energy, color, **kw):
    li = bpy.data.lights.new(name, kind); li.energy = energy; li.color = color
    for key, v in kw.items(): setattr(li, key, v)
    ob = bpy.data.objects.new(name, li); scene.collection.objects.link(ob); ob.location = lib.to_bl(loc3); return ob
def aim(ob, emit3, along3=None):     # a light emits along its local -Z; along: its local X (area light length)
    z = -Vector(lib.to_bl(emit3)).normalized()
    x = Vector(lib.to_bl(along3)).normalized() if along3 else z.orthogonal().normalized()
    x = (x - z * x.dot(z)).normalized(); y = z.cross(x)
    ob.rotation_euler = Matrix((x, y, z)).transposed().to_euler()

DAYL, EVEL = LOOK['day'], LOOK['evening']
sun_dir = Vector((22, 17, 11)).normalized()       # office.js SUN_POS (R2): the same light direction as the live scene
sun = add_light('sun', 'SUN', (0, 0, 0), DAYL['sun'], lib.lin('#ffefd8'), angle=math.radians(4))
aim(sun, tuple(-sun_dir))
DAY, EVE = [sun], []
for r in rooms:
    k, ox = r['kit'], Vector((r['off'], 0, 0))
    for s in k.leds:
        a, b = Vector(s['a']) + ox, Vector(s['b']) + ox; L = (b - a).length; e = Vector(s['emit'])
        ob = add_light('led_' + k.key + '_' + s['kind'], 'AREA', tuple((a + b) / 2 + e * 0.01), lib.LED_W_PER_M[s['kind']] * L * EVEL['ledGain'], lib.lin('#ffb466'), shape='RECTANGLE', size=L, size_y=0.025)
        ob.data.spread = math.radians(150)
        aim(ob, tuple(e), tuple(b - a)); EVE.append(ob)
    for i, bp in enumerate(k.bulbs):
        ob = add_light('lamp_' + k.key + '_%d' % i, 'SPOT', tuple(Vector(bp) + ox), EVEL['lamp'], lib.lin('#ffc684'), spot_size=math.radians(115), spot_blend=0.6, shadow_soft_size=0.04)
        aim(ob, (0.12, -1, -0.25)); EVE.append(ob)

world = bpy.data.worlds.new('world'); scene.world = world
try: world.use_nodes = True
except Exception: pass
bg = world.node_tree.nodes.get('Background')
MODES = {'day': {'world': (lib.lin(DAYL['sky']), DAYL['skyStrength']), 'on': DAY}, 'evening': {'world': (lib.lin(EVEL['sky']), EVEL['skyStrength']), 'on': EVE}}
def set_mode(mode):
    m = MODES[mode]
    bg.inputs['Color'].default_value = (*m['world'][0], 1); bg.inputs['Strength'].default_value = m['world'][1]
    for ob in DAY + EVE: ob.hide_render = ob not in m['on']
    for name in THEMED: lib.set_colour(MATS[name], LOOK['themed'][mode][name])   # warm-white walls by day, dark by evening

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
log('device:', DEVICE, '| samples:', A.samples, '| atlas:', A.size)

def bake(mode):
    set_mode(mode)
    img = bpy.data.images.new('lm_' + mode, A.size, A.size, alpha=True, float_buffer=True)
    img.generated_color = (0, 0, 0, 0)
    nodes = []
    for name in MAT_ORDER:
        if name == 'led': continue
        m = MATS[name]; n = m.node_tree.nodes.new('ShaderNodeTexImage'); n.image = img; m.node_tree.nodes.active = n; nodes.append((m, n))
    bpy.ops.object.select_all(action='DESELECT')
    for r in rooms: r['ob'].select_set(True)
    bpy.context.view_layer.objects.active = rooms[0]['ob']
    t = time.perf_counter()
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, uv_layer='LightMap', margin=6, margin_type='EXTEND', use_clear=True, target='IMAGE_TEXTURES')
    phase('bake_' + mode, t)
    for m, n in nodes: m.node_tree.nodes.remove(n)
    px = np.empty(A.size * A.size * 4, np.float32); img.pixels.foreach_get(px)
    return px.reshape(-1, 4)

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

# ---------------------------------------------------------------- export: rooms and LED meshes at the origin (the page
# places each room at its corner of the floor plan); occluders and lights stay behind
t = time.perf_counter()
bpy.ops.object.select_all(action='DESELECT')
for r in rooms:
    for ob in (r['ob'], r['em']): ob.location = (0, 0, 0); ob.select_set(True)
for ob in DAY + EVE: ob.hide_render = True
opts = dict(filepath=out_path('office.gltf'), export_format='GLTF_SEPARATE', export_texture_dir='textures', use_selection=True,
            export_image_format='JPEG', export_image_quality=82, export_jpeg_quality=82, export_texcoords=True, export_normals=True,
            export_materials='EXPORT', export_vertex_color='MATERIAL', export_lights=False, export_cameras=False, export_yup=True,
            export_apply=False, export_extras=False)
bpy.ops.export_scene.gltf(**opts)
phase('export', t)

info = {'device': DEVICE, 'samples': A.samples, 'size': A.size, 'lightmaps': LM, 'triangles': TRIS, 'phases': PHASES,
        'rooms': {r['kit'].key: {'node': 'room_' + r['kit'].key, 'leds': 'leds_' + r['kit'].key, 'strips': r['kit'].leds} for r in rooms},
        'materials': {'textured': list(lib.TEX.keys()), 'vertexColour': ['solid', 'leaf'], 'decal': ['decal'], 'themed': THEMED, 'unlit': ['led']},
        'seconds': round(time.perf_counter() - T0, 2)}
with open(out_path('.build/bake.json'), 'w', encoding='utf-8') as f: json.dump(info, f, indent=2)
log('done in', info['seconds'], 's')
