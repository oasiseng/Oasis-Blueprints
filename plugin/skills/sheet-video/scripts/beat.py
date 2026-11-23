#!/usr/bin/env python3
# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
"""beat.py - render the music bed on its own (the 10-second "Tropical Tech Funk" sting, or any length).

    python beat.py beat.wav [--seconds 10]

Chime and pad, the bass enters, the groove with steelpan plucks, then a rising flourish and a clean
accent. The music is synthesized in assets/music/beat.js (Web Audio, no samples) and rendered offline.
"""
import argparse, subprocess
from pathlib import Path
from audio import render_music, SPB
from _common import ffmpeg


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("out"), ap.add_argument("--seconds", type=float, default=10.0)
    a = ap.parse_args()
    bar = 4 * SPB
    # The flourish takes six 16ths plus a short tail; for 10 s it starts on beat 4 of bar 4.
    flourish = max(bar, round((a.seconds - 1.67) / SPB) * SPB)
    tmp = Path(a.out).with_suffix(".raw.wav")
    render_music(tmp, a.seconds, flourish, [], mode="solo")
    subprocess.run([ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(tmp), "-af", "loudnorm=I=-16:TP=-1", "-ar", "44100", a.out], check=True)
    tmp.unlink()
    print("wrote", a.out)


if __name__ == "__main__":
    main()
