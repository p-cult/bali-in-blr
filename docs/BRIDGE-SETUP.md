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
2. Create the tabs you fill in by hand:
   - `Events`
   - `Partners`
   - `Stats` (optional)

The **contact tabs are created automatically** on the first submission, with their
header rows — you do not need to make them:

| Tab | What it holds |
| --- | --- |
| `Master` | One row per **person**, deduplicated. `First seen, Full Name, Phone, Email, Sources, Submissions, Last seen, Consent` |
| `Signups` | Every "register for updates" submission |
| `Volunteers` | Every volunteering submission |
| `Receipts` | Submission ids and their outcome. **No personal data** — it is looked up over a URL to confirm a submission landed |

**`Sources`** is the column that records where a contact came from — a person who
registers for updates and later volunteers stays **one row**, with
`Festival updates, Volunteering` in `Sources` and `Submissions` at 2.

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
e.g. a row `attended | 540`. (Per-flavour counts are added automatically.)

---

## Flavours (one tab per purpose)

Each form on the site declares a **flavour** — its purpose — in a hidden field.
The bridge writes the submission to that flavour's own tab and upserts the person
into `Master`. Currently:

| Flavour | Tab | Required fields |
| --- | --- | --- |
| `updates` | `Signups` | name, email |
| `volunteer` | `Volunteers` | name, email, phone (all mandatory) |

To add a flavour later (say, `workshop-interest`), add one entry to the `FLAVOURS`
block at the top of `Code.gs` and give the new form a matching
`<input type="hidden" name="flavour" value="…">`. Nothing else changes.

### Questions (the card carousel)

Before the signup card, each form asks a few questions one card at a time, with
a progress bar and swipe-left to advance. They live in **`data/questions.json`**,
so they can be reworded, reordered, added or removed without touching any code:

```json
{
  "volunteer": [
    { "id": "areas",
      "title": "Where would you like to help?",
      "hint": "Choose as many as you like.",
      "multi": true,
      "options": ["Front-of-house & audience", "Artist hospitality"] }
  ]
}
```

- `multi: true` allows several answers (checkboxes); `multi: false` allows one
  (radio buttons, and picking moves straight to the next card).
- At least one answer is required before a card will advance.
- Answers post under the question's `id`, several joined by ", ".

**If you add or remove a question, add or remove its `id` in the matching
`fields` list in `Code.gs`** — that list is what gives the answer a column on
the flavour's tab, in order. An id present in one and not the other means the
answer is collected but never stored, or a blank column.

An empty or missing `questions.json` is safe: the form then shows on its own,
exactly as before.

### Share links (one per form, with campaign tracking)

Every form has its own link. Share these directly — they open that form as its
own screen, and "Back to main page" returns to the site.

```
https://p-cult.github.io/bali-in-blr/#volunteer
https://p-cult.github.io/bali-in-blr/#register
```

Add `ref=` to record **which link** someone came through. Use a different `ref`
per poster, post, or WhatsApp forward, and the `Sources` column tells you which
one actually worked:

```
https://p-cult.github.io/bali-in-blr/#volunteer?ref=instagram-bio
https://p-cult.github.io/bali-in-blr/?ref=college-poster#volunteer
https://p-cult.github.io/bali-in-blr/?utm_source=whatsapp&utm_campaign=oct-drive#register
```

| The link they clicked | `Sources` in Master |
| --- | --- |
| `#volunteer` | `Volunteering` |
| `#volunteer?ref=instagram-bio` | `Volunteering (instagram-bio)` |
| `?utm_source=whatsapp&utm_campaign=oct-drive#register` | `Festival updates (whatsapp/oct-drive)` |

`ref` is also stored on its own in the flavour tab's **Ref** column. It is
remembered for the visit, so it still counts if someone lands on the home page,
reads a while, and signs up several clicks later. UTM links work unchanged, so
the same link can feed your analytics.

### Duplicate handling
A person is matched on **name + phone**, or **name + email** (phone numbers are
normalised, so `+91 98450 12345`, `09845012345` and `9845012345` are the same
person). Submitting the *same flavour* twice is rejected and the site tells the
visitor we already have their response. Arriving through a *different* flavour is
not a duplicate — it adds a source to their existing `Master` row.

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

In `main.js`, set the one value in the `CONFIG` block at the top:

```js
const CONFIG = {
  BRIDGE_URL: "https://script.google.com/macros/s/XXXXXXXX/exec", // your /exec URL
  ...
};
```

That single URL is the switch: the events, partners and stats sources are all
derived from it. While it is empty the site runs on the local files in `/data`
with the forms in demo mode.

Bump the cache-busting version on the script tag in `index.html`
(e.g. `main.js?v=hub4`), commit, and push. Done.

## Step 5 — Test

- **Signups:** submit the updates form on the live site → a row appears in
  `Signups` **and** in `Master` with `Festival updates` as the source.
- **Volunteers:** submit the volunteer form → a row in `Volunteers`, and the same
  person in `Master` (source `Volunteering`). Submit it again with the same name
  and phone → no new row, and the site says we already have the response.
- **Calendar:** add/edit a row in `Events` → reload the site; it should show.
- **Partners:** add a row in `Partners` → reload; the logo grid should populate.

### If the calendar/partners don't load (CORS)
Handled automatically — no action needed. Cross-origin `GET` to Apps Script
normally works with `fetch`; if a browser blocks it, `main.js` retries the read
over **JSONP** (`?callback=`), which `Code.gs` speaks.

### How a submission is confirmed
The visitor is told their response was recorded **only after the bridge confirms
it** — never on the strength of having clicked Submit. Each submission carries a
random `sid`. Normally the reply is read directly. If the browser blocks that
read, the site looks up the **receipt** for that `sid` instead (no personal data
in the URL) and only resends if no receipt exists. `doPost` keys on `sid`, so a
resend can never create a second row or be misreported as a duplicate. If nothing
can be confirmed, the visitor is told so and asked to retry — we never claim a
response was saved when we do not know that it was.

---

## Notes & compliance

- Personal data (emails, phones) stays in the Foundation's Google Workspace. The
  site only reads back **aggregates** via `?sheet=stats` — never personal rows.
- Keep every form's **consent** checkbox and purpose text (DPDP Act 2023). The
  consent wording is stored alongside each submission.
- `Master` is the single contact registry; `Sources` records the purpose each
  person was collected for. Do not repurpose a contact beyond the purpose they
  consented to.
- To email/SMS registrants later, export/segment from the sheet into **Zoho
  Campaigns** (email) or an approved SMS/WhatsApp tool — the approved stack.
- Anyone editing the sheet can now update the site's calendar and partners with no
  code. Restrict edit access to the sheet accordingly.
