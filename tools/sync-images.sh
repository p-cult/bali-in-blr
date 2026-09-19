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
# It reads the published schedule sheet and the Collab/venues tab, downloads
# every Drive-linked image, optimises it (caps the long side, recompresses),
# and writes it to assets/drive/<fileId>.<ext> — the path main.js maps every
# Drive link to (see toImageUrl). So the sheet keeps the Drive link; the site
# serves the local optimised copy. Re-running picks up any changed file.
#
# A photograph becomes .jpg. An image with real transparency — a collaborator
# logo — stays .png with its alpha, because flattening it onto white puts a
# glaring box on the cream partner tile. Only one extension exists per id; the
# site tries both and then the live Drive copy, so a logo still shows the
# moment its link is in the sheet, before this script has ever run.
#
# Dependency-free on macOS (curl + `sips`). Elsewhere it uses whichever of
# these is present, in order: ImageMagick (`magick` / `convert`), Python 3
# with Pillow, or — with none of them — it keeps the download as-is, full
# size, so the site still works and you can optimise later. Drive files must
# be shared "Anyone with the link".
# ============================================================================
set -euo pipefail

# --new-only: fetch ids that have no local copy yet and leave existing files
# untouched. Different machines' image tools produce different bytes for the
# same source, so re-optimising everything on a schedule would rewrite every
# file on every run and fight with local runs. The scheduled job uses this;
# a human runs the script bare to refresh a changed image.
NEW_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --new-only) NEW_ONLY=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

SCHEDULE_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vTji37D6cT7J9bLFptJdNaYrvZF_soZyiqIsX-rHYUj4H6rnfMCExu2hIyVjCk48j86rdaBhp_lthzb/pub?gid=289612903&single=true&output=tsv"
# Bridge feed fallback (owner-read; works even if the tab isn't published).
SCHEDULE_ALT="https://script.google.com/macros/s/AKfycbyKXzPHQLsHCoryx0aJVpVkP0Z0XrnPxjucaiUJtR1aXeux33ygq2Br2QcBNU_MAB7qDw/exec?feed=schedule"
# The Partners tab (via the bridge) may hold collaborator logos as Drive links.
PARTNERS_URL="https://script.google.com/macros/s/AKfycbyKXzPHQLsHCoryx0aJVpVkP0Z0XrnPxjucaiUJtR1aXeux33ygq2Br2QcBNU_MAB7qDw/exec?sheet=partners"
# The "Collab / venues" tab's Files column holds collaborator logos as Drive
# links; scan it so those logos are synced alongside event images.
COLLAB_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vTji37D6cT7J9bLFptJdNaYrvZF_soZyiqIsX-rHYUj4H6rnfMCExu2hIyVjCk48j86rdaBhp_lthzb/pub?gid=7166598&single=true&output=tsv"
MAXDIM=1600          # longest side, px — photographs
LOGOMAX=600          # longest side, px — transparent logos, drawn at 30-60px
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
# Does this image carry real transparency? Logos do; photographs don't. A
# transparent logo flattened to JPEG gains a white box, which is glaring on the
# cream partner tile — so those are kept as PNG with their alpha intact.
has_alpha() {
  case "$TOOL" in
    sips)    [ "$(sips -g hasAlpha "$1" 2>/dev/null | awk '/hasAlpha/{print $2}')" = "yes" ] ;;
    magick)  [ "$(magick identify -format '%A' "$1" 2>/dev/null)" != "Undefined" ] ;;
    convert) [ "$(identify -format '%A' "$1" 2>/dev/null)" != "Undefined" ] ;;
    pillow)  python3 -c 'import sys; from PIL import Image; im=Image.open(sys.argv[1]); sys.exit(0 if (im.mode in ("RGBA","LA","PA") or "transparency" in im.info) else 1)' "$1" >/dev/null 2>&1 ;;
    *)       return 1 ;;
  esac
}
optimise_png() {  # in out — resize, keep alpha
  case "$TOOL" in
    sips)    cp "$1" "$2" && sips -Z "$LOGOMAX" -s format png "$2" >/dev/null ;;
    magick)  magick "$1" -auto-orient -resize "${LOGOMAX}x${LOGOMAX}>" "png:$2" ;;
    convert) convert "$1" -auto-orient -resize "${LOGOMAX}x${LOGOMAX}>" "png:$2" ;;
    pillow)  python3 - "$1" "$2" "$LOGOMAX" <<'PY'
import sys; from PIL import Image, ImageOps
im=ImageOps.exif_transpose(Image.open(sys.argv[1])).convert("RGBA")
im.thumbnail((int(sys.argv[3]),int(sys.argv[3])))
im.save(sys.argv[2],"PNG",optimize=True)
PY
    ;;
    *)       cp "$1" "$2" ;;
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
curl -fsSL --max-time 30 "$SCHEDULE_URL" -o "$tmp" \
  || curl -fsSL --max-time 30 "$SCHEDULE_ALT" -o "$tmp" \
  || { echo "Error: could not fetch the schedule (published feed and bridge feed both failed)."; exit 1; }

# Also read the Partners tab and the Collab/venues tab (collaborator logos).
# Non-fatal if either can't load.
echo "Reading partners/collaborators…"
curl -fsSL --max-time 30 "$PARTNERS_URL" >> "$tmp" 2>/dev/null || echo "  (partners feed unavailable — skipping)"
curl -fsSL --max-time 30 "$COLLAB_URL" >> "$tmp" 2>/dev/null || echo "  (collab feed unavailable — skipping)"

# Pull every Google Drive file-id that appears in the schedule or partners feed.
ids="$(tr '\r' '\n' < "$tmp" \
  | grep -oE 'drive\.google\.com/(file/d/|open\?id=|uc\?[^[:space:]]*id=)[A-Za-z0-9_-]+' \
  | grep -oE '[A-Za-z0-9_-]{20,}' | sort -u || true)"
rm -f "$tmp"

if [ -z "$ids" ]; then echo "No Google Drive image links found. Nothing to do."; exit 0; fi

count=0; ok=0; fail=0; skip=0
for id in $ids; do
  count=$((count+1))
  if [ "$NEW_ONLY" = "1" ] && { [ -f "$OUTDIR/$id.jpg" ] || [ -f "$OUTDIR/$id.png" ]; }; then
    skip=$((skip+1)); continue
  fi
  raw="$(mktemp)"
  # Prefer the ORIGINAL file: the thumbnail endpoint always re-encodes to JPEG,
  # which would flatten a transparent logo onto white. Fall back to the
  # thumbnail, which avoids Drive's "confirm download" page on large files.
  if ! curl -fsSL --max-time 60 "https://drive.google.com/uc?export=download&id=${id}" -o "$raw" || ! is_image "$raw"; then
    if ! curl -fsSL --max-time 60 "https://drive.google.com/thumbnail?id=${id}&sz=w2000" -o "$raw"; then
      echo "  ✗ ${id}  — download failed (is it shared 'Anyone with the link'?)"; rm -f "$raw"; fail=$((fail+1)); continue
    fi
  fi
  if ! is_image "$raw"; then
    echo "  ✗ ${id}  — not a readable image (private, or needs manual export)"; rm -f "$raw"; fail=$((fail+1)); continue
  fi
  # A logo keeps its alpha as PNG; a photograph becomes JPEG. Only one of the
  # two ever exists for an id, so the site's .jpg → .png chain lands on it.
  if has_alpha "$raw"; then
    out="$OUTDIR/$id.png"; optimise_png "$raw" "$out"; rm -f "$OUTDIR/$id.jpg"
  else
    out="$OUTDIR/$id.jpg"; optimise "$raw" "$out"; rm -f "$OUTDIR/$id.png"
  fi
  rm -f "$raw"
  echo "  ✓ ${id}  → ${out}  ($(dims "$out"), $(du -h "$out" | cut -f1))"
  ok=$((ok+1))
done

echo
echo "Done: ${ok} synced, ${skip} already present, ${fail} failed, ${count} total → ${OUTDIR}/"
if [ "$ok" -gt 0 ]; then
  echo "Next: git add ${OUTDIR} && git commit -m 'Sync Drive images' && git push"
fi
