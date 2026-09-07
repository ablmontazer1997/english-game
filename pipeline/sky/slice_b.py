import numpy as np, os, sys
from PIL import Image
SHEETS = {
 "b_nav":  (["nav2_home","nav2_quests","nav2_shop","nav2_league","nav2_profile"], 80, 25),
 "b_pads": (["pad_base","pad_star","pad_lock"], 60, 20),
}
os.makedirs("assets", exist_ok=True)
for sheet, (names, DT, CT) in SHEETS.items():
    im = Image.open(sheet + ".png").convert("RGBA")
    a = np.array(im).astype(np.float32); h, w = a.shape[:2]
    k = 14
    corners = np.concatenate([a[:k,:k,:3].reshape(-1,3), a[:k,-k:,:3].reshape(-1,3),
                              a[-k:,:k,:3].reshape(-1,3), a[-k:,-k:,:3].reshape(-1,3)])
    bg = np.median(corners, axis=0)
    dist = np.abs(a[..., :3] - bg).max(axis=2)
    hard = dist > DT              # for finding object boundaries (ignores soft shadows)
    soft = dist > 14              # for the alpha matte
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
    merged = [r for r in merged if r[1]-r[0] > w*0.02]
    print(sheet, "found", len(merged), "expected", len(names), merged)
    if len(merged) != len(names): continue
    for (x0, x1), name in zip(merged, names):
        ys = np.where(hard[:, x0:x1].sum(axis=1) > 3)[0]
        y0, y1 = ys[0], ys[-1]+1
        p = 12
        box = (max(0,x0-p), max(0,y0-p), min(w,x1+p), min(h,y1+p))
        c = a[box[1]:box[3], box[0]:box[2]].copy()
        d = np.abs(c[..., :3] - bg).max(axis=2)
        c[..., 3] = np.clip((d - 16)/18, 0, 1) * 255
        o = Image.fromarray(c.astype(np.uint8)); o.save(f"assets/{name}.png")
        print(f"  {name:14s} {o.size}")
