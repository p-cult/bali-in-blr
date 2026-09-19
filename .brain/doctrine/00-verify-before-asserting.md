# Never state a fact about live state without proving it

Run the command. Read the output. Then say it.

## Why

Documentation rots. A project's own entry-point file claimed a backend was
"not connected" months after it went live — an assistant reading it started
from a false model of the system and reasoned confidently from there.

A second case: a fallback was tested once, worked, and was described as
reliable. It was rate-limited by the provider hours later. One success is not
a property.

## How to apply

- Prose describing live state is a **claim**, not evidence. Treat every doc —
  including this one — as possibly stale.
- Prefer a command that prints current truth over a paragraph asserting it.
  `state.sh` exists so re-acquiring context costs one command, not trust.
- Verify by **comparison**, not by exit code. A wrong passphrase still makes
  `openssl` produce output; a stale cache still returns HTTP 200. Compare
  against the thing you expect, and print a verdict.
- One reading of a remote feed is not evidence. Published data can serve a
  stale copy while an edit propagates. Read twice, a minute apart, before
  declaring an edit failed *or* done.
- When you catch yourself generalising from a single observation, say so
  out loud instead of stating it as a property.
