"""step 1: de-dupe hero shared folders (aliased natively to /runecast-wardrobe/) + drop meshes no player can own"""
import os, re, shutil, sys, json
T = sys.argv[1]
SHARED = ["baked", "light", "light_f08", "fabric", "hdri", "wands", "eyes", "mouth"]
UNUSED = {"hair_long","hair_curly","hair_quiff","top_tabard","hair_spiky","hair_braid","hair_twin","top_doublet","legs_plaid",
          "hair_bob","legs_jeans","top_sweater","top_elf","hair_pony","hair_buns","legs_cargo","hair_spikecrop","top_blouse",
          "top_denim","top_hoodie","top_stripe","top_sailor","outer_cape"}
log = {"shared_removed_bytes": 0, "unused_removed": []}
for d in SHARED:
    p = os.path.join(T, "runecast-hero", d)
    for dp, dn, fn in os.walk(p):
        for f in fn:
            a = os.path.join(dp, f); b = os.path.join(T, "runecast-wardrobe", os.path.relpath(a, os.path.join(T, "runecast-hero")))
            assert os.path.exists(b) and open(a, "rb").read() == open(b, "rb").read(), a
            log["shared_removed_bytes"] += os.path.getsize(a)
    shutil.rmtree(p)
def owner(d, f):
    if re.search(r"/(items|items5)$", d):
        m = re.match(r"(?:cover_)?(.+?)(?:\.tuck)?\.(glb|json)$", f); return m and m.group(1)
    if re.search(r"/(light|light5|light_f08)$", d): return f.split("__")[0] if "__" in f else None
    if d.endswith("/baked"):
        m = re.match(r"occ_(.+?)(?:_scalp)?\.png$", f) or re.match(r"(.+?)_irr\.png$", f); return m and m.group(1)
    return None
for dp, dn, fn in os.walk(T):
    for f in fn:
        o = owner(dp, f)
        if o in UNUSED:
            p = os.path.join(dp, f); log["unused_removed"].append((os.path.relpath(p, T), os.path.getsize(p))); os.remove(p)
# light manifests: entries of removed items can stay (only fetched when that item is worn); report them
print("shared removed MB %.1f" % (log["shared_removed_bytes"]/1e6))
print("unused removed MB %.1f in %d files" % (sum(s for _, s in log["unused_removed"])/1e6, len(log["unused_removed"])))
pass
