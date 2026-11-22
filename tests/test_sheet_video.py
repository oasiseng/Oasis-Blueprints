"""The sheet-video skill builds a playable video from its example. Needs Playwright and Chromium, not
the voice model, ffmpeg or numpy: the example is built as a silent draft with estimated timing.

Run from the repository root: python -m unittest tests.test_sheet_video -v
"""
import json, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills" / "sheet-video"
SCRIPTS = SKILL / "scripts"
EXAMPLE = SKILL / "assets" / "example"


def run(*args):
    return subprocess.run([sys.executable, *map(str, args)], cwd=SCRIPTS, capture_output=True, text=True)


class SheetVideoTests(unittest.TestCase):
    def test_example_builds_and_plays_clean(self):
        with tempfile.TemporaryDirectory() as d:
            work = Path(d)
            r = run(SCRIPTS / "audio.py", EXAMPLE / "script.json", work, "--no-voice", "--music", "off")
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            timing = json.loads((work / "timing.json").read_text())
            self.assertEqual(len(timing["scenes"]), 4)
            self.assertTrue(all(s["caps"] for s in timing["scenes"]), "every scene has captions")
            brand = work / "brand.json"
            brand.write_text(json.dumps({"company": "Your Company", "tagline": "Plans you can read", "cta": "yourcompany.com",
                                         "logo": str(SKILL / "assets" / "brand" / "logo.png"), "logoKnockout": False}))
            html = work / "video.html"
            r = run(SCRIPTS / "build.py", EXAMPLE / "scenes.js", html, "--assets", EXAMPLE, "--timing", work / "timing.json",
                    "--brand", brand, "--title", "Example")
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            text = html.read_text()
            self.assertNotIn("/*__DATA__*/", text); self.assertNotIn("/*__BRAND_CSS__*/", text); self.assertNotIn("{{TITLE}}", text)
            r = run(SCRIPTS / "check.py", html, "--step", "0.5", "--reduced")
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertIn("clean", r.stdout)

    def test_brand_example_and_scripts_are_complete(self):
        brand = json.loads((SKILL / "assets" / "brand" / "brand.example.json").read_text())
        for key in ("company", "tagline", "cta", "logo", "colors"):
            self.assertIn(key, brand)
        for name in ("setup", "capture_pdf", "capture_html", "find_text", "crop", "tts", "audio", "beat", "build", "check", "export_mp4"):
            r = run(SCRIPTS / (name + ".py"), "--help")
            self.assertEqual(r.returncode, 0, name + ": " + r.stderr)


if __name__ == "__main__":
    unittest.main()
