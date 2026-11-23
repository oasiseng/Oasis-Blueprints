/*! cc-wind-panels.js v1.0.0 · sheet panels for components and cladding wind pressures · MIT License
 *  Copyright (c) 2026 Oasis Engineering, LLC
 *
 *  Needs cc-wind.js (CCWind) and cc-wind-diagram.js (CCWindDiagram) loaded first.
 *
 *  CCWindKit.compute(spec)        -> { spec, site, theta, h, roofs: [roof result per area], walls: [wall result per area], open: [...] }
 *  CCWindKit.render(spec)         -> { parameters, zones, pressures, css }   three HTML strings and the scoped stylesheet
 *  CCWindKit.mount(spec, { parameters: el, zones: el, pressures: el })       fills three elements; call again after the spec changes
 *
 *  The spec is plain data (see example/sample_wind.json). Every number on the panels is computed here from the spec;
 *  nothing is typed in by hand, so the table, the drawing and the basis line cannot disagree.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cc-wind.js'), require('./cc-wind-diagram.js'));
  else root.CCWindKit = factory(root.CCWind, root.CCWindDiagram);
})(typeof self !== 'undefined' ? self : this, function (W, D) {
  'use strict';

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sgn = v => (v > 0 ? '+' : '−') + Math.abs(v).toFixed(1);
  const num = (v, d) => (+v).toFixed(d == null ? 1 : d).replace(/\.0+$/, '');
  const ENCL = { enclosed: 'Enclosed', partiallyOpen: 'Partially open', partiallyEnclosed: 'Partially enclosed' };
  const ZLABEL = { z1p: "Zone 1'", z1: 'Zone 1', z2: 'Zone 2', z3: 'Zone 3' };

  const CSS = '<style>' +
    '.ccw{font-family:"Barlow Semi Condensed","Segoe UI",Arial,sans-serif;color:#16213a;font-size:15pt;line-height:1.3;font-variant-numeric:tabular-nums}' +
    '.ccw table{border-collapse:collapse;width:100%}.ccw sub{font-size:.7em}' +
    '.ccw .kv th{text-align:left;font-weight:700;padding:3pt 10pt 3pt 0;white-space:nowrap;vertical-align:top}.ccw .kv td{padding:3pt 10pt 3pt 0;vertical-align:top}' +
    '.ccw .kv td.s{color:#56637a;text-align:right;padding-right:0;white-space:nowrap}.ccw .kv tr{border-bottom:.5pt solid #d5dbe6}' +
    '.ccw .pt{margin:.04in 0 .16in}.ccw .pt th{text-align:right;font-weight:700;padding:3pt 0 3pt 8pt;border-bottom:1pt solid #16213a}' +
    '.ccw .pt th:first-child,.ccw .pt td:first-child{text-align:left;padding:3pt 8pt 3pt 0}.ccw .pt td{text-align:right;padding:3pt 0 3pt 8pt;border-bottom:.5pt solid #d5dbe6}' +
    '.ccw p{margin:0 0 .06in}.ccw .open{color:#c62828;font-weight:700}.ccw .sub{color:#56637a;font-size:.8em}' +
    '.ccw .zw{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:.16in;align-items:center}.ccw .zw svg{width:100%;height:auto;display:block}' +
    '.ccw .lg span{display:block;margin-bottom:.09in;font-size:.87em}.ccw .lg i{display:inline-block;width:.16in;height:.16in;border:.5pt solid #56637a;margin-right:.07in;vertical-align:-2pt}' +
    '</style>';

  function compute(spec) {
    const roof = spec.roof || {}, plan = spec.plan || {};
    const theta = roof.theta != null ? +roof.theta : W.slopeToDeg(+roof.pitch || 0);
    const h = spec.h != null ? +spec.h : W.meanRoofHeight(+spec.eaveHeight, spec.ridgeHeight != null ? +spec.ridgeHeight : +spec.eaveHeight, theta);
    const least = Math.min(+plan.width, +plan.length), length = Math.max(+plan.width, +plan.length);
    const areas = spec.areas && spec.areas.length ? spec.areas : [10, 20, 50];
    const base = { V: spec.V, exposure: spec.exposure, h, least, length, theta, enclosure: spec.enclosure || 'enclosed',
      Kzt: spec.Kzt, Ke: spec.Ke, elevation: spec.elevation, Kd: spec.Kd, kzMinHeight: spec.kzMinHeight, roofType: roof.type || 'gable' };
    const open = [];
    for (const k of ['V', 'exposure']) if (spec[k] == null || spec[k] === '') open.push(k);
    if (!(least > 0)) open.push('plan dimensions');
    if (!(h > 0)) open.push('eave height or mean roof height');
    if (open.length) return { spec, open, theta, h };
    const walls = areas.map(A => W.walls(Object.assign({}, base, { A })));
    const roofs = spec.walls_only ? [] : areas.map(A => W.roof(Object.assign({}, base, { A })));
    return { spec, open, theta, h, least, length, areas, walls, roofs, site: walls[0].site };
  }

  const openMsg = c => '<p class="open">Open item: ' + esc(c.open.join(', ')) + ' not set. Pressures are not shown until the engineer provides ' + (c.open.length > 1 ? 'them' : 'it') + '.</p>';

  function parameters(c) {
    const s = c.spec, src = s.sources || {}, roof = s.roof || {}, plan = s.plan || {}, st = c.site;
    const slope = roof.pitch != null ? num(roof.pitch) + ':12 (' + c.theta.toFixed(1) + '°)' : c.theta.toFixed(1) + '°';
    const rows = [
      ['Standard', s.standard || 'ASCE 7-22', src.standard],
      ['Building code', s.code, src.code],
      ['Risk category', s.riskCategory, src.riskCategory],
      ['Ultimate wind speed', s.V != null ? 'V = ' + s.V + ' mph' : null, src.V],
      ['Exposure', s.exposure, src.exposure],
      ['Opening protection', s.openingProtection, src.openingProtection],
      ['Enclosure', st ? ENCL[st.enclosure] + ', GC<sub>pi</sub> = ±' + st.GCpi.toFixed(2) : null, src.enclosure],
      ['K<sub>d</sub>', st ? st.Kd.toFixed(2) : null, src.Kd],
      ['K<sub>zt</sub>', st && st.Kzt !== 1 ? st.Kzt.toFixed(2) : undefined, src.Kzt],
      ['Roof', (roof.type === 'hip' ? 'Hip' : c.theta <= 7 ? 'Low slope' : 'Gable') + ', ' + slope, src.roof],
      ['Eave height', s.eaveHeight != null ? num(s.eaveHeight) + ' ft' : undefined, src.eaveHeight],
      ['Mean roof height', c.h > 0 ? 'h = ' + num(c.h) + ' ft' : null, src.h],
      ['Plan dimensions', plan.width && plan.length ? num(plan.width) + ' ft x ' + num(plan.length) + ' ft' + (plan.note ? ', ' + esc(plan.note) : '') : null, src.plan],
    ].filter(r => r[1] !== undefined);
    return '<div class="ccw"><table class="kv"><tbody>' + rows.map(r => '<tr><th>' + r[0] + '</th><td>' + (r[1] == null ? '<span class="open">Not set</span>' : (/[<]/.test(r[1]) ? r[1] : esc(r[1]))) +
      '</td><td class="s">' + esc(r[2] || 'Engineer') + '</td></tr>').join('') + '</tbody></table></div>';
  }

  function zones(c) {
    if (c.open.length) return '<div class="ccw">' + openMsg(c) + '</div>';
    const r = c.roofs[0], w = c.walls[0];
    const lg = D.legend(r, w).map(l => '<span><i style="background:' + l.color + '"></i><b>Zone ' + l.zone + '</b> ' + esc(l.text) + '</span>').join('');
    return '<div class="ccw"><div class="zw"><div>' + (r ? D.roofPlan(r, { length: c.length, px: 520 }) : '') + '<p class="sub" style="margin:.04in 0">' + (r ? 'Roof plan above · wall elevation below' : 'Wall elevation') + '</p>' +
      D.wallElevation(w, { length: c.length, px: 520 }) + '</div><div class="lg">' + lg + '</div></div>' +
      '<p class="sub" style="margin-top:.08in">Schematic, ASCE 7-22 ' + (r ? r.fig + ' (roof) and ' : '') + w.fig + ' (walls). Drawn in proportion to the plan dimensions as one rectangle; see the roof plan for the real shape.' +
      (c.spec.zoneNote ? ' ' + esc(c.spec.zoneNote) : '') + '</p></div>';
  }

  function pressures(c) {
    if (c.open.length) return '<div class="ccw">' + openMsg(c) + '</div>';
    const st = c.site, w0 = c.walls[0], r0 = c.roofs[0], s = c.spec, E = W.EXPOSURE[st.exposure];
    const head = t => '<tr><th>' + t + '</th>' + c.areas.map(a => '<th>' + a + ' SF</th>').join('') + '</tr>';
    const row = (t, vals) => '<tr><td>' + t + '</td>' + vals.map(v => '<td>' + sgn(v.asd) + (v.minGoverns ? '*' : '') + '</td>').join('') + '</tr>';
    let h = '<div class="ccw"><p style="margin-bottom:.08in"><b>ASD pressures in psf (0.6 x strength level), by effective wind area.</b> Positive acts toward the surface, negative away from it.</p>';
    h += '<table class="pt"><tbody>' + head('Walls (' + w0.fig + ')') + row('Zones 4 and 5, positive', c.walls.map(x => x.pos)) +
      row('Zone 4, wall interior, negative', c.walls.map(x => x.z4)) + row('Zone 5, wall corners, negative', c.walls.map(x => x.z5)) + '</tbody></table>';
    let anyMin = c.walls.some(x => x.pos.minGoverns || x.z4.minGoverns || x.z5.minGoverns);
    if (r0) {
      const names = W.zoneNames(r0.geometry.layout), kind = r0.roofType === 'lowslope' ? 'Low-slope roof' : r0.roofType === 'hip' ? 'Hip roof' : 'Gable roof';
      h += '<table class="pt"><tbody>' + head(kind + ', ' + r0.range + ' (' + (r0.interpolated ? 'Figs. 30.3-2F, 2G' : r0.fig) + ')') + row('All zones, downward', c.roofs.map(x => x.pos));
      for (const k of Object.keys(r0.zones)) {
        if (k === 'z1p' && !r0.geometry.hasInterior) continue;
        h += row(ZLABEL[k] + ', ' + names[k].split(',')[0] + ', uplift', c.roofs.map(x => x.zones[k]));
      }
      h += '</tbody></table>';
      anyMin = anyMin || c.roofs.some(x => x.pos.minGoverns || Object.values(x.zones).some(z => z.minGoverns));
    }
    if (anyMin) h += '<p class="sub">* The 16 psf minimum of Sec. 30.2.2 governs (9.6 psf at ASD).</p>';
    h += '<p><b>Zone width a = ' + w0.a.toFixed(1) + ' ft</b>: ' + (w0.method === 'allHeights' ? '10% of the least horizontal dimension (' + num(c.least) + ' ft), not less than 3 ft (h &gt; 60 ft).'
      : 'the lesser of 10% of the least horizontal dimension (' + num(c.least) + ' ft) and 0.4 h, but not less than 4% of that dimension or 3 ft.') +
      (r0 && r0.geometry.layout === 'lowslope' ? ' Low-slope roof zones are set by h: edge 0.6 h = ' + r0.geometry.edge.toFixed(1) + ' ft, corner 0.6 h x 0.2 h.' : '') + ' Zones as drawn.</p>';
    h += '<p><b>Basis:</b> ' + (s.code ? esc(s.code) + '; ' : '') + 'ASCE 7-22 Chapter 30 ' + (st.h > 60 ? 'Part 2 (h &gt; 60 ft)' : 'Part 1 (h ≤ 60 ft)') + '. V = ' + st.V + ' mph' +
      (s.riskCategory ? ', Risk Category ' + esc(s.riskCategory) : '') + ', Exposure ' + st.exposure + ', ' + ENCL[st.enclosure].toLowerCase() + ' (GC<sub>pi</sub> = ±' + st.GCpi.toFixed(2) + '), h = ' + num(st.h) +
      ' ft, K<sub>zt</sub> = ' + st.Kzt.toFixed(2) + ', K<sub>e</sub> = ' + st.Ke.toFixed(st.Ke === 1 ? 1 : 3) + ', K<sub>d</sub> = ' + st.Kd.toFixed(2) + '.</p>';
    h += '<p>K<sub>h</sub> = 2.41 (' + num(st.zEff) + ' / ' + E.zg + ')<sup>2/' + E.alpha + '</sup> = ' + st.Kh.toFixed(3) +
      (st.zEff > st.h ? ' (z taken as ' + num(st.zEff) + ' ft' + (st.zEff === 15 ? ', the least height in Table 26.10-1' : ', set by the engineer') + ')' : '') +
      '. q<sub>h</sub> = 0.00256 x ' + st.Kh.toFixed(3) + ' x ' + st.Kzt.toFixed(2) + ' x ' + st.Ke.toFixed(st.Ke === 1 ? 1 : 3) + ' x ' + st.V + '² = ' + st.qh.toFixed(2) + ' psf, strength level. ' +
      (st.h > 60 ? 'p = q K<sub>d</sub> (GC<sub>p</sub>) − q<sub>h</sub> K<sub>d</sub> (GC<sub>pi</sub>), Eq. 30.4-1, positive pressure shown at z = h.' : 'p = q<sub>h</sub> K<sub>d</sub> (GC<sub>p</sub> − GC<sub>pi</sub>), Eq. 30.3-1.') + '</p>';
    if (r0 && r0.unconfirmed.length) h += '<p class="open">Check: the ' + r0.unconfirmed.map(k => ZLABEL[k]).join(' and ') + ' GC<sub>p</sub> line of ' + esc(r0.fig) + ' has not been confirmed against a second source for areas above 10 SF. Engineer to verify.</p>';
    h += '<p class="sub">Roof overhangs, parapets and rooftop equipment are not included.</p></div>';
    return h;
  }

  function render(spec) { const c = compute(spec); return { parameters: parameters(c), zones: zones(c), pressures: pressures(c), css: CSS, result: c }; }
  function mount(spec, els) {
    const out = render(spec);
    if (typeof document !== 'undefined' && !document.getElementById('ccw-css')) { const d = document.createElement('div'); d.id = 'ccw-css'; d.innerHTML = out.css; document.head.appendChild(d.firstChild).id = 'ccw-css'; }
    for (const k of ['parameters', 'zones', 'pressures']) if (els[k]) els[k].innerHTML = out[k];
    return out.result;
  }
  return { CSS, compute, render, mount };
});
