#!/usr/bin/env bash
# Copies the Quaternius Ultimate Modular Men + Women outfits the game uses (CC0) into
# public/assets/characters/quaternius-modular/. The originals are 3 MB glTFs with 24 clips,
# ~10 materials and a pistol; slim-character.mjs turns each into a ~230 KB one-draw-call GLB.
# Needs network access to drive.google.com, plus python3 (for gdown).
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
OUT=public/assets/characters

QUAT_MEN="https://drive.google.com/drive/folders/1USAAquX2JJWuA2m6zol0KUkFe3UkZ8zX"   # Ultimate Modular Men
QUAT_WOMEN="https://drive.google.com/drive/folders/1720N9IGyQHXYvtvZJzazhxtTTlz-y2Vf" # Ultimate Modular Women
QUAT="men/Suit:male-suit men/Casual_Hoodie:male-casual-hoodie men/Casual_2:male-casual men/Beach:male-beach men/Worker:male-worker
women/Formal:female-formal women/Casual:female-casual women/Suit:female-suit women/Punk:female-punk women/Worker:female-worker"
# The Worker outfits are builders (yellow hard hat, orange hi-vis vest); recolour them into a
# housekeeping uniform: white cap and trim, navy vest and trousers. Linear RGB.
UNIFORM='{"Worker_Yellow":[0.8,0.8,0.8],"Worker_Vest":[0.03,0.07,0.2],"Brown":[0.02,0.03,0.07],"Brown_02":[0.02,0.03,0.07],"Brown2":[0.015,0.02,0.05],"LightBrown":[0.6,0.6,0.6]}'

# Quaternius Ultimate Modular Men + Women
python3 -m venv "$TMP/py" && "$TMP/py/bin/pip" install -q gdown
# List each Drive folder and download only the glTFs and licence we need: the folders also
# hold hundreds of MB of .blend/.fbx files, and Drive refuses some of those downloads.
"$TMP/py/bin/python" -I - "$TMP" "$QUAT_MEN" "$QUAT_WOMEN" $QUAT <<'PY'
import os, sys, gdown
tmp, men, women, *pairs = sys.argv[1:]
for sex, url in (("men", men), ("women", women)):
    want = {f"Individual Characters/glTF/{p.split(':')[0].split('/')[1]}.gltf" for p in pairs if p.startswith(sex + "/")} | {"License.txt"}
    files = {f.path: f.id for f in gdown.download_folder(url, skip_download=True, quiet=True, output=f"{tmp}/{sex}/")}
    for path in sorted(want):
        os.makedirs(os.path.dirname(f"{tmp}/{sex}/{path}"), exist_ok=True)
        gdown.download(id=files[path], output=f"{tmp}/{sex}/{path}", quiet=True, retries=3) or sys.exit(f"download failed: {sex}/{path}")
PY
npm install -s --prefix "$TMP/gt" @gltf-transform/core@4.5.1 @gltf-transform/functions@4.5.1 @gltf-transform/extensions@4.5.1 meshoptimizer@1.3.0
cp scripts/slim-character.mjs "$TMP/gt/"
mkdir -p "$OUT/quaternius-modular"
for pair in $QUAT; do
  src=${pair%%:*} name=${pair##*:}
  recolor='{}'; [[ $name == *worker ]] && recolor=$UNIFORM
  node "$TMP/gt/slim-character.mjs" "$TMP/${src%%/*}/Individual Characters/glTF/${src##*/}.gltf" "$OUT/quaternius-modular/$name.glb" "$recolor"
done
cp "$TMP/men/License.txt" "$OUT/quaternius-modular/LICENSE.txt"
