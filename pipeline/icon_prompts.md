# Runecast — 3D Icon Generation Prompts

Pipeline: **prompt → gpt-image (2D concept) → Hunyuan3D (shape + full texture) → render/bake**.
Feed each prompt to gpt-image, get a clean transparent PNG, then run it through the 3D pipeline
(`/numa1/blender_work/runecast/` on bms; `make3d` runner).

## Art direction (MUST stay consistent across every icon)
**Soft Stylized Low-Poly 3D** — beveled/chamfered forms, smooth **matte** materials, rounded
toy-like shapes, premium mobile-game asset quality. Soft studio lighting, gentle ambient occlusion,
a subtle **cyan rim light** on the edges. **Night-magic palette:** deep indigo `#0c1440`, warm gold
`#f5c451`, amethyst purple `#9a6bff`, glowing cyan `#57c8ff`. Every icon: **one** object, centered,
**three-quarter front view**, isolated on a **fully transparent background**, **no text**, **no baked
drop shadow**, **no ground plane**, clean readable silhouette, high detail. Output **transparent PNG**.

> Tip for the 3D step: keep the object solid and closed (no thin flat planes), so Hunyuan builds a
> clean watertight mesh. Emissive/glowing parts (liquids, runes, flames) read best if they are a
> distinct bright color against the matte body.

---

## STYLE SUFFIX (append this to every subject line below)
Per the admin's exact art spec: **Soft Stylized Low-Poly 3D** — between low-poly and smooth
stylized 3D. Large geometric surfaces kept, but **beveled/chamfered and smoothed** so edges are
soft and toy-like, **NOT** classic sharp faceted low-poly. **Matte / semi-matte materials, soft
reflections, NO busy texture or fine detail — the geometric form itself carries the character.**
```
Soft Stylized Low-Poly 3D, beveled geometric shapes with rounded chamfered edges, smooth matte materials, minimal game-asset aesthetic, no fine texture and no surface detail (form-driven), soft studio lighting with soft shadows and subtle ambient occlusion at the part joints, clean toy-like premium design, minimal saturated colors from the night-magic palette (deep indigo, warm gold, amethyst purple, glowing cyan). Cute, playful, premium. Single centered object, three-quarter front view, isolated on a pure black background, no text, no drop shadow, no ground plane, clean readable silhouette.
```

---

## Currencies & resources

### 1. Heart (life)
```
A single plump glossy heart gem for a lives counter, deep ruby-red crystal body with a warm inner glow, wrapped by a thin ornate gold rim and a tiny gold crown notch at the top. STYLE SUFFIX
```

### 2. Mana Potion (energy)
```
A single rounded alchemy potion flask, chunky low-poly glass bottle with a short neck and a cork, filled with glowing swirling cyan-to-amethyst liquid and a few floating sparkles, a small gold band around the neck. STYLE SUFFIX
```

### 3. Coin (soft currency)
```
A single thick gold coin standing at a three-quarter tilt, chamfered rim, an amethyst-purple rune star embossed on the face, soft golden highlights. STYLE SUFFIX
```

### 4. Gem (hard currency)
```
A single large faceted amethyst gemstone, clean low-poly cut facets, deep purple with cyan inner light and a bright specular sparkle, tiny gold flecks. STYLE SUFFIX
```

### 5. Rating Star
```
A single chunky five-point star, warm gold body with beveled edges, a soft glowing cyan core and a subtle sparkle, rounded toy-like corners. STYLE SUFFIX
```

## Rewards & progression

### 6. Treasure Chest (closed)
```
A single closed treasure chest, rounded low-poly wooden body with gold trim and rivets, a glowing amethyst crystal lock on the front, faint cyan magic seams between the boards. STYLE SUFFIX
```

### 7. Treasure Chest (open, reward burst)
```
A single open treasure chest overflowing with gold coins and a bright amethyst-and-cyan magical light bursting upward, rounded low-poly wooden body with gold trim. STYLE SUFFIX
```

### 8. Golden Key
```
A single ornate golden key with a chunky low-poly bow shaped like a rune loop set with a small amethyst gem, beveled teeth, warm gold with a cyan rim glint. STYLE SUFFIX
```

### 9. Streak Flame
```
A single stylized magical flame, smooth rounded low-poly tongues of fire in cyan-to-amethyst gradient with a bright white-hot core, no logs, floating. STYLE SUFFIX
```

### 10. League Trophy
```
A single victory trophy cup, chunky low-poly gold goblet with two handles on a stepped base, a glowing amethyst crystal set in the front, subtle cyan rim light. STYLE SUFFIX
```

### 11. League Shield / Rank Badge
```
A single heraldic shield badge, rounded low-poly gold-rimmed shield with a deep indigo face, a glowing cyan rune sigil in the center and small amethyst studs at the corners. STYLE SUFFIX
```

## Spell & learning theme

### 12. Spellbook
```
A single closed magic spellbook, rounded low-poly cover in deep indigo leather with gold corner caps and a gold clasp, a glowing amethyst rune emblem on the cover and faint cyan light leaking from the page edges. STYLE SUFFIX
```

### 13. Quest Scroll
```
A single rolled parchment scroll tied with a gold ribbon, warm cream paper with softly glowing cyan rune marks peeking out, chunky low-poly rolled ends. STYLE SUFFIX
```

### 14. Rune Tile (letter/spell token)
```
A single square stone rune tile with rounded beveled edges, blue-grey cobblestone body with mossy gold-flecked corners, a single glowing cyan rune glyph carved and lit on the face. STYLE SUFFIX
```

### 15. Crystal Shard (collectible)
```
A single tall amethyst crystal shard cluster on a small rocky base, sharp low-poly facets glowing from within in purple and cyan, tiny sparkles. STYLE SUFFIX
```

### 16. Magic Wand
```
A single short magic wand, chunky low-poly indigo handle with gold rings, topped by a glowing amethyst star-gem shedding cyan sparkles. STYLE SUFFIX
```

### 17. Hourglass (SRS timer)
```
A single ornate hourglass, rounded low-poly gold frame with amethyst end caps, glowing cyan magical sand suspended mid-fall, soft inner light. STYLE SUFFIX
```

### 18. Padlock (locked stage)
```
A single stout padlock, blue-grey stone body with a heavy gold shackle and rivets, a dim amethyst rune keyhole, matte and slightly weathered. STYLE SUFFIX
```

---

## Batch note
- Generate all at the **same resolution and framing** (object filling ~70% of the frame, centered) so
  they slot into the HUD/economy UI at one scale.
- Keep the **camera angle identical** (gentle three-quarter, ~15° down) across the set for a coherent tray.
- After gpt-image: drop each PNG into the 3D pipeline; the node-token result is the quality bar.
