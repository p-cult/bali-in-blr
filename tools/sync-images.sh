#!/usr/bin/env bash
# ============================================================================
# sync-images.sh — bring Google Drive event images on-site, optimised.
#
# Why: staff paste a Google Drive link into the schedule sheet's "image"
# column, but Drive images can't be embedded in a browser <img>. This site is
# static (GitHub Pages, no server), so there is nothing to fetch/optimise them
# at request time. Run this whenever a Drive image is added or changed:
#
#     bash tools/sync-images.sh
#     git add assets/drive && git commit -m "Sync Drive images" && git push
#
# It reads the published schedule sheet, downloads every Drive-linked image,
# optimises it (caps the long side, recompresses), and writes it to
# assets/drive/<fileId>.jpg — the exact path main.js maps every Drive link to
# (see toImageUrl). So the sheet keeps the Drive link; the site serves the
# local optimised copy. Re-running picks up any changed photo.
#
# Dependency-free on macOS (curl + `sips`). Elsewhere it uses whichever of
# these is present, in order: ImageMagick (`magick` / `convert`), Python 3
# with Pillow, or — with none of them — it keeps the download as-is, full
# size, so the site still works and you can optimise later. Drive files must
# be shared "Anyone with the link".
# ============================================================================
set -euo pipefail

SCHEDULE_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vTji37D6cT7J9bLFptJdNaYrvZF_soZyiqIsX-rHYUj4H6rnfMCExu2hIyVjCk48j86rdaBhp_lthzb/pub?gid=289612903&single=true&output=tsv"
MAXDIM=1600          # longest side, px
QUALITY=70           # JPEG quality
OUTDIR="assets/drive"

cd "$(dirname "$0")/.."

command -v curl >/dev/null || { echo "Error: curl not found."; exit 1; }
mkdir -p "$OUTDIR"

# Pick an image tool for this machine. Each optimise_* takes (in, out) and
# writes a JPEG no larger than MAXDIM on its long side at QUALITY.
TOOL=""
if command -v sips >/dev/null 2>&1; then TOOL="sips"
elif command -v magick >/dev/null 2>&1; then TOOL="magick"
elif command -v convert >/dev/null 2>&1 && convert -version 2>/dev/null | grep -q ImageMagick; then TOOL="convert"
elif python3 -c 'import PIL' >/dev/null 2>&1; then TOOL="pillow"
fi
[ -n "$TOOL" ] && echo "Optimising with: $TOOL" || echo "No image tool found (sips / ImageMagick / Pillow): images will be kept full size."

is_image() {
  case "$TOOL" in
    sips)    sips -g pixelWidth "$1" >/dev/null 2>&1 ;;
    magick)  magick identify "$1" >/dev/null 2>&1 ;;
    convert) identify "$1" >/dev/null 2>&1 ;;
    pillow)  python3 -c 'import sys; from PIL import Image; Image.open(sys.argv[1]).verify()' "$1" >/dev/null 2>&1 ;;
    *)       head -c 4 "$1" | grep -q $'\xff\xd8\|\x89PNG\|RIFF\|GIF8' ;;
  esac
}
optimise() {  # in out
  case "$TOOL" in
    sips)    cp "$1" "$2" && sips -Z "$MAXDIM" -s format jpeg -s formatOptions "$QUALITY" "$2" >/dev/null ;;
    magick)  magick "$1" -auto-orient -resize "${MAXDIM}x${MAXDIM}>" -quality "$QUALITY" "jpg:$2" ;;
    convert) convert "$1" -auto-orient -resize "${MAXDIM}x${MAXDIM}>" -quality "$QUALITY" "jpg:$2" ;;
    pillow)  python3 - "$1" "$2" "$MAXDIM" "$QUALITY" <<'PY'
import sys; from PIL import Image, ImageOps
im=ImageOps.exif_transpose(Image.open(sys.argv[1])).convert("RGB")
im.thumbnail((int(sys.argv[3]),int(sys.argv[3])))
im.save(sys.argv[2],"JPEG",quality=int(sys.argv[4]),optimize=True)
PY
    ;;
    *)       cp "$1" "$2" ;;
  esac
}
dims() {
  case "$TOOL" in
    sips)    sips -g pixelWidth -g pixelHeight "$1" | awk '/pixelWidth/{w=$2}/pixelHeight/{h=$2}END{print w"x"h}' ;;
    magick)  magick identify -format '%wx%h' "$1" ;;
    convert) identify -format '%wx%h' "$1" ;;
    pillow)  python3 -c 'import sys; from PIL import Image; print("%dx%d"%Image.open(sys.argv[1]).size)' "$1" ;;
    *)       echo "as downloaded" ;;
  esac
}

echo "Reading schedule sheet…"
tmp="$(mktemp)"
curl -fsSL --max-time 30 "$SCHEDULE_URL" -o "$tmp" || { echo "Error: could not fetch the schedule sheet."; exit 1; }

# Pull every Google Drive file-id that appears anywhere in the sheet.
ids="$(tr '\r' '\n' < "$tmp" \
  | grep -oE 'drive\.google\.com/(file/d/|open\?id=|uc\?[^[:space:]]*id=)[A-Za-z0-9_-]+' \
  | grep -oE '[A-Za-z0-9_-]{20,}' | sort -u || true)"
rm -f "$tmp"

if [ -z "$ids" ]; then echo "No Google Drive image links in the sheet. Nothing to do."; exit 0; fi

count=0; ok=0; fail=0
for id in $ids; do
  count=$((count+1))
  out="$OUTDIR/$id.jpg"
  raw="$(mktemp)"
  # The thumbnail endpoint reliably returns a JPEG for a shared file and avoids
  # Drive's "confirm download" page that large uc?export links can return.
  if ! curl -fsSL --max-time 60 "https://drive.google.com/thumbnail?id=${id}&sz=w2000" -o "$raw"; then
    echo "  ✗ ${id}  — download failed (is it shared 'Anyone with the link'?)"; rm -f "$raw"; fail=$((fail+1)); continue
  fi
  if ! is_image "$raw"; then
    echo "  ✗ ${id}  — not a readable image (private, or needs manual export)"; rm -f "$raw"; fail=$((fail+1)); continue
  fi
  optimise "$raw" "$out"; rm -f "$raw"
  echo "  ✓ ${id}  → ${out}  ($(dims "$out"), $(du -h "$out" | cut -f1))"
  ok=$((ok+1))
done

echo
echo "Done: ${ok} synced, ${fail} failed, ${count} total → ${OUTDIR}/"
if [ "$ok" -gt 0 ]; then
  echo "Next: git add ${OUTDIR} && git commit -m 'Sync Drive images' && git push"
fi
