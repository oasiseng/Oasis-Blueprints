/*! cc-wind.js v1.1.0 · ASCE 7-22 Components & Cladding wind pressures (Chapter 30) · MIT License
 *  Copyright (c) 2026 Oasis Engineering, LLC · https://github.com/oasiseng/Oasis-Blueprints (wind-cc-kit)
 *
 *  One file, no dependencies. Works as a browser global (CCWind) and as a Node module.
 *  Scope:  walls, h <= 60 ft (Fig. 30.3-1) and h > 60 ft (Fig. 30.4-1)
 *          roofs, h <= 60 ft: gable and hip, slope 0 to 45 degrees (Figs. 30.3-2A to 30.3-2G)
 *  Not in scope: overhangs (Sec. 30.7), parapets, monoslope roofs over 3 degrees, open buildings,
 *          roofs with h > 60 ft, rooftop equipment, tornado loads (Ch. 32), ASCE 7-16 roof zones.
 *
 *  Units: mph, ft, sq ft, psf. Positive pressure acts toward the surface, negative away from it.
 *  Results are at strength level and at ASD (0.6 W). The Sec. 30.2.2 minimum of 16 psf is applied at
 *  strength level, before the 0.6 factor.
 *
 *  This is a calculation aid. The engineer of record verifies every input and result.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CCWind = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '1.1.0';

  // ---------------------------------------------------------------- Chapter 26
  // Table 26.11-1 terrain exposure constants (ASCE 7-22).
  const EXPOSURE = {
    B: { alpha: 7.5, zg: 3280 },
    C: { alpha: 9.8, zg: 2460 },
    D: { alpha: 11.5, zg: 1935 },
  };
  // Table 26.10-1 Note 1: Kz = 2.41 (z/zg)^(2/alpha) for 15 ft <= z <= zg; for z < 15 ft use z = 15 ft,
  // in every exposure. The "0.70 in Exposure B below 30 ft" footnote of that table is for Chapter 28
  // (envelope MWFRS) only, and the zmin of Table 26.11-1 (30 / 15 / 7 ft) is for the gust-effect factor.
  // Neither is a floor for Kz in Chapter 30.
  const KZ_COEF = 2.41;
  const KZ_MIN_Z = 15;
  const KD = 0.85;                 // Table 26.6-1, buildings; in Eq. 30.3-1, not in qh
  const MIN_PRESSURE = 16;         // psf, Sec. 30.2.2, strength level
  const ASD_FACTOR = 0.6;          // Sec. 2.4.1, 0.6 W
  const GCPI = { enclosed: 0.18, partiallyOpen: 0.18, partiallyEnclosed: 0.55 };   // Table 26.13-1

  function kz(z, exposure, minHeight) {
    const c = EXPOSURE[exposure];
    if (!c) throw new Error('Exposure must be B, C or D');
    const floor = Math.max(minHeight || KZ_MIN_Z, KZ_MIN_Z);
    const zEff = Math.min(Math.max(z, floor), c.zg);
    return KZ_COEF * Math.pow(zEff / c.zg, 2 / c.alpha);
  }
  // Table 26.9-1: Ke = e^(-0.0000362 ze), ze = ground elevation above sea level, ft. Ke = 1.0 is always permitted.
  function ke(elevationFt) { return Math.exp(-0.0000362 * Math.max(elevationFt || 0, 0)); }
  // Eq. 26.10-1 (ASCE 7-22: Kd is not in q).
  function qz(z, s) { return 0.00256 * kz(z, s.exposure, s.kzMinHeight) * s.Kzt * s.Ke * s.V * s.V; }

  // Mean roof height: eave height for slopes of 10 degrees or less, else the mean of eave and ridge (Sec. 26.2).
  function meanRoofHeight(eave, ridge, thetaDeg) { return thetaDeg <= 10 ? eave : (eave + ridge) / 2; }
  const slopeToDeg = risePer12 => Math.atan(risePer12 / 12) * 180 / Math.PI;

  // Zone width a (Figs. 30.3-1 and 30.3-2): 10% of the least horizontal dimension or 0.4 h, whichever is
  // smaller, but not less than 4% of the least horizontal dimension or 3 ft. Exception: slope 0 to 7 degrees
  // and least horizontal dimension over 300 ft, a need not exceed 0.8 h.
  function zoneWidthA(least, h, thetaDeg) {
    let a = Math.max(Math.min(0.1 * least, 0.4 * h), 0.04 * least, 3);
    if (thetaDeg != null && thetaDeg <= 7 && least > 300) a = Math.min(a, Math.max(0.8 * h, 3));
    return a;
  }

  // ---------------------------------------------------------------- GCp curves
  // A curve is flat up to A1, log-linear from (A1, v1) to (A2, v2), flat beyond A2.
  // Every curve below has two sources: the equations in the ASCE 7-22 commentary (Tables C30.3-1 to C30.3-8) and
  // a back-calculation from the 2024 IRC Table R301.2.1(1), which is computed from the same figures (see the test file).
  // src stays 'C' (confirmed); mark a curve 'F' if one is ever added from a figure reading alone, and the tools flag it.
  const c = (A1, v1, A2, v2, src) => ({ A1, v1, A2, v2, src: src || 'C' });
  function gcpAt(curve, A) {
    if (A <= curve.A1) return curve.v1;
    if (A >= curve.A2) return curve.v2;
    return curve.v1 + (curve.v2 - curve.v1) * (Math.log10(A) - Math.log10(curve.A1)) / (Math.log10(curve.A2) - Math.log10(curve.A1));
  }

  // Walls. Fig. 30.3-1 (h <= 60 ft): values may be reduced 10% when the roof slope is 10 degrees or less.
  const WALL_LOW = { fig: 'Fig. 30.3-1', pos: c(10, 1.0, 500, 0.7), z4: c(10, -1.1, 500, -0.8), z5: c(10, -1.4, 500, -0.8) };
  // Fig. 30.4-1 (h > 60 ft): no slope reduction.
  const WALL_HIGH = { fig: 'Fig. 30.4-1', pos: c(20, 0.9, 500, 0.6), z4: c(20, -0.9, 500, -0.7), z5: c(20, -1.8, 500, -1.0) };

  // Roofs, h <= 60 ft. Zone 1' exists only on the low-slope figure.
  const ROOF = {
    '2A': { fig: 'Fig. 30.3-2A', range: 'θ ≤ 7°', layout: 'lowslope',
      pos: c(10, 0.3, 100, 0.2), z1p: c(100, -0.9, 1000, -0.4), z1: c(10, -1.7, 500, -1.0), z2: c(10, -2.3, 500, -1.4), z3: c(10, -3.2, 500, -1.4) },
    '2B': { fig: 'Fig. 30.3-2B', range: '7° < θ ≤ 20°', layout: 'gable_le27',
      pos: c(10, 0.6, 200, 0.3), z1: c(10, -2.0, 300, -0.5), z2: c(10, -2.7, 200, -1.0), z3: c(10, -3.6, 100, -1.8) },
    '2C': { fig: 'Fig. 30.3-2C', range: '20° < θ ≤ 27°', layout: 'gable_le27',
      pos: c(10, 0.6, 200, 0.3), z1: c(10, -1.5, 200, -0.8), z2: c(10, -2.5, 100, -1.2), z3: c(10, -3.0, 100, -1.4) },
    '2D': { fig: 'Fig. 30.3-2D', range: '27° < θ ≤ 45°', layout: 'gable_gt27',
      pos: c(10, 0.9, 200, 0.5), z1: c(10, -1.8, 100, -0.8), z2: c(10, -2.0, 200, -1.0), z3: c(10, -2.5, 200, -1.0) },
    '2E': { fig: 'Fig. 30.3-2E', range: '7° < θ ≤ 20°', layout: 'hip',
      pos: c(10, 0.7, 100, 0.3), z1: c(10, -1.8, 200, -0.8), z2: c(10, -2.4, 200, -1.3), z3: c(10, -2.6, 200, -1.4) },
    '2F': { fig: 'Fig. 30.3-2F', range: '20° < θ ≤ 27°', layout: 'hip',
      pos: c(10, 0.7, 100, 0.3), z1: c(10, -1.4, 100, -0.8), z2: c(10, -2.0, 100, -1.0), z3: c(10, -2.0, 100, -1.0) },
    '2G': { fig: 'Fig. 30.3-2G', range: 'θ = 45°', layout: 'hip',
      pos: c(10, 0.7, 100, 0.3), z1: c(10, -1.5, 100, -0.7), z2: c(10, -1.8, 100, -0.8), z3: c(10, -2.4, 100, -1.0) },
  };

  // Which figure governs. Slopes of 7 degrees or less use Fig. 30.3-2A whatever the roof shape.
  function roofFigure(roofType, thetaDeg) {
    if (thetaDeg < 0 || thetaDeg > 45) throw new Error('Roof slope must be between 0 and 45 degrees');
    if (thetaDeg <= 7) return { key: '2A' };
    if (roofType === 'gable') return { key: thetaDeg <= 20 ? '2B' : thetaDeg <= 27 ? '2C' : '2D' };
    if (roofType === 'hip') {
      if (thetaDeg <= 20) return { key: '2E' };
      if (thetaDeg <= 27) return { key: '2F' };
      if (thetaDeg >= 45) return { key: '2G' };
      // Fig. 30.3-2G Note 6: for 27 < slope < 45 degrees, interpolate between Figs. 30.3-2F and 30.3-2G
      // at the same effective wind area.
      return { key: '2F', key2: '2G', t: (thetaDeg - 27) / (45 - 27) };
    }
    throw new Error("roofType must be 'gable' or 'hip' (a flat or low-slope roof is either, at 7 degrees or less)");
  }

  // ---------------------------------------------------------------- pressures
  function site(input) {
    const s = {
      V: +input.V, exposure: input.exposure, h: +input.h,
      Kzt: input.Kzt == null ? 1 : +input.Kzt,
      Ke: input.Ke != null ? +input.Ke : ke(input.elevation),
      Kd: input.Kd == null ? KD : +input.Kd,
      enclosure: input.enclosure || 'enclosed',
      kzMinHeight: input.kzMinHeight || KZ_MIN_Z,
    };
    if (!(s.V > 0) || !(s.h > 0)) throw new Error('V and h must be positive numbers');
    if (!(s.Kzt >= 1)) throw new Error('Kzt cannot be less than 1.0');
    if (!(s.Ke > 0 && s.Ke <= 1)) throw new Error('Ke must be between 0 and 1.0');
    if (!(s.Kd > 0 && s.Kd <= 1)) throw new Error('Kd must be between 0 and 1.0');
    s.GCpi = GCPI[s.enclosure];
    if (s.GCpi == null) throw new Error("enclosure must be 'enclosed', 'partiallyOpen' or 'partiallyEnclosed'");
    s.Kh = kz(s.h, s.exposure, s.kzMinHeight);
    s.zEff = Math.min(Math.max(s.h, Math.max(s.kzMinHeight, KZ_MIN_Z)), EXPOSURE[s.exposure].zg);
    s.qh = 0.00256 * s.Kh * s.Kzt * s.Ke * s.V * s.V;
    return s;
  }

  // Sec. 30.2.2: not less than 16 psf acting in either direction (strength level).
  function finish(raw) {
    const governed = Math.abs(raw) < MIN_PRESSURE;
    const strength = governed ? MIN_PRESSURE * (raw < 0 ? -1 : 1) : raw;
    return { raw, strength, asd: strength * ASD_FACTOR, minGoverns: governed };
  }

  /** Wall pressures, Zones 4 and 5.
   *  input: V, exposure, h, least (least horizontal dimension), theta (roof slope, degrees), A (effective wind area),
   *         optional Kzt, Ke or elevation, Kd, enclosure, kzMinHeight, z (height of the component, h > 60 ft only). */
  function walls(input) {
    const s = site(input), A = +input.A, least = +input.least, theta = input.theta == null ? 0 : +input.theta;
    if (!(A > 0) || !(least > 0)) throw new Error('A and least horizontal dimension must be positive numbers');
    const high = s.h > 60, T = high ? WALL_HIGH : WALL_LOW;
    const reduced = !high && theta <= 10, r = reduced ? 0.9 : 1;
    const gcp = { pos: gcpAt(T.pos, A) * r, z4: gcpAt(T.z4, A) * r, z5: gcpAt(T.z5, A) * r };
    let p, zUsed = null, qzUsed = null;
    if (high) {
      // Eq. 30.4-1: p = q Kd (GCp) - qi Kd (GCpi); q = qz for positive (windward) pressure at height z, qh otherwise; qi = qh.
      zUsed = input.z == null ? s.h : Math.min(+input.z, s.h); qzUsed = qz(zUsed, s);
      p = { pos: s.Kd * (qzUsed * gcp.pos + s.qh * s.GCpi), z4: s.qh * s.Kd * (gcp.z4 - s.GCpi), z5: s.qh * s.Kd * (gcp.z5 - s.GCpi) };
    } else {
      // Eq. 30.3-1: p = qh Kd [(GCp) - (GCpi)], worst sign of GCpi each way.
      p = { pos: s.qh * s.Kd * (gcp.pos + s.GCpi), z4: s.qh * s.Kd * (gcp.z4 - s.GCpi), z5: s.qh * s.Kd * (gcp.z5 - s.GCpi) };
    }
    // Zone 5 width: a per Fig. 30.3-1; for h > 60 ft, 10% of the least horizontal dimension, not less than 3 ft.
    const a = high ? Math.max(0.1 * least, 3) : zoneWidthA(least, s.h, theta);
    return {
      method: high ? 'allHeights' : 'lowRise', fig: T.fig, equation: high ? 'Eq. 30.4-1' : 'Eq. 30.3-1',
      site: s, A, a, theta, slopeReduction: reduced, gcp, z: zUsed, qz: qzUsed,
      pos: finish(p.pos), z4: finish(p.z4), z5: finish(p.z5),
    };
  }

  const ZONE_KEYS = ['z1p', 'z1', 'z2', 'z3'];

  /** Roof pressures by zone.
   *  input: V, exposure, h, least, roofType ('gable' | 'hip'), theta (degrees), A,
   *         optional length (the other plan dimension, for the zone drawing), Kzt, Ke or elevation, Kd, enclosure, kzMinHeight. */
  function roof(input) {
    const s = site(input), A = +input.A, least = +input.least, theta = +input.theta;
    if (!(A > 0) || !(least > 0)) throw new Error('A and least horizontal dimension must be positive numbers');
    if (s.h > 60) throw new Error('Roof zones for h > 60 ft (Fig. 30.4-1) are not in this tool');
    const roofType = theta <= 7 ? (input.roofType || 'gable') : input.roofType;
    const f = roofFigure(roofType, theta), F = ROOF[f.key], G = f.key2 ? ROOF[f.key2] : null;
    const value = k => G ? gcpAt(F[k], A) + (gcpAt(G[k], A) - gcpAt(F[k], A)) * f.t : gcpAt(F[k], A);
    const gcp = { pos: value('pos') }, out = {}, unconfirmed = [];
    for (const k of ZONE_KEYS) {
      if (!F[k]) continue;
      gcp[k] = value(k);
      out[k] = finish(s.qh * s.Kd * (gcp[k] - s.GCpi));
      if (F[k].src === 'F' || (G && G[k].src === 'F')) unconfirmed.push(k);
    }
    const a = zoneWidthA(least, s.h, theta);
    const geometry = F.layout === 'lowslope'
      // Fig. 30.3-2A is drawn from h, not a: Zone 2 is the edge strip 0.6 h wide; Zone 3 is an L at each corner,
      // 0.6 h along each edge and 0.2 h deep; Zone 1 runs from 0.6 h to 1.2 h from the edge; Zone 1' is beyond 1.2 h.
      ? { layout: 'lowslope', edge: 0.6 * s.h, cornerLeg: 0.6 * s.h, cornerDepth: 0.2 * s.h, interiorFrom: 1.2 * s.h,
          hasInterior: least > 2.4 * s.h }
      : { layout: F.layout, a };
    return {
      fig: G ? 'Figs. 30.3-2F and 30.3-2G (Note 6 interpolation)' : F.fig, figKey: f.key, range: G ? '27° < θ < 45°' : F.range,
      interpolated: !!G, roofType: F.layout === 'lowslope' ? 'lowslope' : roofType, equation: 'Eq. 30.3-1',
      site: s, A, a, theta, least, length: input.length == null ? null : +input.length,
      gcp, pos: finish(s.qh * s.Kd * (gcp.pos + s.GCpi)), zones: out, geometry, unconfirmed,
    };
  }

  // Where each zone is, in words, for the governing figure.
  function zoneNames(layout) {
    if (layout === 'lowslope') return { z1p: 'interior, more than 1.2 h from an edge', z1: 'field', z2: 'edge strip, 0.6 h wide', z3: 'corners, L-shaped, 0.6 h by 0.2 h' };
    if (layout === 'gable_le27') return { z1: 'field and eave edges', z2: 'rake edges and ridge', z3: 'ridge ends' };
    if (layout === 'gable_gt27') return { z1: 'field, eave edges and ridge', z2: 'rake edges', z3: 'corners' };
    return { z1: 'field', z2: 'hips and ridge', z3: 'eave perimeter' };
  }

  return { VERSION, EXPOSURE, KD, MIN_PRESSURE, ASD_FACTOR, GCPI, WALL_LOW, WALL_HIGH, ROOF,
    kz, ke, qz, meanRoofHeight, slopeToDeg, zoneWidthA, gcpAt, roofFigure, site, walls, roof, zoneNames };
});
