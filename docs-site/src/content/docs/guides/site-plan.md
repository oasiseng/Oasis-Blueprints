---
title: Make a site plan
description: Walk through the site plan example - what the engineer supplies, what the kit draws, and how open items show and clear.
---

This guide follows the [site plan example](/examples/site-plan/): a two-sheet set for a new detached metal garage in
the corner of a residential lot. The lot, streets, names and numbers are placeholders.

The kit does not ship a site plan job type. The example draws its sheet with its own job type, `siteplan`, in
[`siteplan.js`](https://github.com/oasiseng/Oasis-Blueprints/blob/main/examples/sheet-sets/site-plan/siteplan.js) beside
its project file. `build.py` finds a `<jobType>.js` beside the project file before it looks in the kit. To start your
own, copy that folder.

## What the engineer supplies

Every number on the sheet comes from someone who is responsible for it. The project file says where, in
`geometry.source`: the lot, existing features and elevations from the owner's topographic survey; the building size
from the owner's sketch; placement, driveway and swale as directed by the engineer and the owner.

| Input | In the example | Where it goes |
|---|---|---|
| Survey: lot lines, found corners, house, fences, spot elevations | 110.0' × 136.0' corner lot, NAVD 88 | `geometry.survey` |
| Building size | 20 × 30 with a 12 ft lean-to: a 29' × 32' footprint | `geometry.building` |
| Setbacks | 6 ft east, 5 ft south, as selected by the owner | `geometry.building`, open item `setbacks` |
| Swale section | 5 ft wide, 4:1 sides, matching existing grade at both edges | `geometry.swale`, open item `swale` |
| Finished floor elevation | 26.5 (NAVD 88) | `geometry.building.ffe`, open item `ffe` |

Zoning limits, lot coverage, plan review comments, utilities, the driveway and easements are open items too, answered
by the office, the engineer or the field.

## What the kit draws

- **C0.0, cover**: the job in one sentence, scope, project information, site notes, general notes and the open items
  with their recorded answers.
- **C1.0, site plan**: the site plan from the survey at 1/240, an enlarged plan with proposed grades at 1/120, a section
  through the east side yard at 1/32, a typical swale section at 1/24, a stormwater check (204.7 cu ft provided against
  77.3 cu ft required), and the building footprint at 1/96.

Grey is what the survey found. Blue is new work. Every view is drawn at its stated scale, and `print.py` measures it.

![Site plan sheet of the site plan example](/ref/examples/sheet-sets/site-plan/preview-site.png)

## How open items show and clear

Each value the engineer or the field owes is an open item with a key:

```json
{ "key": "ffe", "title": "Finished floor elevation", "text": "", "who": "Engineer", "answer": "" }
```

While `answer` is empty, the item is listed in red under **Open items for the engineer** on the cover and counted in
the title block. Any `{ffe}` in the notes or steps prints as a red Engineer chip, and a view that calls
`answer(P, 'ffe')` draws it in red. The set cannot be issued for permit or construction while any item is open: the
layout audit fails.

When the engineer answers, the answer goes into the project file (or into **Edit** in the browser):

```json
{ "key": "ffe", "title": "Finished floor elevation", "text": "", "who": "Engineer", "answer": "26.5 NAVD 88." }
```

The item moves to **Recorded answers** on the cover and stops counting as open. An answer is text: if it changes a
number the drawing uses, such as the floor elevation, change `geometry` too and rebuild.

In the finished example all eight items (`coverage`, `comments`, `setbacks`, `swale`, `ffe`, `pole`, `driveway`,
`easements`) are answered, so its status is `construction`. To see a set with items still open and red on the
drawings, look at the [deck example](/examples/deck/).

![Cover of the site plan example](/ref/examples/sheet-sets/site-plan/preview-cover.png)

## Build it

```bash
python skills/oasis-blueprints/scripts/build.py examples/sheet-sets/site-plan/project.json site-plan.html
python skills/oasis-blueprints/scripts/print.py site-plan.html site-plan.pdf --png preview-
```
