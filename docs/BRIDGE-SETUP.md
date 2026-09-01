# Connecting the Google Sheets bridge

This wires the live site to Google Sheets so signups save and the calendar/partners
read from a spreadsheet. It's the one part that must be done inside a Param
Foundation **Google Workspace** account (an AI editor cannot do it for you — it
requires signing in and deploying under your identity).

Time: ~15 minutes. No cost.

---

## Step 1 — Create the spreadsheet

1. In the Foundation's Google Drive, create a new **Google Sheet** named
   `Bali in Bengaluru — Hub Data`.
2. Create four tabs (bottom-left) named exactly:
   - `Signups`
   - `Events`
   - `Partners`
   - `Stats`

### Column headers (row 1) — must match exactly

**Events** (these become the JSON keys the site expects):
```
id | title | category | date | time | venue | status | ticketUrl | image | description
```
- `category`: `Performance` | `Workshop` | `Academic`
- `date`: a real date cell, or leave blank for "Date to be announced"
- `status`: `announced` | `onsale` | `concluded`
- `image`: e.g. `assets/kecak-hanuman.jpg` (a path in the repo) or a full URL
- Tip: paste the rows from `data/events.json` as a starting point.

**Partners:**
```
name | logo | url | tier
```

**Stats** (optional aggregates shown on the page):
```
key | value
```
e.g. a row `attended | 540`. (`registered` is counted automatically.)

**Signups** — leave empty; the script creates its header row on first submission:
`Timestamp, Name, Email, Phone, Interest, NotifyEmail, NotifyPhone, Consent`.

---

## Step 2 — Add the Apps Script

1. In the sheet: **Extensions ▸ Apps Script**.
2. Delete any placeholder code, then paste the contents of
   `docs/apps-script/Code.gs`.
3. Set `SHEET_ID` at the top to your spreadsheet's ID — the long string in the
   sheet URL between `/d/` and `/edit`:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
4. Save (💾).

---

## Step 3 — Deploy as a Web App

1. **Deploy ▸ New deployment**.
2. Gear icon ▸ select **Web app**.
3. Settings:
   - **Description:** `Bali hub bridge`
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**  ← required so the public site can reach it
4. **Deploy**. Approve the permission prompt (it's your own script accessing your
   own sheet).
5. Copy the **Web app URL** — it ends in `/exec`.

> Re-deploying after code edits: use **Deploy ▸ Manage deployments ▸ edit ▸
> Version: New version**, so the `/exec` URL stays the same.

---

## Step 4 — Wire the site

In `main.js`, edit the `CONFIG` block at the top:

```js
const CONFIG = {
  BRIDGE_URL: "https://script.google.com/macros/s/XXXXXXXX/exec", // your /exec URL
  EVENTS_URL:   "https://script.google.com/macros/s/XXXXXXXX/exec?sheet=events",
  PARTNERS_URL: "https://script.google.com/macros/s/XXXXXXXX/exec?sheet=partners",
  STATS_URL:    "https://script.google.com/macros/s/XXXXXXXX/exec?sheet=stats",
};
```

Bump the cache-busting version on the script/style tags in `index.html`
(e.g. `main.js?v=hub2`), commit, and push. Done.

---

## Step 5 — Test

- **Signups:** submit the form on the live site → a row should appear in `Signups`.
- **Calendar:** add/edit a row in `Events` → reload the site; it should show.
- **Partners:** add a row in `Partners` → reload; the logo grid should populate.

### If the calendar/partners don't load (CORS)
Cross-origin `GET` to Apps Script normally works with `fetch`. If a browser blocks
it, switch those reads to **JSONP** (the script already supports a `callback`
param): append `&callback=?`-style handling, or ask the developer to swap the two
`fetch` reads in `main.js` for a small JSONP loader. Signups (POST) are unaffected
because they use `mode: "no-cors"`.

---

## Notes & compliance

- Personal data (emails, phones) stays in the Foundation's Google Workspace. The
  site only reads back **aggregates** via `?sheet=stats` — never personal rows.
- Keep the signup **consent** checkbox and purpose text (DPDP Act 2023).
- To email/SMS registrants later, export/segment from the sheet into **Zoho
  Campaigns** (email) or an approved SMS/WhatsApp tool — the approved stack.
- Anyone editing the sheet can now update the site's calendar and partners with no
  code. Restrict edit access to the sheet accordingly.
