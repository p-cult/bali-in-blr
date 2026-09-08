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
# Dependency-free: uses curl + macOS `sips`. Drive files must be shared
# "Anyone with the link".
# ============================================================================
set -euo pipefail

SCHEDULE_URL="https://docs.google.com/spreadsheets/d/e/2PACX-1vTji37D6cT7J9bLFptJdNaYrvZF_soZyiqIsX-rHYUj4H6rnfMCExu2hIyVjCk48j86rdaBhp_lthzb/pub?gid=289612903&single=true&output=tsv"
MAXDIM=1600          # longest side, px
QUALITY=70           # JPEG quality
OUTDIR="assets/drive"

cd "$(dirname "$0")/.."

command -v sips >/dev/null || { echo "Error: sips not found (this script needs macOS)."; exit 1; }
mkdir -p "$OUTDIR"

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
  if ! sips -g pixelWidth "$raw" >/dev/null 2>&1; then
    echo "  ✗ ${id}  — not a readable image (private, or needs manual export)"; rm -f "$raw"; fail=$((fail+1)); continue
  fi
  cp "$raw" "$out"; rm -f "$raw"
  sips -Z "$MAXDIM" -s format jpeg -s formatOptions "$QUALITY" "$out" >/dev/null
  dim="$(sips -g pixelWidth -g pixelHeight "$out" | awk '/pixelWidth/{w=$2}/pixelHeight/{h=$2}END{print w"x"h}')"
  echo "  ✓ ${id}  → ${out}  (${dim}, $(du -h "$out" | cut -f1))"
  ok=$((ok+1))
done

echo
echo "Done: ${ok} synced, ${fail} failed, ${count} total → ${OUTDIR}/"
if [ "$ok" -gt 0 ]; then
  echo "Next: git add ${OUTDIR} && git commit -m 'Sync Drive images' && git push"
fi
