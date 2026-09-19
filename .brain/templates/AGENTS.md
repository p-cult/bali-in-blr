# AGENTS.md — entry point for any AI coding tool

Whichever assistant opens this repository, on whichever machine: **this
project has a brain, and you load it before acting.**

## Before anything else

```bash
bash .brain/tools/state.sh      # what is actually true right now
```

Do this first, every session. It is cheap and it is evidence. Everything
below is prose, and **prose can be stale** — the output of that command
cannot.

## Then read, in this order

1. **`.brain/doctrine/`** — how work is done here. Short. Each rule exists
   because something went wrong once.
2. **`CLAUDE.md`** — first actions, the file map, project rules.
3. **`docs/JOURNAL.md`** — decisions and why. If the code looks odd, the
   reason is here. **Do not undo a recorded decision without raising it.**
4. **`docs/CYCLE.md`** — if this project runs in cycles, the checklist for
   one. Routine cycles should need no assistant at all.
5. **The sealed vault**, if the project has one, for private context.

## The three rules that matter most

- **Verify before asserting.** Never state a fact about live state without a
  command that proves it. (`.brain/doctrine/00`)
- **Do only what was asked.** A diagnosis is not a mandate to redesign.
  (`.brain/doctrine/01`)
- **Never render a secret**, not even masked. (`.brain/doctrine/02`)

## About `.brain/`

It is a **vendored copy** of the shared brain at `param/_brain`. Do not edit
it here — the next pull overwrites it. Improve the brain itself, then:

```bash
bash /path/to/param/_brain/brain.sh pull .
```

Project-specific values go in `brain.conf`, never in `.brain/`.
