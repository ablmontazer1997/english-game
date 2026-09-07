"""Turn the generated island strips into genuinely tileable segments.

The old map cut a one-off painting into three chunks whose silhouettes did not
agree, so every join had to be hidden under a cloud. These tile by
construction: the top BAND rows and the bottom BAND rows of EVERY variant are
replaced by the same shared band N, taken from variant 0. Stacking any mix of
variants at a step of (h - BAND) therefore puts identical pixels over each
other, and the join is exact with no feathering and nothing to cover it.
"""
import json
import numpy as np
from PIL import Image
from scipy import ndimage

BAND = 0.12
SRCS = ["assets/c_clean.png"]
OUTS = ["assets/tile1.png"]
N = 41


def key(path, size=None):
    im = Image.open(path).convert("RGB")
    if size and im.size != size:
        im = im.resize(size, Image.LANCZOS)
    a = np.asarray(im).astype(np.int16)
    h, w, _ = a.shape

    sky = np.median(a[:, :12].reshape(-1, 3), axis=0)
    dist = np.sqrt(((a - sky) ** 2).sum(axis=2))
    lab, _ = ndimage.label(dist < 48)
    border = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
    border.discard(0)
    outside = np.isin(lab, list(border))

    alpha = np.ones((h, w), np.float32)
    alpha[outside] = np.clip((dist[outside] - 26) / 22, 0, 1)

    # despill the blue halo the cut leaves on the edge
    edge = (alpha > 0.02) & (alpha < 0.995)
    b = a[..., 2]
    cap = np.maximum(a[..., 0], a[..., 1])
    a[..., 2] = np.where(edge & (b > cap), cap + (b - cap) * 0.25, b)
    return np.dstack([a.astype(np.uint8), (alpha * 255).astype(np.uint8)]).astype(np.uint8)


def measure(rgba):
    h, w, _ = rgba.shape
    r, g, bl = rgba[..., 0].astype(int), rgba[..., 1].astype(int), rgba[..., 2].astype(int)
    op = rgba[..., 3] > 140
    cream = op & (r > 205) & (g > 190) & (bl > 150) & (r - bl > 8) & (r - bl < 100)
    gold = op & (r > 195) & (g > 140) & (bl < 140) & (r - bl > 80)
    road = cream | gold
    grass = op & (g > 110) & (g - r > 18) & (g - bl > 30)

    cols = {k: [] for k in ("roadX", "landL", "landR", "grassL", "grassR")}
    for y in np.linspace(0, h - 1, N).astype(int):
        xs = np.nonzero(road[y])[0]
        cols["roadX"].append(round(float(xs.mean()) / w, 4) if len(xs) > 20 else None)
        xs = np.nonzero(op[y])[0]
        cols["landL"].append(round(float(xs.min()) / w, 4) if len(xs) else None)
        cols["landR"].append(round(float(xs.max()) / w, 4) if len(xs) else None)
        xs = np.nonzero(grass[y])[0]
        cols["grassL"].append(round(float(xs.min()) / w, 4) if len(xs) > 8 else None)
        cols["grassR"].append(round(float(xs.max()) / w, 4) if len(xs) > 8 else None)

    def fill(v, dflt):
        out = list(v)
        for i, x in enumerate(out):
            if x is None:
                prev = next((out[j] for j in range(i - 1, -1, -1) if out[j] is not None), None)
                nxt = next((out[j] for j in range(i + 1, len(out)) if out[j] is not None), None)
                out[i] = dflt if prev is None and nxt is None else \
                    prev if nxt is None else nxt if prev is None else round((prev + nxt) / 2, 4)
        return out

    return {k: fill(v, 0.5) for k, v in cols.items()}


imgs = []
size = None
for p in SRCS:
    rgba = key(p, size)
    if size is None:
        size = (rgba.shape[1], rgba.shape[0])
    imgs.append(rgba)

h, w, _ = imgs[0].shape
band = int(round(h * BAND))
# the shared band: variant 0's bottom band easing into variant 0's top band, so
# it joins its own interior smoothly at both ends
t = np.linspace(0.0, 1.0, band)
t = (0.5 - 0.5 * np.cos(np.pi * t))[:, None, None]
shared = (imgs[0][h - band:].astype(np.float32) * (1 - t)
          + imgs[0][:band].astype(np.float32) * t).astype(np.uint8)

meta = {"w": w, "h": h, "aspect": round(w / h, 5), "band": round(BAND, 4),
        "rows": N, "variants": []}
for rgba, out in zip(imgs, OUTS):
    rgba[:band] = shared
    rgba[h - band:] = shared
    Image.fromarray(rgba, "RGBA").save(out)
    meta["variants"].append(measure(rgba))
    print(out, "road top/bottom", meta["variants"][-1]["roadX"][0], meta["variants"][-1]["roadX"][-1])

json.dump(meta, open("assets/tile.json", "w"), indent=1)
print("tiles", w, "x", h, "band", band)
