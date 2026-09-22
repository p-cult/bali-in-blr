#!/usr/bin/env python3
"""
Bring each event's hero banner on-site from its Drive folder.

    python3 tools/sync-event-banners.py

data/event-banners.json maps an event slug to a Drive folder (one folder per
event, shared "anyone with the link"). For each folder this picks one image:

  1. a file whose name starts with "banner" (drop one in to override), else
  2. the widest landscape image (width clearly greater than height).

PSDs, portraits and subfolders are ignored. The chosen image is saved to
assets/events/<slug>.jpg, shrink-only (never upscaled) to 2000px wide.

It re-downloads only when the chosen Drive file changes, so a scheduled run is
cheap and never rewrites an unchanged file. The event page reads 'version'
from the JSON to bust caches, so a new image shows without anyone editing code.
An event with no usable image gets no file, and the page shows its stand-in.
"""
import json, re, shutil, subprocess, sys, tempfile, datetime
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
MAP = ROOT / "data" / "event-banners.json"
OUT = ROOT / "assets" / "events"
MAXW = 2000
IMG_EXT = re.compile(r"\.(jpe?g|png|webp|tiff?|heic)$", re.I)


def get(url, tries=3):
    """Drive answers 500/429 now and then; retry before giving up."""
    import time
    for n in range(tries):
        try:
            return urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read()
        except Exception:
            if n == tries - 1:
                raise
            time.sleep(2 * (n + 1))


def folder_files(folder):
    h = get(f"https://drive.google.com/drive/folders/{folder}").decode("utf-8", "replace")
    ids = []
    for m in re.finditer(r"([A-Za-z0-9_-]{28,44})-0-16", h):
        if m.group(1) not in ids and m.group(1) != folder:
            ids.append(m.group(1))
    return ids


def file_name(fid):
    try:
        h = get(f"https://drive.google.com/file/d/{fid}/view").decode("utf-8", "replace")
    except Exception:
        return ""          # unknown name: judged by its pixels alone
    m = re.search(r"<title>(.*?) - Google Drive</title>", h)
    return unescape(m.group(1)).strip() if m else ""


def dims(path):
    try:
        from PIL import Image
        with Image.open(path) as im:
            return im.size
    except Exception:
        pass
    if shutil.which("sips"):
        r = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
                           capture_output=True, text=True)
        w = re.search(r"pixelWidth: (\d+)", r.stdout)
        h = re.search(r"pixelHeight: (\d+)", r.stdout)
        if w and h:
            return int(w.group(1)), int(h.group(1))
    return None


def optimise(src, dst, width):
    """Shrink-only JPEG. Pillow first (the CI runner), sips on a Mac."""
    try:
        from PIL import Image
        with Image.open(src) as im:
            im = im.convert("RGB")
            if im.width > MAXW:
                im = im.resize((MAXW, round(im.height * MAXW / im.width)), Image.LANCZOS)
            im.save(dst, "JPEG", quality=80, optimize=True, progressive=True)
        return
    except ImportError:
        pass
    args = ["sips", "-s", "format", "jpeg", "-s", "formatOptions", "80"]
    if width > MAXW:
        args += ["--resampleWidth", str(MAXW)]
    subprocess.run(args + [str(src), "--out", str(dst)], check=True, capture_output=True)


def main():
    cfg = json.loads(MAP.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp())
    listing = {}
    changed = False

    for slug, entry in cfg["events"].items():
        folder = entry["folder"]
        if folder not in listing:
            candidates = []
            try:
                ids = folder_files(folder)
            except Exception as err:
                # Could not see the folder this run. Keep whatever is on-site;
                # never clear a working banner because Drive had a bad minute.
                print(f"  !  {slug:52} folder unreachable ({err}); keeping current banner")
                listing[folder] = "unreachable"
                continue
            for fid in ids:
                name = file_name(fid)
                if name and not IMG_EXT.search(name):
                    continue                      # PSDs, subfolders, anything not an image
                raw = tmp / fid
                try:
                    raw.write_bytes(get(f"https://drive.google.com/thumbnail?id={fid}&sz=w2400"))
                except Exception:
                    continue
                d = dims(raw)
                if not d:
                    continue
                w, h = d
                if w <= h * 1.1:
                    continue                      # landscape only
                candidates.append({"id": fid, "name": name, "w": w, "h": h, "raw": raw})
            pick = None
            forced = [c for c in candidates if c["name"].lower().startswith("banner")]
            pool = forced or candidates
            if pool:
                pick = max(pool, key=lambda c: (c["w"] * c["h"], c["w"] / c["h"]))
            listing[folder] = pick

        pick = listing[folder]
        dest = OUT / f"{slug}.jpg"
        if pick == "unreachable":
            continue
        if not pick:
            print(f"  -  {slug:52} no landscape image yet — page shows the stand-in")
            entry.pop("source", None); entry.pop("version", None)
            continue
        if entry.get("source") == pick["id"] and dest.exists():
            print(f"  =  {slug:52} unchanged ({pick['name']})")
            continue
        optimise(pick["raw"], dest, pick["w"])
        entry["source"] = pick["id"]
        entry["version"] = pick["id"][:10]
        entry["picked"] = f"{pick['name']} ({pick['w']}x{pick['h']})"
        entry["updated"] = datetime.date.today().isoformat()
        changed = True
        print(f"  +  {slug:52} {pick['name']} {pick['w']}x{pick['h']} -> {dest.stat().st_size // 1024} KB")

    MAP.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n")
    shutil.rmtree(tmp, ignore_errors=True)
    print("changed" if changed else "nothing new")


if __name__ == "__main__":
    main()
