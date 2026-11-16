"""Exercise the extracted release, never the checkout's runtime resources."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]


class ExtractedSkill(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="oasis-package-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        archive = os.environ.get("OASIS_SKILL_ZIP")
        if not archive:
            archive = self.root / "skill.zip"
            subprocess.run([sys.executable, str(ROOT / "scripts/package_skill.py"), str(archive)],
                           check=True, capture_output=True)
        with zipfile.ZipFile(archive) as bundle:
            bundle.extractall(self.root / "installed")
        self.skill = self.root / "installed/oasis-blueprints"
        self.library = self.skill / "assets/library"
        self.work = self.root / "unrelated working directory"
        self.work.mkdir()

    def build(self, project, name="details"):
        source = self.work / (name + ".json")
        source.write_text(json.dumps(project), encoding="utf-8")
        output = source.with_suffix(".html")
        result = subprocess.run([sys.executable, str(self.skill / "scripts/build.py"),
                                 str(source), str(output)], cwd=self.work, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stderr, "")
        return output

    def detail_project(self):
        # Only extracted data supplies IDs. No --library or repository-relative paths.
        sheets = []
        for index in sorted((self.library / "details").glob("*/index.json")):
            details = json.loads(index.read_text())["details"]
            for offset in range(0, len(details), 6):
                sheets.append({"no": "D" + str(len(sheets) + 1), "type": "details",
                               "name": index.parent.name,
                               "details": [d["id"] for d in details[offset:offset + 6]]})
        self.assertTrue(sheets)
        return {"jobType": "library", "project": {"title": "Package smoke test"},
                "summary": {}, "geometry": {"units": "in"}, "sheets": sheets}


class PackageTests(ExtractedSkill):
    def test_all_library_resources_are_packaged_unchanged(self):
        sources = [p for p in (ROOT / "library").rglob("*")
                   if p.is_file() and p.suffix in (".json", ".md", ".png")]
        self.assertTrue(sources)
        for source in sources:
            bundled = self.library / source.relative_to(ROOT / "library")
            self.assertEqual(bundled.read_bytes(), source.read_bytes(), str(bundled))
        self.assertTrue((self.skill / "LICENSE.txt").is_file())
        self.assertTrue(list((self.skill / "assets/fonts").glob("*.woff2")))

    def test_every_detail_is_embedded_without_repository_access(self):
        project = self.detail_project()
        html = self.build(project).read_text()
        embedded = json.loads(html.split('<script type="application/json" id="project">')[1].split('</script>')[0])
        ids = {i for sheet in project["sheets"] for i in sheet["details"]}
        self.assertEqual(set(embedded["library"]["details"]), ids)
        for index in (self.library / "details").glob("*/index.json"):
            for detail in json.loads(index.read_text())["details"]:
                source = json.loads((index.parent / (detail["id"] + ".json")).read_text())
                self.assertEqual(embedded["library"]["details"][detail["id"]], source)

    def test_drawing_map_references_resolve_inside_package(self):
        folder = self.library / "drawing-map"
        index = json.loads((folder / "index.json").read_text())
        self.assertTrue(index["groups"])
        for group in index["groups"]:
            source = folder / group["file"]
            self.assertTrue(json.loads(source.read_text())["sheets"])
            self.assertTrue(source.with_suffix(".md").is_file())
            self.assertTrue(source.with_suffix(".png").is_file())
        for name in ("taxonomy.json", "sheet_kinds.json"):
            self.assertTrue(json.loads((folder / name).read_text()))
        self.assertTrue(json.loads((self.library / "type-map.json").read_text())["job_types"])

    def test_bundled_samples_build_from_unrelated_directory(self):
        for name in ("deck", "sunroom"):
            project = json.loads((self.skill / "assets/samples" / name / "project.json").read_text())
            self.assertTrue(self.build(project, name).is_file())


class PackageBrowserTests(ExtractedSkill):
    def test_extracted_library_exports_with_clean_audit(self):
        from playwright.sync_api import sync_playwright
        project = self.detail_project()
        # One detail per collection exercises rendering/export without making this
        # packaging smoke test depend on arbitrary six-detail page arrangements.
        collections = {}
        for sheet in project["sheets"]:
            collections.setdefault(sheet["name"], dict(sheet, details=sheet["details"][:1]))
        project["sheets"] = list(collections.values())
        html = self.build(project)
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page()
            page.goto(html.as_uri())
            page.wait_for_function("window.__ready === true")
            self.assertEqual(page.evaluate("window.__errors"), [])
            self.assertEqual(page.evaluate("window.__audit"), [])
            self.assertEqual(page.locator(".miss").count(), 0)
            browser.close()
        pdf = html.with_suffix(".pdf")
        result = subprocess.run([sys.executable, str(self.skill / "scripts/print.py"),
                                 str(html), str(pdf)], cwd=self.work, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(pdf.read_bytes().startswith(b"%PDF-"))


if __name__ == "__main__":
    unittest.main()
