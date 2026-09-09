# Continuing on another computer

The project travels on the external drive. Plug it in, open the folder, and
almost everything is already right — the working files, the whole `.git`
history, the commit identity and the sealed-notes key are all on the drive.

Run this first:

```bash
cd /Volumes/bkp-01/0proj/code/param/bali-i-blr && bash tools/doctor.sh
```

It reads only, and it prints exactly what this machine still needs. If it ends
in `0 blocking`, carry on as normal.

---

## What travels on the drive

| | Where | Note |
|---|---|---|
| Site, data, docs, tools | the repo folder | |
| Full git history | `.git/` inside the repo | no re-clone needed |
| Commit identity | `.git/config` (set **locally**, not globally) | so commits are attributed the same on any machine |
| Vault key | `/Volumes/bkp-01/.secrets/bali-in-blr.key` | outside the repo, never in git, never online |

## What does not travel — the one thing to set up

**GitHub credentials.** They belong to the machine, not the drive. This repo
pushes over HTTPS and authenticates through the GitHub CLI, so a new computer
needs:

```bash
brew install gh && gh auth login
```

Choose **GitHub.com** → **HTTPS** → authenticate in the browser. Nothing else
about the remote needs changing; `origin` is already
`https://p-cult@github.com/p-cult/bali-in-blr.git`.

## Also install

- **Python 3** — serves the site locally; nothing is built or bundled.
- **Google Chrome** — only to rebuild the calendar PDF. The script looks for
  Chrome, Chromium, Edge and Brave in turn, so any of them will do; override
  with `CHROME=/path/to/chrome`.
- **git**, **openssl** — the versions macOS ships with are fine.

There is no `npm install`. The site is plain HTML, CSS and JavaScript with no
build step, which is why it moves between machines cleanly.

## Working

```bash
git pull --ff-only origin main     # always start here
python3 -m http.server 8000        # http://localhost:8000
```

A server is required — the page fetches `data/*.json`, which `file://` blocks.

```bash
git add -A && git commit -m "…" && git push
```

Push at the end of a session. GitHub, not the drive, is the source of truth: if
the drive and GitHub ever disagree, GitHub wins. The drive is how the working
copy and the key travel, not a substitute for pushing.

If a push with images fails with `HTTP 400` / `the remote end hung up
unexpectedly`, Git's default HTTP buffer is too small for the payload. The
repo's own `.git/config` already raises it (and travels with the drive), but
on a fresh clone set it once:

```bash
git config http.postBuffer 157286400
```

## Not a Mac?

The site and the git workflow need nothing platform-specific. Two tools
adapt themselves: `tools/sync-images.sh` optimises photos with `sips` on
macOS, or ImageMagick or Python Pillow elsewhere (without any, it keeps
photos full size); `tools/build-calendar-pdf.py` finds Chrome, Chromium,
Edge or Brave, or takes `CHROME=/path`. On Windows, run the scripts from Git
Bash or WSL. `bash tools/doctor.sh` tells you what it found.

## If the drive mounts somewhere else

macOS appends a suffix when the name is taken — `/Volumes/bkp-01 1`. The repo
itself does not care, but the vault key is looked up by path. Point at it:

```bash
export BALI_VAULT_KEY="/Volumes/bkp-01 1/.secrets/bali-in-blr.key"
```

## The key

`docs/SECURITY.md` has the detail. The short version: the key opens
`secure/vault.json.enc`, it lives only on this drive, and it must never be
committed, emailed, put in a cloud folder, or pasted into a chat. Anyone with
the repository alone cannot read the sealed notes, and that is the point. Back
it up by copying the drive, offline.

## Not on the drive at all

Two things live in Google and need the right account
(`vinodkumar@paramculture.org`), whichever computer you are on:

- the registration spreadsheet
- the Apps Script bridge behind `CONFIG.BRIDGE_URL`

See `docs/BRIDGE-SETUP.md`.
