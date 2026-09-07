"""Turn the generated island strip into a genuinely tileable segment.

The old map cut a one-off painting into three chunks whose silhouettes did not
agree, so every join had to be hidden under a cloud. Instead we make the tile
seamless by construction: the top BAND rows and the bottom BAND rows are
replaced by the SAME blended band N, where N ramps from the bottom band into
the top band. Stacking the tile at a step of (h - BAND) then puts two identical
bands on top of each other, so the join is exact for any number of copies and
needs no feathering, no overlap fudge and nothing to cover it up.
"""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

BAND = 0.12          # fraction of the tile height that overlaps
SRC = "assets/c_tile.png"

im = Image.open(SRC).convert("RGB")
a = np.asarray(im).astype(np.int16)
h, w, _ = a.shape

# --- key the flat sky blue -------------------------------------------------
sky = np.median(a[:, :12].reshape(-1, 3), axis=0)
dist = np.sqrt(((a - sky) ** 2).sum(axis=2))
isbg = dist < 48
lab, _ = ndimage.label(isbg)
border = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
border.discard(0)
outside = np.isin(lab, list(border))

alpha = np.clip((dist - 26) / 22, 0, 1)
alpha[outside] = np.clip((dist[outside] - 26) / 22, 0, 1)
alpha[outside & (dist < 26)] = 0.0
alpha[~outside] = 1.0                       # holes inside the island stay solid

# despill: the blue halo left on the cut edge
edge = (alpha > 0.02) & (alpha < 0.995)
b = a[..., 2]
cap = np.maximum(a[..., 0], a[..., 1])
spill = edge & (b > cap)
a[..., 2] = np.where(spill, cap + (b - cap) * 0.25, b)

rgba = np.dstack([a.astype(np.uint8), (alpha * 255).astype(np.uint8)]).astype(np.uint8)

# --- make the top and bottom bands identical -------------------------------
band = int(round(h * BAND))
top = rgba[:band].astype(np.float32)
bot = rgba[h - band:].astype(np.float32)
t = (np.linspace(0.0, 1.0, band) ** 1.0)[:, None, None]
t = 0.5 - 0.5 * np.cos(np.pi * t)           # smoothstep, so both ends match C1
merged = (bot * (1 - t) + top * t)
rgba[:band] = merged.astype(np.uint8)
rgba[h - band:] = merged.astype(np.uint8)

Image.fromarray(rgba, "RGBA").save("assets/tile.png")

# --- measure the road centre and the plateau edges, row by row --------------
r, g, bl = rgba[..., 0].astype(int), rgba[..., 1].astype(int), rgba[..., 2].astype(int)
op = rgba[..., 3] > 140
cream = op & (r > 205) & (g > 190) & (bl > 150) & (r - bl > 8) & (r - bl < 100)
gold = op & (r > 195) & (g > 140) & (bl < 140) & (r - bl > 80)
road = cream | gold
grass = op & (g > 110) & (g - r > 18) & (g - bl > 30)

N = 41
rows = np.linspace(0, h - 1, N).astype(int)
road_x, land_l, land_r, grass_l, grass_r = [], [], [], [], []
for y in rows:
    xs = np.nonzero(road[y])[0]
    road_x.append(round(float(xs.mean()) / w, 4) if len(xs) > 20 else None)
    xs = np.nonzero(op[y])[0]
    land_l.append(round(float(xs.min()) / w, 4) if len(xs) else 0.5)
    land_r.append(round(float(xs.max()) / w, 4) if len(xs) else 0.5)
    xs = np.nonzero(grass[y])[0]
    grass_l.append(round(float(xs.min()) / w, 4) if len(xs) > 8 else None)
    grass_r.append(round(float(xs.max()) / w, 4) if len(xs) > 8 else None)

# fill the odd unmeasured row from its neighbours
def fill(v):
    out = list(v)
    for i, x in enumerate(out):
        if x is None:
            prev = next((out[j] for j in range(i - 1, -1, -1) if out[j] is not None), None)
            nxt = next((out[j] for j in range(i + 1, len(out)) if out[j] is not None), None)
            out[i] = prev if nxt is None else nxt if prev is None else round((prev + nxt) / 2, 4)
    return out

meta = {
    "w": w, "h": h, "aspect": round(w / h, 5), "band": round(BAND, 4),
    # index 0 is the TOP row of the image, index N-1 the bottom
    "rows": N, "roadX": fill(road_x),
    "landL": land_l, "landR": land_r,
    "grassL": fill(grass_l), "grassR": fill(grass_r),
}
json.dump(meta, open("assets/tile.json", "w"), indent=1)
print("tile.png", w, "x", h, "band", band)
print("road top", meta["roadX"][0], "bottom", meta["roadX"][-1])
print("land top", land_l[0], land_r[0], "bottom", land_l[-1], land_r[-1])
