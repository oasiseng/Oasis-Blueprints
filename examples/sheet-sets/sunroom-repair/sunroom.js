// sunroom.js — job-local drawing code for this project (kept beside the project file, not in the installed skill).
// Based on the kit's "sunroom" job type: a sloped roof on posts against a house. Changes for this job: (E) CMU wall,
// rafter-to-wall detail from the engineer's source detail, post cap, H2.5AZ ties, screen note, roofing product.
// Everything is drawn from PROJECT.geometry, in inches. x runs along the house (door end at left),
// y runs away from the house, z is up from the top of the slab.
// This file is also the worked example for writing a new job type: see JOB at the bottom.
'use strict';

// The kit's isometric is a mirror image (its x axis runs to the right). Corrected for this job so the picture matches the
// plan: seen from the yard, the door end and the sliding door are on the right, the window on the left.
Iso.prototype.p = function (x, y, z) { return [(y - x) * 0.8660254, (x + y) * 0.5 - z]; };

function derive(P) {
  const g = P.geometry, post = g.post, xl = -post / 2, xr = g.clearL + post / 2, yo = g.clearD + post / 2;
  const longX = [xl]; for (const b of g.longBays) longX.push(longX[longX.length - 1] + b);
  const cols = longX.map(x => ({ x, y: yo, line: 'front' }));
  cols.push({ x: xl, y: g.door[0] - post / 2, line: 'left' }, { x: xl, y: g.door[1] + post / 2, line: 'left' }, { x: xl, y: post / 2, line: 'left', atWall: true });
  cols.push({ x: xr, y: g.rightMid, line: 'right' }, { x: xr, y: post / 2, line: 'right', atWall: true });
  const rx0 = (g.clearL - g.roofL) / 2, rx1 = rx0 + g.roofL, slope = g.slopeRise / g.slopeRun, rb = y => g.h0 - slope * y, bt = rb(yo);
  const rafters = [], lookouts = [];
  if (g.overhang) {   // the roof overhangs the beams on the three open sides: an end rafter over each side beam, the others between them with equal end bays
    const a = xl - 0.75, b = xr + 0.75, n = Math.ceil((b - a) / g.rafterSpacing), e = ((b - a) - (n - 2) * g.rafterSpacing) / 2;
    rafters.push(a); for (let i = 0; i <= n - 2; i++) rafters.push(a + e + i * g.rafterSpacing); rafters.push(b);
    if (g.lookoutSpacing) for (let y = g.lookoutSpacing; y < g.roofD - 6; y += g.lookoutSpacing) lookouts.push(y);   // blocking that carries the side overhangs
  } else {
    let x = rx0 + 0.75, last = x;
    while (x < rx1 - 0.75 + 0.01) { rafters.push(x); last = x; x += g.rafterSpacing; }
    if (rx1 - 0.75 - last > 1) rafters.push(rx1 - 0.75);
  }
  return { xl, xr, yo, longX, cols, rx0, rx1, slope, rb, bt, rafters, lookouts, ex0: rafters[0] - 0.75, ex1: rafters[rafters.length - 1] + 0.75 };
}

// ------------------------------------------------------------------ 1  ROOF FRAMING PLAN
function viewPlan(P, G) {
  const g = P.geometry, v = new View(24, 'plan'), { xl, xr, yo, longX, cols, rx0, rx1, rafters } = G;
  const WT = g.wallT, L = g.clearL, D = g.clearD, RD = g.roofD, post = g.post, h = post / 2, FT = g.fasciaT || 0.75;
  const apx = d => g.overhang ? ftin(Math.round(d), true) : ftin(d);   // roof out-to-out comes from the scan plus the overhang: nearest inch, marked ±
  // house wall with openings
  let a = -22; const ops = g.openings.slice().sort((p, q) => p.x0 - q.x0);
  for (const op of ops.concat([{ x0: L + 22 }])) { v.rect(a, -WT, op.x0, 0, 'exw', { fill: v.pat('wall') }); a = op.x1; }
  for (const op of ops) { for (const y of [0, -WT / 2, -WT]) v.line(op.x0, y, op.x1, y, 'o2'); v.text(op.label, (op.x0 + op.x1) / 2, -WT - 7.5, { cls: 'ts', anchor: 'middle' }); }
  v.text('(E) RESIDENCE · CMU WALL', (ops[0].x1 + ops[1].x0) / 2, -WT - 15.5, { cls: 'tb', anchor: 'middle' });
  // existing beams below the rafters (dashed), ledger at the house
  v.rect(xl - h, yo - 1.5, xr + h, yo + 1.5, 'exh'); v.rect(xl - 1.5, 0, xl + 1.5, yo - 1.5, 'exh'); v.rect(xr - 1.5, 0, xr + 1.5, yo - 1.5, 'exh');
  v.rect(G.ex0, -1.5, G.ex1, 0, 'exh');   // (E) 2×8 blocking between the rafters, on the wall
  // new rafters, roof edge, new columns
  for (const x of rafters) v.rect(x - 0.75, -WT, x + 0.75, RD - FT, 'new');   // rafters bear on the (E) CMU wall
  for (const y of G.lookouts) { v.rect(rx0 + FT, y - 0.75, G.ex0, y + 0.75, 'ex'); v.rect(G.ex1, y - 0.75, rx1 - FT, y + 0.75, 'ex'); }   // blocking in the side overhangs
  if (g.fascia) { const fk = g.fasciaNew ? 'new' : 'ex'; v.rect(rx0, RD - FT, rx1, RD, fk); v.rect(rx0, 0, rx0 + FT, RD - FT, fk); v.rect(rx1 - FT, 0, rx1, RD - FT, fk); }   // fascia board at the roof edge, three sides
  else v.rect(rx0, 0, rx1, RD, 'o2');
  for (const c of cols) v.rect(c.x - h, c.y - h, c.x + h, c.y + h, 'newS');
  // door at the left end
  v.line(xl - 2, g.door[0], xl - 2 - 36, g.door[0], 'o'); v.arc(xl - 2, g.door[0], 36, 90, 180, 'o2');
  // rafter span and slope
  const ax = 150; v.line(ax, 6, ax, yo - 5, 'ld'); v.arrow(ax, 6, ax, 20); v.arrow(ax, yo - 5, ax, yo - 20);
  v.text(`(N) 2×8 ROOF RAFTERS @ ${g.rafterSpacing}" O.C.\nSIMPSON H2.5AZ AT BEAM, EVERY RAFTER\nBEAR ON (E) CMU WALL. SEE ${REF.d2} AND ${REF.d3}/${REF.sheet}`, ax + 5, 84, { cls: 'tN' });
  v.line(72, 38, 72, 64, 'o'); v.arrow(72, 64, 72, 38); { const sl = answer(P, 'slope'); v.text(sl ? 'SLOPE\n' + wrap(sl.toUpperCase(), 22) : 'SLOPE:\nCONFIRM', 76, 56, { cls: sl ? 'tb' : 'tR' }); }
  // dimensions: top
  const y1 = RD + 9, y2 = RD + 17, y3 = RD + 25;
  for (let i = 0; i < longX.length - 1; i++) v.dimH(longX[i], longX[i + 1], y1, yo + h, { text: 'EQ.' });
  v.dimH(xl, xr, y2, yo + h, { text: ftin(xr - xl) + ' C/C COLUMNS' });
  v.dimH(rx0, rx1, y3, RD, { text: apx(rx1 - rx0) + ' ROOF (OUT TO OUT)' });
  if (g.overhang) { v.dimH(rx0, G.ex0, y1, RD, { text: ftin(g.overhang) }); v.dimH(G.ex1, rx1, y1, RD, { text: ftin(g.overhang) }); }   // side overhangs: face of beam to the roof edge
  v.dimH(0, L, 24, 24, { text: ftin(L) + ' CLEAR (INSIDE OF COLUMNS)' });
  // left
  const xa = rx0 - (g.overhang ? 9 : 14), xb = g.overhang ? Math.min(rx0 - 20, xl - 2 - 36 - 4.5) : rx0 - 26;   // clear of the door swing
  v.dimV(0, g.door[0], xa, xl - h, { approx: true }); v.dimV(g.door[0], g.door[1], xa, xl - h, { text: '(E) ' + ftin(g.door[1] - g.door[0]) + ' DOOR' }); v.dimV(g.door[1], D, xa, xl - h, { approx: true });
  v.dimV(0, RD, xb, rx0, { text: apx(RD) + ' ROOF (OUT TO OUT)' });
  // right
  const xc = rx1 + (g.overhang ? 9 : 12), xd = rx1 + (g.overhang ? 19 : 23);
  v.dimV(0, g.rightMid, xc, xr + h, { approx: true }); v.dimV(g.rightMid, yo, xc, xr + h, { approx: true });
  if (g.overhang) v.dimV(yo + 1.5, RD, xc, xr + h, { text: ftin(g.overhang) });   // overhang: outer face of the beam to the roof edge
  v.dimV(0, D, xd, xr + h, { text: ftin(D) + ' CLEAR' });
  // bottom, along the house wall
  const yb = -WT - 26, xs = [0].concat(...ops.map(o => [o.x0, o.x1]), [L]);
  for (let i = 0; i < xs.length - 1; i++) v.dimH(xs[i], xs[i + 1], yb, -WT, { approx: i % 2 === 0 });
  // notes
  v.note(`(E) (2) 2×8 BUILT-UP BEAM TO REMAIN\nTYP. 3 SIDES. CHECK FOR ROT / WDO`, 92, yo, 30, 116, { side: 'r' });
  v.note(`(N) PT 4×4 COLUMN ON SIMPSON ABU44Z\nTYP. OF ${cols.length}. LONG SIDE: 4 EQ. BAYS,\n5'-0" O.C. NOMINAL. SEE ${REF.d1} AND ${REF.d2}/${REF.sheet}`, longX[3] - 1, yo - 2, 176, 119, { side: 'r', kind: 'N' });
  v.note(`(E) 2×8 BLOCKING BETWEEN RAFTERS\nON (E) CMU WALL. SEE ${REF.d3}/${REF.sheet}`, 232, -0.75, 222, 12, { side: 'l' });
  if (G.lookouts.length) v.note(`BLOCKING @ ${g.lookoutSpacing}" O.C. AT SIDE\nOVERHANGS, BOTH ENDS. V.I.F.`, (G.ex1 + rx1) / 2, G.lookouts[1], 236, 40, { side: 'l' });
  if (g.fascia) v.note(`${g.fasciaNew ? '(N) ' : ''}${g.fascia} FASCIA BOARD, 3 SIDES\nSEE ${REF.d2}/${REF.sheet}`, rx1 - FT / 2, 62, 236, 54, { side: 'l', kind: g.fasciaNew ? 'N' : '' });
  // section cut
  const sx = 103; v.line(sx, -WT - 3, sx, RD + 3, 'cutl'); v.line(sx, y3 + 5, sx, y3 + 12, 'cutl2'); v.line(sx, y3 + 12, sx + 8, y3 + 12, 'cutl2'); v.arrow(sx + 8, y3 + 12, sx, y3 + 12);
  v.bubble(sx - 10, y3 + 10, String(REF.section), REF.sheet);
  return v.svg();
}

// ------------------------------------------------------------------ 2  SECTION
function viewSection(P, G) {
  const g = P.geometry, v = new View(32, 'sect'), { yo, rb, bt, slope } = G, RD = g.rafterDepth, BD = g.beamDepth, h = g.post / 2, WT = g.wallT, top = rb(0);
  v.rect(0, -4, 152, 0, 'exw', { fill: v.pat('conc') }); v.line(152, -3, 178, -3, 'o2');
  v.rect(-WT, -4, 0, top, 'exw', { fill: v.pat('wall') });
  // roof: decking + roofing over the rafters
  const FT = g.fasciaT || 0.75, xt = g.roofD - FT;   // xt: end of the rafter
  if (g.fascia) { const e = g.roofD + 0.4; v.line(-WT, rb(-WT) + RD + 0.6, e, rb(e) + RD + 0.6, 'o2'); v.line(-WT, rb(-WT) + RD + 1.3, e, rb(e) + RD + 1.3, 'o'); v.line(e, rb(e) + RD + 1.3, e, rb(e) + RD - 1.2, 'o');
    v.rect(xt, rb(xt) + RD - (g.fasciaD || 9.25), g.roofD, rb(xt) + RD, g.fasciaNew ? 'new' : 'ex'); }   // fascia board at the rafter tails
  else { const e1 = g.roofD + 1, e2 = g.roofD + 1.5; v.line(-WT, rb(-WT) + RD + 0.6, e1, rb(e1) + RD + 0.6, 'o2'); v.line(-WT, rb(-WT) + RD + 1.3, e2, rb(e2) + RD + 1.3, 'o'); v.line(e2, rb(e2) + RD + 1.3, e2, rb(e2) - 0.5, 'o'); }
  v.poly([[-WT, rb(-WT)], [xt, rb(xt)], [xt, rb(xt) + RD], [-WT, rb(-WT) + RD]], 'new');
  v.poly([[-WT, rb(-WT) - 1.5], [-WT - 0.9, rb(-WT) + RD * 0.3], [-WT + 0.9, rb(-WT) + RD * 0.7], [-WT, rb(-WT) + RD + 2.5]], 'o2', false);
  v.lumber(-1.5, rb(0), 0, rb(0) + RD, 'ex');   // (E) 2×8 blocking between the rafters
  v.lumber(yo - 1.5, bt - BD, yo, bt, 'ex'); v.lumber(yo, bt - BD, yo + 1.5, bt, 'ex');
  v.rect(yo - h, 1, yo + h, bt - BD, 'new');
  v.rect(yo - 2.2, 0, yo + 2.2, 1, 'steel'); v.rect(yo - 2.05, 1, yo - h, 6.5, 'steel'); v.rect(yo + h, 1, yo + 2.05, 6.5, 'steel');
  v.rect(yo + 1.5, bt - 3, yo + 2.2, bt + 3.5, 'steel');
  if (g.railH) {   // between the columns: the decorative lattice on the inside, the 2×4 blocking over it, the screen on the outside
    v.rect(yo - 1.5, 1, yo - 0.9, g.railH, 'ex'); v.lumber(yo - 1.75, g.railH, yo + 1.75, g.railH + 1.5, 'ex');
    rawPath(v, [[yo + h + 0.6, 0], [yo + h + 0.6, bt - BD]], `fill:none;stroke:${PAL.exist};stroke-width:${sw(0.8)};stroke-dasharray:${sw(3)} ${sw(2)}`, false);
  }
  // slope symbol
  { const sl = answer(P, 'slope'); v.text(sl ? 'SLOPE ' + sl.toUpperCase() : 'ROOF SLOPE: CONFIRM', 112, rb(112) - 9, { cls: sl ? 'tb' : 'tR', anchor: 'middle' }); }
  // dimensions and levels
  v.dimH(0, yo, -10.5, -4, { text: `RAFTER SPAN ${ftin(yo, true)} (FACE OF WALL TO C.L. BEAM)` });
  v.dimH(0, g.clearD, 20, 20, { text: ftin(g.clearD) + ' CLEAR' });
  v.dimV(0, g.h0, 9, 0, { text: ftin(g.h0) + ' CLEAR' }); v.dimV(0, bt, yo - 15, yo - h, { text: ftin(bt) + ' CLEAR' });   // clear heights, floor to rafter, as given
  v.datum(`TOP OF (E) SLAB\n0'-0"`, -34, 0, -WT);
  v.datum(`B.O. (E) BEAM\n${ftin(bt - BD, true)}  V.I.F.`, 196, bt - BD, yo + 6);
  // notes
  { const nl = answer(P, 'nailing');
    const ey = rb(0) + RD + 17, sz = v.pt(TEXT_PT.t);
    if (nl) {
      v.note(`(N) ROOF SHEATHING: ${g.sheathing || 'APA RATED'}${g.sheathingClips ? ' WITH ' + g.sheathingClips.replace(/\.$/, '') : ''},\nNAILED ${nl.toUpperCase().replace(/(\d+)D\b/g, '$1d')}${REF.x1 ? `. SEE ${REF.x1}/${REF.sheet}` : ''}`, 30, rb(30) + RD + 1.3, 20, ey, { side: 'r', kind: 'N' });
      v.text(`${g.roofing || 'ROOFING'}`, 20 + v.pt(12), ey - sz * 0.34 - 2 * 1.2 * sz, { cls: 't' });
    } else v.note(`ROOF SHEATHING: THICKNESS AND NAILING, V.I.F.\n${g.roofing || 'ROOFING'}${P.project.relatedPermit ? '\nROOF REPAIR PERMIT ' + P.project.relatedPermit : ''}`, 30, rb(30) + RD + 1.3, 20, ey, { side: 'r' }); }
  v.note(`(N) 2×8 RAFTERS @ ${g.rafterSpacing}" O.C.`, 60, rb(60) + 3.5, 74, 70, { side: 'r', kind: 'N' });
  v.note(`RAFTER BEARS ON (E) CMU WALL\n(E) 2×8 BLOCKING. SEE ${REF.d3}/${REF.sheet}`, -0.75, rb(0) + 2.5, 20, 56, { side: 'r' });
  if (g.overhang) v.note(`(N) SIMPSON H2.5AZ, EVERY RAFTER\n${ftin(g.overhang)} OVERHANG. SEE ${REF.d2}/${REF.sheet}`, yo + 2.2, bt - 1.5, yo + 16, bt - 15, { side: 'r', kind: 'N' });
  else v.note(`(N) SIMPSON H2.5AZ, EVERY RAFTER\nSEE ${REF.d2}/${REF.sheet}`, yo + 2.2, bt + 2, yo + 16, bt + 14, { side: 'r', kind: 'N' });
  const colNote = answer(P, 'beamToColumn') ? `(N) PT 4×4 COLUMN\nPOST CAP AT BEAM. SEE ${REF.d2}/${REF.sheet}` : `(N) PT 4×4 COLUMN`, baseNote = `(N) SIMPSON ABU44Z\nSEE ${REF.d1}/${REF.sheet}`;
  if (g.railH) {
    v.note('(E) SCREEN, FULL HEIGHT, OUTSIDE,\nALL SIDES: REMOVE AND REPLACE\nBY CONTRACTOR', yo + h + 0.6, 64, yo + 16, 69, { side: 'r' });
    v.note(colNote, yo + h, 48, yo + 16, 49.5, { side: 'r', kind: 'N' });
    v.note(`(E) ${g.rail || '2×4'} HORIZONTAL BLOCKING AT ${ftin(g.railH, true)}` + (g.railNailing ? `:\nREINSTALL ON THE (N) COLUMNS,\n${g.railNailing}` : '\nBRACES THE COLUMNS'), yo + 1.75, g.railH + 0.75, yo + 16, 37, { side: 'r' });
    v.note('(E) DECORATIVE LATTICE, INSIDE,\nBETWEEN COLUMNS', yo - 1.2, 14, yo + 16, g.railNailing ? 19 : 24.5, { side: 'r' });
    v.note(baseNote, yo + 2.2, 3.5, yo + 16, g.railNailing ? 6.5 : 12, { side: 'r', kind: 'N' });
  } else { v.note(colNote, yo + h, 52, yo + 16, 60, { side: 'r', kind: 'N' }); v.note(baseNote, yo + 2.2, 3.5, yo + 16, 34, { side: 'r', kind: 'N' }); }
  v.note(g.slabT ? `(E) ${g.slabT}" CONC. SLAB\nTO REMAIN. V.I.F.` : `(E) CONC. SLAB / FOUNDATION\nVERIFY THICKNESS & CONDITION`, 100, -2, 92, 8, { side: 'l' });
  v.text('(E) CMU WALL', -WT / 2 + 1.4, 46, { cls: 'ts', anchor: 'middle', rot: 90 });
  return v.svg();
}

// ------------------------------------------------------------------ 3  FRONT ELEVATION (seen from the yard, so the door end is on the right)
// a diamond lattice fill, for the decorative lattice between the columns
function latticePat(v) {
  if (v.pats.lattice) return v.pats.lattice;
  const id = 'lattice-' + v.id, s = r3(7 * v.u), w = r3(0.9 * v.u);
  v.defs.push(`<pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${s}" height="${s}" fill="#fafbfc"/><path d="M0 0H${s}M0 0V${s}" stroke="${PAL.exist}" stroke-width="${w}" fill="none"/></pattern>`);
  return (v.pats.lattice = `url(#${id})`);
}
function viewElevation(P, G) {
  const g = P.geometry, v = new View(48, 'elev'), { xl, xr, longX, rx0, rx1, rb, bt, rafters } = G, RD = g.rafterDepth, BD = g.beamDepth, h = g.post / 2, L = g.clearL;
  const F = x => L - x, top = rb(0) + RD + 30, rh = rb(0) + RD + 1.3, xs = longX.map(F).reverse(), fN = !!g.fasciaNew;
  v.rect(F(rx1) - 14, 0, F(rx0) + 14, top, 'exb'); v.text('(E) RESIDENCE BEYOND', L / 2 + 30, top - 11, { cls: 'ts', anchor: 'middle' });
  v.rect(-10, -4, L + 10, 0, 'exw', { fill: v.pat('conc') }); v.line(F(rx1) - 30, -3, -10, -3, 'o2'); v.line(L + 10, -3, F(rx0) + 30, -3, 'o2');
  const ye = g.fascia ? rb(g.roofD - (g.fasciaT || 0.75)) : bt, ft = ye + RD;   // rafter bottom and top at the roof edge
  v.rect(F(rx1), ft + 1.3, F(rx0), rh, 'ex'); v.rect(F(rx1), ft, F(rx0), ft + 1.3, 'ex');
  v.rect(F(xr) - h, bt - BD, F(xl) + h, bt, 'ex');
  // (E) decorative lattice on the inside, and the 2×4 blocking over it, between the columns
  if (g.railH) for (let i = 0; i < xs.length - 1; i++) { v.rect(xs[i] + h, 1, xs[i + 1] - h, g.railH, 'exb', { fill: latticePat(v) }); v.rect(xs[i] + h, g.railH, xs[i + 1] - h, g.railH + 1.5, 'ex'); }
  if (g.fascia) v.rect(F(rx1), ft - (g.fasciaD || 9.25), F(rx0), ft, fN ? 'new' : 'ex');   // fascia board in front of the rafter tails
  for (const x of rafters) v.rect(F(x) - 0.75, ye, F(x) + 0.75, ft, g.fascia ? 'newH' : 'new');
  for (const x of longX) { v.rect(F(x) - h, 1, F(x) + h, bt - BD, 'new'); v.rect(F(x) - 2.2, 0, F(x) + 2.2, 1, 'steel'); }
  for (let i = 0; i < xs.length - 1; i++) v.dimH(xs[i], xs[i + 1], -17, -4, { text: 'EQ.' });
  v.dimH(F(rx1), F(rx0), -30, -4, { text: (g.overhang ? ftin(Math.round(rx1 - rx0), true) : ftin(rx1 - rx0)) + ' ROOF (OUT TO OUT)' });
  const dx = F(rx1) - 30;
  v.datum(`B.O. (E) BEAM\n${ftin(bt - BD, true)}  V.I.F.`, dx, bt - BD, F(xr) - h); v.datum(`TOP OF (E) SLAB\n0'-0"`, dx, 0, -10);
  v.note(`(N) 2×8 RAFTERS\n@ ${g.rafterSpacing}" O.C.` + (g.fascia ? ', BEYOND' : ''), F(rafters[13]), ye + 3.6, F(rafters[13]) - 8, rh + 15, { side: 'r', kind: 'N' });
  if (g.fascia) v.note(`${fN ? '(N) ' : ''}${g.fascia} FASCIA BOARD`, xs[3] + 26, ft - 4.6, xs[3] + 18, rh + 15, { side: 'r', kind: fN ? 'N' : '' });
  if (g.railH) {   // the lower part of each bay is lattice: notes sit above the blocking, and the detail of it is on the section
    v.note(`(E) SCREEN,\nFULL HEIGHT,\nOUTSIDE.\nSEE ${REF.section}/${REF.sheet}`, xs[0] + 22, 67, xs[0] + 9, 78, { side: 'r' });
    v.note('(N) PT 4×4\nCOLUMN ON\nABU44Z, TYP.', xs[1] + h, 50, xs[1] + 9, 64, { side: 'r', kind: 'N' });
    v.note('(E) (2) 2×8\nBEAM', xs[2] + 14, bt - 5, xs[2] + 9, 72, { side: 'r' });
    v.note(`(E) ${g.rail || '2×4'} BLKG.\nAND LATTICE.\nSEE ${REF.section}/${REF.sheet}`, xs[3] + 30, g.railH + 0.75, xs[3] + 9, 64, { side: 'r' });
  } else {
    v.note('(N) PT 4×4\nCOLUMN, TYP.', xs[1] + h, 46, xs[1] + 9, 56, { side: 'r', kind: 'N' });
    v.note('(E) (2) 2×8\nBEAM', xs[2] + 12, bt - 3.6, xs[2] + 8, 64, { side: 'r' });
    v.note('(N) ABU44Z\nBASE, TYP.', xs[3] + 2.2, 0.5, xs[3] + 9, 16, { side: 'r', kind: 'N' });
    v.note('(E) SCREEN, ALL SIDES:\nREMOVE AND REPLACE\nBY CONTRACTOR', xs[0] + 18, 34, xs[0] + 8, 26, { side: 'r' });
  }
  return v.svg();
}

// ------------------------------------------------------------------ drafting helpers for the large-scale details
// Raw SVG in model units (y is up, as in View). Line weights go through --u, so they print the same at every scale.
// Convention used below: a part that is cut or seen edge-on is solid dark; a plate seen face-on is light with an outline.
const sw = n => `calc(var(--u) * ${n}px)`;
const dPath = (pts, close) => 'M' + pts.map(p => r3(p[0]) + ' ' + r3(-p[1])).join('L') + (close ? 'Z' : '');
function rawPath(v, pts, style, close) { for (const p of pts) v.ext(p[0], p[1]); v.out.push(`<path d="${dPath(pts, close)}" style="${style}"/>`); return v; }
function rawDot(v, x, y, r, style) { v.ext(x - r, y - r); v.ext(x + r, y + r); v.out.push(`<circle cx="${r3(x)}" cy="${r3(-y)}" r="${r3(r)}" style="${style}"/>`); return v; }
const METAL = `fill:#e9ecf0;stroke:${PAL.steel};stroke-width:${sw(0.9)};stroke-linejoin:round`, HOLE = `fill:#fff;stroke:${PAL.steel};stroke-width:${sw(0.6)}`;
// wood grain along a member seen from the side. a -> b is one edge, `across` is the vector to the other edge.
function grain(v, a, b, across, fr, kind, amp = 1) {
  const n = 24, st = `fill:none;stroke:${kind === 'N' ? PAL.new : PAL.exist};stroke-opacity:${kind === 'N' ? 0.3 : 0.5};stroke-width:${sw(0.4)};stroke-linecap:round;stroke-linejoin:round`;
  fr.forEach((f, i) => {
    const t0 = 0.03 * ((i * 7) % 3), t1 = 1 - 0.035 * ((i * 5) % 3), pts = [];
    for (let k = 0; k <= n; k++) {
      const t = t0 + (t1 - t0) * k / n, w = f + amp * (0.022 * Math.sin(6.283 * (t * (1.1 + 0.37 * (i % 3)) + 0.31 * i)) + 0.009 * Math.sin(6.283 * (t * 3.3 + 0.17 * i)));
      pts.push([a[0] + (b[0] - a[0]) * t + across[0] * w, a[1] + (b[1] - a[1]) * t + across[1] * w]);
    }
    rawPath(v, pts, st, false);
  });
}
// break lines: the member or the slab carries on past this point
function breakV(v, x, ya, yb, e = 0.45) { const m = (ya + yb) / 2; return v.poly([[x, ya - e], [x, m - 0.4], [x - 0.36, m - 0.14], [x + 0.36, m + 0.14], [x, m + 0.4], [x, yb + e]], 'o2', false); }
function breakH(v, xa, xb, y, e = 0.6) { const m = (xa + xb) / 2; return v.poly([[xa - e, y], [m - 0.45, y], [m - 0.15, y + 0.5], [m + 0.15, y - 0.5], [m + 0.45, y], [xb + e, y]], 'o2', false); }
// earth below a slab on grade
function earth(v, x0, x1, y, d) {
  const st = `fill:none;stroke:${PAL.exist};stroke-width:${sw(0.5)};stroke-linecap:round`, run = d - 0.24; let k = 0;
  for (let x = x0; x + run + 0.56 <= x1; x += run + 0.86, k++) for (let i = 0; i < 3; i++) {
    const o = x + i * 0.28;
    rawPath(v, k % 2 ? [[o, y - d + 0.12], [o + run, y - 0.12]] : [[o, y - 0.12], [o + run, y - d + 0.12]], st, false);
  }
}
// fasteners, schematic: a nail driven down from (x, y); a nail driven sideways; a masonry screw driven in +x
function nailDown(v, x, y, len, w = 0.9) {
  rawPath(v, [[x, y], [x, y - len]], `fill:none;stroke:${PAL.new};stroke-width:${sw(w)}`, false);
  return rawPath(v, [[x - 0.17, y], [x + 0.17, y]], `fill:none;stroke:${PAL.new};stroke-width:${sw(w + 0.6)}`, false);
}
function nailSide(v, x, y, dir, len, col = PAL.steel) {
  rawPath(v, [[x, y], [x + dir * len, y]], `fill:none;stroke:${col};stroke-width:${sw(0.7)}`, false);
  return rawPath(v, [[x, y - 0.17], [x, y + 0.17]], `fill:none;stroke:${col};stroke-width:${sw(1.4)}`, false);
}
function screwIn(v, x, y, len) {
  v.rect(x - 0.2, y - 0.2, x, y + 0.2, 'steel');
  rawPath(v, [[x, y], [x + len, y]], `fill:none;stroke:${PAL.steel};stroke-width:${sw(0.9)}`, false);
  for (let t = 0.4; t < len - 0.1; t += 0.3) rawPath(v, [[x + t - 0.07, y - 0.13], [x + t + 0.07, y + 0.13]], `fill:none;stroke:${PAL.steel};stroke-width:${sw(0.45)}`, false);
  return v;
}

// ------------------------------------------------------------------ 4  COLUMN BASE
// Two views of the same base. Left: elevation, the strap seen face-on. Right: section through the anchor.
// The connector is drawn to the maker's overall size (ABU44Z: 3 9/16 in. wide, 5 1/2 in. straps, 1 in. standoff); its
// fastener pattern is schematic. Anchor diameter and embedment are the engineer's values, from geometry.
const refSheet = P => ((P.sheets || []).find(x => x.type === 'figures') || {}).no;   // sheet of the engineer's standard details, if any

function detailBase(P, G) {
  const g = P.geometry, v = new View(4, 'base'), h = g.post / 2, RS = refSheet(P), ST = g.slabT || 4, top = 12.4, xb = -13.4, ex = 8;
  const anc = answer(P, 'anchor'), rod = answer(P, 'anchorRod'), emb = g.anchorEmbed || 2, rd = (g.anchorDia || 0.625) / 2, conc = v.pat('conc');
  const ground = (cx, w) => {   // (E) slab on grade, broken both sides
    rawPath(v, [[cx - w, -ST], [cx + w, -ST], [cx + w, 0], [cx - w, 0]], `fill:${conc};stroke:none`, true);
    v.line(cx - w, 0, cx + w, 0, 'exw'); v.line(cx - w, -ST, cx + w, -ST, 'exw');
    earth(v, cx - w + 0.25, cx + w - 0.25, -ST, 1.1);
    breakV(v, cx - w, -ST, 0); breakV(v, cx + w, -ST, 0);
  };
  const post = cx => {          // (N) PT 4×4, broken at the top
    rawPath(v, [[cx - h, 1], [cx + h, 1], [cx + h, top], [cx - h, top]], `fill:${PAL.newFill};stroke:none`, true);
    grain(v, [cx - h, 1.15], [cx - h, top - 0.1], [2 * h, 0], [0.14, 0.31, 0.48, 0.64, 0.81], 'N');
    v.line(cx - h, 1, cx - h, top, 'new'); v.line(cx + h, 1, cx + h, top, 'new');
    breakH(v, cx - h, cx + h, top, 0.5);
  };

  // ---- elevation: strap face
  ground(xb, 3.4); post(xb);
  rawPath(v, [[xb - 1.5, 0], [xb + 1.5, 0], [xb + 1.5, 6.1], [xb + 1.1, 6.5], [xb - 1.1, 6.5], [xb - 1.5, 6.1]], METAL, true);
  v.line(xb - 1.5, 1, xb + 1.5, 1, 'o2');
  for (const [x, y] of [[-0.9, 1.9], [0.9, 1.9], [-0.9, 3.75], [0.9, 3.75], [-0.9, 5.6], [0.9, 5.6]]) rawDot(v, xb + x, y, 0.11, HOLE);
  for (const y of [2.8, 4.7]) rawDot(v, xb, y, 0.27, HOLE);
  if (g.slabT) v.dimV(-ST, 0, xb - 4.7, xb - 3.4, { text: `${g.slabT}" V.I.F.` });
  v.text('ELEVATION', xb, -ST - 2.3, { cls: 'td', anchor: 'middle' });

  // ---- section through the anchor
  ground(0, 6.2);
  if (anc) {                    // drilled hole filled with adhesive, then the rod
    rawPath(v, [[-rd - 0.19, 0], [rd + 0.19, 0], [rd + 0.19, -emb - 0.2], [-rd - 0.19, -emb - 0.2]], `fill:#a9c6f7;stroke:${PAL.new};stroke-width:${sw(0.5)}`, true);
    rawPath(v, [[-rd, -emb], [rd, -emb], [rd, 0.87], [-rd, 0.87]], `fill:#fff;stroke:${PAL.new};stroke-width:${sw(0.9)}`, true);
    for (let y = -emb + 0.1; y < -0.08; y += 0.2) rawPath(v, [[-rd, y], [rd, y + 0.1]], `fill:none;stroke:${PAL.new};stroke-width:${sw(0.4)}`, false);
  }
  post(0);
  v.rect(-h - 0.11, 0, -h, 6.5, 'steel'); v.rect(h, 0, h + 0.11, 6.5, 'steel');        // straps and base sides, edge-on
  v.rect(-h, 0, h, 0.11, 'steel'); v.rect(-h, 0.89, h, 1, 'steel');                  // base plate and the standoff seat
  [[-1, 2.1], [1, 2.9], [-1, 3.7], [1, 4.5], [-1, 5.3], [1, 6.0]].forEach(([d, y]) => nailSide(v, d * (h + 0.11), y, -d, 1.3));
  if (anc) {
    v.rect(-0.85, 0.11, 0.85, 0.24, 'steel');                                         // washer
    rawPath(v, [[-rd * 1.5, 0.24], [rd * 1.5, 0.24], [rd * 1.5, 0.24 + rd * 1.7], [-rd * 1.5, 0.24 + rd * 1.7]], HOLE, true);   // nut
    for (const x of [-rd * 0.64, rd * 0.64]) rawPath(v, [[x, 0.24], [x, 0.24 + rd * 1.7]], `fill:none;stroke:${PAL.steel};stroke-width:${sw(0.45)}`, false);
  } else { v.line(0, 1.7, 0, -3.6, 'anch'); v.line(-0.55, 1.7, 0.55, 1.7, 'anch'); }
  v.dimV(0, 1, -3.5, -h - 0.2, { text: '1"' });
  if (anc && g.anchorEmbed) v.dimV(-emb, 0, -7.4, -0.6, { text: `${g.anchorEmbed}" MIN.` });
  v.text('SECTION', 0, -ST - 2.3, { cls: 'td', anchor: 'middle' });

  // notes, one column on the right
  v.note('(N) PT 4×4 COLUMN', h, 10.6, ex, 11.4, { kind: 'N' });
  v.note('(N) SIMPSON ABU44Z STANDOFF BASE\nMFR. FASTENERS TO COLUMN' + (RS ? `\nSEE ALSO 4/${RS}` : ''), h + 0.11, 5.4, ex, 7.9, { kind: 'N' });
  v.note(anc ? 'ANCHOR TO (E) CONCRETE:\n' + wrap(anc.toUpperCase(), 38) : 'ANCHOR TO (E) CONCRETE:\nTYPE, SIZE, EMBEDMENT, EDGE DISTANCE', anc ? 0.42 : 0, anc ? -0.9 : -2.2, ex, 1.6, { kind: anc ? 'N' : 'R' });
  if (anc) v.note(rod ? wrap('ANCHOR ROD: ' + rod.toUpperCase(), 38) : 'ANCHOR ROD: DIAMETER\nAND EMBEDMENT', rd, -1.7, ex, -2.3, { kind: rod ? 'N' : 'R' });
  v.note(g.slabT ? `(E) ${g.slabT}" CONC. SLAB TO REMAIN. V.I.F.` : '(E) CONC. SLAB / FOUNDATION\nVERIFY THICKNESS & CONDITION', 5, -3.1, ex, -4.3, {});
  return v.svg();
}

// ------------------------------------------------------------------ 5  RAFTER / BEAM / COLUMN
function detailBeam(P, G) {
  const g = P.geometry, v = new View(4, 'beam'), h = g.post / 2, RD = g.rafterDepth, BD = g.beamDepth, s = G.slope, ct = 2.2, bt = ct + BD, sh = g.sheathingT || 0.44, rf = 0.24, cap = sh + 0.05 + rf, RS = refSheet(P);
  const OH = g.overhang || 0, FT = g.fascia ? (g.fasciaT || 1.5) : 0, FD = g.fasciaD || 9.25;
  // x = 0 is the centre of the beam, 1.5 its outer face. The overhang runs from that face to the roof edge (the outside of the fascia).
  const x0 = -12.5, xe = OH ? 1.5 + OH : 2.95, x1 = OH ? xe - FT : 2.25;   // xe: roof edge, x1: end of the rafter
  const rb = x => bt - x * s, rtop = x => rb(x) + RD, nail = answer(P, 'nailing');
  // (N) PT 4×4 column, broken below
  rawPath(v, [[-h, 0], [h, 0], [h, ct], [-h, ct]], `fill:${PAL.newFill};stroke:none`, true);
  grain(v, [-h, 0.1], [-h, ct - 0.1], [2 * h, 0], [0.2, 0.45, 0.72], 'N', 0.3);
  v.line(-h, 0, -h, ct, 'new'); v.line(h, 0, h, ct, 'new'); v.line(-h, ct, h, ct, 'new');
  breakH(v, -h, h, 0, 0.5);
  // (E) (2) 2×8 built-up beam, cut
  v.lumber(-1.5, ct, 0, bt, 'ex'); v.lumber(0, ct, 1.5, bt, 'ex');
  // (N) rafter beyond, bearing on the beam, broken at the left
  rawPath(v, [[x0, rb(x0)], [x1, rb(x1)], [x1, rtop(x1)], [x0, rtop(x0)]], `fill:${PAL.newFill};stroke:none`, true);
  grain(v, [x0 + 0.3, rb(x0 + 0.3)], [x1 - 0.2, rb(x1 - 0.2)], [0, RD], [0.12, 0.27, 0.43, 0.58, 0.74, 0.89], 'N');
  v.poly([[x0, rb(x0)], [x1, rb(x1)], [x1, rtop(x1)], [x0, rtop(x0)]], 'new', false);
  // fascia board at the rafter tails, cut
  if (FT) { v.lumber(x1, rtop(x1) - FD, xe, rtop(x1), g.fasciaNew ? 'new' : 'ex'); if (g.fasciaNailing) for (const d of [2.2, 5.1]) nailSide(v, xe, rtop(x1) - d, -1, 3.5, PAL.new); }
  // sheathing and roofing to the roof edge
  v.poly([[x0, rtop(x0)], [xe, rtop(xe)], [xe, rtop(xe) + sh], [x0, rtop(x0) + sh]], nail ? 'new' : 'ex');
  rawPath(v, [[x0, rtop(x0) + sh + 0.05], [xe + 0.25, rtop(xe) + sh + 0.05], [xe + 0.25, rtop(xe) + cap], [x0, rtop(x0) + cap]], `fill:${PAL.ink};fill-opacity:.82;stroke:none`, true);
  v.line(xe + 0.25, rtop(xe) + cap, xe + 0.25, FT ? rtop(xe) - 1.1 : rb(x1) - 0.4, 'o');
  breakV(v, x0, rb(x0), rtop(x0) + cap);
  // H2.5AZ: one leg on the face of the beam, seen edge-on, the other on the side of the rafter. Fasteners schematic
  { const xs = 1.5, tw = 0.7, y0 = bt - 2.4, y1 = bt - 0.1, y2 = bt + 0.8, y3 = bt + 3, f = (x, y) => r3(x) + ' ' + r3(-y);
    v.rect(xs, y0, xs + 0.12, y1, 'steel');
    for (const y of [bt - 1.9, bt - 0.9]) nailSide(v, xs + 0.12, y, -1, 1.2);
    v.out.push(`<path class="steel" d="M${f(xs, y1)}C${f(xs, y1 + 0.45)} ${f(xs - tw, y2 - 0.45)} ${f(xs - tw, y2)}L${f(xs + tw, y2)}C${f(xs + tw, y2 - 0.45)} ${f(xs + 0.12, y1 + 0.45)} ${f(xs + 0.12, y1)}Z"/>`);
    v.rect(xs - tw, y2, xs + tw, y3, 'steel');
    [[-0.35, 0.45], [0.35, 0.85], [-0.35, 1.25], [0.35, 1.65]].forEach(([dx, dy]) => rawDot(v, xs + dx, y2 + dy, 0.11, 'fill:#fff;stroke:none')); }
  const bc = answer(P, 'beamToColumn');
  if (bc) for (const k of [-1, 1]) {   // post cap, shown schematically: side plates on the column and the beam, seat between
    v.rect(k * h, ct - 2.6, k * (h + 0.16), ct, 'steel'); v.rect(k * 1.5, ct, k * 1.66, ct + 3, 'steel'); v.rect(k * 1.5, ct - 0.16, k * (h + 0.16), ct, 'steel');
  }
  const shNote = nail ? `(N) ROOF SHEATHING, ROOFING OVER\nSEE ${REF.d3}/${REF.sheet}` : 'ROOF SHEATHING + ROOFING', hNote = '(N) SIMPSON H2.5AZ AT EVERY RAFTER\nMFR. FASTENERS' + (REF.x2 ? `. SEE ALSO ${REF.x2}/${REF.sheet}` : RS ? `. SEE ALSO 2, 3/${RS}` : '');
  const beamNote = '(E) (2) 2×8 BUILT-UP BEAM TO REMAIN\nCHECK FOR ROT / WDO', bcNote = bc ? 'BEAM TO COLUMN:\n' + wrap(bc.toUpperCase(), 38) : 'BEAM-TO-COLUMN CONNECTION';
  v.note(`(N) 2×8 RAFTER @ ${g.rafterSpacing}" O.C.`, -9, rb(-9) + 2.4, -6.6, bt - 2.6, { side: 'l', kind: 'N' });
  v.note('(N) PT 4×4 COLUMN', -h, 1.0, -6.6, 0.6, { side: 'l', kind: 'N' });
  if (OH) {   // the tail runs out over the right-hand notes: overhang dimension above the roof, sheathing note at the top left, the rest under the tail
    const yd = rtop(1.5) + cap + 1.3;
    v.dimH(1.5, xe, yd, yd - 0.55, { text: `${ftin(OH)} OVERHANG` });
    v.line(1.5, bt + 3.15, 1.5, yd - 0.5, 'dm'); v.line(xe, rtop(xe) + cap + v.pt(2.5), xe, yd - 0.5, 'dm');   // from the face of the beam, and from the roof edge
    v.note(shNote, -3, rtop(-3) + sh / 2, -5.2, bt + 9.5, { side: 'l', kind: nail ? 'N' : '' });
    if (FT) v.note(`${g.fasciaNew ? '(N) ' : ''}${g.fascia} FASCIA BOARD` + (g.fasciaNailing ? '\n' + g.fasciaNailing : '') + (RS ? `\nSEE ALSO 2/${RS}` : ''), xe, rtop(x1) - FD * 0.72, xe + 1.9, bt + 2.2, { side: 'r', kind: g.fasciaNew ? 'N' : '' });
    v.note(hNote, 1.62, bt - 2.1, 4.6, ct + 3.8, { kind: 'N' });
    v.note(beamNote, 0.75, ct + 3.9, 4.6, ct + 1.4, {});
    v.note(bcNote, h, ct - 0.3, 4.6, ct - 1.6, { kind: bc ? 'N' : 'R' });
  } else {
    v.note(shNote, -3, rtop(-3) + sh / 2, 4.6, bt + 9.4, { side: 'r', kind: nail ? 'N' : '' });
    v.note(hNote, 2.2, bt + 2.2, 4.6, bt + 6.6, { kind: 'N' });
    v.note(beamNote, 1.5, ct + 3.2, 4.6, ct + 2.4, {});
    v.note(bcNote, h, ct - 0.3, 4.6, ct - 2.4, { kind: bc ? 'N' : 'R' });
  }
  return v.svg();
}

// ------------------------------------------------------------------ 6  RAFTER AT EXISTING CMU WALL
// Per the engineer (2026-11-12): the rafters rest on the CMU wall, the 2×8 at the wall is blocking between rafters, no hangers.
// Rafter to wall: Simpson MTSM16, H2.5A or equivalent. Concealed, to be verified in field.
// The view is cut between two rafters: the blocking is cut, the rafter is seen beyond it. The tie is drawn as the MTSM16
// twist strap, to its overall size (16 in. long, 1 1/4 in. wide): one leg flat on the wall face, seen edge-on, then the
// twist, then the other leg flat on the side of the rafter. Its fastener pattern is schematic.
function detailHouse(P, G) {
  const g = P.geometry, v = new View(4, 'house'), RD = g.rafterDepth, s = G.slope, WT = g.wallT, wt = 10, x0 = -WT - 2.2, x1 = 9.6, sh = g.sheathingT || 0.44, rf = 0.24, RS = refSheet(P), ex = x1 + 1.2;
  const nail = answer(P, 'nailing'), rb = x => wt - x * s, rt = x => rb(x) + RD, cap = sh + 0.05 + rf;
  // (E) CMU wall in section, one bed joint showing, broken at the bottom
  rawPath(v, [[-WT, 0], [0, 0], [0, wt], [-WT, wt]], `fill:${v.pat('wall')};stroke:none`, true);
  for (const y of [wt - 7.625, wt - 8]) rawPath(v, [[-WT, y], [0, y]], `fill:none;stroke:${PAL.exist};stroke-width:${sw(0.5)}`, false);
  v.poly([[-WT, 0], [-WT, wt], [0, wt], [0, 0]], 'exw', false);
  breakH(v, -WT, 0, 0);
  // (N) rafter beyond, bearing on the wall, broken both ends
  rawPath(v, [[x0, rb(x0)], [x1, rb(x1)], [x1, rt(x1)], [x0, rt(x0)]], `fill:${PAL.newFill};stroke:none`, true);
  grain(v, [x0 + 0.3, rb(x0 + 0.3)], [x1 - 0.3, rb(x1 - 0.3)], [0, RD], [0.12, 0.27, 0.43, 0.58, 0.74, 0.89], 'N');
  v.line(x0, rb(x0), x1, rb(x1), 'new'); v.line(x0, rt(x0), x1, rt(x1), 'new');
  // sheathing, then the roofing over it
  v.poly([[x0, rt(x0)], [x1, rt(x1)], [x1, rt(x1) + sh], [x0, rt(x0) + sh]], nail ? 'new' : 'ex');
  rawPath(v, [[x0, rt(x0) + sh + 0.05], [x1, rt(x1) + sh + 0.05], [x1, rt(x1) + cap], [x0, rt(x0) + cap]], `fill:${PAL.ink};fill-opacity:.82;stroke:none`, true);
  breakV(v, x0, rb(x0), rt(x0) + cap); breakV(v, x1, rb(x1), rt(x1) + cap);
  // sheathing nails into the rafter, at the spacing given (shown at 6 in.)
  if (nail) for (const x of [-4.2, 2.4, 8.4]) nailDown(v, x, rt(x) + sh, 1.8, 0.7);
  // (E) 2×8 blocking between the rafters, cut
  v.lumber(-1.5, wt, 0, wt + RD, 'ex');
  if (nail) nailDown(v, -0.75, rt(-0.75) + sh, 3, 1.3); else v.line(-0.75, rt(-0.75) + sh, -0.75, wt + RD - 1.6, 'anch');
  // rafter-to-wall tie: twist strap
  { const xs = -WT, tw = 0.625, y0 = wt - 8.2, y1 = wt - 0.2, y2 = wt + 1.8, y3 = wt + 7, f = (x, y) => r3(x) + ' ' + r3(-y);
    v.rect(xs - 0.12, y0, xs, y1, 'steel');
    for (const y of [wt - 7.3, wt - 5.5, wt - 3.7, wt - 1.9]) screwIn(v, xs - 0.12, y, 2.25);
    v.ext(xs - tw, y1); v.ext(xs + tw, y2);
    v.out.push(`<path class="steel" d="M${f(xs - 0.12, y1)}C${f(xs - 0.12, y1 + 1)} ${f(xs - tw, y2 - 1)} ${f(xs - tw, y2)}L${f(xs + tw, y2)}C${f(xs + tw, y2 - 1)} ${f(xs, y1 + 1)} ${f(xs, y1)}Z"/>`);
    v.rect(xs - tw, y2, xs + tw, y3, 'steel');
    [0.5, 1.25, 2, 2.75, 3.5, 4.25, 4.9].forEach((d, i) => rawDot(v, xs + (i % 2 ? 0.24 : -0.24), y2 + d, 0.11, 'fill:#fff;stroke:none')); }

  // notes, right
  v.note('ROOFING (SEPARATE PERMIT)', 9, rt(9) + cap, ex, wt + 8.9, { side: 'r' });
  if (nail) {
    v.note(wrap('(N) ROOF SHEATHING: ' + (g.sheathing || 'APA RATED') + (g.sheathingClips ? ' WITH ' + g.sheathingClips.replace(/\.$/, '') : '') + ', NAILED ' + nail.toUpperCase().replace(/(\d+)D\b/g, '$1d'), 37), x1 - 0.8, rt(x1 - 0.8) + sh / 2, ex, rt(x1 - 0.8) + sh / 2, { side: 'r', kind: 'N' });
    if (g.blockingNailing) v.note(`SHEATHING TO BLOCKING: NAILS\n@ ${g.blockingNailing}`, -0.75, wt + RD - 1.4, ex, wt + 3.5, { side: 'r', kind: 'N' });
  }
  else {
    v.note('ROOF SHEATHING: THICKNESS\nAND NAILING, V.I.F.', x1 - 0.8, rt(x1 - 0.8) + sh / 2, ex, rt(x1 - 0.8) + sh / 2, { side: 'r' });
    v.note('EDGE NAILING (E.N.):\nSIZE AND SPACING' + (RS ? `. SEE 1/${RS}` : ''), -0.75, wt + RD - 0.6, ex, wt + 4.2, { side: 'r', kind: 'R', mark: 'none' });
  }
  v.note(`(N) 2×8 RAFTER @ ${g.rafterSpacing}" O.C.\nBEARS ON (E) CMU WALL`, 8.4, rb(8.4) + 2.2, ex, wt + 1.2, { side: 'r', kind: 'N' });
  v.note('(E) 2×8 BLOCKING BETWEEN\nRAFTERS, TO REMAIN', -0.75, wt + 2.3, 3.2, wt - 3.6, { side: 'r' });
  v.note('(E) CMU WALL', -2.6, 3.4, 3.2, 2.6, { side: 'r' });
  // notes, left
  v.note('RAFTER TO (E) CMU WALL:\nSIMPSON MTSM16, H2.5A\nOR EQUIVALENT. CONCEALED,\nV.I.F.' + (RS ? ` SEE ALSO 5/${RS}` : ''), -WT - 0.12, wt - 4.6, x0 - 1, wt - 1.6, { side: 'l', kind: 'N' });
  return v.svg();
}

// ------------------------------------------------------------------ 7  TYPICAL HORIZONTAL DIAPHRAGM
// The engineer's standard detail, redrawn. Not to scale. The labels are the engineer's own words. Sheets are drawn 4 ft by
// 8 ft over supports at the rafter spacing; edge and boundary nails are solid dots, field nails are open dots.
function leaderSmall(v, s, tx, ty, ex, ey) {   // a leader note in the small text size, text to the right
  v.poly([[tx, ty], [ex, ey], [ex + v.pt(7), ey]], 'ld', false); v.circle(tx, ty, v.pt(1.3), 'dot');
  return v.text(s, ex + v.pt(10), ey - v.pt(9) * 0.34, { cls: 'ts' });
}
function detailDiaphragm(P, G, den) {
  const g = P.geometry, v = new View(den, 'diaph'), sp = g.rafterSpacing || 16, W = 192, H = 138, nl = answer(P, 'nailing');
  const thin = `fill:none;stroke:${PAL.ink};stroke-width:${sw(0.6)}`, dash = `fill:none;stroke:${PAL.exist};stroke-width:${sw(0.5)};stroke-dasharray:${sw(3.2)} ${sw(2)}`;
  const mark = `fill:none;stroke:${PAL.rule};stroke-width:${sw(0.5)};stroke-dasharray:${sw(9)} ${sw(4)}`, solid = `fill:${PAL.ink};stroke:none`, open = `fill:#fff;stroke:${PAL.ink};stroke-width:${sw(0.45)}`;
  const rows = [[0, 48, [0, 96, 192]], [48, 96, [48, 144]], [96, H, [0, 96, 192]]], joint = (r, x) => rows[r][2].includes(x);
  // supports below, and flat blocking under the long sheet edges
  for (let x = 0; x <= W + 0.1; x += sp) for (const d of [-0.75, 0.75]) rawPath(v, [[x + d, -4], [x + d, H + 4]], dash, false);
  for (const y of [48, 96]) for (const d of [-1.75, 1.75]) rawPath(v, [[-4, y + d], [W + 6, y + d]], dash, false);
  // sheets: a diagonal marks each one; joints are staggered row to row
  rows.forEach(([y0, y1, xs]) => { const e = [0].concat(xs.filter(x => x > 0), [W + 6]), k = (y1 - y0) / 48;
    for (let i = 0; i < e.length - 1; i++) if (e[i + 1] - e[i] > 20) rawPath(v, [[e[i], y0], [e[i] + (e[i + 1] - e[i]) * k, y1]], mark, false);
    for (const x of xs) if (x > 0) rawPath(v, [[x, y0], [x, y1]], thin, false); });
  for (const y of [48, 96]) rawPath(v, [[0, y], [W + 6, y]], thin, false);
  // nails. Edge nailing along every sheet edge, boundary nailing along the perimeter, field nailing along the supports
  for (let x = 3; x < W + 4; x += 6) { for (const y of [48, 96]) for (const d of [-3.2, 3.2]) rawDot(v, x, y + d, 0.85, solid); rawDot(v, x, 2.6, 0.85, solid); }
  for (let y = 3; y < H; y += 6) rawDot(v, 2.6, y, 0.85, solid);
  rows.forEach(([y0, y1], r) => { for (let x = sp; x <= W + 0.1; x += sp) for (let y = y0 + 9; y < y1 - 5; y += 6) {
    if (joint(r, x)) for (const d of [-2.6, 2.6]) rawDot(v, x + d, y, 0.85, solid); else rawDot(v, x, y, 0.95, open); } });
  // perimeter of the diaphragm, and break lines where it carries on
  rawPath(v, [[0, H], [0, 0], [W + 6, 0]], `fill:none;stroke:${PAL.ink};stroke-width:${sw(1.5)};stroke-linejoin:miter`, false);
  v.poly([[W + 6, -5], [W + 6, 66], [W + 2.5, 69], [W + 9.5, 75], [W + 6, 78], [W + 6, H + 5]], 'o2', false);
  v.poly([[-5, H], [88, H], [91, H + 3.5], [97, H - 3.5], [100, H], [W + 10, H]], 'o2', false);
  // labels, the engineer's wording
  const ex = W + 24;
  leaderSmall(v, 'EDGE NAILING (E.N.)', 147, 99.2, ex, 146);
  leaderSmall(v, 'FIELD NAILING (F.N.)', 11 * sp, 123, ex, 130);
  leaderSmall(v, 'EDGE OF SHEET, TYP', 144, 76, ex, 114);
  leaderSmall(v, '3x4 (FLAT) EDGE BLKG.\nWHERE REQUIRED', 185, 49.75, ex, 96);
  leaderSmall(v, 'FLOOR/ ROOF JOISTS\n(OR TRUSSES) BELOW', 10 * sp + 0.75, 36, ex, 67);
  leaderSmall(v, 'BOUNDARY NAILING (B.N.) AT PERIMETER,\nSAME AS EDGE NAILING, U.O.N.', 165, 2.6, ex, 38);
  leaderSmall(v, `4'-0"x8'-0" SHEATHING WITH FACE GRAIN\nPERPENDICULAR TO JOISTS, PLACE IN A\nSTAGGERED JOINT PATTERN, TYP. U.O.N.`, 120, 20, ex, 9);
  // this job's values, from the engineer's answers
  if (nl) v.text('THIS JOB: ' + nl.toUpperCase().replace(/(\d+)D\b/g, '$1d') + (g.sheathingClips ? '\n' + (g.sheathing ? g.sheathing + '. ' : '') + g.sheathingClips : ''), 0, -27, { cls: 'tN', size: 9 });
  return v.svg();
}

// ------------------------------------------------------------------ 8  SIMPSON H2.5AZ
// The engineer's standard detail, redrawn as a picture. Not to scale. Rafter over the beam, the tie at the corner between
// the side of the rafter and the face of the beam. Fastener pattern schematic.
function detailTie(P, G, den) {
  const g = P.geometry, v = new View(den, 'tie'), RD = g.rafterDepth, BD = g.beamDepth;
  const p3 = (x, y, z) => [(x - y) * 0.8660254, z - (x + y) / 2];
  const face = (pts, fill, stroke, w = 0.7) => rawPath(v, pts.map(q => p3(...q)), `fill:${fill};stroke:${stroke};stroke-width:${sw(w)};stroke-linejoin:round`, true);
  const seg = (a, b, stroke, w = 0.45) => rawPath(v, [p3(...a), p3(...b)], `fill:none;stroke:${stroke};stroke-width:${sw(w)}`, false);
  const box = (x0, x1, y0, y1, z0, z1, f, st) => {
    face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], f[0], st);   // top
    face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], f[1], st);   // +x face
    face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], f[2], st);   // +y face
  };
  const bx0 = -6, bx1 = 7, ry0 = -5, ry1 = 8, zt = BD + RD;
  // (E) built-up beam, two plies, running left to right
  box(bx0, bx1, -1.5, 1.5, 0, BD, ['#f6f7f9', '#dde1e7', '#eceff3'], PAL.exist);
  seg([bx0, 0, BD], [bx1, 0, BD], PAL.exist); seg([bx1, 0, 0], [bx1, 0, BD], PAL.exist);
  for (const [a, b] of [[-1.5, 0], [0, 1.5]]) { seg([bx1, a, 0], [bx1, b, BD], PAL.exist, 0.35); seg([bx1, a, BD], [bx1, b, 0], PAL.exist, 0.35); }
  // (N) rafter over the beam, running toward the viewer
  box(-0.75, 0.75, ry0, ry1, BD, zt, ['#e9f1fe', PAL.newFill, '#bcd2f8'], PAL.new);
  seg([-0.75, ry1, BD], [0.75, ry1, zt], PAL.new, 0.35); seg([-0.75, ry1, zt], [0.75, ry1, BD], PAL.new, 0.35);
  for (const f of [0.22, 0.42, 0.6, 0.8]) rawPath(v, [0, 0.25, 0.5, 0.75, 1].map(t => p3(0.75, ry0 + 0.4 + (ry1 - ry0 - 0.8) * t, BD + RD * (f + 0.025 * Math.sin(6.3 * (t + f))))), `fill:none;stroke:${PAL.new};stroke-opacity:.3;stroke-width:${sw(0.4)}`, false);
  // the tie: one leg on the side of the rafter, one on the face of the beam, bent at the corner
  const st = `fill:${PAL.steel};stroke:${PAL.steel};stroke-width:${sw(0.4)};stroke-linejoin:round`;
  rawPath(v, [[0.75, 0.1, BD + 0.35], [0.75, 1.5, BD + 0.35], [0.75, 1.5, BD + 3.1], [0.75, 0.1, BD + 3.1]].map(q => p3(...q)), st, true);
  rawPath(v, [[0.75, 1.5, BD - 0.2], [2.2, 1.5, BD - 0.2], [2.2, 1.5, BD - 3], [0.75, 1.5, BD - 3]].map(q => p3(...q)), st, true);
  rawPath(v, [[0.75, 0.7, BD + 0.35], [0.75, 1.5, BD + 0.35], [0.75, 1.5, BD - 0.2], [1.6, 1.5, BD - 0.2]].map(q => p3(...q)), st, true);
  for (const [y, z] of [[0.45, 0.9], [1.1, 1.4], [0.45, 1.9], [1.1, 2.5]]) rawDot(v, ...p3(0.75, y, BD + z), 0.13, 'fill:#fff;stroke:none');
  for (const [x, z] of [[1.15, 0.7], [1.8, 1.2], [1.15, 1.8], [1.8, 2.4]]) rawDot(v, ...p3(x, 1.5, BD - z), 0.13, 'fill:#fff;stroke:none');
  // labels
  const lab = (s, at, ex, ey, kind) => { const q = p3(...at), cls = kind === 'N' ? 'tN' : 'ts';
    v.poly([q, [ex, ey], [ex + v.pt(7), ey]], 'ld', false); v.circle(q[0], q[1], v.pt(1.3), 'dot'); v.text(s, ex + v.pt(10), ey - v.pt(9) * 0.34, { cls, size: 9 }); };
  const ex = p3(bx1, -1.5, 0)[0] + 1.6;
  lab(`(N) 2×8 RAFTER`, [0.75, -2.5, BD + RD * 0.55], ex, p3(0, ry0, zt)[1] - 0.4, 'N');
  lab(`(N) SIMPSON H2.5AZ\nAT EVERY RAFTER`, [0.75, 0.9, BD + 2.6], ex, BD + 2.2, 'N');
  lab(`(E) (2) 2×8 BEAM`, [bx1 - 1.5, 1.5, BD * 0.35], ex, -3.2);
  return v.svg();
}

// ------------------------------------------------------------------ isometric overview and step pictures
// mode: colour key per group. 'new' | 'exist' | 'ghost' | 'check'. shores: draw temporary shoring.
function isoScene(P, G, o = {}) {
  const g = P.geometry, iso = new Iso(o.den || 60, o.id || 'iso'), { xl, xr, yo, cols, rx0, rx1, rb, bt, rafters } = G;
  const m = Object.assign({ cols: 'new', beams: 'exist', rafters: 'new', base: 'ghostBase', roof: 1 }, o.mode || {});
  const RD = g.rafterDepth, BD = g.beamDepth, h = g.post / 2, L = g.clearL, quiet = !!o.quiet;
  const C = k => ({ new: PAL.newSolid, exist: PAL.existSolid, ghost: '#dfe3e9', check: PAL.check, shore: PAL.shore }[k]);
  const S = k => k === 'ghost' ? { stroke: '#b3bbc8' } : {};
  iso.solid(-10, L + 10, 0, g.clearD + g.post + 6.5, -4, 0, quiet ? '#e4e7eb' : PAL.slab, { order: 0, stroke: quiet ? '#b9c0cb' : null });
  iso.solid(-26, L + 26, -g.wallT, 0, -4, rb(0), quiet ? '#eef0f2' : PAL.wall, { order: 1, stroke: quiet ? '#b9c0cb' : null });
  for (const op of g.openings) { const z0 = op.sill || 0, z1 = op.head || 80; iso.quad([[op.x0, 0, z0], [op.x1, 0, z0], [op.x1, 0, z1], [op.x0, 0, z1]], quiet ? '#e3eaef' : PAL.glass, { order: 1.5, stroke: '#9fb2c2' }); }
  for (const c of cols) {
    const topZ = (c.line === 'front' ? bt : rb(c.y)) - BD;
    iso.solid(c.x - 2.2, c.x + 2.2, c.y - 2.2, c.y + 2.2, 0, 1, m.cols === 'ghost' ? '#c9ced6' : PAL.steel, { order: 2 });
    iso.solid(c.x - h, c.x + h, c.y - h, c.y + h, 1, topZ, C(m.cols), Object.assign({ order: 2 }, S(m.cols)));
  }
  if (o.shores) for (const i of o.shores) for (const dx of [-11, 11]) iso.solid(G.longX[i] + dx - h, G.longX[i] + dx + h, yo - h, yo + h, 0, bt - BD, PAL.shore, { order: 2 });
  iso.solid(xl - h, xr + h, yo - 1.5, yo + 1.5, bt - BD, bt, C(m.beams), Object.assign({ order: 3 }, S(m.beams)));
  for (const x of [xl, xr]) iso.solid(x - 1.5, x + 1.5, 0, yo - 1.5, y => rb(y) - BD, rb, C(m.beams), Object.assign({ order: 3 }, S(m.beams)));
  iso.solid(G.ex0, G.ex1, -1.5, 0, rb(0), rb(0) + RD, C(m.beams), Object.assign({ order: 3 }, S(m.beams)));
  const FT = g.fasciaT || 0.75;
  for (const y of G.lookouts) for (const [a, b] of [[rx0 + FT, G.ex0], [G.ex1, rx1 - FT]]) iso.solid(a, b, y - 0.75, y + 0.75, yy => rb(yy) + RD - 3.5, yy => rb(yy) + RD, C(m.beams), Object.assign({ order: 4 }, S(m.beams)));   // blocking in the side overhangs, size schematic
  for (const x of rafters) iso.solid(x - 0.75, x + 0.75, -g.wallT, g.roofD - FT, rb, y => rb(y) + RD, C(m.rafters), Object.assign({ order: 4 }, S(m.rafters)));
  if (g.fascia) { const FD = g.fasciaD || 9.25, yt = g.roofD - FT, zt = rb(yt) + RD, fm = g.fasciaNew ? m.rafters : m.beams, o5 = Object.assign({ order: 5 }, S(fm));   // fascia board, three sides
    for (const [a, b] of [[rx0, rx0 + FT], [rx1 - FT, rx1]]) iso.solid(a, b, 0, yt, y => rb(y) + RD - FD, y => rb(y) + RD, C(fm), o5);
    iso.solid(rx0, rx1, yt, g.roofD, zt - FD, zt, C(fm), o5); }
  if (g.railH && !quiet) {   // (E) 2×4 blocking between the columns, and the decorative lattice under it on the inside
    const z0 = g.railH, z1 = z0 + 1.5, lat = { order: 1.9, stroke: '#a9b1be', op: 0.7 }, P_ = g.post;
    for (let i = 0; i < G.longX.length - 1; i++) { const a = G.longX[i] + h, b = G.longX[i + 1] - h;
      iso.solid(a, b, yo - 1.75, yo + 1.75, z0, z1, PAL.existSolid, { order: 2 }); iso.quad([[a, yo - 1.2, 1], [b, yo - 1.2, 1], [b, yo - 1.2, z0], [a, yo - 1.2, z0]], '#eef0f3', lat); }
    for (const [x, k, ys] of [[xl, 1, [P_, g.door[0] - P_, g.door[1] + P_, yo - h]], [xr, -1, [P_, g.rightMid - h, g.rightMid + h, yo - h]]]) for (let i = 0; i < ys.length - 1; i += 2) {
      iso.solid(x - 1.75, x + 1.75, ys[i], ys[i + 1], z0, z1, PAL.existSolid, { order: 2 }); iso.quad([[x + 1.2 * k, ys[i], 1], [x + 1.2 * k, ys[i + 1], 1], [x + 1.2 * k, ys[i + 1], z0], [x + 1.2 * k, ys[i], z0]], '#eef0f3', lat); }
  }
  if (m.roof) { const z = y => rb(y) + RD + 1.3, e = g.roofD + 1.5; iso.poly3([[rx0, -g.wallT, z(-g.wallT)], [rx1, -g.wallT, z(-g.wallT)], [rx1, e, z(e)], [rx0, e, z(e)]], m.roof === 'solid' ? 'roofS' : 'roofl'); }
  return iso;
}

// ------------------------------------------------------------------ the job type
// layout.js asks JOB for everything it draws. A new job type is a new file in views/ that defines JOB the same way.
const STEP_PICTURES = {
  verify:  { mode: { cols: 'ghost', beams: 'check', rafters: 'ghost', roof: 0 } },
  shore:   { mode: { cols: 'ghost', beams: 'exist', rafters: 'ghost', roof: 0 }, shores: [1, 2, 3] },
  columns: { mode: { cols: 'new', beams: 'exist', rafters: 'ghost', roof: 0 }, shores: [1, 2, 3] },
  rafters: { mode: { cols: 'ghost', beams: 'exist', rafters: 'new', roof: 0 } },
  roof:    { mode: { cols: 'ghost', beams: 'ghost', rafters: 'ghost', roof: 'solid' } },
  all:     { mode: { cols: 'new', beams: 'exist', rafters: 'new', roof: 0 } },
};
const JOB = {
  type: 'sunroom',
  derive,
  picture: (P, G, o) => isoScene(P, G, o),
  // Label elbows are in the picture's own screen units (see Iso.p). This scene spans about -139..249 by -138..211.
  labels(P, G, iso) {
    const g = P.geometry, h = g.post / 2;
    iso.label(`(N) 2×8 RAFTERS @ ${g.rafterSpacing}" O.C.\nSIMPSON H2.5AZ AT THE BEAM`, [G.rafters[8], 20, G.rb(20) + g.rafterDepth], -64, -118, { kind: 'N', side: 'l' });
    iso.label('(E) RESIDENCE, CMU WALL', [150, 0, 92], 60, -128, { side: 'r' });
    iso.label('(E) (2) 2×8 BEAMS, 3 SIDES\nKEEP. CHECK FOR ROT / WDO', [G.xl, G.yo + 1.5, G.bt - 4], 172, 150, { side: 'l' });
    iso.label(`(N) PT 4×4 COLUMNS (${G.cols.length})\nON SIMPSON ABU44Z BASES`, [G.longX[2], G.yo + h, 30], 10, 222, { kind: 'N', side: 'l' });
    iso.label('(E) CONCRETE SLAB', [240, 100, 0], -158, 202, { side: 'l' });
  },
  stepPicture: (P, G, step, k) => isoScene(P, G, Object.assign({ den: 128, id: 'st' + k, quiet: true }, STEP_PICTURES[step.pic] || STEP_PICTURES.all)).svg(),
  field: {
    pictureNote: 'Roof deck and roofing not shown',
    pictureHeight: 6.5, pictureDen: 76,   // the picture gives up height to the two small views under it
    extrasHeight: 3.7,
    extras: [   // the engineer's standard details that this set keeps, redrawn. Numbered after the details
      { title: 'Typical horizontal diaphragm', den: 72, draw: detailDiaphragm, nts: true, flex: 1.8 },
      { title: 'Simpson H2.5AZ', den: 10, draw: detailTie, nts: true, flex: 1 },
    ],
    planHeight: 10.2,   // inches of the middle column for the plan; the section takes the rest
    plan:    { title: 'Roof framing plan', den: 24, draw: viewPlan },
    section: { title: 'Section through the sunroom', den: 32, draw: viewSection },
    side:    { title: 'Front elevation', den: 48, draw: viewElevation, note: 'Seen from the yard. Door end on the right' },
    details: [
      { title: 'Column base', den: 4, draw: detailBase, note: (P, G) => 'Typical of ' + G.cols.length },
      { title: 'Rafter, beam and column', den: 4, draw: detailBeam, note: 'At the outer beam' },
      { title: 'Rafter at existing CMU wall', den: 4, draw: detailHouse, note: 'Tie is concealed, verify' },
    ],
  },
};

// ================================================================== A0.1 site plan
// The site plan is drawn by its own job type (the engineer's siteplan.js), wrapped here so it can sit in this set as
// sheet type "site". Its data is under "site" in the project file. Changes from the original: the two red flag notes
// and the open-items panel are removed, the notes panel accepts a plain paragraph, and the impervious-area note is added.
const SITE = (() => {
// siteplan.js — job type "siteplan": one lot, what stands on it, the setbacks, and the area of work.
//
// The lot is a block on a curved street: front and rear lot lines are concentric arcs and the two side
// lines are radial, so the lot is fixed by two radii and the two side-line bearings.
// The buildings are drawn square to the lot's centreline and placed from two given setbacks (front, north side).
// Every other distance is worked out from those and printed with ± (verify in field).
//
// Site numbers in P.geometry are in FEET (keys end in Ft); FT() turns them into model units.
// Plan frame, in feet: X runs from the rear lot line to the street along the lot's centreline, Y to plan north.
//
// A site plan is one large view, so this job type lays out its own sheet: it replaces the field-sheet layout
// (picture / plan / section / steps / details) with a plan, site data, notes and the open items. The title block,
// status band, panels, colour code, audit and editor are the kit's.

const I = v => v * UPI;            // inches -> model units
const FT = v => v * 12 * UPI;      // feet -> model units
const D2R = Math.PI / 180;
const toHalfFt = ft => Math.floor(ft * 2 + 1e-6) / 2;   // worked-out distances are stated to the 6 in below
const SITE_SCALE = { 64: '3/16" = 1\'-0"', 120: '1" = 10\'', 240: '1" = 20\'' };

function derive(P) {
  const g = P.geometry, lot = g.lot, sb = g.setbacks, h = g.house, s = g.sunroom, p = g.porch;
  const a = (lot.southBearingDeg - lot.northBearingDeg) / 2 * D2R;      // half the angle between the side lines
  const Rr = lot.rearRadiusFt, Rf = lot.frontRadiusFt;
  const pt = (r, ang) => [Rr - r * Math.cos(ang), r * Math.sin(ang)];
  const arcX = (r, y) => Rr - Math.sqrt(r * r - y * y);                 // X of an arc at height y
  const lineY = (x, side) => side * (Rr - x) * Math.tan(a);             // Y of a side line at X. side: +1 north, -1 south
  const toNorth = (x, y) => (Rr - x) * Math.sin(a) - y * Math.cos(a);   // square distance from a point to the north line
  const toSouth = (x, y) => (Rr - x) * Math.sin(a) + y * Math.cos(a);
  const toRear = (x, y) => Rr - Math.hypot(Rr - x, y);
  // House: north wall `northFt` off the north line and street face `frontFt` off the front line, each at the nearest corner.
  let xF = Rr - Rf - sb.frontFt, yN = 0;
  for (let k = 0; k < 12; k++) {
    yN = ((Rr - xF) * Math.sin(a) - sb.northFt) / Math.cos(a);
    const y0 = yN - h.wingWidthFt, near = y0 <= 0 && yN >= 0 ? 0 : Math.min(Math.abs(y0), Math.abs(yN));
    xF = Rr - Math.sqrt((Rf + sb.frontFt) ** 2 - near ** 2);
  }
  const xR = xF - h.wingDepthFt, xM = xR + h.mainDepthFt, yS = yN - h.widthFt, yW = yN - h.wingWidthFt;
  const house = [[xR, yS], [xM, yS], [xM, yW], [xF, yW], [xF, yN], [xR, yN]];
  const porch = { x0: xM, x1: xM + p.depthFt, y0: yW - p.widthFt, y1: yW };
  const sun = { x0: xR - s.depthFt, x1: xR, y1: yN - s.fromNorthWallFt, y0: yN - s.fromNorthWallFt - s.widthFt };
  const corners = house.concat([[porch.x0, porch.y0], [porch.x1, porch.y0], [sun.x0, sun.y0], [sun.x0, sun.y1]]);
  // Driveway: a strip `widthFt` wide, square to the house, from the wing's street face to the front lot line, with a 45° flare
  // `flareFt` wide on each side. The flares are inside the lot and end on the front lot line (the engineer, 2026-11-12).
  // `fromWingSouthFt` places its south edge along that wall.
  const dw = g.driveway, dy0 = dw ? yW + (dw.fromWingSouthFt || 0) : 0;
  const drive = dw ? { y0: dy0, y1: dy0 + dw.widthFt, fl: dw.flareFt || 0, Ro: Rf } : null;
  return {
    a, Rr, Rf, pt, arcX, lineY, xF, xR, xM, yN, yS, yW, house, porch, sun, drive,
    rearFt: sb.rearFt || toHalfFt(Math.min(toRear(sun.x0, sun.y0), toRear(sun.x0, sun.y1))), rearGiven: !!sb.rearFt,
    southFt: sb.southFt || toHalfFt(Math.min(...corners.map(c => toSouth(c[0], c[1])))), southGiven: !!sb.southFt,
    sunNorthFt: toHalfFt(toNorth(sun.x1, sun.y1)),
    sideFt: Rr - Rf, lotArea: Math.round(a * (Rr * Rr - Rf * Rf)),
    northRot: 90 - (lot.northBearingDeg + lot.southBearingDeg) / 2,   // true north, degrees counter-clockwise from plan up
  };
}

// ------------------------------------------------------------------ 1  SITE PLAN
function viewSite(P, G, den) {
  const g = P.geometry, lot = g.lot, sb = g.setbacks, v = new View(den, 'site');
  const { a, Rr, Rf, pt, arcX, lineY, xF, xR, xM, yN, yS, yW, house, porch, sun, drive } = G, deg = a / D2R;
  const M = pts => pts.map(p => [FT(p[0]), FT(p[1])]);
  const arc = (r, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, k) => pt(r, a0 + (a1 - a0) * k / n));
  const ft = n => `${n}'`;
  // a line in a kit line style at another weight (the lot line is the kit's long-dash line, drawn heavier)
  const heavy = (pts, cls, w) => { for (const p of pts) v.ext(p[0], p[1]); v.out.push(`<polygon class="${cls} nf" style="stroke-width:calc(var(--u) * ${w}px)" points="${pts.map(p => r3(p[0]) + ',' + r3(-p[1])).join(' ')}"/>`); };

  // street: a strip beyond the front lot line. Its width and the pavement are not known, so neither is drawn.
  const over = 5.5 / Rf, sw = g.streetStripFt || 10;
  v.poly(M(arc(Rf, -a - over, a + over).concat(arc(Rf - sw, a + over, -a - over))), 'exb');
  v.text(String(g.street || '').toUpperCase(), FT(Rr - Rf + sw * 0.5) + v.pt(5), 0, { cls: 'th', anchor: 'middle', rot: 90 });
  v.text('RIGHT-OF-WAY. WIDTH AND PAVEMENT NOT SHOWN', FT(Rr - Rf + sw) - v.pt(5), 0, { cls: 'ts', anchor: 'middle', rot: 90 });

  // existing concrete driveway, house to the front lot line, with its flares. Drawn before the buildings and the lot line so both stay on top.
  if (drive) {
    const { y0, y1, fl, Ro } = drive, n = 10, u = v.u, dot = (x, y, r) => `<circle cx="${r3(x * u)}" cy="${r3(y * u)}" r="${r3(r * u)}"/>`, ps = 44 * u;
    v.defs.push(`<pattern id="drive-${v.id}" width="${r3(ps)}" height="${r3(ps)}" patternUnits="userSpaceOnUse"><rect width="${r3(ps)}" height="${r3(ps)}" fill="#f5f6f8"/>` +
      `<g fill="${PAL.exist}" opacity=".5">${dot(5, 7, .8)}${dot(19, 4, .6)}${dot(33, 11, .8)}${dot(40, 27, .6)}${dot(12, 22, .7)}${dot(25, 30, .8)}${dot(7, 38, .6)}${dot(36, 40, .7)}${dot(21, 41, .6)}${dot(28, 17, .5)}</g></pattern>`);
    const outer = Array.from({ length: n + 1 }, (_, k) => { const y = y0 - fl + (y1 - y0 + 2 * fl) * k / n; return [arcX(Ro, y), y]; });   // street end, south to north
    v.poly(M([[xF, y0], [arcX(Ro + fl, y0), y0]].concat(outer, [[arcX(Ro + fl, y1), y1], [xF, y1]])), 'ex', true, { fill: `url(#drive-${v.id})` });
  }

  // the buildings: all existing (grey). The sunroom is the area of work (blue): existing, repaired, same footprint.
  v.poly(M(house), 'ex');
  v.rect(FT(porch.x0), FT(porch.y0), FT(porch.x1), FT(porch.y1), 'exh');
  v.rect(FT(sun.x0), FT(sun.y0), FT(sun.x1), FT(sun.y1), 'new');

  // lot lines
  heavy(M(arc(Rr, -a, a).concat(arc(Rf, a, -a))), 'cutl', 1.3);
  const rm = (Rr + Rf) / 2 + 12, nm = pt(rm, a), sm = pt(rm, -a), side = `${G.sideFt.toFixed(1)}' ±`;
  v.text(`${lot.northBearing}  ·  ${side}`, FT(nm[0]) + v.pt(5) * Math.sin(a), FT(nm[1]) + v.pt(5) * Math.cos(a), { cls: 'td', anchor: 'middle', rot: -deg });
  v.text(`${lot.southBearing}  ·  ${side}`, FT(sm[0]) + v.pt(12.5) * Math.sin(a), FT(sm[1]) - v.pt(12.5) * Math.cos(a), { cls: 'td', anchor: 'middle', rot: deg });
  v.text(`${lot.frontArcFt.toFixed(2)}' ARC  ·  R = ${Rf}' ±`, FT(Rr - Rf) - v.pt(5), FT(-15), { cls: 'td', anchor: 'middle', rot: 90 });
  v.text(`${lot.rearArcFt.toFixed(2)}' ARC  ·  R = ${Rr}'`, FT(arcX(Rr, 14)) - v.pt(5), FT(-9), { cls: 'td', anchor: 'middle', rot: 90 });
  v.text(`LOT ${lot.number}`, FT(81), FT(-9), { cls: 'th', anchor: 'middle' });
  v.text(`${G.lotArea.toLocaleString('en-US')} SQ FT ±`, FT(81), FT(-9) - v.pt(13), { cls: 'ts', anchor: 'middle' });
  v.text('ADJACENT LOT', FT(80), FT(lineY(80, 1) + 3.2), { cls: 'td', anchor: 'middle', rot: -deg });
  v.text('ADJACENT LOT', FT(19), FT(lineY(19, -1) - 4.6), { cls: 'td', anchor: 'middle', rot: deg });

  // footprint: the lengths on the county sketch, written along each wall
  const e = v.pt(5), up = { cls: 'td', anchor: 'middle', rot: 90 }, mid = { cls: 'td', anchor: 'middle' }, h = g.house, s = g.sunroom, p = g.porch;
  v.text(ft(h.mainDepthFt), FT((xR + xM) / 2), FT(yS) + e, mid);                                    // south wall
  v.text(ft(h.widthFt - h.wingWidthFt - p.widthFt), FT(xM) - e, FT((yS + porch.y0) / 2), up);       // street wall, main part
  v.text(ft(h.wingDepthFt - h.mainDepthFt), FT((xM + xF) / 2), FT(yW) + e, mid);                    // wing, south side
  v.text(ft(h.wingWidthFt), FT(xF) - e, FT((yW + yN) / 2), up);                                     // wing, street face
  v.text(ft(h.wingDepthFt), FT((xR + xF) / 2), FT(yN) - v.pt(12.5), mid);                           // north wall
  v.text(ft(s.fromNorthWallFt), FT(xR) + v.pt(12.5), FT((sun.y1 + yN) / 2), up);                    // rear wall, north of the sunroom
  v.text(ft(h.widthFt - s.fromNorthWallFt - s.widthFt), FT(xR) + v.pt(12.5), FT((yS + sun.y0) / 2), up);   // rear wall, south of it
  v.text(ft(s.widthFt), FT(sun.x0) + v.pt(12.5), FT((sun.y0 + sun.y1) / 2), up);
  v.text(ft(s.depthFt), FT((sun.x0 + sun.x1) / 2), FT(sun.y0) + e, mid);
  const hx = FT((xR + xM) / 2), hy = FT((yS + yN) / 2);
  v.text('(E) RESIDENCE', hx, hy + v.pt(8), { cls: 'tb', anchor: 'middle' });
  v.text(`${h.areaSf.toLocaleString('en-US')} SQ FT, COUNTY RECORD\nNO CHANGE`, hx, hy - v.pt(5), { cls: 'ts', anchor: 'middle' });
  v.text(`(E) PORCH\n${p.widthFt}' × ${p.depthFt}'`, FT((porch.x0 + porch.x1) / 2), FT((porch.y0 + porch.y1) / 2) + v.pt(2), { cls: 'ts', anchor: 'middle' });
  const sx = FT((sun.x0 + sun.x1) / 2) + v.pt(4), sy = FT((sun.y0 + sun.y1) / 2);
  v.text('(E) SUNROOM', sx, sy + v.pt(4), { cls: 'tN', anchor: 'middle' });
  v.text('REPAIR', sx, sy - v.pt(9), { cls: 'tN', anchor: 'middle' });
  if (drive) {   // the label sits in the upper part of the strip; the front setback dimension runs through the lower part
    const dx = FT((xF + arcX(Rf, drive.y0)) / 2), dy = FT(drive.y0 + (drive.y1 - drive.y0) * 0.66);
    v.text('(E) CONCRETE DRIVEWAY', dx, dy, { cls: 'tb', anchor: 'middle' });
    v.text(`${g.driveway.widthFt}' WIDE  ·  NO CHANGE`, dx, dy - v.pt(12.5), { cls: 'ts', anchor: 'middle' });
  }

  // setbacks. Front and north side are as given, taken at the nearest corner. Rear and south side are worked out (±).
  const yf = yW + 1.6, xn = xF - 1.2, xs = xM - 1.2, yr = sun.y1 - 1.6;
  v.dimH(FT(xF), FT(arcX(Rf, yf)), FT(yf), FT(yf), { text: FMT(FT(sb.frontFt)) });
  v.dimV(FT(yN), FT(lineY(xn, 1)), FT(xn), FT(xn), { text: FMT(FT(sb.northFt)) });
  v.dimV(FT(lineY(xs, -1)), FT(yS), FT(xs), FT(xs), { text: FMT(FT(G.southFt), !G.southGiven) });
  v.dimH(FT(arcX(Rr, yr)), FT(sun.x0), FT(yr), FT(yr), { text: FMT(FT(G.rearFt), !G.rearGiven) });

  // notes
  v.note(`(E) REAR SUNROOM ${FMT(FT(s.depthFt))} × ${FMT(FT(s.widthFt))}, ${s.areaSf} SQ FT\nTO BE REPAIRED UNDER THIS PERMIT\nFOOTPRINT, SETBACKS AND USE UNCHANGED`, FT(sun.x1 - 3.5), FT(sun.y1 - 2.6), FT(sun.x1 - 3), FT(45), { side: 'r', kind: 'N' });
  // flags removed per the engineer's markup of 2026-11-12; the site plan note on the sheet covers them
  if (drive && drive.fl) {   // the callout names the flare and gives no size (the engineer, 2026-11-12)
    const { y1, fl, Ro } = drive, fy = y1 + fl / 2, fx = (arcX(Ro + fl, y1) + arcX(Ro, y1 + fl)) / 2;
    v.note('DRIVEWAY FLARE (TYP.)', FT(fx), FT(fy), FT(fx - 3.2), FT(fy + 3.6), { side: 'l' });
  }

  // north arrow: true north from the plat bearings
  const cx = FT(Rr - Rf + sw * 0.55), cy = FT(43), r = v.pt(22), t = G.northRot * D2R, ux = -Math.sin(t), uy = Math.cos(t);
  v.circle(cx, cy, r, 'o2'); v.line(cx - ux * r, cy - uy * r, cx + ux * r * 1.25, cy + uy * r * 1.25, 'o');
  v.arrow(cx + ux * r * 1.25, cy + uy * r * 1.25, cx, cy);
  v.text('N', cx + ux * r * 1.25 + ux * v.pt(13) , cy + uy * r * 1.25 + uy * v.pt(13) - v.pt(4.5), { cls: 'th', anchor: 'middle' });

  // graphic scale, when the kit has no bar for this scale
  if (!(UPI === 1 && SCALE_LABEL[den])) {
    const x0 = FT(2), y0 = FT(-47.5), bh = v.pt(4.5), marks = [0, 10, 20, 40];
    for (let k = 0; k < marks.length - 1; k++) v.rect(x0 + FT(marks[k]), y0, x0 + FT(marks[k + 1]), y0 + bh, 'o2', { fill: k % 2 ? '#fff' : PAL.ink });
    for (const m of marks) v.text(m ? ft(m) : '0', x0 + FT(m), y0 - v.pt(10), { cls: 'ts', anchor: 'middle' });
    v.text('GRAPHIC SCALE, FEET', x0 + FT(43), y0 - v.pt(1), { cls: 'ts' });
  }
  v.text('NO CHANGES TO EXISTING IMPERVIOUS AREA', FT(2), FT(-52.5), { cls: 'th' });
  return v.svg();
}

// ------------------------------------------------------------------ the sheet: plan, site data, notes, open items
function sheetField(P, G, sh, i, n) {
  const F = JOB.field, den = (P.scales || {}).plan || F.plan.den, sb = P.geometry.setbacks;
  Object.assign(REF, { front: FMT(FT(sb.frontFt)), north: FMT(FT(sb.northFt)), rear: FMT(FT(G.rearFt), !G.rearGiven), south: FMT(FT(G.southFt), !G.southGiven),
    sunNorth: FMT(FT(G.sunNorthFt), true), lotArea: G.lotArea.toLocaleString('en-US'), side: G.sideFt.toFixed(1) });
  // {key} in site data and facts: a worked-out value, or the answer to an open item, or a red "To fill" chip while it is open
  const fill = s => rich(String(s || '').replace(/\{(\w+)\}/g, (m, k) => k in REF || answer(P, k) ? m : '\u0001'), P).replace(/\u0001/g, chip('r', 'To fill'));
  const facts = (P.facts || []).map(f => `<div class="fact"><div class="k">${esc(f.k)} ${f.tag === 'N' ? chip('n', 'New') : f.tag === 'E' ? chip('e', 'Existing') : f.tag ? chip('o', f.tag) : ''}</div><div class="v">${fill(f.v)}</div><div class="s">${fill(f.s)}</div></div>`).join('');
  const data = (P.criteria || []).map(c => `<tr><td>${esc(c.k)}</td><td>${c.v ? fill(c.v) : chip('r', 'To fill')}</td></tr>`).join('');
  const notes = (P.notes || []).map(grp => `<h4>${esc(grp.title)}</h4>${grp.text ? `<p class="snote">${fill(grp.text)}</p>` : ''}${grp.items ? `<ol start="${grp.start || 1}">${grp.items.map(t => `<li>${fill(t)}</li>`).join('')}</ol>` : ''}`).join('');
  const openL = openItems(P), closed = closedItems(P);
  const open = openL.map((o, j) => `<div class="oi"><i class="tri"><b>${j + 1}</b></i><div><b>${esc(o.title)}</b><span>${fill(o.text)}</span><em>${esc(o.who || 'Office')}</em></div></div>`).join('');
  const done = closed.map(o => `<div class="oi done"><i class="ok"><svg viewBox="0 0 16 16"><path d="M3 8.6l3.2 3L13 4.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></i><div><b>${esc(o.title)}</b><span>${esc(o.answer)}</span></div></div>`).join('');
  const legend = `<div class="lgs"><span><i class="sw n"></i>Area of work: (E) sunroom, to be repaired</span><span><i class="sw e"></i>(E) Existing, stays</span>` +
    `<span><svg width="0.55in" height="0.12in" viewBox="0 0 55 12"><line x1="0" y1="6" x2="55" y2="6" stroke="${PAL.ink}" stroke-width="1.7" stroke-dasharray="18 4 4 4"/></svg>Lot line, from plat excerpt</span>` +
    `<span><i class="pm">±</i>Worked out, not measured. Verify in field</span></div>`;
  const kit = UPI === 1 && SCALE_LABEL[den];
  const body = `
  <div class="head"><div class="job" data-fit><label>The job</label><h2>${esc(P.summary.headline)}</h2><p>${esc(P.summary.text)}</p></div><div class="facts" style="grid-template-columns:repeat(${Math.max(1, (P.facts || []).length)},1fr)">${facts}</div></div>
  <div style="flex:1 1 0;min-height:0;display:grid;grid-template-columns:${F.planWidth || 22.6}in minmax(0,1fr);grid-template-rows:minmax(0,1fr);gap:0.2in">
    ${panel(REF.plan, F.plan.title, den, F.plan.draw(P, G, den), { top: legend, note: F.plan.note, scale: kit ? '' : 'Scale ' + (SITE_SCALE[den] || '1:' + den) })}
    <div class="col">
      <section class="panel"><div class="ph">Site data</div><div class="pad" data-fit><table class="kv">${data}</table></div></section>
      <section class="panel grow"><div class="ph">Notes</div><div class="pad notes sm" data-fit>${notes}</div></section>
    </div>
  </div>`;
  return sheet(P, sh, i, n, 's-field', body);
}

// ------------------------------------------------------------------ the job type
const JOB = {
  type: 'siteplan',
  derive,
  field: {
    planWidth: 22.6,   // inches of the sheet given to the plan; site data, notes and open items take the rest
    plan: { title: 'Site plan', den: 64, draw: viewSite, note: 'Existing conditions. Not a survey' },
    details: [],
  },
};
return { JOB, derive, sheetField };
})();

const SHEET_TYPES = {
  site(P, G, sh, i, n) {
    const S = Object.assign({}, P, P.site), keep = Object.assign({}, REF);
    try { return SITE.sheetField(S, SITE.derive(S), sh, i, n); }
    finally { for (const k of Object.keys(REF)) delete REF[k]; Object.assign(REF, keep); }   // the site sheet adds its own {keys}
  },
};
