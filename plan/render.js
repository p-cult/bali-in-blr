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
    return (n === 1 ? "1 event" : n + " events") + " · leave " + hm(day.leave) + " · back " + hm(day.back) +
      " · " + dur(day.travelMin) + " on the road" + (day.km ? " · " + Math.round(day.km) + " km" : "");
  }

  function blockRow(b, opts) {
    const cls = ["tl-row", "tl-" + b.type, b.broad ? "tl-broad" : ""].join(" ");
    let when = hm(b.from) + (b.to != null ? " – " + hm(b.to) : "");
    let body = "<b>" + esc(b.label) + "</b>";
    if (b.type === "leg") body += "<span class='tl-detail'>" + esc(b.detail) + "</span>";
    if (b.type === "show") {
      body += "<span class='tl-detail'>" + esc((b.ev && b.ev.category) || "") + (b.venue ? " · " + esc(b.venue.name) + (b.venue.area ? ", " + esc(b.venue.area) : "") : "") +
        (b.ev && b.ev.extra ? " · internal engagement" : b.ev && b.ev.notPublic ? " · not public" : "") + (b.ev && b.ev.note ? " · " + esc(b.ev.note) : "") + "</span>";
      if (opts.editable && b.ev && !b.showIndex) body += bufferEditor(b.ev, opts.cfg);
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
      html += "<span class='muted'>at " + esc(b.at) + "</span><button class='btn btn-sm' type='button' data-mealdefault>Back to default (where they are)</button>";
    } else {
      html += "<label>Time <input type='time' data-k='start' value='" + hhmm(b.from) + "'></label>" +
        "<label>Length <input type='number' min='10' step='5' data-k='minutes' value='" + Math.round(len) + "'> min</label>" +
        "<label>Note <input type='text' data-k='note' value='" + esc(o.note || "") + "' placeholder='e.g. packed, veg only'></label>" +
        "<label>Elsewhere <input type='text' data-k='where' placeholder='Google Maps link, address or lat, lon'></label><button class='btn btn-sm' type='button' data-mealgo>Go there</button>" +
        (b.edited ? "<button class='btn btn-sm' type='button' data-mealreset>Reset</button>" : "");
    }
    return html + "</span>";
  }
  function bufferEditor(ev, cfg) {
    const o = (cfg.overrides || {})[ev.id] || {};
    const b = cfg.buffers[ev.category] || cfg.buffers.default;
    const f = function (k, label) { return "<label>" + label + " <input type='number' min='0' step='5' data-k='" + k + "' value='" + esc(o[k] != null ? o[k] : (b[k] != null ? b[k] : 0)) + "'></label>"; };
    return "<span class='tl-edit' data-ev='" + esc(ev.id) + "'>" +
      f("setup", "Set-up") + f("soundcheck", "Sound check") + f("ready", "Costume & warm-up") + f("change", "Costume off") + f("after", "Wrap") +
      "<label>Note <input type='text' data-k='note' value='" + esc(o.note || "") + "' placeholder='e.g. gamelan on stage by 5pm'></label>" +
      "<label class='tl-skip'><input type='checkbox' data-k='skip'" + (o.skip ? " checked" : "") + "> skip</label>" +
      "</span>";
  }
  function dayCard(day, opts) {
    opts = opts || {};
    const open = opts.open ? " open" : "";
    const flags = day.flags.length ? "<ul class='day-flags'>" + day.flags.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul>" : "";
    const events = day.events.length ? "<p class='day-events'>" + day.events.map(function (e) {
      return "<span class='day-ev" + (e.notPublic ? " day-ev-private" : "") + "'>" + esc(e.title) + (e.start != null ? " <i>" + hm(e.start) + "</i>" : "") + "</span>";
    }).join("") + "</p>" : "";
    const meals = opts.editable && day.kind !== "outstation" ? stopEditor(day, opts.cfg) : "";
    return "<details class='day day-" + day.kind + "'" + open + " data-date='" + day.date + "'>" +
      "<summary><span class='day-date'>" + esc(L.dateLabel(day.date)) + "</span><span class='day-sum'>" + esc(summaryLine(day)) + "</span></summary>" +
      "<div class='day-body'>" + events + flags + meals +
      "<div class='timeline'>" + day.blocks.map(function (b) { return blockRow(b, Object.assign({}, opts, { date: day.date })); }).join("") + "</div>" +
      "</div></details>";
  }

  function tour(plan, opts) {
    opts = opts || {};
    return plan.days.map(function (d) { return dayCard(d, Object.assign({}, opts, { open: opts.openAll || opts.openDate === d.date })); }).join("");
  }

  function totalsCard(plan) {
    const t = plan.totals;
    if (!plan.days.length) return "";
    const party = plan.party || {};
    const seats = (party.vehicles || []).reduce(function (n, v) { return n + (v.seats || 0) * (v.count || 1); }, 0);
    const who = party.artists != null ? party.artists + " artists + " + (party.volunteers || 0) + " volunteers" : (party.size || "—") + " people";
    return "<div class='totals'>" +
      stat("Travelling", who + (party.vehicles && party.vehicles[0] ? " · " + (party.vehicles[0].count || 1) + " × " + party.vehicles[0].name : "")) +
      stat("Days", plan.days.length + " (" + t.showDays + " with events)") +
      stat("Road time", dur(t.travelMin)) +
      stat("Distance", Math.round(t.km) + " km") +
      stat("Earliest wake", hm(t.earliestWake)) +
      stat("Latest lights out", hm(t.latestSleep)) +
      stat("Early calls", t.earlyCalls) +
      stat("Holds in town", t.holdsInTown) +
      stat("Vehicle est.", "₹" + Math.round(t.vehicleCost).toLocaleString("en-IN")) +
      "</div>";
  }
  function stat(k, v) { return "<div class='stat'><span class='stat-k'>" + esc(k) + "</span><span class='stat-v'>" + esc(v) + "</span></div>"; }

  function compareTable(rows) {
    if (rows.length < 2) return "<p class='muted'>Add a second stay option to compare.</p>";
    const head = "<thead><tr><th>Stay</th><th>Road time</th><th>vs best</th><th>Distance</th><th>Avg / show day</th><th>Earliest wake</th><th>Latest lights out</th><th>Early calls</th><th>Holds in town</th><th>Vehicle est.</th></tr></thead>";
    const body = rows.map(function (r) {
      const t = r.totals;
      return "<tr class='" + (r.best ? "best" : "") + "'><td><b>" + esc(r.stay.name) + "</b>" + (r.best ? " <span class='tag'>least travel</span>" : "") + "<br><small>" + esc(r.stay.address || "") + "</small></td>" +
        "<td>" + dur(t.travelMin) + "</td><td>" + (r.deltaMin ? "+" + dur(r.deltaMin) : "—") + "</td><td>" + Math.round(t.km) + " km</td>" +
        "<td>" + dur(t.showDays ? t.travelMin / t.showDays : 0) + "</td><td>" + hm(t.earliestWake) + "</td><td>" + hm(t.latestSleep) + "</td>" +
        "<td>" + t.earlyCalls + "</td><td>" + t.holdsInTown + "</td><td>₹" + Math.round(t.vehicleCost).toLocaleString("en-IN") + "</td></tr>";
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

  global.LogisticsRender = { dayCard: dayCard, tour: tour, totalsCard: totalsCard, compareTable: compareTable, compareDays: compareDays, summaryLine: summaryLine };
})(window);
