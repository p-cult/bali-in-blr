# Link attribution — which minted link sold what

`admin/attribution.html` sets the clicks each campaign link produced against
the tickets the team recorded, and estimates how many sales each link is
likely to have brought. Three sources, none of them personal:

| Source | What it gives | Where |
| --- | --- | --- |
| **Click log** (new) | visits, event opens, ticket clicks, registrations — each with the campaign ref the visit arrived on | `docs/apps-script/Hits.gs`, its own web app and its own small sheet; `CONFIG.HITS_URL` in `main.js` |
| **Tickets sheet** | tickets recorded per event and per day | the tickets web app (`admin/tickets.html` `API`), `?data=1` now returns `byEvent` + `daily` |
| **Mint tab** | the links themselves: code, source, medium, campaign, destination | registration bridge `?sheet=links` |

## The estimate

1. A visit remembers its `ref` (from the minted link) for the whole session.
2. A click on a Book button logs a **ticket click** for that ref and event.
3. Each event's recorded sales are shared across refs in proportion to their
   ticket clicks on that event. A link with 30% of an event's ticket clicks is
   credited with 30% of its sales.
4. Registrations count only when the bridge confirmed the row.

It is a triangulation, not a receipt: BookMyShow and District never say which
click bought what. Read it as a fair share, in comparison between links.

## Status

Wired on 6 Oct 2026. The click log is the standalone Apps Script project
"Bali-in-Blr Hits" writing to the sheet "Bali in Blr - Hits" (both in the
paramculture Drive); its `/exec` URL is `CONFIG.HITS_URL`. The tickets app was redeployed
the same day (version 3) and reports per-event sales. Nothing pending.

## Set up (once, about ten minutes)

1. **Click log.** Create a new Google Sheet "Bali in Blr - Hits" (its own
   file, so beacons never share execution slots with signups). Extensions ▸
   Apps Script ▸ paste `docs/apps-script/Hits.gs` ▸ Deploy ▸ New deployment ▸
   Web app, execute as **Me**, access **Anyone** ▸ copy the `/exec` URL into
   `CONFIG.HITS_URL` in `main.js`, bump the `main.js?v=` tag on every page that
   loads it, push. Clicks start logging on the next deploy.
2. **Tickets app.** Open the tickets sheet's script, replace it with
   `docs/apps-script/Tickets.gs`, Deploy ▸ **Manage deployments ▸ edit ▸ new
   version** (never a new deployment — the URL would change). The dashboard
   then shows per-event sales; until then totals only.

The dashboard tells you on its own which of these is still missing.

## What is logged

One row per action: time, day, kind, event title, ref, page, a random
per-session id, mobile/desktop. No IP, no name, no email, nothing that
identifies a person. The session id exists only to count a visit once.

## Gotchas learnt the hard way (6 Oct 2026)

- Hits travel as **GET** `?hit=1&…`. Browser POSTs to script.google.com were
  turned away with a 400 after a short while; a GET never was.
- The session id parameter is called **`vs`**. `sid` is reserved by Google's
  front end and gets a 400 before the script even runs.
- A raw `(` in a hand-made test request also gets a 400; the site encodes it.

