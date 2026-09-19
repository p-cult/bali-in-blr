# Bali in Bengaluru

The campaign hub for the **Bali in Bengaluru** festival, by Param Foundation.
Plain HTML + CSS + vanilla JS. No framework, no build step, no dependencies.

- **Live:** https://bali-in-blr.paramfoundation.org
- **Repo:** https://github.com/p-cult/bali-in-blr (GitHub Pages, deploys on push to `main`)
- Programmed events run **3–18 October 2026**.

---

## Start here — do not skip this

This project carries its own memory. Whoever picks it up — a person, Claude,
Cursor, Copilot, anything — reads these first, in order:

| Read | What it gives you |
|------|-------------------|
| **`AGENTS.md`** | The entry point for any AI tool. Start here. |
| **`CLAUDE.md`** | First actions on a new session or machine; the rules. |
| **`HANDOVER.md`** | The complete brief: architecture, data, design system, compliance. |
| **`docs/JOURNAL.md`** | Every decision and why. If the code looks odd, the reason is here. |
| **vault → `memory`** | The private half: sheet ids, links, people. `bash tools/vault.sh show` |
| **`docs/ANOTHER-MACHINE.md`** | If this computer has never run the project. Start with `bash tools/doctor.sh`. |

**Do not undo something `docs/JOURNAL.md` records without raising it first.**

---

## Where the content actually comes from

**The Google Sheet is the source of truth, not this repo.** The page reads it
live in the browser on every page load — there is no build and no deploy step
for content.

Editing the sheet is enough for all of this:

- Calendar events: titles, dates, times, venues, descriptions
- BookMyShow / District links, which become the booking buttons
- Event status (`not public`, `open to all`)
- The hero's days / events / venues numbers — these are **computed**, not copy
- Collaborators and their logos

Two things still live in the repo:

- **Page copy and structure** → `index.html`
- **Design** → `styles.css` (tokens in `:root` first), then `site.css`

`data/events.json` and `data/partners.json` are **fallbacks** for when the sheet
is unreachable — not the live data. Don't add content there expecting it to show.

### Images look after themselves

Paste a Google Drive link into the sheet's image column, or the Collab/venues
Logos block. `.github/workflows/sync-drive-images.yml` runs hourly, pulls
anything new into `assets/drive/`, and commits it.

A collaborator publishes only when its row has **both** a logo link and a
received status — so a logo can be added before the partnership is announced.

---

## Run locally

```bash
python3 -m http.server 8000   # http://localhost:8000
```

A server is required: the page fetches `data/*.json` and the published sheet.

## Deploy

Push to `main`. Pages rebuilds in a minute or two. After editing `main.js`,
`styles.css` or `site.css`, bump the `?v=` on its tag in `index.html` — **and on
every other page that loads the same file**, or visitors get two cached copies.

## The backend

Google Sheets via Apps Script web apps. Two separate scripts on purpose, so
ticket entry can never compete with signups:

- **Registration bridge** — forms, calendar fallback, aggregate stats.
  Source: `docs/apps-script/Code.gs`. Setup: `docs/BRIDGE-SETUP.md`.
- **Tickets** — `/admin/tickets.html` writes through it.
  Source: `docs/apps-script/Tickets.gs`.

When redeploying either: **update the existing deployment, never create a new
one.** A new deployment mints a new `/exec` URL and breaks the page pointing at
it. See `docs/JOURNAL.md`, 19 Sep.

## Private pages (link-only, `noindex`, disallowed in `robots.txt`)

- `/admin/` — sign-in gated: campaign links, project report, ticket sales
- `/progress/` — stakeholder dashboard
- `/brand/` — brand kit
