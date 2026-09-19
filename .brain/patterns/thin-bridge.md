# Pattern: the browser decides nothing and holds nothing secret

**Use when** a public page reads or writes private data.

## Shape

```
browser  ->  one server-side decision point  ->  thin bridge  ->  data store
```

- **The browser is a window.** It never holds a private sheet id, a script
  secret, a write token or a password. Anything in page code can be read by
  anyone.
- **Decisions live in one place.** Who may do what, validation, and identity
  all happen server-side. Hiding a button is cosmetic; the server enforces it.
- **The bridge is hands, not a brain.** Read, write, listen, react — on
  instruction. No role logic, no id policy. If a rule can live in the decision
  point, it must not be re-implemented in the bridge.
- **Validate everything server-side**, including data that came from your own
  store. Restrict writes to known actions and known fields.
- **Formulas over scripts** inside a spreadsheet where a formula can do the
  job. Scripts are the fragile part; keep them for what formulas cannot do.

## Freshness

- Fetch fresh on startup, with `cache: "no-store"` and a timestamp parameter.
- Have the server expose a `version` / `lastUpdated`; poll that, and refetch
  everything only when it changes.
- After a successful write, clear pending state and refetch.
- **A failed write must never look saved.**
