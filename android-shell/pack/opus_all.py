"""option C: every app mp3 above 64 kb/s -> Ogg Opus 64 kb/s (Chromium WebView plays Opus in <audio>); references rewritten.
Files already at <= 64 kb/s stay mp3 (re-encoding them would not save anything)."""
import os, subprocess, sys, glob
T = sys.argv[1]; A = os.path.join(T, "runecast/assets")
conv = []; kept = []
for f in sorted(os.listdir(A)):
    if not f.endswith(".mp3"): continue
    p = os.path.join(A, f)
    br, dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=bit_rate,duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout.strip().split(",")[::-1][:2]
    br = int(br) // 1000 if br.isdigit() else int(float(dur)) if False else int(subprocess.run(["ffprobe","-v","error","-show_entries","format=bit_rate","-of","csv=p=0",p],capture_output=True,text=True).stdout.strip())//1000
    if br <= 66: kept.append(f); continue
    o = p[:-4] + ".ogg"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", p, "-c:a", "libopus", "-b:a", "64k", "-vbr", "on", "-map_metadata", "-1", o], check=True)
    # decode test: the whole file must decode without errors and keep its duration
    d1 = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p],capture_output=True,text=True).stdout)
    d2 = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",o],capture_output=True,text=True).stdout)
    err = subprocess.run(["ffmpeg","-v","error","-i",o,"-f","null","-"],capture_output=True,text=True).stderr.strip()
    if err or abs(d1 - d2) > 0.15 or os.path.getsize(o) >= os.path.getsize(p): os.remove(o); kept.append(f + " (opus check failed: %s %.2f/%.2f)" % (err[:60], d1, d2)); continue
    conv.append((f, br, os.path.getsize(p), os.path.getsize(o), d1)); os.remove(p)
texts = [x for x in glob.glob(os.path.join(T, "runecast/**/*"), recursive=True) if x.endswith((".js", ".css", ".html"))]
for t in texts:
    s = open(t, encoding="utf-8").read(); s0 = s
    for f, *_ in conv: s = s.replace(f, f[:-4] + ".ogg")
    if s != s0: open(t, "w", encoding="utf-8").write(s)
left = [c[0] for c in conv if any(c[0] in open(t, encoding="utf-8").read() for t in texts)]
print("mp3 -> opus 64k: %d files %.1f -> %.1f MB (%.0f s audio), all decode clean, durations kept; stale refs %d" % (len(conv), sum(c[2] for c in conv)/1e6, sum(c[3] for c in conv)/1e6, sum(c[4] for c in conv), len(left)))
print("kept as mp3 (<=64 kb/s):", len(kept), [k for k in kept if "failed" in k])
