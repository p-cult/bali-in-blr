#!/usr/bin/env bash
#
# doctor-core.sh — can this machine carry on?
#
# The generic half. A project adds its own checks in tools/doctor.sh and
# calls this first. Reads only.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"; cd "$ROOT" || exit 1
pass=0; warn=0; fail=0
ok()   { printf '  \033[32m*\033[0m %s\n' "$1"; pass=$((pass+1)); }
note() { printf '  \033[33m!\033[0m %s\n     -> %s\n' "$1" "$2"; warn=$((warn+1)); }
bad()  { printf '  \033[31m!\033[0m %s\n     -> %s\n' "$1" "$2"; fail=$((fail+1)); }
hd()   { printf '\n\033[1m%s\033[0m\n' "$1"; }

hd "Tools"
for c in git curl openssl; do
  command -v "$c" >/dev/null 2>&1 && ok "$c" || bad "$c missing" "Install $c."
done

hd "Git"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  ok "repository present"
  [ -n "$(git config user.email || true)" ] && ok "commit identity: $(git config user.name) <$(git config user.email)>" \
    || bad "no git identity" "git config user.name '...' && git config user.email '...'"
  [ -z "$(git status --porcelain)" ] && ok "working tree clean" || note "uncommitted changes" "Commit or stash before starting."
else
  bad "not a git repository" "Clone it, or run from the project root."
fi

hd "Brain"
[ -f .brain/VERSION ] && ok "vendored brain $(cat .brain/VERSION)" \
  || note "no .brain/" "Run: brain.sh pull ."
[ -f brain.conf ] && ok "brain.conf present" \
  || note "no brain.conf" "Project facts have nowhere to live."

printf '\n\033[1m%s passed, %s to look at, %s blocking\033[0m\n' "$pass" "$warn" "$fail"
[ "$fail" -eq 0 ] || exit 1
