# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
# native.py - content this set types natively instead of taking from a CAD window:
#   S0.0 structural notes (wording from the DWG, re-set), wind tables (from a wind calculator; stubbed here),
#   S2.0 product approval schedule (S2.0 table + office workbook), pictures supplied by the office.
import json, re, base64, html
E = html.escape

def uri(path):
    mime = "image/png" if path.endswith(".png") else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(open(path, "rb").read()).decode()

def sub(t):   # the converter writes a subscript as X/y
    t = E(t)
    for a, b in (("K/d", "K<sub>d</sub>"), ("GC/pi", "GC<sub>pi</sub>"), ("F/b", "F<sub>b</sub>")): t = t.replace(a, b)
    return t

def table(rows, cls="g", head=True, align=None):
    out = [f'<table class="{cls}">']
    for i, r in enumerate(rows):
        tag = "th" if head and i == 0 else "td"
        out.append("<tr>" + "".join(f'<{tag}{(" class=" + chr(34) + align[j] + chr(34)) if align and align[j] else ""}>{c}</{tag}>' for j, c in enumerate(r)) + "</tr>")
    return "".join(out) + "</table>"

# ---------------------------------------------------------------- S0.0 notes
WIND_EDIT = ("Ultimate Wind Speed V = 140 mph", "Ultimate Wind Speed V = 136 mph")
# wording changed on the office's instruction (wind speed, mean roof height, current standards)
EDITS = [("Ultimate Wind Speed V = 140 mph", "Ultimate Wind Speed V = 136 mph"), ("Mean Roof Height 12'", "Mean Roof Height 16'"),
 ('ACI 530/ASCE 5, "Building Code Requirements for Concrete Masonry Structures"; and ACI 530.1/ASCE 6,', 'TMS 402-22, "Building Code Requirements for Masonry Structures"; and TMS 602-22,'),
 ('"Specifications for the Design and Construction of Load-Bearing Concrete Masonry".', '"Specification for Masonry Structures".'),
 ("in accordance with ACI 530.1/ASCE 6.", "in accordance with TMS 602-22."),
 ("for Wood Construction, 2001 Edition,", "for Wood Construction, 2018 Edition,")]

def notes_html(lines_file, log):
    L = [l for l in json.load(open(lines_file)) if l != "<<COLBREAK>>"]
    for a, b in EDITS:
        assert sum(a in l for l in L) == 1, "edit not found once: " + a
        L = [l.replace(a, b) for l in L]; log.append("S0.0 wording: '%s' -> '%s'" % (a, b))
    secs = []; item = None
    for raw in L:
        t = raw.strip()
        if not t: continue
        if re.fullmatch(r"[A-Z][A-Z ,\-&]+", t) and not raw.startswith(" "):
            secs.append({"h": t, "items": [], "free": []}); item = None; continue
        m = re.match(r"(\d+)\. (.*)", t)
        if m and not raw.startswith(" "): item = {"n": int(m.group(1)), "lines": [m.group(2)]}; secs[-1]["items"].append(item); continue
        (item["lines"] if item else secs[-1]["free"]).append(t)
    T = {
     ("GENERAL NOTES", 13): (1, [["Occupancy / use", "Live load", "Dead load"], ["Roof", "20 psf", "25 psf"], ["Attic", "10 psf", "5 psf"], ["Floor", "40 psf", "20 psf"], ["Wall", "-", "12 psf"], ["Deck", "60 psf", "10 psf"], ["Snow", "3 psf", "-"]], 0),
     ("GENERAL NOTES", 14): (1, [["Governing Code", "2023 FBC"], ["Building Risk Category", "II"], ["Ultimate Wind Speed", "V = 136 mph"], ["Mean Roof Height", "16'"], ["Directionality Factor", "K/d = 0.85"], ["Gust-Effect Factor", "G= 0.9"], ["Exposure", "C"], ["Internal Pressure Coefficient", "GC/pi = ±0.18"]], 0),
     ("REINFORCED CONCRETE", 2): (1, [["Element", "Strength"], ["Footings", "3,000 psi"], ["Slabs-on-Grade", "3,000 psi"]], 1),
     ("REINFORCED CONCRETE", 6): (3, [["Element", "Bottom", "Top", "Sides"], ["Footings", '3"', '3"', '3"'], ["Slabs-on-Grade - Interior", '3"', '3/4"', '2"'], ["Slabs-on-Grade - Exterior", '3"', '1 1/2"', '2"']], 0),
     ("STRUCTURAL STEEL", 3): (1, [["HSS Shapes", "ASTM A500, GRADE B"], ["W Shapes", "A992"], ["Continuity Plates", "ASTM A572 (Fy=50 KSI)"], ["Other Shapes And Plates", "ASTM A36"], ["Electrodes", "ASTM E70XX"], ["Base Plates", "ASTM A36"]], 0),
     ("WOOD", 2): (1, [["Member", "Species", "F/b (psi)", "E (psi)"], ["Joists", "So. Pine No. 2", "1,500", "1,400,000"], ["Beam", "Microllam LVL", "2,600", "2,000,000"]], 0),
    }
    HEADED = {("GENERAL NOTES", 13), ("REINFORCED CONCRETE", 2), ("REINFORCED CONCRETE", 6), ("WOOD", 2)}
    out = []; src_words = []; out_words = []
    W = lambda s: re.findall(r"\S+", s)
    for s in secs:
        out.append(f"<h4>{E(s['h'].title() if False else s['h'])}</h4>")
        src_words += W(s["h"]); out_words += W(s["h"])
        if s["items"]: out.append("<ol>")
        for it in s["items"]:
            src_words += W(" ".join(it["lines"]))
            key = (s["h"], it["n"])
            if key in T:
                k, rows, tail = T[key]
                lead = " ".join(it["lines"][:k]); rest = it["lines"][k:]
                tl = rest[len(rest) - tail:] if tail else []
                body = sub(lead) + table([[sub(c) for c in r] for r in rows], "nt" + ("" if key in HEADED else " kvt"), head=key in HEADED) + "".join(f"<div>{sub(x)}</div>" for x in tl)
                flat = W(lead) + [w for r in rows for c in r for w in W(c)] + W(" ".join(tl))
                # the table is the same words as the source lines, in the same order (headings re-cased only)
                a = [w.lower() for w in W(" ".join(it["lines"]))]; b = [w.lower() for w in flat]
                b = [w for w in b if w != "/"]; a = [w for w in a if w != "/"]
                if "".join(a).replace("/", "") != "".join(b).replace("/", ""): log.append(f"S0.0 {key}: table differs from source: {a} vs {b}")
                out_words += W(" ".join(it["lines"]))
            else:
                subs = []; txt = []; cur = txt
                for ln in it["lines"]:
                    m = re.match(r"([a-z])\. (.*)", ln)
                    if m: subs.append([m.group(2)]); cur = subs[-1]
                    else: cur.append(ln)
                body = sub(" ".join(txt)) + ("<ol class='al'>" + "".join(f"<li>{sub(' '.join(x))}</li>" for x in subs) + "</ol>" if subs else "")
                out_words += W(" ".join(it["lines"]))
            out.append(f'<li value="{it["n"]}">{body}</li>')
        if s["items"]: out.append("</ol>")
        if s["free"]:
            src_words += W(" ".join(s["free"])); out_words += W(" ".join(s["free"]))
            para = []; dash = []; after = []
            for ln in s["free"]:
                if ln.startswith("- "): dash.append(ln[2:])
                elif dash: after.append(ln)
                else: para.append(ln)
            out.append(f"<p>{sub(' '.join(para))}</p>" + ("<ul>" + "".join(f"<li>{sub(d)}</li>" for d in dash) + "</ul>" if dash else "") + (f"<p>{sub(' '.join(after))}</p>" if after else ""))
    if src_words != out_words: log.append("S0.0: word check failed")
    log.append(f"S0.0 notes: {len(secs)} sections, {sum(len(s['items']) for s in secs)} numbered notes, {len(src_words)} words carried over ({len(EDITS)} wording edits listed above)")
    return "".join(out)

# ---------------------------------------------------------------- wind tables
# The firm's wind calculators are not part of this repository. wind() returns fixed example results for one
# example building (the inputs below), so the tables on S0.0 can be typeset. Replace it with a call to your own
# calculator: it must return the same keys. The numbers here are an example, not a design.
EXAMPLE_INPUT = {"V": 136, "exposure": "C", "GCpi": 0.18, "Kd": 0.85, "Kzt": 1.0, "Ke": 1.0, "roof": "hip", "slope12": 6, "h": 16, "W": 50, "L": 69}
EXAMPLE_RESULT = {"Kh": 0.8624, "qh": 40.8363, "theta": 26.5651, "band": "b20_27", "fig": "Fig. 30.3-2F", "a": 5.0, "roof": [{"A": 10, "pos": 0.7, "ppos": 18.3273, "z1": -1.4, "z2": -2.0, "z3": -2.0, "pz1": -32.9059, "pz2": -45.4018, "pz3": -45.4018}, {"A": 20, "pos": 0.5796, "ppos": 15.8196, "z1": -1.2194, "z2": -1.699, "z3": -1.699, "pz1": -29.1442, "pz2": -39.1324, "pz3": -39.1324}, {"A": 50, "pos": 0.4204, "ppos": 12.5045, "z1": -0.9806, "z2": -1.301, "z3": -1.301, "pz1": -24.1716, "pz2": -30.8447, "pz3": -30.8447}, {"A": 100, "pos": 0.3, "ppos": 9.9967, "z1": -0.8, "z2": -1.0, "z3": -1.0, "pz1": -20.41, "pz2": -24.5753, "pz3": -24.5753}], "wall": [{"A": 10, "gp": 1.0, "g4": -1.1, "g5": -1.4, "pp": 24.5753, "p4": -26.6579, "p5": -32.9059}, {"A": 20, "gp": 0.9468, "g4": -1.0468, "g5": -1.2937, "pp": 23.4682, "p4": -25.5509, "p5": -30.6918}, {"A": 50, "gp": 0.8766, "g4": -0.9766, "g5": -1.1532, "pp": 22.0048, "p4": -24.0875, "p5": -27.7649}, {"A": 100, "gp": 0.8234, "g4": -0.9234, "g5": -1.0468, "pp": 20.8978, "p4": -22.9804, "p5": -25.5509}, {"A": 200, "gp": 0.7703, "g4": -0.8703, "g5": -0.9405, "pp": 19.7907, "p4": -21.8734, "p5": -23.3368}, {"A": 500, "gp": 0.7, "g4": -0.8, "g5": -0.8, "pp": 18.3273, "p4": -20.41, "p5": -20.41}], "red": 1.0}

def wind(w):
    assert w == EXAMPLE_INPUT, "wind() is a stub: connect your own calculator for other inputs"
    return EXAMPLE_RESULT

f2 = lambda v: f"{v:+.2f}".replace("-", "−")
Z1, Z2, Z3 = "#cfe8df", "#f4d9a6", "#f1b0a3"
sw = lambda c: f'<i class="zs" style="background:{c}"></i>'

def wind_params(w, R):
    rows = [
     ("Standard", "ASCE 7-22, Components and Cladding, Chapter 30 Part 1 (§30.3)", "A0.0 code list"),
     ("Building code", "2023 Florida Building Code, 8th Edition", "S0.0 note 1"),
     ("Risk category", "II", "S0.0 note 14"),
     ("Ultimate wind speed", f"V = {w['V']} mph", "Office"),
     ("Exposure", w["exposure"], "S0.0 note 14 · office"),
     ("Enclosure", f"Enclosed, GC<sub>pi</sub> = ±{w['GCpi']}", "S0.0 note 14"),
     ("Roof", f"Hip, {w['slope12']}:12 (θ = {R['theta']:.2f}°)", "A1.1"),
     ("Mean roof height", f"h = {w['h']} ft", "Office"),
     ("Plan dimensions", f"W = {w['W']} ft · L = {w['L']} ft", "A1.0"),
     ("K<sub>d</sub>", f"{w['Kd']}, applied in the pressure equation", "S0.0 note 14"),
     ("K<sub>zt</sub> · K<sub>e</sub>", f"{w['Kzt']:.1f} · {w['Ke']:.1f}", "Office"),
     ("K<sub>h</sub> · q<sub>h</sub>", f"{R['Kh']:.3f} · {R['qh']:.2f} psf (strength)", "Computed"),
     ("Zone width a", f"{R['a']:.1f} ft = lesser of 0.1W and 0.4h, not less than 0.04W or 3 ft", "Computed"),
     ("Reporting basis", "ASD = 0.6 × strength. Not less than 9.6 psf ASD in either direction (§30.2.2)", "Engines"),
    ]
    return '<table class="kvw">' + "".join(f"<tr><th>{k}</th><td>{v}</td><td class='s'>{s}</td></tr>" for k, v, s in rows) + "</table>"

def wind_schematic(w, R):
    Lft, Wft, a = w["L"], w["W"], R["a"]
    k = 0.088                                    # inches of paper per foot, schematic only
    X, Y = 0.55, 0.3; Lp, Wp, ap = Lft * k, Wft * k, a * k
    r = lambda v: f"{v:.3f}"
    hip = [(X, Y, X + Wp / 2, Y + Wp / 2), (X, Y + Wp, X + Wp / 2, Y + Wp / 2), (X + Lp, Y, X + Lp - Wp / 2, Y + Wp / 2), (X + Lp, Y + Wp, X + Lp - Wp / 2, Y + Wp / 2), (X + Wp / 2, Y + Wp / 2, X + Lp - Wp / 2, Y + Wp / 2)]
    s = [f'<svg class="wz" viewBox="0 0 {r(X + Lp + 0.5)} {r(Y + Wp + 1.52)}" width="{r(X + Lp + 0.5)}in" height="{r(Y + Wp + 1.52)}in" xmlns="http://www.w3.org/2000/svg">',
         f'<defs><clipPath id="wzc"><rect x="{r(X)}" y="{r(Y)}" width="{r(Lp)}" height="{r(Wp)}"/></clipPath></defs>',
         f'<rect x="{r(X)}" y="{r(Y)}" width="{r(Lp)}" height="{r(Wp)}" fill="{Z1}"/>',
         '<g clip-path="url(#wzc)">' + "".join(f'<line x1="{r(x1)}" y1="{r(y1)}" x2="{r(x2)}" y2="{r(y2)}" stroke="{Z2}" stroke-width="{r(2 * ap)}" stroke-linecap="square"/>' for x1, y1, x2, y2 in hip) + "</g>",
         f'<path fill-rule="evenodd" fill="{Z3}" d="M{r(X)} {r(Y)}h{r(Lp)}v{r(Wp)}h{r(-Lp)}z M{r(X + ap)} {r(Y + ap)}v{r(Wp - 2 * ap)}h{r(Lp - 2 * ap)}v{r(-(Wp - 2 * ap))}z"/>',
         "".join(f'<line x1="{r(x1)}" y1="{r(y1)}" x2="{r(x2)}" y2="{r(y2)}" class="hl"/>' for x1, y1, x2, y2 in hip),
         f'<rect x="{r(X)}" y="{r(Y)}" width="{r(Lp)}" height="{r(Wp)}" class="ol"/>',
         f'<text x="{r(X + Lp / 2)}" y="{r(Y + Wp + 0.2)}" class="d">L = {Lft} ft</text>',
         f'<text transform="translate({r(X - 0.12)} {r(Y + Wp / 2)}) rotate(-90)" class="d">W = {Wft} ft</text>',
         f'<text x="{r(X + Lp * 0.27)}" y="{r(Y + Wp * 0.3)}" class="z">1</text><text x="{r(X + Lp / 2)}" y="{r(Y + Wp / 2 + 0.05)}" class="z">2</text><text x="{r(X + Lp / 2)}" y="{r(Y + ap / 2 + 0.05)}" class="z">3</text>',
         f'<text x="{r(X + Lp + 0.06)}" y="{r(Y + ap / 2 + 0.04)}" class="d" style="text-anchor:start">a</text>']
    # wall elevation: Zone 5 strips of width a at each corner, Zone 4 between
    Y2 = Y + Wp + 0.62; Hp = 0.62
    s += [f'<text x="{r(X)}" y="{r(Y2 - 0.12)}" class="t">Roof plan above · wall elevation below</text>',
          f'<rect x="{r(X)}" y="{r(Y2)}" width="{r(Lp)}" height="{r(Hp)}" fill="{Z1}"/>',
          f'<rect x="{r(X)}" y="{r(Y2)}" width="{r(ap)}" height="{r(Hp)}" fill="{Z3}"/><rect x="{r(X + Lp - ap)}" y="{r(Y2)}" width="{r(ap)}" height="{r(Hp)}" fill="{Z3}"/>',
          f'<path d="M{r(X - 0.12)} {r(Y2)} L{r(X + Lp * 0.5)} {r(Y2 - 0.42)} L{r(X + Lp + 0.12)} {r(Y2)}" class="hl" fill="none" style="display:none"/>',
          f'<rect x="{r(X)}" y="{r(Y2)}" width="{r(Lp)}" height="{r(Hp)}" class="ol"/>',
          f'<text x="{r(X + Lp / 2)}" y="{r(Y2 + Hp / 2 + 0.05)}" class="z">4</text><text x="{r(X + ap / 2)}" y="{r(Y2 + Hp / 2 + 0.05)}" class="z">5</text><text x="{r(X + Lp - ap / 2)}" y="{r(Y2 + Hp / 2 + 0.05)}" class="z">5</text>',
          f'<text x="{r(X + ap / 2)}" y="{r(Y2 + Hp + 0.17)}" class="d">a</text><text x="{r(X + Lp - ap / 2)}" y="{r(Y2 + Hp + 0.17)}" class="d">a</text>', "</svg>"]
    leg = (f'<div class="zl"><span>{sw(Z1)}<b>Zone 1</b> Roof field</span><span>{sw(Z2)}<b>Zone 2</b> Hips and ridge, band 2a = {2 * a:.1f} ft</span><span>{sw(Z3)}<b>Zone 3</b> Eave perimeter, width a = {a:.1f} ft</span>'
           f'<span>{sw(Z1)}<b>Zone 4</b> Wall field</span><span>{sw(Z3)}<b>Zone 5</b> Wall corners, width a = {a:.1f} ft in each direction</span></div>')
    return f'<div class="wzw">{"".join(s)}{leg}</div><p class="fn">Schematic of a rectangular hip roof W × L, ASCE 7-22 {R["fig"]} (roof) and Fig. 30.3-1 (walls). It is not the roof plan; for the roof shape see A1.1. Not to scale.</p>'

def wind_roof(w, R):
    r0 = R["roof"][0]
    t1 = table([["Roof zone (effective wind area 10 sf)", "GC<sub>p</sub> (+)", "GC<sub>p</sub> (−)", "P<sub>max</sub> ↓ psf", "P<sub>min</sub> ↑ psf"]] +
               [[f"{sw(c)}Zone {n} · {nm}", f2(r0["pos"]), f2(r0[z]), f2(r0["ppos"]), f2(r0["p" + z])] for n, nm, z, c in ((1, "Field", "z1", Z1), (2, "Hips and ridge", "z2", Z2), (3, "Eave perimeter", "z3", Z3))], "g wt", align=["", "r", "r", "r", "r"])
    t2 = table([["Effective wind area", "Downward, all zones", "Zone 1 uplift", "Zone 2 uplift", "Zone 3 uplift"]] +
               [[f"{x['A']} sf", f2(x["ppos"]), f2(x["pz1"]), f2(x["pz2"]), f2(x["pz3"])] for x in R["roof"]], "g wt", align=["", "r", "r", "r", "r"])
    return (t1 + '<p class="fn">P<sub>max</sub> is the downward (+) design pressure and P<sub>min</sub> the uplift (−). Uplift governs roof attachment.</p>' + t2 +
            f'<p class="fn">psf, ASD. p = q<sub>h</sub> K<sub>d</sub> (GC<sub>p</sub> − GC<sub>pi</sub>), ASCE 7-22 Eq. 30.3-1, hip roof 20° &lt; θ ≤ 27°, {R["fig"]}. GC<sub>p</sub> reduces with the log of the effective wind area from 10 sf to 100 sf and is constant beyond.</p>')

def wind_wall(w, R):
    t = table([["A (sf)", "GC<sub>p</sub> pos", "GC<sub>p</sub> Z4 neg", "GC<sub>p</sub> Z5 neg", "P pos", "P Zone 4 neg", "P Zone 5 neg"]] +
              [[x["A"], f2(x["gp"]), f2(x["g4"]), f2(x["g5"]), f2(x["pp"]), f2(x["p4"]), f2(x["p5"])] for x in R["wall"]], "g wt", align=["", "r", "r", "r", "r", "r", "r"])
    return t + ('<p class="fn">psf, ASD. Walls, low-rise, ASCE 7-22 Fig. 30.3-1: GC<sub>p</sub> log-interpolated from 10 sf to 500 sf (positive +1.0 to +0.7, Zone 4 −1.1 to −0.8, Zone 5 −1.4 to −0.8). '
                + ("Reduced 10% because θ ≤ 10°." if R["red"] < 1 else "The 10% reduction for θ ≤ 10° does not apply at this roof slope.") + ' Worst-case sign of GC<sub>pi</sub> taken for each zone.</p>'
                '<p class="fn">Tables on this sheet were produced with the wind calculators of the firm from the inputs listed under Wind design parameters.</p>')

# ---------------------------------------------------------------- S2.0 product approval schedule
NOTE = ("THIS SCHEDULE INCLUDES MULTIPLE APPROVED PRODUCT OPTIONS FOR DESIGN AND CONSTRUCTION FLEXIBILITY. NOT ALL LISTED PRODUCTS ARE REQUIRED OR INTENDED TO BE INSTALLED. "
        "CONTRACTOR SHALL SELECT THE APPLICABLE PRODUCTS AND ROOFING ASSEMBLY AND VERIFY COMPATIBILITY WITH THE PROJECT DESIGN, REQUIRED DESIGN PRESSURES, "
        "APPLICABLE FLORIDA BUILDING CODE, AND MANUFACTURER'S APPROVED INSTALLATION REQUIREMENTS. CONTRACTOR SHALL PROVIDE CURRENT PRODUCT APPROVALS AND INSTALLATION DOCUMENTATION AS APPLICABLE. "
        "APPROVED EQUIVALENT SUBSTITUTIONS ARE PERMITTED SUBJECT TO DESIGN COMPATIBILITY AND APPROVAL BY THE AUTHORITY HAVING JURISDICTION.")

def schedule(s20_rows, xlsx_rows, log):
    old = json.load(open(s20_rows)); new = [r for r in json.load(open(xlsx_rows))[2:] if r[4] or r[5]]
    new = [r for r in new if not r[0].startswith("GENERAL PRODUCT APPROVAL NOTE")]
    # Office: D02 is the garage door (Clopay, impact, +54 / -60 psf); D03 is an interior door and needs no approval; the non-impact Janus door is not shown
    k0 = (len(old), len(new)); old = [r for r in old if "Janus" not in r[3]]; new = [r for r in new if r[2] != "D02 / D03"]
    assert (len(old), len(new)) == (k0[0] - 1, k0[1] - 1)
    # rows: group, selection, product, description, FL no., NOA, impact, DP+, DP-, expiration, installation / comments
    rows = []; cat = comp = ""
    for r in old:
        if r[0]: cat, comp = r[0], r[2]
        grp = {"Doors": "Exterior doors", "Windows": "Windows", "Roofing": "Roofing · Option B, asphalt shingle"}[cat]
        if comp == "Garage": grp = "Garage doors"
        rows.append([grp, comp, r[3], "", r[5], "", r[4], r[7], r[8], r[6], ""])
    merged = {}
    for r in new:
        c, sel, prod, desc, fl, noa, inst, com = r[:8]
        grp = {"Exterior Door": "Exterior doors", "Window": "Windows", "Structural Connector": "Structural connectors", "Panel / Wall": "Soffit and structural components", "Structural Component": "Soffit and structural components"}.get(c)
        if desc == "Garage door": grp = "Garage doors"
        if c.startswith("Roofing"):
            grp = "Roofing · Option A, metal" if "OPTION A" in sel else "Roofing · Option B, asphalt shingle" if "OPTION B" in sel else "Roofing · separate, if applicable"
        comp = c.replace("Roofing - ", "") if c.startswith("Roofing") else {"GENERAL": "", "ADDITIONAL ALTERNATIVE": "Additional alternative"}.get(sel, sel)
        key = (grp, fl, noa, desc) if fl not in ("TBD", "N/A") else None
        if key and key in merged: merged[key][2] += " / " + prod; continue      # same approval, same description: one row
        row = [grp, comp, prod, desc, "" if fl == "N/A" else fl, "" if noa == "N/A" else noa, "", "", "", "", "; ".join(x for x in (inst, com) if x)]
        if prod == "CLOPAY": row[1], row[2], row[6], row[7], row[8] = "D02", "CLOPAY", "Yes", "54", "-60"
        rows.append(row)
        if key: merged[key] = row
    # Office: shingle roof (metal option not shown); owner's selections updated from the office summary; wall sheathing added
    rows = [r for r in rows if r[0] != "Roofing · Option A, metal"]
    UPD = {"FL12459.2": ["Sliding", "Pella Architect Series / Architect Series Reserve Sliding Impact Glass Door", "Clad traditional sliding door XO or OX Type 2 - 95.25 x 95.5 inches", "FL12459.2-R12", "", "Yes", "60", "-60", "12/29/2026", "Per approved Drawing 1667 and Glazing Detail A; HVHZ approved; Wind Zone 4 Missile D"],
           "FL47000.1": [None, "M/I Windows and Doors Series 1620 Single Hung - Vent F2E5", "Impact resistant vinyl single hung window", "FL47000.1-R1", "", "Yes", None, None, None, "Per approved 1620MDFPA-LM Rev A and A1 installation drawings; verify size-specific design pressures and anchorage"],
           "FL39780.1": ["Asphalt Shingles", "GAF Timberline HDZ", "Architectural laminated fiberglass asphalt roof shingles", "FL39780.1-R2", "22-1221.04", "No", "N/A", "N/A", "02/21/2027", "HVHZ approved listing; verify applicable roof slope and fastening requirements per approved installation instructions"]}
    for k, u in UPD.items():
        hit = [r for r in rows if r[4] == k]; assert len(hit) == 1, k
        for i, v in enumerate(u):
            if v is not None: hit[0][i + 1] = v
    rows.append(["Structural wall sheathing", "Structural Insulation", "Strong-R Structural Insulation - OX Engineered Products / Amrize Building Envelope LLC", "Structural rigid foam insulation with laminated fibrous sheathing", "FL28814.1-R3", "", "No", "60", "-60", "", "Per DrJ TER 1808-02 and approved installation instructions; confirm R3 pressure limits and fastening schedule"])
    for r in rows:
        if r[0] == "Roofing · Option B, asphalt shingle": r[0] = "Roofing · asphalt shingle"
    ids = [x for r in rows for x in (r[4], r[5]) if x and x != "TBD"]
    dup = sorted({x for x in ids if ids.count(x) > 1})
    log.append(f"S2.0 schedule: {len(old)} rows from the S2.0 table + {len(new)} rows from the workbook = {len(rows)} rows after merging rows that share one approval; repeated approval numbers: {dup or 'none'}")
    order = ["Exterior doors", "Garage doors", "Windows", "Structural wall sheathing", "Structural connectors", "Soffit and structural components", "Roofing · asphalt shingle", "Roofing · separate, if applicable"]
    HEAD = '<table class="g ps"><thead><tr><th>Type / selection</th><th>Product, model, manufacturer</th><th>Description</th><th>FL approval no.</th><th>Miami-Dade NOA</th><th class="c">Impact</th><th class="r">DP +</th><th class="r">DP −</th><th>Expiration</th><th>Installation reference and comments</th></tr></thead><tbody>'
    H1 = [HEAD]; H2 = [HEAD]; h = H1
    for g in order:
        rs = [r for r in rows if r[0] == g]
        if not rs: continue
        h = H1
        h.append(f'<tr class="sec"><th colspan="10">{E(g)}</th></tr>')
        last = None
        for r in rs:
            h.append("<tr>" + f"<td>{E(r[1]) if r[1] != last else ''}</td><td>{E(r[2])}</td><td>{E(r[3])}</td><td class='n'>{E(r[4])}</td><td class='n'>{E(r[5])}</td><td class='c'>{E(r[6])}</td><td class='r'>{E(r[7])}</td><td class='r'>{E(r[8]).replace('-', '−')}</td><td class='n'>{E(r[9])}</td><td>{E(r[10])}</td>" + "</tr>")
            last = r[1]
    H1.append("</tbody></table>"); H2.append("</tbody></table>"); parts = ["".join(H1), ""]
    assert len(rows) == sum(1 for r in rows if r[0] in order)
    return [parts[0] + '<p class="fn">Blank cell: not given in the source. Design pressures are as given in the source; the garage door pressures are psf, from the office. Expiration dates are shown as written in the source.</p>', parts[1]]

# ---------------------------------------------------------------- E3.0 panel schedule and load calculation (office workbook tables)
RENAME = {"chip": "ochip", "kv": "okv", "pa": "opa", "ph": "oph", "hold": "ohold"}
def elec(house_json, log):
    H = json.load(open(house_json)); S = {s["name"].split(" ")[0]: s for s in H["sheets"]}
    ren = lambda h: re.sub(r'class="([^"]+)"', lambda m: 'class="%s"' % " ".join(RENAME.get(c, c) for c in m.group(1).split()), h)
    def edit(h, pairs):
        for a, b in pairs:
            assert a in h, "not found: " + a[:50]
            h = h.replace(a, b); log.append("E3.0 wording: '%s' -> '%s'" % (a[:70], b[:70]))
        return h
    calm = lambda h: re.sub(r'<span class="eor">(.*?)</span>', r"\1", h, flags=re.S).replace("ASSUMED", "Assumed").replace("VERIFY", "field verify")
    panel = edit(S["E3.0"]["overlays"][0]["html"], [
        ("MINI-SPLIT A/C (dedicated per E1.0 note 3; location TBD)", "MINI-SPLIT A/C – GARAGE, FUTURE PERMIT (dedicated per E1.0 note 3)"),
        ("Loads that rest on assumed equipment are not confirmed.", "Loads marked assumed are typical values; contractor to field verify against the equipment installed."),
        ("See the notes below and the equipment inputs on E3.1.", "See the panel notes and the equipment inputs on this sheet.")])
    calc = S["E3.1"]["overlays"][0]["html"]
    eq = edit(S["E3.1"]["overlays"][1]["html"], [
        ("ASSUMED 1-ton; E1.0 note 3 requires dedicated circuit; location not shown – unlabeled 220V WP GFI at lanai may be its condenser; VERIFY", "Assumed 1-ton; in the garage under a future permit (Office); E1.0 note 3 requires dedicated circuit"),
        ('<div class="tt open">ITEMS TO VERIFY BEFORE PERMIT</div>', '<div class="tt">CONTRACTOR TO FIELD VERIFY</div>'),
        ('<ol class="open">', "<ol>"),
        ("Lanai 220 V WP GFI receptacle on E1.0 is unlabeled – confirm its purpose. Assumed to be the mini-split condenser (CKT 10). If it serves a spa/hot tub or other load, add a circuit and its load to LOAD CALC.",
         "Lanai 220 V WP GFI receptacle on E1.0 is unlabeled – confirm its purpose. The mini-split (CKT 10) will be in the garage under a future permit. If the lanai receptacle serves a spa/hot tub or other load, add a circuit and its load to LOAD CALC."),
        ("FORMULA – cover sheet 'House square footage' is blank; VERIFY with final area", "FORMULA – the same areas are shown on A0.0"),
        ("Red marks what the workbook calls assumed or to verify.", "Assumed values are typical nameplate figures for the contractor to field verify.")])
    eq, k = re.subn(r" \(A1\.0 labels it .*?VERIFY\)", "", eq); assert k == 1; log.append("E3.0 wording: removed the remark that A1.0 labels the garage offset 6'-9\" (A1.0 now reads 6'-8\")")
    a = eq.index("<li>Smoke/CO alarms and some receptacles are still to be added"); b = eq.index("</li>", a) + 5
    log.append("E3.0 wording: removed the item '%s...' (office: master bedroom has receptacles and alarms; the item came from an earlier drawing)" % re.sub("<.*?>", "", eq[a:a + 80]))
    eq = eq[:a] + eq[b:]
    i = eq.index('<div class="tt">CONTRACTOR TO FIELD VERIFY')
    notes = [p for g in S["E3.0"]["groups"] for p in g["prims"] if p[0] == "T" and p[7] and p[7][0] == "Notes:"][0][7][1:]
    items = []
    for ln in notes:
        if not ln.strip(): continue
        m = re.match(r"(\d+)\. (.*)", ln)
        if m: items.append(m.group(2))
        else: items[-1] += " " + ln
    nh = "<ol>" + "".join(f"<li>{E(t.replace('ASSUMED', 'assumed'))}</li>" for t in items) + "</ol>"
    w = lambda h: '<div class="cadw" style="position:static"><div class="ov" style="position:static">' + re.sub(r'^\s*<div class="tt[^"]*">.*?</div>', "", ren(calm(h)), count=1, flags=re.S) + "</div></div>"
    return {"panel": w(panel), "calc": w(calc), "equip": w(eq[:i]), "verify": w(eq[i:]), "notes": nh}
