---
title: Drafter, not engineer
description: The rule the skill is built around. It never supplies an engineering value.
---

**The model is the drafter, not the engineer.**

- The skill never supplies an engineering value. No member size, spacing, connector, anchor, embedment, footing, load,
  capacity or code edition comes from the model. Anything the user did not give becomes an
  [open item](/concepts/open-items/), shows red on the sheets and is counted in the title block.
- A set is a draft until the engineer of record has closed every open item. The status cannot move to `permit` or
  `construction` while any item is open: the layout audit fails.
- A set is sealed by a licensed engineer, not by the kit. The kit never adds a seal or a signature.

## What the kit does and does not check

The kit draws and checks layout: every view at its stated scale, nothing overflowing its box. It does not design or
check structure. The tests in the repository check drafting behaviour, not structural adequacy or engineer approval.

## Where values come from

- Values the user gives, with their source and revision.
- Values from supplied project documents, such as a survey or the engineer's response.
- Library details, which are the engineer's drawings: one goes on a set only when the engineer of record says it
  applies, and nothing inside it is edited.

An answer typed into an open item records information. It does not say who approved it, so the source and review
status go with it.

## Samples are not designs

The samples and examples show layout. Their sizes are not a design for your job.
