#!/usr/bin/env bash
#
# Seal and open the project's private notes.
#
#   tools/vault.sh open   -> secure/vault.json.enc  ->  secure/vault.json
#   tools/vault.sh seal   -> secure/vault.json      ->  secure/vault.json.enc
#
# Only the sealed file is committed. The key lives on the external drive,
# outside the repository, and must never be copied anywhere online — so a
# clone of this repo on its own decrypts to nothing.
#
set -euo pipefail

KEY="${BALI_VAULT_KEY:-/Volumes/bkp-01/.secrets/bali-in-blr.key}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLAIN="$ROOT/secure/vault.json"
SEALED="$ROOT/secure/vault.json.enc"

# AES-256 with a salt and 200k PBKDF2 rounds, so the sealed file leaks
# nothing without the key — not even whether two versions are the same.
enc() { openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$KEY" "$@"; }

need_key() {
  if [ ! -r "$KEY" ]; then
    echo "No key at $KEY" >&2
    echo "The key lives on the external drive and is never committed." >&2
    echo "Plug the drive in, or set BALI_VAULT_KEY to its location." >&2
    exit 1
  fi
}

case "${1:-}" in
  seal)
    need_key
    [ -f "$PLAIN" ] || { echo "Nothing to seal: $PLAIN does not exist" >&2; exit 1; }
    python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$PLAIN"   # refuse to seal broken JSON
    enc < "$PLAIN" > "$SEALED"
    echo "Sealed  -> secure/vault.json.enc  ($(wc -c < "$SEALED" | tr -d ' ') bytes)"
    echo "Commit the .enc file. secure/vault.json stays out of git."
    ;;
  open)
    need_key
    [ -f "$SEALED" ] || { echo "Nothing to open: $SEALED does not exist" >&2; exit 1; }
    tmp="$(mktemp)"
    if ! enc -d < "$SEALED" > "$tmp" 2>/dev/null; then
      rm -f "$tmp"
      echo "Could not open the vault: wrong key, or the sealed file is damaged." >&2
      exit 1
    fi
    mv "$tmp" "$PLAIN"
    chmod 600 "$PLAIN"
    echo "Opened  -> secure/vault.json  (git-ignored; do not commit)"
    ;;
  show)
    need_key
    # Decrypt to a temp file first: openssl writes garbage to stdout before
    # it reports a bad key, so piping it straight through would leak noise.
    tmp="$(mktemp)"
    if ! enc -d < "$SEALED" > "$tmp" 2>/dev/null; then
      rm -f "$tmp"
      echo "Could not open the vault: wrong key, or the sealed file is damaged." >&2
      exit 1
    fi
    cat "$tmp"
    rm -f "$tmp"
    ;;
  *)
    echo "usage: tools/vault.sh {seal|open|show}" >&2
    exit 1
    ;;
esac
