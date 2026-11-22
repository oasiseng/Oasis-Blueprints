#!/usr/bin/env python3
# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
"""find_text.py - find where a word or callout sits on the captured sheets, in image pixels.

    python find_text.py work/sheets "BUBBLER"            # every page
    python find_text.py work/sheets "FC-1A" --page 12    # one page
    python find_text.py work/sheets --list --page 2      # all text on a page, with boxes

Prints: page, sheet, [x0, y0, x1, y1] in the page image, and the line. Use the boxes to place rings,
tags and crops (crop.py), then convert to crop pixels by subtracting the crop's top-left corner.
"""
import argparse, json
from pathlib import Path


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("sheets"), ap.add_argument("text", nargs="?", default="")
    ap.add_argument("--page", type=int), ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    meta = json.loads((Path(a.sheets) / "sheets.json").read_text(encoding="utf-8"))
    q = a.text.lower()
    for p in meta["pages"]:
        if a.page and p["page"] != a.page:
            continue
        for t, x0, y0, x1, y1 in p["lines"]:
            if a.list or (q and q in t.lower()):
                print("p%02d %-6s [%d, %d, %d, %d]  %s" % (p["page"], p.get("sheet", ""), x0, y0, x1, y1, t[:90]))


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        pass
