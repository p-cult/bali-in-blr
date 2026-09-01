/* ============================================================
   Bali in Bengaluru — hub front-end
   ------------------------------------------------------------
   DATA BRIDGE CONFIG
   Phase 1 reads from local JSON files in /data.
   To go live with the Google Sheets + Apps Script bridge, set
   BRIDGE_URL to your deployed Web App URL and switch the
   EVENTS_URL / PARTNERS_URL / STATS_URL lines to the bridge
   (examples shown). Nothing else needs to change.
   ============================================================ */
const CONFIG = {
  // Paste your Apps Script Web App URL here when ready, e.g.
  // "https://script.google.com/macros/s/AKfy.../exec"
  BRIDGE_URL: "",

  // Sources. Local now; swap to the bridge later:
  //   EVENTS_URL:   CONFIG.BRIDGE_URL + "?sheet=events"
  //   PARTNERS_URL: CONFIG.BRIDGE_URL + "?sheet=partners"
  EVENTS_URL: "data/events.json",
  PARTNERS_URL: "data/partners.json",
  STATS_URL: "", // e.g. CONFIG.BRIDGE_URL + "?sheet=stats"
};

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
    const res = await fetch(CONFIG.EVENTS_URL, { cache: "no-store" });
    events = await res.json();
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
    const res = await fetch(CONFIG.PARTNERS_URL, { cache: "no-store" });
    partners = await res.json();
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

/* ---------- Signup form ---------- */
(function signup() {
  const form = document.getElementById("signup-form");
  const note = document.getElementById("form-note");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    note.className = "form-note";

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = "Registering…";

    // No bridge configured yet → front-end demo mode.
    if (!CONFIG.BRIDGE_URL) {
      note.textContent = "Thanks! Your registration form is ready — it will start saving once the data bridge is connected.";
      note.classList.add("ok");
      form.reset();
      btn.disabled = false;
      btn.textContent = "Register";
      return;
    }

    try {
      await fetch(CONFIG.BRIDGE_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(data).toString(),
      });
      note.textContent = "Thank you for registering — we'll be in touch with festival updates.";
      note.classList.add("ok");
      form.reset();
    } catch (err) {
      note.textContent = "Sorry, something went wrong. Please try again, or call +91 90350 34725.";
      note.classList.add("err");
    } finally {
      btn.disabled = false;
      btn.textContent = "Register";
    }
  });
})();

/* ---------- Boot ---------- */
loadCalendar();
loadPartners();
