---
title: Make a video from a drawing set
description: Turn a drawing set (PDF or HTML) and a script into a narrated, captioned HTML player and MP4, in your own branding.
---

The `sheet-video` skill turns a drawing set and a script into a short video: one self-contained HTML player
and a 1080p MP4. It zooms to what the narration talks about on the real sheets, highlights it (rings, tints,
flow arrows, pipes drawing on), reads the narration with a local neural voice, puts an original music bed
underneath and burns in the captions. Use it for a walkthrough behind a QR code on the plans, a review video
for the city or the owner, or a product explainer.

## The example

Built from the [site plan example](/examples/) printed to PDF, with the placeholder brand. It is rebuilt from the
skill on every push. Click **Sound on**; the arrow keys step between scenes.

<iframe src="/kits/sheet-video/example/" title="Sheet video example" style="width:100%;aspect-ratio:1920/1136;border:1px solid var(--sl-color-gray-5);border-radius:6px" allowfullscreen loading="lazy"></iframe>

[Open it full screen](/kits/sheet-video/example/)

## Install

In Claude Code:

```bash
claude plugin marketplace add oasiseng/oasis-blueprints
claude plugin install oasis-blueprints@oasis-blueprints
```

Install ffmpeg too (`winget install ffmpeg`, `brew install ffmpeg` or `apt install ffmpeg`). Everything else (the
Python packages, Chromium and the voice model, about 340 MB) is installed on first use.

## Make one

Start a session with the `sheet-video` agent, which runs on Claude Opus 5.5 at high effort:

```bash
claude --agent oasis-blueprints:sheet-video
```

and ask, for example: *Make a project video from plans.pdf and script.md.*

1. **Branding, once.** On first use it asks for your company name, logo, tagline, website and colours, and saves
   them in `~/.sheet-video/brand.json`. Every later video uses them.
2. **The script.** Bring one, or write it with the agent from the [brief template](/kits/sheet-video-brief/):
   scenes, what is on screen, the on-screen text and the narration.
3. **The check.** Before building, it compares every claim in the script with the sheets and asks about anything
   that does not match.
4. **The build.** It captures the sheets (PDFs give exact text positions for placing highlights), records the
   narration, times every scene and caption to the voice, adds the music, builds the player and plays every
   frame looking for problems.
5. **The delivery.** `video.html` and `video.mp4`, with the running time and a short list of anything to check.

Listen to every video once before you publish it: the model that builds it cannot hear it.

## Under the hood

The workflow is the [Sheet video](/kits/sheet-video/) page (the skill itself). Writing scenes:
[scenes and player](/kits/sheet-video-player/). The look, the voice, the music and the mix:
[style and sound](/kits/sheet-video-style/). Each script in `skills/sheet-video/scripts/` also runs on its own;
`--help` explains it.
