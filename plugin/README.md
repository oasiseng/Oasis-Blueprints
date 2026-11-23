# Oasis Blueprints

Draw engineering and construction drawing sets with Claude, as one editable HTML file and a print-ready PDF, and
turn a finished set into a short narrated video. Made by [Oasis Engineering](https://oasisengineering.com), a
licensed engineering firm, for engineers, contractors, drafters and owners who need a permit-style sheet set
without CAD.

Full documentation, with built examples you can open: <https://docs.oasisengineering.com>

## What you get

| Component | What it does |
|---|---|
| Skill `oasis-blueprints` | Drafts a sheet set from your project information: cover sheet, true-scale plans, sections and details, general notes, and a title block with your own company and logo. Includes a library of standard construction details and a map of what a typical set of each project type contains. |
| Skill `sheet-video` | Makes a narrated, captioned video (a self-contained HTML player and a 1080p MP4) from a drawing set and a script, in your branding. |
| Agent `sheet-video` | Runs the video skill start to finish. |

## Install

Add it from the Claude directory, or in Claude Code:

```
/plugin install oasis-blueprints --marketplace oasiseng/Oasis-Blueprints
```

## How to use it

Ask in plain words, and attach what you have (a survey, photos, a sketch, dimensions, an existing plan set):

- "Draw a permit set for a 12 by 16 ft deck attached to my house."
- "Make a site plan sheet from this survey, with the proposed swale."
- "Make a two-minute video that walks an owner through this plan set."

Claude drafts the set, shows you the sheets, and lists every engineering question it could not answer from what
you gave it. Those open items print in red on the sheets.

## What a drawing set from this plugin is, and is not

Every set is a **draft**. The plugin lays out and draws what it is given; it does not do the engineering. A set
cannot be marked as issued until a licensed engineer has answered each open item, and sealing and permit
submission remain the engineer's work. Sample projects show layout only and are not designs to build from.

## What the plugin runs, sends and fetches

There are no hooks, no MCP servers, no telemetry and no credentials. Nothing runs until you ask for a drawing set
or a video. All scripts are readable Python and JavaScript in this folder.

**Drawing skill (`oasis-blueprints`)**

- `scripts/build.py` reads your project file, your optional company file and logo, and the kit files in the skill,
  and writes one HTML file. Python standard library only. It makes no network requests, and neither does the HTML
  it writes.
- `scripts/print.py` is optional. If Python Playwright and Chromium are already installed, it opens that HTML in
  headless Chromium on your machine to save the PDF and preview images and to run a layout check. It installs
  nothing. If they are missing, Claude may offer to install them with `pip install playwright` and
  `playwright install chromium`; that downloads from PyPI and from Playwright's download servers.

**Video skill (`sheet-video`)**

- `scripts/setup.py` runs once per machine, only when you ask for a video. It installs six Python packages from
  PyPI with pip (playwright, pymupdf, pillow, numpy, kokoro-onnx, soundfile), installs Playwright's Chromium, and
  downloads the Kokoro voice model: two files, about 340 MB, from the kokoro-onnx project's GitHub release
  (`github.com/thewh1teagle/kokoro-onnx`). Each file is checked against a SHA-256 pinned in the script and deleted
  if it does not match. The model is saved in `~/.sheet-video/models`. `setup.py --check` only reports what is
  missing and installs nothing.
- The other scripts run on your machine: they read your drawing set and script, render narration with the local
  voice model, capture frames in headless Chromium, and call ffmpeg (which you install yourself) to write the MP4.
  Your drawings, script and audio are not uploaded anywhere.
- A saved brand file, if you make one, is kept in `~/.sheet-video`.

The bundled Barlow fonts (SIL Open Font License) are copied into the output so a sheet looks the same on every
machine.

## What is in this folder

- `skills/oasis-blueprints/`: the drawing skill, its kit, the detail library and the drawing map
- `skills/sheet-video/`: the video skill and its scripts
- `agents/sheet-video.md`: the video agent
- `LICENSE`: MIT

This folder is built from the main repository by `scripts/build_plugin.py`. The examples, the documentation site
and the tests live in the [repository](https://github.com/oasiseng/Oasis-Blueprints). To report a problem, open an
issue there.

## Privacy

The plugin collects nothing and sends nothing to Oasis Engineering. Full statement:
[Privacy](https://github.com/oasiseng/Oasis-Blueprints/blob/main/plugin/PRIVACY.md)
(also in this folder as `PRIVACY.md`).

## License

MIT License, Copyright (c) 2026 Oasis Engineering, LLC. The Barlow fonts are under the SIL Open Font License.
