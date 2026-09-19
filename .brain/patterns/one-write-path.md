# Pattern: exactly one way to create a record

**Use when** records get identities — ids, codes, tickets, anything other data
points at.

## The lesson

A system that grew several ways to create a record — a dashboard, an import, a
queue, a sync, a script — ended up with several ways to mint an identity, each
with slightly different rules. That was its single worst source of pain:
duplicates, collisions and records nobody could reconcile. The rebuild made
**a second creation path a bug**, by definition.

## Shape

```
any door  ->  validate  ->  identity guard  ->  mint id  ->  write
```

- **One mint function.** Nothing else invents an id — not the browser, not a
  script, not an import, not an AI.
- **One creation sequence.** Every new way in (a form, an import, a message,
  a kiosk) is a new **door** into the same sequence, never a new factory.
- **An identity is stable.** It does not change when content, status or a
  display name changes.
- **No valid id means not a record.** Quarantine it; never pretend it is real.
- **Refuse rather than invent.** If the id scheme runs out, stop and say so.

## The extension test

Before adding a feature, ask: *does this need a second way to create records,
or a second place they are born?* If yes, the design is wrong — extend the one
path instead.
