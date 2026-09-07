"""Bake the painted panels to exact target aspect ratios.

The image model will not honour a requested aspect ratio, and stretching a
painted panel at render time distorts its corners and border (the admin has
rejected that). So the widening is done ONCE here, as a 9-slice: the left and
right caps are copied pixel-for-pixel and the flat middle column is repeated to
fill. Corners, border thickness and shadow stay exactly as painted; the app then
locks the element to this ratio and only ever scales it uniformly.
"""
import numpy as np
from PIL import Image

TARGETS = {"pnl_card4": 4.0, "pnl_row6": 6.0, "pnl_row6v": 6.0}

for name, aspect in TARGETS.items():
    a = np.array(Image.open(f"assets/{name}.png").convert("RGBA"))
    h, w = a.shape[:2]
    target_w = int(round(h * aspect))
    cap = int(round(h * 0.80))                 # wide enough to clear the rounded corner
    assert target_w > 2 * cap, (name, target_w, cap)
    mid = a[:, w // 2:w // 2 + 1, :]           # one flat column from the centre
    fill = np.repeat(mid, target_w - 2 * cap, axis=1)
    out = np.concatenate([a[:, :cap], fill, a[:, w - cap:]], axis=1)
    Image.fromarray(out).save(f"assets/{name}.png")
    print(f"{name:12s} {w}x{h} -> {out.shape[1]}x{out.shape[0]}  aspect {out.shape[1]/out.shape[0]:.3f}")
