#!/usr/bin/env python3
"""
Build the printable festival calendar.

    python3 tools/build-calendar-pdf.py

Reads data/events.json, lays it out for A4 paper, and prints it to
assets/bali-in-bengaluru-calendar.pdf with headless Chrome.

Print uses the cream side of the palette: paper ground, charcoal type and
the oxidised copper, because the lit copper drops to 2.73 on cream and
cannot be read. Re-run this whenever the calendar changes — the PDF is a
snapshot, not a live view.
"""
import base64, json, re, subprocess, sys, tempfile, os
from datetime import datetime
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "bali-in-bengaluru-calendar.pdf"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

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

def load():
    events = json.loads((ROOT / "data" / "events.json").read_text())
    return sorted(events, key=lambda e: (e.get("date") or "9999-99-99",
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
        meta = " · ".join(x for x in (e.get("time"), e.get("venue")) if x)
        img = thumbnail(e.get("image", ""))
        cats = f'<span class="c">{escape(e.get("category",""))}</span>'
        if e.get("collab"):
            cats += '<span class="c collab">Collaboration</span>'
        out.append(f"""
      <article class="row{' newday' if new_day else ''}">
        <div class="pic">{'<img src="'+img+'" alt="">' if img else ''}</div>
        <div class="when">{'<span class="d">'+day+'</span><span class="m">'+mon+'</span><span class="w">'+escape(weekday[:3])+'</span>' if new_day else ''}</div>
        <div class="what">
          <p class="title">{escape(e.get('title',''))}</p>
          <p class="meta">{escape(meta)}</p>
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

def build_html(events):
    counts = {}
    for e in events:
        counts[e.get("category", "")] = counts.get(e.get("category", ""), 0) + 1
    summary = " · ".join(f"{v} {k.lower()}{'s' if v != 1 else ''}" for k, v in sorted(counts.items()))
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,600;125,700;125,900&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  @page {{ size: A4; margin: 18mm 17mm; }}
  * {{ box-sizing: border-box; }}
  html {{ background:#EFE7D8; }}
  body {{ margin:0; font-family:"Instrument Sans",-apple-system,sans-serif; color:#1B1D21;
          font-size:9.4pt; line-height:1.45; -webkit-print-color-adjust:exact; print-color-adjust:exact; }}

  header {{ border-bottom:1.5pt solid #8E4A24; padding-bottom:9pt; margin-bottom:4pt; }}
  .eyebrow {{ font-family:"Archivo",sans-serif; font-variation-settings:"wdth" 125; font-weight:700;
              font-size:6.6pt; letter-spacing:.16em; text-transform:uppercase; color:#8E4A24; margin:0 0 5pt; }}
  h1 {{ font-family:"Archivo",sans-serif; font-variation-settings:"wdth" 125; font-weight:900;
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
  .d {{ display:block; font-family:"Archivo",sans-serif; font-variation-settings:"wdth" 125;
        font-weight:900; font-size:15pt; line-height:1; }}
  .m {{ display:block; font-family:"Archivo",sans-serif; font-variation-settings:"wdth" 125;
        font-weight:700; font-size:6.2pt; letter-spacing:.12em; color:#8E4A24; margin-top:2pt; }}
  .w {{ display:block; font-size:6.2pt; color:#7A7066; margin-top:1.5pt; }}
  .title {{  font-family:"Archivo",sans-serif; font-variation-settings:"wdth" 125; font-weight:700;
            text-transform:uppercase; font-size:8.4pt; margin:0 0 3pt; line-height:1.15; }}
  .meta {{ margin:0 0 4.5pt; color:#5F574C; font-size:7.4pt; }}
  .cats {{ margin:0; }}
  .c {{ display:inline-block; font-family:"Archivo",sans-serif; font-variation-settings:"wdth" 125;
        font-weight:700; font-size:6pt; letter-spacing:.1em; text-transform:uppercase;
        padding:1.8pt 4pt; margin:0 3pt 0 0; border:.5pt solid rgba(27,29,33,.32); color:#5F574C; }}
  .c.collab {{ border-color:#8E4A24; color:#8E4A24; }}

  footer {{ margin-top:16pt; padding-top:9pt; border-top:.8pt solid rgba(142,74,36,.55);
            display:flex; justify-content:space-between; font-size:7.4pt; color:#7A7066; }}
  footer b {{ color:#1B1D21; font-weight:600; }}
</style></head><body>
  <header>
    <p class="eyebrow">Param Foundation presents</p>
    <h1>Bali in Bengaluru</h1>
    <p class="sub">{span(events)} &nbsp;·&nbsp; {len(events)} events &nbsp;·&nbsp; {summary}</p>
  </header>
  <div class="list">{rows(events)}</div>
  <footer>
    <span>Dates confirmed at the time of printing. Tickets and updates: <b>bali-in-blr.paramfoundation.org</b></span>
    <span>Printed {datetime.now().strftime('%d %b %Y')}</span>
  </footer>
</body></html>"""

def main():
    events = load()
    if not events:
        sys.exit("No events in data/events.json — nothing to print.")
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(build_html(events))
        src = f.name
    OUT.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    "--virtual-time-budget=8000",
                    f"--print-to-pdf={OUT}", f"file://{src}"],
                   check=True, capture_output=True)
    os.unlink(src)
    print(f"{OUT.relative_to(ROOT)} — {len(events)} events, {OUT.stat().st_size//1024} KB")

if __name__ == "__main__":
    main()
