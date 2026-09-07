"""Cut the animated bits of the home map out of the painting itself.

The map (src/assets/sky/map_w1.webp) is one finished painting. To make trees
sway and waterfalls flow WITHOUT touching the painting, we cut soft-alpha
cutouts of just the tree canopies and the waterfall sheets, straight from the
painting's own pixels, and ship them next to a JSON of where they sit. At
runtime MapLife.tsx draws the cutouts back over their own spot, animated.

Because a cutout is drawn over the very pixels it came from, a sway of a few
pixels never opens a gap: the baked original shows through underneath.

Usage: python3 pipeline/sky/cut_life.py   (writes src/assets/sky/life/*)
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'src/assets/sky/map_w1.webp')
OUT = os.path.join(ROOT, 'src/assets/sky/life')
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGB')
A = np.array(im).astype(np.float32) / 255.0
hsv = np.array(im.convert('HSV')).astype(np.float32)
H, S, V = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255

# hand-measured boxes in natural map pixels (898 x 1751)
REGIONS = {
    # kind, box (x0,y0,x1,y1), anchor = where the trunk meets the canopy (sway is 0 there)
    'tree_l':  dict(kind='tree', box=(30, 755, 310, 1000), pivot_y=985),
    'tree_r':  dict(kind='tree', box=(752, 672, 898, 815), pivot_y=805),
    'tree_tl': dict(kind='tree', box=(82, 316, 190, 395),  pivot_y=388),
    # waterfalls: water and sky are the same saturated blue, so colour can't
    # separate them; the sheet is traced by hand as a polygon (natural px) and
    # only gated by brightness to drop the rock face beside it.
    'fall_l':  dict(kind='fall', box=(118, 462, 236, 795),
                    poly=[(130, 472), (206, 472), (222, 600), (228, 700), (226, 786), (150, 786), (146, 650), (140, 560)]),
    'fall_r':  dict(kind='fall', box=(700, 655, 740, 778),
                    poly=[(708, 660), (730, 660), (734, 774), (704, 774)]),
    # clouds: big white blobs found by scipy.ndimage.label on (V>.86 & S<.2); they
    # drift a few px, drawn slightly overscaled so they always cover their baked twin
    'cloud_01': dict(kind='cloud', box=(0, 60, 140, 222), depth=0.9),
    'cloud_02': dict(kind='cloud', box=(322, 140, 452, 262), depth=0.7),
    'cloud_03': dict(kind='cloud', box=(784, 148, 898, 284), depth=0.6),
    'cloud_04': dict(kind='cloud', box=(0, 276, 108, 398), depth=0.5),
    'cloud_05': dict(kind='cloud', box=(214, 498, 363, 672), depth=1.0),
    'cloud_09': dict(kind='cloud', box=(612, 1180, 898, 1674), depth=1.0),
}

# crystal tips that catch the light (natural px): x, y, tint
GLINTS = [
    (455, 262, 'pink'), (490, 345, 'cyan'), (525, 365, 'cyan'),
    (840, 240, 'pink'), (765, 320, 'cyan'), (785, 345, 'cyan'),
    (655, 66, 'violet'),
    (820, 895, 'cyan'),
    (75, 1010, 'cyan'), (120, 1070, 'cyan'), (65, 1050, 'violet'),
    (210, 1220, 'cyan'), (250, 1250, 'pink'), (185, 1290, 'violet'),
]


def soft(mask, grow=1, blur=1.2):
    m = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8))
    if grow:
        m = m.filter(ImageFilter.MaxFilter(2 * grow + 1))
    m = m.filter(ImageFilter.GaussianBlur(blur))
    return np.array(m).astype(np.float32) / 255.0


meta = {}
for name, r in REGIONS.items():
    x0, y0, x1, y1 = r['box']
    h, s, v = H[y0:y1, x0:x1], S[y0:y1, x0:x1], V[y0:y1, x0:x1]
    rgb = A[y0:y1, x0:x1]
    if r['kind'] == 'cloud':
        # cloud = white / very light, low saturation; soft edge into the sky
        m = np.clip((v - 0.78) / 0.12, 0, 1) * np.clip((0.4 - s) / 0.2, 0, 1)
        m = soft(m, grow=1, blur=2.0)
    elif r['kind'] == 'tree':
        # canopy = the purple/pink blossom; trunk and ground stay baked
        m = ((h > 245) & (h < 345) & (s > 0.16) & (v > 0.3)).astype(np.float32)
        m = soft(m, grow=2, blur=1.6)
    else:
        # waterfall sheet = the traced polygon, gated to bright pixels (drops the rock)
        pm = Image.new('L', (x1 - x0, y1 - y0), 0)
        ImageDraw.Draw(pm).polygon([(px - x0, py - y0) for px, py in r['poly']], fill=255)
        m = (np.array(pm).astype(np.float32) / 255.0) * (v > 0.5)
        m = soft(m, grow=0, blur=2.5)
        # feather the top/bottom so the animated sheet blends into the painting
        hh = m.shape[0]
        ramp = np.ones(hh, np.float32)
        f = int(hh * 0.08)
        ramp[:f] = np.linspace(0, 1, f); ramp[-f * 2:] = np.linspace(1, 0, f * 2)
        m *= ramp[:, None]
    rgba = np.dstack([rgb, m])
    Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, f'{name}.png'), optimize=True)
    extra = {}
    if 'pivot_y' in r: extra['pivotY'] = r['pivot_y']
    if 'depth' in r: extra['depth'] = r['depth']
    meta[name] = dict(kind=r['kind'], x=x0, y=y0, w=x1 - x0, h=y1 - y0, **extra)
    print(name, meta[name], 'coverage %.2f' % m.mean())

meta['_map'] = dict(w=im.width, h=im.height)
meta['_glints'] = [dict(x=x, y=y, tint=t) for x, y, t in GLINTS]
with open(os.path.join(OUT, 'life.json'), 'w') as f:
    json.dump(meta, f, indent=1)

# a contact sheet for eyeballing the masks
sheet = Image.new('RGBA', (sum(meta[k]['w'] for k in REGIONS) + 10 * len(REGIONS), max(meta[k]['h'] for k in REGIONS)), (40, 40, 60, 255))
x = 0
for k in REGIONS:
    p = Image.open(os.path.join(OUT, f'{k}.png'))
    sheet.paste(p, (x, 0), p)
    x += p.width + 10
sheet.save(os.path.join(os.path.dirname(__file__), 'life_sheet.png'))
print('sheet -> pipeline/sky/life_sheet.png')
