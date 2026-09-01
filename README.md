# Bali in Bengaluru

The campaign hub for the **Bali in Bengaluru** festival, by Param Foundation.
Static site hosted on GitHub Pages, designed to evolve across the season.

**Live:** https://p-cult.github.io/bali-in-blr/

## Files

- `index.html` — page content & structure (sections are marked with comments)
- `styles.css` — all styling (start at the `:root` design tokens up top)
- `main.js` — behaviour + the data-bridge config (see below)
- `assets/` — photos
- `data/events.json` — calendar data (stand-in for the Sheet, for now)
- `data/partners.json` — partners/sponsors (stand-in for the Sheet, for now)
- `sitemap.xml`, `robots.txt` — SEO

## Data bridge (Google Sheets)

The site is built to read/write **Google Sheets** through a **Google Apps Script
Web App** (the "bridge"). This keeps personal data (emails, phones) inside the
Foundation's Google Workspace and only exposes safe aggregates to the page.

**Currently (Phase 1):** the calendar and partners read from the local
`data/*.json` files, and the signup form runs in demo mode (does not save yet).

**To go live**, edit the `CONFIG` block at the top of `main.js`:

1. Set `BRIDGE_URL` to the deployed Apps Script Web App URL.
2. Point the sources at the bridge, e.g.
   `EVENTS_URL: CONFIG.BRIDGE_URL + "?sheet=events"`.

Nothing else needs to change.

## Editing content

- **Reword text / swap a photo / reorder sections** → `index.html`
- **Colours, fonts, spacing, mobile behaviour** → `styles.css` (`:root` tokens first)
- **Add a calendar event** → add an object to `data/events.json` (later: a row in
  the Events sheet). Fields: `title, category, date, time, venue, status,
  ticketUrl, image, description`. `status` is `announced` | `onsale` | `concluded`.
- **Add a partner** → add to `data/partners.json` (later: the Partners sheet).
  Fields: `name, logo, url, tier`.

## Run locally

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000

## Deploy

Push to `main`; GitHub Pages rebuilds automatically in a minute or two.
