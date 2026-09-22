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
 *   2. Set SHEET_ID below. Tabs are created on first use.
 *   3. Deploy → New deployment → Web app: Execute as *Me*, Who has access
 *      *Anyone*. Copy the /exec URL into CONFIG.LOGISTICS_URL in
 *      plan/engine.js and bump the ?v= on both pages.
 *   4. Later changes: Deploy → Manage deployments → edit → new version.
 *      NEVER create a second deployment (the URL would change).
 *
 * No personal data is handled here: coordinates of public venues and a
 * plan configuration only.
 */

var SHEET_ID = "PASTE_SHEET_ID_HERE";
var CACHE_TAB = "TravelCache";
var PLAN_TAB = "Plan";
var TZ = "Asia/Kolkata";

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    switch (p.action) {
      case "leg": return json_(leg_(p.from, p.to, p.depart));
      case "geocode": return json_(geocode_(p.q));
      case "load": return json_({ ok: true, cfg: loadPlan_() });
      default: return json_({ ok: true, service: "bali-logistics", actions: ["leg", "geocode", "load", "save"] });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.action === "save") { savePlan_(body.cfg || {}); return json_({ ok: true }); }
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
function cacheGet_(key, ttlMs) {
  var hit = CacheService.getScriptCache().get(key);
  if (hit) { var h = JSON.parse(hit); if (Date.now() - h.at < ttlMs) return h; }
  var sh = tab_(CACHE_TAB, ["key", "minutes", "km", "fetched"]);
  var data = sh.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === key && Date.now() - new Date(data[i][3]).getTime() < ttlMs) {
      var v = { minutes: +data[i][1], km: +data[i][2], at: new Date(data[i][3]).getTime() };
      CacheService.getScriptCache().put(key, JSON.stringify(v), Math.min(21600, Math.max(60, Math.floor(ttlMs / 1000))));
      return v;
    }
  }
  return null;
}
function cachePut_(key, v, ttlMs) {
  var rec = { minutes: v.minutes, km: v.km, at: Date.now() };
  CacheService.getScriptCache().put(key, JSON.stringify(rec), Math.min(21600, Math.max(60, Math.floor(ttlMs / 1000))));
  tab_(CACHE_TAB, ["key", "minutes", "km", "fetched"]).appendRow([key, v.minutes, v.km, new Date()]);
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
function tab_(name, header) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(header); sh.setFrozenRows(1); }
  return sh;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
