# Style and sound

## The look

- **Paper** `#f5f3ec` with a faint 40 px grid, **navy ink** `#16233f`, a 2 px navy rule inset 20 px around
  the stage like a sheet border. Viewers are white boxes with a 2 px navy border and a flat offset shadow,
  labelled top-left with a dark chip: `C001 · Site plan` (sheet numbers on screen, never spoken).
- **One accent** (brand `accent`, default `#2c5fd4`) for new work, drainage, highlights and data values.
  **Green** (`keep`) for protected trees and what stays. **Red** (`alert`) only for open items and no-work
  zones; when an open item is answered, turn its red to the accent.
- **Type**: Barlow Condensed 600/700 for headings, kickers and tags; Barlow 400/600 for body text
  (embedded, the same family as Oasis-Blueprints sheets). Kickers: condensed caps, letter-spacing .14em.
- **On-screen text** is short and separate from the captions: one line per fact, values that may change
  as boxed data chips (`D("3'-0\"")`). Captions carry the narration, about 88 characters per chunk.

## Motion

- Highlight, don't redraw: tints (fill 26 %), rings, draw-on lines, flow chevrons, ripples, veils.
- The camera goes to what the voice names, on the word, over 1.5–2.5 s, and backs out before the next thing.
- One idea per scene; hold about 1 s at the end so a reviewer can pause on the sheet.
- Fades 0.4 s in and 0.35 s out between scenes. `prefers-reduced-motion`: no pans, zooms, typing, fades
  or pulses; each item simply appears at its cue.

## Voice (Kokoro, local)

- Voice `af_heart` (warm, conversational), speed 1.0 (1.05 when timing is tight). Others: `af_bella`,
  `am_michael`, `bf_emma`, `bm_george`; set `"voice"` in script.json.
- Generated sentence by sentence, silence trimmed, joined with 0.24 s gaps (0.38 s for short title beats
  given as a list), so every sentence start is known and visuals and captions follow the voice.
- Write for the ear: short sentences, contractions, "It didn't guess. It asked." Spell numbers, acronyms
  and URLs the way they should sound; map them back in `"captions"`.

## Music bed ("Tropical Tech Funk", `assets/music/beat.js`)

Original, synthesized with Web Audio (no samples), rendered offline in Chromium.
- 108 BPM, A minor: Am9 · Fmaj9 · Cmaj9 · G6/9, one bar each.
- Analog-style bass (saw + sine, resonant low-pass sweep) in a syncopated pattern; kick, clap, 16th hats,
  shaker, son clave, soft congas; steelpan-like plucks (sine partials 1, 2, 3, 4.18) with a ping-pong delay;
  airy detuned pads; a synthetic 2.6 s reverb.
- Arrangement: chime and pad, bass enters, groove; melody every third phrase, a sparse figure otherwise;
  a rising flourish and a clean accent at the end, placed just after the last spoken line.
- Ducked under speech (to 45 % of its level, 0.35 s ramps). `beat.py` renders a 10 s sting on its own.

## Mix

| | Value |
|---|---|
| Music under the voice | `--under 0.3` ≈ 16 dB below (review/QR video), `0.39` ≈ 14 dB (explainer) |
| Master | -16 LUFS integrated, limiter at about -1 dBFS |
| HTML | MP3 128 kbps, played from the first click; the picture follows the audio clock |
| MP4 | AAC 192 kbps, H.264 CRF 18, 30 fps, faststart |
