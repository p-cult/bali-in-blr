/* Rendering for the logistics plan — shared by the planner and the public page.
   Read-only by default; the planner passes editable:true to get per-event
   buffer inputs inside each day. Every sheet value goes through esc(). */
(function (global) {
  "use strict";
  const L = global.Logistics;
  const esc = L.esc, hm = L.hm, dur = L.dur;

  function summaryLine(day) {
    if (day.kind === "rest") return "Rest day · no travel";
    if (day.mealsOnly) return "No programme · add-ons only · leave " + hm(day.leave) + " · back " + hm(day.back) + " · " + dur(day.travelMin) + " on the road · " + Math.round(day.km) + " km";
    if (day.kind === "outstation") return day.events.length + " event · out of town · arrive " + hm(day.wake) + " after the overnight drive · leave " + hm(day.sleep) + " for the night drive home · " + dur(day.travelMin) + " on the road";
    const n = day.events.length;
    if (day.nightDeparture) return (n === 1 ? "1 event" : n + " events") + " · leave " + hm(day.leave) + " · overnight coach to " + day.nightTo + " at " + hm(day.sleep) + (day.back == null ? " straight from the venue" : "") + " · " + dur(day.travelMin) + " in town";
    return (n === 1 ? "1 event" : n + " events") + (day.travelling ? " · " + day.travelling + " artists" : "") + " · leave " + hm(day.leave) + " · back " + hm(day.back) +
      " · " + dur(day.travelMin) + " on the road" + (day.km ? " · " + Math.round(day.km) + " km" : "");
  }

  // The same facts as summaryLine, but set for the eye: pills for what kind
  // of day it is, times in ink with an arrow between out and back, the
  // road as one quiet pill at the end. Thin pipes keep the groups apart.
  function summaryHTML(day) {
    const pill = function (t, k) { return "<span class='ds-pill" + (k ? " ds-" + k : "") + "'>" + esc(t) + "</span>"; };
    const sep = "<span class='ds-sep' aria-hidden='true'>|</span>";
    const road = function () { return day.travelMin ? pill(dur(day.travelMin) + (day.km ? " · " + Math.round(day.km) + " km" : ""), "road") : ""; };
    // One pip per event, so two events read differently from one at a glance.
    const n = day.events.length;
    const evs = "<span class='ds-pill ds-ev" + (n > 1 ? " ds-ev-many" : "") + "'><span class='ds-pips' aria-hidden='true'>" + "●".repeat(Math.min(n, 4)) + "</span>" + (n === 1 ? "1 event" : n + " events") + "</span>";
    const t = function (label, v) { return "<span class='ds-t'>" + esc(label) + " <b>" + esc(hm(v)) + "</b></span>"; };
    const arrow = "<span class='ds-arrow' aria-hidden='true'>→</span>";
    if (day.kind === "rest") return "<span class='ds'>" + pill("Rest day", "rest") + sep + "<span class='ds-muted'>no travel</span></span>";
    if (day.mealsOnly) return "<span class='ds'>" + pill("Add-ons only", "rest") + sep + t("leave", day.leave) + arrow + t("back", day.back) + sep + road() + "</span>";
    if (day.kind === "outstation") return "<span class='ds'>" + evs + pill("Out of town", "far") + sep + t("arrive", day.wake) + "<span class='ds-muted'>after the overnight drive</span>" + arrow + t("night drive home", day.sleep) + sep + road() + "</span>";
    if (day.nightDeparture) return "<span class='ds'>" + evs + pill("Overnight coach", "far") + sep + t("leave", day.leave) + arrow + t("coach to " + day.nightTo, day.sleep) + (day.back == null ? "<span class='ds-muted'>straight from the venue</span>" : "") + sep + road() + "</span>";
    const who = (day.travelling ? "<span class='ds-muted'>" + day.travelling + (day.travelling === 1 ? " artist" : " artists") + "</span>" : "") +
      (day.smallVehicle || day.vehicleChosen ? pill((day.vehicles > 1 ? day.vehicles + " × " : "") + String(day.vehicle.name).replace(/\s*\(.*\)$/, ""), "veh") :
        day.vehicles && day.fleet > 1 && day.vehicles < day.fleet ? pill(day.vehicles + " vehicle" + (day.vehicles > 1 ? "s" : ""), "veh") : "");
    return "<span class='ds'>" + evs + who + sep + t("leave", day.leave) + arrow + t("back", day.back) + sep + road() + "</span>";
  }

  // The production vehicle (assets/truck.svg); drawn facing right, so it
  // points at the venue on the way out and is mirrored on the way back.
  const TRUCK = "<svg class='truck-icon' viewBox='0 0 13.91 7.58' aria-hidden='true' focusable='false'><path fill='currentColor' d='M13.68,6.37h-.97c0-.4-.17-.78-.49-1.05-.65-.55-1.62-.49-2.19.15-.22.25-.33.56-.34.9h-5.49c0-.36-.12-.67-.36-.92-.58-.63-1.58-.67-2.21-.09-.29.27-.44.63-.44,1.01H.24c-.13,0-.22-.08-.24-.21v-.53c0-.15.13-.22.29-.24V.48C.3.17.62,0,.9,0h7.63c.27,0,.56.19.56.48v4.91c.1.03.18.03.29,0V1.39c0-.11.16-.19.25-.19h2.24c.22,0,.42.11.53.29l1.06,1.75c.1.17.16.33.16.53v1.63c.12.02.26.06.28.17.04.2.02.4.01.6,0,.1-.1.2-.22.2ZM12.7,3.45c.09,0,.17-.1.13-.17l-.9-1.51h-1.81s-.02,1.52-.02,1.52c0,.09.06.17.15.17h2.45Z'/><path fill='currentColor' d='M12.41,6.37c0,.67-.54,1.21-1.21,1.21s-1.21-.54-1.21-1.21.54-1.21,1.21-1.21,1.21.54,1.21,1.21ZM11.2,6.85c.3,0,.51-.23.5-.49,0-.24-.19-.44-.45-.47-.28-.03-.52.18-.54.43-.03.27.18.53.49.54Z'/><path fill='currentColor' d='M3.91,6.37c0,.67-.54,1.21-1.21,1.21s-1.21-.54-1.21-1.21.54-1.21,1.21-1.21,1.21.54,1.21,1.21ZM3.19,6.37c0-.27-.22-.49-.49-.49s-.49.22-.49.49.22.49.49.49.49-.22.49-.49Z'/></svg>";
  function blockRow(b, opts) {
    const cls = ["tl-row", "tl-" + b.type, b.broad ? "tl-broad" : "", b.type === "truck" ? "truck-" + (b.dir || "out") : ""].join(" ");
    let when = hm(b.from) + (b.to != null ? " – " + hm(b.to) : "");
    const canEditShow = b.type === "show" && opts.editable && opts.eventEditor !== false && b.ev && !b.showIndex;
    let body = "<b>" + (b.type === "truck" ? TRUCK : "") + esc(b.label) + "</b>" + (b.meal && opts.editable ? "<button type='button' class='meal-toggle no-print' data-mealtoggle>edit</button>" : "") +
      (canEditShow ? "<button type='button' class='meal-toggle no-print' data-showtoggle>edit</button>" : "");
    if (b.type === "leg" || b.type === "truck") body += "<span class='tl-detail'>" + esc(b.detail) + "</span>";
    if (b.type === "show") {
      body += "<span class='tl-detail'>" + esc((b.ev && b.ev.category) || "") + (b.venue ? " · " + esc(b.venue.name) + (b.venue.area ? ", " + esc(b.venue.area) : "") : "") +
        (b.ev && b.ev.extra ? " · internal engagement" : b.ev && b.ev.notPublic ? " · not public" : "") + (b.ev && b.ev.note ? " · " + esc(b.ev.note) : "") + "</span>";
      if (b.artists != null || b.cast) body += "<span class='tl-detail tl-cast'>" + (b.artists != null ? b.artists + " artists" : "") + (b.artists != null && b.cast ? " · " : "") + esc(b.cast || "") + "</span>";
      if (canEditShow) body += bufferEditor(b.ev, opts.cfg);
    }
    if (b.type === "buffer") body += "<span class='tl-detail'>" + b.minutes + " min" + (b.short ? " · " + b.short + " min short — arrival is late" : "") + "</span>";
    if (b.meal && opts.editable) body += mealEditorRow(b, opts.date, opts.cfg);
    if (b.note) body += "<span class='tl-detail'>" + esc(b.note) + "</span>";
    return "<div class='" + cls + "'><span class='tl-when'>" + when + "</span><span class='tl-body'>" + body + "</span></div>";
  }
  function hhmm(min) { const m = ((Math.round(min) % 1440) + 1440) % 1440; return L.pad(Math.floor(m / 60)) + ":" + L.pad(m % 60); }
  // Inline editor for a meal line: time, length, note, and a location
  // (which turns the meal into an add-on stop). Default = where they are.
  function mealEditorRow(b, date, cfg) {
    const o = ((cfg.mealPlan || {})[date] || {})[b.meal] || {};
    const len = b.to != null ? b.to - b.from : 45;
    let html = "<span class='tl-edit meal-edit' data-meal='" + esc(b.meal) + "' data-date='" + esc(date) + "'>";
    if (b.out) {
      html += "<span class='muted'>at " + esc(b.at) + "</span><button class='btn btn-sm' type='button' data-mealdefault>Back to default (where they are)</button>" +
        "<button class='btn btn-sm btn-ghost' type='button' data-mealdone>Done</button>";
    } else {
      html += "<label>Time <input type='time' data-k='start' value='" + hhmm(b.from) + "'></label>" +
        "<label>Length <input type='number' min='10' step='5' data-k='minutes' value='" + Math.round(len) + "'> min</label>" +
        "<label>Note <input type='text' data-k='note' value='" + esc(o.note || "") + "' placeholder='e.g. packed, veg only'></label>" +
        "<label>Move elsewhere <input type='text' data-k='where' placeholder='Google Maps link, address or lat, lon'></label><button class='btn btn-sm' type='button' data-mealgo>Move here</button>" +
        (b.edited ? "<button class='btn btn-sm' type='button' data-mealreset>Reset</button>" : "") +
        "<button class='btn btn-sm btn-ghost' type='button' data-mealdone>Done</button>";
    }
    return html + "</span>";
  }
  function bufferEditor(ev, cfg) {
    const o = (cfg.overrides || {})[ev.id] || {};
    const b = cfg.buffers[ev.category] || cfg.buffers.default;
    const f = function (k, label) { return "<label>" + label + " <input type='number' min='0' step='5' data-k='" + k + "' value='" + esc(o[k] != null ? o[k] : (b[k] != null ? b[k] : 0)) + "'></label>"; };
    return "<span class='tl-edit' data-ev='" + esc(ev.id) + "'>" +
      "<label>Artists <input type='number' min='0' data-k='artists' value='" + esc(o.artists != null ? o.artists : "") + "' placeholder='" + esc(cfg.party.artists) + "'></label>" +
      "<label>Cast <input type='text' data-k='cast' value='" + esc(o.cast || "") + "' placeholder='names or group, e.g. Kecak troupe'></label>" +
      f("setup", "Set-up (0 = no instrument vehicle)") + f("soundcheck", "Sound check") + f("ready", "Costume & warm-up") + f("change", "Costume off") + f("after", "Wrap") +
      "<label>Note <input type='text' data-k='note' value='" + esc(o.note || "") + "' placeholder='e.g. gamelan on stage by 5pm'></label>" +
      "<label>Instruments at venue by <input type='time' data-k='instrAt' value='" + (o.instrAt != null ? hhmm(o.instrAt) : "") + "'></label>" +
      "<label class='tl-skip'><input type='checkbox' data-k='skip'" + (o.skip ? " checked" : "") + "> skip this show</label>" +
      "<span class='tl-edit-actions'><button class='btn btn-sm btn-primary' type='button' data-showapply>Apply &amp; re-time</button>" +
      "<button class='btn btn-sm' type='button' data-showreset title='Back to this type\u2019s defaults'>Reset</button>" +
      "<button class='btn btn-sm btn-ghost' type='button' data-showdone>Done</button></span>" +
      "</span>";
  }
  // Day add-ons (planner only): stops with a purpose, a location and optional
  // HH:MM times. Blank list = default day.
  function stopEditor(day, cfg) {
    const list = ((cfg.stops || {})[day.date]) || [];
    const rows = list.map(function (p, i) {
      const when = p.start ? p.start + (p.end ? " – " + p.end : "") : "auto";
      return "<div class='addon-row'><span class='pill on'>" + esc(L.PURPOSE[p.purpose] || "Stop") + "</span><span class='addon-name'>" +
        (p.link ? "<a href='" + esc(p.link) + "' target='_blank' rel='noopener'>" + esc(p.name) + "</a>" : esc(p.name)) + (p.area ? " <small>" + esc(p.area) + "</small>" : "") +
        (p.lat == null ? " <small class='prec low'>NOT LOCATED</small>" : "") + "</span><span class='addon-when'>" + esc(when) + "</span>" +
        "<button class='btn btn-sm' type='button' data-stoprm='" + i + "'>remove</button></div>";
    }).join("");
    const opts = Object.keys(L.PURPOSE).map(function (k) { return "<option value='" + k + "'>" + esc(L.PURPOSE[k]) + "</option>"; }).join("");
    return "<div class='addons' data-date='" + day.date + "'>" + rows +
      "<button type='button' class='addon-toggle no-print' data-addontoggle>+ Add a stop (meal out, sightseeing, shopping…)</button>" +
      "<div class='addon-add'><select data-k='purpose'>" + opts + "</select>" +
      "<input type='text' data-k='where' placeholder='Google Maps link, address or lat, lon'>" +
      "<input type='time' data-k='start' title='Start (optional)'><input type='time' data-k='end' title='End (optional)'>" +
      "<button class='btn btn-sm' type='button' data-stopadd>Add</button>" +
      "<button class='btn btn-sm btn-ghost' type='button' data-stopcancel title='Close without adding'>Cancel</button></div></div>";
  }

  function dayCard(day, opts) {
    opts = opts || {};
    const open = opts.open ? " open" : "";
    const flags = day.flags.length ? "<ul class='day-flags'>" + day.flags.map(function (f) {
      const isRed = f && f.level === "red"; const text = isRed ? f.text : f;
      return "<li class='" + (isRed ? "flag-red" : "") + "'>" + (isRed ? "<b>Red flag:</b> " : "") + esc(text) + "</li>";
    }).join("") + "</ul>" : "";
    const events = day.events.length ? "<p class='day-events'>" + day.events.map(function (e) {
      return "<span class='day-ev" + (e.notPublic ? " day-ev-private" : "") + "'>" + esc(e.title) + (e.start != null ? " <i>" + hm(e.start) + "</i>" : "") + "</span>";
    }).join("") + "</p>" : "";
    const meals = opts.editable && day.kind !== "outstation" ? stopEditor(day, opts.cfg) : "";
    // Per-day vehicle choice (admin): Auto, or any type from Settings → Transport.
    const vehiclePick = opts.editable && day.kind !== "rest" ? (function () {
      const cur = ((opts.cfg.dayVehicle || {})[day.date]) || "";
      const list = (opts.cfg.party.vehicles || []).map(function (v) { return "<option value='" + esc(v.name) + "'" + (cur === v.name ? " selected" : "") + ">" + esc(v.name) + "</option>"; }).join("");
      return "<label class='day-veh no-print'>Vehicle <select data-dayveh='" + day.date + "'><option value=''" + (cur ? "" : " selected") + ">Auto · " + esc(day.vehicle ? (day.vehicles > 1 ? day.vehicles + " × " : "") + day.vehicle.name : "") + "</option>" + list + "</select></label>";
    })() : "";
    return "<details class='day day-" + day.kind + (day.red ? " day-red" : "") + "'" + open + " data-date='" + day.date + "'>" +
      "<summary><span class='day-date'>" + esc(L.dateLabel(day.date)) + "</span>" + (day.red ? "<span class='badge-red'>Red flag</span>" : "") + "<span class='day-sum'>" + summaryHTML(day) + "</span></summary>" +
      "<div class='day-body'><button class='btn btn-sm day-print no-print' type='button' data-printday='" + day.date + "'>Print this day</button>" + vehiclePick + events + flags + meals +
      "<div class='timeline'>" + day.blocks.map(function (b) { return blockRow(b, Object.assign({}, opts, { date: day.date })); }).join("") + "</div>" +
      "</div></details>";
  }

  function tour(plan, opts) {
    opts = opts || {};
    return plan.days.map(function (d) { return dayCard(d, Object.assign({}, opts, { open: opts.openAll || opts.openDate === d.date })); }).join("");
  }

  // opts.internal shows money (vehicle estimate); the public page never does.
  // One line that says who is travelling, how much road there is, and what
  // needs a look — nothing else. Anything zero is left out.
  function totalsCard(plan, opts) {
    const t = plan.totals; opts = opts || {};
    if (!plan.days.length) return "";
    const party = plan.party || {};
    const v0 = party.vehicles && party.vehicles[0];
    const who = party.artists != null ? party.artists + " artists + " + (party.volunteers || 0) + " volunteers" : (party.size || "—") + " people";
    const others = (party.vehicles || []).slice(1).map(function (v) { return (v.count > 1 ? v.count + " × " : "") + esc(v.name) + " on small days"; });
    const veh = v0 ? (v0.count || 1) + " × " + esc(v0.name) + (v0.seats && !/seat/i.test(v0.name) ? " (" + v0.seats + " seats)" : "") + (others.length ? " · " + others.join(" · ") : "") : "";
    const flags = [];
    if (t.redDays) flags.push("<span class='chip chip-red' title='Days where something does not fit: open the day to see what'>" + t.redDays + " red-flag day" + (t.redDays > 1 ? "s" : "") + "</span>");
    if (t.earlyCalls) flags.push("<span class='chip chip-warn' title='Days that start before 6 am'>" + t.earlyCalls + " early call" + (t.earlyCalls > 1 ? "s" : "") + " · from " + hm(t.earliestWake) + "</span>");
    if (t.latestSleep > 24 * 60) flags.push("<span class='chip chip-warn' title='Latest the group gets to bed'>late night · lights out " + hm(t.latestSleep) + "</span>");
    if (t.holdsInTown) flags.push("<span class='chip' title='Gaps spent in town rather than going back to the stay'>" + t.holdsInTown + " hold" + (t.holdsInTown > 1 ? "s" : "") + " in town</span>");
    if (!flags.length) flags.push("<span class='chip chip-ok'>nothing to flag</span>");
    return "<div class='glance'>" +
      "<div class='glance-g'><span class='glance-k'>Travelling</span><b>" + esc(who) + "</b>" + (veh ? "<small>" + veh + "</small>" : "") + "</div>" +
      "<div class='glance-g'><span class='glance-k'>On the road</span><b>" + dur(t.travelMin) + " over " + t.showDays + " show days</b><small>" + Math.round(t.km) + " km · " + plan.days.length + " days in all" +
        (opts.internal ? " · vehicle estimate ₹" + Math.round(t.vehicleCost).toLocaleString("en-IN") : "") + "</small>" +
        "<small>Instrument vehicle, separately: " + (t.truckKnown ? Math.round(t.truckKm) + " km · " + dur(t.truckMin) : "km counted once its storage place is set") + "</small></div>" +
      "<div class='glance-g glance-flags'><span class='glance-k'>Needs a look</span><span class='chips'>" + flags.join("") + "</span></div>" +
      "</div>";
  }

  function compareTable(rows) {
    if (rows.length < 2) return "<p class='muted'>Add a second stay option to compare.</p>";
    const head = "<thead><tr><th>Stay</th><th>Road time</th><th>vs best</th><th>Distance</th><th>Avg / show day</th><th>Earliest wake</th><th>Latest lights out</th><th>Early calls</th><th>Red flags</th><th>Holds in town</th><th>Vehicle est.</th></tr></thead>";
    const body = rows.map(function (r) {
      const t = r.totals;
      return "<tr class='" + (r.best ? "best" : "") + "'><td><b>" + esc(r.stay.name) + "</b>" + (r.best ? " <span class='tag'>least travel</span>" : "") + "<br><small>" + esc(r.stay.address || "") + "</small></td>" +
        "<td>" + dur(t.travelMin) + "</td><td>" + (r.deltaMin ? "+" + dur(r.deltaMin) : "—") + "</td><td>" + Math.round(t.km) + " km</td>" +
        "<td>" + dur(t.showDays ? t.travelMin / t.showDays : 0) + "</td><td>" + hm(t.earliestWake) + "</td><td>" + hm(t.latestSleep) + "</td>" +
        "<td>" + t.earlyCalls + "</td><td class='" + (t.redDays ? "red" : "") + "'>" + (t.redDays || 0) + "</td><td>" + t.holdsInTown + "</td><td>₹" + Math.round(t.vehicleCost).toLocaleString("en-IN") + "</td></tr>";
    }).join("");
    return "<table class='cmp'>" + head + "<tbody>" + body + "</tbody></table>";
  }

  // Day-by-day comparison: leave/back per stay for each date.
  function compareDays(rows) {
    if (rows.length < 2) return "";
    const dates = rows[0].plan.days.map(function (d) { return d.date; });
    const head = "<thead><tr><th>Day</th>" + rows.map(function (r) { return "<th>" + esc(r.stay.name) + "</th>"; }).join("") + "</tr></thead>";
    const body = dates.map(function (date, i) {
      const cells = rows.map(function (r) {
        const d = r.plan.days[i];
        if (d.kind === "rest") return "<td class='muted'>rest</td>";
        const bestMin = Math.min.apply(null, rows.map(function (x) { return x.plan.days[i].travelMin; }));
        return "<td class='" + (d.travelMin === bestMin ? "best" : "") + "'>" + hm(d.leave) + " → " + hm(d.back) + "<br><small>" + dur(d.travelMin) + "</small></td>";
      }).join("");
      return "<tr><td>" + esc(L.dateLabel(date)) + "</td>" + cells + "</tr>";
    }).join("");
    return "<table class='cmp cmp-days'>" + head + "<tbody>" + body + "</tbody></table>";
  }

  global.LogisticsRender = { hhmm: hhmm, dayCard: dayCard, tour: tour, totalsCard: totalsCard, compareTable: compareTable, compareDays: compareDays, summaryLine: summaryLine };
})(window);
