# wisdom/ — what went wrong, and what was done about it

Doctrine says how to work. Patterns say how to build. **Wisdom says where it
went wrong before** — across every project this brain was built from — so the
next one does not pay for the same mistake twice.

Every entry here happened. None is hypothetical. Several happened in more than
one project independently, which is the strongest reason for this file to
exist: the lesson was learned, written down in one project, and then learned
again from scratch in the next.

## How to use it

**Before working in an area, read that area's file.** Touching a spreadsheet
script? Read `apps-script-and-sheets.md` first. Five minutes of reading has, on
the record, been cheaper than every one of these incidents.

| File | Read before |
|---|---|
| `apps-script-and-sheets.md` | editing, deploying or calling a Google script or sheet |
| `identity-and-duplicates.md` | anything that creates records or ids |
| `deploy-and-cutover.md` | deploying, changing hosts, switching systems over |
| `docs-and-context.md` | writing or trusting any documentation |
| `security-and-secrets.md` | anything with a password, key, token or login |
| `front-end-and-assets.md` | page code, styles, images, caching |
| `working-together.md` | every session — this is where most time is lost |

## Entry format

```
### <the pitfall, as it looks when it bites>
- Seen in:       which kinds of project, and how many
- Symptom:       what you notice
- Cause:         what was actually wrong
- Resolution:    what was done
- Status:        resolved | managed | accepted | open
- Early warning: how to spot it before it bites next time
```

**Status matters.** *Resolved* means the cause is gone. *Managed* means the
cause remains and a rule or guard contains it. *Accepted* means it was judged
not worth fixing — with the reason — so nobody re-raises it as new.

## Adding to it

When something goes wrong in any project: fix it there, record it in that
project's journal, and if it could happen elsewhere, **add it here**. An
incident that repeats across projects without appearing in this folder is this
folder failing.

The best entries end up as code. When a pitfall can be checked mechanically,
move it into a tool — then it stops depending on anyone remembering to read.
