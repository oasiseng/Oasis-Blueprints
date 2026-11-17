---
title: What it is
description: An Agent Skill that drafts engineering and construction sheet sets as self-contained HTML, printed to PDF.
---

Building departments ask for a PDF, not a DWG. So the drawing can be a web page: one self-contained HTML file per
job, 36 × 24 in sheets, every view at a stated true scale, printed to PDF by any browser.

Oasis-Blueprints is an Agent Skill, packaged as a Claude plugin, that drafts that set from a described job, with your
own company and logo in the title block. It is open source under the MIT License.

## What a set contains

- **Cover**, for the office and the plan reviewer: the job in one sentence, scope, notes, design criteria and the
  list of [open items](/concepts/open-items/).
- **Field sheet**, for the person building it: a picture of the finished job, numbered steps with a small picture
  each, a plan, a section and the connection details.
- Optional sheets: figure sheets, sheets of standard details from the [detail library](/reference/detail-library/),
  and reserved sheets that hold a number for a drawing that comes from elsewhere.

Colour is meaning: **blue** is new work, **grey** is existing, **red** is waiting on the engineer, **orange** is a hold.

![Cover of the sunroom repair example](/ref/examples/sheet-sets/sunroom-repair/preview-cover.png)

## What it is not

- It is **not an engineer**. It never supplies a member size, anchor, footing or load on its own. See
  [Drafter, not engineer](/concepts/drafter-not-engineer/).
- It does **not design or check structure**. The kit draws and checks layout: that every view is at its stated scale
  and that nothing overflows its box.
- It is **not CAD**. It does not read or write DWG.

## Job types that ship with the skill

| Job type | Use |
|---|---|
| `deck` | Freestanding rectangular deck, inches or millimetres |
| `sunroom` | Sloped roof on posts against a house, inches only |
| `library` | A set made only of sheets of standard details |

Anything else is a job type of your own: one JavaScript file beside the project file. The
[site plan example](/examples/site-plan/) is drawn that way. See [Drawing API](/reference/drawing-api/).

The current kit has one field sheet per set and fixed 36 × 24 in paper.

## What it runs, sends and fetches

Two Python scripts, on the machine where the assistant runs code. `build.py` reads the project file, an optional
company file and logo, and writes one HTML file, with the Python standard library only. `print.py` is optional: if
Playwright and Chromium are already installed it saves the PDF, runs the layout audit and writes preview images. It
installs nothing.

It sends nothing and fetches nothing: no network calls, no credentials, no telemetry. The built HTML embeds its fonts
and makes no network requests either.
