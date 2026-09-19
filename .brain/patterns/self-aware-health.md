# Pattern: a system that can say what state it is in

**Use for** anything with a server or a moving part. Four projects built some
version of this independently; the most complete had a health endpoint that
reports *why* it is unhealthy and what it healed.

## Shape

One read-only check, available two ways: a command for a person
(`state.sh`, a doctor script) and an endpoint for a machine
(`GET /api/health`).

It reports:

- **overall** — healthy / degraded / unhealthy, and a boolean for probes
- **identity** — app name, version, mode (development / staging / production)
- **config issues** — each with a severity, a code, a message and a **hint**
  saying what to do about it
- **dependencies** — each external thing, with its own state
- **what it healed** at startup, so self-healing is never invisible

Unhealthy returns a non-success status so monitoring can alert on it.

## Self-heal in development, refuse in production

| Situation | Development | Production |
|---|---|---|
| Missing local folder | create it | create it |
| Unknown storage adapter | fall back to in-memory, loudly | **refuse to start** |
| Live connection enabled but not configured | disable it, loudly | **refuse to start** |
| Port in use | clear message naming the fix | same |

**Heal foot-guns in development. Never let production pretend.** A system that
silently serves sample data when the real source fails is worse than one that
is visibly down — it produces confident wrong answers.

## Traps

- A health check that only confirms the process is up tells you nothing. Check
  the things that actually fail: the data source, the credentials, the bridge.
- Every heal must be recorded and shown, or the system quietly runs in a
  degraded mode nobody chose.
