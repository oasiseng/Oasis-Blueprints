#!/usr/bin/env python3
"""Build the drawing skill as a ClawHub skill folder: <out>/oasis-blueprints/

    python scripts/build_clawhub.py dist/clawhub

The folder is the standalone skill (skills/oasis-blueprints plus the libraries under assets/library, the same as the
release ZIP) with three changes for ClawHub (https://docs.openclaw.ai/clawhub/skill-format):
  - SKILL.md front matter gains `version` and an OpenClaw `metadata` block (needs python3 or python on PATH), and
    script paths in its commands start from {baseDir}, which OpenClaw sets to the skill folder.
  - No LICENSE.txt. ClawHub publishes every skill under MIT-0 and refuses license terms that conflict with it.
    The Barlow fonts keep their own SIL Open Font License (assets/fonts/OFL.txt), which the font license requires.
  - Left out: agents/ (metadata for another client) and the drawing map's maintenance tool (library/drawing-map/tools),
    which the skill never runs.
"""
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SKILL = Path("skills/oasis-blueprints")
LEAVE_OUT = (SKILL / "LICENSE.txt", SKILL / "agents", Path("library/drawing-map/tools"))


def tracked(*paths):
    out = subprocess.check_output(["git", "ls-files", "-z", "--", *paths], cwd=ROOT).decode().split("\0")
    return [Path(p) for p in sorted(filter(None, out))]


def front_matter(text, version):
    head, sep, body = text.partition("\n---\n")
    assert text.startswith("---\n") and sep, "SKILL.md has no front matter"
    lines = dict(l.split(":", 1) for l in head[4:].splitlines() if ":" in l)
    name, description = lines["name"].strip(), lines["description"].strip()
    meta = ('metadata:\n  {\n    "openclaw":\n      {\n        "emoji": "📐",\n'
            '        "homepage": "https://docs.oasisengineering.com",\n'
            '        "requires": { "anyBins": ["python3", "python"] },\n      },\n  }\n')
    return "---\nname: %s\ndescription: %s\nversion: %s\nhomepage: https://docs.oasisengineering.com\n%s---\n%s" % (
        name, description, version, meta, body)


def build(out):
    dest = out / "oasis-blueprints"
    if dest.exists():
        shutil.rmtree(dest)
    version = json.loads((ROOT / "plugin/.claude-plugin/plugin.json").read_text(encoding="utf-8"))["version"]
    for source in tracked(str(SKILL), "library"):
        if any(part.startswith(".") or part == "__pycache__" for part in source.parts) or source.suffix == ".pyc":
            continue
        if any(source == p or p in source.parents for p in LEAVE_OUT):
            continue
        target = dest / (source.relative_to(SKILL) if source.is_relative_to(SKILL) else Path("assets/library") / source.relative_to("library"))
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / source, target)
    skill_md = dest / "SKILL.md"
    text = front_matter(skill_md.read_text(encoding="utf-8"), version)
    for old, new in (
        ("Keep these resources and [LICENSE.txt](LICENSE.txt) with the skill.", "Keep these resources with the skill."),
        ("python scripts/build.py ", "python {baseDir}/scripts/build.py "),
        ("python scripts/print.py ", "python {baseDir}/scripts/print.py "),
        ("Resolve the script paths relative to this skill's installed folder.",
         "`{baseDir}` is this skill's installed folder."),
    ):
        assert old in text, "SKILL.md changed: " + old
        text = text.replace(old, new)
    skill_md.write_text(text, encoding="utf-8")
    return dest


if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist" / "clawhub"
    dest = build(out)
    files = [p for p in dest.rglob("*") if p.is_file()]
    print("wrote %s: %d files, %.1f MB" % (dest, len(files), sum(p.stat().st_size for p in files) / 1e6))
