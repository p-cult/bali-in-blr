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
2. **Arrival** at the venue = scheduled start − *before* buffer (per
   category: Performance 150 min, Workshop 45, Talk 60; editable globally
   and per event).
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
6. **Morning**, walked back from the first departure: get ready 45 min,
   breakfast 45, wake 60 before that. Earlier than 5.30am is flagged as an
   early call; later than 1.00am as a late night. Lunch that falls inside an
   event is flagged (packed lunch).
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

## Internal engagements

Photoshoots, rehearsals, receptions and other things the group must travel
to that are not on the public calendar live in the plan configuration
(`extras` in `data/logistics.json`, editable in the planner's "Internal
engagements" panel), never in the schedule sheet. They plan exactly like
public events, with their own buffer row ("Internal"), and are marked as
internal on the plan. First entry: the photoshoot at Mandala Cultural
Centre, Kanakapura Road, on 2 Oct 2026 (time assumed 10am–2pm).

## Travel time — three providers

| Provider | Needs | Gives |
|---|---|---|
| `osrm` (default) | nothing (public OSRM demo server) | free-flow road time + distance for every pair, in one request |
| `bridge` | `Logistics.gs` deployed and `CONFIG.LOGISTICS_URL` set | Google Maps duration **with predicted traffic for the exact departure time**, per leg, cached |
| `haversine` | nothing, offline | road-factored straight line at 27 km/h |

Free-flow times are shaped by an hour-of-day **Bengaluru traffic profile**
(`data/logistics.json` → `traffic.weekday` / `weekend`, a multiplier per
hour, ×1.1 safety). The multiplier stretches only the first 75 minutes of a
leg, so a highway run to Manipal is not doubled. When the bridge is on,
"Refresh live traffic" replaces every leg with Google's figure for that
departure, then re-plans; results are cached per weekday and 15-minute slot
so a re-plan costs nothing.

## Comparing stays

Every *active* stay is planned in full. The comparison table shows total
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

## Sharing and saving

- **Copy public link** puts the entire plan (stays, buffers, overrides,
  venue pins) in the URL hash of `/plan/`, so the public page shows exactly
  what the planner shows, with no backend. `?stay=<id>` picks the stay,
  `?day=YYYY-MM-DD` opens that day (today opens by default).
- **Save plan** (visible when the bridge is deployed) stores the same
  configuration in the Logistics sheet; `/plan/` without a hash then loads
  it. Drafts also persist in the planner's own browser (localStorage).

## Backend: `docs/apps-script/Logistics.gs`

A third Apps Script web app (keep it separate from the registration bridge
and the tickets app so planning never competes with signups). Setup steps
are in the file header. Once deployed, paste the `/exec` URL into
`CONFIG.LOGISTICS_URL` in `plan/engine.js` and bump `?v=` on both pages.
Actions: `leg` (traffic-aware duration), `geocode`, `load`, `save`. No
personal data passes through it.

## Known limits

- OSRM's public demo server has no SLA; if it is down the engine falls back
  to the straight-line estimate and says so in the warnings bar.
- Traffic profile numbers are a planning heuristic, not a measurement.
  Switch on the bridge for real figures.
- Venue positions marked `locality` are approximate (a few hundred metres).
