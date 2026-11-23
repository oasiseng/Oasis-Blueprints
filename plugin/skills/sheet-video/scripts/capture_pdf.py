#!/usr/bin/env python3
# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
"""capture_pdf.py - render a PDF drawing set to page images plus searchable text with positions.

    python capture_pdf.py set.pdf work/sheets [--dpi 200] [--pages 1-5,8]

Writes, per page N (1-based): pNN.png (the page at --dpi), pNN.txt (its text, for fact-checking),
and sheets.json: page size in pixels, a guessed sheet number and name, and every text line with its
box in image pixels, so find_text.py can locate a callout ("BUBBLER", "FC-1A") to highlight.
Vector PDFs give exact text boxes; scanned PDFs have no text layer (find features by eye instead).
"""
import argparse, json, re
from pathlib import Path
from _common import need

SHEET_NO = re.compile(r"^(?:[A-Z]{1,2}-?\d{1,3}(?:\.\d{1,2})?[A-Z]?)$")


def pages_arg(spec, n):
    if not spec:
        return list(range(n))
    out = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        out += list(range(int(a) - 1, int(b or a)))
    return [p for p in out if 0 <= p < n]


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("pdf"), ap.add_argument("out")
    ap.add_argument("--dpi", type=int, default=200, help="200 keeps 24x36 sheets sharp when zoomed 2-3x")
    ap.add_argument("--pages")
    a = ap.parse_args()
    pymupdf = need("pymupdf")
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(a.pdf)
    k = a.dpi / 72.0
    meta = {"source": str(Path(a.pdf).resolve()), "dpi": a.dpi, "pages": []}
    for i in pages_arg(a.pages, doc.page_count):
        page = doc[i]
        pix = page.get_pixmap(dpi=a.dpi, alpha=False)
        name = "p%02d" % (i + 1)
        pix.save(out / (name + ".png"))
        lines, seen = [], set()
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = " ".join(" ".join(s["text"] for s in line["spans"]).split())
                if text:
                    x0, y0, x1, y1 = line["bbox"]
                    key = (text, round(x0 * k / 12), round(y0 * k / 12))   # text drawn twice (halo + ink) counts once
                    if key in seen:
                        continue
                    seen.add(key)
                    lines.append([text, round(x0 * k), round(y0 * k), round(x1 * k), round(y1 * k)])
        (out / (name + ".txt")).write_text(page.get_text(), encoding="utf-8")
        # Guess the sheet number: the largest text that looks like A1.0, C001, S-101.
        cands = [(l[4] - l[2], l[0]) for l in lines if SHEET_NO.match(l[0].replace(" ", ""))]
        number = max(cands)[1] if cands else ""
        meta["pages"].append({"page": i + 1, "image": name + ".png", "size": [pix.width, pix.height],
                              "sheet": number, "lines": lines})
        print("%s  %dx%d  sheet %s  %d text lines" % (name, pix.width, pix.height, number or "?", len(lines)))
    (out / "sheets.json").write_text(json.dumps(meta), encoding="utf-8")
    print("wrote", out / "sheets.json")


if __name__ == "__main__":
    main()
