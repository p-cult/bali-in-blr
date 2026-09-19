# Identity and duplicates

The costliest problem in the whole record, and the one that finally forced a
ground-up rebuild. Read this before building anything that creates records.

## Case study — the messaging intake

This is the most important story in this folder. The feature itself was later
judged not worth having; **the lessons are what matter.**

**What happened.** The task system wanted work captured from chat messages. In
a single day, five separate intake routes were built: a bulk import from
AI-cleaned JSON, a phone Shortcut posting to a journal endpoint, an AI parser
for messy text, a "letterbox" tab the Shortcut dropped text into for a server
to drain, and a backfill from message screenshots.

**What it cost, in order:**
- The next day, two running copies of the drainer raced and **created duplicate
  tasks**. Fix: a single-drainer rule — a flag switching it off everywhere but
  one instance.
- A race condition in concurrent status updates needed an emergency fix.
- Two days in, bulk import was retired as dead on arrival.
- Forwarded, repeated and lightly edited messages kept creating **twin tasks**.
  Fix: two dedup keys per item — one from the source row, one from content.
- People wrote "done", "finished", "to do", "planned" freely. Fix: normalise
  every word to four canonical statuses at every entry point.
- The free-tier AI parser failed intermittently under load. Fix: retry once.
- The server slept on its free tier and missed drains. Fix: a keep-alive ping.
- A two-way user-sheet sync began **manufacturing duplicates on its own**. Fix:
  a kill-switch turning it off.
- The master sheet reached **~801 duplicate rows**; one count went from **948 to
  1,461**. Response: a dedup planner, a merge planner, a purge tool, a
  duplicate detector — each with tests.

**The owner's verdict:** the feature was not worth it.

**The root cause** was not the chat app, the AI, or the hosting. Every one of
those fixes treated a symptom. **Each intake route was its own way of minting
an identity.** Five doors, five factories, five slightly different rules.

**The final solution (the fourth-generation rebuild):**
- **Every channel is a door. There is exactly one factory.**
  `validate -> identity guard -> mint id -> create`. No channel mints anything.
- The automated message pipeline was **paused, not rebuilt**. Chat content now
  enters by an admin *pasting* it into an Inject tab: parse, map onto the known
  project list only (with aliases for common misspellings), show duplicates
  for the human to purge or split, **then** send through the one birth path.
- A second creation path is now **defined as a bug**.
- Cleanup tools were demoted to a repair kit — not part of the daily path.

**The lessons, in one line each:**
1. Find out whether the owner values a feature before building infrastructure
   around it.
2. Build one way in, prove it, then add doors to it — never five at once.
3. For low-volume, messy input, a human paste with a preview beats an
   automated pipeline: cheaper, safer, and nothing races.
4. When a system starts manufacturing duplicates, **stop the source first**.
   Cleanup tooling built while the source still runs is a treadmill.

---

### Many ways to create a record
- **Seen in:** the task system, generations 2 and 3
- **Symptom:** duplicate ids, twin rows, records nobody can reconcile.
- **Cause:** each creation path minted identities with its own rules.
- **Resolution:** one mint function, one creation sequence; everything else is
  a door into it. (patterns/one-write-path.md)
- **Status:** resolved in generation 4
- **Early warning:** a new feature that "just needs its own little create".

### Two processes writing the same data at once
- **Seen in:** the task system — twice (two drainers; two whole systems at cutover)
- **Symptom:** duplicated or overwritten rows.
- **Cause:** nothing stopped two writers running together.
- **Resolution:** a single-writer rule enforced in config — an explicit
  `WRITER_OF_RECORD` naming the one system allowed to write — and the old
  system fully stopped *before* the new one is allowed to write.
- **Status:** resolved
- **Early warning:** any second instance, cron, worker or old deployment still
  running.

### An identity that meant two things
- **Seen in:** the task system
- **Symptom:** people saw each other's tasks, or lost their own.
- **Cause:** an assignee was sometimes a sheet key and sometimes a display name.
- **Resolution:** one canonical key in every API; display names only for show.
- **Status:** resolved
- **Early warning:** a field compared against both an id and a name.

### Renaming something that other records point at
- **Seen in:** the event site (checked before renaming, so avoided)
- **Symptom:** records orphaned from what they belong to.
- **Cause:** a human-readable field was also the join key.
- **Resolution:** check every place the value is matched before renaming.
- **Status:** managed
- **Early warning:** "it's just a spelling fix" on a title or name.

### A queue that minted on arrival
- **Seen in:** the task system
- **Cause:** items got real ids before anyone approved them.
- **Resolution:** the queue holds drafts with **no** id; approval calls the one
  birth path.
- **Status:** resolved
