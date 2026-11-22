#!/usr/bin/env python3
# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
"""tts.py - speak the narration of script.json with Kokoro (local, free), one WAV per scene.

    python tts.py script.json work/tts [--voice af_heart] [--speed 1.0]

script.json "scenes": [{"id": "drainage", "say": "One or more sentences."}, ...]. "say" may also be a
list of short lines; those are spoken one by one with a longer pause (good for title beats).
Writes nNN.wav per scene and narr.json with each scene's length and sentence start times, which
audio.py turns into scene timing and captions. Write numbers and acronyms the way they should sound:
"twelve-ten", "A D U", "oasis blueprints dot com"; script.json "captions" maps them back for the screen.
"""
import argparse, json, re
from pathlib import Path
from _common import need, MODELS

SR = 24000


def sentences(say):
    if isinstance(say, list):
        return say, 0.38
    return [s for s in re.split(r"(?<=[.?!])\s+(?=[A-Z\"'])", say.strip()) if s], 0.24


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("script"), ap.add_argument("out")
    ap.add_argument("--voice"), ap.add_argument("--speed", type=float)
    a = ap.parse_args()
    np = need("numpy"); sf = need("soundfile")
    need("kokoro_onnx", "kokoro-onnx")
    from kokoro_onnx import Kokoro
    if not (MODELS / "kokoro-v1.0.onnx").is_file():
        raise SystemExit("Voice model not found in %s. Run: python setup.py" % MODELS)
    sc = json.loads(Path(a.script).read_text(encoding="utf-8"))
    voice = a.voice or sc.get("voice", "af_heart"); speed = a.speed or sc.get("speed", 1.0)
    k = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)

    def say(t):
        x, sr = k.create(t, voice=voice, speed=speed, lang=sc.get("lang", "en-us"))
        nz = np.where(np.abs(x) > 0.008)[0]
        return x[max(0, nz[0] - int(.02 * sr)): nz[-1] + int(.10 * sr)].astype(np.float32)

    narr = []
    for i, s in enumerate(sc["scenes"]):
        sents, gap = sentences(s.get("say", ""))
        parts, cues, sdur, pos = [], [], [], 0.0
        for j, t in enumerate(sents):
            x = say(t)
            if j:
                parts.append(np.zeros(int(gap * SR), dtype=np.float32)); pos += gap
            cues.append(round(pos, 3)); sdur.append(round(len(x) / SR, 3)); parts.append(x); pos += len(x) / SR
        x = np.concatenate(parts) if parts else np.zeros(1, dtype=np.float32)
        sf.write(out / ("n%02d.wav" % (i + 1)), x, SR)
        narr.append({"id": s.get("id", str(i + 1)), "dur": round(len(x) / SR, 3), "cues": cues, "sdur": sdur, "sents": sents})
        print("%2d %-20s %5.1f s" % (i + 1, narr[-1]["id"], narr[-1]["dur"]))
    (out / "narr.json").write_text(json.dumps(narr, indent=1), encoding="utf-8")
    print("speech total %.1f s -> %s" % (sum(n["dur"] for n in narr), out / "narr.json"))


if __name__ == "__main__":
    main()
