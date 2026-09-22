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


if __name__ == "__main__":
    main()
