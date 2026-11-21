# Panel schedule: design and styling instructions

The goal is a panel schedule that looks like the panel itself. An electrician or a DIYer should be able to stand at the open panel and read it without a legend. Everything below supports that goal. When a rule here conflicts with habit ("that's how CAD does it"), the rule wins.

## 1. Reading size: the 13-inch rule

A 24 x 36 sheet shown at 50% on a 13" laptop should read like chat text. It should also stay comfortable printed full size.

| Element | Size | Weight | Colour |
|---|---|---|---|
| Panel name ("Panel A") | 44 pt | 700 | ink |
| Circuit name | 22 pt | 500 | ink |
| Secondary line (what the circuit feeds) | 18 pt | 500 | grey |
| Protection ("AFCI + GFCI required", "GFCI receptacle") | 18 pt | 700 | ink |
| Wire chip, VA, header labels | 18 pt | 500 | ink on light grey / grey |
| Breaker trip ("20 A") | 24 pt | 700 | ink |
| Totals (leg VA, demand amps) | 30 pt | 700 | leg colour / ink |
| Drawing lettering (riser, details) | ≥ 0.25" printed (≈ 18 pt) | 600–700 | blue leaders, ink notes |

- Nothing is smaller than 18 pt.
- Secondary information is lighter and grey, never smaller than 18 pt.
- Subtitles are normal weight. Bold is for names, numbers and protection.
- Use tabular numerals (`font-variant-numeric: tabular-nums`) so columns of amps and VA line up.

## 2. Type

- **Font:** Barlow Semi Condensed, weights 500 and 700. It is SIL Open Font License and is embedded in the page as base64, so the HTML and PDF need no font install.
- **Case:** sentence case on the schedule ("Kitchen countertop 1"). Drawings keep upper case because their leaders match the office details.

## 3. Colour has one job

| Token | Value | Use |
|---|---|---|
| `INK` | `#1d1d1f` | All text that matters, including protection |
| `SUB` | `#6e6e73` | Secondary lines, labels |
| `HAIR` | `#d2d2d7` | Row rules |
| `CARD` | `#f5f5f7` | Breaker fill, wire chip fill |
| Leg A | `#0a6fd6` | Bus stab pill A **and** the Leg A total and bar |
| Leg B | `#5e5ce6` | Bus stab pill B **and** the Leg B total and bar |
| Red | `#c81d25` | Only items the engineer still has to confirm (on the sheet, never inside the schedule) |

- Blue and violet tie each bus stab to its leg total at the bottom. That is all they do.
- Call them **Leg A and Leg B**. On 120/240 V single phase there are two legs, not phases.
- Protection, wire and loads stay black or grey. Don't add a colour per protection type.

## 4. Layout: the panel as installed

```
 CKT | name / what it feeds / protection / wire · VA | BREAKER | BUS | BREAKER | name ... | CKT
  1  |                              Water heater     | 60 A 2P |  A  | 40 A 2P | Cooktop / range |  2
  3  |                                               |         |  B  |         |                 |  4
```

- **Grid:** 7 columns, `.62in 1fr 1.02in .62in 1.02in 1fr .62in`. The middle column is the bus: a light grey bar with a round leg pill per row (A, B, A, B ...).
- **Order:** odd circuits on the left and even on the right, numbered top to bottom like a real panel.
- **Alignment:** left-side text is right-aligned toward the bus and right-side text is left-aligned toward the bus, so the panel reads symmetrically from the centre.
- **2-pole breakers** span two rows (one breaker box, two circuit numbers stacked: "1 / 3"), sitting on both legs.
- **Row heights:** used rows are 1.36". Unused spaces are compact (0.34") with a faint "Space" label. Every space still shows, so the count matches the can.
- **Spares** show a dashed, empty breaker in grey.
- **Header:** the panel name big on the left. A key/value grid on the right (bus, main, fed from, spaces, location, mounting), with the label grey above the value.
- **Footer:**
  - Left: Leg A and Leg B totals with bars, scaled to the larger leg, so the balance shows at a glance.
  - Right: connected load (VA and A), then the NEC 220 demand load against the service rating with a black bar.

## 5. Protection goes where it is provided

This is the most important rule. A badge saying "AFCI GFCI" doesn't tell the electrician what to buy. Where the label sits answers that.

| What the schedule means | Where it is printed |
|---|---|
| The breaker provides it (dual-function AFCI/GFCI, AFCI or GFCI breaker) | **Inside the breaker box**, under "20 A · 1P" |
| A standard breaker feeds a GFCI receptacle | **Beside the description**: "GFCI receptacle" |
| The circuit needs it, but the method isn't chosen yet | **Beside the description**: "AFCI + GFCI required" |

In code, `method={ckt: {'AFCI': 'breaker' | 'receptacle' | 'open', 'GFCI': ...}}`. Anything not listed is `open`. Mixing is allowed: a circuit can have AFCI in the breaker and a GFCI receptacle downstream.

## 6. Each circuit, top to bottom

1. **Name**, e.g. "Kitchen countertop 2": 22 pt ink.
2. **What it feeds**, e.g. "Small appliance circuit": 18 pt grey.
3. **Protection** when it isn't in the breaker: 18 pt bold ink.
4. **Wire chip plus load**: `#12 Cu, #12 G` on a light grey pill, then `1,500 VA` in grey.

The breaker box carries the trip ("20 A", big), the poles ("1P", grey) and any protection the breaker provides.

## 7. The riser goes with the schedule

The riser diagram takes every rating as data: service and bus amps, spaces, feeder conductors, conduit, ground and GEC, calculated amps. It is drawn from the same numbers as the schedule and load calculation, so the three can't drift apart. Lettering is 0.28" at its own size, blue leaders, and green for the grounding electrode conductor.

## 8. Don'ts

- Don't build a wide spreadsheet with phase columns. The panel layout replaces it.
- Don't use more colours, icons, or a colour per protection type.
- Don't use all caps in the schedule.
- Don't drop below 18 pt.
- Don't put engineer-to-confirm items inside the schedule. They go in a red note on the sheet.
- Don't invent ratings. Every number comes from the load calculation or the equipment data.
