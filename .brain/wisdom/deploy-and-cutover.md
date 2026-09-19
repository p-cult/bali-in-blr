# Deploy and cutover

### Switching systems while the old one still writes
- **Seen in:** the task system, generation 3 -> 4
- **Symptom:** (avoided) duplicate ids and overwritten rows from two minters.
- **Cause risk:** both systems pointing at the same live sheets.
- **Resolution:** staging mode with writes gated off until go-live; a written
  freeze runbook; the old service **suspended** before the new becomes sole
  writer; health checks proving only one writer. Cutover is a mode switch,
  never a data migration.
- **Status:** resolved
- **Early warning:** a go-live plan with no step that stops the old writer.

### Production quietly serving sample data
- **Seen in:** the task system (designed out)
- **Symptom risk:** confident, wrong answers while the real source is down.
- **Resolution:** production **refuses to start** if the live data cannot be
  loaded; development falls back loudly. Health reports it.
  (patterns/self-aware-health.md)
- **Status:** resolved

### Work accepted, then lost on a redeploy
- **Seen in:** the task system
- **Cause:** writes queued on the host's ephemeral disk, flushed later. A
  restart before flushing lost them.
- **Resolution:** in production, creation **waits** for the durable write;
  only non-critical updates are write-behind.
- **Status:** resolved

### Free hosting that goes to sleep
- **Seen in:** the task system, both generations on that host
- **Symptom:** the first request after idle is very slow or times out;
  scheduled jobs are missed.
- **Resolution:** a keep-alive ping during working hours only, weekends off —
  run by a free scheduled job.
- **Status:** managed
- **Early warning:** "it works when I test it" but fails first thing in the morning.

### A UI host that could not reach its API
- **Seen in:** the task system
- **Symptom:** the static page could not call the API on another origin; logins
  vanished (cookies not sent cross-origin).
- **Resolution:** a build step that bakes the API origin into the published
  page, bearer tokens instead of relying on cross-site cookies, and an explicit
  CORS origin.
- **Status:** resolved

### Hosts that kept coming back
- **Seen in:** the task system, repeatedly
- **Symptom:** assistants proposed "put the whole app on X", or revived hosts
  that had been abandoned.
- **Resolution:** a list of **forbidden confusions** written into the operating
  law, plus one table of canonical homes. (docs-and-context.md)
- **Status:** managed

### The CDN lags the deploy
- **Seen in:** the event site
- **Resolution:** wait a minute and reload before debugging a "failed" deploy.
- **Status:** accepted

### Pointing a domain before its DNS existed
- **Seen in:** the event site
- **Resolution:** never push a custom-domain file before the DNS record
  resolves. Never publish a `www.` form that does not exist.
- **Status:** managed

### A stale script posting the wrong shape
- **Seen in:** the event site
- **Cause:** a cached old script sent a payload the new backend rejected.
- **Resolution:** bump the version tag on every change, on **every** page that
  loads the file; ship front ends compatible with the old backend until the
  new one is deployed.
- **Status:** managed
