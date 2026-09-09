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
  to `assets/drive/` by `tools/sync-images.sh`.
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
- Do not name a request parameter `sid`. Google rejects it before your code
  runs, with a misleading error and no execution log.
- Any new field the bridge requires needs a **redeploy**; ship the front end
  compatible with the old bridge (mirror fields) or you break live signups.
- Bound every wait: attempts run against a time budget, JSONP timeout is 4 s,
  reads 6 s. Duplicate checks are fail-open.

**Deploy and infrastructure**
- Never push a `CNAME` before its DNS record resolves.
- Image-heavy pushes need `git config http.postBuffer 157286400`.
- The CDN lags the Pages build by up to a minute; reload before debugging.
- Bump the `?v=` cache tag on `styles.css`/`main.js` after every change;
  a stale `main.js` once posted the wrong payload shape to a newer bridge.
- Google Drive images cannot be hotlinked. Sync them into `assets/drive/`
  and commit the copies.

**Design**
- Solve design problems at the **master stylesheet level** (tokens in
  `styles.css`, components in `site.css`), never with one-off patches.
  Mockups decide direction; the fix is promoted into the token system.
- Measure contrast for every colour on every ground; 4.5:1 is the floor.
  The consent fine print stops at the darkest grey that still clears it.
- Watch specificity: `.section p` at (0,1,1) has repeatedly out-ranked
  single-class rules; use element+class and tie-break on order. `.btn`
  setting `display` overrides `[hidden]`. Grid tracks should be
  `minmax(0, 1fr)` so a long word cannot push a card off the sheet.
- Monument Extended is the briefed display face but is **commercial and
  unlicensed**; it cannot be self-hosted on a public site or sit in a public
  repo. Archivo ExtraBold is the stand-in. When licensed: files to
  `assets/fonts/`, one `@font-face`, switch the `--display` token.
- The copper-on-charcoal rebuild was reverted once; do not re-propose a
  palette without showing a preview first.

**Working practice**
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
