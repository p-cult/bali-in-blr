# Backing up and restoring the vault key

`secure/vault.json.enc` holds the private half of the project's memory. One key
opens it. **This document contains the procedure, never the key.**

Read `docs/SECURITY.md` first for the rules. This file is the practical part:
how to make a backup that actually works, and how to restore from it.

---

## What you are backing up

- **64 characters**, base64, on a single line.
- Short enough to write on paper or read down a phone.
- **A trailing newline makes no difference** — verified. A hand-typed copy
  opens the vault exactly like the original file.
- Default location: `/Volumes/bkp-01/.secrets/bali-in-blr.key`, permissions
  `-r--------` (read-only, owner only).

## The honest trade-off

"Cannot be stolen" and "cannot be lost" pull in opposite directions. Every extra
copy reduces the chance of losing it and increases the chance of it leaking.
Two copies in two physical places is the sensible middle. One copy is fragile;
five copies scattered around is a leak waiting to happen.

Right now the key and the repository live on **the same physical disk**. That
single failure takes both. The repo comes back from GitHub. The key does not.

## What is actually lost if the key goes

Not the systems — the *notes about* them. The vault holds sheet ids, the design
board and Drive folder links, people, brand-asset pointers and session context.
The spreadsheets, scripts and Drive files all still exist in Google and can be
opened by their owner.

So losing the key is **painful, not fatal**: you lose curated context and would
have to reconstruct it by hand. Worth protecting properly, not worth panicking
over.

---

## Making a backup

### Paper (best against theft)

Write the 64 characters out, or print them, and put the sheet with your
important documents — a safe, a locked drawer, a deposit box. Paper cannot be
reached over a network, cannot be ransomwared, and does not rot in ten years.

Label it so a future reader knows what it is:

```
Bali in Bengaluru — vault key
Opens secure/vault.json.enc in the bali-in-blr repository.
Restore: see docs/KEY-RECOVERY.md
```

Transcribe carefully. Base64 is case-sensitive, and `0/O` and `1/l/I` are easy
to confuse. **Verify it by typing it back in and testing** (below) before you
trust it.

### A second drive (best against fire or loss at one site)

Copy the file to another encrypted drive and keep that drive somewhere else —
not the same desk, ideally not the same building.

```bash
cp /Volumes/bkp-01/.secrets/bali-in-blr.key /Volumes/<OTHER>/.secrets/
chmod 400 /Volumes/<OTHER>/.secrets/bali-in-blr.key
```

### Never

- In git, in any form, in any repository
- In Drive, Dropbox, iCloud, email, chat or a ticket
- In the same folder as the repository, or anywhere that syncs

A reputable end-to-end-encrypted password manager is a reasonable place for a
secret like this and is what many teams would do. `docs/SECURITY.md` currently
says offline only. If you want the convenience, change that rule deliberately
rather than quietly making an exception.

---

## Verifying a backup — do not skip this

**An untested backup is not a backup.** Point the tool at the copy and open the
vault with it:

```bash
cd /path/to/bali-in-blr
BALI_VAULT_KEY=/path/to/your/backup.key bash tools/vault.sh show | head -5
```

Readable JSON means the backup is good. An error means it is not — a wrong
character, a mangled paste, the wrong file.

Do the same after transcribing to paper: type the characters into a temporary
file, test it, then delete that file.

---

## Restoring

Put the key back where the tools expect it:

```bash
mkdir -p /Volumes/bkp-01/.secrets
cp /path/to/backup.key /Volumes/bkp-01/.secrets/bali-in-blr.key
chmod 400 /Volumes/bkp-01/.secrets/bali-in-blr.key
bash tools/doctor.sh          # should report: Vault decrypts
```

Or leave it anywhere and point at it per session:

```bash
export BALI_VAULT_KEY=/path/to/backup.key
```

`tools/vault.sh` and `tools/doctor.sh` both honour that variable.

---

## If the key is truly gone

The sealed file cannot be opened. There is no recovery, by design — that is the
point of the design, not a bug.

What to do:

1. Accept the sealed file is dead. Do not keep it around implying otherwise.
2. Rebuild the notes from what still exists: the sheets and Drive folders in
   Google, `docs/JOURNAL.md` (the public half, in git), and the client.
3. Generate a new key, re-seal a fresh vault, and **back it up properly this
   time** — paper plus a second drive, both verified.

## If the key may have leaked

Treat it as compromised. Generate a new key, re-seal the vault with it, and
destroy the old key everywhere it exists. Note that anyone who already took a
copy of the old `.enc` file can still read it — so also review whether anything
inside needs rotating (sheet sharing, script deployments).
