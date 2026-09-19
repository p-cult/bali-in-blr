# Apps Script and Google Sheets

The most-repeated source of pain across every project. Google's scripts are
fragile, their error messages mislead, and their behaviour differs between the
editor, a browser and the command line.

### A POST "fails" but the row was written
- **Seen in:** three projects, independently
- **Symptom:** the browser gets an unreadable reply, an HTML page or HTTP 405 —
  yet the row is in the sheet. A retry then writes it twice.
- **Cause:** a web-app POST answers through a redirect. Browsers and `curl -L`
  handle it differently; `curl -L` turns it into a 405.
- **Resolution:** never trust the POST reply. Send an id with every write and
  confirm by reading it back with a GET. One project moved its whole answer
  channel onto GET for this reason; another followed the redirect by hand.
- **Status:** managed
- **Early warning:** any write path that decides success from the POST response.

### Pasting the repo copy over the live script took the system down
- **Seen in:** two projects
- **Symptom:** after "updating" the script, every request errors — in one case
  `getSheetByName` on null, killing all registrations for ten minutes.
- **Cause:** the repo copy deliberately holds blanks where the live script holds
  private ids. Replacing the whole file wiped them. A deploy guide in another
  project literally instructed "select all, delete, paste".
- **Resolution:** undo in the editor, redeploy the old version, then change only
  the intended lines. Keep ids in Script Properties, never in source.
- **Status:** managed
- **Early warning:** any instruction that says "replace the entire file".

### Saving the script changed nothing
- **Seen in:** two projects, independently
- **Symptom:** the fix is in the editor, but the live app behaves as before.
- **Cause:** a web app serves its *deployed version*, not the saved code.
- **Resolution:** Deploy -> Manage deployments -> edit -> **New version**.
- **Status:** managed
- **Early warning:** a fix that "should" be live but isn't.

### Redeploying broke the page that calls it
- **Seen in:** two projects
- **Symptom:** the page can no longer reach its script.
- **Cause:** a *new deployment* mints a new `/exec` URL. Updating the existing
  deployment keeps the id.
- **Resolution:** always edit the existing deployment. If the URL did change,
  update every caller before anything else.
- **Status:** managed
- **Early warning:** clicking "New deployment" instead of editing.

### Every response came back as an HTML error page
- **Seen in:** one project
- **Symptom:** clients choke parsing JSON; nothing in the script's own log.
- **Cause:** a helper called `setHeader` on a `ContentService` output, which does
  not exist. The throw turned every reply into Google's HTML error page.
- **Resolution:** remove the call; harden clients to detect non-JSON replies.
- **Status:** resolved
- **Early warning:** clients that assume every reply parses.

### A request died before the script ran, with a misleading error
- **Seen in:** one project
- **Symptom:** HTTP 400 from Google, zero executions logged. Blamed on Workspace
  policy for a day.
- **Cause:** Google's front end rejects any request carrying a parameter named
  `sid`, before your code sees it.
- **Resolution:** found by bisecting the payload field by field; renamed.
- **Status:** resolved
- **Early warning:** errors with no execution log — suspect the request shape,
  not your code.

### Page views exhausted the script's capacity
- **Seen in:** one project, and designed around in another
- **Symptom:** signups slow or fail under load.
- **Cause:** a script has a small shared pool of concurrent executions (~30).
  Public pages were reading through it on every view.
- **Resolution:** public pages read published feeds; the script is only for
  writes and fallbacks. High-traffic writers (tickets) get their own script.
- **Status:** resolved
- **Early warning:** a read path that calls the script once per visitor.

### The published feed showed old data
- **Seen in:** two projects
- **Symptom:** a cell was edited, the site still shows the old value; a check
  reports the edit failed when it had not.
- **Cause:** published TSV/CSV is edge-cached and propagates with a lag;
  cache-busting parameters do not reliably defeat it.
- **Resolution:** read twice, a minute apart, before concluding anything.
- **Status:** accepted — it is Google's behaviour
- **Early warning:** one read disagreeing with the source cell.

### A column quietly changed its format
- **Seen in:** two projects
- **Symptom:** dates shown as raw ISO timestamps; numbers turning into text.
- **Cause:** values written without an explicit format inherit the row's; a
  trigger writes a real Date while a script writes a string, and readers get
  both. Staff also rename headers and add trailing spaces.
- **Resolution:** write every value with its format; normalise on read; match
  headers trimmed and case-insensitive.
- **Status:** managed
- **Early warning:** the same column rendering two different ways.

### A partial write left two sheets disagreeing
- **Seen in:** one project
- **Symptom:** a record in one sheet with no partner in the other; retries made
  duplicates.
- **Cause:** a two-step write succeeded on the first sheet and failed on the
  second.
- **Resolution:** roll back the first write when the second fails; use a lock
  around multi-sheet writes.
- **Status:** resolved
- **Early warning:** any operation writing to more than one place.

### Scripts where a formula would do
- **Seen in:** stated as a law in two projects after repeated breakage
- **Cause:** scripts are the fragile part of a sheet; formulas are not.
- **Resolution:** formulas wherever they can do the job; scripts only for what
  formulas cannot (read, write, listen, react). Shade formula cells so nobody
  types over them.
- **Status:** managed
