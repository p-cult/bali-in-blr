#!/usr/bin/env python3
"""
Bring each concluded event's photos and videos on-site from Google Drive.

    python3 tools/sync-event-media.py

data/event-media.json holds one Drive folder for the whole festival ("parent")
and, under "events", one entry per event slug. A sub-folder of the parent that
is named like the event (the title, any case; the slug rule is forgiving) is
picked up by itself; an explicit "folder" on an event wins over the name match.
Every folder must be shared "anyone with the link".

For each event folder:
  - photos (jpg/png/webp/heic) are downloaded and saved shrink-only as
    assets/media/<slug>/<n>.jpg plus 800 and 1600 px WebP;
  - videos (mp4/mov/m4v/webm) are NOT downloaded — the site plays them in
    Drive's own player (…/file/d/<id>/preview) and shows a local poster taken
    from Drive's thumbnail.
Re-downloads only when the folder's file list changes, so the hourly run is
cheap. The home page's "What has already happened" carousel reads the JSON.
"""
import hashlib, json, re, shutil, subprocess, sys, tempfile, time
from html import unescape
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
MAP = ROOT / "data" / "event-media.json"
OUT = ROOT / "assets" / "media"
IMG_EXT = re.compile(r"\.(jpe?g|png|webp|tiff?|heic)$", re.I)
VID_EXT = re.compile(r"\.(mp4|mov|m4v|webm|mkv)$", re.I)
MAX_PHOTOS = 12


def get(url, tries=3):
    for n in range(tries):
        try:
            return urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read()
        except Exception:
            if n == tries - 1:
                raise
            time.sleep(2 * (n + 1))


def folder_ids(folder):
    """Ids of the files and sub-folders listed on a shared folder page."""
    h = get(f"https://drive.google.com/drive/folders/{folder}").decode("utf-8", "replace")
    ids = []
    # Files carry an "<id>-0-16" marker; sub-folders are listed as data-id="<id>".
    for m in re.finditer(r'([A-Za-z0-9_-]{25,44})-0-16|data-id="([A-Za-z0-9_-]{25,44})"', h):
        fid = m.group(1) or m.group(2)
        if fid not in ids and fid != folder:
            ids.append(fid)
    return ids


def page_title(url):
    try:
        h = get(url).decode("utf-8", "replace")
    except Exception:
        return None
    # Drive writes "Name - Google Drive" for a file and "Name – Google Drive" (en dash) for a folder.
    m = re.search(r"<title>(.*?)\s[-\u2013]\sGoogle Drive</title>", h, re.S)
    return unescape(m.group(1)).strip() if m else None


def is_folder(fid):
    """A folder's own page lists contents and names the folder mime type."""
    try:
        h = get(f"https://drive.google.com/drive/folders/{fid}").decode("utf-8", "replace")
    except Exception:
        return False
    return "vnd.google-apps.folder" in h and page_title_from(h) is not None


def page_title_from(h):
    m = re.search(r"<title>(.*?)\s[-\u2013]\sGoogle Drive</title>", h, re.S)
    return unescape(m.group(1)).strip() if m else None


def file_name(fid):
    return page_title(f"https://drive.google.com/file/d/{fid}/view") or ""


def slugify(title):
    # Mirrors main.js slugify (and the other tools): lowercase, non-letters to hyphens.
    s = re.sub(r"[^a-z0-9]+", "-", str(title).lower()).strip("-")
    return s


def dims(path):
    try:
        out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
                             capture_output=True, text=True, timeout=30).stdout
        w = int(re.search(r"pixelWidth:\s*(\d+)", out).group(1))
        h = int(re.search(r"pixelHeight:\s*(\d+)", out).group(1))
        return w, h
    except Exception:
        try:
            from PIL import Image
            with Image.open(path) as im:
                return im.size
        except Exception:
            return 0, 0


def optimise(src, dest_base):
    """dest_base + .jpg (max 2000 wide), -800.webp, -1600.webp; shrink-only."""
    try:
        from PIL import Image, ImageOps
        with Image.open(src) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            w = im.width
            def at(width):
                if im.width <= width:
                    return im.copy()
                return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
            at(2000).save(str(dest_base) + ".jpg", "JPEG", quality=82, optimize=True, progressive=True)
            at(800).save(str(dest_base) + "-800.webp", "WEBP", quality=78, method=6)
            at(1600).save(str(dest_base) + "-1600.webp", "WEBP", quality=78, method=6)
            return True
    except Exception as e:
        print(f"    optimise failed: {e}", file=sys.stderr)
        return False


def main():
    if not MAP.exists():
        print("data/event-media.json missing", file=sys.stderr)
        return 1
    data = json.loads(MAP.read_text())
    parent = str(data.get("parent", "")).strip()
    events = data.setdefault("events", {})

    # 1. Discover sub-folders of the parent and match them to event slugs.
    #    A folder named exactly like the event matches outright; otherwise the
    #    event whose slug the folder name starts with (or contains) is taken,
    #    longest first, so "Kecak workshop - studio1" still reaches
    #    kecak-workshop. Folders that match no event are left alone.
    known = []
    try:
        for e in json.loads((ROOT / "data" / "events.json").read_text()):
            t = e.get("title") or ""
            if t:
                known.append(slugify(t))
    except Exception:
        pass
    known = sorted(set(known), key=len, reverse=True)
    if parent:
        for fid in folder_ids(parent):
            if not is_folder(fid):
                continue
            name = page_title(f"https://drive.google.com/drive/folders/{fid}") or ""
            fslug = slugify(name)
            if not fslug:
                continue
            slug = fslug if fslug in known else next((k for k in known if fslug.startswith(k) or k in fslug), None)
            if not slug:
                print(f"no event matches folder '{name}'; skipped")
                continue
            ev = events.setdefault(slug, {})
            if not ev.get("folder"):
                ev["folder"] = fid
                ev["folderName"] = name
                print(f"folder '{name}' -> {slug}")

    OUT.mkdir(parents=True, exist_ok=True)
    changed = False
    for slug, ev in events.items():
        folder = ev.get("folder")
        if not folder:
            continue
        try:
            ids = folder_ids(folder)
        except Exception as e:
            print(f"{slug}: folder unreachable ({e}); keeping what is here", file=sys.stderr)
            continue
        named = []
        for fid in ids:
            n = file_name(fid)
            if n:
                named.append((fid, n))
        photos = [(f, n) for f, n in named if IMG_EXT.search(n)][:MAX_PHOTOS]
        videos = [(f, n) for f, n in named if VID_EXT.search(n)]
        version = hashlib.sha1(("|".join(f for f, _ in photos + videos)).encode()).hexdigest()[:10]
        if ev.get("version") == version and (OUT / slug).exists():
            print(f"{slug}: unchanged ({len(photos)} photos, {len(videos)} videos)")
            continue

        dest = OUT / slug
        if dest.exists():
            shutil.rmtree(dest)
        dest.mkdir(parents=True)
        out_photos, out_videos = [], []
        with tempfile.TemporaryDirectory() as td:
            for i, (fid, n) in enumerate(photos, 1):
                raw = Path(td) / f"p{i}"
                try:
                    raw.write_bytes(get(f"https://drive.google.com/thumbnail?id={fid}&sz=w2400"))
                except Exception as e:
                    print(f"  {slug}: photo {n} failed: {e}", file=sys.stderr)
                    continue
                base = dest / f"{i:02d}"
                if optimise(raw, base):
                    w, h = dims(str(base) + ".jpg")
                    out_photos.append({"file": f"{i:02d}", "name": n, "w": w, "h": h})
            for i, (fid, n) in enumerate(videos, 1):
                poster = dest / f"v{i:02d}-poster.jpg"
                try:
                    raw = Path(td) / f"v{i}"
                    raw.write_bytes(get(f"https://drive.google.com/thumbnail?id={fid}&sz=w1600"))
                    from PIL import Image
                    with Image.open(raw) as im:
                        im.convert("RGB").save(str(poster), "JPEG", quality=80, optimize=True)
                    has_poster = True
                except Exception:
                    has_poster = False
                out_videos.append({"id": fid, "name": n, "poster": poster.name if has_poster else ""})
        ev.update({"photos": out_photos, "videos": out_videos, "version": version,
                   "synced": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
        changed = True
        print(f"{slug}: {len(out_photos)} photos, {len(out_videos)} videos")

    MAP.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print("updated data/event-media.json" if changed else "no media changes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
