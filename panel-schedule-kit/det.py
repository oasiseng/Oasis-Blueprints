"""Small drawing kit for details in the office sheet style, the look of the office detail sheets: new work in blue (tinted
lumber with grain, blue outlines, bold blue callouts on dot leaders), concrete and masonry in grey tones, hardware in ink, what the
engineer still confirms in red.
A detail is drawn in model inches (x right, y up) at a scale den (model inches per paper inch); text sizes are paper inches.
D.out() returns the SVG of the detail in paper inches, its width and height."""
import math
INK, MUT, RED, HAT, BLU = '#16213a', '#56637a', '#c81d25', '#8a93a3', '#1f63d6'
TS = 1.22                                              # lettering scale for every detail (raised so the details print bigger)
BOOST = {}                                             # extra lettering scale for one detail, by its prefix, so every callout prints at a readable size
TINT, TINT2, GRAIN = '#dbe6fb', '#c6d7f8', '#8fb0ee'       # new lumber / sheet goods: fill, darker fill, grain
FONT = '"Barlow Semi Condensed","Arial Narrow",Arial,sans-serif'
class D:
    def __init__(s, den, pfx, ts=1.15, ink=INK): s.d = den; s.p = pfx; s.ts = ts * TS * BOOST.get(pfx, 1); s.ink = ink; s.o = []; s.b = [1e9, 1e9, -1e9, -1e9]      # ts scales every text size (details that print reduced get a larger ts)
    def _b(s, X, Y):
        b = s.b; b[0] = min(b[0], X); b[1] = min(b[1], Y); b[2] = max(b[2], X); b[3] = max(b[3], Y)
    def P(s, x, y): X, Y = x / s.d, -y / s.d; s._b(X, Y); return X, Y
    def pl(s, pts, w=.012, c=None, fill='none', close=False, dash=None):
        q = [s.P(*p) for p in pts]; c = c or s.ink
        s.o.append('<path d="M%s%s" fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round"%s/>' % ('L'.join('%.3f %.3f' % p for p in q), 'Z' if close else '', fill, c, w, ' stroke-dasharray="%s"' % dash if dash else ''))
    def rc(s, x0, y0, x1, y1, **k): s.pl([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], close=True, **k)
    def ci(s, x, y, r, w=.012, c=INK, fill='none'):
        X, Y = s.P(x, y); s._b(X - r / s.d, Y - r / s.d); s._b(X + r / s.d, Y + r / s.d)
        s.o.append('<circle cx="%.3f" cy="%.3f" r="%.3f" fill="%s" stroke="%s" stroke-width="%s"/>' % (X, Y, r / s.d, fill, c, w))
    def hat(s, kind, pts, w=.012, c=INK): s.pl(pts, w=w, c=c, fill='url(#%s-%s)' % (s.p, kind), close=True)
    def hr(s, kind, x0, y0, x1, y1, **k): s.hat(kind, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], **k)
    def X(s, x0, y0, x1, y1, w=.014):                       # new lumber in section: blue tint, crossed
        s.rc(x0, y0, x1, y1, w=w, c=BLU, fill=TINT); s.pl([(x0, y0), (x1, y1)], w=.006, c=GRAIN); s.pl([(x0, y1), (x1, y0)], w=.006, c=GRAIN)
    def wdp(s, pts, w=.014, fill=TINT, n=None):
        """new lumber seen from the side: a four-sided piece p0 -> p1 (one long edge), p2 -> p3 (the other), blue tint with grain along its length"""
        p0, p1, p2, p3 = pts; s.pl(pts, w=w, c=BLU, fill=fill, close=True)
        L = math.hypot(p1[0] - p0[0], p1[1] - p0[1]); T = math.hypot(p3[0] - p0[0], p3[1] - p0[1]); n = n or max(2, min(4, int(T / s.d / .14)))
        for i in range(1, n + 1):
            t = i / (n + 1); a = (p0[0] + (p3[0] - p0[0]) * t, p0[1] + (p3[1] - p0[1]) * t); b = (p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t)
            ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L; k0 = .08 + .13 * ((i * 37) % 5) / 5; k1 = 1 - (.06 + .12 * ((i * 53) % 7) / 7); amp = T * .035; seg = []
            m = max(6, int(L / s.d / .09))
            for j in range(m + 1):
                u = k0 + (k1 - k0) * j / m; wv = amp * math.sin(u * L / s.d * 1.3 + i * 1.7); seg.append((a[0] + ux * L * u - uy * wv, a[1] + uy * L * u + ux * wv))
            s.pl(seg, w=.005, c=GRAIN)
    def wd(s, x0, y0, x1, y1, g='v', w=.014, fill=TINT):      # new lumber, side view, grain vertical ('v') or horizontal ('h')
        s.wdp([(x0, y0), (x0, y1), (x1, y1), (x1, y0)] if g == 'v' else [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], w=w, fill=fill)
    def tx(s, x, y, t, sz=.105, a='start', c=INK, b=500, rot=0): s._tx(x, y, t, sz * s.ts, a, c, b, rot)
    def _tx(s, x, y, t, sz=.105, a='start', c=INK, b=500, rot=0):
        X, Y = s.P(x, y); n = len(t) * sz * .58
        if rot: s._b(X - sz, Y - n / 2); s._b(X + sz, Y + n / 2)
        else: s._b(X - (n if a == 'end' else n / 2 if a == 'middle' else 0), Y - sz); s._b(X + (n if a == 'start' else n / 2 if a == 'middle' else 0), Y + sz * .3)
        s.o.append('<text x="%.3f" y="%.3f" font-family=\'%s\' font-size="%s" font-weight="%s" fill="%s" stroke="#fff" stroke-width=".035" stroke-linejoin="round" paint-order="stroke" text-anchor="%s"%s>%s</text>' % (
            X, Y, FONT, sz, b, c, a, ' transform="rotate(%s %.3f %.3f)"' % (-rot, X, Y) if rot else '', t.replace('&', '&amp;').replace('<', '&lt;')))
    def ld(s, tgt, at, lines, side='r', c=INK, sz=.105):
        """leader: arrow at tgt, text block starting at 'at' (first line), on the right ('r', text runs right) or left ('l', text ends at 'at')"""
        sz = sz * s.ts; tx_, ty_ = at[0] / s.d, -at[1] / s.d; gx, gy = tgt[0] / s.d, -tgt[1] / s.d; c = BLU if c == INK else c      # callouts: bold blue (red stays red)
        for i, l in enumerate(lines): s._tx(at[0], at[1] - i * sz * 1.22 * s.d, l, sz=sz, a='start' if side == 'r' else 'end', c=c, b=600)
        sx = tx_ - .05 if side == 'r' else tx_ + .05; ex = sx - .16 if side == 'r' else sx + .16; yy = ty_ - sz * .32
        a = math.atan2(gy - yy, gx - ex); h = .075; t = .022
        lc = INK if c == BLU else c                                                                                            # leader line and dot in ink, as on the office details (red stays red)
        s.o.append('<path d="M%.3f %.3fL%.3f %.3fL%.3f %.3f" fill="none" stroke="%s" stroke-width=".007" stroke-linejoin="round"/>' % (sx, yy, ex, yy, gx, gy, lc))
        s.o.append('<circle cx="%.3f" cy="%.3f" r=".017" fill="%s" stroke="none"/>' % (gx, gy, lc))                              # dot at the thing called out
        s._b(gx, gy)
    def dim(s, p1, p2, off, t, c=INK, sz=.105):
        """dimension between p1 and p2 (model), dimension line offset 'off' model units to the left of p1->p2"""
        c = '#2b3550' if c == INK else c; dx, dy = p2[0] - p1[0], p2[1] - p1[1]; n = math.hypot(dx, dy); ux, uy = dx / n, dy / n; nx, ny = -uy, ux
        a = (p1[0] + nx * off, p1[1] + ny * off); b = (p2[0] + nx * off, p2[1] + ny * off); k = .06 * s.d
        s.pl([a, b], w=.006, c=c)
        for p, q in ((p1, a), (p2, b)):
            s.pl([(p[0] + nx * k * .5 * (1 if off > 0 else -1), p[1] + ny * k * .5 * (1 if off > 0 else -1)), (q[0] + nx * k * (1 if off > 0 else -1), q[1] + ny * k * (1 if off > 0 else -1))], w=.005, c=c)
            s.pl([(q[0] - (ux + nx) * k * .6, q[1] - (uy + ny) * k * .6), (q[0] + (ux + nx) * k * .6, q[1] + (uy + ny) * k * .6)], w=.014, c=c)
        sz = sz * s.ts; mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2; ang = math.degrees(math.atan2(dy, dx))
        if ang > 90 or ang <= -90: ang -= 180 * (1 if ang > 0 else -1); nx, ny = -nx, -ny
        s._tx(mx + nx * .04 * s.d * (1 if off > 0 else 1), my + ny * .04 * s.d, t, sz=sz, a='middle', c=c, rot=ang)
    def soil(s, pts, depth=.2, step=.3):
        """groups of three short strokes just below a ground edge (pts: polyline along the soil surface, model units, left to right)"""
        acc = 0.0; k = 0
        for a, b in zip(pts, pts[1:]):
            L = math.hypot(b[0] - a[0], b[1] - a[1]) / s.d; ux, uy = (b[0] - a[0]) / s.d / L, (b[1] - a[1]) / s.d / L; t = (step - acc) % step if acc else step / 2
            while t < L - .02:
                X, Y = s.P(a[0] + (b[0] - a[0]) * t / L, a[1] + (b[1] - a[1]) * t / L); sg = 1 if k % 2 == 0 else -1
                for j in (-.035, 0, .035):
                    x0, y0 = X + ux * j, Y - uy * j; s.o.append('<path d="M%.3f %.3fl%.3f %.3f" stroke="#8a93a3" stroke-width=".006" fill="none"/>' % (x0, y0 + .012, sg * depth * .55, depth)); s._b(x0 + sg * depth * .55, y0 + depth)
                t += step; k += 1
            acc = (acc + L) % step
    def brk(s, x, y0, y1, horiz=False):                       # break line
        m = (y0 + y1) / 2; k = .06 * s.d
        if horiz: s.pl([(y0, x), (m - k, x), (m - k * .4, x + k), (m + k * .4, x - k), (m + k, x), (y1, x)], w=.008)
        else: s.pl([(x, y0), (x, m - k), (x + k, m - k * .4), (x - k, m + k * .4), (x, m + k), (x, y1)], w=.008)
    def batt(s, x0, x1, y, h, n=None):                        # batt insulation loops
        n = n or max(2, int((x1 - x0) / (h * .55))); w = (x1 - x0) / n; pts = []
        for i in range(n):
            a = x0 + i * w
            for t in range(0, 21):
                u = t / 20; pts.append((a + w * (u + .32 * math.sin(2 * math.pi * u)), y + h * (.5 - .5 * math.cos(2 * math.pi * u))))
        s.pl(pts, w=.008, c=MUT)
    def note(s, x, y, lines, sz=.105, c=INK, b=500):
        sz = sz * s.ts
        for i, l in enumerate(lines): s._tx(x, y - i * sz * 1.25 * s.d, l, sz=sz, c=c, b=b)
    def out(s, m=.14):
        x0, y0, x1, y1 = s.b[0] - m, s.b[1] - m, s.b[2] + m, s.b[3] + m; p = s.p
        defs = ('<defs>'
                '<pattern id="%s-cmu" width=".07" height=".07" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".07" height=".07" fill="#f1f3f6"/><path d="M0 0H.07" stroke="#8a93a3" stroke-width=".007"/></pattern>'
                '<pattern id="%s-conc" width=".4" height=".34" patternUnits="userSpaceOnUse"><rect width=".4" height=".34" fill="#d9dde3"/><g fill="#a9b1bd"><rect x=".05" y=".06" width=".016" height=".016"/><rect x=".27" y=".19" width=".014" height=".014"/><rect x=".17" y=".29" width=".018" height=".018"/><rect x=".34" y=".04" width=".012" height=".012"/></g><g fill="#bfc6d0"><rect x=".2" y=".08" width=".02" height=".02"/><rect x=".09" y=".2" width=".016" height=".016"/><rect x=".36" y=".29" width=".014" height=".014"/><rect x=".02" y=".31" width=".012" height=".012"/></g><g fill="#8f98a6"><circle cx=".13" cy=".12" r=".005"/><circle cx=".31" cy=".11" r=".005"/><circle cx=".25" cy=".25" r=".005"/></g></pattern>'
                '<pattern id="%s-earth" width=".46" height=".3" patternUnits="userSpaceOnUse"><path d="M.02 .12l.1 -.1M.06 .12l.1 -.1M.10 .12l.1 -.1M.25 .28l.1 -.1M.29 .28l.1 -.1M.33 .28l.1 -.1" stroke="#8a93a3" stroke-width=".006"/></pattern>'
                '<pattern id="%s-gravel" width=".16" height=".12" patternUnits="userSpaceOnUse"><g fill="none" stroke="#8a93a3" stroke-width=".006"><circle cx=".04" cy=".04" r=".024"/><circle cx=".12" cy=".09" r=".02"/><circle cx=".11" cy=".025" r=".014"/></g></pattern>'
                '<pattern id="%s-foam" width=".06" height=".06" patternUnits="userSpaceOnUse"><rect width=".06" height=".06" fill="#e6eefc"/><path d="M0 .06L.06 0" stroke="#8fb0ee" stroke-width=".006"/></pattern>'
                '<pattern id="%s-mortar" width=".05" height=".05" patternUnits="userSpaceOnUse"><rect width=".05" height=".05" fill="#f3f5f8"/><circle cx=".012" cy=".012" r=".005" fill="#8a93a3"/><circle cx=".037" cy=".037" r=".005" fill="#8a93a3"/></pattern>'
                '<pattern id="%s-tile" width=".12" height=".12" patternUnits="userSpaceOnUse"><rect width=".12" height=".12" fill="#fff"/><path d="M0 0H.12M0 0V.12" stroke="#8a93a3" stroke-width=".006"/></pattern>'
                '<pattern id="%s-steel" width=".03" height=".03" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".03" height=".03" fill="#fff"/><path d="M0 0H.03" stroke="#16213a" stroke-width=".006"/></pattern>'
                '<pattern id="%s-dots" width=".07" height=".07" patternUnits="userSpaceOnUse"><rect width=".07" height=".07" fill="#e3e7ee"/><circle cx=".0175" cy=".0175" r=".0095" fill="#16213a"/><circle cx=".0525" cy=".0525" r=".0095" fill="#16213a"/></pattern>'
                '</defs>') % ((p,) * 9)
        w, h = x1 - x0, y1 - y0
        return '<svg x="0" y="-24" width="%.3f" height="%.3f" viewBox="%.3f %.3f %.3f %.3f" overflow="hidden" data-pfx="%s" data-ts="%.3f">%s%s</svg>' % (w, h, x0, y0, w, h, p, s.ts, defs, ''.join(s.o)), round(w, 3), round(h, 3)
