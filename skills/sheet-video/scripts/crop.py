#!/usr/bin/env python3
# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
"""crop.py - cut the views a video needs out of the captured sheets, small enough to embed.

    python crop.py work/sheets work/assets site    --page 2 --box 120 80 2900 2400
    python crop.py work/sheets work/assets secA    --page 2 --panel "SECTION A"     # HTML sets: crop a panel
    python crop.py work/sheets work/assets render  --image photo.jpg --jpeg          # any picture
    python crop.py work/sheets work/assets --thumbs [--thumb-box 0.012 0.036 0.902 0.985]

Crops are palette-quantized PNGs (line drawings stay crisp at a tenth of the size) or JPEG for photos.
--thumbs writes thumbNN.jpg for every page, cut to the drawing area (default drops a top banner and a
right-hand title block; adjust --thumb-box as fractions x0 y0 x1 y1). Records sizes in assets/sizes.json.
"""
import argparse, json
from pathlib import Path
from _common import need


def save(im, path, jpeg, colors):
    if jpeg:
        im.convert("RGB").save(path.with_suffix(".jpg"), quality=88); return path.with_suffix(".jpg")
    from PIL import Image
    im.convert("RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(path.with_suffix(".png"), optimize=True)
    return path.with_suffix(".png")


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("sheets"), ap.add_argument("assets"), ap.add_argument("name", nargs="?")
    ap.add_argument("--page", type=int), ap.add_argument("--box", type=int, nargs=4, metavar=("X0", "Y0", "X1", "Y1"))
    ap.add_argument("--panel", help="part of a panel heading (HTML captures)")
    ap.add_argument("--image", help="crop or copy any picture instead of a page")
    ap.add_argument("--jpeg", action="store_true"), ap.add_argument("--colors", type=int, default=96)
    ap.add_argument("--max", type=int, default=4200, help="longest side after cropping")
    ap.add_argument("--thumbs", action="store_true")
    ap.add_argument("--thumb-box", type=float, nargs=4, default=[0.012, 0.036, 0.902, 0.985])
    a = ap.parse_args()
    need("PIL", "pillow")
    from PIL import Image
    S, A = Path(a.sheets), Path(a.assets); A.mkdir(parents=True, exist_ok=True)
    meta = json.loads((S / "sheets.json").read_text(encoding="utf-8"))
    sizes_p = A / "sizes.json"
    sizes = json.loads(sizes_p.read_text()) if sizes_p.exists() else {}
    if a.thumbs:
        for p in meta["pages"]:
            im = Image.open(S / p["image"]).convert("RGB"); W, H = im.size; x0, y0, x1, y1 = a.thumb_box
            t = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
            t = t.resize((360, round(360 * t.height / t.width)), Image.LANCZOS)
            t.save(A / ("thumb%02d.jpg" % p["page"]), quality=80)
            sizes["thumb%02d" % p["page"]] = [t.width, t.height]
        sizes["_sheets"] = [p.get("sheet", "") for p in meta["pages"]]
        print("thumbnails:", len(meta["pages"]))
    elif a.name:
        if a.image:
            im = Image.open(a.image)
            if a.box: im = im.crop(tuple(a.box))
        else:
            page = next(p for p in meta["pages"] if p["page"] == a.page)
            im = Image.open(S / page["image"])
            box = a.box
            if a.panel:
                panel = next(x for x in page.get("panels", []) if a.panel.lower() in x["heading"].lower())
                box = panel["box"]
            if box: im = im.crop(tuple(box))
        if max(im.size) > a.max:
            f = a.max / max(im.size); im = im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS)
        out = save(im, A / a.name, a.jpeg, a.colors)
        sizes[a.name] = list(im.size)
        print("%s  %dx%d  %d KB" % (out.name, im.width, im.height, out.stat().st_size // 1000))
    sizes_p.write_text(json.dumps(sizes, indent=0))


if __name__ == "__main__":
    main()
