"""No real job data in the repository. Needs no browser.

Scans every text file under examples/, library/, skills/ and panel-schedule-kit/ for things that identify a real job:
street addresses, phone numbers, emails, zip codes, permit-like numbers, local paths and DWG file names.
A failure names the file, the line and the text. If the text is real job data, replace it with a
placeholder (see CONTRIBUTING.md). Add to ALLOW only what is certainly not job data, and say why.

Run from the repository root: python -m unittest tests.test_no_job_data -v
"""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
FOLDERS = ("examples", "library", "skills", "panel-schedule-kit")
SUFFIXES = {".json", ".js", ".md", ".html", ".py", ".csv", ".txt"}

STREET = r"(?:St|Street|Ave|Avenue|Dr|Drive|Rd|Road|Ln|Lane|Blvd|Ct|Court|Way|Pl)"
CHECKS = [
    # 123 Example St, 4500 NW 12th Avenue: a number, one to four words, then a street word
    ("street address", re.compile(r"\b\d{1,6}\s+(?:[A-Za-z0-9][A-Za-z0-9.']*\s+){1,4}" + STREET + r"\b\.?", re.I)),
    ("phone number", re.compile(r"(?<![\d.])\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}(?!\d|\.\d)")),
    ("email address", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")),
    # a zip code where one is written: after a two-letter state, or after the word ZIP
    ("zip code", re.compile(r"\b(?:[A-Z]{2}|[Zz][Ii][Pp])[ ,]+(\d{5})(?:-\d{4})?\b")),
    # BLD2024-001234, B-24-05512: letters, then five or more digits with optional dashes
    ("permit-like number", re.compile(r"\b[A-Z]{1,8}-?\d(?:-?\d){4,}\b")),
    # a drive letter standing alone (C:\Users, not the "NOTE:\n" of a JSON string), a home folder, a synced drive
    ("local path", re.compile(r"(?<![A-Za-z])[A-Za-z]:\\\\?[\w ]|/Users/|/home/\w|OneDrive|Google Drive", re.I)),
    ("DWG file name", re.compile(r"[\w)\]-]\.dwg\b", re.I)),
]

# Placeholders: what an anonymized example uses in place of the real thing (CONTRIBUTING.md).
PLACEHOLDERS = {
    "street address": {"123 Example St", "123 Main St", "456 Sample Ave"},
    "phone number": {"000-000-0000"},
    "zip code": {"00000"},
    "permit-like number": {"PERMIT-000000", "ROOF-000000"},
}

# Known safe matches, each with the reason it is not job data. Keep this short.
ALLOW = {
    # Sunshine 811, the public call-before-you-dig line in Florida, quoted in a general note
    ("phone number", "800-432-4770"),
    # Florida Product Approval number of a roofing product, a public product listing and not a permit
    ("permit-like number", "FL19979"),
}


def findings():
    out = []
    for folder in FOLDERS:
        for path in sorted((ROOT / folder).rglob("*")):
            if path.suffix.lower() not in SUFFIXES or not path.is_file() or "__pycache__" in path.parts or "_state" in path.parts:
                continue
            rel = path.relative_to(ROOT).as_posix()
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                for what, regex in CHECKS:
                    for match in regex.finditer(line):
                        text = " ".join(match.group(0).split())
                        value = match.group(1) if match.groups() else text
                        if value in PLACEHOLDERS.get(what, ()) or text in PLACEHOLDERS.get(what, ()):
                            continue
                        if (what, text) in ALLOW or (what, text, rel) in ALLOW:
                            continue
                        out.append("%s:%d: %s: %s" % (rel, number, what, text))
    return out


class NoJobDataTests(unittest.TestCase):
    def test_no_job_data_in_examples_library_or_skill(self):
        found = findings()
        self.assertEqual(found, [], "\n" + "\n".join(found[:60]) + ("\n... %d more" % (len(found) - 60) if len(found) > 60 else ""))

    def test_the_checks_catch_real_looking_data(self):
        for what, sample in [("street address", "4821 NW Palmetto Ridge Drive"), ("phone number", "(305) 555-0142"),
                             ("email address", "owner@example-homes.com"), ("zip code", "Miami, FL 33101"),
                             ("permit-like number", "BLD2024-001234"), ("local path", "C:\\Users\\someone\\job"),
                             ("local path", "OneDrive - Firm/Drafting"), ("DWG file name", "S-101 framing.dwg")]:
            regex = dict(CHECKS)[what]
            self.assertTrue(regex.search(sample), "%s should be caught: %s" % (what, sample))


if __name__ == "__main__":
    unittest.main()
