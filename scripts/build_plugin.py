#!/usr/bin/env python3
"""Build the publishable plugin folder, plugin/, from the tracked skills, agent and libraries.

    python scripts/build_plugin.py            # write plugin/skills, plugin/agents, plugin/LICENSE
    python scripts/build_plugin.py --check    # exit 1 if plugin/ is out of date

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
GENERATED = ("skills", "agents", "LICENSE")
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
    a = ap.parse_args()
    with tempfile.TemporaryDirectory(prefix="oasis-plugin-") as tmp:
        fresh = Path(tmp)
        left_out = build(fresh)
        if a.check:
            ok = all((PLUGIN / g).exists() for g in GENERATED) and filecmp.cmp(fresh / "LICENSE", PLUGIN / "LICENSE", shallow=False) \
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
