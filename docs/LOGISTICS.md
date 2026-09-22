# Artist logistics planner

Day-by-day tour plan for the touring company (20 Balinese artists), computed
from the live festival schedule and road conditions. Two faces, one engine:

| Page | Who | What |
|---|---|---|
| `/admin/logistics.html` | staff (sign-in gate, tool name `logistics`) | the planner: stays, buffers, day rhythm, per-event overrides, comparison of stays, print, public link |
| `/plan/` | the touring company, by link only (noindex, `robots.txt` disallow, not linked from the site) | read-only day-by-day plan, expandable per day, printable |

Shared code in `plan/`: `engine.js` (schedule, venues, travel, planning),
`render.js` (day cards, totals, comparison tables), `plan.css`.
Data in `data/venues.json` (venue positions) and `data/logistics.json`
(default plan configuration: stay, party, buffers, day rhythm, traffic
profile).

## How a day is built

1. **Events** for the date come from the Event List sheet (same feed as the
   site calendar). Multi-day workshops become one entry per day; "3.30pm and
   7.30pm" becomes two shows in one block. An event with no end time gets the
   category's default length.
2. **Arrival** at the venue = scheduled start − (instrument & stage
   set-up + sound check + costume/make-up/warm-up). Defaults per category
   (Performance 30 + 30 + 60 min; Workshop 10 + 10 + 15; Talk 10 + 10 + 20),
   editable globally and per event. A late arrival squeezes them in order:
   set-up is protected first, then sound check, then whatever is left for
   costume, and the day is red-flagged when costume time is lost.
   After a show: costume off and make-up removal (Performance 20 min,
   others 5), then wrap (pack, meet people, load-out; 30 / 15); meals and
   the drive home follow both. Instruments and sets travel in a separate
   production vehicle, so the group's own loading allowance is only its
   personal kit (10 min out, 5 min back).
3. **Departure** = arrival − travel time at that departure hour, − 20 min
   loading when leaving the stay. Travel is recomputed until the departure
   hour used for traffic matches the actual departure.
4. **Between events**: if the gap is long enough (default ≥ 4 h and the
   round trip plus 90 min fits) the group returns to the stay; otherwise it
   holds in town near the venue. If the previous event's wrap runs past the
   ideal departure, the leg leaves as soon as possible and the day is flagged
   with the minutes lost from the buffer.
5. **Evening**: wrap (*after* buffer) → return → dinner at the stay if home by
   10.30pm, else dinner near the venue before the drive → lights out 60 min
   after dinner.
6. **Morning**, walked back from the first departure: personal kit into
   the vehicle 10 min, get ready 30, breakfast 40, wake 30 before that
   (about 1 h 50 before leaving). On a later start the group wakes at 7am
   and eats around 7.30 anyway, with the free time shown. Earlier than
   5.30am is flagged as an early call; later than 1.00am as a late night.
7. **Rest days** (no events) still appear so the tour is continuous.
8. **Out-of-town days** (Manipal) travel **overnight both ways**: the group
   leaves the stay the night before (after the "night coach leaves after"
   time, default 9.30pm, timed to arrive around 6am and never later than
   11.45pm), freshens up on arrival, does the programme, has dinner in town
   and leaves again at night to be home by early morning. If the previous
   day's show ends too late to go home first, the coach leaves straight from
   that venue after dinner. The two night legs are shown on the days before
   and after as well, and both days are flagged.

Before breakfast and after dinner are rendered *broad* (dimmed); the working
day is detailed to the minute.

**Red flags.** A day gets a red badge on its summary line, a red border and
red-highlighted flag lines when something cannot work as scheduled: a venue
that cannot be reached before the start, a late arrival that leaves no (or
under half the) costume / make-up time, a timed add-on that overlaps an
event, or under five hours between lights out and wake-up. Everything else
(early calls, short nights of five to six and a half hours, packed lunches,
notes) stays a plain flag. The totals card and the comparison table count
red-flag days per stay. The plan states the problem; it does not propose
schedule changes.

## Internal engagements

Photoshoots, rehearsals, receptions and other things the group must travel
to that are not on the public calendar live in the plan configuration
(`extras` in `data/logistics.json`, editable in the planner's "Internal
engagements" panel), never in the schedule sheet. They plan exactly like
public events, with their own buffer row ("Internal"), and are marked as
internal on the plan. First entry: the photoshoot at Mandala Cultural
Centre, Kanakapura Road, on 2 Oct 2026, 7am–2pm.

## Meals

Every day shows breakfast, lunch and dinner as their own lines. The default
is wherever the group is at that time: breakfast at the stay (or on arrival
after a night drive), lunch at the stay, in a hold in town near the venue,
or packed at the venue when a show runs through the window, dinner at the
stay when home in time or near the venue when late. In the planner each
meal line is editable: time and length (HH:MM, minutes), a note, or
"Elsewhere" with a Maps link, which turns that meal into a located stop and
re-routes the day; "Back to default" returns it to where they are.

## Day add-ons (meals out, sightseeing, shopping)

Inside any day in the planner, the add-on row takes a **purpose**
(breakfast, lunch, dinner, sightseeing, shopping, other), a **location**
(Google Maps link, address or `lat, lon`) and optional **start / end times
in HH:MM**. The list is blank by default. Each stop becomes a point the day
routes through, so departure, holds and the return all re-derive:

- A **timed** stop is pinned at that time (and flagged if it overlaps an
  event).
- An untimed **breakfast** goes before the first call, on the way, at a
  normal breakfast hour; breakfast at the stay is dropped.
- An untimed **lunch** takes the first gap that overlaps the lunch window;
  an untimed **dinner** follows the last event, then the drive home.
- An untimed **sightseeing / shopping / other** stop (90 min) takes the
  first gap in the day that fits, or says it does not fit.
- A day with no programme but with add-ons becomes an outing (stay → stops
  → stay), with wake-up and meals around it.

The place name is read from the Maps link when it has one, the link is kept
on the plan, and add-ons travel in the public link.

## Travel time — three providers

| Provider | Needs | Gives |
|---|---|---|
| `osrm` (default) | nothing (public OSRM demo server) | free-flow road time + distance for every pair, in one request |
| `bridge` (default once connected) | `Logistics.gs` deployed and `CONFIG.LOGISTICS_URL` set | Google Maps duration for the exact departure time: **typical traffic for that weekday and hour** while the date is far off, refreshed hourly inside 48 h, **live** and refreshed every 10 min inside 2 h of departure |
| `haversine` | nothing, offline | road-factored straight line at 27 km/h |

Free-flow times are shaped by an hour-of-day **Bengaluru traffic profile**
(`data/logistics.json` → `traffic.weekday` / `weekend`, a multiplier per
hour, ×1.1 safety). The multiplier stretches only the first 75 minutes of a
leg, so a highway run to Manipal is not doubled. When the bridge is on,
"Refresh live traffic" replaces every leg with Google's figure for that
departure, then re-plans; results are cached per weekday and 15-minute slot
so a re-plan costs nothing.

**Quick reloads.** Google figures are also kept in the browser
(localStorage, `bali-legcache-v1`) with the time they were fetched. On the
next load the priced plan appears at once, and only legs whose figure has
aged past its tier (typical 7 days; within 48 h of departure 1 h; within
2 h 10 min) are asked for again, in the background, while the loader says
"Checking Google traffic…". The backend keeps its own cache too, so a
fresh browser still prices in seconds rather than minutes.

## Comparing stays

Each stay row has a **main plan** radio (the stay shown day by day, on
the public link and in the sheet), a **compare** checkbox (plan it in full
for the comparison) and a **Delete** button that asks first and is disabled
on the main plan. If a default stay is missing from your draft, a "Restore
…" button brings it back. Every compared stay is planned in full. The comparison table shows total
road time, delta against the best, distance, average per show day,
earliest wake, latest lights out, early calls, holds in town, and an
indicative vehicle cost (₹/km × km, floored at a per-day minimum). A second
table shows leave/back per day for each stay. Add a stay by pasting an
address (geocoded through the bridge, else OpenStreetMap), a Google Maps
link with coordinates, or `lat, lon`.

## Venues

`data/venues.json` holds one entry per venue with `lat`/`lon`, `precision`
(building / street / locality / town) and `aliases` so sheet spellings
("Dathu", "Studio 1, PCPA") resolve. The planner lists every venue on the
schedule with its precision; a `locality` or `NOT LOCATED` venue can be
pinned from the planner (kept in the plan as `venueOverrides`), and should
then be written back into `venues.json` for good.

## The Google Sheet planner (inputs)

**Bali in Bengaluru — Logistics Planner** (link in the vault and on the
admin planner's "Open the Google Sheet" button) is where staff enter the
inputs. It is created and refreshed by the logistics web app
(`?action=buildsheet`, on demand from the planner's "Re-pull events into
sheet" button; no timer), so no IMPORTRANGE permissions are involved.

- **Settings** tab: place of stay (dropdown), instrument storage location
  (address or Maps link), artists, volunteers, and the default lead for
  instruments at the venue (HH:MM). Headers on row 10, values from row 11.
- **One tab per tour day** ("02 Oct" … "18 Oct"). Rows 1–9 are the title
  block; A2 reads `DD MMM | DAY | HH:MM` where the time is the day's
  departure from the stay, written by the planner. Row 10 holds the
  headers, row 11 onward the day's events pulled from the planning
  workbook's Event List (grey, protected: type, title, venue, start, end,
  status). Beside them the inputs: artists on that show, set-up, sound
  check, costume & make-up, costume off, wrap (all HH:MM, so 30 minutes is
  `00:30`), Skip? (Yes/No), **Instruments at venue by** (HH:MM, blank =
  the default lead before set-up) and **Vehicle leaves storage** (grey,
  computed by the planner from the storage location and traffic), plus a
  note. Below, an **add-ons** block: purpose dropdown (Breakfast, Lunch,
  Dinner, Sightseeing, Shopping, Engagement, Other), location (Maps link or
  address), start and end (HH:MM), Include? (Yes/No), note. An Engagement
  row ("Photoshoot — Mandala Cultural Centre") becomes an internal event.
- Re-pulling keeps every input; it only refreshes the grey cells and adds
  new days or events.

**Two-way sync.** The planner and the public page read the sheet on load
(`?action=sheetplan`); "Fetch sheet inputs" re-reads it without a page
reload. In the other direction the planner writes every day to the sheet
after pricing and about three seconds after any edit made in the planner:
artists per show, the five segments, Skip?, notes, both instrument-vehicle
times, the add-on rows (engagements and stops) and the Settings values
(`writeback`). Last writer wins; there is no merge. A value written by the
planner into an input cell (for example "Instruments at venue by") is from
then on the sheet's value, so change it in either place.

## Admin planner controls (after the 22 Sep tidy-up)

Top bar, four buttons: **Sync everything** (re-pull the Event List into the
sheet, read the sheet's inputs, re-price every leg with Google traffic,
write the plan back), **Open the Google Sheet**, **Print / PDF**, **Reset my
draft** (discard this browser's edits and reload the shipped defaults).
Panels: places of stay (main-plan radio, compare checkbox, guarded Delete,
Restore), group and vehicles, day rhythm, buffers by event type,
**per-show settings** (pick a show from the dropdown, enter its cast, artist
count and timings, Submit replaces the type defaults for that show and
recalibrates; "Back to type defaults" clears it), comparison, the day cards
(each with "Print this day", meal lines and add-ons), venues, and the public
link (Copy public link, Open public page, Copy frozen snapshot). Internal
engagements are entered as Engagement rows in the sheet's add-ons, not in a
separate panel. Per-event inline editors were removed in favour of the
per-show panel.

**Cast per show.** Each event carries an artist count and a cast (names or a
group), in the sheet's "Artists" and "Cast" columns or the per-show panel.
The day's travelling party is the largest cast any event that day needs;
the rest are noted as staying at the stay.

## Sharing and saving

- **Print / save as PDF** on either page prints the plan as one day per
  page, two-column rows, cream sheet. `/plan/?print=1` opens the public page
  with every day expanded for headless printing; a PDF was rendered this
  way with Chrome headless (`--print-to-pdf`, a two-minute virtual time
  budget so Google traffic finishes first).
- **Copy public link** puts the entire plan (stays, buffers, overrides,
  venue pins) in the URL hash of `/plan/`, so the public page shows exactly
  what the planner shows, with no backend. `?stay=<id>` picks the stay,
  `?day=YYYY-MM-DD` opens that day (today opens by default).
- **Save plan** (visible when the bridge is deployed) stores the same
  configuration in the Logistics sheet; `/plan/` without a hash then loads
  it. Drafts also persist in the planner's own browser (localStorage).

## Backend: `docs/apps-script/Logistics.gs`

A third Apps Script web app, **deployed 22 Sep 2026** as the standalone
project "Bali-in-Blr Logistics" (owner: the Foundation's Apps Script
account; deployment "Logistics web app v1", currently Version 2). Its `/exec` URL is in
`CONFIG.LOGISTICS_URL` in `plan/engine.js` (public by necessity, like the
bridge URL). It finds the planning workbook by name and keeps its
`TravelCache` and `Plan` tabs there. To change the code: paste the new
file, then Deploy → Manage deployments → edit → New version. **Never create
a second deployment** (the URL would change).
Actions: `leg` (one traffic-aware duration), `legs` (up to 40 in one
execution — what the planner uses, 12 at a time, sequentially, because
Apps Script answers bursts of parallel calls with an HTML error page),
`geocode`, `load`, `save`. No personal data passes through it.

## Known limits

- OSRM's public demo server has no SLA; if it is down the engine falls back
  to the straight-line estimate and says so in the warnings bar.
- Traffic profile numbers are a planning heuristic, not a measurement.
  Switch on the bridge for real figures.
- Venue positions marked `locality` are approximate (a few hundred metres).
