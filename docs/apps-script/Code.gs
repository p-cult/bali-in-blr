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

// Paste the spreadsheet ID (the long string in the sheet URL between /d/ and /edit).
const SHEET_ID = 'PASTE_SPREADSHEET_ID_HERE';

const MASTER_TAB = 'Master';

/**
 * Receipt log. Holds NO personal data — just the random submission id the
 * browser generated, so a form can confirm its submission landed even when
 * the browser refuses to read our reply. Never put PII in this tab: it is
 * looked up over a URL.
 */
const LOG_TAB = 'Receipts';
const LOG_HEADERS = ['Submission ID', 'Timestamp', 'Flavour', 'Result'];
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
    required: ['name', 'email'],
    fields: ['interest', 'notify_email', 'notify_phone']
  },
  volunteer: {
    tab: 'Volunteers',
    label: 'Volunteering',
    required: ['name', 'email', 'phone'],
    fields: []
  }
};

/** Handle a form submission. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // Serialise writes so two submissions cannot both pass the duplicate check.
    lock.waitLock(20000);

    const p = (e && e.parameter) || {};
    const key = String(p.flavour || 'updates').toLowerCase();
    const flavour = FLAVOURS[key];
    if (!flavour) return json({ ok: false, error: 'Unknown flavour: ' + key });

    const name = clean(p.name);
    const email = clean(p.email);
    const phone = normalisePhone(p.phone);

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

    const ss = SpreadsheetApp.openById(SHEET_ID);

    const sid = clean(p.sid);

    // 0. Idempotency: if this exact submission already has a receipt, the row
    //    is already in — a resend after an unreadable reply must not become a
    //    second row, nor be reported back as a duplicate registration.
    if (sid) {
      const seen = readReceipt(sid);
      if (seen.found) return json({ ok: true, duplicate: seen.duplicate, replayed: true });
    }

    // 1. Already registered for THIS flavour? Then it is a double entry.
    if (findPersonRow(tab(ss, flavour.tab, flavourHeaders(flavour)), name, phone, email, 2, 3, 4)) {
      logReceipt(ss, sid, key, 'duplicate');
      return json({ ok: true, duplicate: true });
    }

    // 2. Record the submission on the flavour's own tab.
    const sh = tab(ss, flavour.tab, flavourHeaders(flavour));
    const ref = cleanRef(p.ref);
    const row = [new Date(), name, phone, email];
    flavour.fields.forEach(function (f) { row.push(clean(p[f])); });
    row.push(ref, clean(p.consent));
    sh.appendRow(row);

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
  tab(ss, LOG_TAB, LOG_HEADERS).appendRow([sid, new Date(), flavourKey, result]);
}

/** Look up a receipt by submission id. Returns { found, result }. */
function readReceipt(sid) {
  const wanted = clean(sid);
  if (!wanted) return { found: false };
  const ss = SpreadsheetApp.openById(SHEET_ID);
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
    .concat(['Ref', 'Consent']);
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
  }
  return sh;
}

/** Serve data to the site (GET). ?sheet=events | partners | stats */
function doGet(e) {
  const which = ((e && e.parameter && e.parameter.sheet) || '').toLowerCase();
  const callback = e && e.parameter && e.parameter.callback; // optional JSONP
  const verify = e && e.parameter && e.parameter.verify;     // submission id
  let data;
  if (verify) data = readReceipt(verify);
  else if (which === 'events') data = readTab('Events');
  else if (which === 'partners') data = readTab('Partners');
  else if (which === 'stats') data = readStats();
  else data = { ok: true, service: 'Bali in Bengaluru bridge' };
  return callback ? jsonp(callback, data) : json(data);
}

/** Read a tab into an array of objects keyed by its header row. */
function readTab(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
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
  const ss = SpreadsheetApp.openById(SHEET_ID);
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
