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
  BRIDGE_URL: "",

  // Used only while BRIDGE_URL is empty.
  LOCAL_EVENTS_URL: "data/events.json",
  LOCAL_PARTNERS_URL: "data/partners.json",
};

/* Where each dataset comes from: the bridge when configured, else local. */
function sourceFor(sheet, localUrl) {
  return CONFIG.BRIDGE_URL
    ? CONFIG.BRIDGE_URL + "?sheet=" + encodeURIComponent(sheet)
    : localUrl;
}
const SOURCES = {
  events: sourceFor("events", CONFIG.LOCAL_EVENTS_URL),
  partners: sourceFor("partners", CONFIG.LOCAL_PARTNERS_URL),
  stats: CONFIG.BRIDGE_URL ? sourceFor("stats", "") : "",
};

/* ---------- Data loading ----------
   Apps Script normally allows cross-origin GET, but some browsers/
   configurations block it. Code.gs also speaks JSONP (?callback=),
   so fall back to that rather than showing an empty calendar. */
function jsonpLoad(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const cb = "__baliCb" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    const done = (fn, arg) => {
      delete window[cb];
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

/* ---------- Calendar ---------- */
async function loadCalendar() {
  const grid = document.getElementById("calendar-grid");
  const filters = document.getElementById("calendar-filters");
  if (!grid) return;

  let events = [];
  try {
    events = await loadJSON(SOURCES.events);
  } catch (e) {
    grid.innerHTML = '<p class="loading">The calendar will appear here soon.</p>';
    return;
  }

  if (!Array.isArray(events) || events.length === 0) {
    grid.innerHTML = '<p class="loading">Dates are being confirmed — register above to be notified.</p>';
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

  function cardHTML(ev) {
    const date = ev.date ? formatDate(ev.date) : "Date to be announced";
    const meta = [ev.time, ev.venue].filter(Boolean).map(esc).join(" · ");
    const img = ev.image
      ? `<div class="cal-img"><img src="${esc(ev.image)}" alt="${esc(ev.title)}" loading="lazy" /></div>`
      : "";
    return `
      <article class="cal-card">
        ${img}
        <div class="cal-body">
          <div class="cal-top">${statusBadge(ev)}<span class="cal-cat">${esc(ev.category || "")}</span></div>
          <p class="cal-date">${date}</p>
          <h4>${esc(ev.title)}</h4>
          ${meta ? `<p class="cal-meta">${meta}</p>` : ""}
          ${ev.description ? `<p class="cal-desc">${esc(ev.description)}</p>` : ""}
          <div class="cal-action">${actionHTML(ev)}</div>
        </div>
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

  const consent = form.elements.consent;
  if (consent && !consent.checked) {
    return "Please tick the consent box so we know we may contact you.";
  }
  return "";
}

function wireForm(formId, noteId, messages) {
  const form = document.getElementById(formId);
  const note = document.getElementById(noteId);
  if (!form || !note) return;

  const say = (text, kind) => {
    note.textContent = text;
    note.className = "form-note" + (kind ? " " + kind : "");
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const problem = validateForm(form);
    if (problem) {
      say(problem, "err");
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Submitting…";
    say("", "");

    const done = () => {
      btn.disabled = false;
      btn.textContent = label;
    };

    // No bridge configured yet → front-end demo mode.
    if (!CONFIG.BRIDGE_URL) {
      say(messages.demo, "ok");
      form.reset();
      done();
      return;
    }

    const body = new URLSearchParams(data).toString();
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };

    try {
      // Read the reply where we can, so duplicates get an honest message.
      const res = await fetch(CONFIG.BRIDGE_URL, { method: "POST", headers, body });
      const out = await res.json();
      if (out.ok === false) throw new Error(out.error || "Rejected");
      say(out.duplicate ? messages.duplicate : messages.success, "ok");
      if (!out.duplicate) form.reset();
    } catch (err) {
      // Some browsers block reading a cross-origin Apps Script reply. Resend
      // opaquely: the row still saves and the bridge still de-duplicates, we
      // just cannot tell the user whether it was a duplicate.
      try {
        await fetch(CONFIG.BRIDGE_URL, { method: "POST", mode: "no-cors", headers, body });
        say(messages.success, "ok");
        form.reset();
      } catch (err2) {
        say(messages.failure, "err");
      }
    } finally {
      done();
    }
  });
}

wireForm("signup-form", "form-note", {
  success: "Thank you for registering — we'll be in touch with festival updates.",
  duplicate: "You're already on the list — we have your details and will keep you posted.",
  demo: "Thanks! Your registration form is ready — it will start saving once the data bridge is connected.",
  failure: "Sorry, something went wrong. Please try again, or call +91 90350 34725.",
});

wireForm("volunteer-form", "volunteer-note", {
  success: "Your response has been recorded. Our team will connect with you soon using the details you've shared.",
  duplicate: "You've already registered to volunteer — your response is with us and our team will connect with you soon.",
  demo: "Your response has been recorded. Our team will connect with you soon using the details you've shared.",
  failure: "Sorry, we couldn't record your response. Please try again, or call +91 90350 34725.",
});

/* ---------- Boot ---------- */
loadCalendar();
loadPartners();
