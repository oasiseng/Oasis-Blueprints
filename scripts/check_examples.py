#!/usr/bin/env python3
"""check_examples.py - stop real job data from being published with the examples. Standard library only.

    python scripts/check_examples.py [--root REPO]

Everything under examples/ becomes public on the documentation site once merged. This fails (exit 1) if
any example:

- names a firm other than the placeholder "Your Company", or has a brand.json or a logo file in its folder;
- contains an email address, a phone number or a street address other than the placeholders already used
  by the examples (the same patterns and placeholders as tests/test_no_job_data.py);
- embeds a raster image in its project.json (maps, aerials, logos);
- matches a line of the optional deny-list in the environment variable ANON_DENYLIST (the Actions secret
  of the same name: one term per line, case-insensitive). A match is reported as the file and
  "matched a deny-list term" only: the term itself is never printed.
"""
import argparse, json, os, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from tests.test_no_job_data import ALLOW, CHECKS, PLACEHOLDERS  # noqa: E402  one copy of the patterns

FIRM = "Your Company"
WATCH = ("email address", "phone number", "street address")
RASTER = re.compile(r"data:image/(?:png|jpe?g|gif|webp|bmp|tiff?|avif|heic)", re.I)
LOGO = re.compile(r"^(?:.*[-_.])?logo(?:[-_.].*)?$", re.I)
TEXT = {".json", ".js", ".md", ".html", ".py", ".csv", ".txt", ".svg", ".css", ".yml", ".yaml"}


def deny_terms():
    return [t.strip().lower() for t in os.environ.get("ANON_DENYLIST", "").splitlines() if t.strip()]


def check(root):
    examples = root / "examples"
    terms = deny_terms()
    found = []
    if not examples.is_dir():
        return found
    for path in sorted(p for p in examples.rglob("*") if p.is_file()):
        rel = path.relative_to(root).as_posix()
        if "__pycache__" in path.parts:
            continue
        if path.name.lower() == "brand.json":
            found.append("%s: a brand file; examples use the placeholder firm only" % rel)
        elif LOGO.match(path.stem):
            found.append("%s: a logo file; examples use the placeholder firm only" % rel)
        text = None
        if path.suffix.lower() in TEXT:
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                text = None
        if terms:
            hay = rel.lower() + "\n" + (text.lower() if text is not None else "")
            if any(t in hay for t in terms):
                found.append("%s: matched a deny-list term" % rel)
        if text is None:
            continue
        if path.name == "project.json":
            if RASTER.search(text):
                found.append("%s: embeds a raster image (a map, aerial or logo); draw it or leave it out" % rel)
            try:
                firm = json.loads(text).get("firm") or {}
            except ValueError:
                found.append("%s: not valid JSON" % rel)
                firm = {}
            for key in ("name", "wordmark"):
                value = str(firm.get(key) or "").strip()
                if value and value != FIRM:
                    found.append('%s: firm %s is "%s"; use the placeholder "%s"' % (rel, key, value, FIRM))
            if firm.get("logo"):
                found.append("%s: firm has a logo; examples use the placeholder firm only" % rel)
        for number, line in enumerate(text.splitlines(), 1):
            for what, regex in CHECKS:
                if what not in WATCH:
                    continue
                for match in regex.finditer(line):
                    value = " ".join(match.group(0).split())
                    if value in PLACEHOLDERS.get(what, ()) or (what, value) in ALLOW or (what, value, rel) in ALLOW:
                        continue
                    found.append("%s:%d: %s: %s" % (rel, number, what, value))
    return found


def main():
    ap = argparse.ArgumentParser(description="Check that the examples carry placeholders only.")
    ap.add_argument("--root", default=str(ROOT), help="repository root (default: this repository)")
    a = ap.parse_args()
    found = check(Path(a.root).resolve())
    if found:
        print("Real job data may be in the examples. Replace it with the placeholders in CONTRIBUTING.md:")
        for f in found:
            print(" - " + f)
        sys.exit(1)
    print("examples: placeholders only%s" % (" (deny-list checked)" if deny_terms() else ""))


if __name__ == "__main__":
    main()
