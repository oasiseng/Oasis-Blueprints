"""The publishable plugin folder, plugin/. Needs no browser.

plugin/ is what Anthropic's directory reads and what an installed copy contains. These tests keep it current with the
skills and libraries it is built from, and inside the directory's published pre-submission rules.
Run from the repository root: python -m unittest tests.test_plugin_bundle -v
"""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugin"
sys.path.insert(0, str(ROOT / "scripts"))
import check_plugin  # noqa: E402


class PluginBundle(unittest.TestCase):
    def test_bundle_is_current(self):
        r = subprocess.run([sys.executable, str(ROOT / "scripts/build_plugin.py"), "--check"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr or r.stdout)

    def test_directory_rules(self):
        block, held = check_plugin.check()
        self.assertEqual(block, [], "these block a submission")
        self.assertEqual(held, [], "these hold a version for manual review")

    def test_marketplace_points_at_the_bundle(self):
        market = json.loads((ROOT / ".claude-plugin/marketplace.json").read_text(encoding="utf-8"))
        manifest = json.loads((PLUGIN / ".claude-plugin/plugin.json").read_text(encoding="utf-8"))
        entry = market["plugins"][0]
        self.assertEqual(entry["source"], "./plugin")
        self.assertEqual(entry["name"], manifest["name"])
        self.assertFalse((ROOT / ".claude-plugin/plugin.json").exists(), "the repository root is not a plugin folder")

    def test_privacy_link(self):
        readme = (PLUGIN / "README.md").read_text(encoding="utf-8")
        self.assertIn("[Privacy](https://github.com/oasiseng/Oasis-Blueprints/blob/main/plugin/PRIVACY.md)", readme)
        self.assertTrue((PLUGIN / "PRIVACY.md").is_file())

    def test_readme_discloses_what_the_scripts_fetch(self):
        readme = (PLUGIN / "README.md").read_text(encoding="utf-8")
        common = (PLUGIN / "skills/sheet-video/scripts/_common.py").read_text(encoding="utf-8")
        setup = (PLUGIN / "skills/sheet-video/scripts/setup.py").read_text(encoding="utf-8")
        self.assertIn("github.com/thewh1teagle/kokoro-onnx", common)
        self.assertIn("github.com/thewh1teagle/kokoro-onnx", readme)          # the download is disclosed
        for package in ("playwright", "pymupdf", "pillow", "numpy", "kokoro-onnx", "soundfile"):
            self.assertIn(package, setup)
            self.assertIn(package, readme)                                    # and so is every pip package
        self.assertIn("KOKORO_SHA256", setup)                                 # the download is checked

    def test_drawing_skill_builds_from_the_bundle_alone(self):
        # a set that uses a library detail, built by the bundled script from an unrelated folder
        index = json.loads((PLUGIN / "skills/oasis-blueprints/assets/library/details/typical/index.json").read_text(encoding="utf-8"))
        for d in index["details"]:
            self.assertTrue((PLUGIN / "skills/oasis-blueprints/assets/library/details/typical" / (d["id"] + ".json")).is_file(), d["id"])
        sample = json.loads((ROOT / "examples/sheet-sets/deck/project.json").read_text(encoding="utf-8")) \
            if (ROOT / "examples/sheet-sets/deck/project.json").is_file() else None
        if sample is None:
            self.skipTest("no deck sample in this checkout")
        with tempfile.TemporaryDirectory(prefix="oasis-plugin-test-") as tmp:
            src = Path(tmp) / "project.json"
            src.write_text(json.dumps(sample), encoding="utf-8")
            r = subprocess.run([sys.executable, str(PLUGIN / "skills/oasis-blueprints/scripts/build.py"), str(src), str(Path(tmp) / "out.html")],
                               cwd=tmp, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertGreater((Path(tmp) / "out.html").stat().st_size, 50000)


class DirectoryEdition(unittest.TestCase):
    """The code-free edition for the Claude plugin directory (scripts/build_plugin.py --lite)."""

    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="oasis-edition-")
        cls.root = Path(cls.temp.name)
        r = subprocess.run([sys.executable, str(ROOT / "scripts/build_plugin.py"), "--lite", str(cls.root)], capture_output=True, text=True)
        assert r.returncode == 0, r.stderr
        cls.plugin = cls.root / "plugin"

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_holds_only_what_an_unverified_organization_may_ship(self):
        block, held = check_plugin.check(self.plugin)
        self.assertEqual(block, [])
        self.assertEqual(held, [])
        self.assertEqual(check_plugin.community(self.plugin), [])
        suffixes = {p.suffix for p in self.plugin.rglob("*") if p.is_file()}
        self.assertLessEqual(suffixes, {".md", ".json", ".png", ""})

    def test_privacy_link(self):
        readme = (self.plugin / "README.md").read_text(encoding="utf-8")
        self.assertIn("[Privacy](https://github.com/oasiseng/Oasis-Blueprints/blob/claude-directory/plugin/PRIVACY.md)", readme)
        self.assertTrue((self.plugin / "PRIVACY.md").is_file())

    def test_says_it_does_not_draw(self):
        for name in ("README.md", "skills/oasis-blueprints/SKILL.md"):
            self.assertIn("does not draw the sheets", (self.plugin / name).read_text(encoding="utf-8"), name)
        manifest = json.loads((self.plugin / ".claude-plugin/plugin.json").read_text(encoding="utf-8"))
        self.assertIn("does not draw", manifest["description"])
        self.assertEqual(manifest["name"], "oasis-blueprints")

    def test_every_file_the_skill_names_is_there(self):
        import re
        skill = self.plugin / "skills/oasis-blueprints"
        text = (skill / "SKILL.md").read_text(encoding="utf-8")
        for link in re.findall(r"\]\(((?:references|assets)/[^)]+)\)", text):
            self.assertTrue((skill / link).is_file(), link)
        index = json.loads((skill / "assets/library/drawing-map/index.json").read_text(encoding="utf-8"))
        for group in index["groups"]:
            self.assertTrue((skill / "assets/library/drawing-map" / group["file"]).is_file(), group["file"])
        self.assertTrue(list((skill / "assets/library/details").glob("*/index.json")))


class ClawHubFolder(unittest.TestCase):
    """The drawing skill as a ClawHub skill folder (scripts/build_clawhub.py)."""

    def test_committed_folder_is_current(self):
        r = subprocess.run([sys.executable, str(ROOT / "scripts/build_clawhub.py"), "--check"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr or r.stdout)

    def test_folder(self):
        import yaml
        with tempfile.TemporaryDirectory(prefix="oasis-clawhub-") as tmp:
            r = subprocess.run([sys.executable, str(ROOT / "scripts/build_clawhub.py"), tmp], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            skill = Path(tmp) / "oasis-blueprints"
            front = yaml.safe_load((skill / "SKILL.md").read_text(encoding="utf-8").split("\n---\n")[0][4:])
            self.assertEqual(front["name"], "oasis-blueprints")
            self.assertRegex(str(front["version"]), r"^\d+\.\d+\.\d+$")
            self.assertEqual(front["metadata"]["openclaw"]["requires"]["anyBins"], ["python3", "python"])
            self.assertFalse((skill / "LICENSE.txt").exists(), "ClawHub publishes under MIT-0; no conflicting license file")
            self.assertTrue((skill / "assets/fonts/OFL.txt").is_file(), "the font license travels with the fonts")
            self.assertTrue((skill / "assets/library/details/typical/index.json").is_file())
            src = json.loads((skill / "assets/samples/deck/project.json").read_text(encoding="utf-8"))
            (Path(tmp) / "p.json").write_text(json.dumps(src), encoding="utf-8")
            r = subprocess.run([sys.executable, str(skill / "scripts/build.py"), str(Path(tmp) / "p.json"), str(Path(tmp) / "p.html")],
                               cwd=tmp, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)


if __name__ == "__main__":
    unittest.main()
