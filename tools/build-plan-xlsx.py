#!/usr/bin/env python3
"""Build the artist tour plan as an Excel workbook.

    python3 tools/build-plan-xlsx.py plan/tour-plan-<stay>.json plan/tour-plan-<stay>.xlsx

The JSON is the plan as the public page computed it (saved by
tools/render-plan-pdf.mjs from window.LogisticsPlan). Tabs: Summary (the
whole tour, one row per day), one tab per day (the timeline), Stay, and
Vehicles. Styled like the print edition: cream, dark show bands, gold
instrument-vehicle rows. Needs openpyxl.
"""
import json
import sys
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

INK, MUTED, COPPER, GOLD_BG, CREAM, LINE, WHITE = "1B1D21", "666666", "8E4A24", "F6ECD0", "F7F3EA", "D9D4C8", "FFFFFF"
RED, AMBER = "A3261A", "6B4A00"
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def hm(m):
    if m is None:
        return "—"
    m = int(round(m)); suffix = ""
    if m >= 1440:
        m -= 1440; suffix = " (+1)"
    if m < 0:
        m += 1440; suffix = " (−1)"
    h, mm = divmod(m, 60)
    ap = "am" if h < 12 else "pm"
    h12 = 12 if h % 12 == 0 else h % 12
    return f"{h12}.{mm:02d}{ap}{suffix}"


def dur(m):
    if not m:
        return "—"
    m = int(round(m)); h, mm = divmod(m, 60)
    return f"{h} h {mm:02d}" if h else f"{mm} min"


def day_label(iso):
    d = date.fromisoformat(iso)
    return f"{DAYS[d.weekday()]}, {d.day} {MONTHS[d.month - 1]}"


def tab_name(iso):
    d = date.fromisoformat(iso)
    return f"{d.day:02d} {MONTHS[d.month - 1]}"


thin = Side(style="thin", color=LINE)
BORDER = Border(bottom=thin)
F_TITLE = Font(name="Arial", size=18, bold=True, color=INK)
F_KICK = Font(name="Arial", size=9, bold=True, color=COPPER)
F_SUB = Font(name="Arial", size=10, color=MUTED)
F_HEAD = Font(name="Arial", size=9, bold=True, color=WHITE)
F_BODY = Font(name="Arial", size=10, color=INK)
F_BOLD = Font(name="Arial", size=10, bold=True, color=INK)
F_MUTED = Font(name="Arial", size=9, color=MUTED)
F_TIME = Font(name="Arial", size=10, color=COPPER)
F_SHOW = Font(name="Arial", size=11, bold=True, color=WHITE)
F_SHOW_SUB = Font(name="Arial", size=9, color="D5D0C5")
F_TRUCK = Font(name="Arial", size=10, bold=True, color="8A6508")
F_MEAL = Font(name="Arial", size=10, bold=True, color=COPPER)
F_RED = Font(name="Arial", size=9, color=RED)
F_AMBER = Font(name="Arial", size=9, color=AMBER)
FILL_HEAD = PatternFill("solid", fgColor=INK)
FILL_SHOW = PatternFill("solid", fgColor=INK)
FILL_TRUCK = PatternFill("solid", fgColor=GOLD_BG)
FILL_CREAM = PatternFill("solid", fgColor=CREAM)
WRAP = Alignment(wrap_text=True, vertical="top")
TOP = Alignment(vertical="top")


def header_row(ws, row, labels, widths=None):
    for i, label in enumerate(labels, 1):
        c = ws.cell(row=row, column=i, value=label)
        c.font = F_HEAD; c.fill = FILL_HEAD; c.alignment = Alignment(vertical="center")
    if widths:
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[row].height = 20


def title_block(ws, title, sub):
    ws["A1"] = "BALI IN BENGALURU · ARTIST TOUR PLAN"; ws["A1"].font = F_KICK
    ws["A2"] = title; ws["A2"].font = F_TITLE
    ws["A3"] = sub; ws["A3"].font = F_SUB
    ws.row_dimensions[2].height = 28


def build(plan, out):
    wb = Workbook()
    stay = plan.get("stay") or {}
    party = plan.get("party") or {}
    t = plan.get("totals") or {}
    days = plan.get("days") or []
    who = f"{party.get('artists', '—')} artists + {party.get('volunteers', 0)} volunteers"
    veh0 = (party.get("vehicles") or [{}])[0]
    fleet = f"{veh0.get('count', 1)} × {veh0.get('name', 'vehicle')}"

    # ---- Summary
    ws = wb.active; ws.title = "Summary"
    ws.sheet_view.showGridLines = False
    span = f"{day_label(days[0]['date'])} – {day_label(days[-1]['date'])}" if days else ""
    title_block(ws, "Day by day", f"{party.get('label', 'Artist group')} · {who} · staying at {stay.get('name', '—')} · {len(days)} days, {span}")
    ws["A5"] = "Travelling"; ws["A5"].font = F_MUTED
    ws["B5"] = f"{who} · {fleet}"; ws["B5"].font = F_BOLD
    ws["A6"] = "On the road"; ws["A6"].font = F_MUTED
    ws["B6"] = f"{dur(t.get('travelMin'))} over {t.get('showDays', 0)} show days · {round(t.get('km', 0))} km · instrument vehicle separately: " + (f"{round(t.get('truckKm', 0))} km" if t.get("truckKnown") else "counted once its storage place is set"); ws["B6"].font = F_BOLD
    flags = []
    if t.get("redDays"): flags.append(f"{t['redDays']} red-flag day(s)")
    if t.get("earlyCalls"): flags.append(f"{t['earlyCalls']} early call(s) from {hm(t.get('earliestWake'))}")
    if (t.get("latestSleep") or 0) > 1440: flags.append(f"late night · lights out {hm(t['latestSleep'])}")
    if t.get("holdsInTown"): flags.append(f"{t['holdsInTown']} hold(s) in town")
    ws["A7"] = "Needs a look"; ws["A7"].font = F_MUTED
    ws["B7"] = " · ".join(flags) if flags else "nothing to flag"; ws["B7"].font = Font(name="Arial", size=10, color=AMBER if flags else "2F5F2A", bold=True)
    for r in (5, 6, 7):
        ws.row_dimensions[r].height = 18

    header_row(ws, 9, ["Date", "Kind", "Events", "Artists", "Vehicle", "Leave", "Back", "On the road", "km", "Notes / flags"],
               [14, 14, 44, 9, 22, 11, 13, 12, 8, 60])
    ws.freeze_panes = "A10"
    r = 10
    for d in days:
        kind = {"rest": "Rest day", "outstation": "Out of town"}.get(d.get("kind"), "Show day")
        if d.get("nightOut") or any(b.get("type") == "leg" and "overnight" in (b.get("label") or "").lower() for b in d["blocks"]):
            pass
        evs = "; ".join(f"{e['title']}" + (f" {hm(e['start'])}" if e.get("start") is not None else "") for e in d.get("events", []))
        vehicle = "" if d.get("kind") == "rest" else (f"{d['vehicles']} × " if (d.get("vehicles") or 1) > 1 else "") + (d.get("vehicle") or "")
        row = [day_label(d["date"]), kind, evs, d.get("travelling") if d.get("kind") != "rest" else "", vehicle,
               hm(d.get("leave")) if d.get("kind") != "rest" else "", hm(d.get("back")) if d.get("kind") != "rest" and d.get("back") is not None else ("night drive" if d.get("kind") == "outstation" else ""),
               dur(d.get("travelMin")), round(d.get("km") or 0), " · ".join(d.get("flags") or [])]
        for i, v in enumerate(row, 1):
            c = ws.cell(row=r, column=i, value=v); c.font = F_BODY; c.alignment = WRAP; c.border = BORDER
        ws.cell(row=r, column=1).font = F_BOLD
        if d.get("red"):
            ws.cell(row=r, column=10).font = F_RED
        elif d.get("flags"):
            ws.cell(row=r, column=10).font = F_AMBER
        if d.get("kind") == "rest":
            for i in range(1, 11): ws.cell(row=r, column=i).font = F_MUTED
        r += 1
    ws.cell(row=r + 1, column=1, value="Times come from the festival schedule and expected Bengaluru traffic; a planning guide, not a promise. Built by Param Foundation | Culture.").font = F_MUTED

    # ---- One tab per day
    for d in days:
        ws = wb.create_sheet(tab_name(d["date"]))
        ws.sheet_view.showGridLines = False
        evs = " · ".join(f"{e['title']}" + (f" {hm(e['start'])}" if e.get("start") is not None else "") for e in d.get("events", []))
        title_block(ws, day_label(d["date"]), evs or ("Rest day · no travel" if d.get("kind") == "rest" else ""))
        r = 4
        for f in d.get("flags") or []:
            c = ws.cell(row=r, column=1, value="• " + f); c.font = F_RED if d.get("red") else F_AMBER; ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=4); r += 1
        r += 1
        header_row(ws, r, ["From", "To", "What", "Detail"], [12, 12, 52, 70]); ws.freeze_panes = f"A{r + 1}"
        r += 1
        for b in d.get("blocks") or []:
            typ = b.get("type")
            what = b.get("label") or ""
            detail = b.get("detail") or ""
            if typ == "show":
                bits = [x for x in [b.get("category"), b.get("venue")] if x]
                if b.get("artists") is not None or b.get("cast"):
                    bits.append(" · ".join(x for x in [f"{b['artists']} artists" if b.get("artists") is not None else "", b.get("cast") or ""] if x))
                detail = " · ".join(bits)
            if b.get("note"):
                detail = (detail + " · " if detail else "") + b["note"]
            if typ == "leg":
                what = "→ " + what
            if typ == "truck":
                what = ("🚚 " if b.get("dir") != "back" else "🚚 ") + what
            cells = [hm(b.get("from")), hm(b.get("to")) if b.get("to") is not None else "", what, detail]
            for i, v in enumerate(cells, 1):
                c = ws.cell(row=r, column=i, value=v); c.font = F_BODY; c.alignment = WRAP; c.border = BORDER
            ws.cell(row=r, column=1).font = F_TIME; ws.cell(row=r, column=2).font = F_TIME
            ws.cell(row=r, column=3).font = F_BOLD
            ws.cell(row=r, column=4).font = F_MUTED
            if typ == "show":
                for i in range(1, 5):
                    ws.cell(row=r, column=i).fill = FILL_SHOW
                ws.cell(row=r, column=1).font = Font(name="Arial", size=10, color="F3E9D2"); ws.cell(row=r, column=2).font = Font(name="Arial", size=10, color="F3E9D2")
                ws.cell(row=r, column=3).font = F_SHOW; ws.cell(row=r, column=3).value = what.upper()
                ws.cell(row=r, column=4).font = F_SHOW_SUB
                ws.row_dimensions[r].height = 24
            elif typ == "truck":
                for i in range(1, 5):
                    ws.cell(row=r, column=i).fill = FILL_TRUCK
                ws.cell(row=r, column=3).font = F_TRUCK
            elif b.get("meal"):
                ws.cell(row=r, column=3).font = F_MEAL
            elif b.get("broad"):
                ws.cell(row=r, column=3).font = Font(name="Arial", size=10, color=MUTED)
            r += 1

    # ---- Stay
    ws = wb.create_sheet("Stay"); ws.sheet_view.showGridLines = False
    title_block(ws, stay.get("name", "Stay"), stay.get("address", ""))
    ws["A5"] = "Coordinates"; ws["A5"].font = F_MUTED; ws["B5"] = f"{stay.get('lat', '')}, {stay.get('lon', '')}"; ws["B5"].font = F_BODY
    ws["A6"] = "Map"; ws["A6"].font = F_MUTED
    if stay.get("lat") is not None:
        ws["B6"] = f"https://www.google.com/maps?q={stay['lat']},{stay['lon']}"; ws["B6"].font = Font(name="Arial", size=10, color=COPPER, underline="single"); ws["B6"].hyperlink = ws["B6"].value
    ws.column_dimensions["A"].width = 16; ws.column_dimensions["B"].width = 70

    # ---- Vehicles
    ws = wb.create_sheet("Vehicles"); ws.sheet_view.showGridLines = False
    title_block(ws, "Transport", "The first type is the group's coach; a smaller type goes on its own when the day's party fits in it.")
    header_row(ws, 5, ["Type", "Seats", "How many", "₹ / km", "Min ₹ / day"], [30, 8, 10, 10, 12])
    r = 6
    for v in party.get("vehicles") or []:
        for i, val in enumerate([v.get("name"), v.get("seats"), v.get("count", 1), v.get("ratePerKm"), v.get("minPerDay")], 1):
            c = ws.cell(row=r, column=i, value=val); c.font = F_BODY; c.border = BORDER
        r += 1
    by = {}
    for d in days:
        if not d.get("vehicles") or not d.get("vehicle"):
            continue
        by.setdefault(d["vehicle"], {"days": 0})["days"] += 1
    r += 1
    ws.cell(row=r, column=1, value="Days by vehicle").font = F_BOLD; r += 1
    for name, v in by.items():
        ws.cell(row=r, column=1, value=name).font = F_BODY; ws.cell(row=r, column=2, value=v["days"]).font = F_BODY; r += 1
    if t.get("vehicleCost") is not None:
        r += 1
        ws.cell(row=r, column=1, value="Vehicle estimate for the tour").font = F_BOLD
        ws.cell(row=r, column=2, value=round(t["vehicleCost"])).font = F_BOLD; ws.cell(row=r, column=2).number_format = "₹#,##0"

    for sheet in wb.worksheets:
        sheet.sheet_properties.tabColor = COPPER if sheet.title in ("Summary",) else ("B8860B" if sheet.title in ("Stay", "Vehicles") else "8C8E92")
    wb.save(out)


if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    with open(src, encoding="utf-8") as f:
        plan = json.load(f)
    build(plan, out)
    print("wrote", out)
