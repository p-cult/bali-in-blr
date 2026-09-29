/* Sheet → print: reads a published Google Sheet (File → Share → Publish to
   web), lists its tabs, and lays each chosen tab out as a day in the style
   of the artist tour plan (plan/plan.css), ready to print or save as PDF.

   Each tab is a day sheet: a title block (date in C1, heading in D1, and
   "key | value" rows such as "Transport of the day") above a header row
   that has "What" in it, then one row per item: From | To | What | Detail.
   Used by admin/sheet-print.html; no sign-in here so the renderer can be
   reused. Every sheet value goes through esc(). */
(function (global) {
  "use strict";
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  // Any Sheets link → the published base ".../d/e/<id>" (publish-to-web
  // links only; a normal /edit link of a private sheet cannot be read).
  function pubBase(link) {
    const m = /https:\/\/docs\.google\.com\/spreadsheets\/d\/e\/([A-Za-z0-9_-]+)/.exec(String(link || ""));
    return m ? "https://docs.google.com/spreadsheets/d/e/" + m[1] : null;
  }
  async function listTabs(base) {
    const html = await fetch(base + "/pubhtml", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); });
    const tabs = [], re = /items\.push\(\{name: "((?:[^"\\]|\\.)*)", pageUrl: "[^"]*", gid: "(\d+)"/g;
    let m; while ((m = re.exec(html))) tabs.push({ name: JSON.parse('"' + m[1] + '"'), gid: m[2] });
    return tabs;
  }
  async function readTab(base, gid) {
    const tsv = await fetch(base + "/pub?gid=" + gid + "&single=true&output=tsv", { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); });
    return tsv.replace(/\r/g, "").split("\n").map(function (l) { return l.split("\t").map(function (c) { return c.trim(); }); });
  }
  // "2.00 pm" / "9.30am " / "14:00" → "2.00pm"
  function clock(s) {
    s = String(s || "").trim(); if (!s) return "";
    const m = /^(\d{1,2})[.:](\d{2})\s*([ap])\.?m?\.?$/i.exec(s);
    if (m) return +m[1] + "." + m[2] + m[3].toLowerCase() + "m";
    const h = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (h) { const hh = +h[1]; return (hh % 12 || 12) + "." + h[2] + (hh < 12 ? "am" : "pm"); }
    return s;
  }
  function parseDay(rows, tabName) {
    const head = rows.findIndex(function (r) { return r.some(function (c) { return /^what$/i.test(c); }); });
    const top = head < 0 ? [] : rows.slice(0, head);
    const day = { date: tabName, title: "", meta: [], items: [] };
    top.forEach(function (r, i) {
      const cells = r.filter(Boolean);
      if (!cells.length) return;
      if (i === 0) { day.date = cells[0] || tabName; day.title = cells.slice(1).join(" · "); return; }
      if (cells.length >= 2) day.meta.push({ k: cells[0], v: cells.slice(1).join(" · ") });
      else day.meta.push({ k: "", v: cells[0] });
    });
    const hdr = head < 0 ? ["From", "To", "What", "Where / detail"] : rows[head];
    const col = function (re, d) { const i = hdr.findIndex(function (c) { return re.test(c); }); return i < 0 ? d : i; };
    const cF = col(/^from$/i, 0), cT = col(/^to$/i, 1), cW = col(/^what$/i, 2), cD = col(/where|detail/i, 3);
    rows.slice(head + 1).forEach(function (r) {
      const it = { from: clock(r[cF]), to: clock(r[cT]), what: r[cW] || "", detail: r[cD] || "" };
      if (!it.from && !it.to && !it.what && !it.detail) return;
      if (!it.what && it.detail) { it.what = it.detail; it.detail = ""; }
      it.type = kind(it.what);
      day.items.push(it);
    });
    return day;
  }
  // Row look, matching the tour plan: travel, the show itself, meals and
  // refreshments, everything else plain.
  function kind(what) {
    const w = what.replace(/^→\s*/, "");
    if (/^→/.test(what) || /^(leave|depart|return|reach|pick-?up)\b/i.test(w)) return "leg";
    const letters = w.replace(/[^A-Za-z]/g, "");
    if (letters.length > 3 && letters === letters.toUpperCase()) return "show";
    if (/breakfast|lunch|dinner|refreshment|snack|coffee|\btea\b|meal/i.test(w)) return "meal";
    return "free";
  }
  function dayHTML(day) {
    const meta = day.meta.map(function (m) { return "<span class='sp-meta'>" + (m.k ? "<i>" + esc(m.k) + "</i> " : "") + "<b>" + esc(m.v) + "</b></span>"; }).join("");
    const rows = day.items.map(function (it) {
      const when = it.from ? esc(it.from) + (it.to ? " – " + esc(it.to) : "") : (it.to ? "until " + esc(it.to) : "");
      const what = esc(it.what.replace(/^→\s*/, ""));
      return "<div class='tl-row tl-" + it.type + "'><span class='tl-when'>" + when + "</span><span class='tl-body'><b>" + what + "</b>" +
        (it.detail ? "<span class='tl-detail'>" + esc(it.detail) + "</span>" : "") + "</span></div>";
    }).join("");
    return "<details class='day sp-day' open><summary><span class='day-date'>" + esc(day.date) + "</span>" +
      (day.title ? "<span class='day-sum'>" + esc(day.title) + "</span>" : "") + "</summary>" +
      "<div class='day-body'>" + (meta ? "<p class='sp-metas'>" + meta + "</p>" : "") +
      "<div class='timeline'>" + (rows || "<p class='muted'>Nothing on this tab yet.</p>") + "</div></div></details>";
  }
  global.SheetPrint = { esc: esc, pubBase: pubBase, listTabs: listTabs, readTab: readTab, parseDay: parseDay, dayHTML: dayHTML };
})(window);
