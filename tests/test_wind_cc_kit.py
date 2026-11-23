"""The wind components and cladding kit (wind-cc-kit/). Needs Node; skipped without it. Needs no browser.

Runs the kit's verification cases, renders the sample, and checks that the built sample page is current.
Run from the repository root: python -m unittest tests.test_wind_cc_kit -v
"""
from pathlib import Path
import json
import shutil
import subprocess
import unittest

KIT = Path(__file__).resolve().parents[1] / "wind-cc-kit"
NODE = shutil.which("node")


@unittest.skipUnless(NODE, "Node is not installed")
class WindKit(unittest.TestCase):
    def node(self, script):
        return subprocess.run([NODE, "-e", script], cwd=KIT, capture_output=True, text=True)

    def test_verification_cases(self):
        r = subprocess.run([NODE, str(KIT / "test" / "cc-wind.test.js")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_sample_renders_and_agrees_with_the_engine(self):
        r = self.node("const K=require('./cc-wind-panels.js'),s=require('./example/sample_wind.json'),o=K.render(s),c=o.result;"
                      "console.log(JSON.stringify({kh:c.site.Kh,z3:c.roofs[0].zones.z3.asd,html:o.pressures,zones:o.zones.length,par:o.parameters.length}))")
        self.assertEqual(r.returncode, 0, r.stderr)
        out = json.loads(r.stdout)
        self.assertAlmostEqual(out["kh"], 0.573, places=3)          # Exposure B below 30 ft: z = 15 ft, not 30 ft
        self.assertIn("%.1f" % abs(out["z3"]), out["html"])           # the table prints what the engine computed
        self.assertIn("Eq. 30.3-1", out["html"])
        self.assertGreater(out["zones"], 500)
        self.assertGreater(out["par"], 500)

    def test_missing_input_is_an_open_item_not_a_guess(self):
        r = self.node("const K=require('./cc-wind-panels.js'),s=Object.assign({},require('./example/sample_wind.json'));delete s.V;"
                      "const o=K.render(s);console.log(JSON.stringify([o.pressures,o.parameters]))")
        self.assertEqual(r.returncode, 0, r.stderr)
        pressures, parameters = json.loads(r.stdout)
        self.assertIn("Open item", pressures)
        self.assertNotIn("psf (0.6", pressures)
        self.assertIn("Not set", parameters)

    def test_built_sample_is_current(self):
        built = (KIT / "example" / "wind-sheet.html").read_text(encoding="utf-8")
        for name in ("cc-wind.js", "cc-wind-diagram.js", "cc-wind-panels.js"):
            self.assertIn((KIT / name).read_text(encoding="utf-8"), built, name + " changed: run python wind-cc-kit/example/build_example.py")


if __name__ == "__main__":
    unittest.main()
