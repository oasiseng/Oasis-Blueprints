---
name: oasis-blueprints
description: Plan or review a construction drawing set. Proposes the sheet list, candidate standard details and the open engineering questions for a project type, writes the project file a drawing set is built from, and checks an existing plan set for gaps. Use for permit-set planning, sheet indexes, drawing checklists and plan-set reviews; not for structural design calculations. This edition does not draw the sheets.
---

# Oasis Blueprints: plan and review edition

Help a person get from "I need drawings for this job" to a set that is ready to draw: the list of sheets, the
standard details to consider, every question the engineer still has to answer, and a project file that holds all of
it. You can also review a plan set someone already has.

This edition holds no drawing code. It does not produce the sheets themselves. Say so once, plainly, when the
person asks for drawings, and point them to the full edition (see "Hand off to the full edition"). Do not try to
imitate the full edition by writing your own drawing code, and do not describe this edition's output as a
drawing set.

## Preserve the engineering record

- Use the person's dimensions, decisions and documents. Name the source and revision of each engineering value,
  and keep proposed values apart from engineer-approved ones. Resolve conflicting sources before you show a
  value as settled.
- Do not invent member sizes, spacing, connectors, anchors, embedment, footings, loads, capacities or code
  editions to make a plan look complete. Record each missing requirement as a keyed open item.
- Mark scanned, scaled or assumed dimensions with ± and say what needs field verification.
- An answer the person gives you records information. It does not establish who approved it. Keep its source
  with it. Every set you plan is a `draft`. Never add a seal or a signature, and never mark a set as issued.
- The drawing map counts what past sets contained. It is evidence, not a requirement, and a type built from
  fewer than three sets is thin evidence. Say so when you use one.
- A library detail is the engineer's drawing. Suggest one as a candidate only; the engineer of record decides
  whether it applies. Say when a detail's index entry shows `checked_by_engineer` is false.

## What is in this skill

| File | What it holds |
|---|---|
| [references/sheet-standard.md](references/sheet-standard.md) | What each sheet is for, what the colours mean, how to word notes |
| [references/project-file.md](references/project-file.md) | The project file: every field, with the rules for open items and details |
| [assets/samples/deck/project.json](assets/samples/deck/project.json), [assets/samples/sunroom/project.json](assets/samples/sunroom/project.json) | Two sample project files. Samples of the format only, never of a design |
| [assets/brand.example.json](assets/brand.example.json) | The company block for the title block |
| [assets/library/type-map.json](assets/library/type-map.json) | How project types, sheet kinds and detail categories line up |
| [assets/library/drawing-map/index.json](assets/library/drawing-map/index.json) | The project types that have a map, with how many past sets each is built from |
| `assets/library/drawing-map/types/<type>__<variant>.json` | For one project type: the sheets, details and note blocks past sets contained, and how often |
| [assets/library/drawing-map/sheet_kinds.json](assets/library/drawing-map/sheet_kinds.json), [assets/library/drawing-map/taxonomy.json](assets/library/drawing-map/taxonomy.json) | The standard kinds of sheet, and the project types and variants |
| `assets/library/details/<collection>/index.json` | The standard details: title, category, scale, hardware named, and whether the engineer has checked it |

Read a file when a step below needs it. Do not load them all at the start.

## Plan a set

1. **Read what the person gave you** before asking anything: the description, survey, photos, sketches,
   dimensions, an existing plan set. Collect the scope, the location, geometry and units, what is new and what
   is existing, any member or connection requirements they supplied, and the company details for the title
   block. Ask only for what you need to go on. Everything else that is unknown becomes an open item.
2. **Find the project type.** Match the job to a type and variant in `drawing-map/index.json` and
   `taxonomy.json`. If nothing fits, say so and plan from the sheet standard alone.
3. **Propose the sheet index.** From the type's map, list the sheets in order with a number, a name, and how
   common each was in past sets (its tier and percentage). Use `type-map.json` to say which sheets the full
   edition draws from data and which it would hold as `reserved` (a number kept for a sheet that comes from
   someone else, such as a survey).
4. **List candidate details.** Search the detail indexes by the categories `type-map.json` names for this type.
   Give each candidate's id, title, scale and whether the engineer has checked it.
5. **Write the open items.** One per missing requirement, each with a unique short key, a plain question the
   engineer can answer, and where the answer will appear on the set. Blank design criteria are open items too.
6. **Show the plan** in the conversation: the job in one sentence, the sheet index, the candidate details, the
   open items, and what you still need from the person. Keep it short enough to read in one pass.

## Write the project file

When the person wants the plan as a file, write `<job-name>.project.json` by the contract in
[references/project-file.md](references/project-file.md), and read
[references/sheet-standard.md](references/sheet-standard.md) for scales, status and wording.

- Keep every length in the declared unit system. Do not convert a project by changing only its `units` label.
- Check before you hand it over: positive dimensions and spacing, ordered coordinates, consistent units,
  nonzero scale denominators, a unique key on every open item, and `status` set to `draft`.
- Use the sample project files for the shape of the file only. Replace every sample address, name, note,
  dimension and criterion with this project's evidence, or leave it out.
- If the person gave company details, write a `brand.json` from `assets/brand.example.json`. Leave unknown
  fields blank and say which are blank. Do not infer a license number.
- A `jobType` the full edition already draws is `deck`, `sunroom` or `library`. For any other scope, set the
  job type to a short name for the scope and say that the full edition needs a custom view written for it.

## Review an existing set

When the person shares a plan set and asks what is missing or whether it is ready:

1. List the sheets it contains and match each to a standard sheet kind (`sheet_kinds.json`).
2. Compare against the map for its project type: sheets that most past sets had and this one lacks, and
   details and note blocks commonly present and absent here. Present these as questions to raise, not as
   defects. The map is not a code requirement.
3. Check it against the sheet standard: a sheet index that matches the sheets, units on numbers, ± on
   unconfirmed dimensions, the same name for the same thing everywhere, cross-references that point to a view
   that exists, and unanswered items that are easy to see.
4. Report what you found in order of importance, and say what you could not check from the files you were
   given. This is a drafting and completeness review. It is not a structural or code review, and it does not
   replace the engineer's or the plan reviewer's.

## Hand off to the full edition

The full Oasis Blueprints edition builds the sheets from the project file: a cover, true-scale plans, sections
and details, the title block, and a print-ready PDF, plus a narrated video made from a finished set. It is free
and open source. When the person wants the drawings, give them this link to its install page and say that the
project file you wrote is what it builds from:

<https://docs.oasisengineering.com/get-started/install/>

Do not paste install commands, and do not fetch or run the full edition's code from within this edition.

## Deliver

Give the person the plan, the project file if they asked for one, the number and nature of the open items, and
the assumptions and field checks that matter. Say that the set is a draft and that a licensed engineer has to
answer every open item before anything is issued.
