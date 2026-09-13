#!/usr/bin/env python3
"""
Build the print-ready event posters, in two shapes.

    python3 tools/build-event-posters.py            # both
    python3 tools/build-event-posters.py --only 1x2 # one

Reads the live schedule sheet (falling back to data/events.json when it cannot
be reached), lays the festival lockup and every event out in the poster
language — brick ground, halftone screen, cream type, gold accents — and
prints:

    assets/print/bali-in-bengaluru-events-1x2.pdf   500 x 1000 mm  (tall)
    assets/print/bali-in-bengaluru-events-2x1.pdf  1000 x  500 mm  (wide)

Print notes: 3 mm bleed is included on every edge and the artwork runs into
it, so the trim size is exactly 1:2 and 2:1. There are no crop marks —
give the printer the trim size below. Chrome writes RGB; if the press wants
CMYK, convert on their side or ask and this can output via a colour profile.

Re-run whenever the schedule changes. The PDF is a snapshot, not a live view.
"""
import argparse, base64, csv, io, json, os, re, shutil, subprocess, sys, tempfile
from html import escape
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
OUTDIR = ROOT / "assets" / "print"
BLEED = 3  # mm on every edge

SIZES = {
    # cols/thumb are tuned so every event lands on ONE sheet in each shape.
    "1x2": {"trim": (500, 1000), "cols": 1, "thumb": 36, "label": "500 x 1000 mm"},
    "2x1": {"trim": (1000, 500), "cols": 4, "thumb": 22, "label": "1000 x 500 mm"},
}


def find_chrome():
    env = os.environ.get("CHROME")
    cands = [env] if env else []
    cands += ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              "/Applications/Chromium.app/Contents/MacOS/Chromium",
              "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
              "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"]
    cands += [shutil.which(n) for n in
              ("google-chrome", "chromium", "chromium-browser", "microsoft-edge")]
    for c in cands:
        if c and Path(c).exists():
            return c
    sys.exit("No Chrome found. Install Chrome, or set CHROME=/path/to/chrome.")


def schedule_url():
    m = re.search(r'SCHEDULE_URL:\s*\n?\s*"([^"]+)"', (ROOT / "main.js").read_text())
    return m.group(1) if m else None


def from_sheet():
    """The sheet is the source of truth. Same header-by-name rule as the site."""
    url = schedule_url()
    if not url:
        return []
    try:
        raw = urlopen(url, timeout=30).read().decode("utf-8", "replace")
    except Exception:
        return []
    rows = list(csv.reader(io.StringIO(raw), delimiter="\t"))
    hi = next((i for i, r in enumerate(rows)
               if any(c.strip().lower() == "title" for c in r)), None)
    if hi is None:
        return []
    head = [c.strip().lower() for c in rows[hi]]
    out = []
    for r in rows[hi + 1:]:
        d = {h: (r[i].strip() if i < len(r) else "") for i, h in enumerate(head)}
        if not d.get("title"):
            continue
        out.append({
            "title": d.get("title", ""),
            "category": d.get("category", ""),
            "date": d.get("start date", ""),
            "end": d.get("end date", ""),
            "start": d.get("start time", ""),
            "finish": d.get("end time", ""),
            "venue": d.get("venue", ""),
            "image": d.get("image", ""),
            "status": d.get("status", "").lower(),
        })
    return out


def from_file():
    try:
        data = json.loads((ROOT / "data" / "events.json").read_text())
    except Exception:
        return []
    return [{"title": e.get("title", ""), "category": e.get("category", ""),
             "date": e.get("date", ""), "end": "", "start": e.get("time", ""),
             "finish": "", "venue": e.get("venue", ""), "image": e.get("image", ""),
             "status": ""} for e in data]


DRIVE = re.compile(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?[^\s]*id=)([A-Za-z0-9_-]{20,})")


def local_image(value):
    """Sheet images are Drive links; the site keeps optimised local copies."""
    if not value:
        return None
    m = DRIVE.search(value)
    if m:
        p = ROOT / "assets" / "drive" / (m.group(1) + ".jpg")
        return p if p.exists() else None
    p = ROOT / value.lstrip("/")
    return p if p.exists() and p.suffix.lower() in (".jpg", ".jpeg", ".png") else None


def thumb(path, px):
    """Inline the picture so the PDF carries its own artwork."""
    if not path:
        return ""
    out = Path(tempfile.gettempdir()) / f"poster-{px}-{path.stem}.jpg"
    if not out.exists():
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "78",
                        "-Z", str(px), str(path), "--out", str(out)],
                       check=True, capture_output=True)
    return "data:image/jpeg;base64," + base64.b64encode(out.read_bytes()).decode()


MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def parse_date(v):
    v = (v or "").strip()
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]{3,})\s*(\d{2,4})?$", v)
    if m:
        return int(m.group(1)), MONTHS.get(m.group(2)[:3].lower(), 0)
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", v)
    if m:
        return int(m.group(3)), int(m.group(2))
    m = re.match(r"^(\d{1,2})[/-](\d{1,2})", v)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None


def date_label(e):
    d, mo = parse_date(e["date"])
    if not d:
        return "Date to be announced", ""
    name = list(MONTHS)[mo - 1].title() if mo else ""
    d2, mo2 = parse_date(e["end"])
    if d2 and (d2, mo2) != (d, mo):
        n2 = list(MONTHS)[mo2 - 1].title() if mo2 else name
        return f"{d}&#8211;{d2}", f"{n2}"
    return str(d), name


def time_label(e):
    a, b = e["start"].strip(), e["finish"].strip()
    if a and b:
        return f"{a} &#8211; {b}"
    if a:
        return f"{a} onwards"
    return ""


def sort_key(e):
    d, mo = parse_date(e["date"])
    return (mo or 99, d or 99)


def logo_svg():
    s = (ROOT / "assets" / "logo.svg").read_text().strip()
    s = re.sub(r"<title[^>]*>.*?</title>", "", s)
    return s.replace('role="img" aria-labelledby="logo-title"', 'aria-hidden="true"')


def build_html(events, key):
    spec = SIZES[key]
    tw, th = spec["trim"]
    pw, ph = tw + BLEED * 2, th + BLEED * 2
    tall = key == "1x2"
    cols, tmm = spec["cols"], spec["thumb"]
    # One scale factor drives the whole sheet, so both shapes share a system.
    u = tw / 500       # 1 on the tall sheet, 2 on the wide one
    hu = u if tall else u * 0.62   # masthead + type run smaller on the wide sheet
    px = 900 if tall else 620

    cards = []
    for e in events:
        d, mon = date_label(e)
        img = thumb(local_image(e["image"]), px)
        pic = f'<img src="{img}" alt="">' if img else '<span class="noimg"></span>'
        t = time_label(e)
        meta = " &#183; ".join(x for x in (t, escape(e["venue"])) if x)
        cards.append(f"""
      <article class="ev">
        <div class="ev-pic">{pic}</div>
        <div class="ev-body">
          <p class="ev-date"><b>{d}</b><span>{mon}</span></p>
          <h2>{escape(e['title'])}</h2>
          <p class="ev-meta">{meta}</p>
        </div>
      </article>""")

    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&family=Instrument+Serif&display=swap" rel="stylesheet">
<style>
  @page {{ size: {pw}mm {ph}mm; margin: 0; }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; }}
  body {{
    width: {pw}mm; height: {ph}mm;
    background: radial-gradient(circle at center, rgba(27,29,33,.42) 42%, transparent 44%) 0 0 / {2.4*u}mm {2.4*u}mm, #A32B14;
    color: #EFE7D8; font-family: "Archivo", Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }}
  .sheet {{
    position: absolute; inset: {BLEED}mm; padding: {26*hu}mm {24*u}mm {18*hu}mm;
    display: flex; flex-direction: column; overflow: hidden;
  }}
  /* masthead */
  .top {{ display: flex; align-items: flex-start; justify-content: space-between; gap: {14*u}mm; }}
  .lock {{ background: #000; padding: {9*hu}mm {11*hu}mm; }}
  .lock svg {{ display: block; width: {132*hu}mm; height: auto; }}
  .logo-gold {{ fill: #E4AB0E; }} .logo-orange {{ fill: #FF5A3D; }} .logo-brown {{ fill: #B68367; }}
  .dates {{ text-align: right; }}
  .dates b {{
    display: block; font-weight: 800; text-transform: uppercase; letter-spacing: -.01em;
    font-size: {13*hu}mm; line-height: .95; color: #E4AB0E;
  }}
  .dates span {{
    display: block; margin-top: {2.5*u}mm; font-weight: 600; text-transform: uppercase;
    letter-spacing: {.9*u}mm; font-size: {4.4*u}mm; color: #EFE7D8;
  }}
  /* the block motif: three squares, fourth corner empty */
  .motif {{ display: grid; grid-template-columns: repeat(3, {7*u}mm); grid-template-rows: repeat(2, {7*u}mm);
            margin-top: {6*u}mm; margin-left: auto; width: max-content; }}
  .motif i {{ display: block; }}
  .m1 {{ grid-column: 2; grid-row: 1; background: #FF5A3C; }}
  .m2 {{ grid-column: 1; grid-row: 2; background: #E4AB0E; }}
  .m3 {{ grid-column: 3; grid-row: 2; background: #FF5A3C; }}

  .strap {{
    margin: {12*hu}mm 0 {9*hu}mm; font-family: "Instrument Serif", Georgia, serif;
    font-size: {6.4*hu}mm; line-height: 1.25; color: #F7E9CE; max-width: {200*u}mm;
  }}
  .rule {{ height: {.7*u}mm; background: rgba(239,231,216,.34); margin-bottom: {8*hu}mm; }}

  /* listing */
  .list {{ flex: 1; display: grid; grid-template-columns: repeat({cols}, 1fr);
           gap: {7*u}mm {10*u}mm; align-content: start; }}
  .ev {{ display: grid; grid-template-columns: {tmm*u}mm 1fr; gap: {7*u}mm; align-items: center;
         border-top: {.5*u}mm solid rgba(239,231,216,.28); padding-top: {6*u}mm; break-inside: avoid; }}
  .ev-pic {{ width: {tmm*u}mm; height: {tmm*u}mm; overflow: hidden; background: #8E2A12; }}
  .ev-pic img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
  .noimg {{ display: block; width: 100%; height: 100%; background: #8E2A12; }}
  .ev-body {{ min-width: 0; }}
  .ev-date {{ margin: 0 0 {1.6*u}mm; display: flex; align-items: baseline; gap: {2.2*u}mm; }}
  .ev-date b {{ font-weight: 800; font-size: {6.4*hu}mm; line-height: 1; color: #E4AB0E; }}
  .ev-date span {{ font-weight: 600; text-transform: uppercase; letter-spacing: {.6*u}mm;
                   font-size: {3.4*hu}mm; color: #F7E9CE; }}
  .ev h2 {{ margin: 0 0 {1.8*u}mm; font-weight: 800; text-transform: uppercase;
            font-size: {5.6*hu}mm; line-height: 1.02; letter-spacing: -.01em; color: #FFFFFF; }}
  .ev-meta {{ margin: 0; font-family: "Instrument Serif", Georgia, serif;
              font-size: {4.3*hu}mm; line-height: 1.3; color: #F7E9CE; }}

  footer {{ margin-top: {9*hu}mm; display: flex; align-items: flex-end; justify-content: space-between;
            gap: {10*u}mm; border-top: {.7*u}mm solid rgba(239,231,216,.34); padding-top: {6*hu}mm; }}
  footer p {{ margin: 0; font-size: {4.2*hu}mm; color: #F7E9CE; }}
  footer .url {{ font-weight: 800; text-transform: lowercase; font-size: {5.6*hu}mm; color: #E4AB0E; }}
</style></head><body>
  <div class="sheet">
    <div class="top">
      <div class="lock">{logo_svg()}</div>
      <div>
        <div class="dates"><b>1&#8211;18 Oct<br>2026</b><span>Bengaluru</span></div>
        <div class="motif"><i class="m1"></i><i class="m2"></i><i class="m3"></i></div>
      </div>
    </div>
    <p class="strap">Bringing Balinese traditions and conversation to Bengaluru, creating a
      cultural exchange that can be watched, heard, learnt and experienced.</p>
    <div class="rule"></div>
    <div class="list">{''.join(cards)}</div>
    <footer>
      <p>Param Foundation presents &#183; Sharing Stories, Connecting Cultures</p>
      <p class="url">bali-in-blr.paramfoundation.org</p>
    </footer>
  </div>
</body></html>"""


def render(events, key, chrome):
    spec = SIZES[key]
    out = OUTDIR / f"bali-in-bengaluru-events-{key}.pdf"
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as f:
        f.write(build_html(events, key))
        src = f.name
    OUTDIR.mkdir(parents=True, exist_ok=True)
    subprocess.run([chrome, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                    "--virtual-time-budget=20000", f"--print-to-pdf={out}", f"file://{src}"],
                   check=True, capture_output=True)
    os.unlink(src)
    print(f"  {out.relative_to(ROOT)}  {spec['label']} trim + {BLEED}mm bleed  "
          f"{out.stat().st_size//1024} KB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", choices=sorted(SIZES))
    args = ap.parse_args()

    events = from_sheet()
    src = "schedule sheet"
    if not events:
        events, src = from_file(), "data/events.json (sheet unreachable)"
    if not events:
        sys.exit("No events anywhere — nothing to print.")
    events.sort(key=sort_key)

    chrome = find_chrome()
    print(f"{len(events)} events from the {src}")
    for key in ([args.only] if args.only else sorted(SIZES)):
        render(events, key, chrome)


if __name__ == "__main__":
    main()
