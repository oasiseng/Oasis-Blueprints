# Player and scene files

`build.py` concatenates `assets/player/head.html` (styles, controls, brand CSS, data) + `lib.js`
(helpers) + the job's `scenes.js` + `engine.js` (render loop, controls, audio). Everything is a pure
function of time `t`: seeking, pausing, stepping and frame export are exact. Never keep state between
frames in a scene; derive everything from `lt`.

Globals available to scenes: `IMG[name]`, `SIZE[name]` (crops from `--assets`), `LOGO`, `BRAND`
(`company`, `tagline`, `cta`, `footer`, `renderingNote`), `TIMING`, `REDUCED`.

## Stage layout (1920 × 1080)

| Area | Box |
|---|---|
| Main viewer | x 60, y 60, w 1230, h 840 (`V`) |
| Side column (kicker + on-screen text) | x 1340, y 64, w 520 |
| Captions band | x 60, y 932, w 1800, h 112 (automatic, from the narration) |
| Small logo / sound pill | x 1340, y 820 / right 62, y 836 |
| Explainer chat column | x 80, y 200, w 610 (`.chat`) |

Two side-by-side viewers: `[60,140,860,560]` and `[960,140,900,560]`. Small plan + two stacked sections:
`[60,60,380,840]`, `[470,60,820,400]`, `[470,500,820,400]`.

## A scene

```js
S.push({name: 'Drainage',                       // shown in the controls
  html: side('03 · Drainage', [['Roof runoff → ADS pipe → trench'], ['Meets the ' + D('½-inch') + ' rule']]),
  init(e, k) { sideInit(k); this.T = TM(2);        // TM(i): timing of scene i (0-based)
    const v = this.v = makeViewer(e, V, 'site', 'C001 · Site plan');
    this.pipe = drawLine(v.svg, [[1358,1024],[1388,1054],[1388,2557]], 'glow');
    this.trench = svgEl('rect', {x:1372, y:1030, width:32, height:1527, class:'tint'}, v.svg);
    this.tag = v.ring('Exfiltration trench', {cls:'ghost', side:'left'}); },
  update(lt, k) { const T = this.T, v = this.v;
    const p = T.w(1, 'pipe'), tr = T.w(1, 'trench');            // when those words are said
    v.cam([{cam:{x:.5,y:.5,w:0}}, {t:p-.4, d:2, cam:{x:.6,y:.5,w:.78}}], lt);
    setDraw(this.pipe, prog(lt, p, 1.6));
    setOp(this.trench, prog(lt, tr, .6)); this.tag.set([1372,1030,1404,2557], 0, prog(lt, tr, .6));
    show(k.kick, lt, .2, .4, 0); show(k.i0, lt, p); show(k.i1, lt, T.w(1, 'meeting')); show(k.logo, lt, 0, .01, 0); }});
```
- `html` is static DOM; elements with `data-k="x"` arrive in `init`/`update` as `k.x`.
- `side(kicker, [[html, cls], ...])` builds the side column; items are `k.i0, k.i1, ...`. `cls`: `h`
  (big heading), `green` (green rule). `D(value)` makes a boxed data value. `sideInit(k)` sets the logo.
- Timing: `T.c(k)` start of sentence k, `T.w(k, phrase)` when the phrase is said (a console warning if
  not found, which `check.py` reports), `T.end` end of speech, `T.dur` scene length.
- Animation: `prog(lt, start, dur)` eased 0→1 (a step in reduced motion), `lin(...)` linear,
  `show(el, lt, start, dur, rise)` fade + rise, `vshow(viewer, lt, start, dur, outAt, slideX)`.

## Viewer: a crop with a camera and an overlay

`makeViewer(parent, [x,y,w,h], name, label)` returns `v` with `v.svg` (an SVG in the crop's pixel space,
moving with the image) and:
- `v.setCam({x, y, w})` / `v.cam(keys, lt)`: centre (x, y) as fractions of the crop, `w` = visible width
  as a fraction of the crop (`0` = whole crop fits). Keys `{t, d, cam}` move from the previous camera
  starting at `t` for `d` seconds. The centre is clamped so the view stays on the image.
- `v.ring(label, {side, align, cls, tcls, pad})` → `.set([x0,y0,x1,y1], ringOpacity, tagOpacity)`.
  `cls:'ghost'` = tag only; `'green'` for trees. Tags stay inside the viewer automatically.
- Overlay shapes (crop pixels; stroke widths stay constant on screen):
  `drawLine(v.svg, pts, 'glow'|'fat'|'thin'|'navy'|'green'|'dash')` + `setDraw(el, p)` draws it on;
  `svgEl('polygon', {points: ptsStr(R2([x0,y0,x1,y1])), class: 'tint'}, v.svg)` + `setOp(el, p)` tints an
  area (`tint green` for trees); `svgEl('circle', {..., class:'ln green glow', pathLength:100})` for zones;
  `chevrons(v.svg, [[x, y0, y1], ...], n)` returns `(lt, opacity) => …` for flow arrows moving down;
  `svgEl('rect', {..., class:'veil'})` covers a band you then fade out (a section "built from the ground up").

## Patterns used so far

- **Zoom to what is being said**: fit → zoom to the feature on its word → back out for the next.
- **A path**: gutter outline lights → downspout pulses → pipe draws on → trench glows with ripples
  (`ellipse.rip`, radius and opacity from `(lt*0.7 + i/5) % 1`) → the detail slides in as a second,
  smaller viewer.
- **Moving building**: two images stacked in one viewer (draft and final, same framing), cross-fade the
  second's opacity, and interpolate a dashed ring from the old rectangle to the new.
- **Sections beside a plan**: small plan viewer with the cut lines drawn, two section viewers sliding in
  (`vshow(..., 120)`), then pulse setback ring → floor line → water path in the narration's order.
- **Rooms**: tint each room on its word, tag centered, fade older tints to 45 %.
- **Reveal from the ground up**: three `veil` bands over a wall section, lifted slab → wall → roof.
- **Sheet index**: index crop with a tint band over the group's rows; thumbnails (`thumbNN`) fly from the
  index row to a 3-column grid (`.th` divs, transform from row position to slot, staggered 0.07 s).
- **Explainer chat**: `bub('b', 'Engineer', text)` + `typeMsg(k.b, lt, start, 40)` (≤ 30 words on screen),
  `reply('r1', text, 'red', '!')` rows, `countTo(el, lt, start, dur, 204.7)` for results,
  an `.alt` bubble for a forwarded message.
- **Close**: `closeCard()` (logo, company, tagline, CTA, footer from the brand); keep the rendering note
  under any rendering.

## Controls and URL options

Play/pause (Space), restart (Home/R), previous/next scene (←/→; while paused they show the scene's built
end state), seek bar with scene ticks, sound (M), captions (C), full screen (F). `?t=12.5` opens paused
at a time, `?export=1` hides the sound pill (used by the MP4 export), `?reduced=1` forces reduced motion.
`window.__player` = `{seek, play, pause, total, scenes, audio()}`.
