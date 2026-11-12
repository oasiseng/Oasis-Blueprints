---
name: oasis-blueprints
description: Draw engineering and construction sheet sets as HTML and PDF - true-scale plans, sections, details, title block, your logo. Use for drawings, plan sheets, permit sets, or instead of CAD/DWG.
---

# Oasis-Blueprints

Turn a described job into a drawing set that reads like a good instruction manual: one self-contained
HTML file, 24 × 36 in sheets, every view at a stated true scale, a title block with the user's own
company and logo, and a PDF for the building department. No CAD, no DWG.

The set has two kinds of sheet. The **cover** is for the office and the plan reviewer: what the job is,
scope, notes, design criteria, and the list of open items. The **field sheet** is for the person building
it: a picture of the finished job, numbered steps with a small picture each, a plan, a section, and the
connection details. Blue is new work, grey is existing, red is waiting on the engineer.

## The one rule: you are the drafter, not the engineer

People build from drawings. A guessed anchor looks exactly as authoritative on a sheet as a calculated
one, so a guess is worse than a blank.

- Draw what the user gave you. Never supply a member size, spacing, fastener, anchor, embedment,
  footing size, load, code edition or capacity from your own knowledge, and never "pick something
  typical", even if asked. If the user wants a typical value, they can state it and it goes in as theirs.
- Everything the drawing needs that the user did not give becomes an **open item**. Open items show
  red on the sheets, are counted in the title block, and stop the set from being issued.
- A value the user gives is recorded as the answer to its open item, in their words.
- Status stays `draft` until the user says the engineer of record has closed every item. The set is
  sealed and issued by a licensed engineer, not by this skill. Say so plainly when you deliver.
- Dimensions that were scanned, scaled or assumed are marked ± (verify in field).

## Workflow

### 1. Collect the job

Ask only for what is missing, in one round: what is being built or repaired and where; overall
dimensions and layout (a sketch, photo, scan or list of dimensions is fine); what is new and what is
existing; member sizes and connectors the user has already decided; permit number if any; who drew
and who checks. Do not interrogate the user about engineering values: missing ones become open items.

### 2. Company block and logo (once)

If there is no `brand.json` in the working folder, ask for the company name, address lines, licence
number, phone, website, an optional logo image (PNG, SVG or JPG) and an optional accent colour. Save
them as `brand.json` (copy `assets/brand.example.json`) and reuse it for every later job. With no logo
the title block shows the company name as a wordmark. Never put this skill's name or anyone else's
company in a user's title block.

### 3. Pick or write the job type

The drawing code for a kind of job is one JavaScript file. Two ship with the kit:

| `jobType` | Draws | File |
|---|---|---|
| `sunroom` | Sloped roof on posts against a house: sunroom, porch, lean-to. Imperial only. | `assets/views/sunroom.js` |
| `deck` | Freestanding rectangular deck on posts and footings. Inches or millimetres. | `assets/views/deck.js` |

If the job fits one, use it. If not, write a new `<jobType>.js` **beside the project file** (the skill
folder may be read-only). Read `references/writing-views.md` first, and start from `assets/views/deck.js`:
it is the unit-safe pattern. A job type is about 150 lines: a `derive` function, a plan, a section, two
or three details, an isometric scene, and a `JOB` object that hands them to the layout.

### 4. Write the project file

One JSON file holds everything that is not drawing code: title block, geometry, the headline, key
facts, steps, scope, notes, criteria, open items and the sheet list. Copy the nearest example
(`assets/examples/*/project.json`) and read `references/project-file.md` for every field.

Writing rules that make the set easy to follow (more in `references/sheet-standard.md`):
- The headline says the whole job in one short sentence a homeowner would understand.
- Steps are in build order, 3 to 5 of them, each one action.
- Give each open item a `key`. Write `{key}` in any text where its answer belongs: it prints as a red
  "Engineer" chip until answered, then as the answer. The drawing code reads the same answer.

### 5. Build

```bash
python scripts/build.py project.json sheet-set.html --brand brand.json
```

Standard library only, no network, no install. The output is one HTML file with fonts, code and
project inside it.

### 6. Check, and fix what the audit finds

```bash
python scripts/print.py sheet-set.html sheet-set.pdf --png preview-
```

This prints the PDF with headless Chromium, runs the layout audit, and writes one PNG per sheet. It
exits 2 if the audit finds anything. Fix every finding and rebuild; do not deliver a set with findings.
Typical fixes: shorten or wrap a note, move a note's elbow, lower a view's scale, trim a detail.
Then **look at the PNGs**: the audit catches overflow and wrong scale, not a leader crossing a
dimension or two notes on top of each other.

If Playwright or Chromium is not available (the script says so), skip the PDF: the HTML is the
deliverable. Tell the user to open it in Chrome or Edge, read the badge at the top left
("Layout OK" or the problems found), and use **Print / Save as PDF**. Ask them to paste any problem
the badge reports so you can fix it.

### 7. Deliver

Give the user the HTML (and the PDF if you made one), then say in a few lines:
- how many open items there are and that the set is a draft until the engineer closes them;
- that they can open the HTML, press **Edit**, type answers, fill the title block, swap the logo,
  then **Download this HTML with my edits** and **Print / Save as PDF**;
- anything you assumed, and every dimension you marked ±.

### 8. Revise

Change the project file (or the view), rebuild, re-check. If the user sends back an edited HTML or a
downloaded `.project.json`, take the project from it rather than from your older copy: their answers
are in there.

## Files

- `scripts/build.py` project file → HTML. `scripts/print.py` HTML → PDF, audit, previews.
- `assets/kit/` the drawing kit (`kit.js`), sheet layout and audit (`layout.js`), in-browser editor
  (`editor.js`), styles (`sheet.css`). Do not edit these for a job; put job-specific drawing in a view.
- `assets/views/` job types. `assets/fonts/` Barlow (SIL OFL), embedded at build.
- `assets/examples/` complete project files to copy. `assets/brand.example.json` company block.
- `references/project-file.md` every field of the project file.
- `references/writing-views.md` the drawing API and how to write a job type. Read before writing one.
- `references/sheet-standard.md` what goes on each sheet, the colour code, wording, statuses.

## Limits to be honest about

One field sheet per set (plus cover and reserved sheets); sheets are 24 × 36 in; the isometric
picture is not to scale; the kit draws and checks layout, it does not design or check structure.
