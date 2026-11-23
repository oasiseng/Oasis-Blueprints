#!/usr/bin/env python3
# Oasis-Blueprints · https://github.com/oasiseng/Oasis-Blueprints · MIT License, Copyright (c) 2026 Oasis Engineering, LLC
"""audio.py - scene timing, captions, the music bed and the final mix.

    python audio.py script.json work [--tts work/tts] [--music on|off] [--under 0.3] [--no-voice]

Reads script.json and the narration (work/tts/narr.json from tts.py). Writes:
  work/timing.json  scene starts and lengths, sentence cues and caption chunks (the player reads this)
  work/mix.wav      voice + music at -16 LUFS, peaks about -1 dBFS (for the MP4)
  work/mix.mp3      the same at 128 kbps (embedded in the HTML)
--no-voice estimates speech from word counts (2.6 words/s) to preview the layout before recording.
--under is the music gain under the voice: 0.39 sits about 14 dB below speech (explainer), 0.3 about
16 dB (review or QR video). Scene lengths = lead + speech + hold; the last scene is stretched so the
music's closing flourish lands after the last line.
"""
import argparse, base64, json, math, re, subprocess, wave
from pathlib import Path
from _common import need, ffmpeg, launch, ASSETS

SPB = 60 / 108; S16 = SPB / 4; BAR = 4 * SPB


def chunks(s, mx=88):
    if len(s) <= mx:
        return [s]
    best = None
    for m in re.finditer(r"[,:;](?=\s)", s):
        sc = abs(m.end() - len(s) / 2)
        if best is None or sc < best[0]:
            best = (sc, m.end())
    cut = best[1] if best else s.rfind(" ", 0, len(s) // 2 + 10)
    return chunks(s[:cut].strip(), mx) + chunks(s[cut:].strip(), mx)


def estimate(sc):
    out = []
    for s in sc["scenes"]:
        say = s.get("say", "")
        sents = say if isinstance(say, list) else [x for x in re.split(r"(?<=[.?!])\s+(?=[A-Z\"'])", say.strip()) if x]
        cues, sdur, pos = [], [], 0.0
        for j, t in enumerate(sents):
            if j: pos += 0.24
            d = max(0.6, len(t.split()) / 2.6); cues.append(round(pos, 3)); sdur.append(round(d, 3)); pos += d
        out.append({"id": s.get("id", ""), "dur": round(pos, 3), "cues": cues, "sdur": sdur, "sents": sents})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("script"), ap.add_argument("work")
    ap.add_argument("--tts"), ap.add_argument("--music", default="on", choices=["on", "off"])
    ap.add_argument("--under", type=float, default=0.3), ap.add_argument("--no-voice", action="store_true")
    a = ap.parse_args()
    sc = json.loads(Path(a.script).read_text(encoding="utf-8"))
    W = Path(a.work); W.mkdir(parents=True, exist_ok=True)
    tts = Path(a.tts or W / "tts")
    narr = estimate(sc) if a.no_voice else json.loads((tts / "narr.json").read_text(encoding="utf-8"))
    lead, hold = sc.get("lead", 0.5), sc.get("hold", 1.1)
    caps_map = sc.get("captions", [])
    scenes, t = [], 0.0
    for i, n in enumerate(narr):
        spec = sc["scenes"][i]
        caps = []
        for k, s in enumerate(n["sents"]):
            for x, y in caps_map:
                s = s.replace(x, y)
            cs = chunks(s); tot = sum(len(c) for c in cs) or 1; pos = 0
            for c in cs:
                caps.append([round(lead + n["cues"][k] + n["sdur"][k] * pos / tot, 3), c]); pos += len(c)
        sents = [s for s in n["sents"]]
        dur = max(spec.get("min", 0), math.ceil((lead + n["dur"] + hold) * 10) / 10)
        scenes.append({"id": n["id"], "start": round(t, 3), "dur": dur, "lead": lead, "n": n["dur"], "cues": n["cues"],
                       "sdur": n["sdur"], "sents": sents, "caps": caps})
        t += dur
    last = scenes[-1]; narr_end = last["start"] + lead + last["n"]
    if a.music == "on":
        F = math.ceil((narr_end + 0.4) / (BAR / 2)) * (BAR / 2); T = round(F + 6 * S16 + 1.6, 3)
    else:
        F = None; T = round(narr_end + hold + 0.8, 3)
    last["dur"] = max(last["dur"], round(T - last["start"], 3)); T = round(last["start"] + last["dur"], 3)
    (W / "timing.json").write_text(json.dumps({"scenes": scenes, "total": T, "flourish": F}, indent=1), encoding="utf-8")
    print("scenes", [s["dur"] for s in scenes], "total %.1f s" % T)
    windows = [(s["start"] + lead, s["n"]) for s in scenes]

    if a.no_voice and a.music == "off":
        print("silent draft: no audio (build without --mix)"); return
    ff = ffmpeg(); parts = []
    if not a.no_voice:
        inp, flt = [], []
        for i, (st, n) in enumerate(windows):
            inp += ["-i", str(tts / ("n%02d.wav" % (i + 1)))]; ms = int(round(st * 1000))
            flt.append("[%d:a]aresample=44100,pan=stereo|c0=c0|c1=c0,adelay=%d|%d[v%d]" % (i, ms, ms, i))
        flt.append("".join("[v%d]" % i for i in range(len(windows))) + "amix=inputs=%d:normalize=0,apad=whole_dur=%s[out]" % (len(windows), T))
        subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", *inp, "-filter_complex", ";".join(flt), "-map", "[out]", "-t", str(T), str(W / "voice.wav")], check=True)
        parts.append((W / "voice.wav", 1.0))
    if a.music == "on":
        render_music(W / "music.wav", T, F, [[st, st + n] for st, n in windows] if not a.no_voice else [])
        parts.append((W / "music.wav", a.under if not a.no_voice else 0.6))
    inp = sum([["-i", str(p)] for p, _ in parts], [])
    flt = ";".join("[%d:a]volume=%s[a%d]" % (i, g, i) for i, (_, g) in enumerate(parts)) + ";" + "".join("[a%d]" % i for i in range(len(parts))) + "amix=inputs=%d:normalize=0[out]" % len(parts)
    subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", *inp, "-filter_complex", flt, "-map", "[out]", str(W / "premix.wav")], check=True)
    r = subprocess.run([ff, "-hide_banner", "-i", str(W / "premix.wav"), "-af", "ebur128", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = float(re.findall(r"I:[ \t]+(-?[\d.]+) LUFS", r)[-1])
    subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(W / "premix.wav"), "-af", "volume=%.2fdB,alimiter=limit=0.89:level=false" % (-16 - I), str(W / "mix.wav")], check=True)
    subprocess.run([ff, "-hide_banner", "-loglevel", "error", "-y", "-i", str(W / "mix.wav"), "-c:a", "libmp3lame", "-b:a", "128k", str(W / "mix.mp3")], check=True)
    print("mix: -16 LUFS ->", W / "mix.mp3")


JS = r"""async (a) => { const SR = 44100, ctx = new OfflineAudioContext(2, Math.ceil(a.len * SR), SR);
  makeMusic(ctx, ctx.destination, {len: a.len, flourishAt: a.F, mode: a.mode, duck: a.duck, level: 1.0, duckLevel: 0.45});
  const b = await ctx.startRendering(), L = b.getChannelData(0), R = b.getChannelData(1), o = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { o[2*i] = Math.max(-32767, Math.min(32767, Math.round(L[i] * .5 * 32767))); o[2*i+1] = Math.max(-32767, Math.min(32767, Math.round(R[i] * .5 * 32767))); }
  let s = ''; const u = new Uint8Array(o.buffer); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
  return btoa(s); }"""


def render_music(path, length, flourish, duck, mode="video"):
    """Render assets/music/beat.js offline in Chromium and write a 44.1 kHz stereo WAV."""
    need("playwright")
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = launch(pw); pg = b.new_page()
        pg.set_content("<script>" + (ASSETS / "music" / "beat.js").read_text(encoding="utf-8") + "</script>")
        data = pg.evaluate(JS, {"len": length, "F": flourish, "duck": duck, "mode": mode})
        b.close()
    w = wave.open(str(path), "wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(44100)
    w.writeframes(base64.b64decode(data)); w.close()


if __name__ == "__main__":
    main()
