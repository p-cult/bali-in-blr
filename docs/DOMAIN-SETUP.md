# Pointing bali-in-blr.paramfoundation.org at the festival site

**For whoever manages DNS for `paramfoundation.org`.**

This is a **one-time** change. Once the record below exists, nothing further is
ever needed from you — new sections and new signup links on the site are handled
entirely in the site's own code repository and appear automatically.

---

## The one record to add

| Field | Value |
| --- | --- |
| **Type** | `CNAME` |
| **Name / Host** | `bali-in-blr` |
| **Value / Points to** | `p-cult.github.io.` |
| **TTL** | Default (or 3600) |

That is the whole change.

**Please note the two easy mistakes:**

- The value is **`p-cult.github.io.`** — the account, *not* the repository. Do
  **not** add `/bali-in-blr` to the end. A path is not valid in a CNAME record.
- The trailing dot is correct if your DNS panel shows other records with one.
  Some panels add it for you; either way is fine.
- If your panel asks for the full name, it is `bali-in-blr.paramfoundation.org`.

This affects **only** the `bali-in-blr` subdomain. `paramfoundation.org` itself,
`www`, mail (MX), and every other record are untouched — this cannot affect the
main website or email.

---

## Please tell us once it is added

We complete the setup from our side after the record exists, and it must be done
in that order — so a quick note back saying it is in place is all we need.

Propagation is usually minutes, occasionally up to a few hours.

---

## What it will serve

The Bali in Bengaluru festival campaign site, published by Param Foundation from
GitHub Pages, over HTTPS with a free auto-renewing certificate. Source:
<https://github.com/p-cult/bali-in-blr>

---

## To verify (optional)

```bash
dig +short bali-in-blr.paramfoundation.org CNAME
# expect: p-cult.github.io.
```
