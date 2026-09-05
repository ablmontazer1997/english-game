# Runecast saga-map scene builder (Blender 4.2, headless).
# usage: blender --background --python build_scene.py -- layout.json outdir [scale]
# Reads a layout JSON (ground plane in "map units": x 0..100 left->right, y 0..100 bottom->top,
# matching CSS percent coordinates of the map canvas), builds terrain + road, places Hunyuan3D
# props, renders layered PNGs with a fixed three-quarter orthographic camera and writes
# nodes.json with the exact 2D pixel coordinates of every level node.
import bpy, bmesh, json, math, os, sys
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:]
LAYOUT = json.load(open(argv[0])); OUT = argv[1]; SCALE = float(argv[2]) if len(argv) > 2 else 1.0
os.makedirs(OUT, exist_ok=True)
ASSETS = LAYOUT.get("assets_dir", "/numa1/blender_work/runecast/map/out")
W, H = LAYOUT.get("canvas", [1080, 2340])          # design canvas in px
UNIT = 0.1                                           # 1 map unit = 0.1 m  -> map is 10 m wide
MAPW, MAPH = 10.0, 10.0 * H / W                      # ground extent in meters
TILT = math.radians(LAYOUT.get("camera_tilt", 55))   # camera elevation angle from horizontal

# ---------- scene reset ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"
sc.cycles.samples = LAYOUT.get("samples", 96); sc.cycles.use_denoising = True
sc.render.resolution_x = int(W * SCALE); sc.render.resolution_y = int(H * SCALE)
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Standard"

def mat(name, rgb, rough=0.85, bump=0.0, noise_scale=8.0, sss=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    if sss and "Subsurface Weight" in b.inputs:
        b.inputs["Subsurface Weight"].default_value = sss
    if bump:
        nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = noise_scale
        nz.inputs["Detail"].default_value = 4
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump
        nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

M_GRASS = mat("grass", (0.46, 0.74, 0.18), 0.9, bump=0.18, noise_scale=10, sss=0.1)
M_CLIFF = mat("cliff", (0.78, 0.46, 0.18), 0.9, bump=0.5, noise_scale=6)
M_ROAD  = mat("road",  (0.87, 0.75, 0.52), 0.95, bump=0.12, noise_scale=20)
M_DOT   = mat("dot",   (0.98, 0.97, 0.92), 0.8)
M_WATER = mat("water", (0.35, 0.75, 0.95), 0.15, bump=0.2, noise_scale=12)

def to_world(x, y):   # map units -> world meters (map centered at origin)
    return ((x / 100.0 - 0.5) * MAPW, (y / 100.0 - 0.5) * MAPH)

# ---------- terrain slabs ----------
def slab(name, x0, y0, x1, y1, z0, z1, top=M_GRASS, side=M_CLIFF, bevel=0.35):
    wx0, wy0 = to_world(x0, y0); wx1, wy1 = to_world(x1, y1)
    bpy.ops.mesh.primitive_cube_add(location=((wx0 + wx1) / 2, (wy0 + wy1) / 2, (z0 + z1) / 2))
    o = bpy.context.active_object; o.name = name
    o.scale = ((wx1 - wx0) / 2, (wy1 - wy0) / 2, (z1 - z0) / 2)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(side); o.data.materials.append(top)
    for p in o.data.polygons:
        p.material_index = 1 if p.normal.z > 0.5 else 0
    bv = o.modifiers.new("bevel", "BEVEL"); bv.width = bevel; bv.segments = 6
    sd = o.modifiers.new("sub", "SUBSURF"); sd.levels = 2; sd.render_levels = 2
    bpy.ops.object.shade_smooth()
    o["layer"] = "terrain"
    return o

terrain_objs = []
for s in LAYOUT.get("slabs", [{"box": [0, 0, 100, 100], "z": [-1.2, 0.0]}]):
    x0, y0, x1, y1 = s["box"]; z0, z1 = s["z"]
    terrain_objs.append(slab("slab", x0, y0, x1, y1, z0, z1, bevel=s.get("bevel", 0.35)))
for wtr in LAYOUT.get("water", []):
    x0, y0, x1, y1 = wtr["box"]
    o = slab("water", x0, y0, x1, y1, wtr.get("z", -0.35) - 0.05, wtr.get("z", -0.35), top=M_WATER, side=M_WATER, bevel=0.05)

# ---------- road (bezier ribbon on the ground) ----------
def make_curve(name, pts, z):
    cd = bpy.data.curves.new(name, "CURVE"); cd.dimensions = "3D"
    sp = cd.splines.new("BEZIER"); sp.bezier_points.add(len(pts) - 1)
    for bp, (x, y) in zip(sp.bezier_points, pts):
        wx, wy = to_world(x, y); bp.co = (wx, wy, z); bp.handle_left_type = bp.handle_right_type = "AUTO"
    sp.resolution_u = 24
    ob = bpy.data.objects.new(name, cd); sc.collection.objects.link(ob); return ob

road_pts = LAYOUT.get("road", [[50, 4], [40, 22], [62, 40], [42, 58], [58, 76], [50, 92]])
ROAD_Z = LAYOUT.get("road_z", 0.0)
road_curve = make_curve("road_curve", road_pts, ROAD_Z)
dep = bpy.context.evaluated_depsgraph_get()
def road_samples():
    dep.update(); me = road_curve.evaluated_get(dep).to_mesh()
    pts = [road_curve.matrix_world @ v.co for v in me.vertices]
    road_curve.evaluated_get(dep).to_mesh_clear()
    acc = [0.0]
    for a, b in zip(pts, pts[1:]): acc.append(acc[-1] + (b - a).length)
    return pts, acc
RPTS, RACC = road_samples()
road_curve.hide_render = True; road_curve.hide_viewport = True
def road_at(t):
    L = RACC[-1] * t
    for i in range(1, len(RACC)):
        if RACC[i] >= L:
            f = (L - RACC[i - 1]) / max(RACC[i] - RACC[i - 1], 1e-6)
            return RPTS[i - 1].lerp(RPTS[i], f)
    return RPTS[-1]

# flat ribbon mesh: offset each sample perpendicular (in XY) by half the road width
half = LAYOUT.get("road_width", 6) * UNIT / 2
bm = bmesh.new(); prev = None
for i, p in enumerate(RPTS):
    a = RPTS[max(i - 1, 0)]; b = RPTS[min(i + 1, len(RPTS) - 1)]
    d = Vector((b.x - a.x, b.y - a.y, 0)).normalized(); n = Vector((-d.y, d.x, 0))
    l = bm.verts.new((p.x + n.x * half, p.y + n.y * half, ROAD_Z)); r = bm.verts.new((p.x - n.x * half, p.y - n.y * half, ROAD_Z))
    if prev: bm.faces.new((prev[0], prev[1], r, l))
    prev = (l, r)
rm = bpy.data.meshes.new("road"); bm.to_mesh(rm); bm.free()
road = bpy.data.objects.new("road", rm); sc.collection.objects.link(road)
road.data.materials.append(M_ROAD); road["layer"] = "terrain"
sol = road.modifiers.new("sol", "SOLIDIFY"); sol.thickness = 0.07; sol.offset = 1
bv = road.modifiers.new("bev", "BEVEL"); bv.width = 0.03; bv.segments = 3
bpy.context.view_layer.objects.active = road; road.select_set(True); bpy.ops.object.shade_smooth()

# stepping dots along the road
for i in range(1, int(RACC[-1] / (LAYOUT.get("dot_spacing", 3.2) * UNIT))):
    p = road_at(i * LAYOUT.get("dot_spacing", 3.2) * UNIT / RACC[-1])
    bpy.ops.mesh.primitive_cylinder_add(radius=0.9 * UNIT, depth=0.03, location=(p.x, p.y, ROAD_Z + 0.085), vertices=24)
    d = bpy.context.active_object; d.data.materials.append(M_DOT); d["layer"] = "terrain"
    bv = d.modifiers.new("b", "BEVEL"); bv.width = 0.012; bv.segments = 3; bpy.ops.object.shade_smooth()

# ---------- props ----------
_cache = {}
def load_prop(asset):
    for suf in ("_tex.glb", "_shape.glb"):
        f = os.path.join(ASSETS, asset + suf)
        if os.path.exists(f): break
    else:
        print("MISSING ASSET", asset); return None
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    new = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    for o in new: o.select_set(True)
    bpy.context.view_layer.objects.active = new[0]
    if len(new) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    o.location = (0, 0, 0); bpy.ops.object.shade_smooth()
    for m in o.data.materials:
        if m and m.use_nodes:
            b = m.node_tree.nodes.get("Principled BSDF")
            if b:
                b.inputs["Roughness"].default_value = 0.75
                if "Metallic" in b.inputs: b.inputs["Metallic"].default_value = 0.0
    # sit on z=0: shift so min z = 0
    zmin = min((o.matrix_world @ v.co).z for v in o.data.vertices)
    o.location.z = -zmin; bpy.ops.object.transform_apply(location=True)
    o.hide_render = True; o.hide_viewport = True
    return o

def place(asset, x, y, h, rot=0, ground=0.0, layer="props"):
    src = _cache.get(asset) or _cache.setdefault(asset, load_prop(asset))
    if src is None: return None
    o = src.copy(); o.data = src.data; sc.collection.objects.link(o)
    o.hide_render = False; o.hide_viewport = False
    # h = target size of the prop's LARGEST extent, in map units (works for flat discs and tall trees alike)
    s = (h * UNIT) / max(max(o.dimensions), 1e-6)
    o.scale = (s, s, s); o.rotation_euler = (0, 0, math.radians(rot))
    wx, wy = to_world(x, y); o.location = (wx, wy, ground)
    o["layer"] = layer
    return o

for p in LAYOUT.get("props", []):
    place(p["asset"], p["x"], p["y"], p.get("h", 12), p.get("rot", 0), p.get("z", 0.0))

# ---------- nodes (level tokens) ----------
nodes = []
node_layer = []
for i, nd in enumerate(LAYOUT.get("nodes", [])):
    t = nd["t"]; p = road_at(t)
    tok = place(nd.get("asset", "token_blue"), 0, 0, nd.get("h", 7), 0, layer="nodes")
    if tok: tok.location = (p.x, p.y, ROAD_Z + 0.07); node_layer.append(tok)
    nodes.append({"id": i + 1, "t": t, "world": [p.x, p.y, ROAD_Z]})

# ---------- camera + light ----------
cam_d = bpy.data.cameras.new("cam"); cam_d.type = "ORTHO"
cam = bpy.data.objects.new("cam", cam_d); sc.collection.objects.link(cam); sc.camera = cam
dist = 40.0
cam.location = (0, -dist * math.cos(TILT), dist * math.sin(TILT))
cam.rotation_euler = (math.pi / 2 - TILT, 0, 0)
# fit the whole ground rect into the frame
foot_h = MAPH * math.sin(TILT)                    # projected height of the ground rect
# Blender's ortho_scale is the size of the LARGER frame side (height, for a portrait canvas)
cam_d.ortho_scale = max(foot_h, MAPW * H / W) * LAYOUT.get("frame_pad", 1.02)
cam_d.shift_y = LAYOUT.get("cam_shift_y", 0.0)

sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 2.6; sun.angle = math.radians(12)
so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so)
so.rotation_euler = (math.radians(50), math.radians(-18), math.radians(35))
fill = bpy.data.lights.new("fill", "AREA"); fill.energy = 900; fill.size = 30
fo = bpy.data.objects.new("fill", fill); sc.collection.objects.link(fo)
fo.location = (-12, -18, 25); fo.rotation_euler = (math.radians(35), math.radians(-25), 0)
wd = bpy.data.worlds.new("w"); wd.use_nodes = True
wd.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.8, 0.95, 1)
wd.node_tree.nodes["Background"].inputs[1].default_value = 0.9; sc.world = wd

# ---------- node 2D coords ----------
RX, RY = sc.render.resolution_x, sc.render.resolution_y
for nd, tok in zip(nodes, node_layer or [None] * len(nodes)):
    v = world_to_camera_view(sc, cam, Vector(nd["world"]))
    nd["px"] = [round(v.x * RX, 1), round((1 - v.y) * RY, 1)]
    nd["pct"] = [round(v.x * 100, 2), round((1 - v.y) * 100, 2)]
    if tok:
        # projected token height in px (for sizing sprites in the web)
        top = world_to_camera_view(sc, cam, tok.location + Vector((0, 0, tok.dimensions.z)))
        right = world_to_camera_view(sc, cam, tok.location + Vector((tok.dimensions.x / 2, 0, 0)))
        nd["token_px_h"] = round((top.y - v.y) * RY, 1)
        nd["token_px_w"] = round((right.x - v.x) * 2 * RX, 1)
json.dump({"canvas": [RX, RY], "nodes": nodes, "tilt": math.degrees(TILT)}, open(os.path.join(OUT, "nodes.json"), "w"), indent=1)

# ---------- layered renders ----------
all_objs = [o for o in sc.objects if o.type == "MESH" and not o.hide_render]
def render(name, visible_layers, holdout_layers=()):
    for o in all_objs:
        L = o.get("layer", "")
        o.hide_render = L not in visible_layers and L not in holdout_layers
        o.is_holdout = L in holdout_layers
    sc.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("LAYER_DONE", name, flush=True)

layers = LAYOUT.get("render_layers", ["full", "terrain", "props"])
if "full" in layers:    render("full", {"terrain", "props", "nodes"})
if "terrain" in layers: render("terrain", {"terrain"})
if "props" in layers:   render("props", {"props"}, holdout_layers={"terrain"})
if "nodes" in layers:   render("nodes", {"nodes"}, holdout_layers={"terrain", "props"})
print("SCENE_DONE", OUT, flush=True)
