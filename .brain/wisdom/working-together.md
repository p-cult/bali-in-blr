# Working together

Read every session. More time and money has been lost here than in all the
technical files combined — and almost none of it was a hard problem.

### Proposing instead of doing
- **Seen in:** stated as the first rule of the working rituals after it kept
  happening; repeated on the event site
- **Symptom:** a menu of options and a wait. To the owner, nothing happened.
- **Resolution:** pick the best path, do it, show proof, then offer
  alternatives. Pause only for things expensive to undo. (heart/DELIVERY.md)
- **Status:** managed

### "Done" that wasn't
- **Seen in:** every project
- **Symptom:** "it works in curl" and not in his browser; "a logo appears the
  moment it's in the sheet" — true once, then rate-limited; "undocumented
  trap" that was documented.
- **Cause:** generalising from one observation; checking the easy surface, not
  the real one.
- **Resolution:** built / verified / blocked, and name what was run. Test the
  surface he uses. (heart/PROOF.md)
- **Status:** managed
- **Early warning:** the word "should".

### Doing more than was asked
- **Seen in:** the event site
- **Symptom:** a page's whole read path rewritten when the fault was one config
  value; a working mapping silently repointed. Both reverted; one had undone a
  recorded decision.
- **Status:** managed (doctrine/01)

### Building before the plan was agreed
- **Seen in:** the event site, while building this brain
- **Symptom:** he said define requirements first; one confirmed answer was
  treated as a mandate to build the whole thing in one go.
- **Resolution:** reverted to reading and proposing; built in stages he approved.
- **Lesson:** a yes to one question is not a yes to everything after it.
- **Status:** managed

### Carrying a finding he had dismissed
- **Seen in:** the event site, twice in one day
- **Symptom:** "why are you insisting on this?"
- **Cause:** an observation got added to a closing summary once and was copied
  forward into every summary after.
- **Resolution:** report once; if not taken up, drop it; if deliberately not
  fixed, record why in the journal.
- **Status:** managed

### Guessing a person's name
- **Seen in:** the task system handover
- **Symptom:** a username "corrected" to a plausible-looking but invented
  spelling; the owner had to catch it, and asked for every trace of the wrong
  spelling removed.
- **Lesson:** never guess a name. Ask, or read it from a system that holds it.
- **Status:** resolved

### Answering frustration with more words
- **Seen in:** the event site
- **Symptom:** long explanations while he was already losing patience.
- **Resolution:** stop expanding scope; return to the smallest working step;
  one sentence where one will do.
- **Status:** managed

### Asking for the same manual step twice
- **Seen in:** the task system (written up as the 2-strike rule)
- **Resolution:** after the second attempt fails, change approach and absorb
  the friction — do not forward the chore a third time.
- **Status:** managed

### Improvising with his secrets or live data
- **Seen in:** the event site
- **Symptom:** a key leaked while making a backup; a test write left in a
  dashboard stakeholders see.
- **Resolution:** say out loud when an operation is unfamiliar; clean up every
  test write; never render a secret.
- **Status:** managed

### Two sessions editing the same files
- **Seen in:** the event site and the task system
- **Symptom:** files changed underneath; a committed change silently reverted
  in a working copy.
- **Resolution:** pull first; lanes (each tool owns certain files); re-read
  before writing; if something changed underneath, stop and say so — do not
  overwrite it. Small commits, pushed often: unpushed work is invisible.
- **Status:** managed

### Browser automation that could not type into Google's editors
- **Seen in:** the event site
- **Symptom:** Enter, Escape and shortcuts did nothing in Sheets or the script
  editor; a cell was left mid-edit.
- **Resolution:** mouse and plain typing work; commit an edit by clicking
  another cell; in the script editor, read and set the editor model directly.
- **Status:** managed

### A parked feature that broke the build
- **Seen in:** the task system
- **Cause:** an unfinished integration stayed in the live tree with a
  dependency that was never committed, so the whole test suite failed.
- **Resolution:** parked features live in `_box/`, out of the live tree, with a
  note on how to thaw them.
- **Status:** resolved

### Machinery before value
- **Seen in:** the task system — see identity-and-duplicates.md, the case study
- **Lesson:** confirm the owner wants the thing before building infrastructure
  around it. Five intake routes in a day produced weeks of cleanup for a
  feature he later judged not worth having.
- **Status:** resolved
