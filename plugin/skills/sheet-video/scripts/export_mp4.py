#!/usr/bin/env python3
# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
"""export_mp4.py - render the player frame by frame to a 1080p MP4 with the same audio.

    python export_mp4.py work/video.html work/video.mp4 [--audio work/mix.wav] [--fps 30] [--crf 18]

Every frame is the player seeked to an exact time, so the MP4 matches the HTML. About 80 ms a frame:
a two-minute video takes about five minutes. Writes to a temporary name and renames when done.
"""
import argparse, subprocess, time
from pathlib import Path
from _common import need, ffmpeg, launch


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("html"), ap.add_argument("out")
    ap.add_argument("--audio"), ap.add_argument("--fps", type=int, default=30), ap.add_argument("--crf", type=int, default=18)
    a = ap.parse_args()
    need("playwright"); ff = ffmpeg()
    from playwright.sync_api import sync_playwright
    out = Path(a.out); silent = out.with_name(out.stem + ".video.tmp.mp4")
    with sync_playwright() as pw:
        b = launch(pw)
        pg = b.new_page(viewport={"width": 1920, "height": 1136})
        pg.goto(Path(a.html).resolve().as_uri() + "?export=1&t=0"); pg.wait_for_timeout(1500)
        total = pg.evaluate("__player.total"); n = int(round(total * a.fps))
        enc = subprocess.Popen([ff, "-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", str(a.fps), "-c:v", "mjpeg", "-i", "-",
                                "-c:v", "libx264", "-preset", "veryfast", "-crf", str(a.crf), "-pix_fmt", "yuv420p", "-r", str(a.fps), str(silent)], stdin=subprocess.PIPE)
        t0 = time.time()
        for i in range(n):
            pg.evaluate("t => __player.seek(t)", i / a.fps)
            enc.stdin.write(pg.screenshot(type="jpeg", quality=92, clip={"x": 0, "y": 0, "width": 1920, "height": 1080}))
            if i % 300 == 0:
                print("frame %d / %d  (%.0f s)" % (i, n, time.time() - t0), flush=True)
        enc.stdin.close(); enc.wait(); b.close()
    if enc.returncode:
        raise SystemExit("ffmpeg failed")
    if a.audio:
        subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(silent), "-i", a.audio, "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)], check=True)
        silent.unlink()
    else:
        silent.replace(out)
    print("wrote %s  %.1f s  %.1f MB" % (out, total, out.stat().st_size / 1e6))


if __name__ == "__main__":
    main()
