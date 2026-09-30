#!/usr/bin/env python3
"""Static checks for the seminar decks.

Usage:
  python3 tools/check_decks.py slides.html [seminar-02.html ...]
  python3 tools/check_decks.py --site
  python3 tools/check_decks.py --dump slides.html
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
EXPECTED = {"slides.html": 17, "seminar-02.html": 17, "seminar-03.html": 16}
BANNED = re.compile("[·—–]")
ARROW = "→"
VISUAL = {"chat-mock", "doc-mock", "sheet-mock", "pipeline", "flow", "loop", "matrix",
          "scene", "icon-card", "probability", "timeline", "mock", "icon", "signal",
          "hub", "stack", "illustration"}
TEXT_EXEMPT = VISUAL | {"notes", "example-box", "sources"}
MAX_TEXT_BLOCKS = 3
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
        "source", "track", "wbr"}


class Node:
    def __init__(self, tag, attrs, parent):
        self.tag = tag
        self.attrs = dict(attrs)
        self.parent = parent
        self.children = []

    @property
    def classes(self):
        return (self.attrs.get("class") or "").split()

    def text(self):
        return "".join(c if isinstance(c, str) else c.text() for c in self.children)

    def iter(self):
        for c in self.children:
            if isinstance(c, Node):
                yield c
                yield from c.iter()

    def ancestors(self):
        p = self.parent
        while p is not None:
            yield p
            p = p.parent


class TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root", [], None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.cur)
        self.cur.children.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        node = self.cur
        while node is not self.root and node.tag != tag:
            node = node.parent
        if node is not self.root:
            self.cur = node.parent

    def handle_data(self, data):
        self.cur.children.append(data)


def parse(path):
    builder = TreeBuilder()
    builder.feed(path.read_text(encoding="utf-8"))
    return builder.root


def banned_lines(path):
    rel = path.relative_to(ROOT)
    return [f"{rel}:{i}: banned symbol {BANNED.findall(line)}"
            for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1)
            if BANNED.search(line)]


def has_class(node, names):
    return any(c in names for c in node.classes)


def slides_of(root):
    return [n for n in root.iter() if n.tag == "section" and "slide" in n.classes]


def check_deck(name):
    path = ROOT / name
    if not path.exists():
        return [f"{name}: file missing"]
    errors = banned_lines(path)
    root = parse(path)
    nodes = list(root.iter())
    if not any(n.tag == "link" and n.attrs.get("href") == "assets/deck.css" for n in nodes):
        errors.append(f'{name}: missing <link href="assets/deck.css">')
    if not any(n.tag == "script" and n.attrs.get("src") == "assets/deck.js" for n in nodes):
        errors.append(f'{name}: missing <script src="assets/deck.js">')
    if any(n.tag == "script" and "src" not in n.attrs for n in nodes):
        errors.append(f"{name}: inline <script> found, engine code belongs in assets/deck.js")
    main = next((n for n in nodes if n.tag == "main" and "deck" in n.classes), None)
    if main is None or not main.attrs.get("data-deck-title"):
        errors.append(f'{name}: <main class="deck" data-deck-title="..."> missing')
    sections = slides_of(root)
    if name in EXPECTED and len(sections) != EXPECTED[name]:
        errors.append(f"{name}: {len(sections)} slides, expected {EXPECTED[name]}")
    for i, sec in enumerate(sections, 1):
        where = f"{name} #{i}"
        inner = list(sec.iter())
        if not sec.attrs.get("data-title", "").strip():
            errors.append(f"{where}: empty data-title")
        notes = [n for n in inner if n.tag == "aside" and "notes" in n.classes]
        if len(notes) != 1 or not notes[0].text().strip():
            errors.append(f'{where}: needs exactly one non-empty <aside class="notes">')
        if not any(n.tag in ("img", "svg") or has_class(n, VISUAL) for n in inner):
            errors.append(f"{where}: no visual element")
        blocks = [n for n in inner
                  if (n.tag in ("p", "li") or "quote" in n.classes)
                  and not has_class(n, TEXT_EXEMPT)
                  and not any(has_class(a, TEXT_EXEMPT) for a in n.ancestors())]
        if len(blocks) > MAX_TEXT_BLOCKS:
            errors.append(f"{where}: {len(blocks)} text blocks outside visuals (max {MAX_TEXT_BLOCKS})")
        for node in [sec] + inner:
            for child in node.children:
                if isinstance(child, str) and ARROW in child and "arrow" not in node.classes:
                    errors.append(f"{where}: arrow character outside .arrow: {child.strip()[:30]!r}")
        for img in (n for n in inner if n.tag == "img"):
            src = unquote(img.attrs.get("src", ""))
            if not (ROOT / src).exists():
                errors.append(f"{where}: image not found {src}")
            if "alt" not in img.attrs:
                errors.append(f"{where}: image without alt attribute {src}")
    return errors


def check_site():
    errors = []
    for name in EXPECTED:
        errors += check_deck(name)
    for extra in ("index.html", "assets/deck.css", "assets/deck.js"):
        path = ROOT / extra
        errors += banned_lines(path) if path.exists() else [f"{extra}: file missing"]
    index = (ROOT / "index.html").read_text(encoding="utf-8") if (ROOT / "index.html").exists() else ""
    for name in EXPECTED:
        if f'href="{name}"' not in index:
            errors.append(f"index.html: no link to {name}")
    for gone in ("cli-harness", "examples/"):
        if gone in index:
            errors.append(f"index.html: still mentions {gone}")
    for path in ("cli-harness.html", "examples"):
        if (ROOT / path).exists():
            errors.append(f"{path}: should be deleted")
    if not (ROOT / "assets/icons/LICENSE").exists():
        errors.append("assets/icons/LICENSE: missing")
    return errors


def visible_text(node):
    parts = []
    for c in node.children:
        if isinstance(c, str):
            parts.append(c)
        elif not (c.tag == "aside" and "notes" in c.classes):
            parts.append(visible_text(c))
    return " ".join(" ".join(parts).split())


def dump(name):
    for i, sec in enumerate(slides_of(parse(ROOT / name)), 1):
        notes = [n for n in sec.iter() if n.tag == "aside" and "notes" in n.classes]
        print(f"## {i}. {sec.attrs.get('data-title', '')}")
        print("화면:", visible_text(sec))
        print("노트:", " ".join(notes[0].text().split()) if notes else "(없음)")
        print()


def main(argv):
    if not argv:
        print(__doc__)
        return 2
    if argv[0] == "--dump":
        for name in argv[1:]:
            dump(name)
        return 0
    errors = check_site() if argv == ["--site"] else [e for name in argv for e in check_deck(name)]
    for e in errors:
        print(e)
    print("OK" if not errors else f"{len(errors)} problem(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
