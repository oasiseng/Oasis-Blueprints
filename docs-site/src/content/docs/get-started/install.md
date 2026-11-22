---
title: Install (Claude, ChatGPT, Codex)
description: Install Oasis-Blueprints as a Claude plugin, as a skill in your assistant, as a local Codex skill, or use it by hand.
---

The same skill folder, `skills/oasis-blueprints/`, is used every way. Pick the one that matches where you work.

## As a Claude plugin

The [repository](https://github.com/oasiseng/Oasis-Blueprints) is the plugin and its own marketplace. In Claude Code:

```bash
claude plugin marketplace add oasiseng/oasis-blueprints
claude plugin install oasis-blueprints@oasis-blueprints
```

Then ask for a drawing set and describe the job. The plugin also brings the `sheet-video` skill and agent, which turn
a drawing set into a narrated video: see [Make a video from a drawing set](/guides/make-a-video/).

## As a skill in Claude or ChatGPT

1. Download `oasis-blueprints.zip` from the
   [latest release](https://github.com/oasiseng/Oasis-Blueprints/releases/latest).
2. Upload it where your assistant manages skills.

The same folder loads in other assistants that support Agent Skills, including ChatGPT. The ZIP includes the detail
libraries, the drawing map and the type map under `assets/library/`, so no repository checkout or download is needed
at run time.

## As a local Codex skill

Extract the release ZIP and copy its `oasis-blueprints` folder to `$CODEX_HOME/skills/oasis-blueprints` (or
`~/.codex/skills/oasis-blueprints` when `CODEX_HOME` is unset). Keep its assets, scripts, references and licenses.
Invoke `$oasis-blueprints` with the project sources and the sheets you want.

## By hand

Python 3, standard library only, to build the HTML:

```bash
cd skills/oasis-blueprints
python scripts/build.py assets/samples/deck/project.json deck.html
```

The PDF and the layout audit need Playwright and Chromium in the same Python environment:

```bash
python -m pip install playwright
python -m playwright install chromium
python scripts/print.py deck.html deck.pdf --png preview-
```

Without them, open the HTML in Chrome or Edge and use **Print / Save as PDF**; the layout check shows as a badge at the
top left of the page.

Next: [Your first sheet set](/get-started/first-sheet-set/).
