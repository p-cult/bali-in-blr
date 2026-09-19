# Pattern: syncing linked assets into the repo

**Use when** content owners paste links to files in a drive, and those files
must be served by a static site that cannot fetch them at request time.

## Shape

A job reads the source, finds every linked file id, downloads it, optimises
it, and commits it to the repo. The page maps a link to the local copy.

Run it on a schedule, not by hand — otherwise assets silently stop keeping up
with content, and the failure is invisible until someone notices a blank.

## What makes it work

- **A fallback chain in the markup**: local optimised copy, then an alternate
  format, then the provider's own URL, then a clean empty state. Each step
  buys something; the last one means a missing asset degrades instead of
  showing a broken image.
- **Fetch the original, not a preview.** Preview endpoints re-encode, which
  silently flattens transparency — fine for photographs, ruinous for logos on
  a coloured background.
- **Transparency decides the format.** Detect an alpha channel and keep those
  as PNG; everything else becomes JPEG.
- **Size caps by kind.** A logo rendered at 60px does not need 1600px. Getting
  this wrong is invisible and expensive on every page load.
- **Only fetch what is missing, on the scheduled run.** Different machines'
  image tools produce different bytes from the same source, so re-optimising
  everything on a timer rewrites every file each run and fights local runs.
  Refreshing a *changed* asset stays a deliberate manual action.

## Traps

- **Never upscale.** Some tools enlarge anything smaller than the cap by
  default, adding bytes and softness and no detail. Measure first, resize only
  when the source is genuinely larger.
- **Provider rate limits.** A live fallback that works in testing may be
  refused under load or after repeated use. Treat it as best-effort; the
  scheduled sync is the mechanism.
- **Check the tool exists** before trusting the job. Falling through to "no
  optimiser available" can silently produce wrong output rather than failing.
