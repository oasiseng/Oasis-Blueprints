---
title: Make a deck set
description: Draft a freestanding deck with the deck job type that ships with the kit, and leave the engineering values open.
---

The `deck` job type draws a freestanding rectangular deck in inches or millimetres: posts on footings, beams, joists
and deck boards. It does not attach the deck to a house. The [deck example](/examples/deck/) is a draft built this way.

## What you give it

The layout and the sizes the owner proposes, all in the declared unit. From the example (`"units": "in"`):

```json
"geometry": {
  "units": "in",
  "source": "Sizes and layout as given by the owner. Member sizes are the owner's proposal, to be confirmed by the engineer.",
  "L": 192, "D": 144, "deckH": 30,
  "post": 5.5, "postName": "PT 6×6", "postsX": [12, 96, 180], "beamY": [18, 126],
  "beamDepth": 9.25, "beamPlies": 2, "plyT": 1.5, "beamName": "(2) 2×10",
  "joistDepth": 7.25, "joistT": 1.5, "joistSpacing": 16, "joistName": "2×8",
  "deckingT": 1, "deckingName": "5/4×6",
  "footingDia": 16, "footingDepth": 24
}
```

A 192 × 144 in deck is 16 × 12 ft. `postsX` and `beamY` place three posts under each of two beams. The member names
(`postName`, `beamName`, `joistName`) are what the notes print, so a size change is one edit. `source` says where the
numbers came from: here, the owner's proposal, not a design.

## What stays open

Everything the engineer has to decide is an open item, not a value the assistant fills in. The example keeps eight:
member sizes and spans, footings, post base and anchor, beam-to-post connection, joist-to-beam connection, lateral
bracing, guards and stairs, and the design criteria. Its design criteria (code edition, loads, soil bearing, frost
depth, lumber grade, connectors) are blank and print as red Engineer chips.

The deck views read the answers with `answer(P, 'footing')`, `answer(P, 'postBase')` and so on. Until an item is
answered the drawing shows it in red, and the footing is drawn schematically.

![Field sheet of the deck example](/ref/examples/sheet-sets/deck/preview-field.png)

## Build and check it

```bash
python skills/oasis-blueprints/scripts/build.py examples/sheet-sets/deck/project.json deck.html
python skills/oasis-blueprints/scripts/print.py deck.html deck.pdf --png deck-
```

The audit is clean for a draft with open items. It fails only if the status says `permit` or `construction` while items
remain. The framing plan prints at 1/24, the section at 1/16 and the two connection details at 1/4 and 1/6.

## Metric

Set `"units": "mm"` and give every length in millimetres. Do not convert an imperial project by changing only the
`units` label. Scales on a metric project print as `1:n`.
