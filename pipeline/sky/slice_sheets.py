"""Slice the generated asset sheets into individual transparent PNGs.

Each sheet is a single row of objects on a flat light background; we key that
background out (sampled from the corners), split on the vertical gaps, and write
one soft-alpha PNG per object.
"""
import numpy as np, json, os
from PIL import Image

SHEETS = {
 "a_tokens": ["token_open", "token_locked", "pill_current"],
 "a_portal": ["portal", "steps"],
 "a_nature": ["tree_pink", "tree_purple", "crystal_blue", "crystal_pink"],
 "a_ui":     ["pill", "ic_energy", "ic_heart", "ic_gem", "ic_coin", "btn_gear"],
 "a_nav":    ["nav_home", "nav_quests", "nav_shop", "nav_league", "nav_profile"],
 "a_cards":  ["card_daily", "dropdown", "widget_chest", "btn_side"],
 "a_world":  ["island", "waterfall", "cloud", "balloon"],
 "a_ground": ["path_seg", "bush", "rocks", "flowers"],
}
os.makedirs("assets", exist_ok=True)
index = {}
for sheet, names in SHEETS.items():
    src = f"{sheet}.png"
    if not os.path.exists(src):
        print("missing", src); continue
    im = Image.open(src).convert("RGBA")
    a = np.array(im).astype(np.float32)
    h, w = a.shape[:2]
    # background colour = median of the four corner patches
    k = 12
    corners = np.concatenate([a[:k, :k, :3].reshape(-1, 3), a[:k, -k:, :3].reshape(-1, 3),
                              a[-k:, :k, :3].reshape(-1, 3), a[-k:, -k:, :3].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    dist = np.abs(a[..., :3] - bg).max(axis=2)
    mask = dist > 26
    cols = mask.sum(axis=0) > 3
    runs, inrun = [], False
    for x, v in enumerate(cols):
        if v and not inrun: start, inrun = x, True
        if not v and inrun: runs.append((start, x)); inrun = False
    if inrun: runs.append((start, len(cols)))
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < max(int(w * 0.022), 18):
            merged[-1] = (merged[-1][0], r[1])
        else: merged.append(r)
    merged = [r for r in merged if r[1] - r[0] > w * 0.02]
    # touching objects merge into one wide run: split the widest at its sparsest column
    while len(merged) < len(names):
        i = max(range(len(merged)), key=lambda k: merged[k][1] - merged[k][0])
        x0, x1 = merged[i]
        lo, hi = x0 + int((x1 - x0) * 0.30), x0 + int((x1 - x0) * 0.70)
        if hi - lo < 4: break
        cut = lo + int(np.argmin(mask[:, lo:hi].sum(axis=0)))
        merged[i:i+1] = [(x0, cut), (cut, x1)]
    if len(merged) != len(names):
        print(f"!! {sheet}: found {len(merged)} objects, expected {len(names)}: {merged}")
    for (x0, x1), name in zip(merged, names):
        sub = mask[:, x0:x1]
        ys = np.where(sub.sum(axis=1) > 2)[0]
        if not len(ys): continue
        y0, y1 = ys[0], ys[-1] + 1
        pad = 16
        box = (max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad))
        c = a[box[1]:box[3], box[0]:box[2]].copy()
        d = np.abs(c[..., :3] - bg).max(axis=2)
        c[..., 3] = np.clip((d - 12) / 22, 0, 1) * 255
        out = Image.fromarray(c.astype(np.uint8))
        out.save(f"assets/{name}.png")
        index[name] = {"sheet": sheet, "size": out.size}
        print(f"{name:14s} {out.size}")
json.dump(index, open("assets/index.json", "w"), indent=1)
