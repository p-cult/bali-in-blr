# Pattern: degrade, never fail

Every external dependency will be unavailable at some point. Decide what the
user sees then — before it happens, not during.

## The chain

Order fallbacks by preference, and make the last one a clean empty state
rather than an error:

```
optimised local copy  ->  alternate format  ->  live remote  ->  clean blank
```

Implement it as a queue the failure handler walks, not as nested error
handling. Nested handlers stop at two levels; a queue extends for free and
stays readable.

## Rules

- **Unknown is not zero.** A failed read shows a dash. A dashboard that prints
  0 because a source was unreachable reports a disaster that did not happen.
- **A missing asset collapses to a designed empty state**, never a broken
  icon.
- **Bound every wait.** A hung request must time out rather than leave a
  control spinning forever.
- **An unreadable success is not a failure.** Some endpoints return an
  unparseable body even when the write succeeded. Confirm by reading back an
  id, not by trusting the response — otherwise a retry writes the record twice.
- **Cheap retries beat clever handling.** Some providers intermittently serve
  an interstitial. One retry removes a whole class of false alarms.
