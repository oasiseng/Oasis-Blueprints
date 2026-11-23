#!/usr/bin/env python3
"""Build the publishable plugin folder, plugin/, from the tracked skills, agent and libraries.

    python scripts/build_plugin.py            # write plugin/skills, plugin/agents, plugin/LICENSE
    python scripts/build_plugin.py --check    # exit 1 if plugin/ is out of date
    python scripts/build_plugin.py --lite DIR # write the code-free directory edition into DIR/plugin

plugin/ is what Anthropic's directory reads and what a person who installs the plugin gets, so it holds only what
the plugin needs: the two skills, the agent, and the detail library and drawing map inside the drawing skill (the
same layout as the standalone skill ZIP). The examples, the documentation site, the kits and the tests stay in the
repository. plugin/.claude-plugin/plugin.json and plugin/README.md are written by hand and are not touched here.

Left out of the bundle, because the directory holds a version for manual review over them:
  - any file that is not text, an image or a font (the example narration .mp3)
  - any text file over 256 KiB (two very large library details; they stay in library/ in the repository)
"""
import argparse
import filecmp
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugin"
GENERATED = ("skills", "agents", "LICENSE", "PRIVACY.md")
MAX_TEXT = 256 * 1024
IMAGE_OR_FONT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".woff", ".woff2", ".ttf", ".otf"}
TEXT = {".md", ".txt", ".json", ".js", ".py", ".css", ".html", ".yaml", ".yml", ".svg"}


def tracked(*paths):
    out = subprocess.check_output(["git", "ls-files", "-z", "--", *paths], cwd=ROOT).decode().split("\0")
    return [Path(p) for p in sorted(filter(None, out))]


def wanted(path):
    """-> None to ship the file, or the reason it is left out."""
    if any(part.startswith(".") or part == "__pycache__" for part in path.parts) or path.suffix == ".pyc":
        return "hidden or cache file"
    suffix = path.suffix.lower()
    if suffix in IMAGE_OR_FONT:
        return None
    if suffix not in TEXT:
        return "not text, an image or a font"
    if (ROOT / path).stat().st_size > MAX_TEXT:
        return "text file over 256 KiB"
    return None


def build(dest):
    left_out = []
    for source in tracked("skills", "agents", "library"):
        why = wanted(source)
        if why:
            if not why.startswith("hidden"):
                left_out.append((str(source), why))
            continue
        target = (Path("skills/oasis-blueprints/assets/library") / source.relative_to("library")
                  if source.parts[0] == "library" else source)
        (dest / target).parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / source, dest / target)
    shutil.copyfile(ROOT / "LICENSE", dest / "LICENSE")
    shutil.copyfile(ROOT / "PRIVACY.md", dest / "PRIVACY.md")
    # a detail that is left out is taken off the collection's index and its README table, so the bundle lists only what it holds
    gone = {Path(name).stem for name, _ in left_out if "/details/" in name}
    library = dest / "skills/oasis-blueprints/assets/library/details"
    for index in library.glob("*/index.json"):
        data = json.loads(index.read_text(encoding="utf-8"))
        kept = [d for d in data.get("details", []) if d.get("id") not in gone]
        if len(kept) != len(data.get("details", [])):
            data["details"] = kept
            if "count" in data:
                data["count"] = len(kept)
            index.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    readme = library / "README.md"
    if readme.exists() and gone:
        lines = [l for l in readme.read_text(encoding="utf-8").splitlines() if not any("`%s`" % g in l for g in gone)]
        readme.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return left_out


LITE_NOTE = ("> This reference comes from the full Oasis Blueprints edition. The scripts and view files it names "
             "(`build.py`, `print.py`, `assets/views/`, `assets/kit/`) are part of that edition, not this one. "
             "Use it here for the format of the project file.\n\n")


def build_lite(dest):
    """The directory edition for an organization that is not Verified: Markdown, JSON and the icon only.
    dest/plugin is the plugin folder; dest itself is the root of the branch the directory tracks."""
    plugin = dest / "plugin"
    skill = plugin / "skills" / "oasis-blueprints"
    def put(source, target, prefix=""):
        target.parent.mkdir(parents=True, exist_ok=True)
        if prefix:
            target.write_text(prefix + (ROOT / source).read_text(encoding="utf-8"), encoding="utf-8")
        else:
            shutil.copyfile(ROOT / source, target)
    put("directory-edition/SKILL.md", skill / "SKILL.md")
    put("directory-edition/README.md", plugin / "README.md")
    put("LICENSE", plugin / "LICENSE")
    put("PRIVACY.md", plugin / "PRIVACY.md")
    put("plugin/.claude-plugin/icon.png", plugin / ".claude-plugin" / "icon.png")
    put("skills/oasis-blueprints/references/sheet-standard.md", skill / "references" / "sheet-standard.md")
    text = (ROOT / "skills/oasis-blueprints/references/project-file.md").read_text(encoding="utf-8")
    head, _, rest = text.partition("\n")
    (skill / "references" / "project-file.md").write_text(head + "\n\n" + LITE_NOTE + rest.lstrip("\n"), encoding="utf-8")
    put("skills/oasis-blueprints/assets/brand.example.json", skill / "assets" / "brand.example.json")
    for source in tracked("skills/oasis-blueprints/assets/samples", "library"):
        rel = source.relative_to("library") if source.parts[0] == "library" else None
        if source.suffix != ".json" or any(part.startswith(".") for part in source.parts):
            continue
        if rel is None:
            put(source, skill / "assets" / "samples" / source.relative_to("skills/oasis-blueprints/assets/samples"))
        elif rel.parts[0] == "details" and source.name != "index.json":
            continue                                     # the detail drawings need the kit; the index is what planning uses
        else:
            put(source, skill / "assets" / "library" / rel)
    manifest = json.loads((ROOT / "plugin/.claude-plugin/plugin.json").read_text(encoding="utf-8"))
    manifest["description"] = ("Plan or review a construction drawing set: the sheet list for a project type, candidate standard "
                               "details, the open questions for the engineer, and the project file a set is built from. "
                               "This edition does not draw the sheets; the free full edition does.")
    manifest["keywords"] = [k for k in manifest.get("keywords", []) if k != "video"] + ["plan-review"]
    (plugin / ".claude-plugin" / "plugin.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (dest / "README.md").write_text(
        "# Oasis Blueprints: directory edition\n\nThis branch is built from `main` by `scripts/build_plugin.py --lite` "
        "and published by a workflow. Do not edit it by hand.\n\n`plugin/` is the edition of the plugin that the Claude "
        "plugin directory lists: instructions and reference data only, no code. The full plugin, the examples and the "
        "documentation are on the [main branch](https://github.com/oasiseng/Oasis-Blueprints).\n", encoding="utf-8")
    shutil.copyfile(ROOT / "LICENSE", dest / "LICENSE")


def same(a, b):
    c = filecmp.dircmp(a, b)
    if c.left_only or c.right_only or c.funny_files:
        return False
    if any(not filecmp.cmp(Path(a) / f, Path(b) / f, shallow=False) for f in c.common_files):
        return False
    return all(same(Path(a) / d, Path(b) / d) for d in c.common_dirs)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--lite", metavar="FOLDER", type=Path, help="write the code-free directory edition into FOLDER (FOLDER/plugin)")
    a = ap.parse_args()
    if a.lite:
        for name in ("plugin", "README.md", "LICENSE"):
            old = a.lite / name
            if old.is_dir():
                shutil.rmtree(old)
            elif old.exists():
                old.unlink()
        a.lite.mkdir(parents=True, exist_ok=True)
        build_lite(a.lite)
        files = [p for p in (a.lite / "plugin").rglob("*") if p.is_file()]
        print("wrote %s: %d files, %.0f KB" % (a.lite / "plugin", len(files), sum(p.stat().st_size for p in files) / 1e3))
        return
    with tempfile.TemporaryDirectory(prefix="oasis-plugin-") as tmp:
        fresh = Path(tmp)
        left_out = build(fresh)
        if a.check:
            ok = all((PLUGIN / g).exists() for g in GENERATED) and all(filecmp.cmp(fresh / f, PLUGIN / f, shallow=False) for f in ("LICENSE", "PRIVACY.md")) \
                and all(same(fresh / g, PLUGIN / g) for g in ("skills", "agents"))
            sys.exit(0 if ok else "plugin/ is out of date: run python scripts/build_plugin.py")
        for g in GENERATED:
            target = PLUGIN / g
            if target.is_dir():
                shutil.rmtree(target)
            elif target.exists():
                target.unlink()
            (shutil.copytree if (fresh / g).is_dir() else shutil.copyfile)(fresh / g, target)
    files = [p for p in PLUGIN.rglob("*") if p.is_file()]
    print("wrote plugin/: %d files, %.1f MB" % (len(files), sum(p.stat().st_size for p in files) / 1e6))
    for name, why in left_out:
        print("  left out: %s (%s)" % (name, why))


if __name__ == "__main__":
    main()
