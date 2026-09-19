# Do only what was asked

Finding the cause of a problem is not permission to redesign around it.

## Why

In one session two changes were made that nobody requested: a page's whole
data-read path was rewritten when the actual fault was an unfilled config
placeholder, and a working asset mapping was silently repointed at a
different file. Both had to be reverted. One of them also undid a decision
that was explicitly recorded in the project journal.

## How to apply

- Fix the thing named. If the fix appears to need a wider change, say so and
  let the owner decide.
- Never undo something the journal records without raising it first.
- **Do not carry an observation forward as a task.** Noticing something is not
  the same as it being work. Report a finding once, with a recommendation. If
  it is not taken up, drop it — do not repeat it in later summaries.
- When something is deliberately not being fixed, record the reasoning in the
  journal, so a later session does not re-raise it as a fresh defect.
