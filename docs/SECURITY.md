# Where the private things live

The rule: **nothing sensitive is committed in readable form, and the key that
opens what is committed never goes online.**

## The key

```
/Volumes/bkp-01/.secrets/bali-in-blr.key
```

On the external drive, **outside the repository**, mode `400`. It is not in git
and cannot be — it is not inside the working tree at all. Back it up wherever
you like as long as that place is offline. Lose it and the sealed file is gone
for good; there is no recovery, by design.

If the drive is mounted elsewhere, point at the key with `BALI_VAULT_KEY`.

## The vault

| File | In git? | What it is |
| --- | --- | --- |
| `secure/vault.json.enc` | yes | AES-256-CBC, PBKDF2, 200k rounds, salted |
| `secure/vault.json` | **no** | The opened copy. Git-ignored |

```bash
tools/vault.sh open    # sealed -> readable (needs the key)
tools/vault.sh show    # print it without writing a file
tools/vault.sh seal    # readable -> sealed, after editing
```

Seal again after any edit, and commit only the `.enc`. A fresh salt each time
means two seals of the same content differ, so the file leaks nothing — not
even whether anything changed.

## What this does and does not protect

**Protects:** anyone with the repository — including the public GitHub mirror —
sees only ciphertext. Verified: the sheet ids, the gid and the owner address do
not appear anywhere in the sealed bytes, and a wrong key fails with an error
rather than partial output.

**Does not protect, and cannot:** anything the visitor's browser fetches. The
bridge `/exec` URL and the published Event List TSV URL are in `main.js` because
the page has to load them. Hiding those addresses is not possible and not the
point — the protection is that those endpoints only ever return public data.
`doGet` returns aggregates and the events list, never personal rows.

**Also outside this:** the sheets themselves. Their contents live in Google, not
here, and are governed by their own sharing settings.
