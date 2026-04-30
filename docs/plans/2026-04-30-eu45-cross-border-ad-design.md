# EU45 / BR 185 Cross-Border Ad — Design (2026-04-30)

## Context

- **Goal:** lift Instagram retention while staying loyal to the DE conversion engine and capitalising on the fresh Polish surge.
- **Stats inputs:** EN57 PL ad pulled 65.7% PL viewer share (vs 10.1% on BR 412 = 6.5× lift). Day 2 Android: 20 installs (4 PL, 12 DE). First DE Android Pro Annual landed 29 Apr ($39.92). EN57 retention died at 0:02 — first 2 seconds matter. IG cross-post pulled 55 views vs 388 on TikTok, 58.7% IG skip rate.
- **Strategy:** cross-border class as protagonist. Reveal narrative (DE viewer thinks ad is about BR 185 → reveal it's also EU45 in Poland). Honours both audiences without splitting attention.

## Class

**EU45 / BR 185** — Bombardier (now Alstom) TRAXX F140 AC2 multi-system electric locomotive. Same physical machine, two operator liveries:
- DB Cargo / Captrain / RTB / DB Schenker (Germany)
- PKP Cargo / Lotos Kolej (Poland)

EU45-846 specifically (the Polish unit in the source footage) is part of the small PKP Cargo TRAXX fleet.

## Source footage

`~/Desktop/BR185/` — 7 clips total:

**German (5 clips, 1080×1920):**
1. `CAPTRAIN BR 185 🚂💨.mp4` — 6.15s, 60fps. **Used in Beat 1.**
2. `Br 185 + Güterzug, Bruchsal.mp4` — 7.57s, 30fps. **Used in Beat 2.**
3. `Br 185 (DB Cargo).mp4` — 6.65s, 60fps. B-roll.
4. `Br 185, DB Cargo.mp4` — 12.20s, 60fps. B-roll.
5. `Br 185 549 von Captrain.mp4` — 20.35s, 60fps. B-roll.

**Polish (2 clips, 608×1080):**
6. `EU45-846.mp4` — 13.43s, 30fps. **Used in Beat 3.**
7. `Lokomotywa elektryczna | EU45-846 PKP Cargo.mp4` — 8.00s, 30fps. **Used in Beat 4.**

## Beat structure (10.0s + endcard inclusive)

| Beat | Time | Clip | On-screen text | Purpose |
|------|------|------|----------------|---------|
| 1 | 0:00–0:02 | Captrain 60fps | "Diese Lok / kennt jeder." (95px) | Hook + setup |
| 2 | 0:02–0:04 | Bruchsal Güterzug | "BR 185" (110px) | DE establishing — set the trap |
| 3 | 0:04–0:06 | EU45-846 v1 | "In Polen: / EU45" (110px) | REVEAL — punchline |
| 4 | 0:06–0:08 | EU45-846 v2 | "Eine Lok. / Zwei Namen." (110px) | Pay-off |
| 5 | 0:08–0:10 | Endcard | LocoSnap + "Foto → Klasse → Sekunden." + "iOS + Android · kostenlos." | CTA |

## Visual standards (per ARCHITECTURE.md §19)

- **Output:** 720×1280, 30fps, h264, no audio (music added in CapCut at post time)
- **Subtitles:** Arial Black, yellow #FFFF00, 6px black outline, ASS format
- **Font sizes:** 110px standard; 95px for the longer Beat 1 line
- **Endcard background:** #0d0d0d
- **Polish characters:** none used in on-screen text. ASS file written via Write tool regardless.

## Source-clip normalisation

- 1080×1920 sources → scale to 720×1280 (66.7% downscale)
- 608×1080 sources → scale to 720×1280 (~118% upscale; aspect 0.563 ≈ output 0.5625, no pad/crop needed)
- Mixed 30/60fps → resample to 30fps output

## Caption (DE-primary, posted tomorrow AM)

```
Diese Lok kennt in Deutschland jeder: BR 185 von Bombardier (jetzt Alstom).
In Polen heißt sie EU45 — gleiche TRAXX, anderes Schild.
Foto einer Lok. Klasse, Hersteller, Jahr, Daten, Seltenheit — in Sekunden.
Kostenlos auf iPhone und Android. Link in Bio.

#br185 #eu45 #traxx #dbcargo #pkpcargo #captrain #güterzug #freighttrain
#bombardier #alstom #lokomotive #zugspotter #trainspotting
#bahn #kolej #foryoupage❤️❤️ #fyp #locosnap
```

## Instagram-specific re-cut

To address the 58.7% IG skip rate from the EN57 cross-post:

- **Add a 0.5s pre-roll text card** at the very start: black background + yellow "BR 185 vs EU45" text
- Total IG runtime: 10.5s
- Same audio + structure for the remaining 10s
- IG audience needs the topic stated up-front; TikTok trusts curiosity
- IG caption: 30% shorter, drop `#fyp` / `#foryoupage`, keep core hashtag identity

## Music direction

Mid-tempo industrial-cinematic instrumental, ~100-110 BPM. "DB Cargo corporate-doc" energy — confident, mechanical, undertone of pride. No vocals (DE/PL ambiguity). Slower than BR 412, less somber than EN57.

## Output files

- `~/Desktop/BR185_ad/locosnap_eu45_tt_v1.mp4` — TikTok version (10.0s)
- `~/Desktop/BR185_ad/locosnap_eu45_ig_v1.mp4` — Instagram version (10.5s)

## Render plan

1. Cut 2s segments from each source clip
2. Scale all to 720×1280, 30fps
3. Concat into base 8.0s pre-endcard video
4. Generate endcard (2.0s)
5. Concat base + endcard
6. Burn ASS subtitles
7. Frame-verify text-heavy beats (1, 3, 4)
8. Build IG variant with 0.5s pre-roll
9. Move to Desktop folder

## Why this design works

- **Retention:** reveal narrative subverts the BR 185 expectation at 0:04 — viewers can't bounce because they don't yet know the punchline at 0:00–0:02.
- **DE conversion:** German viewers see "their" loco for 4s before any PL content; the ad starts as a DE freight piece.
- **PL surge play:** Polish viewers get a dedicated reveal moment + 4s of EU45-846 footage. Polish ID is asserted, not bilingual-token.
- **IG retention:** dedicated pre-roll text card answers "what is this" before the scroll instinct fires.
- **Caption:** DE-first, PL hashtags carry the secondary signal — no caption split that dilutes either audience.

## Risks

- **608×1080 EU45 footage upscale (~18%)** may show softness vs the crisp 1080×1920 BR 185 clips. Mitigation: lighter sharpening pass during scale.
- **Same-locomotive PL clips** (both are EU45-846) — risk of "this is just the same train twice" vibe. Mitigation: pick visually distinct angles in the cuts.
- **DE-only on-screen text** assumes PL viewers parse "In Polen" — confirmed safe (basic German cognate, "Polen" identical word in PL).
