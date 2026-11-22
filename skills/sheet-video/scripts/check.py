#!/usr/bin/env python3
# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
"""check.py - play the video through in headless Chromium and report problems; save frames to look at.

    python check.py work/video.html [--shots 10,22.5,38] [--out work/shots] [--reduced] [--step 0.25]

Reports: total length, images that did not load, console errors and warnings (including "phrase not
found" from scene timing), and for every --step seconds any visible text that leaves the stage, a tag
clipped by its viewer, or a text box that overflows. Exits 1 if anything is found. --shots saves JPEG
frames (1920x1080 stage plus the controls) at those times. --reduced repeats with reduced motion on.
"""
import argparse, json, sys
from pathlib import Path
from _common import need, launch

CHECK_JS = r"""() => {
  const issues = [], scene = [...document.querySelectorAll('.scene')].find(s => s.style.display === 'block');
  const st = document.getElementById('stage').getBoundingClientRect(), sc = st.width / 1920;
  for (const el of [...scene.querySelectorAll('*'), document.getElementById('capt')]) {
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    let o = 1, a = el; while (a && a !== document.body) { o *= +getComputedStyle(a).opacity; a = a.parentElement; } if (o < 0.05) continue;
    const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!hasText) continue;
    const r = el.getBoundingClientRect(), L = (r.left - st.left) / sc, T = (r.top - st.top) / sc, R = (r.right - st.left) / sc, B = (r.bottom - st.top) / sc;
    const name = (el.dataset.k || el.className || el.tagName) + ': ' + (el.textContent || '').trim().slice(0, 40);
    if (L < 24 || T < 24 || R > 1896 || B > 1056) issues.push(['off stage', name]);
    const v = el.closest('.viewer');
    if (v && el.classList.contains('tag')) { const vr = v.getBoundingClientRect(); if (r.left < vr.left - 1 || r.right > vr.right + 1 || r.top < vr.top - 1 || r.bottom > vr.bottom + 1) issues.push(['tag clipped', name]); }
    if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible') issues.push(['overflow', name]);
  }
  for (const el of scene.querySelectorAll('.item')) if (el.scrollHeight > el.clientHeight + 2) issues.push(['overflow', (el.textContent || '').slice(0, 40)]);
  return issues; }"""


def run(html, shots, out, reduced, step):
    from playwright.sync_api import sync_playwright
    bad = 0
    with sync_playwright() as pw:
        b = launch(pw)
        pg = b.new_context(viewport={"width": 1920, "height": 1136}, reduced_motion="reduce" if reduced else "no-preference").new_page()
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type in ("error", "warning") else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(Path(html).resolve().as_uri() + "?t=0"); pg.wait_for_timeout(800)
        info = pg.evaluate("() => ({total: __player.total, imgs: [...document.images].filter(i => i.getAttribute('src')).map(i => [i.alt, i.complete, i.naturalWidth])})")
        missing = [i[0] for i in info["imgs"] if not i[1] or i[2] == 0]
        print("%s: %.1f s (%d:%02d), %d images, %d not loaded %s" % ("reduced motion" if reduced else "check", info["total"], info["total"] // 60, info["total"] % 60, len(info["imgs"]), len(missing), missing or ""))
        bad += len(missing)
        seen, t = {}, 0.0
        while t <= info["total"]:
            pg.evaluate("t => __player.seek(t)", t)
            for i in pg.evaluate(CHECK_JS):
                seen.setdefault(json.dumps(i), []).append(round(t, 2))
            t += step
        for k, v in seen.items():
            print("  ISSUE %s at %s%s" % (k, v[:5], " ..." if len(v) > 5 else "")); bad += 1
        if shots:
            out.mkdir(parents=True, exist_ok=True)
            for s in shots:
                pg.evaluate("t => __player.seek(t)", s); pg.wait_for_timeout(60)
                pg.screenshot(path=str(out / ("t%06.2f%s.jpg" % (s, "_r" if reduced else ""))), type="jpeg", quality=80)
            print("  frames ->", out)
        if errs:
            print("  console:", errs[:8]); bad += len(errs)
        b.close()
    return bad


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("html"), ap.add_argument("--shots", default=""), ap.add_argument("--out")
    ap.add_argument("--reduced", action="store_true"), ap.add_argument("--step", type=float, default=0.25)
    a = ap.parse_args()
    need("playwright")
    shots = [float(x) for x in a.shots.split(",") if x.strip()]
    out = Path(a.out or Path(a.html).parent / "shots")
    bad = run(a.html, shots, out, False, a.step)
    if a.reduced:
        bad += run(a.html, shots, out, True, max(a.step, 0.5))
    print("clean" if not bad else "%d problem(s)" % bad)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
