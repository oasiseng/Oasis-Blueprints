#!/usr/bin/env python3
# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
"""capture_html.py - render an HTML sheet set (Oasis-Blueprints or similar) to page images plus text with positions.

    python capture_html.py set.html work/sheets [--scale 2.5] [--sheet "article.sheet"] [--hide "#ui,#audit"]

Same outputs as capture_pdf.py (pNN.png, pNN.txt, sheets.json), so the rest of the pipeline does not care
whether the set came as PDF or HTML. Prefer a "predrawn" export of a set that draws itself in the browser.
Also writes panels.json: every section.panel per sheet with its heading and box, to crop whole views.
"""
import argparse, json
from pathlib import Path
from _common import need, launch

JS_TEXT = """(a, sc) => { const A = a.getBoundingClientRect(), out = [];
  a.querySelectorAll('*').forEach(e => { if (e.closest('script,style')) return;
    const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\\s+/g, ' ').trim();
    if (!own) return; const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
    out.push([own, Math.round((r.left - A.left) * sc), Math.round((r.top - A.top) * sc), Math.round((r.right - A.left) * sc), Math.round((r.bottom - A.top) * sc)]); });
  const panels = [...a.querySelectorAll('section.panel')].map(s => { const r = s.getBoundingClientRect();
    return {heading: (s.innerText || '').trim().split('\\n').slice(0, 2).join(' / ').slice(0, 80),
            box: [Math.round((r.left - A.left) * sc), Math.round((r.top - A.top) * sc), Math.round((r.right - A.left) * sc), Math.round((r.bottom - A.top) * sc)]}; });
  return {lines: out, panels, text: a.innerText}; }"""


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("html"), ap.add_argument("out")
    ap.add_argument("--scale", type=float, default=2.5, help="device scale factor (2.5 = sharp at 2-3x zoom)")
    ap.add_argument("--sheet", default="article.sheet", help="CSS selector of one sheet")
    ap.add_argument("--hide", default="#ui,#audit", help="CSS selectors of editor overlays to hide")
    a = ap.parse_args()
    need("playwright")
    from playwright.sync_api import sync_playwright
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    meta = {"source": str(Path(a.html).resolve()), "scale": a.scale, "pages": []}
    with sync_playwright() as pw:
        b = launch(pw)
        pg = b.new_page(viewport={"width": 1600, "height": 1100}, device_scale_factor=a.scale)
        pg.goto(Path(a.html).resolve().as_uri())
        try:
            pg.wait_for_function("window.__ready === true", timeout=8000)
        except Exception:
            pg.wait_for_timeout(3000)
        if a.hide:
            pg.add_style_tag(content=a.hide + "{display:none!important}")
        sheets = pg.query_selector_all(a.sheet)
        for i, el in enumerate(sheets):
            el.scroll_into_view_if_needed(); pg.wait_for_timeout(120)
            name = "p%02d" % (i + 1)
            el.screenshot(path=str(out / (name + ".png")))
            d = el.evaluate(JS_TEXT, a.scale)
            (out / (name + ".txt")).write_text(d["text"], encoding="utf-8")
            from PIL import Image
            w, h = Image.open(out / (name + ".png")).size
            t = d["text"].split("\n")
            number = next((t[j + 1].strip() for j, x in enumerate(t[:-1]) if x.strip().upper() == "SHEET NUMBER"), "")
            sname = next((t[j + 1].strip() for j, x in enumerate(t[:-1]) if x.strip().upper() == "SHEET NAME"), "")
            meta["pages"].append({"page": i + 1, "image": name + ".png", "size": [w, h], "sheet": number,
                                  "name": sname, "lines": d["lines"], "panels": d["panels"]})
            print("%s  %dx%d  sheet %s %s  %d panels" % (name, w, h, number or "?", sname, len(d["panels"])))
        b.close()
    (out / "sheets.json").write_text(json.dumps(meta), encoding="utf-8")
    print("wrote", out / "sheets.json")


if __name__ == "__main__":
    main()
