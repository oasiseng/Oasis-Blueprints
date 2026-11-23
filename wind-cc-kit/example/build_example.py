"""Builds example/wind-sheet.html from sample_wind.json: one self-contained page with the three panels.
The numbers are worked out in the browser from the data, so editing the JSON block in the built page and reloading
is enough to try another building.    Run: python example/build_example.py"""
import json, pathlib
HERE = pathlib.Path(__file__).parent
KIT = HERE.parent
spec = json.loads((HERE / "sample_wind.json").read_text(encoding="utf-8"))
js = "\n".join((KIT / n).read_text(encoding="utf-8") for n in ("cc-wind.js", "cc-wind-diagram.js", "cc-wind-panels.js"))
PAGE = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Wind C&amp;C kit sample</title>
<style>
@page{size:17in 11in;margin:0}
body{margin:0;background:#e9ecf1;font-family:"Barlow Semi Condensed","Segoe UI",Arial,sans-serif}
.sheet{width:17in;height:11in;box-sizing:border-box;margin:.2in auto;padding:.4in;background:#fff;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto 1fr;gap:.2in}
.panel{border:1pt solid #16213a;display:flex;flex-direction:column;min-height:0}
.panel .ph{background:#16213a;color:#fff;font-weight:700;font-size:13pt;letter-spacing:.06em;text-transform:uppercase;padding:.05in .12in}
.panel .pad{padding:.12in;font-size:10.5pt}
.panel .ccw{font-size:10.5pt}
#p3{grid-column:2;grid-row:1 / span 2}
.draft{position:fixed;right:.5in;bottom:.12in;font:700 10pt sans-serif;color:#c62828}
@media print{body{background:#fff}.sheet{margin:0}}
</style></head><body>
<div class="sheet">
  <section class="panel"><div class="ph">Wind design parameters</div><div class="pad" id="ccw-parameters"></div></section>
  <section class="panel" id="p3"><div class="ph">Components and cladding design pressures (ASD)</div><div class="pad" id="ccw-pressures"></div></section>
  <section class="panel"><div class="ph">Components and cladding zones</div><div class="pad" id="ccw-zones"></div></section>
</div>
<div class="draft">SAMPLE DATA · NOT FOR CONSTRUCTION</div>
<script type="application/json" id="ccw-spec">%s</script>
<script>
%s
</script>
<script>
CCWindKit.mount(JSON.parse(document.getElementById('ccw-spec').textContent),
  { parameters: document.getElementById('ccw-parameters'), zones: document.getElementById('ccw-zones'), pressures: document.getElementById('ccw-pressures') });
</script>
</body></html>
"""
out = HERE / "wind-sheet.html"
out.write_text(PAGE % (json.dumps(spec, indent=2), js), encoding="utf-8")
print("wrote", out)
