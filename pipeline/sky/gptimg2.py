"""gpt-image via omniroute, with optional reference images (image-to-image).

usage: python3 gptimg2.py OUT.png "prompt" [size] [ref1.png ref2.png ...]
"""
import sys, json, base64, urllib.request, os

KEY = "sk-0af3771bac770e6d-84cf03-a055e297"
URL = "https://cc.hashpa.com/v1/responses"

def gen(out, prompt, size="1024x1536", refs=()):
    content = [{"type": "input_text", "text": prompt}]
    for r in refs:
        b64 = base64.b64encode(open(r, "rb").read()).decode()
        content.append({"type": "input_image",
                        "image_url": "data:image/png;base64," + b64})
    body = json.dumps({
        "model": "codex/gpt-5.6-sol-medium",
        "input": [{"role": "user", "content": content}],
        "tools": [{"type": "image_generation", "size": size, "quality": "high"}],
    }).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=600))
    for o in d.get("output", []):
        if o.get("type") == "image_generation_call" and o.get("result"):
            open(out, "wb").write(base64.b64decode(o["result"]))
            print("OK", out, os.path.getsize(out)); return True
    print("NO IMAGE", d.get("status"), json.dumps(d)[:400]); return False

if __name__ == "__main__":
    out, prompt = sys.argv[1], sys.argv[2]
    size = sys.argv[3] if len(sys.argv) > 3 else "1024x1536"
    gen(out, prompt, size, sys.argv[4:])
