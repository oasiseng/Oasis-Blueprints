---
title: Revise a set
description: Record answers, change geometry and add a revision, then rebuild and recheck.
---

A set is rebuilt from its project file, so a revision is an edit to that file and a rebuild. Keep the project file and
any job-specific drawing code with the project.

## Start from the latest copy

If the set was edited in the browser, the returned HTML or the downloaded `.project.json` holds those edits and wins
over the older project file. **Download project file** in the **Edit** panel saves it.

## Worked example: the engineer sizes the deck footing

1. Record the answer on the open item. The source and review status go with it:

   ```json
   { "key": "footing", "title": "Footings", "who": "Engineer",
     "text": "Diameter, depth below grade, reinforcing and soil bearing. Drawn schematically at 16 in. diameter.",
     "answer": "<the engineer's footing, as written in their response>" }
   ```

2. If the answer changes a number the drawing uses, change `geometry` too (`footingDia`, `footingDepth`). An answer is
   text; it does not resize anything by itself.
3. Add a line to the revisions in the title block:

   ```json
   "issue": { "date": "2026-11-17", "revisions": [{ "no": "1", "text": "Footing per engineer", "date": "2026-11-17" }] }
   ```

4. Rebuild and print again:

   ```bash
   python skills/oasis-blueprints/scripts/build.py deck/project.json deck/sheet-set.html
   python skills/oasis-blueprints/scripts/print.py deck/sheet-set.html deck/sheet-set.pdf --png deck/preview-
   ```

5. Look at every preview, and read the audit.

## Status

New sets are `draft`. `review` releases a set for review, still not for construction. Change to `permit` or
`construction` only when the engineer has reviewed the set and every open item is closed: the audit fails otherwise.
The kit never adds a seal or a signature.
