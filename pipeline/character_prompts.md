# Runecast — Layered Character (mannequin + layers)

Model: a base MANNEQUIN (skin only + simple neutral underclothes) in several skin-tone
variants per gender. Skin color = swapping the mannequin asset (NOT a runtime recolor).
Everything else — eyes, hair, top, pants, shoes, cloak, hat, staff — is a SEPARATE layer
that sits on top of the mannequin.

Every asset is authored on the SAME 1254x1254 canvas, body centered, identical pose/scale,
transparent background — so all layers stack pixel-aligned. Style = Pixar-ish soft 3D matching
the base bodies already delivered (mage_m / mage_f).

Folders: src/assets/character/{body,eyes,hair,top,bottom,shoes,cloak,hat,staff}/*.png
Paint order (back→front): body < bottom < shoes < top < cloak < eyes < hair < hat < staff.

## Common rule (prefix EVERY item prompt, image-to-image from a reference body)
"Using the provided base character as an EXACT reference for pose, size, position, canvas
(1254x1254) and art style, draw ONLY the {ITEM} fitted to this exact body. Output ONLY the
{ITEM}, everything else fully transparent — same canvas and placement, same soft Pixar 3D
style and lighting. Do NOT redraw the body or anything else. Fully transparent background."

## 0) Mannequin (base body) — the colored mannequins
Make a neutral base first: same A-pose/canvas, a plain simple sleeveless undershirt + short
neutral shorts, bare arms/legs, neutral face WITHOUT eyes (eyes are a separate layer),
simple short hair or bald cap (hair is a separate layer too — keep the head neutral).
Then produce it in several SKIN TONES per gender (image-to-image, change only skin color):
  files: body/m_light.png, body/m_medium.png, body/m_tan.png, body/m_deep.png, body/m_dark.png
         body/f_light.png, body/f_medium.png, body/f_tan.png, body/f_deep.png, body/f_dark.png
Prompt: "the same mannequin, skin tone changed to {light / medium tan / deep brown / dark},
keep everything else identical, same canvas and pose, transparent background."

## 1) Layers (image-to-image FROM a mannequin of the matching gender)
Replace {ITEM} in the common rule with:

EYES (eyes/*.png) — a pair of eyes placed on the face:
  - round friendly blue eyes / brown eyes / green eyes / big anime-style eyes
HAIR (hair/*.png — make per gender, put m_/f_ prefix):
  - short tousled hair / long wavy hair / a high ponytail / curly hair / a bob
TOP (top/*.png — shirt/tunic covering torso+arms, open shows nothing under):
  - a simple apprentice tunic / a hooded jacket / a star-patterned mage vest
BOTTOM (bottom/*.png — pants/leggings):
  - plain leggings / puffy trousers / a long skirt
SHOES (shoes/*.png):
  - brown leather boots / soft slippers
CLOAK (cloak/*.png — over the shoulders, open at front):
  - a wizard cloak / a short hooded cape / a long star cloak
HAT (hat/*.png):
  - a classic tall pointed wizard hat / a hood up
STAFF (staff/*.png — held in the right hand):
  - a wooden staff with a glowing crystal / a short wand / a lantern staff

Colors: keep neutral/mid — tops, pants, hair, eyes, cloak, hat, staff are all recolorable
in-app by tint, so one neutral version per item is enough (no need per color).
