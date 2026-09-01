# Project Handover — Bali in Bengaluru (festival hub)

This document is the complete brief for continuing this project in Cursor (or any
editor). It assumes no prior context. Read it top to bottom once.

---

## 1. What this is

A **campaign hub website** for the **Bali in Bengaluru** cultural festival,
presented by **Param Foundation** (a Bengaluru non-profit in science & culture).

- **Live site:** https://p-cult.github.io/bali-in-blr/
- **Repo:** https://github.com/p-cult/bali-in-blr  (branch: `main`)
- **Hosting:** GitHub Pages (static, auto-deploys on push to `main`)
- **Stack:** plain **HTML + CSS + vanilla JS**. No framework, no build step, no
  dependencies, no package.json. Open `index.html` and it runs.

The festival runs ~18 days in **September 2026** in Bengaluru: performances,
workshops, and talks blending Indonesian (Balinese) and Indian traditions.
Headliner: **Dr. I Wayan Dibia** (Padma Shri).

### The product vision (what it must grow into)
A single evolving destination that:
1. Captures interested people (signup → email/phone, with consent).
2. Shows a **calendar** that fills in as dates are confirmed through September.
3. Sends people to **buy tickets / collect passes** (external ticketing).
4. After each show, features **photos, clippings, media**.
5. Displays a **growing** wall of partners/sponsors/supporters.
6. Is **SEO-ready** and easy to plug into marketing (campaign deep-links, pixels).

---

## 2. Files & structure

```
index.html          Page content & structure. Sections are marked with HTML comments.
styles.css          All styling. Design tokens live in :root at the top.
main.js             Behaviour + the DATA BRIDGE config (CONFIG object at top).
assets/             Photos (extracted & optimised from the festival brochure PDF).
data/
  events.json       Calendar data — LOCAL STAND-IN for the Google Sheet (see §4).
  partners.json     Partners data — LOCAL STAND-IN for the Google Sheet (see §4).
robots.txt          SEO.
sitemap.xml         SEO.
docs/
  BRIDGE-SETUP.md   Step-by-step Google Sheets + Apps Script setup (the backend).
  apps-script/Code.gs  The Apps Script "bridge" code, ready to paste & deploy.
README.md           Short version of this doc for casual contributors.
HANDOVER.md         This file.
.cursor/rules/      Cursor project rules.
```

### Page section order (in `index.html`)
Header/nav → Hero → **Register** → **Calendar** → Programme → Featuring
(Dr. Dibia) → Feature band ("also includes") → **Partners** → Param Foundation
→ Support → Footer. Every section has an `id` for deep-linking (e.g.
`https://p-cult.github.io/bali-in-blr/#register`).

---

## 3. Architecture — the "Sheets bridge" (READ THIS)

A static page can't securely read/write Google Sheets by itself. The design uses a
**Google Apps Script Web App** as a bridge between the site and a Google
Spreadsheet:

```
 Visitor ──submit form──▶  Apps Script Web App  ──append row──▶  Google Sheets
 Visitor ◀── JSON data ──  (one deployment)      ◀── read ─────  (Signups/Events/
                                                                   Partners/Stats tabs)
```

- **Writes** (signups) go to a private `Signups` tab.
- **Reads** (calendar, partners, aggregate stats) come back as JSON.
- Personal data (emails/phones) stays inside Param Foundation's Google Workspace.
  The page only ever receives **aggregates** (e.g. a registration count), never
  personal rows. This matters for **DPDP Act 2023** compliance (see §8).

### Current state: Phase 1 (front-end first)
The bridge is **not connected yet**. Right now:
- The **calendar** and **partners** read from `data/events.json` /
  `data/partners.json` (local files that mimic the future Sheet output).
- The **signup form** runs in **demo mode** — it validates and shows a success
  message but does **not** save anywhere yet.

### Going live: flip the switch in `main.js`
At the top of `main.js` there is a `CONFIG` object:

```js
const CONFIG = {
  BRIDGE_URL: "",                    // ← paste the Apps Script Web App URL here
  EVENTS_URL: "data/events.json",    // ← change to CONFIG.BRIDGE_URL + "?sheet=events"
  PARTNERS_URL: "data/partners.json",// ← change to CONFIG.BRIDGE_URL + "?sheet=partners"
  STATS_URL: "",                     // ← optional: CONFIG.BRIDGE_URL + "?sheet=stats"
};
```

Once the Google side is deployed (see `docs/BRIDGE-SETUP.md`), set `BRIDGE_URL`
and repoint the source URLs. The form will start saving and the calendar/partners
will read live from Sheets. **No other code changes needed.**

---

## 4. Data schemas

### `data/events.json` (and the future `Events` sheet)
Array of objects. The Google Sheet's **header row must use these exact column
names** so the bridge returns matching keys:

| field | notes |
|---|---|
| `id` | unique slug, e.g. `kecak` |
| `title` | event name |
| `category` | `Performance` \| `Workshop` \| `Academic` (drives the filter chips) |
| `date` | ISO `YYYY-MM-DD`, or empty → renders "Date to be announced" |
| `time` | free text, optional |
| `venue` | free text, optional |
| `status` | `announced` \| `onsale` \| `concluded` (drives badge + button) |
| `ticketUrl` | external ticket link (shown when `onsale`); or a media link (when `concluded`) |
| `image` | path like `assets/kecak-hanuman.jpg` (or a full URL) |
| `description` | short blurb |

Rendering logic (in `main.js` `loadCalendar`): dated events sort chronologically
and appear before undated ones; `onsale` shows a **Book / passes** button,
`concluded` shows a **View media** button, otherwise "Tickets coming soon".

### `data/partners.json` (and the future `Partners` sheet)
Array of `{ name, logo, url, tier }`. Empty array → the section shows a
"Become a partner" call-to-action. With entries → a logo grid.

### Future `Stats` sheet
Rows of `{ key, value }` returning only aggregates (e.g. `attended = 540`).
`readStats()` in `Code.gs` also derives `registered` from the Signups row count.

---

## 5. Design system

Bold, modern, dark festival aesthetic. **All theme values are CSS custom
properties in `:root` at the top of `styles.css`** — change them there, not
inline.

- Colours: `--bg #0e0f12`, `--accent #ff5a3c` (coral), `--accent-2 #ffd23c`
  (yellow), text `--ink #f4f2ee`.
- Type: `--display "Archivo"` (heavy, uppercase headings), `--sans "Space Grotesk"`
  (body). Loaded from Google Fonts in `<head>`.
- Reusable patterns (act like components): `.card` (image tile), `.card-plain`
  (text tile), `.cards-2/.cards-3` (grid wrappers), `.btn`/`.btn-primary`/
  `.btn-ghost`/`.btn-sm`, `.cal-card` (calendar), `.badge*`, `.chip` (filters),
  `.signup-form`, `.partner`.
- Responsive breakpoints are consolidated at the **bottom** of `styles.css`
  (`@media` 900 / 760 / 520). Mobile nav becomes a hamburger under 760px.

---

## 6. How to run & deploy

**Local:**
```bash
python3 -m http.server 8000   # then open http://localhost:8000
```
A server is required (not file://) because the page `fetch()`es the JSON in `data/`.

**Deploy:** commit and push to `main`. GitHub Pages rebuilds in ~1–2 min. No CI.

> **Cache note:** `index.html` links `styles.css?v=hub1` and `main.js?v=hub1`.
> Bump the `?v=` query when you change CSS/JS so browsers fetch the new version.

---

## 7. Roadmap / TODO (where to take it next)

- [ ] **Connect the bridge** (biggest item): follow `docs/BRIDGE-SETUP.md`, deploy
      the Apps Script, set `CONFIG.BRIDGE_URL` and the source URLs in `main.js`.
      This makes signups save and the calendar/partners read from Sheets.
- [ ] **Phase 2 — Calendar:** add real events/dates in the `Events` sheet as they
      firm up. Set `status: onsale` + `ticketUrl` when tickets open.
- [ ] **Phase 3 — Ticketing:** external platform (TBD — e.g. Townscript / District).
      Just paste each event's URL into `ticketUrl`; buttons appear automatically.
- [ ] **Phase 4 — Post-event media:** build a Gallery section; set concluded events'
      `ticketUrl` to a media/album link, or add a dedicated `Media` sheet + renderer.
      Unused images `assets/carvings.jpg` and `assets/batik.jpg` are available.
- [ ] **Analytics/marketing:** add GA4 and/or Meta Pixel snippets in `<head>`
      (IDs not yet provided). UTM links from campaigns work out of the box.
- [ ] **Custom domain** (optional): configure in repo Settings ▸ Pages + a CNAME.
- [ ] **Privacy policy:** the consent checkbox links to a `#` placeholder — point it
      at a real privacy page.

---

## 8. Constraints & conventions (important)

Param Foundation operates under organisation rules — honour these:

- **Data & privacy:** personal data (donor/visitor/student emails, phones) must
  live **only** in approved systems (Google Workspace / Zoho). Do **not** build
  custom PII storage or send personal data to third-party/unapproved services.
  Never expose personal rows to the public page — aggregates only.
- **DPDP Act 2023 / IT Act:** the signup keeps explicit opt-in **consent** and a
  stated purpose. Keep that. If collecting more data, keep it purpose-limited.
- **Tooling preference:** prefer the existing **Google + Zoho** stack; use
  nonprofit/education pricing where relevant.
- **Formatting:** dates `DD MMM YYYY`; currency INR (₹); Indian English.
- **Branding:** the org is "Param Foundation" (PFT internally); galleries are
  "PARSEC". Festival title is **"Bali in Bengaluru"** (the brochure spelling).
- **Content source of truth:** the festival brochure PDF (`Bali in Bengaluru.pdf`,
  held by the client) and a client "corrections" RTF already applied. Current copy
  reflects the latest corrections.

### Code conventions
- Vanilla JS only; no dependencies. Keep it dependency-free unless there's a strong
  reason. Match existing style (small IIFEs, `esc()` for any user/sheet data
  injected into HTML — keep escaping to avoid XSS from sheet content).
- Keep styling in `styles.css` via classes + `:root` tokens; avoid inline styles.
- Keep content edits in `index.html`; keep data-driven content in `data/*.json`
  (later the Sheet).

---

## 9. History (how we got here, briefly)

Scaffolded a starter page → built a brochure-style landing page from the festival
PDF (extracted/optimised 14 photos) → applied a client corrections doc (wording,
18 days, reordered events, etc.) → redesigned from a maroon/serif look to the
current **bold/dark/modern** direction (chosen from 3 mockups) → removed the
"Balinese roots" section on request → restructured into this **hub** (signup,
dynamic calendar, partners, SEO). Full history is in `git log`.
