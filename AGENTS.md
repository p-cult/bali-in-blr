# AGENTS.md — entry point for any AI coding tool

Whichever assistant opens this repository (Claude Code, Cursor, Codex, Copilot,
Gemini, or anything else), on whichever machine: **this project has a memory,
and you are expected to load it before acting.**

Read, in this order:

1. **`CLAUDE.md`** — first actions for a new session or machine, file map,
   rules. Written for Claude but applies to every tool.
2. **`HANDOVER.md`** — the complete brief: architecture, data schemas, design
   system, roadmap, compliance.
3. **`docs/JOURNAL.md`** — decisions, problems solved and lessons learned,
   in order. This is *why* things are the way they are. Anything that looks
   odd in the code is probably explained here.
4. **The vault's `memory` section** — the private half of the journal (sheet
   ids, design board links, people, constraints that cannot be public):
   `bash tools/vault.sh show`. Needs the key on the external drive.
5. **`docs/ANOTHER-MACHINE.md`** — if this is a computer the project has not
   been worked on before. Run `bash tools/doctor.sh` (reads only).

Then:

```bash
git checkout main && git pull --ff-only origin main
```

GitHub `main` is the single source of truth. Do not start from scratch, do not
rebuild what exists, and do not "fix" a decision the journal records as
deliberate without raising it first.

Rules that every tool must keep (the full set is in `CLAUDE.md`):

- Vanilla HTML/CSS/JS, no dependencies, no build step. Styling through the
  tokens and components in `styles.css` / `site.css`, never inline or patched.
- PII only in approved Google Workspace systems; aggregates only on the site.
- The festival name as a heading or brand mark is the inline logo
  (`assets/logo.svg`; the hero `h1` uses the title mark, inlined in index.html and
  deliberately not shipped as a file) with `.sr-only` text. In a sentence it is text.
- Bump the `?v=` cache tags after touching CSS/JS. Pull first, push last.

When you finish a change, commit with a message that explains the reasoning,
push, and — if the change solved a real problem or reversed a decision — add
an entry to `docs/JOURNAL.md` so the next tool inherits it.

The same rules are mirrored for Cursor in `.cursor/rules/project.mdc`.
