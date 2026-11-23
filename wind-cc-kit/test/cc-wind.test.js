// Verification cases for cc-wind.js. Run: node cc-wind.test.js
const W = require('../cc-wind.js');
let fail = 0, n = 0;
const near = (name, got, want, tol = 0.006) => { n++; if (!(Math.abs(got - want) <= tol)) { fail++; console.log('FAIL', name, 'got', got, 'want', want); } };
const ok = (name, cond) => { n++; if (!cond) { fail++; console.log('FAIL', name); } };

// Kz, Table 26.10-1 (tabulated values to 2 places)
near('Kz B 15', W.kz(15, 'B'), 0.57, 0.006); near('Kz B 13 = B 15', W.kz(13, 'B'), W.kz(15, 'B'), 1e-12);
near('Kz B 30', W.kz(30, 'B'), 0.70, 0.012); near('Kz C 15', W.kz(15, 'C'), 0.85); near('Kz C 30', W.kz(30, 'C'), 0.98);
near('Kz D 15', W.kz(15, 'D'), 1.03); near('Kz D 10 = D 15', W.kz(10, 'D'), W.kz(15, 'D'), 1e-12);
near('Kz C 60', W.kz(60, 'C'), 1.13); near('Kz B 100', W.kz(100, 'B'), 0.95, 0.01);
near('Kh B 15 exact', W.kz(15, 'B'), 0.5731, 0.0005); near('Kh C 30 exact', W.kz(30, 'C'), 0.9805, 0.0005);
near('Ke 5000 ft', W.ke(5000), 0.834, 0.001); near('Ke 0', W.ke(0), 1, 1e-12);

// Zone width a
near('a 100x50 h30', W.zoneWidthA(50, 30, 5), 5); near('a 18 h13', W.zoneWidthA(18, 13, 14), 3);
near('a 200 h20', W.zoneWidthA(200, 20, 5), 8); near('a 400 h15 low slope: 0.8h cap', W.zoneWidthA(400, 15, 5), 12);
near('a 400 h15 steep: 4% rule', W.zoneWidthA(400, 15, 20), 16);

// Walls, low-rise. Door / window calculator baseline: V=115, 100x50, h=30, C, enclosed, theta 5, A=20
let w = W.walls({ V: 115, exposure: 'C', h: 30, least: 50, theta: 5, A: 20 });
near('wall qh', w.site.qh, 33.20, 0.01); near('wall +', w.pos.strength, 29.1, 0.05); near('wall z4', w.z4.strength, -31.7, 0.05); near('wall z5', w.z5.strength, -37.9, 0.05);
ok('wall reduction on', w.slopeReduction === true);
// V=160, C, h=30, A=50, theta 4.76
w = W.walls({ V: 160, exposure: 'C', h: 30, least: 50, theta: 4.76, A: 50 });
near('wall160 +', w.pos.strength, 52.92, 0.02); near('wall160 z4', w.z4.strength, -57.84, 0.02); near('wall160 z5', w.z5.strength, -66.52, 0.02);
// GCp ends
w = W.walls({ V: 115, exposure: 'C', h: 30, least: 50, theta: 20, A: 10 });
near('GCp wall + 10', w.gcp.pos, 1.0); near('GCp z4 10', w.gcp.z4, -1.1); near('GCp z5 10', w.gcp.z5, -1.4);
w = W.walls({ V: 115, exposure: 'C', h: 30, least: 50, theta: 20, A: 600 });
near('GCp wall + 500', w.gcp.pos, 0.7); near('GCp z4 500', w.gcp.z4, -0.8); near('GCp z5 500', w.gcp.z5, -0.8);
// minimum 16 psf
w = W.walls({ V: 85, exposure: 'B', h: 15, least: 30, theta: 5, A: 500 });
ok('16 psf minimum governs', w.z4.minGoverns && w.z4.strength === -16 && Math.abs(w.z4.asd + 9.6) < 1e-9);

// Walls, h > 60 ft (Fig. 30.4-1)
w = W.walls({ V: 150, exposure: 'C', h: 100, least: 80, theta: 0, A: 20, z: 40 });
ok('high method', w.method === 'allHeights' && !w.slopeReduction);
near('high a', w.a, 8); near('high GCp z5', w.gcp.z5, -1.8); near('high GCp +', w.gcp.pos, 0.9);
near('high z4', w.z4.strength, w.site.qh * 0.85 * (-0.9 - 0.18), 1e-9);
near('high + uses qz', w.pos.strength, 0.85 * (W.qz(40, w.site) * 0.9 + w.site.qh * 0.18), 1e-9);
ok('qz40 < qh', w.qz < w.site.qh);

// Roof 2A. roof-wind-calculator baseline: V=160, C, h=30, A=10
let r = W.roof({ V: 160, exposure: 'C', h: 30, least: 100, roofType: 'gable', theta: 2, A: 10 });
near('2A qh', r.site.qh, 64.26, 0.01);
near('2A z1p', r.zones.z1p.strength, -58.99, 0.02); near('2A z1', r.zones.z1.strength, -102.68, 0.02);
near('2A z2', r.zones.z2.strength, -135.45, 0.02); near('2A z3', r.zones.z3.strength, -184.61, 0.02);
near('2A + ', r.gcp.pos, 0.3); ok('2A geometry by h', r.geometry.edge === 18 && r.geometry.cornerDepth === 6 && r.geometry.interiorFrom === 36);
r = W.roof({ V: 160, exposure: 'C', h: 30, least: 100, roofType: 'hip', theta: 5, A: 1000 });
near('2A z1p 1000', r.gcp.z1p, -0.4); near('2A z1 500+', r.gcp.z1, -1.0); near('2A z3 500+', r.gcp.z3, -1.4);

// Gable curves at 10 / 20 / 50 / 100 / end
const g = (type, th, A) => W.roof({ V: 140, exposure: 'C', h: 20, least: 40, roofType: type, theta: th, A }).gcp;
const row = (name, type, th, k, vals) => [10, 20, 50, 100].forEach((A, i) => near(name + ' ' + k + ' @' + A, g(type, th, A)[k], vals[i], 0.006));
row('2C', 'gable', 25, 'z1', [-1.50, -1.34, -1.12, -0.96]); row('2C', 'gable', 25, 'z2', [-2.50, -2.11, -1.59, -1.20]);
row('2C', 'gable', 25, 'z3', [-3.00, -2.52, -1.88, -1.40]); row('2C', 'gable', 25, 'pos', [0.60, 0.53, 0.44, 0.37]);
near('2B z1 @100', g('gable', 14, 100).z1, -0.9845, 0.001); near('2B z1 @300', g('gable', 14, 300).z1, -0.5);
near('2B z2 @10', g('gable', 14, 10).z2, -2.7); near('2B z2 @200', g('gable', 14, 200).z2, -1.0);
near('2B z3 @10', g('gable', 14, 10).z3, -3.6); near('2B z3 @100', g('gable', 14, 100).z3, -1.8);
near('2B + @10', g('gable', 14, 10).pos, 0.6); near('2B + @200', g('gable', 14, 200).pos, 0.3);
near('2D z1 @10', g('gable', 35, 10).z1, -1.8); near('2D z2 @200', g('gable', 35, 200).z2, -1.0); near('2D + @10', g('gable', 35, 10).pos, 0.9);
// Hip
near('2E z1 @10', g('hip', 18, 10).z1, -1.8); near('2E + @10', g('hip', 18, 10).pos, 0.7);
near('2F z2 @20', g('hip', 25, 20).z2, -3.0 + Math.log10(20), 0.001); near('2G z3 @10', g('hip', 45, 10).z3, -2.4);
near('hip 35 A20 z3 (Note 6)', g('hip', 35, 20).z3, -1.82, 0.006);
r = W.roof({ V: 140, exposure: 'C', h: 20, least: 40, roofType: 'hip', theta: 35, A: 20 });
ok('hip interpolated flag', r.interpolated && r.unconfirmed.includes('z1'));
// figure choice
ok('fig 7 deg -> 2A', W.roofFigure('gable', 7).key === '2A'); ok('fig 7.1 -> 2B', W.roofFigure('gable', 7.1).key === '2B');
ok('fig 20 -> 2B', W.roofFigure('gable', 20).key === '2B'); ok('fig 27 -> 2C', W.roofFigure('gable', 27).key === '2C');
ok('fig 27.1 -> 2D', W.roofFigure('gable', 27.1).key === '2D'); ok('fig hip 45 -> 2G', W.roofFigure('hip', 45).key === '2G');
let threw = false; try { W.roofFigure('gable', 50); } catch (e) { threw = true; } ok('slope > 45 rejected', threw);
// Small building in Exposure B below 30 ft: Kh uses 15 ft, not 30 ft
r = W.roof({ V: 141, exposure: 'B', h: 13, least: 18, roofType: 'gable', theta: 14.04, A: 10 });
near('B h13 Kh', r.site.Kh, 0.5731, 0.0005); near('B h13 qh', r.site.qh, 29.16, 0.01);
near('B h13 z3 ASD', r.zones.z3.asd, 0.6 * 29.158 * 0.85 * -3.78, 0.05); near('B h13 + ASD', r.pos.asd, 0.6 * 29.158 * 0.85 * 0.78, 0.05);
// optional conservative floor
r = W.roof({ V: 141, exposure: 'B', h: 13, least: 18, roofType: 'gable', theta: 14.04, A: 10, kzMinHeight: 30 });
near('kzMinHeight 30', r.site.Kh, 0.689, 0.001);
near('mean roof height', W.meanRoofHeight(10, 16, 14), 13); near('mean roof height low', W.meanRoofHeight(10, 11, 5), 10);
console.log(fail ? fail + ' of ' + n + ' FAILED' : 'all ' + n + ' checks passed'); process.exit(fail ? 1 : 0);
