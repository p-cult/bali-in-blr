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
  let banner = {};
  try {
    const cfg = await (await fetch("data/event-banners.json", { cache: "no-store" })).json();
    banner = (cfg.events || {})[ev.slug] || {};
  } catch (e) { /* no map: try the JPEG anyway */ }
  const v = banner.version ? "?v=" + encodeURIComponent(banner.version) : "";
  const base = "assets/events/" + encodeURIComponent(ev.slug);
  const bannerSrc = base + ".jpg" + v;
  // A phone takes the 800px WebP (~40 KB), a wide screen the 1600px one; only
  // offered when the sync tool actually wrote them.
  const webp = (banner.webp || []).length
    ? `<source type="image/webp" sizes="(max-width: 1180px) 100vw, 1120px" ` +
      `srcset="${esc(base + "-800.webp" + v)} 800w, ${esc(base + "-1600.webp" + v)} 1600w" />`
    : "";

  // Public data only: what the Event List tab says about the event, the
  // collaborators' logos, and the site's own copies of its photos. Never the
  // brief, costing, logistics, capacity or seat counts.
  const [, mediaMap, banners, picks] = await Promise.all([
    loadCollaborators(),
    loadMediaMap(),
    loadBannerMap(),
    loadJSON(SITE_ROOT + "data/event-collabs.json").catch(() => ({})),
  ]);

  const time = calTimeText(ev);
  const mapUrl = safeUrl(ev.mapUrl);
  const venue = !ev.venue ? "" : mapUrl
    ? `<a class="text-link" href="${esc(mapUrl)}" target="_blank" rel="noopener">${esc(ev.venue)}</a>`
    : esc(ev.venue);

  // Date, time and category are in the band and the heading; the side panel
  // carries only what is not said elsewhere.
  const facts = [
    venue ? ["Venue", venue] : null,
    ev.passInfo && !ev.notPublic ? ["Entry", esc(ev.passInfo)] : null,
  ].filter(Boolean);

  // The band under the banner: the date large, where the day sits in the
  // festival, and the event's state (counting down, on today, or done).
  const chip = calDayChip(ev);
  const days = festivalDays();
  const dayNo = ev.startDate
    ? Math.round((Date.parse(ev.startDate + "T00:00:00Z") - Date.parse(FESTIVAL.start + "T00:00:00Z")) / 86400000) + 1
    : 0;
  const dayText = dayNo >= 1 && dayNo <= days ? `Day ${dayNo} <em>of ${days}</em>` : "";
  const state = ev.past
    ? `<span class="ev-state ev-state--done">Concluded</span>`
    : ev.today
      ? `<span class="ev-state ev-state--on"><i class="now-dot" aria-hidden="true"></i>On today</span><span class="ev-count" data-ev-count hidden></span>`
      : `<span class="ev-count" data-ev-count hidden></span>`;

  // Collaborators: the same logos as the event's card on the home page.
  const collabs = eventCollabsNamed(ev, picks);
  const collabHTML = collabs.length
    ? `<section class="ev-collabs"><h2 class="ev-h">In collaboration with</h2>
        <div class="ev-collab-logos">${collabs.map((c) => collabMark(c, "ev-collab-logo")).join("")}</div></section>`
    : "";

  // Photos from the day, once the event is over and the team has added them.
  const m = mediaMap[ev.slug];
  const media = m && ((m.photos || []).length || (m.videos || []).length) ? m : null;
  const galleryHTML = media
    ? `<section class="ev-gallery"><h2 class="ev-h">From the day</h2>${mediaCarouselHTML(ev.slug, media)}</section>`
    : "";

  // The lede: the description's first sentence brighter, the rest quieter.
  const d = String(ev.description || "");
  const cut = d.search(/[.!?](\s|$)/);
  const lede = cut > 0 && cut < d.length - 1 ? d.slice(0, cut + 1) : "";
  const descHTML = d
    ? `<p class="ev-desc">${lede ? `<span class="ev-lede">${esc(lede)}</span>${esc(d.slice(lede.length))}` : esc(d)}</p>`
    : "";

  // More from the festival: shows still to come first (same kind first), or
  // once it is all over, the other shows that happened.
  const pub = events.filter((x) => x !== ev && x.startDate && !x.notPublic);
  const ahead = pub.filter((x) => !x.past).sort((a, b) =>
    (a.category === ev.category ? 0 : 1) - (b.category === ev.category ? 0 : 1) || (a.startDate < b.startDate ? -1 : 1));
  const more = (ahead.length ? ahead : pub.slice().sort((a, b) => a.startDate < b.startDate ? 1 : -1)).slice(0, 3);
  const moreHTML = more.length
    ? `<section class="ev-more"><h2 class="ev-h">${ahead.length ? "More in the festival" : "Also in the festival"}</h2>
        <div class="ev-more-grid">${more.map((x) => {
          const pic = eventPictures(x, banners)[0];
          return `<a class="ev-more-card" href="${esc(eventHref(x))}">
            <span class="ev-more-pic">${pic ? pictureTag(pic, "") : `<span class="cal-past-mono">${esc(collabMonogram(x.title))}</span>`}</span>
            <span class="ev-more-body">
              <span class="ev-more-when">${esc(calDateText(x))}${x.category ? ` · ${esc(x.category)}` : ""}</span>
              <span class="ev-more-title">${esc(x.title)}</span>
              ${x.venue ? `<span class="ev-more-venue">${CAL_ICONS.pin}<span>${esc(x.venue)}</span></span>` : ""}
            </span></a>`;
        }).join("")}</div></section>`
    : "";

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
      <picture>
        ${webp}
        <img src="${esc(bannerSrc)}" alt="${esc(ev.title)}" width="1600" height="800"
             fetchpriority="high" decoding="async"
             onload="this.closest('.ev-banner').classList.add('has-image')"
             onerror="this.closest('picture').remove()" />
      </picture>
    </figure>

    <div class="ev-band">
      <span class="ev-date"><b>${esc(chip.day)}</b><span>${esc(chip.mon)}</span></span>
      <span class="ev-band-mid">
        ${dayText ? `<span class="ev-day">${dayText}</span>` : ""}
        <span class="ev-band-when">${esc(calDateText(ev))}${time ? ` <span class="ev-sep">·</span> ${time}` : ""}</span>
      </span>
      <span class="ev-band-state">${state}</span>
    </div>

    <div class="ev-grid">
      <div class="ev-main">
        <div class="ev-head">
          ${ev.category ? `<span class="cal-cat">${esc(ev.category)}</span>` : ""}
          ${ev.past || ev.today ? "" : calStatusChip(ev)}
        </div>
        <h1 class="ev-title">${esc(ev.title)}</h1>
        ${descHTML}
        ${galleryHTML}
        ${collabHTML}
      </div>

      <aside class="ev-side">
        ${facts.length ? `<dl class="ev-facts">
          ${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}
        </dl>` : ""}
        <div class="ev-act cal-act">${calAction(ev)}</div>
      </aside>
    </div>
    ${moreHTML}`;

  if (media) wireCarousels(wrap);

  // Countdown to this event's next start, in the band.
  const counter = wrap.querySelector("[data-ev-count]");
  if (counter && !ev.past) {
    const tick = () => {
      const at = eventInstants(ev).filter((t) => t > Date.now()).sort((a, b) => a - b)[0];
      if (!at) { counter.hidden = true; return; }
      counter.hidden = false;
      counter.innerHTML = `starts in ${fmtLeft(at - Date.now())}`;
    };
    tick();
    setInterval(tick, 1000);
  }

  if (typeof trackView === "function") trackView("/event/" + ev.slug, ev.title);
})();
