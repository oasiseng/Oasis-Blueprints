"""Electrical riser diagram, N.T.S., drawn with the detail kit (det.py) on the large type scale.
Every rating is passed in (c), so the riser always agrees with the panel schedule and the load calculation."""
from det import D, INK, MUT, TINT

TS_BIG = 2.15                        # 0.105 x 1.22 x 2.15 = 0.28" lettering at the drawing's own size
SANC = '#16963e'                     # grounding electrode conductor (green)


def riser(c):
    """Electrical riser diagram, N.T.S., on the large type scale. Every rating comes from the service calculation (c), so the
    riser and the panel schedule / load calculation on E2.0 always agree. Paper inches (den 1)."""
    d = D(1, 'rs', TS_BIG); w = .02; L = .36
    d.pl([(-1.6, 0), (9.4, 0)], w=.016); d.soil([(-1.6, 0), (9.4, 0)], depth=.22, step=.32)
    d.tx(9.4, .14, 'FINISHED GRADE', sz=.09, a='end', c=MUT, b=500)
    # meter / main combo: the service disconnect
    d.rc(0, 1.2, 2.5, 6.6, w=w, c=INK, fill='#fff'); d.ci(1.25, 5.55, .62, w=.018, c=INK, fill=TINT); d.tx(1.25, 5.45, 'kWh', sz=.09, a='middle', b=600)
    for i, t in enumerate(['%d A' % c['serv'], 'METER /', 'MAIN']): d.tx(1.25, 4.15 - i * L, t, a='middle', b=700 if i == 0 else 600)
    d.tx(1.25, 2.4 - 0 * L, 'SERVICE', sz=.09, a='middle', c=MUT, b=500); d.tx(1.25, 2.4 - L * .9, 'DISCONNECT', sz=.09, a='middle', c=MUT, b=500)
    # panel A
    d.rc(6.0, 1.2, 9.0, 8.0, w=w, c=INK, fill='#fff')
    for i, t in enumerate([c['panel'], '%d A BUS' % c['bus'], 'MAIN LUG', '%d SPACES' % c['spaces']]): d.tx(7.5, 7.2 - i * L, t, a='middle', b=700 if i == 0 else 600)
    for k in range(5):                                                                              # breakers, drawn as a reminder of the panel layout
        y = 5.4 - k * .66; d.rc(6.45, y - .44, 7.35, y, w=.012, c=MUT, fill='#f2f3f6'); d.rc(7.65, y - .44, 8.55, y, w=.012, c=MUT, fill='#f2f3f6')
    d.pl([(7.5, 5.5), (7.5, 1.7)], w=.03, c='#c3c8d2')
    # feeder in conduit, meter / main to panel
    d.rc(2.5, 3.35, 6.0, 3.75, w=.016, c=INK, fill=TINT)
    for x in (2.7, 5.8): d.pl([(x, 3.35), (x, 3.75)], w=.012, c=INK)
    d.ld((4.25, 3.75), (3.0, 9.3), ['FEEDER IN %s' % c['conduit'], c['line'], c['neutral'], c['egc']], 'r')
    # underground service from the utility
    for x in (.7, 1.0): d.pl([(x, 1.2), (x, -1.4), (x - 1.2, -2.2)], w=.016, c=INK)
    d.ld((.05, -1.9), (-1.4, -3.3), ['UNDERGROUND SERVICE', 'FROM THE UTILITY'], 'l')
    # grounding electrode conductor to the rods
    d.pl([(1.9, 1.2), (1.9, -1.1), (4.6, -1.1)], w=.016, c=SANC); d.pl([(1.9, -1.1), (1.9, -2.6)], w=.016, c=SANC); d.pl([(4.6, -1.1), (4.6, -2.6)], w=.016, c=SANC)
    for x in (1.9, 4.6):
        for k, h in enumerate((.42, .28, .14)): d.pl([(x - h, -2.6 - k * .14), (x + h, -2.6 - k * .14)], w=.016, c=SANC)
    d.ld((4.6, -1.8), (5.6, -1.4), [c['gec'], c['rods']], 'r')
    # calculated load tag under the panel
    d.note(6.0, .82, ['CALCULATED LOAD %.1f A' % c['amp'], 'ON %d A (%s)' % (c['serv'], c.get('calc_ref', 'SEE LOAD CALCULATION'))], sz=.09, c=MUT, b=500)
    return d.out()
