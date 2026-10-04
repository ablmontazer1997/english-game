# static3d: 3D wardrobe and hero pages

Static, self-contained three.js pages (three r128 from jsDelivr) plus the final 3D models they load.
They are not part of the Vite build; they are served as plain static folders and the app embeds them in iframes.

- `runecast-wardrobe/`, served at https://bingual.app/runecast-wardrobe/
  The character editor (Sims-style tabs: body, face, eyes, hair, tops, coats, pants, shoes, poses).
  The app iframes it with `?embed=1` (and `?embed=1&portrait=1` for the profile portrait) and uses `thumbs/item_<id>.png` for shop/item icons.
  Loads `base_m.glb` (base body + animations), `items/<id>.glb` + `items/cover_<id>.json` (garments and hairs),
  `light/` and `light_f08/` (per-vertex baked lighting, `manifest.json` + `<item>__<mesh>[.nc].bin`), `eyes/` (eye textures), `thumbs/` (editor thumbnails).
- `runecast-hero/`, served at https://bingual.app/runecast-hero/
  The same character renderer used as the in-game hero (Boss Battle, map). The app always calls it with `?embed=1&battle=1...`,
  which switches it to the meshopt-compressed `lite/base_m.glb` and `lite/items/`. It shares `light/`, `light_f08/` and `eyes/` with the wardrobe.

Old versions and backups (backup_* dirs, index.html.bak-*, index_v13.html, wizard*.glb) were left out on purpose.
Deploy: copy each folder as-is to the web root (e.g. ~/bingual-landing/ on the host).
