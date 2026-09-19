#!/usr/bin/env bash
# ============================================================================
# handover.sh — pass work safely between sessions, tools or people.
#
#   bash .brain/tools/handover.sh handover   before you stop
#   bash .brain/tools/handover.sh takeover   before you start editing
#
# Both begin with a backup of the working tree, because a backup is what makes
# every other mistake recoverable. Never skip it.
#
# The backup deliberately LEAVES OUT:
#   .git            already a complete history of its own
#   node_modules    reinstallable
#   plaintext secrets (secure/vault.json, .env*) — a backup must not become
#                   another stray plaintext copy (heart/, doctrine/02)
#
# Origin: the magic-phrase rituals from the task-system project, rebuilt without
# the hardcoded runtime path that made its checks silently skip on any machine
# but one.
# ============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1
[ -f brain.conf ] && . ./brain.conf 2>/dev/null || true
NAME="${PROJECT_NAME:-$(basename "$ROOT")}"
BACKUPS="$ROOT/_handover/backups"
KEEP="${HANDOVER_KEEP:-10}"

ok()   { printf '  \033[32m*\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m!\033[0m %s\n' "$1"; }
hd()   { printf '\n\033[1m%s\033[0m\n' "$1"; }

backup() {
  local kind="$1" stamp archive
  stamp="$(date '+%Y%m%d-%H%M%S')"
  archive="$BACKUPS/$kind-$stamp.tar.gz"
  mkdir -p "$BACKUPS"
  if tar --exclude='./.git' --exclude='./node_modules' --exclude='./_handover/backups' \
         --exclude='./secure/vault.json' --exclude='./.env' --exclude='./.env.*' \
         --exclude='*/.env' --exclude='.DS_Store' \
         -czf "$archive" . 2>/dev/null; then
    ok "backup: ${archive#$ROOT/}  ($(du -h "$archive" | cut -f1))"
  else
    bad "backup FAILED — stop here and find out why before doing anything else"
    exit 1
  fi
  # Frugal: keep only the newest $KEEP of each kind.
  ls -1t "$BACKUPS"/"$kind"-*.tar.gz 2>/dev/null | tail -n +$((KEEP+1)) | while read -r old; do rm -f "$old"; done
  if ! git check-ignore -q _handover/backups 2>/dev/null; then
    bad "_handover/backups is not gitignored — add it, or backups will be committed"
  fi
}

syntax_checks() {
  local n=0 f fails=0
  if command -v node >/dev/null 2>&1; then
    while IFS= read -r f; do
      n=$((n+1)); node --check "$f" >/dev/null 2>&1 || { bad "JS syntax: $f"; fails=$((fails+1)); }
    done < <(git ls-files '*.js' '*.cjs' '*.mjs' 2>/dev/null | grep -v '^\.brain/')
  fi
  while IFS= read -r f; do
    n=$((n+1)); bash -n "$f" >/dev/null 2>&1 || { bad "shell syntax: $f"; fails=$((fails+1)); }
  done < <(git ls-files '*.sh' 2>/dev/null)
  [ "$fails" -eq 0 ] && ok "syntax: $n file(s) parse" || bad "syntax: $fails of $n file(s) fail"
}

reading_order() {
  hd "Read before editing, in this order"
  local i=1 f
  for f in .brain/heart/ESSENCE.md .brain/heart/PROOF.md .brain/heart/DELIVERY.md \
           .brain/wisdom/working-together.md \
           docs/SEED.md CLAUDE.md AGENTS.md docs/JOURNAL.md docs/CYCLE.md; do
    [ -f "$f" ] && { printf '  %d. %s\n' "$i" "$f"; i=$((i+1)); }
  done
}

case "${1:-}" in
  handover)
    printf '\033[1m%s — handover\033[0m\n' "$NAME"
    hd "Backup"; backup handover
    hd "Checks"; syntax_checks
    if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
      bad "uncommitted changes — commit and push, or the next tool will not see them"
    else
      ok "working tree clean"
    fi
    reading_order
    printf '\nUpdate docs/JOURNAL.md if anything was decided, then commit and push.\n' ;;
  takeover)
    printf '\033[1m%s — takeover\033[0m\n' "$NAME"
    hd "Backup (before touching anything)"; backup takeover
    [ -f .brain/tools/state.sh ] && bash .brain/tools/state.sh
    reading_order ;;
  *) sed -n '3,6p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
