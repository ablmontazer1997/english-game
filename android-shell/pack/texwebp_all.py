import os, json, struct, subprocess, sys, shutil
T = os.path.abspath(sys.argv[1]); TOOLS = os.path.dirname(os.path.abspath(__file__))
env = dict(os.environ, PATH="/opt/bingual/dev/node/node-v22.14.0-linux-x64/bin:" + os.environ["PATH"])
done = []; bad = []
for dp, dn, fn in os.walk(T):
    for f in sorted(fn):
        if not f.endswith(".glb"): continue
        if dp.endswith("/lite"): continue   # the 3 small hero bodies (0.27 MB textures) do not re-write cleanly in gltf-transform: kept as they are
        p = os.path.join(dp, f)
        o = subprocess.run(["node", TOOLS + "/texwebp.mjs", p, "/tmp/tw_out.glb"], capture_output=True, text=True, cwd=TOOLS, env=env)
        try: r = json.loads(o.stdout.strip().splitlines()[-1])
        except Exception: bad.append((p, o.stderr[-300:])); continue
        if r["textures"] == 0: continue
        # same geometry/skin/morph check as step 2 (glbpack.mjs compares in vs out element by element)
        c = subprocess.run(["node", TOOLS + "/geomcheck.mjs", p, "/tmp/tw_out.glb"], capture_output=True, text=True, cwd=TOOLS, env=env).stdout.strip()
        if c != "SAME": bad.append((p, c)); continue
        shutil.move("/tmp/tw_out.glb", p); done.append((os.path.relpath(p, T), r))
tin = sum(r["in"] for _, r in done); tout = sum(r["out"] for _, r in done)
print("GLBs with JPEG->WebP: %d, textures %d, GLB bytes %.1f -> %.1f MB (textures %.1f -> %.1f MB); geometry/skin/morph identical in all" % (len(done), sum(r["textures"] for _, r in done), tin/1e6, tout/1e6, sum(r["tex_in"] for _, r in done)/1e6, sum(r["tex_out"] for _, r in done)/1e6))
print("problems:", bad)
