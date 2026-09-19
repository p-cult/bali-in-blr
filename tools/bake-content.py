#!/usr/bin/env python3
"""Bake the site-copy Google Doc into index.html.

Reads the same content feed the page reads live (BRIDGE_URL + ?feed=content)
and writes each line into the matching data-content element, so the printed
wording in index.html stays current. The live swap in main.js still runs on
top, so this is a safety net and an SEO/link-preview improvement, not a
replacement. Standard library only.

Never wipes anything: on any fetch problem, a malformed feed or a suspiciously
small feed it changes nothing and exits 0 (the site just keeps its wording).
"""
import hashlib
import html
import os
import re
import sys
import urllib.request

ROOT = __file__.rsplit("/tools/", 1)[0] if "/tools/" in __file__ else "."
MIN_ROWS = 50  # the feed normally has 92; far fewer means something is wrong
KEY_RE = re.compile(r"^[a-z0-9-]+(\.[a-z0-9-]+)+$", re.I)


def bridge_url():
    src = open(f"{ROOT}/main.js", encoding="utf-8").read()
    m = re.search(r'BRIDGE_URL:\s*"([^"]+)"', src)
    return m.group(1) if m else ""


def fetch_feed(url):
    req = urllib.request.Request(url + "?feed=content", headers={"User-Agent": "bake-content"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8")
    copy = {}
    for line in body.replace("\r", "").split("\n"):
        if "\t" not in line:
            continue
        key, text = line.split("\t", 1)
        key, text = key.strip(), text.strip()
        if KEY_RE.match(key) and text:
            copy[key] = text
    return copy


def to_html(text):
    out = []
    for i, part in enumerate(text.split("**")):
        if not part:
            continue
        esc = html.escape(part, quote=False).replace(" ", "&nbsp;")
        out.append(f"<strong>{esc}</strong>" if i % 2 else esc)
    return "".join(out)


def main():
    url = bridge_url()
    if not url:
        print("No BRIDGE_URL; nothing to do.")
        return 0
    try:
        copy = fetch_feed(url)
    except Exception as err:  # network, timeout, bad bytes
        print(f"Feed unavailable ({err}); leaving index.html alone.")
        return 0
    if len(copy) < MIN_ROWS:
        print(f"Feed has only {len(copy)} rows; leaving index.html alone.")
        return 0

    path = f"{ROOT}/index.html"
    src = open(path, encoding="utf-8").read()
    pat = re.compile(
        r'(<(?P<tag>[a-z0-9]+)\b[^>]*\bdata-content="(?P<key>[^"]+)"[^>]*>)(?P<inner>.*?)(</(?P=tag)>)',
        re.S | re.I,
    )
    changed, skipped, diffs = [], 0, []

    def flat(s):
        return re.sub(r"[ \t\r\n]+", " ", s).strip()

    def sub(m):
        nonlocal skipped
        key = m.group("key")
        text = copy.get(key)
        if not text:
            return m.group(0)
        inner = m.group("inner")
        if re.search(r"<(?!/?strong\b)", inner):  # has other markup: do not touch
            skipped += 1
            return m.group(0)
        current = flat(html.unescape(re.sub(r"</?strong>", "**", inner)))
        if current == flat(text):  # wording already matches: leave the HTML alone
            return m.group(0)
        changed.append(key)
        diffs.append(key + "\t" + text)
        return m.group(1) + to_html(text) + m.group(5)

    out = pat.sub(sub, src)
    state = f"{ROOT}/.bake-state"
    if not changed:
        open(state, "w").write("")
        print(f"In sync: the Doc matches index.html ({len(copy)} lines checked, "
              f"{skipped} skipped for other markup). Nothing to bake.")
        return 0
    # Settle first: bake only a difference that is unchanged since the previous
    # check, so a half-finished edit is never baked. The live swap covers the wait.
    sig = hashlib.sha256("\n".join(sorted(diffs)).encode("utf-8")).hexdigest()
    prev = open(state).read().strip() if os.path.exists(state) else ""
    if sig != prev and not os.environ.get("BAKE_NOW"):
        open(state, "w").write(sig)
        print(f"Doc differs from index.html in {len(changed)} element(s): "
              f"{', '.join(changed)}. Waiting for the next check to let the edit settle.")
        return 0
    open(state, "w").write("")
    open(path, "w", encoding="utf-8").write(out)
    print(f"Doc changed. Baked {len(changed)} element(s): {', '.join(changed)}")
    with open(f"{ROOT}/.bake-changed", "w", encoding="utf-8") as f:
        f.write(", ".join(changed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
