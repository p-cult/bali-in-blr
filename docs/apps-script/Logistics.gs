/**
 * Bali in Bengaluru — Logistics backend (Google Apps Script web app).
 *
 * A THIRD web app, separate from the registration bridge (Code.gs) and the
 * tickets app (Tickets.gs), so planning traffic never competes with signups
 * for Apps Script's shared execution slots.
 *
 * What it does
 *   GET ?action=leg&from=lat,lon&to=lat,lon&depart=<ISO 8601>
 *       → { ok, minutes, km, source:"google-traffic" }
 *       Google Maps directions with the traffic model for that departure
 *       time. Far from the date this is Google's typical traffic for that
 *       weekday and hour ("typical"); within 48 h it is refreshed hourly
 *       ("near"); within 2 h of departure it is live and refreshed every
 *       10 minutes ("live"). Cached in the "TravelCache" tab per
 *       origin/destination/weekday/15-min slot so replanning does not burn
 *       quota; the cache lifetime shortens as the departure approaches. Apps Script's Maps service has a
 *       daily quota (1,000 direction calls on consumer accounts, more on
 *       Workspace) — the planner only asks for legs it has not cached.
 *   GET ?action=legs&legs=<from>~<to>~<depart>|<from>~<to>~<depart>|…
 *       → { ok, results:[{ok, minutes, km, mode} | {ok:false, error}] }
 *       Many legs in ONE execution (the planner sends a tour in a few
 *       requests). Apps Script's front door refuses concurrent calls now
 *       and then with a "unable to open the file" page, so batching beats
 *       parallel single requests.
 *   GET ?action=geocode&q=<address>
 *       → { ok, lat, lon, label }
 *   GET ?action=load
 *       → { ok, cfg }   the saved plan configuration (or {} if none)
 *   POST body {"action":"save","cfg":{…}}
 *       → { ok }        stores the configuration in the "Plan" tab
 *
 * Setup
 *   1. Create a Google Sheet "Bali in Bengaluru — Logistics" (or reuse the
 *      planning workbook) and paste this file into Extensions → Apps Script.
 *   2. SHEET_NAME names the workbook (or set SHEET_ID). Tabs are created on
 *      first use.
 *   3. Deploy → New deployment → Web app: Execute as *Me*, Who has access
 *      *Anyone*. Copy the /exec URL into CONFIG.LOGISTICS_URL in
 *      plan/engine.js and bump the ?v= on both pages.
 *   4. Later changes: Deploy → Manage deployments → edit → new version.
 *      NEVER create a second deployment (the URL would change).
 *
 * No personal data is handled here: coordinates of public venues and a
 * plan configuration only.
 */

// The workbook that holds the TravelCache and Plan tabs: the planning
// workbook, found by name so no id has to be pasted here (the id is then
// remembered in script properties).
var SHEET_NAME = "All things - Bali in Bengaluru";
var SHEET_ID = "";
var CACHE_TAB = "TravelCache";
var PLAN_TAB = "Plan";
var TZ = "Asia/Kolkata";

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    switch (p.action) {
      case "leg": { var one = leg_(p.from, p.to, p.depart); cacheFlush_(); return json_(one); }
      // legs may carry the planner-sheet inputs back too (sheet=1): one
      // round trip for a cold page instead of two.
      case "legs": { var many = legs_(p.legs); if (p.sheet) many.sheet = sheetplanCached_(false); cacheFlush_(); return json_(many); }
      case "buildsheet": return json_(buildsheet_());
      case "sheetplan": return json_(sheetplanCached_(!!p.fresh));
      case "geocode": return json_(geocode_(p.q));
      case "load": return json_({ ok: true, cfg: loadPlan_() });
      default: return json_({ ok: true, service: "bali-logistics", actions: ["leg", "legs", "geocode", "load", "save", "buildsheet", "sheetplan", "writeback"] });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.action === "save") { savePlan_(body.cfg || {}); return json_({ ok: true }); }
    if (body.action === "writeback") return json_(writeback_(body.days || {}, body.settings || null));
    return json_({ ok: false, error: "unknown action" });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ---------- travel time with traffic ---------- */
function leg_(from, to, departISO) {
  var a = parseLatLon_(from), b = parseLatLon_(to);
  if (!a || !b) throw new Error("from/to must be lat,lon");
  var depart = departISO ? new Date(departISO) : new Date();
  if (isNaN(depart.getTime())) depart = new Date();
  // Google only predicts for departures in the future; a past time falls
  // back to "now", which is still live traffic.
  if (depart.getTime() < Date.now()) depart = new Date(Date.now() + 60 * 1000);

  var tier = tier_(depart);
  var key = cacheKey_(a, b, depart);
  var cached = cacheGet_(key, tier.ttlMs);
  if (cached) return { ok: true, minutes: cached.minutes, km: cached.km, source: "google-traffic", mode: tier.mode, cached: true };

  var finder = Maps.newDirectionFinder()
    .setOrigin(a.lat, a.lon)
    .setDestination(b.lat, b.lon)
    .setMode(Maps.DirectionFinder.Mode.DRIVING)
    .setDepart(depart);
  var res = finder.getDirections();
  if (!res.routes || !res.routes.length) throw new Error("No route (" + res.status + ")");
  var legs = res.routes[0].legs;
  var sec = 0, m = 0;
  legs.forEach(function (l) {
    sec += (l.duration_in_traffic ? l.duration_in_traffic.value : l.duration.value);
    m += l.distance.value;
  });
  var out = { minutes: Math.round(sec / 60), km: Math.round(m / 100) / 10 };
  cachePut_(key, out, tier.ttlMs);
  return { ok: true, minutes: out.minutes, km: out.km, source: "google-traffic", mode: tier.mode, cached: false };
}

function legs_(spec) {
  var items = String(spec || "").split("|").filter(function (x) { return x; });
  if (items.length > 120) throw new Error("at most 120 legs per request");
  var results = items.map(function (item) {
    var parts = item.split("~");
    try { var r = leg_(parts[0], parts[1], parts[2]); return { ok: true, minutes: r.minutes, km: r.km, mode: r.mode, cached: r.cached }; }
    catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  });
  return { ok: true, results: results };
}

// How fresh a figure must be, by how far away the departure is.
function tier_(depart) {
  var hours = (depart.getTime() - Date.now()) / 3600000;
  if (hours <= 2) return { mode: "live", ttlMs: 10 * 60000 };
  if (hours <= 48) return { mode: "near", ttlMs: 60 * 60000 };
  return { mode: "typical", ttlMs: 7 * 86400000 };
}

function cacheKey_(a, b, depart) {
  // Same weekday and 15-minute slot → same predicted traffic. Live "now"
  // lookups share the slot too, which is fine for planning.
  var slot = Utilities.formatDate(depart, TZ, "u-HH") + ":" + (Math.floor(depart.getMinutes() / 15) * 15);
  return [a.lat.toFixed(4), a.lon.toFixed(4), b.lat.toFixed(4), b.lon.toFixed(4), slot].join("|");
}
// The TravelCache tab is read ONCE per execution (a batch of 40 legs used to
// re-read the whole tab per leg, which is what made pricing slow as the tab
// grew) and indexed by key; new rows are appended and added to the index.
var cacheIndex_ = null, cacheSheet_ = null;
function cacheLoad_() {
  if (cacheIndex_) return;
  cacheSheet_ = tab_(CACHE_TAB, ["key", "minutes", "km", "fetched"]);
  cacheIndex_ = {};
  var data = cacheSheet_.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var at = new Date(data[i][3]).getTime();
    var cur = cacheIndex_[data[i][0]];
    if (!cur || at > cur.at) cacheIndex_[data[i][0]] = { minutes: +data[i][1], km: +data[i][2], at: at };
  }
}
function cacheGet_(key, ttlMs) {
  var hit = CacheService.getScriptCache().get(key);
  if (hit) { var h = JSON.parse(hit); if (Date.now() - h.at < ttlMs) return h; }
  cacheLoad_();
  var v = cacheIndex_[key];
  if (v && Date.now() - v.at < ttlMs) {
    CacheService.getScriptCache().put(key, JSON.stringify(v), Math.min(21600, Math.max(60, Math.floor(ttlMs / 1000))));
    return v;
  }
  return null;
}
// New rows are queued and written in ONE setValues at the end of the
// request (cacheFlush_): an appendRow per leg was the slow part.
var cachePending_ = [];
function cachePut_(key, v, ttlMs) {
  var rec = { minutes: v.minutes, km: v.km, at: Date.now() };
  CacheService.getScriptCache().put(key, JSON.stringify(rec), Math.min(21600, Math.max(60, Math.floor(ttlMs / 1000))));
  cacheLoad_();
  cacheIndex_[key] = rec;
  cachePending_.push([key, v.minutes, v.km, new Date()]);
}
function cacheFlush_() {
  if (!cachePending_.length) return;
  cacheLoad_();
  var row = cacheSheet_.getLastRow() + 1;
  cacheSheet_.getRange(row, 1, cachePending_.length, 4).setValues(cachePending_);
  cachePending_ = [];
}

/* ---------- geocoding ---------- */
function geocode_(q) {
  if (!q) throw new Error("q required");
  var r = Maps.newGeocoder().setRegion("in").geocode(q);
  if (!r.results || !r.results.length) return { ok: false, error: "not found" };
  var g = r.results[0];
  return { ok: true, lat: g.geometry.location.lat, lon: g.geometry.location.lng, label: g.formatted_address, precision: g.geometry.location_type };
}

/* ---------- plan storage ---------- */
function savePlan_(cfg) {
  var sh = tab_(PLAN_TAB, ["key", "value", "updated"]);
  var text = JSON.stringify(cfg);
  // Cells hold 50,000 characters; split defensively.
  var parts = text.match(/[\s\S]{1,45000}/g) || [""];
  sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 3).clearContent();
  parts.forEach(function (p, i) { sh.getRange(2 + i, 1, 1, 3).setValues([["cfg." + i, p, new Date()]]); });
}
function loadPlan_() {
  var sh = tab_(PLAN_TAB, ["key", "value", "updated"]);
  var rows = sh.getDataRange().getValues().slice(1).filter(function (r) { return String(r[0]).indexOf("cfg.") === 0; });
  if (!rows.length) return {};
  rows.sort(function (a, b) { return +String(a[0]).slice(4) - +String(b[0]).slice(4); });
  try { return JSON.parse(rows.map(function (r) { return r[1]; }).join("")); } catch (e) { return {}; }
}

/* ---------- helpers ---------- */
function parseLatLon_(s) {
  var m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(String(s || ""));
  return m ? { lat: +m[1], lon: +m[2] } : null;
}
function book_() {
  var props = PropertiesService.getScriptProperties();
  var id = SHEET_ID || props.getProperty("SHEET_ID");
  if (!id) {
    var files = DriveApp.getFilesByName(SHEET_NAME);
    if (!files.hasNext()) throw new Error("Workbook not found: " + SHEET_NAME);
    id = files.next().getId();
    props.setProperty("SHEET_ID", id);
  }
  return SpreadsheetApp.openById(id);
}
function tab_(name, header) {
  var ss = book_();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  return sh;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   PLANNER SHEET — "Bali in Bengaluru — Logistics Planner"
   One tab per tour day. Rows 1–9: title block (date as DD MMM | DAY |
   HH:MM, stay, links). Row 10: headers. Row 11+: the day's events pulled
   from the planning workbook's Event List (protected, not editable) with
   the editable inputs beside them, then an add-ons block (meals out,
   sightseeing, shopping, engagements) with dropdowns and HH:MM times.
   The planner web pages read it through ?action=sheetplan.
     GET  ?action=buildsheet   create the workbook (once) / re-pull events
                               (on demand from the admin planner; no timer)
     GET  ?action=sheetplan    → { ok, url, cfg } inputs for the planner
     POST {action:"writeback", days:{date:{leave:"HH:MM", events:{id:{instrLeave,instrAt}}}}}
   ============================================================ */
var PLANNER_NAME = "Bali in Bengaluru — Logistics Planner";
var HEADER_ROW = 10;
var EVENT_HEADERS = ["#", "Type", "Title", "Venue", "Start", "End", "Status", "Artists", "Set-up", "Sound check", "Costume & make-up", "Costume off", "Wrap", "Skip?", "Instruments at venue by", "Vehicle leaves storage", "Note", "Cast (who performs — names or group)"];
var ADDON_HEADERS = ["#", "Purpose", "Location (Maps link or address)", "Start", "End", "Include?", "Note"];
var PURPOSES = ["Breakfast", "Lunch", "Dinner", "Sightseeing", "Shopping", "Engagement", "Other"];
var ADDON_ROWS = 6;
var DEFAULT_SEG = { Performance: [30, 30, 60, 20, 30], Workshop: [10, 10, 15, 5, 15], Talk: [0, 10, 0, 0, 10], Internal: [10, 0, 15, 10, 10], default: [15, 10, 20, 5, 15] };
var SEED_ENGAGEMENTS = [{ date: "2026-10-02", title: "Photoshoot", venue: "Mandala Cultural Centre", start: "07:00", end: "14:00" }];
var STAYS = ["Jana Seva Vidya Kendra", "Citadel Sarovar Portico"];

function plannerBook_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("PLANNER_ID");
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { /* recreate */ } }
  var files = DriveApp.getFilesByName(PLANNER_NAME);
  var ss = files.hasNext() ? SpreadsheetApp.open(files.next()) : SpreadsheetApp.create(PLANNER_NAME);
  props.setProperty("PLANNER_ID", ss.getId());
  return ss;
}
function tabName_(iso) { return Utilities.formatDate(new Date(iso + "T00:00:00+05:30"), TZ, "dd MMM"); }
function dayLabel_(iso) { return Utilities.formatDate(new Date(iso + "T00:00:00+05:30"), TZ, "dd MMM | EEE"); }
function hhmm_(min) { min = Math.round(min); return ("0" + Math.floor(min / 60)).slice(-2) + ":" + ("0" + (min % 60)).slice(-2); }
function parseClock_(s) {
  var m = /(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)?/i.exec(String(s || "").trim());
  if (!m) return null;
  var h = +m[1], mm = m[2] ? +m[2] : 0, ap = (m[3] || "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
  if (!ap && h < 8 && String(s).indexOf(":") === -1) h += 12;
  return h * 60 + mm;
}
function parseDate_(s) {
  s = String(s || "").trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return s.slice(0, 10);
  var months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  m = /^(\d{1,2})\s+([a-z]+)\.?\s+(\d{2,4})/i.exec(s);
  if (m && months[m[2].toLowerCase().slice(0, 3)] != null) { var y = +m[3]; if (y < 100) y += 2000; return y + "-" + ("0" + (months[m[2].toLowerCase().slice(0, 3)] + 1)).slice(-2) + "-" + ("0" + +m[1]).slice(-2); }
  if (Object.prototype.toString.call(s) === "[object Date]") return Utilities.formatDate(s, TZ, "yyyy-MM-dd");
  return "";
}
function slug_(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/ /g, "-"); }
function addDays_(iso, n) { var d = new Date(iso + "T00:00:00+05:30"); d.setDate(d.getDate() + n); return Utilities.formatDate(d, TZ, "yyyy-MM-dd"); }

// Events per day from the planning workbook's Event List tab.
function eventsByDay_() {
  var sh = book_().getSheetByName("Event List");
  if (!sh) throw new Error("Event List tab not found");
  var rows = sh.getDataRange().getDisplayValues();
  var hi = -1, header = [];
  for (var i = 0; i < rows.length; i++) { var low = rows[i].map(function (c) { return String(c).trim().toLowerCase(); }); if (low.indexOf("title") !== -1 && low.indexOf("venue") !== -1) { hi = i; header = low; break; } }
  if (hi < 0) throw new Error("Event List header not found");
  var col = function (n) { return header.indexOf(n); };
  var out = {};
  for (var r = hi + 1; r < rows.length; r++) {
    var row = rows[r]; var title = String(row[col("title")] || "").trim(); if (!title) continue;
    var d0 = parseDate_(row[col("start date")]); if (!d0) continue;
    var d1 = parseDate_(row[col("end date")]) || d0;
    var guard = 0;
    for (var d = d0; d <= d1 && guard++ < 31; d = addDays_(d, 1)) {
      (out[d] = out[d] || []).push({
        id: slug_(title) + "@" + d, title: title, category: String(row[col("category")] || ""), venue: String(row[col("venue")] || ""),
        start: String(row[col("start time")] || ""), end: String(row[col("end time")] || ""), status: String(row[col("status")] || ""),
      });
    }
  }
  return out;
}

function buildsheet_() {
  var ss = plannerBook_();
  var byDay = eventsByDay_();
  var dates = Object.keys(byDay);
  SEED_ENGAGEMENTS.forEach(function (e) { if (dates.indexOf(e.date) === -1) dates.push(e.date); });
  dates.sort();
  var first = dates[0], last = dates[dates.length - 1];
  var settings = settingsTab_(ss);
  var made = [];
  for (var d = first; d <= last; d = addDays_(d, 1)) { dayTab_(ss, d, byDay[d] || []); made.push(tabName_(d)); }
  // Tidy: settings first, then days in order; drop the default "Sheet1".
  var s1 = ss.getSheetByName("Sheet1"); if (s1 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  ss.setActiveSheet(settings); ss.moveActiveSheet(1);
  made.forEach(function (n, i) { ss.setActiveSheet(ss.getSheetByName(n)); ss.moveActiveSheet(i + 2); });
  CacheService.getScriptCache().remove(SHEETPLAN_KEY);
  return { ok: true, url: ss.getUrl(), days: made.length };
}

function settingsTab_(ss) {
  var sh = ss.getSheetByName("Settings") || ss.insertSheet("Settings");
  if (sh.getLastRow() < HEADER_ROW) {
    sh.getRange(1, 1).setValue("Bali in Bengaluru — Logistics Planner").setFontWeight("bold").setFontSize(14);
    sh.getRange(2, 1).setValue("Inputs for the artist tour plan. Grey cells are pulled from the planning workbook and are not editable; white cells are yours. Times are HH:MM (a 30-minute allowance is 00:30).");
    sh.getRange(3, 1).setValue("Public plan: https://bali-in-blr.paramfoundation.org/plan/   ·   Planner: https://bali-in-blr.paramfoundation.org/admin/logistics.html");
    sh.getRange(HEADER_ROW, 1, 1, 3).setValues([["Setting", "Value", "Notes"]]).setFontWeight("bold").setBackground("#EFE7D8");
    sh.getRange(HEADER_ROW + 1, 1, 5, 3).setValues([
      ["Place of stay", STAYS[0], "Which stay the day tabs and the public plan use"],
      ["Instrument storage", "", "Address or Google Maps link of where instruments and sets are kept; used for the instrument vehicle's departure time"],
      ["Artists", 25, ""],
      ["Volunteers travelling", 2, ""],
      ["Instruments needed at venue", "00:30", "Default lead before the artists' set-up starts (HH:MM); override per event on the day tabs"],
    ]);
    sh.getRange(HEADER_ROW + 1, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STAYS, true).build());
    sh.getRange(HEADER_ROW + 5, 2).setNumberFormat("[hh]:mm");
    sh.setColumnWidth(1, 220); sh.setColumnWidth(2, 320); sh.setColumnWidth(3, 520);
    sh.setFrozenRows(HEADER_ROW);
  }
  return sh;
}

function dayTab_(ss, iso, events) {
  var name = tabName_(iso);
  var sh = ss.getSheetByName(name);
  var fresh = !sh;
  if (fresh) sh = ss.insertSheet(name);
  // Title block, rows 1–9. Row 2 carries DD MMM | DAY | HH:MM (leave time, written back by the planner).
  sh.getRange(1, 1).setValue("Bali in Bengaluru — artist logistics").setFontWeight("bold").setFontSize(13);
  // A2:D2 merged: "04 Oct | Sun | 07:30" — the time is the departure from
  // the stay, filled in by the planner (writeback); "—" until then.
  var prev = String(sh.getRange(2, 1).getDisplayValue() || "");
  var leave = (/\|\s*(\d{2}:\d{2})\s*$/.exec(prev) || [])[1] || "—";
  sh.getRange(2, 1, 1, 4).merge();
  sh.getRange(2, 1).setValue(dayLabel_(iso) + " | " + leave).setFontSize(16).setFontWeight("bold");
  sh.getRange(3, 1).setValue("Stay: see Settings · times are HH:MM · a 30-minute allowance is 00:30 · grey cells come from the planning workbook and cannot be edited here.");
  sh.getRange(4, 1).setValue("Public plan for this day: https://bali-in-blr.paramfoundation.org/plan/?day=" + iso);
  sh.getRange(1, 1, 9, 17).setBackground("#F7F3EA");

  // Events block.
  var h = HEADER_ROW;
  sh.getRange(h, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]).setFontWeight("bold").setBackground("#EFE7D8").setWrap(true);
  var keep = {};
  if (!fresh) {
    var old = sh.getRange(h + 1, 1, Math.max(1, sh.getLastRow() - h), EVENT_HEADERS.length).getDisplayValues();
    old.forEach(function (r) { if (r[2] && r[0] !== "" && !/^add-on/i.test(r[0])) keep[slug_(r[2])] = r; });
  }
  var rows = events.map(function (e, i) {
    var seg = DEFAULT_SEG[e.category] || DEFAULT_SEG.default;
    var k = keep[slug_(e.title)];
    var t = function (m) { return hhmm_(m); };
    return [i + 1, e.category, e.title, e.venue, e.start ? hhmm_(parseClock_(e.start)) : "", e.end ? hhmm_(parseClock_(e.end)) : "", e.status,
      k ? k[7] : "", k ? k[8] : t(seg[0]), k ? k[9] : t(seg[1]), k ? k[10] : t(seg[2]), k ? k[11] : t(seg[3]), k ? k[12] : t(seg[4]), k ? k[13] : "No", k ? k[14] : "", k ? k[15] : "", k ? k[16] : "", k ? (k[17] || "") : ""];
  });
  var n = Math.max(rows.length, 1);
  if (!rows.length) rows = [["", "", "(no programme this day)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]];
  var eventsRange = sh.getRange(h + 1, 1, n, EVENT_HEADERS.length);
  eventsRange.setValues(rows);
  sh.getRange(h + 1, 1, n, 7).setBackground("#E9E4DA").setFontColor("#444444");
  sh.getRange(h + 1, 16, n, 1).setBackground("#E9E4DA").setFontColor("#444444");
  sh.getRange(h + 1, 8, n, 9).setBackground("#FFFFFF");
  sh.getRange(h + 1, 18, n, 1).setBackground("#FFFFFF").setWrap(true);
  sh.getRange(h + 1, 5, n, 2).setNumberFormat("@");
  sh.getRange(h + 1, 9, n, 5).setNumberFormat("[hh]:mm");
  sh.getRange(h + 1, 15, n, 2).setNumberFormat("hh:mm");
  sh.getRange(h + 1, 14, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["No", "Yes"], true).build());
  sh.getRange(h + 1, 8, n, 1).setNumberFormat("0");

  // Add-ons block.
  var a = h + n + 2;
  sh.getRange(a - 1, 1).setValue("Add-ons — meals out, sightseeing, shopping, engagements (blank = none; a meal with no row is taken wherever the group is)").setFontStyle("italic");
  sh.getRange(a, 1, 1, ADDON_HEADERS.length).setValues([ADDON_HEADERS]).setFontWeight("bold").setBackground("#EFE7D8");
  var oldAdd = [];
  if (!fresh) {
    var all = sh.getDataRange().getDisplayValues();
    for (var r = 0; r < all.length; r++) if (all[r][0] === "#" && all[r][1] === "Purpose") { oldAdd = all.slice(r + 1, r + 1 + ADDON_ROWS); break; }
  }
  var addRows = [];
  for (var i = 0; i < ADDON_ROWS; i++) {
    var o = oldAdd[i];
    if (o && o[1]) addRows.push([i + 1, o[1], o[2], o[3], o[4], o[5] || "Yes", o[6]]);
    else addRows.push([i + 1, "", "", "", "", "Yes", ""]);
  }
  if (fresh) SEED_ENGAGEMENTS.forEach(function (e) { if (e.date === iso) addRows[0] = [1, "Engagement", e.title + " — " + e.venue, e.start, e.end, "Yes", ""]; });
  sh.getRange(a + 1, 1, ADDON_ROWS, ADDON_HEADERS.length).setValues(addRows).setBackground("#FFFFFF");
  sh.getRange(a + 1, 2, ADDON_ROWS, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(PURPOSES, true).build());
  sh.getRange(a + 1, 6, ADDON_ROWS, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Yes", "No"], true).build());
  sh.getRange(a + 1, 4, ADDON_ROWS, 2).setNumberFormat("hh:mm");
  sh.getRange(a + 1, 1, ADDON_ROWS, 1).setBackground("#E9E4DA");

  // Widths, freeze, protection of the pulled cells.
  [4, 11, 30, 26, 8, 8, 12, 8, 9, 10, 12, 10, 8, 7, 14, 14, 30, 40].forEach(function (w, i) { sh.setColumnWidth(i + 1, w * 8); });
  sh.setFrozenRows(HEADER_ROW);
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) { p.remove(); });
  var prot = function (range, desc) { var p = range.protect().setDescription(desc); p.removeEditors(p.getEditors()); if (p.canDomainEdit()) p.setDomainEdit(false); };
  prot(sh.getRange(1, 1, HEADER_ROW, EVENT_HEADERS.length), "Title block and headers — from the planner");
  prot(sh.getRange(h + 1, 1, n, 7), "Pulled from the planning workbook's Event List — edit there");
  prot(sh.getRange(h + 1, 16, n, 1), "Computed by the planner");
  prot(sh.getRange(a, 1, 1, ADDON_HEADERS.length), "Headers");
}

// Read the inputs back for the planner.
function dispMin_(s) {
  s = String(s || "").trim(); if (!s || s === "—") return null;
  var m = /^(\d{1,3}):(\d{2})/.exec(s); if (m) return +m[1] * 60 + +m[2];
  var c = parseClock_(s); return c;
}
// The 17-tab read costs 15–30 s, so its answer is kept in the script cache
// (6 h, the maximum) and re-made whenever the sheet is written through
// writeback_ or rebuilt; fresh=1 forces a re-read.
var SHEETPLAN_KEY = "sheetplan-v1";
function sheetplanCached_(fresh) {
  var cache = CacheService.getScriptCache();
  if (!fresh) { var hit = cache.get(SHEETPLAN_KEY); if (hit) { try { return JSON.parse(hit); } catch (e) { /* re-read */ } } }
  var r = sheetplan_();
  var str = JSON.stringify(r);
  if (str.length < 95000) cache.put(SHEETPLAN_KEY, str, 21600); else cache.remove(SHEETPLAN_KEY);
  return r;
}
function sheetplan_() {
  var ss = plannerBook_();
  var cfg = { overrides: {}, stops: {}, extras: [], mealPlan: {}, dayVehicle: {} };
  var st = ss.getSheetByName("Settings");
  if (st) {
    var sv = st.getRange(HEADER_ROW + 1, 1, 5, 2).getDisplayValues();
    var get = function (k) { for (var i = 0; i < sv.length; i++) if (sv[i][0] === k) return sv[i][1]; return ""; };
    cfg.stayName = get("Place of stay");
    cfg.party = { artists: +get("Artists") || 25, volunteers: +get("Volunteers travelling") || 0 };
    cfg.instrumentLead = dispMin_(get("Instruments needed at venue"));
    var store = get("Instrument storage");
    if (store) cfg.instrumentStore = locate_(store);
  }
  ss.getSheets().forEach(function (sh) {
    var name = sh.getName(); if (name === "Settings") return;
    var all = sh.getDataRange().getDisplayValues();
    if (all.length <= HEADER_ROW) return;
    var iso = null;
    var m = /plan\/\?day=(\d{4}-\d{2}-\d{2})/.exec(String(all[3] && all[3][0] || "")); if (m) iso = m[1];
    if (!iso) return;
    var vm = /^Vehicle:\s*(.+)$/.exec(String(all[1] && all[1][4] || "").trim());
    if (vm && !/^auto$/i.test(vm[1].trim())) cfg.dayVehicle[iso] = vm[1].trim();
    var r = HEADER_ROW;
    for (; r < all.length; r++) {
      var row = all[r];
      if (row[0] === "#" && row[1] === "Purpose") break;
      if (!row[2] || row[0] === "#" || /^add-on/i.test(row[0]) || /no programme/i.test(row[2])) continue;
      var id = slug_(row[2]) + "@" + iso;
      var o = {};
      if (row[7]) o.artists = +row[7];
      var seg = ["setup", "soundcheck", "ready", "change", "after"];
      seg.forEach(function (k, i) { var v = dispMin_(row[8 + i]); if (v != null) o[k] = v; });
      if (/^y/i.test(row[13])) o.skip = true;
      if (row[14] && row[14] !== "—") o.instrAt = dispMin_(row[14]);
      if (row[16]) o.note = row[16];
      if (row[17]) o.cast = row[17];
      cfg.overrides[id] = o;
    }
    for (r = r + 1; r < all.length; r++) {
      var a = all[r]; if (!a[1]) continue;
      if (!/^y/i.test(a[5] || "Yes")) continue;
      var purpose = String(a[1]).toLowerCase();
      var start = a[3] && a[3] !== "—" ? hhmm_(dispMin_(a[3])) : "", end = a[4] && a[4] !== "—" ? hhmm_(dispMin_(a[4])) : "";
      if (purpose === "engagement") {
        var parts = String(a[2]).split(/\s+—\s+|\s+-\s+/);
        cfg.extras.push({ id: slug_(parts[0]) + "@" + iso, title: parts[0], category: "Internal", date: iso, start: start, end: end, venue: parts[1] || parts[0], note: a[6] || "" });
      } else {
        var loc = locate_(a[2]); if (!loc) continue;
        (cfg.stops[iso] = cfg.stops[iso] || []).push({ purpose: purpose, name: loc.name, lat: loc.lat, lon: loc.lon, link: /^https?:/.test(a[2]) ? a[2] : "", start: start, end: end, note: a[6] || "" });
      }
    }
  });
  return { ok: true, url: ss.getUrl(), cfg: cfg };
}
// Address / Maps link / "lat, lon" → {name, lat, lon}; geocodes through Maps and remembers the answer.
function locate_(text) {
  text = String(text || "").trim(); if (!text) return null;
  var m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(text) || /[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/.exec(text) || /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/.exec(text);
  var name = "";
  var pm = /\/place\/([^\/@?]+)/.exec(text); if (pm) name = decodeURIComponent(pm[1]).replace(/\+/g, " ");
  if (m) return { name: name || text.slice(0, 40), lat: +m[1], lon: +m[2] };
  var q = name || (/^https?:/.test(text) ? "" : text);
  if (!q) return null;
  var cache = CacheService.getScriptCache(); var hit = cache.get("geo|" + q); if (hit) return JSON.parse(hit);
  var g = geocode_(q + (/bengaluru|bangalore|manipal/i.test(q) ? "" : ", Bengaluru"));
  if (!g.ok) return null;
  var out = { name: name || q, lat: g.lat, lon: g.lon, area: (g.label || "").split(",").slice(1, 3).join(",").trim() };
  cache.put("geo|" + q, JSON.stringify(out), 21600);
  return out;
}
// Planner → sheet (two-way sync). days[iso] = { leave, events:{id:{artists, setup,
// soundcheck, ready, change, after, skip, note, instrAt, instrLeave}},
// addons:[{purpose, location, start, end, include, note}] }; settings =
// { stay, artists, volunteers, storage, lead }. Every value is written as
// the cell's display text (HH:MM for times) so the sheet stays readable.
function writeback_(days, settings) {
  var ss = plannerBook_();
  if (settings) {
    var st = ss.getSheetByName("Settings");
    if (st) {
      var vals = st.getRange(HEADER_ROW + 1, 1, 5, 2).getDisplayValues();
      var put = function (k, v) { for (var i = 0; i < vals.length; i++) if (vals[i][0] === k && v != null && v !== "") st.getRange(HEADER_ROW + 1 + i, 2).setValue(v); };
      // The dropdown must offer whatever the planner writes, so re-set it.
      var stayList = STAYS.slice(); if (settings.stay && stayList.indexOf(settings.stay) === -1) stayList.push(settings.stay);
      st.getRange(HEADER_ROW + 1, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(stayList, true).build());
      put("Place of stay", settings.stay); put("Artists", settings.artists); put("Volunteers travelling", settings.volunteers);
      if (settings.storage) put("Instrument storage", settings.storage);
      if (settings.lead) put("Instruments needed at venue", settings.lead);
    }
  }
  Object.keys(days || {}).forEach(function (iso) {
    var sh = ss.getSheetByName(tabName_(iso)); if (!sh) return;
    var d = days[iso];
    if (d.leave) sh.getRange(2, 1).setValue(dayLabel_(iso) + " | " + d.leave);
    // E2: the vehicle chosen for the day ("Vehicle: auto" = let the planner pick).
    if (d.vehicle != null) sh.getRange(2, 5).setValue("Vehicle: " + (d.vehicle || "auto")).setFontColor("#444444");
    var all = sh.getDataRange().getDisplayValues();
    var r = HEADER_ROW, addonHeader = -1;
    for (; r < all.length; r++) {
      var row = all[r]; if (row[0] === "#" && row[1] === "Purpose") { addonHeader = r; break; }
      var id = row[2] ? slug_(row[2]) + "@" + iso : null;
      var ev = id && d.events && d.events[id]; if (!ev) continue;
      var cells = [
        ev.artists != null ? ev.artists : row[7],
        ev.setup != null ? ev.setup : row[8], ev.soundcheck != null ? ev.soundcheck : row[9], ev.ready != null ? ev.ready : row[10],
        ev.change != null ? ev.change : row[11], ev.after != null ? ev.after : row[12],
        ev.skip != null ? (ev.skip ? "Yes" : "No") : row[13],
        ev.instrAt || row[14], ev.instrLeave || row[15], ev.note != null ? ev.note : row[16],
        ev.cast != null ? ev.cast : (row[17] || ""),
      ];
      sh.getRange(r + 1, 8, 1, 11).setValues([cells]);
    }
    if (addonHeader >= 0 && d.addons) {
      var rows = [];
      for (var i = 0; i < ADDON_ROWS; i++) {
        var x = d.addons[i];
        rows.push(x ? [i + 1, x.purpose || "", x.location || "", x.start || "", x.end || "", x.include === false ? "No" : "Yes", x.note || ""] : [i + 1, "", "", "", "", "Yes", ""]);
      }
      sh.getRange(addonHeader + 2, 1, ADDON_ROWS, ADDON_HEADERS.length).setValues(rows);
    }
  });
  // Re-read now so the next page load finds a warm cache that matches.
  sheetplanCached_(true);
  return { ok: true };
}
