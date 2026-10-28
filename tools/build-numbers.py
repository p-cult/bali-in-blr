#!/usr/bin/env python3
"""
Build /numbers/ — the "Bali in Bengaluru — in Numbers" report as a web slide show.

    python3 tools/build-numbers.py <deck-folder>

<deck-folder> holds the deck's own files as the Slides artifact keeps them:
deck.json (title and slide order) and slides/<id>.html, one <section> per
slide on a 1920 x 1080 canvas with inline styles. Download them from the
artifact (its project/ folder), point this script at that folder, and it
writes numbers/index.html. numbers/numbers.css and numbers/numbers.js scale
the canvas to the window and handle the keys, buttons and swipes.

What changes on the way:
  - speaker notes (<aside>) are dropped: the page shows the slides only
  - artifact images (/_blob/<id>) point at the same files already in assets/
  - the cover's typed title becomes the inline festival logo (CLAUDE.md rule)
  - the deck's block arrows become plain inline SVG
The slide markup otherwise keeps its inline styles, so a re-run after the deck
is edited reproduces it exactly. Re-run whenever the deck changes.
"""
import json, re, sys
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "numbers" / "index.html"

# Artifact image id -> the identical file in the repo (matched by SHA-256).
BLOBS = {
    "6e20c668a63104961d81e046a3618883": "assets/festival/kecak-fire.jpg",
    "eb08980b1e262be4228587cef097c8fa": "assets/festival/bali-yakshagana-stage.jpg",
    "7dfee5b4ef08a7ec694c198e2d4868ea": "assets/drive/12PsLSPAOd_g6Kapw7TS24UMrAVm9PJT_.png",
    "b2dc1867c56175675d8e9fbb18e4f30f": "assets/drive/1Q5956nJ4iKpxT3ExIcInUjKjJCKrbKMg.png",
    "f827e80acba794f7ad63e6d9d7fe1c1d": "assets/drive/1W_8FpK6bR9dq5iAPCH77mOdKW8oHZp23.png",
    "47d5fef8da5453a2e13494a4f497c25f": "assets/drive/1L1n8ULGq8n23YWeqnIE8iSLFEAU1Lx-j.png",
    "1e3653c61da16bf7844845b012cd5e62": "assets/drive/1Tqwdcs-nzEiBaYPU2COuIwzmcH-2eeXi.png",
    "1bc02e1a1ed9059af9f304a0bfddf509": "assets/drive/1XnGGiOhliGbAYPJEaekkVqtFeCcnOs1w.png",
    "cb142276a1cee4ed945ed2da8ad739a1": "assets/drive/1kSanlf9PjBhSUMdRZNlQUVW9ieu-y-cY.png",
    "77c4280e8388797e299a318d7f949e82": "assets/drive/1N84JeIjNwFRcLRt1O9NXiqxql6g4eTgl.png",
    "f0ab328a00efbd2c9d7e67efa354a885": "assets/drive/1XFI41hU5QLOI8GPbdwT6-S5-ONF5tJSt.png",
    "d0edab894a672ae644a8f55beae5f9ca": "assets/drive/1Ccls_3cIuNERWTmG62CXu0wdyGmF_4pZ.png",
    "d257e35aa32e0a9b93305c392841ec8b": "assets/drive/18R54TUHWrLLrfUrp4Ds2mQjVjA_wEJ7w.png",
    "27efb05ca473892522f191720c0b6ae0": "assets/drive/1PsuI4nBhawF1kcU2058XJeGEoje2mkk7.png",
    "269b063c6f4fb7b7ab754a61b9468586": "assets/drive/1rFyHzHyEk-XoaUx9N7hBQNNIZQrN7YVH.png",
    "3efb9308eadd0f4056ea4ecfdf6b7cc9": "assets/collab/prabhat-clean.png",
}

ARROWS = {
    "arrow-right": "M0 30h60V0l40 50-40 50V70H0z",
    "arrow-left": "M100 30H40V0L0 50l40 50V70h60z",
}


def blob(m):
    path = BLOBS.get(m.group(1))
    if not path:
        sys.exit(f"Image /_blob/{m.group(1)} has no copy in assets/ — add it to BLOBS.")
    return "../" + path


def shape(m):
    attrs, style = m.group(1), re.search(r'style="([^"]*)"', m.group(1))
    kind = re.search(r'kind="([^"]+)"', attrs).group(1)
    if kind not in ARROWS:
        sys.exit(f'x-shape kind="{kind}" is not handled yet — add it to ARROWS.')
    css = style.group(1) if style else ""
    fill = re.search(r"background:\s*(#[0-9A-Fa-f]{3,8})", css)
    w = re.search(r"width:\s*(\d+)px", css)
    h = re.search(r"height:\s*(\d+)px", css)
    return (f'<svg aria-hidden="true" width="{w.group(1)}" height="{h.group(1)}" '
            f'viewBox="0 0 100 100" preserveAspectRatio="none" style="flex:none">'
            f'<path d="{ARROWS[kind]}" fill="{fill.group(1) if fill else "#000"}"/></svg>')


def cover_logo(html):
    """Swap the cover's typed title for the inline logo, keeping the text for screen readers."""
    logo = (ROOT / "assets" / "logo.svg").read_text().strip()
    logo = logo.replace('aria-labelledby="logo-title"', 'aria-hidden="true"')
    logo = re.sub(r"<title[^>]*>.*?</title>", "", logo, flags=re.S)
    return re.sub(r"(<h1\b[^>]*>)Bali in Bengaluru(</h1>)",
                  lambda m: m.group(1).replace('style="', 'style="display:block;') +
                  logo + '<span class="sr-only">Bali in Bengaluru</span>' + m.group(2),
                  html, count=1)


def slide(src, sid, n):
    html = re.sub(r"\s*<aside>.*?</aside>", "", src, flags=re.S).strip()
    html = re.sub(r"/_blob/([0-9a-f]{32})", blob, html)
    html = re.sub(r"<x-shape\b([^>]*)>\s*</x-shape>", shape, html)
    if sid == "cover":
        html = cover_logo(html)
    html = re.sub(r"<img\b", '<img decoding="async"', html)
    return re.sub(r"^<section\b", f'<section class="slide" data-n="{n}" aria-roledescription="slide"', html, count=1)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    deck = Path(sys.argv[1])
    index = json.loads((deck / "deck.json").read_text())
    title = index["title"]
    slides = []
    for n, sid in enumerate(index["order"], 1):
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", sid):
            sys.exit(f"Odd slide id {sid!r} in deck.json")
        slides.append(slide((deck / "slides" / f"{sid}.html").read_text(), sid, n))
    page = PAGE.format(title=escape(title), count=len(slides), slides="\n".join(slides))
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(page)
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(slides)} slides")


PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>{title}</title>
<meta name="description" content="The festival in figures: programmes, attendance, tickets, website visits and social media reach, 3 – 18 Oct 2026." />
<meta name="theme-color" content="#121316" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400..800;1,400..800&family=Instrument+Sans:wght@400..700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="numbers.css?v=2" />
<!--
  Generated by tools/build-numbers.py from the "in Numbers" slide deck — edit
  the deck and re-run the script rather than editing this file. Link-only:
  noindex, disallowed in robots.txt, not linked from the public site.
-->
</head>
<body>
<main class="deck" aria-label="{title}" aria-roledescription="slide show">
<div class="stage">
{slides}
</div>
</main>
<nav class="deck-nav" aria-label="Slides">
<button type="button" class="deck-btn" data-go="prev" aria-label="Previous slide">&larr;</button>
<p class="deck-count" aria-live="polite"><span data-current>1</span> / {count}</p>
<button type="button" class="deck-btn" data-go="next" aria-label="Next slide">&rarr;</button>
<button type="button" class="deck-btn deck-full" data-go="full" aria-label="Full screen">&#x26F6;</button>
</nav>
<p class="deck-turn">Turn your phone sideways for a bigger view</p>
<script src="numbers.js?v=2"></script>
</body>
</html>
"""

if __name__ == "__main__":
    main()
