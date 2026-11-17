---
title: Print to PDF and read the layout audit
description: Print a set to a 36 x 24 in PDF with print.py and read what the layout audit reports.
---

`print.py` opens the built HTML in headless Chromium, saves a 36 × 24 in PDF, runs the layout audit and, with `--png`,
writes one preview image per sheet. It needs Playwright and Chromium already installed in that Python environment; it
installs and downloads nothing.

```bash
python skills/oasis-blueprints/scripts/print.py sheet-set.html sheet-set.pdf --png preview-
```

## Worked example: the site plan

Printing the [site plan example](/examples/site-plan/) gives:

```text
views: Enlarged plan at the new building: 1/120 stated, 1/120.00 drawn; Site plan: 1/240 stated, 1/240.00 drawn;
Section at the east side yard, looking north: 1/32 stated, 1/32.00 drawn; Typical swale section: 1/24 stated,
1/24.00 drawn; Stormwater check: 1/1 stated, 1/1.00 drawn; Building footprint: 1/96 stated, 1/96.00 drawn
layout audit: clean
wrote site-plan.pdf
```

- **views**: each measured view, the scale it states and the scale it is actually drawn at on the page.
- **layout audit**: `clean`, or a list of findings.
- `preview-0.png`, `preview-1.png`: one picture per sheet, for looking at.

## What the audit reports

A drawing too big for its box, a view not drawn at its stated scale, a picture shrunk below 80 % to fit, text that
overflows its box, a drawing area or title block taller than the sheet, a library detail missing from the library, and
open items on a set whose status is `permit` or `construction`. Script errors are reported too.

`print.py` exits with code 2 when the audit finds anything, so a set with problems is not issued by accident. Fix the
cause (shorter text, a smaller scale in `scales`, a detail moved to another sheet), rebuild and print again.

The layout audit is not a structural check. It says the drawing fits and is at scale, nothing about whether the design
works.

## Look at the previews

The audit cannot see everything. Look at each preview for overlaps, clipped notes, misplaced leaders and dimensions you
cannot read.

## Without Playwright

Open the HTML in Chrome or Edge. The badge at the top left shows the layout check. **Print / Save as PDF** makes the
PDF: print at actual size on 36 × 24 in paper. Resizing to fit changes the physical scale.
