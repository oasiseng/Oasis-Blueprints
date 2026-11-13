#!/usr/bin/env python3
"""Draw the two cover figures of the public example: a parcel map and a key plan.

Both are drawn from the example lot in project.json (an invented lot), so nothing in them comes from a
real map, aerial photo or county record. Output: maps/parcel-map.png and maps/key-plan.png.

    python3 make_figs.py [path to skills/oasis-blueprints/assets]

Needs Playwright and Chromium (the same as print.py).
"""
import json, math, os, sys
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
# the skill's assets folder (for the fonts): given as the first argument, or found from the repo layout
KIT = sys.argv[1] if len(sys.argv) > 1 else next((c for c in (os.path.join(HERE, *(['..'] * n), d, 'oasis-blueprints', 'assets') for n, d in ((3, 'skills'), (1, 'skill')))
                                                  if os.path.isdir(c)), '')
P = json.load(open(os.path.join(HERE, 'project.json'), encoding='utf-8'))
g = P['site']['geometry']; lot = g['lot']; sbk = g['setbacks']; h = g['house']; s = g['sunroom']; p = g['porch']; dw = g.get('driveway')

INK, MUTED, RULE, TINT = '#16213a', '#56637a', '#b9c2d0', '#eef1f5'
NEW, NEWF, EX, EXF = '#1f63d6', '#cfe0fb', '#6f7a8c', '#eceff3'

# ---- the same construction as the site plan (siteplan.js, derive)
a = math.radians(lot['southBearingDeg'] - lot['northBearingDeg']) / 2
Rr, Rf = lot['rearRadiusFt'], lot['frontRadiusFt']
pt = lambda r, ang: (Rr - r * math.cos(ang), r * math.sin(ang))
arcX = lambda r, y: Rr - math.sqrt(r * r - y * y)
arc = lambda r, a0, a1, n=24: [pt(r, a0 + (a1 - a0) * k / n) for k in range(n + 1)]
xF, yN = Rr - Rf - sbk['frontFt'], 0.0
for _ in range(12):
    yN = ((Rr - xF) * math.sin(a) - sbk['northFt']) / math.cos(a)
    y0 = yN - h['wingWidthFt']; near = 0 if y0 <= 0 <= yN else min(abs(y0), abs(yN))
    xF = Rr - math.sqrt((Rf + sbk['frontFt']) ** 2 - near ** 2)
xR = xF - h['wingDepthFt']; xM = xR + h['mainDepthFt']; yS = yN - h['widthFt']; yW = yN - h['wingWidthFt']
house = [(xR, yS), (xM, yS), (xM, yW), (xF, yW), (xF, yN), (xR, yN)]
porch = [(xM, yW - p['widthFt']), (xM + p['depthFt'], yW - p['widthFt']), (xM + p['depthFt'], yW), (xM, yW)]
sx0, sx1, sy1 = xR - s['depthFt'], xR, yN - s['fromNorthWallFt']; sy0 = sy1 - s['widthFt']
sun = [(sx0, sy0), (sx1, sy0), (sx1, sy1), (sx0, sy1)]
drive = None
if dw:
    d0 = yW + dw.get('fromWingSouthFt', 0); d1 = d0 + dw['widthFt']; fl = dw.get('flareFt', 0)
    outer = [(arcX(Rf, d0 - fl + (d1 - d0 + 2 * fl) * k / 10), d0 - fl + (d1 - d0 + 2 * fl) * k / 10) for k in range(11)]
    drive = [(xF, d0), (arcX(Rf + fl, d0), d0)] + outer + [(arcX(Rf + fl, d1), d1), (xF, d1)]
lot_poly = arc(Rr, -a, a) + arc(Rf, a, -a)
lot_area = round(a * (Rr * Rr - Rf * Rf))
north_rot = math.radians(90 - (lot['northBearingDeg'] + lot['southBearingDeg']) / 2)   # counter-clockwise from plan up


class Fig:
    def __init__(self, x0, x1, yc, aspect, wpx=900):
        self.x0, self.k, self.w = x0, wpx / (x1 - x0), wpx
        self.hpx = round(wpx / aspect); self.y1 = yc + self.hpx / self.k / 2; self.o = []
    def P(self, q): return ((q[0] - self.x0) * self.k, (self.y1 - q[1]) * self.k)
    def poly(self, pts, fill='none', stroke=RULE, sw=1.5, dash='', close=True):
        d = ' '.join('%.1f,%.1f' % self.P(q) for q in pts)
        self.o.append('<%s points="%s" fill="%s" stroke="%s" stroke-width="%s"%s stroke-linejoin="round"/>' % (
            'polygon' if close else 'polyline', d, fill, stroke, sw, ' stroke-dasharray="%s"' % dash if dash else ''))
    def text(self, t, q, size=16, fill=MUTED, weight=600, rot=0, anchor='middle', ls=0.02):
        x, y = self.P(q)
        self.o.append('<text x="%.1f" y="%.1f" font-size="%s" fill="%s" font-weight="%s" text-anchor="%s" letter-spacing="%sem"%s>%s</text>' % (
            x, y, size, fill, weight, anchor, ls, ' transform="rotate(%.2f %.1f %.1f)"' % (-rot, x, y) if rot else '', t))
    def north(self, q, r=26):
        x, y = self.P(q); ux, uy = -math.sin(north_rot), -math.cos(north_rot)       # screen direction of north
        self.o.append('<circle cx="%.1f" cy="%.1f" r="%s" fill="#fff" stroke="%s" stroke-width="1.6"/>' % (x, y, r, INK))
        self.o.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.6"/>' % (x - ux * r, y - uy * r, x + ux * r * 1.3, y + uy * r * 1.3, INK))
        tx, ty = x + ux * r * 1.3, y + uy * r * 1.3; px, py = -uy, ux
        self.o.append('<polygon points="%.1f,%.1f %.1f,%.1f %.1f,%.1f" fill="%s"/>' % (tx, ty, tx - ux * 11 + px * 4, ty - uy * 11 + py * 4, tx - ux * 11 - px * 4, ty - uy * 11 - py * 4, INK))
        self.o.append('<text x="%.1f" y="%.1f" font-size="17" font-weight="700" fill="%s" text-anchor="middle">N</text>' % (tx + ux * 15, ty + uy * 15 + 6, INK))
    def svg(self, ident):
        return '<svg id="%s" xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d"><rect width="100%%" height="100%%" fill="#fff"/>%s</svg>' % (
            ident, self.w, self.hpx, self.w, self.hpx, ''.join(self.o))


deg = math.degrees(a)
# ---------------------------------------------------------------- 1  parcel map: the lot among its neighbours
f = Fig(-112, 204, 0, 1.494)
row = lambda r_in, r_out, step, off, nums: [(arc(r_out, off + step * k, off + step * (k + 1)) + arc(r_in, off + step * (k + 1), off + step * k), (r_in + r_out) / 2, off + step * (k + 0.5), nums + k) for k in range(-5, 5)]
ROW = 50                                                                           # street right-of-way drawn, feet
f.poly(arc(Rf, -0.6, 0.6, 60) + arc(Rf - ROW, 0.6, -0.6, 60), fill='#fafbfc', stroke='none')
for poly, rm, am, num in row(Rr, Rr + 112, 2 * a * 0.94, 2 * a * 0.37, 31) + row(Rf - ROW - 108, Rf - ROW, 2 * a * 1.12, -2 * a * 0.2, 52) + row(Rf, Rr, 2 * a, -a, 12):
    if rm == (Rf + Rr) / 2 and num == 12: continue
    f.poly(poly, fill=TINT, stroke='#9aa4b5', sw=1.4)
    lx, ly = f.P(pt(rm, am))
    if 45 < lx < f.w - 45 and 30 < ly < f.hpx - 30: f.text(str(num), pt(rm, am), size=17, fill='#8490a3', weight=600)   # no half-cut numbers at the edge
f.poly(lot_poly, fill='#fff', stroke=INK, sw=3.6)
f.text('LOT %s' % lot['number'], (50, 1.5), size=24, fill=INK, weight=700, ls=0.04)
f.text('{:,} SQ FT ±'.format(lot_area), (50, -9.5), size=15, fill=MUTED)
f.text("%.2f'" % lot['frontArcFt'], (Rr - Rf - 5.5, 0), size=14, rot=90)
f.text("%.2f'" % lot['rearArcFt'], (5.5 + 3.5, 0), size=14, rot=90)
m = pt((Rr + Rf) / 2, a); f.text("%.1f' ±" % (Rr - Rf), (m[0], m[1] - 6.5), size=14, rot=-deg)
m = pt((Rr + Rf) / 2, -a); f.text("%.1f' ±" % (Rr - Rf), (m[0], m[1] + 3.2), size=14, rot=deg)
f.text(g['street'].upper(), (Rr - Rf + ROW / 2 + 3.5, 0), size=19, fill=INK, weight=700, rot=90, ls=0.08)
f.o.append('<rect x="14" y="14" width="250" height="62" fill="#fff" stroke="%s" stroke-width="1.2"/>' % RULE)
f.o.append('<text x="26" y="40" font-size="17" font-weight="700" fill="%s" letter-spacing="0.06em">EXAMPLE SUBDIVISION</text><text x="26" y="62" font-size="14" font-weight="600" fill="%s" letter-spacing="0.04em">PB 00 PG 000 · EXAMPLE DATA</text>' % (INK, MUTED))
f.north((182, 78))
fig1 = f.svg('f1')

# ---------------------------------------------------------------- 2  key plan: what stands on the lot, area of work in blue
f = Fig(-22, 129.5, 0, 1.893)
f.poly(arc(Rf, -0.2, 0.2, 40) + arc(Rf - 40, 0.2, -0.2, 40), fill='#f7f8fa', stroke=RULE, sw=1.2)
if drive: f.poly(drive, fill='#f5f6f8', stroke=EX, sw=1.5)
f.poly(house, fill=EXF, stroke=EX, sw=1.8)
f.poly(porch, fill=EXF, stroke=EX, sw=1.5, dash='7 4')
f.poly(sun, fill=NEWF, stroke=NEW, sw=2.4)
f.poly(lot_poly, stroke=INK, sw=2.6, dash='22 5 5 5')
f.text('(E) RESIDENCE', ((xR + xM) / 2, (yS + yN) / 2 - 1), size=17, fill=INK, weight=700)
f.text('AREA OF WORK', ((sx0 + sx1) / 2 + 1.4, (sy0 + sy1) / 2), size=16, fill=NEW, weight=700, rot=90, ls=0.05)
if drive: f.text('(E) DRIVEWAY', ((xF + Rr - Rf) / 2, (d0 + d1) / 2 - 1.2), size=14)
f.text('LOT %s' % lot['number'], (82, -14), size=19, fill=INK, weight=700, ls=0.04)
f.text(g['street'].upper(), (Rr - Rf + 13, -6), size=16, fill=INK, weight=700, rot=90, ls=0.08)
f.north((119, 25), r=20)
fig2 = f.svg('f2')

face = lambda fam, w, pkg: '@font-face{font-family:"%s";font-weight:%d;src:url("file://%s") format("woff2")}' % (fam, w, os.path.abspath(os.path.join(KIT, 'fonts', '%s-latin-%d-normal.woff2' % (pkg, w))))
css = ''.join(face('Barlow Semi Condensed', w, 'barlow-semi-condensed') for w in (500, 600, 700)) + 'body{margin:0;background:#fff}svg{display:block;font-family:"Barlow Semi Condensed",Arial,sans-serif}'
os.makedirs(os.path.join(HERE, 'maps'), exist_ok=True)
html = os.path.join(HERE, 'maps', '_figs.html')
open(html, 'w', encoding='utf-8').write('<!doctype html><meta charset="utf-8"><style>%s</style>%s%s' % (css, fig1, fig2))
with sync_playwright() as pw:
    b = pw.chromium.launch(); pg = b.new_page(device_scale_factor=2, viewport={'width': 1000, 'height': 1400})
    pg.goto('file://' + html); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
    pg.locator('#f1').screenshot(path=os.path.join(HERE, 'maps', 'parcel-map.png'))
    pg.locator('#f2').screenshot(path=os.path.join(HERE, 'maps', 'key-plan.png'))
    b.close()
print('wrote maps/parcel-map.png, maps/key-plan.png | lot area', lot_area)
