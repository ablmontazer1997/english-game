"""Find the stone path in the finished map scene and pick the stage positions.

The scene is one painted picture, exactly as in the reference. The only thing
not painted into it is the row of level discs, because their number, stars and
lock have to change at runtime. So we trace the path here instead: start at the
bottom row, follow the run of cream-and-gold tiles upwards row by row, and drop
NODES evenly spaced along it. Each node also records the path's width at that
point, so a disc high up the map is drawn smaller, matching the perspective.
"""
import json
import numpy as np
from PIL import Image

SRC = "assets/d_map.png"
NODES = 8
TOP = 0.27       # stop below the portal steps
BOT = 0.878      # and clear of the bottom edge, where the nav bar sits

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(int)
h, w, _ = a.shape
r, g, b = a[..., 0], a[..., 1], a[..., 2]

cream = (r > 205) & (g > 190) & (b > 150) & (r - b > 10) & (r - b < 105) & (g - b > 0)
gold = (r > 195) & (g > 140) & (b < 150) & (r - b > 70)
road = cream | gold


def runs(row, lo=40):
    """contiguous runs of road pixels in one image row"""
    xs = np.nonzero(row)[0]
    if not len(xs):
        return []
    cuts = np.nonzero(np.diff(xs) > 6)[0]
    out, start = [], 0
    for c in list(cuts) + [len(xs) - 1]:
        seg = xs[start:c + 1]
        if len(seg) >= lo:
            out.append((int(seg[0]), int(seg[-1])))
        start = c + 1
    return out


y0, y1 = int(h * TOP), int(h * BOT)
centre = None
track = {}
for y in range(y1, y0 - 1, -1):
    rs = runs(road[y])
    if not rs:
        continue
    if centre is None:
        rs.sort(key=lambda s: s[1] - s[0])
        seg = rs[-1]
    else:
        seg = min(rs, key=lambda s: abs((s[0] + s[1]) / 2 - centre))
        if abs((seg[0] + seg[1]) / 2 - centre) > w * 0.16:
            continue
    # centre on the cream tiles only: the gold trim is not symmetric under this
    # camera, so including it pulls every disc off to one side
    inner = np.nonzero(cream[y, seg[0]:seg[1] + 1])[0]
    centre = (seg[0] + float(inner.mean())) if len(inner) > 20 else (seg[0] + seg[1]) / 2
    track[y] = (centre, seg[1] - seg[0])

ys = sorted(track)
wide = np.median([track[y][1] for y in ys])

# space the stages evenly down the traced path
picks = np.linspace(y1 - h * 0.01, y0 + h * 0.02, NODES)
nodes = []
for py in picks:
    y = min(ys, key=lambda v: abs(v - py))
    cx, cw = track[y]
    # smooth the width over a band of rows; a single row can clip on a shadow
    band = [track[v][1] for v in ys if abs(v - y) < h * 0.02]
    nodes.append({"x": round(cx / w, 4), "y": round(y / h, 4),
                  "scale": round(float(np.median(band)) / wide, 3)})
# picks run bottom-to-top already, so nodes[0] is stage 1 at the foot of the path

meta = {"w": w, "h": h, "aspect": round(w / h, 5), "nodes": nodes}
json.dump(meta, open("assets/map.json", "w"), indent=1)
for i, n in enumerate(nodes):
    print(i + 1, n)

# a proof sheet so the placement can be eyeballed before wiring anything
from PIL import ImageDraw
pv = im.copy()
d = ImageDraw.Draw(pv)
for i, n in enumerate(nodes):
    x, y = n["x"] * w, n["y"] * h
    rr = wide * 0.62 * n["scale"]
    d.ellipse([x - rr, y - rr * 0.62, x + rr, y + rr * 0.62], outline=(255, 40, 40), width=6)
    d.text((x - 8, y - 10), str(i + 1), fill=(255, 255, 255))
pv.resize((w // 2, h // 2)).save("/tmp/claude-1000/-home-rade-projects-hamsaz/0c5cc112-85a9-49cd-983b-918270624a69/scratchpad/map_probe.jpg", quality=88)
