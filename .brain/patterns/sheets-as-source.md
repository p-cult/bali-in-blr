# Pattern: a spreadsheet as the live source of truth

**Use when** non-technical people own the content and must change it without a
developer, a deploy, or an assistant.

## Shape

The sheet is published as a read-only feed. The page fetches it at runtime and
renders it. No build step, no deploy, for content.

```
owner edits a cell  ->  published feed  ->  browser fetch on page load  ->  live
```

Repo holds structure, design and behaviour. Sheet holds content.

## What makes it work

- **A local fallback file** for when the feed is unreachable. Label it as a
  fallback in the file itself, or someone will edit it and wonder why nothing
  changes.
- **A second read path** — many providers can serve a feed two ways (a
  published export and an authenticated script endpoint). Try one, fall back
  to the other, so a publish toggle cannot take the site down.
- **Derived numbers computed, never typed.** Counts shown to users come from
  the feed. A number written into markup is a fallback, and must be updated
  wherever it appears when the underlying data changes.
- **A status column that gates publication.** A row appears only when its own
  status says ready. This lets material be staged before it is announced —
  and stops a half-finished row going public the moment someone pastes a link.

## Traps

- **Published feeds serve stale copies** while an edit propagates, and
  cache-busting does not reliably defeat it. Read twice, a minute apart, before
  concluding an edit failed or landed.
- **Headers drift.** Staff rename columns and add trailing spaces. Match
  headers case-insensitively and trimmed.
- **A column used to match records across systems is an identifier.** Renaming
  it orphans everything pointing at it. Check before renaming.
- **Blank is not zero.** An unreachable source must render "unknown", never a
  confident 0, or a dashboard will report a collapse that did not happen.
