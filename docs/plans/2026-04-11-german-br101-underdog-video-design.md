# German BR 101 "End of an Era" Video — Design

**Date:** 2026-04-11
**Status:** Design approved, ready for build
**Output:** 10-second vertical video for TikTok and Instagram Reels, German language
**Target market:** Germany (primary), German-speaking Austria and Switzerland (secondary)

---

## Strategic context

### Problem

Account-wide TikTok geography is 72.4% Poland (up from 69.9% a week ago). UK (2.2%) and Germany (7.0%) are the actual target markets where app downloads come from. The algorithm is doubling down on Poland because earlier Polish content signalled the creator's audience there.

Individual German-targeted videos do reach German viewers — the Frankfurt S-Bahn video pulled 35.7% Germany vs 31.6% Poland. The problem is the universal 0:02 drop-off: viewers leave before the algorithm has enough completion data to push the video further into German For You feeds.

### The 0:02 drop-off fix

Previous German videos used a "what is this?" quiz hook with train footage plus text overlay. The text question was about the train, not about the viewer. Viewers scroll away because the question doesn't implicate them personally.

This video uses a scarcity and end-of-era hook that creates an immediate emotional stake. "2026 ist Schluss." (2026 is the end.) is a three-word pattern interrupt that forces the viewer to ask "the end of what?" — which they can only answer by watching.

### Why the BR 101 works

The DB Class 101 is actively being retired during 2024–2026. German trainspotters are using "BR 101 retten" (save the BR 101) as a rallying cry on social media. One of the source clips in `~/Desktop/BR101/` is labelled "vermutlich einer der letzten bR 101 in Köln" by the original uploader. This is the German equivalent of the UK HST retirement — an emotional, real, happening-right-now story.

Verified facts (Wikipedia and Deutsche Bahn sources):

- DB began scrapping BR 101 units in 2021, accelerated from 2022
- DB Fernverkehr planned to phase out locomotive-hauled IC1 services by end of 2025
- By 2026 both the IC1 coaches and BR 101 are being withdrawn from DB Fernverkehr
- In early 2024 alone, 11 locomotives were scrapped in the first 1.5 months
- Reason: economic end-of-life plus oversupply from new ICE fleets
- Being replaced by IC 2 (Twindexx) and ICE units

The claim "2026 ist Schluss" is defensible against enthusiast fact-checking.

---

## Video structure (10 seconds)

| Timecode | Clip source | Visual | Text overlay | Font size |
|---|---|---|---|---|
| 0:00–0:02 | Köln Hbf clip, approx 0:03–0:05 | Red BR 101 arriving, arched Köln Hbf roof overhead, "101 033-7" becoming readable | **"2026 ist Schluss."** | 110px Impact |
| 0:02–0:04 | Köln Hbf clip, approx 0:05–0:07 | Same loco continuing past camera, DB logo dead centre, fleet number fully readable | **"Nur noch wenige übrig."** | 90px Impact |
| 0:04–0:06 | Screen recording of LocoSnap app | Card-only reveal of BR 101 identification (no scan animation) | (card visible, no overlay) | n/a |
| 0:06–0:08 | Lichtgruß clip, approx 0:04–0:06 | Red BR 101 at line speed, three-quarter angle, IC1 coaches trailing behind, open sky | **"Seit 1996. Bald Geschichte."** | 90px Impact |
| 0:08–0:10 | `docs/assets/locosnap_end_screen.mp4` | Standard LocoSnap end screen (2s) | Logo + "Free on App Store" + "Coming soon to Android" | (baked in) |

### Emotional arc

Static arrival (calm, familiar) → LocoSnap reveal (information, product moment) → dynamic passing shot (motion, "still running for now") → end screen (call to action).

The red DB livery is used throughout — no livery changes between clips. Viewer never has to re-parse a different train.

---

## Footage assets

Located in `~/Desktop/BR101/`:

### Selected clips

| File | Duration | Res | Role |
|---|---|---|---|
| `vermutlich einer der letzten bR 101 in Köln 😥😥💔❤️ bR 101 retten.mp4` | 7.78s | 720×1280, 30fps | **Opening hook + second beat (0:00–0:04)** — Köln Hbf iconic arched roof, red 101 033-7, classic DB livery |
| `Br 101 Lichtgruß 🤤 \| Linie 77 😍       Mit dabei_ @Trainspotter_nds_  #br101 #lichtgruß.mp4` | 12.10s | 720×1280, 30fps | **Closing beat (0:06–0:08)** — Red BR 101 at line speed, fleet number "101 021" visible, IC1 coaches trailing |

Both clips are already at target resolution (720×1280, 30fps). No downscaling required.

### Rejected clips

| File | Reason |
|---|---|
| `Die Werbe Märklin BR 101 127-9 Kuppelt den Letzten IC 2012...` | Dark Märklin advertising livery is not the iconic red BR 101. Narratively powerful (actual last run footage) but visually breaks the coherence of Option X (red only). Reserved for a follow-up video. |
| `Koblenz Hbf  \| IC 2012 \| Märklin 101...` | Burned-in "IC 2012" text overlay and "Der Denni Spielt das" watermark from original creator. Unusable without destructive crop. |

---

## Text copy

All German text verified with umlaut integrity.

| Line | Characters | Notes |
|---|---|---|
| **"2026 ist Schluss."** | 17 | Three words, maximum pattern interrupt, grounds the claim in the current year |
| **"Nur noch wenige übrig."** | 22 | Scarcity reinforcement, "übrig" is emotional (only a few left) |
| **"Seit 1996. Bald Geschichte."** | 27 | Historical anchor (1996 first presentation) + end-of-era close. "Geschichte" = history |

All three fit at 90px Impact on 720px width. The opening line uses 110px Impact for extra pattern-interrupt weight — there is comfortable room because it is only 17 characters.

### Umlaut and sharp-s verification

- "Schluss" uses "ss" (not "ß") — correct in modern German orthography after 1996 reform because "u" in "Schluss" is short
- "übrig" — ü (U+00FC)
- No other special characters

---

## LocoSnap card reveal content

When identifying a BR 101 photo, the app should return (verify in production before screen recording):

| Field | Value |
|---|---|
| Class | BR 101 |
| Operator | DB Fernverkehr |
| Type | Electric locomotive |
| Designation | Bo-Bo |
| Year built | 1996 (first unit presented 1 July 1996) |
| Builder | Adtranz (Hennigsdorf + Wrocław assembly) |
| Max speed | 220 km/h |
| Power | 6,400 kW |
| Units built | 145 (1996–1999) |
| Rarity | Rare (diminishing fleet, actively being withdrawn) |

**Verification required before build:** scan a real BR 101 photo through the current production vision model. Confirm it returns "BR 101" correctly (the August 2025 update to the German regional EMU pre-flight check should not have affected this — BR 101 is not in the family tree — but verify). Confirm the rarity classification. Capture a clean card-only screen recording.

---

## Build approach (FFmpeg)

Based on the Frankfurt video workflow from 2026-04-10. Work in a temporary directory to avoid polluting source files.

### Step 1 — Extract and trim the three source segments

```bash
mkdir -p /tmp/br101_build

# Köln Hbf — 4 second opening (0:00-0:04 of output)
# Assume we want seconds 3-7 of the source
ffmpeg -y -ss 3 -t 4 -i "~/Desktop/BR101/vermutlich einer der letzten bR 101 in Köln 😥😥💔❤️ bR 101 retten.mp4" \
  -c:v libx264 -preset medium -crf 18 -r 30 -pix_fmt yuv420p \
  /tmp/br101_build/01_koln.mp4

# Screen recording of LocoSnap card reveal — 2 second segment (0:04-0:06 of output)
# User needs to produce this separately; placeholder assumes ~/Desktop/br101_card_reveal.mp4
ffmpeg -y -ss 0 -t 2 -i ~/Desktop/br101_card_reveal.mp4 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -preset medium -crf 18 -r 30 -pix_fmt yuv420p \
  /tmp/br101_build/02_card.mp4

# Lichtgruß — 2 second closing beat (0:06-0:08 of output)
# Use seconds 4-6 of source (line speed shot)
ffmpeg -y -ss 4 -t 2 -i "~/Desktop/BR101/Br 101 Lichtgruß 🤤 | Linie 77 😍       Mit dabei_ @Trainspotter_nds_  #br101 #lichtgruß.mp4" \
  -c:v libx264 -preset medium -crf 18 -r 30 -pix_fmt yuv420p \
  /tmp/br101_build/03_lichtgruss.mp4

# End screen — 2 second (0:08-0:10 of output)
ffmpeg -y -ss 0 -t 2 -i /Users/StephenLear/Projects/locosnap/docs/assets/locosnap_end_screen.mp4 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -preset medium -crf 18 -r 30 -pix_fmt yuv420p \
  /tmp/br101_build/04_endscreen.mp4
```

### Step 2 — Add text overlays to the two Köln segments

Drawtext approach (same as Frankfurt video). Split the 4-second Köln clip into two 2-second segments so each gets its own text:

```bash
# First 2 seconds — "2026 ist Schluss." at 110px
ffmpeg -y -i /tmp/br101_build/01_koln.mp4 -t 2 \
  -vf "drawtext=fontfile=/System/Library/Fonts/Supplemental/Impact.ttf:text='2026 ist Schluss.':fontcolor=white:fontsize=110:borderw=6:bordercolor=black:x=(w-text_w)/2:y=180" \
  -c:v libx264 -preset medium -crf 18 -c:a copy \
  /tmp/br101_build/01a_koln_hook.mp4

# Second 2 seconds — "Nur noch wenige übrig." at 90px
ffmpeg -y -ss 2 -i /tmp/br101_build/01_koln.mp4 -t 2 \
  -vf "drawtext=fontfile=/System/Library/Fonts/Supplemental/Impact.ttf:text='Nur noch wenige übrig.':fontcolor=white:fontsize=90:borderw=5:bordercolor=black:x=(w-text_w)/2:y=180" \
  -c:v libx264 -preset medium -crf 18 -c:a copy \
  /tmp/br101_build/01b_koln_scarcity.mp4
```

### Step 3 — Add text overlay to the Lichtgruß segment

```bash
ffmpeg -y -i /tmp/br101_build/03_lichtgruss.mp4 \
  -vf "drawtext=fontfile=/System/Library/Fonts/Supplemental/Impact.ttf:text='Seit 1996. Bald Geschichte.':fontcolor=white:fontsize=90:borderw=5:bordercolor=black:x=(w-text_w)/2:y=180" \
  -c:v libx264 -preset medium -crf 18 -c:a copy \
  /tmp/br101_build/03a_lichtgruss_text.mp4
```

### Step 4 — Concatenate

```bash
cat > /tmp/br101_build/concat.txt <<'EOF'
file '01a_koln_hook.mp4'
file '01b_koln_scarcity.mp4'
file '02_card.mp4'
file '03a_lichtgruss_text.mp4'
file '04_endscreen.mp4'
EOF

cd /tmp/br101_build
ffmpeg -y -f concat -safe 0 -i concat.txt -c copy ~/Desktop/locosnap_br101_de.mp4
```

### Step 5 — Verification frames

Before finalising, extract test frames at each text transition to verify character fit:

```bash
ffmpeg -y -ss 0.5 -i ~/Desktop/locosnap_br101_de.mp4 -frames:v 1 /tmp/br101_build/verify_00.jpg
ffmpeg -y -ss 2.5 -i ~/Desktop/locosnap_br101_de.mp4 -frames:v 1 /tmp/br101_build/verify_02.jpg
ffmpeg -y -ss 6.5 -i ~/Desktop/locosnap_br101_de.mp4 -frames:v 1 /tmp/br101_build/verify_06.jpg
```

Per the project video-editing skill rule: character count is 17, 22, 27 respectively — all stated before the test frames are rendered.

---

## Known risks and open items

1. **Card reveal screen recording does not yet exist.** The LocoSnap app must be scanned against a real BR 101 photo. Need to verify the card output, capture card-only screen recording, and crop appropriately. This is a blocker.

2. **Köln clip exact timing needs eyeballing.** I picked 0:03–0:07 based on keyframe samples but the actual train arrival timing needs to be watched in real time. The goal is to have the train fleet number readable by 0:02 of the output.

3. **Lichtgruß clip has audio (ambient station noise).** All source clips have audio. The video is supposed to be silent (music added at posting). Strip audio during concatenation or use `-an`.

4. **Font file path.** The command assumes macOS Impact at `/System/Library/Fonts/Supplemental/Impact.ttf`. Verify this path exists before the build (it did for the Frankfurt video).

5. **Creator attribution.** Both source clips came from trainspotters (`@Trainspotter_nds_` on the Lichtgruß clip, unknown on the Köln clip). For TikTok reposting, the ethical move is to credit the original creators in the caption. For commercial use this is a grey area — the clips were likely downloaded from TikTok itself. Worth discussing before publishing.

6. **Fact check the "2026 ist Schluss" claim once more.** Research confirmed the retirement but the exact phrasing ("2026 is the end") might be slightly ahead of reality if some BR 101s linger into 2027. Alternative wording options:
   - "Bald ist Schluss." (Soon it's the end.) — safer
   - "Das Ende naht." (The end is near.) — very dramatic
   - "Noch ein paar Monate." (Only a few more months.) — factual
   Current recommendation: keep "2026 ist Schluss." because the 2026 anchoring is what makes it urgent and specific. Accept minor risk of pedantic correction.

---

## Posting plan

- **Platforms:** TikTok (primary), Instagram Reels (secondary), YouTube Shorts (tertiary)
- **Caption (DE):** Draft for approval before posting
- **Hashtags:** #br101 #deutschebahn #intercity #ic #dbfernverkehr #trainspotter #schienenverkehr #eisenbahn #abschied #letztefahrt #locosnap
- **Music:** Add at posting time. Suggested direction: emotional instrumental (piano or strings) that builds into the reveal. Keep under the "Commercial Sounds" library on TikTok to avoid copyright issues.
- **Timing:** Post when German engagement is high (weekday evenings 18:00–21:00 CET)

---

## Success metrics (48–72 hours after posting)

- Video-level audience geography: Germany share should exceed Poland share (baseline from Frankfurt video: 35.7% vs 31.6%)
- Retention at 0:02: aim for 70%+ (Frankfurt video stopped most viewers at 0:02)
- Average watch time: aim for 5s+ on a 10s video (Frankfurt: 3.81s)
- Watched full video: aim for 15%+ (Frankfurt: 8.1%)
- Account-wide Poland percentage trend: should move down from 72.4% over the 48–72 hour window if this and the Frankfurt video reach their target audience

If Germany audience share is below 30% after 48 hours, the hook is not working and we revise before the next video.

---

## Files referenced

- Source clips: `~/Desktop/BR101/`
- End screen: `docs/assets/locosnap_end_screen.mp4`
- Font: `/System/Library/Fonts/Supplemental/Impact.ttf`
- Output: `~/Desktop/locosnap_br101_de.mp4`
- Previous video precedent: Frankfurt S-Bahn build (2026-04-10 changelog entry)
