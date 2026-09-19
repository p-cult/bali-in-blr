#!/usr/bin/env bash
# images.sh — one intelligent image compressor.
#
# Never upscales (resize uses "NxN>"), never touches originals, skips files
# already small enough, and keeps the original bytes if "compressed" came out
# bigger. Origin: the media tooling project, lifted unchanged in behaviour.
#
# Defaults (your spec): longest side <=1250px, JPEG quality 75, output "../low".
# It is "smart" about the rest:
#   • Auto-orients by EXIF (portrait/landscape handled correctly), then strips metadata.
#   • Picks the right encoder per format:  JPEG->cjpeg   PNG->pngquant+oxipng   WebP->cwebp.
#   • SKIPS images that are already within the size limit AND already small on disk,
#     so re-runs are cheap and nothing is needlessly re-encoded.
#   • Never touches originals; never re-processes its own output folder.
#   • If a "compressed" file comes out bigger than the original, it copies the original instead.
#
# Usage:   cd /folder/with/images && .brain/tools/images.sh [options]
#
#   -m PX      max longest side            (default 1250)
#   -q N       JPEG/WebP quality 1-100     (default 75)
#   -o DIR     output folder               (default ../low)
#   -f FMT     force output format: keep|jpg|webp   (default keep)
#   -r         recurse into subfolders (mirrors tree)
#   -k         keep metadata (default: strip EXIF/GPS)
#   -h         help
#
# Examples:
#   bash .brain/tools/images.sh                       # ../low, 1250px, q75
#   bash .brain/tools/images.sh -m 1920 -q 82         # bigger, higher quality
#   bash .brain/tools/images.sh -f webp -o ../web     # convert everything to WebP
#   bash .brain/tools/images.sh -r                    # whole tree

set -euo pipefail

MAX=1250; QUALITY=75; OUT="../low"; FORCE="keep"; RECURSE=0; STRIP=1

while getopts "m:q:o:f:rkh" opt; do
  case "$opt" in
    m) MAX="$OPTARG" ;;
    q) QUALITY="$OPTARG" ;;
    o) OUT="$OPTARG" ;;
    f) FORCE="$OPTARG" ;;
    r) RECURSE=1 ;;
    k) STRIP=0 ;;
    h) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Try: $0 -h" >&2; exit 1 ;;
  esac
done

command -v magick >/dev/null || { echo "Need ImageMagick (magick)." >&2; exit 1; }
have() { command -v "$1" >/dev/null; }

# ---- helpers ----
hr(){ awk -v b="$1" 'BEGIN{s="B KB MB GB";split(s,u," ");i=1;while(b>=1024&&i<4){b/=1024;i++}printf (i==1?"%d %s":"%.1f %s"),b,u[i]}'; }
fsize(){ stat -f%z "$1" 2>/dev/null || stat -c%s "$1"; }
strip_flag(){ [ "$STRIP" -eq 1 ] && echo "-strip" || echo ""; }

OUT_BASENAME="$(basename "$OUT")"
mkdir -p "$OUT"
OUT_ABS="$(cd "$OUT" && pwd)"

TOTAL_IN=0; TOTAL_OUT=0; COUNT=0; SKIP=0

# decide output format+extension for a source
target_ext(){ # $1=lower ext -> echoes ext
  case "$FORCE" in
    jpg)  echo jpg ;;
    webp) echo webp ;;
    keep) case "$1" in jpeg) echo jpg ;; *) echo "$1" ;; esac ;;
  esac
}

process(){ # $1=source file, $2=output dir
  local f="$1" od="$2" base lower ext out in w h longest need_resize
  base="$(basename "$f")"; lower="$(echo "${base##*.}" | tr '[:upper:]' '[:lower:]')"
  ext="$(target_ext "$lower")"
  mkdir -p "$od"
  out="$od/${base%.*}.$ext"
  in=$(fsize "$f")

  # read dimensions (auto-oriented so EXIF-rotated phone photos measure correctly)
  local dims; dims="$(magick "$f[0]" -auto-orient -format '%w %h' info: 2>/dev/null || echo '0 0')"
  w="${dims% *}"; h="${dims#* }"
  [ -n "$w" ] || w=0; [ -n "$h" ] || h=0
  longest=$(( w > h ? w : h ))
  need_resize=$(( longest > MAX ? 1 : 0 ))

  # SMART SKIP: same format, already within size, and already small on disk (<400KB)
  if [ "$FORCE" = keep ] && [ "$need_resize" -eq 0 ] && [ "$in" -lt 409600 ]; then
    cp "$f" "$out"
    SKIP=$((SKIP+1)); COUNT=$((COUNT+1)); TOTAL_IN=$((TOTAL_IN+in)); TOTAL_OUT=$((TOTAL_OUT+in))
    printf "  %-38s %9s  (copied, already small)\n" "$base" "$(hr "$in")"
    return
  fi

  local resize=""; [ "$need_resize" -eq 1 ] && resize="-resize ${MAX}x${MAX}>"
  local S; S="$(strip_flag)"

  case "$ext" in
    jpg)
      if have cjpeg; then
        magick "$f" -auto-orient $resize $S ppm:- \
          | cjpeg -quality "$QUALITY" -progressive -optimize -outfile "$out" >/dev/null 2>&1
      else
        magick "$f" -auto-orient $resize $S -quality "$QUALITY" "$out"
      fi ;;
    png)
      magick "$f" -auto-orient $resize $S "$out"
      have pngquant && pngquant --quality=65-90 --strip --force --output "$out" -- "$out" 2>/dev/null || true
      have oxipng  && oxipng -o 4 --strip safe --quiet "$out" 2>/dev/null || true ;;
    webp)
      if have cwebp; then
        local tmp; tmp="$(mktemp).png"
        magick "$f" -auto-orient $resize $S "$tmp"
        cwebp -quiet -q "$QUALITY" "$tmp" -o "$out" >/dev/null 2>&1
        rm -f "$tmp"
      else
        magick "$f" -auto-orient $resize $S -quality "$QUALITY" "$out"
      fi ;;
    *)
      magick "$f" -auto-orient $resize $S "$out" ;;
  esac

  # guard: if we made it bigger (tiny/already-optimized source), keep the original bytes
  local osz; osz=$(fsize "$out")
  if [ "$FORCE" = keep ] && [ "$osz" -ge "$in" ]; then cp "$f" "$out"; osz=$in; fi

  TOTAL_IN=$((TOTAL_IN+in)); TOTAL_OUT=$((TOTAL_OUT+osz)); COUNT=$((COUNT+1))
  local pct; pct=$(awk -v a="$in" -v b="$osz" 'BEGIN{printf "%d",(a>0)?(100-100*b/a):0}')
  printf "  %-38s %9s -> %9s  (%s%%)  %dx%d\n" "$base" "$(hr "$in")" "$(hr "$osz")" "$pct" "$w" "$h"
}

echo "Source : $(pwd)"
echo "Output : $OUT_ABS   max=${MAX}px  q=${QUALITY}  format=${FORCE}  strip=${STRIP}  recurse=${RECURSE}"
echo "------------------------------------------------------------------------"

if [ "$RECURSE" -eq 1 ]; then
  find . -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) \
    ! -path "./$OUT_BASENAME/*" -print0 2>/dev/null |
  while IFS= read -r -d '' f; do
    rel="$(dirname "${f#./}")"; [ "$rel" = "." ] && rel=""
    process "$f" "$OUT${rel:+/$rel}"
  done
else
  shopt -s nullglob nocaseglob
  for f in *.jpg *.jpeg *.png *.webp; do [ -f "$f" ] && process "$f" "$OUT"; done
  shopt -u nullglob nocaseglob
fi

echo "------------------------------------------------------------------------"
if [ "$COUNT" -gt 0 ]; then
  pct=$(awk -v a="$TOTAL_IN" -v b="$TOTAL_OUT" 'BEGIN{printf "%d",(a>0)?(100-100*b/a):0}')
  printf "Done: %d image(s)" "$COUNT"; [ "$SKIP" -gt 0 ] && printf " (%d copied as-is)" "$SKIP"
  printf "   %s -> %s   saved %s%%\n" "$(hr "$TOTAL_IN")" "$(hr "$TOTAL_OUT")" "$pct"
else
  echo "No images found."
fi
