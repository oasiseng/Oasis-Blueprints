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

## AI limitations and professional responsibility

**AI-generated drawings can contain errors and must never be assumed accurate, complete, code-compliant, or suitable for
construction without independent professional verification.** Artificial intelligence can misinterpret project
documents, omit critical information, introduce incorrect dimensions or annotations, reference outdated codes, and
generate details that appear technically valid but are inaccurate or inappropriate for the project. Automated layout
checks and the absence of flagged open items do not establish engineering correctness, structural adequacy, or
regulatory compliance.

**The user and the responsible licensed professional must independently verify all information before relying on or
issuing any drawings.** This includes, without limitation, dimensions, elevations, loads, calculations, materials,
member sizes, connections, anchorage, applicable codes, specifications, and coordination between sheets. All
AI-generated content must be reviewed against the original project documents, verified engineering calculations,
applicable standards, and site-specific requirements. Professional review must be substantive and consistent with
applicable responsible-charge obligations, not merely a final signature or seal.

Oasis-Blueprints is a drafting and documentation tool, **not a licensed engineer, engineering design authority, or
substitute for professional judgment.** Use of this software does not transfer or reduce the legal, ethical, or
professional responsibilities of the engineer of record or other responsible design professionals. Users remain
responsible for determining whether the resulting documents are appropriate for their intended use and for obtaining
all required professional reviews, approvals, signatures, and seals.

This approach is consistent with the professional responsibility principles discussed by the Florida Board of
Professional Engineers (FBPE) in its article, [*Regulation in the AI Era*](https://fbpe.org/regulation-in-the-ai-era/),
which recognizes that AI may assist engineering work but cannot replace the judgment, oversight, or accountability of
a licensed Professional Engineer. Reference to the FBPE article is provided for educational purposes and does not
imply regulatory approval, certification, or endorsement of Oasis-Blueprints.

**Bottom line: AI assists with drafting. Qualified professionals remain responsible for engineering, verification, and
approval.**

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
