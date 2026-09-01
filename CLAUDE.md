# CLAUDE.md — read this first, every session

You are continuing an existing project. **Do not start from scratch.** GitHub is
the single source of truth; always build forward from the latest `main`.

## First actions in any new session / machine / account
1. Make sure you're on the latest code before doing anything:
   ```bash
   git checkout main && git pull --ff-only origin main
   ```
2. Read **`HANDOVER.md`** (the complete brief: architecture, data schemas, design
   system, roadmap, compliance). This CLAUDE.md is only the quick summary.
3. When you finish a change: commit and push so the next session (anywhere) has it:
   ```bash
   git add -A && git commit -m "…" && git push
   ```

## What this is
Campaign hub website for the **"Bali in Bengaluru"** festival by **Param
Foundation**. Plain **HTML + CSS + vanilla JS**, no framework, no build step, no
dependencies. Hosted on **GitHub Pages**, auto-deploys on push to `main`.
- Live: https://p-cult.github.io/bali-in-blr/
- Repo: https://github.com/p-cult/bali-in-blr

## File map
- `index.html` — content & structure (sections marked with comments; each has an `id`)
- `styles.css` — all styling; **design tokens in `:root` at the top**; `@media` at the bottom
- `main.js` — behaviour + the `CONFIG` data-bridge block at the top
- `data/events.json`, `data/partners.json` — local stand-ins for Google Sheets
- `docs/BRIDGE-SETUP.md` + `docs/apps-script/Code.gs` — the backend bridge (see below)
- `HANDOVER.md` — full brief · `.cursor/rules/` — same rules for Cursor

## Architecture (short)
Data is designed to come from **Google Sheets via a Google Apps Script Web App**
("the bridge"). **Currently not connected:** calendar/partners read local JSON and
the signup form is in demo mode. To go live, set `CONFIG.BRIDGE_URL` and repoint
`EVENTS_URL`/`PARTNERS_URL` in `main.js` — nothing else. See HANDOVER §3 and
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
  "Bali in Bengaluru".
- After editing CSS/JS, bump the `?v=` query on their tags in `index.html`.

## Run locally
```bash
python3 -m http.server 8000   # http://localhost:8000  (a server is required; page fetches data/*.json)
```

## Current status
Phase 1 built: hub structure, signup form (demo mode), dynamic calendar + partners
(from local JSON), SEO/structured data. Next up: connect the Sheets bridge, then
real dates, ticketing links, and post-event galleries. Full TODO in HANDOVER §7.
