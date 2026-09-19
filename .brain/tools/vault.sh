#!/usr/bin/env bash
#
# vault.sh — seal and open a project's private notes.
#
#   bash .brain/tools/vault.sh open    sealed -> readable  (needs the key)
#   bash .brain/tools/vault.sh seal    readable -> sealed
#   bash .brain/tools/vault.sh show    print the sealed contents
#
# Only the sealed file is committed. The key lives OUTSIDE the repository, so
# a clone on its own decrypts to nothing. Set VAULT_KEY in brain.conf, or
# override per command with VAULT_KEY=/path.
#
# See .brain/doctrine/02-secrets.md. Never render the key; never commit it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[ -f "$ROOT/brain.conf" ] && . "$ROOT/brain.conf" 2>/dev/null || true
KEY="${VAULT_KEY:-}"
PLAIN="$ROOT/secure/vault.json"
SEALED="$ROOT/secure/vault.json.enc"

enc() { openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$KEY" "$@"; }

need_key() {
  if [ -z "$KEY" ] || [ ! -r "$KEY" ]; then
    echo "No readable key${KEY:+ at $KEY}." >&2
    echo "Set VAULT_KEY in brain.conf, or: VAULT_KEY=/path/to.key bash .brain/tools/vault.sh $1" >&2
    exit 1
  fi
}

mkdir -p "$ROOT/secure"
case "${1:-}" in
  seal)
    need_key seal; [ -f "$PLAIN" ] || { echo "No $PLAIN to seal." >&2; exit 1; }
    enc -in "$PLAIN" -out "$SEALED"
    echo "Sealed  -> $SEALED  ($(wc -c < "$SEALED" | tr -d ' ') bytes)"
    echo "Commit the .enc file. secure/vault.json stays out of git." ;;
  open)
    need_key open; [ -f "$SEALED" ] || { echo "No $SEALED to open." >&2; exit 1; }
    enc -d -in "$SEALED" -out "$PLAIN"
    echo "Opened  -> $PLAIN  (git-ignored; re-seal after editing)" ;;
  show)
    need_key show; [ -f "$SEALED" ] || { echo "No $SEALED." >&2; exit 1; }
    enc -d -in "$SEALED" ;;
  *) sed -n '3,8p' "$0" | sed 's/^# \{0,1\}//' ;;
esac
