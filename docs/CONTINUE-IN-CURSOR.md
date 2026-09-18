# Continue this project in Cursor

You don't need this repo explained from scratch — **read `CLAUDE.md` first**, then
`HANDOVER.md`, then `docs/JOURNAL.md`. Those three are the actual source of truth
and are kept current. This file is only a snapshot of exactly where the last
Claude Code session stopped, so you can pick up the in-progress work without
re-deriving it.

## Get set up

The project lives on the external drive; nothing below needs Claude Code
specifically.

```bash
cd /Volumes/bkp-01/0proj/code/param/bali-i-blr
bash tools/doctor.sh        # checks the machine can carry on (read-only)
git checkout main && git pull --ff-only origin main
python3 -m http.server 8000 # http://localhost:8000 — a server is required
```

Secrets (Apps Script `BRIDGE_URL`/`SHEET_ID`, the vault key) travel with the
drive, not with GitHub. `.cursor/rules/` in this repo mirrors `CLAUDE.md` for
Cursor's own context system — open the project in Cursor and it should pick
the rules up automatically; skim `.cursor/rules/` once to confirm it isn't
stale against `CLAUDE.md` before relying on it.

`AGENTS.md` is the model-agnostic entry point if Cursor (or any other tool)
looks for that convention instead.

## Where the last session stopped

**Uncommitted work in the working tree right now** (`git status --short`):
```
 M admin/auth.js
 M admin/campaign-links.html
 M admin/index.html
 M admin/report.html
?? admin/tickets.html
```
This is a new **ticket-sales-entry tool** inside the existing `/admin/` area,
gated by the existing admin sign-in. It is fully written and locally verified
but **not deployed and not functional yet** — see "What's blocking it" below.

Everything else (the bridge-load fix, the `/progress/` countdown redesign) is
already committed and pushed — `git log --oneline` tip is `85f0357`.

### What was built (uncommitted)

- **`admin/auth.js`** — added a new admin user `kishan` (SHA-256 hash only,
  matching password given verbally to the site owner — never written in
  plaintext anywhere) and a new `ACCESS` map that restricts specific users to
  specific tools by name (`kishan` → `["tickets"]` only). Added `canUse(user,
  tool)` and wired it into `protect()` so a user without access to a tool sees
  "No access" instead of unlocking. Everyone not listed in `ACCESS` keeps full
  access (backward compatible).
- **`admin/index.html`**, **`admin/report.html`**, **`admin/campaign-links.html`**
  — each existing tool now declares its own `tool: "…"` name in its
  `AdminAuth.protect({...})` call, and the admin hub hides tool cards the
  signed-in user isn't allowed to use.
- **`admin/tickets.html`** (new, untracked) — the ticket-entry page itself:
  pick an event, enter a quantity, submit. Same dark theme as the rest of
  `/admin`. Uses the same bounded-timeout `fetch` + "confirm by submission id"
  pattern as the registration bridge, so a slow/unreadable Apps Script
  response doesn't risk a double-write.

  **Blocker:** the file has a literal placeholder,
  `const API = "__TICKETS_API__";`, instead of a real URL. It will not work
  until that's replaced (see next section).

### What's blocking it — do this next

The ticket-entry page needs its own Google Apps Script Web App (deliberately
**separate** from the registration bridge, so ticket entry can never slow down
or break signups — the site owner was explicit that the bridge must "always
stay agile and complication free").

The server code is already written, just not pasted in or deployed yet. It's
reproduced in full below so nothing is lost if the scratchpad it was drafted
in is gone.

1. Open the **"Tickets - Bali in Blr"** Google Sheet → Extensions → Apps Script.
   That sheet already has an `onEdit` trigger (auto-date-stamps a row once
   both "Number of tickets" and "Event" are filled on the `Master` tab). Do
   **not** replace that function — merge the code below in alongside it (the
   code below already includes that `onEdit`, so if the live script matches
   it you can just paste over the whole file).
2. Deploy → New deployment → Web app → execute as the site owner's account,
   accessible to "Anyone" (same pattern as the registration bridge). **Click
   through any Google OAuth "Allow" screen yourself** — an AI assistant
   should never approve that step on your behalf.
3. Copy the resulting `/exec` URL into `admin/tickets.html`, replacing
   `"__TICKETS_API__"`.
4. Test end-to-end: sign in to `/admin/tickets.html` as `kishan`, submit one
   entry, confirm it lands in the sheet's `Master` tab with the right date,
   qty, event and "Entered by" = kishan, and that it shows up in "Latest
   entries" on reload.
5. Also check kishan only sees the "Ticket sales" card on `/admin/index.html`
   (not the report or campaign-links tools), and that vinod/jois still see
   everything.
6. Bump `auth.js?v=4` cache-busting is already done on all four admin pages —
   don't need to bump again unless you edit `auth.js` further.
7. Commit and push, then add a `docs/JOURNAL.md` entry (what/why, per the
   project's journal convention) and log it in the vault's
   `memory.sessions` if that's this project's habit (check `docs/JOURNAL.md`
   §"how to use the vault" if unsure).

#### `tickets-code.gs` — paste into the Tickets sheet's Apps Script editor

```javascript
/**
 * Tickets — auto date stamp, and the ticket-entry endpoint.
 *
 * Bound to the "Tickets - Bali in Blr" sheet. Deliberately separate from the
 * registration bridge: ticket entry has its own script and its own execution
 * slots, so it can never slow down or break signups.
 *
 * 1. onEdit (simple trigger, no authorisation): on the "Master" tab, from
 *    row 11 down, column A (Date) fills itself once BOTH "Number of tickets"
 *    (B) and "Event" (C) are filled. The stamp is kept after that; clearing
 *    B or C clears it.
 *
 * 2. Web app, for /admin/tickets.html:
 *      GET  ?data=1       ticketed events + the latest entries (no personal data)
 *      GET  ?verify=<id>  was this submission saved?
 *      POST {user, pass, event, qty, id}
 *    The POST checks the username and password here, on Google's side, before
 *    it writes — the admin page's sign-in is not the only lock. It accepts
 *    only events listed on the Events tab and whole numbers from 1 to 1000,
 *    stamps the date itself (onEdit does not fire for script writes), and
 *    records who entered it. A resent submission id is never written twice.
 */
const SHEET_NAME = 'Master';
const EVENTS_SHEET = 'Events';
const HEADER_ROW = 10;
const FIRST_ROW = 11;   // row 10 holds the headers
const COL_DATE = 1;     // A
const COL_TICKETS = 2;  // B
const COL_EVENT = 3;    // C
const COL_BY = 4;       // D — who entered it (web entries only)

// SHA-256 of each admin password — the same hashes as admin/auth.js.
// To add someone: printf '%s' 'their-password' | shasum -a 256
const USERS = {
  jois:   'ee9d41e56dce85563d3e14b0a37eb48dde121c27539a2f4f9884e56b2ea1e0c7',
  vinod:  'df6fcc5c1774a5292e5b8c61bb0e9cc57034b3b4f25b439231fe7c9cd726c820',
  kishan: '21e72236a640e3217ca075262b8f40b0a3b0be6f735df7d86f6e890195059a29',
};

/* ------------------------------------------------------------ auto date */

function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  // Only react to edits that touch B or C.
  if (e.range.getLastColumn() < COL_TICKETS || e.range.getColumn() > COL_EVENT) return;

  const top = Math.max(e.range.getRow(), FIRST_ROW);
  const bottom = e.range.getLastRow();
  if (bottom < top) return;

  const rows = sheet.getRange(top, COL_DATE, bottom - top + 1, 3).getValues();
  const now = new Date();
  const dates = rows.map(function (r) {
    const date = r[0], tickets = r[1], event = r[2];
    const complete = tickets !== '' && event !== '';
    if (!complete) return [''];          // incomplete row: no stamp
    return [date === '' ? now : date];   // stamp once, then keep it
  });
  sheet.getRange(top, COL_DATE, dates.length, 1).setValues(dates);
}

/* ------------------------------------------------------------- web app */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.verify) {
    const row = CacheService.getScriptCache().get('t:' + p.verify);
    return out({ ok: true, found: !!row, row: row ? Number(row) : null });
  }
  if (p.data) {
    return out({ ok: true, events: ticketedEvents(), recent: recentEntries(10), totalTickets: totalTickets() });
  }
  return out({ ok: true, service: 'Tickets' });
}

function doPost(e) {
  let p = {};
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return out({ ok: false, error: 'Bad request.' }); }

  const user = String(p.user || '').trim().toLowerCase();
  if (!USERS[user] || sha256(String(p.pass || '')) !== USERS[user]) {
    return out({ ok: false, error: 'Sign-in not accepted. Sign out and in again.' });
  }
  const qty = Number(p.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 1000) {
    return out({ ok: false, error: 'Tickets must be a whole number from 1 to 1000.' });
  }
  const event = String(p.event || '').trim();
  if (ticketedEvents().indexOf(event) === -1) {
    return out({ ok: false, error: 'That event is not on sale. Reload the page for the current list.' });
  }
  const id = String(p.id || '').slice(0, 64);
  const cache = CacheService.getScriptCache();

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return out({ ok: false, error: 'Busy — try again in a moment.' });
  try {
    if (id) {
      const seen = cache.get('t:' + id);
      if (seen) return out({ ok: true, row: Number(seen), replayed: true });
    }
    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
    if (sheet.getRange(HEADER_ROW, COL_BY).getValue() === '') {
      sheet.getRange(HEADER_ROW, COL_BY).setValue('Entered by');
    }
    const row = nextFreeRow(sheet);
    if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 200);
    sheet.getRange(row, COL_DATE, 1, 4).setValues([[new Date(), qty, event, user]]);
    if (id) cache.put('t:' + id, String(row), 21600);   // six hours
    return out({ ok: true, row: row });
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------- helpers */

// The row after the last one with tickets or an event in it.
function nextFreeRow(sheet) {
  const last = sheet.getLastRow();
  if (last < FIRST_ROW) return FIRST_ROW;
  const bc = sheet.getRange(FIRST_ROW, COL_TICKETS, last - FIRST_ROW + 1, 2).getValues();
  for (let i = bc.length - 1; i >= 0; i--) {
    if (bc[i][0] !== '' || bc[i][1] !== '') return FIRST_ROW + i + 1;
  }
  return FIRST_ROW;
}

function ticketedEvents() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(EVENTS_SHEET);
  const last = sheet ? sheet.getLastRow() : 0;
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 1).getDisplayValues()
    .map(function (r) { return String(r[0]).trim(); })
    .filter(function (v) { return v && v.charAt(0) !== '('; });
}

function entries() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const last = sheet.getLastRow();
  if (last < FIRST_ROW) return [];
  return sheet.getRange(FIRST_ROW, COL_DATE, last - FIRST_ROW + 1, 3).getDisplayValues()
    .filter(function (r) { return r[1] !== '' && r[2] !== ''; })
    .map(function (r) { return { when: r[0], qty: Number(r[1]) || 0, event: r[2] }; });
}
function recentEntries(n) { return entries().slice(-n).reverse(); }
function totalTickets() { return entries().reduce(function (s, r) { return s + r.qty; }, 0); }

function sha256(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

## Standing constraints (do not violate these — they've bitten before)

- Sensitive info (secrets, keys) is encrypted; the vault key lives only on the
  external drive, never online.
- Never write vendor/product names like "Google Workspace" into visitor-facing
  copy on the public site.
- `v1.html` / `v1-styles.css` are a frozen reference version — never touch them.
- Never paste the whole repo `Code.gs` over a live Apps Script project — it
  blanks the `SHEET_ID`/`PLANNING_ID` secrets that only exist in the deployed
  copy and breaks live registrations. Edit only the intended lines/functions,
  same as the `tickets-code.gs` merge above.
- Admin passwords are stored **only** as SHA-256 hashes, in `admin/auth.js`
  (client-side check) and mirrored in the relevant Apps Script's own `USERS`
  map (server-side check) — never plaintext, never just one side.
- Never click through a Google OAuth "Allow" consent screen on the site
  owner's behalf — that's their action to take.
- Always `esc()` any sheet/user-supplied value before inserting into HTML.
- Bump the `?v=N` query string on `styles.css`/`main.js`/any admin JS include
  after editing it (GitHub Pages caches aggressively).

## Recently shipped (context, not action items)

- **Bridge-load fix** (`85f0357`): public page views used to fire 4 calls to
  the registration bridge per load, competing with real signups for Apps
  Script's ~30 shared execution slots and causing timeouts. Fixed by
  memoizing `loadEvents()` in `main.js` and only falling back to the bridge
  when the published feed fails, instead of always calling both in parallel.
- **`/progress/` countdown** (`558736f`): the stakeholder dashboard's "days to
  opening" text is now a live `DD Days HH:MM` countdown, ticking every second,
  right-aligned in the page header opposite the wordmark. It's computed from
  the real first/last event start times (`istInstant()` converts IST
  wall-clock time to a UTC instant), and shows three states: "Festival opens
  in", "Festival live · day N of 16 · closes in", "Festival concluded".

## Open items already tracked in `docs/JOURNAL.md` §0 (unrelated to the above)

- Registration bridge: `?feed=bms` + rich-text `sheetTsv` deploy still pending
  (a different Apps Script from the Tickets one above).
- 7 of 15 real BookMyShow/District ticket links still need pasting in.
- Rotate the two original admin passwords (once briefly shown in plaintext in
  a comment, since removed, but rotation was still flagged as outstanding).
- Post-event media/gallery (Phase 4, not started).
- Monument display font isn't licensed yet for the headline typeface.
