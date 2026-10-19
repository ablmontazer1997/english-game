"""admin 5976: profile/result heroes (battle=1&map=1 without gel) load the grip body (lite/base_m_grip.glb) instead of
lite/base_m.glb: the same mesh + a 'grip' shape key that stays 0 there (the battle rig returns early for map/profile),
so they look the same and the APK keeps one body file less. The map (gel) keeps its 5-digit body (base_m5)."""
import sys, os
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
b = "BATTLE&&!BKQ.has('map')&&BKQ.get('grip')!=='0'?'base_m_grip.glb?v=g7o'"
assert s.count(b) == 1
s = s.replace(b, "BATTLE&&!window.RCH5&&BKQ.get('grip')!=='0'?'base_m_grip.glb?v=g7o'")
open(p, "w", encoding="utf-8").write(s)
os.remove(os.path.join(os.path.dirname(p), "lite/base_m.glb")); print("hero: grip body for battle/profile/result, lite/base_m.glb dropped")
