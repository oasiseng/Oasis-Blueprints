/* Example scene file for sheet-video: four scenes on the anonymized site plan example (sheet C1.0).
   Copy this file per job. Each scene: name, html (static DOM), init (build viewers and overlays once),
   update(lt, k) (set everything from the scene-local time lt; no state between frames).
   Times come from the narration: T.c(k) = start of sentence k, T.w(k, 'phrase') = when the phrase is said.
   Coordinates are pixels in the crop image (find them with find_text.py, then subtract the crop's corner). */

const S = [];
const V = [60, 60, 1230, 840];          // main viewer box on the 1920x1080 stage

/* 1 · title card */
S.push({name: 'Intro', html: `
  <img class="logo" data-k="logo" style="position:absolute;left:120px;top:150px;height:96px;mix-blend-mode:multiply" alt="logo">
  <div class="big" data-k="t" style="left:120px;top:330px;width:1300px;font-size:100px">A site plan, in about a minute.</div>
  <div data-k="s1" style="position:absolute;left:120px;top:620px;font-size:46px;display:inline-block">One sheet.</div>
  <div data-k="s2" style="position:absolute;left:380px;top:620px;font-size:46px;display:inline-block">About a minute.</div>
  <div data-k="sm" style="position:absolute;left:120px;top:860px;font-size:24px;color:var(--ink2)">Anonymized example. Names and numbers are placeholders.</div>`,
 init(e, k) { this.T = TM(0); if (LOGO) k.logo.src = LOGO; else k.logo.style.display = 'none'; },
 update(lt, k) { const T = this.T;
  show(k.logo, lt, .1, .6, 0); show(k.t, lt, T.c(0) - .2, .7, 20); show(k.s1, lt, T.c(1), .4); show(k.s2, lt, T.c(2), .4); show(k.sm, lt, 1.2, .6, 0); }});

/* 2 · the site plan: tint the building and the driveway, then ring the building */
const SITE = {bldg: [1066, 1100, 1228, 1316], drive: [436, 1106, 1066, 1316]};
S.push({name: 'Site plan', html: side('02 · The site', [['Building in the corner ' + D('6 ft E') + ' ' + D('5 ft S')], ['Gravel driveway to Example Street ' + D('24 ft')]]),
 init(e, k) { sideInit(k); this.T = TM(1);
  const v = this.v = makeViewer(e, V, 'site', 'C1.0 · Site plan');
  this.b = svgEl('polygon', {points: ptsStr(R2(SITE.bldg)), class: 'tint'}, v.svg);
  this.d = svgEl('polygon', {points: ptsStr(R2(SITE.drive)), class: 'tint'}, v.svg);
  this.rb = v.ring('New building', {side: 'top', align: 'r'});
  this.td = v.ring('Gravel driveway', {cls: 'ghost', side: 'top'}); },
 update(lt, k) { const T = this.T, v = this.v;
  const corner = T.w(0, 'in the corner'), drive = T.w(1, 'gravel driveway');
  v.cam([{cam: {x: .5, y: .5, w: 0}}, {t: corner - .5, d: 2.2, cam: {x: .55, y: .72, w: .62}}], lt);
  setOp(this.b, prog(lt, corner, .6)); this.rb.set(SITE.bldg, prog(lt, corner + .3, .5));
  setOp(this.d, prog(lt, drive, .6)); this.td.set(SITE.drive, 0, prog(lt, drive + .3, .5));
  show(k.kick, lt, .2, .4, 0); show(k.i0, lt, corner); show(k.i1, lt, drive); show(k.logo, lt, 0, .01, 0); }});

/* 3 · drainage: draw the swale on the plan, then the stormwater check with a count-up */
S.push({name: 'Drainage', html: side('03 · Drainage', [['Swale along the east side, drains north'], ['Holds 1 in of rain over the roof']]) +
  `<div class="result" data-k="res" style="left:60px;top:800px;font-size:44px"><span data-k="n1">0.0</span> cu ft provided ≥ <span data-k="n2">0.0</span> required</div>`,
 init(e, k) { sideInit(k); this.T = TM(2);
  const v = this.v = makeViewer(e, V, 'site', 'C1.0 · Site plan');
  this.sw = drawLine(v.svg, [[1240, 1310], [1240, 350]], 'fat glow');
  this.flow = chevrons(v.svg, [[1240, 350, 1310]], 5);
  const s = this.s = makeViewer(e, [60, 60, 1230, 700], 'storm', '5 / C1.0 · Stormwater check');
  this.rs = s.ring('', {}); },
 update(lt, k) { const T = this.T, v = this.v, holds = T.c(1);
  v.cam([{cam: {x: .55, y: .72, w: .62}}, {t: 0, d: 1.6, cam: {x: .6, y: .5, w: .8}}], lt);
  vshow(v, lt, 0, .01, holds - .2);
  setDraw(this.sw, prog(lt, T.w(0, 'swale'), 1.2)); this.flow(lt, prog(lt, T.w(0, 'north'), .5));
  vshow(this.s, lt, holds - .2, .6); this.s.setCam({x: .5, y: .5, w: 0}); this.rs.set([210, 525, 1344, 630], prog(lt, holds + .5, .5));
  show(k.res, lt, holds + .3, .5); countTo(k.n1, lt, T.w(1, 'two hundred'), 1.4, 204.7); countTo(k.n2, lt, T.w(1, 'seventy'), 1.0, 77.3);
  show(k.kick, lt, .2, .4, 0); show(k.i0, lt, T.c(0)); show(k.i1, lt, holds); show(k.logo, lt, 0, .01, 0); }});

/* 4 · close: the brand card from brand.json */
S.push({name: 'Close', html: closeCard() + `<div class="big" data-k="q" style="left:120px;top:380px;width:1100px;font-size:72px">Every number here comes from <span style="color:var(--blue)">the sheet.</span></div>`,
 init(e, k) { this.T = TM(3); if (LOGO) k.logo.src = LOGO; else k.logo.style.display = 'none'; },
 update(lt, k) { const T = this.T;
  show(k.q, lt, T.c(0), .6); show(k.logo, lt, T.c(1), .6, 0); show(k.b1, lt, T.c(1) + .2, .6); show(k.b2, lt, T.c(1) + .5, .6); show(k.b3, lt, T.c(1) + .8, .6); show(k.ft, lt, T.c(1) + 1.2, .6, 0); }});
