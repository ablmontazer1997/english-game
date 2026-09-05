# Runecast saga-map GROUND builder (Blender 4.2, headless).
# usage: blender --background --python build_ground.py -- ground.json outdir [scale] [samples]
#
# The reference is a CONTINUOUS rolling landscape seen from a three-quarter FRONT camera:
# grass hills rising into the distance, a river carved through them, localized rock cliffs
# (river banks, the cottage hill) and a dirt path winding up the middle. So the terrain is one
# displaced heightfield -- not a staircase of slabs -- with "plateau" objects (a grass lip
# drooping over layered rock) added only where the reference actually shows a cliff.
#
# Map coords are percent: x 0..100 left->right, y 0..100 near->far (y grows INTO the screen).
import bpy, bmesh, json, math, os, sys, random
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
CFG = json.load(open(argv[0])); OUT = argv[1]
SCALE = float(argv[2]) if len(argv) > 2 else 1.0
SAMPLES = int(argv[3]) if len(argv) > 3 else CFG.get("samples", 128)
os.makedirs(OUT, exist_ok=True)

W, H = CFG.get("canvas", [1080, 2340])
MAPW = CFG.get("map_width", 16.0)          # world metres across x 0..100
MAPD = CFG.get("map_depth", 27.0)          # world metres across y 0..100 (into the screen)

def wx(x): return (x / 100.0 - 0.5) * MAPW
def wy(y): return (y / 100.0) * MAPD
def to_world(x, y): return (wx(x), wy(y))

# ---------------- scene ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"
sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 3
sc.render.resolution_x = int(W * SCALE); sc.render.resolution_y = int(H * SCALE)
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Standard"

# ---------------- materials ----------------
def new_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes["Principled BSDF"]

def noise_bump(nt, bsdf, scale, strength, detail=6):
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = detail
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = strength
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], bsdf.inputs["Normal"])

def grass_colour(nt):
    """Three-tone stylised grass: broad patches plus a finer break-up."""
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 1.6
    nz.inputs["Detail"].default_value = 5; nz.inputs["Roughness"].default_value = 0.55
    fine = nt.nodes.new("ShaderNodeTexNoise"); fine.inputs["Scale"].default_value = 11.0
    fine.inputs["Detail"].default_value = 4
    blend = nt.nodes.new("ShaderNodeMix"); blend.data_type = "FLOAT"
    blend.inputs["Factor"].default_value = 0.28
    nt.links.new(nz.outputs["Fac"], blend.inputs[2])
    nt.links.new(fine.outputs["Fac"], blend.inputs[3])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].position = 0.30; cr.elements[0].color = (0.13, 0.36, 0.05, 1)
    cr.elements[1].position = 0.72; cr.elements[1].color = (0.55, 0.83, 0.19, 1)
    e = cr.elements.new(0.52); e.color = (0.31, 0.62, 0.10, 1)
    nt.links.new(blend.outputs[0], ramp.inputs["Fac"])
    return ramp.outputs["Color"]

def mat_terrain():
    """Grass where the ground is flat, tan rock where it is steep (banks, hill sides)."""
    m, nt, b = new_mat("terrain")
    b.inputs["Roughness"].default_value = 0.93
    if "Subsurface Weight" in b.inputs:
        b.inputs["Subsurface Weight"].default_value = 0.10
        b.inputs["Subsurface Radius"].default_value = (0.4, 0.7, 0.2)
    grass = grass_colour(nt)
    rnz = nt.nodes.new("ShaderNodeTexNoise"); rnz.inputs["Scale"].default_value = 5.0
    rnz.inputs["Detail"].default_value = 6
    rramp = nt.nodes.new("ShaderNodeValToRGB")
    rramp.color_ramp.elements[0].position = 0.35
    rramp.color_ramp.elements[0].color = (0.66, 0.36, 0.13, 1)
    rramp.color_ramp.elements[1].position = 0.70
    rramp.color_ramp.elements[1].color = (0.90, 0.68, 0.38, 1)
    nt.links.new(rnz.outputs["Fac"], rramp.inputs["Fac"])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Normal"], sep.inputs["Vector"])
    lo, hi = CFG.get("rock_slope", [0.62, 0.88])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = lo; mr.inputs["From Max"].default_value = hi
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    nt.links.new(mr.outputs["Result"], mix.inputs["Factor"])
    nt.links.new(rramp.outputs["Color"], mix.inputs[6])   # steep -> rock
    nt.links.new(grass, mix.inputs[7])                    # flat  -> grass
    nt.links.new(mix.outputs[2], b.inputs["Base Color"])
    noise_bump(nt, b, 40, 0.14)
    return m

def mat_grass_cap():
    m, nt, b = new_mat("grass_cap")
    b.inputs["Roughness"].default_value = 0.93
    if "Subsurface Weight" in b.inputs: b.inputs["Subsurface Weight"].default_value = 0.10
    nt.links.new(grass_colour(nt), b.inputs["Base Color"])
    noise_bump(nt, b, 45, 0.13)
    return m

def mat_rock(z_top=0.0, band=1.9, tag=""):
    """Layered cliff strata mapped to the metre band just under this cliff's rim."""
    m, nt, b = new_mat("rock" + tag)
    b.inputs["Roughness"].default_value = 0.95
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = z_top - band
    mr.inputs["From Max"].default_value = z_top + 0.08
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nzs = nt.nodes.new("ShaderNodeTexNoise"); nzs.inputs["Scale"].default_value = 3.2
    nzs.inputs["Detail"].default_value = 3
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "FLOAT"
    mix.inputs["Factor"].default_value = 0.16
    nt.links.new(mr.outputs["Result"], mix.inputs[2])
    nt.links.new(nzs.outputs["Fac"], mix.inputs[3])
    ramp = nt.nodes.new("ShaderNodeValToRGB"); cr = ramp.color_ramp
    cr.elements[0].position = 0.00; cr.elements[0].color = (0.60, 0.30, 0.10, 1)
    cr.elements[1].position = 1.00; cr.elements[1].color = (0.95, 0.87, 0.68, 1)
    for pos, col in [(0.30, (0.83, 0.48, 0.17, 1)), (0.58, (0.91, 0.65, 0.32, 1)),
                     (0.80, (0.94, 0.78, 0.52, 1))]:
        e = cr.elements.new(pos); e.color = col
    nt.links.new(mix.outputs[0], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    noise_bump(nt, b, 16, 0.32, detail=8)
    return m

def mat_simple(name, rgb, rough, bump=None):
    m, nt, b = new_mat(name)
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    if bump: noise_bump(nt, b, *bump)
    return m

def mat_dirt():
    m, nt, b = new_mat("dirt")
    b.inputs["Roughness"].default_value = 0.97
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 8
    nz.inputs["Detail"].default_value = 5
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.36; ramp.color_ramp.elements[0].color = (0.68, 0.52, 0.28, 1)
    ramp.color_ramp.elements[1].position = 0.70; ramp.color_ramp.elements[1].color = (0.88, 0.76, 0.50, 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    noise_bump(nt, b, 35, 0.16)
    return m

def mat_water():
    m, nt, b = new_mat("water")
    b.inputs["Base Color"].default_value = (0.30, 0.76, 0.94, 1)
    b.inputs["Roughness"].default_value = 0.06
    if "Transmission Weight" in b.inputs: b.inputs["Transmission Weight"].default_value = 0.30
    noise_bump(nt, b, 22, 0.14)
    return m

M_TERRAIN, M_CAP = mat_terrain(), mat_grass_cap()
M_DIRT, M_WATER = mat_dirt(), mat_water()
M_STONE = mat_simple("stone", (0.66, 0.64, 0.60), 0.9, (20, 0.30))
M_FAR = mat_simple("far_hills", (0.55, 0.75, 0.63), 1.0)

# ---------------- curve helpers ----------------
def catmull(pts, per_seg, closed=False):
    n = len(pts); out = []
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[(i - 1) % n] if closed else pts[max(i - 1, 0)]
        p1 = pts[i % n]; p2 = pts[(i + 1) % n] if closed else pts[i + 1]
        p3 = pts[(i + 2) % n] if closed else pts[min(i + 2, n - 1)]
        for s in range(per_seg):
            t = s / per_seg; t2, t3 = t * t, t * t * t
            x = 0.5 * ((2*p1[0]) + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3)
            y = 0.5 * ((2*p1[1]) + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
            out.append((x, y))
    if not closed: out.append(pts[-1])
    return out

def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    L = vx * vx + vy * vy
    t = 0.0 if L < 1e-12 else max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / L))
    return math.hypot(px - (ax + vx * t), py - (ay + vy * t))

def smoothstep(t):
    t = max(0.0, min(1.0, t)); return t * t * (3 - 2 * t)

# ---------------- height field ----------------
RIVER_LINES = [(catmull([to_world(*p) for p in r["path"]], 16), r) for r in CFG.get("rivers", [])]
MOUNDS = CFG.get("mounds", [])
SLOPE = CFG.get("slope_gain", 3.2)
ROLL = CFG.get("roll_amp", 0.45)

def height(x, y):
    ny = max(y, 0.0) / MAPD
    z = SLOPE * (ny ** 1.25)
    z += noise.noise((x * 0.10, y * 0.10, 0.0)) * ROLL
    z += noise.noise((x * 0.28, y * 0.28, 3.3)) * ROLL * 0.35
    for m in MOUNDS:
        mx, my = to_world(m["x"], m["y"])
        d2 = ((x - mx) / m.get("rx", 4.0)) ** 2 + ((y - my) / m.get("ry", 4.0)) ** 2
        z += m["h"] * math.exp(-d2 * 2.2)
    for line, rv in RIVER_LINES:
        w = rv.get("width", 10) / 100.0 * MAPW
        reach = w * rv.get("bank", 1.9)
        d = 1e9
        for a, b in zip(line, line[1:]):
            dd = seg_dist(x, y, a[0], a[1], b[0], b[1])
            if dd < d:
                d = dd
                if d < 1e-6: break
        if d < reach:
            z -= rv.get("carve", 1.5) * (1.0 - smoothstep(d / reach))
    return z

GRID = CFG.get("grid", [190, 300])
EXT = CFG.get("extent", {"x0": -95, "x1": 195, "y0": -30, "y1": 135})
bm = bmesh.new()
nx, nyy = GRID
x0, x1 = wx(EXT["x0"]), wx(EXT["x1"]); y0, y1 = wy(EXT["y0"]), wy(EXT["y1"])
rows_v = []
for j in range(nyy + 1):
    row = []
    for i in range(nx + 1):
        x = x0 + (x1 - x0) * i / nx; y = y0 + (y1 - y0) * j / nyy
        row.append(bm.verts.new((x, y, height(x, y))))
    rows_v.append(row)
for j in range(nyy):
    for i in range(nx):
        bm.faces.new((rows_v[j][i], rows_v[j][i+1], rows_v[j+1][i+1], rows_v[j+1][i]))
me = bpy.data.meshes.new("terrain"); bm.to_mesh(me); bm.free()
terrain = bpy.data.objects.new("terrain", me); sc.collection.objects.link(terrain)
terrain.data.materials.append(M_TERRAIN); terrain["layer"] = "terrain"
bpy.context.view_layer.objects.active = terrain; terrain.select_set(True)
bpy.ops.object.shade_smooth(); terrain.select_set(False)
print("TERRAIN_BUILT", flush=True)

# ---------------- cliff plateaus (grass lip over layered rock) ----------------
def ring_normals(ring):
    n = len(ring)
    area = sum(ring[i][0]*ring[(i+1) % n][1] - ring[(i+1) % n][0]*ring[i][1] for i in range(n))
    sgn = 1.0 if area > 0 else -1.0
    out = []
    for i in range(n):
        a, b = ring[(i-1) % n], ring[(i+1) % n]
        t = Vector((b[0]-a[0], b[1]-a[1]))
        t = t.normalized() if t.length > 1e-9 else Vector((1, 0))
        out.append(Vector((t.y, -t.x)) * sgn)
    return out

def wobble(ring, seed, amp, freq=3.0):
    nrm = ring_normals(ring); off = random.Random(seed).random() * 100
    n = len(ring); out = []
    for i, (p, nv) in enumerate(zip(ring, nrm)):
        a = i / n * math.tau
        d = noise.noise((math.cos(a)*freq + off, math.sin(a)*freq + off, seed*0.7)) * amp
        out.append((p[0] + nv.x*d, p[1] + nv.y*d))
    return out

def plateau(name, outline_pct, z_top, depth, drip=0.30, seed=1, wob=0.35, rib=0.10, undulate=0.05):
    ring = wobble(catmull([to_world(*p) for p in outline_pct], 14, closed=True), seed, wob)
    nrm = ring_normals(ring); n = len(ring)
    cx = sum(p[0] for p in ring)/n; cy = sum(p[1] for p in ring)/n

    bm = bmesh.new(); levels = []
    for f, bulge in [(0.0, 0.0), (0.28, 0.55), (0.60, 0.62), (0.85, 0.30), (1.0, -0.15)]:
        z = z_top - depth*f; rv = []
        for i in range(n):
            a = i/n*math.tau
            r = noise.noise((math.cos(a)*9.0 + seed, math.sin(a)*9.0 + seed, f*2.0))
            d = rib*(0.5 + 0.5*r) + bulge*rib*2.2
            rv.append(bm.verts.new((ring[i][0] + nrm[i].x*d, ring[i][1] + nrm[i].y*d, z)))
        levels.append(rv)
    for lo, hi in zip(levels, levels[1:]):
        for i in range(n):
            j = (i+1) % n; bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    ct = bm.verts.new((cx, cy, z_top))
    for i in range(n): bm.faces.new((levels[0][i], levels[0][(i+1) % n], ct))
    cb = bm.verts.new((cx, cy, z_top - depth*1.05))
    for i in range(n): bm.faces.new((levels[-1][(i+1) % n], levels[-1][i], cb))
    me = bpy.data.meshes.new(name+"_rock"); bm.to_mesh(me); bm.free()
    rock = bpy.data.objects.new(name+"_rock", me); sc.collection.objects.link(rock)
    rock.data.materials.append(mat_rock(z_top, band=min(depth, 2.1), tag="_" + name))
    rock["layer"] = "terrain"
    bpy.context.view_layer.objects.active = rock; rock.select_set(True)
    try: bpy.ops.object.shade_auto_smooth(angle=math.radians(50))
    except Exception: bpy.ops.object.shade_smooth()
    rock.select_set(False)

    bm = bmesh.new()
    drips = [drip * (0.55 + 0.75*abs(noise.noise((math.cos(i/n*math.tau)*4 + seed*3,
                                                  math.sin(i/n*math.tau)*4 + seed*3, 1.3))))
             for i in range(n)]
    rings = []
    for k, (off, dz) in enumerate([(0.00, 0.055), (0.085, -0.02), (0.055, None), (-0.09, None)]):
        rv = []
        for i in range(n):
            z = (z_top + dz) if dz is not None else (
                z_top - drips[i]*(0.85 if k == 2 else 1.0) - (0.06 if k == 3 else 0.0))
            rv.append(bm.verts.new((ring[i][0] + nrm[i].x*off, ring[i][1] + nrm[i].y*off, z)))
        rings.append(rv)
    for lo, hi in zip(rings, rings[1:]):
        for i in range(n):
            j = (i+1) % n; bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    inner = rings[0]
    for step in (0.55, 0.25):
        cur = []
        for i in range(n):
            px = cx + (ring[i][0]-cx)*step; py = cy + (ring[i][1]-cy)*step
            cur.append(bm.verts.new((px, py, z_top + 0.055 + noise.noise((px*0.5, py*0.5, seed))*undulate)))
        for i in range(n):
            j = (i+1) % n; bm.faces.new((inner[i], inner[j], cur[j], cur[i]))
        inner = cur
    cg = bm.verts.new((cx, cy, z_top + 0.055 + noise.noise((cx, cy, seed))*undulate))
    for i in range(n): bm.faces.new((inner[i], inner[(i+1) % n], cg))
    cu = bm.verts.new((cx, cy, z_top - max(drips) - 0.1))
    for i in range(n): bm.faces.new((rings[-1][(i+1) % n], rings[-1][i], cu))
    me = bpy.data.meshes.new(name+"_grass"); bm.to_mesh(me); bm.free()
    grass = bpy.data.objects.new(name+"_grass", me); sc.collection.objects.link(grass)
    grass.data.materials.append(M_CAP); grass["layer"] = "terrain"
    bpy.context.view_layer.objects.active = grass; grass.select_set(True)
    bpy.ops.object.shade_smooth(); grass.select_set(False)

for p in CFG.get("plateaus", []):
    plateau(p.get("name", "plat"), p["outline"], p["z"], p.get("depth", 2.4),
            drip=p.get("drip", 0.30), seed=p.get("seed", 1), wob=p.get("wobble", 0.35),
            rib=p.get("rib", 0.10), undulate=p.get("undulate", 0.05))

# ---------------- boulders ----------------
def boulder(x, y, z, r, seed):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r, location=(x, y, z))
    o = bpy.context.active_object; rnd = random.Random(seed)
    for v in o.data.vertices:
        v.co *= 1.0 + noise.noise((v.co.x*2.2 + seed, v.co.y*2.2, v.co.z*2.2))*0.22
    o.scale = (1.0 + rnd.uniform(-.15, .25), 1.0 + rnd.uniform(-.15, .25), rnd.uniform(.55, .8))
    o.rotation_euler = (0, 0, rnd.uniform(0, math.tau))
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    o.data.materials.append(M_STONE); o["layer"] = "terrain"
    bpy.ops.object.shade_smooth(); return o

# ---------------- river water + bank stones ----------------
for line, rv in RIVER_LINES:
    w = rv.get("width", 10) / 100.0 * MAPW
    surf = rv.get("surface", 0.10)
    bm = bmesh.new(); prev = None
    for i, p in enumerate(line):
        a = line[max(i-1, 0)]; b = line[min(i+1, len(line)-1)]
        d = Vector((b[0]-a[0], b[1]-a[1], 0))
        d = d.normalized() if d.length > 1e-9 else Vector((1, 0, 0))
        nv = Vector((-d.y, d.x, 0))
        hw = w * 0.5 * (1.0 + 0.16*noise.noise((p[0], p[1], 3.0)))
        z = height(p[0], p[1]) + surf
        l = bm.verts.new((p[0] + nv.x*hw, p[1] + nv.y*hw, z))
        r = bm.verts.new((p[0] - nv.x*hw, p[1] - nv.y*hw, z))
        if prev: bm.faces.new((prev[0], prev[1], r, l))
        prev = (l, r)
    me = bpy.data.meshes.new("river"); bm.to_mesh(me); bm.free()
    wo = bpy.data.objects.new("river", me); sc.collection.objects.link(wo)
    wo.data.materials.append(M_WATER); wo["layer"] = "terrain"
    bpy.context.view_layer.objects.active = wo; wo.select_set(True)
    bpy.ops.object.shade_smooth(); wo.select_set(False)
    rnd = random.Random(rv.get("seed", 5))
    for i in range(rv.get("stones", 22)):
        idx = rnd.randrange(len(line)); p = line[idx]
        a = line[max(idx-1, 0)]; b = line[min(idx+1, len(line)-1)]
        d = Vector((b[0]-a[0], b[1]-a[1], 0))
        d = d.normalized() if d.length > 1e-9 else Vector((1, 0, 0))
        off = w*0.5*rnd.uniform(0.85, 1.5)*rnd.choice([-1, 1])
        bx, by = p[0] - d.y*off, p[1] + d.x*off
        boulder(bx, by, height(bx, by) + rnd.uniform(0.0, 0.12), rnd.uniform(0.10, 0.28), i*7 + 3)

for b in CFG.get("boulders", []):
    x, y = to_world(b["x"], b["y"])
    boulder(x, y, height(x, y) + b.get("dz", 0.0), b.get("r", 0.22), b.get("seed", 11))

# ---------------- distant hills ----------------
for i, hc in enumerate(CFG.get("far_hills", [])):
    x, y = to_world(hc["x"], hc["y"])
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=hc.get("r", 6),
                                         location=(x, y, hc.get("z", -1.0)))
    o = bpy.context.active_object
    for v in o.data.vertices:
        v.co *= 1.0 + noise.noise((v.co.x*.5 + i, v.co.y*.5, v.co.z*.5))*0.12
    o.scale = (hc.get("sx", 1.6), hc.get("sy", 1.0), hc.get("sz", 0.5))
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(M_FAR); o["layer"] = "far"
    bpy.ops.object.shade_smooth()

# ---------------- path (follows the heightfield) ----------------
pc = CFG.get("path")
if pc:
    dense = catmull([to_world(*p) for p in pc["points"]], 20)
    half = pc.get("width", 7) / 100.0 * MAPW / 2
    rows = []
    for i, p in enumerate(dense):
        a = dense[max(i-1, 0)]; b = dense[min(i+1, len(dense)-1)]
        d = Vector((b[0]-a[0], b[1]-a[1], 0))
        d = d.normalized() if d.length > 1e-9 else Vector((1, 0, 0))
        nv = Vector((-d.y, d.x, 0))
        hw = half * (1.0 + 0.12*noise.noise((p[0]*1.5, p[1]*1.5, 7.0)))
        lp = (p[0] + nv.x*hw, p[1] + nv.y*hw); rp = (p[0] - nv.x*hw, p[1] - nv.y*hw)
        rows.append([lp, rp, height(*lp), height(*rp)])
    for _ in range(pc.get("smooth", 4)):
        for k in (2, 3):
            sm = [r[k] for r in rows]
            for i in range(1, len(rows)-1):
                rows[i][k] = (sm[i-1] + 2*sm[i] + sm[i+1]) / 4.0
    bm = bmesh.new(); prev = None
    for lp, rp, lz, rz in rows:
        l = bm.verts.new((lp[0], lp[1], lz + 0.02)); r = bm.verts.new((rp[0], rp[1], rz + 0.02))
        ls = bm.verts.new((lp[0], lp[1], lz - 0.09)); rs = bm.verts.new((rp[0], rp[1], rz - 0.09))
        if prev:
            bm.faces.new((prev[0], prev[1], r, l))       # surface
            bm.faces.new((prev[2], prev[0], l, ls))      # left flank
            bm.faces.new((prev[1], prev[3], rs, r))      # right flank
        prev = (l, r, ls, rs)
    me = bpy.data.meshes.new("path"); bm.to_mesh(me); bm.free()
    path = bpy.data.objects.new("path", me); sc.collection.objects.link(path)
    path.data.materials.append(M_DIRT); path["layer"] = "terrain"
    bpy.context.view_layer.objects.active = path; path.select_set(True)
    bpy.ops.object.shade_smooth(); path.select_set(False)

    if pc.get("dots", True):
        m_dot = mat_simple("dot", (0.97, 0.96, 0.92), 0.75)
        step = max(int(len(dense) / pc.get("dot_count", 30)), 1)
        for i in range(step, len(dense) - step, step):
            p = dense[i]; a = dense[i-1]; b = dense[i+1]
            ang = math.atan2(b[1]-a[1], b[0]-a[0])
            z = (rows[i][2] + rows[i][3]) / 2
            bpy.ops.mesh.primitive_cylinder_add(radius=half*0.13, depth=0.05,
                                                location=(p[0], p[1], z + 0.10), vertices=20)
            d = bpy.context.active_object
            d.scale = (1.0, 0.60, 1.0); d.rotation_euler = (0, 0, ang)
            bpy.ops.object.transform_apply(scale=True, rotation=True)
            d.data.materials.append(m_dot); d["layer"] = "terrain"
            bv = d.modifiers.new("b", "BEVEL"); bv.width = 0.012; bv.segments = 3
            bpy.ops.object.shade_smooth()

# ---------------- camera ----------------
cc = CFG.get("camera", {})
elev = math.radians(cc.get("elevation", 28))
cd = bpy.data.cameras.new("cam"); cd.type = "PERSP"
cd.lens = cc.get("lens", 32); cd.sensor_fit = "VERTICAL"
cam = bpy.data.objects.new("cam", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (cc.get("x", 0.0), wy(cc.get("cam_y", -24)), cc.get("cam_z", 7.6))
cam.rotation_euler = (math.pi/2 - elev, 0, 0)

# ---------------- light ----------------
sun = bpy.data.lights.new("sun", "SUN")
sun.energy = CFG.get("sun_energy", 2.1); sun.angle = math.radians(9)
sun.color = (1.0, 0.97, 0.90)
so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so)
so.rotation_euler = (math.radians(46), math.radians(-14), math.radians(26))
fill = bpy.data.lights.new("fill", "AREA"); fill.energy = CFG.get("fill_energy", 320); fill.size = 40
fo = bpy.data.objects.new("fill", fill); sc.collection.objects.link(fo)
fo.location = (-14, wy(10), 16); fo.rotation_euler = (math.radians(42), math.radians(-30), 0)
wd = bpy.data.worlds.new("w"); wd.use_nodes = True
wd.node_tree.nodes["Background"].inputs[0].default_value = (0.60, 0.79, 0.95, 1)
wd.node_tree.nodes["Background"].inputs[1].default_value = CFG.get("ambient", 0.32)
sc.world = wd

sc.render.filepath = os.path.join(OUT, "ground.png")
bpy.ops.render.render(write_still=True)
json.dump({"canvas": [sc.render.resolution_x, sc.render.resolution_y],
           "camera": {"elevation": math.degrees(elev), "lens": cd.lens,
                      "location": list(cam.location)}},
          open(os.path.join(OUT, "ground.json"), "w"), indent=1)
print("GROUND_DONE", OUT, flush=True)
