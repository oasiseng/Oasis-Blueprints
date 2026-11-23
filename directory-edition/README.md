# Oasis Blueprints (plan and review edition)

Plan a construction drawing set with Claude before anyone draws it, or check a plan set you already have. Made by
[Oasis Engineering](https://oasisengineering.com), a licensed engineering firm, for engineers, contractors,
drafters and owners.

**This edition does not draw the sheets.** It holds no code: only instructions and reference data. The full
edition, which draws true-scale sheets as HTML and PDF from the project file this edition writes, is free and
open source. Install page: <https://docs.oasisengineering.com/get-started/install/>

## What it does

| You ask | You get |
|---|---|
| "What sheets does a permit set for a detached ADU need?" | A proposed sheet index for that project type, with how common each sheet was across past permit sets |
| "Plan the drawings for a 12 by 16 ft deck." | The sheet list, candidate standard details, and every question the engineer still has to answer |
| "Write the project file for this job." | A `project.json` in the Oasis Blueprints format, ready for the full edition to build from |
| "Review this plan set. What is missing?" | A completeness check against the sheet standard and against what sets of that type usually contain |

## What is inside

One skill, `oasis-blueprints`, with:

- the sheet standard: what each sheet is for, what the colours mean, how notes are worded
- the project file reference and two sample project files
- a drawing map: what past permit sets of each project type contained (sheets, details, note blocks), as counts
- the index of the standard detail library: title, category, scale, and whether the engineer has checked each one

The drawing map counts what past sets contained. It is evidence, not a code requirement.

## What a plan from this plugin is, and is not

Every plan is a **draft**. The plugin organizes what it is given; it does not do the engineering. It does not
choose member sizes, connections, footings or loads. Anything it was not given is listed as an open item for a
licensed engineer to answer. A completeness review is not a structural or code review.

## What the plugin runs, sends and fetches

Nothing. This edition holds only Markdown, JSON and one image. It has no scripts, no hooks, no MCP servers, no
network calls, no credentials and no telemetry.

## The full edition

Source, examples and documentation: <https://github.com/oasiseng/Oasis-Blueprints> and
<https://docs.oasisengineering.com>. This edition is built from that repository.

## License

MIT License, Copyright (c) 2026 Oasis Engineering, LLC.
