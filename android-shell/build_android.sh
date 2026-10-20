#!/bin/bash
# admin 5935/5949: the FULL Android app. Everything the game shows is bundled in the APK, served by Capacitor
# from https://localhost with the same paths as the live site:
#   /runecast/            Vite build (base /runecast/), API -> https://bingual.app/runecast-api (CORS: https://localhost)
#   /runecast-hero/       static3d/runecast-hero   (three r164 + fonts vendored, no CDN)
#   /runecast-wardrobe/   static3d/runecast-wardrobe (own.js API made absolute)
#   /vendor/              three r164 (build + used examples/jsm), Google Fonts used by the hero page
#   /index.html           router: a folder URL -> that folder's index.html; /offline.html if the WebView fails
# Needs: node 22, python3 + Pillow, cwebp, ffmpeg (libopus), JDK 21, Android SDK 35.
# Signing: /opt/bingual/keys/englishspell/keystore.properties (outside the repo).
#   android-shell/build_android.sh            web bundle + cap sync + signed release APK
#   android-shell/build_android.sh web        web bundle + cap sync only
set -e
cd "$(dirname "$0")/.."
export PATH=/opt/bingual/dev/node/node-v22.14.0-linux-x64/bin:$PATH
export JAVA_HOME=${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64} ANDROID_HOME=${ANDROID_HOME:-/opt/android-sdk}
API=https://bingual.app/runecast-api
W=android-web
rm -rf $W && mkdir -p $W
cp -a android-shell/index.html android-shell/offline.html android-shell/icon.png android-shell/vendor $W/
VITE_API_BASE=$API npx vite build --base /runecast/ --outDir $W/runecast --emptyOutDir 2>&1 | grep -E "built in|error|Error"
[ -s $W/runecast/index.html ] || { echo "VITE BUILD FAILED"; exit 1; }
rm -rf $W/runecast/fonts-test   # test-only font previews
rm -rf $W/runecast/notif        # web push pictures only; the app uses res/drawable-nodpi/notif_* (10-20)
for d in runecast-hero runecast-wardrobe; do cp -a static3d/$d $W/$d; done
CDN=https://cdn.jsdelivr.net/npm/three@0.164.1/
GF='https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800\&family=Nunito:wght@600;700;800;900\&display=swap'
for f in $W/runecast-hero/index.html $W/runecast-wardrobe/index.html; do
  sed -i -e "s#${CDN}#/vendor/three/#g" -e "s#${GF}#/vendor/fonts/gfonts.css#g" \
         -e 's#<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>##' "$f"
done
sed -i "s#const API = '/runecast-api';#const API = '$API';#" $W/runecast-wardrobe/own.js
grep -q "const API = '$API'" $W/runecast-wardrobe/own.js || { echo "own.js API rewrite failed"; exit 1; }
# nothing may still point at a CDN or another host (the API is the only remote)
LEFT=$(grep -rlE "cdn\.jsdelivr|unpkg\.com|fonts\.googleapis|fonts\.gstatic" $W --include=*.html --include=*.js --include=*.css || true)
[ -z "$LEFT" ] || { echo "REMOTE REFERENCES LEFT: $LEFT"; exit 1; }
# ---- lean pack (admin 5949/5966/5973): one copy of the hero/wardrobe shared folders (aliased in MainActivity),
# no meshes outside the catalogue, the hero on the full wardrobe items (textures shrunk at load), the grip body for
# battle/profile/result, lossless meshopt + GLB JPEG->WebP q90 (gltf-transform, checked mesh by mesh), app PNG->WebP,
# irradiance PNG->lossless WebP, SFX above 64 kb/s -> Opus 64k. Never through Blender.
PK=android-shell/pack
[ -d $PK/node_modules ] || (cd $PK && npm ci --no-audit --no-fund >/dev/null)
python3 $PK/lean1.py $W
python3 $PK/hero_full_items.py $W/runecast-hero/index.html && rm -rf $W/runecast-hero/lite/items
python3 $PK/hero_grip.py $W/runecast-hero/index.html
python3 $PK/glb_all.py $W
python3 $PK/texwebp_all.py $W
python3 $PK/hero_tex1k.py $W   # admin 6225: 1024 px side copies of the hero item textures (+~6 MB), no full-size decode on the phone
python3 $PK/webp_all.py $W 2>&1 | grep -v "libpng warning"
python3 $PK/opus_all.py $W
du -sh $W; du -sh $W/* | sort -rh
npx cap sync android 2>&1 | grep -E "✔|error|Error" | head -5
[ "$1" = web ] && exit 0
cd android
./gradlew --no-daemon --max-workers=3 -q assembleRelease -PesKeystoreProps=/opt/bingual/keys/englishspell/keystore.properties 2>&1 | grep -vE "^Note:|warning:|deprecat" | tail -20
A=app/build/outputs/apk/release/app-release.apk
ls -la $A && $ANDROID_HOME/build-tools/35.0.0/apksigner verify $A 2>/dev/null && echo SIGNED_OK
