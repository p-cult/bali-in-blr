#!/usr/bin/env python3
"""
Build the printable festival calendar — two editions.

    python3 tools/build-calendar-pdf.py            # both editions
    python3 tools/build-calendar-pdf.py public     # only the public one
    python3 tools/build-calendar-pdf.py internal   # only the internal one

Reads data/events.json (refresh it first with tools/sync-events-fallback.py),
lays it out for A4 paper, and prints with headless Chrome:
  assets/bali-in-bengaluru-calendar.pdf  — public: linked from the site, so
                                            events marked "not public" are left out
  plan/calendar-a4.pdf                    — internal A4 list: every event, not-public
                                            ones tagged. (The poster-style internal
                                            calendar at plan/calendar.pdf comes from
                                            tools/build-event-posters.py --internal.)
A multi-day event appears on every date it runs, so no date is missed.

Print uses the cream side of the palette: paper ground, charcoal type and
the oxidised copper, because the lit copper drops to 2.73 on cream and
cannot be read. Re-run this whenever the calendar changes — the PDF is a
snapshot, not a live view.
"""
import base64, json, re, shutil, subprocess, sys, tempfile, os
from datetime import datetime, timedelta
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_PUBLIC = ROOT / "assets" / "bali-in-bengaluru-calendar.pdf"
OUT_INTERNAL = ROOT / "plan" / "calendar-a4.pdf"
NOT_PUBLIC = re.compile(r"^(internal|private|invite|invite only|invitation|invitation only|closed|not public|not open|no button)$", re.I)


def find_chrome():
    """Locate a headless-capable Chrome. The project moves between machines on
    an external drive, so the browser is looked up rather than assumed; set
    CHROME to override."""
    env = os.environ.get("CHROME")
    candidates = [env] if env else []
    candidates += [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ]
    candidates += [shutil.which(n) for n in
                   ("google-chrome", "chromium", "chromium-browser", "microsoft-edge")]
    for c in candidates:
        if c and Path(c).exists():
            return c
    sys.exit("No Chrome found. Install Google Chrome, or set CHROME to its "
             "executable:\n  CHROME=/path/to/chrome python3 tools/build-calendar-pdf.py")


CHROME = find_chrome()

MONTHS = ["January","February","March","April","May","June",
          "July","August","September","October","November","December"]

def minutes(t):
    """Sort key for a free-text time. "7.30pm" must not sort before "9.00am",
    which is what comparing the strings did."""
    t = (t or "").strip().lower()
    m = re.search(r"(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)", t)
    if m:
        h, mm, ap = int(m.group(1)), int(m.group(2) or 0), m.group(3)
        if ap == "pm" and h != 12: h += 12
        if ap == "am" and h == 12: h = 0
        return h * 60 + mm
    if "morning" in t: return 9 * 60
    if "daytime" in t or "full day" in t: return 10 * 60
    if "evening" in t or "night" in t: return 18 * 60
    return 12 * 60          # unknown: between the two

def load(internal):
    """Every event from the fallback file, one entry per date it runs, with
    the venue's area from data/venues.json. The public edition drops events
    whose status says they are not open to the public (same rule as main.js)."""
    events = json.loads((ROOT / "data" / "events.json").read_text())
    venues = json.loads((ROOT / "data" / "venues.json").read_text())["venues"]
    def norm(x):
        return re.sub(r"[^a-z0-9]+", " ", (x or "").lower()).strip()
    def area(name):
        n = norm(name)
        for v in venues:
            if norm(v["name"]) == n or n in [norm(a) for a in v.get("aliases", [])]:
                return v.get("area", "")
        for v in venues:
            head = norm(v["name"]).split(" ")[0]
            if n and (n in norm(v["name"]) or norm(v["name"]) in n or (len(head) > 4 and n.startswith(head))):
                return v.get("area", "")
        return ""
    out = []
    for e in events:
        e = dict(e)
        e["notPublic"] = bool(NOT_PUBLIC.match((e.get("statusRaw") or "").strip()))
        if e["notPublic"] and not internal:
            continue
        e["area"] = area(e.get("venue"))
        start, end = e.get("date") or "", e.get("endDate") or ""
        if start and end and end > start:
            a, b = datetime.strptime(start, "%Y-%m-%d"), datetime.strptime(end, "%Y-%m-%d")
            n = (b - a).days + 1
            for i in range(n):
                d = a + timedelta(days=i)
                x = dict(e); x["date"] = d.strftime("%Y-%m-%d")
                x["dayOf"] = f"Day {i + 1} of {n}"
                x["runs"] = f"{a.day}–{b.day} {MONTHS[a.month - 1][:3]}"
                out.append(x)
        else:
            out.append(e)
    return sorted(out, key=lambda e: (e.get("date") or "9999-99-99",
                                      minutes(e.get("time")),
                                      e.get("title") or ""))

def day_label(iso):
    if not iso:
        return ("--", "TBA", "")
    d = datetime.strptime(iso[:10], "%Y-%m-%d")
    return (f"{d.day:02d}", MONTHS[d.month - 1][:3].upper(), d.strftime("%A"))

def span(events):
    dates = sorted(e["date"] for e in events if e.get("date"))
    if not dates:
        return "Dates to be announced"
    a = datetime.strptime(dates[0], "%Y-%m-%d")
    b = datetime.strptime(dates[-1], "%Y-%m-%d")
    if (a.month, a.year) == (b.month, b.year):
        return f"{a.day}–{b.day} {MONTHS[a.month-1]} {a.year}"
    return f"{a.day} {MONTHS[a.month-1]} – {b.day} {MONTHS[b.month-1]} {b.year}"

def rows(events):
    out, last = [], None
    for e in events:
        day, mon, weekday = day_label(e.get("date"))
        new_day = e.get("date") != last
        last = e.get("date")
        where = e.get("venue") or ""
        if e.get("area"):
            where += f" · {e['area']}"
        when = e.get("time") or "Time to be announced"
        if e.get("dayOf"):
            when = f"{when} · {e['dayOf']} ({e['runs']})"
        meta = f"<b>{escape(when)}</b><br>{escape(where)}"
        img = thumbnail(e.get("image", ""))
        cats = f'<span class="c">{escape(e.get("category",""))}</span>'
        if e.get("collab"):
            cats += '<span class="c collab">Collaboration</span>'
        if e.get("notPublic"):
            cats += '<span class="c private">Not public</span>'
        elif (e.get("statusRaw") or "").strip(" -–—"):
            cats += f'<span class="c status">{escape(e["statusRaw"])}</span>'
        out.append(f"""
      <article class="row{' newday' if new_day else ''}">
        <div class="pic">{'<img src="'+img+'" alt="">' if img else ''}</div>
        <div class="when">{'<span class="d">'+day+'</span><span class="m">'+mon+'</span><span class="w">'+escape(weekday[:3])+'</span>' if new_day else ''}</div>
        <div class="what">
          <p class="title">{escape(e.get('title',''))}</p>
          <p class="meta">{meta}</p>
          <p class="cats">{cats}</p>
        </div>
      </article>""")
    return "".join(out)

def thumbnail(rel):
    """Downscale to a print-sized thumb and inline it, so the PDF carries its
    own pictures rather than depending on the repository."""
    src = ROOT / rel
    if not rel or not src.exists():
        return ""
    out = Path(tempfile.gettempdir()) / ("cal-" + src.stem + ".jpg")
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "62",
                    "-Z", "320", str(src), "--out", str(out)],
                   check=True, capture_output=True)
    return "data:image/jpeg;base64," + base64.b64encode(out.read_bytes()).decode()

def build_html(events, internal):
    counts = {}
    seen = set()
    for e in events:
        key = e.get("id") or e.get("title")
        if key in seen: continue
        seen.add(key)
        counts[e.get("category", "")] = counts.get(e.get("category", ""), 0) + 1
    summary = " · ".join(f"{v} {k.lower()}{'s' if v != 1 else ''}" for k, v in sorted(counts.items()))
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;900&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  @page {{ size: A4; margin: 18mm 17mm; }}
  * {{ box-sizing: border-box; }}
  html {{ background:#EFE7D8; }}
  body {{ margin:0; font-family:"Instrument Sans",-apple-system,sans-serif; color:#1B1D21;
          font-size:9.4pt; line-height:1.45; -webkit-print-color-adjust:exact; print-color-adjust:exact; }}

  header {{ border-bottom:1.5pt solid #8E4A24; padding-bottom:9pt; margin-bottom:4pt; }}
  .eyebrow {{ font-family:"Archivo",sans-serif; font-weight:700;
              font-size:6.6pt; letter-spacing:.16em; text-transform:uppercase; color:#8E4A24; margin:0 0 5pt; }}
  h1 {{ font-family:"Archivo",sans-serif; font-weight:900;
        text-transform:uppercase; font-size:24pt; line-height:.94; margin:0 0 6pt; letter-spacing:-.01em; }}
  .sub {{ margin:0; font-size:9pt; color:#5F574C; }}

  /* two columns of events on a single sheet */
  .list {{ column-count:2; column-gap:22pt; margin-top:4pt; }}
  .row {{ display:grid; grid-template-columns:48pt 34pt 1fr; gap:11pt;
          align-items:center; padding:8pt 0; border-top:.4pt solid rgba(27,29,33,.12);
          break-inside:avoid; }}
  .row.newday {{ border-top:.8pt solid rgba(142,74,36,.55); }}
  .pic {{ width:48pt; height:36pt; overflow:hidden; background:#E2D8C6; }}
  .pic img {{ width:100%; height:100%; object-fit:cover; display:block; }}
  .when {{ text-align:center; }}
  .d {{ display:block; font-family:"Archivo",sans-serif;
        font-weight:900; font-size:15pt; line-height:1; }}
  .m {{ display:block; font-family:"Archivo",sans-serif;
        font-weight:700; font-size:6.2pt; letter-spacing:.12em; color:#8E4A24; margin-top:2pt; }}
  .w {{ display:block; font-size:6.2pt; color:#7A7066; margin-top:1.5pt; }}
  .title {{  font-family:"Archivo",sans-serif; font-weight:700;
            text-transform:uppercase; font-size:8.4pt; margin:0 0 3pt; line-height:1.15; }}
  .meta {{ margin:0 0 4.5pt; color:#5F574C; font-size:7.4pt; }}
  .cats {{ margin:0; }}
  .c {{ display:inline-block; font-family:"Archivo",sans-serif;
        font-weight:700; font-size:6pt; letter-spacing:.1em; text-transform:uppercase;
        padding:1.8pt 4pt; margin:0 3pt 0 0; border:.5pt solid rgba(27,29,33,.32); color:#5F574C; }}
  .c.collab {{ border-color:#8E4A24; color:#8E4A24; }}
  .c.private {{ border-color:#A3261A; color:#A3261A; }}
  .c.status {{ border-color:#3F5F38; color:#3F5F38; }}
  .meta b {{ color:#1B1D21; font-weight:600; }}
  .edition {{ font-family:"Archivo",sans-serif; font-weight:700; font-size:6.4pt; letter-spacing:.14em; text-transform:uppercase;
              color:#A3261A; border:.6pt solid #A3261A; padding:2pt 5pt; margin-left:8pt; vertical-align:middle; }}

  footer {{ margin-top:16pt; padding-top:9pt; border-top:.8pt solid rgba(142,74,36,.55);
            display:flex; justify-content:space-between; font-size:7.4pt; color:#7A7066; }}
  footer b {{ color:#1B1D21; font-weight:600; }}
</style></head><body>
  <header>
    <p class="eyebrow">Param Foundation presents</p>
    <h1>Bali in Bengaluru{' <span class="edition">Internal · every event</span>' if internal else ''}</h1>
    <p class="sub">{span(events)} &nbsp;·&nbsp; {len({e.get('id') or e.get('title') for e in events})} events over {len({e.get('date') for e in events})} days &nbsp;·&nbsp; {summary}</p>
  </header>
  <div class="list">{rows(events)}</div>
  <footer>
    <span>Dates confirmed at the time of printing. Tickets and updates: <b>bali-in-blr.paramfoundation.org</b></span>
    <span>Printed {datetime.now().strftime('%d %b %Y')}</span>
  </footer>
</body></html>"""

def render(internal):
    events = load(internal)
    if not events:
        sys.exit("No events in data/events.json — nothing to print.")
    out = OUT_INTERNAL if internal else OUT_PUBLIC
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(build_html(events, internal))
        src = f.name
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    "--virtual-time-budget=8000",
                    f"--print-to-pdf={out}", f"file://{src}"],
                   check=True, capture_output=True)
    os.unlink(src)
    print(f"{out.relative_to(ROOT)} — {len(events)} entries, {out.stat().st_size//1024} KB")

def main():
    which = (sys.argv[1] if len(sys.argv) > 1 else "both").lower()
    if which in ("both", "public"): render(False)
    if which in ("both", "internal"): render(True)

if __name__ == "__main__":
    main()
