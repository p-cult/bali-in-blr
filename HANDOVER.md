# Project Handover — Bali in Bengaluru (festival hub)

This document is the complete brief for continuing this project in Cursor (or any
editor). It assumes no prior context. Read it top to bottom once.

---

## 1. What this is

A **campaign hub website** for the **Bali in Bengaluru** cultural festival,
presented by **Param Foundation** (a Bengaluru non-profit in science & culture).

- **Live site:** https://bali-in-blr.paramfoundation.org
  (GitHub Pages mirror: https://p-cult.github.io/bali-in-blr/)
- **Repo:** https://github.com/p-cult/bali-in-blr  (branch: `main`)
- **Hosting:** GitHub Pages (static, auto-deploys on push to `main`)
- **Stack:** plain **HTML + CSS + vanilla JS**. No framework, no build step, no
  dependencies, no package.json. Open `index.html` and it runs.

The festival runs **1–18 October 2026** in Bengaluru: performances,
workshops, and talks blending Indonesian (Balinese) and Indian traditions.
Headliner: **Dr. I Wayan Dibia** (Padma Shri).
(Dates are the source of truth in the schedule sheet — see §3/§4. Ignore any
older "September" wording elsewhere.)

### The product vision (what it must grow into)
A single evolving destination that:
1. Captures interested people (signup → email/phone, with consent).
2. Shows a **calendar** that fills in as dates are confirmed through October.
3. Sends people to **buy tickets / collect passes** (external ticketing).
4. After each show, features **photos, clippings, media**.
5. Displays a **growing** wall of partners/sponsors/supporters.
6. Is **SEO-ready** and easy to plug into marketing (campaign deep-links, pixels).

---

## 2. Files & structure

```
index.html          Page content & structure. Sections are marked with HTML comments.
styles.css          Main styling. Design tokens live in :root at the top.
site.css            Supplementary styles (loaded after styles.css).
main.js             Behaviour + the CONFIG block at the top. CONFIG holds the
                    bridge/schedule URLs AND two feature switches (see §3):
                    BOOKING_OPEN and RSVP_ENABLED (both false).
privacy.html        Privacy policy (linked from consent lines and the footer).
v1.html             Previous design, kept for reference. noindex + robots-blocked.
admin/              Internal, login-gated tools (not for the public):
  index.html          Admin hub at /admin — lists the tools.
  campaign-links.html Campaign Link Builder (UTM links + QR → 'links' sheet tab).
  auth.js             Shared sign-in gate (username+password, SHA-256 hashes).
assets/             Photos (extracted & optimised from the festival brochure PDF).
data/
  events.json       Calendar FALLBACK when the schedule sheet is unreachable (§4).
  partners.json     Partners data — LOCAL STAND-IN for the Google Sheet (see §4).
  questions.json    The signup/volunteer onboarding questions (carousel).
robots.txt          SEO. Disallows /admin/ and /v1.html.
sitemap.xml         SEO.
docs/
  BRIDGE-SETUP.md   Step-by-step Google Sheets + Apps Script setup (the backend).
  apps-script/Code.gs  The Apps Script "bridge" code, ready to paste & deploy.
tools/
  JOURNAL.md        (docs/) Decisions, problems solved, lessons — the project memory.
  sync-images.sh    Pull Google Drive event images → optimise → assets/drive/.
                    Run when a Drive image link in the sheet is added/changed.
README.md           Short version of this doc for casual contributors.
HANDOVER.md         This file.
.cursor/rules/      Cursor project rules.
```

### Feature switches & admin (quick pointers)
- **`CONFIG.BOOKING_OPEN`** / **`CONFIG.RSVP_ENABLED`** in `main.js` gate the
  calendar buttons — see §3. Both are currently `false`.
- **Admin** lives at `/admin` (login-gated; users are defined as SHA-256 hashes
  in `admin/auth.js`). Add a new admin tool by dropping a page under `admin/`
  that includes `auth.js` and wraps its content in `<div id="admin-app" hidden>`.

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

### Current state: live
The bridge is connected. `CONFIG.BRIDGE_URL` in `main.js` points at the deployed
Apps Script Web App: the signup and volunteer forms save (flavours → per-purpose
tabs, upserted into a deduplicated `Master` contact registry), and aggregate stats
read back. The **calendar reads real dates live** from the schedule sheet via
`CONFIG.SCHEDULE_URL` (published TSV), falling back to `data/events.json` only
when that tab is empty. Partners read `data/partners.json` until a Partners tab is
populated.

See `docs/BRIDGE-SETUP.md` for the full data model (flavours, questions carousel,
dedupe, receipts, share links) and `docs/apps-script/Code.gs` for the bridge.

### Calendar feature switches (`CONFIG` in `main.js`)
Two flags gate what the calendar's event buttons do. **Both are `false`.**
- **`BOOKING_OPEN`** — while `false`, event buttons never use ticket/RSVP links
  from the sheet (placeholder links containing an `EXAMPLE-` marker or an
  `example.com/net/org` domain are stripped by `toActionUrl` regardless), the
  "Tickets live / Sold out" chips and the seats bar are hidden, and every button
  routes to the single Register section. Flip to `true` for real ticketing.
- **`RSVP_ENABLED`** — while `false`, buttons read "Register". When `true`,
  buttons read "RSVP" and route to `#register?rsvp=1&programme=<event>`; the
  register module then posts `flavour=rsvp` (event name included), landing in a
  dedicated **RSVPs** tab. Turning it on needs BOTH this flag AND an Apps Script
  redeploy (the `rsvp` flavour already exists in `Code.gs`).

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

**Event images:** put an `assets/…` path in the image column. A Google Drive
share link also works — Drive images can't be embedded directly, so
`tools/sync-images.sh` downloads and optimises each one into
`assets/drive/<fileId>.jpg`, and `toImageUrl()` in `main.js` maps the link to
that local copy. Run the script (and commit `assets/drive/`) whenever a Drive
image is added or changed. A missing/failed image collapses to a clean no-image
poster rather than a broken icon.

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
The CDN can serve a 404 for brand-new files for a minute or so after the build
reports success — reload before assuming a file is missing.

> **Push fails with `HTTP 400` / `the remote end hung up unexpectedly`:** the
> payload (usually images) exceeds Git's default HTTP buffer. The repo's
> `.git/config` already sets `http.postBuffer = 157286400`; on a fresh clone run
> `git config http.postBuffer 157286400` once.

> **Cache note:** `index.html` links `styles.css?v=hub1` and `main.js?v=hub1`.
> Bump the `?v=` query when you change CSS/JS so browsers fetch the new version.

---

## 7. Roadmap / TODO (where to take it next)

- [x] **Connect the bridge** — done. `CONFIG.BRIDGE_URL` is set; the signup and
      volunteer forms save, and aggregate stats read back.
- [x] **Calendar reads live** — done. Reads real dates from the schedule sheet via
      `CONFIG.SCHEDULE_URL`, falling back to `data/events.json` when empty.
- [x] **Analytics** — Google Tag Manager installed in `<head>`; forms announce
      events to `dataLayer`. GA4/Meta/Ads can be added via GTM or the `ANALYTICS`
      block in `main.js` when IDs are provided.
- [x] **Custom domain** — live at https://bali-in-blr.paramfoundation.org
      (`CNAME` set, absolute URLs repointed, HTTPS working).
- [x] **Privacy policy** — `privacy.html` exists and is linked from the consent
      lines and the footer.
- [ ] **Calendar (ongoing):** keep adding events/dates in the schedule sheet as they
      firm up; add a ticket link to flip an event to "On sale".
- [ ] **Phase 3 — Ticketing:** external platform (TBD — e.g. Townscript / District).
      Paste each event's URL into the schedule sheet's ticket-link column; the
      booking button appears automatically.
- [ ] **Phase 4 — Post-event media:** build a Gallery section; set concluded events'
      link to a media/album, or add a dedicated `Media` sheet + renderer.
      Unused images `assets/carvings.jpg` and `assets/batik.jpg` are available.

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

**The full story — every decision, problem solved and lesson learned, in
order — is in `docs/JOURNAL.md`. Read it; this section is only the opening.**


Scaffolded a starter page → built a brochure-style landing page from the festival
PDF (extracted/optimised 14 photos) → applied a client corrections doc (wording,
18 days, reordered events, etc.) → redesigned from a maroon/serif look to the
current **bold/dark/modern** direction (chosen from 3 mockups) → removed the
"Balinese roots" section on request → restructured into this **hub** (signup,
dynamic calendar, partners, SEO). Full history is in `git log`.
