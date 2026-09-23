# JOURNAL — decisions, problems solved, and lessons learned

This is the project's institutional memory. `HANDOVER.md` says what the site
**is**; this file says **why it is that way** and what went wrong on the way
here, so that any person or AI tool, on any machine, carries the same
understanding. Read it after `HANDOVER.md` and before changing anything that
looks odd — it is probably odd for a reason recorded here.

**Keep it current.** When a change fixes a real problem, reverses a decision,
or reveals a constraint, add an entry to §1 (chronology) and, if it is a rule
worth keeping, to §2 (lessons). Full detail is always in `git log` — commit
messages on this project are written as explanations, not labels.

**Two halves.** This file is the public half. Context that must not sit in a
public repo — sheet ids, the state of the planning sheet, design board and
asset links, people, the admin gate — lives in the sealed vault under a
`memory` key: `bash tools/vault.sh show` (needs the drive's key; see
`docs/SECURITY.md`). Read both at the start of a session. Private lessons go
there, then `tools/vault.sh seal` and commit the `.enc`.

---

## 0. Where things stand (update this block when the status changes)

- **Live** at https://bali-in-blr.paramfoundation.org (GitHub Pages, custom
  domain, HTTPS). Programmed events run **3–18 October 2026** — sixteen days,
  opening with the Inaugural Kecak on 3 Oct. (It was billed 1–18 Oct early on;
  the sheet is authoritative and the site's copy was reconciled to it on
  17 Sep — see §1.)
- **Bridge connected.** Register and Volunteer forms save via the Apps Script
  bridge into a deduplicated `Master` registry with per-flavour tabs and
  receipts. Calendar reads the schedule sheet's `Event List` tab live, with a
  publish-proof fallback through the bridge (`?feed=schedule` / `?feed=collab`).
  Live counts: `BRIDGE_URL?sheet=stats` (198 registered on 19 Sep 2026:
  58 updates, 143 volunteers — 201 flavour rows, so the dedup is working).
  This number moves; read the endpoint, do not quote this line.
- **Measurement.** Views, every call-to-action click, phone and email taps,
  outbound links and confirmed registrations all reach `dataLayer`. The GTM
  container still needs its tags: see `docs/ANALYTICS-SETUP.md`.
- **Ticketing.** Buttons follow the sheet. As of 19 Sep 2026, **8 of the 16
  listed events carry a live BookMyShow URL and 6 also carry District**; the
  rest funnel to Register until a real `https://` is pasted into the Event
  List. The **BMS** tab still stores Ctrl-K hyperlinks labelled "Link";
  published TSV only has that word, so the overlay ignores those labels and
  they cannot wipe a real Event List URL. `BOOKING_OPEN` only gates the
  occupancy bar. Verify counts against the live page, not this line.
- **Analytics:** Google Tag Manager installed; GA4/Meta/Ads are added inside
  GTM, not in the repo.
- **Admin:** `/admin` hub with a staff sign-in gate, the Campaign Link
  Builder, a **Project report** (`/admin/report.html`) that reconstructs the
  funder write-up from the planning workbook plus live registration counts,
  and **Ticket sales** (`/admin/tickets.html`). The hub hides any tool the
  signed-in user cannot open (`ACCESS` in `admin/auth.js`).
- **Collaborators** are published from the Collab/venues tab's Logos block:
  a row needs a logo link AND a received status (`collabReceived`). "Pending",
  "NA" or blank keeps it off the site, so pasting a logo early is harmless —
  marking it received is what publishes it. 14 published; Ministry of culture
  is Pending with no file.
- **Images:** event photos AND collaborator logos come from Google Drive
  links in the sheet, synced to `assets/drive/` by `tools/sync-images.sh`.
  Photos become `.jpg`; a logo with transparency stays `.png` with its alpha.
  The site tries `.png`, then `.jpg`, then the live Drive copy — so a newly
  linked logo shows before the script has run. Programme cards carry the
  client's own photos (all seven have real images; no placeholder remains).
- **Brand:** the festival logo (`assets/logo.svg`) is inlined wherever the
  name is a heading or brand mark; the hero uses the title mark, inlined in
  `index.html` and deliberately not shipped as a file (source in the vault).
  Hero copy is the client's, applied 9 Sep from their corrections document.
  The three hero numbers are **not** copy — they auto-sync from the schedule
  sheet (`updateHeroStats`) and currently read 16 days / 16 events / 14
  venues. The markup holds the same values as a fallback. Do not quote a
  number from this file as the live one; read the page.
- **Brand kit:** colour, pairings, the reference boards, the block motif,
  seams and edges, both wordmarks and type. Shared with the team at
  **/brand/** (link-only: noindex, robots-disallowed, unlinked). It is the
  thing to hand a designer; the stylesheets remain the exact reference.
- **Progress dashboard:** `/progress/` (link-only) — tickets from the Tickets
  workbook, events from the Event List, totals from the bridge. See §1, 18 Sep.
- **Event pages:** `event/?e=<slug>` for every event with tickets live, read
  live from the sheet; the calendar row links to it. Banners from one Drive
  folder per event (`data/event-banners.json`), served as responsive WebP
  (~40 KB on a phone), synced hourly; a stand-in shows until one exists.
- **Hero figures** count only public events and their venues: 16 days,
  15 events, 13 venues on 22 Sep 2026.
- **Print:** `tools/build-event-posters.py` renders the event listing at
  500&#215;1000&#160;mm and 1000&#215;500&#160;mm into `assets/print/`.
- **Open:**
  - **Pending Apps Script deploy.** The repo `Code.gs` has the `?feed=bms`
    handler and the rich-text `sheetTsv` (which writes a hyperlink's href
    instead of its label); the live script does **not** — `?feed=bms` still
    returns the default service JSON. Nothing is broken by this: the Event
    List's own provider columns carry the live URLs. Until it is deployed, a
    Ctrl-K "Link" on the BMS tab cannot be read; a pasted `https://…` can.
    Deploy by editing only those lines — **never paste the whole repo
    `Code.gs`** over the live script (it blanks `SHEET_ID`/`PLANNING_ID` and
    kills registrations; see §1, 17 Sep).
  - Paste real BookMyShow / District URLs into the Event List as shows go on
    sale (7 of 15 done).
  - Rotate the admin passwords (the old ones were served in comments).
    `admin/auth.js` currently holds jois, vinod and kishan (tickets only).
  - Post-event media/gallery (Phase 4).
  - The Monument display font is not licensed (see §2).

---

## 1. Chronology — what happened and why

### 1 Sep 2026 — from brochure to hub
- Scaffolded a starter page, then built a brochure-style landing page from the
  festival PDF (14 optimised photos). Applied a client corrections document
  (wording, "18 days", event order, condensed objectives and bio).
- Redesigned to a bold dark direction (Archivo Black + Space Grotesk, coral and
  yellow) chosen from three mockups. Removed the "Balinese roots" section on
  request.
- Restructured into a **hub**: signup form wired to a Sheets + Apps Script
  bridge (demo mode until connected), calendar from `data/events.json`,
  partners grid, SEO (OG cards, JSON-LD, sitemap, robots).
- Wrote `HANDOVER.md`, `CLAUDE.md`, Cursor rules, and the bridge (`Code.gs`)
  with a setup guide — so that the project could be resumed anywhere.

### 4 Sep 2026 — the bridge, the forms, and the domain
- **One switch for the bridge.** `BRIDGE_URL` alone derives the events,
  partners and stats sources; empty means local JSON. Reads fall back to JSONP
  when a browser blocks cross-origin GET.
- **Master registry.** One row per person, deduplicated on name + phone or
  name + email, with phone numbers normalised (`+91 98450 12345`,
  `09845012345`, `9845012345` all match). Each form is a "flavour" with its
  own tab; a second flavour adds a Source rather than a second row. A script
  lock stops two submissions passing the duplicate check together.
- **Honest confirmations.** "Your response has been recorded" appears only
  after the bridge confirms the row. Each submission carries a random id; if
  the reply is unreadable the client looks the id up in a `Receipts` tab.
  This fixed a false-duplicate bug where a blind resend filed a first-time
  volunteer as already registered.
- **In-page views.** Register, Volunteer and Calendar open as full-screen
  overlays routed off the hash (`#register`, `#volunteer`, `#calendar`), so
  links are shareable and the browser Back button closes them.
- **Trackable links.** `?ref=` (folded into the sheet's Sources) and UTM
  parameters, kept for the visit so late signups still count.
- **Question carousel** before the signup card, mobile-first at 375×812;
  questions in `data/questions.json`; every question mandatory by
  construction, enforced client- and server-side.
- **Bridge deployment saga.** Reads worked; every POST returned Google's own
  HTTP 400 page with zero `doPost` executions logged. First diagnosed as a
  Workspace policy. **It was ours:** Google's front end rejects any request
  carrying a parameter named `sid` before the script runs. Found by bisecting
  the payload field by field. Renamed to `submission`; the bridge went live.
- **Duplicate refusal at entry.** As soon as name + phone/email are typed,
  the form asks the bridge and says "already registered" immediately.
  Fail-open: if the bridge is unreachable the form carries on.
- **Domain move** to `bali-in-blr.paramfoundation.org`. Pushing the `CNAME`
  before DNS existed would have made GitHub redirect the live site to a
  hostname that answered nothing, so the CNAME was held back and added only
  once the record resolved. Absolute URLs (canonical, OG, sitemap) were
  repointed first, harmlessly.
- **Calendar reads the sheet.** The schedule sheet gained an `Event List`
  tab (a proper table, header row located by name, so blank rows above it
  and column reordering are fine). Falls back to `data/events.json` when
  empty.
- **Vault.** Sensitive notes (spreadsheet ids, what each holds) sealed in
  `secure/vault.json.enc` (AES-256-CBC, 200k PBKDF2). Key lives only on the
  external drive at `/Volumes/bkp-01/.secrets/`. Two bugs found in testing:
  the openssl helper dropped its arguments so `open` re-encrypted; and
  openssl emits garbage before reporting a bad key.
- **Measurement.** `dataLayer` events `virtual_page_view` (each in-page view
  reported by hand, since it is one page) and `registration_complete` (only
  on a confirmed new row, never on click, duplicate or demo). No PII in
  events. GTM container installed in `<head>`; verified zero third-party
  scripts when no id is set.
- **Privacy policy** in plain English; vendor names removed at the
  Foundation's request; responsibility for submitted details placed on the
  person entering them (DPDP duty), nobody under 18 to be registered.
- **Consent line iterations:** separate 18+ tick → merged into one line →
  one identical line for every form ("I'm 18 or over, these details are
  mine or shared with permission, and Param Foundation may contact me about
  Bali in Bengaluru"). Validation messages moved from under the button to
  the field itself.
- **Design direction arrives** (boards by Harshitha Jois; brief from Vinod):
  folk-festival poster feel, Pantone metallic gold, charcoal, rose smoke,
  black-on-cream scallop/harlequin/wave patterns; headline font Monument
  Extended. A first copper-on-charcoal rebuild with the Grvtrn display face
  was **reverted in full** on review. A second pass kept the charcoal ground
  and copper for structure, festival orange for every action, Archivo at
  width 125 for display and Instrument Sans for body — all measured for
  contrast (lowest 4.53:1).

### 5 Sep 2026 — v2 design, promoted
- Oxblood and deep maroon grounds for the Featuring and Support sections,
  each restating what text colours it permits (orange fails on oxblood).
- Rebuilt the page as `v2.html` beside the live one, then promoted it to
  `index.html`; the old design frozen as `v1.html` with its own stylesheet.
- Iterations recorded in commits: support section as a definition list on
  maroon; wordmark from 8rem to 3.6rem; programme photographs restored after
  a text-only strand layout read as a wall; calendar given photographs, a
  date block and colour-coded categories; hero cut from 88vh to 68vh; heading
  scale brought down to 2.15rem.
- **Audit pass** fixed four real defects: a visitor could wait 82 s on an
  unreachable bridge (now a 10 s budget); a wrongly matched duplicate verdict
  never cleared; the v1 backup mixed markup and CSS from different commits;
  the privacy page had no GTM container.
- Print calendar generator `tools/build-calendar-pdf.py`.

### 6 Sep 2026 — stylesheet system, print edition, smart calendar, portability
- **Stylesheet rewrite.** `styles.css` is the system (tokens, components,
  stands alone; what `privacy.html` loads); `site.css` is the page treatment.
  Seven places where `site.css` silently overrode `styles.css` collapsed to
  one definition each; twelve dead selectors removed; one breakpoint ladder
  per file. Every measured value unchanged.
- **Print edition**: cream sheet, copper rules, columns where earned; prints
  the open view rather than the page behind it; forms unfold on paper.
  `@page` margins are overridden by the browser's dialog, so breathing space
  is content padding instead.
- **Portability**: committed `__pycache__` with absolute paths removed and
  ignored; the PDF script finds any Chromium browser; `tools/doctor.sh` and
  `docs/ANOTHER-MACHINE.md` added. GitHub credentials are the one thing that
  does not travel with the drive.
- **Smart calendar** (`.cal-event` module): status derived from data
  (tickets live / filling fast / sold out / RSVP / opens soon), occupancy
  bar, smart time reading, multi-day ranges, Maps link for venue, sheet row
  order preserved. Phone numbers in the ticket column become `tel:` links.
  `status` cell of `none`/`hide` suppresses the chip.
- **Hardening**: `safeUrl()` whitelists http(s)/mailto/tel/relative for every
  sheet-sourced link (blocks `javascript:`/`data:` from a sheet editor);
  `fetchWithTimeout()` 6 s on reads.
- **Register with a programme picker**: first step is a live checklist built
  from the calendar, with a "Season pass" master box. Shipped before the
  bridge was redeployed, which broke signups; fixed by mirroring
  `programmes` into the old `interest` field so both bridge versions work.
- Campaign Link Builder admin page added.

### 7 Sep 2026 — campaign links, gating, funnelling
- Minted links recorded to the sheet's `Mint` tab (no PII); QR minting (SVG
  and PNG). Admin page gated behind a staff sign-in (hashed passwords,
  deliberately lightweight — it is a link builder, not a secret store).
- **All event buttons route to Register.** The sheet held placeholder links
  (`forms.gle/EXAMPLE-*`) that were reaching the page. `BOOKING_OPEN=false`
  makes buttons ignore sheet links entirely; `toActionUrl` additionally
  strips `EXAMPLE-` and RFC-2606 example domains at the data layer.
- Per-event RSVP wired through the bridge into an `RSVPs` tab, behind
  `RSVP_ENABLED=false`. Enabling needs the flag **and** an Apps Script
  redeploy, or the bridge answers "Unknown flavour: rsvp".

### 8 Sep 2026 — admin hub, headings, Drive images
- `/admin` hub with shared `auth.js`; robustness fixes from an audit
  (notify default if `questions.json` fails; narrowed placeholder filter).
- **Heading font churn**: Space Grotesk tried as a free Monument look-alike
  and reverted the same day; Archivo Black tried; settled on **Archivo
  ExtraBold 800 at normal width** (not the expanded axis).
- **Drive images.** A sheet cell held a Drive *view* link (a web page, not an
  image). Tested: Drive thumbnail/lh3/uc forms all fail to embed reliably.
  Solution: `tools/sync-images.sh` downloads every Drive link in the sheet,
  optimises to 1600px JPEG, writes `assets/drive/<fileId>.jpg`, and
  `toImageUrl()` maps the link to that local file. A failed image collapses
  to a clean no-image poster via `onerror`.

### 9 Sep 2026 — sync, push fix, documentation
- Synced four new event photos. The push failed twice with `HTTP 400 / the
  remote end hung up unexpectedly`: Git's default HTTP buffer is too small
  for image payloads. Fixed with `http.postBuffer = 157286400` in the repo's
  `.git/config` (travels with the drive). Newly pushed files can 404 on the
  CDN for about a minute after the Pages build reports success.
- This journal and `AGENTS.md` written so every tool and machine starts with
  the same memory. The private half of that memory (what cannot be public)
  added to the vault under `memory`, so it travels with the drive too.
- **Festival logo arrives** (Illustrator SVG: "Param" in brown over "BALI IN
  BENGALURU" in yellow and orange). Inlined as one `.logo` component in the
  master stylesheet, sized by context, and it replaces the phrase wherever it
  is a heading or brand mark: site header, hero `h1`, print masthead, footer,
  every in-page view bar, the privacy header, and the admin pages and sign-in
  card. Paragraph mentions stay as text. Each replaced heading keeps an
  `.sr-only` "Bali in Bengaluru" so assistive tech and SEO see the name.
  The viewBox was tightened to the artwork bounds; the source file is kept at
  `assets/logo.svg`. `v1.html` (the frozen backup) is untouched.
- In the in-page views the mark first sat at the right of the sticky bar;
  moved on review to a `.view-head` row beside the eyebrow and title. Print
  hides that row on the calendar, whose masthead already carries the mark.
- The hero `h1` switched to a second mark, the title without "Param"
  (`assets/title.svg`), since the kicker above it already says "Param
  Foundation presents". Everywhere else keeps the full logo.
- **Programme photos from the client** (Drive folder "Main Page"): four
  cards re-imaged by the file names' own instructions — Shadow Puppetry
  (performances), Mask-Making Workshop, Dance & Movement Workshops, and
  Lecture-Demonstration Sessions, which had carried a flat placeholder since
  4 Sep. Saved as site assets (`shadow-puppetry.jpg`, `mask-making.jpg`,
  `dance-movement.jpg`, `lecture-dibia.jpg`), kept at
  native size where the source was under 1600px so nothing is upscaled. The
  old files stay: the masks wall is still the feature band, and the Indian
  shadow photo is still the calendar fallback. Lesson: when reading a Drive
  folder page, names are HTML-escaped (`&amp;`); the fourth file was missed
  on the first pass for exactly that reason.
- **Client copy corrections** arrived as an RTF with the old text struck
  through and the new text beside it (`site-change-01`). Applied verbatim,
  nothing invented: new hero lead ("Bringing Balinese traditions and
  conversation to Bengaluru…"), a tagline line "Sharing Stories | Connecting
  Cultures" (new `.hero-tagline`, small uppercase copper), hero numbers 18
  days / 18 events / 15 venues, and "Founded on Culture, Science, History and
  Technology together". The print masthead's own lead was not struck, so it
  stayed.
- The logo rule was then written into every instruction surface (CLAUDE.md,
  AGENTS.md, HANDOVER §5 and §8, Cursor rules, journal §2) so any tool reads
  the same instruction.
- **Portability pass.** `tools/sync-images.sh` depended on macOS `sips`; it
  now picks whichever optimiser the machine has (sips, ImageMagick, Python
  Pillow) and otherwise keeps the download full size. `doctor.sh` reports
  which one it found. HANDOVER §5 rewritten to match the real tokens and
  components (it still described the coral/yellow, Space Grotesk era).

### 10 Sep 2026 — Android reports: weak networks, www, old browsers
- Two screenshots from Android phones. One showed the calendar view with
  "The calendar will appear here soon" on weak LTE: that text only appeared
  when *both* the sheet and the local file failed, and they were fetched one
  after the other with 6 s each, so a stalled connection left nothing. Fixed
  in code: the two sources are now requested together (sheet wins if usable),
  the last successfully loaded schedule is kept in `localStorage`
  (`bib.events.v1`) and shown when the network fails, and the failure state
  is an honest "check your connection" with a working **Try again** link.
  Verified offline with and without the cache.
- The other showed `DNS_PROBE_FINISHED_NXDOMAIN` for
  `www.bali-in-blr.paramfoundation.org`. There is no www record; Chrome tries
  a www variant only after the bare host fails to resolve, so this was most
  likely a flaky lookup on mobile data surfacing as a www error. The fix is
  in DNS (Cloudflare holds the zone: CNAME `www.bali-in-blr` + redirect rule,
  and proxying the bare host would also cure the old-Android certificate
  issue), which the client chose **not** to do for now. Nothing in the repo
  ever uses www.
- Browser-support audit: `main.js` needs ES2018 (object spread; Chrome 60+),
  `admin/auth.js` ES2017. Old Chrome/WebView would reject the whole file and
  leave dead buttons. Added an ES5 inline check before `main.js` that shows a
  plain "browser too old, update Chrome or call us" bar instead. The HTTPS
  chain (Let's Encrypt via ISRG Root X1) is not trusted by Android ≤ 7.0; only
  a proxy in front of GitHub Pages can change that.

- **"Generated link not syncing."** Checked the bridge: a POST from the live
  origin saves and answers `ok:true`, and the Mint tab already held the
  staff's links, including one minted that morning. So rows land; what fails
  is *reading the reply* in some browsers (Google answers a cross-origin
  POST with a redirect, and not every browser lets the page read the
  result), which left links marked "pending". Same shape as the signup
  false-duplicate of 4 Sep. Fix in the admin page: an unreadable reply is
  followed by a GET of the Mint tab, and the link is marked synced if its
  URL is there; **Sync unsaved** now pulls the sheet first, then posts only
  what is genuinely missing. Note: `curl -L` turns Google's 302 into a 405,
  so never diagnose the bridge with curl alone — POST from a browser.
  Diagnostic rows (codes starting `zz-`, one with a blank code, URLs with
  `zzdiag`) were left in the Mint tab and should be deleted by hand.

### 11 Sep 2026 — "First seen" changing format part-way down
- The registration sheet's date columns showed two display styles. The
  bridge always wrote a real `Date`, but never a number format, so each cell
  took whatever formatting its row already carried: rows inside a range once
  formatted by hand looked one way, rows below it fell back to Sheets'
  automatic style. Fixed in `Code.gs`: a single `STAMP_FORMAT`
  (`dd mmm yyyy, h:mm am/pm`) applied to the whole date column on every write
  (Master First/Last seen, each flavour's Timestamp, Receipts, Mint), plus a
  one-off `fixDateFormats()` to repair every tab at once. **Deployed the same
  day as version 8** of the existing web-app deployment (same URL), after
  `fixDateFormats()` was run once; every date column now reads e.g.
  "06 Sep 2026, 6:52 pm".
- Found while deploying: the live bridge was **behind the repo**. It still
  lacked the 7 Sep RSVP flavour (`rsvp`, `allowMultiple`), which was never
  deployed. Only the date fix was patched into the live code, so behaviour
  is otherwise unchanged; the RSVP flavour goes live whenever the repo's
  `Code.gs` is next deployed in full. The live copy also has `SHEET_ID` set,
  which the public repo deliberately leaves blank — keep it when pasting.

### 12 Sep 2026 — events that are listed but not bookable
- "A Day in Manipal" (16 Oct) is a campus performance at Manipal University,
  Udupi. The planning sheet's Event Brief marks it **Open to public: No**, yet
  the calendar showed it with a Register button. Added a sheet-driven state:
  a `status` of `internal` / `private` / `invite` / `invite only` / `closed` /
  `not public` / `not open` / `no button` lists the event normally but shows
  no status chip and no action, only a quiet "Not open to the public". Set
  that cell to `not public` for the 16 Oct row.
- Still missing for that row: start time, end time and description. The
  planning sheet has none ("16th - Full day", time "-"), so nothing was
  invented; the calendar accepts a plain phrase such as "Full day" in the
  time column if that is what is wanted.

### 13 Sep 2026 — brand kit, and the title mark taken out of the repo
- Compiled a **brand kit** (published artifact): colour with measured contrast,
  the poster palette, the block motif and its orientations, seams and edges,
  both wordmarks, and type. Built from the tokens and the poster set rather
  than sampled by eye.
- The motif is **three squares on a four-square footprint**, one raised centre
  with two below and the fourth corner empty, rotated to four orientations. I
  first drew it as four blocks, which was wrong; the client's reference
  corrected it.
- **`assets/title.svg` deleted.** The wordmark without "Param" must not be
  downloadable. The hero still shows it because `index.html` inlines the
  paths, and the source now lives in the vault under `memory.brand_assets`.
  Anyone reading page source can still extract the inlined copy; no static
  site can prevent that, and the kit simply never offers the file. Verified:
  the file 404s live, `logo.svg` still serves, and the hero renders unchanged.
- **Kit iterations, all client-led.** It began as a colour reference and was
  wrong three times before it was right: too text-heavy and exhaustive
  (rebuilt visual-first, broad not intricate); layout diagrams that used
  gradients and invented compositions (redrawn flat, on the module); and a
  motif I had invented rather than read. Corrected each time from the
  client's own reference images.
- **Wordmarks in the kit.** The full lockup offers Copy SVG and a link to the
  hosted file. The title mark is shown for reference only, badged "Never use
  this as the logo", because without Param it is a headline treatment rather
  than the logo.
- **Seams and edges** added to the kit, drawn with the site's real values:
  harlequin, scallop both ways, the hairline, the copper hover edge and the
  copper rule.

### 13 Sep 2026 (later) — print-ready event posters
- `tools/build-event-posters.py` renders the whole listing in two shapes:
  1:2 at 500&#215;1000&#160;mm (one column, 15 rows) and 2:1 at
  1000&#215;500&#160;mm (four columns). Reads the live schedule sheet, falls
  back to `data/events.json`, inlines the lockup and every thumbnail so the
  PDF is self-contained, and prints through headless Chrome.
- One scale factor drives each sheet, with a second, smaller factor for the
  masthead and type on the wide one, so both shapes share a system rather
  than being two separate designs.
- 3&#160;mm bleed on every edge, artwork running into it, no crop marks.
  Chrome writes RGB; a press wanting CMYK converts on their side.
- Output lives in `assets/print/` and is a snapshot: re-run it whenever the
  schedule changes.
- **Reworked on review.** The brick ground with a strong halftone was too
  heavy for a listing, so both sheets moved to the print palette: cream
  ground, charcoal type, brick for dates and oxidised copper for rules, with
  the screen dropped to a faint 10% dot. The tall sheet went from one column
  of small rows to **two columns** with much larger thumbnails and type, rows
  distributed to fill the sheet.

### 13 Sep 2026 (later still) — the brand kit gets a public link
- The kit was a private artifact, so only its owner could open it. It now
  also lives on the site at **/brand/**, link-only: `noindex` on the page and
  `Disallow: /brand/` in robots.txt, and nothing on the site links to it. The
  team and collaborators need no account.
- Nothing new is exposed by this: the title mark was already inlined on the
  home page, and the kit still offers only the full lockup for download.
- The artifact stays as the working copy. When the kit changes, republish the
  artifact and copy the same HTML into `brand/index.html` so the two agree.
- Verified live: 10 sections, 19 copyable colours, both wordmarks, fonts
  loading, no console errors, and `Disallow: /brand/` serving in robots.txt.

### 13 Sep 2026 (fix) — the admin logo was painting black
- The `/admin` hub and Campaign Link Builder showed the lockup in solid
  black on the dark ground. Cause: those pages carry their own inline CSS and
  never load `styles.css`, so `.logo-gold` / `.logo-orange` / `.logo-brown`
  were undefined and the SVG fell back to the default black fill. The
  sign-in card was fine because `auth.js` defines its own copies.
- Fixed by giving both admin pages the three fills, scoped to `.kick`.

### 13 Sep 2026 (fix) — the link builder asked for too much
- Eight fields, most of them UTM jargon, to mint one link. Now it asks two
  questions: **where should it open** and **where are you sharing it**. That
  second choice sets `utm_source` and `utm_medium` from a plain-English list
  (Instagram post, WhatsApp, Poster or standee, Paid ads…), the campaign
  defaults to the month, and the ref tag and code derive from those. QR still
  appears on its own when the choice is a poster.
- Everything that was there is still there, in an **Advanced** block that is
  closed by default and only needed for something unusual.
- A line under the generated link says in words what the link records, so the
  admin can see the tagging without understanding UTM.
- Cleared three diagnostic rows I had left in the sheet's Mint tab.

### 13 Sep 2026 (fix) — track the four things that matter, ask for two
- The question was: who arrived, when, which screen, and what did they do.
  Views and confirmed registrations were already reported; the middle was
  missing. One delegated click listener now reports `cta_click` (with the
  destination and, from a calendar row, the programme), `call_click`,
  `email_click` and `outbound_click`, each carrying the screen it happened on
  and the campaign ref. Nothing is tagged by hand and no personal data moves.
- The link builder is down to the two things only a person can know: the
  call to action, and where the link will be used. Source, medium, campaign,
  ref and code all derive from those; the programme picker moved into
  Advanced and appears only for the Register destination.

### 13 Sep 2026 (fix) — the minted list now mirrors the sheet
- The list merged sheet rows over a local cache but never dropped anything, so
  a link deleted in the Mint tab lived on in the browser forever. On every
  pull the list is now rebuilt from the sheet, keeping only links that never
  reached it; those show as pending and can be discarded. A toast says how
  many stale rows were cleared.
- A saved link is still deleted in the Mint tab, not from the admin page. The
  page never removes anything the sheet holds.

### 13 Sep 2026 (end of day) — full check of the live site
- Everything green. Pages: home, privacy, `/brand/`, both admin pages,
  robots, sitemap and the v1 backup all serve; `assets/title.svg` 404s as
  intended. Home renders 7 programme cards and 27 images with none broken.
  Calendar shows all 15 sheet events with photos, 14 with a Register button
  and Manipal correctly reading "Not open to the public". Both forms open
  with their question cards, the live 19-item programme checklist and the
  consent tick. Brand kit intact. Mobile at 375px has no overflow. No console
  errors anywhere.
- **Registrations are at 85** (29 updates, 57 volunteers), up from 32 on
  11 Sep. The volunteer poster is clearly working.
- Calendar photos load lazily, so an image only downloads when scrolled to.
  A first pass flagged four as "missing" before they were reached — correct
  behaviour, and worth remembering before chasing it again.

### 15 Sep 2026 — hero stats: bigger, spread, and self-syncing
- Reworked the hero stat row. Numbers are now large (clamp 2.6–3.8rem) and
  spread across the full content width (`justify-content: space-between`,
  the old 780px cap dropped). Each label sits on one line under its number —
  an earlier attempt held the label to the number's width, which stacked
  "Venues across the city" into an ugly three-line block under 15; letting the
  label keep its own width fixed it. On phones all three stay on one row.
- **Days, Events and Venues now auto-sync with the calendar** (`updateHeroStats`
  in `main.js`, run when the calendar loads). Events = number of listed events;
  Days = the span from the first event date to the last, inclusive; Venues =
  distinct venues (matched case/space-insensitively). The numbers in
  `index.html` are only a fallback shown if the calendar can't load. Currently
  reads 16 days / 15 events / 14 venues from 15 sheet rows. (Venues was manual
  for a few hours the same day, then wired up on request.)

### 15 Sep 2026 — collaborators: live from the Collab/venues tab, with dummy logos
- Collaborators are read **live from the "Collab / venues" tab** of the same
  published workbook as the schedule (`CONFIG.COLLAB_URL`, gid 7166598) — same
  method as the calendar. `parseCollaborators()` pulls the **"Logos" block**
  (name / status / Files) out of that multi-block tab; `loadCollaborators()`
  caches it and builds a name→row map.
- One registry feeds both the **Partners grid** (all collaborator logos) and the
  **per-event** logos on the calendar (a `collaborators` column in the schedule
  sheet, comma-separated names matched to the block).
- **Dummy logos:** the Files column is empty for now, so `collabMark()` renders
  a monogram tile (dashed border) as a stand-in. The moment a **Drive link** is
  put in the Files column, `sync-images.sh` (which now also scans the Collab
  tab) pulls it into `assets/drive/` and `toImageUrl()` swaps the real logo in —
  no code change.
- First try used the Partners tab via the bridge; switched to reading the
  Collab/venues tab directly because that is where the team already tracks the
  logos. Lesson: read a private planning sheet through its **published /pub URL
  and gid**, not the raw spreadsheet id (that 401s).
- **Logos + cream + auto-by-venue (later same day):** logo files came from a
  Drive folder; downloaded 11 as PNG (transparency kept) to `assets/collab/`,
  mapped name→file in `data/collab-logos.json` (merged into the live list when
  the sheet's Files column is empty). Chowdiah's file is named "Music Academy".
  Per-event logos **auto-match the event's venue** to a collaborator name
  (substring), so no per-event data entry — `collabForVenue()`. Logos sit on a
  **cream** tile (the grid tiles and the card chips), per request.
- **Bug:** `loadCollaborators` cached the array; a second concurrent caller saw
  the truthy empty `[]` before the fetch resolved and rendered with no logos.
  Fixed by caching the **promise** instead.
- **Open (blocking):** the "Event List" tab publish is OFF (401) — the live
  calendar can't read the schedule and falls back to `data/events.json`; the
  per-event logos are verified only against that fallback until it is
  re-published (File → Share → Publish to web → Entire document).

---

### 17 Sep 2026 — make the sheet read publish-proof (bridge feeds)
- The planning workbook is published per-sheet, so the "Event List" tab kept
  ending up un-published (401) whenever publish was re-toggled — breaking the
  live calendar (it fell back to `data/events.json`). Re-publishing was a
  recurring band-aid.
- **Fix:** the Apps Script bridge now serves the schedule and collab tabs from
  the planning workbook **by id** (`openById(PLANNING_ID)`), returned as TSV
  (`?feed=schedule`, `?feed=collab`). The script executes as the owner, so this
  works whether or not the tabs are published. The site tries the published feed
  first, then the bridge feed, then the local file — so a publish toggle can no
  longer break it. `sync-images.sh` gained the same fallback.
- **Needs a one-time Apps Script redeploy** (the feed handlers are new in
  `Code.gs`). Until then the bridge returns its old default for `?feed=…` and
  the site simply uses the published feed / local fallback as before — no
  regression. Also: the bridge's account must have access to `PLANNING_ID`.

### 17 Sep 2026 — bridge redeployed with feeds; a SHEET_ID outage on the way
- Redeployed the "Bali-in-Blr" Apps Script (standalone project; deployment id
  AKfycby…MAB7qDw) so the `?feed=schedule` / `?feed=collab` handlers go live —
  the site's publish-proof fallback now works end to end. Also re-published the
  Event List tab (Publish to web → that sheet), which had been 401.
- **Outage (self-inflicted, ~10 min):** I pasted the repo `Code.gs` over the live
  script. The repo keeps `const SHEET_ID = ''` (the real id is a vault secret),
  so this wiped it; `book()` then returned null (standalone → getActiveSpreadsheet
  is null) and every registration/read threw `TypeError … getSheetByName`.
  Caught it via a post-deploy `mode=check` returning that error.
- **Recovery:** undid the paste in the editor (restored the working code WITH the
  real SHEET_ID), saved, deployed Version 10 → registrations restored. Then added
  the feed handlers WITHOUT touching SHEET_ID by transforming the Monaco model
  in-place (string-insert, never reading/printing the secret), saved, deployed
  Version 11. Verified: mode=check ok, feed=schedule TSV (16 rows), feed=collab
  TSV with the Logos block.
- **Lesson (also flagged in Code.gs):** never paste the whole repo `Code.gs` over
  the live standalone script — it blanks SHEET_ID and kills registrations. Edit
  only the intended lines; keep the real SHEET_ID (vault → memory).

### 17 Sep 2026 (later) — per-event BookMyShow / District buttons
- Ticketing is no longer "pick one platform". Each Event List row can carry a
  **bookmyshow link** and a **district link** (and the existing rsvp / ticket
  columns). A provider button appears the moment a real URL is pasted; an empty
  cell shows nothing. Placeholder `EXAMPLE-` links are still stripped.
- `BOOKING_OPEN` is no longer a hard gate on those URLs: a single event can go
  on sale without flipping the whole calendar. Events with no live link still
  funnel to Register. The occupancy bar stays behind the flag.
- Also: `admin/auth.js` no longer comments the plaintext passwords next to the
  hashes (they were served at `/admin/auth.js`). Repo `Code.gs` keeps
  `PLANNING_ID` blank, same rule as `SHEET_ID`.

### 17 Sep 2026 (end of day) — internal project report
- Built `/admin/report.html` (login-gated, noindex, unlinked from the public
  hub): live registration counts from the bridge, Event Brief programme table
  next to the public calendar, venues/collaborators, and the indicative costing
  sheet. Print/save as PDF uses the cream print palette.
- It flags sheet mismatches rather than "fixing" them in code. First one: the
  Kumarans **Workshop for students** is Open to public: No on the Event Brief
  but still has a Register button on the calendar (Event List status is not
  `not public`). Same class of bug as Manipal on 12 Sep — set the status cell.
- Register's programme checklist no longer includes `not public` rows. Manipal
  was listed on the calendar (correctly with no button) but still offered as
  something to sign up for.
- Costing and ticket-price columns stay off the public hub; they are only on
  this staff page. Do not add a `?feed=budget` to the unauthenticated bridge.

### 17 Sep 2026 — calendar buttons follow the BMS tab hyperlinks
- The burning issue was not a missing report: staff put BookMyShow / District
  URLs on the **BMS** listings tab as cell hyperlinks labelled "Link". The
  public TSV only contains that label, so the calendar never saw a URL and
  every event stayed on Register. The Event List's own bookmyshow/district
  columns were empty.
- The site now overlays the BMS tab onto the Event List (matched by event
  name). `sheetTsv` writes the hyperlink href instead of the label, and
  `?feed=bms` serves that tab. **Deploy those two changes in the live Apps
  Script without pasting the whole file** (keep SHEET_ID / PLANNING_ID). Until
  that deploy, a pasted-as-text `https://…` URL in either tab already works;
  a Ctrl-K "Link" does not.

### 17 Sep 2026 — Kecak Workshop URL is live; junk "Link" overlay
- Event List `bookmyshow link` for Kecak Workshop now has a pasted BookMyShow
  URL. The BMS tab for the same row is still the word "Link" (a cell hyperlink
  the published TSV cannot carry). Overlay used to copy that label into empty
  fields, and a stale fetch left the calendar on Register. `copyLinkFields`
  now keeps only `toActionUrl` survivors, Event List rows also pick up a
  bookmyshow.com / district.in URL from any cell, and sheet fetches are
  cache-busted so a paste shows on the next reload.

### 17 Sep 2026 — provider logos, brand colours, status + back-to-main
- **Security sweep.** Removed the plaintext admin passwords that were sitting in
  comments beside the hashes in `admin/auth.js` (served publicly — defeated the
  hashing). Blanked `PLANNING_ID` in the repo copy of `Code.gs` to match the
  `SHEET_ID` vault-secret treatment (live script keeps the real id). Rotation of
  the two admin passwords is still an open to-do (old ones are burned).
- **Provider buttons carry brand logos.** BookMyShow → `assets/bms-btn.svg` on
  brand red (#C4242C); District → `assets/dstrct-btn.svg` on District purple
  (#8B15F0). Both buttons share `min-width` + a fixed `height` so they are
  identical in size; the logo alone scales (BMS nudged up). Text kept as each
  anchor's `aria-label`.
- **Status chip.** A bare dash `-` in the Status cell no longer force-hides the
  chip (only real words none/hide/off/nothing/na do) — so a ticket link now
  auto-shows the chip. And low seat counts no longer auto-downgrade to "Filling
  fast": a live link reads "Tickets live"; only 0 seats forces "Sold out";
  "Filling fast" is opt-in via the Status column.
- **Back to main page.** The view bar's back button always closes the view to
  reveal the site's main page (was `history.back()`, which left the site when a
  view was opened from a shared link or new tab).

### 17 Sep 2026 (copy) — "Eighteen days" reconciled to the sheet's sixteen
- The hero's three numbers auto-sync from the schedule sheet and read
  **16 days / 15 events / 14 venues** (days = first event 3 Oct to last 18 Oct,
  inclusive). Five places in the copy still said "Eighteen days" / "18-day",
  written when the festival was billed 1–18 October. A visitor saw "16 Days"
  beside prose claiming eighteen.
- **Decision (client): the sheet is final — the festival is 16 days.** Changed
  the wording, not the maths: meta description ("A 16-day cultural festival"),
  the programme `h2`, the calendar view's print masthead lead, the calendar
  intro, and the volunteer paragraph. The print-only calendar masthead's
  dateline went 1 Oct → **3 Oct – 18 Oct 2026** to match. The brand kit's
  poster specimen chip went 18 → 16 days (label only; the colours it
  demonstrates are unchanged).
- Text only: no CSS or JS was touched, so no `?v=` bump was needed. The stats
  keep deriving from the sheet, so the numbers cannot drift again.
- **The mismatch was really in this file.** §0 recorded "18 days, 18 events,
  15 venues" as the hero numbers, left over from the 9 Sep client copy and
  never updated when the stats were made self-syncing on 15 Sep. A session
  read that line, reported a bug that did not exist, and proposed changing a
  number the sheet already had right. §0 now says the numbers are derived and
  to read the page. Same correction applied to the stale ticketing paragraph.

### 18 Sep 2026 — ticket log and stakeholder progress dashboard
- **Ticket log.** A separate "Tickets - Bali in Blr" workbook (id in the
  vault). `Master` tab: headers on row 10, entries from row 11 to 2100 —
  Date (`DD-MMM | HH:MM`), Number of tickets (whole numbers ≥ 1, others
  rejected), Event (dropdown, off-list rejected).
- **The dropdown follows the website.** A helper `Events` tab holds one
  `IMPORTDATA` formula over the same published Event List the site reads,
  keeping rows that carry a BookMyShow or District URL. Headers there carry
  stray spaces (`'bookmyshow link       '`), so the formula trims and
  lower-cases before matching — exactly as `main.js` does. Refreshes about
  hourly (Google's import cadence). Single-letter `LET` names like `r` are
  reserved (R1C1) and silently break the formula; use full words.
- **Auto date.** A bound Apps Script, "Tickets - auto date stamp", with a
  simple `onEdit` trigger (no authorisation): when B and C are both filled,
  A gets the current date-time once and keeps it; clearing B or C clears A.
  A formula cannot do this — `NOW()` recalculates and every stamp drifts.
- **Dashboard** at `/progress/` for partners and stakeholders: countdown,
  tickets sold, events on sale, registered and volunteer totals, tickets by
  event, sales by day, latest entries, and the full timeline. Standalone like
  `/brand/` (own styles and logo fills; logo is the heading), noindex,
  robots-disallowed, unlinked. Reads three live sources — the Tickets
  `Master` tab (published to web as TSV, **that tab only**; `Events` returns
  401), the Event List, and the bridge's aggregate stats. Each source has a
  bounded timeout and a last-good browser copy, and the page says when it is
  showing one. An unreadable ticket source shows "—", never a false 0.
- **No project-updates panel yet:** nothing records updates or milestones.
  Add an "Updates" tab (Date, Update) to the Tickets workbook to wire one in;
  the page shows only what has a real source.

### 18 Sep 2026 — the site stops spending bridge capacity on page views
- **Symptom:** the bridge went slow and flaky — 4 of 6 GETs came back as
  Google's own 404 page after 13–40 s; successes took 5–9 s instead of ~1 s.
  No Google Workspace incident was open.
- **Cause (ours):** every public page view made **four** bridge calls
  (`feed=schedule` and `feed=bms`, twice each), in parallel with published
  feeds that had already answered. `loadEvents` fired the bridge feed
  alongside the published one (so links could be merged), and it ran twice
  per view — once for the calendar, once for the Register form. `feed=bms`
  is not even deployed, so each of those calls bought nothing. Apps Script
  allows the owner roughly 30 concurrent executions, and registrations share
  them: page traffic was competing with signups.
- **Fix:** one shared load per page view, and the bridge only as a fallback
  when the published feed fails. Bridge calls per view: 4 → 0; published
  requests 5 → 3; calendar unchanged (15 events, 7 BookMyShow, 6 District).
  Verified the fallback by breaking the published URL: one bridge call, all
  15 events. The bridge itself was not touched.
- **Trade-off:** a Ctrl-K hyperlink on the BMS tab is only readable through
  the bridge (and only once the rich-text `sheetTsv` is deployed). With the
  bridge now a fallback, paste plain `https://` URLs into the Event List —
  which is what staff already do for all 7 live links.

### 18 Sep 2026 — a collaborator logo goes live from the sheet alone
- **Problem.** The Logos block was already wired (name / status / Files), but
  `toImageUrl` mapped a Drive link to `assets/drive/<id>.jpg` — a file that
  only exists after someone runs `tools/sync-images.sh` and pushes. So pasting
  a link in the sheet showed nothing, and every new collaborator meant a code
  round-trip. In practice the Files column was left empty and
  `data/collab-logos.json` was hand-maintained instead, which is why logos and
  names drifted apart.
- **Fix.** The `<img>` now carries `data-fallback` pointing at Drive's own
  thumbnail endpoint (`drive.google.com/thumbnail?id=…`), which *does* serve a
  plain image to an `<img>` for a file shared "Anyone with the link".
  `imgFallback()` swaps to it once, on error. Order of precedence is unchanged:
  optimised local copy first, live Drive only as a stand-in, monogram never.
- **Result.** Add a row with a Drive link and the logo is on the site at the
  next page load — no script, no commit, no deploy. `sync-images.sh` is now an
  optimisation pass, not a prerequisite.
- **`data/collab-logos.json` is now only a safety net.** The sheet's Files
  column wins (`if (!p.logo && …)`). Prefer filling the sheet; don't add new
  names to the JSON.
- **Known data gaps:** "Mandala Bengaluru" has a logo in the Drive folder but
  no row in the Logos block, so it cannot appear. "Ministry of culture" has a
  row (Pending) but no file.

### 18 Sep 2026 — a logo that would not look bigger, and two changes that should not have been made
- **The Yaksha Kala Academy logo read tiny and no amount of CSS fixed it.** It
  was resized four times (60 → 78 → 94 → 140px) before the cause turned out to
  be the file, not the design system: the artwork is a narrow 1:2.4 mark, and
  an intermediate pass flattened its transparency onto white, so the cream
  tile showed a white block. Every container change was reverted; the tile is
  back to the shared 60px with a single 72px override for that one mark.
- **Lesson: check the asset before touching the token/component system.** A
  logo that "looks small" is usually the file — padding baked into the
  artwork, a flattened alpha channel, the wrong export. Resizing the
  container to compensate bends the design system around one bad file.
- **Two changes were made that nobody asked for. Both were reverted:**
  - `admin/tickets.html` had its whole read path rewritten to pull two
    published TSVs instead of the Tickets web app. That bypassed the Tickets
    sheet's own `Events` tab, which this journal records as the deliberate
    dropdown source. The actual fault was an unfilled `__TICKETS_API__`
    placeholder — nothing to do with the read design.
  - `data/collab-logos.json` had its working `yuvakasangha` mapping silently
    repointed at a smaller new file, and gained alias keys matching no name
    in the sheet.
- **Lesson:** diagnosing a cause does not authorise redesigning around it, and
  a recorded decision is not undone without raising it first.

### 18 Sep 2026 — ticket-sales admin module finished, and a username guessed wrong
- **Shipped.** `/admin/tickets.html` now points at the Tickets sheet's own
  deployed Apps Script web app (a separate script/execution pool from the
  registration bridge, by design — ticket entry can never compete with
  signups for Apps Script's shared slots). End-to-end tested live: signed in,
  recorded a real sale, watched it land in "Latest entries" and the sheet.
- **The username is `kishan`.** `admin/auth.js` carried a hash that matched
  no spelling of it, and the name was then "corrected" to a made-up variant
  on nothing more than it looking plausible. The client confirmed the real
  spelling. `USERS`/`ACCESS` now read `kishan` with the hash for that
  account, `auth.js?v=6` was bumped on all four admin pages so the correction
  is not served stale, and the same spelling was applied in
  `docs/CONTINUE-IN-CURSOR.md`.
- **Lesson: never guess a person's name.** Ask, or read it from a system
  that already holds it. The live Apps Script's own server-side `USERS` map
  (it independently re-checks credentials in `doPost()` — "the admin page's
  sign-in is not the only lock") already had `kishan` right; only the
  client-side gate was wrong. Verified this by probing the deployed script
  directly (`user`/`pass` correct, deliberately bad event name) before
  touching anything live, rather than guessing both layers needed the same
  fix.

### 19 Sep 2026 — the Files column filled, and logos that keep their alpha
- **The Files column was empty for all 14 logos**, so `data/collab-logos.json`
  had been hand-maintained instead and the two drifted apart. Filled F15:F27
  from the shared `web-logos` Drive folder (link in the vault under
  `memory.client_assets.collaborator_logos_folder`) and added a row for
  **Mandala Bengaluru**, which had a logo in the folder but no row, so it
  could never appear. `Ministry of culture` is still Pending with no file.
- **Name → file matches that are not obvious:** `MUSIC ACADEMY.png` is
  **Chowdiah** (Academy of Music, Chowdiah Memorial Hall); `SRRK.png` is
  Rajarajeshwari Kalaniketan; `Indian Music Experience.png` is IME;
  `Drishti Art Foundation.png` is the sheet's "Drishti Art Centre".
- **The sync then flattened every logo onto white.** `sync-images.sh` was
  written for photographs: it fetched Drive's *thumbnail* (always JPEG) and
  re-encoded to JPEG. On the cream partner tile that is a glaring white box —
  the same fault that had been chased manually on one logo the day before.
  Fixed by downloading the **original** (`uc?export=download`) first and
  writing `.png` when the image has real alpha, at `LOGOMAX=600` (they render
  at 30-60px; 1-2MB → 48-428K). The thumbnail endpoint remains the fallback.
- **Lesson:** a tool named for one asset type will silently mangle another.
  The white box was not a CSS problem and no amount of resizing would have
  fixed it.
- **Verified:** 14/14 logos load from local PNGs, 0 Drive hits, 0 broken.
  A second sync run is byte-identical, so this is not recurring churn.

### 19 Sep 2026 — alignment sweep
- Reconciled every *current-state* claim against the live sheet. Chronology
  entries below were left alone: they are dated history, not status.
- `index.html` hero fallback said **15 events**; the sheet has 16. That is the
  number a visitor sees if the sheet fetch fails, so it was wrong twice over.
- `HANDOVER.md` still opened with **1–18 October**; programmed events run
  **3–18 October** (sixteen days).
- §0 here said **7 of 15** events carry BookMyShow; it is now **8 of 16**.
  Hero numbers 16/15/14 → **16/16/14**. Registrations 184 → **196**.
- §0 and HANDOVER did not mention `/admin/tickets.html` or that the image sync
  now covers logos. Both added.

### 19 Sep 2026 — ticket entry tested end to end; date format fixed
- **The web app was already deployed** ("Ticket web app v1", 18 Sep 19:49) and
  already wired into `admin/tickets.html`. The earlier "loading is so slow"
  symptom was a stale working copy still holding `__TICKETS_API__`, which burnt
  the full 12s timeout on every load. Nothing needed deploying.
- **End-to-end test:** wrong password → refused, nothing written, total
  unchanged. Correct password → row written, `?verify=<id>` found it, total
  moved, date stamped `dd-MMM | HH:mm`. Test rows were deleted afterwards so
  the stakeholder dashboard stays honest.
- **A POST returns HTTP 405 and an HTML body even when the row is written.**
  That is why the page confirms by id instead of trusting the reply — do not
  "fix" that apparent error. `?data=1` also returns a non-JSON interstitial
  now and then; retry rather than treating it as failure.
- **Removed three probe rows** (`probe2-…`, `ff84cac7-…`, `1e06da16-…`) left by
  18 Sep testing. They were counted as real sales: `/progress/` was showing
  **8 tickets when only 5 were genuine**. Test writes must be cleaned up.
- **Date format bug fixed.** Rows stamped by the `onEdit` trigger hold a real
  `Date`; rows written by `doPost` hold a preformatted string. `getData()`
  returned `r[0]` raw, so JSON serialised the Dates as
  `2026-09-18T05:03:00.000Z` and the admin table printed that verbatim. Added
  `fmtWhen()` and deployed as **Version 2**. The **deployment id did not
  change**, so the `/exec` URL and the site were untouched.
- **The script is now in the repo** at `docs/apps-script/Tickets.gs`. It had
  existed only inside Google, with no backup and no version control. Keep the
  two in step. The deployment is recorded in the vault under
  `sheets.tickets.web_app`; **update the existing deployment, never create a
  new one** — a new deployment mints a new `/exec` URL and breaks the page.
- **Editing a live Apps Script from a browser:** keyboard events do not reach
  either Google Sheets or the Apps Script editor here — no Enter, Escape or
  cmd+A. Mouse and character typing do work, and the editor's Monaco model can
  be read and set directly. Remember a saved script is NOT a deployed script:
  deploy a new version or the web app keeps serving the old code.

### 19 Sep 2026 — the Logos Status column now gates publication
- **The site ignored Status entirely.** `loadPartners` published any row with a
  logo, so the moment a file link was pasted the collaborator went live — even
  one still marked **Pending**. With `Ministry of culture` pending, pasting its
  logo early would have published a government body as a confirmed festival
  collaborator. Nobody had hit this because every other row says "Recieved".
- **Fix:** `collabReceived(p)` gates the grid — a row is published only with a
  logo AND a received status. "Pending", "NA", blank or a stray note all keep
  it off the site. Pasting a logo link early is now harmless; marking the row
  received is the deliberate act that publishes it.
- The sheet spells it **"Recieved"**. The check accepts both spellings, trims
  and lowercases, so fixing the typo later will not silently empty the grid.
- **Scope:** the grid only. The Event List has no `collaborators` column and
  neither pending name is a venue, so calendar cards cannot surface one today.
  If a `collaborators` column is ever added, gate `calCollaborators` too.
- **Careful with the published TSV when verifying:** a plain read returned a
  stale row (Mandala's status showed blank when it was already "Recieved").
  The site's own `loadCollaborators()` is authoritative; a cache-busted fetch
  with no-cache headers agrees with it.

### 19 Sep 2026 — an event title corrected, and a feed that lied twice
- Fixed `Balinese Dance Demonstartion` → `Demonstration` in the Event List
  (`A26`). Checked the blast radius first, because an event title is a
  **matching key**: the Tickets `Events` tab imports it, `doPost` validates
  against it, and `/progress/` matches sales to events by title. Nothing
  referenced the misspelling — no ticket row, not in the ticketed dropdown,
  not in the repo — so the rename was display-only and needed no deploy.
  **Renaming an event that already has ticket rows would orphan those rows.**
- **The published TSV serves stale copies while an edit propagates**, and one
  read is not proof. It reported Mandala's status as blank when the cell
  already read "Recieved", and it served the old event title to the live page
  minutes after a cache-busted fetch had returned the corrected one. Sampling
  the feed eight times then showed it correct 8/8.
- **Verifying a sheet edit:** reload after a minute, or sample more than once.
  A single stale read is not a failed edit.
- Also recorded in the vault: the collaborator logo Drive folder
  (`memory.client_assets.collaborator_logos_folder`) and the tickets web app
  (`sheets.tickets.web_app`). The journal is the public half, so asset links
  and deployment ids live there and are pointed at from here.

### 19 Sep 2026 — new Drive images sync themselves
- **Sheet text reached the site by itself; images did not.** A Drive link
  pasted into an event's image column or the Logos block resolved only to
  `assets/drive/<id>.<ext>`, so nothing appeared until a person ran
  `tools/sync-images.sh` and pushed.
- **First attempt was a client-side fallback** — the `<img>` now tries `.jpg`,
  `.png`, then the live Drive copy. It works, but **Google rate-limits the
  thumbnail endpoint**: it served this browser fine in the morning and refused
  every request by evening, while `curl` fetched the same URL successfully.
  Treat that fallback as best-effort, never as the mechanism.
- **The real fix is `.github/workflows/sync-drive-images.yml`** — hourly and
  on demand, it fetches any Drive id with no local copy and commits only if
  something arrived. Pages redeploys on that push. First workflow in the repo;
  it does not touch the existing Pages deployment.
- **`--new-only` exists to prevent churn.** Image tools differ per machine and
  produce different bytes from the same source, so re-optimising everything on
  a schedule would rewrite every file each run and fight local runs. The job
  passes the flag; refreshing a *changed* image stays a deliberate manual run
  without it.
- **The runner has no ImageMagick** — it falls through to Pillow, which the
  workflow installs. Without a tool the script would silently write logos as
  opaque JPEG and put a white box on the cream tile, so the job fails loudly
  if none is present.
- **Verified end to end, not assumed:** deleted a synced image, pushed, and
  dispatched the job. It fetched exactly that one file, committed as
  `github-actions[bot]` and pushed. So an explicit `permissions: contents:
  write` does override a repo whose default workflow permission is *read*.
- **`sips` was silently upscaling, and it is now fixed.** `sips -Z N` resamples
  to N in both directions, enlarging anything smaller; ImageMagick's `NxN>` and
  Pillow's `thumbnail()` only ever shrink. `sips_fit()` now measures first and
  passes `-Z` only when the image really is over the cap. This broke §2's
  "never upscale a client photo" rule on every run since the script was
  written. It was not only logos: an event photo whose source is 1500×984 had
  been stored as 1600×1049. **The images already committed were made by the old
  path, so some are inflated** — a one-off re-sync without `--new-only` would
  correct them, at the cost of rewriting those files once.

### 19 Sep 2026 — whole-project audit
A pass over security, dead code, assets, markup, compliance, links and
infrastructure. Recorded so the next session need not repeat it, and so the
two findings deliberately left alone are not re-raised as if they were new.

**Checked and clean** (point-in-time, 19 Sep):
- No secrets committed. `secure/vault.json.enc` is genuinely encrypted
  (`Salted__` header); the plaintext is gitignored. No API keys or tokens.
- No dead code: 71 top-level functions in `main.js`, **none unreferenced**.
  No `console.log` in shipped code.
- Assets: every referenced file exists, and **no asset is unreferenced**. All
  four `data/*.json` parse; `collab-logos.json` points at 13 files, all present.
- Markup: no duplicate element ids, every `<img>` in `index.html` has `alt`.
- Privacy: no PII-bearing feed reaches a public page — `/progress/` reads
  `?sheet=stats` (aggregates). Repo `Code.gs` still keeps `SHEET_ID` and
  `PLANNING_ID` empty, as §1 (17 Sep) requires.
- Indexing: all seven private pages carry `noindex, nofollow` *and* are
  disallowed in `robots.txt`. Both sitemap URLs resolve.
- Infrastructure: HTTPS enforced, `http → https` 301, CNAME correct, 404s 404.
- The 16 selectors defined in both stylesheets are deliberate layering —
  `site.css` loads after `styles.css`.

**Fixed:**
- `privacy.html` asked for `styles.css?v=hub34` while `index.html` asked for
  `hub39`. One file, two cache keys: downloaded twice, and privacy could
  render from a long-stale copy. Both now on `hub39` — **when a shared
  stylesheet is version-bumped, bump it on every page that loads it.**
- The analytics loader's `GTM_ID` was blank with a comment warning that
  setting it would load a second container, since `index.html` carries
  Google's own snippet. The warning was right but advisory. The loader now
  skips injection when a `gtm.js` container is already present, so
  double-counting is structurally impossible. (The audit first called this an
  undocumented trap; it was documented. The defect was that a comment was
  doing a guard's job.)

**Left alone on purpose — do not re-raise as new:**
- **The admin gate keeps the password in `sessionStorage`** (`auth.js`). Not
  an oversight: `tickets.html` re-sends user and password on every save
  because the Apps Script re-verifies them server-side. `sessionStorage` is
  origin-scoped and dies with the tab, and reading it already requires script
  execution on an admin page — where the login form is readable anyway. These
  are shared staff credentials and `auth.js` states it is a lightweight gate,
  not a secret store. Closing it properly means issuing a short-lived token
  from the Apps Script; judged not worth changing the live ticket-recording
  script weeks before the festival. Revisit if admin access widens.
- **~3.6MB of print PDFs** in `assets/print/` are the two largest tracked
  files and sit in every clone. They are referenced, so not dead weight;
  moving them to Drive or a release is optional tidying, not a defect.
- The published planning sheet was **not** raised: §2 records that as a
  considered decision.

### 19 Sep 2026 — made the project genuinely hand-over-able
Goal: anyone — another machine, another AI tool, another Claude account, or a
human coder — can continue from the drive or a plain clone with nothing carried
in someone's head. Audited what already existed rather than adding scaffolding.
Most of it (`AGENTS.md`, `HANDOVER.md`, this journal, `doctor.sh`, the vault)
was already good. Three things were wrong.

- **`CLAUDE.md` was lying in its own first screen.** It still read "Currently
  not connected: calendar/partners read local JSON and the signup form is in
  demo mode" — false since the bridge went live, and contradicting the status
  block in the same file. It is the first thing a Claude session reads.
  Replaced with how it actually works: the sheet is the source of truth,
  `data/*.json` are fallbacks, two separate web apps, and the
  never-create-a-new-deployment rule.
- **`README.md` carried the same claim**, plus the old github.io URL and
  instructions to add events by editing `data/events.json`. Rewritten as a
  front door that routes to the other docs instead of duplicating them.
- **`doctor.sh` verified the machine but not the system.** It now also checks
  the admin tools and the sync workflow, that both Apps Script sources are
  backed up (they exist only inside Google otherwise), and read-tests both web
  apps and the live site — reading the URLs out of the files that use them, so
  it stays honest after a redeploy.

**Checked and already fine:** every topic held in a Claude account's memory is
also in the repo or the vault, so no knowledge is account-bound. Nothing was
untracked. A fresh clone serves with zero setup and cannot open the vault.

**The single point of no return is the vault key.** Everything else recovers
from GitHub. The key exists in exactly one place on one drive; lose it and the
private half is unrecoverable, by design. `doctor.sh` now says so on every run,
and `docs/ANOTHER-MACHINE.md` states it plainly. **A second offline copy is the
one thing a human still has to do.**

### 19 Sep 2026 — site copy moves to a Google Doc (first built as a sheet tab)

Decision: every static line of text on the page (nav, hero, programme cards,
featuring, presented-by, support, calendar/forms headings, footer) is editable
from one Google Doc, "Bali in Bengaluru - Website text". It was first built as
a "Content" sheet tab; the user asked for a Doc instead, so the tab is now
unused (safe to delete) and the Doc is the source. The Doc is organised in
tabs and sub-tabs by site section (Navigation, Hero, Programme > Performances /
Workshops / Academic traditions, Featuring, Presented by > Foundation facts,
Also at the festival, Collaborators, Support > Support benefits, Calendar, Get
updates, Volunteer > Volunteer summary, Footer). The Doc is written for
non-technical editors and reads like a normal document: each tab is plain text
in page order, one paragraph per line, titles bold, no headings or keys, plus a
"Read me first" tab. (History: `key: text` lines, then labelled headings; the
user found both confusing.) Lines are matched to keys **by position** using
`CONTENT_MAP` in `Code.gs` (its labels are for maintainers only). Safety: if a
tab's non-empty line count differs from the map, that whole tab is skipped and
the HTML wording stays; empty lines and a `NOTE:` line are ignored. `**word**`
= bold. Do not collapse `\s` (non-breaking spaces must survive). A new tab or
line needs a `CONTENT_MAP` entry too.

Wiring: elements in `index.html` carry `data-content="key"`; `loadContent()` in
`main.js` reads the bridge feed `?feed=content` and overwrites them via
`textContent`. The feed (`docContent()` in `docs/apps-script/Code.gs`) walks
every tab and sub-tab of the Doc and returns `key<TAB>text` rows, so `main.js`
did not change. The wording in the HTML stays as the fallback, so a broken
line, an empty Doc or an outage changes nothing. Deliberately **not**
Doc-driven: `<title>`, meta, JSON-LD, the logo, form labels, consent text and
Privacy links (SEO, legal and function). Seed: `data/content.tsv`.

Live-script setup done: `CONTENT_DOC_ID` (blank in the repo, like
`PLANNING_ID`) set in the live script; Docs permission granted; deployment
updated in place (version 16 after the plain-text rewrite, same `/exec` URL). Adding a *new* line to the site
needs a matching `data-content` in `index.html` plus a line in the Doc. Lessons:
Docs tabs are created with the Docs advanced service (`addDocumentTab`); typing
into the Doc title via keystrokes fires shortcuts, so set it via the Rename field.

Baking (added after the Doc move): `.github/workflows/bake-content.yml` runs
hourly (:43) and `tools/bake-content.py` writes the Doc's text into the
`data-content` elements of `index.html`, committing only if it changed. The live
swap in `main.js` stays on top (covers the gap between runs). The script never
wipes: an unreachable, malformed or under-50-row feed changes nothing. So the
wording in `index.html` is now generated for these elements; edit the Doc, not
the HTML (a hand edit to one of those elements is overwritten within the hour).
The check compares wording (not markup) per element and only rewrites elements
whose text differs from the Doc; in sync = no write, no commit, and a commit
message lists the changed keys. Settle-first: a difference is only baked once it is identical at two hourly
checks in a row (hash kept in the Actions cache, no content), so a half-finished
edit is never baked; bake time is therefore 1-2 hours, the live swap covers the
wait. Manual runs can tick "Bake straight away". First bake only reformatted (entities to characters, one line per element);
visible text was verified identical.

### 22 Sep 2026 — artist logistics planner (admin tool + link-only public plan)

Ask: a planning tool that builds each day for the touring company (20
artists) from the latest calendar — wake-up to lights out, broad outside the
working day and detailed from breakfast to dinner — with travel times that
follow traffic, custom buffers before and after each show, a printable
day-by-day plan, a public page reachable only by link, and the ability to add
other places of stay and compare the whole tour's logistics.

Built: `/admin/logistics.html` (gated, tool `logistics`) and `/plan/` (noindex,
robots-blocked, unlinked). One engine, `plan/engine.js`, does the work:
- Schedule is the live Event List feed (same as the site). Multi-day
  workshops expand per day; "3.30pm and 7.30pm" becomes two shows.
- Venues resolve through `data/venues.json` (positions from OpenStreetMap or
  the venue's published address; five venues are only locality-precise and
  can be pinned from the planner).
- Travel: OSRM road routing (no key) for free-flow, shaped by an hour-of-day
  Bengaluru traffic profile; or Google Maps predicted traffic per departure
  via a third Apps Script web app (`docs/apps-script/Logistics.gs`) when
  deployed. Straight-line fallback if the routing service is down.
- The planner re-plans synchronously on every edit; live traffic is an async
  pass that fills a leg cache and re-plans.
- Comparison of stays: every active stay is planned in full; totals table
  plus a leave/back per day table. First draft shows a Jayanagar stay saving
  ~10 h of road time over the tour against 20th Mile, Magadi Road.
- The public link carries the whole plan in the URL hash, so no backend is
  needed for sharing; the bridge adds Save/Load when deployed.

Decisions:
- A **separate** Apps Script for logistics, as with tickets: planning calls
  must never queue behind signups.
- No PII anywhere: venue coordinates and a plan configuration only. Artists
  are a party size, not names.
- OSRM's public server is used as the keyless default because the tool must
  give a useful draft before anyone deploys anything. It is best effort; the
  warnings bar says when it fell back.
- Out-of-town days (Manipal) travel overnight both ways (user's call, same
  day): leave the night before, arrive ~6am, programme, dinner, night coach
  home. When the previous show ends late the coach leaves straight from that
  venue. A day with no time in the sheet assumes a 10am–4pm programme.

Same day, later: a photoshoot at Mandala Cultural Centre (Kanakapura Road)
on 2 Oct is not a public event, so the planner grew an "Internal
engagements" list in the plan config rather than a row in the schedule
sheet — the sheet stays the public calendar's source of truth, and the
planner merges the two.

Same day: optional per-day add-ons — a purpose (breakfast / lunch / dinner
/ sightseeing / shopping / other), a location (Maps link) and optional
HH:MM times. Implemented as synthetic events the main loop routes through,
so departure, holds and the return re-derive with no special cases; timed
stops are pinned, untimed ones auto-place. Meal
stops are registered as routing points up front; a point dropped in after
the matrix exists gets a straight-line estimate until the next rebuild.

Same day: every meal is now an explicit line (breakfast / lunch / dinner)
defaulting to wherever the group is, editable in the planner (time, length,
note, or a location that re-routes the day). The old "packed lunch" flag
became a real lunch line inside the show.

Comparison stay set to Citadel Sarovar Portico (Ananda Rao Circle, Gandhi
Nagar) on the user's request: 22 h 48 of road time over the tour against
29 h 04 from 20th Mile. Maps "share" links carry only a place id, so the
planner now reads a place name or q= from such links and geocodes it, and
says clearly when a link has neither.

### 22 Sep 2026 — logistics backend deployed; traffic goes Google

Deployed `docs/apps-script/Logistics.gs` as a third standalone Apps Script
("Bali-in-Blr Logistics", deployment "Logistics web app v1"), driven from
the browser pane with the user signed in; the user authorised the Maps /
Sheets / Drive scopes. The script finds the planning workbook **by name**
(DriveApp) and caches the id in script properties, so no sheet id had to be
typed or pasted anywhere — the lesson of 17 Sep applied in advance.

Traffic policy (user's ask): far from the date, Google's typical traffic
for that weekday and hour; inside 48 h refreshed hourly; inside 2 h live,
refreshed every 10 min. The cache lifetime shortens with the horizon and the
plan labels each leg's mode. First live figure: 20th Mile → Chowdiah at
3.30pm on a Tuesday, 51 min against the profile's 60.

The `/exec` URL is in `plan/engine.js` (public by necessity, like the
bridge) and recorded in the vault under `apps_script_logistics`. Update the
existing deployment, never create a new one.

Problem on the way: pricing ~35 legs as parallel single requests made
Google's front door answer many of them with a "Sorry, unable to open the
file at present" HTML page (the request still executed server-side — the
figure was in the cache afterwards). Fix: an `action=legs` batch endpoint
that prices up to 40 legs in one execution (Version 2 of the same
deployment), the planner sending 12 at a time, one request after another,
retrying an HTML answer. A whole stay now prices in about 30 s and the page
re-renders as batches land; three passes settle departures that moved.
Lesson: Apps Script web apps want few, fat requests, never a burst of thin
ones. Also: the leg cache key must use the departure the planner actually
priced (before the loading allowance), or refined figures never match.

Google's typical figures make the tour slower than the profile guessed:
about 35 h on the road from 20th Mile against 29 h estimated.

Later: party is 25 artists + 2 volunteers in two 17-seat tempo travellers
(seat check warns if vehicles fall short). Instruments travel in a separate
production vehicle, so loading time no longer sits in artist time. The
single "before" buffer became three customisable segments — instrument &
stage set-up, sound check, costume/make-up/warm-up — and "after" split into
costume off/make-up removal and wrap, so a meal or the drive home never
starts with the cast still in costume. With Google traffic the 4 Oct day
(Drishti workshop → Jagriti double bill) leaves no costume time before the
3.30pm show: the plan says so rather than hiding it; the fix is in the
schedule (shorter wrap at Drishti or a later first show).

User's rule (22 Sep): the plan must not suggest moving anything; it marks
red flags in the schedule instead. Implemented as a red badge / border /
line per day with a strict definition (unreachable start, no or under half
the costume time, overlapping timed stop, under five hours' sleep) and a
red-flag-days count per stay. A false-positive class got fixed on the way:
single-event days were reporting "11 min late" because the departure was
computed from one traffic slot and priced at another; departures now walk
back until the priced leg really arrives in time.

Recalibration (user, 22 Sep): with instruments in their own vehicle the
morning is wake 30 → breakfast 40 (typically 7.30–8.30) → get ready 30 →
kit 10 → go, about 1 h 50 before departure instead of 2 h 50; pre-show
segments trimmed to 30/30/60 for a performance (10/10/15 workshop,
10/10/20 talk), costume off 20/5, wrap 30/15. Rest-day and late-start wake
is 7am.

### 22 Sep 2026 — the Google Sheet planner

The inputs moved into a Google Sheet, "Bali in Bengaluru — Logistics
Planner", built by the logistics web app rather than by hand or
IMPORTRANGE: Settings tab + one tab per day, headers on row 10, data from
row 11, pulled Event List cells grey and protected, inputs as HH:MM with
dropdowns for Yes/No and add-on purposes, two instrument-vehicle columns
per event (at venue by / leaves storage, the second computed). The planner
reads it on load and writes departure and vehicle times back. Deployed as
Versions 3–6 of the same web app. The first build failed at the last step
because installing a time trigger needs a scope the deployment was not
granted; the user then said no timer at all, so it is an on-demand
"Re-pull events into sheet" button instead. The instrument vehicle's
departure needs the storage location in Settings; until it is filled the
plan shows only "instruments at venue by".

Two-way sync (user's ask, same day): the planner now fills the sheet with
the whole default plan and keeps writing after every edit (debounced), and
reads the sheet on load / on "Fetch sheet inputs". Last writer wins.
Version 7 of the same deployment.

Later on 22 Sep: per-show cast and artist count (sheet columns and a
per-show panel with a dropdown and Submit that recalibrates the plan);
"Print this day"; the public-link panel became buttons only (the visible
hash link was intimidating — the sheet-backed page is the link to share,
the hash link is a frozen snapshot); and the admin's top bar was cut from
eight buttons to four ("Sync everything" does re-pull + fetch + traffic +
write-back). The Internal engagements panel went (the sheet's Engagement
add-on rows do it) and so did the per-event inline editors.

Quick loads (user's ask, 22 Sep evening): the browser now keeps both the
sheet read and every Google leg price (localStorage, with the traffic
tiers as expiry), so a refresh shows the priced plan at once and only stale
legs are re-asked in the background. Measured: a reload went from about
80–190 s of backend waiting to a couple of seconds. Also removed the public
page's read of the old "saved plan" tab (18 s for nothing).
Open item: the backend answers even a cached single leg in ~14 s; the sheet
read is 30 s. Worth profiling with a timing field in the responses.

Lesson: the first pass let a leg depart before the previous event had
wrapped (arrival was fixed at start − buffer). Legs now leave no earlier
than the previous wrap and the day is flagged with the minutes lost from
the buffer — the tool's job is to expose the squeeze, not hide it.

### 22 Sep 2026 — days and events synced site-wide
- Truth from the sheet: **3–18 Oct, 16 days, 17 events (two not public),
  15 venues**. The live hero already computed these and the copy already said
  sixteen days. What had drifted was everything *not* read live:
  - `data/events.json` (the fallback) held 12 events from 4 Oct — a different
    festival on a bad connection. Rewritten from the sheet by the new
    `tools/sync-events-fallback.py`: 17 events, 3–18 Oct, carrying both the
    sheet-parser keys and the older keys the PDF tools read.
  - The hero's built-in fallback figures said 16 events and 14 venues; now 17
    and 15, matching what the page computes.
  - `tools/build-event-posters.py` had "1–18 Oct" typed in; it now derives
    the span from the events. Both posters rebuilt; the wide one needed a
    fifth column for 17 events, or its footer was clipped.
  - `assets/bali-in-bengaluru-calendar.pdf` was a 6 Sep snapshot; rebuilt.
- Verified by blocking the sheet in the browser: the fallback renders the
  same 17 events and the same hero as the live page.
- Left alone: `v1.html` still says eighteen days — the frozen backup,
  noindex, by design.

### 22 Sep 2026 — the hero counts only what the public can attend
- Decided with the client: the hero's Events and Venues figures exclude events
  marked not public, and those events' venues. The calendar still lists them.
  Result: **16 days, 15 events, 13 venues** (was 17 and 15, counting the
  Kumarans school workshop and the Manipal campus day, which is outside
  Bengaluru under a label reading "Venues across the city").
- No venue list to maintain: a venue drops out because its only events are
  not public. If a *public* event is ever held outside the city, its venue
  will count — revisit then.

### 22 Sep 2026 — a page for every ticketed event
- **Address:** `event/?e=<slug>`, the slug built from the title (a duplicate
  title gets its date appended). Reached by clicking anywhere on a calendar
  row, or its title, or directly by URL. Only events with tickets live are
  linked from the calendar (`ticketsLive()`: status live / fast / sold out,
  and public); the address works for any event.
- **Live data, one data layer.** The page loads the same `main.js` as the home
  page and reads the event through `loadEvents()` → `normaliseEvent()`, so
  dates, times, venue, description, booking buttons and status come from the
  sheet exactly as the calendar shows them. No copy of the parser. `event/`
  uses `<base href="../">` so every relative path resolves from the root. The
  one line in `main.js` that assumed the home page (the footer year) is now
  guarded.
- **Banners:** one Drive folder per event, mapped in
  `data/event-banners.json`. `tools/sync-event-banners.py` takes a file named
  `banner*` if there is one, otherwise the widest landscape image; PSDs,
  portraits and subfolders are ignored. Saved shrink-only to
  `assets/events/<slug>.jpg`. The folders hold ticket-platform artwork with the
  title set in, so the page shows it whole at its own 2:1 ratio, never cropped.
- **Stand-in:** drawn under every banner — the title and the block motif on a
  raised ground. An image covers it when it loads; with no image it is what
  shows. Dropping a banner in the event's Drive folder is all it takes: the
  hourly workflow now runs the banner sync too, and the page busts the cache
  with the version the tool records.
- The sync keeps a working banner if Drive is unreachable (it had crashed on a
  transient 500 on its second run, and would have cleared a good banner).
- At launch: 9 events with tickets live, 9 banners; IME's folder is empty, and
  Kecak Performance has no folder, so both show the stand-in.
- **Made light the same day.** Each banner was one 1920px JPEG of ~310 KB sent
  to every device. Now each is two WebP widths plus a JPEG fallback, served
  through `<picture>` so the browser picks by screen: a phone downloads the
  800px WebP (~40-50 KB), a high-density desktop the 1600px one (~110-170 KB),
  old browsers a 1600px JPEG (~150-210 KB). Measured: 50 KB on a 375px phone,
  169 KB on a retina desktop, one file per load. WebP is listed per event in
  `data/event-banners.json` only when written, so the page never asks for a
  file that does not exist. Bump `FMT` in the sync tool to re-encode them all.

### 22 Sep 2026 — booking buttons on phones
- The BookMyShow and District buttons stacked full width on phones with their
  logos jammed into the top-left corner. Cause: the phone rule
  `.cal-act .btn { display: block }` out-ranked `.btn-logo`'s
  `display: inline-flex` centring (two classes beat one). Fixed in the shared
  component, so calendar rows and event pages both get it: on a phone the
  buttons sit side by side at equal width, one alone takes the full width, and
  the rule sets size only, never display.
- Verified live at 375px: all 8 calendar rows with two buttons have them on
  one line with logos centred, none misaligned; the event pages match; no
  sideways scroll on the home page, the calendar or an event page.
- Then the desktop event page stacked them: its side panel was narrower than
  two buttons at their fixed minimum width. Provider buttons now start from
  zero and grow to their usual width (`flex: 1 1 0; max-width: 10.5rem`), so a
  pair shrinks together instead of wrapping — anywhere. The event page stacks
  its details panel under the description below 900px, so a tablet gets the
  full-width panel. Measured side by side: 159px desktop, 168px tablet, 139px
  phone, 168px in the calendar.
- Header on tablets, fixed the same day: the full menu needs ~880px beside the
  logo (measured), but only folded into the menu button below 760px, so from
  761-880px the page scrolled sideways. It now folds at 960px, with headroom
  because the labels are editable from the sheet. Only the menu rules moved;
  the rest of the 760px layout is untouched.
- That exposed an older fault: privacy.html's header has one link and no menu
  button, so whenever the menu folded, "Back to the festival" disappeared —
  on phones since the page was made. It is now `.nav-links--fixed` and stays
  visible at every width.
- Every page loading styles.css is on the same cache tag (privacy had lagged).
- Verified live at 768px: menu button in place, no sideways scroll, privacy's
  back link visible. Locally also at 1078, 980, 940 and 375px.

### 22 Sep 2026 — data audit: one pipeline, sheet-driven everywhere
- Audited every place data enters and every copy of it; the map is now
  **`docs/DATA-MAP.md`** (sources → readers → derived copies → who regenerates
  what). Findings and fixes, each a targeted change:
- **Link builder now uses the site's own event pipeline.** It loads `main.js`
  and calls `loadEvents` → `normaliseEvent` → `assignSlugs` → `ticketsLive`,
  so its new **Event pages** destination lists exactly the events the calendar
  links, with the same addresses. Its own copies of the bridge and schedule
  URLs and its own schedule parser are gone; it reads `CONFIG`. Its weaker
  `esc` (no quote escaping) is gone too. A minted event link is
  `event/?e=<slug>&utm_…&ref=…`.
- **Fallback files resolve from the script's location** (`SITE_ROOT`), not
  from the page that loaded it — needed once `main.js` runs under `/admin/`,
  and it makes `event/`'s `<base>` no longer load-bearing for data.
- **Page views now carry `campaign_ref`** like every other dataLayer event;
  without it arrivals could not be split by link.
- **The event a visitor came from reaches the sheet again.** Since the 17 Sep
  simplification the Register form asks no programme question, so the
  Signups `programmes` column stayed empty even when the link said
  `?programme=`. A hidden `programmes` field is now filled from the link
  before the form's early return (that return was why a first attempt inside
  `preselectProgramme` never ran). The 17 Sep decision — no question — stands;
  only the data is carried. Cleared on a plain visit.
- **Derived copies regenerate hourly:** `tools/sync-events-fallback.py` now
  also rewrites the hero's placeholder figures in `index.html` (public events,
  span, venues — mirroring `NOT_PUBLIC`) and `sitemap.xml` (home, privacy and
  every public event page, 15 today), and the image workflow runs it.
- Not changed, recorded: PDFs and posters stay on-demand snapshots; the slug
  rule and the not-public keyword list exist in both JS and Python by design
  (see the map's "deliberate duplicates").

## 2. Lessons and standing rules (the "why" behind the rules)

**Data and privacy**
- PII lives only in the Foundation's Google Workspace. The site exposes
  aggregates only. The public site reads **only** the `Event List` tab of
  the planning sheet — never budget, fees, or personal rows.
- Costing and artist fees may appear on `/admin/report.html` (staff gate).
  Never add a budget/fees `?feed=` to the unauthenticated bridge — its URL
  is public by design and must only return public data.
- Spreadsheet ids are not secrets but do not belong in a public repo; they
  are in the vault. The bridge and schedule URLs must stay in `main.js`
  because the browser fetches them; their safety comes from returning only
  public data.
- Never let the form claim a save that the bridge has not confirmed.

**Bridge and Apps Script**
- Every value the bridge writes to a sheet must carry its own format. A
  value without one inherits the row's formatting, and the column drifts.
- A POST reply from Apps Script may be unreadable in the browser even
  though the row was written. Never leave a record "pending" on that alone:
  confirm with a GET (Receipts for signups, the Mint tab for links). And do
  not diagnose POSTs with `curl -L`; it turns Google's redirect into a 405.
- Do not name a request parameter `sid`. Google rejects it before your code
  runs, with a misleading error and no execution log.
- **The bridge is for writes and fallbacks, not page views.** Public pages
  read published feeds; the bridge is asked only when those fail. It shares
  ~30 concurrent executions with every registration.
- Any new field the bridge requires needs a **redeploy**; ship the front end
  compatible with the old bridge (mirror fields) or you break live signups.
- Bound every wait: attempts run against a time budget, JSONP timeout is 4 s,
  reads 6 s. Duplicate checks are fail-open.

**Deploy and infrastructure**
- Assume mobile data is bad. Every remote read needs a bounded timeout, a
  parallel local fallback, a cached last-good copy, and a retry the visitor
  can press. "Will appear soon" is never an acceptable failure state.
- Do not publish or type a `www.` form of the site address; it does not
  exist in DNS. If a www error appears on a phone, the bare lookup failed
  first.
- Nothing in `tools/` may assume macOS. Prefer a chain of fallbacks (as the
  image sync does) over a hard dependency, and let `doctor.sh` say what it
  found. The site itself is static HTML/CSS/JS and runs anywhere a browser
  does; only the tooling can drift.
- Never push a `CNAME` before its DNS record resolves.
- Image-heavy pushes need `git config http.postBuffer 157286400`.
- The CDN lags the Pages build by up to a minute; reload before debugging.
- Bump the `?v=` cache tag on `styles.css`/`main.js` after every change;
  a stale `main.js` once posted the wrong payload shape to a newer bridge.
- Google Drive images cannot be hotlinked. Sync them into `assets/drive/`
  and commit the copies.

**Design**
- The inline logo needs its fill rules wherever it is used. A page that does
  not load `styles.css` (the admin pages, any standalone tool) must carry
  `.logo-gold` / `.logo-orange` / `.logo-brown` itself, or the mark paints
  black.
- The full lockup (with Param) is the distributable mark. The title mark is
  display-only: never ship it as a file, never link it for download.
- Solve design problems at the **master stylesheet level** (tokens in
  `styles.css`, components in `site.css`), never with one-off patches.
  Mockups decide direction; the fix is promoted into the token system.
- Measure contrast for every colour on every ground; 4.5:1 is the floor.
  The consent fine print stops at the darkest grey that still clears it.
- Watch specificity: `.section p` at (0,1,1) has repeatedly out-ranked
  single-class rules; use element+class and tie-break on order. `.btn`
  setting `display` overrides `[hidden]`. Grid tracks should be
  `minmax(0, 1fr)` so a long word cannot push a card off the sheet.
- **The festival name as a mark.** Wherever "Bali in Bengaluru" stands as a
  heading or brand mark it is the inline SVG logo (`assets/logo.svg`) with a
  visually hidden `.sr-only` "Bali in Bengaluru" beside it; the hero `h1`
  alone uses the title mark (`assets/title.svg`, no "Param") because the
  kicker above it already names the presenter. Inside a sentence the name
  stays as text. Never type the name as display type again, never load the
  SVG as an `<img>`, and change the artwork in every inline copy and the
  asset together (they are identical).
- Monument Extended is the briefed display face but is **commercial and
  unlicensed**; it cannot be self-hosted on a public site or sit in a public
  repo. Archivo ExtraBold is the stand-in. When licensed: files to
  `assets/fonts/`, one `@font-face`, switch the `--display` token.
- The copper-on-charcoal rebuild was reverted once; do not re-propose a
  palette without showing a preview first.

**Working practice**
- **Before blaming a change, test the deployed site.** The empty Register
  checklist looked like a regression from the day's edits; the live site had
  the same one-card form because it was simplified on purpose on 17 Sep.
- **A shared script in a new page needs the same cache tag on every page.**
  Two edits under one tag served the first edit from cache and cost a
  wrong-looking test.
- **Fallbacks and PDFs drift; the page does not.** After a schedule change,
  run `tools/sync-events-fallback.py` and the two PDF tools. Derive dates in
  code rather than typing them into a template.
- **Derived numbers are not copy.** Anything the site computes from the
  sheet (the hero's days/events/venues, ticket-button counts) is only ever
  true on the page. §0 once recorded them as fixed client copy; a later
  session quoted that line, reported a mismatch that did not exist, and
  nearly "corrected" a number the sheet already had right. When §0 states a
  number, it says where it comes from and to verify on the page.
- Cross-check the public calendar against the planning sheet's Event Brief.
  An event can be confirmed and dated yet not open to the public; listing it
  with a Register button invites people to something they cannot attend.
  Those rows must also stay out of the Register programme checklist.
- Client changes arrive as documents with strikethrough (old) beside new
  text. Apply them verbatim and only where struck; do not improve, extend or
  invent copy around them. Anything not struck stays.
- Client photos arrive in a Drive folder, named for where they go ("… -
  under workshops"). Follow the name. When reading a folder page, count file
  ids against names: names are HTML-escaped and a `&` in one hid a file once.
- Never upscale a client photo; keep sources under the 1600px cap at native
  size.
- GitHub `main` is the source of truth; the drive is how the working copy
  and the vault key travel. Pull first, push last, always.
- Commit messages explain the reasoning. They are the audit trail this
  journal summarises.
- Verify on the live site after deploying, not just locally.
- **Change only what was asked.** Finding the cause of a problem is not
  permission to redesign around it. Two unrequested changes in one session
  (rewriting the tickets read path, repointing a working logo mapping) both
  had to be reverted. If a fix seems to need a wider change, say so and let
  the client decide; never undo a decision recorded here without raising it.
- **One read of a published feed is not evidence.** Google serves stale
  copies of a published TSV while an edit propagates, and cache-busting does
  not reliably defeat it. Before reporting an edit as failed — or as done —
  read twice, a minute apart.

---

## 3. Deferred and future work (with context)

- **Ticketing (Phase 3):** BookMyShow and District buttons are wired. Paste
  per-event URLs into the Event List provider columns. `BOOKING_OPEN` only
  needs flipping for occupancy/waitlist copy.
- **RSVP:** built and off. Flag + Apps Script redeploy to enable.
- **Post-event media (Phase 4):** gallery section or a `Media` sheet +
  renderer; concluded events link to albums.
- **Internal project-report page:** shipped at `/admin/report.html`. Iterate
  if the funder template wants different sections.
- **Calendar PDF download** is hidden on the site for now.
- **Monument licence** purchase, then the one-token font switch.
- **DNS hardening (client deferred, 10 Sep 2026):** on Cloudflare, add
  `www.bali-in-blr` CNAME + redirect to the bare host, and proxy the bare
  host so old Android trusts the certificate. Needs the domain admin.
- **Legacy JS build:** if old Android browsers keep appearing in reports, add
  a tool script that emits an ES2015 `main.legacy.js` and load it via the
  `nomodule` pattern. Not done; the old-browser notice covers it for now.

## 23 Sep 2026 — Planner pages draw first, firm up later

**Problem.** A cold load of the planner waited a minute or more: the sheet
read (15–40 s) and then 12 sequential leg batches, each paying Apps Script's
15–30 s front door, before anything appeared.

**Done, keeping the structure.**
- Both pages render at once from the festival schedule, the stored sheet
  copy (any age) and the built-in traffic profile; the backend work runs
  behind the drawn plan (`load({ sheet: "background" })`).
- One backend call instead of thirteen: `legs` takes up to 120 legs (the
  page sends 100, which is normally the whole tour) and, with `sheet=1`,
  returns the planner-sheet inputs in the same answer. The page tolerates
  an older backend (falls back to 40 a time and a separate sheet read).
- The backend keeps the 17-tab sheet read in CacheService (`sheetplan-v1`,
  6 h) and re-makes it after every write-back and rebuild; `fresh=1`
  bypasses it. Legs already lived in CacheService.
- The browser keeps the sheet copy for a day instead of an hour; legs keep
  their tiered TTLs.

**Measured (local, cold cache, old backend):** plan on screen in ~4 s,
Google traffic settled in ~60 s; warm reload complete in ~5 s.

**Lesson.** Never block first paint on Apps Script. Draw from what is on
the device, then refine; the front-door latency is Google's and cannot be
tuned away, only paid fewer times.

