"""admin 6225 (Home load, APK): the map/battle/profile hero loads the FULL wardrobe item GLBs (option A, admin 5973), whose
textures are up to 4096 px, and shrank them to 1024 at load (a full-size WebP decode per garment on the phone). This step
writes a 1024 px WebP side copy of every item texture above 1024 (runecast-hero/tex1k/<item>_<image>.webp, ~0.1-0.3 MB each,
no second mesh) and gives the hero page a per-item GLTFLoader plugin that takes the side copy instead of decoding the
embedded image (the embedded one is used if the side copy fails). The wardrobe keeps the full textures.
usage: hero_tex1k.py <android-web dir>"""
import io, json, os, struct, sys
from PIL import Image
T = sys.argv[1]; IT = os.path.join(T, "runecast-wardrobe", "items"); OUT = os.path.join(T, "runecast-hero", "tex1k")
MAX = 1024; os.makedirs(OUT, exist_ok=True)
man = {}; nb = 0; srcb = 0
for f in sorted(os.listdir(IT)):
    if not f.endswith(".glb"): continue
    b = open(os.path.join(IT, f), "rb").read(); n = struct.unpack("<I", b[12:16])[0]; j = json.loads(b[20:20 + n]); o0 = 20 + n + 8
    for i, im in enumerate(j.get("images", [])):
        if "bufferView" not in im: continue
        bv = j["bufferViews"][im["bufferView"]]; data = b[o0 + bv.get("byteOffset", 0): o0 + bv.get("byteOffset", 0) + bv["byteLength"]]
        img = Image.open(io.BytesIO(data)); w, h = img.size
        if max(w, h) <= MAX: continue
        sc = MAX / max(w, h); img = img.resize((round(w * sc), round(h * sc)), Image.LANCZOS)
        if img.mode not in ("RGB", "RGBA"): img = img.convert("RGBA" if "A" in img.mode else "RGB")
        o = io.BytesIO(); img.save(o, "WEBP", quality=90, method=6); id_ = f[:-4]
        open(os.path.join(OUT, "%s_%d.webp" % (id_, i)), "wb").write(o.getvalue())
        man.setdefault(id_, []).append(i); nb += len(o.getvalue()); srcb += len(data)
p = os.path.join(T, "runecast-hero", "index.html"); s = open(p, encoding="utf-8").read()
l = "loadItem=f=>itemCache[f]||(itemCache[f]=new Promise(res=>IL.load(f,g=>{"; assert s.count(l) == 1, "loadItem anchor"
il = "const IL=new THREE.GLTFLoader();"; assert s.count(il) == 1, "IL anchor"
s = s.replace(il, il + "const T1K=" + json.dumps(man, separators=(",", ":")) + ";"
  "const ITL=f=>{const id=(f.match(/items\\/([^.?\\/]+)\\.glb/)||[])[1],s1=id&&T1K[id];if(!s1||typeof createImageBitmap!=='function')return IL;"
  "const L=new THREE.GLTFLoader();if(window.MeshoptDecoder)L.setMeshoptDecoder(MeshoptDecoder);"
  "L.pluginCallbacks.unshift(p=>({name:'ES_tex1k',loadTexture(ti){const td=p.json.textures[ti],src=td.extensions&&td.extensions.EXT_texture_webp?td.extensions.EXT_texture_webp.source:td.source;"
  "if(!s1.includes(src))return null;const o={premultiplyAlpha:'none',colorSpaceConversion:'none'};"
  "return p.loadTextureImage(ti,src,{isImageBitmapLoader:true,load:(u,ok,pr,er)=>{fetch('tex1k/'+id+'_'+src+'.webp?v=1').then(r=>{if(!r.ok)throw 0;return r.blob();})"
  ".catch(()=>fetch(u).then(r=>r.blob())).then(b=>createImageBitmap(b,o)).then(ok,er);}});}}));return L;};", 1)
s = s.replace(l, l.replace("IL.load(f,", "ITL(f).load(f,"), 1)
open(p, "w", encoding="utf-8").write(s)
print("tex1k: %d items, %d textures, side copies %.1f MB (embedded originals %.1f MB stay in the wardrobe GLBs)" % (len(man), sum(map(len, man.values())), nb / 1e6, srcb / 1e6))
