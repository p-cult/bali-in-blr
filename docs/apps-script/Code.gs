/**
 * Bali in Bengaluru — Google Sheets bridge (Apps Script Web App)
 * ---------------------------------------------------------------
 * Connects the static site to a Google Spreadsheet:
 *   - doPost : saves a submission to its flavour tab AND upserts the person
 *              into the "Master" contact registry
 *   - doGet  : returns "Events" / "Partners" as JSON, and "stats" aggregates
 *
 * FLAVOURS
 * Every form on the site declares a `flavour` (its purpose). Each flavour gets
 * its own tab with its own columns, while Master holds one row per PERSON with
 * a Sources column recording every flavour they came in through. Add a new
 * form by adding one entry to FLAVOURS below — nothing else changes.
 *
 * DEDUPE
 * A person is matched on name + phone, or name + email. Re-submitting the same
 * flavour is rejected as a duplicate (the site shows a friendly message). A
 * person arriving through a NEW flavour is not a duplicate: their Master row
 * gains the extra source instead of a second row being created.
 *
 * SETUP: see docs/BRIDGE-SETUP.md. In short:
 *   1. Create a Google Spreadsheet; set SHEET_ID below. Tabs are auto-created.
 *   2. Paste this into Extensions ▸ Apps Script.
 *   3. Deploy ▸ New deployment ▸ Web app; Execute as: Me; Access: Anyone.
 *   4. Copy the /exec URL into the site's main.js CONFIG.BRIDGE_URL.
 *
 * PRIVACY: never return personal rows. doGet exposes only aggregates (readStats).
 */

/**
 * The Registration Data spreadsheet id. The DEPLOYED "Bali-in-Blr" script is a
 * STANDALONE project (not container-bound), so book() reaches the sheet by id —
 * the live deployment HAS a real value here. It is blank in the repo on purpose
 * (the id lives in the vault, not a public repo).
 *
 * ⚠️ LANDMINE: because this is blank here, do NOT paste this whole file over the
 * live script — that wipes SHEET_ID and book() returns null (getActiveSpreadsheet
 * is null for a standalone script), breaking ALL registrations. When editing the
 * deployed script, change only the lines you mean to; keep the real SHEET_ID. To
 * see it:  bash tools/vault.sh show  → memory. (17 Sep 2026: a full paste caused
 * exactly this outage — see JOURNAL.)
 */
const SHEET_ID = '';

/* The planning workbook ("All things - Bali in Bengaluru") that holds the
   Event List and Collab/venues tabs. The script's owner must have access to it;
   reads go through this by id so they never depend on Publish-to-web.
   ⚠️ Vault secret — like SHEET_ID this is blank in the repo. The real id lives
   in the vault (bash tools/vault.sh show → memory) and in the LIVE script only.
   The live Apps Script already has the correct value; do NOT paste this repo
   copy over it (that would blank PLANNING_ID and break the feeds). */
const PLANNING_ID = '';

/* The Google Doc "Bali in Bengaluru - Website text" (tabs per site section).
   Blank in the repo like PLANNING_ID; the live script has the real id.
   Reads through DocumentApp, which needs the Docs scope. */
const CONTENT_DOC_ID = '';

/** The spreadsheet this script works on. */
function book() {
  return SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

/** Prefer a pasted URL; otherwise the cell's hyperlink (Ctrl-K / Insert link).
    Publish-to-web TSV only exports the visible label ("Link"), so this is how
    the site ever sees the real BookMyShow / District href. */
function cellExport(display, rich, formula) {
  var shown = String(display == null ? '' : display).trim();
  if (/^(https?:|mailto:|tel:)/i.test(shown)) return shown;
  var link = '';
  if (rich) {
    link = rich.getLinkUrl() || '';
    if (!link) {
      var runs = rich.getRuns();
      for (var i = 0; i < runs.length; i++) {
        link = runs[i].getLinkUrl() || '';
        if (link) break;
      }
    }
  }
  if (link) return link;
  var f = String(formula || '');
  var m = f.match(/HYPERLINK\s*\(\s*"([^"]+)"/i) || f.match(/HYPERLINK\s*\(\s*'([^']+)'/i);
  if (m) return m[1];
  return shown;
}

/** A tab of any accessible spreadsheet, serialised as TSV.
    Hyperlink URLs are written in place of a label so the site can use them. */
function sheetTsv(spreadsheetId, tabName) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sh = ss.getSheetByName(tabName);
  if (!sh || sh.getLastRow() < 1) return '';
  const range = sh.getDataRange();
  const display = range.getDisplayValues();
  const rich = range.getRichTextValues();
  const formulas = range.getFormulas();
  return display.map(function (row, r) {
    return row.map(function (cell, c) {
      return cellExport(cell, rich[r][c], formulas[r][c]);
    }).join('\t');
  }).join('\n');
}

/* The lines of each site-copy Doc tab, in page order. In the Doc each tab is
   plain text, one paragraph per line, in exactly this order (no headings). The
   first text is a label for maintainers only; the second is the data-content
   key. Tab titles must match the Doc exactly. */
const CONTENT_MAP = {
  'Navigation': [
    ['Menu link to Calendar', 'nav.a1'],
    ['Menu link to Programme', 'nav.a2'],
    ['Menu link to Featuring', 'nav.a3'],
    ['Menu link to Collaborators', 'nav.a4'],
    ['Menu link to Support', 'nav.a5'],
    ['Menu link to Volunteer', 'nav.a6'],
    ['Menu button: Get updates', 'nav.a7']
  ],
  'Hero': [
    ['Small line above the title', 'page.span1'],
    ['Place and month', 'page.span2'],
    ['Intro paragraph', 'hero.lead'],
    ['Tagline', 'hero.tagline'],
    ['Counter label: days', 'page.span3'],
    ['Counter label: events', 'page.span4'],
    ['Counter label: venues', 'page.span5'],
    ['Button: see the calendar', 'page.a1'],
    ['Button: get updates', 'page.a2']
  ],
  'Programme': [
    ['Small heading above the title', 'programme.p1'],
    ['Section title', 'programme.title']
  ],
  'Performances': [
    ['Group heading', 'programme.h31'],
    ['Performance 1 - title', 'programme.h41'],
    ['Performance 1 - description', 'programme.p2'],
    ['Performance 2 - title', 'programme.h42'],
    ['Performance 2 - description', 'programme.p3'],
    ['Performance 3 - title', 'programme.h43'],
    ['Performance 3 - description', 'programme.p4']
  ],
  'Workshops': [
    ['Group heading', 'programme.h32'],
    ['Workshop 1 - title', 'programme.h44'],
    ['Workshop 1 - description', 'programme.p5'],
    ['Workshop 2 - title', 'programme.h45'],
    ['Workshop 2 - description', 'programme.p6']
  ],
  'Academic traditions': [
    ['Group heading', 'programme.h33'],
    ['Session 1 - title', 'programme.h46'],
    ['Session 1 - description', 'programme.p7'],
    ['Session 2 - title', 'programme.h47'],
    ['Session 2 - description', 'programme.p8']
  ],
  'Featuring': [
    ['Small heading', 'featuring.p1'],
    ['Name', 'featuring.h21'],
    ['Subtitle', 'featuring.p2'],
    ['First paragraph', 'featuring.p3'],
    ['Second paragraph', 'featuring.p4']
  ],
  'Presented by': [
    ['Small heading', 'foundation.eyebrow'],
    ['Heading', 'foundation.title'],
    ['Paragraph', 'foundation.text'],
    ['Website link text', 'foundation.a1']
  ],
  'Foundation facts': [
    ['Fact 1 - label', 'foundation.fact1.label'],
    ['Fact 1 - text', 'foundation.fact1.value'],
    ['Fact 2 - label', 'foundation.fact2.label'],
    ['Fact 2 - text', 'foundation.fact2.value'],
    ['Fact 3 - label', 'foundation.fact3.label'],
    ['Fact 3 - text', 'foundation.fact3.value']
  ],
  'Also at the festival': [
    ['Intro line', 'page.p1'],
    ['Item 1 - title', 'page.h41'],
    ['Item 1 - description', 'page.p2'],
    ['Item 2 - title', 'page.h42'],
    ['Item 2 - description', 'page.p3'],
    ['Item 3 - title', 'page.h43'],
    ['Item 3 - description', 'page.p4']
  ],
  'Collaborators': [
    ['Section title', 'partners.h21'],
    ['Intro paragraph', 'partners.p1']
  ],
  'Support': [
    ['Small heading', 'support.p1'],
    ['Section title', 'support.h21'],
    ['Paragraph', 'support.p2'],
    ['Call button text', 'support.a1'],
    ['Website link text', 'support.a2']
  ],
  'Support benefits': [
    ['Benefit 1 - title', 'support.dt1'],
    ['Benefit 1 - description', 'support.dd1'],
    ['Benefit 2 - title', 'support.dt2'],
    ['Benefit 2 - description', 'support.dd2'],
    ['Benefit 3 - title', 'support.dt3'],
    ['Benefit 3 - description', 'support.dd3']
  ],
  'Calendar': [
    ['Small heading', 'calendar.p1'],
    ['Section title', 'calendar.h21'],
    ['Intro line', 'calendar.p2'],
    ['Download button text', 'calendar.a1'],
    ['Note beside the download button', 'calendar.span1']
  ],
  'Get updates': [
    ['Small heading', 'register.p1'],
    ['Section title', 'register.h21'],
    ['Intro paragraph', 'register.p2'],
    ['Sign-up button text', 'signup-form.button1']
  ],
  'Volunteer': [
    ['Small heading', 'volunteer.p1'],
    ['Section title', 'volunteer.h21'],
    ['Paragraph', 'volunteer.p2'],
    ['Submit button text', 'volunteer-form.button1']
  ],
  'Volunteer summary': [
    ['Row 1 - label', 'volunteer.span1'],
    ['Row 1 - text', 'volunteer.value1'],
    ['Row 2 - label', 'volunteer.span2'],
    ['Row 2 - text', 'volunteer.value2'],
    ['Row 3 - label', 'volunteer.span3'],
    ['Row 3 - text', 'volunteer.value3']
  ],
  'Footer': [
    ['Line of text', 'footer.p1'],
    ['Website link text', 'footer.a1'],
    ['Phone number', 'footer.a2']
  ]
};

/** The site-copy Google Doc, tabs and sub-tabs included. Each tab is read by
    position: if its number of non-empty lines (ignoring a NOTE: line) is not what
    CONTENT_MAP expects, that tab is skipped and the HTML wording stays. */
function docContent(docId) {
  if (!docId) return '';
  const norm = function (s) { return String(s).toLowerCase().replace(/\s+/g, ' ').trim(); };
  const keysByTab = {};
  Object.keys(CONTENT_MAP).forEach(function (title) {
    keysByTab[norm(title)] = CONTENT_MAP[title].map(function (e) { return e[1]; });
  });
  const out = [];
  (function walk(tabs) {
    tabs.forEach(function (t) {
      const keys = keysByTab[norm(t.getTitle())];
      if (keys) {
        const lines = [];
        t.asDocumentTab().getBody().getParagraphs().forEach(function (p) {
          const txt = p.getText().replace(/[ \t\r\n]+/g, ' ').replace(/^ | $/g, '');
          if (txt && !/^NOTE:/.test(txt)) lines.push(txt);
        });
        if (lines.length === keys.length) keys.forEach(function (k, i) { out.push(k + '\t' + lines[i]); });
      }
      walk(t.getChildTabs());
    });
  })(DocumentApp.openById(docId).getTabs());
  return out.join('\n');
}

/** Plain-text (TSV) response, with the same permissive access as json(). */
function tsvOut(s) {
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT);
}

const MASTER_TAB = 'Master';

/**
 * Receipt log. Holds NO personal data — just the random submission id the
 * browser generated, so a form can confirm its submission landed even when
 * the browser refuses to read our reply. Never put PII in this tab: it is
 * looked up over a URL.
 */
const LOG_TAB = 'Receipts';
const LOG_HEADERS = ['Submission ID', 'Timestamp', 'Flavour', 'Result'];

// One display format for every date/time the bridge writes. Without it each
// cell takes whatever formatting that row happened to carry, so a column could
// switch style part-way down. Google Sheets syntax; shows "11 Sep 2026, 2:05 PM".
const STAMP_FORMAT = 'dd mmm yyyy, h:mm am/pm';

/** Apply STAMP_FORMAT to whole columns (1-based), header row excluded. Also
 *  repairs rows written before this existed. */
function stamp(sh, cols) {
  const rows = sh.getMaxRows() - 1;
  if (rows < 1) return;
  cols.forEach(function (c) { sh.getRange(2, c, rows, 1).setNumberFormat(STAMP_FORMAT); });
}

/** Run once from the Apps Script editor to fix every existing date column now. */
function fixDateFormats() {
  const ss = book();
  const plan = [[MASTER_TAB, [1, 7]], [LOG_TAB, [2]], [LINK_TAB, [2]]];
  Object.keys(FLAVOURS).forEach(function (k) { plan.push([FLAVOURS[k].tab, [1]]); });
  plan.forEach(function (p) { const sh = ss.getSheetByName(p[0]); if (sh) stamp(sh, p[1]); });
}

/* Master store of minted campaign links. No personal data — campaign URLs and
   their tags only. Fed by the Campaign Link Builder (mode=link). */
const LINK_TAB = 'Mint';
const LINK_HEADERS = ['Code', 'Timestamp', 'Destination', 'Source', 'Medium', 'Campaign', 'Content', 'Programme', 'Ref', 'URL', 'QR SVG'];
const MASTER_HEADERS = [
  'First seen', 'Full Name', 'Phone', 'Email', 'Sources', 'Submissions', 'Last seen', 'Consent'
];

/**
 * The flavour registry. `label` is what lands in the Master "Sources" column.
 * `fields` are the flavour-specific extras stored on its own tab, in order.
 * `required` is enforced server-side as well as in the browser.
 */
const FLAVOURS = {
  updates: {
    tab: 'Signups',
    label: 'Festival updates',
    // name/email/notify are always required. 'programmes' is not hard-required
    // server-side: if the calendar can't load, the front end drops that
    // question, and a signup must still be able to go through.
    required: ['name', 'email', 'notify'],
    // These must match the question ids in data/questions.json.
    fields: ['programmes', 'notify']
  },
  volunteer: {
    tab: 'Volunteers',
    label: 'Volunteering',
    required: ['name', 'email', 'phone', 'areas', 'availability'],
    fields: ['areas', 'availability']
  },
  // Per-event RSVP. One row per RSVP, on its own RSVPs tab, plus a Master
  // upsert. `allowMultiple` because one person may RSVP to several events —
  // so the per-person duplicate block is skipped (idempotency by submission id
  // still stops a resend of the SAME click becoming two rows).
  rsvp: {
    tab: 'RSVPs',
    label: 'Event RSVP',
    required: ['name', 'email', 'event'],
    fields: ['event', 'notify'],
    allowMultiple: true
  }
};

/** Handle a form submission. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Serialise writes so two submissions cannot both pass the duplicate check.
    lock.waitLock(20000);

    const p = (e && e.parameter) || {};

    // Record a minted campaign link to the master 'links' tab. No PII.
    if (clean(p.mode) === 'link') return recordLink(p);

    const key = String(p.flavour || 'updates').toLowerCase();
    const flavour = FLAVOURS[key];
    if (!flavour) return json({ ok: false, error: 'Unknown flavour: ' + key });

    const name = clean(p.name);
    const email = clean(p.email);
    const phone = normalisePhone(p.phone);

    // A check asks "is this person already registered for this flavour?" and
    // writes nothing. It lets the form refuse a duplicate while someone is
    // still filling it in, rather than after they press Submit. Needs only a
    // name plus one way of reaching them — no consent, no answers.
    if (clean(p.mode) === 'check') {
      if (!name || (!phone && !email)) {
        return json({ ok: false, error: 'A check needs a name and a phone or email' });
      }
      // Flavours that allow multiple entries per person are never "already in".
      if (flavour.allowMultiple) {
        return json({ ok: true, check: true, exists: false });
      }
      const ss0 = book();
      const found = !!findPersonRow(
        tab(ss0, flavour.tab, flavourHeaders(flavour)), name, phone, email, 2, 3, 4);
      // Recorded so the answer can be read back by id when a browser refuses
      // to read our reply. Holds no personal data, as ever.
      logReceipt(ss0, clean(p.submission), key, found ? 'exists' : 'new');
      return json({ ok: true, check: true, exists: found });
    }

    for (let i = 0; i < flavour.required.length; i++) {
      const f = flavour.required[i];
      const v = f === 'phone' ? phone : clean(p[f]);
      if (!v) return json({ ok: false, error: 'Missing required field: ' + f });
    }
    if (email && !isEmail(email)) return json({ ok: false, error: 'Invalid email' });
    if (flavour.required.indexOf('phone') !== -1 && !isPhone(phone)) {
      return json({ ok: false, error: 'Invalid phone' });
    }
    if (!clean(p.consent)) return json({ ok: false, error: 'Consent is required' });
    if (!clean(p.age18)) return json({ ok: false, error: 'Age confirmation is required' });

    const ss = book();

    // Named "submission", not "sid": Google's front end rejects any request
    // carrying a parameter called sid with a 400, before the script runs.
    const sid = clean(p.submission);

    // 0. Idempotency: if this exact submission already has a receipt, the row
    //    is already in — a resend after an unreadable reply must not become a
    //    second row, nor be reported back as a duplicate registration.
    if (sid) {
      const seen = readReceipt(sid);
      if (seen.found) return json({ ok: true, duplicate: seen.duplicate, replayed: true });
    }

    // 1. Already registered for THIS flavour? Then it is a double entry —
    //    unless the flavour allows multiple entries per person (e.g. RSVP, one
    //    per event), where only the submission-id idempotency above applies.
    if (!flavour.allowMultiple &&
        findPersonRow(tab(ss, flavour.tab, flavourHeaders(flavour)), name, phone, email, 2, 3, 4)) {
      logReceipt(ss, sid, key, 'duplicate');
      return json({ ok: true, duplicate: true });
    }

    // 2. Record the submission on the flavour's own tab.
    const sh = tab(ss, flavour.tab, flavourHeaders(flavour));
    const ref = cleanRef(p.ref);
    const row = [new Date(), name, phone, email];
    flavour.fields.forEach(function (f) { row.push(clean(p[f])); });
    row.push(ref, clean(p.consent), clean(p.age18));
    sh.appendRow(row);
    stamp(sh, [1]);

    // 3. Upsert the person into Master.
    // Source reads "Volunteering (instagram-bio)" when a campaign link was used.
    const source = ref ? flavour.label + ' (' + ref + ')' : flavour.label;
    upsertMaster(ss, name, phone, email, source, clean(p.consent));

    // 4. Leave a receipt the browser can look up to confirm this landed.
    logReceipt(ss, sid, key, 'saved');

    return json({ ok: true, duplicate: false });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

/** Record the outcome against the submission id. No personal data here. */
function logReceipt(ss, sid, flavourKey, result) {
  if (!sid) return;
  const sh = tab(ss, LOG_TAB, LOG_HEADERS);
  sh.appendRow([sid, new Date(), flavourKey, result]);
  stamp(sh, [2]);
}

/** Look up a receipt by submission id. Returns { found, result }. */
function readReceipt(sid) {
  const wanted = clean(sid);
  if (!wanted) return { found: false };
  const ss = book();
  const sh = ss.getSheetByName(LOG_TAB);
  if (!sh || sh.getLastRow() < 2) return { found: false };
  const values = sh.getRange(1, 1, sh.getLastRow(), 4).getValues();
  // Newest first: a retry is far more likely to be recent.
  for (let i = values.length - 1; i >= 1; i--) {
    if (clean(values[i][0]) === wanted) {
      return { found: true, result: clean(values[i][3]), duplicate: clean(values[i][3]) === 'duplicate' };
    }
  }
  return { found: false };
}

function flavourHeaders(flavour) {
  return ['Timestamp', 'Full Name', 'Phone', 'Email']
    .concat(flavour.fields.map(titleise))
    .concat(['Ref', 'Consent', 'Age 18+']);
}

/**
 * Which link brought this person in, e.g. "instagram-bio". Kept short and
 * tidy so the Sources column stays readable.
 */
function cleanRef(v) {
  return clean(v).replace(/[^\w .:@/-]/g, '').slice(0, 60);
}

/** One row per person; a returning person gains a source rather than a new row. */
function upsertMaster(ss, name, phone, email, source, consent) {
  const sh = tab(ss, MASTER_TAB, MASTER_HEADERS);
  const hit = findPersonRow(sh, name, phone, email, 2, 3, 4);

  if (!hit) {
    sh.appendRow([new Date(), name, phone, email, source, 1, new Date(), consent]);
    stamp(sh, [1, 7]);
    return;
  }

  // Fill in a detail we did not have before (e.g. phone from a later form).
  if (phone && !hit.values[2]) sh.getRange(hit.row, 3).setValue(phone);
  if (email && !hit.values[3]) sh.getRange(hit.row, 4).setValue(email);

  const sources = String(hit.values[4] || '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(String);
  if (sources.indexOf(source) === -1) sources.push(source);

  sh.getRange(hit.row, 5).setValue(sources.join(', '));
  sh.getRange(hit.row, 6).setValue((Number(hit.values[5]) || 0) + 1);
  sh.getRange(hit.row, 7).setValue(new Date());
  stamp(sh, [1, 7]);
}

/**
 * Find a person by name + phone, or name + email. Column args are 1-based.
 * Returns { row, values } or null.
 */
function findPersonRow(sh, name, phone, email, nameCol, phoneCol, emailCol) {
  if (sh.getLastRow() < 2) return null;
  const values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
  const wantName = nameKey(name);
  const wantPhone = normalisePhone(phone);
  const wantEmail = emailKey(email);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (nameKey(row[nameCol - 1]) !== wantName) continue;
    const samePhone = wantPhone && normalisePhone(row[phoneCol - 1]) === wantPhone;
    const sameEmail = wantEmail && emailKey(row[emailCol - 1]) === wantEmail;
    if (samePhone || sameEmail) return { row: i + 1, values: row };
  }
  return null;
}

/* ---------- Normalising (so "  Ravi  Kumar" and "ravi kumar" are one person) ---------- */

function clean(v) { return String(v == null ? '' : v).trim(); }
function nameKey(v) { return clean(v).toLowerCase().replace(/\s+/g, ' '); }
function emailKey(v) { return clean(v).toLowerCase(); }

/** Digits only, dropping an Indian country code so +91 98… and 098… match. */
function normalisePhone(v) {
  let d = clean(v).replace(/\D/g, '');
  if (d.length > 10 && d.indexOf('91') === 0) d = d.slice(2);
  if (d.length === 11 && d.indexOf('0') === 0) d = d.slice(1);
  return d;
}

function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(clean(v)); }
function isPhone(v) {
  const d = normalisePhone(v);
  // 10 digits = Indian mobile, which must start 6-9 (so 1234567890 is rejected).
  // Anything longer is treated as an international number.
  if (d.length === 10) return /^[6-9]\d{9}$/.test(d);
  return d.length >= 11 && d.length <= 15;
}

function titleise(s) {
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

/** Get a tab, creating it with the given headers if missing. */
function tab(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sh.setFrozenRows(1);
    return sh;
  }
  // A tab made before a column was added: fill in the missing headers, so
  // new rows do not land under blank ones.
  const width = sh.getLastColumn();
  if (width < headers.length) {
    const missing = headers.slice(width);
    sh.getRange(1, width + 1, 1, missing.length)
      .setValues([missing])
      .setFontWeight('bold');
  }
  return sh;
}

/** Serve data to the site (GET). ?sheet=events | partners | stats */
function doGet(e) {
  const which = ((e && e.parameter && e.parameter.sheet) || '').toLowerCase();
  const callback = e && e.parameter && e.parameter.callback; // optional JSONP
  const verify = e && e.parameter && e.parameter.verify;     // submission id

  // Reliable, publish-independent reads of the planning workbook. The script
  // runs as the owner, so it can read those tabs whether or not they are
  // "published to web" — the site uses these so the sheet is a single source
  // of truth that a publish toggle can't break. Returned as TSV to match the
  // site's existing parsers.
  const feed = ((e && e.parameter && e.parameter.feed) || '').toLowerCase();
  if (feed === 'schedule') return tsvOut(sheetTsv(PLANNING_ID, 'Event List'));
  // Site copy: the Content doc ("key: text" lines) overrides marked text on the page.
  if (feed === 'content') return tsvOut(docContent(CONTENT_DOC_ID));
  if (feed === 'collab') return tsvOut(sheetTsv(PLANNING_ID, 'Collab / venues'));
  // Marketing listings tab: columns "Event link - BMS" / "Event link - District".
  // Cells are often a hyperlink labelled "Link" — cellExport turns that into the URL.
  if (feed === 'bms' || feed === 'tickets') return tsvOut(sheetTsv(PLANNING_ID, 'BMS'));

  let data;
  if (verify) data = readReceipt(verify);
  else if (which === 'events') data = readTab('Events');
  else if (which === 'partners') data = readTab('Partners');
  else if (which === 'stats') data = readStats();
  else if (which === 'links') data = readTab(LINK_TAB);
  else data = { ok: true, service: 'Bali in Bengaluru bridge' };
  return callback ? jsonp(callback, data) : json(data);
}

/** Append a minted campaign link to the master 'links' tab, deduped by URL. */
function recordLink(p) {
  const url = clean(p.url);
  if (!url) return json({ ok: false, error: 'A link needs a url' });
  const sh = tab(book(), LINK_TAB, LINK_HEADERS);
  // Skip if this exact URL is already recorded.
  const existing = sh.getLastRow() > 1
    ? sh.getRange(2, LINK_HEADERS.indexOf('URL') + 1, sh.getLastRow() - 1, 1).getValues()
    : [];
  for (var i = 0; i < existing.length; i++) {
    if (clean(existing[i][0]) === url) return json({ ok: true, duplicate: true });
  }
  sh.appendRow([
    clean(p.code), new Date(), clean(p.destination), clean(p.source), clean(p.medium),
    clean(p.campaign), clean(p.content), clean(p.programme), clean(p.ref), url, clean(p.svg)
  ]);
  stamp(sh, [2]);
  return json({ ok: true, duplicate: false });
}

/** Read a tab into an array of objects keyed by its header row. */
function readTab(name) {
  const ss = book();
  const sh = ss.getSheetByName(name);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values.shift().map(function (h) { return String(h).trim(); });
  return values
    .filter(function (row) { return row.some(function (c) { return c !== '' && c !== null; }); })
    .map(function (row) {
      const obj = {};
      headers.forEach(function (h, i) {
        let v = row[i];
        if (v instanceof Date) v = Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        obj[h] = v;
      });
      return obj;
    });
}

/** Aggregates only — safe to expose publicly. Never returns personal rows. */
function readStats() {
  const ss = book();
  const out = {};
  if (ss.getSheetByName('Stats')) {
    readTab('Stats').forEach(function (r) {
      if (r.key !== undefined) out[r.key] = r.value;
    });
  }
  const master = ss.getSheetByName(MASTER_TAB);
  out.registered = master ? Math.max(0, master.getLastRow() - 1) : 0;
  Object.keys(FLAVOURS).forEach(function (k) {
    const sh = ss.getSheetByName(FLAVOURS[k].tab);
    out[k] = sh ? Math.max(0, sh.getLastRow() - 1) : 0;
  });
  return out;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp(cb, obj) {
  return ContentService
    .createTextOutput(cb + '(' + JSON.stringify(obj) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
