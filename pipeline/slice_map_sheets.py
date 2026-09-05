import numpy as np, json, os
from PIL import Image
NAMES = {
 'b1_buildings': ['cottage','cart','signpost'],
 'b2_trees':     ['tree_round','tree_pine','bush'],
 'b3_ground':    ['fence','rocks','flowers_yellow','flowers_bluepink'],
 'b4_terrain':   ['block_plateau','block_river','island_small'],
 'b5_tokens':    ['token_gold','token_blue','token_locked','cloud'],
}
os.makedirs('map_assets', exist_ok=True)
out = {}
for sheet, names in NAMES.items():
    im = Image.open(f'map_sheets/{sheet}.png').convert('RGBA')
    a = np.array(im).astype(np.int16)
    if Image.open(f'map_sheets/{sheet}.png').mode == 'RGBA':
        mask = a[...,3] > 8
    else:
        dist = (255 - a[...,:3]).max(axis=2)
        mask = dist > 18
    cols = mask.any(axis=0)
    runs, inrun = [], False
    for x, v in enumerate(cols):
        if v and not inrun: start, inrun = x, True
        if not v and inrun: runs.append((start, x)); inrun = False
    if inrun: runs.append((start, len(cols)))
    # merge runs separated by small gaps (<25px), drop tiny runs
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < 25: merged[-1] = (merged[-1][0], r[1])
        else: merged.append(r)
    merged = [r for r in merged if r[1]-r[0] > 40]
    assert len(merged) == len(names), (sheet, merged)
    for (x0,x1), name in zip(merged, names):
        sub = mask[:, x0:x1]; ys = np.where(sub.any(axis=1))[0]
        y0, y1 = ys[0], ys[-1]+1
        pad = 24
        box = (max(0,x0-pad), max(0,y0-pad), min(im.width,x1+pad), min(im.height,y1+pad))
        crop = im.crop(box)
        if Image.open(f'map_sheets/{sheet}.png').mode != 'RGBA':
            c = np.array(crop).astype(np.float32)
            d = (255 - c[...,:3]).max(axis=2)
            alpha = np.clip((d - 10) / 30, 0, 1) * 255   # soft key on white
            c[...,3] = alpha
            crop = Image.fromarray(c.astype(np.uint8))
        crop.save(f'map_assets/{name}.png')
        out[name] = {'sheet': sheet, 'box': [int(v) for v in box], 'size': crop.size}
        print(name, crop.size)
json.dump(out, open('map_assets/index.json','w'), indent=1)
