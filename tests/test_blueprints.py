"""Drafting regression checks. Requires Playwright and its Chromium browser.

Run from the repository root: python -m unittest discover -s tests -v
All generated drawings use disposable sample fixtures, not project approvals.
"""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from playwright.sync_api import sync_playwright


SKILL = Path(__file__).resolve().parents[1] / "skills" / "oasis-blueprints"


class BlueprintTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="blueprints-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.page = self.browser.new_page(viewport={"width": 3600, "height": 2500})
        self.addCleanup(self.page.close)
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))

    def sample(self, name="deck"):
        return json.loads((SKILL / "assets" / "examples" / name / "project.json").read_text(encoding="utf-8"))

    def build(self, project, name="sheet-set"):
        source = self.root / (name + ".json")
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text(json.dumps(project, ensure_ascii=False), encoding="utf-8")
        output = source.with_suffix(".html")
        result = subprocess.run([sys.executable, str(SKILL / "scripts" / "build.py"),
                                 str(source), str(output)], capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return output

    def open(self, path):
        self.page.goto(path.as_uri())
        self.page.wait_for_function("window.__ready === true")
        self.assertEqual(self.errors, [])
        self.assertEqual(self.page.evaluate("window.__errors"), [])

    def test_examples_export_from_paths_with_spaces_and_url_characters(self):
        for name in ("deck", "sunroom-repair"):
            with self.subTest(name=name):
                html = self.build(self.sample(name), "folder # 50%/" + name)
                self.open(html)
                self.assertEqual(self.page.evaluate("window.__audit"), [])
                self.assertEqual(self.page.locator(".sheet").count(), len(self.sample(name)["sheets"]))
                pdf = html.with_suffix(".pdf")
                result = subprocess.run([sys.executable, str(SKILL / "scripts" / "print.py"),
                                         str(html), str(pdf)], capture_output=True, text=True, encoding="utf-8")
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertTrue(pdf.read_bytes().startswith(b"%PDF-"))

    def test_detail_library_example_builds_with_clean_audit(self):
        project = SKILL.parents[1] / "examples" / "sheet-sets" / "detail-library" / "project.json"
        html = self.root / "detail-library.html"
        result = subprocess.run([sys.executable, str(SKILL / "scripts" / "build.py"), str(project), str(html)],
                                capture_output=True, text=True, encoding="utf-8")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn("not in the library", result.stderr)
        self.open(html)
        self.assertEqual(self.page.evaluate("window.__audit"), [])
        sheets = json.loads(project.read_text(encoding="utf-8"))["sheets"]
        self.assertEqual(self.page.locator(".sheet").count(), len(sheets))
        self.assertEqual(self.page.locator(".miss").count(), 0)

    def test_detail_missing_from_library_fails_audit(self):
        project = json.loads((SKILL.parents[1] / "examples" / "sheet-sets" / "detail-library" / "project.json").read_text(encoding="utf-8"))
        project.pop("library", None)   # the kit falls back to the library that ships with the repository
        project["sheets"] = [{"no": "D1", "type": "details", "name": "Details", "details": ["62d7e973", "00000000"]}]
        html = self.build(project, "missing-detail")
        self.open(html)
        audit = self.page.evaluate("window.__audit")
        self.assertTrue(any("00000000" in line and "not in the library" in line for line in audit), audit)
        self.assertEqual(self.page.locator(".miss").count(), 1)

    def test_type_map_names_exist_where_it_points(self):
        library = SKILL.parents[1] / "library"
        load = lambda *parts: json.loads(library.joinpath(*parts).read_text(encoding="utf-8"))
        type_map = load("type-map.json")
        kinds = {k["key"] for k in load("drawing-map", "sheet_kinds.json")["kinds"]}
        variants = {t["key"]: {v["key"] for v in t.get("variants", [])} for t in load("drawing-map", "taxonomy.json")["types"]}
        categories = {d["category"] for d in load("details", "typical", "index.json")["details"]}
        self.assertEqual({k["kind"] for k in type_map["sheet_kinds"]}, kinds)
        for kind in type_map["sheet_kinds"]:
            self.assertIn(kind["kit_sheet_type"], type_map["_kit_sheet_type"])
            self.assertLessEqual(set(kind["detail_categories"]), categories, kind["kind"])
        views = {p.stem for p in (SKILL / "assets" / "views").glob("*.js")}
        self.assertEqual({j["job_type"] for j in type_map["job_types"]}, views)
        for job in type_map["job_types"]:
            self.assertLessEqual(set(job["field_sheet_covers"]), kinds, job["job_type"])
            for ref in job["drawing_map"]:
                self.assertLessEqual(set(ref["variants"]), variants[ref["type"]], job["job_type"])

    def test_drawing_map_has_a_page_for_every_type_file(self):
        folder = SKILL.parents[1] / "library" / "drawing-map"
        index = json.loads((folder / "index.json").read_text(encoding="utf-8"))
        listing = (folder / "types" / "README.md").read_text(encoding="utf-8")
        for group in index["groups"]:
            data = folder / group["file"]
            self.assertTrue(data.exists(), group["file"])
            page = data.with_suffix(".md")
            self.assertTrue(page.exists(), page.name)
            self.assertIn("(%s)" % page.name, listing)
            text = page.read_text(encoding="utf-8")
            self.assertIn("## Sheet index", text)
            for sheet in json.loads(data.read_text(encoding="utf-8"))["sheets"]:
                self.assertIn("| **%s** |" % sheet["name"], text)
        pages = {p.stem for p in (folder / "types").glob("*.md")} - {"README"}
        self.assertEqual(pages, {Path(g["file"]).stem for g in index["groups"]})

    def test_imperial_and_metric_plan_have_same_physical_scale(self):
        imperial = self.sample()
        metric = copy.deepcopy(imperial)
        for key, value in metric["geometry"].items():
            if isinstance(value, (int, float)) and key != "beamPlies":
                metric["geometry"][key] = value * 25.4
            elif isinstance(value, list):
                metric["geometry"][key] = [item * 25.4 for item in value]
        metric["geometry"]["units"] = "mm"
        for project in (imperial, metric):
            with self.subTest(units=project["geometry"]["units"]):
                self.open(self.build(project))
                self.assertEqual(self.page.evaluate("window.__audit"), [])
                inches = self.page.evaluate("""() => {
                    document.getElementById('set').style.zoom = 1;
                    const panel = [...document.querySelectorAll('.panel')].find(
                        p => p.querySelector('.vn')?.textContent === 'Framing plan');
                    const svg = panel.querySelector('svg.sk');
                    return Math.abs(svg.getScreenCTM().a) * PROJECT.geometry.L / 96;
                }""")
                self.assertAlmostEqual(inches, 8, delta=0.003)

    def test_blank_criteria_still_block_issue_after_other_answers(self):
        self.open(self.build(self.sample()))
        result = self.page.evaluate("""() => {
            const p = structuredClone(PROJECT);
            p.openItems.forEach(o => o.answer = 'Test fixture answer');
            p.status = 'permit';
            return { items: openItems(p), audit: audit(p) };
        }""")
        self.assertEqual([item["title"] for item in result["items"]], ["Design criteria"])
        self.assertTrue(any('status is "permit"' in item for item in result["audit"]))

    def test_blank_criteria_values_and_zero_are_distinguished(self):
        self.open(self.build(self.sample()))
        result = self.page.evaluate("""() => {
            const p = structuredClone(PROJECT); p.openItems = [];
            const counts = ['', '  ', null, 0, '0', 'Given'].map(v => {
                p.criteria = [{k: 'Test criterion', v}]; return openItems(p).length;
            });
            p.criteria = [{k: 'Test criterion', v: 0}]; p.status = 'permit';
            return {counts, audit: audit(p)};
        }""")
        self.assertEqual(result["counts"], [1, 1, 1, 0, 0, 0])
        self.assertEqual(result["audit"], [])

    def test_existing_criteria_item_is_not_duplicated(self):
        self.open(self.build(self.sample()))
        self.assertEqual(self.page.evaluate("openItems(PROJECT).length"), 8)

    def test_browser_answer_survives_download_and_reopen(self):
        self.open(self.build(self.sample()))
        self.page.locator('[data-a="edit"]').click()
        self.page.locator('[data-path="openItems.0.answer"]').fill("Recorded fixture answer")
        self.page.wait_for_function("document.querySelector('.oih')?.textContent === 'Recorded answers'")
        with self.page.expect_download() as pending:
            self.page.locator('[data-a="html"]').click()
        saved = self.root / "edited.html"
        pending.value.save_as(saved)
        self.open(saved)
        self.assertEqual(self.page.evaluate("PROJECT.openItems[0].answer"), "Recorded fixture answer")
        self.assertEqual(self.page.evaluate("PROJECT.status"), "draft")
        self.assertEqual(self.page.evaluate("openItems(PROJECT).length"), 7)
        self.assertIn('<meta name="generator" content="Oasis-Blueprints', saved.read_text(encoding="utf-8"))
        self.assertIn("Copyright (c) 2026 Oasis Engineering, LLC", saved.read_text(encoding="utf-8"))

    def test_built_html_names_its_source_and_never_prints_it(self):
        output = self.build(self.sample())
        html = output.read_text(encoding="utf-8")
        self.assertIn('<meta name="generator" content="Oasis-Blueprints (https://github.com/oasiseng/Oasis-Blueprints)">', html)
        self.assertIn("MIT License, Copyright (c) 2026 Oasis Engineering, LLC", html)
        self.assertNotIn("PCP Contributors", html)
        self.open(output)
        sheets = self.page.evaluate("[...document.querySelectorAll('.sheet')].map(s => s.innerText).join(' ')")
        self.assertNotIn("Oasis-Blueprints", sheets)
        self.assertNotIn("github.com", sheets)
        self.page.locator('[data-a="edit"]').click()
        self.assertEqual(self.page.locator("#ui .src a").count(), 2)
        self.page.emulate_media(media="print")
        self.assertEqual(self.page.evaluate("getComputedStyle(document.getElementById('ui')).display"), "none")

    def test_project_text_cannot_close_embedded_json_script(self):
        project = self.sample()
        title = '</script><script>window.injected = true</script>'
        project["project"]["title"] = title
        self.open(self.build(project))
        self.assertEqual(self.page.evaluate("PROJECT.project.title"), title)
        self.assertTrue(self.page.evaluate("window.injected === undefined"))

    def test_duplicate_open_item_keys_are_rejected(self):
        project = self.sample()
        project["openItems"].append(copy.deepcopy(project["openItems"][0]))
        source = self.root / "duplicate.json"
        source.write_text(json.dumps(project), encoding="utf-8")
        result = subprocess.run([sys.executable, str(SKILL / "scripts" / "build.py"),
                                 str(source), str(self.root / "invalid.html")], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Open item keys must be unique", result.stderr)
        self.assertFalse((self.root / "invalid.html").exists())


if __name__ == "__main__":
    unittest.main()
