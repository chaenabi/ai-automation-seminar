#!/usr/bin/env python3
"""Rewrite the icon block at the end of assets/deck.css.

Icons are inlined as data URIs so decks opened straight from disk (file://)
still show them; Chrome blocks file:// mask images as cross-origin.

Usage: python3 tools/build_icons.py [extra-icon-name ...]
Icon SVGs come from tools/node_modules/lucide-static/icons (npm install in tools/).
"""
import re
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
CSS = ROOT / "assets/deck.css"
SOURCE = ROOT / "tools/node_modules/lucide-static/icons"
MARKER = "/* Lucide icons (ISC), see icons/LICENSE */"


def data_uri(name):
    svg = (SOURCE / f"{name}.svg").read_text(encoding="utf-8")
    svg = re.sub(r"<!--.*?-->", "", svg, flags=re.S)
    svg = " ".join(svg.split()).replace('"', "'")
    return "data:image/svg+xml," + quote(svg, safe=" /:=',-.()")


def main(extra):
    css = CSS.read_text(encoding="utf-8")
    head, _, block = css.partition(MARKER)
    names = re.findall(r"^\.i-([a-z0-9-]+) ", block, flags=re.M) + list(extra)
    names = list(dict.fromkeys(names))
    lines = [f'.i-{n} {{ --i: url("{data_uri(n)}"); }}' for n in names]
    CSS.write_text(head + MARKER + "\n" + "\n".join(lines) + "\n", encoding="utf-8")
    print(f"{len(names)} icons written")


if __name__ == "__main__":
    main(sys.argv[1:])
