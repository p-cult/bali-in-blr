# Grvtrn mn

Display face for Bali in Bengaluru. © 2024 Nian Keun Studio. Licensed by Param
Foundation — keep the licence with the Foundation's records, not in this repo.

- One weight only (Regular). Display type must not lean on a bold that does not
  exist; use size, case and colour for hierarchy instead.
- `fsType` is 0 — no embedding restriction — which is why it can be served from
  the site.
- **No rupee glyph.** A `₹` set in this face falls back to the body font, so
  prices are set in the body face on purpose.
- Shipped as TTF. Converting to WOFF2 would roughly halve the 91 KB, and needs
  fonttools + brotli, which the project does not otherwise require.
