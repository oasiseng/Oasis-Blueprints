---
title: Open items and statuses
description: How missing engineering values are tracked, shown in red, answered, and how they gate the set's status.
---

An open item is something the engineer, the office or the field still owes. It has a unique key:

```json
{ "key": "anchor", "title": "Column base anchorage",
  "text": "Anchor type, size, embedment and edge distance into the existing concrete.",
  "who": "Engineer", "answer": "" }
```

`who` is `Engineer`, `Field verify`, `Field measure, then engineer` or `Office`.

## While it is open

- It is listed in red under **Open items for the engineer** on the cover and counted in the title block.
- `{anchor}` in facts, steps, scope, notes or another item's text prints as a red Engineer chip.
- A view that calls `answer(P, 'anchor')` draws it in red.
- A blank design criterion also prints as a red Engineer chip and keeps a design-criteria item open.
- A blank project number, locality or drawn-by adds an automatic title block item.

## When it is answered

Fill `answer`, in the project file or with **Edit** in the browser. The item moves to **Recorded answers**, `{anchor}`
prints the answer, and views that call `answer(P, 'anchor')` draw it in blue.

An answer does not change geometry. If it changes a size, change `geometry` and the related notes, then rebuild.

## Statuses

| Status | Band and stamp | Open items allowed |
|---|---|---|
| `draft` (default) | Draft · for engineer review · not for construction | yes |
| `review` | Released for review · not for construction | yes |
| `permit` | Issued for permit | no: the audit fails |
| `construction` | Released for construction | no: the audit fails |

Only move past `review` when the engineer has closed every item. The [deck example](/examples/deck/) is a draft with
eight items open; the [site plan](/examples/site-plan/) and [sunroom repair](/examples/sunroom-repair/) examples have
every item answered and are released for construction.
