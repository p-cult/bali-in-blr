# CLAUDE.md — read this first, every session

You are continuing an existing project. **Do not start from scratch.** GitHub is
the single source of truth; always build forward from the latest `main`.

## First actions in any new session / machine / account
1. **On a computer you have not worked on before**, check it can carry on —
   this only reads, and it names anything still missing:
   ```bash
   bash tools/doctor.sh
   ```
   The project travels on the external drive (files, full `.git` history, commit
   identity, and the vault key). The one thing that does not travel is GitHub
   credentials: `brew install gh && gh auth login`. See
   **`docs/ANOTHER-MACHINE.md`**.
2. Make sure you're on the latest code before doing anything:
   ```bash
   git checkout main && git pull --ff-only origin main
   ```
3. Read **`HANDOVER.md`** (the complete brief: architecture, data schemas, design
   system, roadmap, compliance). This CLAUDE.md is only the quick summary.
4. Read **`docs/JOURNAL.md`** — the project's memory: every decision, problem
   solved and lesson learned, in order. Anything odd in the code is explained
   there. Do not undo a recorded decision without raising it first. Its
   private half is in the vault: `bash tools/vault.sh show` → `memory`.
5. When you finish a change: commit and push so the next session (anywhere) has it:
   ```bash
   git add -A && git commit -m "…" && git push
   ```
   If the change solved a real problem or reversed a decision, add an entry to
   `docs/JOURNAL.md` so the next session inherits it.

## What this is
Campaign hub website for the **"Bali in Bengaluru"** festival by **Param
Foundation**. Plain **HTML + CSS + vanilla JS**, no framework, no build step, no
dependencies. Hosted on **GitHub Pages**, auto-deploys on push to `main`.
- Live: https://p-cult.github.io/bali-in-blr/ (moving to
  https://bali-in-blr.paramfoundation.org — see `docs/DOMAIN-SETUP.md`)
- Repo: https://github.com/p-cult/bali-in-blr

## File map
- `index.html` — content & structure (sections marked with comments; each has an `id`)
- `styles.css` — all styling; **design tokens in `:root` at the top**; `@media` at the bottom
- `main.js` — behaviour + the `CONFIG` data-bridge block at the top
- `data/events.json`, `data/partners.json` — local stand-ins for Google Sheets
- `assets/logo.svg` — the festival logo; inlined as the `.logo` component wherever the
  name is a heading or brand mark (see HANDOVER §5). The hero uses the title mark (no
  "Param"), which is inlined in `index.html` only — its source file is **not** in the repo,
  it lives in the vault under `memory.brand_assets`
- `docs/BRIDGE-SETUP.md` + `docs/apps-script/Code.gs` — the backend bridge (see below)
- `docs/ANOTHER-MACHINE.md` — working from the drive on a new computer
- `tools/doctor.sh` — checks a machine can carry on (reads only)
- `docs/JOURNAL.md` — decisions, problems solved, lessons (the project's memory)
- `HANDOVER.md` — full brief · `AGENTS.md` — entry point for any AI tool ·
  `.cursor/rules/` — same rules for Cursor

## Architecture (short)
Content comes from **Google Sheets**, read live in the browser on every page
load. **The sheet is the source of truth, not this repo** — editing a cell is
enough; there is no build or deploy step for content. That covers calendar
events, booking links, event status, the hero's computed numbers, and
collaborators with their logos. `data/events.json` and `data/partners.json` are
*fallbacks* for when the sheet is unreachable, not the live data.

Writes (signups, volunteers, ticket sales) go through **Google Apps Script web
apps** — two separate ones on purpose, so ticket entry can never compete with
signups for Apps Script's shared execution slots:
- the registration bridge, `CONFIG.BRIDGE_URL` in `main.js`
- the tickets web app, `const API` in `admin/tickets.html`

Both sources are backed up in `docs/apps-script/`; the repo copy is the only
backup, so keep it in step. **When redeploying either, update the existing
deployment — never create a new one**, or the `/exec` URL changes and the page
breaks (`docs/JOURNAL.md`, 19 Sep). Drive images linked in the sheet are pulled
in hourly by `.github/workflows/sync-drive-images.yml`. See HANDOVER §3 and
`docs/BRIDGE-SETUP.md`.

## Rules
- Keep it **dependency-free** vanilla HTML/CSS/JS. No frameworks/build tools/npm
  without a strong stated reason.
- Styling → `styles.css` via classes + `:root` tokens (no inline styles).
  Content → `index.html`. Data-driven content → `data/*.json` (later the Sheet).
- Always `esc()` any sheet/user value before inserting into HTML (XSS).
- **Privacy/compliance (Param Foundation):** PII (emails/phones) lives only in
  approved systems (Google Workspace / Zoho). Never store PII in the repo, never
  send it to unapproved third parties, never expose personal rows publicly —
  aggregates only. Keep the signup consent + purpose text (DPDP Act 2023).
- Prefer the Google + Zoho stack for new integrations.
- Conventions: dates `DD MMM YYYY`, INR (₹), Indian English. Title is exactly
  "Bali in Bengaluru". Where that name is a heading or brand mark it is the
  inline logo (`assets/logo.svg`; the hero `h1` alone uses the title mark, inlined)
  with `.sr-only` text, never typed display text or an `<img>`; inside a
  sentence it is text. Never publish the title mark as a downloadable file.
- After editing CSS/JS, bump the `?v=` query on their tags in `index.html`.

## Run locally
```bash
python3 -m http.server 8000   # http://localhost:8000  (a server is required; page fetches data/*.json)
```

## Current status
Live and deployed. The hub is built and running: signup + volunteer forms saving
through the Google Apps Script bridge (flavours → deduplicated `Master` registry,
receipts), a calendar reading real dates live from the schedule sheet, GTM
analytics, a privacy page, a print edition, an encrypted vault for secrets, and a
live custom domain (https://bali-in-blr.paramfoundation.org). Also live: an
`/admin` hub (campaign links, project report, ticket sales) behind a per-tool
sign-in gate, and a link-only `/progress/` dashboard for stakeholders.
Collaborator names AND logos come from the Collab/venues sheet, so adding a row
there puts a partner on the site with no code change. Remaining: add ticket
links and post-event media as shows go on sale and conclude. Roadmap in
HANDOVER §7.
