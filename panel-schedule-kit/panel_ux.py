"""Panel schedule drawn like the panel itself: odd circuits on the left, even on the right, breakers on a centre bus.
Type scale of the set: names 22 pt, secondary lines 18 pt grey, nothing under 18 pt.

Colour has one job: Leg A (blue) and Leg B (violet) tie each bus stab to its leg total at the bottom. Everything else is black / grey.
Protection is printed where it is provided, so the electrician knows what to buy:
  'breaker'    -> inside the breaker box, under the trip and poles  (e.g. a dual-function AFCI / GFCI breaker)
  'receptacle' -> beside the description: "GFCI receptacle"
  'open'       -> beside the description: "AFCI + GFCI required"  (the method is still to be chosen)"""
from html import escape as E

INK, SUB, HAIR, CARD = '#1d1d1f', '#6e6e73', '#d2d2d7', '#f5f5f7'
PH = {'A': '#0a6fd6', 'B': '#5e5ce6'}
f0 = lambda v: format(int(round(v)), ',')

CSS = '''<style>
.pnx{font-family:"Barlow Semi Condensed",sans-serif;color:%(INK)s;font-size:22pt;line-height:1.12;font-variant-numeric:tabular-nums}
.pnx .hd{display:grid;grid-template-columns:auto 1fr;column-gap:.5in;align-items:end;padding:.05in .05in .16in;border-bottom:.018in solid %(INK)s}
.pnx .nm{font-weight:700;font-size:44pt;letter-spacing:-.01em;line-height:1}
.pnx .nm small{display:block;font-weight:500;font-size:20pt;color:%(SUB)s;letter-spacing:0;margin-top:.06in}
.pnx .kv{display:grid;grid-template-columns:repeat(3,auto);justify-content:end;column-gap:.34in;row-gap:.05in;font-size:19pt}
.pnx .kv div span{display:block;color:%(SUB)s;font-size:18pt}
.pnx .bd{display:grid;grid-template-columns:.62in 1fr 1.02in .62in 1.02in 1fr .62in;margin-top:.12in}
.pnx .c{display:flex;align-items:center;border-bottom:.008in solid %(HAIR)s;min-width:0}
.pnx .n{justify-content:center;color:%(SUB)s;font-size:19pt}
.pnx .d{flex-direction:column;justify-content:center;padding:0 .16in}
.pnx .d.l{align-items:flex-end;text-align:right}.pnx .d.r{align-items:flex-start;text-align:left}
.pnx .t{font-weight:500}
.pnx .s{font-size:18pt;color:%(SUB)s;margin-top:.03in}
.pnx .m{display:flex;gap:.07in;align-items:center;margin-top:.04in;font-size:18pt;color:%(SUB)s}
.pnx .d.l .m{justify-content:flex-end}
.pnx .chip{border:.012in solid #aeb0b6;border-radius:.09in;padding:0 .07in;color:%(INK)s;line-height:1.25}
.pnx .chip.w{background:%(CARD)s;border-color:%(CARD)s}
.pnx .bk{justify-content:center;padding:.09in .06in}
.pnx .br{width:100%%;height:100%%;box-sizing:border-box;border:.014in solid #b8bac0;border-radius:.1in;background:%(CARD)s;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}
.pnx .br b{font-weight:700;font-size:24pt;line-height:1}.pnx .br i{font-style:normal;font-size:18pt;color:%(SUB)s}.pnx .br u{text-decoration:none;font-size:18pt;font-weight:700;color:%(INK)s;line-height:1.05;margin-top:.03in;text-align:center}
.pnx .br.p2:after{content:"";position:absolute;left:18%%;right:18%%;top:50%%;height:.05in;margin-top:-.025in;background:#8e9096;border-radius:.03in;display:none}
.pnx .br.sp{background:#fff;border-style:dashed}
.pnx .bus{justify-content:center;position:relative;border-bottom:none}
.pnx .bus:before{content:"";position:absolute;top:0;bottom:0;left:50%%;width:.2in;margin-left:-.1in;background:#e8e8ed}
.pnx .ph{position:relative;width:.4in;height:.4in;border-radius:50%%;color:#fff;font-weight:700;font-size:19pt;display:flex;align-items:center;justify-content:center}
.pnx .sp .t,.pnx .sp{color:#a1a1a6}
.pnx .ft{display:grid;grid-template-columns:1fr 1fr;column-gap:.5in;margin-top:.22in;padding-top:.16in;border-top:.018in solid %(INK)s}
.pnx .bar{height:.16in;border-radius:.08in;background:#e8e8ed;margin:.05in 0 .12in;overflow:hidden}
.pnx .bar i{display:block;height:100%%;border-radius:.08in}
.pnx .big{font-weight:700;font-size:30pt}
.pnx .lab{font-size:18pt;color:%(SUB)s}
.pnx .pr{color:%(INK)s;font-weight:700}
</style>''' % dict(INK=INK, SUB=SUB, HAIR=HAIR, CARD=CARD)


def chips(wire):
    return '<span class="chip w">%s</span>' % E(wire.replace(' + ', ' Cu, ')) if wire else ''

def protection(prot, how):
    """-> (inside the breaker box, beside the description). prot: text naming AFCI and / or GFCI; how: {'AFCI': m, 'GFCI': m}, m in breaker / receptacle / open."""
    fn = [p for p in ('AFCI', 'GFCI') if p in prot]; by = lambda m: [p for p in fn if how.get(p, 'open') == m]
    box = '<br>'.join(by('breaker'))
    side = [' + '.join(by('open')) + ' required'] if by('open') else []
    side += ['%s receptacle' % p for p in by('receptacle')]
    return box, ' \u00b7 '.join(side)


def html(left, right, names, info, totals, slots=40, used_rows=10, method=None):
    """left / right: [(ckt, name, va, poles, trip, wire, protection)]; names: {ckt: (title, secondary)};
    info: [(label, value)]; totals: dict(A=, B=, conn=, amp=, serv=); method: {ckt: {'AFCI': m, 'GFCI': m}} (default: open)."""
    method = method or {}
    rows = slots // 2
    H = ['%.2fin' % (1.36 if r < used_rows else .34) for r in range(rows)]
    cells = []

    def put(col, row, span, cls, inner):
        cells.append('<div class="c %s" style="grid-column:%d;grid-row:%d / span %d">%s</div>' % (cls, col, row + 1, span, inner))

    for side, lst, cn, cd, cb in (('l', left, 1, 2, 3), ('r', right, 7, 6, 5)):
        taken = set()
        for ckt, nm, va, p, trip, wire, prot in lst:
            r0 = (ckt - 1) // 2; taken.update(range(r0, r0 + p))
            spare = nm.upper() == 'SPARE'
            num = '<br>'.join(str(ckt + 2 * k) for k in range(p))
            t, s = names.get(ckt, (nm, ''))
            put(cn, r0, p, 'n', num)
            inner = '<div class="t">%s</div>' % E(t) + ('<div class="s">%s</div>' % E(s) if s else '')
            box, beside = protection(prot or '', method.get(ckt, {}))
            if beside and not spare: inner += '<div class="m pr">%s</div>' % E(beside)
            if not spare: inner += '<div class="m">%s<span>%s VA</span></div>' % (chips(wire), f0(va))
            put(cd, r0, p, 'd %s%s' % (side, ' sp' if spare else ''), inner)
            put(cb, r0, p, 'bk', '<div class="br%s%s"><b>%s A</b><i>%dP</i>%s</div>' % (' p2' if p == 2 else '', ' sp' if spare else '', trip, p, '<u>%s</u>' % box if box else ''))
        for r in range(rows):
            if r in taken: continue
            put(cn, r, 1, 'n', str(2 * r + (1 if side == 'l' else 2)))
            put(cd, r, 1, 'd %s sp' % side, '<div class="t" style="font-size:19pt">Space</div>')
            put(cb, r, 1, 'bk', '')
    for r in range(rows):
        p_ = 'AB'[r % 2]
        put(4, r, 1, 'bus', '<div class="ph" style="background:%s%s">%s</div>' % (PH[p_], '' if r < used_rows else ';width:.3in;height:.3in;font-size:18pt', p_))
    kv = ''.join('<div><span>%s</span>%s</div>' % (E(a), E(b)) for a, b in info)
    mx = max(totals['A'], totals['B'])
    bal = ''.join('<div class="lab">Leg %s</div><div class="big" style="color:%s">%s VA</div><div class="bar"><i style="width:%.0f%%;background:%s"></i></div>'
                  % (p, PH[p], f0(totals[p]), 100 * totals[p] / mx, PH[p]) for p in 'AB')
    dem = ('<div class="lab">Connected load</div><div class="big">%s VA &#183; %.1f A</div><div style="height:.2in"></div>'
           '<div class="lab">Demand load, NEC 220 calculation</div><div class="big">%.1f A <span class="lab">of %d A</span></div>'
           '<div class="bar"><i style="width:%.0f%%;background:%s"></i></div>') % (f0(totals['conn']), totals['conn'] / 240, totals['amp'], totals['serv'], 100 * totals['amp'] / totals['serv'], INK)
    return (CSS + '<div class="pnx"><div class="hd"><div class="nm">%s<small>%s</small></div><div class="kv">%s</div></div>' % (E(totals['name']), E(totals['sub']), kv)
            + '<div class="bd" style="grid-template-rows:%s">%s</div>' % (' '.join(H), ''.join(cells))
            + '<div class="ft"><div>%s</div><div>%s</div></div></div>' % (bal, dem))


TCSS = '''<style>
.ctx{font-family:"Barlow Semi Condensed",sans-serif;color:%(INK)s;font-size:20pt;line-height:1.15;font-variant-numeric:tabular-nums;width:100%%;border-collapse:collapse}
.ctx td,.ctx th{padding:.05in .1in;border-bottom:.008in solid %(HAIR)s;vertical-align:top;text-align:left;font-weight:500}
.ctx .r{text-align:right;white-space:nowrap}
.ctx tr.sec th{font-weight:700;font-size:20pt;padding-top:.2in;border-bottom:.016in solid %(INK)s}
.ctx tr.sec th.g{color:%(SUB)s;font-weight:500;font-size:18pt}
.ctx td.in{padding-left:.36in}
.ctx td.nt{color:%(SUB)s;font-size:18pt}
.ctx tr.sub td{font-weight:700}
.ctx tr.tot td{font-weight:700;background:%(CARD)s}
.ctx tr.tot td.big{font-size:24pt}
''' % dict(INK=INK, SUB=SUB, HAIR=HAIR, CARD=CARD) + '</style>'


def calc_table(rows):
    """rows: (kind, item, value, unit, note) with kind in sec / sub / in / tot / ''."""
    out = []
    for k, a, v, u, n in rows:
        if k == 'sec':
            out.append('<tr class="sec"><th>%s</th><th class="r g">%s</th><th class="g">%s</th><th class="g">%s</th></tr>' % (E(a), E(v), E(u), 'Code reference / note' if v else ''))
        else:
            out.append('<tr class="%s"><td%s>%s</td><td class="r%s">%s</td><td>%s</td><td class="nt">%s</td></tr>' % (k if k != 'in' else '', ' class="in"' if k == 'in' else '', E(a), ' big' if k == 'tot' else '', E(v), E(u), E(n)))
    return TCSS + '<table class="ctx"><tbody>%s</tbody></table>' % ''.join(out)


# ---- scope every class name (the sheet template has its own .hd, .chip, .kv, .r ...) ----
import re as _re
def _scope_css(css): return _re.sub(r'\.(?!pnx\b|ctx\b)([a-z][a-z0-9]*)\b(?![\d])', lambda m: '.q-' + m.group(1), css)
def _scope_html(h): return _re.sub(r'class="([^"]*)"', lambda m: 'class="%s"' % ' '.join(t if t in ('pnx', 'ctx') else 'q-' + t for t in m.group(1).split()), h)
CSS, TCSS = _scope_css(CSS), _scope_css(TCSS)
_html, _calc = html, calc_table
def html(*a, **k):
    h = _html(*a, **k); i = h.index('</style>') + 8; return h[:i] + _scope_html(h[i:])
def calc_table(rows):
    h = _calc(rows); i = h.index('</style>') + 8; return h[:i] + _scope_html(h[i:])
