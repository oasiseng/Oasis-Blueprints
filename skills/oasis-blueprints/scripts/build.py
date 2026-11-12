#!/usr/bin/env python3
"""build.py - one project file in, one self-contained HTML sheet set out.

    python build.py project.json sheet-set.html [--brand brand.json] [--view my-job.js]

Standard library only, no network. The HTML holds the fonts, the drawing code and the project,
so it opens in any browser, can be edited there (Edit button), and prints to a 36 x 24 in PDF.

Company details: --brand FILE, else brand.json beside the project file, else brand.json in the
current folder. Anything set under "firm" in the project file wins over the brand file.

Job type: the project's "jobType" picks the drawing code. --view FILE, else views/<jobType>.js or
<jobType>.js beside the project file, else the views that ship with the kit.
"""
import argparse, base64, datetime, json, mimetypes, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = next(p for p in (os.path.join(HERE, "..", "assets"), HERE) if os.path.isdir(os.path.join(p, "kit")))
FONTS = [("Barlow", "barlow", [400, 500, 600, 700]),
         ("Barlow Condensed", "barlow-condensed", [600, 700]),
         ("Barlow Semi Condensed", "barlow-semi-condensed", [500, 600, 700])]


def read(*parts):
    with open(os.path.join(*parts), encoding="utf-8") as f:
        return f.read()


def data_uri(path):
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode("ascii"))


def main():
    ap = argparse.ArgumentParser(description="Build a self-contained HTML sheet set from a project file.")
    ap.add_argument("project")
    ap.add_argument("out")
    ap.add_argument("--brand", help="brand.json with the company block and logo")
    ap.add_argument("--view", help="drawing code for this job type (a .js file)")
    a = ap.parse_args()
    try:
        P = json.loads(read(a.project))
    except ValueError as e:
        sys.exit("The project file is not valid JSON: %s" % e)
    pdir = os.path.dirname(os.path.abspath(a.project))

    missing = [k for k in ("project", "summary", "geometry") if not isinstance(P.get(k), dict)]
    if missing or not (P.get("project") or {}).get("title"):
        sys.exit("The project file needs: %s" % ", ".join(missing or ["project.title"]))
    P.setdefault("status", "draft")
    P.setdefault("people", {})
    P.setdefault("issue", {}).setdefault("date", datetime.date.today().isoformat())
    for k in ("facts", "steps", "scope", "notes", "criteria", "openItems"):
        P.setdefault(k, [])
    if not P.get("sheets"):
        P["sheets"] = [{"no": "S0.0", "type": "cover", "name": "Cover, scope and notes", "what": "Scope, notes, criteria and open items."},
                       {"no": "S1.0", "type": "field", "name": "Plan, section and details", "what": "The picture, the steps, the plan, the section and each connection."}]
    keys = [o.get("key") for o in P["openItems"] if o.get("key")]
    dup = sorted({k for k in keys if keys.count(k) > 1})
    if dup:
        sys.exit("Open item keys must be unique. Repeated: %s" % ", ".join(dup))

    brand, bdir = {}, pdir
    for cand in (a.brand, os.path.join(pdir, "brand.json"), "brand.json"):
        if cand and os.path.exists(cand):
            brand = json.loads(read(cand))
            bdir = os.path.dirname(os.path.abspath(cand))
            break
    if a.brand and not brand:
        sys.exit("Brand file not found: %s" % a.brand)
    firm = dict(brand.get("firm", brand))
    firm.update({k: v for k, v in (P.get("firm") or {}).items() if v not in ("", None, [])})
    logo = firm.get("logo")
    if logo and not str(logo).startswith("data:"):
        path = next((p for p in (logo, os.path.join(pdir, logo), os.path.join(bdir, logo)) if os.path.exists(p)), None)
        if path:
            firm["logo"] = data_uri(path)
        else:
            print("warning: logo file not found: %s (using the wordmark instead)" % logo, file=sys.stderr)
            firm.pop("logo")
    P["firm"] = firm

    job = P.get("jobType") or "sunroom"
    cands = [a.view, os.path.join(pdir, "views", job + ".js"), os.path.join(pdir, job + ".js"), os.path.join(KIT, "views", job + ".js")]
    view = next((p for p in cands if p and os.path.exists(p)), None)
    if not view:
        have = sorted(f[:-3] for f in os.listdir(os.path.join(KIT, "views")) if f.endswith(".js"))
        sys.exit('No drawing code for jobType "%s". The kit ships: %s. Write %s.js beside the project file '
                 "(see references/writing-views.md) or pass --view." % (job, ", ".join(have), job))

    faces = ""
    for fam, pkg, weights in FONTS:
        for w in weights:
            faces += '@font-face{font-family:"%s";font-weight:%d;font-style:normal;src:url(%s) format("woff2")}\n' % (
                fam, w, data_uri(os.path.join(KIT, "fonts", "%s-latin-%d-normal.woff2" % (pkg, w))))

    html = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sheet set</title>
<style>
%s%s
</style></head><body>
<div id="set"></div><div id="audit"></div>
<script type="application/json" id="project">%s</script>
<script>
%s
%s
%s
%s
SRC_HTML = document.documentElement.outerHTML;
const PROJECT = JSON.parse(document.getElementById('project').textContent);
window.__errors = [];
try { renderSet(PROJECT); } catch (e) { window.__errors.push(String(e && e.stack || e)); document.getElementById('audit').textContent = 'The drawing code failed: ' + e; }
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
  try { fitViews(); window.__audit = audit(PROJECT); EDITOR.init(); } catch (e) { window.__errors.push(String(e && e.stack || e)); }
  window.__ready = true;
});
</script></body></html>
""" % (faces, read(KIT, "kit", "sheet.css"), json.dumps(P, ensure_ascii=False).replace("<", "\\u003c"),
       read(KIT, "kit", "kit.js"), read(KIT, "kit", "layout.js"), read(view), read(KIT, "kit", "editor.js"))

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(html)
    n = len([o for o in P["openItems"] if not str(o.get("answer") or "").strip()])
    print("built %s (%d KB, job type %s from %s, %d open item%s)" % (a.out, len(html.encode("utf-8")) // 1024, job, os.path.relpath(view), n, "" if n == 1 else "s"))


if __name__ == "__main__":
    main()
