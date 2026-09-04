/* ============================================================
   Bali in Bengaluru — hub front-end
   ------------------------------------------------------------
   DATA BRIDGE CONFIG
   Set BRIDGE_URL to the deployed Apps Script Web App URL (the
   one ending in /exec) and everything switches over: signups
   POST to it, and the calendar/partners/stats read from the
   Sheet. Leave it "" and the site stays in Phase 1 mode —
   reading the local files in /data with the form in demo mode.
   See docs/BRIDGE-SETUP.md.
   ============================================================ */
const CONFIG = {
  // Paste your Apps Script Web App URL here, e.g.
  // "https://script.google.com/macros/s/AKfy.../exec"
  BRIDGE_URL: "https://script.google.com/macros/s/AKfycbyKXzPHQLsHCoryx0aJVpVkP0Z0XrnPxjucaiUJtR1aXeux33ygq2Br2QcBNU_MAB7qDw/exec",

  // The festival calendar, read live from the "Event List" tab of the
  // published schedule sheet. Columns: title, category, date, venue,
  // start time, end time, ticket link. Edit the sheet and the site follows.
  SCHEDULE_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTji37D6cT7J9bLFptJdNaYrvZF_soZyiqIsX-rHYUj4H6rnfMCExu2hIyVjCk48j86rdaBhp_lthzb/pub?gid=289612903&single=true&output=tsv",

  // Used when the sheet has no rows yet, or cannot be reached.
  LOCAL_EVENTS_URL: "data/events.json",
  LOCAL_PARTNERS_URL: "data/partners.json",
};

/* ---------- Analytics ----------
   Nothing loads until an id is filled in below, so the site ships with no
   trackers at all. Only ids and campaign refs are ever sent — never a name,
   email or phone. See docs/ANALYTICS.md. */
const ANALYTICS = {
  // Google Tag Manager is installed as Google's own snippet at the top of
  // <head> in index.html (GTM-5S6DXF7V), so it loads before anything else.
  // Left blank here on purpose — setting it would load a second copy.
  // Everything below announces itself to dataLayer, which GTM reads.
  GTM_ID: "",            // "GTM-XXXXXXX"

  // Or wire the tags directly, without GTM:
  GA4_ID: "",            // "G-XXXXXXXXXX"
  META_PIXEL_ID: "",     // "1234567890"
  GOOGLE_ADS_ID: "",     // "AW-XXXXXXXXX"
  // Optional: the conversion label Google Ads gives you, per form.
  GOOGLE_ADS_LABELS: { updates: "", volunteer: "" },
};

/* Where each dataset comes from: the bridge when configured, else local. */
function sourceFor(sheet, localUrl) {
  return CONFIG.BRIDGE_URL
    ? CONFIG.BRIDGE_URL + "?sheet=" + encodeURIComponent(sheet)
    : localUrl;
}
const SOURCES = {
  // The calendar comes from the schedule sheet, not the registration one,
  // so it does not follow BRIDGE_URL. See docs/BRIDGE-SETUP.md.
  events: CONFIG.LOCAL_EVENTS_URL,
  partners: sourceFor("partners", CONFIG.LOCAL_PARTNERS_URL),
  stats: CONFIG.BRIDGE_URL ? sourceFor("stats", "") : "",
};

/* ---------- Analytics loader ----------
   Loads Google (GA4 and/or Ads) and the Meta pixel, but only for the ids
   that are actually set. */
(function analytics() {
  window.dataLayer = window.dataLayer || [];

  if (ANALYTICS.GTM_ID) {
    dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    const gtm = document.createElement("script");
    gtm.async = true;
    gtm.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(ANALYTICS.GTM_ID);
    document.head.appendChild(gtm);
  }

  const googleId = ANALYTICS.GA4_ID || ANALYTICS.GOOGLE_ADS_ID;

  if (googleId) {
    const tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(googleId);
    document.head.appendChild(tag);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    gtag("js", new Date());
    // send_page_view off: this is one page, so views are sent by hand below.
    if (ANALYTICS.GA4_ID) gtag("config", ANALYTICS.GA4_ID, { send_page_view: false });
    if (ANALYTICS.GOOGLE_ADS_ID) gtag("config", ANALYTICS.GOOGLE_ADS_ID);
  }

  if (ANALYTICS.META_PIXEL_ID) {
    /* Meta's own loader, unmodified. */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", ANALYTICS.META_PIXEL_ID);
  }
})();

/* A screen was opened. This site is one page, so each view is reported as
   its own page view — otherwise every visit looks like a single landing. */
function trackView(path, title) {
  // Announced whether or not anything is listening. GTM picks this up as a
  // "virtual_page_view" trigger; with no GTM it simply sits in the array.
  (window.dataLayer = window.dataLayer || []).push({
    event: "virtual_page_view",
    page_path: path,
    page_title: title,
  });
  if (window.gtag && ANALYTICS.GA4_ID) {
    gtag("event", "page_view", {
      page_title: title,
      page_path: path,
      page_location: location.origin + location.pathname + path,
    });
  }
  if (window.fbq) fbq("track", "PageView");
}

/* A registration the bridge has confirmed. Never called for a duplicate and
   never in demo mode — a conversion has to mean a real row. Carries no
   personal data: the flavour, the campaign ref, and the submission id, which
   doubles as Meta's deduplication key against any server-side copy. */
function trackRegistration(flavour, submissionId) {
  const ref = CAMPAIGN_REF || "(direct)";

  /* The one event a performance marketer actually needs, pushed once, in a
     shape GTM can route anywhere. No personal data — the submission id is an
     opaque key, useful for deduplicating against a server-side copy. */
  (window.dataLayer = window.dataLayer || []).push({
    event: "registration_complete",
    form: flavour,                 // "volunteer" | "updates"
    campaign_ref: ref,             // ?ref= or utm_source[/utm_campaign]
    submission_id: submissionId,
  });

  if (window.gtag && ANALYTICS.GA4_ID) {
    gtag("event", flavour === "volunteer" ? "sign_up" : "generate_lead", {
      method: flavour,
      campaign_ref: ref,
      transaction_id: submissionId,
    });
  }
  const label = (ANALYTICS.GOOGLE_ADS_LABELS || {})[flavour];
  if (window.gtag && ANALYTICS.GOOGLE_ADS_ID && label) {
    gtag("event", "conversion", {
      send_to: ANALYTICS.GOOGLE_ADS_ID + "/" + label,
      transaction_id: submissionId,
    });
  }
  if (window.fbq) {
    fbq("track", flavour === "volunteer" ? "CompleteRegistration" : "Lead",
      { content_name: flavour, source: ref },
      { eventID: submissionId });
  }
}

/* ---------- Campaign source ----------
   Each signup link can carry where it was shared, so the sheet records
   "Volunteering (instagram-bio)" rather than just "Volunteering":

     .../#volunteer?ref=instagram-bio      (ref inside the hash)
     .../?ref=poster-qr#volunteer          (ordinary query string)
     .../?utm_source=instagram#volunteer   (UTM links work too)

   Remembered for the visit, so it still applies if the visitor browses
   the page first and signs up a few clicks later. */
const REF_KEY = "bali.ref";

function readRef() {
  const params = new URLSearchParams(location.search);
  // Also accept a query tacked onto the hash, e.g. #volunteer?ref=x
  const hashQuery = location.hash.indexOf("?");
  if (hashQuery !== -1) {
    new URLSearchParams(location.hash.slice(hashQuery + 1)).forEach((v, k) => {
      if (!params.has(k)) params.set(k, v);
    });
  }

  const ref = params.get("ref") || params.get("utm_source") || "";
  const campaign = params.get("utm_campaign") || "";
  const found = [ref, campaign].filter(Boolean).join("/");

  try {
    if (found) sessionStorage.setItem(REF_KEY, found);
    return found || sessionStorage.getItem(REF_KEY) || "";
  } catch (err) {
    return found; // private browsing can refuse storage
  }
}

const CAMPAIGN_REF = readRef();

/* ---------- Data loading ----------
   Apps Script normally allows cross-origin GET, but some browsers/
   configurations block it. Code.gs also speaks JSONP (?callback=),
   so fall back to that rather than showing an empty calendar. */
function jsonpLoad(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const cb = "__baliCb" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const done = (fn, arg) => {
      // A reply can still arrive after we have given up. Leave a harmless
      // stub behind rather than deleting the callback, or that late script
      // throws a ReferenceError into the console.
      window[cb] = function () {};
      setTimeout(() => { delete window[cb]; }, 60000);
      script.remove();
      clearTimeout(timer);
      fn(arg);
    };
    const timer = setTimeout(() => done(reject, new Error("JSONP timeout")), timeoutMs);
    window[cb] = (data) => done(resolve, data);
    script.onerror = () => done(reject, new Error("JSONP failed"));
    script.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
    document.head.appendChild(script);
  });
}

async function loadJSON(url) {
  if (!url) throw new Error("No source configured");
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (err) {
    // Only the bridge can answer JSONP; local files cannot.
    if (!CONFIG.BRIDGE_URL || !url.startsWith(CONFIG.BRIDGE_URL)) throw err;
    return jsonpLoad(url);
  }
}

/* ---------- In-page views ----------
   The onboarding forms live on their own screen without being separate
   pages. Opening one overlays the site; "back to main page" just hides it
   again, so the main page is untouched underneath — same scroll position,
   nothing reloaded. Routed off the hash, so existing #register /
   #volunteer links work and the browser's own Back button closes a view. */
(function views() {
  const views = Array.from(document.querySelectorAll(".page-view"));
  if (!views.length) return;

  const KEYS = views.map((v) => v.id);
  let restoreScrollTo = 0;
  let pendingScroll = null; // captured on click, before the hash moves
  let lastFocus = null;

  function close({ silent = false } = {}) {
    const open = views.find((v) => !v.hidden);
    if (!open) return;
    open.hidden = true;
    document.body.classList.remove("view-open");
    trackView("/", document.title);
    // Instant, not smooth: closing should put the page back where it was,
    // not animate a scroll the visitor never asked for.
    window.scrollTo({ top: restoreScrollTo, behavior: "instant" });
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
    if (!silent && KEYS.indexOf(location.hash.slice(1).split("?")[0]) !== -1) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }

  function open(id) {
    const view = views.find((v) => v.id === id);
    if (!view) return close();
    if (!view.hidden) return;

    // Remember where the main page was, but not while another view is open.
    if (!document.body.classList.contains("view-open")) {
      // Prefer the position captured on click: by the time the hash has
      // changed the browser may already have jumped the page.
      restoreScrollTo = pendingScroll == null ? window.scrollY : pendingScroll;
      lastFocus = document.activeElement;
    }
    pendingScroll = null;
    views.forEach((v) => { v.hidden = v !== view; });
    document.body.classList.add("view-open");
    const barTitle = view.querySelector(".view-bar-title");
    trackView("#" + view.id, barTitle ? barTitle.textContent.trim() : view.id);
    view.scrollTop = 0;
    const heading = view.querySelector("h2, .view-back");
    if (heading) heading.focus({ preventScroll: true });
  }

  function route() {
    // "#volunteer?ref=instagram-bio" still routes to the volunteer view.
    const id = location.hash.slice(1).split("?")[0];
    if (KEYS.indexOf(id) !== -1) open(id); else close({ silent: true });
  }

  document.addEventListener("click", (e) => {
    // Any link to a view: note the scroll position before the hash moves.
    const link = e.target.closest('a[href^="#"]');
    if (link && KEYS.indexOf(link.getAttribute("href").slice(1).split("?")[0]) !== -1) {
      pendingScroll = window.scrollY;
    }

    const back = e.target.closest("[data-close-view]");
    if (!back) return;
    e.preventDefault();
    // Prefer real Back so the view leaves no dead entry in history.
    const openId = location.hash.slice(1).split("?")[0];
    if (KEYS.indexOf(openId) !== -1 && history.length > 1) history.back();
    else close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("view-open")) close();
  });

  window.addEventListener("hashchange", route);
  route(); // honour a #register / #volunteer link arrived at directly
})();

/* ---------- Footer year ---------- */
document.getElementById("year").textContent = new Date().getFullYear();

/* ---------- Mobile nav toggle ---------- */
(function nav() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (!toggle || !links) return;
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      links.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
})();

/* ---------- Helpers ---------- */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + (iso.length <= 10 ? "T00:00:00" : ""));
  if (isNaN(d)) return esc(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/* ---------- The schedule sheet ----------
   Reads the "Event List" tab, published as TSV. The header row is found by
   name rather than position, so blank rows above it — or columns moved
   around — do not break it. */
function parseSchedule(tsv) {
  const rows = tsv.split(/\r?\n/).map((line) => line.split("\t"));
  const headerAt = rows.findIndex((cells) => {
    const names = cells.map((c) => c.trim().toLowerCase());
    return names.includes("title") && names.includes("date");
  });
  if (headerAt === -1) return [];

  const header = rows[headerAt].map((c) => c.trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  const at = (cells, name) => {
    const i = col(name);
    return i === -1 ? "" : String(cells[i] == null ? "" : cells[i]).trim();
  };

  return rows.slice(headerAt + 1)
    .filter((cells) => at(cells, "title"))
    .map((cells, i) => {
      const start = at(cells, "start time");
      const end = at(cells, "end time");
      const ticketUrl = at(cells, "ticket link");
      return {
        id: "ev-" + i,
        title: at(cells, "title"),
        category: normaliseCategory(at(cells, "category")),
        date: parseSheetDate(at(cells, "date")),
        venue: at(cells, "venue"),
        time: [start, end].filter(Boolean).join(" – "),
        ticketUrl: ticketUrl,
        status: ticketUrl ? "onsale" : "announced",
        description: "",
      };
    });
}

/* The filters only know these three, so anything else is folded in. */
function normaliseCategory(v) {
  const s = String(v || "").toLowerCase();
  if (/work|class|lab/.test(s)) return "Workshop";
  if (/talk|lecture|demo|panel|screen|film|exhib/.test(s)) return "Talk";
  if (/perform|dance|music|show|puppet|kecak|kechak/.test(s)) return "Performance";
  return v ? v.trim() : "Performance";
}

/* Accepts what a spreadsheet is likely to hand us: an ISO date, a
   day-first 4/10/2026, or something Date can read. Day-first because the
   sheet is kept in India. */
function parseSheetDate(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return dmy[3] + "-" + String(dmy[2]).padStart(2, "0") + "-" + String(dmy[1]).padStart(2, "0");
  }
  const d = new Date(s);
  if (!isNaN(d)) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  return ""; // unreadable: treated as "date to be announced"
}

async function loadEvents() {
  // The sheet is the source of truth once it has rows in it.
  if (CONFIG.SCHEDULE_URL) {
    try {
      const res = await fetch(CONFIG.SCHEDULE_URL, { cache: "no-store" });
      if (res.ok) {
        const events = parseSchedule(await res.text());
        if (events.length) return events;
      }
    } catch (err) {
      /* fall through to the file below */
    }
  }
  return loadJSON(SOURCES.events);
}

/* ---------- Calendar ---------- */
async function loadCalendar() {
  const grid = document.getElementById("calendar-grid");
  const filters = document.getElementById("calendar-filters");
  if (!grid) return;

  let events = [];
  try {
    events = await loadEvents();
  } catch (e) {
    grid.innerHTML = '<p class="loading">The calendar will appear here soon.</p>';
    return;
  }

  if (!Array.isArray(events) || events.length === 0) {
    grid.innerHTML =
      '<p class="loading">Dates are being confirmed — ' +
      '<a class="text-link" href="#register">register for updates</a> to be notified.</p>';
    return;
  }

  // Sort: dated events first (chronological), then undated.
  events.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(a.date) - new Date(b.date);
  });

  render(events);
  if (filters) {
    filters.hidden = false;
    filters.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      filters.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
      btn.classList.add("is-active");
      const f = btn.dataset.filter;
      render(f === "all" ? events : events.filter((ev) => ev.category === f));
    });
  }

  function render(list) {
    if (!list.length) {
      grid.innerHTML = '<p class="loading">Nothing in this category yet.</p>';
      return;
    }
    grid.innerHTML = list.map(cardHTML).join("");
  }

  function statusBadge(ev) {
    const s = (ev.status || "announced").toLowerCase();
    if (s === "concluded") return '<span class="badge badge-done">Concluded</span>';
    if (s === "onsale") return '<span class="badge badge-live">On sale</span>';
    return '<span class="badge">Announced</span>';
  }

  function actionHTML(ev) {
    const s = (ev.status || "announced").toLowerCase();
    if (s === "onsale" && ev.ticketUrl)
      return `<a class="btn btn-primary btn-sm" href="${esc(ev.ticketUrl)}" target="_blank" rel="noopener">Book / passes</a>`;
    if (s === "concluded" && ev.ticketUrl)
      return `<a class="btn btn-ghost btn-sm" href="${esc(ev.ticketUrl)}" target="_blank" rel="noopener">View media</a>`;
    return '<span class="cal-soon">Tickets coming soon</span>';
  }

  /* One bar per event, stacked in date order — not a grid of cards. */
  function cardHTML(ev) {
    const d = ev.date ? new Date(ev.date + "T00:00:00") : null;
    const day = d && !isNaN(d) ? String(d.getDate()).padStart(2, "0") : "--";
    const mon = d && !isNaN(d)
      ? d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()
      : "TBA";
    const weekday = d && !isNaN(d)
      ? d.toLocaleDateString("en-IN", { weekday: "short" })
      : "";
    const meta = [ev.time, ev.venue].filter(Boolean).map(esc).join(" · ");

    return `
      <article class="cal-bar" data-category="${esc(ev.category || "")}">
        <div class="cal-when">
          <span class="cal-day">${day}</span>
          <span class="cal-mon">${mon}</span>
          <span class="cal-weekday">${esc(weekday)}</span>
        </div>
        <div class="cal-what">
          <div class="cal-tags">
            <span class="cal-cat">${esc(ev.category || "")}</span>
            ${ev.collab ? '<span class="cal-collab">Collaboration</span>' : ""}
            ${statusBadge(ev)}
          </div>
          <h4>${esc(ev.title)}</h4>
          ${meta ? `<p class="cal-meta">${meta}</p>` : ""}
          ${ev.description ? `<p class="cal-desc">${esc(ev.description)}</p>` : ""}
        </div>
        <div class="cal-action">${actionHTML(ev)}</div>
      </article>`;
  }
}

/* ---------- Partners ---------- */
async function loadPartners() {
  const grid = document.getElementById("partners-grid");
  if (!grid) return;

  let partners = [];
  try {
    partners = await loadJSON(SOURCES.partners);
  } catch (e) {
    partners = [];
  }

  if (!Array.isArray(partners) || partners.length === 0) {
    grid.innerHTML = `
      <div class="partners-empty">
        <p>We're building our circle of partners, sponsors, and supporters.</p>
        <a class="btn btn-primary" href="#support">Become a partner</a>
      </div>`;
    return;
  }

  grid.classList.add("has-partners");
  grid.innerHTML = partners.map((p) => {
    const inner = p.logo
      ? `<img src="${esc(p.logo)}" alt="${esc(p.name)}" loading="lazy" />`
      : `<span>${esc(p.name)}</span>`;
    return p.url
      ? `<a class="partner" href="${esc(p.url)}" target="_blank" rel="noopener" title="${esc(p.name)}">${inner}</a>`
      : `<div class="partner" title="${esc(p.name)}">${inner}</div>`;
  }).join("");
}

/* ---------- Forms ----------
   Every form declares a `flavour` (its purpose) via a hidden input. The
   bridge stores it on that flavour's own tab and upserts the person into
   the Master contact registry, recording which flavour they came from. */

const VALID = {
  /* A full name: at least two words, letters only (plus . ' -). */
  fullName: (v) => /^[\p{L}][\p{L}.'-]*(\s+[\p{L}][\p{L}.'-]*)+$/u.test(v.trim()),
  name: (v) => v.trim().length >= 2,
  email: (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()),
  phone: (v) => {
    let d = v.replace(/\D/g, "");
    if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
    if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
    if (d.length === 10) return /^[6-9]\d{9}$/.test(d); // Indian mobile
    return d.length >= 11 && d.length <= 15;            // international
  },
};

/* Validate one form. Returns an error message, or "" when valid. */
function validateForm(form) {
  const get = (n) => (form.elements[n] ? String(form.elements[n].value || "") : "");
  const need = (form.dataset.require || "").split(/\s+/).filter(Boolean);

  for (const field of need) {
    const value = get(field);
    if (!value.trim()) {
      return field === "name" ? "Please enter your full name."
        : field === "email" ? "Please enter your email address."
        : "Please enter your phone number.";
    }
    if (field === "name" && form.dataset.fullname === "true" && !VALID.fullName(value)) {
      return "Please enter your full name (first and last).";
    }
    if (field === "name" && !VALID.name(value)) return "Please enter your name.";
    if (field === "email" && !VALID.email(value)) {
      return "That email address doesn't look right — please check it.";
    }
    if (field === "phone" && !VALID.phone(value)) {
      return "That phone number doesn't look right — please enter a 10-digit mobile number.";
    }
  }

  const age = form.elements.age18;
  if (age && !age.checked) {
    return "Please confirm you are 18 or over.";
  }

  const consent = form.elements.consent;
  if (consent && !consent.checked) {
    return "Please tick the consent box so we know we may contact you.";
  }
  return "";
}

/* Confirm a submission landed, using only its random id — never any
   personal data, which must not travel in a URL. Polls because the row is
   written a moment before the receipt becomes readable. */
async function confirmBySid(sid, tries = 5) {
  const url = CONFIG.BRIDGE_URL + "?verify=" + encodeURIComponent(sid);
  for (let i = 0; i < tries; i++) {
    await new Promise((r) => setTimeout(r, 900 + i * 600));
    try {
      const receipt = await loadJSON(url);
      if (receipt && receipt.found) return receipt;
    } catch (err) {
      /* keep trying — the next attempt may succeed */
    }
  }
  return null;
}

/* Ask the bridge whether this person is already registered for this
   flavour, without writing anything. Runs while the form is being filled
   in, so a duplicate is refused there rather than after Submit. */
async function checkAlreadyRegistered(form) {
  if (!CONFIG.BRIDGE_URL) return null; // demo mode: nothing to check against

  const get = (n) => (form.elements[n] ? String(form.elements[n].value || "").trim() : "");
  const name = get("name");
  const phone = get("phone");
  const email = get("email");
  if (!name || (!phone && !email)) return null; // not enough to identify anyone

  const submission =
    (crypto.randomUUID && crypto.randomUUID()) ||
    String(Date.now()) + Math.random().toString(36).slice(2);

  const body = new URLSearchParams({
    mode: "check",
    flavour: get("flavour"),
    name: name,
    phone: phone,
    email: email,
    submission: submission,
  }).toString();
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };

  try {
    const res = await fetch(CONFIG.BRIDGE_URL, { method: "POST", headers, body });
    const out = await res.json();
    if (out && out.ok) return !!out.exists;
  } catch (err) {
    // Reply unreadable — read the answer back by id instead.
    try {
      await fetch(CONFIG.BRIDGE_URL, { method: "POST", mode: "no-cors", headers, body });
    } catch (err2) {
      return null;
    }
    const receipt = await confirmBySid(submission, 3);
    if (receipt && receipt.found) return receipt.result === "exists";
  }
  return null; // unknown: never block someone on a failed check
}

function wireForm(formId, noteId, messages) {
  const form = document.getElementById(formId);
  const note = document.getElementById(noteId);
  if (!form || !note) return;

  const say = (text, kind) => {
    note.textContent = text;
    note.className = "form-note" + (kind ? " " + kind : "");
  };

  /* Check as soon as there is enough to identify someone, so a duplicate is
     refused while the form is being filled in. */
  let alreadyRegistered = false;
  const idFields = ["phone", "email", "name"].filter((f) => form.elements[f]);

  async function runCheck() {
    const found = await checkAlreadyRegistered(form);
    if (found === null) return; // unknown — never block on a failed check
    alreadyRegistered = found;
    if (found) {
      say(messages.alreadyRegistered, "err");
    } else if (note.textContent === messages.alreadyRegistered) {
      say("", "");
    }
  }

  idFields.forEach((f) => {
    form.elements[f].addEventListener("blur", () => {
      // Only worth asking once the field is plausibly complete.
      if (!validateForm(form) || form.elements[f].value.trim()) runCheck();
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Refuse a duplicate outright rather than sending it.
    if (alreadyRegistered) {
      say(messages.alreadyRegistered, "err");
      return;
    }

    // Every question must be answered before any details are sent.
    if (typeof form.onboardingGuard === "function" && !form.onboardingGuard()) {
      return; // the unanswered card is now on screen, showing its own message
    }

    const problem = validateForm(form);
    if (problem) {
      say(problem, "err");
      return;
    }

    // Last look before sending, in case they never left the last field.
    const dupe = await checkAlreadyRegistered(form);
    if (dupe === true) {
      alreadyRegistered = true;
      say(messages.alreadyRegistered, "err");
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    if (CAMPAIGN_REF) data.ref = CAMPAIGN_REF;
    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Submitting…";
    say(messages.pending || "Checking your details…", "");

    const done = () => {
      btn.disabled = false;
      btn.textContent = label;
    };

    // No bridge configured yet → demo mode. Nothing is stored, so we must
    // not tell anyone their response was recorded.
    if (!CONFIG.BRIDGE_URL) {
      say(messages.demo, "");
      done();
      return;
    }

    // A random id lets us confirm this exact submission afterwards without
    // sending name, email or phone through a URL.
    // Named "submission", not "sid": Google rejects requests carrying a
    // parameter called sid with a 400 before the script ever runs.
    data.submission =
      (crypto.randomUUID && crypto.randomUUID()) ||
      String(Date.now()) + Math.random().toString(36).slice(2);

    const body = new URLSearchParams(data).toString();
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };

    // Confirm from the reply when the browser lets us read it, and otherwise
    // by looking the receipt up. Either way the message below is only shown
    // once the bridge has actually confirmed the submission.
    let outcome = null;
    try {
      const res = await fetch(CONFIG.BRIDGE_URL, { method: "POST", headers, body });
      const out = await res.json();
      if (out.ok === false) {
        say(out.error === "Consent is required" ? messages.consent || messages.failure : messages.failure, "err");
        done();
        return;
      }
      outcome = out;
    } catch (err) {
      // The reply was unreadable — but the POST itself may well have landed,
      // so look for its receipt BEFORE resending. Resending blind would file
      // a first-time entry as a duplicate.
      say(messages.verifying || "Verifying your details…", "");
      outcome = await confirmBySid(data.submission, 3);

      if (!outcome) {
        // No receipt: it really did not arrive. Send it again, opaquely.
        // The bridge keys on the submission id, so a resend cannot double-book.
        try {
          await fetch(CONFIG.BRIDGE_URL, { method: "POST", mode: "no-cors", headers, body });
        } catch (err2) {
          say(messages.failure, "err");
          done();
          return;
        }
        outcome = await confirmBySid(data.submission, 4);
      }
    }

    if (!outcome) {
      // Sent, but never confirmed — say exactly that rather than claim success.
      say(messages.unconfirmed, "err");
      done();
      return;
    }

    say(outcome.duplicate ? messages.duplicate : messages.success, "ok");
    if (!outcome.duplicate) {
      // Confirmed by the bridge, and not a duplicate: a real conversion.
      trackRegistration(data.flavour, data.submission);
      form.reset();
    }
    done();
  });
}

wireForm("signup-form", "form-note", {
  pending: "Checking your details…",
  verifying: "Verifying your registration…",
  success: "Thank you for registering — we'll be in touch with festival updates.",
  duplicate: "You're already on the list — we have your details and will keep you posted.",
  alreadyRegistered: "These details are already registered for updates — no need to register again. To change anything, call +91 90350 34725.",
  demo: "Your details look good. Registrations start saving once the data bridge is connected.",
  unconfirmed: "We couldn't confirm your registration just now. Please try again in a moment, or call +91 90350 34725.",
  failure: "Sorry, something went wrong. Please try again, or call +91 90350 34725.",
});

wireForm("volunteer-form", "volunteer-note", {
  pending: "Checking your details…",
  verifying: "Verifying your details…",
  success: "Your response has been recorded. Our team will connect with you soon using the details you've shared.",
  duplicate: "You've already registered to volunteer — your response is with us and our team will connect with you soon.",
  alreadyRegistered: "These details are already registered to volunteer — no need to register again. Our team will be in touch, or call +91 90350 34725.",
  demo: "Your details look good. Volunteer responses start saving once the data bridge is connected.",
  unconfirmed: "We couldn't confirm your response just now. Please try again in a moment, or call +91 90350 34725.",
  failure: "Sorry, we couldn't record your response. Please try again, or call +91 90350 34725.",
});

/* ---------- Onboarding carousel ----------
   Each signup component asks its questions one card at a time, then shows
   the signup card. Questions come from data/questions.json so they can be
   changed without touching this file. Swipe left for the next card (drag
   with a mouse works too); the Back/Next buttons and the keyboard do the
   same thing, so nothing depends on being able to swipe. */
async function initOnboarding() {
  const shells = Array.from(document.querySelectorAll(".onboard"));
  if (!shells.length) return;

  let sets = {};
  try {
    sets = await loadJSON("data/questions.json");
  } catch (err) {
    sets = {}; // questions are an enhancement: fall back to the plain form
  }

  shells.forEach((shell) => {
    setupOnboarding(shell, Array.isArray(sets[shell.dataset.flavour]) ? sets[shell.dataset.flavour] : []);
  });
}

function setupOnboarding(shell, questions) {
  const stage = shell.querySelector(".onboard-stage");
  const signup = shell.querySelector(".onboard-signup");
  const bar = shell.querySelector(".onboard-bar");
  const progress = shell.querySelector(".onboard-progress");
  const stepLabel = shell.querySelector(".onboard-step");
  const form = signup && signup.querySelector("form");
  if (!stage || !signup || !form) return;

  const answers = {};
  const total = questions.length;
  let index = 0; // 0..total-1 = questions, total = the signup card

  // No questions configured → behave exactly as before.
  if (!total) {
    stage.hidden = true;
    if (progress) progress.hidden = true;
    signup.hidden = false;
    return;
  }

  /* ----- build one card per question ----- */
  questions.forEach((q, i) => {
    const multi = q.multi !== false;
    const card = document.createElement("fieldset");
    card.className = "onboard-card onboard-question";
    card.dataset.index = String(i);
    card.hidden = i !== 0;

    const options = (q.options || []).map((opt, n) => {
      const id = "q-" + shell.dataset.flavour + "-" + i + "-" + n;
      return (
        '<label class="choice" for="' + id + '">' +
        '<input type="' + (multi ? "checkbox" : "radio") + '"' +
        ' id="' + id + '" name="' + esc(q.id) + '"' +
        ' value="' + esc(opt) + '" />' +
        "<span>" + esc(opt) + "</span>" +
        "</label>"
      );
    }).join("");

    card.innerHTML =
      "<legend>" + esc(q.title || "") + "</legend>" +
      (q.hint ? '<p class="onboard-hint">' + esc(q.hint) + "</p>" : "") +
      '<div class="choices">' + options + "</div>" +
      '<p class="onboard-error" role="alert" hidden>Please choose at least one to continue.</p>';

    stage.appendChild(card);
  });

  const cards = Array.from(stage.querySelectorAll(".onboard-question"));

  /* One arrow either side of the question block, rather than a pair of
     buttons inside every card. */
  const CHEVRON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="15 18 9 12 15 6"></polyline></svg>';

  const carousel = document.createElement("div");
  carousel.className = "onboard-carousel";
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "onboard-arrow onboard-arrow-prev";
  prev.dataset.onboard = "back";
  prev.setAttribute("aria-label", "Previous question");
  prev.innerHTML = CHEVRON;
  const next = document.createElement("button");
  next.type = "button";
  next.className = "onboard-arrow onboard-arrow-next";
  next.dataset.onboard = "next";
  next.setAttribute("aria-label", "Next question");
  next.innerHTML = CHEVRON;

  stage.parentNode.insertBefore(carousel, stage);
  carousel.appendChild(prev);
  carousel.appendChild(stage);
  carousel.appendChild(next);
  // The signup card joins the question cards in the stage, so it lines up
  // with them exactly instead of sitting wider and shifting on the last step.
  stage.appendChild(signup);

  /* ----- a hidden input per question, so answers post with the form ----- */
  questions.forEach((q) => {
    if (form.elements[q.id]) return;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = q.id;
    form.appendChild(input);
  });

  /* ----- let people go back and change what they said ----- */
  const change = document.createElement("button");
  change.type = "button";
  change.className = "onboard-change";
  change.dataset.onboard = "restart";
  change.innerHTML = '<span aria-hidden="true">&larr;</span> Change my answers';
  signup.insertBefore(change, signup.firstChild);

  function selected(i) {
    return Array.from(cards[i].querySelectorAll("input:checked")).map((el) => el.value);
  }

  function show(to) {
    index = Math.max(0, Math.min(total, to));
    cards.forEach((c, i) => { c.hidden = i !== index; });
    signup.hidden = index !== total;

    // The bar tracks cards completed, so it is full only on the signup card.
    const pct = Math.round((index / total) * 100);
    if (bar) bar.style.width = pct + "%";
    if (progress) progress.setAttribute("aria-valuenow", String(pct));
    if (stepLabel) {
      stepLabel.textContent = index === total
        ? "Your details"
        : "Question " + (index + 1) + " of " + total;
    }

    // First card has nowhere back; the signup card has its own submit.
    // The next arrow keeps its place rather than being removed, so the
    // question block does not jump sideways on the last step.
    const done = index === total;
    prev.disabled = index === 0;
    next.classList.toggle("is-gone", done);
    next.setAttribute("aria-hidden", String(done));
    next.tabIndex = done ? -1 : 0;
    next.disabled = done;
    carousel.classList.toggle("is-done", done);

    const card = index === total ? signup : cards[index];
    const focusTarget = card.querySelector("legend, h2, input, button");
    if (focusTarget && document.body.classList.contains("view-open")) {
      focusTarget.focus({ preventScroll: true });
    }
    card.scrollIntoView({ block: "nearest", behavior: "instant" });
  }

  function advance() {
    if (index >= total) return;
    if (!selected(index).length) {
      const err = cards[index].querySelector(".onboard-error");
      if (err) err.hidden = false;
      return;
    }
    answers[questions[index].id] = selected(index);
    form.elements[questions[index].id].value = selected(index).join(", ");
    show(index + 1);
  }

  stage.addEventListener("change", (e) => {
    const err = cards[index] && cards[index].querySelector(".onboard-error");
    if (err) err.hidden = true;

    // Unticking the last box clears the recorded answer, so a stale one can
    // never travel with the form.
    const question = questions[index];
    if (question && !selected(index).length) {
      delete answers[question.id];
      form.elements[question.id].value = "";
    }
    // A single-answer question has nothing more to say once picked.
    const q = questions[index];
    if (q && q.multi === false && e.target.checked) setTimeout(advance, 260);
  });

  shell.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-onboard]");
    if (!btn) return;
    const action = btn.dataset.onboard;
    if (action === "next") advance();
    if (action === "back") show(index - 1);
    if (action === "restart") show(0);
  });

  /* ----- swipe: left for next, right for back ----- */
  let startX = null;
  let startY = null;
  stage.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  stage.addEventListener("touchend", (e) => {
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    startX = null;
    // Ignore anything that was really a vertical scroll.
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) advance(); else show(index - 1);
  }, { passive: true });

  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") advance();
    if (e.key === "ArrowLeft" && index > 0) show(index - 1);
  });

  /* Last line of defence: the form refuses to submit while any question is
     unanswered, whatever route was taken to reach it. */
  form.onboardingGuard = function () {
    for (let i = 0; i < total; i++) {
      if (!selected(i).length) {
        show(i);
        const err = cards[i].querySelector(".onboard-error");
        if (err) err.hidden = false;
        return false;
      }
    }
    return true;
  };

  show(0);
}

/* ---------- Boot ---------- */
loadCalendar();
loadPartners();
initOnboarding();
