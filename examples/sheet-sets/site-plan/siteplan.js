// Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
// siteplan.js — job-local drawing code for this project (kept beside the project file, not in the installed skill).
// Job type "siteplan": a residential site plan drawn from a survey extract, with one new accessory building placed
// by setbacks, a gravel driveway and a side-yard swale. It is not based on a kit view: the kit ships none for site plans.
// Survey geometry is in decimal feet (P.geometry.survey, local origin at the SW lot corner, x east, y north); the kit's
// model unit is the inch, so everything goes through K = 12.
// What is particular to this job (see "Job-specific drawing code" in references/writing-views.md):
//   - the survey extract drawn as surveyed: pavement, fences, wires, poles, trees, spot elevations, found corners
//   - one building set square to the lot by a north and an east setback, with a lean-to on the street side
//   - a gravel driveway that flares past a utility pole, a swale centred in the east side yard, proposed grades
//   - six views: site plan, side-yard section, enlarged plan, typical swale section, stormwater check, footprint
//   - label and note positions are written for this lot: a different lot needs them moved
//   - the cover is an owner deliverable: three columns, no open-items column, "90% submittal" wording
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

// ---- this job's cover: an owner deliverable. Three columns (no open-items column), notes in two columns, and the
// draft wording says who it is for. The general notes band is the kit's own (project "generalNotes").
document.head.insertAdjacentHTML('beforeend', `<style>.cover .ctop{grid-template-columns:7.6in 8in 1fr} .cover .notes{columns:2;column-gap:.4in} .cover .notes li{break-inside:avoid} .cover .notes h4{break-after:avoid}</style>`);
STATUS.draft = Object.assign({}, STATUS.draft, { band: 'Draft · 90% submittal for owner review · not for construction', box: ['Draft', '90% submittal for owner review', 'Not for construction'] });
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

function derive(P) {
  const g = P.geometry, s = g.survey, b = g.building, B = s.boundary, [NW, NE, SE, SW] = B;
  const northY = x => NW[1] + (NE[1] - NW[1]) * (x - NW[0]) / (NE[0] - NW[0]), southY = x => SW[1] + (SE[1] - SW[1]) * (x - SW[0]) / (SE[0] - SW[0]);
  const eastX = y => SE[0] + (NE[0] - SE[0]) * (y - SE[1]) / (NE[1] - SE[1]), westX = y => SW[0] + (NW[0] - SW[0]) * (y - SW[1]) / (NW[1] - SW[1]);
  // the building is set square to the survey grid: north edge of the lean-to set back from the north line, east wall set back from the east line
  let y1 = NE[1] - b.northSetback, x1 = eastX(y1) - b.eastSetback; y1 = northY(x1 - b.ew / 2) - b.northSetback; x1 = eastX(y1) - b.eastSetback;
  const x0 = x1 - b.ew, y0 = y1 - b.ns, yl = y1 - b.leanNs;
  // separations: building NW corner to the east wall of the house, and to the concrete walk; south wall to the shed
  const hs = ptSeg([x0, y1], s.house[0], s.house[3]);
  let walk = Infinity; for (const poly of s.concrete) for (let i = 0; i < poly.length; i++) walk = Math.min(walk, ptSeg([x0, y1], poly[i], poly[(i + 1) % poly.length]).d);
  const shedTop = Math.max(...s.shed.map(p => p[1])), shedX0 = Math.min(...s.shed.map(p => p[0])), shedX1 = Math.max(...s.shed.map(p => p[0]));
  const pole = s.poles.find(p => p[0] > x0 - 5 && p[0] < x1 + 5 && p[1] > y1) || null;
  // swale: centred in the side yard between the wall and the fence. Storage = full triangular section × length
  const sw = g.swale, swX = (x1 + eastX((y0 + y1) / 2)) / 2 - 0.3, swA = y0 - sw.southExt, swB = northY(swX), swL = Math.round((swB - swA) * 10) / 10;
  const swD = sw.width / 2 / sw.sideSlope, swArea = sw.width * swD / 2, foot = b.ew * b.ns, vReq = foot * sw.rainfallIn / 12, vProv = swArea * swL;
  const egE = y => interp(sw.existing, y), fl = y => egE(y) - swD;
  // gravel driveway: narrow leg in front of the east opening, then a 45° flare past the pole to the full width at the lean-to
  const d = g.driveway, fo = b.frameouts, xE = x0 + fo[1][1], xN = xE - d.width, xW = xE - d.finalWidth, yF1 = pole ? pole[1] - d.pastPole : y1 + 20, yF2 = yF1 - (xN - xW), yN = northY((xN + xE) / 2);
  const drive = [[xN, northY(xN)], [xN, yF1], [xW, yF2], [xW, y1], [xE, y1], [xE, northY(xE)]];
  const dg = y => b.ffe + (d.gradeAtLine - b.ffe) * (y - y1) / (yN - y1);
  return { x0, x1, y0, y1, yl, northY, southY, eastX, westX, toWest: x0 - westX((y0 + y1) / 2), toSouth: y0 - southY((x0 + x1) / 2), toEastS: eastX(y0) - x1,
    houseFoot: hs.q, houseClear: hs.d, walkClear: walk, shedTop, shedX: Math.min(shedX1, x1) - 1.2, shedClear: y0 - shedTop, shedOverlap: shedX0 < x1,
    pole, poleClear: pole ? pole[1] - y1 : 0, poleToDrive: pole ? xN - pole[0] : 0,
    swX, swA, swB, swL, swD, swArea, foot, vReq, vProv, minL: vReq / swArea, egE, fl, pad: b.ffe - b.stepToGrade,
    drive, xE, xN, xW, yF1, yF2, yN, dg };
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
  area(s.house, 'ex', '#dfe3e9'); area(s.shed, 'ex');
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
  const b = P.geometry.building, { x0, x1, y0, y1, yl } = G;
  f.rect(x0, y0, x1, yl, 'new'); f.rect(x0, yl, x1, y1, 'newH');
  if (o.doors) { const dw = 0.45;
    for (const d of b.doors) f.rect(x0 + d[0], yl - dw, x0 + d[1], yl + dw, 'steelo');                       // roll-up doors, in the wall under the lean-to
    f.rect(x1 - dw, y0 + b.manDoor[0], x1 + dw, y0 + b.manDoor[1], 'steelo');                                  // walk-in door, east end wall
    f.raw([[x0, y0 + (yl - y0) / 2], [x1, y0 + (yl - y0) / 2]], { w: 0.6, color: BLUE, dash: [10, 3, 2, 3] });   // ridge
    for (const x of new Set([0, ...b.frameouts.flat(), b.ew])) f.rect(x0 + x - 0.18, y1 - 0.18, x0 + x + 0.18, y1 + 0.18, 'newS');   // lean-to posts at the frame-outs, schematic
  }
}
function drawSwale(f, P, G, o = {}) { // centreline with flow arrows draining north, and the two top-of-bank lines
  const x = G.swX, w = P.geometry.swale.width / 2, ya = G.swA, yb = G.swB;
  f.raw([[x - w, ya], [x - w, yb]], ST.bank); f.raw([[x + w, ya], [x + w, yb]], ST.bank); f.raw([[x - w, ya], [x + w, ya]], ST.bank);
  f.raw([[x, ya], [x, yb]], ST.swale);
  for (let y = ya + (o.first || 10); y < yb - 3; y += (o.step || 22)) f.poly([[x, y + 2.2], [x - 0.9, y - 0.6], [x + 0.9, y - 0.6]], 'newS');
}
function drawDrive(f, P, G, o = {}) { // gravel driveway on the lot, and its connection across the right-of-way (dashed)
  const s = P.geometry.survey, ep = o.epY || 155.9, sp = o.sp || 2, v = f.v;
  f.raw(G.drive, Object.assign({ fill: '#f2f6fd' }, ST.drive), true);
  f.raw([[G.xN, G.northY(G.xN)], [G.xN, ep]], ST.driveRW); f.raw([[G.xE, G.northY(G.xE)], [G.xE, ep]], ST.driveRW);
  let k = 0; for (let y = G.y1 + sp / 2; y < G.yN; y += sp) for (let x = G.xW + sp / 2; x < G.xE; x += sp) { k++; const jx = ((k * 37) % 11 - 5) / 11 * sp * 0.7, jy = ((k * 53) % 13 - 6) / 13 * sp * 0.7;
    if (inPoly(x + jx, y + jy, G.drive)) v.circle((x + jx) * K, (y + jy) * K, v.pt(0.42), 'dot'); }
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

// ------------------------------------------------------------------ 1  SITE PLAN
function viewSite(P, G, den) {
  const g = P.geometry, s = g.survey, b = g.building, v = new View(den, 'site'), f = FV(v), c = [-44, -9, 136, 179], { x0, x1, y0, y1, yl } = G;
  drawSurvey(f, P, G, c, { skipSpot: p => (p.x > x0 - 6 && p.x < x1 + 1 && p.y > y0 - 1 && p.y < y1 + 1) || (p.x > G.xN - 6 && p.x < G.xE + 1 && p.y > y1 && p.y < 156) || (p.x > x0 - 8 && p.x < x0 && p.y > y1 && p.y < y1 + 6) || (p.x < x0 && Math.abs(p.y - (y0 - 2.25)) < 2.2) });
  drawDrive(f, P, G, { sp: 3 });
  drawSwale(f, P, G, { first: 14 });
  drawBuilding(f, P, G);
  // streets and lot lines
  f.text(streetN(P), 30, 164.6, { cls: 'th', anchor: 'middle' }); f.text("50' RIGHT OF WAY · ASPHALT PAVEMENT", 30, 159.6, { cls: 'tm', anchor: 'middle', size: 7.5 });
  f.text(streetW(P), -31.6, 60, { cls: 'th', anchor: 'middle', rot: 90 }); f.text("50' RIGHT OF WAY · ASPHALT PAVEMENT", -26.4, 60, { cls: 'tm', anchor: 'middle', rot: 90, size: 7.5 });
  for (const l of s.lotLines) f.text(l.text, l.x, l.y, { cls: 'ts', anchor: 'middle', rot: l.rot || 0, size: 8.5 });
  for (const m of s.monuments) if (m.label) f.text(m.label, m.x + m.dx, m.y + m.dy, { cls: 'tm', size: 7, anchor: m.dx < 0 ? 'end' : 'start' });
  // existing
  f.text('(E) 1-STORY RESIDENCE', 44.6, 87.6, { cls: 'ts', anchor: 'middle', rot: 55.1, size: 8 }); f.text('FLOOR ELEV ' + s.houseFloor, 48.6, 84.9, { cls: 'tm', anchor: 'middle', rot: 55.1, size: 7 });
  for (const t of s.ties) { f.raw([[t.x1, t.y1], [t.x2, t.y2]], ST.thin); f.text(t.text, t.tx, t.ty, { cls: 'tm', size: 7, anchor: 'middle', rot: t.rot || 0 }); }
  f.text('FLOOD ZONE X', 30, 22, { cls: 'ts', size: 8.5, anchor: 'middle' }); f.text('(ENTIRE LOT, PER SURVEY)', 30, 17.6, { cls: 'tm', size: 7, anchor: 'middle' });
  // new building
  const mx = (x0 + x1) / 2;
  f.text(`(N) METAL\nBUILDING\n${b.ew}' × ${b.ns}'`, mx, y0 + 14.5, { cls: 'tN', anchor: 'middle', size: 9 }); f.text('FFE ' + b.ffe.toFixed(1), mx, y0 + 2.6, { cls: 'tN', anchor: 'middle', size: 9 });
  f.text('LEAN-TO', mx, yl + 4.6, { cls: 'tN', anchor: 'middle', size: 7.5 });
  f.dimV(y1, G.northY(x1 - 1.2), x1 - 1.2, x1 - 1.2, { text: ff(b.northSetback) });
  f.dimH(x1, G.eastX(y0 - 3.4), y0 - 3.4, y0, { text: ff(b.eastSetback) });
  f.dimH(G.westX(y0 - 2.25), x0, y0 - 2.25, y0, { text: ff(G.toWest, true) });
  f.dimV(G.southY(x0 + 12), y0, x0 + 12, x0 + 12, { text: ff(G.toSouth, true) });
  // separations to the existing buildings
  f.raw([[x0, y1], G.houseFoot], ST.thin); f.dot(G.houseFoot[0], G.houseFoot[1], 1, 'dot'); f.dot(x0, y1, 1, 'dot');
  f.text(ff(G.houseClear, true), (x0 + G.houseFoot[0]) / 2 + 0.9, (y1 + G.houseFoot[1]) / 2 + 1.5, { cls: 'td', anchor: 'middle', rot: -34.8, size: 8 });
  f.raw([[G.shedX, G.shedTop], [G.shedX, y0]], ST.thin);
  // notes, in the neighbour's side yard east of the lot
  const nx = 143;
  f.note("(E) 4' HOG WIRE FENCE AND GATE IN THE\nRIGHT-OF-WAY. OPENING AT THE DRIVEWAY\nBY THE CONTRACTOR", 100, 145.3, nx, 172, { side: 'r' });
  f.note(`(N) DRIVEWAY CONNECTION TO ${streetN(P)},\nIN THE RIGHT-OF-WAY. COORDINATE WITH\nTHE COUNTY`, G.xE, 150, nx, 157, { side: 'r', kind: 'N' });
  f.note(`(N) GRAVEL DRIVEWAY, ${f1(g.driveway.width)}' WIDE,\nFLARES TO ${f1(g.driveway.finalWidth)}' AT THE LEAN-TO.\nSLOPES TO THE STREET. SEE ${REF.side}/${REF.sheet}`, G.xE, 124, nx, 142, { side: 'r', kind: 'N' });
  if (G.pole) f.note(`(E) UTILITY POLE AND OVERHEAD WIRE,\n${ff(G.poleClear, true)} IN FRONT OF THE LEAN-TO.\nCONTRACTOR IS TO CONFIRM ACCESS AND\nPROTECT EXISTING UTILITIES`, G.pole[0], G.pole[1], nx, 127, { side: 'r' });
  f.note(`(N) ${b.ew}' × ${b.ns}' METAL BUILDING\nFFE ${b.ffe.toFixed(1)} (NAVD 88)\nSEE ${REF.side}/${REF.sheet}`, x1, y0 + 26, nx, 108, { side: 'r', kind: 'N' });
  f.note(`(N) SWALE, ${f1(g.swale.width)}' WIDE × ${f1(G.swL)}' LONG,\nDRAINS NORTH TO ${streetN(P)}.\nSEE ${REF.section} AND ${REF.d1}/${REF.sheet}`, G.swX, y0 + 12, nx, 91, { side: 'r', kind: 'N' });
  f.note("(E) 4' HOG WIRE FENCE", 109.4, 58, nx, 76, { side: 'r' });
  f.note(`(E) SHED, 7' × 7'. ${ff(G.shedClear, true)}\nCLEAR TO THE NEW BUILDING`, G.shedX, (G.shedTop + y0) / 2, nx, 63, { side: 'r' });
  f.note("(E) 4' CHAINLINK FENCE", 96, -1.3, nx, 44, { side: 'r' });
  f.note('(E) CANOPY LINE,\nPER SURVEY', 103, 17.8, nx, 30, { side: 'r' });
  northArrow(f, 152, 6, 5.5); graphicScale(f, 166, 1.5, [0, 10, 20, 40]);
  return v.svg();
}

// ------------------------------------------------------------------ 2  SECTION through the east side yard, looking north
function viewSection(P, G, den) {
  const g = P.geometry, b = g.building, sw = g.swale, v = new View(den, 'sect'), f = FV(v, Math.floor(b.ffe) - 5), { x1 } = G, ym = (G.y0 + G.y1) / 2, pl = G.eastX(ym), fx = g.section.fenceX, eg = g.section.existGrade, egL = g.section.existGradeAtLine;
  const xa = x1 - 7.6, xb = pl + 3, F = b.ffe, pad = G.pad, t = 0.333, fb = pad - 1.0, wl = G.swX - sw.width / 2, wr = G.swX + sw.width / 2, egW = eg + (egL - eg) * (wl - x1) / (pl - x1), egR = eg + (egL - eg) * (wr - x1) / (pl - x1), inv = Math.min(egW, egR) - G.swD;
  // slab with a thickened perimeter footing, schematic (by others)
  f.poly([[xa, F], [x1, F], [x1, fb], [x1 - 1, fb], [x1 - 1, F - t - 0.55], [x1 - 1.55, F - t], [xa, F - t]], 'new', true, { fill: v.pat('conc') });
  f.poly([[xa, F - t - 0.35], [xa - 0.12, F - 0.22], [xa + 0.12, F - 0.1], [xa, F + 0.25]], 'o2', false);
  f.dot(x1 - 0.72, fb + 0.28, 2.2, 'dot'); f.dot(x1 - 0.28, fb + 0.28, 2.2, 'dot');
  // base rail and wall
  f.rect(x1 - 0.5, F, x1 - 0.29, F + 0.21, 'steelo');
  f.rect(x1 - 0.5, F + 0.21, x1 - 0.29, F + 3.0, 'newF'); f.poly([[x1 - 0.5, F + 3.0], [x1 - 0.5, F + 0.21]], 'new', false); f.poly([[x1 - 0.29, F + 0.21], [x1 - 0.29, F + 3.0]], 'new', false);
  f.poly([[x1 - 0.8, F + 3.0], [x1 - 0.48, F + 3.0], [x1 - 0.43, F + 3.2], [x1 - 0.36, F + 2.8], [x1 - 0.3, F + 3.0], [x1 + 0.05, F + 3.0]], 'o2', false);
  // grades: existing dashed grey, proposed blue
  f.raw([[xa, eg], [x1, eg], [pl, egL], [xb, egL]], { w: 0.9, color: GREY, dash: [6, 3] });
  f.raw([[x1, pad], [wl, egW], [G.swX, inv], [wr, egR]], { w: 1.5, color: BLUE });
  f.raw([[pl, egL - 1.5], [pl, F + 3.2]], ST.prop); f.line(fx, egL, fx, egL + 4, 'exw');
  // dimensions
  f.dimH(x1, pl, F + 2.45, F + 0.5, { text: ff(b.eastSetback) + ' SIDE YARD' });
  f.dimH(x1, wl, F + 1.25, pad + 0.1, { text: ff(wl - x1, true) }); f.dimH(wl, wr, F + 1.25, egR + 0.1, { text: ff(sw.width) + ' SWALE' }); f.dimH(wr, pl, F + 1.25, egR + 0.1, { text: ff(pl - wr, true) });
  f.dimV(inv, Math.min(egW, egR), wr + 0.75, G.swX, { text: `${Math.round(G.swD * 24) / 2}"` });
  f.text(`${sw.sideSlope}:1`, (wl + G.swX) / 2 - 0.1, (egW + inv) / 2 - 0.42, { cls: 'tN', size: 8, anchor: 'middle' }); f.text(`${sw.sideSlope}:1`, (wr + G.swX) / 2 + 0.2, (egR + inv) / 2 - 0.42, { cls: 'tN', size: 8, anchor: 'middle' });
  // notes
  f.datum('FINISHED FLOOR\nEL. ' + F.toFixed(1), xa - 2.4, F, xa - 0.3);
  f.note('(E) GRADE ' + eg.toFixed(1) + ' ±\nAT THE BUILDING', xa + 1.2, eg, xa - 0.6, eg - 0.95, { side: 'l' });
  f.note('(N) METAL BUILDING WALL\nON BASE RAIL', x1 - 0.5, F + 2.3, x1 - 1.7, F + 2.75, { side: 'l', kind: 'N' });
  f.note('(N) SLAB AND FOUNDATION\nBY OTHERS. SHOWN SCHEMATIC', xa + 1.6, F - 0.17, xa + 0.9, F + 1.45, { side: 'r', kind: 'N' });
  f.note(`PERIMETER FOOTING BELOW GRADE.\nSIZE, REINFORCING AND ANCHORS\nPER THE BUILDING PLANS`, x1 - 0.5, fb + 0.1, x1 - 2.0, fb - 1.25, { side: 'l', kind: 'N' });
  f.note(`(N) FINISHED GRADE AT THE WALL\n${pad.toFixed(1)} ±, ABOUT ${Math.round(b.stepToGrade * 12)}" BELOW THE FLOOR.\nSLOPE AWAY TO THE SWALE`, x1 + 0.9, pad - (pad - egW) * 0.9 / (wl - x1), x1 + 1.5, fb - 0.55, { side: 'r', kind: 'N' });
  f.note(`(N) SWALE FLOW LINE ${inv.toFixed(1)} ±\nMATCH (E) GRADE AT BOTH EDGES.\nSEE ${REF.d1}/${REF.sheet}`, G.swX, inv, pl + 2.1, inv - 0.95, { side: 'r', kind: 'N' });
  f.note('EAST PROPERTY LINE', pl, F + 3.0, pl + 2.1, F + 3.05, { side: 'r' });
  f.note("(E) 4' HOG WIRE FENCE", fx, egL + 3.3, pl + 2.1, F + 1.9, { side: 'r' });
  f.note('(E) GRADE ' + egL.toFixed(1) + ' ±\nAT THE LINE', pl + 0.8, egL, pl + 2.1, F + 0.55, { side: 'r' });
  return v.svg();
}

// ------------------------------------------------------------------ 3  ENLARGED PLAN at the new building
function viewEnlarged(P, G, den) {
  const g = P.geometry, s = g.survey, b = g.building, d = g.driveway, v = new View(den, 'enl'), f = FV(v), { x0, x1, y0, y1, yl } = G, c = [52, y0 - 11.6, G.eastX(y0) + 2.5, G.northY(x1) + 2.4];
  drawSurvey(f, P, G, c, { spotSize: 7.5, skipSpot: p => (p.x > x0 - 11 && p.x < x1 + 3 && p.y > y0 - 6 && p.y < y1 + 1) || (p.x > G.xW - 2 && p.x < G.xE + 2 && p.y > y1) || (p.x > x1 && p.y > y0 - 8 && p.x < G.swX + 3) || p.y > G.yN + 1 });
  drawDrive(f, P, G, { sp: 1.7, epY: c[3] });
  drawSwale(f, P, G, { first: 9, step: 19 });
  drawBuilding(f, P, G, { doors: true });
  const mx = (x0 + x1) / 2;
  f.text("(N) METAL BUILDING", mx, y0 + 13.6, { cls: 'tN', anchor: 'middle', size: 11 }); f.text(`FFE ${b.ffe.toFixed(1)} (NAVD 88)`, mx, y0 + 11, { cls: 'tN', anchor: 'middle', size: 10 });
  f.text(`${b.ns - b.leanNs}' ENCLOSED · RIDGE EAST-WEST`, mx, y0 + 5.2, { cls: 'ts', anchor: 'middle', size: 8 });
  f.text(`${b.leanNs}' LEAN-TO, OPEN`, mx, yl + 7.4, { cls: 'tN', anchor: 'middle', size: 9.5 }); f.text("(2) 10' × 10' ROLL-UP DOORS", mx, yl + 2.2, { cls: 'ts', anchor: 'middle', size: 8 });
  f.text('(E) RESIDENCE', 57.6, 96.6, { cls: 'ts', anchor: 'middle', rot: 55.1, size: 8.5 }); f.text('(E) CONC.', 58.6, 83.3, { cls: 'tm', anchor: 'middle', rot: 55.1, size: 7.5 });
  f.text(`NORTH PROPERTY LINE · ${streetN(P)} R/W`, 70, G.northY(70) + 1.2, { cls: 'ts', anchor: 'middle', size: 8 });
  f.text('EAST PROPERTY LINE', G.eastX(120) + 1.3, 120, { cls: 'ts', anchor: 'middle', rot: 90, size: 8 });
  f.text(`(N) GRAVEL DRIVEWAY`, (G.xN + G.xE) / 2 + 0.6, (G.yF1 + G.yN) / 2 + 1.5, { cls: 'tN', anchor: 'middle', rot: 90, size: 9 });
  // building and setback dimensions
  f.dimH(x0, x1, y0 - 3.6, y0, { text: ff(b.ew) }); f.dimH(x1, G.eastX(y0 - 3.6), y0 - 3.6, y0, { text: ff(b.eastSetback) });
  f.dimV(y0, yl, x0 - 3.6, x0, { text: ff(b.ns - b.leanNs) }); f.dimV(yl, y1, x0 - 3.6, x0, { text: ff(b.leanNs) }); f.dimV(y0, y1, x0 - 8, x0, { text: ff(b.ns) });
  f.dimV(y1, G.northY(x1 - 1.9), x1 - 1.9, x1 - 1.9, { text: ff(b.northSetback) + ' TO NORTH LINE' });
  // driveway dimensions
  f.dimH(G.xN, G.xE, G.yN - 4.6, G.yN - 4.6, { text: ff(d.width) }); f.dimH(G.xW, G.xE, y1 + 3.2, y1, { text: ff(d.finalWidth) });
  if (G.pole) { f.dimH(G.pole[0], G.xN, G.pole[1], G.pole[1], { text: ff(G.poleToDrive, true) }); f.dimV(y1, G.pole[1], x0 - 3.6, G.pole[0], { text: ff(G.poleClear, true) }); }
  // separations to the existing buildings
  f.raw([[x0, y1], G.houseFoot], ST.thin); f.dot(G.houseFoot[0], G.houseFoot[1], 1.1, 'dot');
  f.text(ff(G.houseClear, true), (x0 + G.houseFoot[0]) / 2 - 0.5, (y1 + G.houseFoot[1]) / 2 + 0.9, { cls: 'td', anchor: 'middle', rot: -34.8, size: 9 });
  f.dimV(G.shedTop, y0, G.shedX, G.shedX, { text: ff(G.shedClear, true) });
  f.text("(E) SHED", (Math.max(...s.shed.map(p => p[0])) + Math.min(...s.shed.map(p => p[0]))) / 2, G.shedTop - 2.4, { cls: 'ts', anchor: 'middle', size: 7.5 });
  // proposed grades (blue ×): pad at the walls, swale flow line, driveway
  const pd = G.pad.toFixed(1);
  pgrade(f, x0, y0, pd, { anchor: 'end', dy: 0.5 }); pgrade(f, x1, y0, pd, { anchor: 'start', dy: 0.5, size: 7 }); pgrade(f, x0, yl, pd, { anchor: 'end', dy: 0.5 }); pgrade(f, x1, yl, pd, { anchor: 'end', dy: 0.6 });
  for (const y of [G.swA + 0.4, (y0 + yl) / 2 + 4, y1, y1 + 19, G.swB - 0.6]) pgrade(f, G.swX, y, 'FL ' + f1(G.fl(y)), { dy: -0.4 });
  pgrade(f, (G.xW + G.xE) / 2 - 5, y1 + 0.9, f1(b.ffe) + ' AT SLAB', { dy: -0.4 }); pgrade(f, G.xN + 2.2, (y1 + G.yN) / 2, f1(G.dg((y1 + G.yN) / 2)) + ' ±', { dy: -0.4 }); pgrade(f, G.xN + 2.6, G.yN - 1.1, f1(d.gradeAtLine) + ' ± MATCH (E)', { dy: -0.4, anchor: 'end' });
  slopeArrow(f, G.xE - 4.6, y1 + 9, y1 + 17, 'SLOPE', { side: 'l' }); slopeArrow(f, G.xN + 1.6, G.yN - 15.5, G.yN - 8, 'SLOPE', { side: 'l' });
  // section cut
  const ym = (y0 + y1) / 2, ca = x1 - 5, cb = c[2] + 1.2;
  f.line(ca, ym, cb, ym, 'cutl'); f.line(ca, ym, ca, ym + 2.2, 'cutl2'); f.line(cb, ym, cb, ym + 2.2, 'cutl2'); f.arrow(cb, ym + 3.6, cb, ym); f.bubble(cb + 3.2, ym + 0.6, String(REF.section), REF.sheet);
  // notes
  const nx = c[2] + 2.2;
  f.note("(E) FENCE AND GATE\nIN THE R/W.\nOPENING AT THE\nDRIVEWAY BY\nCONTRACTOR", G.xE - 1, c[3] - 0.4, nx, G.yN - 1.5, { side: 'r' });
  f.note(`(N) GRAVEL\nDRIVEWAY,\n${f1(d.width)}' WIDE.\nFLARES TO\n${f1(d.finalWidth)}' PAST\nTHE POLE`, G.xE, G.yN - 14, nx, G.yN - 17, { side: 'r', kind: 'N' });
  f.note(`(N) SWALE\n${f1(g.swale.width)}' × ${f1(G.swL)}'\nFLOWS NORTH\nSEE ${REF.d1}/${REF.sheet}`, G.swX, y1 + 8, nx, y1 + 13, { side: 'r', kind: 'N' });
  f.note("(N) GRADE\n×  BLUE.\n(E) GRADE\n+  GREY", G.swX, y1, nx, y1 - 1.5, { side: 'r', kind: 'N' });
  f.note("36\" × 80\"\nDOOR ±", x1 + 0.45, y0 + (b.manDoor[0] + b.manDoor[1]) / 2, nx, y0 + 8.5, { side: 'r', kind: 'N' });
  f.note("(E) 4' HOG\nWIRE FENCE", 109.45, y0 + 2, nx, y0 + 3, { side: 'r' });
  if (G.pole) f.note('(E) UTILITY POLE AND\nOVERHEAD WIRE. CONTRACTOR\nIS TO CONFIRM ACCESS AND\nPROTECT EXISTING UTILITIES', G.pole[0], G.pole[1], 55.5, G.pole[1] + 12.5, { side: 'r' });
  f.note('(E) A/C PAD', 64.6, 99.3, 53.5, 106.5, { side: 'r' });
  northArrow(f, nx + 5.5, y0 - 8, 2.8); graphicScale(f, 66, y0 - 9.6, [0, 5, 10]);
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

// ------------------------------------------------------------------ 6  BUILDING FOOTPRINT (from the owner's building sketch)
function detailFootprint(P, G, den) {
  const b = P.geometry.building, v = new View(den, 'foot'), f = FV(v), W = b.ew, D = b.ns, yl = D - b.leanNs, dw = 0.4;
  f.rect(0, 0, W, yl, 'new'); f.rect(0, yl, W, D, 'newH');
  f.raw([[0, yl / 2], [W, yl / 2]], { w: 0.6, color: BLUE, dash: [10, 3, 2, 3] });
  for (const d of b.doors) f.rect(d[0], yl - dw, d[1], yl + dw, 'steelo');
  f.rect(W - dw, b.manDoor[0], W + dw, b.manDoor[1], 'steelo'); f.rect(W - dw * 0.6, b.window[0], W + dw * 0.6, b.window[1], 'steelo');
  for (const x of new Set([0, ...b.frameouts.flat(), W])) f.rect(x - 0.25, D - 0.25, x + 0.25, D + 0.25, 'newS');
  f.text('ENCLOSED GARAGE', W / 2, yl / 2 + 3, { cls: 'tN', anchor: 'middle' }); f.text('RIDGE', W / 2, yl / 2 + 0.6, { cls: 'ts', anchor: 'middle', size: 8 });
  f.text('LEAN-TO, OPEN', W / 2, yl + b.leanNs / 2 - 0.5, { cls: 'tN', anchor: 'middle' });
  f.dimH(0, W, -2.6, 0); f.dimV(0, yl, -4, 0); f.dimV(yl, D, -4, 0); f.dimV(0, D, -9, 0);
  f.dimH(b.frameouts[0][0], b.frameouts[0][1], D + 2.6, D, { text: "10.0'" }); f.dimH(b.frameouts[1][0], b.frameouts[1][1], D + 2.6, D, { text: "10.0'" });
  f.note(`(2) 10' × 10' FRAMED OPENINGS IN THE\nLEAN-TO, FACING ${streetN(P)}. LOCATION ±`, b.frameouts[1][1] - 1, D, W + 6, D + 1.5, { side: 'r', kind: 'N' });
  f.note("(2) 10' × 10' ROLL-UP DOORS IN THE\nWALL UNDER THE LEAN-TO. LOCATION ±", b.doors[1][1] - 1, yl, W + 6, yl + 3.2, { side: 'r', kind: 'N' });
  f.note('36" × 80" WALK-IN DOOR AND\n24" × 36" WINDOW, EAST END. LOCATION ±', W + dw, (b.manDoor[0] + b.manDoor[1]) / 2, W + 6, yl - 6.5, { side: 'r', kind: 'N' });
  f.note(`NOMINAL ${b.nominal} PER THE OWNER'S\nBUILDING SKETCH. FRAME ${b.ew}' × ${b.ns}' OVERALL`, W, 3.4, W + 6, 5.2, { side: 'r' });
  f.note('STRUCTURE, ANCHORAGE AND FOUNDATION\nBY OTHERS, PER THE BUILDING PLANS', W * 0.8, 1.2, W + 6, 0.6, { side: 'r' });
  northArrow(f, -17, D - 5, 3.2);
  return v.svg();
}

// ------------------------------------------------------------------ the picture (not to scale): lot from the north-east
function isoScene(P, G, o = {}) {
  const g = P.geometry, s = g.survey, b = g.building, iso = new Iso(o.den || 480, o.id || 'iso'), F = v => v * K, { x0, x1, y0, y1, yl } = G;
  const Q = (pts, z, col, order, opt) => iso.quad(pts.map(p => [F(p[0]), F(p[1]), F(z)]), col, Object.assign({ order }, opt || {}));
  iso.solid(F(-44), F(134), F(-8), F(178), -F(3), 0, '#eef0ea', { order: 0, stroke: '#c3c9bb' });
  Q([[-38, -8], [-21.5, -8], [-21.5, 156], [-38, 156]], 0.02, '#d9dce1', 1, { stroke: '#b9c2d0' }); Q([[-38, 156], [134, 156], [134, 171], [-38, 171]], 0.02, '#d9dce1', 1, { stroke: '#b9c2d0' });
  Q(s.boundary, 0.04, '#e3ead9', 1.5, { stroke: INK });
  for (const p of s.concrete) Q(p, 0.08, PAL.slab, 2);
  // gravel driveway, to the edge of the pavement
  Q([[G.xN, G.yF1], [G.xE, G.yF1], [G.xE, 156], [G.xN, 156]], 0.1, '#cfdcf5', 2.2, { stroke: PAL.new });
  Q([[G.xW, y1], [G.xE, y1], [G.xE, G.yF2], [G.xW, G.yF2]], 0.1, '#cfdcf5', 2.2); Q([[G.xW, G.yF2], [G.xE, G.yF2], [G.xE, G.yF1], [G.xN, G.yF1]], 0.1, '#cfdcf5', 2.2);
  const prism = (pts, h, col, order) => { for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length]; iso.quad([[F(a[0]), F(a[1]), 0], [F(c[0]), F(c[1]), 0], [F(c[0]), F(c[1]), F(h)], [F(a[0]), F(a[1]), F(h)]], shade(col, -0.1), { order }); } Q(pts, h, shade(col, 0.3), order + 0.5); };
  prism(s.porch[0], 8, PAL.existSolid, 3); prism(s.house, 10, PAL.existSolid, 4); prism(s.shed, 7, PAL.existSolid, 4);
  const C = PAL.newSolid, ym = (y0 + yl) / 2, k = (b.peak - b.eave) / (ym - y0);
  iso.solid(F(x0), F(x1), F(y0), F(ym), 0, y => F(b.eave) + (y - F(y0)) * k, C, { order: 5 });
  iso.solid(F(x0), F(x1), F(ym), F(yl), 0, y => F(b.peak) - (y - F(ym)) * k, C, { order: 5.2 });
  for (const d of b.doors) iso.quad([[F(x0 + d[0]), F(yl) + 1, 0], [F(x0 + d[1]), F(yl) + 1, 0], [F(x0 + d[1]), F(yl) + 1, F(10)], [F(x0 + d[0]), F(yl) + 1, F(10)]], '#f4f7fd', { order: 5.3, stroke: PAL.steel });
  const kl = (b.eave - b.leanEave) / (y1 - yl), lt = y => F(b.eave) - (y - F(yl)) * kl;
  for (const x of new Set([0.2, ...b.frameouts.flat(), b.ew - 0.2])) iso.solid(F(x0 + x - 0.2), F(x0 + x + 0.2), F(y1 - 0.4), F(y1), 0, F(b.leanEave), C, { order: 5.4 });
  iso.solid(F(x0), F(x1), F(yl), F(y1), y => lt(y) - F(0.4), lt, shade(C, 0.25), { order: 5.6, op: 0.72 });
  iso.line3([F(G.swX), F(G.swA), 2], [F(G.swX), F(G.swB), 2], 'anchOk');
  return iso;
}
function isoLabels(P, G, iso, lean) {
  const F = v => v * K, { x0, x1, y0, y1, yl } = G, b = P.geometry.building, p = (x, y, z) => iso.p(F(x), F(y), F(z || 0));
  const top = p(-44, -8, 0)[1] - F(6), bot = p(134, 178, 0)[1] + F(14);
  iso.label(`(N) ${b.ew}' × ${b.ns}' METAL BUILDING`, [F(x1 - 6), F(y0 + 6), F(b.eave + 1.2)], p(134, -8)[0] - F(12), top + F(34), { kind: 'N', side: 'l' });
  iso.label('(E) RESIDENCE', [F(44), F(84), F(10)], p(-44, 100)[0] + F(70), top + F(16), { side: 'l' });
  iso.label('(N) SWALE, DRAINS NORTH', [F(G.swX), F(y1 + 30), 2], p(134, 178)[0] + F(20), bot, { kind: 'N', side: 'r' });
  iso.label(streetN(P), [F(30), F(164), 0], p(-44, 178)[0] + F(24), bot - F(10), { side: 'r' });
  if (!lean) { iso.label(streetW(P), [F(-30), F(40), 0], p(-44, 60)[0] - F(4), top + F(40), { side: 'r' });
    iso.label('(N) GRAVEL DRIVEWAY', [F((G.xN + G.xE) / 2), F(G.yN - 6), 0], p(60, 178)[0] - F(60), bot - F(34), { kind: 'N', side: 'l' }); }
}

const JOB = {
  type: 'siteplan',
  derive,
  picture: (P, G, o) => { const iso = isoScene(P, G, o); if (o.id === 'cov') isoLabels(P, G, iso, true); return iso; },
  labels: (P, G, iso) => isoLabels(P, G, iso, false),
  field: {
    pictureNote: 'Seen from the north-east', pictureDen: 620, coverDen: 820, pictureHeight: 4.2, planHeight: 10.4,
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
