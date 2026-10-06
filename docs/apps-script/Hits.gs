/**
 * Bali in Bengaluru — click log ("Hits") for the attribution dashboard.
 *
 * Its own Apps Script web app, bound to its own small spreadsheet, on purpose:
 * beacons arrive on every visit and must never queue behind a signup on the
 * registration bridge (Apps Script's execution slots are shared per script).
 *
 * The site (main.js sendHit) posts one small, PII-free row per action:
 *   kind   visit | event_open | ticket_click | register_open | register
 *   label  the event title (or page title / form flavour)
 *   ref    the campaign ref the visit arrived on, or "(direct)"
 *   page   which page it happened on
 *   sid    a random id per browser session — not a person, never joined to one
 *   dev    mobile | desktop
 *
 * GET ?summary=1[&days=N] returns aggregates only (cached 60 s):
 *   byRef[ref]        = { sessions, visit, event_open, ticket_click, register_open, register }
 *   byRefEvent[ref][event] = ticket clicks
 *   byEvent[event]    = { event_open, ticket_click }
 *   daily[yyyy-mm-dd] = { sessions, ticket_click, register }
 *
 * Setup (once): a spreadsheet "Bali in Blr - Hits" (SHEET_ID below), a
 * standalone Apps Script project with this file → Deploy ▸ New deployment ▸
 * Web app, execute as Me, access Anyone → the /exec URL into
 * CONFIG.HITS_URL in main.js. Done 6 Oct 2026.
 * After edits: Deploy ▸ Manage deployments ▸ edit ▸ new version. NEVER a
 * second deployment — the URL would change.
 */
/* The Hits spreadsheet. A standalone script reaches it by id; a script
   created from inside the sheet (Extensions ▸ Apps Script) may leave this
   blank. The id is not a secret and the sheet holds no personal data. */
const SHEET_ID = '16NZtYPy04GGtOFwDGcaSXjCmUfY1yMsqwQfAla2DzZA';
const TAB = 'Hits';
const HEADERS = ['When', 'Day', 'Kind', 'Label', 'Ref', 'Page', 'Session', 'Device'];
const KINDS = ['visit', 'event_open', 'ticket_click', 'register_open', 'register'];
const TZ = 'Asia/Kolkata';

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const kind = clean(p.kind);
    if (KINDS.indexOf(kind) === -1) return text('ignored');
    const now = new Date();
    sheet().appendRow([
      now,
      Utilities.formatDate(now, TZ, 'yyyy-MM-dd'),
      kind,
      clean(p.label).slice(0, 120),
      clean(p.ref).slice(0, 80) || '(direct)',
      clean(p.page).slice(0, 120),
      clean(p.sid).slice(0, 16),
      clean(p.dev) === 'mobile' ? 'mobile' : 'desktop',
    ]);
    return text('ok');
  } catch (err) {
    return text('error');
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.summary) return json({ ok: true, service: 'Bali in Bengaluru hits' });
  const days = Math.max(0, parseInt(p.days, 10) || 0);
  const key = 'summary:' + days;
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit) return jsonText(hit);
  const out = JSON.stringify(summary(days));
  try { cache.put(key, out, 60); } catch (err) { /* over 100 KB: serve uncached */ }
  return jsonText(out);
}

function summary(days) {
  const sh = sheet();
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, HEADERS.length).getValues() : [];
  const since = days ? Utilities.formatDate(new Date(Date.now() - days * 86400000), TZ, 'yyyy-MM-dd') : '';
  const byRef = {}, byRefEvent = {}, byEvent = {}, daily = {};
  const seen = {}; // ref|sid and day|sid, so a session counts once
  let total = 0, first = '', last = '';
  rows.forEach(function (r) {
    const day = String(r[1] || '');
    if (!day || (since && day < since)) return;
    const kind = String(r[2] || ''), label = String(r[3] || ''), ref = String(r[4] || '(direct)') || '(direct)', sid = String(r[6] || '');
    total++;
    if (!first || day < first) first = day;
    if (!last || day > last) last = day;
    const R = byRef[ref] || (byRef[ref] = { sessions: 0, visit: 0, event_open: 0, ticket_click: 0, register_open: 0, register: 0 });
    const D = daily[day] || (daily[day] = { sessions: 0, ticket_click: 0, register: 0 });
    if (kind in R) R[kind]++;
    if (kind in D) D[kind]++;
    if (!seen[ref + '|' + sid]) { seen[ref + '|' + sid] = 1; R.sessions++; }
    if (!seen[day + '|' + sid]) { seen[day + '|' + sid] = 1; D.sessions++; }
    if (kind === 'ticket_click' || kind === 'event_open') {
      const ev = label || '(unknown event)';
      const E = byEvent[ev] || (byEvent[ev] = { event_open: 0, ticket_click: 0 });
      E[kind]++;
      if (kind === 'ticket_click') {
        const RE = byRefEvent[ref] || (byRefEvent[ref] = {});
        RE[ev] = (RE[ev] || 0) + 1;
      }
    }
  });
  return { ok: true, rows: total, from: first, to: last, days: days, byRef: byRef, byRefEvent: byRefEvent, byEvent: byEvent, daily: daily };
}

function sheet() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TAB);
  if (!sh) {
    sh = ss.insertSheet(TAB);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function clean(v) { return String(v == null ? '' : v).trim(); }
function text(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.TEXT); }
function json(o) { return jsonText(JSON.stringify(o)); }
function jsonText(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON); }
