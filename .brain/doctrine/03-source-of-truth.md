# One source of truth, read live, edited by the people who own it

Content belongs to whoever owns it, in a tool they already use. Code belongs
in the repo. The page reads content at runtime.

## Why

Non-technical staff must be able to change what the public sees without a
developer, a deploy, or an assistant. When content lives in the repo, every
correction becomes an engineering request — and every engineering request is
a chance to drift, hallucinate, or spend tokens on a typo.

## How to apply

- Source of truth is the external store (a sheet, a CMS). The repo holds
  structure, design and behaviour.
- Local data files are **fallbacks for when the source is unreachable**, not
  the live data. Say so in the file and in the docs, or someone will edit the
  fallback and wonder why nothing changed.
- Derived numbers are computed from the source, never typed as copy. Anything
  a doc states as a count is stale the moment it is written; docs should say
  where the number comes from, not what it is.
- Publication gates belong in the data, not the code. A row appears only when
  its own status says it is ready, so material can be staged before it is
  announced.
- A field used to match records across systems is an identifier. Renaming it
  orphans the records that point at it — check before renaming.
