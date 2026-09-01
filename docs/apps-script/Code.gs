/**
 * Bali in Bengaluru — Google Sheets bridge (Apps Script Web App)
 * ---------------------------------------------------------------
 * Connects the static site to a Google Spreadsheet:
 *   - doPost : saves signup submissions to the "Signups" tab
 *   - doGet  : returns "Events" / "Partners" as JSON, and "stats" aggregates
 *
 * SETUP: see docs/BRIDGE-SETUP.md. In short:
 *   1. Create a Google Spreadsheet with tabs: Signups, Events, Partners, Stats.
 *   2. Paste this into Extensions ▸ Apps Script, set SHEET_ID below.
 *   3. Deploy ▸ New deployment ▸ Web app; Execute as: Me; Access: Anyone.
 *   4. Copy the /exec URL into the site's main.js CONFIG.BRIDGE_URL.
 *
 * PRIVACY: never return personal rows from Signups. Only aggregates (see readStats).
 */

// Paste the spreadsheet ID (the long string in the sheet URL between /d/ and /edit).
const SHEET_ID = 'PASTE_SPREADSHEET_ID_HERE';
const SIGNUP_TAB = 'Signups';

/** Handle signup form submissions (POST from the site's signup form). */
function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sh = ss.getSheetByName(SIGNUP_TAB);
    if (!sh) sh = ss.insertSheet(SIGNUP_TAB);
    if (sh.getLastRow() === 0) {
      sh.appendRow(['Timestamp', 'Name', 'Email', 'Phone', 'Interest', 'NotifyEmail', 'NotifyPhone', 'Consent']);
    }
    sh.appendRow([
      new Date(),
      p.name || '',
      p.email || '',
      p.phone || '',
      p.interest || '',
      p.notify_email || '',
      p.notify_phone || '',
      p.consent || ''
    ]);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** Serve data to the site (GET). ?sheet=events | partners | stats */
function doGet(e) {
  const which = ((e && e.parameter && e.parameter.sheet) || '').toLowerCase();
  const callback = e && e.parameter && e.parameter.callback; // optional JSONP
  let data;
  if (which === 'events') data = readTab('Events');
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
  const stats = ss.getSheetByName('Stats');
  if (stats) {
    readTab('Stats').forEach(function (r) {
      if (r.key !== undefined) out[r.key] = r.value;
    });
  }
  const signups = ss.getSheetByName(SIGNUP_TAB);
  out.registered = signups ? Math.max(0, signups.getLastRow() - 1) : 0;
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
