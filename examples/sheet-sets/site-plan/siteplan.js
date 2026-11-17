// Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
// siteplan.js — job-local drawing code for this project (kept beside the project file, not in the installed skill).
// Job type "siteplan": a residential site plan drawn from a survey extract, with one new accessory building placed
// by setbacks, a gravel driveway and a side-yard swale. It is not based on a kit view: the kit ships none for site plans.
// Survey geometry is in decimal feet (P.geometry.survey, local origin at the SW lot corner, x east, y north); the kit's
// model unit is the inch, so everything goes through K = 12.
// What is particular to this job (see "Job-specific drawing code" in references/writing-views.md):
//   - the survey extract drawn as surveyed: pavement, fences, wires, poles, trees, spot elevations, found corners
//   - one building set square to the lot in the south-east corner by an east and a south setback, lean-to on the west
//   - a full-width gravel driveway west to the street with a cross slope, a swale between the east wall and the fence
//     running to the north line, a shed relocated by the owner, proposed grades
//   - six views: site plan, side-yard section, enlarged plan, typical swale section, stormwater check, footprint
//   - the picture is drawn from the south-west: the scene is entered turned half a turn (XM - x, YM - y)
//   - label and note positions are written for this lot: a different lot needs them moved
//   - the cover is an owner deliverable: three columns, no open-items column
'use strict';

const K = 12;
const ff = (v, approx) => (Math.round(v * 10) / 10).toFixed(1) + "'" + (approx ? ' ±' : '');
SCALE_LABEL[240] = '1" = 20\''; SCALE_LABEL[120] = '1" = 10\'';   // engineering scales for the plan views
const GREY = PAL.exist, INK = PAL.ink, BLUE = PAL.new, RED = PAL.eor;

// ---- geometry helpers (feet)
const lerpAt = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function clipSeg(a, b, c) { // Liang-Barsky; c = [x0, y0, x1, y1] or null
  if (!c) return [a, b];
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - c[0]], [dx, c[2] - a[0]], [-dy, a[1] - c[1]], [dy, c[3] - a[1]]]) {
    if (p === 0) { if (q < 0) return null; } else { const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } } }
  return [lerpAt(a, b, t0), lerpAt(a, b, t1)];
}
function clipPoly(pts, c) { // Sutherland-Hodgman against a rectangle
  if (!c) return pts;
  const edges = [[p => p[0] >= c[0], (a, b) => lerpAt(a, b, (c[0] - a[0]) / (b[0] - a[0]))], [p => p[0] <= c[2], (a, b) => lerpAt(a, b, (c[2] - a[0]) / (b[0] - a[0]))],
    [p => p[1] >= c[1], (a, b) => lerpAt(a, b, (c[1] - a[1]) / (b[1] - a[1]))], [p => p[1] <= c[3], (a, b) => lerpAt(a, b, (c[3] - a[1]) / (b[1] - a[1]))]];
  let out = pts;
  for (const [inside, cut] of edges) { const inp = out; out = []; for (let i = 0; i < inp.length; i++) { const a = inp[i], b = inp[(i + 1) % inp.length];
    if (inside(a)) { out.push(a); if (!inside(b)) out.push(cut(a, b)); } else if (inside(b)) out.push(cut(a, b)); } if (!out.length) break; }
  return out;
}
const inBox = (x, y, c) => !c || (x >= c[0] && x <= c[2] && y >= c[1] && y <= c[3]);

// ---- a View that takes feet. oy shifts the vertical origin (used for elevations in the section).
function FV(v, oy = 0) {
  const X = x => x * K, Y = y => (y - oy) * K, P2 = pts => pts.map(p => [X(p[0]), Y(p[1])]);
  return { v,
    line: (a, b, c, d, cls) => v.line(X(a), Y(b), X(c), Y(d), cls),
    poly: (pts, cls, close, o) => v.poly(P2(pts), cls, close, o),
    rect: (a, b, c, d, cls, o) => v.rect(X(a), Y(b), X(c), Y(d), cls, o),
    dot: (x, y, rpt, cls) => v.circle(X(x), Y(y), v.pt(rpt), cls),
    text: (s, x, y, o) => v.text(s, X(x), Y(y), o),
    arrow: (a, b, c, d, cls) => v.arrow(X(a), Y(b), X(c), Y(d), cls),
    dimH: (x1, x2, y, yo, o = {}) => v.dimH(X(x1), X(x2), Y(y), Y(yo), Object.assign({ text: ff(Math.abs(x2 - x1), o.approx) }, o)),
    dimV: (y1, y2, x, xo, o = {}) => v.dimV(Y(y1), Y(y2), X(x), X(xo), Object.assign({ text: ff(Math.abs(y2 - y1), o.approx) }, o)),
    note: (s, tx, ty, ex, ey, o) => v.note(s, X(tx), Y(ty), X(ex), Y(ey), o),
    datum: (s, x, y, toX) => v.datum(s, X(x), Y(y), X(toX)),
    bubble: (x, y, n, sh) => v.bubble(X(x), Y(y), n, sh),
    // a line with its own weight (points), colour and dash (points): property lines, fences, wires, swale
    raw(pts, st, close) { const q = P2(pts); for (const p of q) v.ext(p[0], p[1]);
      v.out.push(`<${close ? 'polygon' : 'polyline'} points="${q.map(p => r3(p[0]) + ',' + r3(-p[1])).join(' ')}" style="fill:${st.fill || 'none'};stroke:${st.color || INK};stroke-width:${r3(v.pt(st.w || 0.6))};${st.dash ? 'stroke-dasharray:' + st.dash.map(d => r3(v.pt(d))).join(' ') + ';' : ''}stroke-linejoin:round;stroke-linecap:butt"/>`); },
  };
}
const ST = {
  prop: { w: 1.7, color: INK, dash: [16, 3, 3, 3, 3, 3] }, row: { w: 0.6, color: PAL.muted, dash: [10, 3, 3, 3] }, ep: { w: 0.6, color: PAL.muted },
  fence: { w: 0.6, color: GREY, dash: [7, 2, 1, 2] }, wire: { w: 0.5, color: GREY, dash: [2, 2.5] }, deck: { w: 0.6, color: GREY }, canopy: { w: 0.5, color: GREY, dash: [4, 2] },
  swale: { w: 1.4, color: BLUE, dash: [9, 3, 2, 3] }, bank: { w: 0.5, color: BLUE, dash: [3, 2] }, drive: { w: 0.9, color: BLUE }, driveRW: { w: 0.7, color: BLUE, dash: [5, 3] }, pg: { w: 1.1, color: BLUE }, thin: { w: 0.45, color: PAL.muted },
};

// the calculation panel is text, not a scaled drawing: give it a plain scale label
{ const panel0 = panel; panel = function (num, title, den, svg, o = {}) { return panel0(num, title, den, svg, /^Stormwater/.test(title) ? Object.assign({}, o, { scale: 'Calculation · not to scale' }) : o); }; }

// ---- this job's cover: an owner deliverable. Three columns (no open-items column) and notes in two columns.
// The general notes band is the kit's own (project "generalNotes").
document.head.insertAdjacentHTML('beforeend', `<style>.cover .ctop{grid-template-columns:7.6in 8in 1fr} .cover .notes{columns:2;column-gap:.4in} .cover .notes li{break-inside:avoid} .cover .notes h4{break-after:avoid}</style>`);
{ const cover0 = sheetCover; sheetCover = function (P, G, sh, i, n, sheets) {
  return cover0(P, G, sh, i, n, sheets)
    .replace(/<div class="col">\s*<section class="panel grow"><div class="ph[^"]*">Open items for the engineer[\s\S]*?<\/section>\s*<\/div>/, '')
    .replace('<div class="ph">Design criteria</div>', '<div class="ph">Design criteria / project information</div>'); }; }
const streetN = P => String(P.geometry.streets.north).toUpperCase(), streetW = P => String(P.geometry.streets.west).toUpperCase();
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
function interp(tbl, y) { // tbl = [[y, el], ...] ascending in y; held flat beyond the ends
  if (y <= tbl[0][0]) return tbl[0][1]; for (let i = 1; i < tbl.length; i++) if (y <= tbl[i][0]) return tbl[i - 1][1] + (tbl[i][1] - tbl[i - 1][1]) * (y - tbl[i - 1][0]) / (tbl[i][0] - tbl[i - 1][0]); return tbl[tbl.length - 1][1];
}
function ptSeg(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))), q = [a[0] + dx * t, a[1] + dy * t]; return { q, d: Math.hypot(p[0] - q[0], p[1] - q[1]) }; }
function inPoly(x, y, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; }

function rectPoly(R, poly) { // closest pair between an axis rectangle [x0,y0,x1,y1] and a polygon
  const cs = [[R[0], R[1]], [R[2], R[1]], [R[2], R[3]], [R[0], R[3]]]; let best = { d: Infinity };
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length];
    for (const c of cs) { const r = ptSeg(c, a, b); if (r.d < best.d) best = { d: r.d, a: c, b: r.q }; }
    for (let k = 0; k < 4; k++) { const r = ptSeg(a, cs[k], cs[(k + 1) % 4]); if (r.d < best.d) best = { d: r.d, a: r.q, b: a }; } }
  return best;
}
function derive(P) {
  const g = P.geometry, s = g.survey, b = g.building, B = s.boundary, [NW, NE, SE, SW] = B;
  const northY = x => NW[1] + (NE[1] - NW[1]) * (x - NW[0]) / (NE[0] - NW[0]), southY = x => SW[1] + (SE[1] - SW[1]) * (x - SW[0]) / (SE[0] - SW[0]);
  const eastX = y => SE[0] + (NE[0] - SE[0]) * (y - SE[1]) / (NE[1] - SE[1]), westX = y => SW[0] + (NW[0] - SW[0]) * (y - SW[1]) / (NW[1] - SW[1]);
  // the building is set square to the survey grid in the south-east corner: east wall off the east line, south wall off the south line.
  // 29 ft runs north-south, 32 ft east-west: the lean-to is the west 12 ft, facing the west street
  const x1 = eastX(SE[1] + b.southSetback + b.ns / 2) - b.eastSetback, x0 = x1 - b.ew, xl = x0 + b.leanW, y0 = southY((x0 + x1) / 2) + b.southSetback, y1 = y0 + b.ns;
  const doors = b.doors.map(d => [y1 - d[1], y1 - d[0]]), frames = b.frameouts.map(d => [y1 - d[1], y1 - d[0]]), postsY = [...new Set([y0, ...frames.flat(), y1])];
  const manDoor = [x1 - b.manDoor[1], x1 - b.manDoor[0]], win = [x1 - b.window[1], x1 - b.window[0]];
  // separations to the existing buildings
  const R = [x0, y0, x1, y1]; let hs = { d: Infinity }; for (const poly of [s.house, ...s.porch]) { const r = rectPoly(R, poly); if (r.d < hs.d) hs = r; }
  const k = g.shed, shed = [x1 - k.size, y1 + k.clear, x1, y1 + k.clear + k.size], pole = s.poles.find(p => p[0] > 0 && p[0] < 110 && p[1] > 0 && p[1] < 137) || null;
  // swale: in the east side yard, from near the south-east corner to the north line. Storage = full triangular section × length
  const sw = g.swale, swX = eastX((y0 + y1) / 2) - sw.offLine, swA = y0, swB = northY(swX), swL = Math.round((swB - swA) * 10) / 10;
  const swD = sw.width / 2 / sw.sideSlope, swArea = sw.width * swD / 2, foot = b.ew * b.ns, vReq = foot * sw.rainfallIn / 12, vProv = swArea * swL;
  const egE = y => interp(sw.existing, y), fl = y => egE(y) - swD;
  // gravel driveway: full width from the lean-to west to the street, centred on the two openings
  const d = g.driveway, yc = y1 - (b.frameouts[0][0] + b.frameouts[1][1]) / 2, yS = yc - d.width / 2, yN = yc + d.width / 2, xW = westX(yc);
  const drive = [[westX(yS), yS], [x0, yS], [x0, yN], [westX(yN), yN]], dg = x => b.ffe + (d.gradeAtLine - b.ffe) * (x0 - x) / (x0 - xW);
  return { x0, x1, xl, y0, y1, northY, southY, eastX, westX, doors, frames, postsY, manDoor, win,
    toWest: x0 - westX((y0 + y1) / 2), toNorth: northY((x0 + x1) / 2) - y1, houseA: hs.a, houseB: hs.b, houseClear: hs.d, shed, pole,
    swX, swA, swB, swL, swD, swArea, foot, vReq, vProv, minL: vReq / swArea, egE, fl, pad: b.ffe - b.stepToGrade,
    drive, yc, yS, yN, xW, dg, driveLen: x0 - xW };
}

function northArrow(f, x, y, r = 5) {
  f.v.circle(x * K, y * K, r * K, 'o2'); f.poly([[x, y + r * 0.92], [x - r * 0.36, y - r * 0.6], [x, y - r * 0.25], [x + r * 0.36, y - r * 0.6]], 'dot');
  f.text('N', x, y + r + 0.012 * f.v.den, { cls: 'tb', anchor: 'middle', size: 12 });
}
function graphicScale(f, x, y, marks) { // marks in feet, e.g. [0, 10, 20, 40]
  const h = f.v.pt(4) / K;
  for (let i = 0; i < marks.length - 1; i++) f.rect(x + marks[i], y, x + marks[i + 1], y + h, 'o2', { fill: i % 2 ? '#fff' : INK });
  for (const m of marks) f.text(m + (m === marks[marks.length - 1] ? ' FT' : ''), x + m, y - f.v.pt(8.5) / K, { cls: 'tm', size: 7.5, anchor: 'middle' });
}
function arcPts(a) { const [cx, cy, r, a0, a1] = a, out = []; for (let d = a0; d <= a1 + 0.01; d += 3) out.push([cx + r * Math.cos(d * Math.PI / 180), cy + r * Math.sin(d * Math.PI / 180)]); return out; }

// ---- the survey, shared by the site plan and the enlarged plan. c = clip box in feet, or null.
function drawSurvey(f, P, G, c, o = {}) {
  const s = P.geometry.survey, v = f.v, segs = (list, st) => { for (const l of list || []) { const q = clipSeg([l[0], l[1]], [l[2], l[3]], c); if (q) f.raw(q, st); } };
  const path = (pts, st) => { for (let i = 0; i < pts.length - 1; i++) { const q = clipSeg(pts[i], pts[i + 1], c); if (q) f.raw(q, st); } };
  const area = (pts, cls, fill) => { const q = clipPoly(pts, c); if (q.length > 2) f.poly(q, cls, true, fill ? { fill } : undefined); };
  segs(s.lines['X-EP'], ST.ep); for (const a of s.arcs) path(arcPts(a), ST.ep);
  segs(s.lines.RW, ST.row); segs(s.lines['5S'], ST.row);
  path(s.canopy.map(p => [p[0], p[1]]), ST.canopy);
  for (const p of s.concrete) area(p, 'exw', PAL.slab);
  for (const p of s.porch) area(p, 'ex');
  area(s.house, 'ex', '#dfe3e9');
  segs(s.lines['X-DECK'], ST.deck);
  segs(s.lines['X-WBF'], ST.fence); segs(s.lines['X-CLF'], ST.fence); segs(s.lines['X-OHW'], ST.wire);
  for (const p of s.poles) if (inBox(p[0], p[1], c)) { f.dot(p[0], p[1], 3, 'bub'); f.dot(p[0], p[1], 1.1, 'dot'); }
  for (const p of s.trees) if (inBox(p[0], p[1], c)) { v.circle(p[0] * K, p[1] * K, 4 * K, 'o2'); f.dot(p[0], p[1], 1, 'dot'); }
  const B = s.boundary; for (let i = 0; i < 4; i++) { const q = clipSeg(B[i], B[(i + 1) % 4], c); if (q) f.raw(q, ST.prop); }
  if (!c) for (const m of s.monuments) { f.dot(m.x, m.y, 2.6, 'bub'); }
  // spot elevations (NAVD 88), as surveyed
  const skip = o.skipSpot || (() => false);
  for (const p of s.spots) if (p.el && inBox(p.x, p.y, c) && !skip(p)) { const t = v.pt(1.8) / K;
    f.raw([[p.x - t, p.y], [p.x + t, p.y]], ST.thin); f.raw([[p.x, p.y - t], [p.x, p.y + t]], ST.thin);
    f.text(p.el, p.x + v.pt(2.5) / K, p.y + v.pt(1.5) / K, { cls: 'tm', size: o.spotSize || 7 }); }
}

function drawBuilding(f, P, G, o = {}) {
  const { x0, x1, xl, y0, y1 } = G;
  f.rect(G.shed[0], G.shed[1], G.shed[2], G.shed[3], 'ex');                                                        // existing shed, relocated by the owner
  f.rect(xl, y0, x1, y1, 'new'); f.rect(x0, y0, xl, y1, 'newH');
  if (o.doors) { const dw = 0.45;
    for (const d of G.doors) f.rect(xl - dw, d[0], xl + dw, d[1], 'steelo');                                   // roll-up doors, in the wall under the lean-to
    f.rect(G.manDoor[0], y1 - dw, G.manDoor[1], y1 + dw, 'steelo'); f.rect(G.win[0], y1 - dw * 0.6, G.win[1], y1 + dw * 0.6, 'steelo');   // walk-in door and window, north end wall
    f.raw([[(xl + x1) / 2, y0], [(xl + x1) / 2, y1]], { w: 0.6, color: BLUE, dash: [10, 3, 2, 3] });           // ridge
    for (const y of G.postsY) f.rect(x0 - 0.18, y - 0.18, x0 + 0.18, y + 0.18, 'newS');                        // lean-to posts at the frame-outs, schematic
  }
}
function drawSwale(f, P, G, o = {}) { // centreline with flow arrows draining north, and the two top-of-bank lines
  const x = G.swX, w = P.geometry.swale.width / 2, ya = Math.max(G.swA, o.from != null ? o.from : -1e9), yb = Math.min(G.swB, o.to != null ? o.to : 1e9);
  f.raw([[x - w, ya], [x - w, yb]], ST.bank); f.raw([[x + w, ya], [x + w, yb]], ST.bank); if (ya === G.swA) f.raw([[x - w, ya], [x + w, ya]], ST.bank);
  f.raw([[x, ya], [x, yb]], ST.swale);
  for (let y = ya + (o.first || 10); y < yb - 3; y += (o.step || 22)) f.poly([[x, y + 2.2], [x - 0.9, y - 0.6], [x + 0.9, y - 0.6]], 'newS');
}
function drawDrive(f, P, G, o = {}) { // gravel driveway on the lot, and its connection across the right-of-way (dashed)
  const ep = P.geometry.driveway.epX, sp = o.sp || 2, v = f.v, xa = o.from != null ? o.from : -1e9;
  const poly = G.drive.map(p => [Math.max(p[0], xa), p[1]]);
  f.raw(poly, { fill: '#f2f6fd', w: 0, color: 'none' }, true); f.raw([poly[0], poly[1]], ST.drive); f.raw([poly[2], poly[3]], ST.drive); if (xa < G.xW) f.raw([poly[3], poly[0]], ST.driveRW);
  if (xa < ep) { f.raw([[G.westX(G.yS), G.yS], [ep, G.yS]], ST.driveRW); f.raw([[G.westX(G.yN), G.yN], [ep, G.yN]], ST.driveRW); }
  let k = 0; for (let y = G.yS + sp / 2; y < G.yN; y += sp) for (let x = Math.max(G.xW, xa) + sp / 2; x < G.x0; x += sp) { k++; const jx = ((k * 37) % 11 - 5) / 11 * sp * 0.7, jy = ((k * 53) % 13 - 6) / 13 * sp * 0.7;
    if (inPoly(x + jx, y + jy, poly)) v.circle((x + jx) * K, (y + jy) * K, v.pt(0.42), 'dot'); }
}
function pgrade(f, x, y, s, o = {}) { // a proposed grade: blue ×, blue text
  const t = f.v.pt(2.1) / K, a = o.anchor || 'start', dx = (a === 'end' ? -1 : a === 'middle' ? 0 : 1) * f.v.pt(3.2) / K;
  f.raw([[x - t, y - t], [x + t, y + t]], ST.pg); f.raw([[x - t, y + t], [x + t, y - t]], ST.pg);
  f.text(s, x + dx, y + (o.dy != null ? o.dy : f.v.pt(a === 'middle' ? 4 : -2.4) / K), { cls: 'tN', size: o.size || 7.5, anchor: a });
}
function slopeArrow(f, x, ya, yb, s, o = {}) { // thin blue arrow in the direction of fall, with a label beside it
  f.raw([[x, ya], [x, yb]], { w: 0.7, color: BLUE }); const d = yb > ya ? 1 : -1, h = f.v.pt(5) / K, w = f.v.pt(2) / K;
  f.raw([[x, yb], [x - w, yb - d * h], [x + w, yb - d * h]], { w: 0.7, color: BLUE, fill: BLUE }, true);
  if (s) f.text(s, x + f.v.pt(o.side === 'l' ? -4 : 9) / K, (ya + yb) / 2, { cls: 'tN', size: o.size || 7, anchor: 'middle', rot: 90 });
}

function slopeArrowH(f, xa, xb, y, s) { // thin blue arrow in the direction of fall (east-west), label above
  f.raw([[xa, y], [xb, y]], { w: 0.7, color: BLUE }); const d = xb > xa ? 1 : -1, h = f.v.pt(5) / K, w = f.v.pt(2) / K;
  f.raw([[xb, y], [xb - d * h, y - w], [xb - d * h, y + w]], { w: 0.7, color: BLUE, fill: BLUE }, true);
  if (s) f.text(s, (xa + xb) / 2, y + f.v.pt(3.5) / K, { cls: 'tN', size: 7, anchor: 'middle' });
}

// ------------------------------------------------------------------ 1  SITE PLAN
function viewSite(P, G, den) {
  const g = P.geometry, s = g.survey, b = g.building, d = g.driveway, v = new View(den, 'site'), f = FV(v), c = [-44, -9, 136, 176], { x0, x1, xl, y0, y1 } = G;
  drawSurvey(f, P, G, c, { skipSpot: p => (p.x > G.xW - 14 && p.x < x1 + 1 && p.y > G.yS - 1.5 && p.y < G.yN + 1.5) || (p.x > x0 - 1 && p.x < x1 + 4 && p.y > y0 - 6 && p.y < y1 + 2) || (p.x > G.swX - 4.5 && p.x < G.swX + 4 && p.y > G.swA - 2) });
  drawDrive(f, P, G, { sp: 3 });
  drawSwale(f, P, G, { first: 14 });
  drawBuilding(f, P, G);
  // streets and lot lines
  f.text(streetN(P), 30, 164.6, { cls: 'th', anchor: 'middle' }); f.text("50' RIGHT OF WAY · ASPHALT PAVEMENT", 30, 159.6, { cls: 'tm', anchor: 'middle', size: 7.5 });
  f.text(streetW(P), -31.6, 118, { cls: 'th', anchor: 'middle', rot: 90 }); f.text("50' RIGHT OF WAY · ASPHALT PAVEMENT", -26.4, 118, { cls: 'tm', anchor: 'middle', rot: 90, size: 7.5 });
  for (const l of s.lotLines) f.text(l.text, l.x, l.y, { cls: 'ts', anchor: 'middle', rot: l.rot || 0, size: 8.5 });
  for (const m of s.monuments) if (m.label) f.text(m.label, m.x + m.dx, m.y + m.dy, { cls: 'tm', size: 7, anchor: m.dx < 0 ? 'end' : 'start' });
  // existing
  f.text('(E) 1-STORY RESIDENCE', 44.6, 87.6, { cls: 'ts', anchor: 'middle', rot: 55.1, size: 8 }); f.text('FLOOR ELEV ' + s.houseFloor, 48.6, 84.9, { cls: 'tm', anchor: 'middle', rot: 55.1, size: 7 });
  for (const t of s.ties) if (t.text !== "58.0'") { f.raw([[t.x1, t.y1], [t.x2, t.y2]], ST.thin); f.text(t.text, t.tx, t.ty, { cls: 'tm', size: 7, anchor: 'middle', rot: t.rot || 0 }); }
  f.text('FLOOD ZONE X', 24, 122, { cls: 'ts', size: 8.5, anchor: 'middle' }); f.text('(ENTIRE LOT, PER SURVEY)', 24, 117.6, { cls: 'tm', size: 7, anchor: 'middle' });
  // new building
  const mx = (xl + x1) / 2, my = (y0 + y1) / 2;
  f.text(`(N) METAL\nBUILDING\n${b.ns}' × ${b.ew}'`, mx, my + 6.5, { cls: 'tN', anchor: 'middle', size: 8.5 }); f.text('FFE ' + b.ffe.toFixed(1), mx, y0 + 3, { cls: 'tN', anchor: 'middle', size: 8.5 });
  f.text('LEAN-TO', (x0 + xl) / 2 + 1, my, { cls: 'tN', anchor: 'middle', size: 7.5, rot: 90 });
  f.text(`(N) GRAVEL DRIVEWAY, ${f1(d.width)}' WIDE`, (G.xW + x0) / 2 + 2, G.yc + 7.6, { cls: 'tN', anchor: 'middle', size: 8.5 });
  for (const x of [G.xW + 22, G.xW + 40, x0 - 8]) slopeArrow(f, x, G.yc - 1.5, G.yc + 4.5, x === G.xW + 40 ? `${d.crossPct}% ±` : '');
  slopeArrowH(f, x0 - 14, x0 - 26, G.yc - 5, 'SLOPE'); 
  pgrade(f, x0 - 1.2, G.yc - 9, f1(b.ffe), { anchor: 'end', dy: -0.9 }); pgrade(f, (G.xW + x0) / 2, G.yc - 9, f1(G.dg((G.xW + x0) / 2)) + ' ±', { dy: -0.9 }); pgrade(f, G.xW + 1.5, G.yc - 9, f1(d.gradeAtLine) + ' ± MATCH (E)', { dy: -0.9 });
  for (const y of [G.swA + 1, y1 + 30, y1 + 60, y1 + 88]) pgrade(f, G.swX, y, 'FL ' + f1(G.fl(y)), { anchor: 'end', dy: -0.9, size: 7 });
  f.dimV(y1, G.northY(x0 + 17), x0 + 17, x0 + 17, { text: ff(G.toNorth, true) });
  f.dimH(x1, G.eastX(y1 + 2.5), y1 + 2.5, y1, { text: ff(b.eastSetback) });
  f.dimH(G.westX(G.yN + 3), x0, G.yN + 3, G.yN + 3, { text: ff(G.toWest, true) });
  f.dimV(G.southY(x0 - 5), y0, x0 - 5, x0, { text: ff(b.southSetback) });
  f.dimV(G.yS, G.yN, 14, 14, { text: ff(d.width) });
  // separation to the residence
  f.raw([G.houseA, G.houseB], ST.thin); f.dot(G.houseA[0], G.houseA[1], 1, 'dot'); f.dot(G.houseB[0], G.houseB[1], 1, 'dot');
  f.text(ff(G.houseClear, true), G.houseB[0] + (G.houseA[0] - G.houseB[0]) * 0.22 + 1.2, G.houseB[1] + (G.houseA[1] - G.houseB[1]) * 0.22 + 1.6, { cls: 'td', anchor: 'middle', rot: Math.atan2(G.houseB[1] - G.houseA[1], G.houseB[0] - G.houseA[0]) * 180 / Math.PI + 180, size: 8 });
  // notes, in the neighbour's side yard east of the lot
  const nx = 143;
  f.note("(E) 4' HOG WIRE FENCE AND GATE\nIN THE RIGHT-OF-WAY", 100, 145.3, nx, 166, { side: 'r' });
  if (G.pole) f.note('(E) UTILITY POLE AND OVERHEAD WIRE.\nCONTRACTOR IS TO CONFIRM ACCESS AND\nPROTECT EXISTING UTILITIES', G.pole[0], G.pole[1], nx, 150, { side: 'r' });
  f.note(`(N) SWALE, ${f1(g.swale.width)}' WIDE × ${f1(G.swL)}' LONG,\nDRAINS NORTH TO ${streetN(P)}.\nSEE ${REF.section} AND ${REF.d1}/${REF.sheet}`, G.swX, 112, nx, 128, { side: 'r', kind: 'N' });
  f.note("(E) 4' HOG WIRE FENCE", 109.5, 84, nx, 108, { side: 'r' });
  f.note(`(E) 7' × 7' SHED, RELOCATED BY THE OWNER.\nKEEP ${f1(g.shed.clear)}' MIN. CLEAR OF THE NEW BUILDING\nAND ${f1(b.eastSetback)}' OFF THE EAST LINE`, G.shed[2] - 1.5, (G.shed[1] + G.shed[3]) / 2, nx, 93, { side: 'r' });
  f.note(`(N) ${b.ns}' × ${b.ew}' METAL BUILDING\nFFE ${b.ffe.toFixed(1)} (NAVD 88)\nSEE ${REF.side}/${REF.sheet}`, x1, y0 + 22, nx, 72, { side: 'r', kind: 'N' });
  f.note('(E) CANOPY LINE, PER SURVEY. THE TREES\nLOCATED BY THE SURVEY STAND\nOUTSIDE THE LOT', 106.5, 17, nx, 51, { side: 'r' });
  f.note("(E) 4' CHAINLINK FENCE", 102, -1.2, nx, 34, { side: 'r' });
  f.note(`(N) DRIVEWAY CONNECTION TO ${streetW(P)}, IN THE RIGHT-OF-WAY.\nOPENING IN THE (E) FENCE BY THE CONTRACTOR. COORDINATE WITH THE COUNTY.\n(E) OVERHEAD WIRE ALONG ${streetW(P)}: VERIFY CLEARANCE`, -12, G.yS, -8, -10.5, { side: 'r', kind: 'N' });
  northArrow(f, 152, 8, 5.5); graphicScale(f, 166, 3.5, [0, 10, 20, 40]);
  return v.svg();
}

// ------------------------------------------------------------------ 2  SECTION through the east side yard at the building, looking north
function viewSection(P, G, den) {
  const g = P.geometry, b = g.building, v = new View(den, 'sect'), f = FV(v, Math.floor(b.ffe) - 5), { x1 } = G, ym = (G.y0 + G.y1) / 2, pl = G.eastX(ym), fx = g.section.fenceX, eg = g.section.existGrade, egL = g.section.existGradeAtLine;
  const xa = x1 - 7.6, xb = pl + 3, F = b.ffe, pad = G.pad, t = 0.333, fb = pad - 1.0, toe = fx - g.section.toeInside, egT = eg + (egL - eg) * (toe - x1) / (pl - x1);
  // slab with a thickened perimeter footing, schematic (by others)
  f.poly([[xa, F], [x1, F], [x1, fb], [x1 - 1, fb], [x1 - 1, F - t - 0.55], [x1 - 1.55, F - t], [xa, F - t]], 'new', true, { fill: v.pat('conc') });
  f.poly([[xa, F - t - 0.35], [xa - 0.12, F - 0.22], [xa + 0.12, F - 0.1], [xa, F + 0.25]], 'o2', false);
  f.dot(x1 - 0.72, fb + 0.28, 2.2, 'dot'); f.dot(x1 - 0.28, fb + 0.28, 2.2, 'dot');
  // base rail and wall
  f.rect(x1 - 0.5, F, x1 - 0.29, F + 0.21, 'steelo');
  f.rect(x1 - 0.5, F + 0.21, x1 - 0.29, F + 3.0, 'newF'); f.poly([[x1 - 0.5, F + 3.0], [x1 - 0.5, F + 0.21]], 'new', false); f.poly([[x1 - 0.29, F + 0.21], [x1 - 0.29, F + 3.0]], 'new', false);
  f.poly([[x1 - 0.8, F + 3.0], [x1 - 0.48, F + 3.0], [x1 - 0.43, F + 3.2], [x1 - 0.36, F + 2.8], [x1 - 0.3, F + 3.0], [x1 + 0.05, F + 3.0]], 'o2', false);
  // grades: existing dashed grey, proposed blue. The swale fills the side yard: east edge at existing grade, west bank up to the grade at the wall
  const sw = g.swale, wr = G.swX + sw.width / 2, egR = eg + (egL - eg) * (wr - x1) / (pl - x1), inv = egR - G.swD;
  f.raw([[xa, eg], [x1, eg], [pl, egL], [xb, egL]], { w: 0.9, color: GREY, dash: [6, 3] });
  f.raw([[x1, pad], [G.swX, inv], [wr, egR]], { w: 1.5, color: BLUE });
  f.raw([[pl, inv - 1.6], [pl, F + 3.2]], ST.prop); f.line(fx, egL, fx, egL + 4, 'exw');
  // dimensions
  f.dimH(x1, pl, F + 2.45, F + 0.5, { text: ff(b.eastSetback) + ' SIDE YARD' });
  f.dimH(x1, wr, F + 1.25, pad + 0.1, { text: ff(wr - x1) + ' SWALE' }); f.dimH(wr, pl, F + 1.25, egR + 0.1, { text: ff(pl - wr, true) });
  f.text(`${f1((G.swX - x1) / (pad - inv))}:1 ±`, (x1 + G.swX) / 2 + 0.75, (pad + inv) / 2 + 0.3, { cls: 'tN', size: 8, anchor: 'middle' });
  f.text(`${sw.sideSlope}:1`, (wr + G.swX) / 2 + 0.25, (egR + inv) / 2 - 0.45, { cls: 'tN', size: 8, anchor: 'middle' });
  // notes
  f.datum('FINISHED FLOOR\nEL. ' + F.toFixed(1), xa - 2.4, F, xa - 0.3);
  f.note('(N) METAL BUILDING WALL\nON BASE RAIL', x1 - 0.5, F + 2.3, x1 - 1.7, F + 2.75, { side: 'l', kind: 'N' });
  f.note('(N) SLAB AND FOUNDATION\nBY OTHERS. SHOWN SCHEMATIC', xa + 1.6, F - 0.17, xa + 0.9, F + 1.45, { side: 'r', kind: 'N' });
  f.note(`(N) REGRADING OR FILL UNDER THE SLAB,\nABOUT ${Math.round((F - t - g.section.existHigh) * 12)}" TO ${Math.round((F - t - eg) * 12)}" ±. PERIMETER FOOTING, REINFORCING\nAND ANCHORS PER THE BUILDING PLANS`, x1 - 3.2, (F - t + eg) / 2, x1 - 4.0, eg - 1.5, { side: 'l', kind: 'N' });
  f.note('(E) GRADE ' + eg.toFixed(1) + ' ±\nAT THE BUILDING', xa + 0.4, eg, xa - 0.9, eg - 0.05, { side: 'l' });
  f.note(`(N) FINISHED GRADE AT THE WALL ${pad.toFixed(1)} ±,\nABOUT ${Math.round(b.stepToGrade * 12)}" BELOW THE FLOOR.\nSLOPE DOWN TO THE SWALE`, x1 + 0.7, pad - (pad - inv) * 0.7 / (G.swX - x1), x1 - 1.4, inv - 0.9, { side: 'r', kind: 'N' });
  f.note(`(N) SWALE FLOW LINE ${inv.toFixed(1)} ±, DRAINS NORTH.\nEAST EDGE MATCHES (E) GRADE AT THE FENCE.\nSEE ${REF.d1}/${REF.sheet}`, G.swX, inv, pl + 2.1, inv - 0.2, { side: 'r', kind: 'N' });
  f.note('EAST PROPERTY LINE', pl, F + 3.0, pl + 2.1, F + 3.05, { side: 'r' });
  f.note("(E) 4' HOG WIRE FENCE", fx, egL + 3.3, pl + 2.1, F + 1.9, { side: 'r' });
  f.note('(E) GRADE ' + egL.toFixed(1) + ' ±\nAT THE LINE', pl + 0.8, egL, pl + 2.1, F + 0.55, { side: 'r' });
  return v.svg();
}

// ------------------------------------------------------------------ 3  ENLARGED PLAN at the new building
function viewEnlarged(P, G, den) {
  const g = P.geometry, s = g.survey, b = g.building, d = g.driveway, v = new View(den, 'enl'), f = FV(v), { x0, x1, xl, y0, y1 } = G, c = [50, G.southY(x0) - 3.4, G.eastX(y0) + 2.5, G.shed[3] + 9];
  drawSurvey(f, P, G, c, { spotSize: 7.5, skipSpot: p => (p.x > x0 - 12 && p.x < x1 + 9 && p.y > y0 - 9 && p.y < G.shed[3] + 3) || (p.x < x0 && p.y > G.yS - 1 && p.y < G.yN + 1) });
  drawDrive(f, P, G, { sp: 1.7, from: c[0] });
  drawSwale(f, P, G, { first: 6, step: 14, to: c[3] });
  drawBuilding(f, P, G, { doors: true });
  const mx = (xl + x1) / 2, my = (y0 + y1) / 2;
  f.text("(N) METAL BUILDING", mx + 1.5, my + 7, { cls: 'tN', anchor: 'middle', size: 10.5 }); f.text(`FFE ${b.ffe.toFixed(1)} (NAVD 88)`, mx + 1.5, my + 4.4, { cls: 'tN', anchor: 'middle', size: 9.5 });
  f.text(`${b.ew - b.leanW}' ENCLOSED`, mx + 1.5, my - 3, { cls: 'ts', anchor: 'middle', size: 8 }); f.text('RIDGE NORTH-SOUTH', mx + 1.5, my - 5.2, { cls: 'ts', anchor: 'middle', size: 8 });
  f.text(`${b.leanW}' LEAN-TO, OPEN`, (x0 + xl) / 2 - 1.2, my, { cls: 'tN', anchor: 'middle', size: 9.5, rot: 90 }); f.text("(2) 10' × 10' ROLL-UP DOORS", xl - 2.2, my, { cls: 'ts', anchor: 'middle', size: 8, rot: 90 });
  f.text('(N) GRAVEL DRIVEWAY', (c[0] + x0) / 2 + 1, G.yc + 5, { cls: 'tN', anchor: 'middle', size: 9 }); f.text('TO ' + streetW(P) + '. SEE ' + REF.plan + '/' + REF.sheet, (c[0] + x0) / 2 + 1, G.yc + 2.6, { cls: 'ts', anchor: 'middle', size: 7.5 });
  f.text('(E) CONC.', 57.6, 46.6, { cls: 'tm', anchor: 'middle', size: 7.5 });
  f.text('EAST PROPERTY LINE', G.eastX(22) + 1.3, 22, { cls: 'ts', anchor: 'middle', rot: 90, size: 8 });
  f.text('SOUTH PROPERTY LINE', 60, G.southY(60) - 2.6, { cls: 'ts', anchor: 'middle', size: 8 });
  // building, setback and shed dimensions
  f.dimH(x0, xl, y1 + 2.6, y1, { text: ff(b.leanW) }); f.dimH(xl, x1, y1 + 2.6, y1, { text: ff(b.ew - b.leanW) });
  f.dimH(x1, G.eastX(y0 - 2.4), y0 - 2.4, y0, { text: ff(b.eastSetback) });
  f.dimV(G.southY(x0 - 4), y0, x0 - 4, x0, { text: ff(b.southSetback) });
  f.dimV(y0, y1, x0 - 8.5, x0, { text: ff(b.ns) }); f.dimV(G.yS, G.yN, x0 - 4, x0 - 4, { text: ff(d.width) });
  f.dimV(y1, G.shed[1], G.shed[0] + 2, G.shed[0] + 2, { text: ff(g.shed.clear) + ' MIN.' });
  f.text('(E) SHED', (G.shed[0] + G.shed[2]) / 2, (G.shed[1] + G.shed[3]) / 2 + 0.6, { cls: 'ts', anchor: 'middle', size: 7 }); f.text('RELOCATED', (G.shed[0] + G.shed[2]) / 2, (G.shed[1] + G.shed[3]) / 2 - 1.2, { cls: 'ts', anchor: 'middle', size: 6.5 });
  // proposed grades (blue ×): pad at the walls, swale flow line, driveway
  const pd = G.pad.toFixed(1);
  pgrade(f, x0, y0, pd, { anchor: 'end', dy: -1.9 }); pgrade(f, x1, y0, pd, { anchor: 'end', dy: 0.6 }); pgrade(f, x0, y1, pd, { anchor: 'end', dy: 0.6 }); pgrade(f, x1, y1, pd, { anchor: 'end', dy: 0.6 });
  for (const y of [G.swA + 0.6, y1, G.shed[3] + 3]) pgrade(f, G.swX, y, 'FL ' + f1(G.fl(y)), { dy: -0.4, size: 7 });
  pgrade(f, x0 - 1.2, G.yc - 7, f1(b.ffe) + ' AT SLAB', { anchor: 'end', dy: -0.4 }); slopeArrowH(f, x0 - 2.5, x0 - 10, G.yc - 3.5, 'SLOPE'); slopeArrow(f, 54.5, G.yc + 6.5, G.yc + 11, `${d.crossPct}% ±`);
  // section cut
  const ca = x1 - 5, cb = c[2] + 1.2, ym = my - 4;
  f.line(ca, ym, cb, ym, 'cutl'); f.line(ca, ym, ca, ym + 2.2, 'cutl2'); f.line(cb, ym, cb, ym + 2.2, 'cutl2'); f.arrow(cb, ym + 3.6, cb, ym); f.bubble(cb + 3.2, ym + 0.6, String(REF.section), REF.sheet);
  // notes
  const nx = c[2] + 2.2;
  f.note(`(N) SWALE\n${f1(g.swale.width)}' × ${f1(G.swL)}'\nFLOWS NORTH.\nSEE ${REF.section}\nAND ${REF.d1}/${REF.sheet}`, G.swX, c[3] - 3, nx, c[3] - 1, { side: 'r', kind: 'N' });
  f.note(`(E) SHED, BY\nTHE OWNER.\n${f1(g.shed.clear)}' MIN. FROM\nTHE BUILDING`, G.shed[2], (G.shed[1] + G.shed[3]) / 2, nx, G.shed[1] + 0.5, { side: 'r' });
  f.note("SWALE STARTS\nAT THE SOUTH\nWALL LINE", G.swX, G.swA, nx, y0 - 6.5, { side: 'r', kind: 'N' });
  f.note("(N) GRADE\n×  BLUE.\n(E) GRADE\n+  GREY", G.swX, my + 9, nx, my + 9.5, { side: 'r', kind: 'N' });
  f.note("(E) 4' HOG\nWIRE FENCE", 109.4, y0 + 2.5, nx, y0 + 1, { side: 'r' });
  f.note('36" × 80" DOOR AND\n24" × 36" WINDOW ±', (G.manDoor[0] + G.manDoor[1]) / 2, y1 + 0.45, x1 - 19, y1 + 9, { side: 'l', kind: 'N' });
  northArrow(f, 55, y1 + 22, 2.8); graphicScale(f, 62, y1 + 20.5, [0, 5, 10]);
  return v.svg();
}

// ------------------------------------------------------------------ 4  TYPICAL SWALE SECTION (from the engineer's swale detail)
function detailSwale(P, G, den) {
  const sw = P.geometry.swale, v = new View(den, 'swale'), f = FV(v), w = sw.width / 2, d = G.swD, a = 2.6, L = -w - a, R = w + a, top = 1.9;
  f.raw([[L - 0.5, 0.12], [L, 0.1], [-w, 0], [0, -d], [w, 0], [R + 0.5, 0]], { w: 1.5, color: BLUE });
  f.line(L, 0.1, L, top + 0.5, 'o2'); f.line(R, 0, R, top + 0.5, 'o2');
  f.dimH(L, -w, top, 0.15, { text: 'VARIES' }); f.dimH(-w, w, top, 0.1, { text: ff(sw.width) }); f.dimH(w, R, top, 0.1, { text: 'VARIES' });
  f.text('BUILDING', L - 0.15, top + 0.05, { cls: 'ts', size: 8, anchor: 'end' }); f.text('PROPERTY\nLINE', R + 0.15, top + 0.25, { cls: 'ts', size: 8, anchor: 'start' });
  f.line(0, -d, w + 1.1, -d, 'dm'); f.dimV(-d, 0, w + 0.9, w, { text: `${Math.round(d * 24) / 2}"` });
  // slope triangles, 1 vertical on 4 horizontal
  const tri = (x, sgn) => { const y = -d - 0.5, h = 0.2, r = h * sw.sideSlope; f.raw([[x, y + h], [x, y], [x + sgn * r, y]], { w: 0.6, color: INK });
    f.text(String(sw.sideSlope), x + sgn * r / 2, y - 0.32, { cls: 'ts', size: 8, anchor: 'middle' }); f.text('1', x - sgn * 0.16, y + 0.03, { cls: 'ts', size: 8, anchor: 'middle' }); };
  tri(-w + 0.25, 1); tri(w - 0.25, -1);
  f.note('MATCH EXISTING GRADE\nAT BOTH EDGES', -w, 0, -w - 1.2, -1.55, { side: 'l', kind: 'N' });
  f.dot(w, 0, 1.2, 'dot'); f.dot(-w, 0, 1.2, 'dot');
  f.note(`FLOW LINE. DRAINS NORTH\nTO ${streetN(P)}`, 0, -d, w + 1.0, -1.55, { side: 'r', kind: 'N' });
  return v.svg();
}

// ------------------------------------------------------------------ 5  STORMWATER CHECK (text; drawn in sheet inches at 1:1)
function detailStorm(P, G, den) {
  const g = P.geometry, b = g.building, sw = g.swale, v = new View(den, 'storm'), n0 = x => x.toFixed(0), n1 = x => x.toFixed(1), n2 = x => x.toFixed(2);
  const X = [0, 3.05, 7.55], lh = 0.33, ok = G.vProv >= G.vReq;
  const rows = [
    ['NEW BUILDING FOOTPRINT (ROOFED AREA)', `${n1(b.ew)}' × ${n1(b.ns)}'`, `${n0(G.foot)} SQ FT`],
    ['RAINFALL TO HOLD', '', `${n1(sw.rainfallIn)} IN`],
    ['VOLUME REQUIRED', `${n0(G.foot)} SQ FT × ${n1(sw.rainfallIn)} IN ÷ 12`, `${n1(G.vReq)} CU FT`, 1],
    ['SWALE TOP WIDTH AND SIDE SLOPES', `SEE ${REF.d1}/${REF.sheet}`, `${n1(sw.width)}' · ${sw.sideSlope}:1`],
    ['SWALE DEPTH', `(${n1(sw.width)}' ÷ 2) ÷ ${sw.sideSlope}`, `${G.swD.toFixed(3)}' (${Math.round(G.swD * 24) / 2}")`],
    ['SECTION AREA = VOLUME PER FOOT', `½ × ${n1(sw.width)}' × ${G.swD.toFixed(3)}'`, `${n2(G.swArea)} CU FT / FT`],
    ['SWALE LENGTH, MEASURED ON THE PLAN', `SEE ${REF.side}/${REF.sheet}`, `${n1(G.swL)}'`],
    ['VOLUME PROVIDED', `${n2(G.swArea)} CU FT / FT × ${n1(G.swL)}'`, `${n1(G.vProv)} CU FT`, 1],
  ];
  let y = 0;
  v.text('ITEM', X[0], y, { cls: 'tm', size: 7.5 }); v.text('WORKING', X[1], y, { cls: 'tm', size: 7.5 }); v.text('RESULT', X[2], y, { cls: 'tm', size: 7.5, anchor: 'end' });
  v.line(X[0], y - 0.09, X[2], y - 0.09, 'o2'); y -= 0.36;
  for (const r of rows) { v.text(r[0], X[0], y, { cls: r[3] ? 'tb' : 'ts', size: 9.5 }); v.text(r[1], X[1], y, { cls: 'ts', size: 9.5 }); v.text(r[2], X[2], y, { cls: r[3] ? 'tb' : 'ts', size: 9.5, anchor: 'end' });
    v.line(X[0], y - 0.11, X[2], y - 0.11, 'dm'); y -= lh; }
  y -= 0.12;
  v.rect(X[0], y - 0.5, X[2], y + 0.2, ok ? 'new' : 'o');
  v.text(ok ? `${n1(G.vProv)} CU FT PROVIDED  ≥  ${n1(G.vReq)} CU FT REQUIRED.  OK` : `${n1(G.vProv)} CU FT PROVIDED  <  ${n1(G.vReq)} CU FT REQUIRED.  EXTEND THE SWALE`, (X[0] + X[2]) / 2, y - 0.04, { cls: ok ? 'tN' : 'tR', size: 12, anchor: 'middle' });
  v.text(ok ? `MINIMUM SWALE LENGTH ${n1(G.minL)}'. SWALE BEHIND THE BUILDING IS NOT NEEDED.` : `MINIMUM SWALE LENGTH ${n1(G.minL)}'.`, (X[0] + X[2]) / 2, y - 0.3, { cls: 'ts', size: 8.5, anchor: 'middle' });
  y -= 0.78;
  v.text("BASIS, AS DIRECTED BY THE ENGINEER: 1 IN OF RAIN OVER THE NEW BUILDING FOOTPRINT, HELD IN THE FULL\nTRIANGULAR SWALE SECTION OVER ITS WHOLE LENGTH. THE GRAVEL DRIVEWAY IS NOT COUNTED.", X[0], y, { cls: 'tm', size: 7.5 });
  return v.svg();
}

// ------------------------------------------------------------------ 6  BUILDING FOOTPRINT (from the owner's building sketch), north up
function detailFootprint(P, G, den) {
  const b = P.geometry.building, v = new View(den, 'foot'), f = FV(v), W = b.ew, D = b.ns, xl = b.leanW, dw = 0.4;
  const yy = r => [D - r[1], D - r[0]], md = [W - b.manDoor[1], W - b.manDoor[0]], wn = [W - b.window[1], W - b.window[0]], fr = b.frameouts.map(yy), dr = b.doors.map(yy);
  f.rect(xl, 0, W, D, 'new'); f.rect(0, 0, xl, D, 'newH');
  f.raw([[(xl + W) / 2, 0], [(xl + W) / 2, D]], { w: 0.6, color: BLUE, dash: [10, 3, 2, 3] });
  for (const d of dr) f.rect(xl - dw, d[0], xl + dw, d[1], 'steelo');
  f.rect(md[0], D - dw, md[1], D + dw, 'steelo'); f.rect(wn[0], D - dw * 0.6, wn[1], D + dw * 0.6, 'steelo');
  for (const y of new Set([0, ...fr.flat(), D])) f.rect(-0.25, y - 0.25, 0.25, y + 0.25, 'newS');
  f.text('ENCLOSED\nGARAGE', (xl + W) / 2 + 4.5, D / 2 + 1.5, { cls: 'tN', anchor: 'middle' }); f.text('RIDGE', (xl + W) / 2 - 1, D / 2 - 7, { cls: 'ts', anchor: 'middle', size: 8, rot: 90 });
  f.text('LEAN-TO, OPEN', xl / 2, D / 2, { cls: 'tN', anchor: 'middle', rot: 90 });
  f.dimH(0, xl, -2.6, 0); f.dimH(xl, W, -2.6, 0); f.dimH(0, W, -6.4, 0); f.dimV(0, D, -7.2, 0);
  f.dimV(fr[1][0], fr[1][1], -2.8, 0, { text: "10.0'" }); f.dimV(fr[0][0], fr[0][1], -2.8, 0, { text: "10.0'" });
  f.note('36" × 80" WALK-IN DOOR AND\n24" × 36" WINDOW, NORTH END. LOCATION ±', md[1], D + dw, W + 6, D + 1.5, { side: 'r', kind: 'N' });
  f.note("(2) 10' × 10' ROLL-UP DOORS IN THE\nWALL UNDER THE LEAN-TO. LOCATION ±", xl + dw, dr[0][0] + 3, W + 6, D - 6.5, { side: 'r', kind: 'N' });
  f.note(`(2) 10' × 10' FRAMED OPENINGS IN THE\nLEAN-TO, FACING ${streetW(P)}. LOCATION ±`, 0.25, fr[1][0] + 4, W + 6, D - 14.5, { side: 'r', kind: 'N' });
  f.note(`NOMINAL ${b.nominal},\nPER THE OWNER'S BUILDING SKETCH.\nFRAME ${b.ns}' × ${b.ew}' OVERALL`, W, 6.5, W + 6, 8, { side: 'r' });
  f.note('STRUCTURE, ANCHORAGE AND FOUNDATION\nBY OTHERS, PER THE BUILDING PLANS', W * 0.85, 1.2, W + 6, 0.8, { side: 'r' });
  northArrow(f, -17, D - 5, 3.2);
  return v.svg();
}

// ------------------------------------------------------------------ the picture (not to scale): lot from the north-west.
// The kit's isometric puts the viewer at +x, +y; the scene is entered with x reversed (X = XM - x) so the view is from the north-west.
const XM = 110, YM = 136;
function isoScene(P, G, o = {}) {
  const g = P.geometry, s = g.survey, b = g.building, iso = new Iso(o.den || 480, o.id || 'iso'), F = v => v * K, { x0, x1, xl, y0, y1 } = G;
  const q3 = (pts, col, order, opt) => iso.quad(pts.map(p => [F(XM - p[0]), F(YM - p[1]), F(p[2])]), col, Object.assign({ order }, opt || {}));
  const Q = (pts, z, col, order, opt) => q3(pts.map(p => [p[0], p[1], z]), col, order, opt);
  iso.solid(F(XM - 134), F(XM + 44), F(YM - 178), F(YM + 8), -F(3), 0, '#eef0ea', { order: 0, stroke: '#c3c9bb' });
  Q([[-38, -8], [-21.5, -8], [-21.5, 156], [-38, 156]], 0.02, '#d9dce1', 1, { stroke: '#b9c2d0' }); Q([[-38, 156], [134, 156], [134, 171], [-38, 171]], 0.02, '#d9dce1', 1, { stroke: '#b9c2d0' });
  Q(s.boundary, 0.04, '#e3ead9', 1.5, { stroke: INK });
  for (const p of s.concrete) Q(p, 0.08, PAL.slab, 2);
  Q([[-21.5, G.yS], [x0, G.yS], [x0, G.yN], [-21.5, G.yN]], 0.1, '#cfdcf5', 2.2, { stroke: PAL.new });   // gravel driveway, to the edge of the pavement
  const prism = (pts, h, col, order) => { for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; q3([[a[0], a[1], 0], [c[0], c[1], 0], [c[0], c[1], h], [a[0], a[1], h]], shade(col, -0.1), order); } Q(pts, h, shade(col, 0.3), order + 0.5); };
  prism(s.house, 10, PAL.existSolid, 3); prism(s.porch[0], 8, PAL.existSolid, 4);
  prism([[G.shed[0], G.shed[1]], [G.shed[2], G.shed[1]], [G.shed[2], G.shed[3]], [G.shed[0], G.shed[3]]], 7, PAL.existSolid, 4.5);
  const C = PAL.newSolid, xm = (xl + x1) / 2, e = b.eave, pk = b.peak, le = b.leanEave;
  q3([[xm, y0, pk], [x1, y0, e], [x1, y1, e], [xm, y1, pk]], shade(C, 0.15), 5.0);                                          // east roof plane (far side)
  q3([[xl, y0, 0], [xl, y1, 0], [xl, y1, e], [xl, y0, e]], shade(C, -0.1), 5.1);                                            // wall under the lean-to
  for (const d of G.doors) q3([[xl - 0.1, d[0], 0], [xl - 0.1, d[1], 0], [xl - 0.1, d[1], 10], [xl - 0.1, d[0], 10]], '#f4f7fd', 5.2, { stroke: PAL.steel });
  q3([[xl, y0, e], [xm, y0, pk], [xm, y1, pk], [xl, y1, e]], shade(C, 0.3), 5.3);                                           // west roof plane
  q3([[xl, y0, 0], [x1, y0, 0], [x1, y0, e], [xm, y0, pk], [xl, y0, e]], C, 5.4);                                           // south gable
  for (const y of G.postsY) prism([[x0, y - 0.25], [x0 + 0.5, y - 0.25], [x0 + 0.5, y + 0.25], [x0, y + 0.25]], le, C, 5.6);
  q3([[x0, y0, le], [xl, y0, e], [xl, y1, e], [x0, y1, le]], shade(C, 0.25), 5.8, { op: 0.7 });                             // lean-to roof
  iso.line3([F(XM - G.swX), F(YM - G.swA), 2], [F(XM - G.swX), F(YM - G.swB), 2], 'anchOk');
  return iso;
}
function isoLabels(P, G, iso, lean) {
  const F = v => v * K, { x0, x1, xl, y0, y1 } = G, b = P.geometry.building;
  const L = (t, x, y, z, dx, dy, o) => { const at = [F(XM - x), F(YM - y), F(z)], p = iso.p(...at); iso.label(t, at, p[0] + F(dx), p[1] + F(dy), o); };
  L(`(N) ${b.ns}' × ${b.ew}' METAL BUILDING`, x1 - 6, y0 + 4, b.eave + 1.5, -6, -46, { kind: 'N', side: 'r' });
  L('(E) RESIDENCE', 40, 80, 10, -46, -10, { side: 'l' });
  L('(N) GRAVEL DRIVEWAY', 22, G.yc, 0, 16, 34, { kind: 'N', side: 'r' });
  L('(N) SWALE, DRAINS NORTH', G.swX, 96, 0, 22, -26, { kind: 'N', side: 'r' });
  if (!lean) { L(streetN(P), 96, 164, 0, -22, -20, { side: 'l' }); L(streetW(P), -30, 100, 0, -22, 26, { side: 'l' }); }
}

const JOB = {
  type: 'siteplan',
  derive,
  picture: (P, G, o) => { const iso = isoScene(P, G, o); if (o.id === 'cov') isoLabels(P, G, iso, true); return iso; },
  labels: (P, G, iso) => isoLabels(P, G, iso, false),
  field: {
    pictureNote: 'Seen from the south-west', pictureDen: 560, coverDen: 600, pictureHeight: 7.4, planHeight: 10.55,
    plan:    { title: 'Site plan', den: 240, draw: viewSite, note: 'Survey extract. Elevations NAVD 88' },
    section: { title: 'Section at the east side yard, looking north', den: 32, draw: viewSection, note: 'Foundation shown schematic' },
    side:    { title: 'Enlarged plan at the new building', den: 120, draw: viewEnlarged, note: 'Blue × is proposed grade' },
    details: [
      { title: 'Typical swale section', den: 24, draw: detailSwale },
      { title: 'Stormwater check', den: 1, draw: detailStorm, note: (P, G) => `1 in over ${G.foot.toFixed(0)} sq ft` },
      { title: 'Building footprint', den: 96, draw: detailFootprint, note: 'From the owner\'s building sketch' },
    ],
  },
};
