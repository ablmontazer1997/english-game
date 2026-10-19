import shutil, os, json, struct, subprocess, sys
T = os.path.abspath(sys.argv[1]); TOOLS = os.path.dirname(os.path.abspath(__file__))
env = dict(os.environ, PATH="/opt/bingual/dev/node/node-v22.14.0-linux-x64/bin:" + os.environ["PATH"])
res = {"compressed": [], "already": 0, "already_bytes": 0, "failed": []}
for dp, dn, fn in os.walk(T):
    for f in fn:
        if not f.endswith(".glb"): continue
        if f == "base_m.glb" and dp.endswith("runecast-wardrobe"): continue   # the wardrobe loads its body with a loader that has no meshopt decoder
        p = os.path.join(dp, f); b = open(p, "rb").read(4096 * 64)
        n = struct.unpack("<I", b[12:16])[0]; j = json.loads(open(p, "rb").read(20 + n)[20:])
        if "EXT_meshopt_compression" in j.get("extensionsUsed", []):
            res["already"] += 1; res["already_bytes"] += os.path.getsize(p); continue
        o = subprocess.run(["node", TOOLS + "/glbpack.mjs", p, "/tmp/glbpack_out.glb"], capture_output=True, text=True, cwd=TOOLS, env=env)
        try: r = json.loads(o.stdout.strip().splitlines()[-1])
        except Exception: res["failed"].append((p, o.stderr[-300:])); continue
        if r["same"] and r["out"] < r["in"]:
            shutil.move("/tmp/glbpack_out.glb", p); res["compressed"].append((os.path.relpath(p, T), r["in"], r["out"]))
        else: res["failed"].append((p, "not identical" if not r["same"] else "not smaller"))
print("already meshopt: %d files %.1f MB (kept as they are)" % (res["already"], res["already_bytes"]/1e6))
print("compressed now: %d files %.1f -> %.1f MB, all geometry/skin/index checks identical" % (len(res["compressed"]), sum(x[1] for x in res["compressed"])/1e6, sum(x[2] for x in res["compressed"])/1e6))
for x in res["compressed"]: print("   %-45s %6.2f -> %6.2f" % (x[0], x[1]/1e6, x[2]/1e6))
print("failed/skipped:", res["failed"])
