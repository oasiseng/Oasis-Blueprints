/*! cc-wind-diagram.js v1.0.0 · zone drawings for cc-wind.js results · MIT License
 *  Copyright (c) 2026 Oasis Engineering, LLC
 *
 *  CCWindDiagram.roofPlan(roofResult, { length, width, px })   -> SVG string, roof plan with Zones 1', 1, 2, 3
 *  CCWindDiagram.wallElevation(wallResult, { length, px })      -> SVG string, wall elevation with Zones 4, 5
 *  CCWindDiagram.legend(roofResult, wallResult)                 -> [{ zone, color, text }]
 *
 *  Drawings are in proportion to the plan dimensions given, but they are schematics: one rectangle, ridge along
 *  the long side. Zone positions follow the ASCE 7-22 figure named in the result.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CCWindDiagram = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const COLOR = { z1p: '#e8f4ef', z1: '#cfe8df', z2: '#f4d9a6', z3: '#f1b0a3', z4: '#cfe8df', z5: '#f1b0a3', ink: '#16213a', sub: '#56637a' };
  const f = v => (+v).toFixed(1);
  const ft = v => (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v) : (+v).toFixed(1)) + ' ft';
  const STYLE = '<style>.ccz .ol{fill:none;stroke:' + COLOR.ink + ';stroke-width:1.4}.ccz .hl{stroke:' + COLOR.ink + ';stroke-width:.8;stroke-dasharray:5 3;fill:none}' +
    '.ccz .dm{stroke:' + COLOR.sub + ';stroke-width:.8;fill:none}.ccz text{font:600 11px "Barlow Semi Condensed","Segoe UI",Arial,sans-serif;fill:' + COLOR.ink + ';text-anchor:middle}' +
    '.ccz text.z{font-size:17px;font-weight:700;paint-order:stroke;stroke:#fff;stroke-opacity:.55;stroke-width:3px}.ccz text.s{fill:' + COLOR.sub + ';font-weight:500}</style>';

  const rect = (x, y, w, h, fill, cls) => w > 0 && h > 0 ? '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' + (fill ? ' fill="' + fill + '"' : '') + (cls ? ' class="' + cls + '"' : '') + '/>' : '';
  const line = (x1, y1, x2, y2, cls) => '<line x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '" class="' + cls + '"/>';
  const text = (s, x, y, cls) => '<text x="' + f(x) + '" y="' + f(y) + '"' + (cls ? ' class="' + cls + '"' : '') + '>' + s + '</text>';
  const vtext = (s, x, y, cls) => '<text transform="translate(' + f(x) + ' ' + f(y) + ') rotate(-90)"' + (cls ? ' class="' + cls + '"' : '') + '>' + s + '</text>';
  // a zone number, only where the zone is big enough to hold it
  const znum = (s, x, y, w, h) => (w >= 13 && h >= 15) ? text(s, x, y + 6, 'z') : '';
  // dimension tick: a short dashed line from x1 to x2 at y with a label above
  const dimH = (x1, x2, y, label) => line(x1, y, x2, y, 'dm') + line(x1, y - 3, x1, y + 3, 'dm') + line(x2, y - 3, x2, y + 3, 'dm') + text(label, (x1 + x2) / 2, y - 5, 's');

  let uid = 0;

  function roofPlan(r, o) {
    o = o || {};
    const W = r.least, L = Math.max(o.length || r.length || 1.6 * W, W);
    const px = o.px || 460, mL = 34, mR = 12, mT = 30, mB = 30;
    const shownL = Math.min(L, 3 * W);                      // very long buildings are drawn shortened
    const s = (px - mL - mR) / shownL, w = shownL * s, d = W * s, x0 = mL, y0 = mT, H = d + mT + mB;
    const lay = r.geometry.layout, id = 'ccz' + (++uid);
    let g = '';
    if (lay === 'lowslope') {
      const e = Math.min(r.geometry.edge * s, d / 2, w / 2), cd = Math.min(r.geometry.cornerDepth * s, e), i = Math.min(r.geometry.interiorFrom * s, d / 2, w / 2);
      g += rect(x0, y0, w, d, COLOR.z2);
      g += rect(x0 + e, y0 + e, w - 2 * e, d - 2 * e, COLOR.z1);
      g += rect(x0 + i, y0 + i, w - 2 * i, d - 2 * i, COLOR.z1p);
      for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x0 + w, y0, -1, 1], [x0, y0 + d, 1, -1], [x0 + w, y0 + d, -1, -1]]) {
        g += rect(sx > 0 ? cx : cx - e, sy > 0 ? cy : cy - cd, e, cd, COLOR.z3) + rect(sx > 0 ? cx : cx - cd, sy > 0 ? cy : cy - e, cd, e, COLOR.z3);
      }
      g += znum("1'", x0 + w / 2, y0 + d / 2, w - 2 * i, d - 2 * i);
      g += znum('1', x0 + w / 2, y0 + (e + i) / 2, w - 2 * e, i - e) || znum('1', x0 + w / 2, y0 + d / 2, w - 2 * e, (w - 2 * i > 13 && d - 2 * i > 15) ? 0 : d - 2 * e);
      g += znum('2', x0 + w / 2, y0 + e / 2, w - 2 * e, e) + znum('2', x0 + e / 2, y0 + d / 2, e, d - 2 * e);
      g += znum('3', x0 + e / 2, y0 + cd / 2, e, Math.max(cd, 15)) + znum('3', x0 + w - e / 2, y0 + d - cd / 2, e, Math.max(cd, 15));
      g += dimH(x0, x0 + e, y0 - 9, '0.6h = ' + ft(r.geometry.edge));
      if (i > e + 1) g += dimH(x0, x0 + i, y0 + d + 22, '1.2h = ' + ft(r.geometry.interiorFrom));
    } else if (lay === 'gable_le27' || lay === 'gable_gt27') {
      const a = Math.min(r.a * s, w / 2, d / 2), yr = y0 + d / 2;
      g += rect(x0, y0, w, d, COLOR.z1);
      g += rect(x0, y0, a, d, COLOR.z2) + rect(x0 + w - a, y0, a, d, COLOR.z2);
      if (lay === 'gable_le27') {
        g += rect(x0 + a, yr - a, w - 2 * a, 2 * a, COLOR.z2) + rect(x0, yr - a, a, 2 * a, COLOR.z3) + rect(x0 + w - a, yr - a, a, 2 * a, COLOR.z3);
        g += znum('1', x0 + w / 2, y0 + (d / 2 - a) / 2, w - 2 * a, d / 2 - a) + znum('1', x0 + w / 2, y0 + d - (d / 2 - a) / 2, w - 2 * a, d / 2 - a);
        g += znum('2', x0 + w / 2, yr + a / 2 + 2, w - 2 * a, 2 * a) + znum('2', x0 + a / 2, y0 + (d / 2 - a) / 2, a, d / 2 - a);
        g += znum('3', x0 + a / 2, yr + a / 2 + 2, a, 2 * a) + znum('3', x0 + w - a / 2, yr + a / 2 + 2, a, 2 * a);
      } else {
        for (const [cx, cy] of [[x0, y0], [x0 + w - a, y0], [x0, y0 + d - a], [x0 + w - a, y0 + d - a]]) g += rect(cx, cy, a, a, COLOR.z3);
        g += znum('1', x0 + w / 2, y0 + d / 4, w - 2 * a, d / 2) + znum('1', x0 + w / 2, y0 + 3 * d / 4, w - 2 * a, d / 2);
        g += znum('2', x0 + a / 2, y0 + d / 4, a, d - 2 * a) + znum('2', x0 + w - a / 2, y0 + 3 * d / 4, a, d - 2 * a);
        g += znum('3', x0 + a / 2, y0 + a / 2, a, a) + znum('3', x0 + w - a / 2, y0 + d - a / 2, a, a);
      }
      g += line(x0, yr, x0 + w, yr, 'hl') + text('RIDGE', x0 + w / 2, yr - 4, 's');
      g += dimH(x0, x0 + a, y0 - 9, 'a = ' + ft(r.a));
    } else {   // hip
      const a = Math.min(r.a * s, w / 2, d / 2), h2 = d / 2, yr = y0 + h2, xa = x0 + h2, xb = x0 + w - h2;
      const hips = 'M' + f(x0) + ' ' + f(y0) + 'L' + f(xa) + ' ' + f(yr) + 'L' + f(x0) + ' ' + f(y0 + d) + 'M' + f(x0 + w) + ' ' + f(y0) + 'L' + f(xb) + ' ' + f(yr) + 'L' + f(x0 + w) + ' ' + f(y0 + d) + 'M' + f(xa) + ' ' + f(yr) + 'L' + f(xb) + ' ' + f(yr);
      g += '<clipPath id="' + id + '"><rect x="' + f(x0) + '" y="' + f(y0) + '" width="' + f(w) + '" height="' + f(d) + '"/></clipPath>';
      g += rect(x0, y0, w, d, COLOR.z1);
      g += '<path d="' + hips + '" fill="none" stroke="' + COLOR.z2 + '" stroke-width="' + f(2 * a) + '" stroke-linejoin="round" clip-path="url(#' + id + ')"/>';
      g += '<path fill-rule="evenodd" fill="' + COLOR.z3 + '" d="M' + f(x0) + ' ' + f(y0) + 'h' + f(w) + 'v' + f(d) + 'h' + f(-w) + 'zM' + f(x0 + a) + ' ' + f(y0 + a) + 'v' + f(d - 2 * a) + 'h' + f(w - 2 * a) + 'v' + f(-(d - 2 * a)) + 'z"/>';
      g += '<path d="' + hips + '" class="hl"/>';
      const fy = (h2 - 2 * a) / 2;
      g += znum('1', x0 + w / 2, y0 + a + fy / 2 + 2, xb - xa, fy + 4) + znum('1', x0 + w / 2, y0 + d - a - fy / 2 - 2, xb - xa, fy + 4);
      g += znum('2', x0 + w / 2, yr, xb - xa + a, 2 * a) + znum('3', x0 + w / 2, y0 + a / 2, w, Math.max(a, 15));
      g += dimH(x0, x0 + a, y0 - 9, 'a = ' + ft(r.a));
    }
    g += rect(x0, y0, w, d, null, 'ol');
    g += text((shownL < L ? 'L = ' + ft(L) + ' (drawn shortened)' : 'L = ' + ft(L)) + (lay === 'lowslope' ? '' : ', along the ridge'), x0 + w / 2 + (lay === 'lowslope' ? 40 : 0), y0 + d + (lay === 'lowslope' ? 12 : 16), 's');
    g += vtext('W = ' + ft(W), x0 - 10, y0 + d / 2, 's');
    return '<svg class="ccz" viewBox="0 0 ' + px + ' ' + f(H) + '" width="' + px + '" height="' + f(H) + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Roof plan with components and cladding zones">' + STYLE + g + '</svg>';
  }

  function wallElevation(wr, o) {
    o = o || {};
    const L = o.length || wr.length || 40, h = wr.site.h, px = o.px || 460, mL = 34, mR = 12, mT = 26, mB = 8;
    const shownL = Math.min(L, 6 * h), s = (px - mL - mR) / shownL, w = shownL * s, d = Math.max(Math.min(h * s, 0.2 * w), 34);
    const a = Math.min(wr.a * s, w / 2), x0 = mL, y0 = mT, H = d + mT + mB;
    let g = rect(x0, y0, w, d, COLOR.z4) + rect(x0, y0, a, d, COLOR.z5) + rect(x0 + w - a, y0, a, d, COLOR.z5) + rect(x0, y0, w, d, null, 'ol');
    g += znum('4', x0 + w / 2, y0 + d / 2, w - 2 * a, d) + znum('5', x0 + a / 2, y0 + d / 2, a, d) + znum('5', x0 + w - a / 2, y0 + d / 2, a, d);
    g += dimH(x0, x0 + a, y0 - 9, 'a = ' + ft(wr.a)) + vtext('h = ' + ft(h), x0 - 10, y0 + d / 2, 's');
    return '<svg class="ccz" viewBox="0 0 ' + px + ' ' + f(H) + '" width="' + px + '" height="' + f(H) + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wall elevation with components and cladding zones">' + STYLE + g + '</svg>';
  }

  function legend(r, wr) {
    const out = [];
    if (r) {
      const g = r.geometry, lay = g.layout, a = ft(r.a), a2 = ft(2 * r.a);
      const T = lay === 'lowslope' ? {
        z1p: 'Roof interior, more than 1.2h (' + ft(g.interiorFrom) + ') from every edge', z1: 'Roof field, between 0.6h and 1.2h from an edge',
        z2: 'Roof edges, 0.6h = ' + ft(g.edge) + ' wide', z3: 'Roof corners, L-shaped: 0.6h (' + ft(g.cornerLeg) + ') along each edge, 0.2h (' + ft(g.cornerDepth) + ') deep' }
        : lay === 'gable_le27' ? { z1: 'Roof field and eave edges', z2: 'Rake edges, width a = ' + a + ', and the ridge band, 2a = ' + a2, z3: 'Ridge ends, 2a x a' }
        : lay === 'gable_gt27' ? { z1: 'Roof field, eave edges and ridge', z2: 'Rake edges, width a = ' + a, z3: 'Corners, a x a' }
        : { z1: 'Roof field', z2: 'Hips and ridge, a = ' + a + ' each side', z3: 'Eave perimeter, width a = ' + a };
      for (const k of ['z1p', 'z1', 'z2', 'z3']) if (r.zones[k] && !(k === 'z1p' && !g.hasInterior)) out.push({ zone: k === 'z1p' ? "1'" : k[1], key: k, color: COLOR[k], text: T[k] });
    }
    if (wr) {
      out.push({ zone: '4', key: 'z4', color: COLOR.z4, text: 'Wall field' });
      out.push({ zone: '5', key: 'z5', color: COLOR.z5, text: 'Wall corners, a = ' + ft(wr.a) + ' each way from the corner' });
    }
    return out;
  }

  return { COLOR, roofPlan, wallElevation, legend };
});
