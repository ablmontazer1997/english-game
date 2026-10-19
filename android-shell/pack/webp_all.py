"""step 2b: app PNGs -> WebP (q92, alpha lossless-ish q100, references rewritten in the bundle text files);
irradiance PNGs (baked/*_irr.png) -> lossless WebP (-exact), page loaders pointed at .webp"""
import os, re, subprocess, sys, glob
T = sys.argv[1]
A = os.path.join(T, "runecast/assets")
conv = []; kept = []
for f in sorted(os.listdir(A)):
    if not f.endswith(".png"): continue
    p = os.path.join(A, f); w = p[:-4] + ".webp"
    subprocess.run(["cwebp", "-quiet", "-q", "92", "-alpha_q", "100", "-m", "6", "-sharp_yuv", "-mt", p, "-o", w], check=True)
    if os.path.getsize(w) < os.path.getsize(p) * 0.9: conv.append((f, os.path.getsize(p), os.path.getsize(w))); os.remove(p)
    else: kept.append(f); os.remove(w)
texts = [x for x in glob.glob(os.path.join(T, "runecast/**/*"), recursive=True) if x.endswith((".js", ".css", ".html"))]
for t in texts:
    s = open(t, encoding="utf-8").read(); s0 = s
    for f, _, _ in conv: s = s.replace(f, f[:-4] + ".webp")
    if s != s0: open(t, "w", encoding="utf-8").write(s)
left = [f for f, _, _ in conv if any(f in open(t, encoding="utf-8").read() for t in texts)]
print("app png->webp: %d files %.1f -> %.1f MB; kept as png (webp not smaller): %d; stale refs left: %d" % (len(conv), sum(c[1] for c in conv)/1e6, sum(c[2] for c in conv)/1e6, len(kept), len(left)))
B = os.path.join(T, "runecast-wardrobe/baked"); ib = ia = 0
for p in glob.glob(os.path.join(B, "*_irr.png")):
    w = p[:-4] + ".webp"
    subprocess.run(["cwebp", "-quiet", "-lossless", "-exact", "-z", "9", "-mt", p, "-o", w], check=True)
    ib += os.path.getsize(p); ia += os.path.getsize(w); os.remove(p)
n = 0
for page in ["runecast-wardrobe/index.html", "runecast-hero/index.html"]:
    pp = os.path.join(T, page); s = open(pp, encoding="utf-8").read()
    c = s.count("_irr.png?v=6"); s = s.replace("_irr.png?v=6", "_irr.webp?v=6"); n += c
    open(pp, "w", encoding="utf-8").write(s)
    if "_irr.png" in s: print("WARN: other _irr.png reference left in", page)
print("irradiance png->lossless webp: %.1f -> %.1f MB, %d loader references switched" % (ib/1e6, ia/1e6, n))
