#!/usr/bin/env bash
# Downloads OMIC's existing photography and posters from omic.spot into public/assets.
# Run once from the project root:  npm run fetch-assets   (or: bash scripts/fetch-assets.sh)
set -u
cd "$(dirname "$0")/.."
BASE="https://omic.spot"
OUT="public/assets"
mkdir -p "$OUT/posters" "$OUT/artists" "$OUT/menu" "$OUT/docs" "$OUT/img"

get() { # $1 = remote path, $2 = local path
  if [ -s "$2" ]; then echo "  ✓ $2 (already here)"; return; fi
  if curl -fsSL --retry 2 "$BASE$1" -o "$2"; then echo "  ↓ $2"; else echo "  ✗ $1 (failed)"; rm -f "$2"; fi
}

echo "Posters"
get /posters/newton.jpg                          "$OUT/posters/newton.jpg"
get /posters/omic-art-contest-shared-ground.jpg  "$OUT/posters/art-prize.jpg"
get /poster.jpg                                  "$OUT/posters/nothing-unusual.jpg"
get /posters/panel-discussion-afterimage.jpg     "$OUT/posters/afterimage.jpg"
get /posters/linocut-workshop.jpg                "$OUT/posters/linocut-workshop.jpg"
get /posters/unspoken-workshop.jpg               "$OUT/posters/unspoken-workshop.jpg"
get /posters/living-room.jpg                     "$OUT/posters/living-room.jpg"

echo "Venue"
get /cafe-teaser.jpg "$OUT/img/cafe-interior.jpg"

echo "Cafe menu"
for i in 01 02 03 04 05 06 07 08 09 10; do get "/menu/menu-$i.jpg" "$OUT/menu/menu-$i.jpg"; done
for i in 01 02 03 04 05 06; do get "/menu/dish-$i.jpg" "$OUT/menu/dish-$i.jpg"; done

echo "People"
for p in manish-mundra amit-masurkar pankaj-tripathi rashmi-devi-sawhney \
         patricia-millns jalal-luqman khalil-abdulwahid robin-corcos \
         nujoom-alghanem ali-ettehad curro-gomez elizaveta-pugacheva elham-shafaei \
         gonzalo-rodriguez-gomez maryam-lamei richa-nirwan solimar-miller talal-altukhaes tamer-karam \
         hind-mezaina valentina-della-rocca mohammad-ali-famori beatriz-minguez-de-molina \
         sami-alkour cristina-gabriela daria-avdeeva mrs-helichrysum tanvi-patel \
         seungeun-cho rollie-mukherjee nika-sagamonyants tamara-vasilenko; do
  get "/artists/$p.jpg" "$OUT/artists/$p.jpg"
done

echo "Documents"
get /documents/omic-art-prize-2026-rules-and-regulations.pdf "$OUT/docs/omic-art-prize-2026-rules.pdf"

echo "Done. Images live in $OUT"
