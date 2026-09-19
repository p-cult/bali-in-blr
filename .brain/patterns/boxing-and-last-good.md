# Pattern: box, never delete — and keep a rope back

Nothing the owner made is destroyed. Things that stop mattering are moved
aside, with enough context to bring them back.

## Boxing

When files go irrelevant or work drifts, move them to
`_box/box-<date>/` with a short manifest:

- what was boxed
- **why** it was boxed
- **what would make it relevant again**

Reversible always. `_box/` is archaeology, never current truth — tools and
people must not treat anything in it as how things work now.

## Last-good

Files that matter have a **blessed last-good** version: a commit known to be
genuinely solid. Keep a short table of them.

When a file goes rogue — bloated, failing, drifting from its purpose — do not
keep patching it. Box the rogue state, and **remould from the last-good**.
Piling fixes on a corrupted file makes it unfixable.

## Before any risky change

Take a backup first — `bash .brain/tools/handover.sh takeover` does this. Four
projects independently kept timestamped copies before refactors and rewrites;
the brain makes it one command instead of a habit that only some sessions keep.
