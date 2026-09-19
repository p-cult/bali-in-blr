# Security and secrets

### A key printed into a transcript
- **Seen in:** the event site
- **Symptom:** most of a vault key appeared in a chat while making a printable
  backup.
- **Cause:** a "masked" preview was printed to show layout; the mask missed one
  formatting case.
- **Resolution:** transcripts cannot be deleted, so the key was **rotated**, the
  vault re-sealed, every backup redone.
- **Status:** resolved — and made a rule: never render a secret, even masked
  (doctrine/02)
- **Early warning:** any command about to print part of a secret "just to check".

### Logins written into docs in a public repo
- **Seen in:** the task system (8 docs, a committed credentials file, and an
  editor rule telling assistants which password to type — including in the
  handover documents given to the client) and a dashboard (in its README)
- **Status:** managed — they were confirmed not to be live accounts;
  `brain.sh check` now scans for them (file and line only, never the value)
- **Early warning:** "just for staging".

### An admin password shipped to every visitor
- **Seen in:** a dashboard
- **Cause:** the admin check lived in page JavaScript, so the password was in
  code anyone can read.
- **Lesson:** anything in browser code is public. A browser-side "login" is a
  curtain, not a lock.
- **Status:** open

### A backup drive that ignored permissions
- **Seen in:** the event site
- **Symptom:** `ls` showed read-only, owner-only — meaningless.
- **Cause:** exFAT and FAT do not enforce Unix permissions.
- **Resolution:** the backup key was wrapped with a passphrase; no plaintext
  on that drive.
- **Status:** resolved

### Passwords in a spreadsheet, in plain text
- **Seen in:** the task system
- **Status:** **accepted** — a deliberate, recorded decision for a personal-scale
  app. Do not add hashing or enterprise auth unless asked. Do not re-raise it.
- **Consequence to respect:** never open or read that users tab wholesale —
  select only the columns you need, or you will print everyone's password.

### Private ids or tokens reaching the browser
- **Seen in:** designed out in three projects
- **Resolution:** the browser holds nothing private; opaque references instead
  of raw ids. (patterns/thin-bridge.md)
- **Status:** resolved

### The repo copy of a script is the only backup
- **Seen in:** the event site (one script existed only inside Google)
- **Resolution:** keep every deployed script's source in the repo, in step.
- **Status:** managed
