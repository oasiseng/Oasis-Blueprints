#!/usr/bin/env python3
"""docs_prebuild.py - prepare docs-site/ for `astro build`. Standard library only.

    python scripts/docs_prebuild.py

One source of truth: the Reference pages, the sheet standard, the changelog, the license and the
contributing page are not written twice. This script copies them from the files the repository
already ships into the Starlight content folder, adds the front matter Starlight needs and points
their relative links at the right place (another generated page, a copied picture, or the file on
GitHub). The panel schedule kit's README and DESIGN.md become its two pages under /kits/. It also copies the heading fonts and the example preview pictures, and writes the CNAME
file from docs-site/site.json. Everything it writes is listed in docs-site/.gitignore.

The examples gallery is written by scripts/build_examples.py, which needs a browser; this script
does not.
"""
import json, posixpath, re, shutil, sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SITE_DIR = ROOT / "docs-site"
DOCS = SITE_DIR / "src" / "content" / "docs"
PUBLIC = SITE_DIR / "public"
SITE = json.loads((SITE_DIR / "site.json").read_text(encoding="utf-8"))

# source file in the repository -> (page in the content folder, title shown on the site)
PAGES = {
    "skills/oasis-blueprints/references/project-file.md": ("reference/project-file", "Project file"),
    "skills/oasis-blueprints/references/writing-views.md": ("reference/drawing-api", "Drawing API and writing a job type"),
    "library/details/README.md": ("reference/detail-library", "Detail library"),
    "skills/oasis-blueprints/references/sheet-standard.md": ("concepts/sheet-standard", "The sheet standard"),
    "CHANGELOG.md": ("project/changelog", "Changelog"),
    "LICENSE": ("project/license", "License"),
    "CONTRIBUTING.md": ("project/contributing", "Contributing"),
    "panel-schedule-kit/README.md": ("kits/panel-schedule", "Panel schedule kit"),
    "panel-schedule-kit/DESIGN.md": ("kits/panel-schedule-design", "Panel schedule design rules"),
    "skills/sheet-video/SKILL.md": ("kits/sheet-video", "Sheet video"),
    "skills/sheet-video/references/player.md": ("kits/sheet-video-player", "Sheet video: scenes and player"),
    "skills/sheet-video/references/style-and-sound.md": ("kits/sheet-video-style", "Sheet video: style and sound"),
    "skills/sheet-video/references/brief-template.md": ("kits/sheet-video-brief", "Sheet video: brief template"),
}
# extra lines under the "generated page" note, for pages that have something built for them
LEAD = {
    "panel-schedule-kit/README.md": "**The sample sheet, rebuilt on every push:** [open it](/kits/panel-schedule/sheet/) · "
                                    "[PDF](/kits/panel-schedule/panel-sheet.pdf) · [picture](/kits/panel-schedule/panel-sheet.png). "
                                    "The styling rules are in [Panel schedule design rules](/kits/panel-schedule-design/).",
    "skills/sheet-video/SKILL.md": "**The example video, rebuilt on every push:** [play it](/kits/sheet-video/example/) "
                                   "(click Sound on). How to install it and make your own: [Make a video from a drawing set](/guides/make-a-video/).",
}
FONTS = ["barlow-condensed-latin-600-normal.woff2", "barlow-condensed-latin-700-normal.woff2"]
IMAGE = re.compile(r"\.(png|jpe?g|gif|svg|webp)$", re.I)
LINK = re.compile(r"(!?)\[([^\]]*)\]\(([^)\s]+)\)")


def site_path(page):
    return "/" + page.strip("/") + "/"


def github(path, kind="blob"):
    return "%s/%s/%s/%s" % (SITE["repo"], kind, SITE["branch"], path)


def copy_public(repo_path):
    """Copy a repository file under public/ref/ and return its address on the site."""
    src = ROOT / repo_path
    dst = PUBLIC / "ref" / repo_path
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    return "/ref/" + repo_path


def rewrite_link(source, bang, text, target):
    if re.match(r"^(?:[a-z][a-z0-9+.-]*:|#|/)", target, re.I):
        return "%s[%s](%s)" % (bang, text, target)
    path, _, anchor = target.partition("#")
    repo_path = posixpath.normpath(posixpath.join(posixpath.dirname(source), path)) if path else source
    if repo_path.startswith(".."):
        sys.exit("%s links outside the repository: %s" % (source, target))
    if repo_path in PAGES:
        url = site_path(PAGES[repo_path][0])
    elif (ROOT / repo_path).is_file() and (bang or IMAGE.search(repo_path)):
        url = copy_public(repo_path)
    elif (ROOT / repo_path).is_dir():
        url = github(repo_path, "tree")
    elif (ROOT / repo_path).is_file():
        url = github(repo_path)
    else:
        sys.exit("%s has a link to a file that does not exist: %s" % (source, target))
    return "%s[%s](%s%s)" % (bang, text, url, "#" + anchor if anchor else "")


def convert(source, page, title):
    text = (ROOT / source).read_text(encoding="utf-8")
    if not source.endswith(".md"):
        body = "```text\n" + text.rstrip("\n") + "\n```\n"
    else:
        lines = text.splitlines()
        if lines and lines[0] == "---":           # a skill's YAML front matter is not shown
            lines = lines[lines.index("---", 1) + 1:]
            while lines and not lines[0].strip():
                lines = lines[1:]
        if lines and lines[0].startswith("# "):   # the page title comes from the front matter
            lines = lines[1:]
        out, fenced = [], False
        for line in lines:
            if line.lstrip().startswith("```"):
                fenced = not fenced
            if not fenced:
                line = LINK.sub(lambda m: rewrite_link(source, m.group(1), m.group(2), m.group(3)), line)
            out.append(line)
        body = "\n".join(out).strip("\n") + "\n"
    front = ["---",
             "title: " + json.dumps(title),
             "description: " + json.dumps("Generated from %s in the repository." % source),
             "editUrl: " + json.dumps(github(source, "edit")),
             "---", "",
             ":::note[Generated page]",
             "This page is copied from [`%s`](%s) when the site is built. To change it, edit that file." % (source, github(source)),
             ":::", ""] + ([LEAD[source], ""] if source in LEAD else [])
    dst = DOCS / (page + ".md")
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text("\n".join(front) + "\n" + body, encoding="utf-8")


def main():
    for folder in ("reference", "project", "kits"):
        shutil.rmtree(DOCS / folder, ignore_errors=True)
    shutil.rmtree(PUBLIC / "ref", ignore_errors=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    host = urlparse(SITE["url"]).hostname
    (PUBLIC / "CNAME").write_text(host + "\n", encoding="utf-8")

    (PUBLIC / "fonts").mkdir(exist_ok=True)
    for name in FONTS:
        shutil.copyfile(ROOT / "skills" / "oasis-blueprints" / "assets" / "fonts" / name, PUBLIC / "fonts" / name)
    shutil.copyfile(ROOT / "skills" / "oasis-blueprints" / "assets" / "fonts" / "OFL.txt", PUBLIC / "fonts" / "OFL.txt")

    # the committed preview pictures of each example, used by the hand-written guides
    for png in sorted((ROOT / "examples" / "sheet-sets").glob("*/preview-*.png")):
        copy_public(png.relative_to(ROOT).as_posix())

    for source, (page, title) in PAGES.items():
        convert(source, page, title)
    print("prebuild: %d generated pages, CNAME %s" % (len(PAGES), host))


if __name__ == "__main__":
    main()
