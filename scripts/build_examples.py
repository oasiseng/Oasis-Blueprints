#!/usr/bin/env python3
"""build_examples.py - build the examples gallery of the documentation site.

    python scripts/build_examples.py [--jobs 3]

For every folder in examples/sheet-sets/ that holds a project.json (the folder name is its slug):

1. builds the sheet set with the skill's own scripts/build.py into
   docs-site/public/examples/<slug>/<liveSetFolder>/index.html;
2. prints it with the skill's scripts/print.py to sheet-set.pdf, with one preview per sheet
   (preview-<n>.png, 2400 px wide) and thumb.png (1200 px wide, the first field sheet);
3. fails the whole build if the layout audit reports anything;
4. writes a gallery page for it in docs-site/src/content/docs/examples/.

A folder with a sheet-set.html and no project.json is a pre-drawn set: finished sheets as plain HTML and SVG, with
no JavaScript. It is published as it is (not rebuilt), printed to PDF from the browser, checked for text that
overflows its box, and gets a gallery page that says it is view-only. An optional example.json beside it may set
"thumbSheet", the sheet number used for the gallery thumbnail.

It also builds the panel schedule kit's sample sheet (panel-schedule-kit/) into docs-site/public/kits/panel-schedule/,
and the sheet-video skill's example player (skills/sheet-video/assets/example/) into docs-site/public/kits/sheet-video/.

Then it writes the gallery index (oldest example first, newest last) and docs-site/public/examples.json
for the main website. Addresses come from docs-site/site.json.

Needs Python with Playwright and Chromium, like print.py. Everything it writes is listed in
docs-site/.gitignore.
"""
import argparse, base64, concurrent.futures, datetime, json, re, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "oasis-blueprints"
SETS = ROOT / "examples" / "sheet-sets"
SITE_DIR = ROOT / "docs-site"
PAGES = SITE_DIR / "src" / "content" / "docs" / "examples"
OUT = SITE_DIR / "public" / "examples"
KITS = SITE_DIR / "public" / "kits"
SITE = json.loads((SITE_DIR / "site.json").read_text(encoding="utf-8"))
BASE = SITE["url"].rstrip("/") + "/"
LIVE = SITE.get("liveSetFolder", "set")
PREVIEW_WIDTH, THUMB_WIDTH = 2400, 1200


def git(*args):
    try:
        return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def added(folder):
    """When the folder first appeared in git (seconds), so the gallery can put the newest last."""
    stamps = git("log", "--format=%ct", "--", folder.relative_to(ROOT).as_posix()).split()
    return int(stamps[-1]) if stamps else 0


def status_labels():
    """Status words as the kit prints them in the title block (skills/oasis-blueprints/assets/kit/layout.js)."""
    js = (SKILL / "assets" / "kit" / "layout.js").read_text(encoding="utf-8")
    out = {}
    for key, a, b in re.findall(r"(\w+):\s*\{\s*band:[^\n]*?box:\s*\['([^']*)',\s*'([^']*)'", js):
        out[key] = a + (", " + b[0].lower() + b[1:] if b else "")
    return out


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return p.returncode, (p.stdout + p.stderr).strip()


def predrawn(folder):
    return not (folder / "project.json").is_file() and (folder / "sheet-set.html").is_file()


def build_one(folder, tmp):
    """Build and print one example. Returns (folder, problems, full-size preview paths)."""
    slug = folder.name
    dest = OUT / slug
    shutil.rmtree(dest, ignore_errors=True)
    (dest / LIVE).mkdir(parents=True)
    html = dest / LIVE / "index.html"
    if predrawn(folder):   # published as it is; printed and checked in finish(), which has the browser
        shutil.copyfile(folder / "sheet-set.html", html)
        return folder, [], []
    code, log = run([sys.executable, str(SKILL / "scripts" / "build.py"), str(folder / "project.json"), str(html)])
    if code:
        return folder, ["build.py failed:\n" + log], []
    prefix = Path(tmp) / slug / "sheet-"
    prefix.parent.mkdir(parents=True)
    code, log = run([sys.executable, str(SKILL / "scripts" / "print.py"), str(html), str(dest / "sheet-set.pdf"), "--png", str(prefix)])
    print("[%s]\n%s" % (slug, log), flush=True)
    if code:
        return folder, ["print.py exited %d (layout audit or script errors):\n%s" % (code, log)], []
    shots = sorted(prefix.parent.glob("sheet-*.png"), key=lambda p: int(p.stem.split("-")[1]))
    return folder, [], shots


def finish_predrawn(browser, folder, tmp):
    """Print a pre-drawn set, check it and read its facts from the sheets themselves."""
    slug = folder.name
    page = browser.new_page(viewport={"width": 3600, "height": 2500})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto((OUT / slug / LIVE / "index.html").resolve().as_uri())
    page.evaluate("document.fonts.ready")
    page.add_style_tag(content="#set{zoom:1 !important}")   # the copy keeps the screen zoom it was saved at
    facts = page.evaluate("""() => {
        const t = (root, sel) => ((root.querySelector(sel) || {}).textContent || '').trim(), first = document.querySelector('.sheet');
        const over = [...document.querySelectorAll('[data-fit]')].filter(e => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)
            .map(e => (e.closest('.sheet')?.dataset.sheet || '?') + ' · ' + (e.closest('.panel')?.querySelector('.vn, .ph')?.textContent || e.className));
        return { sheets: document.querySelectorAll('.sheet').length, open: parseInt(t(first, '.tb-open b')) || 0,
                 numbers: [...document.querySelectorAll('.sheet')].map(s => s.dataset.sheet || ''),
                 names: [...document.querySelectorAll('.sheet')].map(s => t(s, '.tb-name div')),
                 title: t(first, '.tb-proj .pt'), headline: t(first, '.job h2'),
                 statusLabel: [...first.querySelectorAll('.tb-status b, .tb-status span')].map(e => e.textContent.trim()).filter(Boolean).slice(0, 2).join(', '),
                 scripts: document.querySelectorAll('script').length, images: document.querySelectorAll('img, image').length, over };
    }""")
    problems = (["script errors: " + "; ".join(errors)] if errors else []) + ["text overflows its box: " + o for o in facts["over"]]
    if facts["scripts"]:
        problems.append("a pre-drawn set holds no script, this one has %d" % facts["scripts"])
    if facts["images"]:
        problems.append("a pre-drawn example embeds no picture, this one has %d" % facts["images"])
    if not facts["sheets"]:
        problems.append("no sheets found")
    if problems:
        sys.exit("%s (pre-drawn set) did not pass:\n - %s" % (slug, "\n - ".join(problems)))
    shots = []
    for i in range(facts["sheets"]):
        shot = Path(tmp) / slug / ("sheet-%d.png" % i)
        shot.parent.mkdir(parents=True, exist_ok=True)
        page.locator(".sheet").nth(i).screenshot(path=str(shot))
        shots.append(shot)
    page.emulate_media(media="print")
    page.pdf(path=str(OUT / slug / "sheet-set.pdf"), print_background=True, prefer_css_page_size=True)
    page.close()
    meta = json.loads((folder / "example.json").read_text(encoding="utf-8")) if (folder / "example.json").is_file() else {}
    facts["thumb"] = facts["numbers"].index(meta["thumbSheet"]) if meta.get("thumbSheet") in facts["numbers"] else 0
    print("[%s]\npre-drawn set: %d sheets, no overflow, printed" % (slug, facts["sheets"]), flush=True)
    return facts, shots


def finish(results, sync_playwright, tmp):
    """Resize the previews and read the sheet count, the open items and the field sheet from each built set."""
    info = {}
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for folder, shots in results:
            slug = folder.name
            if predrawn(folder):
                facts, shots = finish_predrawn(browser, folder, tmp)
                for i, shot in enumerate(shots):
                    resize(browser, shot, OUT / slug / ("preview-%d.png" % i), PREVIEW_WIDTH)
                resize(browser, shots[facts["thumb"]], OUT / slug / "thumb.png", THUMB_WIDTH)
                info[slug] = facts
                continue
            page = browser.new_page(viewport={"width": 3600, "height": 2500})
            page.goto((OUT / slug / LIVE / "index.html").resolve().as_uri())
            page.wait_for_function("window.__ready === true", timeout=60000)
            facts = page.evaluate("""() => ({
                sheets: document.querySelectorAll('.sheet').length,
                open: typeof openItems === 'function' ? openItems(PROJECT).length : null,
                types: (PROJECT.sheets || []).map(s => s.type)})""")
            page.close()
            if len(shots) != facts["sheets"]:
                sys.exit("%s: %d sheets but %d preview pictures" % (slug, facts["sheets"], len(shots)))
            field = facts["types"].index("field") if "field" in facts["types"] else 0
            for i, shot in enumerate(shots):
                resize(browser, shot, OUT / slug / ("preview-%d.png" % i), PREVIEW_WIDTH)
            resize(browser, shots[field], OUT / slug / "thumb.png", THUMB_WIDTH)
            info[slug] = facts
        browser.close()
    return info


def resize(browser, src, dst, width):
    page = browser.new_page(viewport={"width": width, "height": 800}, device_scale_factor=1)
    uri = "data:image/png;base64," + base64.b64encode(src.read_bytes()).decode("ascii")
    page.set_content('<body style="margin:0"><img id="i" style="display:block;width:%dpx" src="%s"></body>' % (width, uri))
    page.wait_for_function("document.getElementById('i').complete")
    page.locator("#i").screenshot(path=str(dst))
    page.close()


def build_panel_kit(sync_playwright):
    """The panel schedule kit's sample sheet (panel-schedule-kit/), for its page under /kits/panel-schedule/:
    its own build_example.py, then a 36 x 24 in PDF, a 2400 px picture and a 1200 px thumbnail."""
    kit = ROOT / "panel-schedule-kit"
    code, log = run([sys.executable, str(kit / "example" / "build_example.py")])
    if code:
        sys.exit("The panel schedule kit's example did not build:\n" + log)
    dest = KITS / "panel-schedule"
    shutil.rmtree(dest, ignore_errors=True)
    (dest / "sheet").mkdir(parents=True)
    html = dest / "sheet" / "index.html"
    shutil.copyfile(kit / "example" / "panel-sheet.html", html)
    with sync_playwright() as pw, tempfile.TemporaryDirectory() as tmp:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 3456, "height": 2304})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(html.resolve().as_uri())
        page.wait_for_load_state("networkidle")
        page.evaluate("document.fonts.ready")
        if errors:
            sys.exit("The panel schedule sample has script errors:\n - " + "\n - ".join(errors))
        page.pdf(path=str(dest / "panel-sheet.pdf"), width="36in", height="24in", print_background=True, prefer_css_page_size=True)
        full = Path(tmp) / "full.png"
        page.locator(".sheet").screenshot(path=str(full))
        page.close()
        resize(browser, full, dest / "panel-sheet.png", PREVIEW_WIDTH)
        resize(browser, full, dest / "thumb.png", THUMB_WIDTH)
        browser.close()
    print("built the panel schedule kit sample: /kits/panel-schedule/sheet/")


def build_sheet_video(sync_playwright):
    """The sheet-video skill's example (skills/sheet-video/assets/example/), for its page under /kits/sheet-video/:
    the player built with the skill's build.py from the committed narration and timing (no voice model or ffmpeg
    needed), played through once for script errors, and a 1200 px poster frame."""
    video = ROOT / "skills" / "sheet-video"
    example = video / "assets" / "example"
    dest = KITS / "sheet-video"
    shutil.rmtree(dest, ignore_errors=True)
    (dest / "example").mkdir(parents=True)
    html = dest / "example" / "index.html"
    with tempfile.TemporaryDirectory() as tmp:
        brand = Path(tmp) / "brand.json"
        brand.write_text(json.dumps({"company": "Your Company", "tagline": "Plans you can read", "cta": "yourcompany.com",
                                     "logo": str(video / "assets" / "brand" / "logo.png"), "logoKnockout": False}), encoding="utf-8")
        code, log = run([sys.executable, str(video / "scripts" / "build.py"), str(example / "scenes.js"), str(html),
                         "--assets", str(example), "--timing", str(example / "timing.json"), "--mix", str(example / "narration.mp3"),
                         "--brand", str(brand), "--title", "Sheet video example"])
    if code:
        sys.exit("The sheet-video example did not build:\n" + log)
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1920, "height": 1136})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.goto(html.resolve().as_uri() + "?export=1&t=0")
        page.wait_for_timeout(500)
        total = page.evaluate("__player.total")
        t = 0.0
        while t <= total:
            page.evaluate("t => __player.seek(t)", t); t += 1.0
        if errors:
            sys.exit("The sheet-video example has script errors:\n - " + "\n - ".join(errors))
        page.evaluate("t => __player.seek(t)", 10.0)
        page.screenshot(path=str(dest / "poster-full.png"), clip={"x": 0, "y": 0, "width": 1920, "height": 1080})
        resize(browser, dest / "poster-full.png", dest / "poster.png", THUMB_WIDTH)
        (dest / "poster-full.png").unlink()
        browser.close()
    print("built the sheet-video example: /kits/sheet-video/example/ (%.0f s)" % total)


def front(title, description, edit, order):
    return "\n".join(["---", "title: " + json.dumps(title), "description: " + json.dumps(description),
                      "editUrl: " + json.dumps(edit), "sidebar:", "  order: %d" % order, "---", ""])


def esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def main():
    ap = argparse.ArgumentParser(description="Build every example sheet set and the gallery pages.")
    ap.add_argument("--jobs", type=int, default=3, help="examples printed at the same time")
    a = ap.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("The gallery build needs Playwright and Chromium: python -m pip install playwright, then python -m playwright install chromium")

    folders = sorted((f for f in SETS.iterdir() if (f / "project.json").is_file() or predrawn(f)), key=lambda f: (added(f), f.name))
    if not folders:
        sys.exit("No examples found in %s" % SETS)
    shutil.rmtree(OUT, ignore_errors=True)
    shutil.rmtree(PAGES, ignore_errors=True)
    OUT.mkdir(parents=True)
    PAGES.mkdir(parents=True)

    with tempfile.TemporaryDirectory() as tmp:
        with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, a.jobs)) as pool:
            done = list(pool.map(lambda f: build_one(f, tmp), folders))
        problems = [(f.name, p) for f, ps, _ in done for p in ps]
        if problems:
            for slug, p in problems:
                print("\nFAILED %s: %s" % (slug, p), file=sys.stderr)
            sys.exit("The example build failed: %d example(s) did not build or print clean." % len(problems))
        info = finish([(f, shots) for f, _, shots in done], sync_playwright, tmp)
    build_panel_kit(sync_playwright)
    build_sheet_video(sync_playwright)

    labels = status_labels()
    commit = git("rev-parse", "--short=7", "HEAD")
    version = json.loads((ROOT / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"))["version"]
    examples, cards = [], []
    for n, folder in enumerate(folders, 1):
        slug = folder.name
        facts = info[slug]
        if predrawn(folder):
            here = "%sexamples/%s/" % (BASE, slug)
            rel = "examples/sheet-sets/%s" % slug
            entry = {"slug": slug, "title": facts["title"] or slug, "headline": facts["headline"], "jobType": "pre-drawn", "status": "draft",
                     "statusLabel": facts["statusLabel"] or "Draft", "sheets": facts["sheets"], "openItems": facts["open"], "page": here,
                     "live": "%s%s/" % (here, LIVE), "pdf": here + "sheet-set.pdf", "thumb": here + "thumb.png",
                     "previews": [here + "preview-%d.png" % i for i in range(facts["sheets"])],
                     "source": "%s/tree/%s/%s" % (SITE["repo"], SITE["branch"], rel)}
            examples.append(entry)
            lines = [front(entry["title"], entry["headline"] or entry["title"], "%s/edit/%s/%s/README.md" % (SITE["repo"], SITE["branch"], rel), n),
                     "**%s**" % esc(entry["headline"]) if entry["headline"] else "", "",
                     "| | |", "|---|---|",
                     "| Status | %s |" % esc(entry["statusLabel"]),
                     "| Kind | Pre-drawn copy: finished sheets as plain HTML and SVG, view-only |",
                     "| Sheets | %d |" % entry["sheets"],
                     "| Open items | %d |" % entry["openItems"], "",
                     "[Open the set](/examples/%s/%s/) · [PDF](/examples/%s/sheet-set.pdf) · [About this example on GitHub](%s/blob/%s/%s/README.md)"
                     % (slug, LIVE, slug, SITE["repo"], SITE["branch"], rel), "",
                     "This set is published as a finished copy. It has no project file here yet, so it is not rebuilt by the site and has no **Edit** button.", ""]
            for i in range(entry["sheets"]):
                name = "%s %s" % (facts["numbers"][i], facts["names"][i] or "")
                lines += ["### %s" % esc(name.strip()), "", '<a href="/examples/%s/preview-%d.png"><img src="/examples/%s/preview-%d.png" alt="%s" loading="lazy" width="2400"></a>' % (slug, i, slug, i, esc(name.strip())), ""]
            (PAGES / (slug + ".md")).write_text("\n".join(lines), encoding="utf-8")
            cards.append('<a class="oasis-card" href="/examples/%s/"><img src="/examples/%s/thumb.png" alt="" loading="lazy" width="1200"><strong>%s</strong>%s<br><small>%s · %d sheets · pre-drawn copy</small></a>'
                         % (slug, slug, esc(entry["title"]), esc(entry["headline"]), esc(entry["statusLabel"]), entry["sheets"]))
            continue
        P = json.loads((folder / "project.json").read_text(encoding="utf-8"))
        proj, summ, status = P.get("project") or {}, P.get("summary") or {}, P.get("status") or "draft"
        job = P.get("jobType") or "sunroom"
        here = "%sexamples/%s/" % (BASE, slug)
        rel = "examples/sheet-sets/%s" % slug
        entry = {
            "slug": slug,
            "title": proj.get("title") or slug,
            "headline": summ.get("headline") or "",
            "jobType": job,
            "status": status,
            "statusLabel": labels.get(status, status),
            "sheets": facts["sheets"],
            "openItems": facts["open"] if facts["open"] is not None else len([o for o in P.get("openItems") or [] if not str(o.get("answer") or "").strip()]),
            "page": here,
            "live": "%s%s/" % (here, LIVE),
            "pdf": here + "sheet-set.pdf",
            "thumb": here + "thumb.png",
            "previews": [here + "preview-%d.png" % i for i in range(facts["sheets"])],
            "source": "%s/tree/%s/%s" % (SITE["repo"], SITE["branch"], rel),
        }
        examples.append(entry)

        own = sorted(p.name for p in folder.glob("*.js"))
        code = ["[`%s`](%s/blob/%s/%s/%s)" % (js, SITE["repo"], SITE["branch"], rel, js) for js in own] or \
               ["[`%s.js`](%s/blob/%s/skills/oasis-blueprints/assets/views/%s.js) (ships with the kit)" % (job, SITE["repo"], SITE["branch"], job)]
        sheet_names = [s.get("name") or s.get("no") or "" for s in P.get("sheets") or []]
        lines = [front(entry["title"], entry["headline"] or entry["title"], "%s/edit/%s/%s/project.json" % (SITE["repo"], SITE["branch"], rel), n),
                 "**%s**" % esc(entry["headline"]) if entry["headline"] else "", "",
                 "| | |", "|---|---|",
                 "| Status | %s (`%s`) |" % (entry["statusLabel"], status),
                 "| Job type | `%s` |" % job,
                 "| Sheets | %d |" % entry["sheets"],
                 "| Open items | %d |" % entry["openItems"], "",
                 "[Open the live set](/examples/%s/%s/) · [PDF](/examples/%s/sheet-set.pdf) · [`project.json` on GitHub](%s/blob/%s/%s/project.json) · Drawing code: %s"
                 % (slug, LIVE, slug, SITE["repo"], SITE["branch"], rel, ", ".join(code)), "",
                 "The live set is the built HTML. Its **Edit** button works in your browser and changes nothing here.", ""]
        for i in range(entry["sheets"]):
            name = sheet_names[i] if i < len(sheet_names) else "Sheet %d" % (i + 1)
            lines += ["### %s" % esc(name), "", '<a href="/examples/%s/preview-%d.png"><img src="/examples/%s/preview-%d.png" alt="%s" loading="lazy" width="2400"></a>' % (slug, i, slug, i, esc(name)), ""]
        (PAGES / (slug + ".md")).write_text("\n".join(lines), encoding="utf-8")
        cards.append('<a class="oasis-card" href="/examples/%s/"><img src="/examples/%s/thumb.png" alt="" loading="lazy" width="1200"><strong>%s</strong>%s<br><small>%s · %d sheet%s · <code>%s</code></small></a>'
                     % (slug, slug, esc(entry["title"]), esc(entry["headline"]), esc(entry["statusLabel"]), entry["sheets"], "" if entry["sheets"] == 1 else "s", esc(job)))

    kit_panel = json.loads((ROOT / "panel-schedule-kit" / "example" / "sample_panel.json").read_text(encoding="utf-8"))["panel"]
    index = [front("Gallery", "Every example sheet set in the repository, built, printed and audited when the site is built.",
                   "%s/tree/%s/examples/sheet-sets" % (SITE["repo"], SITE["branch"]), 0),
             "Each example below is a folder in [`examples/sheet-sets/`](%s/tree/%s/examples/sheet-sets). The site builds it with the skill's own "
             "scripts, prints it to PDF and runs the layout audit on every push; an example the audit flags stops the build. Names, addresses and "
             "numbers in the examples are placeholders. Oldest first." % (SITE["repo"], SITE["branch"]), "",
             '<div class="oasis-grid">', *cards, "</div>", "",
             "## Kits", "",
             "Separate kits beside the skill, with their own sample sheet.", "",
             '<div class="oasis-grid">',
             '<a class="oasis-card" href="/kits/panel-schedule/"><img src="/kits/panel-schedule/thumb.png" alt="" loading="lazy" width="1200">'
             "<strong>Panel schedule kit</strong>An electrical panel schedule laid out like the panel, with a matching riser diagram, "
             "for a house, ADU or tiny home.<br><small>Sample sheet · %d A · %d spaces</small></a>" % (kit_panel["serv"], kit_panel["slots"]),
             "</div>", ""]
    (PAGES / "index.md").write_text("\n".join(index), encoding="utf-8")

    manifest = {
        "version": version,
        "repo": SITE["repo"],
        "docs": BASE,
        "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "commit": commit,
        "examples": examples,
    }
    (SITE_DIR / "public" / "examples.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("built %d examples: %s" % (len(examples), ", ".join(e["slug"] for e in examples)))


if __name__ == "__main__":
    main()
