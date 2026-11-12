# PCP: Project Context Protocol

PCP is an open, machine-readable protocol for defining how a project should run.

It standardizes:
- project type and execution model
- required deliverables
- required documents
- context libraries (engineering standards, QC checklists, policies)
- optimization rubrics (cycle time, quality, predictability, cost)
- bot/agent operating context
- Airtable mapping for operational use

The goal is simple: one shared project contract that humans and bots can both execute against.

## Why PCP

Most teams lose time because project context lives across docs, chat, and memory. PCP turns that context into a single protocol payload so work can be launched, audited, and automated consistently.

## Core Concepts

- `project`: identity, type, goals, stage, roles
- `deliverables`: what must be produced and how completion is measured
- `documents_required`: mandatory artifacts to create/maintain
- `context_modules`: reusable policy and execution libraries
- `workflows`: stage gates and QC checks
- `agents`: bot responsibilities and boundaries
- `airtable`: mapping of PCP entities to Airtable tables/fields

## Quick Start

1. Copy an example from `examples/`.
2. Validate your PCP file against `schema/pcp.schema.json`.
3. Reference reusable defaults from `library/`.
4. Map entities into Airtable using `airtable/field-mapping.md`.

## Repository Layout

- `SPECIFICATION.md`: protocol specification
- `schema/pcp.schema.json`: JSON Schema for PCP payloads
- `examples/`: complete sample PCP payloads
- `library/`: reusable project types, deliverables, docs, context modules
- `airtable/`: Airtable integration guidance
- `templates/`: document templates used by PCP payloads
- `docs/`: operational templates and reference docs
- `WindCalculations/`: standardized wind-calculation subcategory playbooks
- `skills/oasis-blueprints/`: the Oasis-Blueprints drawing skill (HTML sheet sets), see below
- `examples/sheet-sets/`: example sheet sets built with it (project file, HTML, PDF, previews)


## New: Standardized Engineering Intake Matrix

For teams mapping project types to default deliverables, required documents, and execution resources:

- Canonical matrix: `library/taxonomy/project-delivery-matrix.json`
- Operational guidance: `docs/standardized-sop-framework.md`
- Example generated PCP payload: `examples/container-home-pcp.json`

This gives you a machine-readable baseline for Airtable automations and bot task assignment.

Wind subcategory playbooks are available under `WindCalculations/` and mapped in `library/taxonomy/project-delivery-matrix.json`.


## New: Standardized Engineering Intake Matrix

For teams mapping project types to default deliverables, required documents, and execution resources:

- Canonical matrix: `library/taxonomy/project-delivery-matrix.json`
- Operational guidance: `docs/standardized-sop-framework.md`
- Example generated PCP payload: `examples/container-home-pcp.json`
- Container plans deliverable index: `docs/container-plans-deliverable.md`
- Plans-as-product strategy scaffold: `docs/plans-as-product-scaffold.md`

This gives you a machine-readable baseline for Airtable automations and bot task assignment.

## New: Oasis-Blueprints, drawings as HTML

Building departments ask for a PDF, not a DWG. So the drawing can be a web page: one self-contained HTML
file per job, 24 × 36 in sheets, every view at a stated true scale, printed to PDF by any browser.
`skills/oasis-blueprints/` is an Agent Skill that makes Claude or ChatGPT draw that set from a described
job, with your own company and logo in the title block.

![Field sheet of the sunroom repair example](examples/sheet-sets/sunroom-repair/preview-field.png)

What a set looks like:

- **Cover** for the office and the plan reviewer: the job in one sentence, scope, notes, design criteria
  and the list of open items.
- **Field sheet** for the person building it: a picture of the finished job, numbered steps with a small
  picture each, a plan, a section and the connection details.
- **Colour is meaning**: blue is new work, grey is existing, red is waiting on the engineer, orange is a hold.

The rule the skill is built around: **the model is the drafter, not the engineer.** It never supplies a
member size, anchor, footing or load on its own. Anything the user did not give becomes an open item,
shows red on the sheets, is counted in the title block, and blocks the set from being issued until the
engineer of record answers it. The built HTML has an **Edit** button for typing those answers, filling
the title block and swapping the logo, then **Print / Save as PDF**.

Examples (built output is committed so you can open it without installing anything):

| Example | Job type | Open it |
|---|---|---|
| Sunroom repair | `sunroom` (existing + new, imperial) | [`sheet-set.pdf`](examples/sheet-sets/sunroom-repair/sheet-set.pdf) · [`sheet-set.html`](examples/sheet-sets/sunroom-repair/sheet-set.html) · [`project.json`](examples/sheet-sets/sunroom-repair/project.json) |
| Freestanding deck | `deck` (all new, inches or millimetres) | [`sheet-set.pdf`](examples/sheet-sets/deck/sheet-set.pdf) · [`sheet-set.html`](examples/sheet-sets/deck/sheet-set.html) · [`project.json`](examples/sheet-sets/deck/project.json) |

Use it:

- **As a skill in Claude or ChatGPT.** Zip the folder (`cd skills && zip -r oasis-blueprints.zip oasis-blueprints`)
  and upload the zip where your app manages skills. Then ask for a drawing set and give it your job.
- **As a Claude plugin.** This repository is a plugin (`.claude-plugin/plugin.json`) that carries the skill.
- **By hand.** Python 3 standard library only:

  ```bash
  cd skills/oasis-blueprints
  python scripts/build.py assets/examples/deck/project.json deck.html --brand my-brand.json
  python scripts/print.py deck.html deck.pdf --png preview-     # optional: needs Playwright + Chromium
  ```

Start with [`skills/oasis-blueprints/SKILL.md`](skills/oasis-blueprints/SKILL.md). A new kind of job is one
JavaScript file of about 150 lines: see
[`references/writing-views.md`](skills/oasis-blueprints/references/writing-views.md).

The kit draws and checks layout. It does not design or check structure, and a set is a draft until a
licensed engineer closes the open items and seals it.

## Versioning

Protocol versioning uses semantic versioning in `pcp_version`.

- Major: breaking structural changes
- Minor: backward-compatible additions
- Patch: clarifications and non-breaking fixes

## Open Source Intent

This repository is designed as a shared public baseline for teams and autonomous systems. You can fork it, extend it, and propose upstream improvements.
