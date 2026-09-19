#!/usr/bin/env bash
# Check that this machine can carry on with the project.
#
#     bash tools/doctor.sh
#
# The project travels on an external drive: the repository, its .git history,
# the git identity and the vault key all live on it. Almost everything is
# therefore already correct on a new machine — this script says which of the
# few remaining things are not. Run it first on any computer you have not
# worked on before.
#
# It only reads. Nothing here changes the repository or the drive.

cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"

pass=0; warn=0; fail=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; pass=$((pass+1)); }
note() { printf '  \033[33m!\033[0m %s\n     → %s\n' "$1" "$2"; warn=$((warn+1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n     → %s\n' "$1" "$2"; fail=$((fail+1)); }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

printf '\033[1mBali in Bengaluru — can this machine carry on?\033[0m\n'
printf 'Repository: %s\n' "$ROOT"

# ---------------------------------------------------------------- the drive
head_ "The drive"
case "$ROOT" in
  /Volumes/*) ok "Working from an external volume ($(echo "$ROOT" | cut -d/ -f1-3))" ;;
  *) note "Not running from /Volumes — this is a copy, not the drive" \
          "Fine to work in, but commit and push, or the drive falls behind." ;;
esac

# --------------------------------------------------------------- the tools
head_ "Tools"
for c in git python3 openssl; do
  if command -v "$c" >/dev/null 2>&1; then ok "$c — $(command -v $c)"
  else bad "$c is missing" "Install it; the project cannot run without $c."; fi
done

if command -v gh >/dev/null 2>&1; then ok "gh — $(command -v gh)"
else
  # The repo's credential helper is `gh auth git-credential`, so a push on a
  # machine without gh fails at the helper rather than at GitHub.
  bad "gh (GitHub CLI) is missing" \
      "This repo authenticates pushes through gh. Install it (brew install gh), then: gh auth login"
fi

CHROME=""
for c in "$CHROME_BIN" \
         "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         "/Applications/Chromium.app/Contents/MacOS/Chromium" \
         "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
  [ -n "$c" ] && [ -x "$c" ] && { CHROME="$c"; break; }
done
[ -z "$CHROME" ] && CHROME="$(command -v google-chrome || command -v chromium || true)"
if [ -n "$CHROME" ]; then ok "Chrome — $CHROME"
else note "No Chrome found" \
      "Only needed to rebuild the calendar PDF. Install Chrome, or set CHROME=/path/to/chrome."; fi

IMG=""
for c in sips magick convert; do command -v "$c" >/dev/null 2>&1 && { IMG="$c"; break; }; done
[ -z "$IMG" ] && python3 -c 'import PIL' >/dev/null 2>&1 && IMG="python3 + Pillow"
if [ -n "$IMG" ]; then ok "Image optimiser — $IMG"
else note "No image optimiser (sips / ImageMagick / Pillow)" \
      "Only needed by tools/sync-images.sh. Without one, synced Drive photos stay full size. Install ImageMagick, or: pip3 install Pillow"; fi

# ----------------------------------------------------------------- the repo
head_ "Repository"
if git rev-parse --git-dir >/dev/null 2>&1; then ok "Git history is present on the drive"
else bad "No .git here" "The history did not travel. Clone from GitHub instead."; fi

name="$(git config user.name)"; email="$(git config user.email)"
if [ -n "$name" ] && [ -n "$email" ]; then ok "Commit identity: $name <$email>"
else bad "No git identity" \
      "git config user.name 'your name' && git config user.email 'you@example.com'"; fi

if [ -z "$(git status --porcelain)" ]; then ok "Working tree is clean"
else note "Uncommitted changes present" "Commit or stash them before you start."; fi

# -------------------------------------------------------------- the remote
head_ "GitHub"
printf '  Remote: %s\n' "$(git remote get-url origin 2>/dev/null || echo 'none')"
if git ls-remote --exit-code origin >/dev/null 2>&1; then
  ok "origin is reachable and credentials work"
  git fetch -q origin 2>/dev/null
  local_h="$(git rev-parse @ 2>/dev/null)"
  remote_h="$(git rev-parse @{u} 2>/dev/null)"
  if [ -z "$remote_h" ]; then note "No upstream branch set" "git push -u origin main"
  elif [ "$local_h" = "$remote_h" ]; then ok "In sync with origin/main"
  elif [ "$local_h" = "$(git merge-base @ @{u})" ]; then
    note "Behind origin/main" "git pull --ff-only origin main"
  else note "Ahead of / diverged from origin/main" "Push, or reconcile before working."; fi
else
  bad "Cannot reach origin (or not authenticated)" \
      "Check the network, then: gh auth login   (choose HTTPS)"
fi

# --------------------------------------------------------------- the vault
head_ "Sealed notes"
KEY="${BALI_VAULT_KEY:-/Volumes/bkp-01/.secrets/bali-in-blr.key}"
if [ -r "$KEY" ]; then
  ok "Key readable at $KEY"
  if bash tools/vault.sh show >/dev/null 2>&1; then ok "Vault decrypts"
  else bad "Key present but the vault will not open" \
        "Wrong key file. The right one is on the drive at .secrets/ — never online."; fi
else
  bad "No key at $KEY" \
      "Plug the drive in. If it mounted elsewhere: export BALI_VAULT_KEY=/path/to/bali-in-blr.key"
fi

# ---------------------------------------------------------------- the site
head_ "Site"
[ -f index.html ] && [ -f styles.css ] && [ -f main.js ] \
  && ok "Site files present" || bad "Site files missing" "The drive copy is incomplete."
n=$(ls assets 2>/dev/null | wc -l | tr -d ' ')
[ "$n" -gt 0 ] && ok "assets/ has $n files" || bad "assets/ is empty" "Images did not travel."

# ------------------------------------------------------- internal tooling
head_ "Internal tools and automation"
for f in admin/index.html admin/tickets.html admin/report.html \
         admin/campaign-links.html admin/auth.js progress/index.html; do
  [ -f "$f" ] && ok "$f" || bad "$f is missing" "The drive copy is incomplete."
done
if [ -f .github/workflows/sync-drive-images.yml ]; then
  ok "Hourly Drive-image sync workflow present"
else
  bad "sync-drive-images.yml is missing" \
      "New images in the sheet would stop reaching the site. Restore it from git."
fi
for f in docs/apps-script/Code.gs docs/apps-script/Tickets.gs; do
  [ -f "$f" ] && ok "$f backed up" \
    || bad "$f is missing" "That script then exists ONLY inside Google, with no backup."
done

# ------------------------------------------------------------- the backends
# URLs are read out of the files that use them, so this stays honest if either
# web app is ever redeployed.
head_ "Backends"
if command -v curl >/dev/null 2>&1; then
  BRIDGE=$(grep -oE 'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec' main.js | head -1)
  TICKETS=$(grep -oE 'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec' admin/tickets.html | head -1)
  if [ -n "$BRIDGE" ] && curl -sL --max-time 25 "$BRIDGE?sheet=stats" | grep -q '"registered"'; then
    ok "Registration bridge answering"
  else
    note "Registration bridge did not answer" \
         "Forms and live counts are down, or it was redeployed to a new /exec URL."
  fi
  if [ -n "$TICKETS" ] && curl -sL --max-time 25 "$TICKETS?data=1" | grep -q '"totalTickets"'; then
    ok "Tickets web app answering"
  else
    note "Tickets web app did not answer" \
         "Retry once; it serves an interstitial now and then. If it persists it was redeployed -- NEVER create a new deployment, update the existing one (docs/JOURNAL.md, 19 Sep)."
  fi
  if curl -s -o /dev/null -w '%{http_code}' --max-time 25 https://bali-in-blr.paramfoundation.org/ | grep -q 200; then
    ok "Live site responding"
  else
    note "Live site did not respond 200" "Check GitHub Pages and the custom domain."
  fi
else
  note "curl not found -- skipped the backend checks" "Install curl to test them."
fi

# ------------------------------------------ the one thing that cannot be undone
head_ "Recoverability"
if [ -r "$KEY" ]; then
  note "The vault key exists in ONE place only: $KEY" \
       "Lose the drive and the private half is gone for good, by design (docs/SECURITY.md). Keep a second copy somewhere offline -- never in git, never in cloud storage."
fi

printf '\n\033[1m%s passed, %s to look at, %s blocking\033[0m\n' "$pass" "$warn" "$fail"
if [ "$fail" -eq 0 ]; then
  printf 'Ready. Serve it with:  python3 -m http.server 8000\n'
else
  printf 'Fix the ✗ lines above, then run this again.\n'
fi
exit 0
