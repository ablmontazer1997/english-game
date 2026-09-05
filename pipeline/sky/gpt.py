"""gpt-image via omniroute codex provider, with reference images (image-to-image).

usage: python3 gpt.py OUT.png PROMPT_FILE [WxH] [ref.png ...]
"""
import sys, json, base64, urllib.request, urllib.error, os, time

KEY = os.environ.get("OMNI_KEY", "sk-0af3771bac770e6d-d1c5c5-7bfad1b2")
URL = "https://cc.hashpa.com/v1/responses"
MODEL = os.environ.get("IMG_MODEL", "codex/gpt-5.6-sol-medium")

def gen(out, prompt, size="1024x1536", refs=()):
    content = [{"type": "input_text", "text": prompt}]
    for r in refs:
        b64 = base64.b64encode(open(r, "rb").read()).decode()
        content.append({"type": "input_image",
                        "image_url": "data:image/png;base64," + b64})
    body = json.dumps({
        "model": MODEL,
        "input": [{"role": "user", "content": content}],
        "tools": [{"type": "image_generation", "size": size, "quality": "high"}],
    }).encode()
    for attempt in range(5):
        req = urllib.request.Request(URL, data=body, headers={
            "Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
        try:
            d = json.load(urllib.request.urlopen(req, timeout=900)); break
        except urllib.error.HTTPError as e:
            msg = e.read()[:200].decode("utf8", "replace")
            if e.code not in (429, 500, 502, 503, 504) or attempt == 4:
                print("HTTP", e.code, msg); return False
            w = 25 * (attempt + 1); print("retry %ds (%d)" % (w, e.code), flush=True); time.sleep(w)
    else:
        return False
    for o in d.get("output", []):
        if o.get("type") == "image_generation_call" and o.get("result"):
            open(out, "wb").write(base64.b64decode(o["result"]))
            print("OK", out, os.path.getsize(out)); return True
    print("NO IMAGE", d.get("status"), json.dumps(d)[:300]); return False

if __name__ == "__main__":
    out = sys.argv[1]
    prompt = open(sys.argv[2]).read().strip() if os.path.exists(sys.argv[2]) else sys.argv[2]
    size = sys.argv[3] if len(sys.argv) > 3 else "1024x1536"
    gen(out, prompt, size, sys.argv[4:])
