# LocoSnap — Changelog

All code changes to frontend and backend are recorded here.
Format: newest first within each date block.

---

## 2026-04-21

### Content — Play Store launch video built (EN + DE versions)

Built 30-second Play Store launch video in EN and DE versions, targeting the Android production-access approval window. Eight-beat structure, 720×1280 portrait, 24fps, no audio (music to be added in CapCut at post time). Saved to `~/Desktop/launch/launch_video_en.mp4` and `~/Desktop/launch/launch_video_de.mp4`; master draft without captions at `~/Desktop/launch/launch_video_draft.mp4`.

| Beat | Duration | Source | EN caption | DE caption |
|------|----------|--------|------------|------------|
| 1 | 0–3s | AI-generated platform scene (person with grey jacket watching train arrive) | SEEN A TRAIN... | ZUG GESEHEN? |
| 2 | 3–6s | AI-generated phone-lift clip | ...AND WONDERED WHAT? | WAS WAR DAS? |
| 3 | 6–9s | Real app screen recording (BR 232 scan viewfinder) | POINT. SCAN. | EINFACH SCANNEN |
| 4 | 9–12s | Real app screen recording (BR 232 identification card + RARE badge reveal) | GET THE ANSWER | ANTWORT IN SEKUNDEN |
| 5 | 12–17s | Six-blueprint style-variety montage (IMG_3231 / 3232 / 3233 / 3235 / 3242 / 3518, 0.8s each) | WITH AI BLUEPRINTS | MIT KI-BLAUPAUSEN |
| 6 | 17–23s | Hero variety: Class 91 York / BR 101 Lichtgruß / BR 103 TEE / BR 218 / ICE 1 Eschede (1.2s each) | ANY TRAIN. ANYWHERE. | JEDER ZUG. ÜBERALL. |
| 7 | 23–26s | Eurostar e300 at Silly 300kph (watermark covered with drawbox) | LOCOSNAP (green) | LOCOSNAP (green) |
| 8 | 26–29s | Built from scratch: dark-theme end card with icon + LOCOSNAP + NOW LIVE + Play Store & App Store + Download Now CTA, progressive reveal animation | (end card has own text) | (end card has own text) |

**Workflow notes:**
- AI-generated beats 1 & 2 required upscale + left-aligned crop for beat 1 (centre-crop ate the person); beat 2 was already 360×640 portrait.
- BR 101 source had "IC 2012" watermark — swapped to cleaner "Br 101 Lichtgruß" clip from backup folder.
- Eurostar clip had "Beautiful sound" TikTok watermark at top — covered with a 180px-tall black bar at y=100, preserving full train composition.
- ffmpeg concat filter required fps/pix_fmt normalisation (`fps=24,format=yuv420p,setsar=1`) because source clips mixed 24fps/60fps and yuv420p/yuvj420p.
- Captions positioned upper-third (y=180) with semi-transparent black box (boxcolor=black@0.55, boxborderw=20) for readability against variable backgrounds.
- German umlauts verified: ÜBERALL renders correctly in DE build.

**Why:** Play Store production access application expected tomorrow (2026-04-22) once the 14-day closed test completes. Launch video is the primary organic marketing asset for the Android release, posted to TikTok and Instagram simultaneously in both EN and DE versions to reach UK and Germany markets. User will add music in CapCut before posting (specific track TBD).

### Backend — BR 648 factual overrides (rarity, specs, facts)

`backend/src/services/rarity.ts`, `backend/src/services/trainSpecs.ts`, `backend/src/services/trainFacts.ts` — added BR 648 / Alstom Coradia LINT 41 factual-override blocks to all three AI services. Rarity tier forced to "common" (300+ units across BR 648.0/.1/.2/.4/.7 in active daily service across DB Regio, HLB, NAH.SH, erixx, vlexx, Vias, Nordwestbahn). Specs pin builder to "Alstom Transport (formerly LHB Salzgitter)" (never Bombardier/Siemens/Stadler), numberBuilt 300, 630 kW, 120 km/h, 68 t, 41.8 m, Diesel. Facts prompt explicitly forbids "extremely limited production", "only 192 units built" (192 is the VR Dv12 Finnish diesel — cross-contamination guard), "specialized service", "withdrawn", "rare", or "legendary" framing.

**Why:** Vision fix shipped earlier today (commit 0b347df) correctly identifies BR 648, but downstream layers hallucinated "legendary" rarity, "192 units built", "Bombardier" builder, and "extremely limited production" narrative — same pattern as BR 140 / BR 232 / Sr1-Sr2-Sr3 where vision succeeds and specs/facts/rarity drift. Confirmed via 20:09 user screen recording showing correctly-IDed BR 648 tagged legendary with wrong build numbers. All 93 backend tests pass. Not yet deployed — needs a push to go live on Render.

### Backend — BR 648 / LINT 41 vs Siemens Mireo disambiguation fix

`backend/src/services/vision.ts` — replaced the narrow BR 563 vs LINT 41 rule with a comprehensive BR 648 / Alstom Coradia LINT 41 vs Siemens Mireo family rule. Covers all Mireo variants (BR 463, 463.3, 463.4, 563, 3427) and all LINT variants (BR 648, 622, 623). Adds Nordwestbahn, erixx, vlexx, Vias operator hints. Introduces definitive roof check: pantograph = Mireo, exhaust stacks / radiator grilles = LINT. Also fixed typo at line 218: "LINT 48" → "LINT 41" (LINT 48 is not a real variant; BR 648 = LINT 41).

**Why:** A German TikTok commenter reported photographing a BR 648 Nordwestbahn LINT 41 and receiving "Mireo" as the identification. The existing rule only covered one Mireo BR number (BR 563) and was too weak to prevent the model defaulting to "Mireo" for any modern-looking regional unit. Reply already sent to the commenter via TikTok DM stating fix would be live server-side within hours. 93/93 backend tests pass.

---

## 2026-04-20

### Content — BR 232 "Ludmilla" DE organic ad built and ready for 2026-04-21 AM post

Built `~/Desktop/locosnap_br232_de.mp4` — 11.53s, 720×1280, 30fps, H.264 CRF 18, silent, 5.74 MB. Five-beat structure matching the BR 143 / BR 140 template:

| Beat | Time | Source | Text | Notes |
|------|------|--------|------|-------|
| 1 | 0.0–2.5s | Clip 3 (`Br 232 (Ludmilla).mp4`, 1080×1920→720×1280, window 3.0–5.5s) | "1973" (0.0–1.0s) → "LUHANSK / GEBAUT" (1.0–2.5s) | 110px Arial Black |
| 2 | 2.5–5.0s | Clip 2 (`#ludmilla #bundeswehr #panzer… .mp4`, already 720×1280, window 10.0–12.5s) | "HEUTE" (2.5–3.5s) → "BUNDESWEHR / PANZER" (3.5–5.0s) | 110px / 95px (BUNDESWEHR downsized to fit 720px width) |
| 3 | 5.0–7.5s | Clip 4 (`Vorbeifahrt Ludmilla in DU Hüttenheim… .mp4`, 1080×1920→720×1280, window 10.0–12.5s — 232 259-2 hero front shot) | "MORGEN" (5.0–6.0s) → "AM ENDE" (6.0–7.5s) | 110px |
| 4 | 7.5–9.5s | Scan reveal (`ScreenRecording_04-20-2026 20-35-43_1.MP4`, 1206×2622 letterboxed, window 25.0–27.0s) | (no overlay — card speaks for itself per skill rule) | BR 232 / Deutsche Bahn · Diesel / 120 km/h / 2,200 kW / RARE |
| 5 | 9.5–11.5s | `docs/assets/locosnap_end_screen.mp4` | Top caption "ANDROID / DIESE WOCHE" (85px) + existing end-screen content | Existing asset reused per video-editing skill rule #3 |

Hook copy: **"1973 in Luhansk gebaut. Heute zieht sie Bundeswehr-Panzer. Morgen verschwindet sie. Die Ludmilla."** Three present-tense clauses — historical observation framing, irony does the work implicitly, not a political statement. Matches the proven DE scarcity template while pivoting from "end of era" to the Soviet-Ukrainian origin / Bundeswehr-cargo angle (a direction the account has not used before).

Caption (DE primary): *"1973 in Luhansk gebaut. 709 Stück für die Deutsche Reichsbahn. Heute zieht sie Bundeswehr-Panzer durch Deutschland — und wird ausgemustert. Russland-Sanktionen blockieren die Ersatzteile. Das Ende einer Ära. LocoSnap erkennt jede Lok — Android kommt diese Woche."*

Hashtags: `#ludmilla #br232 #russendiesel #reichsbahn #dbcargo #deutschebahn #eisenbahn #train #zug #trainspotting #trainspotter #locosnap`

**Skill-rule nuance discovered during build:** ARCHITECTURE.md §19 states a "10–11 char safe limit at 110px" for Arial Black drawtext. During this build, **BUNDESWEHR (10 wide letters) overflowed at 110px** because the rule is letter-width-dependent — words with wide letters (W, H, M, N, U, D, B, E) exceed the limit earlier than words with narrow letters (I, 1, 4, 3). Had to downsize to 95px. Same issue on "DIESE WOCHE" (11, downsized to 85px). Updated guidance: for strings where **every character is a wide letter**, 8–9 chars is the safe limit at 110px; for strings with narrow characters, the 10–11 rule from BR 143 still holds.

### Build — Android v1.0.20 AAB built on EAS (versionCode 9) awaiting Play Store submission

Triggered `eas build --platform android --profile production` from `frontend/` to match live iOS v1.0.20 build 42 ahead of Google Play promotion tomorrow (final day of the 14-day tester window, 2026-04-21).

- **Build ID:** `386f0d23-a8a7-49a5-a387-d1c579e10233`
- **Artifact:** https://expo.dev/artifacts/eas/7YbEaBTzzccMkr6A7gakSt.aab
- **EAS dashboard:** https://expo.dev/accounts/stephenlear1/projects/locosnap/builds/386f0d23-a8a7-49a5-a387-d1c579e10233
- **versionCode:** 8 → 9 (autoIncrement)
- **Status:** FINISHED cleanly in ~21 min, no errors.
- **Billing note:** user was at 100% of included monthly EAS credits before this build — pay-as-you-go charge applies.
- **Android v1.0.20 user-facing content:** same as iOS v1.0.20 — leaderboard username edit UI with EN + DE localisation + all backend vision/specs improvements already live server-side (Dr18, Dv12, Sr1/2/3, BR 140, Urie S15, Sm2/4/5, Mireo vs Desiro HC, and tonight's BR 232 Ludmilla).
- **Next step (tomorrow AM, after 14-day window closes):** upload AAB to Play Console production track, either via `eas submit --platform android --profile production --latest` or manual Play Console upload. Staged rollout recommended (20% initial) for first 48h.
- **AAB NOT auto-submitted tonight** — holding for user verification before hitting the production track.

### Backend fix — BR 232 / DR BR 132 "Ludmilla" factual override (Siemens → Voroshilovgrad, 273 → 709, 80t → 116t)

Discovered via on-device screen recording while preparing a BR 232 "Ludmilla" organic ad for TikTok / Instagram. App was returning three structured-specs errors:
- **Builder: "Siemens"** (wrong — Ludmilla was built at Voroshilovgrad Locomotive Works in Luhansk, Ukrainian SSR, 1973–1982)
- **Weight: 80 tonnes** (wrong — service weight is ~116 tonnes)
- **Units built: 273** (wrong — 709 BR 132 units were built and renumbered BR 232 after reunification)

The Fun Facts narrative layer was already correct (mentioned "Voroshilovgrad Works" and the V300 → BR 132 → BR 232 renumbering history) — this was a structured-specs-layer hallucination, same failure mode as BR 140 / LSWR Urie S15 / Sm2/Sm4/Sm5.

**`backend/src/services/trainSpecs.ts`:**
- Added BR 232 / Ludmilla factual-override prompt block with critical-facts guard. Naming and structure match the existing BR 140 / Urie S15 / Desiro HC blocks.
- Added 6 `WIKIDATA_CORRECTIONS` entries: `br 232`, `db br 232`, `baureihe 232`, `dr br 132`, `br 132`, `ludmilla` — each pinning maxSpeed 120 km/h / power 2,200 kW / weight 116 tonnes / builder Voroshilovgrad Locomotive Works (Luhansk) / numberBuilt 709 / fuelType Diesel.

Scope discipline: deliberately did NOT add a broad `siemens` correction — Siemens builds plenty of DB locomotives legitimately (Desiro HC, Mireo, Vectron, Taurus). Keyed only on BR 232 / Ludmilla class names.

Build + 93/93 backend tests passing.

Motivation: the app returning "Siemens" as builder would have been the first thing a German commenter screenshot-contested under the Ludmilla ad. Shipping the fix now means the scan result in the ad itself will be factually bulletproof.

---

## 2026-04-19

### Release — iOS v1.0.20 build 42 APPROVED by Apple and LIVE on App Store (evening)

Apple approved v1.0.20 build 42 on the evening of 2026-04-19. Now live on the App Store under app ID 6759280267 at https://apps.apple.com/app/locosnap/id6759280267.

**User-visible change in v1.0.20:** leaderboard username edit UI. Auto-generated TrainFan names (e.g. "TrainFan4821") can now be personalised from the Profile tab — tap the username, edit modal appears, save a custom name (letters / numbers / underscores, 3–20 chars). Modal copy localised to EN + DE.

**Server-side improvements active for v1.0.20 users without requiring an app update:**
- Finnish VR rules — Dr18 (Fenniarail, not VR), Dv12 (correct livery + 192 units), Sr1/Sr2/Sr3 (distinct classes, not all Sr3)
- BR 140 / E 40 factual override (879 built West German, not 186 East German)
- BR 30506 → LSWR Urie S15 (4-6-0, 1920 Eastleigh, not Schools 4-4-0 1914)
- VR Sm2 / Sm4 / Sm5 commuter EMU disambiguation (+ HSL operator for Sm5)
- Siemens Mireo vs Desiro HC disambiguation (deck count as single discriminator)

**Previous live:** v1.0.19 build 41 (approved 2026-04-14).

**Next:** Android v1.0.20 APK build + distribution to tester cohort. Currently distributed Android is v1.0.19 (versionCode 8, preview) from 2026-04-14 — covers the 3-lifetime-scan paywall but not the username edit feature. Android public release target remains "within the next week" as communicated in tester emails and TikTok comment threads.

### fix(vision): Siemens Mireo vs Desiro HC disambiguation (evening hotfix)

Public reply commitment made on TikTok BR 111 video ("Fix ist heute Abend live"). Shipped within 2 hours.

**Bug:** German TikTok commenter reported the app returning "Mireo" for roughly 1 in 3 regional EMU scans, including obviously bilevel Desiro HC units. Second comment from the same person on the BR 111 video confirmed the pattern ("sagt bei jedem dritten es sei ein mireo"). Root cause: vision.ts had a full Siemens Mireo PRE-FLIGHT CHECK block but **no Desiro HC rule at all** — model had nowhere to route a double-deck angular-nosed Siemens EMU, so it defaulted to Mireo every time.

**Files changed:**
- `backend/src/services/vision.ts` — added dedicated "Siemens Mireo vs Siemens Desiro HC disambiguation" block immediately before the Finnish Sm2/Sm4/Sm5 block. Hard single-discriminator rule (deck count): single-deck throughout = Mireo; double-deck middle cars with stepped roofline = Desiro HC. Block names NRW RRX (Rhein-Ruhr-Express, National Express / Abellio) as the primary operator, describes the aqua/teal RRX livery stripe, and explicitly blocks two wrong defaults ("if two rows of windows stacked, NEVER Mireo"; "if RRX aqua stripe visible, NEVER Mireo"). Also explicitly distinguishes from BR 462 ICE 3neo (single-deck high-speed, different platform entirely).
- `backend/src/services/trainSpecs.ts` — added "Siemens Desiro HC" factual-override prompt block (160 km/h, ~3,100 kW, ~230 t 4-car, Siemens Mobility Krefeld, 25 kV 50 Hz AC, push-pull 2+2 config) with critical-facts guard (double-deck middle not all single-deck, Krefeld builder not Bombardier/Alstom/Stadler, "Desiro HC" not "Mireo", not ICE 3neo). Added two `WIKIDATA_CORRECTIONS` entries (`desiro hc`, `siemens desiro hc`).

**Scope discipline:** Did NOT modify the existing Mireo PRE-FLIGHT CHECK block — the rule itself is fine, the gap was simply that Desiro HC had no competing rule. Adding Desiro HC as a sibling option gives the model the right routing decision.

**Tests:** `npm run build` clean, `npm test` 93/93 pass across 12 suites.

**Deployment:** Committed and pushed to `main` same evening to honour the public "heute Abend live" commitment on TikTok.

### fix(vision): BR 30506 → LSWR Urie S15 + VR Sm2/Sm4/Sm5 commuter EMU disambiguation

Two tester bugs fixed in one pass.

**Bug 1 — UK tester, BR 30506 misidentified as "Schools Class 4-4-0 built 1914" (Legendary).** Correct answer: **LSWR Urie S15 Class, 4-6-0, built October 1920 at Eastleigh Works** (LSWR 506 → SR 506 → BR 30506), designed by Robert Urie, preserved and operational at the Mid-Hants Railway (Watercress Line) by the Urie Locomotive Society. Model invented a fake "Class 30506" and attributed it to Maunsell's Schools (V) class, which is a completely different 4-4-0 express passenger design built 1930–1935.

**Bug 2 — Finnish tester Oula, every VR commuter EMU collapsed to "Sm5 FLIRT".** Correct answers: older boxy units = **VR Sm2** (Valmet/Strömberg 1975–1981, 50 two-car sets, flat windscreen, 120 km/h); mid-generation rounded-nose = **VR Sm4** (CAF Beasain / Transtech 1999–2005, 30 two-car sets, 160 km/h); sharp angular FLIRT-nose = **VR Sm5** (Stadler FLIRT Finland, 2008+, 81 four-car sets, operator is HSL not VR alone — Pääkaupunkiseudun Junakalusto Oy owns the fleet).

**Files changed:**
- `backend/src/services/vision.ts` — added three new disambiguation blocks to the vision prompt: (a) "UK BR 30xxx number block" rule forbidding the model from returning a BR running number as a class name, with explicit 30506 → Urie S15 resolution; (b) full "LSWR Urie S15 Class (BR 30506 and siblings)" rule with critical facts (4-6-0 not 4-4-0, built 1920 not 1914, Urie not Maunsell, class name "LSWR Urie S15" not "Class 30506" not "Schools Class"), visual cues (Urie stovepipe chimney, double-window cab, 8-wheel Urie bogie tender), and explicit contrast with Schools class; (c) "Finnish VR commuter EMU disambiguation (Sm2 vs Sm4 vs Sm5)" covering the three distinct visual families and the HSL vs VR operator distinction for Sm5.
- `backend/src/services/trainSpecs.ts` — added four new factual-override blocks to the specs prompt (Urie S15, Sm2, Sm4, Sm5) with exact maxSpeed/power/weight/builder/numberBuilt values, plus eight new entries to the `WIKIDATA_CORRECTIONS` map (`urie s15`, `lswr urie s15`, `lswr urie s15 class`, `s15`, `sm2`, `vr sm2`, `sm4`, `vr sm4`, `sm5`, `vr sm5`) so Wikidata hallucinations get corrected even if the vision layer returns a class name variant.

**Why this structure:** Vision layer (class name + design era) and specs layer (builder/power/year) are independent failure points. BR 140 and Sr1/Sr2/Sr3 bugs showed that fixing only one layer leaves the other lying. Both layers now carry the correction, and the Wikidata corrections map catches any residual drift.

**Scope discipline:** Did NOT add a broad "stadler flirt" correction because the FLIRT platform is worldwide (Norway, Germany, Switzerland, Italy, etc.) — applying Finnish Sm5 specs to every FLIRT scan would break those. Correction is keyed on "sm5" / "vr sm5" only.

**Tests:** Backend `npm test` — all 93 tests pass across 12 suites. No test changes needed (existing tests don't assert specific class-name overrides, but the compile + test pass confirms no regression).

**Deployment:** Not yet deployed — needs a push to go live on Render.

### Content — BR 140 "DB HAT SIE AUFGEGEBEN" DE video produced

Built `~/Desktop/locosnap_br140_de.mp4` — 10.0s, 720×1280, 30fps, H.264, silent, 4.9 MB. Ready for post tomorrow AM (TikTok first, Instagram Reel ~1h later, music added at post time).

**Concept:** "Killed by DB, kept alive by the sensible people." Narrative frames DB Cargo's 2020 retirement of BR 140 vs. the private freight operators (PRESS, Lokomotion, Railsystems RP, RailAdventure, EBM Cargo) who bought the survivors and kept them running. Chosen as next DE class after BR 103 based on: (a) 7-day TikTok data confirming DE videos outperform UK on retention, full-watch rate, AND follower conversion (BR 103 landed 9 followers vs Class 345's 2 — 4.5×); (b) BR 140 has a strong "end of era / they wouldn't die" hook that matches the proven template.

**Beat structure (yellow subs — first time using #FFFF00 not white):**
- Beat 1 (0.0–1.5s): Radebeul Ost 2024 red DB-era 140 approaching at distance. Text: "DB HAT SIE" / "AUFGEGEBEN." (14-char safe limit respected)
- Beat 2 (1.5–4.0s): PRESS 140 050-3 in blue livery, hero arrival at Radbruch. Text: "DIE SCHLAUEN" / "RETTETEN SIE."
- Beat 3 (4.0–6.5s): Radebeul Ost 2024 red 140 side pass. Text: "BR 140." / "879 GEBAUT."
- Beat 4 (6.5–10.0s): App screen recording card reveal (Legendary, 110 km/h, 3,700 kW, 100 left, DB Class 140) letterboxed into 720×980 on black padding. Text: "NICHT" (top black band) / "TOTZUKRIEGEN." (bottom black band) at 64px to fit in bands.

**Source footage:** `~/Desktop/BR140/`
- `Vorbeifahrt einer wunderschönen Br.140 in Radebeul Ost am 13.2.24.mp4` (22.3s, 720×1280, 30fps) — used 11.0–12.5s for Beat 1, 13.5–16.0s for Beat 3 (user confirmed is BR 140)
- `Br 140 050 (140 833) von PRESS in Radbruch.mp4` (32.5s, 1080×1920, 60fps) — used 2.5–5.0s for Beat 2. Earlier window 3.5–6.0s was rejected — too much carriage footage, loco out of frame. New window captures PRESS 140 050-3 as hero
- `ScreenRecording_04-19-2026 19-45-29_1.MP4` (32.1s, 1206×2622, 60fps HEVC) — used 19.5–23.0s for Beat 4 card reveal
- **DB Museum Koblenz clip REJECTED** — YouTube uploader tagged #BR140 but the loco is actually an E 50 (DB Class 150). Fleet plate "E 50 0591" visible on side. Would have drawn savage German railfan comments. Flagged early in QA, not used.

**Subtitle iterations (2 rebuilds):**
1. First build: white subs, all 4 beats top-positioned. Rejected — Beat 4 subs covered the LEGENDARY badge at the top of the app card.
2. Second build: yellow subs, Beat 4 moved to bottom with alignment=2. Rejected — subs overlapped the Save/Share/Details buttons.
3. Final build: Beat 4 footage letterboxed (720×980 in 720×1280 with black top/bottom bands), subs placed on black bands using RevealTop (alignment=8, MarginV 40) and RevealBot (alignment=2, MarginV 40) styles. Clean card centered, subs legible on solid black.

**Caption + 20 hashtags drafted** ready to post. Caption mirrors video narrative: "DB hat sie 2020 aufgegeben. Die Schlauen nicht. BR 140 – 879 gebaut, nicht totzukriegen. Heute fährt sie noch jeden Tag Güterzüge bei PRESS, Lokomotion, Railsystems RP und Co." Hashtags favour private-operator names (`#press #lokomotion #dbcargo`) to reward engaged viewers and prime the railfan crowd.

---

### Backend — BR 140 factual overrides (trainSpecs + rarity), commit 6d18bbf

Deploy triggered by the BR 140 video build: the app card was returning hallucinated facts — "186 built, East German, virtually no survivors, withdrawn since 1957". 186 built is the exact number for DB Class 156 (a different LEW Hennigsdorf prototype), and the "East German / withdrawn 1957" framing was pure text-generator hallucination. Would have been a catastrophic error to ship in a DE video targeting the very audience that would spot "186" and "East German" inside 5 seconds.

Added to `backend/src/services/trainSpecs.ts`:
- BR 140 / E 40 hardcoded override with authoritative values:
  - numberBuilt 879 (explicit "NEVER 186" guard against the Class 156 hallucination)
  - West German DB Bundesbahn origin — explicit "NEVER Deutsche Reichsbahn" guard
  - Built 1957–1973 by Krauss-Maffei / Krupp / Henschel / SSW
  - Status "Mixed (withdrawn from DB Cargo 2020, active with private freight operators)" — named: PRESS, Lokomotion, Railsystems RP, RailAdventure, EBM Cargo
  - ~100 units still operational in 2026 — explicit "NOT extinct" guard
  - Specs: 110 km/h, 3,700 kW, 83 tonnes, 16.49 m, Bo'Bo', 15 kV 16.7 Hz AC, standard gauge

Added to `backend/src/services/rarity.ts`:
- BR 140 legendary-tier rule. Forces `legendary` tier despite the large historical fleet, on the grounds that BR 140 is now one of the last classic Bundesbahn first-generation electric freight locos still in commercial freight service
- Reason-field guard mandates West German framing + 879 units origin, blocks "extinct / virtually no survivors / completely withdrawn" language

`vision.ts` unchanged — the classifier correctly returned "DB Class 140", the hallucination was purely downstream in specs/rarity.

**Deployment:** committed `6d18bbf`, pushed to `main`, Render auto-deploy landed within 90 seconds. Rescan in app confirmed card now shows correct LEGENDARY / DB Class 140 / 110 km/h / 3,700 kW / 100 left / PRESS 140 050-3 photo / West German private-operator framing. Fresh screen recording used for video Beat 4.

**TypeScript clean, no test regressions.** This is the same pattern as the Dr18, Sr-class, BR 485, BR 143 fixes shipped earlier in the month — vision correct, specs+rarity need reinforcement for the downstream text generation.

---

### Tester Outreach — mass "please update" nudge email sent (23/23)

Bilingual EN/DE email sent via Resend to 23 active testers asking them to install the latest v1.0.19 APK. Triggered by a regressed Sentry alert (REACT-NATIVE-6 "Could not connect to LocoSnap servers") surfacing a cluster of 5 users / 11 events over 30 days on release 1.0.7 (versionCode 5) — all from users who never updated past early APKs. Email frames the ask around "older builds are hitting connection errors" and teases public launch within the next week.

All 23 sends successful. Resend IDs audit-trailed in `~/.claude/projects/-Users-StephenLear-Projects-locosnap/memory/tester_contacts.md`. CC'd to `unsunghistories@proton.me` per mandatory rule. Cloudflare UA header set. From: `stephen@locosnap.app`.

Recipients (23): Stephstottor, aylojasimir, christian.grama, dieterbrandes6, esseresser07, gazthomas, gerlachr70, jakubek.rolnik, jannabywaniec, jlison1154, joshimosh2607, krawiec.jr69, kt4d.vip, leander.jakowski, m.j.griffiths.ucl, mf.bruch, mike.j.harvey, muz.campanet, qwertylikestrains, scr.trainmad, scrtrainmadother, trithioacetone, vattuoula.

Excluded: stevelear51 (user's secondary account), unsunghistories (CC).

Sentry alert resolved manually in UI after send decision made — handled error, low severity, stale releases only.

---

## 2026-04-18

### Content — BR 103 "EINST FUHR SIE DEN RHEINGOLD" DE video produced

Built `~/Desktop/locosnap_br103_de.mp4` — 10.02s, 720×1280, 30fps, H.264, silent, 1.63 MB. Ready for post tomorrow AM (TikTok first, Instagram Reel ~1h later, music added at post time).

**Concept:** German nostalgia angle leveraging the BR 103's association with the Rheingold — one of the most iconic European express trains of the 20th century. Selected from unused German candidates (BR 103, BR 232 Ludmilla, SVT 137 Flying Hamburger) after ICE L was already burned on 2026-04-10 (4 posts that day). Prioritised Germany over UK for tomorrow based on Germany being the only monetising market (100% of $27 proceeds) and the 7-day TikTok audience being 44.2% DE vs 5.9% UK.

**Source footage:** `~/Desktop/br103/` — five clips, three usable.
- `German Br103 on its way with Rheingold train to Luzern` (16.2s, 720×1280, 60fps) — used 4.0–5.5s window (BR 103 246-7 in full TEE cream/red livery with Rheingold rake trailing). Initial build used 10.0–11.5s which showed only the coaches — caught by user on first preview, rebuilt.
- `Die legendäre BR 103` (23.2s, 1080×1920, 25fps) — used 9.0–12.0s (BR 103 113-7 nose-on hero shot)
- `ScreenRecording_04-18-2026 22-10-58_1.MP4` (47.4s, 1206×2622 HEVC) — app card reveal at 27.5–31.0s (EPIC rarity, confetti)
- `Ex. DB Br103 with its mixed TEE train from Luzern to Koblenz.mp4` — not used
- `TSW 4 Trainspotting Short BR 103 Gemischtzug.mp4` — rejected (Train Sim World 4 CGI)

**Beat structure:**
- Beat 1 (0.0–1.5s): Rheingold + BR 103 246-7 side-pass. Text: "EINST FUHR SIE" / "DEN RHEINGOLD" (Arial Bold 70px white with 4px black outline, y=140/y=230 — within 14-char safe limit at 720px)
- Beat 2 (1.5–4.5s): BR 103 113-7 nose-on hero
- Beat 3 (4.5–8.0s): Screen recording card reveal (EPIC rarity)
- Beat 4 (8.0–10.0s): LocoSnap end screen

**Skill rule reinforcement logged:** "Screen recording crop — verify source frames before building" failed here by failing to verify which clip window had the loco visible vs carriages only. Fix required rebuilding seg1 after first render. The `verify in/out timestamps` rule should extend to beat hero footage, not just screen recordings.

### Content — iOS v1.0.20 build 42 release notes drafted (EN + DE)

Drafted App Store release notes via `app-store-release-notes` skill for v1.0.20 build 42. User-facing change: leaderboard username edit UI (auto-generated TrainFan names can be personalised in Profile, letters/numbers/underscores, 3–20 chars). Backend Dr18/Dv12 vision fixes deployed in the morning already live on server — no user-visible change in the app. Notes ready for paste when build is submitted; build not yet queued this session.

### Stats — 2026-04-18 Class 345 + account review

Reviewed 11 stat screenshots in `~/Desktop/stats 18:4/`. Key findings informed BR 103 direction.
- **Class 345 TikTok:** 397 views, 66.0% UK, 8.9% full-watch rate, 2 new followers.
- **Class 345 Instagram:** 115 views, 53.9% Germany, 69.5% skip rate, 0 follows.
- **7-day account TikTok:** 7.0K views (+33.6%), Germany 44.2%, Poland 17.9%, UK 5.9%. Germany overtaking Poland — trajectory validates prioritising German nostalgia content for tomorrow.

### Backend — Sr1/Sr2/Sr3 disambiguation reinforcement (Oula feedback)

Oula (vattuoula) tested more Finnish locomotives after the AM Dr18/Dv12 deploy and reported all three Sr electric classes being returned as Sr3. Screenshots showed Sr1 fleet 3041 (classic red-green-yellow Finnish tricolor livery) and Sr2 fleet 3227 (modern white/green) both misidentified as Sr3. Fix shipped same evening.

#### `backend/src/services/vision.ts` — Sr rule rewrite
- **Replaced** the existing Sr1/Sr2/Sr3 rule with a three-tier cue hierarchy: fleet number ranges as definitive (30xx=Sr1, 32xx=Sr2, 33xx=Sr3), then livery (red+yellow stripe = Sr1 ALWAYS), then axle count + cab silhouette as fallback. Explicit "NEVER default to Sr3" guidance added.
- **Clarified** builder lineage: Sr1 = Novocherkassk (NEVZ) + Strömberg electrics, Sr2 = SLM Winterthur / ABB (Re 460 family — Swiss rounded cab), Sr3 = Siemens Vectron.

#### `backend/src/services/trainSpecs.ts` — Sr1 + Sr2 prompt rules and hardcoded overrides
- **Added** SPECS_PROMPT guidance for Sr1 (Co'Co' 110 units 1973–1985, 160 km/h, 3,100 kW) and Sr2 (Bo'Bo' 46 units 1995–2003, 210 km/h, 6,100 kW).
- **Added** WIKIDATA_CORRECTIONS entries for `sr1`/`vr sr1` (builder "Novocherkassk (NEVZ) / Strömberg"), `sr2`/`vr sr2` (builder "SLM Winterthur / ABB"), `sr3`/`vr sr3` (builder "Siemens", 200 km/h, 6,400 kW, 80 units).

#### `backend/src/services/rarity.ts` — Sr-class rarity tiers
- **Extended** the Finnish fleet-awareness paragraph with Sr1 = rare (fleet shrinking, classic tricolor livery leans epic), Sr2 = rare (only 46 units ever built, all active), Sr3 = uncommon (80-unit modern backbone).

#### Deployment
- Commit `0e28169` pushed to Render 2026-04-18 evening. All 93 backend tests pass, TypeScript clean. Awaiting Oula retest feedback.

### Frontend — v1.0.20 build: leaderboard username edit UI + DE localisation

#### `frontend/app.json` — version bump
- **Changed** `"version": "1.0.19"` to `"version": "1.0.20"`. EAS production profile uses `autoIncrement: true` for iOS build number.

#### `frontend/locales/en.json` + `frontend/locales/de.json` — new `profile.usernameModal` section
- **Added** modal strings: `title`, `subtitle`, `placeholder`, `cancel`, `save`.
- **Added** `errors` subsection: `empty`, `tooShort`, `tooLong`, `invalidChars`, `notAllowed`, `alreadyTaken`, `notSignedIn`, `generic`.
- German translations verified for correct umlauts (ä, ü) and en-dash in the "3–20 Zeichen" copy.

#### `frontend/utils/profanityFilter.ts` — return i18n keys
- **Changed** `ValidationResult` shape from `{ valid, reason }` to `{ valid, reasonKey }`. The caller now translates via `t(reasonKey)` instead of embedding English strings in the utility. Profanity blocklist (~65 words) unchanged.

#### `frontend/store/authStore.ts` — `updateUsername` returns i18n keys
- **Changed** return shape from `{ success, error }` to `{ success, errorKey }`. Maps Supabase unique-constraint (23505) to `alreadyTaken`, not-signed-in to `notSignedIn`, anything else to `generic`.

#### `frontend/app/(tabs)/profile.tsx` — modal UI translated
- **Replaced** hardcoded English strings (title "Change Username", subtitle, placeholder, Cancel/Save button labels) with `t("profile.usernameModal.*")` calls.
- **Updated** `handleSaveUsername` to translate validation `reasonKey` and authStore `errorKey` before displaying.

#### Tests
- **55 frontend tests pass** (7 suites, ~8s). No new test failures.

#### Build state
- Version bumped; ready to queue EAS iOS production build. Current live: iOS v1.0.19 build 41 (2026-04-14), Android v1.0.11 build 5 (2026-04-01 — pre-v1.0.19 code). v1.0.20 brings the leaderboard edit feature to production for the first time.

### Backend — Finnish diesel vision rules + dead-column cleanup

Three ordered tasks per the 2026-04-17 handover plan: lowest-risk migration first, then vision-rule additions.

#### `supabase/migrations/008_drop_daily_scans_reset_at.sql` — NEW migration, cleanup
- **Added** migration 008. Drops `daily_scans_reset_at` from `public.profiles`. The column has been dead code since 2026-04-14 when the scan-gate flipped from `MAX_FREE_MONTHLY_SCANS=10` (monthly reset) to lifetime `MAX_FREE_SCANS=3` (no reset). Uses `drop column if exists` so re-running is safe.
- **Why:** backend stopped reading the column in commit 8c4cb7c (2026-04-14). Queued as backlog item 10 on 2026-04-17, executed now.

#### `supabase/migration.sql` — schema bundle sync
- **Removed** `daily_scans_reset_at` column from the all-in-one setup bundle so new installs don't re-add the dead column.

#### `frontend/store/authStore.ts` — Profile type cleanup
- **Removed** `daily_scans_reset_at: string` from the `Profile` interface. No runtime code read it — the store always deferred to `daily_scans_used` for gating. Frontend behaviour unchanged.

#### `docs/PRODUCT-SPEC.md` — spec doc accuracy
- **Removed** `daily_scans_reset_at` row from the Profile schema block. Added note that `daily_scans_used` is a lifetime counter despite the legacy name.

#### `backend/src/services/vision.ts` — Dr18 (Fenniarail) + Dv12 deepening
- **Corrected** the existing VR Finland fleet rule: Dv12 is built by Valmet (Tampere) and Lokomo (Rauma-Repola), 192 units 1963–1984 — NOT "Valmet/ABB, 262 units" as previously written. The diesel transmission is hydraulic, not diesel-electric.
- **Added** dedicated Fenniarail Dr18 disambiguation rule. Key points: operator MUST be "Fenniarail" (never VR); builder is CZ Loko (Czech Republic), based on the 774.7 EffiShunter 1600 platform; only 6 units exist (Dr18 101–106) built 2015–2020; Co'Co' hood-unit silhouette; dark-green + yellow Fenniarail livery; 90 km/h, 1,550 kW; Finnish broad gauge 1,524 mm. Explicit "NOT a VR class" framing addresses the root-cause misidentification: our Finnish Dr-series rules historically framed all Dr-classes as VR-owned.
- **Added** dedicated VR Dv12 deepening rule. Key points: CRITICAL livery correction — historic classic is **red-with-light-grey**, NOT "orange/white" (that was a prior-memory error); later schemes are green-and-white (1990s) and modern white-with-green-stripe (current); fleet numbers "Dv12 2xxx" in ranges 2501–2568 / 2601–2664 / 2701–2760; hood-unit with asymmetric long+short hood, cab roughly centred; disambiguation vs Dr19 (full-width boxcab at both ends), Dr16 (Co'Co' six-axle — count the axles), Dr14 (centre-cab full-width); sub-variants Sr12 (60 heavier 2700-series), Sv1 (unit 2501 briefly 3-phase AC 1978–80), pre-1976 designation Sv12.

#### `backend/src/services/trainSpecs.ts` — hardcoded overrides
- **Added** Fenniarail Dr18 spec override: 90 km/h, 1,550 kW, 120 tonnes, builder "CZ Loko", 6 built, 6 surviving, In service, Diesel, Finnish broad gauge 1,524 mm, operator MUST be Fenniarail. Explicit "NOT a VR class" framing and "NEVER attribute to Valmet/Lokomo/Strömberg/ABB/Siemens".
- **Added** VR Dv12 spec override: 125 km/h, 1,000 kW, 62.2 tonnes, 14.4 m, builder "Valmet / Lokomo", 192 built, Mixed status, Diesel (hydraulic transmission noted), Finnish broad gauge. LIVERY correction explicitly documented — any colour/livery field must use red-with-light-grey (historic) / green-and-white / white-with-green-stripe, NEVER "orange/white".

#### `backend/src/services/rarity.ts` — Dr18 rarity override
- **Added** Fenniarail Dr18 rarity rule: classify as **legendary**. Global fleet of 6 (Dr18 101–106) puts it alongside DR Class 156 as one of the smallest mainline locomotive fleets in existence. Explicit "operator must be recorded as Fenniarail, not VR".

#### Tests
- **93 backend tests pass** (12 suites, ~7.2s). No regressions from the rule additions or migration.

#### Deployment state
- Backend changes NOT YET DEPLOYED — needs a push to Render to go live. Migration 008 also needs to be run against the production Supabase instance separately.

---

## 2026-04-17

### Content — Class 345 "THE QUEEN OPENED THIS" video produced (EN only, UK-targeted)

Built `~/Desktop/locosnap_class345_en.mp4` — 10.0s, 720×1280, 30fps, H.264, CRF 18, silent, 4.43 MB. Scheduled for 2026-04-18 morning post. TikTok AM first, Instagram ~1 hour later (cross-post decision corrected mid-session from initial "TikTok only" call after reviewing data: Class 91 IG pulled 37.3% UK, Class 37 IG got 189 free views at flat skip rate — cross-posting delivers ~150+ free views with zero marginal effort).

**Concept:** Queen Elizabeth II's last major rail opening — she opened the Elizabeth Line on 17 May 2022 and died just under four months later on 8 September 2022. The line now carries her name. This is the hardest viral hook available for Elizabeth Line content because it ties the train to the most-viewed British news event of the decade. Continues the UK-audience build after Class 91 (Apr 15) and Class 37 (Apr 17).

**Source footage:** Four Class 345 clips in `~/Desktop/Class 345/` (Slough front-on, Stratford daylight side-pass, Stratford night arrival at 60fps, horn compilation — last one unused) plus LocoSnap scan screen recording (`ScreenRecording_04-17-2026 17-12-29_1.MP4`, 1206×2622 HEVC). App identified Class 345 "Aventra" as UNCOMMON with 95% match; 90 mph, 2,250 kW, "70 left".

**Beat structure:**
- Beat 1 (0.0-2.0s): Slough front approach. Text: "THE QUEEN" / "OPENED THIS"
- Beat 2 (2.0-4.0s): Stratford daylight side-pass. Text: "70 TRAINS" / "HER NAME"
- Beat 3 (4.0-5.5s): Screen recording card reveal (UNCOMMON + Aventra)
- Beat 4 (5.5-8.0s): Stratford night arrival (60fps, saturated purple). Text: "NEWEST LINE" / "IN LONDON"
- Beat 5 (8.0-10.0s): End screen reused from Class 37 video

**Text overlay style:** ASS subtitles, Arial Black 96px yellow `#FFFF00`, 7px black outline, bottom-centre, MarginV 160. All strings within 11-char safe zone.

**Caption:** "The Queen opened this line. Four months later, she was gone. Now 70 purple trains — all built in Britain at Bombardier's Derby works — carry her name under London every day."

**Hashtags (20):** #elizabethline #class345 #crossrail #tfl #londontransport #london #britishrail #uktrain #trainspotter #trainspotting #aventra #bombardier #purpletrain #queenelizabeth #queenelizabethii #railway #train #trains #locosnap #railfans

---

## 2026-04-16

### Backend

#### `backend/src/services/rarity.ts` — BR 485 and Class 143 rarity upgrades
- **Changed** BR 143 rarity classification from "rare" to "epic" -- near-extinct in DB Regio service, tester confirmed class is functionally gone
- **Added** BR 485 "Coladose" rarity rule: must classify as "epic" -- only 3 surviving units out of 166 originally built, all others scrapped

#### `backend/src/services/trainSpecs.ts` — 8 new hardcoded overrides
- **Added** BR 483/484 overrides: builder "Stadler / Siemens", 2020, 750V DC third rail. Fixes Wikidata hallucination that returned "Crewe Works", "1943", and "15kV 16.7Hz AC" for a modern Berlin S-Bahn train
- **Added** OBB 1116 Taurus overrides: Siemens, 230 km/h, 6,400 kW, 382 units
- **Added** DRG E 77 overrides: BMAG 1924-1926, 65 km/h, 56 units built
- **Added** Class 37 overrides: English Electric (Vulcan Foundry), 90 mph, 1,750 HP, 309 built. Fixes Wikidata returning "ALSTOM Transportation Germany" as builder
- **Added** SPECS_PROMPT bullets for BR 483/484, OBB 1116 Taurus, DRG E 77, Class 37

#### `backend/src/services/vision.ts` — 4 new disambiguation rules
- **Added** OBB 1116 Taurus vs BR 193 Vectron disambiguation: rounded smooth cab (Taurus) vs angular squared-off cab (Vectron), different Siemens generations
- **Added** DRG E 77 vs CSD E 669.1 disambiguation: 1920s German BMAG electric vs 1960s Czech Skoda electric, completely different eras and countries
- **Added** BR 483/484 S-Bahn Berlin rule: newest fleet, Stadler/Siemens 2020, 750V DC, angular contemporary cab
- **Added** BR 412 vs BR 408 reinforced disambiguation: wide flat front (ICE 4) vs narrow pointed nose (ICE 3neo)

### Frontend

#### `frontend/utils/profanityFilter.ts` — New username validation utility
- **Added** `containsProfanity()` function with ~65-word blocklist (case-insensitive substring match)
- **Added** `isValidUsername()` function: 3-20 chars, alphanumeric + underscores, no profanity

#### `frontend/store/authStore.ts` — Username update method
- **Added** `updateUsername()` method to AuthState interface and store implementation
- **Added** Postgres unique constraint error handling (code 23505 -> "Username already taken")

#### `frontend/app/(tabs)/profile.tsx` — Username edit UI
- **Added** pencil edit icon next to username display on profile header
- **Added** modal with TextInput for changing username, pre-filled with current value
- **Added** validation feedback (profanity, length, characters), loading state, error display
- **Added** "Username already taken" error handling from Supabase unique constraint
- **Changed** username display wrapped in `usernameRow` flex container to accommodate edit icon

### Infrastructure

#### `supabase/migrations/007_auto_generate_usernames.sql` — Auto-generate leaderboard usernames
- **Added** `generate_trainfan_username()` function: produces "TrainFan_XXXX" with retry loop for uniqueness collisions
- **Changed** `handle_new_user()` trigger to auto-assign a TrainFan_XXXX username on signup instead of leaving it NULL
- **Added** backfill: updates all existing profiles with NULL usernames to TrainFan_XXXX names
- **Why:** Leaderboard has been dead since launch because all views filter `WHERE username IS NOT NULL`, but profiles were created with NULL usernames and there was no UI to set one. Migration must be run manually on Supabase to take effect.

### Content — Class 37 "BUILT IN 1960" video produced (EN only, UK-targeted)

Built `~/Desktop/locosnap_class37_en.mp4` -- 10.0s, 720x1280, 30fps, H.264, CRF 18, silent, 2.96 MB. Scheduled for 2026-04-17 morning post. TikTok only, English, UK-targeted to compound the UK audience that Class 91 started building.

---

## 2026-04-15

### Content — BR 143 "AM ENDE" / "IS DYING" video produced (DE + EN, scheduled for 2026-04-16 AM post)

Produced a 10-second TikTok/Instagram short-form video for the DB Class 143, telling the story that the class is almost extinct in DB Regio service after 646 units originally built by LEW Hennigsdorf. Built in parallel as `~/Desktop/locosnap_br143_de.mp4` (primary) and `~/Desktop/locosnap_br143_en.mp4` (secondary). Scheduled for tomorrow morning: DE first to TikTok + Instagram, EN ~1 hour later to both platforms.

**Source footage:** Five BR 143 clips provided by the user in `~/Desktop/BR143/`. Reviewed all five for resolution, framerate, bitrate, loco visibility, and narrative fit. Picked three as the hero beats:

- **Beat 1 (hook 0.0–2.0s):** `BR 143 mit Bauzug #trainspotting #br143 #großköris #lokführer2008.mp4` timestamps 20.0–22.0s. DB Regio red/white BR 143 passing through pine forest, 3/4 angle. First 10s of clip skipped to avoid the "Groß Köris" burned-in text overlay from the original creator.
- **Beat 2 (scarcity 2.0–4.0s):** `Weinrot BR143 am Dresden Hbf #train #vintage #eisenbahn #germany.mp4` timestamps 11.0–13.0s. Orientrot BR 143 (fleet `143 250-9` readable on cab) in Dresden Hbf's iconic arched roof. First 9s of clip skipped because the clip opens on the Doppelstock Steuerwagen (wrong end of the push-pull set) which would have triggered a German rail-fan correction in the comments.
- **Beat 4 (closer 6.0–8.0s):** `Einfahrt Br 143 (S-Bahn Dresden), Kurort Rathen.mp4` timestamps 10.5–12.5s. Night arrival at Kurort Rathen station with headlights on, DB logo and fleet number `143 68x` visible.

**Beat 3 (card reveal 4.0–6.0s):** Screen recording `~/Desktop/BR143/ScreenRecording_04-15-2026 21-18-57_1.mp4` timestamps 23.3–25.3s. User scanned the extracted Weinrot 12.0s still (`~/Desktop/BR143/stills/weinrot_12.0s.jpg`) in LocoSnap on device. Backend returned `DB Class 143` / `DB · Electric` / `120 km/h` / `3,720 kW` / RARE badge — all three hardcoded trainSpecs values from today's backend fix flowed through correctly, and the new rarity classification showing RARE (instead of Common) is the main narrative payoff of the video. Screen recording cropped `1206:2144:0:239` then scaled to 720×1280.

**Beat 5 (end screen 8.0–10.0s):** Built fresh as `/tmp/br143_build/endscreen.mp4` matching architecture doc §19 spec: LocoSnap icon (`frontend/assets/icon-512.png`) centred, "LOCOSNAP" in large white Arial Black, "Free on App Store" and "Coming soon to Android" in yellow `#FFFF00` on `#0d0d0d` background, 2.0s duration.

**Text overlays:** ASS subtitle files built separately for DE and EN, both using architecture doc §19 style (Arial Black 110px yellow `#FFFF00`, 6px black outline, bottom-centre alignment, MarginV 250 to clear TikTok UI chrome). First pass had "VERSCHWINDET" (12 chars, DE beat 1) and "IS VANISHING" (12 chars, EN beat 1) overflowing the frame edges. Confirmed from rendered output that 10-11 chars is the actual safe max at 110px, not 9. Replaced with "AM ENDE" (DE) and "IS DYING" (EN) — punchier and fits cleanly.

**Text beats (matching pairs):**
| Beat | DE | EN |
|---|---|---|
| 1 | DIE BR 143 → AM ENDE | THE BR 143 → IS DYING |
| 2 | 646 GEBAUT → FAST WEG | 646 BUILT → ALMOST GONE |
| 4 | DAS DR-ERBE → STIRBT AUS | THE DR ERA → IS ENDING |

**Technical spec:** 720×1280, 30fps, H.264 yuv420p, CRF 18, `+faststart` flag for fast TikTok/IG upload, silent (music added at posting time). Both outputs ~5.3 MB / 10.03s.

**Concat filter:** ffmpeg with `filter_complex` chaining five inputs, scaling/padding 1080×1920 clips down to 720×1280, cropping+scaling the 1206×2622 screen recording, normalising all inputs to 30fps, concat filter with n=5:v=1:a=0. Build command documented in session notes.

### Tester feedback — Oula (vattuoula@gmail.com) confirmed v1.0.19 working + green-circle fix

Oula (Finnish tester, Samsung S24, Android 16) replied to the v1.0.19 APK mass distribution from 2026-04-14 with two pieces of very good news:
1. **App doesn't crash, opens fast, runs smoothly, no lag** on Samsung S24 Android 16 — this closes the book on the long crash saga from v1.0.8 through v1.0.11 through the notification-fix build. v1.0.19 is the first build confirmed working on this device configuration.
2. **Green-circle-off-centre scan screen UI bug is fixed and Oula noticed it** — Oula originally reported this on 2026-04-07. The fix shipped in a subsequent build and Oula spotted it in v1.0.19, thanking me in the same message.

Oula also reported two new open items: **Dr18 locomotive not identified** (Oula acknowledged "not an easy one") and **Dv12 locomotive has trouble identifying**. Both Finnish VR classes. Dv12 is already covered in vision.ts (line 229 Sm3/Dv12 rule) but the coverage may need deepening. Dr18 is NOT currently covered in vision.ts — requires research because the standard Finnish VR class list goes Dr12/Dr13/Dr14/Dr16/Dr19/Dr20 and I need to verify whether Dr18 is a current designation. Queued for next Finnish-rule session.

**Pro status verification:** Ran SQL lookup in Supabase to verify Oula's Pro status — `is_pro = true` confirmed on profile id `d07a9528-9942-4ab5-8142-336019324848` (created 2026-03-22, 13 scans used, blueprint_credits 0). Oula already had complimentary Pro from the 2026-03-31 beta tester batch — the question about the 3-scan limit was pre-emptive clarification after reading the v1.0.19 release notes, not an actual paywall hit. Replied with a clear explanation that the 3-scan limit does not apply to Oula's account and a thank-you for the Finnish-class bug reports.

### Backend — vision prompt fixes + specs/rarity overrides (Lxcx_241 feedback batch)

Tester Lxcx_241 sent six misidentification screenshots for review. All six issues fixed in this session across `vision.ts`, `trainSpecs.ts`, and `rarity.ts`.

#### `backend/src/services/vision.ts` — Six rule additions and corrections

- **Corrected** the Vossloh Euro 4000 / ADtranz Blue Tiger confusion — the previous rule incorrectly called the Vossloh Euro 4000 "Blue Tiger" and mapped Captrain "250 xxx" fleet numbers to Euro 4000. Both claims were factually wrong. "Blue Tiger" is exclusively the ADtranz DE-AC33C, a completely separate locomotive built by ADtranz + GE Transportation 1996–2002. In Germany it is numbered Class 250 (fleet 250 001–250 030, operated by Captrain, ITL, HGK, MRCE). The Vossloh Euro 4000 is a separate Spanish Vossloh/Stadler build from 2006 onwards on the EMD JT42CWRM platform. Replaced the broken rule with two clear separate rules: one for the ADtranz DE-AC33C Class 250 Blue Tiger (with Co-Co diesel, flat cab front, two square windscreens, ADtranz/GE builder) and one for the Vossloh Euro 4000 (Stadler Rail Valencia, modern angular cab, NOT called Blue Tiger). Discovered via Lxcx_241 screenshot of Captrain 250 007-2 being misidentified as Vossloh Euro 4000.
- **Added** Tatra KT4 / KT4D articulated tram vs Siemens Combino disambiguation. The KT4D is a Czechoslovak two-section articulated high-floor tram built by ČKD Tatra Smíchov (Prague) 1974–1997, widely used across East Germany (BVG Berlin, Potsdam ViP, Cottbus, Erfurt, Gera, Frankfurt Oder). It is visibly different from the Siemens Combino — the KT4D is a two-section high-floor 1970s/80s Eastern Bloc design with boxy angular cab styling, while the Combino is a 3+ section smooth low-floor modern tram from 1996+. New rule covers visual identifiers (high-floor vs low-floor, section count, cab era, Jacobs bogie articulation), modernised variants (KT4DM, KT4DC, KT4Dt), and operator liveries. Discovered via Lxcx_241 screenshot of a dark green/teal KT4D unit 157 being misidentified as Siemens Combino.
- **Added** DR BR 120 / Soviet M62 "Taigatrommel" rule, extending the existing ST 44 / M62 family rule. The East German Deutsche Reichsbahn BR 120 is a Co-Co Soviet-built diesel freight locomotive from Voroshilovgrad Locomotive Works (Luhansk, Ukrainian SSR) 1966–1975, 378 delivered to DR. Nicknamed "Taigatrommel" for its rhythmic 2-stroke Kolomna 14D40 exhaust beat. CRITICAL disambiguation: the Soviet DR BR 120 diesel is completely different from the modern DB BR 120 electric (1979, Krauss-Maffei/Henschel/Krupp) — the cab silhouette is unmistakable (single central cab elevated above a long hood with two round headlights flanking the blunt front end). Anti-anchor against British Class 33 (which has a flush rounded BR-era cab, not a cyclopean cab tower). Post-1992 renumbering: DR BR 120 → DB Cargo BR 220 (mostly withdrawn). Discovered via Lxcx_241 screenshot of a preserved red Taigatrommel being misidentified as British Class 33.
- **Rewrote** the broken S-Bahn Berlin BR 480 vs 485 rule. The previous rule claimed "BR 485 is the unpowered trailer of BR 480" which is factually wrong — BR 485 is an independent DR-era (East German) EMU class, not a trailer car. The previous rule also used pantograph visibility as a distinguisher, but the Berlin S-Bahn uses 750 V DC third-rail electrification and NONE of these classes has a pantograph. Replaced with a unified BR 480 / BR 481 / BR 485 rule that correctly describes BR 485 as an independent class built 1987–1992 by LEW Hennigsdorf (166 half-sets, originally DR class 270), distinguished from BR 480 (1986–1994 AEG, 85 half-sets, transitional design) and BR 481 (1996–2004 DWA/Adtranz/Bombardier, ~500 half-sets, modern flat-angular cab). Added service-line bias: BR 485 primarily operates on S8/S85/S9/S75/S47/S46; BR 481 on S1/S2/S25/S26/S3/S5/S7/S41/S42. Also removed the now-redundant standalone "BR 480 vs BR 481" rule. Discovered via Lxcx_241 screenshot of a yellow/red Berlin S-Bahn train on S85 Pankow being misidentified as BR 481.
- **Added** DRB Baureihe 52 / Kriegslokomotive critical guard rule. This is a 2-10-0 German wartime STEAM freight locomotive built 1942–1950, approximately 6,719 units, coal-fired. ABSOLUTE rule: fuelType must be "Coal", type must be "Steam", builder defaults to "Borsig (Berlin-Hennigsdorf)" (the first/primary manufacturer), operator defaults to "Deutsche Reichsbahn" — NEVER "Czech Railways" and NEVER electric/diesel. Covers the full builder list (Borsig, WLF, Henschel, Krupp, Krauss-Maffei, Schichau, DWM Posen, Škoda-Werke Pilsen Protectorate), post-war operators (DR, DB, ÖBB, PKP, ČSD, SNCF, JŽ), and preservation context. Discovered via Lxcx_241 screenshot showing a preserved Class 52 with specs of "Electric (3 kV DC)" fuel, "Škoda Plzeň" builder, and "Czech Railways" operator — all three fundamentally wrong for a WW2 German steam locomotive.

#### `backend/src/services/trainSpecs.ts` — Seven new hardcoded override blocks + six new SPECS_PROMPT rule entries

- **Added** Class 52 hardcoded overrides keyed as `class 52`, `br 52`, `baureihe 52`, `drb 52`, `drb class 52`, `dr 52`, `kriegslokomotive`, `kriegslok`: maxSpeed "80 km/h", builder "Borsig (Berlin-Hennigsdorf)", numberBuilt 6719, fuelType "Coal (Steam)".
- **Added** Class 143 / DR 243 hardcoded overrides keyed as `br 143`, `class 143`, `db class 143`, `baureihe 143`, `dr 243`, `dr class 243`, `br 243`: maxSpeed "120 km/h", power "3,720 kW", builder "LEW Hennigsdorf", numberBuilt 646, fuelType "Electric (15 kV 16.7 Hz AC)".
- **Added** ADtranz DE-AC33C Class 250 Blue Tiger hardcoded overrides keyed as `class 250`, `br 250`, `baureihe 250`, `adtranz de-ac33c`, `de-ac33c`, `blue tiger`: maxSpeed "120 km/h", power "2,500 kW", builder "ADtranz / GE Transportation", numberBuilt 30, fuelType "Diesel".
- **Added** DR BR 120 Taigatrommel hardcoded overrides keyed as `dr br 120`, `dr 120`, `dr class 120`, `db br 220`, `db 220`, `taigatrommel`, `m62`: maxSpeed "100 km/h", power "1,470 kW", builder "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt 378, fuelType "Diesel". These keys deliberately do NOT shadow the modern DB BR 120 electric — a lookup for plain `br 120` will fall through to AI/Wikidata and get the correct modern electric answer.
- **Added** Tatra KT4D tram hardcoded overrides keyed as `tatra kt4d`, `kt4d`, `tatra kt4`, `kt4dm`, `kt4dc`, `kt4dt`: maxSpeed "65 km/h", power "4 × 40 kW", builder "ČKD Tatra Smíchov (Prague)", fuelType "Electric (600 V DC)".
- **Added** BR 485 hardcoded overrides keyed as `br 485`, `class 485`, `baureihe 485`, `dr 270`, `dr class 270`: maxSpeed "100 km/h", builder "LEW Hennigsdorf", numberBuilt 166, fuelType "Electric (750 V DC third rail)".
- **Added** six new SPECS_PROMPT rule entries covering Class 52 (ABSOLUTE facts: coal, Borsig, Deutsche Reichsbahn, ~6,719 built, 80 km/h — NEVER electric or diesel), DB BR 143 / DR 243 (LEW Hennigsdorf builder, dwindling fleet context), ADtranz Class 250 Blue Tiger (separate from Vossloh Euro 4000), DR BR 120 Taigatrommel (Voroshilovgrad diesel, distinct from modern DB BR 120 electric), and Tatra KT4D (ČKD Tatra Smíchov, not a Combino). Defence in depth: if the Wikidata lookup misses or returns wrong entity, the AI layer now has explicit instructions for all six classes.

#### `backend/src/services/rarity.ts` — DB Class 143 rarity guidance added

- **Added** to the RARITY_PROMPT rules that DB Class 143 (ex-DR 243) has been dramatically reduced — DB Regio has withdrawn almost all of the 646-unit production fleet by 2025–2026, leaving only a small number active with private freight operators or in heritage use. A BR 143 in DB Regio push-pull passenger service in 2025–2026 should be classified as "rare", not "common". Explicitly instructs not to be fooled by the historical fleet size of 646 because the active fleet is a tiny fraction of that today. Discovered via Lxcx_241 screenshot of a DB Regio BR 143 being rarity-classified as "Common" despite the class being near-extinct in active service.

- **Tests:** All 93 backend tests pass.
- **Type check:** `tsc --noEmit` clean.
- **Not yet deployed** — needs a push to go live on Render.

---

## 2026-04-14

### Backend — vision prompt fixes (evening batch, commit `badd747`)

#### `backend/src/services/vision.ts` — Added Class 201 Hastings Thumper rule, Class 88 DRS rule, tightened Mireo pre-flight gate

- **Added** Class 201 / 202 / 203 Hastings "Thumper" DEMU disambiguation rule. Discovered via tester Steph the Spotter on 2026-04-12: scanned the preserved Class 201 1001 on "THE NORFOLK NAVIGATOR" railtour and LocoSnap returned "Class 421" (4CIG EMU, completely wrong class and traction type). Root cause: zero Class 201/202/203 coverage in vision.ts. New rule identifies the class by its narrow-profile 8 ft 6½ in body (Hastings line loading gauge restriction), BR Southern green livery with small yellow warning panel, rounded cab ends, 6-car DEMU formation, underfloor English Electric 4SRKT diesel engines (the "thumper" sound), and preserved units 1001 / 1013 owned by Hastings Diesels Ltd at St Leonards-on-Sea. Anti-anchor against Class 421, Class 411 (4CEP), Class 423 (4VEP), Class 438 (4TC) — all of which are slam-door EMUs from a completely different era and traction type. Type must be "DMU" (the app type enum has no DEMU option).
- **Added** Class 88 Direct Rail Services Stadler Euro Dual rule. Discovered via tester Steph the Spotter on 2026-04-14: scanned 88005 "Minerva" with the fleet number clearly visible on the cab front, and LocoSnap returned "Class 385" (Hitachi AT200 ScotRail EMU, completely different operator and train type). Root cause: zero Class 88 coverage in vision.ts. New rule covers: 10-unit fleet (88001–88010), Stadler Rail Valencia build 2015–2017, dual-mode Siemens Vectron-derived platform with added Caterpillar C27 diesel, 4,000 kW electric + 708 kW diesel, 100 mph max, DRS dark blue/green livery, Bo-Bo, god/goddess unit naming convention. Anti-anchor against Class 385, Class 90, Class 68 (same DRS operator but diesel-only), and Hitachi AT300 multi-units (800/801/802/805/807/810).
- **Tightened** Siemens Mireo PRE-FLIGHT CHECK gate. Discovered via BR 111 video comment 2026-04-14: commenter reported "every third scan returns a Mireo". Investigation showed the Mireo pre-flight was too broad — it fired on any white/silver German EMU with a dark underbelly, causing false positives on BR 442 (Talent 2), BR 440 (Coradia Continental), BR 462 (ICE 3neo Velaro MS), and other non-Mireo German regional EMUs. Added a CRITICAL GATE: before returning "Mireo" or "BR 463", at least one of three conditions must be true — (a) a fleet number starting "463" is readable in the image, OR (b) explicit "Mireo" / "Mireo Smart" / "Mireo Plus B" / "Mireo Plus H" branding is visible, OR (c) it is a clearly short 3-car formation with the Mireo-specific angular cab profile AND no other German Regional EMU rule matches. If none are true, fall through to the German Regional EMU Family pre-flight check or return "DB Regional EMU".

#### `backend/src/services/trainSpecs.ts` — Added hardcoded corrections for Class 201 and Class 88

- **Added** Class 201 / 202 / 203 hardcoded overrides keyed as `class 201`, `class 202`, `class 203`, `hastings thumper`, `hastings demu`, `thumper`: maxSpeed 75 mph, builder BR Eastleigh Works, numberBuilt 7 per sub-class, fuelType "Diesel-Electric (English Electric 4SRKT)".
- **Added** Class 88 hardcoded overrides keyed as `class 88`, `br 88`, `br class 88`, `88005`, `88005 minerva`: maxSpeed 100 mph, power "4,000 kW (electric) / 708 kW (diesel)", builder "Stadler Rail Valencia (Vossloh España)", numberBuilt 10, fuelType "Bi-mode (25 kV AC overhead + Caterpillar C27 diesel)".

- **Tests:** All 93 backend tests pass.
- **Deployed** to Render (commit `badd747`, pushed to main 2026-04-14).
- **Public responses posted** on the BR 111 video comment thread acknowledging the Mireo over-match (fix already deployed) and accepting the "NUR NOCH 4" clarification that the "4 remaining" count specifically refers to RB 6 München-Garmisch in DB Regio Bayern, while other Verwaltungsbereiche still operate additional BR 111s. Video left live per strategic decision — the public correction is itself a trust-building signal.

### App Store

#### iOS v1.0.19 build 41 — **Apple approved — live on App Store**
- **Approved** by Apple 2026-04-14. v1.0.19 build 41 now live on App Store, replacing v1.0.18 build 40 which had been live since 2026-04-12.
- **Contains:** 3 lifetime scans paywall (down from 10/month), Pro upsell banner on results screen with source tracking `paywall?source=results_banner`, `free_limit_hit` analytics event rename, BR 442/642 disambiguation fix, card-reveal Rules of Hooks fix (from v1.0.18).
- **Impact:** Frontend paywall is now 3 lifetime scans for all iOS users. Existing free users with previous scans retained counted against the new limit on first launch.
- **Triggered next action:** Backend `identify.ts` scan limit flip (see Backend section below) — coordinated with App Store approval per the hold plan in HANDOVER-2026-04-13-3.md.

### Backend

#### `backend/src/routes/identify.ts` — Flipped to 3 lifetime scans, removed monthly reset
- **Changed** `const MAX_FREE_MONTHLY_SCANS = 10` to `const MAX_FREE_SCANS = 3`. Free-tier users now have 3 lifetime scans, no monthly reset.
- **Removed** the `isNewMonth` check and `daily_scans_reset_at` column from the profile SELECT. The column remains in the Supabase schema but is no longer used by the backend — the `daily_scans_used` counter now accumulates without reset for non-Pro users, matching the frontend behaviour introduced in v1.0.19 build 41.
- **Updated** error message from "Monthly scan limit reached. Upgrade to Pro for unlimited scans." to "Free scan limit reached. Upgrade to Pro for unlimited scans."
- **Why now:** Apple approved iOS v1.0.19 build 41 earlier on 2026-04-14, making the new frontend live on App Store. Per the hold plan in HANDOVER-2026-04-13-3.md, the backend flip must happen in the same session as the App Store release to keep frontend and backend in sync. Holding the flip any longer would leave iOS users on a 3-lifetime-scan frontend while the backend allowed 10/month — a divergent state.
- **Tests:** All 93 backend tests pass.
- **Deployed** to Render (commit `8c4cb7c`, pushed to main 2026-04-14).

### Build

#### v1.0.19 Android APK — EAS preview build completed
- **Built** v1.0.19 Android preview APK via EAS to match iOS v1.0.19 build 41 state (currently in Apple review). Build id `8d5b2ad3-937d-46eb-b4ed-bc076413ae62`, versionCode 8, SDK 54.0.0, 10m 58s build duration, git commit `872dd58`.
- **APK URL:** https://expo.dev/artifacts/eas/ispu2yQ9ZFMWc8x2Wq6Hwb.apk
- **Contains:** `MAX_FREE_SCANS=3` lifetime (down from 10/month), Pro upsell banner on results screen linking to `paywall?source=results_banner`, `free_limit_hit` analytics event rename, BR 442/642 disambiguation fix, all prior v1.0.18 card-reveal Rules of Hooks fix.
- **Held — not yet distributed.** Backend still at `MAX_FREE_MONTHLY_SCANS=10` intentionally. Distribution waits until iOS v1.0.19 is approved by Apple and the backend is flipped to `MAX_FREE_SCANS=3` in the same synchronised action.
- **EAS cost:** pay-as-you-go (100% of April monthly credits used). One build triggered, one build completed, no re-trigger — acceptable spend.
- **Why now:** Android has been one version behind iOS since 2026-04-07 (v1.0.17 was the last Android build). Needed to match iOS v1.0.19 state so that when Apple approves, Android testers can be moved to the new paywall at the same time as iOS users and the backend flip. Building now before Apple approval means the APK is ready to ship the moment the coordinated flip happens.

### Tester Outreach

#### 5 tester check-in emails sent via Resend
- **Sent** bilingual EN/DE chase emails to 4 inactive testers who had received Pro grants but never signed up in-app: krawiec.jr69@gmail.com (Resend id `c9ddf59e`), mike.j.harvey@gmail.com (`ee962798`), muz.campanet@gmail.com (`7c423bc5`), qwertylikestrains@gmail.com (`6e93bd2e`).
- **Sent** a separate chase email to scr.trainmad@gmail.com (Tom Guy — Resend id `12d00c4f`) following up on the 2026-04-02 version query and asking about `scrtrainmadother@gmail.com` active status.
- **Structure:** "Three replies that work — Still in / Switch / Not anymore" pattern to make the reply effortless. All 5 emails CC'd `unsunghistories@proton.me` per the mandatory rule.
- **Why:** Pro grant slots were sitting unused for up to 2 weeks. Needed to confirm which email addresses are live before continuing to hold slots, so we can free them for waitlist testers if any accounts have moved on.

#### Jan Kaczorkowski (krawiec.jr69@gmail.com) — reply + v1.0.17 APK sent
- **Received** "yes" reply 2026-04-14 confirming he's still in on krawiec.jr69@gmail.com.
- **Sent** bilingual EN/PL install email (Resend id `2c6ea6c2`) with the v1.0.17 Android APK download link. Chose v1.0.17 over v1.0.19 because v1.0.19 Android APK had not yet been built at the time of reply, and v1.0.17 is a known-good tester build (vattuoula confirmed it working 2026-04-07).
- **Polish translation:** the email body included a full Polish section alongside the English (Jan is Polish). Special characters verified: `ą`, `ć`, `ę`, `ł`, `ó`, `ś`, `ź`, `ż` all present and correct in `Cześć`, `dzięki`, `załóż`, `dostęp`, `się`, `Być`, `może`, `zezwolić`, `instalację`, `źródeł`, `problemów`, `instalacją`, `chętnie`, `pomogę`.
- **Next for Jan:** install v1.0.17, sign up in-app with krawiec.jr69@gmail.com, Pro grant activates automatically via the 4-hourly Pro monitor. Will be offered v1.0.19 as part of the coordinated Apple-approved rollout.

### Infrastructure

#### Resend API — Cloudflare User-Agent block discovered and documented
- **Fixed** Resend API `POST /emails` now rejects requests with the default `Python-urllib/3.x` User-Agent header, returning `403 Forbidden` and Cloudflare error code `1010`. First attempt to send the 5 tester chase emails failed entirely (0/5 sent). Added `User-Agent: LocoSnap-TesterMailer/1.0 (curl-equivalent)` and `Accept: application/json` headers — second attempt sent 5/5 successfully.
- **Documented** in `docs/ARCHITECTURE.md` Section 10 Sending (Resend) with the working header set so future Python/urllib-based Resend calls don't re-discover this. Also added the mandatory CC rule (`unsunghistories@proton.me` on every outbound) to the Resend property table for discoverability.

#### `docs/ARCHITECTURE.md` — Android APK build history and latest-build row updated
- **Added** 2026-04-14 row for v1.0.17 distribution to Jan Kaczorkowski (krawiec.jr69@gmail.com), and a second 2026-04-14 row for the new v1.0.19 Android preview build.
- **Updated** "Latest Android Preview Build" row in Section 13 from v1.0.17 to v1.0.19, with the direct APK URL and full feature list.

#### Git repo cleanup — multiple catchup commits
- **Committed** files that had been on disk but untracked for several sessions:
  - `CLAUDE.md` + `docs/CHANGELOG.md` from the 2026-04-13 Session 3 (end-of-session docs rule addition + v1.0.19 submission entry)
  - Play Store assets: `frontend/assets/feature-graphic.png`, `feature-graphic-gen.py`, `icon-512.png`, `screenshots/` (4 screenshots)
  - Video assets: `docs/assets/locosnap_end_screen.mp4` (2-second end screen used in every TikTok/Reels build)
  - Handover files: 17 files from `HANDOVER-2026-03-31-3.md` through `HANDOVER-2026-04-13-3.md`
  - Plan files: `docs/plans/2026-04-12-br218-allgau-end-of-era.md`, `docs/plans/2026-04-12-paywall-deep-assessment.md`
  - Website: `website/index.html`, `website/vercel.json`, `website/.gitignore`, `website/images/`
  - Root-level marketing docs: `locosnap-ugc-teaser-scripts.md`, `ugc-campaigns-three-apps.md`
- **Why:** Pre-build cleanup before the v1.0.19 Android EAS build. EAS clones from git at build time — any files that are only on disk but not committed do not exist in the build. Cleaning the tree first ensures the build sees everything the developer sees.
- **Not committed:** `.claude/` directory remains correctly untracked (local Claude Code settings, should not be in the repo).

### Tester Contacts Memory

#### `~/.claude/projects/.../memory/tester_contacts.md` — chase dates and open threads updated
- **Updated** 5 tester entries with chase email send dates (2026-04-11) and Resend IDs for audit trail.
- **Updated** Jan's entry to include his real name (Jan Kaczorkowski), "yes" reply from 2026-04-11, and install email Resend ID (`2c6ea6c2`).
- **Added** cool-off rule: "Do not re-chase the 2026-04-11 cohort before 2026-04-18" — week-long window prevents double-chase on the same free grant.
- **Updated** Open Threads table to 2026-04-11 baseline with all 5 chase threads listed, waiting state for each.

---

## 2026-04-13

### Frontend

#### `frontend/app.json` — Version bump to 1.0.19
- **Changed** version from `1.0.18` to `1.0.19` before triggering EAS production build.
- **Why:** v1.0.18 build 40 was already live on App Store. Apple rejects submissions where the version matches a previously approved build (ITMS-90186 / ITMS-90062).

### Build

#### iOS v1.0.19 build 41 — Submitted to App Store Connect (2026-04-13)
- **Submitted** to Apple App Store Connect for review. In review as of 2026-04-13.
- **Contains:** 3 lifetime scans for free accounts (down from 10/month), Pro upsell banner on results screen, updated scan badge and paywall alert text. All changes committed 2026-04-12 — see that date's changelog entries for full detail.
- **App Store release notes (EN):** "Bug fixes and performance improvements. Free scan limit updated to 3 lifetime scans. Pro banner added to results screen."
- **App Store release notes (DE):** "Fehlerbehebungen und Leistungsverbesserungen. Kostenlose Scan-Grenze auf 3 Scans insgesamt reduziert. Pro-Banner auf dem Ergebnisscreen hinzugefuegt."
- **Backend note:** Backend (`identify.ts`) remains at `MAX_FREE_MONTHLY_SCANS=10` until this build clears review and goes live. Backend flip and frontend release must happen simultaneously.

---

## 2026-04-12

### Frontend

#### `frontend/app/card-reveal.tsx` — Fix Rules of Hooks violation causing ErrorBoundary crash
- **Fixed** React ErrorBoundary crash ("Rendered fewer hooks than expected") triggered when `currentTrain` or `currentRarity` is null. Root cause: four `useMemo` hooks (`frontInterpolate`, `backInterpolate`, `frontOpacity`, `backOpacity`) were declared after the early return guard at line 280. When the guard fired, React counted fewer hooks than on a normal render and threw. Fix: moved all four `useMemo` calls above the early return. Added inline comment explaining the Rules of Hooks constraint so the order is not accidentally reversed in future. Caught via Sentry issue REACT-NATIVE-C in production release 1.0.17 (build 38), 1 event, 1 user, iPhone 14 iOS 26.3.1.

#### `frontend/store/authStore.ts` — Change free scan limit from 10/month to 3 lifetime
- **Changed** `MAX_MONTHLY_SCANS = 10` to `MAX_FREE_SCANS = 3`. Free accounts now get 3 lifetime scans with no monthly reset, not 10 per calendar month.
- **Removed** Monthly reset logic in `fetchProfile()` that checked `getMonth()` + `getFullYear()` and reset `daily_scans_used` to 0 on new month. The `daily_scans_used` column is now a lifetime counter despite the legacy name.
- **Changed** `canScan()` now checks against `MAX_FREE_SCANS` (lifetime) instead of `MAX_MONTHLY_SCANS` (monthly).
- **Why:** Zero conversions to Pro — 10 scans/month was too generous. Most users scan 3-5 times and never see the paywall. PictureThis (closest comparable, $60M/yr revenue) uses 3-5 free scans. Reducing to 3 lifetime ensures active users hit the paywall within their first session.
- **Not yet in a build** — will ship with v1.0.19.

#### `frontend/app/(tabs)/index.tsx` — Update scan badge and paywall alert for lifetime limit
- **Changed** Import from `MAX_MONTHLY_SCANS` to `MAX_FREE_SCANS`.
- **Changed** Scan badge comment from "monthly remaining" to "lifetime remaining".
- **Changed** Paywall alert title from "Monthly Limit Reached" to "Grow Your Collection".
- **Changed** Paywall alert body to "You've used your free scans. Upgrade to Pro for unlimited scans, cards, and blueprints."
- **Changed** CTA button text from "Upgrade to Pro" to "Continue" (proven conversion uplift per RevenueCat data).
- **Changed** Paywall source param from `monthly_limit` to `scan_limit`.
- **Changed** Analytics event from `monthly_limit_hit` to `free_limit_hit`.
- **Changed** Pre-signup alert body removed "10 scans per month" claim, now says "continue scanning, build your collection".
- **Not yet in a build** — will ship with v1.0.19.

#### `frontend/app/results.tsx` — Add Pro upsell banner on results screen
- **Added** Upsell banner visible to all non-Pro users after every scan result. Positioned between the train identity card and the blueprint section. Shows "Grow your collection / Unlimited scans, cards, and blueprints" with a sparkles icon and chevron. Taps through to paywall with `source=results_banner`.
- **Added** Styles: `upsellBanner`, `upsellContent`, `upsellIcon`, `upsellText`, `upsellTitle`, `upsellSubtitle`. Uses accent border colour and subtle background.
- **Why:** The paywall was entirely reactive — users only saw it when hitting the scan limit. Most users never reached the limit. The banner ensures every user sees a Pro prompt on every scan result, regardless of how many scans they have remaining.
- **Not yet in a build** — will ship with v1.0.19.

### Backend

#### `backend/src/services/vision.ts` — Add BR 442/642 pantograph disambiguation
- **Added** Mandatory pantograph check to the BR 442 (Bombardier Talent 2) rule in the German Regional EMU PRE-FLIGHT CHECK. BR 442 is an EMU and MUST have a pantograph on the roof. If a train has a curved nose but no pantograph and appears to be a short 2-car diesel unit, it is BR 642 (Siemens Desiro Classic, DMU), not BR 442.
- **Triggered** by TikTok comment: "Also ein 442 als 642 erkennen? Die App funktioniert gut"
- **Deployed** to Render (commit ba7dd21, pushed to main 2026-04-12).

#### `backend/src/routes/identify.ts` — Scan limit changes reverted (held for v1.0.19)
- **Changed** then **reverted** scan limit from 10/month to 3 lifetime. Initially deployed with `MAX_FREE_SCANS = 3` and monthly reset removed, but this caused 31 Sentry events / 19 users hitting confusing 429 errors because the live frontend (v1.0.17/1.0.18) still showed 10/month. Reverted to `MAX_FREE_MONTHLY_SCANS = 10` with monthly reset restored. Backend limit will be flipped to 3 lifetime when v1.0.19 frontend ships.
- **Lesson:** Frontend and backend paywall/limit changes must ship together. Never deploy a backend limit change ahead of the matching frontend.

#### `backend/src/services/vision.ts` — Add DSB Danish train pre-flight check to prevent Class ME/ER confusion
- **Added** DSB DANISH TRAIN PRE-FLIGHT CHECK block positioned before the rules section. Covers four DSB classes with a mandatory fleet number scan as Step 1 and a visual type fallback as Step 2.
- **Fixed** DSB Class ME was being returned for fleet number 2143, which is a Class ER S-tog EMU. Root cause: no DSB-specific disambiguation existed in the prompt, so the model defaulted to the most familiar DSB loco class (ME). The ME class is a diesel locomotive (Bo'Bo', built 1981–1984, 42 units numbered 1501–1542) that hauls separate coaches — completely different from the Class ER EMU (Copenhagen S-bane urban network, fleet numbers 2xxx range, third-rail 1650V DC). Fleet number alone is sufficient to rule out ME for any 2xxx number.
- **Added** Fleet number rules: 15xx range → Class ME (diesel loco); 2xxx range → Class ER (S-tog EMU, operator "DSB S-tog", type "EMU").
- **Added** Visual fallback rules for when no fleet number is readable: large diesel loco cab = ME; rubber flexible nose/bellows = IC3 (DMU); rounded dark EMU on urban service = ER; modern silver/white with pantograph on Oresund corridor = Class ET.
- **Added** Critical rule: a DSB 2xxx fleet number is always Class ER — never Class ME.
- **Triggered** by TikTok comment on the BR 101 video from user confirming the app returned "DSB Class ME" for a Class ER (DSB S-tog number 2143).
- **Deployed** to Render (commit 1949f35, pushed to main 2026-04-12).

---

## 2026-04-11

### Backend

#### `backend/src/services/vision.ts` — Rewrite German regional EMU identification as structured decision tree
- **Removed** buried BR 423 vs BR 425 disambiguation bullet from the bottom of the prompt rules list (line ~199). It was the last item in a 160-line prompt and was being under-weighted by the model, causing BR 425 to be returned even when "423" was clearly visible in the image.
- **Added** German Regional EMU Family PRE-FLIGHT CHECK block positioned immediately before the rules section. Covers BR 423, 425, 426, 440, 442, 445, and 463 as a family. Structure: Step 1 mandatory fleet number scan (definitive, overrides everything), Step 2 double-deck check (→ BR 445 Twindexx), Step 3 nose profile discriminator (BR 463 Mireo = angular pointed; BR 442 Talent 2 = wrap-around curved; BR 440 Coradia Continental = owl-face wide headlights; flat-ish upright = 423/425 family), Step 4 S-Bahn vs Regio context to distinguish 423 from 425/426. Confidence fallback: below 70%, return class "DB Regional EMU" rather than a wrong specific number.
- **Deployed** to Render (commit d5730d0, pushed to main 2026-04-11).

#### `backend/src/services/vision.ts` — Add ICE 1 vs ICE 2 Scharfenberg flap rule and ICE L Steuerwagen recognition
- **Added** ICE 1 vs ICE 2 disambiguation via Scharfenberg coupler flap (Schaku-Abdeckung) as the definitive front-on discriminator. BR 401 (ICE 1) has a small upward-opening emergency flap below the lower headlights — coupler is "Notkupplung" for emergency towing only, not used in passenger service. BR 402 (ICE 2) has a full-width front flap covering the lower nose that unlocks centrally and swings halfway inward — coupler IS used in regular passenger service for coupling two half-sets on Berlin/Hamburg-style routes. Formation length kept as secondary cue. Correction submitted by a long-term German rail enthusiast follower on the Frankfurt ICE 1 post — they identified the class specifically via the Schaku flap size.
- **Added** ICE L Steuerwagen end recognition. Previously the rule only covered the Vectron BR 193 hauling end. The ICE L has two different visual ends: (1) Vectron BR 193 in ICE white livery with roofline step-down to low Talgo coaches, (2) Talgo Steuerwagen low-profile unpowered control car with cab front but no pantograph. Both must resolve to "ICE L", never BR 193. Notes BR 193 as interim until BR 105 (Talgo Travca) is certified, and notes that as of early 2026 the Steuerwagen is not yet approved for push-pull operation. Same commenter correction — they pointed out the ICE L photo in an earlier post showed the Steuerwagen end, not the Vectron end.
- **Verified** both rules independently via Wikipedia (ICE 1, ICE 2, ICE L articles), heise.de ICE L background piece, and bahnblogstelle Steuerwagen certification delay reporting.
- **Deployed** to Render (commit a212a73, pushed to main 2026-04-11).

#### `backend/src/services/vision.ts` — Consolidate ICE disambiguation into single structured pre-flight check
- **Removed** three redundant bullet rules from the long disambiguation list: (1) ICE 3 family (BR 403/406/407/408) detail bullet — repeated the pre-flight check Step 2; (2) ICE 4 vs ICE 3 bullet — repeated the pre-flight check Step 1 description of BR 412; (3) ICE T vs ICE 3 bullet — folded into new Step 3.
- **Rewritten** ICE PRE-FLIGHT CHECK as a clean 3-step decision tree. Step 1: nose shape (rounded bullet → 401/402; wide upright chin → 412; pointed EMU → ICE 3 family). Step 2: ICE 3 sub-variant inline with location check first (Netherlands → 406), then nose profile (sharpest → 408; crease lines → 407; fleet 462; softer → 403/406). Step 3: ICE T (tilt fairings) and ICE L pointer.
- **Fixed** BR 412 was incorrectly listed inside "Step 2 — IF ICE 3 FAMILY" in the old structure. ICE 4 is not an ICE 3 variant — it is now correctly resolved in Step 1 only.
- **Changed** Default for unidentifiable ICE 3 sub-variant changed from BR 407 to BR 408. BR 408 is the newest and most numerous ICE 3 variant now entering service; BR 407 (only 17 units) should never be the default.
- **Deployed** to Render (commit 3522bfe, pushed to main 2026-04-11).

---

## 2026-04-10

### Backend

#### `backend/src/services/vision.ts` — Add BR 423 vs BR 425 disambiguation rule
- **Fixed** BR 423 (S-Bahn Frankfurt/Munich/Stuttgart) was being misidentified as BR 425 (DB Regio regional EMU). Added disambiguation rule: if fleet number visible and starts with 423, classify as BR 423. Context rule: S-Bahn network context (double S symbol, S-line destinations like "Bad Homburg", "Darmstadt", "Erding") = BR 423. Regional/intercity context without S-Bahn markings = BR 425.
- **Deployed** to Render (commit 7d4b798, pushed to main 2026-04-10).

#### `backend/src/services/trainSpecs.ts` — Fix BR 423/425/426 builder attribution
- **Fixed** BR 425 and BR 426 were returning "Derby Works" as build location (hallucination). Correct builder: Bombardier consortium (LHB Salzgitter + Bombardier Hennigsdorf/Bautzen), built 1999–2006. Added hardcoded spec corrections for BR 423, 425, and 426 covering maxSpeed (160 km/h), power (4,200 kW for 423/425; 2,000 kW for 426), builder, and year range.
- **Deployed** to Render (commit 231b2c8, pushed to main 2026-04-10).

### Social / Video

#### `~/Desktop/locosnap_frankfurt_de.mp4` and `locosnap_frankfurt_en.mp4` — Frankfurt S-Bahn quiz videos
- **Created** Two 10s TikTok/Reels quiz videos using Frankfurt West BR 423/425 footage. Structure: hook (FW 7–9s, skyline visible) → card reveal (screen recording 9.5–11.5s, card-only) → train continuing (9–13s) → end screen. DE version: "JEDEN TAG / WAS IST DAS?" + "BAUREIHE 425". EN version: "EVERY DAY / WHAT IS IT?" + "BR 425". 720x1280, 30fps, no audio.

---

## 2026-04-09

### Backend

#### `backend/src/services/vision.ts` — Add LMS Stanier fleet number disambiguation
- **Fixed** Loco 45407 (LMS Black Five) was misidentified as "LMS Princess Coronation / Duchess of Sutherland". Added LMS Stanier family disambiguation rule with definitive fleet number ranges: 44658-45499 = Black Five, 46200-46212 = Princess Royal, 46220-46257 = Princess Coronation. Includes wheel arrangement fallback (4-6-0 vs 4-6-2) when no number visible.
- **Deployed** to Render (commit e4441b8, pushed to main 2026-04-09).

### Video Assets

#### `docs/assets/locosnap_end_screen.mp4` — Rebuild end screen to spec
- **Fixed** End screen had wrong text ("Now on the App Store" in green, missing "Coming soon to Android"). Rebuilt with correct spec: "LOCOSNAP" white Impact 130, "Free on App Store" yellow #FFFF00 Impact 70, "Coming soon to Android" yellow #FFFF00 Impact 55. Dark background #0d0d0d. Icon 280x280 centred.
- **Updated** Architecture doc and video-editing skill to reflect both lines yellow (previously "Coming soon to Android" was white).

#### `~/Desktop/steam/earl_tunnel_final.mp4` — Full rebuild
- **Fixed** Video structure was wrong — opened on 2s of empty tunnel. Rebuilt with correct structure: 2s train emerging from tunnel (hook) -> 1.6s card reveal (BR Standard Class, RARE) -> 3s train and coaches passing -> 2s end screen. Total 8.6s.

#### `~/Desktop/steam/duchess_of_sutherland_final.mp4` — End screen only
- **Fixed** End screen replaced with corrected version. Footage content unchanged — still needs new screen recording after Black Five disambiguation fix is deployed (loco 45407 was misidentified as Princess Coronation).

#### `backend/src/services/vision.ts` — Add ICE L (Talgo) disambiguation rule
- **Added** ICE L identification rule. ICE L is loco-hauled by Vectron BR 193 in ICE white livery + Talgo coaches. Key visual: height step-down between tall Vectron and low Talgo coaches. Initial rule (commit a93e125) incorrectly described a Talgo cab nose. Rewritten (commit 471779e) after reviewing actual footage — train is loco-hauled, not self-propelled.
- **Deployed** to Render (commits a93e125 and 471779e).

#### `backend/src/services/trainSpecs.ts` — Add ICE L specs corrections
- **Added** Wikidata corrections for ICE L: builder "Talgo", maxSpeed "230 km/h". Keys: "ice l", "icel", "ecx", "talgo 230".

#### ICE L videos built (German + English)
- **Built** `~/Desktop/ICE L Talgo/icel_guterlok_final.mp4` — German version, 9s. Hook: "NEUER ICE" / "GUTERLOK" text overlay with Vectron visible. Card reveal: BR 193, COMMON, 272 left. Coaches passing. End screen.
- **Built** `~/Desktop/ICE L Talgo/icel_freight_loco_en_final.mp4` — English version, 9s. Same structure, "NEW ICE TRAIN" / "FREIGHT LOCO" text.

### App Store

#### iOS v1.0.17 — Approved and live on App Store
- **Approved** by Apple 2026-04-09. v1.0.17 build 38 now live on App Store. Includes language picker (EN/DE), all disambiguation improvements, Android 16 crash fix. Previous release was v1.0.7 (2026-03-31).

---

## 2026-04-08

### Backend

#### `backend/src/services/trainSpecs.ts` — Add BR Class 14 builder correction
- **Fixed** Specs card showing "BRCW Smethwick" as builder for the BR Class 14 "Teddy Bear" — all 56 were built at Swindon Works. Added to WIKIDATA_CORRECTIONS map with keys "class 14" and "br class 14". Reported by UK tester.

#### `backend/src/services/vision.ts` — Correct ET22 max speed from 125 km/h to 120 km/h
- **Fixed** PKP ET22 heavy freight electric max speed in disambiguation prompt was 125 km/h, correct value is 120 km/h.

### Build

#### iOS v1.0.17 (build 38) — Submitted to TestFlight
- **Built** iOS production build via EAS. Version 1.0.17, buildNumber 38. Includes all changes from v1.0.8 through v1.0.17 that were previously Android-only: language picker, i18n deferred init, Android 16 crash fix (setTimeout(0) deferred navigation), viewfinder glow alignment, FCM token skip on Android, all train ID disambiguation improvements.
- **Submitted** to App Store Connect via `eas submit`. IPA: https://expo.dev/artifacts/eas/kWHhX6gcrPpUBYT9Ky1AZg.ipa

---

## 2026-04-07

### Frontend

#### `frontend/app/(tabs)/index.tsx` — Fix ambient glow circle off-centre relative to viewfinder corner brackets
- **Fixed** Green circle on scan screen was visually offset from the L-shaped corner brackets. Root cause: `ambientGlow` was `position: absolute` inside `readyState`, which has no fixed height — the circle centred itself in `readyState` without accounting for `viewfinderReady`'s `marginBottom`. Moved `ambientGlow` inside `viewfinderReady` so it is positioned relative to the frame. Added `top: -40, left: -40` to account for the glow being 80px larger than the frame. Reported by vattuoula 2026-04-07.

### Backend

#### `backend/src/services/vision.ts` — Add VR Sr1/Sr2/Sr3 disambiguation rule
- **Fixed** All Finnish VR electric locomotives being returned as Sr2. No disambiguation rule existed — "VR Sr2" used as a class format example was biasing the model. Added full rule: Sr1 (Co'Co', Strömberg, 1973–1995, boxy Soviet-influenced cab), Sr2 (Bo'Bo', ABB/Adtranz, 1995–2003, modern rounded cab), Sr3 (Siemens Vectron AC, 2017+, distinctive large wrap-around windscreen). Critical rules: never default to Sr2; if Co'Co' bogies visible it is Sr1; if Vectron cab styling visible it is Sr3. Reported by vattuoula 2026-04-07.

#### `frontend/app/_layout.tsx` — Definitive Android 16 crash fix: defer router.replace via setTimeout(0) (v1.0.17)
- **Fixed** "Maximum update depth exceeded" crash persisting in v1.0.16 on vattuoula's Samsung S24 (Android 16, Hermes). Confirmed via bug report dumpstate.txt: crash stack bottom is `flushPassiveEffects → performSyncWorkOnRoot → flushLayoutEffects → forceStoreRerender`. Root cause: `router.replace()` called directly inside a passive `useEffect` triggers `performSyncWorkOnRoot` (synchronous React commit). During that commit's `flushLayoutEffects` phase, expo-router's internal layout effects fire, which call Zustand's `forceStoreRerender`, which attempts to schedule a new render inside an active commit — crashes on Android 16/Hermes with "Maximum update depth exceeded".
- **Fixed** wrapped `router.replace("/language-picker")` in `setTimeout(0)` to defer navigation to a new macrotask, completely outside any React commit cycle.
- **Fixed** added `authIsLoading` to `useAuthStore` selector and to navigation useEffect deps. Settings resolves before Supabase `getSession()` completes; without this guard, `router.replace` fires while AuthGate still renders its spinner (Stack not yet mounted) — second crash window on Android 16/Hermes.
- **Removed** early return that checked `!languageChosen` before rendering the Stack. Stack must be mounted before any `router.replace` call.

#### `frontend/app.json` — Version bump to 1.0.17

---

## 2026-04-06

### Frontend

#### `frontend/app/_layout.tsx` — Replace `<Redirect>` with useEffect for language-picker navigation (v1.0.16)
- **Fixed** "Maximum update depth exceeded" infinite loop crash on Android 16 (Samsung S24, Hermes interpreter mode). Root cause: expo-router's `<Redirect>` component mounts as a new React component instance on every RootLayout re-render. On Android 16, each mount fires the component's internal useEffect which calls `router.replace()`, which triggers a navigation event, which fires the settingsStore `useSyncExternalStore` subscriber, which calls `forceStoreRerender`, which re-renders RootLayout, which returns a new `<Redirect>` instance — infinite loop. Confirmed by crash stack frame `anonymous@1:874412` present in every vattuoula v1.0.15 crash and absent from all v1.0.13 crashes.
- **Removed** `Redirect` import from expo-router. `<Redirect href="/language-picker" />` early return removed entirely.
- **Added** `useEffect([settingsLoading, languageChosen])` that calls `router.replace("/language-picker")` when `!settingsLoading && !languageChosen`. A useEffect fires at most once per deps change and does not remount — the forceStoreRerender re-render leaves deps unchanged, so the effect cannot re-fire. Loop is impossible.
- **Changed** The `!languageChosen` early return now renders a blank `<View>` while the useEffect above handles navigation, rather than returning `<Redirect>`.

#### `frontend/app.json` — Version bump to v1.0.16
- **Changed** Version from `1.0.15` to `1.0.16`.

### Backend

#### `backend/src/services/vision.ts` — Class 14 "Teddy Bear" disambiguation rule added
- **Added** Identification rule for the BR Class 14 diesel-hydraulic shunter (D9500–D9555). Without this rule the app returned Class 31 (A1A-A1A mainline loco, completely different size category) on first scan and Class 09 (diesel-electric shunter) on second scan for D9529. Rule covers: D9500–D9555 fleet number range as definitive identifier; size distinction from Class 31 (Class 14 is 0-6-0 with no bogies, roughly half the length of a Class 31); fleet number distinction from Class 08/09 (D3xxx/D4xxx vs D9xxx); heritage railway context (entire surviving fleet is preserved).
- **Root cause** UK tester reported D9529 (Class 14 "Teddy Bear") misidentified as Class 31 then Class 09. No Class 14 disambiguation existed in the prompt.

---

## 2026-04-05

### Frontend

#### `frontend/services/notifications.ts` — Skip FCM token fetch on Android (v1.0.13)
- **Fixed** Native crash on Android when user grants notification permission. Root cause: `getExpoPushTokenAsync()` triggers a Firebase Cloud Messaging (FCM) JNI native call that throws an unrecoverable exception on Android 16, killing the process before JS error handling can run. Confirmed by tester vattuoula (Samsung S24, Android 16) — crash occurred immediately after tapping "Allow" on the notification permission dialog.
- **Changed** `getExpoPushTokenAsync()` is now skipped entirely on Android (`Platform.OS === 'android'`) and returns `null`. The function returns early after requesting permission without attempting the FCM token fetch. This is safe because push notifications are not yet live in the backend — no tokens are consumed anywhere.
- **Changed** Version bumped to v1.0.13 in `app.json`.

### Backend

#### `backend/src/services/vision.ts` — Newag 48WE Elf 2 disambiguation added
- **Added** Identification rule for the Newag 48WE Elf 2 Polish EMU. Without this rule the AI was returning ÖBB Class 814 (Czech/Austrian Regionova DMU) for the 48WE — a completely wrong class, wrong country, wrong traction type. Rule covers the 48WE's distinctive Newag nose profile, green/white PKP Intercity or regional liveries, and EMU (electric) traction as primary identifiers distinguishing it from the visually dissimilar Class 814.
- **Root cause** Polish tester submitted a photo of the 48WE Elf 2; app returned ÖBB Class 814. No Polish EMU coverage existed in the prompt for Newag products.

#### `backend/src/services/vision.ts` — BR Standard Class 5MT vs 4MT fleet number disambiguation added
- **Added** Fleet number range rule for BR Standard tender locomotives: 73xxx (73000–73171) = Class 5MT, 75xxx (75000–75079) = Class 4MT. These two classes share similar external appearance (both Riddles-designed BR Standard steam, both 4-6-0 wheel arrangement) but are distinct classes with different power ratings and driving wheel diameters. Fleet number is definitive and must take priority over visual identification.
- **Root cause** UK heritage railway tester reported the app identified loco 73156 as Class 4MT. Fleet number 73156 is unambiguously Class 5MT. No fleet number disambiguation existed for the BR Standard family.

---

## 2026-04-04

### Backend

#### `backend/src/services/vision.ts` — EU07 family production types fully disambiguated
- **Changed** EU07 rule now distinguishes two separate manufacturing runs: Pafawag type 4E (1965–1977, fleet numbers 001–251) and HCP Poznan type 303E (1983–1992, fleet numbers 301+). Previously treated as one undifferentiated class. Fleet number range is now the primary sub-type identifier.
- **Changed** EU07A clarified as 303E units with further traction upgrades (3.2 MW, 160 km/h) — not retrofits of 4E units.
- **Changed** EP07 clarified as a designation reclassification only (universal → passenger-only service), not a physical rebuild. Same locomotive, same specs, different official designation.
- **Added** CRITICAL RULE using fleet number ranges: 001–251 = Pafawag 4E, 301+ = HCP 303E, EU07A-0XX = 303E modernised with upgraded specs.
- **Root cause** Polish rail enthusiast TikTok commenter provided authoritative production history — the two factory runs differ in appearance, weight, and manufacturer and must be treated as distinct sub-types.

#### `backend/src/services/vision.ts` — EU07A type 303e (HCP Poznan modernisation) specs added
- **Added** EU07A-001 / type 303e detail to the EU07/EP07/EP09 disambiguation rule — the 303e modernisation by HCP Poznan gives substantially upgraded specs: 3.2 MW continuous power and 160 km/h max speed, both significantly higher than the standard EU07 (~2.0 MW, 125 km/h). Revised pantograph equipment also noted as a visual identifier.
- **Added** CRITICAL RULE (5) to EU07 block — if fleet number begins "EU07A-", classify as EU07A; if identifiable as 303e type, apply upgraded specs rather than standard EU07 figures.
- **Root cause** Polish TikTok commenter on the ET22/EU07 video correctly identified that EU07A-001 is a different category — HCP modernisation, 3.2 MW, 160 km/h. Without this rule the AI would return standard EU07 specs for all EU07A variants.

### Frontend

#### `frontend/i18n/index.ts` — Deferred i18n initialisation to prevent startup crash on Android 16
- **Changed** `i18n.use(initReactI18next).init({...})` was running as a module-level side effect (executed at JS bundle evaluation time, before any component mounts or any native bridge call completes). Moved into an exported `initI18n()` function that is called explicitly at runtime.
- **Added** `initImmediate: false` option — makes the init synchronous so `i18n.changeLanguage()` (called immediately after by `settingsStore.initialize()`) can run without awaiting a promise.
- **Added** `if (i18n.isInitialized) return` guard — prevents double-init if `initI18n()` is ever called more than once.
- **Root cause** Finnish tester (Samsung S24, Android 16) experienced a repeating startup crash (<0.3 s, crash loop, no error dialog) on every build from v1.0.8 onwards. Samsung bug report confirmed `data_app_crash` (Java managed exception) and artd logs showed the app running in interpreted mode (`filter 'verify' executable 'false'`). Native module set is identical to stable v1.0.7 — the only new code is `i18next` + `react-i18next`. Module-level JS init during interpreted bundle evaluation on Android 16 was the prime suspect. Moving init out of module scope and into a useEffect eliminates this.

#### `frontend/app/_layout.tsx` — Wire deferred i18n init into settings useEffect
- **Changed** `import "../i18n"` (module-level side-effect import that triggered init at bundle load) replaced with `import { initI18n } from "../i18n"` (named import only, no side effects).
- **Changed** Settings useEffect now calls `initI18n()` before `initializeSettings()` — order is critical because `settingsStore.initialize()` calls `i18n.changeLanguage()`, which requires i18n to already be initialised.

#### `backend/src/services/vision.ts` — Class 197 and Class 805/807 disambiguation added
- **Added** Class 197 vs Class 158 rule — the CAF Class 197 (TfW diesel Civity DMU, 2022+) was being returned as Class 158 (BR-era Sprinter DMU). Rule covers TfW red livery, modern CAF Civity nose, and absence of pantograph as the key identifiers distinguishing 197 from the older flat-fronted 158.
- **Added** Class 802 vs Class 805/807 rule — Avanti West Coast Hitachi AT300 variants (805 = 5-car bi-mode, 807 = 9-car electric) were being returned as Class 802 (GWR AT300). All share the same Hitachi platform; livery is the primary identifier — Avanti blue vs GWR green. Reported by UK tester (ProposedLines).

#### `backend/src/services/vision.ts` — CAF Class 756 disambiguation added
- **Added** Class 756 vs Class 700 vs Class 117 disambiguation rule — the CAF Class 756 (TfW bi-mode, 2022+, red livery) was being misidentified as Class 700 (Siemens Thameslink EMU, blue/white, England only) and Class 117 (1960s Pressed Steel DMU, completely different era). Rule covers TfW red livery, squared CAF Civity nose, and Welsh operation as key identifying signals. Explicitly blocks both incorrect classes. Reported by UK tester (ProposedLines).

#### `frontend/services/api.ts` — Silent 3s retry on connection errors
- **Added** `sleep()` helper for retry backoff.
- **Changed** `identifyTrainNative()` — on connection failure (no response from server), waits 3 seconds and retries once silently before surfacing the error to the user. Server errors, timeouts, and scan limit 429s still fail immediately without retry.
- **Changed** `identifyTrainWeb()` — same retry logic for the fetch-based web path. Retries only on "Failed to fetch" (connection refused); all other errors re-throw immediately.
- **Root cause** REACT-NATIVE-1 "Could not connect" errors spike after every backend deploy because Render has a ~15–30s restart window. The retry covers this window silently.

#### `backend/src/services/vision.ts` — ET22 specs corrected
- **Changed** ET22 disambiguation rule — added correct technical specs: max speed 125 km/h, continuous power 3000 kW. Confirmed by Polish TikTok commenter (previous prompt had no speed figure; 125 km/h is the correct ET22 figure, not 120 as tentatively noted in a previous session).

#### `backend/src/services/vision.ts` — Class 97/3 and track maintenance vehicle disambiguation
- **Added** Class 37 vs Class 97/3 disambiguation rule — the 4 Class 97/3 locos (97301–97304) are Network Rail rebuilds of Class 37s used for ERTMS trials on the Cambrian line; mechanically identical to Class 37 but identified by fleet number (97/3xx) and plain NR yellow livery. If Colas, DRS, or heritage livery is visible it is a standard Class 37.
- **Added** Track maintenance vehicle rule — tampers (Plasser & Theurer, Matisa), ballast regulators, stoneblowers, and rail grinders should be identified as their actual type (e.g. "Plasser & Theurer Tamper") not guessed as a TOPS locomotive class. Triggered by visible working machinery dominating the upper body profile. Root cause: UK tester (ProposedLines) submitted a Tamper photo that was returned as "Class 20", and a Class 97/3 that was returned as "Class 37".

#### `frontend/app/(tabs)/index.tsx` — Remove Sentry captureWarning for failed identifications
- **Removed** `captureWarning(message, { context: "handleScan" })` call when scan returns "Could not identify a train" — this is expected product behaviour (unclear photo, not a train), not an error. Was generating Sentry issues REACT-NATIVE-5 and REACT-NATIVE-7 as persistent noise that regressed every time a legitimate failed scan occurred.
- **Removed** `captureWarning` from the analytics import — no longer used anywhere in the file.
- **Changed** Condition inverted — `captureError` now fires for all errors that are NOT "Could not identify" messages. Real errors (network failures, server errors) still reported to Sentry.

---

## 2026-04-03

### Frontend

#### `frontend/services/notifications.ts` — Prevent launch crash on Samsung/Android devices
- **Fixed** App crashing at launch on Samsung Android (confirmed Finnish tester, Samsung device) — root cause was `getExpoPushTokenAsync` and `setNotificationChannelAsync` throwing native errors on certain Samsung/Android configurations that bypass JS catch blocks when not wrapped at the top level.
- **Changed** Wrapped entire `registerForPushNotifications()` body in a top-level try/catch — notification failures now log a warning and return `null` silently. The app continues loading regardless of notification setup outcome.
- **Added** Inner try/catch around `setNotificationChannelAsync` specifically — Android channel creation is now independently isolated so a channel failure does not prevent the permission request or token fetch from running.
- **Root cause** The outer `.catch(() => {})` in `_layout.tsx` only catches JS-level promise rejections. On some Samsung devices running Android 12+, the Expo notifications native module throws before the JS bridge can catch it, causing an unhandled native exception that Android reports as "LocoSnap pysähtyy toistuvasti" (keeps stopping). The fix wraps at the function level so any error path returns null safely.

### Frontend

#### `frontend/app/(tabs)/history.tsx` — Raise FREE_COLLECTION_LIMIT from 3 to 5
- **Changed** `FREE_COLLECTION_LIMIT` from `3` to `5` — research (Greg/Planta case study) shows 3 feels punitive before the user has understood the app's value. 5 gives enough scans to form a habit and feel invested before the lock triggers.

#### `frontend/app/(tabs)/history.tsx` — Collection lock gate for free users
- **Added** `FREE_COLLECTION_LIMIT = 3` constant — free users see only their 3 most recent scans.
- **Added** `LockedCollectionBanner` component — shown inline as FlatList footer when free user has more than 3 scans. Displays a stacked locked-card visual, the count of inaccessible trains ("X trains locked"), and a "Continue" CTA that routes to the paywall.
- **Changed** FlatList `data` prop — sliced to `FREE_COLLECTION_LIMIT` for non-Pro users, full array for Pro. `ListFooterComponent` conditionally renders the locked banner.
- **Added** `collection_lock_tapped` analytics event — fires with `locked_count` when banner is tapped.
- **Root cause** Free users had no in-app reason to upgrade — the collection is the core long-term value and locking it creates loss-aversion at the point of maximum engagement.

#### `frontend/app/paywall.tsx` — Paywall conversion improvements
- **Changed** Plan sort order — annual now sorts first (anchor effect makes monthly look like a downgrade). Previously monthly sorted first.
- **Changed** "Support indie development" feature item → "Full collection access" with desc "Every train you've ever spotted, always accessible". Removes charity framing, replaces with user-benefit framing.
- **Added** Safety triggers row between CTA and Restore button — "Cancel anytime" and "No commitment" with icons, reduces hesitation at point of purchase.

#### `frontend/locales/en.json` + `frontend/locales/de.json` — CTA copy change
- **Changed** `paywall.subscribe` from "Subscribe" → "Continue" (EN) and "Abonnieren" → "Weiter" (DE). "Continue" implies mid-flow completion rather than a buying commitment — removes psychological friction at the CTA.

### Backend

#### `backend/src/services/vision.ts` — Fall back to OpenAI when Anthropic billing limit is hit
- **Added** Catch for HTTP 402 in `identifyWithClaude()` — if Anthropic returns a billing error and `OPENAI_API_KEY` is configured, the request is retried silently with `identifyWithOpenAI()`. Users see no error.
- **Root cause** The existing multi-provider support was a startup-time selection only (use whichever key is configured). A 402 from Anthropic previously propagated as a server error to the user. This closes the gap so a depleted Anthropic balance never causes visible failures as long as an OpenAI key is present on Render.

### Frontend

#### `frontend/__tests__/services/api.test.ts` — Fix CI test failure caused by new supabase import
- **Added** `jest.mock("../../config/supabase", ...)` — stubs the Supabase client with a no-session `getSession()` mock. Prevents "supabaseUrl is required" error when the test suite imports `api.ts`, which now imports the Supabase client for the auth token interceptor.
- **Added** `interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }` to the axios mock instance — `api.ts` now calls `api.interceptors.request.use()` on module load; without this stub the test suite threw on import.
- **Root cause** The server-side scan gate changes added a Supabase import and an axios interceptor to `api.ts`. The test file had no mocks for either, causing the entire test suite to fail to run (not individual test failures — module load error).

### Backend

#### `backend/src/routes/identify.ts` — Add server-side monthly scan gate for free users
- **Added** `checkScanAllowed()` function — verifies the bearer token via Supabase, fetches the user profile, and blocks free users who have used all 10 monthly scans before the Vision API is called. Returns HTTP 429 with `"Monthly scan limit reached. Upgrade to Pro for unlimited scans."` Fails open on any error (Supabase down, invalid token, missing profile) so legitimate users are never incorrectly blocked.
- **Changed** Free user abuse vector closed — previously the 10-scan monthly limit existed only in frontend `canScan()` and could be bypassed by calling the Render URL directly. The gate now runs server-side before Vision is invoked.

#### `frontend/services/api.ts` — Send Supabase auth token with every identify request
- **Added** Axios interceptor that reads the current Supabase session and injects `Authorization: Bearer <access_token>` on every request when a session exists. Applied to the axios instance (native iOS/Android path).
- **Added** Same token injection to the `identifyTrainWeb()` function (web path uses native fetch, not axios). Token is added to the fetch `headers` object when session exists.
- **Changed** Previously the backend received no auth information — all identify requests were anonymous regardless of whether the user was signed in or not.

#### `backend/src/routes/identify.ts` — Add IP-based rate limiting to scan endpoint
- **Added** `express-rate-limit` middleware applied to `POST /api/identify` — 20 requests per IP per hour. Returns HTTP 429 with `{ success: false, error: "Too many scan requests. Please wait before trying again." }` when exceeded.
- **Root cause** Anthropic API balance was exhausted because the `/api/identify` endpoint had no server-side protection. Vision fires on every scan regardless of cache, and with no rate limit any client (or anyone with the Render URL) could trigger unlimited Vision API calls. Client-side scan limits (3 trial / 10 monthly) could be bypassed entirely by calling the endpoint directly.

#### `backend/package.json` + `backend/package-lock.json` — Add express-rate-limit dependency
- **Added** `express-rate-limit` package (2 packages total added).

#### `backend/src/services/vision.ts` — Expand Polish electric locomotive coverage in vision prompt
- **Changed** EU07/EU07A disambiguation rule — expanded to cover the full EU07 family (EU07, EU07A, EP07, EP09) in a single consolidated rule. Previous rule only covered EU07 and EU07A.
- **Added** Rail Polska livery context — explicitly documents that Rail Polska is a private Polish freight operator using EU07-class locos in a distinctive bright red body with yellow horizontal stripe and "RAIL POLSKA" text. Fixes identification failures where the model could not associate this unusual livery with the EU07 class.
- **Added** EP09 disambiguation — Bo'Bo' electric passenger loco built 1986–1994, identified by a prominent row of oval porthole windows along the upper bodyside. Critical rule added: if oval porthole windows are visible in a row, classify as EP09, not EU07. Previously missing from the prompt entirely.
- **Added** ET22 disambiguation — Co-Co heavy freight electric loco built 1969–1990, one of Poland's most numerous classes. Distinguished from the EU07 family by its six-axle Co-Co wheel arrangement vs the EU07's four-axle Bo-Bo. Previously missing from the prompt entirely.
- **Root cause** Tester (Foxiar) submitted a Rail Polska-liveried electric loco and received no identification result. Model was returning null because the red/yellow Rail Polska livery did not match any known EU07 operator context in the prompt, and EP09/ET22 had no rules at all. Polish audience represents 9–22% of video viewers across multiple videos, making Polish loco accuracy a priority.

---

## 2026-04-01

### Frontend (v1.0.11)

#### `frontend/store/settingsStore.ts` — Remove expo-localization entirely
- **Removed** `import * as Localization from "expo-localization"` — the native module was crashing at startup on devices with non-EN/DE device locales (confirmed: Finnish tester on Samsung S24) before Sentry could initialise, making the crash invisible to monitoring.
- **Removed** `detectDeviceLanguage()` function — replaced with hardcoded `"en"` default. App now starts in English on first launch; user selects German via the language picker in settings.
- **Changed** fallback in `initialize()` from `detectDeviceLanguage()` to `"en"`.

#### `frontend/__tests__/settingsStore.test.ts` — Remove expo-localization mock and locale detection test
- **Removed** `jest.mock("expo-localization", ...)` — package no longer in the project.
- **Removed** test case `"detects German device locale and defaults to de when no stored language"` — the behaviour no longer exists; device locale is not read at startup.

#### `frontend/app.json` — Bump version to 1.0.11
- **Changed** `version` from `"1.0.10"` to `"1.0.11"`.
- expo-localization removed from plugins array (was removed in v1.0.10 — package itself now removed).

#### `frontend/package.json` — Remove expo-localization dependency
- **Removed** `expo-localization` from dependencies — package uninstalled via `npm uninstall expo-localization`.

---

### Frontend (v1.0.10)

#### `frontend/app.json` — Remove expo-localization native plugin, bump to v1.0.10
- **Removed** `"expo-localization"` from the plugins array in `app.json` — attempted crash fix. Hypothesis: native plugin crashing at Android module registration on devices with unsupported locales. Fix was insufficient: package remained installed and settingsStore.ts still called `Localization.getLocales()` at startup.
- **Changed** `version` from `"1.0.9"` to `"1.0.10"`.

---

### Frontend

#### `frontend/app/(tabs)/_layout.tsx` — Remove key={i18n.language} from Tabs to fix Android 16 launch crash
- **Fixed** app crashing immediately on launch on Samsung S24 / Android 16 (reported by Finnish tester after installing v1.0.8). Root cause: `key={i18n.language}` was added to the `<Tabs>` component in the previous commit to force the tab navigator to remount on language change. On app startup, `settingsStore.initialize()` calls `i18n.changeLanguage()` which changes `i18n.language`, triggering a full unmount/remount of the gesture handler tree. Android 16 changed how predictive back gestures are handled, and `react-native-gesture-handler` 2.28.0 is not fully compatible with re-initialising the native gesture layer mid-startup, resulting in a native crash before Sentry initialises (explaining why nothing appeared in Sentry). Fixed by removing the `key` prop — `useTranslation()` is reactive and `t()` returns updated strings whenever `i18n.language` changes without requiring a remount, so live language switching still works correctly.
- **Removed** `i18n` from `useTranslation()` destructuring (was only used for `i18n.language` in the key prop — no longer needed).
- **Changed** `const { t, i18n } = useTranslation()` → `const { t } = useTranslation()`.

#### `frontend/app.json` — Bump version to 1.0.9
- **Changed** `version` from `"1.0.8"` to `"1.0.9"` for the hotfix build.

#### `frontend/app/card-reveal.tsx` — Fix intermittent crash when flipping the rarity card
- **Fixed** intermittent crash on Android when tapping the card to flip it. Two root causes: (1) the four flip interpolations (`frontInterpolate`, `backInterpolate`, `frontOpacity`, `backOpacity`) were derived via `flipAnim.interpolate(...)` in the render body, meaning new interpolation objects were created on every re-render — including the one triggered mid-animation by `setIsFlipped`. Recreating interpolation objects while a `useNativeDriver: true` animation is in flight can cause a native crash on Android. Fixed by wrapping all four interpolations in `useMemo` so they are created once and remain stable. (2) Rapid double-tapping could start two concurrent `Animated.spring` calls on the same value with `useNativeDriver: true`, also a crash vector. Fixed by adding a `flipInProgress` ref that blocks any new flip until the current spring animation completes.

### Backend

#### `backend/src/services/vision.ts` — Add VR Finland fleet disambiguation (Sm3 Pendolino vs Dm12)
- **Fixed** VR Sm3 (Pendolino) being misidentified as VR Dm12 (reported by Finnish tester). Root cause: no Finnish rolling stock disambiguation existed in the prompt; the AI had limited basis for distinguishing the two. Added a dedicated VR Finland fleet disambiguation rule covering: Sm3 (Pendolino) — Fiat Ferroviaria ETR 460 derivative, electric (pantograph present), tilting aerodynamic nose, white/red/blue livery, 6-car articulated, 220 km/h, in service since 1995; Dm12 — diesel DMU (no pantograph), older boxy design, entirely different body profile. Critical rules: if pantograph is visible it cannot be Dm12; Sm3 and Dm12 are visually very different and must not be confused. Also documents Sm5 (Stadler FLIRT, covered by existing FLIRT rule) and Sr3 (Siemens Vectron electric loco).

#### `backend/src/services/rarity.ts` — Add freight service context to rarity classification
- **Fixed** freight locomotives being classified as rare purely because they are uncommon on passenger trains (reported by Finnish tester). Root cause: the rarity prompt had no freight/passenger distinction — a Class 66 with 400+ units could be scored as rare because it rarely appears on passenger workings, despite being a common sight in freight service. Added two rules: (1) assess rarity across all service types — a high-fleet freight loco encountered regularly on freight routes should be "common" or "uncommon" regardless of passenger frequency; (2) the inverse also applies — a genuinely rare freight loco (small fleet, withdrawn, limited routes) should still be classified as such even if it never runs on passenger services.

---

## 2026-03-31

### Frontend

#### `frontend/store/settingsStore.ts` — Wire i18n to language changes
- **Fixed** UI always rendering in English regardless of stored or detected language preference. Root cause: `setLanguage` and `initialize` updated Zustand state and AsyncStorage but never called `i18n.changeLanguage()`, so i18next remained on its default `"en"` language for the lifetime of every session.
- **Added** `import i18n from "../i18n"` — no circular dependency risk; `i18n/index.ts` imports only from `locales/`.
- **Changed** `initialize()`: after resolving the stored or device-detected language into `language`, now calls `await i18n.changeLanguage(language)` before committing state to Zustand. This ensures the active i18next language matches the resolved preference on every cold start.
- **Changed** `setLanguage(lang)`: now calls `await i18n.changeLanguage(lang)` inside the existing `try` block after the `AsyncStorage.setItem` call, so the UI language switches immediately when the user picks a language from the picker.

#### `frontend/__tests__/settingsStore.test.ts` — Fix German locale detection test and add i18n mock
- **Fixed** German locale detection test passing vacuously. Root cause: `jest.doMock("expo-localization", ...)` was called after `jest.mock(...)` had already registered the `"en"` mock at module-load time, and the `settingsStore` module was required before `doMock` could take effect. Fixed by calling `jest.resetModules()` at the top of that test before `jest.doMock(...)` and the subsequent `require` calls, ensuring the German locale mock is the one loaded when the store module initialises.
- **Added** `jest.mock("../i18n", ...)` at the top of the file — mocks `i18n.changeLanguage` as a no-op resolved promise so tests do not attempt to initialise the real i18next instance, which has no React Native environment available in Jest.

#### `frontend/locales/en.json` — Rename "Built" locale key value
- **Changed** `results.built` value from `"Built"` to `"Units built"` — aligns with the results.tsx label fix so any component consuming the locale key shows the correct label.

#### `frontend/locales/de.json` — Rename "Built" locale key value
- **Changed** `results.built` value from `"Gebaut"` to `"Gebaute Einheiten"` — German equivalent of "Units built", replacing the ambiguous "Gebaut" which implies a construction year rather than a production count.

#### `frontend/app/(tabs)/_layout.tsx` — Wire tab labels to i18n
- **Added** `useTranslation` hook; tab `title` options now call `t("tabs.scan")`, `t("tabs.history")`, `t("tabs.leaderboard")`, `t("tabs.profile")` so tab bar labels change language when the user switches locale.

#### `frontend/app/(tabs)/index.tsx` — Wire scan screen strings to i18n
- **Added** `useTranslation` hook.
- **Changed** "Scan with Camera" button label now uses `t("scan.scanButton")`.
- **Changed** Warming-up indicator "Connecting to server..." now uses `t("scan.warmingUp")`.
- **Changed** Guest trial banner text now uses `t("scan.signUpPrompt")` (zero scans used) and `t("scan.trialBanner", { remaining })` (scans used), replacing hardcoded English strings with pluralisation-aware keys.

#### `frontend/app/(tabs)/history.tsx` — Wire history screen empty state to i18n
- **Added** `useTranslation` hook.
- **Changed** Empty-state subtitle now uses `t("history.empty")` instead of the hardcoded English string.

#### `frontend/app/(tabs)/profile.tsx` — Wire profile screen strings to i18n
- **Added** `useTranslation` hook.
- **Changed** Level number label now uses `t("profile.level")` prefix.
- **Changed** "Total Spots" StatBox label now uses `t("profile.totalSpots")`.
- **Changed** "Day Streak" StatBox label now uses `t("profile.streak")`.
- **Changed** "Upgrade to Pro" button title now uses `t("profile.upgradeToPro")`.
- **Changed** "Sign Out" button text now uses `t("profile.signOut")`.
- **Changed** "PRO" badge text now uses `t("profile.pro").toUpperCase()`.

#### `frontend/app/results.tsx` — Wire results screen strings to i18n
- **Added** `useTranslation` hook.
- **Changed** "Specifications" section heading now uses `t("results.specs")`.
- **Changed** "Facts & History" section heading now uses `t("results.facts")`.
- **Changed** "Status" spec row label now uses `t("results.status")`.
- **Changed** SpecRow labels for Max Speed, Power, Weight, Length, Builder, and Units Built now use the corresponding `results.*` keys.
- **Changed** "View Blueprint" button text (both Pro and credit-user variants) now uses `t("results.viewBlueprint")`.
- **Changed** "Generating Blueprint..." loading text (both Pro and credit-user variants) now uses `t("results.generatingBlueprint")`.

#### `frontend/app/sign-in.tsx` — Wire sign-in screen strings to i18n
- **Added** `useTranslation` hook.
- **Changed** Email input placeholder now uses `t("auth.emailPlaceholder")` instead of hardcoded "Email address".
- **Changed** Guest note text now uses `t("auth.freeAccountPerks")` instead of hardcoded English perks list.

#### `frontend/app/paywall.tsx` — Wire paywall screen strings to i18n
- **Added** `useTranslation` hook.
- **Changed** Hero title "Unlock LocoSnap Pro" now uses `t("paywall.title")`.
- **Changed** Primary CTA button "Upgrade to Pro" now uses `t("paywall.subscribe")`.
- **Changed** Restore purchases button text now uses `t("paywall.restorePurchases")`.

### Backend

#### `backend/src/services/wikidataSpecs.ts` — Fix length unit conversion (mm/km to metres)
- **Fixed** DB Class 101 (and any train where Wikidata stores length in millimetres) displaying wildly incorrect length values like "19100.0 m". Root cause: `getQuantity()` extracted the raw numeric amount from Wikidata without checking the unit URI, so 19100 mm was displayed as 19100 m. Fixed by checking the unit QID on the extracted quantity: `Q11573` (metre) used as-is, `Q174789` (kilometre) multiplied by 1000, `Q11570` (millimetre) divided by 1000. An additional sanity-check fallback divides any value exceeding 500 by 1000, on the assumption that no train is longer than 500 m and such a value must be in millimetres.
- **Added** `KILOMETRE: "Q174789"` and `MILLIMETRE: "Q11570"` entries to the `UNIT` constants map.

#### `backend/src/services/vision.ts` — Add locomotive vs EMU type classification guidance
- **Fixed** DB Class 101 (and similar single-unit electric locos) being classified as `"EMU"` instead of `"Electric"`. Root cause: the prompt listed valid type values but gave no guidance on how to distinguish a single-unit electric locomotive (hauls separate coaches, Bo-Bo/Co-Co wheel arrangement) from an EMU (self-propelled articulated set with passenger seating inside the powered vehicles). Added three clarifying bullet points under the `"type"` rule: "Electric" for single traction units such as DB Class 101/103/120/185/187 and BR Class 90/91; "EMU" for self-propelled articulated sets such as ICE 3, Desiro, Talent, FLIRT, Velaro, Class 319/387; explicit prohibition against classifying a single-unit electric locomotive as EMU.

#### `backend/src/services/vision.ts` — Add ICE 1/2 and NS ICNG disambiguation rules
- **Fixed** ICE 1 (BR 401) being misidentified as BR 412 (ICE 4). Root cause: the pre-flight check only framed the decision as "ICE 3 family vs ICE 4" — BR 401/402 were never mentioned, so the model picked between those two options and landed on BR 412. Restructured the pre-flight check into a two-step process: Step 1 determines the ICE generation (rounded elongated bullet-like nose = ICE 1/2; sharp aerodynamic pointed nose = ICE 3 family; wide upright flat-fronted = ICE 4) before any ICE 3/4 sub-classification runs. Added explicit descriptions of BR 401 (14-car, separate power cars, 60 trainsets, blunt rounded tip, built 1991–1996) and BR 402 (half-set, one power car + Steuerwagen, 7 cars) with the critical rule: if the nose is a rounded bullet with a blunt tip and separate power cars are visible, it is ICE 1/2 — not ICE 3 and not BR 412.
- **Fixed** NS ICNG (Intercity Nieuwe Generatie) being misidentified as VIRM and BR 186. Root cause: no Dutch NS EMU disambiguation existed in the prompt. The ICNG only entered service April 2023 and has limited AI training data. Added a dedicated disambiguation rule covering four NS EMU families: ICNG (single-deck, sharp V-shaped aerodynamic nose, Alstom Coradia Stream, in service from 2023), VIRM (double-deck — two stacked rows of windows, flat-fronted cab, 160 km/h), SLT (Sprinter Lighttrain, single-deck commuter), SGM (older Sprinter, boxy cab). Added critical rules: double-deck = VIRM; sharp modern angular nose = ICNG; BR 186 (Bombardier TRAXX freight/passenger loco) cannot be an NS passenger EMU under any circumstances.

#### `backend/src/services/vision.ts` — Strengthen NS ICNG identification: NS pre-flight check + VT 650 exclusion
- **Fixed** NS ICNG still being returned as VT 650 after initial disambiguation rule was added. Root cause: the VT 650 rule described "compact modern low-floor DMU with rounded modern cab" without any exclusion for Dutch NS trains — the model pattern-matched "modern rounded cab + yellow" to VT 650. Fixed by (1) adding a dedicated NS Yellow Train pre-flight check at the top of the prompt that fires on NS logo, Dutch station signage, or sharp V-nose on a yellow formation, mapping directly to ICNG / VIRM / SLT; (2) adding CRITICAL EXCLUSION to the VT 650 rule stating a long yellow NS-branded intercity formation can never be a VT 650; (3) expanding the ICNG disambiguation with the "Wesp" black/yellow nose pattern, 8-car formation context, and fleet number range (31xx).

#### `backend/src/services/vision.ts` — Rewrite NS pre-flight check to use cab nose shape as primary ICNG discriminator
- **Fixed** NS ICNG still returning as VIRM after pre-flight check was added. Root cause: the pre-flight check used side-window count (single vs double-deck) to distinguish ICNG from VIRM, but front-on photos do not show the coach sides — the model could not apply the rule. Rewrote Step A of the NS pre-flight to use cab front shape: ICNG has a pointed aerodynamic V-nose with a BLACK lower section (the "wasp" pattern), fleet numbers 31xx, year built ~2019; VIRM has a flat rectangular cab face, fleet numbers 86xx, year built 1994. Added explicit critical default rule: if the nose is clearly aerodynamic and pointed rather than flat and rectangular, return ICNG not VIRM — prevents the model defaulting to the historically better-known VIRM simply because the ICNG has less training data.

### Infrastructure

#### `Supabase — profiles table` — Pro access granted to all testers with accounts
- **Changed** 11 tester profiles updated to `is_pro = true` via Supabase REST API (service role). Testers affected: aylojasimir, esseresser07, gazthomas, gerlachr70, joshimosh2607, kt4d.vip, leander.jakowski, rheintalbahnerneo, stephstottor, unsunghistories, vattuoula. Root cause: no process existed to grant Pro at tester onboarding — Pro grants were being done ad hoc and most testers were on the free tier, hitting the 10 scan/month cap and unable to test properly.
- **Note** 9 testers (dieterbrandes6, jlison1154, krawiec.jr69, mike.j.harvey, muz.campanet, qwertylikestrains, scr.trainmad, scrtrainmadother, trithioacetone) have not signed up in-app yet. Pro must be re-granted once they create accounts.

#### `Resend — tester email` — Pro activation email sent to all 19 Android testers + iOS tester
- **Added** Bilingual EN/DE email sent to all testers explaining that free Pro access has been granted and that they must sign up in the app with their tester email address to activate it. Resend ID: `8738a615-86b0-4cbe-90e8-58556e8a03d3`. Triggered by discovery that only 3 testers had signed up in-app despite 19 being on the Play beta list.

### Docs

#### `docs/ARCHITECTURE.md` — Full audit and update against all handover docs
- **Fixed** iOS build number inconsistency — Section 1 referenced build 33, Section 13 referenced build 36. Corrected to build 36 throughout with note that builds 32-35 were earlier v1.0.7 attempts.
- **Fixed** Tester list was out of date: `foxiar771@gmail.com` corrected to `trithioacetone@gmail.com`, `aylojasimir@gmail.com` added (was missing entirely), `joshimosh2607@gmail.com` and `krawiec.jr69@gmail.com` added (recruited 2026-03-30), count updated from 16 to 19.
- **Fixed** Known Limitations section: Android APK updated from v1.0.6 to v1.0.7, auto-submit updated from v1.0.6 to v1.0.7 with gotcha note about eas.json local path, added v1.0.8 pending item.
- **Added** Current live vision provider note — Claude Vision (Anthropic) confirmed via health endpoint. Switched from GPT-4o on 2026-03-30.
- **Added** Temperature=0 documentation — all vision and specs/facts/rarity calls are deterministic. Eliminates oscillation on repeat scans of ambiguous classes.
- **Added** Hardcoded specs documentation — ICE 3 family, BR 412, DB/DR Class 156 are pinned in SPECS_PROMPT to prevent hallucination.
- **Added** Wikidata zero-value guard documentation — quantity fields can return 0; guards skip these and treat as missing data.
- **Added** maxSpeed conflict resolution rule — Wikidata trusted over AI when they disagree by >20% (changed 2026-03-26).
- **Added** Cache version v6 documentation with explanation of when/why to bump.
- **Added** Auth known fixes — clearHistory() on SIGNED_OUT, _layout.tsx account switch fix.
- **Added** Automated Pro grant monitor note under Monetisation — runs every 4 hours, auto-grants Pro to new tester signups.
- **Added** Tester Pro Grant Process section under Monetisation — documents that Pro grants only apply to existing profiles, that new sign-ups need a re-grant, and provides the exact SQL and REST API commands to run.
- **Changed** Last updated date from 2026-03-27 to 2026-03-31.

---

## 2026-03-30

### Backend

#### `backend/src/services/wikidataSpecs.ts` — Guard against zero weight from Wikidata
- **Fixed** DB Class 156 (and any future loco) showing "0 tonnes" for weight. Root cause: Wikidata's P2067 (mass) claim for the matched entity contained an amount of 0, which passed the `if (mass)` guard because the quantity object existed. `Math.abs(0)` = 0 formatted as "0 tonnes", which then won over AI's correct value via `wiki.weight ?? ai.weight`. Fixed by adding `mass.amount > 0` and `tonnes > 0` guards so zero-valued mass claims are skipped and treated as missing data.

#### `backend/src/services/vision.ts` — Loosen rejection criteria to reduce false not_a_train errors
- **Fixed** 17 Sentry events (13 iOS production users) where blurry, dark, or distant train photos were being rejected with "Could not identify a train." Root cause: the prompt told the AI to reject images that were "too unclear to identify," which the AI interpreted too conservatively. Changed to: only return `{"error": "not_a_train"}` if there is definitively no railway vehicle present. All partial, blurry, or distant shots now receive a best-effort low-confidence identification instead.

#### `backend/src/services/vision.ts` — Handle 429 rate limit errors with user-facing message
- **Fixed** HTTP 429 responses from Anthropic and OpenAI vision APIs bubbling up as a generic 500 "Could not connect" error. Both `identifyWithClaude` and `identifyWithOpenAI` now catch 429 explicitly and throw an `AppError` with message "LocoSnap is experiencing high demand. Please try again in a moment." and correct 429 status code, which surfaces correctly to the user via the existing axios error handler.

#### `backend/src/services/trainSpecs.ts` — Post-merge corrections for known Wikidata data quality errors
- **Fixed** BR 462 showing builder as "Crewe Works" instead of Siemens. Root cause: Wikidata was matching a wrong entity for this class and returning a UK builder. Added post-merge corrections map (`WIKIDATA_CORRECTIONS`) applied after every Wikidata+AI merge (and on the AI-only path) to force correct values where Wikidata is demonstrably wrong.
- **Fixed** DB Class 642 showing wrong builder. Correction: Siemens (Desiro Classic).
- **Fixed** DB Class 114 showing incorrect maxSpeed. Correction: 160 km/h.
- **Added** `applyKnownCorrections()` function — takes the merged specs and overrides specific fields for specific classes. Covers all class name variants (e.g. "br 114", "class 114", "db class 114"). Pattern is reusable for future Wikidata quality issues.

#### `backend/src/services/trainSpecs.ts` — Hardcode DB Class 156 specs in AI prompt
- **Fixed** DB Class 156 returning null for maxSpeed, power, and fuelType. Root cause: no pinned entry in the SPECS_PROMPT meant Claude was not confident enough about this East German Bo'Bo' loco and returned null rather than guessing. Added hardcoded entry: `maxSpeed "120 km/h"`, `power "6,360 kW"`, `weight "123 tonnes"`, `length "19.6 m"`, `builder "LEW Hennigsdorf"`, `numberBuilt 186`, `fuelType "Electric (15kV 16.7Hz AC)"`, `status "Withdrawn"`. Follows the same pattern as the ICE 3 family pinned entries.

#### `backend/src/services/vision.ts` — Switch to Claude Vision and fix ICE 4 (BR 412) identification
- **Fixed** ICE 4 (BR 412) being consistently misidentified as BR 407 by GPT-4o Vision. Root cause: GPT-4o has a strong prior toward the more common BR 407 (Velaro D) and could not be corrected through prompt changes alone. Fix: set `ANTHROPIC_API_KEY` on Render to switch the vision provider from GPT-4o to Claude Vision (Anthropic), which correctly identifies BR 412 from the nose profile.
- **Fixed** Generic "ICE 3" being returned as the class value instead of a specific BR number. Added a CRITICAL PRE-FLIGHT CHECK at the very top of the prompt (before all other rules) explicitly banning "ICE 3" as a class return value and requiring one of: BR 403, BR 406, BR 407, BR 408, or BR 412.
- **Added** Statistical tiebreaker for BR 412 vs BR 407: BR 412 has ~108 units in service vs BR 407's 17 — model now defaults to BR 412 at any major German terminus unless the Velaro D crease lines and pointed nose are clearly visible.
- **Added** Sharp horizontal chin edge as the primary visual discriminator for BR 412 — the squared-off lower cab front with a red band is distinctive and differs from the smooth-tapering BR 407 cab.
- **Added** ICE 4 disambiguation rules to the disambiguation section covering: wider/upright nose, flatter cab front, fleet numbers starting with "412", max speed 250 km/h not 300/320 km/h.

#### `backend/src/services/trainSpecs.ts` — Additional BR 412 class string variants in corrections map
- **Added** Six additional key variants to `WIKIDATA_CORRECTIONS` for BR 412: "br412", "ice4", "412", "ice 4 (br 412)", "br 412 (ice 4)" — ensures the 250 km/h maxSpeed correction and Siemens Mobility builder always apply regardless of how the vision model formats the class string.

#### `backend/src/services/trainCache.ts` — Bump cache version to v6
- **Changed** `CACHE_VERSION` from `"v5"` to `"v6"` to orphan all stale Redis entries from earlier in this session (which cached incorrect "ice 3::db" data with wrong specs). All cache keys now use `v6::` prefix; old v5 entries are ignored and will be recomputed on next scan.

### Frontend

#### `frontend/app/(tabs)/index.tsx` — Gallery toggle button in camera view
- **Added** Gallery icon button (`images-outline`) in the camera controls row, replacing the empty placeholder `View` on the right side of the shutter button. Tapping it calls `setCameraMode(false)` then `pickImage()` — closes the camera and opens the photo library picker directly without requiring the user to exit the app. Fixes friction reported by Android tester (locosnapwerbung).

#### `frontend/app/language-picker.tsx` — First-launch language selection screen (new file)
- **Added** Full-screen language picker shown once on first launch before any language is set. Displays the app icon (`assets/icon.png`), hardcoded English title "Choose your language", and hardcoded English subtitle "Select the language for the app" — these are intentionally not translated since i18n is not yet initialised at this point.
- **Added** Two `TouchableOpacity` buttons: "English" and "Deutsch". Each calls `setLanguage(lang)`, `i18n.changeLanguage(lang)`, and `markLanguageChosen()` in sequence, then uses `router.replace("/(tabs)")` to navigate to the main app. `replace` (not `push`) prevents the user from navigating back to this screen after selecting a language.
- **Added** Uses `colors.accent` (`#00D4AA`) as the primary button fill, matching the scanner aesthetic of existing screens. Secondary button (Deutsch) is transparent with an accent-coloured border and label.

#### `frontend/__tests__/languagePicker.test.tsx` — Language picker store interaction tests (new file)
- **Added** Three tests covering the store contracts the language picker screen depends on: (1) both `"en"` and `"de"` are present in `SUPPORTED_LANGUAGES`; (2) selecting English calls `setLanguage("en")`, updates `language` state to `"en"`, calls `i18n.changeLanguage("en")`, and sets `languageChosen` to `true` via `markLanguageChosen()`; (3) same assertions for `"de"`. Tests are pure store logic — no React Native rendering required.

#### `frontend/jest.config.js` — Extend test match to include .tsx test files
- **Changed** `testMatch` array: added `"**/__tests__/**/*.test.tsx"` alongside the existing `"**/__tests__/**/*.test.ts"` pattern. Required to pick up `languagePicker.test.tsx` and any future component-adjacent logic tests written in TSX.

#### `frontend/app/(tabs)/profile.tsx` — Add language toggle row to profile screen
- **Added** `useSettingsStore` and `i18n` imports.
- **Added** `language` and `setLanguage` destructured from `useSettingsStore()` inside the component.
- **Added** `handleLanguageToggle` — computes `next` as the opposite of the current language (`en` -> `de`, `de` -> `en`), then awaits `setLanguage(next)` and `i18n.changeLanguage(next)` so the UI rerenders with the correct language immediately.
- **Added** Language toggle row as a `TouchableOpacity` using the existing `infoRow` style, placed immediately after the "Best Streak" row. Displays a `language-outline` Ionicon, the `t("profile.language")` label, the current language name ("English" or "Deutsch"), and a `chevron-forward` affordance. Visual style is identical to adjacent info rows.

#### `frontend/services/api.ts` — Pass current language to backend on every identify request
- **Added** `useSettingsStore` import from `../store/settingsStore`.
- **Changed** `identifyTrainWeb`: reads `useSettingsStore.getState().language` (store accessed via `getState()` — not a hook, safe in a service) and appends it as `"language"` to the `FormData` before the `fetch` call.
- **Changed** `identifyTrainNative`: same — reads `useSettingsStore.getState().language` and appends `"language"` to the `FormData` before `api.post`. Backend can now use this field to return facts and specs in the user's chosen language.

#### `frontend/__tests__/languageSelector.test.ts` — Tests for profile screen language toggle logic (new file)
- **Added** Four tests: toggle from `en` to `de` updates store state; toggle from `de` to `en` updates store state; `i18n.changeLanguage` is called with the new code on toggle; display label returns "English" for `en` and "Deutsch" for `de`.

#### `frontend/__tests__/services/api.test.ts` — Add settingsStore mock and language field assertion
- **Added** `jest.mock("../../store/settingsStore", ...)` — mocks `useSettingsStore.getState()` to return `{ language: "en" }` by default, preventing the real store's AsyncStorage and expo-localization deps from running in Jest.
- **Added** Test "includes language field from settingsStore in the request body" — overrides the mock to `{ language: "de" }`, calls `identifyTrain`, and asserts `formData.get("language") === "de"`.

### Infrastructure

#### Render — ANTHROPIC_API_KEY environment variable
- **Added** `ANTHROPIC_API_KEY` to Render environment variables for the locosnap backend service. Backend now uses Claude Vision (Anthropic) as the primary vision provider instead of GPT-4o (OpenAI). OpenAI key retained as fallback. Health endpoint now reports `"visionProvider": "Claude Vision (Anthropic)"`.

#### Render — backend language support deployed
- **Deployed** backend commits `aff40d8` and `bbf4195` to Render via `git push origin main`. Backend now accepts `language` field on `/api/identify`, returns AI-generated facts, specs, and rarity descriptions in German when `language === "de"`. Cache version bumped to v7 as part of this deploy, invalidating all v6 entries.

---

Additional frontend and backend changes from language picker feature (v1.0.8):

### Frontend (language picker infrastructure)

#### `frontend/store/settingsStore.ts` — Create language preference store (new file)
- **Added** Zustand store (`useSettingsStore`) managing `language: AppLanguage`, `languageChosen: boolean`, `isLoading: boolean`. Exported type `AppLanguage = "en" | "de"` and constant `SUPPORTED_LANGUAGES: AppLanguage[] = ["en", "de"]`.
- **Added** `initialize()` — reads stored language from AsyncStorage (`locosnap_language`), falls back to device locale (via `expo-localization`), defaults to `"en"` if no match. Sets `languageChosen` from `locosnap_language_chosen` key. Calls `i18n.changeLanguage()` with resolved language before committing state, so i18next is synchronised on every cold start.
- **Added** Guard at top of `initialize()`: `if (!get().isLoading) return` — prevents double-invocation in React StrictMode (development) from causing two concurrent async chains writing to AsyncStorage.
- **Added** `setLanguage(lang)` — writes to AsyncStorage, calls `i18n.changeLanguage(lang)`, updates Zustand state. UI language switches immediately.
- **Added** `markLanguageChosen()` — writes `"true"` to `locosnap_language_chosen` and sets `languageChosen: true`. Called after user selects a language on the picker screen so the gate is not shown again.

#### `frontend/i18n/index.ts` — Create i18next configuration (new file)
- **Added** i18next instance configured with `react-i18next`, loading EN and DE translation resources. Settings: `lng: "en"`, `fallbackLng: "en"`, `interpolation: { escapeValue: false }`, `compatibilityJSON: "v3"` (required to avoid console warnings in React Native with i18next v23+).
- **Added** `LANGUAGE_RESOURCES = { en, de }` export — gives non-component code access to raw locale JSON without importing the i18n instance.
- **Added** Side-effect import pattern: consumers import `"../i18n"` to initialise i18next once at module load.

#### `frontend/locales/en.json` — Create English translation file (new file)
- **Added** 80 translation keys across 11 namespaces: `tabs`, `scan`, `results`, `profile`, `history`, `leaderboard`, `auth`, `paywall`, `rarity`, `errors`, `languagePicker`. Covers all user-visible strings across main app screens. Plural forms use i18next v3 `_plural` suffix convention (e.g. `scan.trialBanner` / `scan.trialBanner_plural`, `scan.scanBadge` / `scan.scanBadge_plural`). Interpolation variables use `{{variable}}` syntax (e.g. `scan.trialBanner` uses `{{remaining}}`).

#### `frontend/locales/de.json` — Create German translation file (new file)
- **Added** 80 matching German translation keys with identical structure to `en.json`. All umlauts verified: ä, ö, ü, Ä, Ö, Ü, ß. Key translation choices: "Scannen" (scan), "Sammlung" (collection/history), "Bestenliste" (leaderboard), "Hochstgeschwindigkeit" (max speed), "Gebaute Einheiten" (units built), "Legendar" (legendary), "Gewohnlich" (common).

#### `frontend/app/_layout.tsx` — Add language picker gate before app stack
- **Added** `import "../i18n"` side-effect import to initialise i18next at root layout load time.
- **Added** `useSettingsStore` import; reads `languageChosen`, `isLoading` (aliased `settingsLoading`), and `initializeSettings` from the store.
- **Added** `useEffect(() => { initializeSettings(); }, [initializeSettings])` — calls store initialisation on mount, triggering AsyncStorage read and language resolution.
- **Added** Loading gate: while `settingsLoading` is true, renders a full-screen `View` with `backgroundColor: colors.background` (no spinner) to prevent FOUC while AsyncStorage resolves.
- **Added** Language picker gate: when `settingsLoading` is false and `languageChosen` is false, renders `<Redirect href="/language-picker" />`. This is the outermost conditional — executes before AuthGate and all other navigation logic.
- **Added** `language-picker` as a named `Stack.Screen` entry so Expo Router recognises the route.

#### `frontend/__tests__/layout.test.ts` — Tests for root layout language gate logic (new file)
- **Added** Three tests covering the three store-state conditions that drive layout behaviour: (1) store initialises with `isLoading: true` so a blank view is shown on first render; (2) after `initialize()` with no stored preference, `isLoading` becomes false and `languageChosen` remains false, which would trigger the `<Redirect>`; (3) after `initialize()` with `locosnap_language_chosen = "true"` in AsyncStorage, `languageChosen` becomes true and the redirect is bypassed.

#### `frontend/app/(tabs)/index.tsx` — Wire remaining scan screen keys to i18n
- **Changed** Scan progress label from `{SCAN_STAGES[scanStage]}` to `{t("scan.scanning")}` — SCAN_STAGES animation cycle retained for dot-count logic; only the visible text label uses the translation key.
- **Changed** "No train found" error string to `t("scan.noTrainFound")` — was hardcoded English fallback in `setScanError` call.
- **Changed** Camera permission denial Alert message body to `t("scan.cameraPermission")` — was hardcoded English Alert string.
- **Changed** Trial banner `t()` call to pass `{ count: remaining, remaining }` where `remaining` is a named local variable — `count` drives i18next v3 pluralisation (selecting `trialBanner` vs `trialBanner_plural`), `remaining` is the interpolated number. Previously passed the computed expression twice without a named variable.
- **Changed** Scan badge label from `` `${scansRemaining} scan${scansRemaining !== 1 ? "s" : ""}` `` to `t("scan.scanBadge", { count: scansRemaining })` — removes English-only pluralisation logic; i18next now handles singular/plural via `scanBadge` / `scanBadge_plural` keys.

#### `frontend/app/(tabs)/profile.tsx` — Additional i18n fixes and profile toggle cleanup
- **Changed** Level label from `{t("profile.level")} {levelInfo.index}` to `{t("profile.level", { number: levelInfo.index })}` with translation string updated to `"Level {{number}}"` — removes string concatenation outside `t()`, which breaks word order in non-English locales.
- **Changed** Rarity labels: replaced hardcoded `rarityLabels` map with `getRarityLabel(tier)` switch/case using static `t("rarity.*")` calls for all five tiers (common, uncommon, rare, epic, legendary). No dynamic key construction.
- **Fixed** Redundant `i18n.changeLanguage(next)` call removed from `handleLanguageToggle` — `setLanguage()` already calls `i18n.changeLanguage()` internally via settingsStore. Calling it twice caused two overlapping i18next language-change events on every toggle.

#### `frontend/app/results.tsx` — Additional i18n fixes
- **Changed** Rarity labels: replaced hardcoded `rarityLabels` map with `getRarityLabel(tier)` switch/case using `t("rarity.*")` calls — same pattern as profile.tsx.
- **Changed** Blueprint section title wired to `t("results.blueprint")` — was hardcoded "Blueprint Style" in the Pro style picker heading.

### Backend (language support — v1.0.8)

#### `backend/src/routes/identify.ts` — Accept and validate language parameter
- **Added** `VALID_LANGUAGES = ["en", "de"] as const` and derived `Language` type.
- **Added** Language extraction from `req.body.language` with validation: any value not in `VALID_LANGUAGES` (including missing, empty, or capitalised variants) defaults to `"en"` — never errors.
- **Changed** `language` forwarded to `getCachedTrainData`, `getTrainSpecs`, `getTrainFacts`, `classifyRarity`, `setCachedTrainData`, and `monitorBlueprintForCache` so language-specific AI content is cached and served per language.
- **Fixed** `monitorBlueprintForCache` missing `language` parameter — blueprints generated during a German-language scan were being stored under the English cache key, causing unnecessary regeneration on subsequent German scans of the same train.

#### `backend/src/services/trainFacts.ts` — Add German language instruction to facts prompt
- **Added** `language: string = "en"` parameter.
- **Added** When `language === "de"`: prepends `"Respond in German (Deutsch). Use formal register.\n\n"` as the very first line of the prompt, so the model's first instruction is the language directive. AI-generated facts and historical descriptions are now returned in German for German-language sessions.

#### `backend/src/services/trainSpecs.ts` — Add German language instruction to specs prompt
- **Added** `language: string = "en"` parameter.
- **Added** German instruction prepended when `language === "de"`. Technical spec values (numbers, units, speed, weight, length) remain in standard international format regardless of language — only narrative text fields like `status` and `route` change language.

#### `backend/src/services/rarity.ts` — Add German language instruction to rarity prompt
- **Added** `language: string = "en"` parameter.
- **Added** German instruction prepended when `language === "de"`. The `tier` field (enum value) stays in English; `description` and `reasoning` fields are returned in German.

#### `backend/src/services/trainCache.ts` — Cache v7 with language segment in key
- **Changed** `CACHE_VERSION` from `"v6"` to `"v7"` — invalidates all v6 cache entries. Required because v6 entries contain English-only AI content; v7 entries are language-specific.
- **Changed** Cache key format from `v6::{class}::{operator}` to `v7::{language}::{class}::{operator}` — EN and DE results for the same train are stored as separate entries, preventing German-session users from receiving cached English content.
- **Fixed** `getTopTrains()` key-split broken by the new language segment — was destructuring `[cls, operator] = key.split("::")` (indices 0 and 1), but indices 0 and 1 are now the version and language segments. Fixed to `[, , cls, operator] = key.split("::")` to skip the first two segments.

---

## 2026-03-29

### Frontend

#### `frontend/app/(tabs)/history.tsx` — Show train photo thumbnail in collection cards
- **Added** `Image` imported from `react-native`.
- **Changed** `HistoryCard` icon area: previously always rendered a `<Ionicons name="train" />` icon. Now conditionally renders `<Image source={{ uri: item.photoUri }} />` when `item.photoUri` is present, falling back to the train icon when no photo is available.
- **Added** `cardPhoto` style — `width: 48, height: 48, borderRadius: borderRadius.md` — fills the card icon slot exactly.
- **Added** `overflow: "hidden"` to `cardIcon` style so the photo thumbnail is clipped to the rounded corners.

#### `frontend/app/(tabs)/index.tsx` — Render cold start fix: disable scan buttons until backend is ready
- **Added** `isBackendReady` state (default `false`). Set to `true` when `healthCheck()` resolves or rejects on mount.
- **Changed** `healthCheck()` useEffect: previously called with no state tracking, so scan could be triggered before the backend was warm. Now resolves the `isBackendReady` flag on both success and failure (so a dead backend never permanently blocks the UI).
- **Added** "Connecting to server..." indicator (`warmingBox` / `warmingText` styles) shown above the action buttons while `!isBackendReady`.
- **Changed** Camera and Library buttons: `disabled` and `btnDisabled` opacity applied while `!isBackendReady || isScanning`. Prevents users from hitting a cold Render instance before the health check response arrives.
- **Added** `warmingBox`, `warmingText`, and `btnDisabled` styles.

#### `frontend/types/index.ts` — Add photoUri to HistoryItem
- **Added** `photoUri: string | null` field to `HistoryItem` interface. Previously the field was missing from the type despite photo URIs being stored in Supabase and tracked in Zustand state.

#### `frontend/services/supabase.ts` — Return photoUri from fetchSpots
- **Added** `photoUri: spot.photo_url || null` to the `HistoryItem` mapping in `fetchSpots`. `photo_url` was already being selected from Supabase but was not mapped to the returned object, so cloud-loaded history never had photos.

#### `frontend/store/trainStore.ts` — Wire photoUri through history lifecycle
- **Added** `photoUri: state.currentPhotoUri` to the initial `HistoryItem` in `saveToHistory`, so local saves include the capture URI immediately.
- **Changed** Post-cloud-upload history update: now includes `photoUri: photoUrl || h.photoUri` so the Supabase Storage URL replaces the local file URI once the upload completes.
- **Changed** `viewHistoryItem`: changed `currentPhotoUri: null` to `currentPhotoUri: item.photoUri || null`, so navigating to a history item restores the photo for display in results.

### Infrastructure

#### `EAS Build / TestFlight` — Build and submit v1.0.7 (build 33)
- **Added** iOS build 33 (v1.0.7) triggered after passing pre-build checklist: `transform: [{ translateX: -9999 }]` confirmed on `shareCard` style, `shareCardRef` confirmed on correct `<View>` with `collapsable={false}`, `handleShare`/`handleSave` confirmed targeting `shareCardRef`, `NSPhotoLibraryAddUsageDescription` and `expo-media-library` plugin confirmed in `app.json`, 39/39 tests passing, tsc clean except pre-existing `_layout.tsx TS2459`.
- **Added** Build submitted to TestFlight via `eas submit --platform ios --latest --non-interactive`. IPA: `https://expo.dev/artifacts/eas/4ThtAzq48Fq3i8n62jrvXB.ipa`.
- **Changed** ARCHITECTURE.md iOS version entry updated from 1.0.6 build 29 to 1.0.7 build 33.

---

## 2026-03-28

### Frontend

#### `frontend/app/card-reveal.tsx` — Add Share image and Save to Gallery for train card

- **Added** `shareCardRef` (`useRef<View>`) — dedicated capture target for `captureRef`. Points at a hidden static View, completely independent of all animation wrappers.
- **Added** Hidden off-screen ShareCard component: `position: absolute, left: -9999`, fixed 400x580px, `collapsable={false}`. Renders photo area, rarity badge, class name, operator, stats row (speed, power, surviving count), and LocoSnap watermark. Always rendered, never visible. Exists solely as the capture target.
- **Added** `handleSave` — calls `captureRef(shareCardRef)`, requests `MediaLibrary.WRITE` permission if not already granted, saves PNG to device library as `LocoSnap_[CLASS]_[OPERATOR].png`. Tracks `card_saved` event to PostHog.
- **Changed** `handleShare` — previously targeted the animated `cardRef` inside nested `Animated.View` layers, causing silent failure on device (white PNG or no image). Now targets `shareCardRef`. Saves capture to cache directory as `locosnap-[class]-[operator].png`. Shares via `expo-sharing`.
- **Changed** Share text — removed emoji (was firing fallback with train emoji). New format: `"Guess what I just spotted and added to my collection near [CITY]. Identified with LocoSnap."` (with location) or without city when unavailable. Class name, operator, and rarity deliberately excluded — card image is the hook.
- **Added** `locationName` state — resolved on mount via `Location.reverseGeocodeAsync()` with 2s timeout. Uses `place.city ?? place.district ?? place.region` as the city string. Falls back silently to null if geocoding fails or times out.
- **Added** `currentLocation` pulled from `useTrainStore` to supply `latitude`/`longitude` for reverse geocoding.
- **Added** `isSaving` and `isSharing` loading states — buttons show hourglass icon and 0.5 opacity while capture is in progress.
- **Changed** Action button row from two buttons ([Share] [Full Details]) to three ([Save] [Share] [Full Details]). Save uses `download-outline` icon. All three equal flex.
- **Added** 18 `shareCard*` styles to StyleSheet covering card layout, photo area, rarity badge, operator row, stats row, watermark, and label typography.
- **Added** Imports: `expo-media-library`, `expo-location`.

### Docs

#### `docs/plans/2026-03-28-shareable-card-design.md` — Design document for shareable card feature
- **Added** Design document covering: hidden static card approach, share text format, Save to Gallery behaviour, three-button action row layout, data flow diagram, success criteria.

#### `docs/plans/2026-03-28-shareable-card-implementation.md` — Implementation plan for shareable card feature
- **Added** 7-task implementation plan with TDD steps, exact file paths, commands, and expected test output for each task.

---

## 2026-03-27

### Docs

#### `docs/ARCHITECTURE.md` — Add Video Production Standards to Section 21
- **Added** Video Production Standards subsection under Social Media Strategy (Section 21) covering mandatory end screen elements, text overlay standards, and hook structure rules.
- **Added** Rule: every video end screen must include the app icon (`frontend/assets/icon-512.png`) above the LOCOSNAP wordmark — no exceptions. Root cause for rule: blueprint v1 and v2 shipped without the icon on the end screen.
- **Added** Rule: no time claims for blueprint generation in any video copy — the feature takes up to 60 seconds in the app. Prevents false advertising.
- **Added** Rule: frame 1 must always be a pattern interrupt (moving train or strongest visual asset) — never open on scan UI or app chrome. Based on drop-off data from today's Instagram ad (26 views) and consistent 0:02 drop-off pattern across Frankfurt and EU07 footage.

---

## 2026-03-26

### Frontend

#### `app/paywall.tsx` — Fix silent purchase failure when only one RevenueCat package returns
- **Fixed** Silent no-op on purchase attempt — `selectedIndex` was hardcoded to `1` (annual), so if RevenueCat returned only one package (e.g. during a network hiccup or phased rollout), `packages[1]` was `undefined` and `handlePurchase` returned without error or feedback.
- **Changed** `selectedIndex` initial state from `1` to `0`. After offerings load, `loadOfferings` now finds the annual package index dynamically (`findIndex` on `packageType === "ANNUAL"` or identifier containing `"annual"`) and sets `selectedIndex` to that value, or `0` if no annual package exists. Eliminates the hardcoded assumption that annual is always at index 1.

#### `app/paywall.tsx` — Pull blueprint credit price from RevenueCat instead of hardcoding
- **Fixed** Hardcoded `£0.99` credit price on the blueprint credit card — would display the wrong currency and amount for any non-GBP storefront (e.g. German users from Frankfurt ad campaign seeing £ instead of €).
- **Added** `creditPrice` state variable (`string | null`). `loadOfferings` now reads `offerings.all["blueprint_credits"]?.availablePackages?.[0]?.product.priceString` and stores it in state.
- **Changed** Credit card price display from static `£0.99` to `{creditPrice ?? "—"}` — shows the App Store / Play Store localised price once loaded, or a neutral dash if unavailable.

#### `app/paywall.tsx` — Fix "Unlimited daily scans" copy
- **Fixed** Feature label read "Unlimited daily scans" — the app has no daily reset mechanic, so "daily" was misleading. Changed to "Unlimited scans".

#### `app/paywall.tsx` — Remove "Exclusive card frames" from Pro features list
- **Removed** "Exclusive card frames" feature row from `PRO_FEATURES` — this feature has not been built and was falsely advertising a capability that does not exist. Removed to avoid misleading users on the paywall.

#### `app/(tabs)/profile.tsx` — Remove hardcoded £4.99/month from upgrade button
- **Fixed** Upgrade button subtitle showed "Unlimited scans + premium blueprints · £4.99/month" — hardcoded GBP price would display incorrectly for any non-GBP storefront. Root cause: same Frankfurt ad / German market exposure risk as the paywall credit price.
- **Changed** Subtitle to "Unlimited scans · Premium blueprints · All styles" — factual, currency-neutral, and consistent with the corrected paywall feature list.

### Backend

#### `src/services/trainSpecs.ts` — Fix maxSpeed taking wrong Wikidata value when it conflicts with AI
- **Fixed** DB Class 403 (ICE 3) showing 265 km/h instead of 300/330 km/h — root cause: Wikidata `maxSpeed` was unconditionally preferred over AI output. The Wikidata entity being matched for the Class 403 contained a stale or variant-specific speed figure (265 km/h) that the "Wikidata wins" merge rule silently propagated into the response.
- **Added** `resolveMaxSpeed()` function in the merge block. Parses both Wikidata and AI speed strings into km/h for comparison. If the two values differ by more than 20%, logs a `WARN` and uses the AI figure instead. If only one source has speed data, that source wins as before. Disagreement under 20% continues to prefer Wikidata.
- **Changed** `merged.maxSpeed` from `wiki.maxSpeed ?? ai.maxSpeed` to `resolveMaxSpeed()`.

---

## 2026-03-25

### Backend

#### `src/services/vision.ts` — Add 15 tester-reported misidentification fixes to vision prompt
- **Fixed** BR 480 vs BR 481 (S-Bahn Berlin): added rule distinguishing BR 480 (rounder front, single-piece windscreen) from the far more numerous BR 481 (flatter angular front, split windscreen). BR 481 is now the default when windscreen detail is ambiguous.
- **Fixed** BR 445 Twindexx vs Bombardier Talent 2: added explicit double-deck (Twindexx) vs single-deck curved-nose (Talent 2) rule. A double-deck train can never be a Talent 2.
- **Fixed** CD 380 (Škoda 109E) vs ČD Class 151: modern angular Škoda loco on Czech Railways = CD 380; boxy 1970s Soviet-era body = Class 151.
- **Fixed** CD 654 (RegioPanter) vs Stadler FLIRT: Škoda cab face = CD 654; Leo Express branding = FLIRT. Never conflate these.
- **Fixed** ICE T (BR 411 / BR 415) vs ICE 3: tilting train with bogie tilt fairings and bulbous nose = ICE T; non-tilting = ICE 3. BR 411 = 7-car, BR 415 = 5-car.
- **Fixed** ST 44 (M62 family, Poland/Czech/Hungary) vs Class 159 (UK DMU): completely different vehicles on different continents. Long-hood Soviet-era freight loco in Central/Eastern Europe = M62 family.
- **Fixed** VT 650 (Regio-Shuttle RS1) vs VT 628: compact modern low-floor single car = VT 650; boxy 1980s two-car set = VT 628.
- **Fixed** EL2 / EU06 family vs E 94: active Co'Co' freight electric in Poland/Czech Republic = EL2/EU06 family; E 94 is a WWII museum piece, not in regular freight service.
- **Fixed** BR 563 (Siemens Mireo) vs Alstom Coradia LINT 41: pantographs on roof = cannot be LINT 41; no pantograph + Alstom cab = LINT 41.
- **Fixed** BR 462 (ICE 3neo / Velaro MS) vs BR 642 (Desiro Classic): number-reversal confusion. Full ICE high-speed train = BR 462; small regional DMU = BR 642.
- **Fixed** VT 646 Gen 1 (Talent 1) vs DB Class 648 (LINT 48): Talent 1 boxy cab face = VT 646; Alstom LINT cab = Class 648.
- **Fixed** BR 646 Gen 2 (Talent 2 variant) vs Alstom Coradia LINT 41: ODEG operator + Talent 2 curved nose = VT 646 / Talent 2, not LINT 41.
- **Fixed** LU A Stock vs 1972 Tube Stock: A Stock is sub-surface gauge (wider, Metropolitan/Hammersmith & City lines); 1972 Stock is tube gauge (narrower, Bakerloo/Northern lines).
- **Fixed** LU 1960 Tube Stock vs 1992 Tube Stock: 1992 Stock has modern flat-ended aluminium body with roof AC domes; 1960 Stock has older rounded pre-modern body shape.
- **Fixed** LU CO/CP Stock vs 1938 Tube Stock: CO/CP is sub-surface gauge (wider, Circle/Hammersmith); 1938 Stock is tube gauge (narrower), dark red with rounded 1938-style cab ends.

#### `src/services/vision.ts` — Add ICE 3 family disambiguation to vision prompt
- **Added** Explicit disambiguation block for the BR 403 / BR 406 / BR 407 / BR 408 ICE 3 family, matching the style of existing disambiguation entries (S-Bahn 480/485, Vectron variants, etc.). Root cause of the inconsistency: all four classes share the same white + red-stripe ICE livery and broadly similar nose profile, so without explicit guidance the model was freely cycling between "ICE 3", "BR 403", "BR 406", and "BR 407" on repeated scans of the same train.
- **Added** Route indicator rule: trains photographed at Amsterdam, Utrecht, Arnhem, or anywhere on the Amsterdam–Utrecht–Oberhausen–Cologne–Frankfurt corridor must be classified as BR 406. The BR 403 is single-voltage and does not operate into the Netherlands, so any ICE 3 at Utrecht Centraal is almost certainly a BR 406.
- **Added** Nose profile discriminator: 403/406 = rounder/softer classic ICE 3 nose; 407 = more angular with sharper crease lines and larger rectangular windscreen; 408 = sharpest and flattest, most modern LED headlight cluster.
- **Added** Fleet number rules: visible "406 xxx" or "4651–4667" (NS side numbers) confirm BR 406 definitively.
- **Added** Speed correction note: all ICE 3 variants have a 330 km/h theoretical max but 300 km/h operational max in regular DB service — instructs the model to use 300 km/h, preventing the incorrect 330 km/h figure from appearing in specs.
- **Added** Fallback rule: if 403 vs 406 is genuinely uncertain, output "BR 406/403" at lower confidence rather than defaulting to a generic label or the wrong class.

### Frontend

#### `store/authStore.ts` — Fix train history not cleared on auth-listener sign-out
- **Fixed** Cross-account collection contamination — when a genuine sign-out was detected via `onAuthStateChange` (e.g. token refresh failure, session expiry, or remote sign-out from another device), the handler only called `set({ profile: null })`, leaving the previous user's scans in Zustand memory. The explicit `signOut()` action already cleared trainStore, but any sign-out that bypassed that action (all non-explicit paths) did not.
- **Changed** Both branches of the `SIGNED_OUT` recovery path (recovery succeeded but session null, and recovery threw an error) now call `set({ session: null, user: null, profile: null })` followed by `useTrainStore.getState().clearHistory()`. Uses the same dynamic `require` pattern already present in `signOut()` to avoid the circular import between authStore and trainStore.

#### `app/_layout.tsx` — Clear stale history when switching between accounts
- **Fixed** Account B seeing Account A's local scans after a sign-in switch — root cause: the `user?.id` effect called `loadHistory()` on any new user ID; if Account B had zero cloud spots, `loadHistory()` fell through to AsyncStorage which still contained Account A's local backup written during their session.
- **Changed** `clearHistory` is now also subscribed from `useTrainStore` in `RootLayout`. When `user?.id` changes and `prevId` is not null (i.e. switching accounts, not a cold app start with no prior user), `clearHistory()` is awaited before `loadHistory()` is called. Cold-start behaviour (prevId is null → first sign-in) is unchanged and does not clear history first.

#### `app/card-reveal.tsx` — Fix fatal mixed animation driver crash on card reveal
- **Fixed** React Native fatal error caused by `glowAnim` (JS driver, `useNativeDriver: false`) and `flipAnim` (native driver, `useNativeDriver: true`) being applied to the same `Animated.View` node. RN cannot reconcile mixed driver types on a single view and throws at runtime.
- **Changed** View wrapping structure for both the front and back card faces — previously each face was an outer `Animated.View` (glow: JS driver) wrapping an inner `Animated.View` (flip transform + opacity: native driver), which still placed both driver types in a parent-child relationship on the same rendered node path. Now restructured to: outer `Animated.View` carries only the flip transform and opacity (`rotateY`, native driver); inner `Animated.View` carries only the glow shadow props (`shadowRadius`, `shadowOpacity`, JS driver); innermost card content is a plain `View` with no animation driver.
- **Changed** `styles.cardGlowWrapper` — removed `shadowOffset` and `elevation` from the stylesheet entry (they moved to the inner glow `Animated.View`'s inline style) since the outer wrapper no longer owns shadow props.
- **Note** No animation values, timing, sequences, or visual output were changed — only the JSX wrapper structure.

---

## 2026-03-24

### Backend

#### `package.json` — Switch Redis client from ioredis to @upstash/redis
- **Removed** `ioredis` and `@types/ioredis` — ioredis uses TCP on port 6379, which is blocked by Render's free-tier firewall. This was silently causing every Redis connection attempt to time out (`connect ETIMEDOUT`), causing the server to fall back to in-memory storage with misleading `[REDIS] connected` log output.
- **Added** `@upstash/redis` — Upstash REST client uses HTTPS on port 443, which is not blocked. This is the officially recommended client for Render free tier + Upstash.

#### `src/services/redis.ts` — Rewrite from ioredis TCP to @upstash/redis REST
- **Changed** `initRedis()` — was creating an `ioredis` client with `REDIS_URL`; now creates an `@upstash/redis` `Redis` instance with `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. REST client is stateless (no persistent TCP connection), so `disconnectRedis()` simply nulls the reference.
- **Fixed** Root cause of Upstash showing 0 commands processed — all commands were timing out before reaching Upstash because Render free tier blocks outbound TCP/6379. Switching to REST/HTTPS means commands now reach Upstash and the 30-day train data cache is actually used (~84% AI cost saving on repeat scans).
- **Changed** Connection detection in `initRedis()` — now checks `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (both required); falls back to in-memory if either is missing.

#### `src/config/env.ts` — Update Redis env var names
- **Changed** Redis config block — was reading `UPSTASH_REDIS_REST_URL` (already correct) but the `hasRedis` getter was checking the old combined field. Updated `upstashRedisRestUrl` and `upstashRedisRestToken` to match new env var names, with a comment explaining why REST is used over TCP.

#### `.env.example` — Update Redis env var documentation
- **Changed** Redis section — replaced `REDIS_URL` with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, with a comment explaining the REST vs TCP distinction and where to find the values in the Upstash console.

### Infrastructure

#### `render.yaml` — Replace REDIS_URL with Upstash REST vars
- **Changed** `REDIS_URL` env var entry replaced with two entries: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (both `sync: false`, set in Render dashboard)

#### Render dashboard — Update Redis environment variables
- **Removed** `REDIS_URL` — old TCP-based var, no longer used
- **Added** `UPSTASH_REDIS_REST_URL` = `https://innocent-pup-44610.upstash.io`
- **Added** `UPSTASH_REDIS_REST_TOKEN` = Upstash REST token (from Upstash console → Connect → REST tab)
- **Deployed** Render re-deployed the service with the new vars; backend will now initialise with a live Upstash REST connection instead of falling back to in-memory

#### `docs/ARCHITECTURE.md` — Redact exposed Sentry token
- **Fixed** Sentry auth token `sntryu_e89687...` was committed in plain text in section 11 (Sentry Source Maps). Replaced with `sntryu_****` placeholder. GitHub push protection blocked the push until the secret was unblocked via the GitHub secret scanning UI.
- **Note** The exposed token should be revoked in Sentry → User Settings → Auth Tokens and a new one generated, then added to EAS secrets as `SENTRY_AUTH_TOKEN`.

#### `docs/ARCHITECTURE.md` — iOS testers section reformatted
- **Changed** iOS TestFlight Testers section — reformatted to match Android tester list style (bullet email list + email format note). Added `rheintalbahnerneo@gmail.com` (@Rheintalbahner_Neo) as first confirmed iOS tester. Removed duplicate pending item from section 20.

### Frontend (session 4 — evening)

#### `store/authStore.ts` — Fix magic link redirect on Android
- **Fixed** Magic link sign-in showing a white page with one line of code on Android — root cause was missing `emailRedirectTo` in `signInWithOtp`. Supabase was falling back to the Site URL (`exp://localhost:8081`) which doesn't exist in production, causing the browser to show a raw error page instead of returning the user to the app.
- **Added** `emailRedirectTo: "locosnap://auth/callback"` in the `signInWithMagicLink` options — Supabase now explicitly redirects to the app's custom URL scheme after link click.

#### `app/_layout.tsx` — Handle deep link auth callbacks
- **Added** `expo-linking` import and `supabase` import
- **Added** `useEffect` in `RootLayout` that listens for incoming deep links to `locosnap://auth/callback`
- **Added** Implicit flow handler — extracts `access_token` + `refresh_token` from URL hash and calls `supabase.auth.setSession()`. Used when Supabase is configured for implicit flow.
- **Added** PKCE flow handler — extracts `code` from query params and calls `supabase.auth.exchangeCodeForSession()`. Used when Supabase is configured for PKCE.
- **Added** `Linking.getInitialURL()` check for app opened from cold state via deep link
- **Added** `Linking.addEventListener("url", ...)` for deep links received while app is already running
- **Fixed** Without this handler, `setSession()` was never called on magic link return, leaving the user on a blank screen with no auth state set even if the redirect URL was correct.

### Infrastructure (session 4 — evening)

#### Supabase dashboard — URL Configuration
- **Changed** Site URL from `exp://localhost:8081` (dev default) to `https://locosnap.app` — the old value was the fallback Supabase used when no `emailRedirectTo` was specified, causing production magic links to redirect nowhere useful.

### Backend (session 3)

#### `src/services/vision.ts` — Alstom Coradia family vs Stadler FLIRT disambiguation
- **Fixed** Misidentification of Alstom Coradia variants (incl. Coradia Polyvalent / Regio 2N / X'Trapolis) as Stadler FLIRT — reported by tester on RailUK forum, where an Alstom Astride loco was returned as "Stadler FLIRT EMU, built by Bombardier Transportation, Budapest Metro" (three simultaneous errors: wrong class, wrong manufacturer, wrong country/operator)
- **Added** Detailed disambiguation rule covering the full Alstom Coradia family vs Stadler FLIRT. Key rules: (1) FLIRT is Stadler-only — never Bombardier or Alstom; (2) double-deck trains are never FLIRTs; (3) Budapest Metro uses Alstom Metropolis, not mainline FLIRTs; (4) Alstom cab noses are rounder vs the FLIRT's distinctive forward-angled slanted windscreen; (5) if uncertain on a single-deck EMU, use cab nose profile to distinguish

#### `src/services/trainFacts.ts` — Eliminate hallucinated nicknames and tighten accuracy rules
- **Fixed** "AI slop" in fun facts — model was inventing plausible-sounding nicknames when none were known (e.g. HST described as "speed record holders" — a hallucinated nickname not used by any spotter, flagged immediately by the RailUK community). Root cause: prompt instructed the model to "include nicknames" with no guardrail against invention.
- **Changed** `funFacts` instruction — removed open invitation to include nicknames; replaced with explicit rule: only include nicknames that are genuinely well-known and documented within the rail community, with examples given (Deltic, Shed, Thunderbird, Granny, Bones). Added hard rule: "A missing nickname is far better than a hallucinated one."
- **Changed** `notableEvents` instruction — tightened from "real, verifiable events only" to "if you cannot recall a specific verifiable event, return fewer items or an empty array rather than fabricating plausible-sounding events"
- **Added** Overarching accuracy mandate at end of prompt: explicit instruction to use cautious language ("reportedly", "approximately") or omit details when uncertain, rather than stating guesses confidently

### Backend (session 2)

#### `src/services/vision.ts` — LINT 27 vs Class 445 KISS/Twindex disambiguation
- **Fixed** Misidentification of Class 445 KISS (Stadler double-deck EMU) as LINT 27 (Alstom Coradia single-car diesel DMU) — reported by tester @Rheintalbahner_Neo
- **Added** Explicit disambiguation rule covering all three Class 445 variants: KISS (self-propelled double-deck EMU, pantographs on roof, multi-car, main-line routes), Twindex/Twindexx IC2 (double-deck push-pull set with separate loco and flat-fronted control car), and LINT 27 (single-deck diesel DMU, no pantograph, short, branch-line use). Key visual tells: KISS/Twindex are double-deck with pantographs; LINT 27 is single-deck diesel. The two are completely different size classes — a KISS towers over a LINT.

---

## 2026-03-23

### Frontend

#### `app/card-reveal.tsx` — Fix card flip crash on Android + clean up animation drivers
- **Fixed** App force-close on Android when tapping the card to flip it — root cause: `{ perspective: 1000 }` was included in the same animated `transform` array as `rotateY` with `useNativeDriver: true`. Android's native animation driver does not support `perspective` as a transform property; including it causes a native thread crash that bypasses Sentry entirely.
- **Fixed** Latent iOS crash — `backfaceVisibility: "hidden"` in `styles.card` is incompatible with `useNativeDriver: true` on iOS and crashes the native rendering thread at the 90° rotation point. Removed; the existing `opacity` interpolation (`frontOpacity`/`backOpacity`) already correctly hides the inactive face and is the proper substitute.
- **Changed** `{ perspective: 1000 }` moved from the animated card `transform` arrays to a static `transform` on `cardTouchable` — preserves the 3D depth effect safely without involving the native driver.
- **Fixed** Mixed animation driver instability — `glowAnim` (`useNativeDriver: false`, drives `shadowRadius`/`shadowOpacity`) and `flipAnim` (`useNativeDriver: true`, drives `rotateY`/`opacity`) were both applied to the same `Animated.View` nodes. React Native requires a single driver per animated node; mixed drivers can produce warnings and crashes on Fabric/New Architecture. Fixed by introducing a `cardGlowWrapper` `Animated.View` for each face that owns the glow shadow (JS driver), with the inner card `Animated.View` handling only the flip (native driver).
- **Removed** `shimmerAnim` — `Animated.Value` was declared and looped indefinitely on every card reveal but was never consumed by any element in the render tree. Removed the declaration and the loop to eliminate the wasted CPU and animation thread overhead.
- **Changed** `styles.card` — removed `position: "absolute"`, `shadowOffset`, and `elevation` (moved to new `styles.cardGlowWrapper`). Card no longer needs absolute positioning as it fills its wrapper.
- **Added** `styles.cardGlowWrapper` — absolutely-positioned container matching card dimensions; owns `shadowOffset` and `elevation` (static) plus the animated glow shadow properties (JS driver).

---

## 2026-03-22 (session 4)

### Frontend

#### `services/analytics.ts` — Added captureWarning for expected user-facing failures
- **Added** `captureWarning(message, context?)` — calls `Sentry.captureMessage()` at `"warning"` severity instead of `captureException`. Warning-level messages appear in Sentry's data but do not trigger high-priority alert rules.
- **Why** Identification failures ("Could not identify a train") are expected product behaviour — unclear photo, non-train subject, depot obstruction. Routing them through `captureException` was creating high-priority Sentry issues for normal user flow outcomes, generating alert noise.

#### `app/(tabs)/index.tsx` — Route identification failures to captureWarning
- **Changed** `handleScan` catch block — was calling `captureError()` (→ `captureException`) for all errors
- **Changed** Now checks error message prefix: `"Could not identify"` → `captureWarning`; all other errors (network timeout, server fault, unexpected exception) → `captureError` as before
- **Added** Import of `captureWarning` from analytics
- **Fixed** Sentry alert noise — "Could not identify" errors will no longer trigger high-priority notifications. Real crashes and network failures still alert correctly.

---

## 2026-03-22 (session 3)

### Frontend

#### `plugins/withSentryDisableUpload.js` — New custom Expo config plugin (created)
- **Added** Custom Expo config plugin that injects `SENTRY_DISABLE_AUTO_UPLOAD=true` directly into all Xcode build configurations as an Xcode build setting
- **Fixed** EAS builds #1–3 failing with sentry-cli "An organization ID or slug is required" error
- **Root cause** EAS Build passes env vars from `eas.json` to the macOS shell, but fastlane (which EAS uses to run Xcode) does not propagate all shell env vars into Xcode build phase scripts. The `sentry-xcode.sh` and `sentry-xcode-debug-files.sh` scripts check `$SENTRY_DISABLE_AUTO_UPLOAD` but never see it. Xcode build settings ARE visible to all run-script build phases regardless of how Xcode was invoked — so setting it as a build setting is the reliable fix.
- DSN-based crash reporting at runtime is unaffected — this only disables the CI-time source map upload step

#### `app.json` — Sentry disable plugin registered
- **Added** `"./plugins/withSentryDisableUpload"` to the `plugins` array immediately after `"@sentry/react-native"`
- Plugin runs at Expo prebuild time, modifying the generated Xcode project before EAS compiles it

### Backend

#### `services/vision.ts` — Depot and preserved loco identification improved
- **Added** Explicit instruction to never return `{"error": "not_a_train"}` solely because foreground objects (barriers, fencing, other rolling stock) obscure part of the locomotive — depot and shed scenes routinely have this
- **Added** Class 24 vs Class 25 disambiguation: both are BR Sulzer Type 2 Bo-Bo diesels, commonly preserved, frequently photographed in depot conditions. Class 24 (1958–60, shorter hood, round marker lights set into nose). Class 25 (1961–67, more numerous, subtle grille and nose profile differences). Instructs the model to accept lower confidence rather than returning `not_a_train`
- **Added** Guidance that heavily weathered, dirty, partially repainted, or unnumbered preserved locos are still identifiable from cab shape, roof profile, bogie type, and bodyside panel shape
- **Fixed** Two tester photos (BR-era locos at a depot with barriers in foreground) returning "Could not identify a train" — model was refusing to attempt ID due to foreground obstruction

### Infrastructure

#### EAS Build #3 (build number 26) — succeeded and submitted
- **Fixed** Sentry source map upload block — build succeeded with `SENTRY_DISABLE_AUTO_UPLOAD=true` in eas.json env (env var propagated on this attempt)
- **Submitted** v1.0.4 build 26 to Apple App Store Connect via `eas submit --id 963b738e-8e44-48de-80af-64cc53f4e20a`
- **Status** Processed by Apple and available in TestFlight

#### EAS Build #4 (build number 27) — succeeded (Sentry plugin fix)
- Includes `withSentryDisableUpload` plugin — future builds will not rely on env var propagation through fastlane
- Build URL: `https://expo.dev/accounts/stephenlear1/projects/locosnap/builds/04ef6865-db26-4f42-bdd7-0d892eedd7a3`

---

## 2026-03-22 (continued)

### Backend

#### `services/vision.ts` — Class 33 vs Class 73 disambiguation added to vision prompt
- **Fixed** Misidentification of Class 33 as Class 73 (confirmed user report with depot photo)
- **Added** Explicit disambiguation rule: Class 33 = rounded "Crompton" nose, prominent lower-bodyside louvres, pure diesel, no third-rail shoes. Class 73 = flatter rectangular cab, electro-diesel (third-rail shoes may be visible). Both are BR Blue Bo-Bo Southern Region locos — the key visual tell is the nose shape (rounded = 33, flat = 73)
- Follows the same pattern as existing Czech DMU and Vectron disambiguation rules

---

## 2026-03-22

### Frontend

#### `store/authStore.ts` — Guest mode removed, scan-first model
- **Removed** `isGuest` state, `continueAsGuest()`, and `clearGuest()` actions entirely
- **Added** `preSignupScansUsed: number` — tracks unauthenticated trial scans in AsyncStorage (`locosnap_presignup_scans`)
- **Added** `incrementPreSignupScans()` — increments and persists trial scan counter
- **Added** `PRE_SIGNUP_FREE_SCANS = 3` (exported) — trial scan allowance before sign-up required
- **Added** `MAX_MONTHLY_SCANS = 10` (exported) — monthly free scan limit after sign-up
- **Changed** `canScan()` — unauthenticated users get 3 trial scans; free users get 10/month; Pro unlimited
- **Changed** Monthly scan reset logic — was checking `toDateString()` (daily), now checks `getMonth()` + `getFullYear()` (monthly)
- **Changed** `MAX_DAILY_SCANS = 5` removed — replaced by monthly model
- **Added** `AsyncStorage` import for trial scan persistence
- **Fixed** Guest loophole — `canScan()` previously returned `true` unconditionally for all guest users (unlimited free scans)

#### `app/(tabs)/index.tsx` — Scan gate + trial banner
- **Removed** local `MAX_DAILY_SCANS = 5` constant (was duplicated from authStore)
- **Removed** guest badge UI — replaced with trial banner
- **Added** Trial banner for unauthenticated users showing scans remaining
- **Changed** `handleScan()` limit alert — now shows different messages for unauthenticated (trial exhausted → "Create Free Account") vs authenticated free users (monthly limit → "Upgrade to Pro")
- **Added** `incrementPreSignupScans()` called after every successful scan when not signed in
- **Imports** `PRE_SIGNUP_FREE_SCANS`, `MAX_MONTHLY_SCANS` from authStore

#### `app/_layout.tsx` — Auth gate relaxed
- **Changed** `AuthGate` no longer redirects unauthenticated users to `/sign-in` on app open
- Unauthenticated users can now access all tabs — scan gate in `index.tsx` handles the limit
- Sign-in redirect only triggers if user is already authenticated and somehow lands on `/sign-in`
- **Removed** `isGuest` from AuthGate state subscription

#### `app/sign-in.tsx` — Guest option removed
- **Removed** "Continue as Guest" button
- **Removed** `continueAsGuest` import from authStore
- **Removed** `handleGuest()` function
- **Changed** Footer note — now reads "Free account • 10 scans per month • Save your collection • Appear on leaderboard"

#### `store/trainStore.ts` — History cap raised
- **Changed** `MAX_HISTORY` from `50` → `200`
- Fixes issue where Czech tester hit the 50-scan cap and saw oldest entries disappearing

#### `app/(tabs)/profile.tsx` — isGuest cleanup
- **Removed** `isGuest` from `useAuthStore()` destructuring
- **Changed** `isGuest` checks → `user` / `!user` checks throughout
- **Changed** "Not signed in" email fallback → empty string (user is either signed in or not)
- **Changed** Sign-in prompt copy — "Create your free account" with updated benefit line
- **Removed** `useAuthStore.getState().clearGuest()` call — no longer needed

#### `app/(tabs)/leaderboard.tsx` — isGuest cleanup
- **Changed** `isGuest` → `!user` for the sign-in prompt gate

#### `app/blueprint.tsx` — isGuest cleanup
- **Changed** `isGuest` → `user` in Pro gate check (shows Pro upsell only to authenticated non-Pro users)

#### `app/results.tsx` — isGuest cleanup
- **Changed** `!isGuest && credits > 0` → `user && credits > 0` for credit-purchase blueprint flow

#### `app/paywall.tsx` — isGuest cleanup
- **Removed** `isGuest` from `useAuthStore()` destructuring (was unused in logic)

---

### Backend

#### `services/trainCache.ts` — Redis persistence (replaces filesystem)
- **Rewrote** entire file — removed all `fs` imports, `CACHE_FILE`, `CACHE_DIR`, `loadCache()`, `saveCache()`
- **Added** L1/L2 cache pattern: in-memory `Map` (L1) + Upstash Redis via `redis.ts` (L2)
- **Made async** `getCachedTrainData()`, `setCachedTrainData()`, `setCachedBlueprint()`
- **Added** lazy-load: on L1 miss, fetches from Redis and populates L1
- **Added** multi-style blueprint support via `blueprintUrls: Record<string, string>`
- Fixes cache being wiped on every Render.com deploy (ephemeral filesystem)

#### `services/redis.ts` — Train cache functions
- **Added** `setTrainCache(key, data)` — writes to Redis with 30-day TTL, falls back to in-memory
- **Added** `getTrainCache(key)` — reads from Redis, falls back to in-memory
- Prefix: `traindata:` to namespace train cache keys separately from blueprint task keys

#### `routes/identify.ts` — Async cache calls
- **Changed** `getCachedTrainData()` call to `await` (now async)
- **Changed** `setCachedTrainData()` to fire-and-forget with `.catch()` error handling

#### `index.ts` — Removed loadCache
- **Removed** `loadCache` import and `loadCache()` call at startup (no longer needed — cache lazy-loads from Redis)

---

### Infrastructure

#### `frontend/.env` — Sentry DSN added
- **Added** `EXPO_PUBLIC_SENTRY_DSN` — was missing, Sentry was silently disabled in development

#### `frontend/eas.json` — Sentry configuration fixed
- **Production profile**: removed `SENTRY_DISABLE_AUTO_UPLOAD: true` (was blocking crash uploads), added `EXPO_PUBLIC_SENTRY_DSN`
- **Preview profile**: kept `SENTRY_DISABLE_AUTO_UPLOAD: true` (correct — no source maps needed for internal builds), added `EXPO_PUBLIC_SENTRY_DSN`

#### Render.com — Backend Sentry DSN
- **Added** `SENTRY_DSN` environment variable in Render dashboard — triggered immediate redeploy

#### `docs/ARCHITECTURE.md` — Updated to reflect all 2026-03-22 changes
- Auth section: Guest Mode marked Removed
- Section 6: Redis expanded to cover train data cache + L1/L2 architecture
- Section 7: Scan limits table added, guest loophole bug documented
- Section 11: Sentry activation documented
- New Section 17: User flow (scan-first) documented
- Section 18: Data flow updated
- Section 19: Pending work updated

---

*Previous entries: none — changelog started 2026-03-22*
