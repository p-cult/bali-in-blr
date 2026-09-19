# Docs and context

The failures here are the ones that cost the most tokens, because they send an
assistant confidently in the wrong direction.

### Too many docs made assistants invent things
- **Seen in:** the task system, generation 2
- **Symptom:** assistants proposed wrong hosting homes and lost the project's
  real intent. The plan file had become "a novel of past handoffs".
- **Cause:** 25+ root documents — audits, handovers, a second blueprint —
  contradicting each other, with no rule for which wins.
- **Resolution:** a one-day cleanup boxing everything non-essential; **three**
  living documents; an explicit **truth hierarchy** saying which wins when two
  disagree. Generation 4 kept it lean from day one: five files to read.
- **Status:** resolved
- **Early warning:** more than one file claiming to be "the plan" or "the state".

### The front door lied
- **Seen in:** the event site
- **Symptom:** an assistant started from "the backend is not connected" — weeks
  after it went live.
- **Cause:** the first file read described a state that had since changed.
- **Resolution:** corrected; a `state.sh` that measures the live system, run
  first every session, so prose is never the first source.
- **Status:** resolved
- **Early warning:** a status sentence with no date and no source.

### A status file frozen in the past
- **Seen in:** the task system, generation 4
- **Symptom:** "can we switch over tomorrow? No" — a fortnight after the switch.
- **Cause:** written once for a decision, never touched again.
- **Resolution:** newer handover documents superseded it; the lesson is to
  state where a fact comes from rather than the fact.
- **Status:** managed (doctrine/04)

### "Final state" that wasn't
- **Seen in:** the task system, generation 2
- **Symptom:** a summary titled *final state* declared the system "stable,
  leak-free, ready". Weeks later the system was rebuilt from scratch because of
  a problem the summary never mentioned.
- **Lesson:** nothing is final. Say what was verified, and what was not.
- **Status:** managed (heart/PROOF.md)

### A number written down as if it were copy
- **Seen in:** the event site
- **Symptom:** a later session quoted a stored count, reported a mismatch that
  did not exist, and nearly "corrected" a number the source already had right.
- **Resolution:** derived numbers are only ever true on the live page; docs say
  where a number comes from, not what it is.
- **Status:** resolved

### Chat memory died
- **Seen in:** every project
- **Cause:** decisions made in conversation and never written down.
- **Resolution:** write decisions to a file the moment they are made. "Your
  memory is sand; these files are stone." (heart/ESSENCE.md)
- **Status:** managed

### Handover depended on one tool's setup
- **Seen in:** the first task sheet
- **Symptom:** handover checks silently skipped on every machine but one.
- **Cause:** the script hardcoded one tool's private runtime path.
- **Resolution:** rebuilt as `tools/handover.sh`, using whatever is installed.
- **Status:** resolved
