---
title: Your first sheet set
description: Build the bundled deck sample, open it, read its open items and print it.
---

The fastest way to see what the skill makes is to build the deck sample that ships with it. It is a draft: its
engineering values are still open, so the red open items show straight away.

## Build it

From a copy of the repository:

```bash
cd skills/oasis-blueprints
python scripts/build.py assets/samples/deck/project.json deck.html
```

`build.py` prints the size of the file, the job type it used and how many open items remain. Open `deck.html` in a
browser.

## Read it

- The **cover** has the job in one sentence, the scope, the notes, the design criteria and the list of open items.
- The **field sheet** has the picture, the steps, the framing plan, the section and the connection details.
- Everything in **red** is waiting on the engineer: blank design criteria print as a red Engineer chip, and each open
  item shows in red where it applies.

![Field sheet of the deck example, a draft with open items](/ref/examples/sheet-sets/deck/preview-field.png)

## Change it

Click **Edit**. The panel fills the title block, changes the company and logo, sets the status, and records answers to
open items. **Download project file** saves the edited project; **Download this HTML with my edits** saves the whole
set. An answer typed into an open item records information; it does not resize anything. When geometry changes, change
the project file and rebuild.

## Print it

Use **Print / Save as PDF** in the browser at actual size on 36 × 24 in paper, or, with Playwright installed:

```bash
python scripts/print.py deck.html deck.pdf --png preview-
```

See [Print to PDF and read the layout audit](/guides/print-and-audit/).

## With an assistant

With the skill installed you do not run these commands yourself. Describe the job ("a freestanding 16 × 12 deck,
2'-6" above grade, on six posts") and give it what you have. The assistant writes the project file, builds the set,
tells you what is still open, and leaves those values for the engineer.
