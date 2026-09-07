"""Key the grey out of the island ribbon segments and measure where the path
crosses the top and bottom edges, so slices can be chained by their real
entry/exit points instead of assumed ones.

The background is removed by flood-fill from the image border, so grey-ish
pixels inside the land are never punched out.
"""
import numpy as np, json, os
from PIL import Image
from scipy import ndimage

OUT = {}
for name in ("seg_a", "seg_b", "seg_c"):
    a = np.array(Image.open(f"{name}.png").convert("RGBA")).astype(np.float32)
    h, w = a.shape[:2]
    rgb = a[..., :3]
    bg = np.median(np.concatenate([rgb[:8, :8].reshape(-1, 3), rgb[:8, -8:].reshape(-1, 3),
                                   rgb[-8:, :8].reshape(-1, 3), rgb[-8:, -8:].reshape(-1, 3)]), axis=0)
    dist = np.abs(rgb - bg).max(axis=2)
    isbg = dist < 26
    lab, n = ndimage.label(isbg)
    border = set(lab[0].tolist()) | set(lab[-1].tolist()) | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    border.discard(0)
    outside = np.isin(lab, list(border))
    alpha = np.clip((dist - 12) / 18, 0, 1)
    alpha[outside & (dist < 26)] = 0
    alpha[~outside] = np.maximum(alpha[~outside], 1.0)      # keep the land solid
    # feather the bottom edge so a slice blends into the one it overlaps,
    # instead of showing a hard horizontal seam where the cliffs step across
    fade = int(h * 0.16)
    ramp = np.linspace(0.0, 1.0, fade) ** 0.8
    alpha[h - fade:] *= ramp[:, None]
    a[..., 3] = alpha * 255

    # path = cream flagstone or gold kerb
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    cream = (r > 205) & (g > 190) & (b > 155) & (r - b > 12) & (r - b < 95)
    gold = (r > 195) & (g > 140) & (b < 135) & (r - b > 80)
    path = (cream | gold) & (a[..., 3] > 200)

    def cross(band):
        cols = band.sum(axis=0)
        idx = np.where(cols > band.shape[0] * 0.5)[0]
        if not len(idx):
            idx = np.where(cols > 0)[0]
        if not len(idx):
            return 0.5
        # widest contiguous run
        runs, start = [], idx[0]
        for i in range(1, len(idx)):
            if idx[i] != idx[i-1] + 1:
                runs.append((start, idx[i-1])); start = idx[i]
        runs.append((start, idx[-1]))
        s, e = max(runs, key=lambda r: r[1] - r[0])
        return float((s + e) / 2 / w)

    k = 14
    bottom = cross(path[-k:])
    top = cross(path[:k])
    # sample the path centre down the slice so nodes and props can be placed
    # exactly on the road at any height
    N = 33
    centers = []
    for i in range(N):
        y = int(round(i * (h - 1) / (N - 1)))
        lo, hi = max(0, y - 10), min(h, y + 10)
        centers.append(round(cross(path[lo:hi]), 4))
    Image.fromarray(a.astype(np.uint8)).save(f"assets/{name}.png")
    OUT[name] = {"w": w, "h": h, "enter": round(bottom, 4), "exit": round(top, 4), "centers": centers}
    print(f"{name}: {w}x{h}  enter(bottom) {bottom:.3f}  exit(top) {top:.3f}")

json.dump(OUT, open("assets/segments.json", "w"), indent=1)
