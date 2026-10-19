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
l = "loadItem=f=>itemCache[f]||(itemCache[f]=new Promise(res=>IL.load(f,g=>{"; n3 = s.count(l)
s = s.replace(l, l + "shrinkTex(g.scene);")
assert n2 == 1 and n3 == 1 and n1 >= 18, (n1, n2, n3)
left = re.findall(r"LITE\+'items", s)
open(p, "w", encoding="utf-8").write(s)
print("item paths switched:", n1, "covers:", n2, "loadItem shrink hook:", n3, "left:", left)
