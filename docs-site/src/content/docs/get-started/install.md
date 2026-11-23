---
title: Install (Claude, ChatGPT, Codex, OpenClaw)
description: Install Oasis-Blueprints as a Claude plugin, as a skill in your assistant, as a local Codex skill, from ClawHub for OpenClaw, or use it by hand.
---

The same drawing skill is used every way; each route gets a copy packaged for it. Pick the one that matches where you
work.

## As a Claude plugin

The plugin is the [`plugin/`](https://github.com/oasiseng/Oasis-Blueprints/tree/main/plugin) folder of the
repository, and the repository is its own marketplace. In Claude Code:

```bash
claude plugin marketplace add oasiseng/oasis-blueprints
claude plugin install oasis-blueprints@oasis-blueprints
```

Then ask for a drawing set and describe the job. The plugin also brings the `sheet-video` skill and agent, which turn
a drawing set into a narrated video: see [Make a video from a drawing set](/guides/make-a-video/).

### If you added it from the Claude directory

The Claude plugin directory lists the **plan and review edition**. It proposes the sheet list and standard details for
a project type, lists the questions the engineer still has to answer, writes the project file, and reviews an existing
plan set for gaps, but it does not draw the sheets. To draw them, install the full plugin with the commands above. The
project file the plan and review edition wrote is what the full plugin builds from, so nothing is lost.

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

## In OpenClaw, from ClawHub

The drawing skill is published on [ClawHub](https://clawhub.ai), the skill registry for OpenClaw agents, as
`oasis-blueprints`. Install it with either command:

```bash
openclaw skills install oasis-blueprints
npx clawhub@latest install oasis-blueprints
```

It needs Python 3 on the machine (`python3` or `python`). The PDF and the layout check also need Playwright and
Chromium, as under [By hand](#by-hand). The skill folder is
[`clawhub/oasis-blueprints/`](https://github.com/oasiseng/Oasis-Blueprints/tree/main/clawhub/oasis-blueprints) in the
repository, with the detail library inside it. ClawHub publishes every skill under its MIT-0 license, so that copy
carries no attribution requirement; the repository itself is MIT.

The video skill is not on ClawHub; it comes with the Claude plugin.

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
