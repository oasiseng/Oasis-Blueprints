#!/usr/bin/env python3
"""Build the standalone skill ZIP from tracked skill and library resources."""
import argparse
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SKILL = Path("skills/oasis-blueprints")


def package(output):
    # Git's inventory excludes local scan data, caches, and generated outputs.
    files = subprocess.check_output(
        ["git", "ls-files", "-z", "--", str(SKILL), "library"], cwd=ROOT
    ).decode().split("\0")
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(filter(None, files)):
            source = Path(name)
            if any(p.startswith(".") or p == "__pycache__" for p in source.parts) or source.suffix == ".pyc":
                continue
            relative = (source.relative_to(SKILL) if source.is_relative_to(SKILL)
                        else Path("assets/library") / source.relative_to("library"))
            archive.write(ROOT / source, Path("oasis-blueprints") / relative)
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    print(package(parser.parse_args().output))
