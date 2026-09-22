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
    LOGISTICS_URL: "",
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
  async function fetchJSON(url) { return JSON.parse(await fetchText(url)); }

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
        const r = await fetchJSON(url);
        if (!r.ok) throw new Error(r.error || "bridge");
        return { min: r.minutes, km: r.km, source: "google-traffic" };
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
    if (this.pindex[k] == null) { this.pindex[k] = this.points.length; this.points.push({ lat: +p.lat, lon: +p.lon, key: k }); this.matrix = null; }
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
    const base = this.matrix.dur[a][b], km = this.matrix.dist[a][b];
    if (base == null) return { min: null, km: km, source: "unroutable" };
    const mult = this.multiplier(dateISO, departMin);
    // Congestion is a city phenomenon: it stretches the first CITY_MIN_CAP
    // minutes of a leg, not a four-hour highway run to Manipal.
    const cityPart = Math.min(base, CONFIG.CITY_MIN_CAP);
    return { min: base + cityPart * (mult - 1), km: km, source: this.matrix.source + "+profile", mult: mult };
  };

  /* ---------- the day planner ---------- */
  function bufFor(cfg, ev) {
    const b = (cfg.buffers[ev.category] || cfg.buffers.default || {});
    const o = (cfg.overrides || {})[ev.id] || {};
    return {
      before: o.before != null ? +o.before : (b.before || 60),
      after: o.after != null ? +o.after : (b.after || 30),
      skip: !!o.skip,
      note: o.note || "",
      start: o.start != null ? +o.start : ev.start,
      end: o.end != null ? +o.end : ev.end,
    };
  }
  function block(type, from, to, label, extra) {
    return Object.assign({ type: type, from: from, to: to, label: label }, extra || {});
  }

  // Plans one date. `events` are that day's events (already filtered).
  // Returns {date, kind, blocks[], legs[], leave, back, wake, sleep, travelMin, km, flags[]}.
  function planDay(ctx, dateISO, events, stay, prev) {
    const cfg = ctx.cfg, D = cfg.day;
    const stayIdx = ctx.point(stay);
    const day = { date: dateISO, stay: stay, blocks: [], legs: [], flags: [], travelMin: 0, km: 0, events: [] };
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

    if (!evs.length) {
      const wake = toMin(D.restDayWake) || 480;
      day.kind = "rest";
      day.blocks.push(block("wake", wake, wake + D.wake, "Wake up", { broad: true }));
      day.blocks.push(block("meal", wake + D.wake, wake + D.wake + D.breakfast, "Breakfast at the stay", { broad: true }));
      day.blocks.push(block("free", wake + D.wake + D.breakfast, toMin(D.dinnerWindow[0]) + 30, "Rest day — no programme", { note: "Rehearsal, rest or a city visit can be pencilled here." }));
      day.blocks.push(block("meal", toMin(D.dinnerWindow[0]) + 30, toMin(D.dinnerWindow[0]) + 30 + D.dinner, "Dinner at the stay"));
      day.blocks.push(block("sleep", toMin(D.dinnerWindow[0]) + 30 + D.dinner + D.windDown, null, "Lights out", { broad: true }));
      day.wake = wake; day.sleep = day.blocks[day.blocks.length - 1].from;
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
      let depart = mustArrive - 45, tr = null;
      for (let pass = 0; pass < 3; pass++) {
        tr = ctx.travel(here, x.idx, dateISO, depart);
        depart = mustArrive - (tr.min == null ? 45 : tr.min);
      }
      if (notBefore != null && depart < notBefore) { depart = notBefore; tr = ctx.travel(here, x.idx, dateISO, depart); }
      return { depart: depart, arrive: depart + (tr.min == null ? 45 : tr.min), travel: tr };
    }

    let notBefore = null; // earliest we can leave the current location
    for (let i = 0; i < evs.length; i++) {
      const x = evs[i];
      const wanted = x.b.start - x.b.before;
      const leg = legTo(x, wanted, notBefore);
      const arrive = Math.min(leg.arrive, x.b.start);
      const fromStay = here === stayIdx;
      const depart = leg.depart - (fromStay && notBefore == null ? D.loadOut : 0);
      if (i === 0) leaveStay = depart;
      timeline.push(block("leg", depart, leg.arrive, "Leave " + hereLabel + " for " + (x.venue ? x.venue.name : x.ev.venue), {
        travel: leg.travel, loadOut: fromStay ? D.loadOut : 0, dest: x.venue, detail: legDetail(leg.travel, fromStay && notBefore == null ? D.loadOut : 0),
      }));
      day.legs.push({ from: hereLabel, to: x.venue ? x.venue.name : x.ev.venue, depart: depart, arrive: leg.arrive, travel: leg.travel });
      if (leg.travel.min != null) { day.travelMin += leg.travel.min; day.km += leg.travel.km || 0; }
      if (leg.arrive > wanted + 5) day.flags.push("“" + x.ev.title + "”: arrives " + hm(arrive) + ", " + dur(leg.arrive - wanted) + " into the " + x.b.before + " min buffer — the previous event runs too close.");
      if (leg.arrive > x.b.start) day.flags.push("“" + x.ev.title + "” cannot be reached before it starts (" + hm(leg.arrive) + ").");
      if (x.b.start > arrive) timeline.push(block("buffer", arrive, x.b.start, "At venue — " + (x.ev.category === "Performance" ? "load-in, sound & costume, warm-up" : "set-up & settle") , { minutes: Math.round(x.b.start - arrive) }));
      x.ev.shows.length > 1
        ? x.ev.shows.forEach(function (s, k) { timeline.push(block("show", s.start, s.end, x.ev.title + " — show " + (k + 1), { ev: x.ev, venue: x.venue, showIndex: k })); })
        : timeline.push(block("show", x.b.start, x.b.end, x.ev.title, { ev: x.ev, venue: x.venue }));
      const freeAt = x.b.end + x.b.after;
      timeline.push(block("buffer", x.b.end, freeAt, "Wrap — pack, meet people, load-out", { minutes: x.b.after }));
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
          const slack = gap - (nx.idx === here ? 0 : (onward.min || 45));
          if (slack >= 10) timeline.push(block("hold", freeAt, freeAt + slack, (nx.idx === here ? "Hold at " : "Hold in town near ") + hereLabel + mealHint(freeAt, freeAt + slack, D), { inTown: true, gap: slack }));
          if (slack >= 10) notBefore = freeAt + slack;
        }
      }
    }

    // Home run.
    const last = evs[evs.length - 1];
    const freeAt = last.b.end + last.b.after;
    day.lastFreeAt = freeAt; day.lastIdx = here; day.lastLabel = hereLabel;
    let departHome = freeAt;
    const dinnerOpen = toMin(D.dinnerWindow[0]), dinnerClose = toMin(D.dinnerWindow[1]);
    let backLeg = ctx.travel(here, stayIdx, dateISO, departHome);
    let home = departHome + (backLeg.min == null ? 45 : backLeg.min);
    let dinnerBlock = null;
    if (home + 10 > dinnerClose) {
      // Too late to eat at the stay: dinner near the venue before the drive.
      dinnerBlock = block("meal", departHome, departHome + D.dinner, "Dinner near " + hereLabel + " (late return)");
      departHome += D.dinner;
      backLeg = ctx.travel(here, stayIdx, dateISO, departHome);
      home = departHome + (backLeg.min == null ? 45 : backLeg.min);
      timeline.push(dinnerBlock);
    }
    timeline.push(block("leg", departHome, home, "Return to the stay", { travel: backLeg, detail: legDetail(backLeg, 0) }));
    day.legs.push({ from: hereLabel, to: "the stay", depart: departHome, arrive: home, travel: backLeg });
    if (backLeg.min != null) { day.travelMin += backLeg.min; day.km += backLeg.km || 0; }
    let sleepAt;
    if (!dinnerBlock) {
      const dAt = Math.max(home + D.loadIn, dinnerOpen);
      timeline.push(block("meal", dAt, dAt + D.dinner, "Dinner at the stay", { broad: dAt > home + 30 }));
      sleepAt = dAt + D.dinner + D.windDown;
    } else sleepAt = home + D.loadIn + D.windDown;
    timeline.push(block("sleep", sleepAt, null, "Lights out", { broad: true }));

    // Morning, walked back from the first departure.
    const prepStart = leaveStay - D.prep;
    const normalWake = toMin(D.restDayWake) || 480;
    let bfStart = prepStart - D.breakfast;
    let wake = bfStart - D.wake;
    const morning = [];
    const lo = toMin(D.lunchWindow[0]), lc = toMin(D.lunchWindow[1]);
    if (wake > normalWake) {
      // A late departure does not mean a late morning: wake at the usual
      // hour and show the free time, with lunch at the stay if it fits.
      wake = normalWake; bfStart = wake + D.wake;
      morning.push(block("wake", wake, bfStart, "Wake up", { broad: true }));
      morning.push(block("meal", bfStart, bfStart + D.breakfast, "Breakfast at the stay", { broad: true }));
      const lunchAt = prepStart - D.lunch >= lo ? Math.min(prepStart - D.lunch, lo + 30) : null;
      const freeTo = lunchAt != null ? lunchAt : prepStart;
      if (freeTo - (bfStart + D.breakfast) >= 30) morning.push(block("free", bfStart + D.breakfast, freeTo, "Free at the stay — rehearsal, rest", { broad: true }));
      if (lunchAt != null) {
        morning.push(block("meal", lunchAt, lunchAt + D.lunch, "Lunch at the stay before leaving", { broad: true }));
        if (prepStart - (lunchAt + D.lunch) >= 30) morning.push(block("free", lunchAt + D.lunch, prepStart, "Free at the stay", { broad: true }));
      }
    } else {
      morning.push(block("wake", wake, bfStart, "Wake up", { broad: true }));
      morning.push(block("meal", bfStart, prepStart, "Breakfast at the stay", { broad: true }));
    }
    morning.push(block("prep", prepStart, leaveStay, "Get ready · costumes & instruments to the vehicle", {}));
    // Lunch on the road: if a show sits inside the lunch window, say so.
    const busy = timeline.filter(function (b) { return b.type === "show" && b.from < lc && b.to > lo; });
    const lunchDone = morning.some(function (b) { return b.type === "meal" && /Lunch/.test(b.label); });
    if (!lunchDone && busy.length) day.flags.push("Lunch falls inside “" + busy[0].label + "” — arrange packed lunch at the venue.");

    day.blocks = morning.concat(timeline).sort(function (a, b) { return a.from - b.from; });
    day.wake = wake; day.leave = leaveStay; day.back = home; day.sleep = sleepAt;
    const earliest = toMin(D.earliestWake), latest = toMin(D.latestSleep) + 1440;
    if (wake < earliest) day.flags.push("Early call: wake-up at " + hm(wake) + ".");
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
    if (departOut + outMin - 1440 > first.b.start - first.b.before - fresh) day.flags.push("Leaving " + originLabel + " at " + hm(departOut) + " the night before arrives " + hm(departOut + outMin - 1440) + " — later than the venue call.");
    const arriveOut = departOut + outMin - 1440; // minutes into this day
    day.nightOut = { date: prevDate, depart: departOut, arrive: arriveOut, travel: out, to: dest ? dest.name : first.ev.venue, fromVenue: fromVenue, fromLabel: originLabel };
    timeline.push(block("leg", arriveOut, null, "Arrive " + (dest ? dest.name : first.ev.venue) + " after the overnight drive", { travel: out, detail: legDetail(out, 0) + " · left " + originLabel + " " + hm(departOut) + " on " + dateLabel(prevDate), overnight: true }));
    if (out.min != null) { day.travelMin += out.min; day.km += out.km || 0; }
    const bfEnd = arriveOut + fresh;
    timeline.push(block("meal", arriveOut, bfEnd, "Freshen up & breakfast on arrival", { broad: true }));
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
      if (arrive > x.b.start) day.flags.push("“" + x.ev.title + "” starts before the group can be ready (" + hm(arrive) + ").");
      if (x.b.start > arrive) timeline.push(block("buffer", arrive, x.b.start, "At venue — set-up & settle", { minutes: Math.round(x.b.start - arrive) }));
      timeline.push(block("show", x.b.start, x.b.end, x.ev.title, { ev: x.ev, venue: x.venue }));
      here = x.b.end + x.b.after;
      timeline.push(block("buffer", x.b.end, here, "Wrap — pack, meet people, load-out", { minutes: x.b.after }));
    });
    const lo = toMin(D.lunchWindow[0]), lc = toMin(D.lunchWindow[1]);
    if (evs.some(function (x) { return x.b.start < lc && x.b.end > lo; })) day.flags.push("Lunch falls inside the programme — arrange it at the venue.");
    // Dinner in town, then the night drive home.
    const dinnerAt = Math.max(here, toMin(D.dinnerWindow[0]));
    timeline.push(block("meal", dinnerAt, dinnerAt + D.dinner, "Dinner near " + (last.venue ? last.venue.name : last.ev.venue)));
    const back0 = ctx.travel(last.idx, stayIdx, dateISO, departAfter);
    const backMin = back0.min == null ? 360 : back0.min;
    const departBack = Math.min(1425, Math.max(dinnerAt + D.dinner, departAfter, morning + 1440 - backMin));
    if (departBack > dinnerAt + D.dinner + 15) timeline.push(block("hold", dinnerAt + D.dinner, departBack, "Rest before the night drive", { inTown: true }));
    const back = ctx.travel(last.idx, stayIdx, dateISO, departBack);
    const arriveHome = departBack + backMin; // > 1440 → next morning
    timeline.push(block("leg", departBack, null, "Leave for the stay — overnight drive", { travel: back, detail: legDetail(back, 0) + " · home about " + hm(arriveHome), overnight: true }));
    if (back.min != null) { day.travelMin += back.min; day.km += back.km || 0; }
    day.nightBack = { date: nextDate, depart: departBack, arrive: arriveHome - 1440, travel: back, from: last.venue ? last.venue.name : last.ev.venue };
    day.blocks = timeline.sort(function (a, b) { return a.from - b.from; });
    day.wake = arriveOut; day.leave = departOut - 1440; day.back = arriveHome; day.sleep = departBack;
    day.legs = [];
    day.flags.push("Overnight travel both ways: sleep on the road out (" + dur(outMin) + ") and back (" + dur(backMin) + "). A sleeper coach is worth booking for these two nights.");
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
        prev.blocks.push(block("meal", cut, cut + dinnerLen, "Dinner near " + n.fromLabel));
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

  function mealHint(from, to, D) {
    const lo = toMin(D.lunchWindow[0]), lc = toMin(D.lunchWindow[1]);
    if (from < lc && to > lo && (Math.min(to, lc) - Math.max(from, lo)) >= 45) return " · lunch here";
    return "";
  }
  function legDetail(tr, loadOut) {
    if (!tr || tr.min == null) return "travel time unknown";
    const src = tr.source === "google-traffic" ? "live traffic" : tr.source === "same" ? "" : "est. with traffic";
    return dur(tr.min) + (tr.km != null ? " · " + Math.round(tr.km) + " km" : "") + (src ? " · " + src : "") + (loadOut ? " · " + loadOut + " min loading first" : "");
  }

  /* ---------- tour + comparison ---------- */
  function planTour(ctx, events, stay) {
    const dates = events.map(function (e) { return e.date; });
    if (!dates.length) return { stay: stay, days: [], totals: {} };
    const first = dates.reduce(function (a, b) { return a < b ? a : b; });
    const last = dates.reduce(function (a, b) { return a > b ? a : b; });
    const days = [];
    for (let d = first; d <= last; d = addDays(d, 1)) {
      days.push(planDay(ctx, d, events.filter(function (e) { return e.date === d; }), stay, days[days.length - 1]));
    }
    days.forEach(function (day, i) { if (day.kind === "outstation") stitchOvernight(days, i); });
    const t = { travelMin: 0, km: 0, showDays: 0, restDays: 0, earlyCalls: 0, lateNights: 0, earliestWake: null, latestSleep: null, holdsInTown: 0, longestDay: 0 };
    const D = ctx.cfg.day;
    days.forEach(function (day) {
      t.travelMin += day.travelMin; t.km += day.km;
      if (day.kind === "rest") { t.restDays++; return; }
      t.showDays++;
      if (day.wake < toMin(D.earliestWake)) t.earlyCalls++;
      if (day.sleep > toMin(D.latestSleep) + 1440) t.lateNights++;
      t.earliestWake = t.earliestWake == null ? day.wake : Math.min(t.earliestWake, day.wake);
      t.latestSleep = t.latestSleep == null ? day.sleep : Math.max(t.latestSleep, day.sleep);
      t.holdsInTown += day.blocks.filter(function (b) { return b.type === "hold" && b.inTown; }).length;
      t.longestDay = Math.max(t.longestDay, day.back - day.leave);
    });
    const veh = (ctx.cfg.party.vehicles || [])[0] || { ratePerKm: 0, minPerDay: 0, count: 1 };
    t.vehicleCost = days.reduce(function (s, day) { return s + Math.max(day.km * (veh.ratePerKm || 0), day.kind === "rest" ? 0 : (veh.minPerDay || 0)); }, 0) * (veh.count || 1);
    return { stay: stay, days: days, totals: t };
  }
  function compareStays(ctx, events, stays) {
    const rows = stays.map(function (s) { const p = planTour(ctx, events, s); return { stay: s, totals: p.totals, plan: p }; });
    const best = rows.slice().sort(function (a, b) { return a.totals.travelMin - b.totals.travelMin; })[0];
    rows.forEach(function (r) { r.deltaMin = best ? r.totals.travelMin - best.totals.travelMin : 0; r.best = r === best; });
    return rows;
  }

  /* ---------- live-traffic refinement (async, optional) ---------- */
  // For every leg in a plan, ask the bridge for the traffic-aware time at that
  // departure, fill the leg cache, and return true if anything changed. The
  // caller then re-plans synchronously.
  async function refineWithBridge(ctx, plan) {
    if (!CONFIG.LOGISTICS_URL) return false;
    let changed = false;
    for (const day of plan.days) {
      for (const leg of day.legs) {
        if (!leg.travel || leg.travel.source === "google-traffic") continue;
        const a = ctx.points.findIndex(function (p) { return p.key === pointKeyFor(ctx, leg, day, true); });
        const b = ctx.points.findIndex(function (p) { return p.key === pointKeyFor(ctx, leg, day, false); });
        if (a < 0 || b < 0) continue;
        const bucket = Math.floor(leg.depart / 15);
        const ck = ctx.points[a].key + "|" + ctx.points[b].key + "|" + day.date + "|" + bucket;
        if (ctx.legCache[ck]) continue;
        try {
          const departISO = day.date + "T" + pad(Math.floor(leg.depart / 60) % 24) + ":" + pad(leg.depart % 60) + ":00+05:30";
          const r = await providers.bridge.leg(ctx.points[a], ctx.points[b], departISO);
          ctx.legCache[ck] = { min: r.min, km: r.km, source: "google-traffic" };
          changed = true;
        } catch (e) { ctx.warnings.push("Live traffic unavailable for one leg: " + e.message); return changed; }
      }
    }
    return changed;
  }
  function pointKeyFor(ctx, leg, day, isFrom) {
    const name = isFrom ? leg.from : leg.to;
    if (name === "the stay") return pkey(day.stay);
    const v = ctx.venues.items.find(function (x) { return x.name === name; });
    return v ? pkey(v) : "";
  }

  /* ---------- config helpers ---------- */
  function activeStays(cfg) { return (cfg.stays || []).filter(function (s) { return s.active !== false && s.lat != null; }); }
  function encodeShare(cfg) {
    const slim = { v: cfg.version || 1, party: cfg.party, stays: cfg.stays, day: cfg.day, buffers: cfg.buffers, overrides: cfg.overrides, provider: cfg.provider, traffic: cfg.traffic, excludeStatuses: cfg.excludeStatuses, venueOverrides: cfg.venueOverrides || [] };
    return btoa(unescape(encodeURIComponent(JSON.stringify(slim)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function decodeShare(s) {
    try { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch (e) { return null; }
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
    return { cfg: cfg, venues: venues, events: events, fromSheet: !!tsv };
  }

  global.Logistics = {
    CONFIG: CONFIG, providers: providers, Ctx: Ctx, VenueBook: VenueBook,
    load: load, parseSchedule: parseSchedule, planDay: planDay, planTour: planTour, compareStays: compareStays,
    refineWithBridge: refineWithBridge, activeStays: activeStays, encodeShare: encodeShare, decodeShare: decodeShare,
    parseLatLon: parseLatLon, geocode: geocode, deepMerge: deepMerge, clone: clone,
    esc: esc, hm: hm, dur: dur, toMin: toMin, dateLabel: dateLabel, slug: slug, pad: pad,
  };
})(window);
