"""Slice the page asset sheets. Boundaries come from a hard threshold so soft
contact shadows don't bridge neighbouring objects; the alpha matte uses a soft
one so edges stay clean."""
import numpy as np, os, json
from PIL import Image

SHEETS = {
 "a_isles": ["isle_fall", "isle_tree", "isle_rock", "isle_tiny", "isle_crystal"],
 "a_edge":  ["fall_big", "trees_pink", "trees_purple", "crystals_big"],
 "a_panels": ["pnl_card4", "pnl_row6", "pnl_row6v"],
 "a_qicons": ["qi_star", "qi_potion", "qi_crystal", "qi_chest", "qi_flame"],
 "a_qui":    ["ui_card_wide", "btn_gold", "chip_violet", "switch_seg"],
 "a_gems":   ["gem_s", "gem_m", "gem_l", "gem_xl"],
 "a_chests": ["chest_wood", "chest_silver", "chest_epic", "chest_open"],
 "a_sui":    ["panel_banner", "card_square", "btn_green", "ribbon_gold"],
 "a_tiers":  ["tier_1", "tier_2", "tier_3", "tier_4", "tier_5"],
 "a_lui":    ["rank_gold", "rank_silver", "rank_bronze", "row_white", "row_violet", "trophy_big"],
 "a_pui":    ["podium", "card_stat", "btn_edit", "panel_wide"],
 "a_badges2": ["badge_1", "badge_2", "badge_3", "badge_lock1", "badge_lock2"],
}
os.makedirs("assets", exist_ok=True)
index = {}
for sheet, names in SHEETS.items():
    src = sheet + ".png"
    if not os.path.exists(src):
        print("missing", src); continue
    im = Image.open(src).convert("RGBA")
    a = np.array(im).astype(np.float32); h, w = a.shape[:2]
    k = 14
    corners = np.concatenate([a[:k, :k, :3].reshape(-1, 3), a[:k, -k:, :3].reshape(-1, 3),
                              a[-k:, :k, :3].reshape(-1, 3), a[-k:, -k:, :3].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    dist = np.abs(a[..., :3] - bg).max(axis=2)
    got = None
    for DT, CT in ((80, 25), (60, 20), (45, 14), (34, 8)):
        hard = dist > DT
        cols = hard.sum(axis=0) > CT
        runs, inrun = [], False
        for x, v in enumerate(cols):
            if v and not inrun: start, inrun = x, True
            if not v and inrun: runs.append((start, x)); inrun = False
        if inrun: runs.append((start, len(cols)))
        merged = []
        for r in runs:
            if merged and r[0] - merged[-1][1] < 16: merged[-1] = (merged[-1][0], r[1])
            else: merged.append(r)
        merged = [r for r in merged if r[1] - r[0] > w * 0.015]
        if len(merged) == len(names):
            got = (merged, hard); break
    if got is None:
        print(f"!! {sheet}: could not split into {len(names)}"); continue
    merged, hard = got
    for (x0, x1), name in zip(merged, names):
        ys = np.where(hard[:, x0:x1].sum(axis=1) > 3)[0]
        y0, y1 = ys[0], ys[-1] + 1
        p = 12
        box = (max(0, x0 - p), max(0, y0 - p), min(w, x1 + p), min(h, y1 + p))
        c = a[box[1]:box[3], box[0]:box[2]].copy()
        d = np.abs(c[..., :3] - bg).max(axis=2)
        c[..., 3] = np.clip((d - 16) / 18, 0, 1) * 255
        o = Image.fromarray(c.astype(np.uint8)); o.save(f"assets/{name}.png")
        index[name] = {"sheet": sheet, "w": o.size[0], "h": o.size[1],
                       "aspect": round(o.size[0] / o.size[1], 4)}
        print(f"  {name:14s} {o.size}  aspect {o.size[0]/o.size[1]:.3f}")
json.dump(index, open("assets/pages_index.json", "w"), indent=1)
print("total", len(index))
