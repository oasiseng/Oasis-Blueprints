// Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
// views/manufactured-home.js — job type "manufactured-home": a permanent pier foundation, a site plan and freestanding
// entry decks for a multi-section HUD-code manufactured home. Three field sheets, each with its own view:
//   sheets[].view = "site" (P.site, decimal feet), "foundation" (P.geometry, inches), "deck" (P.deck, inches).
// Each field sheet can take its own summary, facts and construction steps from P.sheetData[view]; the cover and every
// cross-reference in the notes point at the foundation sheet. The kit draws one kind of field sheet per job, so this
// file wraps the kit's sheetField and setRefs to pick the view per sheet (see THE SET at the end).
'use strict';

// 'GENERAL NOTE A1' when the set carries the engineer's general notes, else 'GENERAL NOTES'
const GN = (P, key) => ((P.generalNotes || []).length ? 'GENERAL NOTE ' + key : 'GENERAL NOTES');
// The label positions in the three pictures below are worked out on screen with sx = (x - y) × 0.866, the mirror of the
// kit's isometric (sx = (y - x) × 0.866). lab() mirrors each one back, so a label keeps its place beside the part it names.
const lab = iso => (t, at, ex, ey, o = {}) => iso.label(t, at, -ex, ey, Object.assign({}, o, { side: (o.side || 'r') === 'r' ? 'l' : 'r' }));

const I = v => v * UPI;
// feet-inches to the quarter inch (the kit's FMT rounds to the half inch)
const Q = v => { const q = Math.round(v / UPI * 4) / 4, f = Math.floor(q / 12), i = q - f * 12, w = Math.floor(i); return (f ? f + "'-" : '') + w + ['', '¼', '½', '¾'][Math.round((i - w) * 4)] + '"'; };
const UP = s => String(s).toUpperCase();

function stations(L, end, sMax) { const n = Math.ceil((L - 2 * end) / sMax), s = (L - 2 * end) / n, xs = []; for (let i = 0; i <= n; i++) xs.push(end + i * s); return { n, s, xs }; }

function foundDerive(P) {
  const g = P.geometry, W = g.Ws * g.nSec, e = (g.Ws - g.iBeamSpacing) / 2, beams = [];
  for (let k = 0; k < g.nSec; k++) { beams.push({ y: k * g.Ws + e, outer: k === 0 }); beams.push({ y: (k + 1) * g.Ws - e, outer: k === g.nSec - 1 }); }
  const fr = stations(g.L, g.endDist, g.pierSpacing), ml = g.mlStations ? { xs: g.mlStations } : stations(g.L, g.endDist, g.mlSpacing), ti = stations(g.L, g.tieEnd, g.anchorSpacing);
  const zPadBot = -g.embed, zPadTop = zPadBot + g.padT, zPierTop = zPadTop + g.pierH, zFloorBot = zPierTop + g.iBeamDepth, zFloorTop = zPierTop + g.floorDepth;
  const cols = g.colStations || [], padAt = x => (cols.includes(x) ? g.padCol : g.padML);
  return { W, e, beams, fr, ml, ti, cols, padAt, zPadBot, zPadTop, zPierTop, zFloorBot, zFloorTop, yML: g.nSec > 1 ? g.Ws : null,
    zFtgTop: zPadBot + g.ftgH, fo: (g.ftgB - g.wallT) / 2, zWallTop: g.wallTop, zAnch: g.anchorH };
}
const loop = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const breakH = (v, x0, x1, y) => { const m = (x0 + x1) / 2, a = I(1.2), b = I(2.6); v.poly([[x0 - I(2), y], [m - a, y], [m - a / 2, y + b], [m + a / 2, y - b], [m + a, y], [x1 + I(2), y]], 'o2', false); };
const breakV = (v, x, y0, y1) => { const m = (y0 + y1) / 2, a = I(1.2), b = I(2.6); v.poly([[x, y0 - I(2)], [x, m - a], [x + b, m - a / 2], [x - b, m + a / 2], [x, m + a], [x, y1 + I(2)]], 'o2', false); };

// ---- drawing parts shared by the sections and the details ----
function soil(v, x0, x1, zBot) {                                     // earth below finished grade, drawn first
  if (!v._soil) { const id = 'soil-' + v.id, s = v.pt(6.5);
    v.defs.push(`<pattern id="${id}" width="${r3(s)}" height="${r3(s)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${r3(s)}" height="${r3(s)}" fill="#f7f5ef"/><line x1="0" y1="0" x2="0" y2="${r3(s)}" stroke="#d3ccbb" stroke-width="${r3(v.pt(0.55))}"/></pattern>`); v._soil = `url(#${id})`; }
  v.ext(x0, 0); v.ext(x1, zBot); v.out.push(`<rect x="${r3(x0)}" y="0" width="${r3(x1 - x0)}" height="${r3(-zBot)}" style="fill:${v._soil};stroke:none"/>`);
  v.line(x0, 0, x1, 0, 'o');
}
function pad(v, g, x, w, zb, bars) {                                 // concrete pad with bottom bars
  v.rect(x - w / 2, zb, x + w / 2, zb + g.padT, 'new', { fill: v.pat('conc') });
  if (bars) { v.line(x - w / 2 + I(3), zb + I(3), x + w / 2 - I(3), zb + I(3), 'steel'); const n = Math.max(2, Math.round((w - I(6)) / I(12)) + 1); for (let k = 0; k < n; k++) v.circle(x - w / 2 + I(3.6) + k * (w - I(7.2)) / (n - 1), zb + I(3.8), I(0.42), 'steel'); }
}
function cmuPier(v, g, x, w, zb, zt, o = {}) {                       // block courses, solid cap, shims
  const capT = I(4), shim = I(2), H = zt - zb - capT - shim, n = Math.max(1, Math.round(H / g.blockH)), ch = H / n;
  v.rect(x - w / 2, zb, x + w / 2, zb + H, 'new');
  for (let k = 1; k < n; k++) v.line(x - w / 2, zb + k * ch, x + w / 2, zb + k * ch, 'new');
  if (o.cells) for (const dx of [-w / 4, w / 4]) v.line(x + dx, zb, x + dx, zb + H, 'newH');
  if (o.double) for (let k = 0; k < n; k++) { const xx = k % 2 ? x - w / 4 : x + w / 4; v.line(o.interlock ? xx : x, zb + k * ch, o.interlock ? xx : x, zb + (k + 1) * ch, 'new'); }
  v.rect(x - w / 2, zb + H, x + w / 2, zb + H + capT, 'newS');                                             // solid cap
  const sw = o.shimW || Math.min(w - I(1.5), I(8)), h = shim / 2;                                          // two stacked wood shims, no gap
  [[sw, zb + H + capT, '#c9a06a'], [sw - I(1.5), zb + H + capT + h, '#b88a54']].forEach(([ww, z0, col]) => { v.ext(x - ww / 2, z0); v.ext(x + ww / 2, z0 + h);
    v.out.push(`<rect x="${r3(x - ww / 2)}" y="${r3(-(z0 + h))}" width="${r3(ww)}" height="${r3(h)}" style="fill:${col};stroke:#6b4a23;stroke-width:${r3(v.pt(0.7))}"/>`); });
}
function iBeam(v, x, zb, zt) {                                       // chassis I-beam cut in section
  const bf = I(2.2), tf = I(0.6), tw = I(0.35);
  v.rect(x - bf, zb, x + bf, zb + tf, 'steel'); v.rect(x - bf, zt - tf, x + bf, zt, 'steel'); v.rect(x - tw, zb + tf, x + tw, zt - tf, 'steel');
}
function floorBand(v, x0, x1, zb, zt) { v.rect(x0, zb, x1, zt, 'exw', { fill: v.pat('wall') }); }
function strap(v, x0, z0, x1, z1) {                                  // strap from clamp (x0,z0) to anchor (x1,z1), with a tensioner
  v.line(x0, z0, x1, z1, 'anchOk'); const t = 0.35, cx = x1 + (x0 - x1) * t, cz = z1 + (z0 - z1) * t, a = Math.atan2(z0 - z1, x0 - x1), c = Math.cos(a), s = Math.sin(a), l = I(2.4), h = I(1);
  v.poly([[cx - l * c + h * s, cz - l * s - h * c], [cx + l * c + h * s, cz + l * s - h * c], [cx + l * c - h * s, cz + l * s + h * c], [cx - l * c - h * s, cz - l * s + h * c]], 'steelo');
}
// perimeter wall on its footing. x0 = outside face, k = +1 when the inside of the home is toward +x. detail: bars and courses
function wallSect(v, g, G, x0, k, detail) {
  const xi = x0 + k * g.wallT, xc = x0 + k * g.wallT / 2, f0 = xc - g.ftgB / 2, f1 = xc + g.ftgB / 2;
  v.rect(f0, G.zPadBot, f1, G.zFtgTop, 'new', { fill: v.pat('conc') });
  v.rect(Math.min(x0, xi), G.zFtgTop, Math.max(x0, xi), G.zWallTop, 'new');
  if (detail) {
    for (let z = G.zFtgTop + g.blockH; z < G.zWallTop - I(1); z += g.blockH) v.line(Math.min(x0, xi), z, Math.max(x0, xi), z, 'new');
    v.poly([[xc + k * I(4.5), G.zPadBot + I(3.4)], [xc, G.zPadBot + I(3.4)], [xc, G.zWallTop - I(2)]], 'steel', false);        // hooked vertical bar
    for (const dx of [-I(4.2), I(4.2)]) v.circle(xc + dx, G.zPadBot + I(3.6), I(0.5), 'steel');                                   // footing bars
    for (const dx of [-I(1.6), I(1.6)]) v.circle(xc + dx, G.zAnch, I(0.5), 'steel');                                              // anchor bond beam
    v.circle(xc + k * I(1.6), G.zWallTop - I(4), I(0.5), 'steel');                                                                // top course bar
  }
  return { xi, xc };
}
function anchorAt(v, x, z, k) { v.rect(Math.min(x, x - k * I(3)), z - I(1.4), Math.max(x, x - k * I(3)), z + I(1.4), 'steel'); v.circle(x + k * I(1.3), z, I(1.3), 'steelo'); }

// ------------------------------------------------------------------ 1  FOUNDATION PLAN
function fdPlan(P, G, den) {
  const g = P.geometry, v = new View(den, 'plan'), L = g.L, W = G.W, t = g.wallT, fo = G.fo, nx = L + fo + I(12);
  // wall footing (below grade) and perimeter wall
  for (const r of [[-fo, -fo, L + fo, t + fo], [-fo, W - t - fo, L + fo, W + fo], [-fo, t + fo, t + fo, W - t - fo], [L - t - fo, t + fo, L + fo, W - t - fo]]) v.rect(r[0], r[1], r[2], r[3], 'newF');
  v.poly(loop(-fo, -fo, L + fo, W + fo), 'newH', false); v.poly(loop(t + fo, t + fo, L - t - fo, W - t - fo), 'newH', false);
  for (const r of [[0, 0, L, t], [0, W - t, L, W], [0, t, t, W - t], [L - t, t, L, W - t]]) v.rect(r[0], r[1], r[2], r[3], 'new');
  v.poly(loop(0, 0, L, W), 'o', false);
  if (G.yML != null) { v.line(t, G.yML, L - t, G.yML, 'exh'); v.text('MARRIAGE LINE', (G.ml.xs[0] + G.ml.xs[1]) / 2, G.yML + I(5), { cls: 'ts', anchor: 'middle' }); }
  for (const b of G.beams) v.rect(t, b.y - I(2), L - t, b.y + I(2), 'ex');
  // frame pads and piers
  for (const b of G.beams) for (const x of G.fr.xs) { const h = g.padFrame / 2; v.rect(x - h, b.y - h, x + h, b.y + h, 'new'); v.rect(x - g.pierT / 2, b.y - g.pierW / 2, x + g.pierT / 2, b.y + g.pierW / 2, 'newS'); }
  // marriage-line pads and piers
  if (G.yML != null) for (const x of G.ml.xs) { const h = G.padAt(x) / 2; v.rect(x - h, G.yML - h, x + h, G.yML + h, 'new'); v.rect(x - g.pierW / 2, G.yML - g.pierW / 2, x + g.pierW / 2, G.yML + g.pierW / 2, 'newS'); }
  // perimeter piers each side of the exterior doors, against the inside face of the wall
  for (const d of g.doorPiers || []) { const y0 = d.side === 'front' ? t : W - t - g.pierT, yc = y0 + g.pierT / 2; v.rect(d.x - I(8), yc - I(8), d.x + I(8), yc + I(8), 'new'); v.rect(d.x - g.pierW / 2, y0, d.x + g.pierW / 2, y0 + g.pierT, 'newS'); }
  v.text('FRONT', L / 2, -fo - I(12), { cls: 'ts', anchor: 'middle' }); v.text('HITCH END', L + fo + I(4), W / 2, { cls: 'ts', anchor: 'middle', rot: 90 });
  // diagonal frame ties to anchors on the inside face of the wall, both sides
  const bo = G.beams.filter(b => b.outer);
  for (const x of G.ti.xs) for (const [yb, ya] of [[bo[0].y, t], [bo[1].y, W - t]]) { v.line(x, yb, x, ya, 'anchOk'); v.circle(x, ya, I(2.6), 'newS'); }
  // end ties at each end of each I-beam
  for (const b of G.beams) for (const [xa, xb] of [[t, G.fr.xs[0] + I(14)], [L - t, G.fr.xs[G.fr.xs.length - 1] - I(14)]]) for (const dy of [-I(10), I(10)]) { v.line(xb, b.y + dy * 0.4, xa, b.y + dy, 'anchOk'); v.circle(xa, b.y + dy, I(2), 'newS'); }
  // dimensions
  const xs = G.fr.xs, top = W + fo;
  v.dimH(0, xs[0], top + I(24), top); v.dimH(xs[0], xs[1], top + I(24), top, { text: Q(G.fr.s) });
  v.dimH(xs[1], xs[xs.length - 1], top + I(24), top, { text: `${G.fr.n - 1} MORE EQUAL SPACES, ${FMT(g.pierSpacing)} MAX.` }); v.dimH(xs[xs.length - 1], L, top + I(24), top);
  v.dimH(0, L, top + I(50), top, { text: FMT(L) + ' HOME (V.I.F.)' });
  const ys = [0].concat(G.beams.map(b => b.y), [W]);
  for (let i = 0; i < ys.length - 1; i++) v.dimV(ys[i], ys[i + 1], -fo - I(22), -fo, { text: Q(ys[i + 1] - ys[i]) + (i % 2 ? ' V.I.F.' : '') });
  v.dimV(0, W, -fo - I(46), -fo, { text: FMT(W) + ' HOME (V.I.F.)' });
  // notes, on the right, top to bottom in the order of what they point at
  const bl = G.beams[G.beams.length - 1], xl = xs[xs.length - 1], mlx = G.ml.xs[G.ml.xs.length - 1], cx = G.cols[G.cols.length - 1], dr = (g.doorPiers || []).filter(d => d.side !== 'front').sort((a, b) => b.x - a.x)[0], df = (g.doorPiers || []).filter(d => d.side === 'front').sort((a, b) => b.x - a.x)[0];
  v.note(`(N) ${UP(g.wallName)} PERIMETER WALL ON\n${g.ftgB}" FOOTING. SEE ${REF.d2}/${REF.sheet}`, L, W - I(3), nx, W + I(12), { side: 'r', kind: 'N' });
  if (dr) v.note(wrap(UP(g.doorPierNote), 30), dr.x + g.pierW / 2, W - t - g.pierT / 2, nx, W - I(30), { side: 'r', kind: 'N' });
  v.note(`(N) FRAME PIER ON ${g.padFrame}" PAD, TYP.\nALL I-BEAMS. SEE ${REF.d1}/${REF.sheet}`, xl + g.padFrame / 2, bl.y - I(3), nx, W - I(82), { side: 'r', kind: 'N' });
  if (G.yML != null) v.note(`(N) MARRIAGE-LINE PIER, ${g.padML}" PAD\n@ ${FMT(g.mlSpacing)} MAX. SEE ${REF.d3}/${REF.sheet}`, mlx + g.padML / 2, G.yML + I(4), nx, W - I(122), { side: 'r', kind: 'N' });
  if (G.yML != null && cx != null) v.note(wrap(UP(g.columnNote), 30), cx + g.padCol / 2, G.yML - I(4), nx, W - I(162), { side: 'r', kind: 'N' });
  v.note(`(N) END TIES, ${g.endTies} PER I-BEAM END\nSEE ${REF.d4}/${REF.sheet}`, L - t, G.beams[1].y + I(10), nx, W - I(214), { side: 'r', kind: 'N' });
  v.note(`(N) FRAME TIES @ ${FMT(g.anchorSpacing)} MAX.\nEACH SIDE, FIRST ≤ 2'-0" FROM\nEACH END. SEE ${REF.d2}/${REF.sheet}`, G.ti.xs[G.ti.xs.length - 1], bo[0].y * 0.6, nx, I(56), { side: 'r', kind: 'N' });
  v.note('(N) STRAP ANCHOR, INSIDE FACE\nOF WALL. SEE ' + GN(P, 'A1'), G.ti.xs[G.ti.xs.length - 1], t, nx, I(8), { side: 'r', kind: 'N' });
  // column stations, dimensioned from the hitch end
  if (G.yML != null) for (const x of G.cols) { const prev = Math.max(...G.ml.xs.filter(q => q < x - 1)); v.text(`COL. ${Q(L - x)}\nFROM HITCH`, (x + prev) / 2, G.yML + I(5), { cls: 'ts', anchor: 'middle', size: 8 }); }
  // section cut
  const sx = (xs[2] + xs[3]) / 2, ty = top + I(56);
  v.line(sx, -fo - I(14), sx, top + I(14), 'cutl'); v.line(sx, ty, sx, ty + I(16), 'cutl2'); v.line(sx, ty + I(16), sx + I(22), ty + I(16), 'cutl2'); v.arrow(sx + I(22), ty + I(16), sx, ty + I(16));
  v.bubble(sx - I(26), ty + I(8), String(REF.section), REF.sheet);
  return v.svg();
}

// ------------------------------------------------------------------ 2  SECTION ACROSS THE HOME
function fdSection(P, G, den) {
  const g = P.geometry, v = new View(den, 'sect'), W = G.W, t = g.wallT, nx = W + G.fo + I(12), zw = G.zFloorTop + I(30);
  soil(v, -G.fo - I(14), W + G.fo + I(8), G.zPadBot - I(7));
  const wl = wallSect(v, g, G, 0, 1), wr = wallSect(v, g, G, W, -1);
  v.line(t, I(0.8), W - t, I(0.8), 'newH');                                                                 // ground cover
  for (const b of G.beams) { pad(v, g, b.y, g.padFrame, G.zPadBot, false); cmuPier(v, g, b.y, g.pierW, G.zPadTop, G.zPierTop); iBeam(v, b.y, G.zPierTop, G.zFloorBot); }
  if (G.yML != null) { pad(v, g, G.yML, g.padML, G.zPadBot, false); cmuPier(v, g, G.yML, g.pierW, G.zPadTop, G.zFloorBot, { double: true, shimW: g.pierW - I(1.5) }); }
  for (let k = 0; k < g.nSec; k++) { const x0 = k * g.Ws, x1 = x0 + g.Ws;                                   // the home: floor and wall stubs
    floorBand(v, x0, x1, G.zFloorBot, G.zFloorTop);
    for (const x of [x0, x1 - I(5)]) { v.rect(x, G.zFloorTop, x + I(5), zw, 'ex'); breakH(v, x, x + I(5), zw); } }
  const bo = G.beams.filter(b => b.outer);
  for (const [xb, w, k] of [[bo[0].y, wl, 1], [bo[1].y, wr, -1]]) { strap(v, xb - k * I(2.2), G.zFloorBot - I(0.6), w.xi + k * I(1.3), G.zAnch); anchorAt(v, w.xi, G.zAnch, k); v.rect(xb - I(3.4), G.zFloorBot - I(1.6), xb + I(3.4), G.zFloorBot, 'steel'); }
  // dimensions
  const ys = [0].concat(G.beams.map(b => b.y), [W]), xm = (G.beams[0].y + G.beams[1].y) / 2, xm2 = (G.beams[2].y + G.beams[3].y) / 2;
  for (let i = 0; i < ys.length - 1; i++) v.dimH(ys[i], ys[i + 1], G.zPadBot - I(20), G.zPadBot - I(7), { text: Q(ys[i + 1] - ys[i]) + (i % 2 ? ' V.I.F.' : '') });
  v.dimV(G.zPadBot, 0, xm, xm - I(18), { text: FMT(g.embed) + ' MIN.' }); v.dimV(0, G.zPierTop, xm2, xm2 - I(18), { text: g.clearText });
  v.text('FINISHED GRADE', xm + I(10), I(5), { cls: 'ts' });
  // notes
  const bl = G.beams[G.beams.length - 1];
  v.note('MANUFACTURED HOME\n(BY MANUFACTURER)', W - I(30), G.zFloorTop, nx, G.zFloorTop + I(26), { side: 'r' });
  v.note(`(N) DIAGONAL FRAME TIE\n${g.strapAngle}°. SEE ${REF.d2}/${REF.sheet}`, (bl.y + W) / 2 - I(2), (G.zFloorBot + G.zAnch) / 2 + I(2), nx, G.zFloorBot - I(1), { side: 'r', kind: 'N' });
  v.note(`(N) ${UP(g.wallName)} PERIMETER\nWALL, ANCHORS ${g.anchorH}" ABOVE\nGRADE. SEE ${REF.d2}/${REF.sheet}`, W, I(12), nx, I(4), { side: 'r', kind: 'N' });
  v.note(`(N) FOOTING ${g.ftgB}" × ${g.ftgH}"`, W + G.fo, G.zPadBot + g.ftgH / 2, nx, G.zPadBot - I(8), { side: 'r', kind: 'N' });
  v.note(`(N) CMU PIER ON PAD\nSEE ${REF.d1}/${REF.sheet}`, G.beams[0].y - g.pierW / 2, G.zPadTop + g.pierH * 0.35, I(46), G.zFloorTop + I(46), { side: 'r', kind: 'N' });
  if (G.yML != null) v.note(`(N) MARRIAGE-LINE PIER\nSEE ${REF.d3}/${REF.sheet}`, G.yML + g.pierW / 2, G.zPadTop + g.pierH * 0.6, G.yML + I(36), G.zFloorTop + I(46), { side: 'r', kind: 'N' });
  v.note('(N) GROUND COVER', G.yML + I(22), I(0.8), G.yML + I(30), -I(34), { side: 'r', kind: 'N' });
  v.note('SHIMS TO LEVEL, TYP.', G.beams[2].y + I(3), G.zPierTop - I(1), G.beams[2].y + I(40), G.zFloorTop + I(26), { side: 'r', kind: 'N' });
  return v.svg();
}

// ------------------------------------------------------------------ 3  SECTION ALONG AN I-BEAM (side view, under the picture)
function fdAlong(P, G, den) {
  const g = P.geometry, v = new View(den, 'along'), L = g.L, xs = G.fr.xs;
  soil(v, -G.fo - I(20), L + G.fo + I(20), G.zPadBot - I(8));
  const wl = wallSect(v, g, G, 0, 1), wr = wallSect(v, g, G, L, -1);
  for (const x of xs) { v.rect(x - g.padFrame / 2, G.zPadBot, x + g.padFrame / 2, G.zPadTop, 'new', { fill: v.pat('conc') }); v.rect(x - g.pierT / 2, G.zPadTop, x + g.pierT / 2, G.zPierTop, 'newS'); }
  v.rect(g.wallT + I(2), G.zPierTop, L - g.wallT - I(2), G.zFloorBot, 'steel'); floorBand(v, 0, L, G.zFloorBot, G.zFloorTop);
  for (const [w, k] of [[wl, 1], [wr, -1]]) { const run = (G.zPierTop - G.zAnch) / Math.tan(g.endTieAngle * Math.PI / 180); v.line(w.xi, G.zAnch, w.xi + k * run, G.zPierTop, 'anchOk'); v.circle(w.xi, G.zAnch, I(2.6), 'newS'); }
  v.dimH(0, xs[0], G.zPadBot - I(30), G.zPadBot - I(8)); v.dimH(xs[0], xs[xs.length - 1], G.zPadBot - I(30), G.zPadBot - I(8), { text: `${G.fr.n} EQUAL SPACES OF ${Q(G.fr.s)} (${FMT(g.pierSpacing)} MAX.)` }); v.dimH(xs[xs.length - 1], L, G.zPadBot - I(30), G.zPadBot - I(8));
  const up = G.zFloorTop + I(52);
  v.note(`(N) END TIES, ${g.endTies} PER I-BEAM END\nSEE ${REF.d4}/${REF.sheet}`, wl.xi + I(4), G.zAnch + I(3), I(60), up, { side: 'r', kind: 'N' });
  v.note(`(N) PIERS UNDER EACH I-BEAM\nSEE ${REF.d1}/${REF.sheet}`, xs[Math.floor(xs.length / 2)] + g.pierT / 2, G.zPadTop + g.pierH / 2, xs[Math.floor(xs.length / 2)] + I(40), up, { side: 'r', kind: 'N' });
  v.note('SHIMS TO LEVEL, TYP.', xs[xs.length - 2], G.zPierTop - I(1), xs[xs.length - 2] - I(70), G.zPadBot - I(60), { side: 'r', kind: 'N' });
  return v.svg();
}

// ------------------------------------------------------------------ 4  FRAME PIER ON PAD
function detailPier(P, G, den) {
  const g = P.geometry, v = new View(den, 'pier'), pw = g.padFrame, x0 = -pw / 2 - I(24), x1 = pw / 2 + I(12);
  soil(v, x0, x1, G.zPadBot - I(6));
  pad(v, g, 0, pw, G.zPadBot, true); cmuPier(v, g, 0, g.pierW, G.zPadTop, G.zPierTop, { cells: true }); iBeam(v, 0, G.zPierTop, G.zFloorBot);
  v.rect(-I(24), G.zFloorBot, I(22), G.zFloorTop, 'exw', { fill: v.pat('wall') }); breakV(v, -I(24), G.zFloorBot, G.zFloorTop); breakV(v, I(22), G.zFloorBot, G.zFloorTop);
  v.dimH(-pw / 2, pw / 2, G.zPadBot - I(13), G.zPadBot - I(6)); v.dimV(G.zPadBot, 0, -pw / 2 - I(8), -pw / 2, { text: FMT(g.embed) + ' MIN.' });
  v.dimV(G.zPadBot, G.zPadTop, -pw / 2 - I(18), -pw / 2); v.dimV(G.zPadTop, G.zPierTop, pw / 2 + I(7), g.pierW / 2, { text: FMT(g.pierH) });
  v.dimV(0, G.zPierTop, -g.pierW / 2 - I(8), -g.pierW / 2, { text: g.clearText });
  const nx = x1 + I(4);
  v.note('FLOOR JOISTS AND DECK (HOME)', I(14), G.zFloorTop - I(3), nx, G.zFloorTop + I(2), { side: 'r' });
  v.note('FRAME I-BEAM (HOME)', I(2.2), G.zPierTop + I(6), nx, G.zPierTop + I(13), { side: 'r' });
  v.note(wrap(UP(g.capNote), 28), g.pierW / 2, G.zPierTop - I(4), nx, G.zPierTop + I(7), { side: 'r', kind: 'N' });
  v.note('SHIMS\nTO LEVEL', -I(3.2), G.zPierTop - I(1), x0 + I(13), G.zPierTop + I(9), { side: 'l', kind: 'N' });
  v.note(wrap(UP('(N) ' + g.pierName + '. ' + g.pierNote), 28), g.pierW / 2, G.zPadTop + I(8), nx, G.zPadTop + I(11), { side: 'r', kind: 'N' });
  v.note(`(N) CONCRETE PAD ${pw}" × ${pw}" × ${g.padT}"\n${wrap(UP(g.padBars), 26)}\n${UP(g.padNote)}`, pw / 2, G.zPadBot + g.padT / 2, nx, G.zPadBot - I(3), { side: 'r', kind: 'N' });
  v.text(UP(g.gradeNote), x0 + I(1), I(11), { cls: 'ts' });
  return v.svg();
}

// ------------------------------------------------------------------ 5  FRAME TIE AND PERIMETER WALL
function detailTie(P, G, den) {
  const g = P.geometry, v = new View(den, 'tie'), xb = G.e, top = G.zFloorTop + I(16), x0 = -G.fo - I(16), x1 = xb + I(24);
  soil(v, x0, x1, G.zPadBot - I(6));
  const w = wallSect(v, g, G, 0, 1, true);
  v.line(w.xi, I(0.8), x1, I(0.8), 'newH');                                                                 // ground cover
  pad(v, g, xb, g.padFrame, G.zPadBot, false); cmuPier(v, g, xb, g.pierW, G.zPadTop, G.zPierTop); iBeam(v, xb, G.zPierTop, G.zFloorBot);
  v.rect(0, G.zFloorBot, x1, G.zFloorTop, 'exw', { fill: v.pat('wall') }); breakV(v, x1, G.zFloorBot, G.zFloorTop);
  v.rect(0, G.zFloorTop, I(5), top, 'ex'); breakH(v, 0, I(5), top);                                         // sidewall, outer face flush with the wall
  strap(v, xb - I(2.2), G.zFloorBot - I(0.6), w.xi + I(1.3), G.zAnch); anchorAt(v, w.xi, G.zAnch, 1); v.rect(xb - I(3.6), G.zFloorBot - I(1.8), xb + I(1), G.zFloorBot, 'steel');
  v.arc(w.xi + I(1.3), G.zAnch, I(8), 0, g.strapAngle, 'dm'); v.text(g.strapAngle + '°', w.xi + I(10.5), G.zAnch + I(1.6), { cls: 'td' });
  v.dimH(w.xc - g.ftgB / 2, w.xc + g.ftgB / 2, G.zPadBot - I(13), G.zPadBot - I(6)); v.dimV(0, G.zAnch, -I(9), 0, { text: FMT(g.anchorH) });
  const nx = x1, lx = x0 - I(1);
  v.note(wrap(UP(g.gapNote), 22), g.wallT / 2, G.zWallTop + I(0.5), lx, G.zFloorTop + I(18), { side: 'l', kind: 'N' });
  v.note(wrap(UP('(N) ' + g.wallName + ' perimeter wall. ' + g.wallNote), 22), 0, I(15), lx, G.zFloorBot + I(9), { side: 'l', kind: 'N' });
  v.note(wrap(UP(g.anchorNote), 22), w.xi - I(2), G.zAnch, lx, I(1), { side: 'l', kind: 'N' });
  v.note(wrap(UP(`(N) Footing ${g.ftgB}" × ${g.ftgH}". ` + g.ftgNote), 22), w.xc - g.ftgB / 2, G.zPadBot + I(5), lx, G.zPadBot - I(6), { side: 'l', kind: 'N' });
  v.note('SIDEWALL AND FLOOR (HOME)', I(5), G.zFloorTop + I(8), nx, G.zFloorTop + I(14), { side: 'r' });
  v.note(wrap(UP(g.clampNote), 24), xb - I(2), G.zFloorBot - I(1), nx, G.zFloorBot + I(13), { side: 'r', kind: 'N' });
  v.note(wrap(UP(g.strapSpec + '. ' + g.strapNote), 24), w.xi + (xb - w.xi) * 0.62, G.zAnch + (G.zFloorBot - G.zAnch) * 0.62, nx, G.zPierTop - I(9), { side: 'r', kind: 'N' });
  v.note('PIER AND PAD NOT PART\nOF THE TIE PATH', xb + g.pierW / 2, G.zPadTop + I(4), nx, G.zPadBot - I(22), { side: 'r' });
  v.note('SHIMS TO LEVEL', xb + I(3.2), G.zPierTop - I(1), nx, G.zPadBot - I(8), { side: 'r', kind: 'N' });
  return v.svg();
}

// ------------------------------------------------------------------ 6  MARRIAGE-LINE PIER
function detailMarriage(P, G, den) {
  const g = P.geometry, v = new View(den, 'ml'), pw = g.padML, top = G.zFloorTop + I(7), x0 = -pw / 2 - I(20), x1 = pw / 2 + I(16);
  soil(v, x0, x1, G.zPadBot - I(6));
  pad(v, g, 0, pw, G.zPadBot, true); cmuPier(v, g, 0, g.pierW, G.zPadTop, G.zFloorBot, { double: true, interlock: true, shimW: g.pierW - I(1.5) });
  v.rect(-I(26), G.zFloorBot, -I(0.4), G.zFloorTop, 'exw', { fill: v.pat('wall') }); v.rect(I(0.4), G.zFloorBot, I(26), G.zFloorTop, 'exw', { fill: v.pat('wall') });
  breakV(v, -I(26), G.zFloorBot, G.zFloorTop); breakV(v, I(26), G.zFloorBot, G.zFloorTop);
  v.rect(-I(5), G.zFloorTop, -I(0.4), top, 'ex'); v.rect(I(0.4), G.zFloorTop, I(5), top, 'ex'); breakH(v, -I(5), I(5), top);
  v.line(0, G.zPadBot - I(4), 0, top + I(3), 'cutl');
  v.dimH(-pw / 2, pw / 2, G.zPadBot - I(13), G.zPadBot - I(6)); v.dimV(G.zPadBot, 0, -pw / 2 - I(8), -pw / 2, { text: FMT(g.embed) + ' MIN.' });
  const nx = x1 + I(4);
  v.note('MARRIAGE LINE', 0, top + I(1), nx, top, { side: 'r' });
  v.note('RIM JOISTS OF BOTH SECTIONS\nBEAR ON THE PIER (HOME)', I(8), G.zFloorBot + I(4), nx, G.zFloorBot + I(8), { side: 'r' });
  v.note('SHIMS TO LEVEL', g.pierW / 2 - I(1.5), G.zFloorBot - I(1), nx, G.zFloorBot - I(3), { side: 'r', kind: 'N' });
  v.note(wrap(UP('(N) ' + g.pierMLName + ' @ ' + FMT(g.mlSpacing) + ' max. ' + g.pierMLNote), 34), g.pierW / 2, G.zPadTop + I(18), nx, G.zPadTop + I(22), { side: 'r', kind: 'N' });
  v.note(`(N) CONCRETE PAD ${pw}" × ${pw}" × ${g.padT}"\n${wrap(UP(g.padBars), 30)}`, pw / 2, G.zPadBot + g.padT / 2, nx, G.zPadBot + I(8), { side: 'r', kind: 'N' });
  v.note(wrap(UP(g.columnDetailNote), 34), pw / 2 - I(2), G.zPadBot + I(1.5), nx, G.zPadBot - I(4), { side: 'r', kind: 'N' });
  return v.svg();
}

// ------------------------------------------------------------------ 7  END TIE AT THE FRAME END
function detailEndTie(P, G, den) {
  const g = P.geometry, v = new View(den, 'endtie'), xp = g.endDist, x1 = xp + I(44), x0 = -G.fo - I(10), top = G.zFloorTop + I(14);
  soil(v, x0, x1, G.zPadBot - I(6));
  const w = wallSect(v, g, G, 0, 1, true);
  v.rect(xp - g.padFrame / 2, G.zPadBot, xp + g.padFrame / 2, G.zPadTop, 'new', { fill: v.pat('conc') }); cmuPier(v, g, xp, g.pierT, G.zPadTop, G.zPierTop);
  v.rect(w.xi + I(2), G.zPierTop, x1, G.zFloorBot, 'steelo'); v.line(w.xi + I(2), G.zPierTop + I(0.6), x1, G.zPierTop + I(0.6), 'o2'); v.line(w.xi + I(2), G.zFloorBot - I(0.6), x1, G.zFloorBot - I(0.6), 'o2'); breakV(v, x1, G.zPierTop, G.zFloorBot);
  v.rect(0, G.zFloorBot, x1, G.zFloorTop, 'exw', { fill: v.pat('wall') }); breakV(v, x1, G.zFloorBot, G.zFloorTop);
  v.rect(0, G.zFloorTop, I(5), top, 'ex'); breakH(v, 0, I(5), top);
  const ax = w.xi + I(1.3), run = (G.zPierTop - G.zAnch) / Math.tan(g.endTieAngle * Math.PI / 180), cx = ax + run;
  v.line(cx, G.zPierTop, ax, G.zAnch, 'anchOk'); anchorAt(v, w.xi, G.zAnch, 1); v.rect(cx - I(1.5), G.zPierTop - I(0.4), cx + I(2.5), G.zPierTop + I(1.6), 'steel');
  v.dimH(0, xp, G.zPadBot - I(13), G.zPadBot - I(6), { text: '≤ ' + FMT(g.endDist) }); v.dimV(G.zPadBot, 0, x0 + I(2), w.xc - g.ftgB / 2, { text: FMT(g.embed) + ' MIN.' });
  const nx = x1 + I(2);
  v.note('END WALL AND FLOOR (HOME)', I(5), G.zFloorTop + I(7), nx, G.zFloorTop + I(9), { side: 'r' });
  v.note('FRAME I-BEAM, SIDE VIEW (HOME)', x1 - I(8), G.zPierTop + I(5), nx, G.zPierTop + I(5), { side: 'r' });
  v.note('SHIMS\nTO LEVEL', xp - I(1), G.zPierTop - I(1), x0 - I(1), G.zFloorBot + I(4), { side: 'l', kind: 'N' });
  v.note(wrap(UP(g.endTieNote), 28), cx - I(1), G.zPierTop - I(1), nx, G.zPierTop - I(4), { side: 'r', kind: 'N' });
  v.note(wrap(UP(g.endAnchorNote), 28), w.xi + I(1), G.zAnch - I(1.5), nx, G.zPadBot - I(13), { side: 'r', kind: 'N' });
  v.note(wrap(UP(g.endTieClear), 28), xp + g.pierT / 2, G.zPadTop + I(8), nx, G.zPadBot - I(32), { side: 'r' });
  return v.svg();
}

// ------------------------------------------------------------------ isometric
// mode per group: 'new' (blue), 'done' (grey), 0 (hidden). home: share of the floor shown, 0 to 1.
function fdIso(P, G, o = {}) {
  const g = P.geometry, iso = new Iso(o.den || 124, o.id || 'iso'), m = Object.assign({ foot: 'new', piers: 'new', wall: 'new', home: 0.42, ties: 'new' }, o.mode || {});
  const L = g.L, W = G.W, t = g.wallT, fo = G.fo, pad = I(30), zb = G.zPadBot, C = k => (k === 'new' ? PAL.newSolid : PAL.existSolid), F = k => (k === 'new' ? shade(PAL.newSolid, 0.45) : PAL.slab), capC = k => (k === 'new' ? shade(PAL.newSolid, -0.25) : shade(PAL.existSolid, -0.15));
  iso.solid(-pad, L + pad, -pad, W + pad, zb - I(4), zb, o.quiet ? '#eceee9' : '#e7e3d8', { order: 0, stroke: '#b9b29f' });
  if (m.foot) {
    iso.solid(-fo, L + fo, -fo, t + fo, zb, G.zFtgTop, F(m.foot), { order: 1 }); iso.solid(-fo, t + fo, t + fo, W - t - fo, zb, G.zFtgTop, F(m.foot), { order: 1 });
    iso.solid(L - t - fo, L + fo, t + fo, W - t - fo, zb, G.zFtgTop, F(m.foot), { order: 1 }); iso.solid(-fo, L + fo, W - t - fo, W + fo, zb, G.zFtgTop, F(m.foot), { order: 1.5 });
    for (const b of G.beams) for (const x of G.fr.xs) { const h = g.padFrame / 2; iso.solid(x - h, x + h, b.y - h, b.y + h, zb, G.zPadTop, F(m.foot), { order: 1.2 }); }
    if (G.yML != null) for (const x of G.ml.xs) { const h = G.padAt(x) / 2; iso.solid(x - h, x + h, G.yML - h, G.yML + h, zb, G.zPadTop, F(m.foot), { order: 1.2 }); }
  }
  if (m.wall) {   // far walls full height; near walls shown to the anchor course so the piers stay visible
    iso.solid(0, L, 0, t, G.zFtgTop, G.zWallTop, C(m.wall), { order: 1.6 }); iso.solid(0, t, t, W - t, G.zFtgTop, G.zWallTop, C(m.wall), { order: 1.6 });
    iso.solid(L - t, L, t, W - t, G.zFtgTop, G.zAnch, C(m.wall), { order: 5 }); iso.solid(0, L, W - t, W, G.zFtgTop, G.zAnch, C(m.wall), { order: 5.1 });
  }
  if (m.piers) {
    const pier = (x0, x1, y0, y1, zt) => { iso.solid(x0, x1, y0, y1, G.zPadTop, zt - I(6), C(m.piers), { order: 2 }); iso.solid(x0, x1, y0, y1, zt - I(6), zt, capC(m.piers), { order: 2.05 }); };
    for (const b of G.beams) for (const x of G.fr.xs) pier(x - g.pierT / 2, x + g.pierT / 2, b.y - g.pierW / 2, b.y + g.pierW / 2, G.zPierTop);
    if (G.yML != null) for (const x of G.ml.xs) pier(x - g.pierW / 2, x + g.pierW / 2, G.yML - g.pierW / 2, G.yML + g.pierW / 2, G.zFloorBot);
  }
  if (m.home) {
    for (const b of G.beams) iso.solid(t, L - t, b.y - I(2.5), b.y + I(2.5), G.zPierTop, G.zFloorBot, shade(PAL.steel, 0.35), { order: 3 });
    for (let k = 0; k < g.nSec; k++) iso.solid(0, L * m.home, k * g.Ws, (k + 1) * g.Ws, G.zFloorBot, G.zFloorTop, shade(PAL.existSolid, 0.3), { order: 4 + k * 0.1 });
  }
  if (m.ties && m.home) {
    const bo = G.beams.filter(b => b.outer);
    for (const x of G.ti.xs) if (x > L * m.home + I(6)) { iso.line3([x, bo[0].y, G.zFloorBot], [x, t, G.zAnch], 'anchOk'); iso.line3([x, bo[1].y, G.zFloorBot], [x, W - t, G.zAnch], 'anchOk'); }
    for (const b of G.beams) iso.line3([L - t - I(12), b.y, G.zPierTop], [L - t, b.y, G.zAnch], 'anchOk');
  }
  return iso;
}

const FD_STEPS = {
  footings: { foot: 'new', piers: 0, wall: 0, home: 0, ties: 0 },
  piers:    { foot: 'done', piers: 'new', wall: 'new', home: 0, ties: 0 },
  home:     { foot: 'done', piers: 'done', wall: 'done', home: 1, ties: 0 },
  ties:     { foot: 'done', piers: 'done', wall: 'done', home: 0.42, ties: 'new' },
  all:      {},
};
const fdSceneW = (P, G) => (P.geometry.L + G.W) / UPI * 0.866 + 60 * 0.866;


// ====================================================================== SITE PLAN (sheet C1.0)
// Geometry is in decimal feet (P.site), origin at the front-left lot corner, x along the frontage toward the driveway side,
// y toward the rear along the side lot lines. The kit's model unit is the inch, so everything goes through K = 12.
const K = 12;
SCALE_LABEL[360] = '1" = 30\''; SCALE_LABEL[180] = '1" = 15\'';
const ftin0 = v => { const t = Math.round(v * 12), f = Math.floor(t / 12), i = t - f * 12; return f + "'-" + i + '"'; };

function siteDerive(P) {
  const s = P.site, arc = s.arc, b = s.boundary;
  const interp = (pts, x) => { for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; if (x >= p[0] && x <= q[0]) return p[1] + (q[1] - p[1]) * (x - p[0]) / ((q[0] - p[0]) || 1); } return x < pts[0][0] ? pts[0][1] : pts[pts.length - 1][1]; };
  const arcY = x => interp(arc, x), rearY = x => interp([b[1], b[2]], x);
  const slopeDeg = (pts, x) => { for (let i = 0; i < pts.length - 1; i++) { const p = pts[i], q = pts[i + 1]; if (x >= p[0] && x <= q[0]) return Math.atan2(q[1] - p[1], (q[0] - p[0]) || 1e-9) * 180 / Math.PI; } return 0; };
  const lot = arc.concat([b[2], b[1]]);                                         // closed lot outline: frontage arc, driveway side, rear, far side
  const drive = [[s.drive.x0, s.drive.yTop], [s.drive.x1, s.drive.yTop], [s.drive.x1, arcY(s.drive.x1)], [s.drive.x0, arcY(s.drive.x0)]];
  const X1 = Math.max(...b.map(p => p[0])), Y1 = Math.max(...b.map(p => p[1])), Y0 = Math.min(...arc.map(p => p[1]));
  return { s, arcY, rearY, slopeDeg, lot, drive, X1, Y1, Y0 };
}
// a View that takes feet
function FV(v) {
  const X = x => x * K, P2 = pts => pts.map(p => [p[0] * K, p[1] * K]);
  return { v,
    line: (a, b, c, d, cls) => v.line(X(a), X(b), X(c), X(d), cls), rect: (a, b, c, d, cls, o) => v.rect(X(a), X(b), X(c), X(d), cls, o),
    poly: (pts, cls, close, o) => v.poly(P2(pts), cls, close, o), circle: (x, y, r, cls) => v.circle(X(x), X(y), X(r), cls),
    text: (t, x, y, o) => v.text(t, X(x), X(y), o), note: (t, tx, ty, ex, ey, o) => v.note(t, X(tx), X(ty), X(ex), X(ey), o),
    dimH: (x1, x2, y, yo, o) => v.dimH(X(x1), X(x2), X(y), X(yo), o), dimV: (y1, y2, x, xo, o) => v.dimV(X(y1), X(y2), X(x), X(xo), o),
    // a line with its own weight (points), colour and dash (points)
    raw(pts, st, close) { const q = P2(pts); for (const p of q) v.ext(p[0], p[1]);
      v.out.push(`<${close ? 'polygon' : 'polyline'} points="${q.map(p => r3(p[0]) + ',' + r3(-p[1])).join(' ')}" style="fill:${st.fill || 'none'};stroke:${st.color || PAL.ink};stroke-width:${r3(v.pt(st.w || 0.7))};${st.dash ? 'stroke-dasharray:' + st.dash.map(d => r3(v.pt(d))).join(' ') + ';' : ''}stroke-linejoin:round"/>`); } };
}
const LINE = { prop: { w: 1.5, dash: [16, 3.5, 3.5, 3.5] }, water: { color: PAL.new, w: 1.1, dash: [8, 3.5] }, sewer: { color: PAL.new, w: 1.1, dash: [2.2, 3] }, elec: { color: PAL.new, w: 1.1, dash: [8, 2.5, 1.5, 2.5] } };

function northArrow(f, x, y, n, len) { const a = [x - n[0] * len / 2, y - n[1] * len / 2], b = [x + n[0] * len / 2, y + n[1] * len / 2];
  f.raw([a, b], { w: 1.2 }); f.v.arrow(b[0] * K, b[1] * K, a[0] * K, a[1] * K); f.text('N', b[0] + n[0] * len * 0.22, b[1] + n[1] * len * 0.22 - len * 0.06, { cls: 'tb', anchor: 'middle' }); }
function scaleBarFt(f, x, y, seg, n) { for (let i = 0; i < n; i++) f.rect(x + i * seg, y, x + (i + 1) * seg, y + seg * 0.07, i % 2 ? 'steelo' : 'steel');
  for (let i = 0; i <= n; i++) f.text(i * seg + (i === n ? ' FT' : ''), x + i * seg, y - seg * 0.16, { cls: 'ts', anchor: 'middle', size: 8 }); }

// the proposed work, shared by the site plan and the enlarged plan. big = enlarged plan (more linework)
function siteWork(f, G, big, yMin) {
  const s = G.s, h = s.home, cl = ln => (yMin == null ? ln : ln.filter((p, i) => p[1] >= yMin || (ln[i + 1] && ln[i + 1][1] >= yMin)).map(p => [p[0], Math.max(p[1], yMin)]));
  f.poly(G.drive, 'newF'); f.raw(G.drive.concat([G.drive[0]]), { color: PAL.new, w: 0.9, dash: [5, 2.5] });
  f.rect(h[0], h[1], h[2], h[3], 'new');
  for (const d of s.decks) { f.rect(d.deck[0], d.deck[1], d.deck[2], d.deck[3], 'new'); f.rect(d.stair[0], d.stair[1], d.stair[2], d.stair[3], 'new'); f.rect(d.pad[0], d.pad[1], d.pad[2], d.pad[3], 'newH');
    if (big) { const n = 5, y0 = d.stair[1], y1 = d.stair[3]; for (let k = 1; k < n; k++) f.line(d.stair[0], y0 + (y1 - y0) * k / n, d.stair[2], y0 + (y1 - y0) * k / n, 'new'); } }
  f.rect(s.hvac[0], s.hvac[1], s.hvac[2], s.hvac[3], 'new');
  f.raw(cl(s.water), LINE.water); f.raw(cl(s.sewer), LINE.sewer); f.raw(cl(s.electric), LINE.elec);
  const r = 1.3; if (!big) { f.circle(s.water[0][0], s.water[0][1], r, 'steelo'); f.rect(s.sewer[0][0] - r, s.sewer[0][1] - r, s.sewer[0][0] + r, s.sewer[0][1] + r, 'steelo'); }
  f.rect(s.md[0] - 1.25, s.md[1] - 1.25, s.md[0] + 1.25, s.md[1] + 1.25, 'steelo');
}

// ------------------------------------------------------------------ 1  SITE PLAN
function sitePlan(P, G, den) {
  // Positions come from the lot (G.X1, G.Y1, the frontage arc and the rear line) and from the home (h), so the plan
  // lays out for any lot of about this size. Notes to the right are for the home and the paving, to the left the services.
  const s = G.s, v = new View(den, 'site'), f = FV(v), b = s.boundary, h = s.home, X1 = G.X1, nx = X1 + 14, lx = -16, po = s.pavementOffset || [-5.6, -12.2];
  const hx = (h[0] + h[2]) / 2, ry = x => G.rearY(x);
  f.raw(G.lot, LINE.prop, true);
  f.raw(s.arc.map(p => [p[0] + po[0], p[1] + po[1]]), { color: PAL.exist, w: 0.7 });                    // edge of pavement, schematic offset of the frontage
  const xs = X1 * 0.42, xf = X1 * 0.58;
  f.text(UP(s.street), xs, G.arcY(xs) - 32, { cls: 'tb', anchor: 'middle', rot: G.slopeDeg(s.arc, xs) - 2 });
  if (s.frontageNote) f.text(UP(s.frontageNote), xf, G.arcY(xf) - 25.3, { cls: 'ts', anchor: 'middle', rot: G.slopeDeg(s.arc, xf) - 2, size: 8 });
  if (s.sideA) f.text(UP(s.sideA.label), -3.5, h[3] + 0.34 * (b[1][1] - h[3]), { cls: 'ts', anchor: 'middle', rot: 90 });
  if (s.sideB) f.text(UP(s.sideB.label), X1 - 4.4, h[3] + 0.5 * (b[2][1] - h[3]), { cls: 'ts', anchor: 'middle', rot: 90, size: 8 });
  if (s.rear) f.text(UP(s.rear.label), X1 / 2, ry(X1 / 2) + 3.8, { cls: 'ts', anchor: 'middle', rot: G.slopeDeg([b[1], b[2]], X1 / 2) });
  if (s.woodland) f.text(UP(s.woodland), X1 * 0.4, ry(X1 * 0.4) - 30, { cls: 'ts', anchor: 'middle' });
  if (s.easement) f.raw([[X1 - 1.4, h[1] - 3.4], [X1 - 1.4, ry(X1) - 11]], { color: PAL.exist, w: 0.7, dash: [3, 3] });   // easement side, schematic
  siteWork(f, G, false);
  f.text('(N) HOME', hx, (h[1] + h[3]) / 2 + 2.5, { cls: 'tN', anchor: 'middle', size: 9 }); f.text(UP(s.homeSize), hx, (h[1] + h[3]) / 2 - 5.5, { cls: 'ts', anchor: 'middle', size: 8 });
  // placement dimensions
  f.dimH(0, h[0], h[3] + 10, h[3], { text: ftin0(h[0]) }); f.dimH(h[2], b[3][0], h[3] + 10, h[3], { text: ftin0(b[3][0] - h[2]) });
  const fa = s.frontSetback; f.raw([fa.from, fa.to], { w: 0.6 }); f.text(UP(fa.label), fa.from[0] - 1.5, (fa.from[1] + fa.to[1]) / 2 - 3, { cls: 'td', anchor: 'end' });
  const yr = h[3] + 0.35 * (ry(hx) - h[3]);
  f.text('REAR YARD ' + UP(s.rearClear.label), hx - 3, yr, { cls: 'td', anchor: 'middle' }); f.text('(NEAREST CORNER OF THE HOME)', hx - 3, yr - 6, { cls: 'ts', anchor: 'middle', size: 8 });
  northArrow(f, -34, b[1][1] - 22, s.north, 26); scaleBarFt(f, nx, -10, 30, 3);
  // notes: right side for the home and paving, left side for the services
  f.note(`(N) MANUFACTURED HOME\n${UP(s.homeSize)}. SEE ${REF.section}/${REF.sheet}`, h[2], h[3] - 4, nx, h[3] + 10.3, { side: 'r', kind: 'N' });
  f.note('(N) OUTDOOR HVAC PAD\n4\' × 4\', AT REAR', s.hvac[2], s.hvac[3] - 1, nx, h[3] + 28.3, { side: 'r', kind: 'N' });
  f.note(`(N) ASPHALT DRIVEWAY\n${UP(s.drive.label)}`, s.drive.x1, h[1] + 6.6, nx, h[3] - 9.7, { side: 'r', kind: 'N' });
  f.note('(N) 5\' × 5\' ENTRY DECKS, FRONT\nAND REAR. SEE SHEET ' + s.deckSheet, s.decks[0].deck[2], s.decks[0].deck[1] + 2, nx, h[1] - 5.4, { side: 'r', kind: 'N' });
  if (s.easement) f.note(wrap(UP(s.easement), 30), X1 - 1.4, ry(X1) - 13, nx, ry(X1) - 5, { side: 'r' });
  f.note('(N) UNDERGROUND ELECTRIC (UE)\nTO METER / DISCONNECT (M/D)', s.electric[2][0], h[1] - 19.4, lx, h[1] + 14.6, { side: 'l', kind: 'N' });
  f.note('(N) SANITARY SEWER (SS)\nCLEANOUT AT THE FRONT LINE', s.sewer[1][0], h[1] - 29.4, lx, h[1] - 7.4, { side: 'l', kind: 'N' });
  f.note('(N) WATER SERVICE (W)\nMETER AT THE FRONT LINE', s.water[0][0], h[1] - 41.4, lx, h[1] - 29.4, { side: 'l', kind: 'N' });
  if (s.pole) { f.note('(E) UTILITY POLE AT THE STREET', s.pole[0], s.pole[1], lx, h[1] - 51.4, { side: 'l' }); f.circle(s.pole[0], s.pole[1], 1.3, 'ex'); }
  return v.svg();
}

// ------------------------------------------------------------------ 2  ENLARGED PLAN AT THE HOME
function siteZoom(P, G, den) {
  const s = G.s, v = new View(den, 'zoom'), f = FV(v), h = s.home, b = s.boundary, y0 = h[1] - 17.4, y1 = h[3] + 14.3, nx = G.X1 + 7, lx = -7;
  f.raw([[0, y0], [0, y1]], LINE.prop); f.raw([[b[3][0], y0], [b[3][0], y1]], LINE.prop);
  f.text('PROPERTY LINE', -1.6, y1 - 12, { cls: 'ts', anchor: 'middle', rot: 90, size: 8 }); f.text('PROPERTY LINE', b[3][0] + 1.8, y1 - 12, { cls: 'ts', anchor: 'middle', rot: 90, size: 8 });
  siteWork(f, { s, drive: [[s.drive.x0, s.drive.yTop], [s.drive.x1, s.drive.yTop], [s.drive.x1, y0], [s.drive.x0, y0]] }, true, y0);
  f.text('(N) MANUFACTURED HOME', (h[0] + h[2]) / 2, (h[1] + h[3]) / 2 + 1.5, { cls: 'tN', anchor: 'middle' }); f.text(UP(s.homeModel), (h[0] + h[2]) / 2, (h[1] + h[3]) / 2 - 3, { cls: 'ts', anchor: 'middle' }); f.text('FOUNDATION: SEE SHEET ' + s.foundSheet, (h[0] + h[2]) / 2, (h[1] + h[3]) / 2 - 7.5, { cls: 'ts', anchor: 'middle' });
  f.text('FRONT · ' + UP(s.street), (h[0] + h[2]) / 2 - 10, y0 + 1, { cls: 'ts', anchor: 'middle' });
  for (const [k, vt] of s.vents.entries()) { f.rect(vt[0] - 0.7, vt[1] - 0.45, vt[0] + 0.7, vt[1] + 0.45, 'steel'); f.text('V' + (k + 1), vt[0], vt[1] + (vt[1] > h[1] + 1 ? -2.6 : 1.3), { cls: 'ts', anchor: 'middle', size: 8 }); }
  f.rect(s.access[0] - 0.75, h[1] - 0.45, s.access[0] + 0.75, h[1] + 0.45, 'steel');
  // dimensions
  f.dimH(h[0], h[2], h[3] + 12, h[3], { text: ftin0(h[2] - h[0]) }); f.dimH(0, h[0], h[3] + 12, h[3], { text: ftin0(h[0]) }); f.dimH(h[2], b[3][0], h[3] + 12, h[3], { text: ftin0(b[3][0] - h[2]) });
  f.dimV(h[1], h[3], h[0] - 4, h[0], { text: ftin0(h[3] - h[1]) });
  const fd = s.decks[0], rd = s.decks[1];
  f.dimH(h[0], fd.deck[0], h[1] - 3.5, h[1], { text: ftin0(fd.deck[0] - h[0]) }); f.dimH(fd.deck[0], fd.deck[2], h[1] - 3.5, h[1], { text: ftin0(fd.deck[2] - fd.deck[0]) });
  f.dimV(fd.pad[1], h[1], fd.deck[2] + 3.4, fd.deck[2], { text: ftin0(h[1] - fd.pad[1]) });
  f.dimH(h[2], s.drive.x0, h[1] - 3.5, h[1], { text: ftin0(s.drive.x0 - h[2]) }); f.dimH(s.drive.x0, s.drive.x1, h[1] - 3.5, h[1], { text: ftin0(s.drive.x1 - s.drive.x0) });
  // notes
  f.note('(N) REAR ENTRY DECK 5\' × 5\',\nSTAIR AND PAD. SEE ' + s.deckSheet, rd.deck[0], rd.deck[3] - 1, lx, h[3] + 8.3, { side: 'l', kind: 'N' });
  f.note('(N) WATER (W), TO THE HOME', s.water[1][0], s.water[1][1] - 2, lx, h[3] - 3.7, { side: 'l', kind: 'N' });
  f.note('(N) SEWER (SS), TO THE HOME', s.sewer[1][0], s.sewer[1][1] - 3, lx, h[3] - 11.7, { side: 'l', kind: 'N' });
  f.note('(N) ELECTRIC (UE) AND\nMETER / DISCONNECT (M/D)', s.md[0] - 1.25, s.md[1], lx, h[1] + 2.6, { side: 'l', kind: 'N' });
  f.note('(N) CRAWL SPACE ACCESS\n18" × 24", CLEAR OF STAIRS', s.access[0], h[1], lx, h[1] - 11.4, { side: 'l', kind: 'N' });
  f.note('(N) HVAC PAD 4\' × 4\'', s.hvac[2], s.hvac[3] - 1, nx, h[3] + 9.3, { side: 'r', kind: 'N' });
  f.note('(N) FOUNDATION VENTS V1–V4.\nSEE ' + GN(P, 'M8'), s.vents[3][0] + 0.7, s.vents[3][1], nx, h[3] + 1.3, { side: 'r', kind: 'N' });
  f.note(`(N) ASPHALT DRIVEWAY\n${UP(s.drive.label)}`, s.drive.x1, h[1] + 12.6, nx, h[3] - 11.7, { side: 'r', kind: 'N' });
  f.note('(N) FRONT ENTRY DECK 5\' × 5\',\nSTAIR 4\' WIDE × 5\' MAX. ON A\nCONCRETE PAD. SEE ' + s.deckSheet, fd.stair[2], fd.stair[1] + 2, nx, h[1] - 1.4, { side: 'r', kind: 'N' });
  return v.svg();
}

// ------------------------------------------------------------------ table drawn in a detail box (text only, not to scale)
function tableView(id, den, rows, foot) {
  const v = new View(den, id), u = v.pt(1), rh = 24 * u, w0 = 250 * u, w1 = 760 * u; let y = 0;
  for (const r of rows) { const b = r[2] === 'b';
    if (r[2] === 'h') { v.text(UP(r[0]), 0, y, { cls: 'tN', size: 14 }); y -= rh; v.line(0, y + rh * 0.55, w1, y + rh * 0.55, 'o'); continue; }
    v.text(UP(r[0]), 0, y, { cls: b ? 'tb' : 't', size: 13 }); v.text(UP(r[1]), w1, y, { cls: b ? 'tb' : 't', size: 13, anchor: 'end' }); y -= rh; v.line(0, y + rh * 0.6, w1, y + rh * 0.6, 'dm'); }
  if (foot) v.text(wrap(UP(foot), 110), 0, y - rh * 0.3, { cls: 'ts', size: 10 });
  return v.svg();
}
const siteCoverage = (P, G, den) => tableView('cov', den, P.site.coverage, P.site.coverageNote);
function siteLegend(P, G, den) {
  const v = new View(den, 'leg'), f = FV(v), rows = [['prop', 'PROPERTY LINE, PER THE RECORDED PLAT'], ['water', 'W · (N) WATER SERVICE'], ['sewer', 'SS · (N) SANITARY SEWER'], ['elec', 'UE · (N) UNDERGROUND ELECTRIC']];
  const u = v.pt(1) / K * 1.4; let y = 0;
  for (const [k, t] of rows) { f.raw([[0, y], [70 * u, y]], LINE[k]); f.text(t, 84 * u, y - 3.4 * u, { cls: 't', size: 13 }); y -= 19 * u; }
  f.circle(8 * u, y, 4 * u, 'steelo'); f.text('WATER METER', 22 * u, y - 3.4 * u, { cls: 't', size: 13 }); f.rect(146 * u, y - 4 * u, 154 * u, y + 4 * u, 'steelo'); f.text('SEWER CLEANOUT', 166 * u, y - 3.4 * u, { cls: 't', size: 13 });
  f.rect(300 * u, y - 4 * u, 308 * u, y + 4 * u, 'steelo'); f.text('M/D · METER / DISCONNECT', 320 * u, y - 3.4 * u, { cls: 't', size: 13 }); y -= 24 * u;
  f.text(wrap(UP(P.site.utilityNote), 110), 0, y - 8 * u, { cls: 'ts', size: 10 });
  // site plan general notes, in a column to the right of the legend
  const nx0 = 490 * u; let ny = 6 * u; f.text('SITE PLAN GENERAL NOTES', nx0, ny, { cls: 'tN', size: 14 }); ny -= 18 * u;
  (P.site.generalNotes || []).forEach((t, i) => { const ls = wrap(UP(t), 72).split('\n'); f.text((i + 1) + '.', nx0, ny, { cls: 't', size: 11 }); f.text(ls.join('\n'), nx0 + 16 * u, ny, { cls: 't', size: 11 }); ny -= (ls.length * 9.6 + 5) * u; });
  v.ext((nx0 + 276 * u) * K, 10 * u * K); v.ext((nx0 + 276 * u) * K, ny * K);
  return v.svg();
}

// ------------------------------------------------------------------ isometric of the lot, seen from the street
function siteIso(P, G, o = {}) {
  // seen from the street: the lot is turned so the frontage is nearest the viewer (x' = XM - x, y' = YM - y)
  const s = G.s, iso = new Iso(o.den || 420, o.id || 'siso'), m = Object.assign({ util: 'new', home: 'new', drive: 'new', decks: 'new' }, o.mode || {}), XM = G.X1, YM = G.Y1 + 1.6;
  const T = (x, y) => [(XM - x) * K, (YM - y) * K], C = k => (k === 'new' ? PAL.newSolid : PAL.existSolid), box = (r, z0, z1, col, ord) => { const a = T(r[2], r[3]), b = T(r[0], r[1]); iso.solid(a[0], b[0], a[1], b[1], z0 * K, z1 * K, col, { order: ord }); };
  const q = pts => pts.map(p => { const t = T(p[0], p[1]); return [t[0], t[1], 0]; }), xa = -14, xb = G.X1 + 14, yb = G.Y0 - 22;
  iso.quad(q([[xa, yb], [xb, yb], [xb, G.Y1 + 8], [xa, G.Y1 + 8]]), o.quiet ? '#eceee9' : '#e7e3d8', { order: 0, stroke: '#b9b29f' });
  iso.quad(q([s.boundary[0], s.boundary[3], s.boundary[2], s.boundary[1]]), '#dfe6d6', { order: 0.1, stroke: PAL.ink });
  iso.quad(q([[xa, yb], [xb, yb], [xb, G.arcY(G.X1) - 9], [xa, G.arcY(0) - 12]]), '#d9dbe0', { order: 0.05, stroke: '#b7bcc6' });   // street
  if (m.drive) iso.quad(q([[s.drive.x0, s.drive.yTop], [s.drive.x1, s.drive.yTop], [s.drive.x1, G.arcY(s.drive.x1)], [s.drive.x0, G.arcY(s.drive.x0)]]), m.drive === 'new' ? shade(PAL.newSolid, 0.55) : PAL.slab, { order: 0.3 });
  if (m.util) for (const ln of [s.water, s.sewer, s.electric]) for (let i = 0; i < ln.length - 1; i++) { const a = T(ln[i][0], ln[i][1]), b = T(ln[i + 1][0], ln[i + 1][1]); iso.line3([a[0], a[1], 0], [b[0], b[1], 0], 'anchOk'); }
  if (m.home) box(s.home, 0, 11, C(m.home), 2);
  if (m.decks) for (const d of s.decks) { box(d.deck, 0, 2.8, C(m.decks), 1.5); box(d.stair, 0, 1.4, C(m.decks), 1.4); }
  if (m.home) box(s.hvac, 0, 0.3, C(m.home), 1.2);
  iso._T = T; return iso;
}
const SITE_STEPS = { stake: { util: 0, home: 0, drive: 0, decks: 0 }, util: { util: 'new', home: 0, drive: 0, decks: 0 }, home: { util: 0, home: 'new', drive: 0, decks: 0 }, finish: { util: 0, home: 'done', drive: 'new', decks: 'new' }, all: {} };
const SITE = {
  derive: siteDerive,
  picture: (P, G, o) => siteIso(P, G, o),
  labels(P, G, iso) {
    const s = G.s, T = iso._T, L = lab(iso), X1 = G.X1, Y1 = G.Y1, at = (x, y, z) => { const t = T(x, y); return [t[0], t[1], z * K]; }, sp = p => [(p[0] - p[1]) * 0.866, (p[0] + p[1]) / 2 - p[2]];
    const h = s.home, top = sp(at(X1 / 2, Y1 + 1.6, 0))[1] - 160, bot = sp(at(X1 / 2, G.Y0 - 22, 0))[1] + 150;
    if (s.woodland) L(UP(s.woodland), at(X1 / 2, Y1 * 0.77, 0), sp(at(0, Y1 * 0.91, 0))[0] - 200, top, { side: 'r' });
    L(`(N) MANUFACTURED HOME\n${UP(s.homeSize)}`, at((h[0] + h[2]) / 2, h[3], 11), sp(at(X1, Y1 * 0.72, 0))[0] - 100, top + 330, { side: 'l', kind: 'N' });
    L('(N) ASPHALT DRIVEWAY', at(s.drive.x1 - 6, h[1] - 13.4, 0), sp(at(X1, 20, 0))[0] - 520, bot, { side: 'l', kind: 'N' });
    L('(N) WATER, SEWER AND ELECTRIC', at(s.sewer[1][0], h[1] - 23.4, 0), sp(at(0, 0, 0))[0] + 260, bot + 150, { side: 'r', kind: 'N' });
    L(UP(s.street), at(X1 * 0.44, G.arcY(X1 * 0.44) - 34, 0), sp(at(X1 * 0.44, G.arcY(X1 * 0.44) - 34, 0))[0] + 300, bot + 300, { side: 'r' });
  },
  stepPicture: (P, G, step, k) => siteIso(P, G, { den: 1150, id: 'sst' + k, quiet: true, mode: SITE_STEPS[step.pic] || SITE_STEPS.all }).svg(),
  field: {
    pictureNote: 'Seen from the street. Trees not shown.',
    planHeight: 8.3, pictureDen: 460, coverDen: 520,
    plan:    { title: 'Site plan', den: 360, draw: sitePlan, note: P => (P.site && P.site.sourceNote) || 'From owner-furnished information. Not a boundary or topographic survey' },
    section: { title: 'Enlarged plan at the home', den: 180, draw: siteZoom },
    details: [
      { title: 'Placement and lot coverage', den: 24, draw: siteCoverage, nts: true, note: 'Table' },
      { title: 'Line legend and site plan general notes', den: 24, draw: siteLegend, nts: true, note: 'Legend and notes' },
    ],
  },
};

// ====================================================================== ENTRY DECK (sheet S2.0)
// P.deck, inches. x runs along the home wall, y runs away from the home (home wall face at y = -gap), z is up from grade.
function deckDerive(P) {
  const d = P.deck, jt = d.joistT, joists = d.joistX.slice(), yB = [d.postInsetHome, d.D - d.postInset], xP = [d.postInset, d.L - d.postInset];
  const posts = []; for (const y of yB) for (const x of xP) posts.push({ x, y });
  const zJoistTop = d.deckH - d.deckingT, zBeamTop = zJoistTop - d.joistDepth, zPostTop = zBeamTop - d.beamDepth, beamW = d.beamPlies * d.plyT;
  const rise = d.deckH / d.risers, nT = d.risers - 1, sx0 = (d.L - d.stairW) / 2, sx1 = sx0 + d.stairW, yEnd = d.D + nT * d.tread, yPad0 = yEnd - d.padD * 2 / 3, yPad1 = yPad0 + d.padD;
  return { d, joists, yB, xP, posts, zJoistTop, zBeamTop, zPostTop, beamW, rise, nT, sx0, sx1, yEnd, yPad0, yPad1, zBase: d.stemTop + d.standoff };
}
const dkBreak = (v, x0, x1, y) => { const m = (x0 + x1) / 2, a = I(0.35), b = I(0.8); v.poly([[x0 - I(0.7), y], [m - a, y], [m - a / 2, y + b], [m + a / 2, y - b], [m + a, y], [x1 + I(0.7), y]], 'o2', false); };

// ------------------------------------------------------------------ 1  FRAMING AND FOOTING PLAN
function deckPlan(P, G, den) {
  const d = G.d, v = new View(den, 'dplan'), L = d.L, D = d.D, jt = d.joistT, h = d.post / 2, nx = L + I(22), lx = -I(30);
  v.rect(-I(26), -d.gap - I(8), L + I(26), -d.gap, 'ex'); v.text('MANUFACTURED HOME · ENTRY DOOR', L / 2, -d.gap - I(6), { cls: 'ts', anchor: 'middle' });
  for (const p of G.posts) v.circle(p.x, p.y, d.footingDia / 2, 'newH');
  for (const y of G.yB) v.rect(0, y - G.beamW / 2, L, y + G.beamW / 2, 'newH');
  for (const x of G.joists) v.rect(x - jt / 2, jt, x + jt / 2, D - jt, 'new');
  v.rect(0, 0, L, jt, 'new'); v.rect(0, D - jt, L, D, 'new');
  for (const p of G.posts) v.rect(p.x - h, p.y - h, p.x + h, p.y + h, 'newS');
  // stair and lower landing
  v.rect(G.sx0, G.yPad0, G.sx1, G.yPad1, 'newH'); v.rect(G.sx0, D, G.sx1, G.yEnd, 'new'); for (let k = 1; k < G.nT; k++) v.line(G.sx0, D + k * d.tread, G.sx1, D + k * d.tread, 'new');
  v.text('DN', L / 2, D + I(4), { cls: 'ts', anchor: 'middle' });
  // dimensions
  v.dimH(0, G.xP[0], -d.gap - I(14), -d.gap - I(8)); v.dimH(G.xP[0], G.xP[1], -d.gap - I(14), -d.gap - I(8)); v.dimH(G.xP[1], L, -d.gap - I(14), -d.gap - I(8));
  v.dimH(0, L, -d.gap - I(24), -d.gap - I(8), { text: FMT(L) + ' OUT TO OUT' });
  const ys = [0, G.yB[0], G.yB[1], D, G.yEnd], tx = [null, null, null, '±' + FMT(G.yEnd - D) + ' STAIR'];
  for (let i = 0; i < ys.length - 1; i++) v.dimV(ys[i], ys[i + 1], lx + I(14), i > 2 ? G.sx0 : 0, tx[i] ? { text: tx[i] } : {});
  v.dimV(0, D, lx, 0, { text: FMT(D) + ' OUT TO OUT' });
  v.dimH(G.sx0, G.sx1, G.yPad1 + I(10), G.yPad1, { text: FMT(d.stairW) + ' STAIR AND PAD' });
  // notes
  v.note('NO LEDGER. DECK IS NOT\nCONNECTED TO THE HOME', L * 0.8, -d.gap / 2, nx, -I(4), { side: 'r' });
  v.note(`(N) ${d.beamName} BEAM BELOW\nJOISTS. SEE ${REF.d2}/${REF.sheet}`, L, G.yB[0], nx, G.yB[0] + I(3), { side: 'r', kind: 'N' });
  v.note(`(N) ${d.joistName} JOISTS @ ${FMT(d.joistSpacing)}\nO.C. MAX. ${d.joistName} RIM EACH END`, L - jt / 2, D * 0.5, nx, D * 0.5 + I(2), { side: 'r', kind: 'N' });
  v.note(`(N) ${d.postName} POST, TYP. OF ${G.posts.length}\nSEE ${REF.d1}/${REF.sheet}`, G.xP[1] + h, G.yB[1] + h * 0.4, nx, G.yB[1] - I(7), { side: 'r', kind: 'N' });
  v.note(`(N) ${FMT(d.footingDia)} DIA. × ${FMT(d.footingDepth)} DEEP CONCRETE\nPIER FOOTING, TYP. OF ${G.posts.length}`, G.xP[1] + d.footingDia * 0.35, G.yB[1] + d.footingDia * 0.35, nx, G.yB[1] + I(9), { side: 'r', kind: 'N' });
  v.note(`(N) STAIR: ${d.stringerCount} ${d.stringerName}\nSTRINGERS. SEE ${REF.d4}/${REF.sheet}`, G.sx1, D + I(18), nx, D + I(18), { side: 'r', kind: 'N' });
  v.note(`(N) CONCRETE PAD UNDER THE\nSTRINGERS. SEE ${REF.d4}/${REF.sheet}`, G.sx1, G.yPad1 - I(1.5), nx, G.yPad1 + I(4), { side: 'r', kind: 'N' });
  // section cut
  const sx = L * 0.42, ty = -d.gap - I(34);
  v.line(sx, G.yPad1 + I(4), sx, -d.gap - I(26), 'cutl'); v.line(sx, ty, sx, ty - I(6), 'cutl2'); v.line(sx, ty - I(6), sx + I(8), ty - I(6), 'cutl2'); v.arrow(sx + I(8), ty - I(6), sx, ty - I(6));
  v.bubble(sx - I(10), ty - I(4), String(REF.section), REF.sheet);
  return v.svg();
}

// parts shared by the section and the stair detail (y horizontal, z vertical)
function dkStair(v, G) {
  const d = G.d, D = d.D, pts = [[D, d.deckH - G.rise]];
  for (let k = 0; k < G.nT; k++) { const y = D + k * d.tread, z = d.deckH - (k + 1) * G.rise; pts.push([y + d.tread, z], [y + d.tread, z - G.rise]); }
  const yEnd = D + G.nT * d.tread, th = I(6.2), sl = G.rise / d.tread;
  pts.push([yEnd + I(1), 0], [yEnd - th / sl * 0.55, 0], [D, d.deckH - G.rise - th * 1.25]);
  v.poly(pts, 'newF', true); v.poly(pts.concat([pts[0]]), 'new', false);
  for (let k = 0; k < G.nT; k++) { const y = D + k * d.tread, z = d.deckH - (k + 1) * G.rise; v.rect(y - I(0.75), z, y + d.tread, z + I(1), 'new'); }
  return yEnd;
}
function dkFooting(v, G, y, o = {}) {                                   // cast-in-place concrete pier footing, one diameter full depth
  const d = G.d, fr = d.footingDia / 2, h = d.post / 2, zb = -d.footingDepth;
  v.rect(y - fr, zb, y + fr, d.stemTop, 'new', { fill: v.pat('conc') });
  v.rect(y - h - I(0.25), d.stemTop, y + h + I(0.25), G.zBase, 'steel');
  if (!o.noPost) v.rect(y - h, G.zBase, y + h, G.zPostTop, 'new');
}

// ------------------------------------------------------------------ 2  SECTION THROUGH THE DECK AND STAIR
function deckSection(P, G, den) {
  const d = G.d, v = new View(den, 'dsect'), D = d.D, jt = d.joistT, lx = -d.gap - I(30), F = P.geometry, top = d.deckH + d.guardH;
  // the home, by others: perimeter wall, footing and floor
  v.rect(-d.gap - F.wallT, -F.embed + F.ftgH, -d.gap, F.wallTop, 'ex'); v.rect(-d.gap - F.wallT - (F.ftgB - F.wallT) / 2, -F.embed, -d.gap + (F.ftgB - F.wallT) / 2, -F.embed + F.ftgH, 'ex');
  v.rect(-d.gap - I(24), d.deckH + d.threshold - I(10), -d.gap, d.deckH + d.threshold, 'ex'); v.rect(-d.gap - I(6), d.deckH + d.threshold, -d.gap, top + I(14), 'ex');
  v.line(lx - I(4), 0, -d.gap - F.wallT, 0, 'o'); v.line(-d.gap, 0, G.yPad0, 0, 'o'); v.line(G.yPad1, 0, G.yPad1 + I(40), 0, 'o');
  for (const y of G.yB) { dkFooting(v, G, y); for (let k = 0; k < d.beamPlies; k++) v.lumber(y - G.beamW / 2 + k * d.plyT, G.zPostTop, y - G.beamW / 2 + (k + 1) * d.plyT, G.zBeamTop, 'new'); }
  v.rect(jt, G.zBeamTop, D - jt, G.zJoistTop, 'new'); v.lumber(0, G.zBeamTop, jt, G.zJoistTop, 'new'); v.lumber(D - jt, G.zBeamTop, D, G.zJoistTop, 'new');
  v.rect(-I(0.5), G.zJoistTop, D + I(0.75), d.deckH, 'new');
  const yEnd = dkStair(v, G);
  v.rect(G.yPad0, -d.padT, G.yPad1, 0, 'new', { fill: v.pat('conc') });
  // guard at the deck side and handrail along the stair, shown beyond
  { const zb = d.deckH + I(2.5), gp = I(3.5);                                                       // deck guard: 4x4 posts, 2x4 rails, 2x2 balusters at 5 in
    v.rect(I(1), top - I(1.5), D, top, 'new'); v.rect(I(1), zb, D, zb + I(1.5), 'new');
    for (const y of [G.yB[0] - gp / 2, G.yB[1] - gp / 2]) v.rect(y, G.zBeamTop, y + gp, top, 'new', { fill: '#fff' });
    for (let y = G.yB[0] + gp / 2 + I(2.5); y + I(1.5) < G.yB[1] - gp / 2; y += I(5)) v.rect(y, zb + I(1.5), y + I(1.5), top - I(1.5), 'new');
    for (let y = G.yB[0] - gp / 2 - I(4.5); y > I(1.5); y -= I(5)) v.rect(y, zb + I(1.5), y + I(1.5), top - I(1.5), 'new'); }
  const hr = I(36), y0 = D, y1 = yEnd, sl = G.rise / d.tread, zN = y => d.deckH - (y - y0) * sl, z1 = zN(y1);
  { const gp = I(3.5);                                                                                // stair guard and handrail, parallel to the nosing line
    v.poly([[y0, d.deckH + hr], [y1, z1 + hr], [y1, z1 + hr - I(1.5)], [y0, d.deckH + hr - I(1.5)]], 'new', true); v.poly([[y0, d.deckH + I(4)], [y1, z1 + I(4)], [y1, z1 + I(2.5)], [y0, d.deckH + I(2.5)]], 'new', true);
    v.rect(y0 - gp, G.zBeamTop, y0, top, 'new', { fill: '#fff' }); v.rect(y1 - gp, 0, y1, z1 + hr, 'new', { fill: '#fff' });
    for (let y = y0 + I(2.5); y + I(1.5) < y1 - gp; y += I(5)) v.poly([[y, zN(y) + I(4)], [y + I(1.5), zN(y + I(1.5)) + I(4)], [y + I(1.5), zN(y + I(1.5)) + hr - I(1.5)], [y, zN(y) + hr - I(1.5)]], 'new', true); }
  // dimensions and datums
  v.dimH(0, G.yB[0], -d.footingDepth - I(9), -d.footingDepth); v.dimH(G.yB[0], G.yB[1], -d.footingDepth - I(9), -d.footingDepth); v.dimH(G.yB[1], D, -d.footingDepth - I(9), -d.footingDepth);
  v.dimH(D, G.yEnd, -d.footingDepth - I(9), 0, { text: '±' + FMT(G.yEnd - D) + ' STAIR' });
  v.dimV(-d.footingDepth, 0, G.yB[1] + I(20), G.yB[1] + d.footingDia / 2, { text: FMT(d.footingDepth) + ' MIN.' });
  v.dimV(d.deckH, top, D + I(10), D, { text: FMT(d.guardH) + ' MIN.' });
  v.datum(`TOP OF DECK ${FMT(d.deckH, true)}\nMATCH THRESHOLD, V.I.F.`, lx, d.deckH, -d.gap - I(26)); v.datum('FINISHED GRADE', lx, 0, -d.gap - I(14));
  // notes above
  const ny = top + I(26);
  v.note('HOME AND PERIMETER\nWALL. SEE SHEET ' + P.site.foundSheet, -d.gap - I(3), top + I(8), -d.gap - I(8), ny, { side: 'l' });
  v.note(`(N) GUARD ${FMT(d.guardH)} MIN.: 4×4 POSTS,\n2×4 RAILS, 2×2 @ 5" O.C. SEE ${REF.d3}/${REF.sheet}`, D * 0.45, top, D * 0.2, ny, { side: 'r', kind: 'N' });
  v.note('(N) GRASPABLE HANDRAIL 34" TO 38"\nABOVE THE NOSINGS, CONTINUOUS FOR\nTHE FLIGHT, ENDS RETURNED', (y0 + y1) / 2, (d.deckH + hr + hr) / 2, D + I(26), ny + I(5), { side: 'r', kind: 'N' });
  v.note('(N) GUARD ON EACH OPEN SIDE OF THE\nSTAIR, 34" MIN. ABOVE THE NOSINGS.\n4×4 POSTS @ 4\'-0" O.C. MAX., 2×2 @ 5" O.C.', y0 + (y1 - y0) * 0.75, d.deckH * 0.25 + hr * 0.55, D + I(96), ny - I(5), { side: 'r', kind: 'N' });
  v.note(`(N) ${d.risers} EQUAL RISERS, ${G.nT} TREADS.\nSEE ${REF.d4}/${REF.sheet}`, D + d.tread * 2.5, d.deckH - G.rise * 3 + I(1), D + I(96), ny - I(29), { side: 'r', kind: 'N' });
  return v.svg();
}

// ------------------------------------------------------------------ 3  FOOTING AND POST BASE
function deckFooting(P, G, den) {
  const d = G.d, v = new View(den, 'dftg'), fr = d.footingDia / 2, h = d.post / 2, zb = -d.footingDepth, top = G.zBase + I(9), nx = fr + I(9), lx = -fr - I(9);
  v.line(-fr - I(12), 0, -fr, 0, 'o'); v.line(fr, 0, fr + I(12), 0, 'o');
  dkFooting(v, G, 0, { noPost: true });
  v.rect(-h - I(0.25), G.zBase, -h, G.zBase + I(5), 'steel'); v.rect(h, G.zBase, h + I(0.25), G.zBase + I(5), 'steel');
  v.rect(-h, G.zBase, h, top, 'newF'); v.poly([[-h, top], [-h, G.zBase], [h, G.zBase], [h, top]], 'new', false); dkBreak(v, -h, h, top);
  v.line(0, d.stemTop, 0, d.stemTop - I(5), 'anchOk');
  v.dimH(-fr, fr, zb - I(6), zb, { text: FMT(d.footingDia) + ' DIA.' }); v.dimV(zb, 0, fr + I(4.5), fr, { text: FMT(d.footingDepth) + ' MIN.' });
  v.note(`(N) ${d.postName} POST, ${UP(d.lumber)}`, h, top - I(2.5), nx, top - I(1), { side: 'r', kind: 'N' });
  v.note('(N) ' + wrap(UP(d.baseNote), 30), h + I(0.25), G.zBase + I(2.5), nx, G.zBase + I(1), { side: 'r', kind: 'N' });
  v.note('(N) ' + wrap(UP(d.footingNote), 30), fr, zb * 0.55, nx, zb * 0.55, { side: 'r', kind: 'N' });
  v.note('FINISHED GRADE', -fr - I(5), 0, lx, I(5), { side: 'l' });
  v.note(`TOP OF CONCRETE ${FMT(d.stemTop)}\nABOVE GRADE`, -fr * 0.6, d.stemTop, lx, I(12), { side: 'l' });
  v.note(wrap(UP(d.bearingNote), 22), -fr * 0.5, zb, lx, zb + I(10), { side: 'l' });
  return v.svg();
}

// ------------------------------------------------------------------ 4  JOIST, BEAM AND POST
function deckBeam(P, G, den) {
  const d = G.d, v = new View(den, 'dbeam'), h = d.post / 2, bw = G.beamW, pt = I(5), bt = pt + d.beamDepth, jt = bt + d.joistDepth, x0 = -I(11), x1 = I(11), nx = I(14);
  v.rect(-h, 0, h, pt, 'newF'); v.poly([[-h, 0], [-h, pt], [h, pt], [h, 0]], 'new', false); dkBreak(v, -h, h, 0);
  for (let k = 0; k < d.beamPlies; k++) v.lumber(-bw / 2 + k * d.plyT, pt, -bw / 2 + (k + 1) * d.plyT, bt, 'new');
  v.rect(-h - I(0.2), pt - I(3), -h, pt, 'steel'); v.rect(h, pt - I(3), h + I(0.2), pt, 'steel'); v.rect(-bw / 2 - I(0.2), pt, -bw / 2, pt + I(3.5), 'steel'); v.rect(bw / 2, pt, bw / 2 + I(0.2), pt + I(3.5), 'steel');
  v.rect(x0, bt, x1, jt, 'newF'); v.line(x0, bt, x1, bt, 'new'); v.line(x0, jt, x1, jt, 'new');
  for (const x of [x0, x1]) v.poly([[x, bt - I(0.6)], [x - I(0.35), bt + d.joistDepth * 0.3], [x + I(0.35), bt + d.joistDepth * 0.7], [x, jt + I(0.6)]], 'o2', false);
  v.rect(x0 + I(0.4), jt, x1 - I(0.4), jt + d.deckingT, 'new');
  v.note(`(N) ${UP(d.deckingName)} DECKING, PERPENDICULAR\nTO THE JOISTS. ⅛" GAP AFTER DRYING`, I(6), jt + d.deckingT, nx, jt + I(4), { side: 'r', kind: 'N' });
  v.note(`(N) ${d.joistName} JOIST @ ${FMT(d.joistSpacing)} O.C. MAX.`, I(8), bt + d.joistDepth * 0.55, nx, bt + d.joistDepth * 0.5, { side: 'r', kind: 'N' });
  v.note('(N) ' + wrap(UP(d.joistTieNote), 30), bw / 2 + I(0.1), bt, nx, bt - I(2), { side: 'r', kind: 'N' });
  v.note('(N) ' + wrap(UP(d.capNote), 30), h + I(0.2), pt - I(1.2), nx, pt - I(4.5), { side: 'r', kind: 'N' });
  v.note(`(N) ${d.beamName} BEAM`, -bw / 2, pt + d.beamDepth * 0.6, -nx, pt + d.beamDepth * 0.8, { side: 'l', kind: 'N' });
  v.note(`(N) ${d.postName} POST`, -h, I(1.6), -nx, I(1.2), { side: 'l', kind: 'N' });
  return v.svg();
}

// ------------------------------------------------------------------ 5  GUARD AT THE DECK EDGE
function deckGuard(P, G, den) {                                         // guard elevation at a beam: post on the beam, rails and balusters
  const d = G.d, v = new View(den, 'dguard'), ply = d.plyT, zb0 = -d.beamDepth, zt = d.joistDepth, zd = zt + d.deckingT, top = zd + d.guardH, gp = I(1.75), x0 = -I(15), x1 = I(15), nx = x1 + I(5), lx = x0 - I(5), zbr = zd + I(2.5);
  v.rect(x0, 0, x1, zt, 'newF'); v.line(x0, 0, x1, 0, 'new'); v.line(x0, zt, x1, zt, 'new'); v.rect(x0, zt, x1, zd, 'new');           // end joist and decking, beyond
  v.lumber(-ply, zb0, 0, 0, 'new'); v.lumber(0, zb0, ply, 0, 'new');                                                                    // beam, cut
  v.rect(-gp, 0, gp, top, 'new', { fill: '#fff' }); v.rect(-gp, 0, gp, top, 'newF');                                                    // 4x4 guard post on the beam
  for (const k of [-1, 1]) v.poly([[k * gp, I(3)], [k * (gp + I(0.2)), I(3)], [k * (gp + I(0.2)), -I(3)], [k * ply, -I(3)], [k * ply, 0], [k * gp, 0]], 'steel', true);   // LPC4Z each side
  for (const k of [-1, 1]) { const a = k * gp, b = k > 0 ? x1 : x0;
    v.rect(Math.min(a, b), top - I(1.5), Math.max(a, b), top, 'new'); v.rect(Math.min(a, b), zbr, Math.max(a, b), zbr + I(1.5), 'new');   // 2x4 top and bottom rails
    for (let x = gp + I(3.2); x + I(1.5) <= I(15); x += I(5)) v.rect(k > 0 ? x : -x - I(1.5), zbr + I(1.5), k > 0 ? x + I(1.5) : -x, top - I(1.5), 'new');
    for (const z of [top - I(1.5), zbr]) v.rect(k > 0 ? a : a - I(1.4), z - I(1.4), k > 0 ? a + I(1.4) : a, z, 'steel'); }
  for (const x of [x0, x1]) v.poly([[x, -I(0.8)], [x - I(0.4), zt * 0.3], [x + I(0.4), zt * 0.7], [x, zd + I(0.8)]], 'o2', false);
  v.dimV(zd, top, nx + I(27), x1, { text: FMT(d.guardH) + ' MIN.' }); v.dimV(zd, zbr, x0 - I(2), x0, { text: '4" MAX.' });
  v.dimH(gp + I(3.2) + I(0.75), gp + I(8.2) + I(0.75), top + I(5), top, { text: '5" O.C.' });
  v.note('(N) ' + wrap(UP(d.guardRailNote), 28), I(9), top, nx, top + I(2), { side: 'r', kind: 'N' });
  v.note('(N) ' + wrap(UP(d.guardBalNote), 28), gp + I(9.7), zd + d.guardH * 0.62, nx, zd + d.guardH * 0.7, { side: 'r', kind: 'N' });
  v.note('(N) ' + wrap(UP(d.guardPostNote), 28), gp, zd + d.guardH * 0.36, nx, zd + d.guardH * 0.38, { side: 'r', kind: 'N' });
  v.note('(N) ' + wrap(UP(d.guardClipNote), 28), gp + I(0.7), zbr - I(0.7), nx, zd + I(1), { side: 'r', kind: 'N' });
  v.note('(N) ' + wrap(UP(d.guardFixNote), 28), gp + I(0.2), -I(1.5), nx, -I(5), { side: 'r', kind: 'N' });
  v.note('GUARD AND HANDRAIL RESIST\n200 LB AT THE TOP, ANY\nDIRECTION' + (d.guardLoadRef ? ` (${UP(d.guardLoadRef)})` : ''), -I(8), top, lx, top + I(3), { side: 'l' });
  v.note('A 4" SPHERE SHALL NOT\nPASS ANY OPENING', -I(7.5), zd + d.guardH * 0.5, lx, zd + d.guardH * 0.55, { side: 'l' });
  v.note(`END JOIST AND DECKING`, -I(10), zt * 0.5, lx, zt * 1.6, { side: 'l' });
  v.note(`(N) ${d.beamName} BEAM`, -ply, zb0 * 0.6, lx, zb0 * 0.7, { side: 'l', kind: 'N' });
  return v.svg();
}

// ------------------------------------------------------------------ 6  STAIR
function deckStair(P, G, den) {
  const d = G.d, v = new View(den, 'dstair'), D = d.D, jt = d.joistT, ny = d.deckH + I(16);
  v.lumber(D - jt, G.zBeamTop, D, G.zJoistTop, 'new'); v.rect(D - I(14), G.zJoistTop, D + I(0.75), d.deckH, 'new'); v.rect(D - I(14), G.zBeamTop, D - jt, G.zJoistTop, 'newF');
  const yEnd = dkStair(v, G); v.line(D - I(16), 0, D + I(2), 0, 'o');
  v.rect(G.yPad0, -d.padT, G.yPad1, 0, 'new', { fill: v.pat('conc') }); v.line(D + I(2), 0, G.yPad0, 0, 'o'); v.line(G.yPad1, 0, G.yPad1 + I(24), 0, 'o');
  v.poly([[yEnd - I(4.6), 0], [yEnd - I(7), 0], [yEnd - I(7), I(0.3)], [yEnd - I(4.9), I(0.3)], [yEnd - I(4.9), I(2.4)], [yEnd - I(4.6), I(2.4)]], 'steel', true);   // angle at the stringer toe
  v.dimV(0, d.deckH, D - I(24), D - I(14), { text: `${FMT(d.deckH, true)} V.I.F.` });
  v.dimH(D, yEnd, -d.padT - I(15), 0, { text: `${G.nT} TREADS` }); v.dimH(G.yPad0, G.yPad1, -d.padT - I(8), -d.padT); v.dimV(-d.padT, 0, G.yPad1 + I(8), G.yPad1);
  v.note('(N) ' + wrap(UP(d.stringerNote), 26), D + d.tread * 0.5, d.deckH - G.rise * 1.6, D + I(20), ny + I(11), { side: 'r', kind: 'N' });
  v.note('(N) ' + wrap(UP(d.treadNote), 26), D + d.tread * 1.5, d.deckH - G.rise * 2 + I(1), D + I(34), ny + I(2), { side: 'r', kind: 'N' });
  v.note('(N) ' + wrap(UP(d.riserNote), 26), D + d.tread * 2.6, d.deckH - G.rise * 3 + I(1), D + I(44), ny - I(16), { side: 'r', kind: 'N' });
  v.note('(N) ' + wrap(UP(d.toeNote), 22), yEnd - I(5.5), I(0.3), D + I(8), I(7), { side: 'l', kind: 'N' });
  v.note('(N) ' + wrap(UP(d.padNote), 22), G.yPad1 - I(1), -d.padT / 2, yEnd + I(22), I(12), { side: 'r', kind: 'N' });
  return v.svg();
}

// ------------------------------------------------------------------ isometric
function deckIso(P, G, o = {}) {
  const d = G.d, iso = new Iso(o.den || 30, o.id || 'diso'), m = Object.assign({ foot: 'new', posts: 'new', beams: 'new', joists: 'new', deck: 0.45, stair: 'new', guard: 'new' }, o.mode || {});
  const C = k => (k === 'new' ? PAL.newSolid : PAL.existSolid), h = d.post / 2, fr = d.footingDia / 2, sr = fr, L = d.L, D = d.D, jt = d.joistT, pad = I(18);
  iso.solid(-pad, L + pad, -d.gap, G.yPad1 + pad, -I(3), 0, o.quiet ? '#eceee9' : '#e2e7dc', { order: 0, stroke: '#b7bfae' });
  iso.solid(-pad, L + pad, -d.gap - I(8), -d.gap, -I(3), d.deckH + I(50), PAL.existSolid, { order: 0.5 });                                    // home wall, by others
  for (const p of G.posts) {
    if (m.foot) iso.solid(p.x - sr, p.x + sr, p.y - sr, p.y + sr, 0, d.stemTop, m.foot === 'new' ? shade(PAL.newSolid, 0.45) : PAL.slab, { order: 1 });
    if (m.posts) iso.solid(p.x - h, p.x + h, p.y - h, p.y + h, G.zBase, G.zPostTop, C(m.posts), { order: 2 });
  }
  if (m.beams) for (const y of G.yB) iso.solid(0, L, y - G.beamW / 2, y + G.beamW / 2, G.zPostTop, G.zBeamTop, C(m.beams), { order: 3 });
  if (m.joists) { for (const x of G.joists) iso.solid(x - jt / 2, x + jt / 2, jt, D - jt, G.zBeamTop, G.zJoistTop, C(m.joists), { order: 4 });
    iso.solid(0, L, 0, jt, G.zBeamTop, G.zJoistTop, C(m.joists), { order: 3.9 }); iso.solid(0, L, D - jt, D, G.zBeamTop, G.zJoistTop, C(m.joists), { order: 4.5 }); }
  if (m.deck) for (let x = 0; x + I(5.5) <= L * m.deck + 0.01; x += I(5.75)) iso.solid(x, x + I(5.5), 0, D, G.zJoistTop, d.deckH, m.deckAs === 'done' ? PAL.existSolid : shade(PAL.newSolid, 0.25), { order: 5 });
  if (m.stair) { for (let k = 0; k < G.nT; k++) { const y = D + k * d.tread, z = d.deckH - (k + 1) * G.rise; iso.solid(G.sx0, G.sx1, y, y + d.tread, Math.max(0, z - G.rise), z, C(m.stair), { order: 6 + k * 0.1 }); }
    iso.solid(G.sx0, G.sx1, G.yPad0, G.yPad1, 0, I(0.6), m.stair === 'new' ? shade(PAL.newSolid, 0.45) : PAL.slab, { order: 1 }); }
  if (m.guard) { const top = d.deckH + d.guardH, gp = I(3.5), cg = C(m.guard);
    for (const x of [0, L - gp]) { for (const y of [I(1), D - gp]) iso.solid(x, x + gp, y, y + gp, d.deckH, top, cg, { order: 7 }); iso.solid(x + I(1), x + I(2.5), I(1), D, top - I(1.5), top, cg, { order: 7.5 }); iso.solid(x + I(1), x + I(2.5), I(1), D, d.deckH + I(3), d.deckH + I(4.5), cg, { order: 7.2 }); } }
  return iso;
}
const DECK_STEPS = {
  footings: { foot: 'new', posts: 0, beams: 0, joists: 0, deck: 0, stair: 0, guard: 0 },
  frame:    { foot: 'done', posts: 'new', beams: 'new', joists: 'new', deck: 0, stair: 0, guard: 0 },
  decking:  { foot: 'done', posts: 'done', beams: 'done', joists: 'done', deck: 1, stair: 'new', guard: 0 },
  guards:   { foot: 'done', posts: 'done', beams: 'done', joists: 'done', deck: 1, deckAs: 'done', stair: 'done', guard: 'new' },
  all:      { deck: 1 },
};
const DECK = {
  derive: deckDerive,
  picture: (P, G, o) => deckIso(P, G, o),
  labels(P, G, iso) {
    const LB = lab(iso), d = G.d, L = d.L, D = d.D, left = -(L + I(18)) * 0.866, right = (G.yPad1 + I(18)) * 0.866, top = -(d.deckH + d.guardH) - I(34), bot = (L + G.yPad1) / 2 + I(30);
    LB('MANUFACTURED HOME WALL\nNO LEDGER, NO CONNECTION', [L * 0.7, -d.gap, d.deckH + I(40)], left * 0.9, top, { side: 'r' });
    LB(`(N) GUARD ${FMT(d.guardH)} MIN., EACH SIDE`, [L - I(2), D * 0.5, d.deckH + d.guardH], right * 0.25, top + I(10), { side: 'r', kind: 'N' });
    LB(`(N) ${d.joistName} JOISTS ON TWO\n${d.beamName} BEAMS`, [L, G.yB[1], G.zBeamTop - I(3)], left * 1.0, bot - I(40), { side: 'r', kind: 'N' });
    LB(`(N) ${d.postName} POSTS ON CONCRETE\nFOOTINGS, TYP. OF ${G.posts.length}`, [G.xP[1] + d.post / 2, G.yB[1], G.zPostTop / 2], left * 0.6, bot, { side: 'r', kind: 'N' });
    LB('(N) STAIR ON A CONCRETE PAD', [G.sx1, D + d.stairRun * 0.6, I(8)], right * 0.45, bot + I(10), { side: 'r', kind: 'N' });
  },
  stepPicture: (P, G, step, k) => deckIso(P, G, { den: 64, id: 'dst' + k, quiet: true, mode: DECK_STEPS[step.pic] || DECK_STEPS.all }).svg(),
  field: {
    pictureNote: 'Front entry shown. Rear entry is the same. Stair handrails not shown.',
    planHeight: 8.9, pictureDen: 30, coverDen: 30,
    plan:    { title: 'Framing and footing plan', den: 24, draw: deckPlan, note: 'Typical of 2 · front and rear entries' },
    section: { title: 'Section through deck and stair', den: 24, draw: deckSection },
    details: [
      { title: 'Footing and post base', den: 12, draw: deckFooting, note: 'Typical of 4 per deck' },
      { title: 'Joist, beam and post', den: 8, draw: deckBeam, note: 'Typical of 4 per deck' },
      { title: 'Guard post at beam', den: 12, draw: deckGuard, note: 'Each open side' },
      { title: 'Stair and stringer pad', den: 16, draw: deckStair },
    ],
  },
};

// ====================================================================== THE SET: one cover and three field sheets
const FOUND = {
  derive: foundDerive,
  picture: (P, G, o) => fdIso(P, G, o),
  labels(P, G, iso) {
    // laid out for the kit's isometric (sx = (y - x) × 0.866): the far end of the home is to the left, the near long wall to the right
    const g = P.geometry, L = g.L, W = G.W, pad = I(30), LB = (t, at, ex, ey, o) => iso.label(t, at, ex, ey, o);
    const left = -(L + pad) * 0.866, right = (W + pad) * 0.866, fy = (L + W) / 2 + pad - G.zPadBot, top = -G.zFloorTop - I(70), xs = G.fr.xs, bl = G.beams[G.beams.length - 1];
    LB('MANUFACTURED HOME FLOOR\n(SHOWN CUT AWAY)', [L * 0.2, W * 0.3, G.zFloorTop], right * 0.35, top, { side: 'r' });
    LB('FRAME I-BEAMS (HOME)', [L * 0.7, G.beams[1].y, G.zFloorBot], left * 0.55, top + I(30), { side: 'l' });
    LB(`(N) ${UP(g.wallName)} PERIMETER WALL\nON CONTINUOUS FOOTING`, [L * 0.08, W - g.wallT / 2, G.zAnch], right * 1.08, fy * 0.62, { side: 'r', kind: 'N' });
    LB(`(N) CMU PIERS ON CONCRETE PADS\n@ ${FMT(g.pierSpacing)} MAX. UNDER EACH I-BEAM`, [xs[2], bl.y + g.pierW / 2, G.zPadTop + g.pierH / 2], right * 0.55, fy + I(30), { side: 'r', kind: 'N' });
    LB(`(N) DIAGONAL FRAME TIES\n@ ${FMT(g.anchorSpacing)} MAX.`, [xs[xs.length - 2], (bl.y + W) / 2, (G.zFloorBot + G.zAnch) / 2], left * 0.62, fy + I(30), { side: 'l', kind: 'N' });
  },
  stepPicture: (P, G, step, k) => fdIso(P, G, { den: Math.ceil(fdSceneW(P, G) / 2.9), id: 'st' + k, quiet: true, mode: FD_STEPS[step.pic] || FD_STEPS.all }).svg(),
  field: {
    pictureNote: 'Backfill not shown. Floor and near walls cut away.',
    planHeight: 8.1, pictureHeight: 9.6,
    pictureDen: (P, G) => Math.ceil(fdSceneW(P, G) / 7.6), coverDen: (P, G) => Math.ceil(fdSceneW(P, sub(G, 'foundation')) / 6.2),
    plan:    { title: 'Foundation plan', den: 64, draw: fdPlan },
    section: { title: 'Section across the home', den: 32, draw: fdSection },
    side:    { title: 'Section along an I-beam', den: 96, draw: fdAlong, note: 'Typical of each I-beam' },
    details: [
      { title: 'Frame pier on pad', den: 16, draw: detailPier, note: (P, G) => 'Typical of ' + G.beams.length * G.fr.xs.length },
      { title: 'Frame tie and perimeter wall', den: 24, draw: detailTie, note: 'Each station, both sides' },
      { title: 'Marriage-line pier', den: 16, draw: detailMarriage, note: (P, G) => 'Typical of ' + G.ml.xs.length },
      { title: 'End tie', den: 24, draw: detailEndTie, note: 'Each end of each I-beam' },
    ],
  },
};
const VIEWS = { foundation: FOUND, site: SITE, deck: DECK };
const sub = (G, k) => (G && G[k]) || G;
const refsFor = (J, no) => { const R = { sheet: no, plan: 1, section: 2 }; let k = 3; if (J.field.side) R.side = k++; (J.field.details || []).forEach((d, j) => { R['d' + (j + 1)] = k + j; }); return R; };
const sheetNo = (P, key) => ((P.sheets || []).find(s => s.view === key) || {}).no || '';

// The cover and every cross-reference in the notes point at the foundation sheet.
const JOB = { type: 'manufactured-home',
  derive: P => ({ foundation: foundDerive(P), site: siteDerive(P), deck: deckDerive(P) }),
  picture: (P, G, o) => FOUND.picture(P, sub(G, 'foundation'), o), labels: (P, G, iso) => FOUND.labels(P, sub(G, 'foundation'), iso),
  stepPicture: FOUND.stepPicture, field: FOUND.field };
setRefs = function (P) { REF = refsFor(FOUND, sheetNo(P, 'foundation')); };
const _sheetField = sheetField;
sheetField = function (P, G, sh, i, n) {
  const key = sh.view || 'foundation', J = VIEWS[key], d = (P.sheetData || {})[key] || {}, keep = { picture: JOB.picture, labels: JOB.labels, stepPicture: JOB.stepPicture, field: JOB.field }, ref0 = REF;
  Object.assign(JOB, { picture: J.picture, labels: J.labels, stepPicture: J.stepPicture, field: J.field }); REF = refsFor(J, sh.no);
  const P2 = Object.assign({}, P, { facts: d.facts || P.facts, steps: d.steps || P.steps, summary: Object.assign({}, P.summary, d.summary || {}) });
  try { return _sheetField(P2, G[key], sh, i, n).replace(/What you are building/, d.pictureTitle || 'What you are building'); } finally { Object.assign(JOB, keep); REF = ref0; }
};
