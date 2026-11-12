// kit.js — scale-true SVG drawing kit.
// Model units are inches with y up. A view has a scale denominator `den` (model inches per sheet inch):
// ½" = 1'-0" is den 24. Text and line weights are given in sheet points and converted, so they print
// the same size on every view whatever its scale.
'use strict';

const PAL = {
  ink: '#16213a', muted: '#56637a', rule: '#b9c2d0', paper: '#ffffff',
  new: '#1f63d6', newFill: '#cfe0fb', newSolid: '#3b7be0',
  exist: '#6f7a8c', existFill: '#eceff3', existSolid: '#b4bcc9',
  slab: '#d5d9df', wall: '#e9ebee', glass: '#cfe6f5', ghost: '#e6e9ee',
  check: '#f0a928', shore: '#f08c2e', hold: '#e8730c', eor: '#c81d25', steel: '#2b3345',
};

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r3 = v => Math.round(v * 1000) / 1000;

// 254 -> 21'-2"    257.5 -> 21'-5½"
function ftin(v, approx) {
  const s = Math.round(v * 2) / 2, f = Math.floor(s / 12), i = s - f * 12, w = Math.floor(i), h = i - w > 0;
  return (f ? f + "'-" : '') + w + (h ? '½' : '') + '"' + (approx ? ' ±' : '');
}

// Units. Model geometry is in inches (default) or millimetres. UPI = model units per inch.
// den is what the drafter would say: 24 for ½" = 1'-0", 50 for 1:50.
let UPI = 1, FMT = ftin;
function setUnits(u) { UPI = u === 'mm' ? 25.4 : 1; FMT = u === 'mm' ? ((v, approx) => String(Math.round(v)) + (approx ? ' ±' : '')) : ftin; }
const SCALE_LABEL = { 4: '3" = 1\'-0"', 6: '2" = 1\'-0"', 8: '1½" = 1\'-0"', 12: '1" = 1\'-0"', 16: '¾" = 1\'-0"', 24: '½" = 1\'-0"', 32: '3/8" = 1\'-0"', 48: '¼" = 1\'-0"', 96: '1/8" = 1\'-0"' };
const scaleText = den => UPI === 1 && SCALE_LABEL[den] ? SCALE_LABEL[den] : '1:' + den;
// graphic scale bar, so a print at any size can still be measured
function scaleBar(den) {
  let spec;
  if (UPI === 1) spec = { 4: [[0, '0'], [3, '3"'], [6, '6"'], [12, "1'"]], 6: [[0, '0'], [3, '3"'], [6, '6"'], [12, "1'"]], 8: [[0, '0'], [6, '6"'], [12, "1'"], [24, "2'"]], 12: [[0, '0'], [6, '6"'], [12, "1'"], [24, "2'"]], 16: [[0, '0'], [12, "1'"], [24, "2'"], [36, "3'"]], 24: [[0, '0'], [12, "1'"], [24, "2'"], [48, "4'"]], 32: [[0, '0'], [24, "2'"], [48, "4'"], [72, "6'"]], 48: [[0, '0'], [24, "2'"], [48, "4'"], [96, "8'"]], 96: [[0, '0'], [48, "4'"], [96, "8'"], [192, "16'"]] }[den];
  else { const L = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].filter(v => v / (den * UPI) <= 2.4).pop(), t = v => v >= 1000 ? (v / 1000) + ' m' : v + ' mm'; if (L) spec = [[0, '0'], [L / 4, t(L / 4)], [L / 2, t(L / 2)], [L, t(L)]]; }
  if (!spec) return '';
  const k = den * UPI, L = spec[spec.length - 1][0] / k, h = 0.06; let s = '';
  for (let i = 0; i < spec.length - 1; i++) { const a = spec[i][0] / k, b = spec[i + 1][0] / k; s += `<rect x="${r3(a)}" y="0" width="${r3(b - a)}" height="${h}" fill="${i % 2 ? '#fff' : PAL.ink}" stroke="${PAL.ink}" stroke-width="0.008"/>`; }
  for (const [v, t] of spec) s += `<text x="${r3(v / k)}" y="${h + 0.115}" font-size="0.1" text-anchor="middle" fill="${PAL.muted}" font-weight="600">${esc(t)}</text>`;
  return `<svg class="sbar" width="${r3(L + 0.5)}in" height="0.22in" viewBox="-0.25 -0.01 ${r3(L + 0.5)} 0.22" xmlns="http://www.w3.org/2000/svg">${s}</svg>`;
}

const TEXT_PT = { t: 10.5, ts: 9, tb: 11.5, th: 13.5, td: 10, tN: 10.5, tR: 10.5, tm: 9 };

class View {
  constructor(den, id) { this.den = den; this.id = id; this.u = den * UPI / 72; this.out = []; this.defs = []; this.bb = [1e9, 1e9, -1e9, -1e9]; this.pats = {}; }
  pt(n) { return n * this.u; }
  ext(x, y) { const b = this.bb; if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; }
  _st(o) { return o && o.fill ? ` style="fill:${o.fill}"` : ''; }
  line(x1, y1, x2, y2, cls = 'o') { this.ext(x1, y1); this.ext(x2, y2); this.out.push(`<line class="${cls}" x1="${r3(x1)}" y1="${r3(-y1)}" x2="${r3(x2)}" y2="${r3(-y2)}"/>`); return this; }
  poly(pts, cls = 'o', close = true, o) { for (const p of pts) this.ext(p[0], p[1]); this.out.push(`<${close ? 'polygon' : 'polyline'} class="${cls}${close ? '' : ' nf'}" points="${pts.map(p => r3(p[0]) + ',' + r3(-p[1])).join(' ')}"${this._st(o)}/>`); return this; }
  rect(x0, y0, x1, y1, cls = 'o', o) { return this.poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], cls, true, o); }
  circle(x, y, r, cls = 'o') { this.ext(x - r, y - r); this.ext(x + r, y + r); this.out.push(`<circle class="${cls}" cx="${r3(x)}" cy="${r3(-y)}" r="${r3(r)}"/>`); return this; }
  arc(cx, cy, r, a0, a1, cls = 'o') { // degrees, counter-clockwise
    const p = a => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)], s = p(a0), e = p(a1);
    this.ext(s[0], s[1]); this.ext(e[0], e[1]);
    this.out.push(`<path class="${cls} nf" d="M${r3(s[0])} ${r3(-s[1])}A${r3(r)} ${r3(r)} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${r3(e[0])} ${r3(-e[1])}"/>`); return this; }
  // lumber cut in section: outline plus the X
  lumber(x0, y0, x1, y1, cls) { this.rect(x0, y0, x1, y1, cls); this.line(x0, y0, x1, y1, cls + ' xx'); this.line(x0, y1, x1, y0, cls + ' xx'); return this; }
  text(s, x, y, o = {}) {
    const cls = o.cls || 't', size = this.pt(o.size || TEXT_PT[cls] || 10.5), lines = String(s).split('\n'), lh = (o.lh || 1.2) * size, anchor = o.anchor || 'start', rot = o.rot || 0;
    this.ext(x, y); this.ext(x, y - (lines.length - 1) * lh);
    const tr = rot ? ` transform="rotate(${-rot} ${r3(x)} ${r3(-y)})"` : '';
    this.out.push(`<text class="${cls}" font-size="${r3(size)}" x="${r3(x)}" y="${r3(-y)}" text-anchor="${anchor}"${tr}>${lines.map((l, i) => `<tspan x="${r3(x)}" dy="${i ? r3(lh) : 0}">${esc(l)}</tspan>`).join('')}</text>`); return this; }
  arrow(tx, ty, fx, fy, cls = 'dot') { // filled arrowhead at (tx,ty) pointing away from (fx,fy)
    const a = Math.atan2(ty - fy, tx - fx), L = this.pt(6), w = this.pt(1.9), bx = tx - L * Math.cos(a), by = ty - L * Math.sin(a);
    return this.poly([[tx, ty], [bx - w * Math.sin(a), by + w * Math.cos(a)], [bx + w * Math.sin(a), by - w * Math.cos(a)]], cls); }
  // horizontal dimension: dim line at y, extension lines rising from yo
  dimH(x1, x2, y, yo, o = {}) {
    const d = y >= yo ? 1 : -1, g = this.pt(2.5), e = this.pt(3.5), t = this.pt(3);
    for (const x of [x1, x2]) { this.line(x, yo + d * g, x, y + d * e, 'dm'); this.line(x - t, y - t, x + t, y + t, 'dmt'); }
    this.line(x1, y, x2, y, 'dm');
    return this.text(o.text != null ? o.text : FMT(Math.abs(x2 - x1), o.approx), (x1 + x2) / 2, y + this.pt(3), { cls: 'td', anchor: 'middle' }); }
  dimV(y1, y2, x, xo, o = {}) {
    const d = x >= xo ? 1 : -1, g = this.pt(2.5), e = this.pt(3.5), t = this.pt(3);
    for (const y of [y1, y2]) { this.line(xo + d * g, y, x + d * e, y, 'dm'); this.line(x - t, y - t, x + t, y + t, 'dmt'); }
    this.line(x, y1, x, y2, 'dm');
    return this.text(o.text != null ? o.text : FMT(Math.abs(y2 - y1), o.approx), x - this.pt(3), (y1 + y2) / 2, { cls: 'td', anchor: 'middle', rot: 90 }); }
  // leader note. kind: undefined (ink), 'N' (new work, blue), 'R' (engineer still owes this, red + triangle)
  note(s, tx, ty, ex, ey, o = {}) {
    const side = o.side || (ex >= tx ? 'r' : 'l'), k = side === 'r' ? 1 : -1, kind = o.kind || '', cls = kind === 'N' ? 'tN' : kind === 'R' ? 'tR' : 't';
    const size = this.pt(TEXT_PT[cls]), sh = this.pt(9) * k;
    this.poly([[tx, ty], [ex, ey], [ex + sh, ey]], 'ld' + (kind === 'R' ? ' ldR' : ''), false);
    if (o.mark !== 'none') this.circle(tx, ty, this.pt(1.5), 'dot' + (kind === 'R' ? ' dotR' : ''));
    let x = ex + sh + this.pt(3) * k;
    if (kind === 'R') { const w = this.pt(9), h = this.pt(8.5), x0 = side === 'r' ? x : x - w, yb = ey - h * 0.45;
      this.poly([[x0, yb], [x0 + w, yb], [x0 + w / 2, yb + h]], 'eorT'); this.text('!', x0 + w / 2, yb + h * 0.14, { cls: 'eorX', size: 7.5, anchor: 'middle' }); x += (w + this.pt(3)) * k; }
    return this.text(s, x, ey - size * 0.34, { cls, anchor: side === 'r' ? 'start' : 'end' }); }
  // elevation datum: target symbol with a level line and a two-line label
  datum(s, x, y, toX) {
    const r = this.pt(4.5), k = toX >= x ? 1 : -1;
    this.line(x + r * k, y, toX, y, 'dm'); this.circle(x, y, r, 'o2'); this.line(x - r * 1.5, y, x + r * 1.5, y, 'o2'); this.line(x, y - r * 1.5, x, y + r * 1.5, 'o2');
    this.out.push(`<path class="dot" d="M${r3(x)} ${r3(-y)}L${r3(x + r)} ${r3(-y)}A${r3(r)} ${r3(r)} 0 0 0 ${r3(x)} ${r3(-y - r)}Z"/><path class="dot" d="M${r3(x)} ${r3(-y)}L${r3(x - r)} ${r3(-y)}A${r3(r)} ${r3(r)} 0 0 0 ${r3(x)} ${r3(-y + r)}Z"/>`);
    const lines = String(s).split('\n'), size = this.pt(TEXT_PT.ts);
    return this.text(s, x - k * this.pt(9), y + size * (lines.length - 1) * 1.2 + this.pt(3), { cls: 'ts', anchor: k > 0 ? 'end' : 'start' }); }
  // detail / section reference bubble: number over sheet
  bubble(x, y, num, sheet) {
    const r = this.pt(11); this.circle(x, y, r, 'bub'); this.line(x - r, y, x + r, y, 'o2');
    this.text(num, x, y + this.pt(2.2), { cls: 'tb', size: 9.5, anchor: 'middle' }); return this.text(sheet, x, y - this.pt(8.2), { cls: 'tm', size: 7, anchor: 'middle' }); }
  pat(name) {
    if (this.pats[name]) return this.pats[name];
    const id = name + '-' + this.id, u = this.u, f = r3; let d = '';
    if (name === 'wall') { const s = 5.5 * u; d = `<pattern id="${id}" width="${f(s)}" height="${f(s)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${f(s)}" height="${f(s)}" fill="#f1f3f5"/><line x1="0" y1="0" x2="0" y2="${f(s)}" stroke="${PAL.exist}" stroke-width="${f(0.7 * u)}"/></pattern>`; }
    if (name === 'conc') { const s = 44 * u, c = (x, y, r) => `<circle cx="${f(x * u)}" cy="${f(y * u)}" r="${f(r * u)}"/>`, t = (x, y) => `<path d="M${f(x * u)} ${f(y * u)}l${f(4 * u)} ${f(1 * u)}l${f(-3 * u)} ${f(3 * u)}z"/>`;
      d = `<pattern id="${id}" width="${f(s)}" height="${f(s)}" patternUnits="userSpaceOnUse"><rect width="${f(s)}" height="${f(s)}" fill="${PAL.slab}"/><g fill="${PAL.ink}" opacity=".5">${c(5, 7, .8)}${c(19, 4, .6)}${c(33, 11, .8)}${c(40, 27, .6)}${c(12, 22, .7)}${c(25, 30, .8)}${c(7, 38, .6)}${c(36, 40, .7)}${c(21, 41, .6)}${c(28, 17, .5)}</g><g fill="none" stroke="${PAL.ink}" stroke-width="${f(.5 * u)}" opacity=".5">${t(14, 11)}${t(33, 31)}${t(8, 28)}</g></pattern>`; }
    this.defs.push(d); return (this.pats[name] = `url(#${id})`); }
  svg(o = {}) {
    const p = this.pt(o.pad == null ? 4 : o.pad), [x0, y0, x1, y1] = this.bb, W = x1 - x0 + 2 * p, H = y1 - y0 + 2 * p;
    return `<svg class="sk" data-den="${this.den}" style="--u:${r3(this.u)}" width="${r3(W / (this.den * UPI))}in" height="${r3(H / (this.den * UPI))}in" viewBox="${r3(x0 - p)} ${r3(-y1 - p)} ${r3(W)} ${r3(H)}" xmlns="http://www.w3.org/2000/svg"><defs>${this.defs.join('')}</defs>${this.out.join('')}</svg>`; }
}

// ---- isometric (30° axonometric). x runs right-down, y runs left-down, z is up. Viewer sits at +x, +y, +z. ----
function shade(hex, f) { // f > 0 lightens toward white, f < 0 darkens toward black
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }

class Iso {
  constructor(den, id) { this.den = den; this.id = id; this.u = den * UPI / 72; this.items = []; this.over = []; }
  pt(n) { return n * this.u; }
  p(x, y, z) { return [(x - y) * 0.8660254, (x + y) * 0.5 - z]; }
  // box or sloped prism: zb / zt may be numbers or functions of y. order = paint layer; within a layer far paints first.
  solid(x0, x1, y0, y1, zb, zt, color, o = {}) { this.items.push({ k: 's', x0, x1, y0, y1, zb, zt, color, order: o.order || 0, key: (x0 + x1 + y0 + y1) / 2, o }); return this; }
  quad(pts, color, o = {}) { this.items.push({ k: 'q', pts, color, order: o.order || 0, key: pts.reduce((a, p) => a + p[0] + p[1], 0) / pts.length, o }); return this; }
  line3(a, b, cls) { const p = this.p(...a), q = this.p(...b); this.over.push(`<line class="${cls}" x1="${r3(p[0])}" y1="${r3(p[1])}" x2="${r3(q[0])}" y2="${r3(q[1])}"/>`); return this; }
  poly3(pts, cls) { this.over.push(`<polygon class="${cls}" points="${pts.map(a => this.p(...a).map(r3).join(',')).join(' ')}"/>`); return this; }
  label(s, at, ex, ey, o = {}) { // leader from a 3D point to an elbow given in screen units; text runs to o.side ('r' or 'l')
    const p = this.p(...at), k = (o.side || (ex >= p[0] ? 'r' : 'l')) === 'r' ? 1 : -1, sh = this.pt(8) * k, cls = o.kind === 'N' ? 'tN' : o.kind === 'R' ? 'tR' : 't', size = this.pt(o.size || 10.5), lines = String(s).split('\n');
    const x = ex + sh + this.pt(3) * k, y = ey + size * 0.34;
    this.over.push(`<polyline class="ld nf" points="${r3(p[0])},${r3(p[1])} ${r3(ex)},${r3(ey)} ${r3(ex + sh)},${r3(ey)}"/><circle class="dot" cx="${r3(p[0])}" cy="${r3(p[1])}" r="${r3(this.pt(1.6))}"/>` +
      `<text class="${cls}" font-size="${r3(size)}" x="${r3(x)}" y="${r3(y)}" text-anchor="${k > 0 ? 'start' : 'end'}">${lines.map((l, i) => `<tspan x="${r3(x)}" dy="${i ? r3(size * 1.2) : 0}">${esc(l)}</tspan>`).join('')}</text>`); return this; }
  svg() {
    const f = (v, y) => typeof v === 'function' ? v(y) : v, sw = r3(this.pt(0.45)), out = [];
    const face = (pts, fill, stroke, op) => `<polygon points="${pts.map(a => this.p(...a).map(r3).join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"${op != null ? ` fill-opacity="${op}"` : ''}/>`;
    for (const it of this.items.slice().sort((a, b) => a.order - b.order || a.key - b.key)) {
      const c = it.color, st = it.o.stroke || shade(c, -0.45);
      if (it.k === 'q') { out.push(face(it.pts, c, st, it.o.op)); continue; }
      const { x0, x1, y0, y1 } = it, b0 = f(it.zb, y0), b1 = f(it.zb, y1), t0 = f(it.zt, y0), t1 = f(it.zt, y1);
      out.push(face([[x0, y0, t0], [x1, y0, t0], [x1, y1, t1], [x0, y1, t1]], shade(c, 0.32), st, it.o.op));          // top
      out.push(face([[x1, y0, b0], [x1, y1, b1], [x1, y1, t1], [x1, y0, t0]], shade(c, -0.14), st, it.o.op));         // +x side
      out.push(face([[x0, y1, b1], [x1, y1, b1], [x1, y1, t1], [x0, y1, t1]], c, st, it.o.op));                        // +y side
    }
    return `<svg class="sk iso" data-den="${this.den}" style="--u:${r3(this.u)}" xmlns="http://www.w3.org/2000/svg">${out.join('')}${this.over.join('')}</svg>`; }
}

// wrap a long note to lines of about n characters
function wrap(s, n = 36) { const out = []; for (const para of String(s).split('\n')) { let line = ''; for (const w of para.split(/\s+/)) { if (line && (line + ' ' + w).length > n) { out.push(line); line = w; } else line = line ? line + ' ' + w : w; } out.push(line); } return out.join('\n'); }

if (typeof module !== 'undefined') module.exports = { PAL, esc, r3, ftin, setUnits, scaleText, scaleBar, TEXT_PT, View, Iso, shade, wrap };
