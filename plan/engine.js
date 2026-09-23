/* ============================================================
   Logistics engine — Bali in Bengaluru artist tour planner.

   Shared by /admin/logistics.html (the planner) and /plan/ (the read-only
   public page). Pure vanilla JS, no dependencies.

   What it does
   - Reads the festival schedule live (same Event List feed as the site).
   - Resolves each venue to a position (data/venues.json + live overrides).
   - Computes travel time for every leg with a pluggable provider:
       haversine  — no network: road-factored straight line at city speed
       osrm       — free-flow road routing (router.project-osrm.org, no key)
       bridge     — Google Maps with live/predicted traffic through the
                    Apps Script backend (docs/apps-script/Logistics.gs)
     Free-flow times are shaped by an hour-of-day Bengaluru traffic profile;
     the bridge provider replaces that with real traffic per departure time.
   - Builds each day: wake → breakfast → prep → leave stay → (legs, shows,
     holds, meals) → back → dinner → sleep. Broad before breakfast and
     after dinner, detailed in between. Decides whether to return to the
     stay between shows or hold in town.
   - Plans the whole tour for one stay, and compares any number of stays.

   Everything is synchronous once a distance matrix is loaded, so the UI
   can re-plan on every keystroke. Live-traffic refinement is an async pass
   that fills a leg cache and then re-plans.
   ============================================================ */
(function (global) {
  "use strict";

  const PUB =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTji37D6cT7J9bLFptJdNaYrvZF_soZyiqIsX-rHYUj4H6rnfMCExu2hIyVjCk48j86rdaBhp_lthzb/pub?single=true&output=tsv";
  const BRIDGE =
    "https://script.google.com/macros/s/AKfycbyKXzPHQLsHCoryx0aJVpVkP0Z0XrnPxjucaiUJtR1aXeux33ygq2Br2QcBNU_MAB7qDw/exec";

  const CONFIG = {
    SCHEDULE: [PUB + "&gid=289612903", BRIDGE + "?feed=schedule"],
    VENUES: "../data/venues.json",
    DEFAULTS: "../data/logistics.json",
    // The logistics web app (Logistics.gs). Empty until deployed; the
    // planner then falls back to OSRM + the traffic profile.
    LOGISTICS_URL: "https://script.google.com/macros/s/AKfycbytjLT1kfJIMnsFKQPm_ydoWQAGw7art807TKDe6d4NtnRztKppfgonpxJNpCdLwIPVWA/exec",
    OSRM: "https://router.project-osrm.org",
    ROAD_FACTOR: 1.35,     // straight line → road distance, Bengaluru
    CITY_KMH: 27,          // free-flow-ish average for a tempo traveller
    CITY_MIN_CAP: 75,      // traffic multiplier applies to the first N min of a leg
  };

  /* ---------- small helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function slug(s) { return norm(s).replace(/ /g, "-"); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function hm(min) {
    if (min == null || !isFinite(min)) return "—";
    let m = Math.round(min); let d = "";
    if (m >= 1440) { m -= 1440; d = " (+1)"; }
    if (m < 0) { m += 1440; d = " (−1)"; }
    const h = Math.floor(m / 60), mm = m % 60;
    const ap = h < 12 ? "am" : "pm";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + "." + pad(mm) + ap + d;
  }
  function dur(min) {
    if (min == null || !isFinite(min)) return "—";
    const m = Math.round(min);
    if (m < 60) return m + " min";
    const h = Math.floor(m / 60), r = m % 60;
    return h + " h" + (r ? " " + pad(r) : "");
  }
  function toMin(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
    return m ? +m[1] * 60 + +m[2] : null;
  }
  function parseClock(s) {
    // "6.00pm", "10.00am", "7pm", "18:30", "11.00 am"
    const m = /(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)?/i.exec(String(s || "").trim());
    if (!m) return null;
    let h = +m[1]; const mm = m[2] ? +m[2] : 0; const ap = (m[3] || "").toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (!ap && h < 8) h += 12; // "7" with no am/pm is an evening show
    return h * 60 + mm;
  }
  function parseClockList(s) {
    // "3.30pm and 7.30pm" → [930, 1170]
    return String(s || "").split(/\s*(?:and|&|,|\/|\+)\s*/i).map(parseClock).filter(function (v) { return v != null; });
  }
  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  function parseDate(s) {
    s = String(s || "").trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return s.slice(0, 10);
    m = /^(\d{1,2})\s+([a-z]+)\.?\s+(\d{2,4})/i.exec(s);
    if (m && MONTHS[m[2].toLowerCase().slice(0, 4)] != null) {
      let y = +m[3]; if (y < 100) y += 2000;
      return y + "-" + pad(MONTHS[m[2].toLowerCase().slice(0, 4)] + 1) + "-" + pad(+m[1]);
    }
    m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(s);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return y + "-" + pad(+m[2]) + "-" + pad(+m[1]); }
    return "";
  }
  function addDays(iso, n) {
    const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function dayOfWeek(iso) { return new Date(iso + "T00:00:00Z").getUTCDay(); }
  function dateLabel(iso, long) {
    const d = new Date(iso + "T00:00:00Z");
    const opts = long ? { weekday: "long", day: "numeric", month: "short", year: "numeric" } : { weekday: "short", day: "numeric", month: "short" };
    return d.toLocaleDateString("en-IN", Object.assign({ timeZone: "UTC" }, opts));
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function deepMerge(a, b) {
    const out = clone(a || {});
    Object.keys(b || {}).forEach(function (k) {
      if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) out[k] = deepMerge(out[k], b[k]);
      else out[k] = clone(b[k]);
    });
    return out;
  }

  /* ---------- fetching ---------- */
  async function fetchText(url, ms) {
    const ctrl = new AbortController();
    const t = setTimeout(function () { ctrl.abort(); }, ms || 9000);
    try {
      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } finally { clearTimeout(t); }
  }
  async function firstOk(urls) {
    for (const u of urls) { try { const t = await fetchText(u); if (t && t.trim()) return t; } catch (e) { /* next */ } }
    return "";
  }
  async function fetchJSON(url, ms) { return JSON.parse(await fetchText(url, ms)); }

  /* ---------- schedule ---------- */
  function rowsOf(tsv) { return String(tsv || "").replace(/\r/g, "").split("\n").map(function (l) { return l.split("\t"); }); }
  function keyedRows(tsv, need) {
    const rows = rowsOf(tsv);
    const at = rows.findIndex(function (cells) {
      const have = cells.map(function (c) { return String(c).trim().toLowerCase(); });
      return need.every(function (n) { return have.indexOf(n) !== -1; });
    });
    if (at < 0) return [];
    const header = rows[at].map(function (c) { return String(c).trim().toLowerCase(); });
    const out = [];
    for (let i = at + 1; i < rows.length; i++) {
      const cells = rows[i];
      if (!cells.some(function (c) { return String(c).trim(); })) continue;
      const o = {};
      header.forEach(function (h, j) { if (h) o[h] = String(cells[j] == null ? "" : cells[j]).trim(); });
      out.push(o);
    }
    return out;
  }
  // One entry per calendar day (multi-day workshops expand). Shape:
  // {id, title, category, date, start, end, shows[], venue, status, notPublic, note}
  function parseSchedule(tsv, buffers) {
    const rows = keyedRows(tsv, ["title"]).filter(function (r) { return r.title; });
    const out = [];
    rows.forEach(function (r) {
      const d0 = parseDate(r["start date"] || r.date);
      if (!d0) return;
      const d1 = parseDate(r["end date"]) || d0;
      const cat = r.category || "";
      const b = (buffers && (buffers[cat] || buffers.default)) || { defaultDuration: 120 };
      const starts = parseClockList(r["start time"] || r.time);
      const ends = parseClockList(r["end time"]);
      const status = (r.status || "").toLowerCase();
      const notPublic = /^(internal|private|invite|invite only|invitation|invitation only|closed|not public|not open|no button)$/.test(status);
      const baseId = slug(r.title);
      let d = d0; let guard = 0;
      while (d <= d1 && guard++ < 31) {
        const shows = starts.length ? starts.map(function (s, i) {
          const e = ends[i] != null ? ends[i] : (ends.length === 1 && starts.length === 1 ? ends[0] : s + b.defaultDuration);
          return { start: s, end: e > s ? e : s + b.defaultDuration };
        }) : [];
        out.push({
          id: baseId + "@" + d,
          title: r.title.trim(),
          category: cat,
          date: d,
          start: shows.length ? shows[0].start : null,
          end: shows.length ? shows[shows.length - 1].end : null,
          shows: shows,
          timeText: (r["start time"] || "") + (r["end time"] ? " – " + r["end time"] : ""),
          venue: r.venue || "",
          mapLink: r["map link"] || "",
          status: r.status || "",
          notPublic: notPublic,
          collaboration: /^y/i.test(r.collaboration || ""),
          multiDay: d1 !== d0,
        });
        d = addDays(d, 1);
      }
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.start || 0) - (b.start || 0); });
    return out;
  }

  /* ---------- venues ---------- */
  function VenueBook(list) {
    const items = (list || []).map(function (v) { return clone(v); });
    const index = {};
    items.forEach(function (v) {
      index[norm(v.key || v.name)] = v;
      (v.aliases || []).forEach(function (a) { index[norm(a)] = v; });
    });
    this.items = items; this.index = index;
  }
  VenueBook.prototype.resolve = function (name) {
    const n = norm(name);
    if (!n) return null;
    if (this.index[n]) return this.index[n];
    // Loose matches: "Studio 1, PCPA" → pcpa; "Dathu" → dhaatu via alias; otherwise contains.
    const keys = Object.keys(this.index);
    for (let i = 0; i < keys.length; i++) if (n.indexOf(keys[i]) !== -1 || keys[i].indexOf(n) !== -1) return this.index[keys[i]];
    return null;
  };
  VenueBook.prototype.upsert = function (v) {
    const k = norm(v.key || v.name);
    const cur = this.index[k];
    if (cur) Object.assign(cur, v); else { this.items.push(v); this.index[k] = v; }
    (v.aliases || []).forEach(function (a) { this.index[norm(a)] = this.index[k]; }, this);
  };

  /* ---------- travel providers ---------- */
  function haversineKm(a, b) {
    const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function pkey(p) { return (+p.lat).toFixed(5) + "," + (+p.lon).toFixed(5); }

  const providers = {
    haversine: {
      label: "Straight-line estimate",
      live: false,
      async matrix(points) {
        const n = points.length, dur = [], dist = [];
        for (let i = 0; i < n; i++) {
          dur[i] = []; dist[i] = [];
          for (let j = 0; j < n; j++) {
            const km = i === j ? 0 : haversineKm(points[i], points[j]) * CONFIG.ROAD_FACTOR;
            dist[i][j] = km; dur[i][j] = km / CONFIG.CITY_KMH * 60;
          }
        }
        return { dur: dur, dist: dist, source: "haversine" };
      },
    },
    osrm: {
      label: "Road routing (OSRM) + Bengaluru traffic profile",
      live: false,
      async matrix(points) {
        const coords = points.map(function (p) { return (+p.lon).toFixed(6) + "," + (+p.lat).toFixed(6); }).join(";");
        const url = CONFIG.OSRM + "/table/v1/driving/" + coords + "?annotations=duration,distance";
        const r = await fetchJSON(url);
        if (r.code !== "Ok") throw new Error("OSRM " + r.code);
        return {
          dur: r.durations.map(function (row) { return row.map(function (s) { return s == null ? null : s / 60; }); }),
          dist: r.distances.map(function (row) { return row.map(function (m) { return m == null ? null : m / 1000; }); }),
          source: "osrm",
        };
      },
    },
    bridge: {
      label: "Google Maps, live/predicted traffic (via Apps Script)",
      live: true,
      // Free-flow matrix still comes from OSRM (cheap); the bridge is used
      // per leg with a departure time, which is what traffic needs.
      async matrix(points) { return providers.osrm.matrix(points); },
      async leg(from, to, departISO) {
        if (!CONFIG.LOGISTICS_URL) throw new Error("No logistics web app configured");
        const url = CONFIG.LOGISTICS_URL + "?action=leg&from=" + encodeURIComponent(from.lat + "," + from.lon) +
          "&to=" + encodeURIComponent(to.lat + "," + to.lon) + "&depart=" + encodeURIComponent(departISO);
        // Apps Script now and then answers a request with an HTML
        // interstitial instead of JSON (more so under parallel load): retry.
        let r = null;
        for (let attempt = 0; attempt < 4 && !r; attempt++) {
          try { r = await fetchJSON(url, 15000); }
          catch (e) { if (attempt === 3) throw e; await new Promise(function (res) { setTimeout(res, 400 * (attempt + 1)); }); }
        }
        if (!r.ok) throw new Error(r.error || "bridge");
        return { min: r.minutes, km: r.km, source: "google-traffic", mode: r.mode || "typical" };
      },
    },
  };

  /* ---------- planning context: points, matrix, caches ---------- */
  function Ctx(cfg, venues) {
    this.cfg = cfg; this.venues = venues;
    this.points = []; this.pindex = {}; this.matrix = null;
    this.legCache = {}; // "a|b|date|bucket" → {min, km, source}
    this.warnings = [];
  }
  Ctx.prototype.point = function (p) {
    if (!p || p.lat == null || p.lon == null) return -1;
    const k = pkey(p);
    if (this.pindex[k] == null) { this.pindex[k] = this.points.length; this.points.push({ lat: +p.lat, lon: +p.lon, key: k }); }
    return this.pindex[k];
  };
  Ctx.prototype.ensureMatrix = async function () {
    if (this.matrix && this.matrix.n === this.points.length) return this.matrix;
    const name = providers[this.cfg.provider] ? this.cfg.provider : "osrm";
    let m;
    try { m = await providers[name].matrix(this.points); }
    catch (e) { this.warnings.push("Routing service unavailable (" + e.message + "); using straight-line estimate."); m = await providers.haversine.matrix(this.points); }
    m.n = this.points.length; this.matrix = m; return m;
  };
  Ctx.prototype.multiplier = function (dateISO, departMin) {
    const t = this.cfg.traffic || {};
    const dow = dayOfWeek(dateISO);
    const arr = (dow === 0 || dow === 6) ? (t.weekend || t.weekday) : t.weekday;
    const h = Math.max(0, Math.min(23, Math.floor(((departMin % 1440) + 1440) % 1440 / 60)));
    return (arr && arr[h] != null ? arr[h] : 1.4) * (t.safety || 1);
  };
  // Travel from point index a to b, leaving at departMin on dateISO. Sync.
  Ctx.prototype.travel = function (a, b, dateISO, departMin) {
    if (a < 0 || b < 0 || !this.matrix) return { min: null, km: null, source: "unknown" };
    if (a === b) return { min: 0, km: 0, source: "same" };
    const bucket = Math.floor(departMin / 15);
    const ck = this.points[a].key + "|" + this.points[b].key + "|" + dateISO + "|" + bucket;
    if (this.legCache[ck]) return this.legCache[ck];
    let base = this.matrix.dur[a] && this.matrix.dur[a][b], km = this.matrix.dist[a] && this.matrix.dist[a][b];
    let src = this.matrix.source;
    if (base == null) {
      // Point added after the matrix was built (a meal stop dropped in
      // just now): estimate until the next full rebuild.
      km = haversineKm(this.points[a], this.points[b]) * CONFIG.ROAD_FACTOR; base = km / CONFIG.CITY_KMH * 60; src = "estimate";
    }
    const mult = this.multiplier(dateISO, departMin);
    // Congestion is a city phenomenon: it stretches the first CITY_MIN_CAP
    // minutes of a leg, not a four-hour highway run to Manipal.
    const cityPart = Math.min(base, CONFIG.CITY_MIN_CAP);
    return { min: base + cityPart * (mult - 1), km: km, source: src + "+profile", mult: mult };
  };

  /* ---------- the day planner ---------- */
  // Segments before a show: setup (instruments, stage), sound check, ready
  // (costume, warm-up, call). Older configs carried one "before" number.
  function bufFor(cfg, ev) {
    const b = (cfg.buffers[ev.category] || cfg.buffers.default || {});
    const o = (cfg.overrides || {})[ev.id] || {};
    const pick = function (k, d) { return o[k] != null ? +o[k] : (b[k] != null ? +b[k] : d); };
    let setup = pick("setup", null), soundcheck = pick("soundcheck", null), ready = pick("ready", null);
    if (setup == null && soundcheck == null && ready == null) {
      const before = o.before != null ? +o.before : (b.before || 60);
      setup = Math.round(before * 0.3); soundcheck = Math.round(before * 0.3); ready = before - setup - soundcheck;
    }
    setup = setup || 0; soundcheck = soundcheck || 0; ready = ready || 0;
    return {
      setup: setup, soundcheck: soundcheck, ready: ready,
      before: setup + soundcheck + ready,
      change: pick("change", ev.category === "Performance" ? 30 : 10),
      after: o.after != null ? +o.after : (b.after || 30),
      skip: !!o.skip,
      // Set-up 0 = nothing to bring: the instrument vehicle stays away
      // (talks, mask making…). Any "instruments at" time is then ignored.
      truck: setup > 0,
      note: o.note || "",
      artists: o.artists != null && o.artists !== "" ? +o.artists : (b.artists != null ? +b.artists : null),
      cast: o.cast || "",
      start: o.start != null ? +o.start : ev.start,
      end: o.end != null ? +o.end : ev.end,
    };
  }
  // A red flag is something that cannot work as scheduled; plain flags are
  // notes. Rendered as {level, text} — strings stay plain notes.
  function red(day, text) { day.flags.push({ level: "red", text: text }); day.red = true; }
  function block(type, from, to, label, extra) {
    return Object.assign({ type: type, from: from, to: to, label: label }, extra || {});
  }

  // Plans one date. `events` are that day's events (already filtered).
  // Returns {date, kind, blocks[], legs[], leave, back, wake, sleep, travelMin, km, flags[]}.
  // A flight before 06:00 is planned on the evening before.
  function departureDay(tv) {
    const dep = tv && tv.departure; if (!dep || !parseDate(dep.date)) return null;
    const m = toMin(dep.time); return m != null && m < 360 ? addDays(parseDate(dep.date), -1) : parseDate(dep.date);
  }
  // Arrival day (land → stay) and departure day (stay → airport for the
  // flight). Only when the day has no programme; otherwise the flight is
  // flagged on the show day for a human to fit.
  function flightBlocks(ctx, dateISO, stay, stayIdx, day, evs) {
    const cfg = ctx.cfg, D = cfg.day, tv = cfg.travel || {};
    const arr = tv.arrival, dep = tv.departure;
    const isArr = arr && parseDate(arr.date) === dateISO, isDep = departureDay(tv) === dateISO;
    if (!isArr && !isDep) return null;
    if (evs.length) { day.flags.push(isArr ? "The company lands today at " + hm(toMin(arr.time)) + " — the programme below assumes they are already here." : "The flight home is tonight/tomorrow at " + hm(toMin(dep.time)) + " — leave time for the airport after the programme."); return null; }
    const port = ctx.venues.resolve((isArr ? arr : dep).place);
    const portIdx = port ? ctx.point(port) : -1;
    const portName = port ? port.name : ((isArr ? arr : dep).place || "the airport");
    const T = day.blocks;
    if (isArr) {
      day.kind = "arrival";
      const land = toMin(arr.time) || 900, buf = arr.landingBuffer != null ? +arr.landingBuffer : 75;
      T.push(block("show", land, land + buf, "Land at " + portName, { detail: (arr.note || "The company arrives") + " · immigration, baggage, meet the team" }));
      const tr = ctx.travel(portIdx, stayIdx, dateISO, land + buf);
      const home = land + buf + (tr.min == null ? 60 : tr.min);
      T.push(block("leg", land + buf, home, "Leave " + portName + " for the stay", { travel: tr, detail: legDetail(tr, D.loadOut || 0), dest: "the stay" }));
      day.legs.push({ from: portName, to: "the stay", depart: land + buf, arrive: home, travel: tr });
      if (tr.min != null) { day.travelMin += tr.min; day.km += tr.km || 0; }
      T.push(block("free", home, home + 90, "Check in at the stay, settle in", { note: "Rooms, luggage, a first briefing." }));
      const dinnerAt = Math.max(home + 90, toMin(D.dinnerWindow[0]) + 30);
      T.push(block("meal", dinnerAt, dinnerAt + D.dinner, "Dinner at the stay", { meal: "dinner", at: "the stay" }));
      T.push(block("sleep", dinnerAt + D.dinner + D.windDown, null, "Lights out", { broad: true }));
      day.wake = land; day.leave = null; day.back = home; day.sleep = dinnerAt + D.dinner + D.windDown; day.travelling = (cfg.party && cfg.party.artists) || 0;
      applyMealPlan(cfg, dateISO, day);
      return day;
    }
    day.kind = "departure";
    let flight = toMin(dep.time) || 0; if (parseDate(dep.date) !== dateISO) flight += 1440;
    const lead = dep.checkInLead != null ? +dep.checkInLead : 180;
    const atPort = flight - lead;
    let leave = atPort - 60, tr = null;
    for (let i = 0; i < 6; i++) { tr = ctx.travel(stayIdx, portIdx, dateISO, leave); const arrive = leave + (tr.min == null ? 60 : tr.min) + (D.loadOut || 0); if (arrive <= atPort + 0.5) break; leave -= (arrive - atPort); }
    const wake = toMin(D.restDayWake) || 480;
    T.push(block("wake", wake, wake + D.wake, "Wake up", { broad: true }));
    T.push(block("meal", wake + D.wake, wake + D.wake + D.breakfast, "Breakfast at the stay", { broad: true, meal: "breakfast", at: "the stay" }));
    const lunchAt = toMin(D.lunchWindow[0]) + 30;
    T.push(block("free", wake + D.wake + D.breakfast, lunchAt, "Pack, settle up, rest", { note: "Last day at the stay." }));
    T.push(block("meal", lunchAt, lunchAt + D.lunch, "Lunch at the stay", { meal: "lunch", at: "the stay" }));
    const dinnerAt = Math.min(toMin(D.dinnerWindow[0]) + 30, leave - D.dinner - (D.loadOut || 0) - 15);
    T.push(block("free", lunchAt + D.lunch, dinnerAt, "Free at the stay"));
    T.push(block("meal", dinnerAt, dinnerAt + D.dinner, "Dinner at the stay", { meal: "dinner", at: "the stay" }));
    T.push(block("prep", leave - (D.loadOut || 0), leave, "Load luggage into the vehicles", {}));
    const arrivePort = leave + (tr.min == null ? 60 : tr.min);
    T.push(block("leg", leave, arrivePort, "Leave the stay for " + portName, { travel: tr, detail: legDetail(tr, 0), dest: portName }));
    day.legs.push({ from: "the stay", to: portName, depart: leave, arrive: arrivePort, travel: tr });
    if (tr.min != null) { day.travelMin += tr.min; day.km += tr.km || 0; }
    T.push(block("free", arrivePort, flight, "Check-in, immigration, security", { note: lead + " min before the flight." }));
    T.push(block("show", flight, null, "Flight departs " + hm(flight), { detail: "from " + portName }));
    day.wake = wake; day.leave = leave; day.back = null; day.sleep = null; day.flight = flight; day.travelling = (cfg.party && cfg.party.artists) || 0;
    applyMealPlan(cfg, dateISO, day);
    return day;
  }

  function planDay(ctx, dateISO, events, stay, prev) {
    const cfg = ctx.cfg, D = cfg.day;
    const stayIdx = ctx.point(stay);
    const day = { date: dateISO, stay: stay, blocks: [], legs: [], flags: [], travelMin: 0, km: 0, events: [] };
    const stops = dayStops(cfg, dateISO, ctx);
    const evs = events.map(function (ev) { return { ev: ev, b: bufFor(cfg, ev), venue: ctx.venues.resolve(ev.venue) }; })
      .filter(function (x) { return !x.b.skip; });
    evs.forEach(function (x) {
      if (!x.venue) { day.flags.push("No position for venue “" + x.ev.venue + "” — add it in the venue list."); }
      x.idx = x.venue ? ctx.point(x.venue) : -1;
      const defLen = (cfg.buffers[x.ev.category] || cfg.buffers.default || {}).defaultDuration || 120;
      if (x.b.start == null && x.venue && x.venue.outstation) {
        // No time and far away: the programme fills the day there.
        x.b.start = 600; x.b.end = x.b.start + Math.max(defLen, 360);
        day.flags.push("“" + x.ev.title + "” has no time in the sheet; assumed a day programme from " + hm(x.b.start) + ".");
      } else if (x.b.start == null) {
        day.flags.push("“" + x.ev.title + "” has no start time in the sheet; assumed " + hm(1080) + ".");
        x.b.start = 1080; x.b.end = x.b.start + defLen;
      }
      if (x.b.end == null || x.b.end <= x.b.start) x.b.end = x.b.start + defLen;
    });
    evs.sort(function (a, b) { return a.b.start - b.b.start; });
    day.events = evs.map(function (x) { return x.ev; });
    // Who travels today: the largest cast any event needs (others rest at the stay).
    const partyArtists = (cfg.party && cfg.party.artists) || 0;
    const needs = evs.map(function (x) { return x.b.artists != null ? x.b.artists : partyArtists; });
    day.travelling = evs.length ? Math.max.apply(null, needs) : 0;
    if (evs.length && partyArtists && day.travelling < partyArtists) day.flags.push(day.travelling + " of " + partyArtists + " artists travel today; " + (partyArtists - day.travelling) + " stay at the stay.");
    if (evs.length && partyArtists && day.travelling > partyArtists) day.flags.push("An event today lists " + day.travelling + " artists but the group has " + partyArtists + ".");
    // People who join the company today (local artists for a joint show).
    const jn = (cfg.joiners || {})[dateISO];
    if (jn && jn.count) {
      day.joiners = jn;
      if (jn.travel) { day.travelling += jn.count; day.flags.push(jn.count + " " + jn.label + " travel with the group today — " + day.travelling + " in the vehicles."); }
      else day.flags.push(jn.count + " " + jn.label + " perform with the group today and travel on their own.");
    }
    const flightDay = flightBlocks(ctx, dateISO, stay, stayIdx, day, evs);
    if (flightDay) return flightDay;
    placeStops(ctx, evs, stops, stayIdx, dateISO, D, day);
    if (!day.events.length) day.mealsOnly = true;

    if (!evs.length && !stops.length) {
      const wake = toMin(D.restDayWake) || 480;
      day.kind = "rest";
      day.blocks.push(block("wake", wake, wake + D.wake, "Wake up", { broad: true }));
      day.blocks.push(block("meal", wake + D.wake, wake + D.wake + D.breakfast, "Breakfast at the stay", { broad: true, meal: "breakfast", at: "the stay" }));
      const dinnerAt = toMin(D.dinnerWindow[0]) + 30;
      const lunchAt = toMin(D.lunchWindow[0]) + 30;
      day.blocks.push(block("free", wake + D.wake + D.breakfast, lunchAt, "Rest day — no programme", { note: "Rehearsal, rest or a city visit can be pencilled here." }));
      day.blocks.push(block("meal", lunchAt, lunchAt + D.lunch, "Lunch at the stay", { meal: "lunch", at: "the stay" }));
      day.blocks.push(block("free", lunchAt + D.lunch, dinnerAt, "Free at the stay"));
      day.blocks.push(block("meal", dinnerAt, dinnerAt + D.dinner, "Dinner at the stay", { meal: "dinner", at: "the stay" }));
      day.blocks.push(block("sleep", dinnerAt + D.dinner + D.windDown, null, "Lights out", { broad: true }));
      day.wake = wake; day.sleep = dinnerAt + D.dinner + D.windDown;
      applyMealPlan(cfg, dateISO, day);
      return day;
    }

    if (evs.some(function (x) { return x.venue && x.venue.outstation; })) return planOutstationDay(ctx, dateISO, evs, stay, day, stayIdx, prev);
    day.kind = "show";
    const timeline = [];
    let here = stayIdx, hereLabel = "the stay";
    let leaveStay = null;

    // First leg: two passes so the departure hour used for traffic is the
    // one we actually leave at.
    // Latest departure that still arrives by mustArrive (two passes so the
    // traffic hour matches the real departure). If we cannot leave before
    // `notBefore` (still wrapping the previous show) we leave then and
    // arrive late — the caller flags the lost buffer.
    function legTo(x, mustArrive, notBefore) {
      let depart = mustArrive - 45, tr = null, arrive = null;
      // Walk the departure back until leaving at that time (priced at that
      // time — traffic changes by the quarter hour) really arrives by
      // mustArrive, unless the previous event holds us (notBefore).
      for (let pass = 0; pass < 8; pass++) {
        if (notBefore != null && depart < notBefore) depart = notBefore;
        tr = ctx.travel(here, x.idx, dateISO, depart);
        arrive = depart + (tr.min == null ? 45 : tr.min);
        if (arrive <= mustArrive + 0.5 || (notBefore != null && depart <= notBefore)) break;
        depart -= (arrive - mustArrive);
      }
      return { depart: depart, arrive: arrive, travel: tr };
    }

    let notBefore = null; // earliest we can leave the current location
    for (let i = 0; i < evs.length; i++) {
      const x = evs[i];
      const wanted = x.b.start - x.b.before;
      const leg = legTo(x, wanted, notBefore);
      if (x.meal && leg.arrive > x.b.start) { x.b.end += leg.arrive - x.b.start; x.b.start = leg.arrive; }
      const arrive = Math.min(leg.arrive, x.b.start);
      const fromStay = here === stayIdx;
      const depart = leg.depart - (fromStay && notBefore == null ? D.loadOut : 0);
      if (i === 0) leaveStay = depart;
      timeline.push(block("leg", depart, leg.arrive, "Leave " + hereLabel + " for " + (x.venue ? x.venue.name : x.ev.venue), {
        travel: leg.travel, loadOut: fromStay ? D.loadOut : 0, dest: x.venue, detail: legDetail(leg.travel, fromStay && notBefore == null ? D.loadOut : 0),
      }));
      day.legs.push({ from: hereLabel, to: x.venue ? x.venue.name : x.ev.venue, depart: depart, travelDepart: leg.depart, arrive: leg.arrive, travel: leg.travel });
      if (leg.travel.min != null) { day.travelMin += leg.travel.min; day.km += leg.travel.km || 0; }
      if (!x.meal && leg.arrive > x.b.start) red(day, "“" + x.ev.title + "” cannot be reached before it starts: arrival " + hm(leg.arrive) + ".");
      else if (!x.meal && leg.arrive > wanted + 5) {
        const lost = leg.arrive - wanted;
        const costumeLeft = Math.max(0, x.b.ready - Math.max(0, lost - 0));
        const msg = "“" + x.ev.title + "”: arrives " + hm(arrive) + ", " + dur(lost) + " late for the " + x.b.before + " min preparation.";
        if (lost >= x.b.ready + x.b.soundcheck) red(day, msg + " No sound check or costume time.");
        else if (lost >= x.b.ready) red(day, msg + " No costume / make-up time.");
        else if (costumeLeft < x.b.ready / 2) red(day, msg + " Costume / make-up cut to " + Math.round(costumeLeft) + " min.");
        else day.flags.push(msg);
      }
      if (!x.meal) truckFor(ctx, day, timeline, x, arrive, dateISO);
      if (x.meal) {
        // A meal out: no venue buffers, the meal itself, then move on.
        if (x.b.start > arrive + 5) timeline.push(block("hold", arrive, x.b.start, "Arrive early at " + x.venue.name, { inTown: true }));
        const isMeal = /^(breakfast|lunch|dinner)$/.test(x.meal);
        timeline.push(block(isMeal ? "meal" : "visit", x.b.start, x.b.end, x.stopLabel, { stop: x.venue, meal: isMeal ? x.meal : undefined, at: x.venue.name, out: true }));
      } else {
        pushPrep(timeline, arrive, x);
        x.ev.shows.length > 1
          ? x.ev.shows.forEach(function (s, k) { timeline.push(block("show", s.start, s.end, x.ev.title + " — show " + (k + 1), { ev: x.ev, venue: x.venue, showIndex: k, artists: x.b.artists, cast: x.b.cast })); })
          : timeline.push(block("show", x.b.start, x.b.end, x.ev.title, { ev: x.ev, venue: x.venue, artists: x.b.artists, cast: x.b.cast }));
      }
      const freeAt = x.b.end + (x.meal ? 0 : x.b.change) + x.b.after;
      if (!x.meal) { pushWrap(timeline, x); truckBack(ctx, day, timeline, x, freeAt, dateISO); }
      here = x.idx; hereLabel = x.venue ? x.venue.name : x.ev.venue;
      notBefore = freeAt;

      // Gap to the next event: go back to the stay, or hold in town?
      if (i + 1 < evs.length) {
        const nx = evs[i + 1];
        const nxArrive = nx.b.start - nx.b.before;
        const back = ctx.travel(here, stayIdx, dateISO, freeAt);
        const outAgain = ctx.travel(stayIdx, nx.idx, dateISO, nxArrive - 60);
        const onward = ctx.travel(here, nx.idx, dateISO, freeAt);
        const gap = nxArrive - freeAt;
        const roundTrip = (back.min || 45) + (outAgain.min || 45) + D.loadOut;
        if (gap >= (D.returnThresholdMin || 240) && gap - roundTrip >= 90) {
          const home = freeAt + (back.min || 45);
          timeline.push(block("leg", freeAt, home, "Back to the stay", { travel: back, detail: legDetail(back, 0) }));
          day.legs.push({ from: hereLabel, to: "the stay", depart: freeAt, arrive: home, travel: back });
          if (back.min != null) { day.travelMin += back.min; day.km += back.km || 0; }
          const leaveAgain = nxArrive - (outAgain.min || 45);
          timeline.push(block("hold", home, leaveAgain - D.loadOut, "At the stay — rest" + mealHint(home, leaveAgain - D.loadOut, D), { atStay: true }));
          here = stayIdx; hereLabel = "the stay"; notBefore = null;
        } else {
          const onward2 = nx.idx === here ? { min: 0 } : ctx.travel(here, nx.idx, dateISO, nxArrive - (onward.min || 45));
          const slack = gap - (nx.idx === here ? 0 : (onward2.min || 45));
          if (slack >= 10) timeline.push(block("hold", freeAt, freeAt + slack, (nx.idx === here ? "Hold at " : "Hold in town near ") + hereLabel + mealHint(freeAt, freeAt + slack, D), { inTown: true, gap: slack }));
          if (slack >= 10) notBefore = freeAt + slack;
        }
      }
    }

    // Home run.
    const last = evs[evs.length - 1];
    const freeAt = last.b.end + (last.meal ? 0 : last.b.change) + last.b.after;
    day.lastFreeAt = freeAt; day.lastIdx = here; day.lastLabel = hereLabel;
    let departHome = freeAt;
    const dinnerOpen = toMin(D.dinnerWindow[0]), dinnerClose = toMin(D.dinnerWindow[1]);
    let backLeg = ctx.travel(here, stayIdx, dateISO, departHome);
    let home = departHome + (backLeg.min == null ? 45 : backLeg.min);
    let dinnerBlock = null;
    if (day.dinnerOut) { /* dinner already taken at the chosen place */ }
    else if (home + 10 > dinnerClose) {
      // Too late to eat at the stay: dinner near the venue before the drive.
      dinnerBlock = block("meal", departHome, departHome + D.dinner, "Dinner near " + hereLabel + " (late return)", { meal: "dinner", at: "near " + hereLabel });
      departHome += D.dinner;
      backLeg = ctx.travel(here, stayIdx, dateISO, departHome);
      home = departHome + (backLeg.min == null ? 45 : backLeg.min);
      timeline.push(dinnerBlock);
    }
    timeline.push(block("leg", departHome, home, "Return to the stay", { travel: backLeg, detail: legDetail(backLeg, 0) }));
    day.legs.push({ from: hereLabel, to: "the stay", depart: departHome, arrive: home, travel: backLeg });
    if (backLeg.min != null) { day.travelMin += backLeg.min; day.km += backLeg.km || 0; }
    let sleepAt;
    if (day.dinnerOut) sleepAt = home + D.loadIn + D.windDown;
    else if (!dinnerBlock) {
      const dAt = Math.max(home + D.loadIn, dinnerOpen);
      timeline.push(block("meal", dAt, dAt + D.dinner, "Dinner at the stay", { broad: dAt > home + 30, meal: "dinner", at: "the stay" }));
      sleepAt = dAt + D.dinner + D.windDown;
    } else sleepAt = home + D.loadIn + D.windDown;
    timeline.push(block("sleep", sleepAt, null, "Lights out", { broad: true }));

    // Morning, walked back from the first departure.
    const prepStart = leaveStay - D.prep;
    const normalWake = toMin(D.restDayWake) || 480;
    const bfLen = day.breakfastOut ? 0 : D.breakfast;
    let bfStart = prepStart - bfLen;
    let wake = bfStart - D.wake;
    const morning = [];
    const lo = toMin(D.lunchWindow[0]), lc = toMin(D.lunchWindow[1]);
    if (wake > normalWake) {
      // A late departure does not mean a late morning: wake at the usual
      // hour and show the free time, with lunch at the stay if it fits.
      wake = normalWake; bfStart = wake + D.wake;
      morning.push(block("wake", wake, bfStart, "Wake up", { broad: true }));
      if (!day.breakfastOut) morning.push(block("meal", bfStart, bfStart + D.breakfast, "Breakfast at the stay", { broad: true, meal: "breakfast", at: "the stay" }));
      const lunchAt = !day.lunchOut && prepStart - D.lunch >= lo ? Math.min(prepStart - D.lunch, lo + 30) : null;
      const freeTo = lunchAt != null ? lunchAt : prepStart;
      if (freeTo - (bfStart + bfLen) >= 30) morning.push(block("free", bfStart + bfLen, freeTo, "Free at the stay — rehearsal, rest", { broad: true }));
      if (lunchAt != null) {
        morning.push(block("meal", lunchAt, lunchAt + D.lunch, "Lunch at the stay before leaving", { broad: true, meal: "lunch", at: "the stay" }));
        if (prepStart - (lunchAt + D.lunch) >= 30) morning.push(block("free", lunchAt + D.lunch, prepStart, "Free at the stay", { broad: true }));
      }
    } else {
      morning.push(block("wake", wake, bfStart, "Wake up", { broad: true }));
      if (!day.breakfastOut) morning.push(block("meal", bfStart, prepStart, "Breakfast at the stay", { broad: true, meal: "breakfast", at: "the stay" }));
    }
    morning.push(block("prep", prepStart, leaveStay, "Get ready · costumes & personal kit to the vehicle", {}));
    // Lunch on the road: if a show sits inside the lunch window, say so.
    day.blocks = morning.concat(timeline).sort(function (a, b) { return a.from - b.from; });
    if (!day.lunchOut && !day.blocks.some(function (b) { return b.meal === "lunch"; })) placeDefaultLunch(day, D, lo, lc);
    applyMealPlan(cfg, dateISO, day);
    day.wake = wake; day.leave = leaveStay; day.back = home; day.sleep = sleepAt;
    const earliest = toMin(D.earliestWake), latest = toMin(D.latestSleep) + 1440;
    if (wake < earliest) day.flags.push("Early call: wake-up at " + hm(wake) + ".");
    if (prev && prev.sleep != null && prev.kind !== "rest") {
      const night = wake + 1440 - prev.sleep;
      if (night < 300) red(day, "Only " + dur(night) + " between lights out (" + hm(prev.sleep) + " the night before) and wake-up.");
      else if (night < 390) day.flags.push("Short night: " + dur(night) + " between lights out (" + hm(prev.sleep) + ") and wake-up.");
    }
    if (sleepAt > latest) day.flags.push("Late night: lights out at " + hm(sleepAt) + ".");
    evs.forEach(function (x) { if (x.b.note) day.flags.push("Note on “" + x.ev.title + "”: " + x.b.note); });
    return day;
  }
  // Out-of-town day (e.g. Manipal): travel is overnight both ways. The
  // group leaves the stay the previous night, sleeps on the road, freshens
  // up on arrival, does the programme, eats, and leaves again at night to
  // be home the next morning. planTour stitches the two night legs into
  // the neighbouring days (day.nightOut / day.nightBack).
  function planOutstationDay(ctx, dateISO, evs, stay, day, stayIdx, prev) {
    const cfg = ctx.cfg, D = cfg.day;
    const departAfter = toMin(D.outstationDepart) || 1260;
    const fresh = D.freshenUp != null ? D.freshenUp : 90;
    const morning = (toMin(D.earliestWake) || 330) + 60; // a civilised arrival hour
    day.kind = "outstation";
    const first = evs[0], last = evs[evs.length - 1];
    const dest = first.venue, destIdx = first.idx;
    const prevDate = addDays(dateISO, -1), nextDate = addDays(dateISO, 1);
    const timeline = [];

    // Night out: leave the previous evening, arrive early morning. If the
    // previous day's show ends too late to go home first, leave straight
    // from that venue after dinner.
    let originIdx = stayIdx, originLabel = "the stay", notBefore = departAfter, fromVenue = false;
    if (prev && prev.kind === "show" && prev.lastFreeAt != null && prev.back + 30 > departAfter) {
      originIdx = prev.lastIdx; originLabel = prev.lastLabel; fromVenue = true;
      notBefore = Math.max(departAfter, prev.lastFreeAt + D.dinner);
    }
    const out = ctx.travel(originIdx, destIdx, prevDate, notBefore);
    const outMin = out.min == null ? 360 : out.min;
    // Arrive by the first venue call, but no earlier than a civilised hour;
    // never depart after midnight (it stops being a night drive).
    const wanted = Math.min(first.b.start - first.b.before - fresh, morning);
    let departOut = Math.min(1425, Math.max(notBefore, wanted + 1440 - outMin));
    const outFinal = ctx.travel(originIdx, destIdx, prevDate, departOut);
    const outMinFinal = outFinal.min == null ? outMin : outFinal.min;
    if (departOut + outMin - 1440 > first.b.start - first.b.before - fresh) day.flags.push("Leaving " + originLabel + " at " + hm(departOut) + " the night before arrives " + hm(departOut + outMin - 1440) + " — later than the venue call.");
    const arriveOut = departOut + outMinFinal - 1440; // minutes into this day
    day.nightOut = { date: prevDate, depart: departOut, arrive: arriveOut, travel: outFinal, to: dest ? dest.name : first.ev.venue, fromVenue: fromVenue, fromLabel: originLabel };
    timeline.push(block("leg", arriveOut, null, "Arrive " + (dest ? dest.name : first.ev.venue) + " after the overnight drive", { travel: outFinal, detail: legDetail(outFinal, 0) + " · left " + originLabel + " " + hm(departOut) + " on " + dateLabel(prevDate), overnight: true }));
    if (outFinal.min != null) { day.travelMin += outFinal.min; day.km += outFinal.km || 0; }
    const bfEnd = arriveOut + fresh;
    timeline.push(block("meal", arriveOut, bfEnd, "Freshen up & breakfast on arrival", { broad: true, meal: "breakfast", at: "on arrival" }));
    let here = bfEnd;
    evs.forEach(function (x, i) {
      const arrive = Math.max(here, x.b.start - x.b.before);
      if (i > 0 && x.idx !== evs[i - 1].idx) {
        const tr = ctx.travel(evs[i - 1].idx, x.idx, dateISO, here);
        timeline.push(block("leg", here, here + (tr.min || 15), "To " + (x.venue ? x.venue.name : x.ev.venue), { travel: tr, detail: legDetail(tr, 0) }));
        if (tr.min != null) { day.travelMin += tr.min; day.km += tr.km || 0; }
        here += tr.min || 15;
      }
      if (arrive > here + 15) timeline.push(block("hold", here, arrive, "Free time in town" + mealHint(here, arrive, D), { inTown: true }));
      if (arrive > x.b.start) red(day, "“" + x.ev.title + "” starts before the group can be ready (" + hm(arrive) + ").");
      truckFor(ctx, day, timeline, x, arrive, dateISO);
      pushPrep(timeline, arrive, x);
      timeline.push(block("show", x.b.start, x.b.end, x.ev.title, { ev: x.ev, venue: x.venue, artists: x.b.artists, cast: x.b.cast }));
      here = x.b.end + x.b.change + x.b.after;
      pushWrap(timeline, x); truckBack(ctx, day, timeline, x, here, dateISO);
    });
    const lo = toMin(D.lunchWindow[0]), lc = toMin(D.lunchWindow[1]);
    // Dinner in town, then the night drive home.
    const dinnerAt = Math.max(here, toMin(D.dinnerWindow[0]));
    timeline.push(block("meal", dinnerAt, dinnerAt + D.dinner, "Dinner near " + (last.venue ? last.venue.name : last.ev.venue), { meal: "dinner", at: "near " + (last.venue ? last.venue.name : last.ev.venue) }));
    const back0 = ctx.travel(last.idx, stayIdx, dateISO, departAfter);
    const backMin = back0.min == null ? 360 : back0.min;
    const departBack = Math.min(1425, Math.max(dinnerAt + D.dinner, departAfter, morning + 1440 - backMin));
    if (departBack > dinnerAt + D.dinner + 15) timeline.push(block("hold", dinnerAt + D.dinner, departBack, "Rest before the night drive", { inTown: true }));
    const back = ctx.travel(last.idx, stayIdx, dateISO, departBack);
    const arriveHome = departBack + backMin; // > 1440 → next morning
    timeline.push(block("leg", departBack, null, "Leave for the stay — overnight drive", { travel: back, detail: legDetail(back, 0) + " · home about " + hm(arriveHome), overnight: true }));
    if (back.min != null) { day.travelMin += back.min; day.km += back.km || 0; }
    day.nightBack = { date: nextDate, depart: departBack, arrive: arriveHome - 1440, travel: back, from: last.venue ? last.venue.name : last.ev.venue };
    day.legs = [
      { from: originLabel, to: dest ? dest.name : first.ev.venue, depart: departOut - 1440, travelDepart: departOut, travelDate: prevDate, arrive: arriveOut, travel: outFinal },
      { from: last.venue ? last.venue.name : last.ev.venue, to: "the stay", depart: departBack, arrive: arriveHome, travel: back },
    ];
    day.blocks = timeline.sort(function (a, b) { return a.from - b.from; });
    if (!day.blocks.some(function (b) { return b.meal === "lunch"; })) placeDefaultLunch(day, D, lo, lc);
    applyMealPlan(cfg, dateISO, day);
    day.wake = arriveOut; day.leave = departOut - 1440; day.back = arriveHome; day.sleep = departBack;
    day.flags.push("Overnight travel both ways: sleep on the road out (" + dur(outMinFinal) + ") and back (" + dur(backMin) + "). A sleeper coach is worth booking for these two nights.");
    return day;
  }
  // Called by planTour: fold an out-of-town day's night legs into the day
  // before (departure replaces lights out) and the day after (arrival
  // replaces the wake-up).
  function stitchOvernight(days, i) {
    const day = days[i];
    const prev = days[i - 1], next = days[i + 1];
    if (prev && day.nightOut) {
      const n = day.nightOut;
      prev.blocks = prev.blocks.filter(function (b) { return b.type !== "sleep"; });
      if (n.fromVenue) {
        // Cut everything after the last wrap and go straight on from the venue.
        const cut = prev.lastFreeAt;
        prev.blocks = prev.blocks.filter(function (b) { return b.from < cut || (b.type === "buffer" && b.to <= cut); });
        const dinnerLen = n.depart - cut >= 60 ? 60 : Math.max(30, n.depart - cut);
        prev.blocks = prev.blocks.filter(function (b) { return b.meal !== "dinner"; });
        prev.blocks.push(block("meal", cut, cut + dinnerLen, "Dinner near " + n.fromLabel, { meal: "dinner", at: "near " + n.fromLabel }));
        if (n.depart - (cut + dinnerLen) >= 15) prev.blocks.push(block("hold", cut + dinnerLen, n.depart, "Wait for the coach at " + n.fromLabel, { inTown: true }));
        prev.back = null;
        prev.flags.push("No return to the stay tonight: the overnight coach to " + n.to + " leaves from " + n.fromLabel + " at " + hm(n.depart) + " — pack for Manipal in the morning.");
      }
      prev.blocks.push(block("leg", n.depart, null, "Leave " + n.fromLabel + " for " + n.to + " — overnight drive", { travel: n.travel, detail: legDetail(n.travel, 0) + " · sleep on the road", overnight: true }));
      prev.blocks.sort(function (a, b) { return a.from - b.from; });
      prev.sleep = n.depart; prev.nightDeparture = true; prev.nightTo = n.to;
    }
    if (next && day.nightBack) {
      const arr = day.nightBack.arrive;
      next.blocks = next.blocks.filter(function (b) { return b.type !== "wake"; });
      next.blocks.unshift(block("leg", arr, null, "Arrive back at the stay from " + day.nightBack.from, { travel: day.nightBack.travel, detail: "overnight drive · rest before the day starts", overnight: true }));
      const firstAfter = next.blocks.find(function (b) { return b.type !== "leg" && b.from != null; });
      if (firstAfter && firstAfter.from < arr + 120) next.flags.push("Only " + dur(Math.max(0, firstAfter.from - arr)) + " rest between arriving from " + day.nightBack.from + " and the day's start.");
      next.wake = arr;
    }
  }

  // Day add-ons: cfg.stops[date] = [{purpose, name, lat, lon, link, start, end}].
  // purpose: breakfast | lunch | dinner | sightseeing | shopping | other.
  // start/end are "HH:MM" and optional: a timed stop is pinned; an untimed
  // meal is auto-placed; an untimed visit takes the first gap that fits.
  const PURPOSE = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", sightseeing: "Sightseeing", shopping: "Shopping", other: "Stop" };
  const VISIT_LEN = 90;
  function dayStops(cfg, dateISO, ctx) {
    let list = (cfg.stops || {})[dateISO] || [];
    // Legacy shape from the first version: mealStops[date] = {lunch, dinner}.
    const legacy = (cfg.mealStops || {})[dateISO];
    if (legacy) ["lunch", "dinner"].forEach(function (k) { if (legacy[k] && legacy[k].lat != null) list = list.concat([Object.assign({ purpose: k }, legacy[k])]); });
    return list.filter(function (p) { return p && p.lat != null && p.lon != null; }).map(function (p, i) {
      const purpose = PURPOSE[p.purpose] ? p.purpose : "other";
      return { i: i, purpose: purpose, label: PURPOSE[purpose], name: p.name || PURPOSE[purpose] + " place", area: p.area || "", lat: +p.lat, lon: +p.lon,
        start: toMin(p.start), end: toMin(p.end), idx: ctx.point(p), stop: true };
    });
  }
  function stopLen(D, p) {
    if (p.start != null && p.end != null && p.end > p.start) return p.end - p.start;
    return p.purpose === "breakfast" ? D.breakfast : p.purpose === "lunch" ? D.lunch : p.purpose === "dinner" ? D.dinner : (p.end != null && p.start == null ? VISIT_LEN : VISIT_LEN);
  }
  // Turn the day's stops into synthetic events the main loop routes through.
  function placeStops(ctx, evs, stops, stayIdx, dateISO, D, day) {
    const lo = toMin(D.lunchWindow[0]), lc = toMin(D.lunchWindow[1]);
    const dOpen = toMin(D.dinnerWindow[0]);
    function mk(p, start, len) {
      return { ev: { id: "stop-" + p.i + "@" + dateISO, title: p.label, category: "Stop", shows: [], notPublic: true }, b: { start: start, end: start + len, before: 0, after: 0 }, venue: p, idx: p.idx, meal: p.purpose, stopLabel: p.label + " at " + p.name };
    }
    function real() { return evs.filter(function (x) { return !x.meal; }); }
    function travel(a, b, t) { return ctx.travel(a, b, dateISO, t).min || 30; }
    // Find the first gap (after `from`) that can hold len at `place`, given the
    // current list of events; returns a start time or null.
    function firstGap(p, len, notBefore, notAfter) {
      const list = evs.slice().sort(function (a, b) { return a.b.start - b.b.start; });
      let hereIdx = stayIdx, t = notBefore;
      for (let i = 0; i <= list.length; i++) {
        const next = list[i];
        const start = Math.max(t + travel(hereIdx, p.idx, t), notBefore);
        const limit = next ? next.b.start - next.b.before - travel(p.idx, next.idx, start + len) : Infinity;
        if (start + len <= Math.min(limit, notAfter)) return start;
        if (!next) break;
        t = next.b.end + (next.meal ? 0 : next.b.change || 0) + next.b.after; hereIdx = next.idx;
      }
      return null;
    }
    // Timed stops first (they are fixed), then untimed ones around them.
    stops.slice().sort(function (a, b) { return (a.start == null) - (b.start == null); }).forEach(function (p) {
      const len = stopLen(D, p);
      let start = null;
      if (p.start != null) {
        start = p.start;
        const clash = evs.find(function (x) { return x.b.start < start + len && x.b.end > start; });
        if (clash) red(day, p.label + " at " + p.name + " (" + hm(start) + ") overlaps “" + (clash.stopLabel || clash.ev.title) + "”.");
      } else if (p.purpose === "breakfast") {
        const first = evs.slice().sort(function (a, b) { return a.b.start - b.b.start; })[0];
        const call = first ? first.b.start - first.b.before : toMin(D.restDayWake) + 240;
        const earliest = (toMin(D.earliestWake) || 330) + D.wake + D.prep + D.loadOut + travel(stayIdx, p.idx, 420);
        // On the way to an early call, else a normal breakfast hour (by 10am).
        const usual = Math.max(earliest, toMin(D.restDayWake) + D.wake + 30);
        start = first ? Math.min(Math.max(earliest, call - travel(p.idx, first.idx, call - len) - len), Math.max(usual, 600)) : usual;
        if (first && start + len + travel(p.idx, first.idx, start + len) > first.b.start - first.b.before + 15) day.flags.push("Breakfast at " + p.name + " squeezes the first call; it starts " + hm(start) + ".");
      } else if (p.purpose === "lunch") {
        start = firstGap(p, len, lo, lc + 30);
        if (start == null) day.flags.push("Lunch at " + p.name + " does not fit around the programme; the stop is ignored.");
      } else if (p.purpose === "dinner") {
        const last = real().slice(-1)[0];
        const after = last ? last.b.end + (last.b.change || 0) + last.b.after : dOpen - 60;
        const from = last ? last.idx : stayIdx;
        start = Math.max(after + travel(from, p.idx, after), dOpen);
        if (start > toMin(D.dinnerWindow[1]) + 60) day.flags.push("Dinner at " + p.name + " would start " + hm(start) + " — late.");
      } else {
        start = firstGap(p, len, toMin(D.restDayWake) + D.wake + D.breakfast + 30, 1320);
        if (start == null) day.flags.push(p.label + " at " + p.name + " does not fit today; give it a time or drop it.");
      }
      if (start != null) {
        evs.push(mk(p, start, len));
        if (p.purpose === "breakfast") day.breakfastOut = true;
        if (p.purpose === "lunch") day.lunchOut = true;
        if (p.purpose === "dinner") day.dinnerOut = true;
      }
    });
    evs.sort(function (a, b) { return a.b.start - b.b.start; });
  }

  // Default lunch: wherever the group is inside the lunch window — a hold
  // in town, the stay, or packed at the venue during a show.
  function placeDefaultLunch(day, D, lo, lc) {
    const bl = day.blocks;
    const overlap = function (b) { return b.to != null && b.from < lc && b.to > lo; };
    let host = bl.find(function (b) { return b.type === "hold" && overlap(b) && Math.min(b.to, lc) - Math.max(b.from, lo) >= 30; });
    let label, at, from, note;
    if (host) {
      from = Math.max(host.from, lo);
      at = host.atStay ? "the stay" : (host.label.replace(/^Hold (in town near |at )/, "").replace(/ · lunch here$/, ""));
      label = "Lunch " + (host.atStay ? "at the stay" : "near " + at);
      host.label = host.label.replace(/ · lunch here$/, "");
    } else {
      host = bl.find(function (b) { return b.type === "free" && overlap(b); });
      if (host) { from = Math.max(host.from, lo); at = "the stay"; label = "Lunch at the stay"; }
      else {
        host = bl.find(function (b) { return (b.type === "show" || b.type === "buffer") && overlap(b); });
        if (host) { from = Math.max(host.from, lo); at = host.venue ? host.venue.name : "the venue"; label = "Lunch at the venue (packed)"; note = "During “" + (host.ev ? host.ev.title : host.label) + "” — arrange packed lunch."; }
        else {
          host = bl.find(function (b) { return b.type === "leg" && overlap(b); });
          from = host ? Math.max(host.from, lo) : lo; at = "on the road"; label = "Lunch on the road";
        }
      }
    }
    bl.push(block("meal", from, from + Math.min(D.lunch, 60), label, { meal: "lunch", at: at, note: note, during: !!note }));
    bl.sort(function (a, b) { return a.from - b.from; });
  }
  // Staff edits to a default meal: cfg.mealPlan[date][meal] = {start, minutes, note}.
  function applyMealPlan(cfg, dateISO, day) {
    const mp = (cfg.mealPlan || {})[dateISO] || {};
    day.blocks.forEach(function (b) {
      if (!b.meal || b.out) return;
      const o = mp[b.meal]; if (!o) return;
      const len = o.minutes != null && o.minutes > 0 ? +o.minutes : (b.to != null ? b.to - b.from : 45);
      if (toMin(o.start) != null) b.from = toMin(o.start);
      b.to = b.from + len;
      if (o.note) b.note = o.note;
      b.edited = true;
    });
    day.blocks.sort(function (a, b) { return a.from - b.from; });
  }

  // The instrument vehicle (production, not artist time): must be at the
  // venue `instrumentLead` minutes before the artists' set-up, or at the
  // time given for the event; leaves the storage place travel-time earlier.
  function truckFor(ctx, day, timeline, x, artistsArrive, dateISO) {
    if (!x.b.truck) return;
    const cfg = ctx.cfg, o = (cfg.overrides || {})[x.ev.id] || {};
    const lead = cfg.instrumentLead != null ? +cfg.instrumentLead : 30;
    const at = o.instrAt != null ? +o.instrAt : artistsArrive - lead;
    const store = cfg.instrumentStore && cfg.instrumentStore.lat != null ? cfg.instrumentStore : null;
    let leave = null, tr = null;
    if (store && x.idx >= 0) {
      const sIdx = ctx.point(store);
      let dep = at - 45;
      for (let i = 0; i < 3; i++) { tr = ctx.travel(sIdx, x.idx, dateISO, dep); dep = at - (tr.min == null ? 45 : tr.min); }
      leave = dep;
      if (tr && tr.km != null) { day.truckKm = (day.truckKm || 0) + tr.km; day.truckMin = (day.truckMin || 0) + (tr.min || 0); }
      timeline.push(block("truck", leave, at, "Instrument vehicle: leave " + (store.name || "storage") + " for " + (x.venue ? x.venue.name : x.ev.venue), { dir: "out", detail: legDetail(tr, 0) + " · production vehicle, not artist time" }));
    } else {
      timeline.push(block("truck", at, null, "Instruments at " + (x.venue ? x.venue.name : x.ev.venue) + " by now", { dir: "out", detail: "" }));
    }
    day.trucks = day.trucks || [];
    day.trucks.push({ id: x.ev.id, instrAt: at, instrLeave: leave });
  }

  // After the wrap the instruments go back (or on to the next venue: the
  // planner keeps it simple and shows the return to storage).
  function truckBack(ctx, day, timeline, x, freeAt, dateISO) {
    if (!x.b.truck) return;
    const cfg = ctx.cfg;
    const store = cfg.instrumentStore && cfg.instrumentStore.lat != null ? cfg.instrumentStore : null;
    const from = x.venue ? x.venue.name : x.ev.venue;
    if (store && x.idx >= 0) {
      const tr = ctx.travel(x.idx, ctx.point(store), dateISO, freeAt);
      if (tr.km != null) { day.truckKm = (day.truckKm || 0) + tr.km; day.truckMin = (day.truckMin || 0) + (tr.min || 0); }
      timeline.push(block("truck", freeAt, freeAt + (tr.min == null ? 45 : tr.min), "Instrument vehicle: leave " + from + " for " + (store.name || "storage"), { dir: "back", detail: legDetail(tr, 0) + " · production vehicle, not artist time" }));
    } else {
      timeline.push(block("truck", freeAt, null, "Instruments leave " + from, { dir: "back", detail: "" }));
    }
  }

  // The pre-show segments between arrival and the start. A late arrival
  // squeezes them in order: setup first (it cannot be skipped), then sound
  // check, then whatever is left for costume and warm-up.
  function pushPrep(timeline, arrive, x) {
    let t = arrive, left = x.b.start - arrive;
    if (left <= 1) return;
    const segs = [["setup", "Instrument & stage set-up"], ["soundcheck", "Sound check"], ["ready", "Costume, make-up, warm-up & call"]];
    segs.forEach(function (sg) {
      const want = x.b[sg[0]] || 0; if (!want) return;
      const got = Math.max(0, Math.min(want, left));
      if (got >= 1) timeline.push(block("buffer", t, t + got, sg[1], { minutes: Math.round(got), seg: sg[0], short: got < want - 1 ? Math.round(want - got) : 0 }));
      t += got; left -= got;
    });
    if (left > 1) timeline.push(block("buffer", t, x.b.start, "Spare time at the venue", { minutes: Math.round(left) }));
  }

  // After a show: costume off and make-up removal, then wrap.
  function pushWrap(timeline, x) {
    let t = x.b.end;
    if (x.b.change > 0) { timeline.push(block("buffer", t, t + x.b.change, "Costume off, make-up removal & change", { minutes: x.b.change, seg: "change" })); t += x.b.change; }
    if (x.b.after > 0) timeline.push(block("buffer", t, t + x.b.after, "Wrap — pack, meet people, load-out", { minutes: x.b.after, seg: "after" }));
  }

  function mealHint(from, to, D) {
    const lo = toMin(D.lunchWindow[0]), lc = toMin(D.lunchWindow[1]);
    if (from < lc && to > lo && (Math.min(to, lc) - Math.max(from, lo)) >= 45) return " · lunch here";
    return "";
  }
  function legDetail(tr, loadOut) {
    if (!tr || tr.min == null) return "travel time unknown";
    const src = tr.source === "google-traffic" ? (tr.mode === "live" ? "live traffic" : tr.mode === "near" ? "traffic, refreshed hourly" : "typical traffic for the day") : tr.source === "same" ? "" : "est. with traffic";
    return dur(tr.min) + (tr.km != null ? " · " + Math.round(tr.km) + " km" : "") + (src ? " · " + src : "") + (loadOut ? " · " + loadOut + " min loading first" : "");
  }

  /* ---------- tour + comparison ---------- */
  function planTour(ctx, events, stay) {
    const dates = events.map(function (e) { return e.date; });
    if (!dates.length) return { stay: stay, days: [], totals: {} };
    let first = dates.reduce(function (a, b) { return a < b ? a : b; });
    let last = dates.reduce(function (a, b) { return a > b ? a : b; });
    // The company's flights stretch the tour: arrival day, and the day the
    // run to the airport happens (the evening before a small-hours flight).
    const tv = ctx.cfg.travel || {};
    if (tv.arrival && parseDate(tv.arrival.date) && parseDate(tv.arrival.date) < first) first = parseDate(tv.arrival.date);
    const depDay = departureDay(tv);
    if (depDay && depDay > last) last = depDay;
    const days = [];
    for (let d = first; d <= last; d = addDays(d, 1)) {
      days.push(planDay(ctx, d, events.filter(function (e) { return e.date === d; }), stay, days[days.length - 1]));
    }
    days.forEach(function (day, i) { if (day.kind === "outstation") stitchOvernight(days, i); });
    const t = { travelMin: 0, km: 0, truckKm: 0, truckMin: 0, showDays: 0, restDays: 0, earlyCalls: 0, lateNights: 0, earliestWake: null, latestSleep: null, holdsInTown: 0, longestDay: 0 };
    // The instrument vehicle's own legs (storage ↔ venue) are counted apart
    // from the artists' road time; they exist once a storage place is set.
    t.truckKnown = !!(ctx.cfg.instrumentStore && ctx.cfg.instrumentStore.lat != null);
    const D = ctx.cfg.day;
    days.forEach(function (day) {
      t.travelMin += day.travelMin; t.km += day.km; t.truckKm += day.truckKm || 0; t.truckMin += day.truckMin || 0;
      if (day.kind === "rest") { t.restDays++; return; }
      if (day.kind === "arrival" || day.kind === "departure") return;
      t.showDays++;
      if (day.wake < toMin(D.earliestWake)) t.earlyCalls++;
      if (day.sleep != null && day.sleep > toMin(D.latestSleep) + 1440) t.lateNights++;
      t.earliestWake = t.earliestWake == null ? day.wake : Math.min(t.earliestWake, day.wake);
      if (day.sleep != null) t.latestSleep = t.latestSleep == null ? day.sleep : Math.max(t.latestSleep, day.sleep);
      t.holdsInTown += day.blocks.filter(function (b) { return b.type === "hold" && b.inTown; }).length;
      if (day.red) t.redDays = (t.redDays || 0) + 1;
      t.longestDay = Math.max(t.longestDay, day.back - day.leave);
    });
    // Vehicles per day follow who travels: a talk with one speaker needs
    // one vehicle, not the whole fleet; the estimate follows suit.
    // The first vehicle is the group's coach; any smaller one listed (a
    // car) is used on its own when the day's party fits in it.
    const fleetList = ctx.cfg.party.vehicles || [];
    const veh = fleetList[0] || { ratePerKm: 0, minPerDay: 0, count: 1 };
    const fleet = veh.count || 1, perVehicle = veh.seats || 17;
    const small = fleetList.slice(1).filter(function (v) { return (v.seats || 0) < perVehicle; }).sort(function (a, b) { return a.seats - b.seats; });
    days.forEach(function (day) {
      const heads = (day.travelling || ctx.cfg.party.size || 0);
      if (day.kind === "rest") { day.vehicles = 0; day.vehicle = veh; day.fleet = fleet; return; }
      // A vehicle chosen by hand for the day (admin dropdown / sheet E2) wins.
      const chosenName = (ctx.cfg.dayVehicle || {})[day.date];
      const chosen = chosenName ? fleetList.find(function (v) { return v.name === chosenName; }) : null;
      const fits = small.find(function (v) { return heads <= v.seats * (v.count || 1); });
      if (chosen) { day.vehicle = chosen; day.vehicles = Math.max(1, Math.min(chosen.count || 1, Math.ceil(heads / (chosen.seats || heads)))); day.smallVehicle = chosen !== veh; day.vehicleChosen = true; if (heads > (chosen.seats || 0) * (chosen.count || 1)) day.flags.push("Vehicle: " + chosen.name + " chosen for the day, but " + heads + " travel and it seats " + (chosen.seats || 0) * (chosen.count || 1) + "."); }
      else if (fits) { day.vehicle = fits; day.vehicles = Math.max(1, Math.ceil(heads / fits.seats)); day.smallVehicle = true; }
      else { day.vehicle = veh; day.vehicles = Math.max(1, Math.min(fleet, Math.ceil(heads / perVehicle))); }
      day.fleet = fleet;
    });
    t.vehicleCost = days.reduce(function (s, day) { const v = day.vehicle || veh; return s + Math.max(day.km * (v.ratePerKm || 0), day.kind === "rest" ? 0 : (v.minPerDay || 0)) * day.vehicles; }, 0);
    const seats = (ctx.cfg.party.vehicles || []).reduce(function (n, v) { return n + (v.seats || 0) * (v.count || 1); }, 0);
    if (seats && seats < (ctx.cfg.party.size || 0)) ctx.warnings.push("The group is " + ctx.cfg.party.size + " people but the vehicles seat " + seats + " — add a vehicle or a bigger coach.");
    return { stay: stay, days: days, totals: t, party: ctx.cfg.party };
  }
  function compareStays(ctx, events, stays) {
    const rows = stays.map(function (s) { const p = planTour(ctx, events, s); return { stay: s, totals: p.totals, plan: p }; });
    const best = rows.slice().sort(function (a, b) { return a.totals.travelMin - b.totals.travelMin; })[0];
    rows.forEach(function (r) { r.deltaMin = best ? r.totals.travelMin - best.totals.travelMin : 0; r.best = r === best; });
    return rows;
  }

  /* ---------- persistent leg cache (browser) ---------- */
  // Google figures are kept in localStorage so a page refresh shows the
  // priced plan at once; only legs whose figure has aged past its tier
  // (typical 7 days, within 48 h of departure 1 h, within 2 h 10 min) are
  // asked for again, in the background.
  const LEG_STORE = "bali-legcache-v1";
  function legTTL(ck) {
    // ck = a|b|YYYY-MM-DD|bucket(15 min)
    const parts = ck.split("|"), date = parts[2], bucket = +parts[3];
    const dep = new Date(date + "T00:00:00+05:30").getTime() + bucket * 15 * 60000;
    const hours = (dep - Date.now()) / 3600000;
    return hours <= 2 ? 10 * 60000 : hours <= 48 ? 60 * 60000 : 7 * 86400000;
  }
  function loadLegCache(ctx) {
    try {
      const raw = JSON.parse(localStorage.getItem(LEG_STORE) || "{}");
      let kept = 0;
      Object.keys(raw).forEach(function (ck) {
        const v = raw[ck];
        if (v && v.at && Date.now() - v.at < legTTL(ck)) { ctx.legCache[ck] = v; kept++; }
      });
      return kept;
    } catch (e) { return 0; }
  }
  function saveLegCache(ctx) {
    try {
      const out = {};
      Object.keys(ctx.legCache).forEach(function (ck) { const v = ctx.legCache[ck]; if (v && v.source === "google-traffic") out[ck] = v; });
      localStorage.setItem(LEG_STORE, JSON.stringify(out));
    } catch (e) { /* storage full or blocked: fine */ }
  }
  function pruneLegCache(ctx) {
    Object.keys(ctx.legCache).forEach(function (ck) { const v = ctx.legCache[ck]; if (v && v.at && Date.now() - v.at >= legTTL(ck)) delete ctx.legCache[ck]; });
  }

  /* ---------- live-traffic refinement (async, optional) ---------- */
  // For every leg in a plan, ask the bridge for the traffic-aware time at
  // that departure (six requests at a time), fill the leg cache and call
  // onProgress after each batch so the page can re-plan and re-render as
  // figures arrive. Returns true if anything changed.
  async function refineWithBridge(ctx, plan, onProgress, opts) {
    opts = opts || {};
    if (!CONFIG.LOGISTICS_URL || ctx.backendDown) return false;
    pruneLegCache(ctx);
    const jobs = [];
    plan.days.forEach(function (day) {
      day.legs.forEach(function (leg) {
        if (!leg.travel || leg.travel.source === "google-traffic") return;
        const a = ctx.points.findIndex(function (p) { return p.key === pointKeyFor(ctx, leg, day, true); });
        const b = ctx.points.findIndex(function (p) { return p.key === pointKeyFor(ctx, leg, day, false); });
        if (a < 0 || b < 0 || a === b) return;
        const td = leg.travelDepart != null ? leg.travelDepart : leg.depart;
        // A night leg belongs to the previous calendar day (negative minutes)
        // and was priced with that day and a positive minute; match that.
        const keyDate = leg.travelDate || (td < 0 ? addDays(day.date, -1) : day.date);
        const keyMin = leg.travelDate ? td : (td < 0 ? td + 1440 : td);
        const dep = ((Math.round(keyMin) % 1440) + 1440) % 1440;
        const date = keyMin >= 1440 ? addDays(keyDate, 1) : keyDate;
        const ck = ctx.points[a].key + "|" + ctx.points[b].key + "|" + keyDate + "|" + Math.floor(keyMin / 15);
        if (ctx.legCache[ck] || jobs.some(function (j) { return j.ck === ck; })) return;
        jobs.push({ ck: ck, a: a, b: b, departISO: date + "T" + pad(Math.floor(dep / 60)) + ":" + pad(dep % 60) + ":00+05:30" });
      });
    });
    let changed = false, failed = 0;
    // One backend execution prices up to 100 legs — normally the whole tour
    // in a single round trip, since the front door costs 15–30 s per call.
    // Requests go one after another (Apps Script dislikes concurrency),
    // with retries on its occasional HTML answer. The first request can
    // also carry the planner-sheet inputs back (opts.sheet), so a cold
    // load pays the front door once, not twice.
    let batch = 100, batchesFailed = 0;
    let wantSheet = !!opts.sheet;
    for (let i = 0; i < jobs.length || wantSheet; i += batch) {
      const chunk = jobs.slice(i, i + batch);
      const spec = chunk.map(function (j) { return ctx.points[j.a].lat + "," + ctx.points[j.a].lon + "~" + ctx.points[j.b].lat + "," + ctx.points[j.b].lon + "~" + j.departISO; }).join("|");
      const url = CONFIG.LOGISTICS_URL + "?action=legs&legs=" + encodeURIComponent(spec) + (wantSheet ? "&sheet=1" : "");
      let r = null, tooMany = false;
      // Three tries, 75 s each at most: a flaky front door can hold a page
      // for a couple of minutes, never a quarter of an hour. After the
      // second whole batch fails the rest of the tour is skipped for now.
      for (let attempt = 0; attempt < 3 && !r; attempt++) {
        try { r = await fetchJSON(url, 75000); if (!r.ok) { if (/at most \d+ legs/.test(r.error || "")) { tooMany = true; break; } throw new Error(r.error || "bridge"); } }
        catch (e) { r = null; if (attempt === 2) { failed += chunk.length; batchesFailed++; } else await new Promise(function (res) { setTimeout(res, 1500 * (attempt + 1)); }); }
      }
      if (batchesFailed >= 2) { failed += Math.max(0, jobs.length - i - chunk.length); ctx.backendDown = true; break; }
      // An older backend takes 40 a time: redo this chunk in that size.
      if (tooMany && batch > 40) { batch = 40; i -= batch; continue; }
      if (r && wantSheet) {
        wantSheet = false;
        let sheet = r.sheet && r.sheet.ok ? r.sheet : null;
        if (sheet) storeSheetPlan(sheet); else sheet = await fetchSheetPlanLive();
        if (sheet && opts.onSheet) await opts.onSheet(sheet);
      }
      if (r) chunk.forEach(function (j, k) {
        const x = r.results[k];
        if (x && x.ok) { ctx.legCache[j.ck] = { min: x.minutes, km: x.km, source: "google-traffic", mode: x.mode, at: Date.now() }; changed = true; }
        else failed++;
      });
      if (onProgress) onProgress(i + batch, jobs.length);
      if (!jobs.length) break;
    }
    if (failed) ctx.warnings.push("Google's backend did not answer for " + failed + " leg" + (failed > 1 ? "s" : "") + " — those show the built-in estimate. It is usually back within a few minutes; reload or press Sync everything to try again.");
    if (changed) saveLegCache(ctx);
    return changed;
  }
  // Refine, re-plan, and refine again until departures settle (max 3 passes).
  // Returns the plan; onProgress(plan, done, total, pass) fires per batch —
  // when every leg is already cached it fires once with total 0.
  async function refineTour(ctx, events, stay, onProgress, opts) {
    opts = opts || {};
    let plan = planTour(ctx, events, stay);
    for (let pass = 0; pass < 4; pass++) {
      const first = pass === 0;
      const changed = await refineWithBridge(ctx, plan, function (done, total) { if (onProgress) onProgress(planTour(ctx, events, stay), done, total, pass); },
        first ? { sheet: opts.sheet, onSheet: async function (sheet) { if (!opts.onSheet) return; const ev = await opts.onSheet(sheet); if (ev) events = ev; } } : null);
      plan = planTour(ctx, events, stay);
      if (ctx.backendDown) break;
      // Sheet inputs may have added stops: one more pass prices those.
      if (!changed && !(first && opts.sheet)) break;
    }
    return plan;
  }
  function pointKeyFor(ctx, leg, day, isFrom) {
    const name = isFrom ? leg.from : leg.to;
    if (name === "the stay") return pkey(day.stay);
    const v = ctx.venues.items.find(function (x) { return x.name === name; });
    return v ? pkey(v) : "";
  }

  /* ---------- config helpers ---------- */
  // Register every place the plan can route through, so one matrix call
  // covers stays, venues, internal engagements and meal stops.
  function registerPoints(ctx, cfg, venues, events) {
    loadLegCache(ctx);
    activeStays(cfg).forEach(function (s) { ctx.point(s); });
    events.forEach(function (e) { const v = venues.resolve(e.venue); if (v) ctx.point(v); });
    Object.keys(cfg.stops || {}).forEach(function (d) { (cfg.stops[d] || []).forEach(function (p) { if (p && p.lat != null) ctx.point(p); }); });
    if (cfg.instrumentStore && cfg.instrumentStore.lat != null) ctx.point(cfg.instrumentStore);
    ["arrival", "departure"].forEach(function (k) { const t = cfg.travel && cfg.travel[k]; const v = t && t.place && venues.resolve(t.place); if (v) ctx.point(v); });
    Object.keys(cfg.mealStops || {}).forEach(function (d) {
      ["lunch", "dinner"].forEach(function (k) { const p = cfg.mealStops[d][k]; if (p && p.lat != null) ctx.point(p); });
    });
  }
  function activeStays(cfg) { return (cfg.stays || []).filter(function (s) { return s.active !== false && s.lat != null; }); }
  function encodeShare(cfg) {
    const slim = { v: cfg.version || 1, instrumentStore: cfg.instrumentStore || null, instrumentLead: cfg.instrumentLead, selectedStay: cfg.selectedStay, extras: cfg.extras || [], stops: cfg.stops || {}, mealPlan: cfg.mealPlan || {}, dayVehicle: cfg.dayVehicle || {}, travel: cfg.travel || null, joiners: cfg.joiners || {}, party: cfg.party, stays: cfg.stays, day: cfg.day, buffers: cfg.buffers, overrides: cfg.overrides, provider: cfg.provider, traffic: cfg.traffic, excludeStatuses: cfg.excludeStatuses, venueOverrides: cfg.venueOverrides || [] };
    return btoa(unescape(encodeURIComponent(JSON.stringify(slim)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodeShare(s) {
    try { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch (e) { return null; }
  }
  // "…/maps/place/Vidyarthi+Bhavan/@…" → "Vidyarthi Bhavan"
  function placeNameFromLink(s) {
    const m = /\/place\/([^\/@?]+)/.exec(String(s || ""));
    if (!m) return "";
    try { return decodeURIComponent(m[1]).replace(/\+/g, " ").trim(); } catch (e) { return m[1].replace(/\+/g, " "); }
  }
  // Parse "12.97,77.43", a Google Maps URL with @lat,lon or ?q=lat,lon.
  function parseLatLon(s) {
    s = String(s || "");
    let m = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s) || /[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s) || /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/.exec(s);
    return m ? { lat: +m[1], lon: +m[2] } : null;
  }
  async function geocode(q) {
    if (CONFIG.LOGISTICS_URL) {
      const r = await fetchJSON(CONFIG.LOGISTICS_URL + "?action=geocode&q=" + encodeURIComponent(q));
      if (r.ok) return { lat: r.lat, lon: r.lon, label: r.label, source: "google" };
    }
    const r = await fetchJSON("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=" + encodeURIComponent(q));
    if (r && r[0]) return { lat: +r[0].lat, lon: +r[0].lon, label: r[0].display_name, source: "osm" };
    return null;
  }

  // Internal engagements from the plan config (photoshoots, rehearsals…):
  // not on the public calendar, but the group still has to get there.
  function extraEvents(cfg) {
    return (cfg.extras || []).filter(function (x) { return x && x.title && parseDate(x.date); }).map(function (x) {
      const start = toMin(x.start) != null ? toMin(x.start) : parseClock(x.start);
      let end = toMin(x.end) != null ? toMin(x.end) : parseClock(x.end);
      const cat = x.category || "Internal";
      const len = ((cfg.buffers || {})[cat] || cfg.buffers.default || {}).defaultDuration || 120;
      if (start != null && (end == null || end <= start)) end = start + len;
      return { id: x.id || (slug(x.title) + "@" + parseDate(x.date)), title: x.title, category: cat, date: parseDate(x.date),
        start: start, end: end, shows: start != null ? [{ start: start, end: end }] : [], timeText: (x.start || "") + (x.end ? " – " + x.end : ""),
        venue: x.venue || "", status: "internal", notPublic: true, extra: true, note: x.note || "" };
    });
  }

  // Inputs from the Google Sheet planner (the source of truth for per-event
  // and per-day inputs once the backend is connected).
  // The sheet read takes the backend 15–40 s (17 tabs), so the last answer
  // is kept in the browser for a day: a load draws from it at once and a
  // fresh copy rides along with the first traffic request (refineTour's
  // opts.sheet) whenever the stored one is older than that.
  const SHEET_STORE = "bali-sheetplan-v1", SHEET_FRESH_MS = 24 * 60 * 60000;
  function storedSheetPlan() {
    try { const s = JSON.parse(localStorage.getItem(SHEET_STORE) || "null"); return s && s.at && s.data ? s : null; } catch (e) { return null; }
  }
  function storeSheetPlan(r) { try { localStorage.setItem(SHEET_STORE, JSON.stringify({ at: Date.now(), data: r })); } catch (e) { /* ignore */ } }
  function sheetIsFresh() { const s = storedSheetPlan(); return !!(s && Date.now() - s.at < SHEET_FRESH_MS); }
  async function fetchSheetPlanLive(fresh) {
    if (!CONFIG.LOGISTICS_URL) return null;
    try {
      const r = await fetchJSON(CONFIG.LOGISTICS_URL + "?action=sheetplan" + (fresh ? "&fresh=1" : ""), 75000);
      if (r && r.ok) { storeSheetPlan(r); return r; }
    } catch (e) { /* fall through */ }
    return null;
  }
  // opts.fresh forces a live read (and a backend re-read of the tabs);
  // opts.background never waits: the stored copy, whatever its age, or null;
  // otherwise a recent stored copy is returned and, if onFresh is given, a
  // live read follows and is handed to it when it differs.
  async function fetchSheetPlan(opts) {
    opts = opts || {};
    if (!CONFIG.LOGISTICS_URL) return null;
    const stored = storedSheetPlan();
    if (opts.background && !opts.fresh) return stored ? stored.data : null;
    if (!opts.fresh && stored && Date.now() - stored.at < SHEET_FRESH_MS) {
      if (opts.onFresh) fetchSheetPlanLive().then(function (live) { if (live && JSON.stringify(live.cfg) !== JSON.stringify(stored.data.cfg)) opts.onFresh(live); });
      return stored.data;
    }
    const live = await fetchSheetPlanLive(opts.fresh);
    return live || (stored ? stored.data : null);
  }
  function applySheetPlan(cfg, sheet) {
    if (!sheet || !sheet.cfg) return cfg;
    const sc = sheet.cfg;
    cfg.overrides = Object.assign({}, cfg.overrides || {}, sc.overrides || {});
    cfg.stops = sc.stops || {};
    cfg.mealStops = {};
    cfg.extras = sc.extras || [];
    if (sc.dayVehicle) cfg.dayVehicle = Object.assign({}, cfg.dayVehicle || {}, sc.dayVehicle);
    if (sc.travel) { cfg.travel = cfg.travel || {}; if (sc.travel.arrival) cfg.travel.arrival = Object.assign({}, cfg.travel.arrival || {}, sc.travel.arrival); if (sc.travel.departure) cfg.travel.departure = Object.assign({}, cfg.travel.departure || {}, sc.travel.departure); }
    if (sc.joiners) cfg.joiners = Object.assign({}, cfg.joiners || {}, sc.joiners);
    if (sc.party) { cfg.party.artists = sc.party.artists; cfg.party.volunteers = sc.party.volunteers; cfg.party.size = (sc.party.artists || 0) + (sc.party.volunteers || 0); }
    if (sc.instrumentLead != null) cfg.instrumentLead = sc.instrumentLead;
    if (sc.instrumentStore) cfg.instrumentStore = sc.instrumentStore;
    if (sc.stayName) {
      const want = String(sc.stayName).trim().toLowerCase();
      const st = (cfg.stays || []).find(function (s) { return s.name.toLowerCase() === want || (s.aliases || []).some(function (al) { return al.toLowerCase() === want; }); });
      if (st) cfg.selectedStay = st.id;
    }
    cfg.sheetUrl = sheet.url;
    return cfg;
  }

  /* ---------- loading everything ---------- */
  async function load(opts) {
    opts = opts || {};
    const base = opts.base || "";
    const [defaults, venuesFile, tsv] = await Promise.all([
      fetchJSON(base + CONFIG.DEFAULTS), fetchJSON(base + CONFIG.VENUES), firstOk(CONFIG.SCHEDULE),
    ]);
    let cfg = defaults;
    if (opts.cfg) cfg = deepMerge(defaults, opts.cfg);
    if (opts.cfg && opts.cfg.stays) cfg.stays = clone(opts.cfg.stays);
    if (opts.cfg && opts.cfg.overrides) cfg.overrides = clone(opts.cfg.overrides);
    const venues = new VenueBook(venuesFile.venues);
    (cfg.venueOverrides || []).forEach(function (v) { venues.upsert(v); });
    let events = parseSchedule(tsv, cfg.buffers);
    if (!events.length) {
      const local = await fetchJSON(base + "../data/events.json");
      events = local.map(function (e) { return { id: slug(e.title) + "@" + e.date, title: e.title, category: e.category, date: e.date, start: parseClock(e.time), end: null, shows: [], venue: e.venue, status: e.status, notPublic: false, timeText: e.time || "" }; })
        .map(function (e) { if (e.start != null) { e.end = e.start + 120; e.shows = [{ start: e.start, end: e.end }]; } return e; });
    }
    if (opts.sheet !== false) { const sheet = await fetchSheetPlan({ fresh: opts.freshSheet, background: opts.sheet === "background", onFresh: opts.onFreshSheet }); if (sheet) applySheetPlan(cfg, sheet); }
    events = events.concat(extraEvents(cfg));
    events.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.start || 0) - (b.start || 0); });
    return { cfg: cfg, venues: venues, events: events, fromSheet: !!tsv };
  }

  global.Logistics = { PURPOSE: PURPOSE,
    CONFIG: CONFIG, providers: providers, Ctx: Ctx, VenueBook: VenueBook,
    load: load, parseSchedule: parseSchedule, planDay: planDay, planTour: planTour, compareStays: compareStays,
    refineWithBridge: refineWithBridge, refineTour: refineTour, loadLegCache: loadLegCache, saveLegCache: saveLegCache, fetchSheetPlan: fetchSheetPlan, sheetIsFresh: sheetIsFresh, applySheetPlan: applySheetPlan, activeStays: activeStays, registerPoints: registerPoints, encodeShare: encodeShare, decodeShare: decodeShare,
    parseLatLon: parseLatLon, placeNameFromLink: placeNameFromLink, geocode: geocode, deepMerge: deepMerge, clone: clone,
    esc: esc, hm: hm, dur: dur, toMin: toMin, dateLabel: dateLabel, slug: slug, pad: pad,
  };
})(window);
