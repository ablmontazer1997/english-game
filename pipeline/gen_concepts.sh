set -e
G=/home/rade/projects/rusty-stories/pipeline/gptimg.py
PY=/usr/bin/python3
MEM="Concept art mockup of a mobile word-learning mini-game screen named 'Memory Crystals', portrait phone screen. Cute casual mobile-game UI style (like Match-3 / Duolingo), soft rounded cards, friendly Fredoka-style vibe. A 4x3 grid of glowing magical memory cards: most face-down showing an ornate crystal/rune back, a couple flipped face-up showing a word. A cheerful cartoon fox-wizard mascot peeking from a corner. Warm magical palette: soft cream/lavender background with purple, teal and gold accents, gentle glow. Clean, polished, juicy, high quality game UI."
GAP="Concept art mockup of a mobile word-learning mini-game screen named 'Gap Gate', portrait phone screen. Cute casual mobile-game UI style, soft rounded elements, friendly Fredoka-style vibe. Centerpiece is a glowing magical stone GATE / portal with a glowing runic blank slot to fill in a missing word; below it a row of rounded word-tile options floating. A cheerful cartoon fox-wizard mascot beside the gate. Warm magical palette: soft cream/lavender background with purple, teal and gold accents, gentle glow and sparkles. Clean, polished, juicy, high quality game UI."
$PY $G "$MEM" concept_memory.png 1024x1536 && echo MEM_DONE
$PY $G "$GAP" concept_gap.png 1024x1536 && echo GAP_DONE
