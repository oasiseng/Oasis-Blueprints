---
name: sheet-video
description: Make a narrated, captioned explainer or project video from a drawing set (PDF or HTML) and a script, in the user's branding, as a self-contained HTML player and a 1080p MP4. Use for plan-set walkthroughs, QR-code project videos and product explainers; not for editing an existing video file.
---

# Sheet video

Turn a drawing set and a script into:
1. **`video.html`**: one self-contained player (1920 × 1080 stage that scales to the window, images, fonts
   and sound embedded, no network). Plays on its own with captions; sound after one click.
2. **`video.mp4`**: 1080p, 30 fps, frame-exact render of the same player with the same audio.

The look is a drawing office: off-white paper, navy ink, one accent colour for new work, highlights
drawn over crops of the real sheets (never redrawn). Narration is a local neural voice (Kokoro), the
music an original synth bed rendered offline, captions burned in.

`SKILL_DIR` below is this folder. Scripts are plain Python; each has `--help`.

## 0. First time on a machine

```
python SKILL_DIR/scripts/setup.py          # packages, Chromium, voice model (~340 MB) into ~/.sheet-video
```
ffmpeg is separate (`winget install ffmpeg` · `brew install ffmpeg` · `apt install ffmpeg`).
`python SKILL_DIR/scripts/setup.py --check` reports what is missing.

## 1. Branding (once per user, then reused)

Look for `brand.json` in the project folder, then `~/.sheet-video/brand.json`. If neither exists, ask
the user, in one AskUserQuestion round where possible, for: company name, logo file, tagline, call to
action (URL), footer line (optional), accent colour (default blue #2c5fd4), and whether to use the
default voice and the music bed. Copy `SKILL_DIR/assets/brand/brand.example.json` to
`~/.sheet-video/brand.json`, fill it in, copy the logo next to it, and set `"logoKnockout": true` for
a logo on a white background (white turns transparent). Show the user the saved file. Colour roles:
`accent` new work, drainage, highlights · `keep` protected or existing to keep (trees) · `alert` only
open items and no-work zones. Fonts: Barlow (embedded, matches Oasis-Blueprints sheets); set
`"fonts": {"embed": false, "heading": "...", "body": "..."}` to use the brand's own installed fonts.

## 2. Inputs, and checking them before building

- **Script**: scenes, each with what is on screen, the on-screen text and the narration. If the user has
  none, write one with them from `references/brief-template.md`. Keep each scene to one idea.
- **Drawing set**: a **PDF** (most common) or an HTML set. For an HTML set that draws itself in the
  browser, ask for a "predrawn" export.
- **Fact-check every claim of the script against the sheets before building.** Capture the set (step 3),
  grep the page text, and put every mismatch to the user in one AskUserQuestion, each with a recommended
  fix. Past catches: an element the set does not show yet (trench vs bubbler: ask for the newer set);
  loose wording (two "units" vs two heads and one outdoor unit; "west of the house" vs west of the new
  unit; "no work on that side" when a pipe crosses a tree zone); a claim with no source ("finishes match
  the house"); a calculation that passes only on an assumption marked "engineer to confirm"; a sheet
  index missing sheets. Also ask: crop around DRAFT banners and TO CONFIRM boxes? (default yes) ·
  music under the voice? (default yes, quiet).
- Videos shown to reviewers or the public: add no claim, number or testimonial that is not in the
  sources; never say software designed or engineered anything or replaces an engineer or a survey;
  mark renderings "for reference only, the drawings govern"; third-party product names in plain text only.

## 3. Capture the sheets and cut the crops

```
python SKILL_DIR/scripts/capture_pdf.py set.pdf work/sheets --dpi 200      # or capture_html.py set.html work/sheets
python SKILL_DIR/scripts/find_text.py work/sheets "BUBBLER"                 # where a callout is, in pixels
python SKILL_DIR/scripts/crop.py work/sheets work/assets site --page 2 --box X0 Y0 X1 Y1
python SKILL_DIR/scripts/crop.py work/sheets work/assets secA --page 2 --panel "SECTION A"   # HTML sets
python SKILL_DIR/scripts/crop.py work/sheets work/assets render --image rendering.jpg --jpeg
python SKILL_DIR/scripts/crop.py work/sheets work/assets --thumbs           # thumbNN.jpg per page, for an index scene
```
Crop each view the narration talks about (site plan, sections, floor plan, details), leaving out banners
and title blocks. Find feature positions with `find_text.py` (vector PDFs give exact boxes) and by
viewing the crop; overlay coordinates are pixels **in the crop** (page box minus the crop's corner).
Scanned PDFs have no text layer: locate features by eye.

## 4. Narration, timing, music, mix

Write `work/script.json` (format: `SKILL_DIR/assets/example/script.json`). Write numbers and acronyms as
spoken ("twelve-ten", "A D U", "oasis blueprints dot com") and map them back for captions in `"captions"`.
```
python SKILL_DIR/scripts/audio.py work/script.json work --no-voice --music off    # optional silent draft first
python SKILL_DIR/scripts/tts.py work/script.json work/tts
python SKILL_DIR/scripts/audio.py work/script.json work [--under 0.39] [--music off]
```
Scene length = lead 0.5 s + speech + hold 1.1 s; the last scene stretches so the music's closing
flourish lands after the last line. `--under`: 0.39 ≈ music 14 dB under the voice (explainer), 0.3 ≈ 16 dB
(review or QR video, the default). Output: `timing.json`, `mix.wav` (-16 LUFS), `mix.mp3`.
You cannot hear the audio: say so, and ask the user to listen once before publishing.

## 5. Scenes

Copy `SKILL_DIR/assets/example/scenes.js` to `work/scenes.js` and write one scene per script scene.
`references/player.md` has the API and the patterns (camera moves, rings, tints, draw-on paths, flow
chevrons, ripples, reveal veils, thumbnails fanning out of an index, typed prompts, count-ups, close card).
Cue every visual to the words: `T.w(k, 'phrase')` is when sentence k says the phrase.

## 6. Build, check, look

```
python SKILL_DIR/scripts/build.py work/scenes.js work/video.html --assets work/assets --timing work/timing.json --mix work/mix.mp3 [--brand brand.json] --title "..."
python SKILL_DIR/scripts/check.py work/video.html --shots 8,21,35 --reduced
```
`check.py` plays the whole timeline (every 0.25 s) and fails on text off the stage, tags clipped by
their viewer, overflowing text, images not loaded and console errors (including a cue phrase not found).
Then take frames at the busiest moment of every scene and **look at them**. Typical fixes: zoom too
tight or too wide, a tag over sheet text, a duplicate label, an overlay on the wrong feature, a viewer
showing through behind another. Repeat until clean.

## 7. MP4 and delivery

```
python SKILL_DIR/scripts/export_mp4.py work/video.html work/video.mp4 --audio work/mix.wav
```
About 80 ms per frame (a 2-minute video takes about 5 minutes). Deliver both files to the user's project
folder, plus the running time and a short list of flags: claims resting on "to confirm" items, wording
that differs from the set, draft marks visible inside crops, and that the audio was not listened to.
For publishing, offer a title and description with chapters (each chapter at least 10 s; merge short
scenes). `scripts/beat.py out.wav --seconds 10` renders the music sting on its own.

## References

- `references/player.md`: scene file API, layout grid, patterns with code.
- `references/style-and-sound.md`: the look, motion rules, voice settings, the music and the mix.
- `references/brief-template.md`: a brief to fill in before a video, and the rules that go with it.
