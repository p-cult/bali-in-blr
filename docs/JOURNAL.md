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
  domain, HTTPS). Festival runs **1–18 October 2026**.
- **Bridge connected.** Register and Volunteer forms save via the Apps Script
  bridge into a deduplicated `Master` registry with per-flavour tabs and
  receipts. Calendar reads the schedule sheet's `Event List` tab live.
- **Switches currently OFF** in `main.js` `CONFIG`: `BOOKING_OPEN` (per-event
  ticket/RSVP links from the sheet) and `RSVP_ENABLED` (per-event RSVP
  capture). All event buttons funnel to the single Register module.
- **Analytics:** Google Tag Manager installed; GA4/Meta/Ads are added inside
  GTM, not in the repo.
- **Admin:** `/admin` hub with a staff sign-in gate and the Campaign Link
  Builder (UTM + ref links, QR minting, recorded to the sheet's `Mint` tab).
- **Images:** event photos come from Google Drive links in the sheet, synced
  to `assets/drive/` by `tools/sync-images.sh`. Programme cards carry the
  client's own photos (all seven have real images; no placeholder remains).
- **Brand:** the festival logo (`assets/logo.svg`) is inlined wherever the
  name is a heading or brand mark; the hero uses the title mark, inlined in
  `index.html` and deliberately not shipped as a file (source in the vault).
  Hero copy and numbers (18 days, 18 events, 15 venues) are the client's,
  applied 9 Sep from their corrections document.
- **Brand kit:** a published artifact holds colour, pairings, the reference
  boards, the block motif, seams and edges, both wordmarks and type. It is
  the thing to hand a designer; the stylesheets remain the exact reference.
- **Open:** ticketing platform not chosen (Phase 3); post-event media/gallery
  (Phase 4); an internal project-report page (see §3); the Monument display
  font is not licensed (see §2).

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

---

## 2. Lessons and standing rules (the "why" behind the rules)

**Data and privacy**
- PII lives only in the Foundation's Google Workspace. The site exposes
  aggregates only. The public site reads **only** the `Event List` tab of
  the planning sheet — never budget, fees, or personal rows.
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
- Cross-check the public calendar against the planning sheet's Event Brief.
  An event can be confirmed and dated yet not open to the public; listing it
  with a Register button invites people to something they cannot attend.
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

---

## 3. Deferred and future work (with context)

- **Ticketing (Phase 3):** platform undecided (Townscript / District were
  floated). Paste per-event URLs into the sheet's ticket-link column and set
  `BOOKING_OPEN=true` when real.
- **RSVP:** built and off. Flag + Apps Script redeploy to enable.
- **Post-event media (Phase 4):** gallery section or a `Media` sheet +
  renderer; concluded events link to albums.
- **Internal project-report page:** Vinod wants a page that helps produce
  the funder/Foundation report from the planning sheet (programming grid,
  event brief, venues, budget, fees) plus registration and volunteer counts.
  Must be private or access-controlled, never a section of the public hub.
- **Calendar PDF download** is hidden on the site for now.
- **Monument licence** purchase, then the one-token font switch.
- **DNS hardening (client deferred, 10 Sep 2026):** on Cloudflare, add
  `www.bali-in-blr` CNAME + redirect to the bare host, and proxy the bare
  host so old Android trusts the certificate. Needs the domain admin.
- **Legacy JS build:** if old Android browsers keep appearing in reports, add
  a tool script that emits an ES2015 `main.legacy.js` and load it via the
  `nomodule` pattern. Not done; the old-browser notice covers it for now.
