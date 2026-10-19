"""option A (admin 5973): in the APK, the battle/map/profile hero loads the FULL wardrobe item GLBs (same geometry
and skin as the lite ones; normals within 0.5 deg) and shrinks their textures to 1024 px at load, like the lite set."""
import sys, re
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
a = "const LITE=BATTLE&&BKQ.get('lite')!=='0'?'lite/':'';"
assert s.count(a) == 1
s = s.replace(a, a + "const ITEMS=LITE?'../runecast-wardrobe/items/':'items/';"
  "const TEXMAX=1024;const shrinkTex=root=>{if(!LITE)return;const seen=new Set();root.traverse(o=>{const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];"
  "for(const m of ms)for(const k in m){const t=m[k];if(!t||!t.isTexture||seen.has(t))continue;seen.add(t);const im=t.image;"
  "if(!im||!im.width||Math.max(im.width,im.height)<=TEXMAX)continue;const sc=TEXMAX/Math.max(im.width,im.height);"
  "const c=document.createElement('canvas');c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);"
  "const x=c.getContext('2d');x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';x.drawImage(im,0,0,c.width,c.height);"
  "if(im.close)im.close();t.image=c;t.needsUpdate=true;}});};")
n1 = s.count("LITE+'items/'"); s = s.replace("LITE+'items/'", "ITEMS"); n1 += s.count("LITE+'items/"); s = s.replace("LITE+'items/", "ITEMS+'")
c = "LITE+(window.RCH5?'items5':'items')+'/cover_'"; n2 = s.count(c)
s = s.replace(c, "(window.RCH5?LITE+'items5/':ITEMS)+'cover_'")
# 0.2.1 (admin 5999, startup): decode + shrink in one step off the main thread (createImageBitmap resize, size read from the
# WebP/PNG header) instead of decoding the full 2048-4096 px image and redrawing it on a canvas; JPEG/unknown keeps the old path
s = s.replace("const TEXMAX=1024;", "const TEXMAX=1024;const texDim=async b=>{try{const u=new Uint8Array(await b.slice(0,40).arrayBuffer());"
  "const t=String.fromCharCode(...u.subarray(12,16));if(String.fromCharCode(...u.subarray(8,12))==='WEBP'){"
  "if(t==='VP8 ')return [(u[26]|u[27]<<8)&16383,(u[28]|u[29]<<8)&16383];"
  "if(t==='VP8L')return [1+(u[21]|(u[22]&63)<<8),1+(u[22]>>6|u[23]<<2|(u[24]&15)<<10)];"
  "if(t==='VP8X')return [1+(u[24]|u[25]<<8|u[26]<<16),1+(u[27]|u[28]<<8|u[29]<<16)];}"
  "if(u[1]===80&&u[2]===78&&u[3]===71){const v=new DataView(u.buffer);return [v.getUint32(16),v.getUint32(20)];}}catch(e){}return null;};"
  "const fastTex=L=>{if(!LITE||typeof createImageBitmap!=='function')return;L.register(p=>{const tl=p.textureLoader;if(tl&&tl.isImageBitmapLoader){"
  "tl.load=(url,onLoad,onProg,onErr)=>{fetch(url).then(r=>r.blob()).then(async b=>{const o={premultiplyAlpha:'none',colorSpaceConversion:'none'};"
  "const d=await texDim(b);if(d&&d[0]&&d[1]&&Math.max(d[0],d[1])>TEXMAX){const sc=TEXMAX/Math.max(d[0],d[1]);"
  "o.resizeWidth=Math.round(d[0]*sc);o.resizeHeight=Math.round(d[1]*sc);o.resizeQuality='high';}return createImageBitmap(b,o);}).then(onLoad,onErr);};}"
  "return {name:'ES_fastTex'};});};", 1)
il = "const IL=new THREE.GLTFLoader();"; assert s.count(il) == 1
s = s.replace(il, il + "fastTex(IL);")
l = "loadItem=f=>itemCache[f]||(itemCache[f]=new Promise(res=>IL.load(f,g=>{"; n3 = s.count(l)
s = s.replace(l, l + "shrinkTex(g.scene);")
assert n2 == 1 and n3 == 1 and n1 >= 18, (n1, n2, n3)
left = re.findall(r"LITE\+'items", s)
open(p, "w", encoding="utf-8").write(s)
print("item paths switched:", n1, "covers:", n2, "loadItem shrink hook:", n3, "left:", left)
