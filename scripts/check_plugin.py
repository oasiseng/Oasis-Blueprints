#!/usr/bin/env python3
"""Check plugin/ against the Claude plugin directory's published pre-submission rules.

    python scripts/check_plugin.py

Covers the rules that can be checked from the files alone: the layout, the manifest and name, the README and
license, the file limits, and the things that hold a version for manual review. It does not replace the portal's
own Validate button or `claude plugin validate --strict ./plugin`; run those too.
Source of the rules: https://claude.com/docs/plugins/pre-submission-checklist
"""
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugin"
IMAGE_OR_FONT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".woff", ".woff2", ".ttf", ".otf"}
TEXT = {".md", ".txt", ".json", ".js", ".py", ".css", ".html", ".yaml", ".yml", ".svg", ""}
SYSTEM = {".DS_Store", "Thumbs.db", "desktop.ini", "__MACOSX"}
RESERVED = {"claude", "anthropic", "official", "plugin", "mcp", "test"}
DEVICE = re.compile(r"^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$", re.I)
LAUNCHER = re.compile(r"\b(npx|bunx|pnpm dlx|yarn dlx|uvx|pipx run|uv run)\b")


def check(plugin=PLUGIN):
    """-> (blocking, held): two lists of messages."""
    block, held = [], []
    files = [p for p in plugin.rglob("*") if p.is_file()]
    rel = lambda p: p.relative_to(plugin).as_posix()
    manifest_path = plugin / ".claude-plugin" / "plugin.json"
    if not manifest_path.is_file():
        return ["no .claude-plugin/plugin.json"], held
    m = json.loads(manifest_path.read_text(encoding="utf-8"))

    name = m.get("name", "")
    if not re.fullmatch(r"[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?", name):
        block.append("name must be lowercase letters, digits and hyphens, up to 64 characters: %r" % name)
    if name in RESERVED:
        block.append("name is a reserved word: %r" % name)
    for key in ("description", "author", "version"):
        if not m.get(key):
            block.append("plugin.json has no %s" % key)       # a warning in the portal; treated as required here
    for key in ("displayName",):
        if m.get(key) and not m[key].isascii():
            block.append("%s must be in one writing system without look-alike letters" % key)
    if not (m.get("author") or {}).get("name", "").isascii():
        block.append("author.name must be in one writing system")
    for key in ("hooks", "mcpServers", "commands", "agents", "skills"):
        value = m.get(key)
        for path in ([value] if isinstance(value, str) else value if isinstance(value, list) else []):
            if isinstance(path, str) and (path.startswith("/") or ".." in Path(path).parts):
                block.append("plugin.json %s points outside the plugin folder: %s" % (key, path))

    readme = next((plugin / n for n in ("README.md", "README", "readme.md") if (plugin / n).is_file()), None)
    if not readme:
        block.append("README missing")
    else:
        prose = re.sub(r"```.*?```", " ", readme.read_text(encoding="utf-8"), flags=re.S)
        if len(prose.split()) < 40:
            block.append("README too short: under 40 words outside code blocks")
    if not (plugin / "LICENSE").is_file() and not m.get("license"):
        block.append("License missing")

    lowered = {}
    for p in files:
        r = rel(p)
        for part in Path(r).parts:
            if part in SYSTEM:
                block.append("system file: " + r)
            if ":" in part or part.endswith((".", " ")) or DEVICE.match(part):
                block.append("name not valid on Windows and macOS: " + r)
        if lowered.setdefault(r.lower(), r) != r:
            block.append("two names differ only by capitalization: %s, %s" % (lowered[r.lower()], r))
        if p.is_symlink():
            block.append("symbolic link: " + r)
        size, suffix = p.stat().st_size, p.suffix.lower()
        if size > 5 * 1024 * 1024:
            block.append("file over 5 MiB: " + r)
        if suffix in IMAGE_OR_FONT:
            continue
        if suffix not in TEXT:
            held.append("not text, an image or a font: " + r)
        elif size > 256 * 1024:
            held.append("text file over 256 KiB: " + r)
        if p.name in (".npmrc", "bunfig.toml", "uv.toml"):
            held.append("package-manager configuration: " + r)
        if p.name in ("package-lock.json", "npm-shrinkwrap.json", "bun.lock", "bun.lockb") and p.parent == plugin:
            held.append("lockfile install: " + r)
        if p.suffix in (".mcpb", ".dxt"):
            held.append("bundled MCP server: " + r)
    if len(files) > 512:
        held.append("more than 512 files: %d" % len(files))
    if (plugin / ".gitattributes").exists() or (ROOT / ".gitattributes").exists():
        text = "".join(p.read_text() for p in (plugin / ".gitattributes", ROOT / ".gitattributes") if p.exists())
        if re.search(r"export-ignore|export-subst|filter=", text):
            block.append(".gitattributes uses export-ignore, export-subst or a filter")

    for cfg in ("hooks/hooks.json", ".mcp.json"):
        path = plugin / cfg
        if path.is_file():
            text = path.read_text(encoding="utf-8")
            try:
                json.loads(text)
            except ValueError:
                block.append(cfg + " is not valid JSON")
            if LAUNCHER.search(text):
                held.append(cfg + " runs a package launcher")

    for p in files:
        if p.name == "SKILL.md" or p.parent.name in ("agents", "commands") and p.suffix == ".md" and p.parent.parent == plugin:
            text = p.read_text(encoding="utf-8")
            front = re.match(r"---\n(.*?)\n---\n", text, flags=re.S)
            if not front:
                block.append("no front matter: " + rel(p))
            elif not re.search(r"^description:\s*\S", front.group(1), flags=re.M):
                block.append("front matter has no text description: " + rel(p))
    for skill in (plugin / "skills").iterdir() if (plugin / "skills").is_dir() else []:
        if skill.is_dir() and not (skill / "SKILL.md").is_file():
            block.append("skill folder without SKILL.md: " + rel(skill))
    return block, held


COMMUNITY = {".md", ".txt", ".json", ".yaml", ".yml", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ""}


def verified_only(plugin=PLUGIN):
    """Files the directory accepts only from a Verified organization: anything that is not Markdown, text, JSON, YAML or
    a PNG, JPEG, GIF, WebP or ICO image, and any file that starts with #!. -> {reason: [paths]}"""
    out = {}
    for p in sorted(plugin.rglob("*")):
        if not p.is_file():
            continue
        r = p.relative_to(plugin).as_posix()
        if p.suffix.lower() not in COMMUNITY:
            out.setdefault(p.suffix.lower() + " files", []).append(r)
        elif p.read_bytes()[:2] == b"#!":
            out.setdefault("files that start with #!", []).append(r)
    return out


if __name__ == "__main__":
    block, held = check()
    restricted = verified_only()
    if restricted:
        print("VERIFIED ORGANIZATION REQUIRED. The directory refuses these from an organization that is not Verified:")
        for reason, paths in restricted.items():
            print("  %3d %s" % (len(paths), reason))
        print("  Request it in the developer portal: Help and appeals, then Request verified.")
    for line in block:
        print("BLOCKS  ", line)
    for line in held:
        print("HELD    ", line)
    n = sum(1 for p in PLUGIN.rglob("*") if p.is_file())
    print("plugin/: %d files. %d blocking, %d that hold a version for manual review." % (n, len(block), len(held)))
    sys.exit(1 if block or held else 0)
