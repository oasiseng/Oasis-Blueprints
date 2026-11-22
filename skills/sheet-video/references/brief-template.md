# Video brief

Fill this in (or have Claude fill it in with you) before building. One brief, one video.

```
VIDEO BRIEF
Purpose and audience:   (e.g. City reviewers, owner, contractors, neighbours · or engineers new to the product)
Where it plays:         (QR code on the plans / YouTube / website / a meeting)
Target length:          (e.g. 1:30-2:20; the narration decides the final length)
Sources:                script or story notes · drawing set (PDF, or a predrawn HTML export) · rendering (optional)
Branding:               brand.json (saved once); anything different for this video
Tone:                   human, conversational, one idea per scene

SCENES (repeat for each)
  N. Title (target seconds)
     Visual:     sheet and view; what to zoom to; what to highlight (tint / ring / path / arrows / reveal)
     On screen:  short text; mark values that may change as [data: 3'-0"]
     Narration:  the spoken line (no sheet numbers; numbers only if they are meant to be spoken)

CLOSE
  Logo, tagline, call to action, footer line

RULES
  Facts only from the sources; every claim checked against the sheets before building
  Colours as on the set: accent = new work and drainage, green = protected/kept, red = only no-work or open items
  Crop out draft banners and TO CONFIRM boxes; renderings marked "for reference only, the drawings govern"
  Captions on by default; music quiet under the voice (or none)

DELIVERABLES
  video.html (self-contained player) + video.mp4 (1080p) (+ a title, description and chapters for YouTube)
```

## Writing the narration

- About 150 words a minute. A 2:20 video is about 350 words across 10-12 scenes.
- Update-proof option: keep quantities out of the narration and put them in `[data]` fields on screen,
  so a plan change means editing text, not re-recording (re-recording with Kokoro is quick anyway).
- Say what the viewer sees, in the order they see it; the visuals are cued to the words.
- For a QR or review video, open with what and where, and make the on-screen text of the first few
  scenes carry the whole story for someone who stops early.
