# The project file

One JSON file per job. Everything on the sheets that is not linework comes from here, so a change of
address, a new note or an engineer's answer is an edit to this file and a rebuild. Complete examples:
`assets/examples/sunroom-repair/project.json`, `assets/examples/deck/project.json`.

## Top level

| Key | Required | What it is |
|---|---|---|
| `schema` | no | `"oasis-blueprints/0.2"` |
| `jobType` | yes | Which drawing code to use: `sunroom`, `deck`, or the name of your own `<jobType>.js` |
| `status` | no | `draft` (default), `review`, `permit`, `construction`. See below |
| `firm` | no | Company block. Usually left out and supplied by `brand.json` |
| `project` | yes | Title block: what and where |
| `people` | no | `drawnBy`, `checkedBy` |
| `issue` | no | `date` (defaults to today), `revisions: [{no, text, date}]` |
| `geometry` | yes | Numbers the drawing code reads. Shape is set by the job type |
| `scales` | no | Override view scales: `{plan, section, side, details, d1, d2, picture, cover}` |
| `summary` | yes | Headline and standing text |
| `facts` | no | Up to 6 key facts across the top of the field sheet |
| `steps` | no | The build sequence, 3 to 5 |
| `scope` | no | Scope rows on the cover |
| `notes` | no | Numbered job notes on the cover, in groups |
| `criteria` | no | Design criteria table. Blank values print as a red Engineer chip |
| `openItems` | no | What the engineer or the field still owes |
| `sheets` | no | Sheet list. Defaults to a cover and a field sheet |

## `firm` (or `brand.json`)

```json
{ "name": "Your Company, LLC", "wordmark": "Your Company", "logo": "logo.png", "accent": "#1f63d6",
  "lines": ["123 Main St", "City, ST 00000", "Firm license no. 00000", "P: 000-000-0000", "www.example.com"] }
```

`logo` is a path (relative to the project file or the brand file) or a `data:` URI; build.py embeds
it. Without a logo the first word of `wordmark` is set large and the rest small. `accent` colours the
wordmark only: it does not change the blue that means "new work". `brand.json` may hold these keys
directly or under `"firm"`. Values in the project's own `firm` win.

## `project`

`title` (required, short: "Rear Sunroom"), `subtitle`, `number`, `address`, `locality` (city, state,
zip), `permit`, `relatedPermit`, `relatedScope`, `use` (one line under the cover headline).
A blank `number`, `locality` or `people.drawnBy` adds an automatic "Title block" open item.

## `geometry`

Whatever the job type's `derive` and views read. Always include `units`: `"in"` (default) or `"mm"`.
All lengths in that unit. Put member names the notes print here too (`"joistName": "2×8"`), so a
size change is one edit. Add `source` to say where the dimensions came from.

For `deck`: `L`, `D`, `deckH`, `post`, `postName`, `postsX[]`, `beamY[]`, `beamDepth`, `beamPlies`,
`plyT`, `beamName`, `joistDepth`, `joistT`, `joistSpacing`, `joistName`, `deckingT`, `deckingName`,
`footingDia`, `footingDepth` (the footing is drawn schematically until open item `footing` is answered).

For `sunroom`: `clearL`, `clearD`, `post`, `roofL`, `roofD`, `longBays[]`, `door[y0,y1]`, `rightMid`,
`slopeRise`, `slopeRun`, `h0`, `rafterDepth`, `beamDepth`, `rafterSpacing`, `wallT`,
`openings[{x0,x1,label,sill,head}]`.

## `scales`

Scale is a plain ratio. `24` is ½" = 1'-0" (1:24); `50` is 1:50. Imperial labels exist for
4, 6, 8, 12, 16, 24, 32, 48, 96; any other number, and every metric project, prints as `1:n`.
`details` applies to every detail; `d1`, `d2` override one. Use this when a view does not fit its box.

## `summary`

| Key | Where it shows |
|---|---|
| `headline` | Big line on both sheets. One short sentence |
| `text` | Two or three plain sentences under it |
| `howToRead` | Under the legend on the cover |
| `sequenceNote` | Small print under the steps (means and methods are the contractor's) |
| `reserved`, `reservedTitle` | The band on the cover kept for the engineer's general notes |

## `facts`

`{ "k": "Joists", "tag": "N", "v": "2×8 @ 16\" o.c.", "s": "To beam: {joistToBeam}" }`
`tag`: `"N"` new (blue), `"E"` existing (grey), any other text prints as an outline chip, `""` none.
`v` is the big value, kept short. `s` is one small line and may use the markup below.

## `steps`

`{ "pic": "posts", "title": "Posts and beams", "text": "...", "hold": "...", "ref": "Details {d1} and {d2}" }`
`pic` names a step picture defined by the job type (`deck`: `footings`, `posts`, `joists`, `decking`,
`all`; `sunroom`: `verify`, `shore`, `columns`, `rafters`, `roof`, `all`). `hold` is an orange
stop-and-ask line. Keep `text` under about 45 words: the audit reports overflow.

## `scope`

`{ "kind": "n", "item": "Posts and bases", "text": "..." }` with `kind` `n` new, `e` existing, or `o`
other (set `tag`, for example `"Separate permit"` or `"Not in this set"`).

## `notes`

`[{ "title": "Framing", "start": 3, "items": ["**Posts.** ...", "..."] }]`. Numbering runs through the
groups, so set each group's `start`.

## `criteria`

`[{ "k": "Governing code and edition", "v": "" }]`. Leave `v` empty for unsupported values.
It prints as a red Engineer chip and the user fills it in the editor. Empty or whitespace-only
criteria keep an automatic design-criteria item open even after other answers have been recorded.
An existing unanswered item keyed `criteria` represents these blanks until it is answered.

## `openItems`

```json
{ "key": "anchor", "title": "Column base anchorage",
  "text": "Anchor type, size, embedment and edge distance into the existing concrete.",
  "who": "Engineer", "answer": "" }
```

- `key`: short, unique, letters and digits. It is how text and drawing code refer to the item.
- `text`: what is needed, specific enough to answer in one line.
- `who`: `Engineer`, `Field verify`, `Field measure, then engineer`, `Office`.
- `answer`: empty while open. Once filled, the item moves to "Recorded answers", `{key}`
  prints the answer, and views that call `answer(P, 'key')` draw it in blue instead of red.

An answer does not establish engineer approval or automatically update numeric geometry. Record its
source and review status in the item text or project notes. Reconcile any changed sizes with
`geometry` and all affected labels before rebuilding.

Make an open item for every engineering value the user did not give, and for every existing condition
the drawing assumes.

## `sheets`

```json
[ { "no": "S0.0", "type": "cover",    "name": "Cover, scope and notes", "what": "..." },
  { "no": "A0.1", "type": "reserved", "name": "Site plan", "what": "Reserved. Site plan to be added." },
  { "no": "S1.0", "type": "field",    "name": "Framing plan, section and details", "what": "..." } ]
```

`cover` and `field` once each; `reserved` holds a place for a sheet that comes from elsewhere.
`what` is the line in the sheet index.

## Markup in text

Works in `facts[].s`, `steps`, `scope`, `notes`, open item text:

| Write | Prints |
|---|---|
| `**bold**` | bold |
| `[N]` `[E]` `[EOR]` `[HOLD]` | New, Existing, Engineer, Hold chips |
| `{permit}` `{relatedPermit}` | the permit numbers from `project` |
| `{d1}` `{d2}` `{plan}` `{section}` `{side}` `{sheet}` | view numbers and the field sheet number |
| `{anyKey}` | the answer to that open item, or a red Engineer chip while it is open |

## `status`

| Value | Band and stamp | Open items allowed |
|---|---|---|
| `draft` | Draft · for engineer review · not for construction | yes |
| `review` | Released for review · not for construction | yes |
| `permit` | Issued for permit | no: the audit fails |
| `construction` | Released for construction | no: the audit fails |

Only move past `review` when the user says the engineer has closed every item.
