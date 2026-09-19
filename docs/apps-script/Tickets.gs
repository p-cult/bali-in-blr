/**
 * Tickets — auto date stamp.
 *
 * On the "Master" tab, from row 11 down, column A (Date) fills itself with the
 * current date and time as soon as BOTH "Number of tickets" (B) and "Event" (C)
 * are filled in on that row.
 *
 *   - The stamp is set once and then left alone, so editing a row later does
 *     not change when it was recorded.
 *   - Clearing B or C clears the date, so an abandoned row carries no stamp.
 *   - Works for typing, dropdown picks and pasting several rows at once.
 *
 * This is a "simple trigger": it runs by itself on every edit and needs no
 * authorisation. It only ever writes to column A of Master.
 */
const SHEET_NAME = 'Master';
const FIRST_ROW = 11;   // row 10 holds the headers
const COL_DATE = 1;     // A
const COL_TICKETS = 2;  // B
const COL_EVENT = 3;    // C

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


// ===== Web app: ticket recording + verification =====

function doGet(e) {
  const p = e.parameter;
  if (p.data) return jsonResp(getData());
  if (p.verify) return jsonResp(verifyById(p.verify));
  return jsonResp({ error: "unknown" });
}

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    if (!authOk(b.user, b.pass)) return jsonResp({ error: "Auth failed" });
    if (!b.event || !b.qty || b.qty < 1 || !Number.isInteger(Number(b.qty)))
      return jsonResp({ error: "Bad data" });
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const master = ss.getSheetByName("Master");
    const events = getEvents(ss);
    if (!events.includes(b.event)) return jsonResp({ error: "Event not on list" });
    const id = b.id || Utilities.getUuid();
    const now = Utilities.formatDate(new Date(), "Asia/Kolkata", "dd-MMM | HH:mm");
    master.appendRow([now, Number(b.qty), b.event, id]);
    return jsonResp({ ok: true, row: true, id: id });
  } catch (err) {
    return jsonResp({ error: String(err) });
  }
}

function getData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const events = getEvents(ss);
  const master = ss.getSheetByName("Master");
  const rows = master.getDataRange().getValues().slice(10); // data from row 11
  const recent = rows.filter(r => r[0]).slice(-20).reverse()
    .map(r => ({ when: fmtWhen(r[0]), qty: r[1], event: r[2] }));
  const total = rows.filter(r => r[0]).reduce((s, r) => s + Number(r[1] || 0), 0);
  return { events: events, recent: recent, totalTickets: total };
}

/**
 * A row stamped by onEdit holds a real Date; a row written by doPost holds a
 * preformatted string. Normalise both to "dd-MMM | HH:mm" so the admin table
 * never shows a raw ISO timestamp for the older rows.
 */
function fmtWhen(v) {
  return (v instanceof Date)
    ? Utilities.formatDate(v, "Asia/Kolkata", "dd-MMM | HH:mm")
    : String(v);
}

function getEvents(ss) {
  const tab = ss.getSheetByName("Events");
  if (!tab) return [];
  return tab.getDataRange().getValues().slice(1).map(r => String(r[0]).trim()).filter(Boolean);
}

function verifyById(id) {
  const master = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Master");
  const rows = master.getDataRange().getValues();
  const found = rows.some(r => String(r[3]) === id);
  return { found: found };
}

function authOk(user, pass) {
  const HASHES = {
    kishan: "21e72236a640e3217ca075262b8f40b0a3b0be6f735df7d86f6e890195059a29",
    vinod:  "df6fcc5c1774a5292e5b8c61bb0e9cc57034b3b4f25b439231fe7c9cd726c820",
    jois:   "ee9d41e56dce85563d3e14b0a37eb48dde121c27539a2f4f9884e56b2ea1e0c7",
  };
  if (!user || !pass || !HASHES[user]) return false;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    pass, Utilities.Charset.UTF_8);
  const hex = digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
  return hex === HASHES[user];
}

function jsonResp(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
