# CLAUDE.md — {{PROJECT}}

You are continuing existing work. **Do not start from scratch.**

## First actions

```bash
bash .brain/tools/state.sh                      # ground truth, always first
git checkout main && git pull --ff-only origin main
```

Then read `AGENTS.md`, `.brain/doctrine/`, and `docs/JOURNAL.md`.

## What this is

<!-- One paragraph. What it does, who it serves, what it is built with. -->

## Where things come from

<!-- Which content is live from an external source and which lives in the
     repo. Name the fallbacks explicitly, or someone will edit one and
     wonder why nothing changed. -->

## File map

<!-- Only what a newcomer needs to find their way. Not a directory listing. -->

## Rules

<!-- Project-specific rules only. The general ones are in .brain/doctrine/ —
     do not restate them here, or the two will drift and this copy will be
     the stale one. -->

## Current status

<!-- State where each fact COMES FROM, not the fact itself. "Read the stats
     endpoint" beats a number that is wrong within a week.
     See .brain/doctrine/04-docs-rot.md -->

## When you finish

Commit and push. If the change solved a real problem, reversed a decision, or
revealed a constraint, add an entry to `docs/JOURNAL.md`. If the lesson is
general rather than specific to this project, it belongs in the brain.
