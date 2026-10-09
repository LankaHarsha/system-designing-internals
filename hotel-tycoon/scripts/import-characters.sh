#!/usr/bin/env bash
# Copies the candidate character packs (both CC0) into public/assets/characters/.
# Kenney ships GLBs as-is. Quaternius ships 3 MB embedded glTFs with combat clips
# and a pistol, so each one goes through slim-character.mjs: hotel clips only, binary GLB.
# Needs network access to kenney.nl and drive.google.com, plus python3 (for gdown).
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
OUT=public/assets/characters

KENNEY_ZIP="https://kenney.nl/media/pages/assets/mini-characters/bfc7e272b4-1774770718/kenney_mini-characters.zip"
KENNEY="male-a female-a male-c female-c male-e female-e"
QUAT_MEN="https://drive.google.com/drive/folders/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX"   # Ultimate Modular Men
QUAT_WOMEN="https://drive.google.com/drive/folders/1720N9IGyQHXYvtvZJzazhxtTTlz-y2Vf" # Ultimate Modular Women
QUAT="men/Suit:male-suit women/Formal:female-formal men/Casual_Hoodie:male-casual-hoodie women/Casual:female-casual"

# Kenney Mini Characters
curl -fsSL -o "$TMP/kenney.zip" "$KENNEY_ZIP"
unzip -q "$TMP/kenney.zip" -d "$TMP/kenney"
mkdir -p "$OUT/kenney-mini/Textures"
for n in $KENNEY; do cp "$TMP/kenney/Models/GLB format/character-$n.glb" "$OUT/kenney-mini/"; done
cp "$TMP/kenney/Models/GLB format/Textures/colormap.png" "$OUT/kenney-mini/Textures/"
cp "$TMP/kenney/License.txt" "$OUT/kenney-mini/LICENSE.txt"

# Quaternius Ultimate Modular Men + Women
python3 -m venv "$TMP/py" && "$TMP/py/bin/pip" install -q gdown
"$TMP/py/bin/gdown" -q --folder "$QUAT_MEN" -O "$TMP/men"
"$TMP/py/bin/gdown" -q --folder "$QUAT_WOMEN" -O "$TMP/women"
npm install -s --prefix "$TMP/gt" @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4
cp scripts/slim-character.mjs "$TMP/gt/"
mkdir -p "$OUT/quaternius-modular"
for pair in $QUAT; do
  src=${pair%%:*} name=${pair##*:}
  node "$TMP/gt/slim-character.mjs" "$TMP/${src%%/*}/Individual Characters/glTF/${src##*/}.gltf" "$OUT/quaternius-modular/$name.glb"
done
cp "$TMP/men/License.txt" "$OUT/quaternius-modular/LICENSE.txt"
