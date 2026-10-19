import os, sys, zlib, collections
def cat(rel):
    p = rel.split("/")
    if p[0] == "runecast":
        e = os.path.splitext(rel)[1]
        return "app: audio (mp3+opus)" if e in (".mp3", ".ogg") else "app: images" if e in (".png", ".webp", ".jpg", ".svg") else "app: code/fonts"
    if p[0] in ("runecast-wardrobe", "runecast-hero"):
        if len(p) > 2 and p[1] in ("items",): return "3D: wardrobe items (full)"
        if p[1] == "lite": return "3D: hero lite (bodies + items)"
        if p[1] == "base_m.glb": return "3D: wardrobe body base_m.glb"
        if p[1] in ("light", "light5", "light_f08"): return "3D: per-vertex light bakes (.bin)"
        if p[1] == "baked": return "3D: irradiance + occlusion maps"
        if p[1] == "thumbs": return "3D: shop thumbs"
        if p[1] == "wands": return "3D: wands"
        return "3D: fabric/hdri/eyes/ui/pages"
    return "shell + vendor (three, fonts)"
def measure(T):
    r = collections.Counter(); z = collections.Counter()
    for dp, dn, fn in os.walk(T):
        for f in fn:
            p = os.path.join(dp, f); b = open(p, "rb").read(); c = cat(os.path.relpath(p, T))
            r[c] += len(b); z[c] += min(len(b), len(zlib.compress(b, 9)))
    return r, z
rb, zb = measure(sys.argv[1]); ra, za = measure(sys.argv[2])
print("%-38s %9s %9s %9s %9s" % ("category", "raw bef", "raw aft", "zip9 bef", "zip9 aft"))
for k in sorted(set(rb) | set(ra), key=lambda k: -rb.get(k, 0)):
    print("%-38s %9.1f %9.1f %9.1f %9.1f" % (k, rb[k]/1e6, ra[k]/1e6, zb[k]/1e6, za[k]/1e6))
print("%-38s %9.1f %9.1f %9.1f %9.1f" % ("TOTAL", sum(rb.values())/1e6, sum(ra.values())/1e6, sum(zb.values())/1e6, sum(za.values())/1e6))
