#!/usr/bin/env bash
# ============================================================================
# state.sh — what is actually true, right now.
#
#     bash .brain/tools/state.sh
#
# Run this FIRST, every session. It exists so that re-acquiring context costs
# one command instead of reading documentation and trusting it. Everything it
# prints was just measured; nothing here is a claim.
#
# It only reads. Nothing is changed.
#
# Project-specific values come from brain.conf, so this file stays general.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

ok()   { printf '  \033[32m*\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m!\033[0m %s\n' "$1"; }
dim()  { printf '  \033[2m%s\033[0m\n' "$1"; }
hd()   { printf '\n\033[1m%s\033[0m\n' "$1"; }

[ -f brain.conf ] && . ./brain.conf 2>/dev/null
PROJECT_NAME="${PROJECT_NAME:-$(basename "$ROOT")}"
LIVE_URL="${LIVE_URL:-}"; HEALTH_URLS="${HEALTH_URLS:-}"
SOURCE_URL="${SOURCE_URL:-}"; VAULT_KEY="${VAULT_KEY:-}"

printf '\033[1m%s\033[0m  —  %s\n' "$PROJECT_NAME" "$(date '+%Y-%m-%d %H:%M')"
dim "$ROOT"

# ------------------------------------------------------------------ the repo
hd "Repo"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  ok "branch: $(git branch --show-current 2>/dev/null || echo detached)"
  if [ -z "$(git status --porcelain)" ]; then ok "working tree clean"
  else
    bad "$(git status --porcelain | wc -l | tr -d ' ') uncommitted change(s)"
    git status --porcelain | head -5 | sed 's/^/        /'
  fi
  if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
    git fetch -q origin 2>/dev/null || true
    set -- $(git rev-list --left-right --count '@{u}...HEAD' 2>/dev/null || echo "0 0")
    [ "${1:-0}" = 0 ] && [ "${2:-0}" = 0 ] && ok "in sync with upstream" \
      || bad "${1:-0} behind, ${2:-0} ahead of upstream"
  else
    bad "no upstream branch set"
  fi
  dim "last: $(git log -1 --format='%h %ad %s' --date=short 2>/dev/null | cut -c1-72)"
else
  bad "not a git repository"
fi

# ----------------------------------------------------------------- the brain
hd "Brain"
if [ -f .brain/VERSION ]; then
  ok "vendored brain $(cat .brain/VERSION)"
  [ -f .brain/SOURCE ] && dim "$(sed -n '2p' .brain/SOURCE)"
else
  bad "no .brain/ — run: brain.sh pull ."
fi
[ -f brain.conf ] && ok "brain.conf present" || bad "no brain.conf — project facts have nowhere to live"

# ------------------------------------------------------------------ the live
if [ -n "$LIVE_URL$HEALTH_URLS$SOURCE_URL" ]; then
  hd "Live"
  if command -v curl >/dev/null 2>&1; then
    if [ -n "$LIVE_URL" ]; then
      code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$LIVE_URL" 2>/dev/null)
      [ "$code" = "200" ] && ok "site 200  $LIVE_URL" || bad "site $code  $LIVE_URL"
    fi
    for u in $HEALTH_URLS; do
      code=$(curl -sL -o /dev/null -w '%{http_code}' --max-time 25 "$u" 2>/dev/null)
      [ "$code" = "200" ] && ok "endpoint 200  ${u:0:58}" || bad "endpoint $code  ${u:0:58}"
    done
    if [ -n "$SOURCE_URL" ]; then
      n=$(curl -sL --max-time 25 "$SOURCE_URL" 2>/dev/null | wc -l | tr -d ' ')
      [ "${n:-0}" -gt 1 ] && ok "content source answering ($n lines)" \
        || bad "content source returned $n lines — check it is still published"
    fi
  else
    bad "curl missing — cannot verify anything live"
  fi
fi

# ----------------------------------------------------------------- the vault
if [ -n "$VAULT_KEY" ] || [ -f secure/vault.json.enc ]; then
  hd "Vault"
  K="${BRAIN_VAULT_KEY:-$VAULT_KEY}"   # BRAIN_VAULT_KEY overrides brain.conf per command
  if [ -n "$K" ] && [ -r "$K" ]; then
    ok "key readable"
    if [ -x .brain/tools/vault.sh ] || [ -f .brain/tools/vault.sh ]; then
      VAULT_KEY="$K" bash .brain/tools/vault.sh show >/dev/null 2>&1 \
        && ok "vault decrypts" || bad "key present but the vault will not open"
    fi
  else
    bad "vault key not readable${K:+ at $K}"
  fi
fi

printf '\n'
dim "Everything above was measured just now. Docs may disagree; they are wrong."
dim "Before working in an area, read .brain/wisdom/ for it.   History: docs/JOURNAL.md"
