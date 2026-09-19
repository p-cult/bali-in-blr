# Front end and assets

### A logo that stayed tiny whatever the CSS
- **Seen in:** the event site
- **Symptom:** resized four times; still read small, then showed a white box.
- **Cause:** the file, not the styles — a narrow mark, and a pass that had
  flattened its transparency onto white.
- **Resolution:** reverted every container change; fixed the file.
- **Lesson:** check the asset before touching the design system.
- **Status:** resolved

### Images silently upscaled
- **Seen in:** the event site (the image tool had already solved it)
- **Symptom:** 16 of 24 stored images bigger than their source; 1.4 MB wasted.
- **Cause:** `sips -Z` enlarges anything smaller than the cap.
- **Resolution:** measure first, resize only when larger. The image tool had
  used shrink-only resizing all along.
- **Status:** resolved (tools/images.sh, patterns/asset-sync.md)

### Transparency flattened to white
- **Seen in:** the event site
- **Cause:** a preview endpoint that always returns JPEG.
- **Resolution:** fetch the original; keep PNG when there is an alpha channel.
- **Status:** resolved

### Tools that disagreed byte for byte
- **Seen in:** the event site
- **Cause:** different machines' image tools encode differently.
- **Resolution:** scheduled jobs fetch only what is missing; they never
  re-optimise existing files.
- **Status:** resolved

### Two versions of the same stylesheet in the cache
- **Seen in:** the event site
- **Cause:** one page bumped the version tag, another didn't.
- **Resolution:** bump on every page that loads the file.
- **Status:** managed

### An empty result cached as if it were final
- **Seen in:** the event site
- **Symptom:** a section rendered empty.
- **Cause:** a loader cached the result array; a second caller got the empty
  starting value before the fetch finished.
- **Resolution:** cache the promise, not the value.
- **Status:** resolved

### Specificity surprises
- **Seen in:** the event site, repeatedly
- **Cause:** a descendant selector out-ranking a single class; a display rule
  overriding `[hidden]`; grid tracks without `minmax(0, 1fr)` letting one long
  word push a card off the page.
- **Status:** managed

### A mark that painted black
- **Seen in:** the event site
- **Cause:** an inline SVG on a page that did not load the stylesheet holding
  its colours.
- **Resolution:** every page using the mark carries its fill rules.
- **Status:** managed

### Bad mobile data
- **Seen in:** the event site
- **Resolution:** every remote read has a bounded timeout, a local fallback, a
  cached last-good copy, and a retry the visitor can press. "Will appear soon"
  is never an acceptable failure state.
- **Status:** managed

### Duplicate screens drifting apart
- **Seen in:** the task system
- **Cause:** two pages did the same job; one lagged and leaked internal text on
  an ungated page.
- **Resolution:** one canonical screen; the other boxed.
- **Status:** resolved
