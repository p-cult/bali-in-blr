/* Bali in Bengaluru — one event, one page: event/?e=<slug>

   Everything here is read live, the same way the calendar reads it: the event
   comes from the schedule sheet through main.js (loadEvents → normaliseEvent),
   so a change in the sheet shows on the next load with no code change. The
   banner is assets/events/<slug>.jpg, kept current by
   tools/sync-event-banners.py; when an event has none, a stand-in is drawn in
   its place and is replaced the moment a banner file appears. */

(async function eventPage() {
  const root = document.getElementById("event-root");
  if (!root) return;
  const wrap = root.querySelector(".wrap");
  const slug = (new URLSearchParams(location.search).get("e") || "").trim().toLowerCase();

  const back = `<a class="ev-back" href="./#calendar">&larr; All events</a>`;

  function fail(msg, withRetry) {
    wrap.innerHTML = back +
      `<div class="ev-missing"><h1>${msg}</h1>` +
      (withRetry
        ? `<p>This usually means the connection dropped. <a class="text-link" href="${esc(location.href)}">Try again</a></p>`
        : `<p><a class="text-link" href="./#calendar">See every event in the calendar</a></p>`) +
      `</div>`;
  }

  if (!slug) return fail("Which event?", false);

  let events;
  try {
    events = assignSlugs((await loadEvents()).map(normaliseEvent));
  } catch (err) {
    return fail("The event could not load.", true);
  }
  const ev = events.find((x) => x.slug === slug);
  if (!ev) return fail("That event is not on the calendar.", false);

  // The banner's version comes from the sync tool, so a new image is fetched
  // fresh instead of from a cache. A missing file simply leaves the stand-in.
  let bannerVersion = "";
  try {
    const cfg = await (await fetch("data/event-banners.json", { cache: "no-store" })).json();
    bannerVersion = ((cfg.events || {})[ev.slug] || {}).version || "";
  } catch (e) { /* no map: try the file anyway */ }
  const bannerSrc = "assets/events/" + encodeURIComponent(ev.slug) + ".jpg" +
    (bannerVersion ? "?v=" + encodeURIComponent(bannerVersion) : "");

  const time = calTimeText(ev);
  const mapUrl = safeUrl(ev.mapUrl);
  const venue = !ev.venue ? "" : mapUrl
    ? `<a class="text-link" href="${esc(mapUrl)}" target="_blank" rel="noopener">${esc(ev.venue)}</a>`
    : esc(ev.venue);

  const facts = [
    ["Date", esc(calDateText(ev))],
    time ? ["Time", time] : null,
    venue ? ["Venue", venue] : null,
    ev.category ? ["Category", esc(ev.category)] : null,
    ev.passInfo && !ev.notPublic ? ["Entry", esc(ev.passInfo)] : null,
  ].filter(Boolean);

  document.title = ev.title + " — Bali in Bengaluru";
  const desc = document.querySelector('meta[name="description"]');
  if (desc && ev.description) desc.setAttribute("content", ev.description);

  wrap.innerHTML = `
    ${back}
    <figure class="ev-banner">
      <div class="ev-standin" aria-hidden="true">
        <span class="ev-standin-kicker">Bali in Bengaluru</span>
        <span class="ev-standin-title">${esc(ev.title)}</span>
        <span class="ev-standin-motif"><i></i><i></i><i></i></span>
      </div>
      <img src="${esc(bannerSrc)}" alt="${esc(ev.title)}"
           onload="this.parentNode.classList.add('has-image')"
           onerror="this.remove()" />
    </figure>

    <div class="ev-grid">
      <div class="ev-main">
        <div class="ev-head">
          ${ev.category ? `<span class="cal-cat">${esc(ev.category)}</span>` : ""}
          ${calStatusChip(ev)}
        </div>
        <h1 class="ev-title">${esc(ev.title)}</h1>
        ${ev.description ? `<p class="ev-desc">${esc(ev.description)}</p>` : ""}
      </div>

      <aside class="ev-side">
        <dl class="ev-facts">
          ${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}
        </dl>
        <div class="ev-act cal-act">${calAction(ev)}</div>
      </aside>
    </div>`;

  if (typeof trackView === "function") trackView("/event/" + ev.slug, ev.title);
})();
