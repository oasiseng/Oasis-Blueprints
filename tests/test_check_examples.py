"""scripts/check_examples.py: the guard run before the documentation site publishes the examples. Needs no browser."""
import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "check_examples.py"


def run(root, denylist=None):
    env = dict(os.environ)
    env.pop("ANON_DENYLIST", None)
    if denylist is not None:
        env["ANON_DENYLIST"] = denylist
    return subprocess.run([sys.executable, str(SCRIPT), "--root", str(root)], capture_output=True, text=True, env=env)


class CheckExamplesTests(unittest.TestCase):
    def test_the_repository_examples_pass(self):
        p = run(ROOT)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)

    def make(self, tmp, project, extra=None):
        folder = Path(tmp) / "examples" / "sheet-sets" / "job"
        folder.mkdir(parents=True)
        (folder / "project.json").write_text(json.dumps(project), encoding="utf-8")
        for name, body in (extra or {}).items():
            (folder / name).write_bytes(body)
        return Path(tmp)

    def test_each_rule_fails(self):
        cases = [
            ({"firm": {"name": "Real Engineering LLC"}}, None, "firm name"),
            ({"firm": {"name": "Your Company"}}, {"brand.json": b"{}"}, "brand file"),
            ({}, {"company-logo.png": b"x"}, "logo file"),
            ({"notes": ["Call owner@realhomes.com"]}, None, "email address"),
            ({"notes": ["Call (305) 555-0142"]}, None, "phone number"),
            ({"project": {"address": "4821 NW Palmetto Ridge Drive"}}, None, "street address"),
            ({"property": {"maps": [{"src": "data:image/png;base64,AAAA"}]}}, None, "raster image"),
        ]
        for project, extra, words in cases:
            with tempfile.TemporaryDirectory() as tmp:
                p = run(self.make(tmp, project, extra))
                self.assertEqual(p.returncode, 1, words)
                self.assertIn(words, p.stdout)

    def test_placeholders_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = run(self.make(tmp, {"firm": {"name": "Your Company"}, "project": {"address": "123 Example St"}}))
            self.assertEqual(p.returncode, 0, p.stdout)

    def test_denylist_match_never_prints_the_term(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = self.make(tmp, {"project": {"title": "Garage for the Quackenbush job"}})
            p = run(root, "\nnothing-here\nquackenbush\n")
            self.assertEqual(p.returncode, 1)
            self.assertIn("matched a deny-list term", p.stdout)
            self.assertNotIn("quackenbush", (p.stdout + p.stderr).lower())
            self.assertEqual(run(root, "someone-else\n").returncode, 0)


if __name__ == "__main__":
    unittest.main()
