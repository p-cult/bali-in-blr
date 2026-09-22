#!/usr/bin/env python3
"""
Rewrite data/events.json from the live schedule sheet.

    python3 tools/sync-events-fallback.py

The site reads the sheet on every page load; data/events.json is only the
fallback for when the sheet cannot be reached. A fallback that has drifted from
the sheet is worse than useless — it shows a different festival on a bad
connection. Run this whenever the sheet changes, then commit the file.

Each entry carries two shapes at once:
  - the keys main.js builds from the sheet (startDate, startTime, statusRaw…),
    so a fallback render matches a live one;
  - the older keys (date as ISO, time, collab, image as a local path) that
    tools/build-calendar-pdf.py and tools/build-event-posters.py read.
"""
import csv, io, json, re, sys
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "events.json"
MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
DRIVE = re.compile(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?[^\s]*id=)([A-Za-z0-9_-]{20,})")


def schedule_url():
    m = re.search(r'SCHEDULE_URL:\s*\n?\s*"([^"]+)"', (ROOT / "main.js").read_text())
    if not m:
        sys.exit("No SCHEDULE_URL in main.js.")
    return m.group(1)


def iso(v):
    v = (v or "").strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", v)
    if m:
        return v
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]{3,})\s*(\d{2,4})?$", v)
    if m:
        y = m.group(3) or "2026"
        y = ("20" + y) if len(y) == 2 else y
        return f"{y}-{MONTHS[m.group(2)[:3].lower()]:02d}-{int(m.group(1)):02d}"
    return ""


def local_image(v):
    """Point at the optimised on-site copy, which both the site and the PDF
    tools can use; keep any other value as the sheet has it."""
    m = DRIVE.search(v or "")
    if m:
        p = f"assets/drive/{m.group(1)}.jpg"
        return p if (ROOT / p).exists() else v
    return (v or "").strip()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    raw = urlopen(schedule_url(), timeout=30).read().decode("utf-8", "replace")
    rows = list(csv.reader(io.StringIO(raw), delimiter="\t"))
    hi = next((i for i, r in enumerate(rows)
               if any(c.strip().lower() == "title" for c in r)), None)
    if hi is None:
        sys.exit("No header row with 'title' in the sheet — refusing to overwrite the fallback.")
    head = [c.strip().lower() for c in rows[hi]]

    out = []
    for r in rows[hi + 1:]:
        d = {h: (r[i].strip() if i < len(r) else "") for i, h in enumerate(head)}
        title = d.get("title", "")
        if not title:
            continue
        start, end = iso(d.get("start date")), iso(d.get("end date"))
        st, et = d.get("start time", ""), d.get("end time", "")
        time = f"{st} – {et}" if st and et else st
        collab = d.get("collaboration", "").lower() in ("yes", "y", "true", "1")
        out.append({
            "id": slug(title) + ("-" + start if start else ""),
            "title": title,
            "category": d.get("category", ""),
            "collaboration": d.get("collaboration", ""),
            "collab": collab,
            "startDate": start, "endDate": end, "date": start,
            "startTime": st, "endTime": et, "time": time,
            "venue": d.get("venue", ""),
            "mapUrl": d.get("map link", ""),
            "description": d.get("description", ""),
            "image": local_image(d.get("image", "")),
            "ticketUrl": d.get("ticket link", ""),
            "passInfo": d.get("pass info", ""),
            "rsvpUrl": d.get("rsvp link", ""),
            "capacity": d.get("capacity", ""),
            "seatsLeft": d.get("seats left", ""),
            "showSeats": d.get("show seats", ""),
            "status": d.get("status", ""),
            "statusRaw": d.get("status", ""),
        })

    if not out:
        sys.exit("The sheet returned no events — refusing to overwrite the fallback.")
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n")
    days = sorted(e["date"] for e in out if e["date"])
    print(f"data/events.json <- {len(out)} events, {days[0]} to {days[-1]}")
    write_hero_fallback(out)
    write_sitemap(out)


# Mirrors ev.notPublic in main.js — keep the two lists identical.
NOT_PUBLIC = re.compile(r"^(internal|private|invite|invite only|invitation|invitation only|closed|not public|not open|no button)$", re.I)


def write_hero_fallback(events):
    """The hero's numbers are computed live by main.js; the figures typed in
    index.html only show while the sheet is loading or unreachable. Keep them
    equal to what the page would compute: public events, their span, their
    distinct venues."""
    pub = [e for e in events if not NOT_PUBLIC.match(e["statusRaw"].strip())]
    dates = [d for e in pub for d in (e["startDate"], e["endDate"]) if d]
    if not dates:
        return
    d0, d1 = min(dates), max(dates)
    from datetime import date
    span = (date.fromisoformat(d1) - date.fromisoformat(d0)).days + 1
    venues = {e["venue"].strip().lower() for e in pub if e["venue"].strip()}
    idx = ROOT / "index.html"
    html = idx.read_text()
    changed = html
    for key, val in (("days", span), ("events", len(pub)), ("venues", len(venues))):
        changed = re.sub(rf'(data-stat="{key}">)\d+(<)', rf"\g<1>{val}\2", changed)
    if changed != html:
        idx.write_text(changed)
        print(f"index.html hero fallback <- {span} days, {len(pub)} events, {len(venues)} venues")


def write_sitemap(events):
    """Every public event has a page at event/?e=<slug>; list them so they can
    be found. Slugs follow main.js's assignSlugs: the title, with the date
    appended when two events share a title."""
    site = "https://bali-in-blr.paramfoundation.org/"
    seen, urls = {}, []
    for e in events:
        if NOT_PUBLIC.match(e["statusRaw"].strip()):
            continue
        base = slug(e["title"]) or e["id"]
        s = base + ("-" + slug(e["startDate"]) if seen.get(base) else "")
        seen[base] = seen.get(base, 0) + 1
        urls.append(f"{site}event/?e={s}")
    entry = lambda loc, freq, pri: f"  <url>\n    <loc>{loc}</loc>\n    <changefreq>{freq}</changefreq>\n    <priority>{pri}</priority>\n  </url>"
    body = [entry(site, "weekly", "1.0"), entry(site + "privacy.html", "yearly", "0.3")]
    body += [entry(u, "weekly", "0.8") for u in urls]
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(body) + "\n</urlset>\n"
    sm = ROOT / "sitemap.xml"
    if sm.read_text() != xml:
        sm.write_text(xml)
        print(f"sitemap.xml <- {len(urls)} event pages")


if __name__ == "__main__":
    main()
