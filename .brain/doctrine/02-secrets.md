# Secrets are written to files, never rendered

Never print a secret, or any part of one, into a transcript — not even masked.

## Why

A key was being written to a printable file. A "masked" preview was printed to
show the layout; the mask was a regex that missed one formatting case, and
most of the key went into the transcript in clear. Transcripts cannot be
deleted, so the key had to be rotated, everything re-encrypted and every
backup redone.

**You cannot unpublish a secret. You can only retire it.**

## How to apply

- Write the secret to a file and hand over the file. No `cat`, no preview,
  no "just to show the format". Masking is not a safeguard — if output might
  contain a secret, do not produce the output.
- Let the owner type passphrases themselves in their own terminal. Never
  accept one in chat, never put one on a command line.
- Verify by comparison, printing only a verdict.
- Sweep for stray plaintext copies afterwards and remove them.
- Keep the encrypted store in the repo and the key outside it. A repo alone
  must reveal nothing.
- Exposure is answered by **rotation**, and rotation protects the future only:
  encrypted blobs already published stay readable with the retired key.
