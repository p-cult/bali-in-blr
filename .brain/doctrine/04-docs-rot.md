# Docs rot; make them cheap to check and hard to believe blindly

## Why

Front-door files are the most dangerous place for a stale claim, because they
are read first and set the mental model for everything after. In one audit the
two files an assistant reads first both described a state that had been false
for weeks.

It was not a one-off. A second project's go-live status file still said "can
we switch over tomorrow? No" a fortnight after the switch had happened and the
new system was serving production. The newer handover docs were right; the
status file simply never got touched again.

## How to apply

- Keep a **status block** that states where each fact comes from, not the fact
  itself: "read the endpoint" beats "198 registered".
- Chronological entries are history — never rewrite them. Status is current —
  always update it. Keep them in separate sections so the distinction is
  obvious.
- Record decisions **not** to act, with the reasoning. Without that, every
  fresh session rediscovers the same non-issue and re-raises it.
- Prefer a check over a sentence. A script that verifies twenty facts for free
  is worth more than a paragraph asserting them, and it cannot go stale
  silently.
- When a shared asset is versioned for cache-busting, bump it on **every** page
  that loads it, or visitors hold two copies.
