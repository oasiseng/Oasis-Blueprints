#!/usr/bin/env python3
# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
"""build.py - assemble the self-contained video player (one HTML file, everything embedded).

    python build.py scenes.js work/video.html --assets work/assets --timing work/timing.json
                    [--mix work/mix.mp3] [--brand brand.json] [--title "Project video"]

scenes.js is the job's scene file (see assets/player/scenes.example.js and references/player.md).
Images come from --assets (PNG/JPG + sizes.json from crop.py), each available to scenes as IMG[name]
with SIZE[name]. The brand file sets colours, fonts, logo, company, tagline, CTA and footer.
Without --mix the video is silent (captions still play).
"""
import argparse, base64, io, json
from pathlib import Path
from _common import ASSETS, load_brand, need

DEFAULT_COLORS = {"paper": "#f5f3ec", "ink": "#16233f", "ink2": "#4b5674", "ink3": "#7d859b", "line": "#d9d4c5",
                  "accent": "#2c5fd4", "accentSoft": "#dce6fa", "keep": "#23864f", "keepSoft": "#dcf0e3",
                  "alert": "#c42f28", "alt": "#f3e9d2", "altLine": "#b8975a"}
DEFAULT_FONTS = {"heading": '"Bahnschrift SemiCondensed","Bahnschrift","Roboto Condensed","Arial Narrow","Liberation Sans Narrow","DejaVu Sans Condensed",sans-serif',
                 "body": '"Segoe UI",system-ui,-apple-system,"Helvetica Neue",Roboto,Arial,sans-serif'}


def b64(path, mime):
    return "data:%s;base64,%s" % (mime, base64.b64encode(Path(path).read_bytes()).decode())


def logo_uri(brand):
    """The logo as a data URI. With "logoKnockout": true a white background becomes transparent."""
    p = brand.get("logo")
    if not p:
        return ""
    p = Path(p) if Path(p).is_absolute() else Path(brand["_dir"]) / p
    if not p.is_file():
        print("logo not found:", p); return ""
    if not brand.get("logoKnockout"):
        return b64(p, "image/svg+xml" if p.suffix.lower() == ".svg" else "image/png")
    need("PIL", "pillow"); np = need("numpy")
    from PIL import Image
    im = np.asarray(Image.open(p).convert("RGBA")).astype(float)
    rgb, al = im[..., :3], im[..., 3:] / 255
    rgb = rgb * al + 255 * (1 - al)                       # flatten onto white
    a = np.clip((255 - rgb.min(axis=2, keepdims=True)) / 255 * 1.15, 0, 1)
    col = np.where(a > 0.01, (rgb - 255 * (1 - a)) / np.maximum(a, 0.01), 0)
    out = np.concatenate([np.clip(col, 0, 255), a * 255], axis=2).astype("uint8")
    img = Image.fromarray(out, "RGBA"); bb = img.getbbox(); img = img.crop(bb) if bb else img
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


FONTS = [("Barlow Condensed", 600, "barlow-condensed-latin-600-normal"), ("Barlow Condensed", 700, "barlow-condensed-latin-700-normal"),
         ("Barlow", 400, "barlow-latin-400-normal"), ("Barlow", 600, "barlow-latin-600-normal")]


def font_faces():
    """Barlow (SIL OFL, assets/fonts) embedded, so the video looks the same on every machine and matches the sheets."""
    return "".join('@font-face{font-family:"%s";font-weight:%d;src:url(%s) format("woff2")}\n'
                   % (fam, w, b64(ASSETS / "fonts" / (f + ".woff2"), "font/woff2")) for fam, w, f in FONTS)


def brand_css(brand):
    c = {**DEFAULT_COLORS, **brand.get("colors", {})}; f = {**DEFAULT_FONTS, **brand.get("fonts", {})}
    if brand.get("fonts", {}).get("embed", True):
        f = {"heading": '"Barlow Condensed",' + f["heading"], "body": '"Barlow",' + f["body"]}
        return font_faces() + brand_css_vars(c, f)
    return brand_css_vars(c, f)


def brand_css_vars(c, f):
    return (":root{--paper:%(paper)s;--line:%(line)s;--ink:%(ink)s;--ink2:%(ink2)s;--ink3:%(ink3)s;"
            "--blue:%(accent)s;--blue-soft:%(accentSoft)s;--green:%(keep)s;--green-soft:%(keepSoft)s;--red:%(alert)s;"
            "--sand:%(alt)s;--sand-line:%(altLine)s;" % c) + "--cond:%s;--sans:%s;}\n" % (f["heading"], f["body"])


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("scenes"), ap.add_argument("out")
    ap.add_argument("--assets", required=True), ap.add_argument("--timing", required=True)
    ap.add_argument("--mix"), ap.add_argument("--brand"), ap.add_argument("--title", default="")
    a = ap.parse_args()
    brand = load_brand(a.brand)
    A = Path(a.assets)
    sizes = json.loads((A / "sizes.json").read_text()) if (A / "sizes.json").exists() else {}
    img = {}
    for f in sorted(A.iterdir()):
        if f.suffix.lower() in (".png", ".jpg", ".jpeg"):
            img[f.stem] = b64(f, "image/png" if f.suffix.lower() == ".png" else "image/jpeg")
    timing = json.loads(Path(a.timing).read_text(encoding="utf-8"))
    pub = {k: brand.get(k, "") for k in ("company", "tagline", "cta", "footer", "renderingNote")}
    data = ("const IMG=%s;\nconst SIZE=%s;\nconst LOGO=%s;\nconst BRAND=%s;\nconst TIMING=%s;\nconst MIX=%s;\n"
            % (json.dumps(img), json.dumps(sizes), json.dumps(logo_uri(brand)), json.dumps(pub), json.dumps(timing),
               json.dumps(b64(a.mix, "audio/mpeg") if a.mix else "")))
    P = ASSETS / "player"
    head = P.joinpath("head.html").read_text(encoding="utf-8")
    head = head.replace("/*__BRAND_CSS__*/", brand_css(brand)).replace("{{TITLE}}", a.title or brand.get("company", "Video"))
    html = (head.replace("/*__DATA__*/", data) + P.joinpath("lib.js").read_text(encoding="utf-8") + "\n"
            + Path(a.scenes).read_text(encoding="utf-8") + "\n" + P.joinpath("engine.js").read_text(encoding="utf-8")
            + "</script>\n</body>\n</html>\n")
    out = Path(a.out); out.parent.mkdir(parents=True, exist_ok=True); out.write_text(html, encoding="utf-8")
    print("wrote %s  %.1f MB  %d images  %.1f s  %s" % (out, out.stat().st_size / 1e6, len(img), timing["total"], "with sound" if a.mix else "silent"))


if __name__ == "__main__":
    main()
