"""Image generation through omniroute.

usage: python3 gen.py OUT.png "prompt" [WxH] [ref.png ...]
Reference images are passed as data URLs in `image_url`; the gateway forwards them
to Gemini flash-image, which supports image-to-image.
"""
import sys, json, base64, urllib.request, urllib.error, os, time

KEY = "sk-0af3771bac770e6d-84cf03-a055e297"
URL = "https://cc.hashpa.com/v1/images/generations"
MODEL = os.environ.get("IMG_MODEL", "antigravity/gemini-3.1-flash-image")

def gen(out, prompt, size="1024x1536", refs=()):
    body = {"model": MODEL, "prompt": prompt, "size": size}
    if refs:
        urls = ["data:image/png;base64," + base64.b64encode(open(r, "rb").read()).decode()
                for r in refs]
        body["image_url"] = urls[0] if len(urls) == 1 else urls
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    # the gateway rate-limits bursts, so back off and retry
    for attempt in range(6):
        try:
            d = json.load(urllib.request.urlopen(req, timeout=600)); break
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or attempt == 5:
                print("HTTP", e.code, e.read()[:200].decode("utf8", "replace")); return False
            wait = 20 * (attempt + 1)
            print("retry in %ds (HTTP %d)" % (wait, e.code), flush=True); time.sleep(wait)
    else:
        return False
    data = d.get("data") or []
    if not data or not data[0].get("b64_json"):
        print("NO IMAGE", str(d)[:300]); return False
    open(out, "wb").write(base64.b64decode(data[0]["b64_json"]))
    print("OK", out, os.path.getsize(out)); return True

if __name__ == "__main__":
    out, prompt = sys.argv[1], sys.argv[2]
    size = sys.argv[3] if len(sys.argv) > 3 else "1024x1536"
    gen(out, prompt, size, sys.argv[4:])
