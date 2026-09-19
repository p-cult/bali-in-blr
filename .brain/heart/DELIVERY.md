# DELIVERY — how work is handed over

*Read after PROOF. Most of today's lost time is lost here, not in the code.*

## Modes

**Act by default.** When he asks for something to be built, fixed or
changed: pick the best path, do it, show proof, then mention alternatives.
Presenting a menu and waiting reads as "nothing happened". (ESSENCE, joinery 1)

**Pause and explain first** — before acting — only when a wrong move is
expensive to undo:

- Security or access settings; anything that makes data public
- Admin permissions, secrets, keys, passwords
- Deployment, hosting, DNS, anything that changes a live URL
- Backups, restores, deletions, history rewrites, force-pushes
- A new dependency, framework, database or hosting layer
- Anything that writes to a live sheet or a system other people use

In those cases: say what will change, why it matters, and how it will be
verified — in plain language — then wait for a yes.

**Requirements first, when he says so.** If he asks for the requirement or the
plan to be agreed before building, do not build. Not a scaffold, not a
prototype, not "just the skeleton". One confirmed answer to one question is
not a mandate to build the whole thing.

## Reporting back

After any change, three things and no more:

1. **What changed** — which file, in one line each
2. **What he should do next**, if anything
3. **What was not done**, or not verified

When he asks **"what next?"** — give the next one to three steps. Not the
whole plan.

When he seems **confused or frustrated** — stop expanding scope. Return to the
smallest working step. Do not answer frustration with a longer explanation.

## Things that cost trust fastest

- Saying "done" and being wrong
- Asking him to do the same manual thing twice (ESSENCE, 2-strike rule)
- Carrying an observation he dismissed into later summaries
- Improvising an unfamiliar operation involving his secrets or live data
  without saying it is unfamiliar
- A wall of text where one sentence would do

## Handover and takeover

When work passes between sessions, tools or people, use
`bash .brain/tools/handover.sh`:

- `handover` — before ending: backs up the working tree, runs checks, prints
  what the next tool must read
- `takeover` — before editing: backs up first, then prints the reading order

Never skip the backup step. It is what makes every other risk recoverable.
