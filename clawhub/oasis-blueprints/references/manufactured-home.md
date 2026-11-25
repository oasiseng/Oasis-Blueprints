# Job type `manufactured-home`

A permanent pier foundation, a site plan and freestanding entry decks for a multi-section HUD-code manufactured home:
one cover and three field sheets. Drawing code: [`assets/views/manufactured-home.js`](../assets/views/manufactured-home.js).
Sample: [`assets/samples/manufactured-home/project.json`](../assets/samples/manufactured-home/project.json).

The kit draws one kind of field sheet per job. This job type draws three, so each field sheet names its view:

```json
"sheets": [
  { "no": "S0.0", "type": "cover", "name": "Cover, scope and notes" },
  { "no": "C1.0", "type": "field", "view": "site", "name": "Site plan" },
  { "no": "S1.0", "type": "field", "view": "foundation", "name": "Foundation plan, section and details" },
  { "no": "S2.0", "type": "field", "view": "deck", "name": "Entry decks" }
]
```

Leave out a sheet to leave out its view (a job with no decks has no `deck` sheet, and then needs no `deck` block).
The cover, its picture and every cross-reference in the notes point at the foundation sheet.

## `sheetData`

`sheetData.site` and `sheetData.deck` give those sheets their own `summary`, `facts`, `steps` and `pictureTitle`.
A sheet without an entry uses the project's `summary`, `facts` and `steps` (the foundation sheet does).
Step pictures: `site` uses `stake`, `util`, `home`, `finish`; `foundation` uses `footings`, `piers`, `home`, `ties`;
`deck` uses `footings`, `frame`, `decking`, `guards`.

## `geometry` (the foundation, inches)

The home: `L` (length), `Ws` (section width), `nSec` (sections), `iBeamSpacing`, `endDist`, `iBeamDepth`,
`floorDepth`. Supports: `pierSpacing`, `mlSpacing` (marriage line), `padFrame`, `padML`, `padCol`, `padT`, `embed`,
`pierH`, `pierW`, `pierT`, `blockH`, `mlStations[]`, `colStations[]` (ridge-beam columns), `doorPiers[]`.
Wall and footing: `wallT`, `wallName`, `ftgB`, `ftgH`, `wallTop`. Anchorage: `anchorSpacing`, `anchorH`,
`strapAngle`, `endTieAngle`, `endTies`, `tieEnd`. Every `…Note`, `…Name` and `…Spec` string is printed on the
drawings as written; put loads and capacities there only once the engineer has given them.

## `site` (decimal feet)

Origin at the front-left lot corner; x runs along the frontage toward the driveway side, y toward the rear.

| Key | What |
|---|---|
| `boundary` | `[front-left, rear-left, rear-right, front-right]`, each `[x, y]` |
| `arc` | The frontage, `[x, y]` points from the front-left to the front-right corner, x increasing |
| `home` | `[x0, y0, x1, y1]`, the home's footprint |
| `decks` | `[{ deck, stair, pad }]`, each a rectangle `[x0, y0, x1, y1]`; the first is the front deck |
| `hvac`, `md`, `pole`, `access`, `vents[]` | Pad rectangle, meter / disconnect point, utility pole, crawl-space access and vents |
| `water`, `sewer`, `electric` | Service routes, polylines from the street to the home |
| `drive` | `{ x0, x1, yTop, label }`: driveway from the frontage to `yTop` |
| `frontSetback`, `rearClear` | `{ from, to, label }`: the dimension lines for the front and rear yards |
| `north` | Unit vector of north in plan coordinates |
| `street`, `frontageNote`, `sideA`, `sideB`, `rear` | Labels; the side and rear labels carry bearings and lengths |
| `woodland`, `easement` | Optional labels (an easement is drawn along the right-hand lot line) |
| `homeSize`, `homeModel`, `deckSheet`, `foundSheet` | Text printed on the plans |
| `coverage`, `coverageNote` | Rows of the placement and coverage table: `[label, value]`, `[label, value, "b"]` bold, `[title, "", "h"]` heading |
| `utilityNote`, `generalNotes[]`, `sourceNote` | The legend note, the site plan notes, and the note under the site plan |
| `pavementOffset` | Optional `[dx, dy]` from the frontage to the drawn edge of pavement (default `[-5.6, -12.2]`) |

The site plan prints at 1" = 30' and the enlarged plan at 1" = 15', so the plan fits a lot of about 90 by 210 ft.
Labels are placed from the lot and the home; check the preview and move a label in the data if it lands on work.

## `deck` (inches)

One freestanding deck, typical of the decks on the site plan: `L`, `D`, `gap` (clear of the home), `deckH`,
`threshold`, `post`, `postInset`, `postInsetHome`, `joistX[]`, `joistSpacing`, `joistT`, `joistDepth`, `beamDepth`,
`beamPlies`, `plyT`, `deckingT`, `footingDia`, `footingDepth`, `stemDia`, `stemTop`, `standoff`, `guardH`, `stairW`,
`stairRun`, `risers`, `tread`, `padD`, `padT`, and the printed names and notes (`joistName`, `beamName`, `postName`,
`deckingName`, `stringerName`, `stringerCount`, `lumber`, `…Note`). `guardLoadRef` names the code table for the guard
load, if any.

## General notes

With `generalNotes` in the project, the notes that point at them name the note (`SEE GENERAL NOTE A1`); without them
they say `SEE GENERAL NOTES` and the cover keeps the band reserved for the engineer's notes.
