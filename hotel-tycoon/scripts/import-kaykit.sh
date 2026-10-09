#!/usr/bin/env bash
# Copies the KayKit props the game uses from KayKit's official GitHub repos (CC0)
# into public/assets/kaykit/. Re-run after editing the lists below.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FURNITURE="armchair_pillows couch_pillows table_low table_medium lamp_standing lamp_table rug_rectangle_stripes_A cactus_medium_A cactus_small_B shelf_B_large_decorated pictureframe_large_A cabinet_medium_decorated bed_double_A bed_single_A"
RESTAURANT="table_round_A chair_A kitchencounter_straight_A"

fetch() { # repo, dir inside repo, texture, names...
  local repo=$1 dir=$2 tex=$3 out=$4; shift 4
  git clone -q --depth 1 --filter=blob:none --sparse "https://github.com/KayKit-Game-Assets/$repo" "$TMP/$repo"
  git -C "$TMP/$repo" sparse-checkout set --no-cone "/$dir/$tex" "/LICENSE.txt" $(for n in "$@"; do printf '/%s/%s.gltf /%s/%s.bin ' "$dir" "$n" "$dir" "$n"; done)
  mkdir -p "public/assets/kaykit/$out"
  cp "$TMP/$repo/$dir/$tex" "public/assets/kaykit/$out/"
  cp "$TMP/$repo/LICENSE.txt" "public/assets/kaykit/$out/LICENSE.txt"
  for n in "$@"; do cp "$TMP/$repo/$dir/$n.gltf" "$TMP/$repo/$dir/$n.bin" "public/assets/kaykit/$out/"; done
  echo "$repo @ $(git -C "$TMP/$repo" rev-parse --short HEAD)"
}

fetch KayKit-Furniture-Bits-1.0 addons/kaykit_furniture_bits/Assets/gltf furniturebits_texture.png furniture $FURNITURE
fetch KayKit-Restaurant-Bits-1.0 addons/kaykit_restaurant_bits/Assets/gltf restaurantbits_texture.png restaurant $RESTAURANT
