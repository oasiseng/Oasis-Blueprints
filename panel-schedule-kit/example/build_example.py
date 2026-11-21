"""Builds example/panel-sheet.html: a sample E2.0-style sheet (panel schedule, riser, panel notes) from sample_panel.json.
Run from the kit folder:  python example/build_example.py"""
import json, os, sys, base64, re
HERE = os.path.dirname(os.path.abspath(__file__)); KIT = os.path.dirname(HERE); sys.path.insert(0, KIT)
import panel_ux as PX, riser as RS
from html import escape as E

J = json.load(open(os.path.join(HERE, 'sample_panel.json'), encoding='utf-8'))
def rows(side): return [(c, t, va, p, trip, w, pr) for c, t, s, va, p, trip, w, pr in side]
names = {r[0]: (r[1], r[2]) for r in J['left'] + J['right']}
L, R = rows(J['left']), rows(J['right'])

# leg totals: rows alternate legs A, B down the panel; a 2-pole load sits half on each leg
leg = {'A': 0.0, 'B': 0.0}
for lst in (L, R):
    for c, t, va, p, *_ in lst:
        for k in range(p): leg['AB'[((c - 1) // 2 + k) % 2]] += va / p
conn = leg['A'] + leg['B']
method = {int(k): v for k, v in J['method'].items()}
P = J['panel']
panel = PX.html(L, R, names, [tuple(x) for x in J['info']], dict(A=leg['A'], B=leg['B'], conn=conn, amp=P['demand_amps'], serv=P['serv'], name=P['name'], sub=P['sub']),
                slots=P['slots'], method=method)
svg, rw, rh = RS.riser(J['riser'])
svg = re.sub(r'<svg ', '<svg style="width:%.3fin;height:%.3fin" ' % (rw, rh), svg, count=1)
font = ''.join("@font-face{font-family:'Barlow Semi Condensed';font-weight:%d;src:url(data:font/ttf;base64,%s)}" % (w, base64.b64encode(open(os.path.join(KIT, 'fonts', 'barlow-semi-condensed-latin-%d-normal.ttf' % w), 'rb').read()).decode()) for w in (500, 700))
notes = ''.join('<li>%s</li>' % E(n) for n in J['notes'])
page = '''<!doctype html><html><head><meta charset="utf-8"><title>Panel schedule (sample)</title><style>%s
@page{size:36in 24in;margin:0}
html,body{margin:0;background:#fff}
.sheet{width:36in;height:24in;box-sizing:border-box;padding:.5in;display:grid;grid-template-columns:13.6in 1fr;gap:.3in;font-family:"Barlow Semi Condensed",sans-serif;color:#1d1d1f}
.card{border:.012in solid #c9ccd3;border-radius:.06in;overflow:hidden;display:flex;flex-direction:column}
.card h2{margin:0;padding:.08in .14in;font-size:20pt;letter-spacing:.06em;text-transform:uppercase;background:#f5f5f7;border-bottom:.012in solid #c9ccd3}
.card .in{padding:.14in}
.right{display:grid;grid-template-rows:auto 1fr;gap:.3in}
ol{margin:0;padding-left:1.4em;font-size:20pt;line-height:1.3;columns:2;column-gap:.4in}li{margin-bottom:.06in;break-inside:avoid}
</style></head><body><div class="sheet">
<div class="card"><h2>Panel schedule</h2><div class="in">%s</div></div>
<div class="right"><div class="card"><h2>Electrical riser diagram</h2><div class="in" style="display:flex;justify-content:center">%s</div></div>
<div class="card"><h2>Panel notes</h2><div class="in"><ol>%s</ol></div></div></div>
</div></body></html>''' % (font, panel, svg, notes)
open(os.path.join(HERE, 'panel-sheet.html'), 'w', encoding='utf-8').write(page)
print('wrote example/panel-sheet.html')
