# LocoSnap — Full Architecture Reference

> Last updated: 2026-04-19 (afternoon — BR 30506 / VR Sm2/Sm4/Sm5 disambiguation)

---

## Overview

LocoSnap is a mobile app that identifies trains from photos using AI. Users take a photo, the backend identifies the train and returns class, operator, specs, rarity, historical facts, and an AI-generated blueprint illustration.

---

## 1. Mobile App

| Property | Value |
|----------|-------|
| Framework | React Native + Expo (TypeScript) |
| Navigation | Expo Router (file-based) |
| State Management | Zustand + AsyncStorage |
| iOS Version | 1.0.19 build 41 — **LIVE on App Store** (approved 2026-04-14). Contains: 3 lifetime scans paywall (down from 10/month), Pro upsell banner on results screen with source tracking, updated badge/alert text, BR 442/642 disambiguation fix, card-reveal Rules of Hooks fix. Previous live release: v1.0.18 build 40 — Live on App Store 2026-04-12 (card-reveal Rules of Hooks crash fix only). v1.0.17 build 38 — Live on App Store 2026-04-09. IPA v1.0.17: https://expo.dev/artifacts/eas/kWHhX6gcrPpUBYT9Ky1AZg.ipa |
| Android Version | 1.0.11 build 5 — sent to Finnish tester 2026-04-01. Crash fix: removed expo-localization entirely. v1.0.8 introduced expo-localization native plugin which crashed at startup on devices with non-EN/DE device locales (Finnish tester confirmed). v1.0.9 (wrong fix — removed key prop from Tabs), v1.0.10 (partial fix — removed plugin from app.json but not package), v1.0.11 (correct fix — removed package and import entirely; app defaults to EN, user can switch to DE via picker). APK: https://expo.dev/artifacts/eas/451HLSXRSRiqoFAMpfm4sy.apk |
| App Store ID | 6759280267 |
| App Store URL | https://apps.apple.com/app/locosnap/id6759280267 |
| Bundle ID | com.locosnap.app |

### Key Screens
- **Scan** (`app/(tabs)/index.tsx`) — camera + photo library, pre-warms backend on mount
- **History** (`app/(tabs)/history.tsx`) — scan history, loads from Supabase if logged in
- **Profile** (`app/(tabs)/profile.tsx`) — user profile, XP, achievements, Pro status
- **Leaderboard** (`app/(tabs)/leaderboard.tsx`) — global rankings, refreshes on tab focus
- **Results** (`app/results.tsx`) — train details, specs, facts, rarity card
- **Blueprint** (`app/blueprint.tsx`) — full-screen blueprint viewer
- **Compare** (`app/compare.tsx`) — side-by-side train comparison

---

## 2. Backend API

| Property | Value |
|----------|-------|
| Framework | Express.js (TypeScript) |
| Hosting | Render.com (Web Service) |
| Plan | Starter ($7/month) — upgraded 2026-03-31. No spin-down, zero downtime deploys. |
| URL | https://locosnap.onrender.com |
| Cold Start | Eliminated — Starter plan keeps dyno live permanently. healthCheck() pre-warm retained as belt-and-braces. |
| Source | `/backend/src/` |

### Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/identify | Upload photo + optional `language` field (`"en"`/`"de"`) → train ID, specs, facts, rarity (in requested language), blueprint task ID |
| GET | /api/blueprint/:taskId | Poll blueprint generation status |
| GET | /api/health | Health check — active providers + Redis status |
| POST | /api/webhooks/revenuecat | RevenueCat subscription webhooks |

---

## 3. AI Services

| Feature | Primary | Fallback |
|---------|---------|---------|
| Train identification (vision) | Anthropic Claude Vision | OpenAI GPT-4o Vision |
| Specs / Facts / Rarity | Anthropic Claude | OpenAI GPT-4o |
| Blueprint generation | Replicate (SDXL) | OpenAI DALL-E 3 |

**How it works:** Backend auto-detects which API keys are present and uses the right provider. Prefers Anthropic. Only ONE of `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is required.

**Current live provider (Render):** Claude Vision (Anthropic) for identification. Confirmed via `/api/health` which reports `"visionProvider": "Claude Vision (Anthropic)"`. Switched from GPT-4o Vision on 2026-03-30 after Claude correctly identified BR 412 (ICE 4) on first attempt where GPT-4o failed repeatedly.

**AI call configuration:** Temperature is set to `0` on all vision and specs/facts/rarity calls (both Claude and OpenAI paths). This ensures deterministic output — the same photo returns the same class on every scan. Previously, repeat scans of ambiguous classes (e.g. ICE 3 family) would oscillate between BR 403/406/407.

**Hardcoded specs in prompt (prevents AI hallucination):**
- ICE 3 family: BR 403, BR 406, BR 407, BR 408, BR 462 — maxSpeed 300 km/h, power 8,000 kW, builder Siemens
- DB/DR Class 156 — maxSpeed 120 km/h, power 6,360 kW, weight 123 t, builder LEW Hennigsdorf, 186 built, Electric (15kV 16.7Hz AC), status Withdrawn
- BR 412 (ICE 4) — maxSpeed 250 km/h, power 7,440 kW, 108 built

**Vision prompt disambiguation rules added 2026-04-05:**
- **Newag 48WE Elf 2** — Polish EMU (green/white PKP liveries, Newag nose profile, electric traction). Was being returned as ÖBB Class 814 (Czech/Austrian Regionova DMU — wrong country, wrong traction). Fleet number range 48WE-xxx is definitive.
- **BR Standard 5MT vs 4MT** — Fleet number range is definitive: 73xxx (73000–73171) = Class 5MT, 75xxx (75000–75079) = Class 4MT. Both are Riddles-designed 4-6-0 tender steam locos with similar appearance; fleet number must take priority over visual identification.

**Vision prompt structure changes 2026-04-11:**
- **German Regional EMU Family PRE-FLIGHT CHECK added** — Covers BR 423, 425, 426, 440, 442, 445, and 463 as a named decision tree block positioned prominently before the rules section. Structure: mandatory fleet number scan first (definitive, overrides all other cues) → double-deck check (BR 445) → nose profile (BR 463 Mireo = angular pointed; BR 442 Talent 2 = wrap-around curved windscreen; BR 440 Coradia Continental = wide owl-face headlights; flat-ish upright = 423/425 pair) → S-Bahn vs Regio context to separate 423 from 425/426. Confidence fallback: below 70% returns class "DB Regional EMU". Previously, a single disambiguation bullet for BR 423 vs BR 425 at the end of the prompt was being ignored — model returned BR 425 even when "423" was visible in the image.
- **ICE PRE-FLIGHT CHECK consolidated** — Removed three redundant bullets (ICE 3 family detail, ICE 4 vs ICE 3, ICE T vs ICE 3) that repeated logic already in the pre-flight check. Rewrote as a clean 3-step tree: Step 1 nose shape (rounded=401/402, chin=412, pointed=ICE 3), Step 2 ICE 3 sub-variant inline, Step 3 ICE T and ICE L. Fixed structural error: BR 412 was listed inside "Step 2 — IF ICE 3 FAMILY" despite not being an ICE 3 variant. Default for unidentifiable ICE 3 sub-variant changed from BR 407 (17 units, rare) to BR 408 (newest and most numerous ICE 3 variant now entering service).
- **ICE 1 vs ICE 2 Scharfenberg flap rule added** — BR 401 and BR 402 share an almost identical rounded nose. Formation length (14-car vs 7-car) is only visible in side shots. Added the Schaku-Abdeckung (Scharfenberg coupler flap) as the definitive front-on discriminator: BR 401 has a small upward-opening emergency flap below the lower headlights (emergency towing only, not used in passenger service); BR 402 has a full-width front flap covering the lower nose that unlocks centrally and swings halfway inward (designed for routine coupling of two half-sets). Verified via Wikipedia ICE 1 and ICE 2 articles. Correction submitted by a long-term German rail enthusiast follower who identified the ICE 2 specifically by the flap.
- **ICE L Steuerwagen end recognition added** — Previously the rule only covered the Vectron BR 193 hauling end (tall loco + roofline step-down to low Talgo coaches). Added the Talgo Steuerwagen end: low-profile unpowered control car with cab front and windscreen but no pantograph, visually continuous with the Talgo coach body, roofline lower than any true locomotive. Both ends must classify as "ICE L", never as BR 193 or any loco class. Rule also notes that as of early 2026 the Steuerwagen is not yet approved for push-pull operation (so the train is always hauled by a Vectron at one end, Steuerwagen at the other end carried along but not controlling) and that BR 105 (Talgo Travca, currently in certification) will replace the interim Vectrons. Verified via Wikipedia ICE L, heise.de background piece, and bahnblogstelle Steuerwagen certification delay reporting.

**Vision prompt structure changes 2026-04-12:**
- **BR 442 vs BR 642 pantograph disambiguation added** — The BR 442 (Bombardier Talent 2) rule in the German Regional EMU PRE-FLIGHT CHECK now includes a mandatory pantograph check. BR 442 is an EMU and must have a pantograph on the roof. If a train has a curved nose but no pantograph and appears to be a short 2-car diesel unit, it is BR 642 (Siemens Desiro Classic, DMU). Triggered by TikTok comment: "Also ein 442 als 642 erkennen?"
- **DSB Danish Train PRE-FLIGHT CHECK added** — Covers DSB Class ME, ER, IC3, and ET as a named decision tree block positioned before the rules section. Step 1 is a mandatory fleet number scan: 15xx range (1501–1542) = Class ME (diesel loco, Bo'Bo', built 1981–1984, hauls coaches); 2xxx range (e.g. 2001–2240) = Class ER (Copenhagen S-tog EMU, third-rail 1650V DC, operator "DSB S-tog"). Step 2 is a visual type fallback when no number is readable: large diesel loco cab = ME; rubber flexible nose/bellows = IC3 (DMU); rounded dark EMU on urban service = ER; modern silver/white EMU on Oresund corridor = Class ET. Critical rule: a DSB 2xxx fleet number is always Class ER — never Class ME. Triggered by a TikTok comment on the BR 101 video confirming the app returned "DSB Class ME" for fleet number 2143 (a Class ER S-tog EMU).

**Vision prompt structure changes 2026-04-14:**
- **Class 91 (InterCity 225) rule added** — Zero Class 91 coverage in the prompt previously. Discovered during Class 91 content research: scanned a Class 91 photo and the app returned Class 756 (TfW CAF Civity bi-mode), then Class 720 (Greater Anglia Aventra) after the first fix attempt. Root cause: model has very weak training data on Class 91 (31 units ever built, niche UK-only) and was picking the nearest-match modern UK streamlined electric from the rule inventory. Full rule added with wedge nose as defining feature, fleet number range 91101-91131, current active fleet list of 12 units (Dec 2025), ETCS withdrawal deadline (end of 2028), Mark 4 coach formation, DVT at opposite end, three livery variants (LNER red/purple, Swallow heritage, earlier LNER white/red), and explicit anti-anchors against Class 756, Class 800/801/802/805/807/810, Class 43/HST. Hardcoded trainSpecs override added for 125 mph operational max, 4,700 kW power, BREL Crewe, 31 units, 25 kV AC overhead.
- **Class 201 / 202 / 203 Hastings "Thumper" DEMU rule added** — Zero coverage previously. Tester Steph the Spotter scanned preserved Class 201 1001 on "THE NORFOLK NAVIGATOR" railtour on 2026-04-12 and the app returned Class 421 (4CIG EMU — completely wrong type and era). Full rule added with narrow-profile 8 ft 6½ in body as the defining feature (Hastings line tunnels built 1845–1852 forced the reduced loading gauge), rounded cab ends, BR Southern green livery with small yellow warning panel, underfloor English Electric 4SRKT diesel engines (the "thumper" sound origin), 6-car DEMU formation, 21 originally built (7 × 201 6S / 7 × 202 6L / 7 × 203 6B), only 2 preserved (1001 and 1013, Hastings Diesels Ltd at St Leonards-on-Sea). Anti-anchors against Class 421, Class 411, Class 423, Class 438, and every other Southern Region EMU. Type must be "DMU" (no DEMU in the app type enum). Hardcoded trainSpecs override added for 75 mph, BR Eastleigh Works builder, Diesel-Electric fuel type.
- **Class 88 (DRS Stadler Euro Dual) rule added** — Zero coverage previously. Tester Steph the Spotter scanned 88005 "Minerva" on 2026-04-14 with the fleet number clearly visible, and the app returned Class 385 (Hitachi AT200 ScotRail EMU). Full rule added with: 10-unit fleet (88001–88010), Stadler Rail Valencia / Vossloh España build 2015–2017, Stadler Euro Dual family (Siemens Vectron-derived with added Caterpillar C27 diesel), 4,000 kW electric + 708 kW diesel, 100 mph, Bo-Bo, DRS dark blue/green livery, god/goddess unit naming. Anti-anchors against Class 385, Class 90, Class 68, and Hitachi AT300 multi-units. The "88xxx" fleet number is declared definitive — the fleet is so small that any visible 88xxx number is an unambiguous classification. Hardcoded trainSpecs override added covering max speed, power (both electric and diesel values), Stadler builder, 10 units, bi-mode fuel type.
- **Siemens Mireo PRE-FLIGHT CHECK tightened** — BR 111 video comment "every third scan returns a Mireo" triggered investigation. The Mireo pre-flight was firing on any white/silver German EMU with a dark underbelly, causing false positives on BR 442 (Talent 2), BR 440 (Coradia Continental), BR 462 (ICE 3neo Velaro MS). Added a CRITICAL GATE: before returning Mireo or BR 463, at least one of three conditions must be verified — (a) fleet number starting "463" readable in the image, (b) explicit "Mireo" / "Mireo Smart" / "Mireo Plus B" / "Mireo Plus H" branding visible, or (c) short 3-car formation with Mireo-specific angular profile and no other German Regional EMU rule match. Otherwise fall through to the German Regional EMU Family pre-flight check decision tree or return "DB Regional EMU". The Mireo rule is now for shape/colour gating only — it does not authorise returning Mireo as the final class without specific evidence.

**Vision prompt structure changes 2026-04-15:** Lxcx_241 feedback batch — six misidentifications fixed in one session.
- **ADtranz DE-AC33C "Blue Tiger" / DB Class 250 rule added, Vossloh Euro 4000 rule corrected** — The previous rule at vision.ts line 180 incorrectly conflated the Vossloh Euro 4000 with the Blue Tiger and mapped "250 xxx" fleet numbers to Euro 4000. Both claims were factually wrong. "Blue Tiger" is exclusively the ADtranz DE-AC33C (Co-Co diesel-electric built 1996–2002 by ADtranz + GE Transportation, ~30 units, numbered Class 250 in Germany with fleet 250 001–250 030 operated by Captrain/ITL/HGK/MRCE). The Vossloh Euro 4000 is a separate Spanish build from 2006 on the EMD JT42CWRM platform. Replaced with two clean separate rules. Hardcoded trainSpecs overrides added for `class 250` / `blue tiger` / `adtranz de-ac33c`. Discovered via Lxcx_241 screenshot of Captrain 250 007-2 being identified as Vossloh Euro 4000.
- **Tatra KT4 / KT4D rule added** — Zero Tatra coverage previously. The KT4D is a Czechoslovak two-section articulated high-floor tram built by ČKD Tatra Smíchov (Prague) 1974–1997, widely used in East Germany (BVG Berlin, Potsdam ViP, Cottbus, Erfurt, Gera, Frankfurt Oder). Full rule distinguishes it from the Siemens Combino (which is a 3+ section smooth low-floor modern tram from 1996+, completely different era and design). Visual identifiers: high-floor entry, two body sections joined by Jacobs-bogie articulation, boxy 1970s/80s Eastern Bloc cab styling, modernised variants (KT4DM, KT4DC, KT4Dt) retain the same bodyshell. Hardcoded trainSpecs override added. Discovered via Lxcx_241 screenshot of a dark green/teal KT4D unit 157 being identified as Siemens Combino.
- **DR BR 120 / Soviet M62 "Taigatrommel" rule added** — Extended the existing ST 44 / M62 family rule with an explicit German variant entry. The East German Deutsche Reichsbahn BR 120 is a Co-Co Soviet-built diesel freight locomotive from Voroshilovgrad Locomotive Works (Luhansk, Ukrainian SSR) 1966–1975, 378 delivered to DR. Post-1992 renumbering to DB Cargo BR 220, mostly withdrawn. CRITICAL disambiguation: the Soviet DR BR 120 diesel is completely different from the modern DB BR 120 electric (1979, Krauss-Maffei/Henschel/Krupp). Anti-anchor against British Class 33. The silhouette is unmistakable: single central cab elevated above a long hood with two round headlights flanking the blunt front end. Hardcoded trainSpecs override added keyed with `dr br 120` / `dr 120` / `taigatrommel` / `db br 220` — deliberately not shadowing the plain `br 120` key so modern DB BR 120 electric lookups still fall through to Wikidata. Discovered via Lxcx_241 screenshot of a preserved red Taigatrommel being identified as Class 33.
- **S-Bahn Berlin BR 480 / 481 / 485 rule rewritten** — The previous rule was factually broken in two ways: (1) it claimed "BR 485 is the unpowered trailer of BR 480", which is false — BR 485 is a completely independent DR-era class; (2) it used pantograph visibility as a distinguisher, but the Berlin S-Bahn uses 750 V DC third-rail electrification and none of these classes has a pantograph. Replaced with a unified BR 480 / BR 481 / BR 485 rule that correctly describes each class: BR 485 (1987–1992 LEW Hennigsdorf, 166 half-sets, originally DR 270, retro East German cab), BR 480 (1986–1994 AEG, 85 half-sets, transitional rounded cab), BR 481 (1996–2004 DWA/Adtranz/Bombardier, ~500 half-sets, flat-angular modern cab). Added service-line context bias: S8/S85/S9/S75/S47/S46 lean BR 485; S1/S2/S25/S26/S3/S5/S7/S41/S42 lean BR 481. Also removed the now-redundant standalone "BR 480 vs BR 481" rule. Hardcoded trainSpecs override added for BR 485 / DR 270. Discovered via Lxcx_241 screenshot of a BR 485 on S85 Pankow being identified as BR 481.
- **DRB Baureihe 52 / Kriegslokomotive guard rule added** — Zero Class 52 vision coverage previously, allowing the specs layer to hallucinate electric traction for a WW2 steam locomotive. Baureihe 52 is a 2-10-0 German wartime STEAM freight locomotive built 1942–1950, ~6,719 units, coal-fired. ABSOLUTE rule: fuelType must be "Coal", type must be "Steam", builder defaults to "Borsig (Berlin-Hennigsdorf)" (the first/primary manufacturer — other builders WLF/Henschel/Krupp/Krauss-Maffei/Schichau/DWM Posen/Škoda Pilsen), operator defaults to "Deutsche Reichsbahn" — NEVER "Czech Railways", NEVER electric, NEVER diesel. Hardcoded trainSpecs override and dedicated SPECS_PROMPT bullet added — defence in depth. Discovered via Lxcx_241 screenshot showing a preserved Class 52 with specs of "Electric (3 kV DC)" fuel, "Škoda Plzeň" builder, and "Czech Railways" operator — all three fundamentally wrong.
- **DB Class 143 / DR 243 rarity + specs added** — The existing Class 143 classification was correct but rarity was showing as "Common" and builder was being guessed by Wikidata. DB Class 143 (ex-DR 243, LEW Hennigsdorf 1984–1991, 646 units built) has been dramatically reduced in active service — DB Regio withdrew almost all of them by 2025–2026, leaving only a small number with private freight operators or in heritage use. Added rarity.ts RARITY_PROMPT bullet explicitly instructing that a BR 143 in 2025–2026 is "rare" despite the large historical fleet size, because the active fleet is a tiny fraction of that today. Added trainSpecs hardcoded override (LEW Hennigsdorf builder, 120 km/h, 3,720 kW, 15 kV 16.7 Hz AC, 646 built). Discovered via Lxcx_241 screenshot of a DB Regio BR 143 being rarity-classified as "Common".

**Vision prompt structure changes 2026-04-16:** Lxcx_241 feedback batch #2 (Czech tester forwarding) — six further misidentifications fixed in one session, plus a Class 37 builder correction discovered during the Class 37 video screen recording.
- **BR 485 "Coladose" rarity upgraded COMMON → EPIC** — rarity.ts RARITY_PROMPT rule added instructing that BR 485 must classify as "epic". Only 3 surviving units out of 166 originally built (LEW Hennigsdorf 1987–1992) — all others scrapped. The class is on the verge of total extinction and is the last surviving East German S-Bahn design on the Berlin network. Nicknamed "Coladose" (cola can) by enthusiasts. Discovered via Czech tester forwarding screenshot of a BR 485 classified as Common.
- **Class 143 rarity upgraded RARE → EPIC** — rarity.ts RARITY_PROMPT updated. The "rare" classification from 2026-04-15 was already correct in direction but the actual fleet remnant is small enough that "epic" is a better fit. A genuinely exciting spot, not merely "rare". Czech tester noted the class is functionally gone from mainline service.
- **Berlin S-Bahn BR 483 / BR 484 rule added, specs hardcoded** — Zero coverage previously, and Wikidata was matching a completely wrong entity returning "Crewe Works" builder, "1943" year, and "15 kV 16.7 Hz AC" electrification — all three nonsensical for a modern Berlin S-Bahn EMU. BR 483 (powered) and BR 484 (intermediate/trailer) are the newest S-Bahn Berlin fleet, built by a Stadler/Siemens consortium from 2020 onwards, ~106 half-trains ordered, 750 V DC third-rail (Berlin S-Bahn standard), 100 km/h max. Angular contemporary cab design, LED headlight arrays, the only Berlin S-Bahn class that looks genuinely 2020s. Added both a vision rule (extending the BR 480/481/485 family decision tree) and hardcoded trainSpecs overrides (`br 483`, `class 483`, `baureihe 483`, `br 484`, `class 484`, `baureihe 484`). Discovered via Czech tester screenshot showing the back-of-card specs with "Crewe Works 1943 15kV AC".
- **OBB 1116 / OBB 1016 "Taurus" vs BR 193 Vectron disambiguation added** — Zero Taurus coverage previously. The OBB Taurus (Siemens Eurosprinter ES64U2, 1999–2006, ~382 units across 1016 + 1116 series) is a DIFFERENT generation from the Vectron. The Taurus has a rounded smooth cab nose with a large curved windscreen flowing into the body. The Vectron has an angular squared-off cab with a flat windscreen and sharp corners. OBB red livery + "1116 xxx" fleet number = Taurus definitively. Hardcoded trainSpecs overrides added (`1116`, `obb 1116`, `obb 1016`, `taurus`, `es64u2`) with 230 km/h, 6,400 kW, Siemens, 382 units, 15 kV 16.7 Hz AC. Discovered via Czech tester screenshot of an OBB 1116 being identified as BR 193.
- **DRG E 77 vs CSD E 669.1 disambiguation added** — Zero E 77 coverage previously. Two completely different locomotives from different countries and eras were being confused: **DRG E 77** is a pre-war German electric built 1924–1926 by BMAG/Krauss/LHW for Deutsche Reichsbahn-Gesellschaft, 56 units, 15 kV 16.7 Hz AC, 65 km/h, rod-drive pre-war boxy body, E 77 10 preserved at Dresden Transport Museum. **CSD E 669.1** (later CD Class 181) is a post-war Czech Skoda Co-Co freight electric built 1961–1962, 3 kV DC, entirely different profile and era. Hardcoded trainSpecs overrides added for `e 77`, `e77`, `drg e 77`, `drg class e 77`. Discovered via Czech tester screenshot of a preserved DRG E 77 at a Czech rail event being identified as Skoda E 669.1.
- **BR 412 (ICE 4) vs BR 408 (ICE 3neo) disambiguation reinforced** — Existing rules had the distinction correct but the model was still returning BR 408 for ICE 4 images. Added a dedicated reinforcement rule: BR 412 (ICE 4) has a WIDE FLAT nose with rectangular windscreen and prominent chin undercut, 250 km/h (never 300/320). BR 408 (ICE 3neo) has a NARROW POINTED aerodynamic nose, 320 km/h. "Wide flat = 412, narrow pointed = 408" — plus the usual fleet number check. Discovered via Czech tester "BR408 should be a 412 (think we have had that before)".
- **Class 37 trainSpecs builder override added** — Wikidata was returning "ALSTOM Transportation Germany" as the builder for Class 37. Class 37 was built by English Electric at Vulcan Foundry (Newton-le-Willows, Lancashire) 1960–1965, 309 units. Alstom inherited maintenance contracts decades later but did not build the class. Hardcoded override added for `class 37`, `br class 37`, `br 37`, `37` with builder "English Electric (Vulcan Foundry)", 90 mph, 1,750 HP, 309 units, Diesel. Discovered during Class 37 video screen recording — builder "ALSTOM Transportation Germany" would have embarrassed the account in front of UK rail enthusiasts if shipped without a fix.

**Vision prompt structure changes 2026-04-18:** Oula (vattuoula — Finnish tester) feedback batch — Finnish rail coverage deepened across both diesel and electric locomotive classes.
- **Fenniarail Dr18 rule added, trainSpecs hardcoded, rarity = legendary** — Oula reported Dr18 unidentifiable. Root cause: existing Finnish Dr-series rules all framed around VR operator. Dr18 is actually operated by Fenniarail Oy (private Finnish freight operator), CZ Loko-built 2015–2020, only 6 units worldwide (Dr18 101–106), Co'Co' hood-unit with dark-green-and-yellow Fenniarail livery. Added dedicated vision rule with the operator framing ("Dr18 is NOT a VR class"), hardcoded trainSpecs override (90 km/h, 1,550 kW, 120 t, CZ Loko, 6 units, Finnish broad gauge 1,524 mm), and rarity.ts "legendary" rule (6-unit global fleet puts it alongside DR Class 156 in the smallest-fleet tier). Confirmed working by Oula first-try retest minutes after deploy.
- **VR Dv12 rule deepened + livery correction** — Existing Sm3/Dv12 rule mentioned Dv12 briefly but had no disambiguation vs Dr14/Dr16/Dr19 and carried a factual error claiming "orange/white" livery. Rewrote with full cue set: Bo'Bo' four-axle, asymmetric long + short hood silhouette, fleet number format "Dv12 2xxx" (ranges 2501–2568, 2601–2664, 2701–2760), correct historic livery **red-with-light-grey band** (NOT orange/white — corrected), Valmet + Lokomo under Nohab licence 1963–1984, 192 units, diesel-hydraulic. Hardcoded trainSpecs override with corrected livery guidance. Disambiguation vs Dr19 (modern Stadler full-width boxcab with cabs at both ends) and Dr16 (Co'Co' six-axle, count the axles) added. Migration 008 also drops the dead `daily_scans_reset_at` column the same session (Supabase production ran evening of 2026-04-17, code deploy 2026-04-18 AM, commit `081a40b`).
- **DB BR 140 / E 40 trainSpecs + rarity overrides added (2026-04-19, commit `6d18bbf`)** — Discovered during BR 140 video build that the app was returning hallucinated facts for "DB Class 140": "186 built, East German, virtually no survivors, withdrawn since 1957". The 186-built figure is the exact production count of DB Class 156 (a completely different LEW Hennigsdorf prototype), and the "East German / withdrawn 1957" framing was pure text-generator invention for what is in reality a West German Bundesbahn workhorse still running in freight service in 2026. Would have been a catastrophic factual error in a DE video targeting the exact audience that would spot "186" and "East German" inside 5 seconds. Fix adds `trainSpecs.ts` block with authoritative values: numberBuilt 879 (explicit "NEVER 186" guard), West German DB Bundesbahn origin (explicit "NEVER Deutsche Reichsbahn / East German" guard), built 1957–1973 by Krauss-Maffei / Krupp / Henschel / SSW, status "Mixed (withdrawn from DB Cargo 2020, active with private freight operators)" naming PRESS / Lokomotion / Railsystems RP / RailAdventure / EBM Cargo, ~100 units still operational in 2026 (explicit "NOT extinct" guard), specs 110 km/h / 3,700 kW / 83 t / 16.49 m / Bo'Bo' / 15 kV 16.7 Hz AC. Fix adds `rarity.ts` rule forcing `legendary` tier despite the large historical fleet, on the grounds that BR 140 is now one of the last classic Bundesbahn first-generation electric freight locos still in commercial freight service. Reason-field guard mandates West German framing + 879 units, blocks "extinct / virtually no survivors / completely withdrawn" language. `vision.ts` unchanged — the classifier correctly returned "DB Class 140", the hallucination was purely downstream. Same pattern as the Dr18 / Sr-class / BR 485 / BR 143 fixes earlier in the month: vision correct, specs+rarity need reinforcement for downstream text generation. Commit `6d18bbf` pushed to Render 2026-04-19 evening, Render auto-deploy landed within 90 seconds. Rescan confirmed card now shows correct LEGENDARY / DB Class 140 / 110 km/h / 3,700 kW / 100 left / West German private-operator framing.
- **LSWR Urie S15 (BR 30506) + UK BR 30xxx number-block rule added (2026-04-19 afternoon)** — UK tester scanned preserved 4-6-0 30506 at the Watercress Line; app returned "Class 30506, Southern Railway Schools Class 4-4-0, built 1914, Legendary". Three compounding errors: (a) model treated the BR running number "30506" as a class name ("Class 30506"), (b) mis-classified it as Schools (V) class — a completely different Maunsell 4-4-0 express passenger design built 1930–1935 — instead of the correct LSWR Urie S15 Class 4-6-0, (c) hallucinated build year 1914 (correct = October 1920, Eastleigh Works). Fix in `vision.ts`: (i) "UK BR 30xxx number block" rule forbidding the model from returning a BR running number as a class name, with explicit guidance that 30xxx numbers are ex-Southern-Region locos and must be resolved to the underlying design class; (ii) full "LSWR Urie S15 Class (BR 30506 and siblings)" rule with critical facts (4-6-0 not 4-4-0, built 1920 not 1914, Urie not Maunsell, class name "LSWR Urie S15" not "Class 30506" not "Schools"), visual cues (Urie stovepipe chimney, double-window cab, 8-wheel Urie bogie tender), and explicit contrast with Schools V class. Fix in `trainSpecs.ts`: prompt-text override block and four `WIKIDATA_CORRECTIONS` entries (`urie s15`, `lswr urie s15`, `lswr urie s15 class`, `s15`) with 70 mph / 1,268 kW / Eastleigh Works / 20 units / coal steam. Not yet deployed — awaiting push decision.
- **VR Sm2 / Sm4 / Sm5 Finnish commuter EMU disambiguation added (2026-04-19 afternoon)** — Oula reported every VR commuter EMU being collapsed to "Sm5 (FLIRT)". Three distinct vehicle families conflated: Sm2 (Valmet/Strömberg 1975–1981, 50 two-car sets, boxy 1970s cab, flat windscreen, 120 km/h, HSL/VR), Sm4 (CAF Beasain / Transtech 1999–2005, 30 two-car sets, rounded single-curve cab, 160 km/h, HSL/VR), Sm5 (Stadler FLIRT Finland 2008+, 81 four-car sets, sharp angular FLIRT nose, 160 km/h). Also fixed the Sm5 operator bug — Sm5 is owned by **Pääkaupunkiseudun Junakalusto Oy** and operated under contract for **HSL** (Helsingin seudun liikenne), so operator must be "HSL" or "HSL / VR", NEVER just "VR" alone (VR operates the trains on HSL's behalf, but it is an HSL service). Fix in `vision.ts`: dedicated "Finnish VR commuter EMU disambiguation (Sm2 vs Sm4 vs Sm5)" block covering all three families with visual cues and the HSL vs VR operator rule. Fix in `trainSpecs.ts`: four prompt-text override blocks (Sm2, Sm4, Sm5 plus the Urie S15 above) and six `WIKIDATA_CORRECTIONS` entries (`sm2`, `vr sm2`, `sm4`, `vr sm4`, `sm5`, `vr sm5`). Deliberately did NOT add a broad "stadler flirt" correction — the FLIRT platform is worldwide and that would break Norwegian, German, Swiss, Italian FLIRT scans. Not yet deployed — awaiting push decision.
- **VR Sr1 / Sr2 / Sr3 disambiguation REINFORCED** — Oula reported later the same day that after the Dr18 deploy, testing more Finnish electric locos revealed all three Sr classes being returned as Sr3. Screenshots showed Sr1 fleet 3041 (classic red-green-yellow Finnish tricolor livery) and Sr2 fleet 3227 (modern white/green) both misidentified as Sr3. Existing Sr rule mentioned axle count and cab styling but didn't push hard enough on fleet numbers or the uniquely identifying red Sr1 livery. Rewrote with a three-tier cue hierarchy: (1) Fleet number ranges as definitive (30xx=Sr1, 32xx=Sr2, 33xx=Sr3), (2) Livery (red+yellow-stripe = Sr1 ALWAYS), (3) Axle count + cab silhouette fallback (Co'Co'=Sr1, Bo'Bo'+rounded Swiss cab=Sr2, Bo'Bo'+angular Vectron cab=Sr3). Explicit "NEVER default to Sr3" guidance added. Builder lineage clarified: Sr1 = Novocherkassk (NEVZ) + Strömberg electrics, Sr2 = SLM Winterthur / ABB (Re 460 family — Swiss rounded cab), Sr3 = Siemens Vectron. Hardcoded trainSpecs overrides added for `sr1`/`vr sr1` (Co'Co' 110 units, 160 km/h, 3,100 kW), `sr2`/`vr sr2` (Bo'Bo' 46 units, 210 km/h, 6,100 kW), `sr3`/`vr sr3` (Bo'Bo' 80 units, 200 km/h, 6,400 kW). Rarity.ts Finnish paragraph extended: Sr1 = rare (shrinking fleet, tricolor livery leans epic), Sr2 = rare (only 46 units ever), Sr3 = uncommon (modern backbone, fleet growing). Commit `0e28169` pushed to Render 2026-04-18 evening.

**Wikidata data quality guards:** Quantity fields (e.g. P2067 mass) can return a value of 0 from Wikidata. Guards check `amount > 0` and `tonnes > 0` before accepting any Wikidata quantity — zero values are skipped and treated as missing data.

**maxSpeed conflict resolution:** When Wikidata and AI disagree on maxSpeed by more than 20%, Wikidata is trusted (changed 2026-03-26 — previously AI was overriding correct Wikidata values for well-documented trains).

**Length unit conversion (2026-03-31):** Wikidata P2043 (length) can return values in millimetres (Q11570), metres (Q11573), or kilometres (Q174789). `wikidataSpecs.ts` `getQuantity()` now checks the unit QID and converts to metres before use. Fallback: any value exceeding 500 is assumed to be in mm and divided by 1000. Fixes DB Class 101 showing "19100.0 m" instead of "19.1 m".

---

## 3a. Language / Localisation

| Property | Value |
|----------|-------|
| Supported languages | English (`en`), German (`de`) — v1.0.8 |
| Future languages | Architecture supports FR, NL, PL, CS — add locale file + 6 lines in `i18n/index.ts` |
| Language preference store | `frontend/store/settingsStore.ts` — `AppLanguage`, `initialize()`, `setLanguage()`, `markLanguageChosen()` |
| i18n library | i18next + react-i18next + expo-localization |
| Translation files | `frontend/locales/en.json`, `frontend/locales/de.json` — 80 keys, 11 namespaces |
| First-launch gate | `frontend/app/language-picker.tsx` — shown once before auth, `router.replace("/(tabs)")` after selection |
| Language gate in layout | `frontend/app/_layout.tsx` — outermost gate: blank loading view → language picker redirect → AuthGate |
| Language toggle | Profile screen (`(tabs)/profile.tsx`) — toggles EN/DE, persists to AsyncStorage, switches immediately |
| Backend language param | Frontend sends `language` field in FormData on every `/api/identify` POST |
| Backend validation | `backend/src/routes/identify.ts` — `VALID_LANGUAGES = ["en", "de"]`, defaults to `"en"` for invalid/missing |
| AI content in German | When `language === "de"`, a German instruction is prepended to facts, specs, and rarity prompts. Narrative fields (descriptions, reasoning) return in German. Technical values (numbers, units, speed) remain in standard international format. Train identification (vision) always runs in English regardless of language setting. |
| Cache per language | Cache key includes language segment: `v7::{language}::{class}::{operator}`. EN and DE results stored as separate entries. |

**Language detection on first launch:** `settingsStore.initialize()` reads `locosnap_language` from AsyncStorage. If not set, checks device locale via `expo-localization`. If device locale matches a supported language, that language is pre-selected. Otherwise defaults to `"en"`. The language picker screen is shown on first launch; subsequent launches skip it.

**Adding a new language:** (1) Create `frontend/locales/{code}.json` matching the en.json structure. (2) Import it in `frontend/i18n/index.ts` and add to the `resources` object. (3) Add the language code to `SUPPORTED_LANGUAGES` in `settingsStore.ts` and `VALID_LANGUAGES` in `identify.ts`. (4) Add a button to `language-picker.tsx`. (5) Add translations for the new language button in all locale files. (6) Bump backend if the AI prompt needs language-specific tuning.

---

## 4. Database — Supabase

| Property | Value |
|----------|-------|
| Provider | Supabase (PostgreSQL) |
| Project | locosnap |
| Project Ref | vfzudbnmtwgirlrfoxpq |
| Region | eu-west-1 |
| Dashboard | https://supabase.com/dashboard/project/vfzudbnmtwgirlrfoxpq |

### Key Tables
| Table | Description |
|-------|-------------|
| profiles | User profiles — XP, level, streak, is_pro, blueprint_credits |
| spots | Every train scan — linked to user + train |
| trains | Train records (class, operator, specs, facts, rarity) |
| achievements | Unlocked achievements per user |
| leaderboard | View combining profiles + spots for rankings |
| subscription_events | RevenueCat webhook events |

### Row Level Security
RLS is enabled on all tables. Users can only read/write their own data.

---

## 5. Auth — Supabase Auth

| Property | Value |
|----------|-------|
| Provider | Supabase Auth |
| Supported Methods | Email magic link (OTP), Google OAuth, Apple OAuth |
| Guest Mode | **Removed** — see User Flow below |
| Auth Email Sender | noreply@locosnap.app (via Resend SMTP) |
| Sender Name | LocoSnap |

**Known fixes (implemented):**
- Android session expiry — `onAuthStateChange` now handles `TOKEN_REFRESHED` and unexpected `SIGNED_OUT` events with session recovery before clearing state.
- All `SIGNED_OUT` paths now explicitly call `clearHistory()` to prevent scan history from persisting after sign-out or account switch.
- `app/_layout.tsx` account switching now awaits `clearHistory()` before calling `loadHistory()` — fixes cross-contamination bug where signing into a second account could show the previous account's collection.

---

## 6. Blueprint Task Store + Train Data Cache — Redis

| Property | Value |
|----------|-------|
| Production | Upstash Redis |
| Local Dev | In-memory Map (automatic fallback) |
| Blueprint tasks | Stores async blueprint generation task status (key: `task:<id>`) |
| Train data cache | Stores specs/facts/rarity/blueprints per train class+operator (key: `traindata:<class>::<operator>`) |

**Cache architecture (2026-03-22):** The train data cache was previously written to the local filesystem (`train-cache.json`) which is wiped on every Render deploy. Migrated to a two-level cache:
- **L1** — in-memory `Map` (fast, resets on server restart)
- **L2** — Upstash Redis with 30-day TTL (persistent across deploys)

Cache entries are lazy-loaded from Redis on first access. `trainCache.ts` functions (`getCachedTrainData`, `setCachedTrainData`, `setCachedBlueprint`) are all async. Saves ~84% of AI costs on repeat scans (£0.005 cached vs £0.031 fresh).

**Cache version: v7** (as of 2026-03-31). Version is embedded in all cache keys. Key format: `v7::{language}::{class}::{operator}` — language segment added so EN and DE results for the same train are stored as separate entries. Bump the version in `trainCache.ts` whenever wrong identification data may have been cached during iterative prompt/model fixes, or when the cache key format changes — this orphans all stale Redis entries and forces fresh AI calls on next scan. Every version bump means the first scan of every class will miss cache and run the full AI pipeline.

---

## 7. Monetisation — RevenueCat

| Property | Value |
|----------|-------|
| Provider | RevenueCat |
| Entitlement | Pro |
| Features | Unlimited scans, all blueprint styles, leaderboard access |
| Webhook | POST /api/webhooks/revenuecat |
| Manual Pro Grant | UPDATE public.profiles SET is_pro = true WHERE id = '...' |

**Note:** RevenueCat is checked on profile load. If DB has `is_pro = true` (manually granted), RevenueCat will not override it (fixed in commit `7f0188a`).

### Tester Pro Grant Process

All beta testers must be granted Pro manually via Supabase. The grant only applies to profiles that already exist — a new sign-up creates a fresh profile without `is_pro = true`.

**Process every time a tester signs up or a new tester is added:**

1. Run the diagnostic to find their user ID:
```sql
SELECT id, email FROM auth.users WHERE lower(email) = 'tester@example.com';
```

2. Grant Pro:
```sql
UPDATE public.profiles SET is_pro = true WHERE id = '<user-id>';
```

Or via REST API (service role key required):
```bash
curl -X PATCH "https://vfzudbnmtwgirlrfoxpq.supabase.co/rest/v1/profiles?id=eq.<user-id>" \
  -H "apikey: <service-role-key>" \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"is_pro": true}'
```

**Important:** After any signup wave (e.g. following a Pro access email to testers), re-run the bulk grant for all tester emails — new sign-ups will not have Pro until this is done. The service role key is in Render → locosnap-backend → Environment Variables → `SUPABASE_SERVICE_KEY`.

**Automated monitor (active as of 2026-03-31):** A local scheduled task runs every 4 hours, checks whether any outstanding testers have signed up, grants Pro automatically, and emails a summary to unsunghistories@proton.me. Task file: `/Users/StephenLear/.claude/scheduled-tasks/locosnap-tester-pro-monitor/SKILL.md`. Manage via the Scheduled tab in Claude Code sidebar. New testers added 2026-04-04: christian.grama@outlook.com and jannabywaniec@gmail.com — monitor will auto-grant Pro when they sign up in-app.

### Scan Limits (as of 2026-03-22)

| User State | Scan Allowance |
|-----------|---------------|
| Unauthenticated (trial) | 3 total — tracked in AsyncStorage (`locosnap_presignup_scans`) |
| Free account | 3 lifetime (no monthly reset) — tracked in `daily_scans_used` (legacy column name) |
| Pro | Unlimited |

**Scan limit change 2026-04-12 / synced 2026-04-14 / schema cleaned up 2026-04-18:** Free account limit changed from 10 per calendar month to 3 lifetime scans with no monthly reset. The monthly reset logic was removed from both frontend (`authStore.ts fetchProfile`) and backend (`identify.ts checkScanAllowed`). The `daily_scans_used` column retains its legacy name but is now a lifetime counter. The `daily_scans_reset_at` column was dropped on 2026-04-18 via Supabase migration 008 — no longer part of the schema. Frontend `Profile` type and the setup-bundle `supabase/migration.sql` were updated in the same session. Reason: zero Pro conversions — 10/month was too generous, most users never hit the paywall. Frontend shipped in iOS v1.0.19 build 41 (submitted to Apple 2026-04-13, **approved and live on App Store 2026-04-14**). Backend `identify.ts` flipped in the same session as the Apple approval (commit `8c4cb7c`, pushed 2026-04-14) — `const MAX_FREE_SCANS = 3`, error message changed to "Free scan limit reached". Frontend and backend are now fully synchronised on the 3-lifetime-scan paywall model.

**Results screen upsell banner (2026-04-12 / live 2026-04-14):** Added a Pro upsell banner to `results.tsx` visible to all non-Pro users after every scan. Shows "Grow your collection / Unlimited scans, cards, and blueprints" with link to paywall (`source=results_banner`). Previously the paywall was entirely reactive — only shown when a limit was hit. The banner ensures every active user sees a Pro prompt regardless of remaining scans. Shipped in v1.0.19 build 41, now live on App Store.

**Important:** Guest mode was removed in 2026-03-22 because `canScan()` returned `true` unconditionally for guests (a loophole giving unlimited free scans). The sign-in screen no longer shows "Continue as Guest". Unauthenticated users can scan 3 times before being prompted to create a free account.

---

## 8. Domain & DNS — locosnap.app

| Property | Value |
|----------|-------|
| Registrar | Hostinger |
| Domain | locosnap.app |
| Expires | 2027-03-21 |
| DNS Panel | hPanel → Domains → locosnap.app → DNS / Nameservers |
| API Key | gLnygWWPZjzE5TEGCCUQe7Zurn2v4hP4rkFz8aPr7ae2c002 |

### DNS Records
| Type | Name | Value | Purpose |
|------|------|-------|---------|
| A | @ | 76.76.21.21 | Website → Vercel |
| A | www | 76.76.21.21 | Website → Vercel |
| MX | @ | mx1.improvmx.com (priority 10) | Email receiving |
| MX | @ | mx2.improvmx.com (priority 20) | Email receiving |
| MX | send | feedback-smtp.eu-west-1.amazonses.com (priority 10) | Resend sending |
| TXT | resend._domainkey | DKIM key | Resend email authentication |
| TXT | send | v=spf1 include:amazonses.com ~all | SPF for Resend |

---

## 9. Website — locosnap.app

| Property | Value |
|----------|-------|
| URL | https://locosnap.app |
| Hosting | Vercel |
| Source | `/website/index.html` |
| Deploy | `cd website && npx vercel --prod --yes` |
| Vercel Project | stephens-projects-ea204d52/website |

---

## 10. Email

### Sending (Resend)
| Property | Value |
|----------|-------|
| Provider | Resend |
| Domain | locosnap.app (verified ✅) |
| Region | eu-west-1 |
| Domain ID | c3f826ac-93d9-49f0-af9f-65ecf2b8396a |
| From address | stephen@locosnap.app (primary contact/tester emails) |
| Auth email | noreply@locosnap.app (Supabase auth) |
| API Key | re_XU3bJw3A_FeZwjrnRpiKQ7tz3GTQVcTi8 (Resend dashboard → API Keys) |
| Dashboard | https://resend.com |
| Mandatory CC | unsunghistories@proton.me on every outbound email — no exceptions (enforced by email-send-guard skill rule 12) |
| API endpoint | `POST https://api.resend.com/emails` |

**Resend API gotcha — Cloudflare User-Agent block (discovered 2026-04-11):** The Resend API now sits behind Cloudflare and rejects requests with the default `Python-urllib/3.x` User-Agent with `403 Forbidden` and Cloudflare error code `1010` ("the owner of this website has banned your access based on your browser's signature"). Any script calling the Resend API MUST include a custom `User-Agent` header. Working header set used 2026-04-11 to send 5 tester check-in emails:

```
Authorization: Bearer <RESEND_API_KEY>
Content-Type: application/json
User-Agent: LocoSnap-TesterMailer/1.0 (curl-equivalent)
Accept: application/json
```

Without the User-Agent override, all 5 emails returned `403 / error 1010` and 0 sent. With the override, all 5 sent successfully on the next attempt. Apply the same pattern to any future Python/urllib-based Resend calls. `curl` and Node SDKs are not affected because they send their own non-empty User-Agent by default.

### Receiving / Forwarding (ImprovMX)
| Property | Value |
|----------|-------|
| Provider | ImprovMX |
| hello@locosnap.app | Forwards to unsunghistories@proton.me |
| stephen@locosnap.app | Forwards to unsunghistories@proton.me (via catch-all) |
| Catch-all (*) | Forwards to unsunghistories@proton.me |
| Dashboard | https://improvmx.com |

**Note:** `stephen@locosnap.app` is the primary contact/business email. Use this on App Store Connect, TestFlight, and any public-facing communications. All mail forwards to unsunghistories@proton.me.

---

## 11. Analytics & Monitoring

| Service | Purpose |
|---------|---------|
| PostHog | Product analytics — scan events, feature usage, funnels |
| Sentry | Error tracking + crash reporting |

**Sentry activation (2026-03-22):** `EXPO_PUBLIC_SENTRY_DSN` was missing from all build profiles and `.env`. Added to `eas.json` (preview + production), `frontend/.env`, and the backend's Render environment. `SENTRY_DISABLE_AUTO_UPLOAD=true` was also blocking production — removed from the production profile in `eas.json`. Sentry DSN: `https://874dfbb3d0666b9a54bf4ac8b3375872@o4511090253955072.ingest.de.sentry.io/4511090259198032` (EU region, project: locosnap).

### Sentry Source Maps (EAS Secrets)

| Property | Value |
|----------|-------|
| Org slug | `locosnap` |
| Project slug | `react-native` |
| Token name | `EAS Source Maps` |
| Token scopes | `project:write`, `release:admin`, `organization:read` |
| Token value | `sntryu_****` (stored in EAS secrets, not checked in) |
| EAS secret name | `SENTRY_AUTH_TOKEN` |

**Setup (2026-03-23):** Personal token created in Sentry → User Settings → Auth Tokens. Added to EAS project secrets so that EAS builds can upload source maps and symbolicate stack traces. Commands used:
```bash
eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value "<your-sentry-token>"
eas secret:create --scope project --name SENTRY_ORG --value "locosnap"
eas secret:create --scope project --name SENTRY_PROJECT --value "react-native"
```

---

## 12. Push Notifications

| Property | Value |
|----------|-------|
| Provider | Expo Push Notifications |
| Triggers | Blueprint ready, achievement unlocked, streak reminder |

---

## 13. Build & Distribution — EAS

| Property | Value |
|----------|-------|
| Provider | Expo Application Services (EAS) |
| Account | stephenlear1 |
| iOS Profile | production |
| Android Profile | preview (APK for testers) |
| Build command | `eas build --platform [ios/android/all] --profile [production/preview]` |
| Local dev build | Not yet built. Run `eas build --profile development --platform ios` once to install it. After that, `npx expo start --dev-client` pushes code changes instantly without rebuilding. **Build this before the next debugging session to avoid wasting TestFlight builds.** |
| Expo Go limitations | Two errors appear when testing via Expo Go — these are NOT code bugs and do NOT appear in TestFlight: (1) RevenueCat "invalid API key" — Expo Go has no native store access; (2) Worklets mismatch 0.7.4 vs 0.5.1 — Expo Go bundles an older version. Both are resolved in any real build. |
| Latest iOS Build | Build 41 (v1.0.19) — **LIVE on App Store** (approved 2026-04-14). Contains: 3 lifetime scans, Pro upsell banner on results screen, updated badge/alert text, BR 442/642 fix, card-reveal Rules of Hooks fix. Backend flipped `MAX_FREE_MONTHLY_SCANS=10` → `MAX_FREE_SCANS=3` in the same session (commit `8c4cb7c`). Previous: Build 40 (v1.0.18) — Live on App Store 2026-04-12. Build 38 (v1.0.17) — Live on App Store 2026-04-09. IPA v1.0.17: https://expo.dev/artifacts/eas/kWHhX6gcrPpUBYT9Ky1AZg.ipa |
| Latest Android Production Build | v1.0.17 AAB (versionCode 8) — built 2026-04-07 — https://expo.dev/artifacts/eas/9iNjvH7L9AFjeVq8KB1uhp.aab — Submitted to Play Store closed testing track 2026-04-07, in review by Google |
| Latest Android Preview Build | v1.0.19 APK (versionCode 8) — https://expo.dev/artifacts/eas/ispu2yQ9ZFMWc8x2Wq6Hwb.apk — built 2026-04-14 (build id 8d5b2ad3-937d-46eb-b4ed-bc076413ae62, git commit 872dd58). Matches iOS v1.0.19 build 41 (currently in Apple review). Contains: `MAX_FREE_SCANS=3` lifetime (down from 10/month), Pro upsell banner on results screen, updated badge/alert text, all prior v1.0.18 card-reveal fixes, BR 442/642 disambiguation. Previous Latest Android Preview Build (v1.0.17 — Android 16 setTimeout fix + authIsLoading guard): https://expo.dev/accounts/stephenlear1/projects/locosnap/builds/be527909-08eb-4ef9-b95e-d6ba89180f6f |

### Android APK Build History

Every APK shipped to testers must be recorded here on the day it is sent.

| Date | Version | What Was In It | APK Link | Sent To |
|------|---------|---------------|----------|---------|
| 2026-03-24 | v1.0.5 (preview build 3) | Card-reveal animation crash fix (native driver separation on Android). authStore SIGNED_OUT recovery fix. Account cross-contamination fix (_layout). S-Bahn 480/485 pantograph disambiguation. LU vintage stock fixes (A Stock, 1960 Stock, CO/CP). 15 new German class disambiguation rules in vision prompt. | https://expo.dev/artifacts/eas/9Zk2rLcqzY9n8Ruc4Sk9Bj.apk | 13 Android testers (full list) |
| 2026-03-26 | v1.0.5 (preview) | Card-reveal animation crash fix. S-Bahn 480/485 now distinguished by pantograph check. DR Class 156 corrected to Legendary rarity (only 4 built). | https://expo.dev/artifacts/eas/uhB5zAZwTry8AiX5Y5QEaB.apk | Nero (gerlachr70@gmail.com) — new tester onboarding |
| 2026-03-27 | v1.0.6 (preview build 4) | ICE 3 family disambiguation (BR 403/406/407/408). 15 identification fixes including ICE T, BR 462/642, BR 480/481, LINT 41/Mireo, FLIRT/CD 654, VT 650/628, Twindexx/Talent 2. ICE 3 max speed corrected to 300 km/h. Paywall display bug fixes (currency localisation, purchase failure, copy). Account history no longer persists after sign-out. | https://expo.dev/artifacts/eas/uiYbj1NQVidPWUR3JhuQqW.apk | 13 Android testers (full list) |
| 2026-03-29 | v1.0.7 (preview build 5) | Collection photos in scan history. Cold start fix (scan buttons disabled until healthCheck resolves). photoUri plumbing (save, update to CDN, restore on viewHistoryItem). | https://expo.dev/artifacts/eas/ibpfRqcwWrjvvGuYB1M6y9.apk | 14 Android testers (full list) |
| 2026-03-30 | v1.0.7 (preview build 5) | Same build as above — onboarding two new testers. | https://expo.dev/artifacts/eas/ibpfRqcwWrjvvGuYB1M6y9.apk | foxiar771@gmail.com, dieterbrandes6@gmail.com |
| 2026-04-01 | v1.0.9 (preview build 5) | Remove key={i18n.language} from Tabs — attempted crash fix for Finnish tester (Samsung S24). Did not resolve crash. | https://expo.dev/artifacts/eas/bgSBn4vfGRTDzvdgubz3zy.apk | vattuoula@gmail.com (Finnish tester only) |
| 2026-04-01 | v1.0.10 (preview build 5) | Remove expo-localization plugin from app.json — second crash fix attempt. Still crashed: package still installed, JS still calling native APIs. | https://expo.dev/artifacts/eas/wd4MkHy6AQwVGcxp1Wnqc7.apk | vattuoula@gmail.com (Finnish tester only) |
| 2026-04-01 | v1.0.11 (preview build 5) | Remove expo-localization package entirely — correct fix. App defaults to EN on first launch; user switches to DE via picker. No native locale detection at startup. | https://expo.dev/artifacts/eas/451HLSXRSRiqoFAMpfm4sy.apk | vattuoula@gmail.com (Finnish tester only) |
| 2026-04-03 | v1.0.11 (preview — notification crash fix) | Notification launch crash fix: wrapped entire registerForPushNotifications() in top-level try/catch — getExpoPushTokenAsync and setNotificationChannelAsync now isolated so native exceptions on Samsung/Android 12+ devices cannot crash the app. Also includes: collection lock gate (free users see 5 scans), paywall improvements (annual first, Continue CTA, safety triggers, Full collection access copy), server-side scan gate auth token injection, IP rate limit (20/hour). | https://expo.dev/accounts/stephenlear1/projects/locosnap/builds/9e803686-c11a-4285-bbbc-5b1253cc9ba6 | vattuoula@gmail.com (Finnish tester only — awaiting confirmation) |
| 2026-04-04 | v1.0.12 (preview — Android 16 crash fix) | Android 16 startup crash fix: i18n init moved from module-level side effect into useEffect so it no longer runs during JS bundle evaluation in interpreted mode (confirmed Samsung S24 crash pattern). registerForPushNotifications() further hardened. Remove captureWarning for failed identifications (Sentry noise). EU07A type 303e specs (3.2 MW, 160 km/h) added to vision prompt. | https://expo.dev/artifacts/eas/8HWy5JKVxfNta337fvb1M7.apk | vattuoula@gmail.com (Finnish tester only — crash fix confirmation required before wider release) |
| 2026-04-05 | v1.0.13 (preview — Android FCM crash fix) | Skip FCM token fetch entirely on Android: `getExpoPushTokenAsync()` was triggering a native JNI crash on Android 16 (Samsung S24) when user tapped Allow on notification permission dialog. Confirmed by vattuoula screen recording — app reached notification dialog (i18n fix worked) but crashed immediately on Allow. Fix: return null early on Android before attempting FCM fetch. Safe because push notifications not yet live. | https://expo.dev/artifacts/eas/kmynXVcXb3gXuGwuYNYAfe.apk | vattuoula@gmail.com (Finnish tester — awaiting confirmation) |
| 2026-04-06 | v1.0.16 (preview — Android 16 infinite loop crash fix) | Removed `<Redirect href="/language-picker" />` from `_layout.tsx` entirely. Replaced with `useEffect([settingsLoading, languageChosen])` calling `router.replace("/language-picker")`. Root cause: `<Redirect>` mounts as a new component instance on every parent re-render; on Android 16 Zustand's `useSyncExternalStore` is synchronous and fires on every navigation event, causing `<Redirect>` to remount continuously — confirmed by stack frame `anonymous@1:874412` present in every v1.0.15 crash log. useEffect fires at most once per deps change and cannot remount. | https://expo.dev/accounts/stephenlear1/projects/locosnap/builds/ba143e37-ad40-4ed4-acc1-66529cec1f7d | vattuoula@gmail.com (Finnish tester — confirmed still crashing: grey/black screen on v1.0.16) |
| 2026-04-07 | v1.0.17 (preview — Android 16 definitive crash fix) | Wrapped `router.replace("/language-picker")` in `setTimeout(0)` inside `_layout.tsx` useEffect. Root cause confirmed via bug report dumpstate.txt: `router.replace` triggers `performSyncWorkOnRoot` (synchronous React commit), during which `flushLayoutEffects` fires expo-router layout effects, which trigger Zustand's `forceStoreRerender`, attempting to schedule a new render inside an active commit — crashes on Android 16/Hermes with "Maximum update depth exceeded". Stack bottom: `flushPassiveEffects → performSyncWorkOnRoot → ... → forceStoreRerender`. `setTimeout(0)` defers navigation to a new macrotask, completely outside any React commit cycle. Also added `authIsLoading` guard: settings resolves before Supabase getSession(), so router.replace could fire before AuthGate unmounts its spinner and the Stack mounts — second crash window. | https://expo.dev/accounts/stephenlear1/projects/locosnap/builds/be527909-08eb-4ef9-b95e-d6ba89180f6f | vattuoula@gmail.com (Finnish tester — awaiting crash confirmation) |
| 2026-04-14 | v1.0.17 (preview build 5 — same build as 2026-04-07) | Onboarding new Polish tester Jan Kaczorkowski. Confirmed Pro slot via bilingual chase reply "yes" 2026-04-11. Sent install email with bilingual EN/PL body (Resend id 2c6ea6c2). Note: this was the last v1.0.17 distribution — v1.0.19 APK was built later the same day (see row below). | https://expo.dev/accounts/stephenlear1/projects/locosnap/builds/be527909-08eb-4ef9-b95e-d6ba89180f6f | krawiec.jr69@gmail.com (Jan Kaczorkowski — Polish tester) |
| 2026-04-14 | v1.0.19 (preview, versionCode 8, build 8d5b2ad3) | Android rebuild to match iOS v1.0.19 build 41. Contains all frontend changes from commits `ba7dd21` and `cc05910`: `MAX_FREE_SCANS=3` lifetime (down from 10/month), Pro upsell banner on results screen linking to `paywall?source=results_banner`, `free_limit_hit` analytics event rename, BR 442/642 disambiguation fix. Also includes all prior v1.0.18 card-reveal Rules of Hooks fix. Build duration 10m 58s, git commit 872dd58. EAS credits: on pay-as-you-go for April. | https://expo.dev/artifacts/eas/ispu2yQ9ZFMWc8x2Wq6Hwb.apk | Held until Apple approved iOS v1.0.19 — then distributed to 22 testers via bilingual EN/DE mass email 2026-04-14 after backend flip (commit `8c4cb7c`) |
| 2026-04-14 (evening) | v1.0.19 (same APK as above) | Mass distribution following Apple approval of iOS v1.0.19 build 41 and backend flip to `MAX_FREE_SCANS=3`. 23/23 Resend sends successful. 22 testers on bilingual EN/DE mass email; 1 separate personal EN/PL email to Jan Kaczorkowski (krawiec.jr69@gmail.com) who had just received v1.0.17 hours earlier. See tester_contacts.md "Last Mass Distribution" section for full Resend ID table. | https://expo.dev/artifacts/eas/ispu2yQ9ZFMWc8x2Wq6Hwb.apk | 22 mass recipients + 1 personal (Jan Kaczorkowski) — full list: Stephstottor, aylojasimir, christian.grama, dieterbrandes6, esseresser07, gazthomas, gerlachr70, jakubek.rolnik, jannabywaniec, jlison1154, joshimosh2607, kt4d.vip, leander.jakowski, mf.bruch, mike.j.harvey, muz.campanet, qwertylikestrains, scr.trainmad, scrtrainmadother, stevelear51, trithioacetone, vattuoula, krawiec.jr69 |
| 2026-04-15 | v1.0.19 — **CONFIRMED WORKING ON SAMSUNG S24 ANDROID 16** | Oula (vattuoula@gmail.com — Finnish tester) replied to v1.0.19 mass distribution confirming the app runs without crashes, opens fast, no lag on Samsung S24 Android 16 Finnish locale. This is the **first confirmation that v1.0.19 is stable on the Samsung S24 Android 16 hardware** that drove the entire crash-fix saga from v1.0.8 through v1.0.17. Oula also confirmed the green-circle-off-centre scan screen UI bug (originally reported 2026-04-07, fixed in subsequent build) is now visible as centred — spotted and thanked for it in the same message. Oula reported two new open items: Dr18 not identified, Dv12 has trouble identifying. Queued for next Finnish-rule session. | n/a — confirmation only | vattuoula@gmail.com (Oula) |

---

## 14. CI/CD — GitHub Actions

| Workflow | Trigger | Description |
|----------|---------|-------------|
| ci.yml | Push to any branch | Runs backend (93) + frontend (56) tests |
| preview.yml | PR with frontend changes | EAS preview build |

---

## 15. Repository

| Property | Value |
|----------|-------|
| GitHub | https://github.com/StephenLear/locosnap |
| Main branch | main |
| Backend source | `/backend/src/` |
| Frontend source | `/frontend/app/` |
| Website source | `/website/` |

---

## 16. Environment Variables (Backend)

```
# AI — need at least ONE
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Blueprints (optional if using OpenAI)
REPLICATE_API_TOKEN=r8_...

# Redis (optional — falls back to in-memory)
REDIS_URL=...

# Supabase
SUPABASE_URL=https://vfzudbnmtwgirlrfoxpq.supabase.co
SUPABASE_SERVICE_KEY=...

# Analytics (optional)
POSTHOG_API_KEY=...
POSTHOG_HOST=...
SENTRY_DSN=...

# RevenueCat (optional)
REVENUECAT_WEBHOOK_SECRET=...

# Server
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://locosnap.app
```

---

## 17. User Flow (Scan-First, No Guest Mode)

```
1. App opens → user goes directly to scanner (no auth gate)
2. Trial banner shows: "3 free scans to try — sign up to save your collection"
3. User scans (up to 3 times, counted in AsyncStorage)
4. On scan 4: "Create Your Free Account" prompt — sign-up gate
5. User creates free account → 3 lifetime scans, cloud sync, leaderboard
6. User upgrades to Pro → unlimited scans, all blueprint styles
```

**Key constants** (`authStore.ts`) — as of v1.0.19 (pending review):
- `PRE_SIGNUP_FREE_SCANS = 3` — trial scans before sign-up required
- `MAX_FREE_SCANS = 3` — lifetime limit for free accounts (changed from `MAX_MONTHLY_SCANS = 10` in v1.0.19)
- `PRE_SIGNUP_SCANS_KEY = "locosnap_presignup_scans"` — AsyncStorage key

---

## 18. Data Flow (Single Scan)

```
1. User takes photo
2. canScan() checked — trial/monthly limit enforced
3. App uploads photo to POST /api/identify
4. Backend pre-warms on app mount (healthCheck) to avoid cold start
5. Vision API identifies the train (Claude or GPT-4o)
6. Cache check — if train class+operator seen before, skip steps 7-9
7. Specs + Facts + Rarity fetched in parallel (Claude or GPT-4o)
8. Results cached in Redis (30-day TTL)
9. Blueprint generation starts async → returns taskId
10. Train data returned immediately to app
11. App displays results + polls GET /api/blueprint/:taskId
12. Blueprint completes → uploaded to Supabase Storage
13. Spot saved to Supabase (spots table) — authenticated users only
14. XP awarded, streak updated, achievements checked
15. Leaderboard updated
```

---

## 19. Beta Testers

### Android Testers (21) — notified by email

**Google Play closed testing opt-in status: 11 of 12 required (as of 2026-04-05). One more opt-in needed before the 14-day clock can start.**
- aylojasimir@gmail.com
- christian.grama@outlook.com (Christian-Gabriel — German, recruited via EU07 TikTok 2026-04-04 — added to Play Console closed testing, awaiting opt-in and in-app signup for Pro)
- dieterbrandes6@gmail.com (locosnapwerbung — organic TikTok promoter, recruited 2026-03-30)
- esseresser07@gmail.com
- gazthomas@hotmail.com
- gerlachr70@gmail.com (Nero — German ICE enthusiast, recruited via Frankfurt TikTok/Instagram ad 2026-03-26)
- jannabywaniec@gmail.com (Jan — Polish, recruited via TikTok 2026-04-04 — added to Play Console closed testing, awaiting opt-in and in-app signup for Pro)
- jakubek.rolnik@gmail.com (Jakub — Polish, recruited via TikTok 2026-04-05 — added to Play Console closed testing, opt-in link sent 2026-04-05, awaiting opt-in)
- mf.bruch@gmail.com (Max — German, Stephen's nephew — added to Play Console closed testing, full welcome + opt-in email sent 2026-04-05, awaiting opt-in)
- jlison1154@gmail.com
- joshimosh2607@gmail.com (recruited 2026-03-30)
- krawiec.jr69@gmail.com (recruited 2026-03-30)
- kt4d.vip@gmail.com
- leander.jakowski@gmail.com
- mike.j.harvey@gmail.com
- muz.campanet@gmail.com
- qwertylikestrains@gmail.com
- scr.trainmad@gmail.com
- scrtrainmadother@gmail.com
- Stephstottor@gmail.com
- trithioacetone@gmail.com (recruited 2026-03-29, corrected from foxiar771@gmail.com which was wrong)
- unsunghistories@proton.me
- vattuoula@gmail.com

**Email format:** Bilingual EN/DE. Logo (https://locosnap.app/images/icon.png) at top. No emojis. Include APK download link from EAS.

**MANDATORY: Always draft the email and present it to Stephen for approval before sending. Never send tester emails without explicit sign-off.**

**MANDATORY: When drafting emails in any language other than English, always include a full English translation in the same response so Stephen can review what is being sent. This applies to Polish, German, Finnish, and any other language. Never present a non-English draft without the English translation alongside it.**

### iOS TestFlight Testers (1) — notified by email
- rheintalbahnerneo@gmail.com (@Rheintalbahner_Neo)

**Email format:** English only. Include TestFlight link. No emojis.

| Tester | Email | Status |
|--------|-------|--------|
| @Rheintalbahner_Neo | rheintalbahnerneo@gmail.com | Invited ✅ |
| Czech tester's friend | confirmed 2026-03-31 | Invited ✅ |

---

## 21. Social Media Strategy

> Last updated: 2026-03-25. Research based on TikTok/Instagram niche analysis.

### Core Insight
No competitor in the rail niche has a product mechanic at the centre of their content. Francis Bourgeois (3.3M TikTok) never identifies, never explains — he performs joy. LocoSnap owns the technical knowledge layer, the ID mechanic, the rarity system, and the blueprint. Every scan is a repeatable content unit no other creator can produce.

### Accounts to Watch
| Account | Platform | Followers | What They Do | Gap LocoSnap Owns |
|---------|----------|-----------|--------------|-------------------|
| Francis Bourgeois (@francis.bourgeois) | TikTok/IG | 3.3M TikTok | Face-cam reaction + train footage. Zero education, zero ID. | Everything informational |
| Geoff Marshall (Geofftech) | YouTube | 100M+ views | Long-form documentary, research-heavy | Short-form platform-native content |
| TrainAndy (@trainandy) | TikTok | 37K | Trains + travel, platform-native | No ID mechanic, no rarity system |
| Jago Hazzard | YouTube | Growing | London transport + railway history | Live, real-time identification angle |
| #eisenbahn community | TikTok | Fragmented | German rail, no dominant personality | First-mover in DE market |
| Traintrack (traintrack.app) | TikTok | 557 | Competitor app, aggressive paywall | Better UX, rarity system, blueprints |

### Formats That Work Right Now
1. **Interrupted reveal** — scan + cut before result + return. Replay mechanic built in.
2. **Pass/Fail ID challenge** — freeze frame, "what class is this?", reveal in comments.
3. **Rare sighting documentation** — raw handheld, real audio, text overlay on rarity.
4. **Satisfying ASMR** — clean platform footage, no voiceover, real sound. Crosses out of niche.
5. **Did You Know drops** — one fact, 20-30 seconds, no list. Circulates outside the niche.
6. **Live app demo** — point, scan, result. The product sells itself.

### Posting Cadence
| Platform | Frequency | Format Mix |
|----------|-----------|------------|
| TikTok | 1 per day | Rotate: ID reveal, educational drop, ASMR/reaction |
| Instagram | 3x per week | 2 Reels + 1 carousel (carousels drive saves) |

### Hashtag Strategy
- **TikTok 3-3-3 rule:** 3 broad (#trains #railway #trainspotting) + 3 niche (#trainspotter #uktrains #locosnap) + 3 content-specific (class name, operator, etc.)
- **Instagram:** Hashtags in first comment, not caption. Keep captions clean for storytelling.
- **German audience tags:** #eisenbahn #zugspotter #bahnfotografie #zugfotografie #bahnliebe

### Posting Times
| Audience | Platform | Best Window |
|----------|----------|-------------|
| UK | TikTok | 6-9pm GMT weekdays |
| German | TikTok | 7-9pm CET Tue/Thu/Sun |
| Both | Instagram | Wednesday + Saturday evenings |

### Content Pillars (Rotate Weekly)
1. **Identify** — live app demo, challenge, interrupted reveal
2. **Educate** — Did You Know, class history, spec facts
3. **Rare** — rarity reveal, Legendary sighting, "this shouldn't exist"
4. **Aesthetic** — ASMR, blueprint reveal, journey time-lapse

### The TikTok Quote (Organic Social Proof)
> "This app is crazy." — unsolicited TikTok DM from a new user, March 2026.
Use as overlay text on future ad content. Do not attribute — let it stand alone.

### Video Production Standards

**End screen — mandatory elements:**
- LocoSnap app icon (`frontend/assets/icon-512.png`) centred above the app name — always present, no exceptions
- "LOCOSNAP" in large white Impact text below the icon
- "Free on App Store" in yellow (#FFFF00) Impact text
- "Coming soon to Android" in yellow (#FFFF00) Impact text
- Dark background (#0d0d0d)
- Duration: 2 seconds minimum

**Text overlays (ASS subtitle format for ffmpeg):**
- Font: Arial Black (Impact-weight, bold -1)
- Colour: yellow (`&H0000FFFF` in ASS AABBGGRR format = #FFFF00)
- Outline: black (`&H00000000`), 6px — essential for legibility over bright footage
- Size: minimum 110px at 720px wide (PlayResX 720, PlayResY 1280 portrait). Do not go smaller — text reads as an afterthought at 78px or below.
- Alignment: 2 (bottom-centre) unless overriding with `\an` tag
- Two lines maximum — keep it punchy, not explanatory
- No time claims for blueprint generation (takes up to 60 seconds in the app)
- ASS style reference (720p portrait): `Style: Impact,Arial Black,110,&H0000FFFF,&H000000FF,&H00000000,&HA0000000,-1,0,0,0,100,100,0,0,1,6,2,2,30,30,100,1`
- **Character limit per line (tested 2026-04-15 on BR 143 build)**: At 110px Arial Black width 720px with 6px black outline, the safe maximum is **10 characters comfortably, 11 tight but OK, 12 or more overflows the frame edges**. Tested fits: "DIE BR 143" (10) ✓, "646 GEBAUT" (10) ✓, "FAST WEG" (8) ✓, "STIRBT AUS" (10) ✓, "DAS DR-ERBE" (11) tight but OK. Tested overflows: "VERSCHWINDET" (12) ✗, "IS VANISHING" (12) ✗ — both had to be replaced during the BR 143 build cycle. Always count characters before finalising overlay text; plan shorter alternatives for long German compound words. Earlier handover notes claimed a "9-char safe limit" which is outdated — actual tested limit is 10–11.

**Hook structure:**
- Frame 1 must be a pattern interrupt — moving train or strongest visual asset
- Never open on the scan UI or app chrome
- Blueprint reveals go after the footage cut, not before

---

## 20. Known Limitations / Pending Work

| Item | Status |
|------|--------|
| Render cold start | Resolved 2026-03-31 — upgraded to Starter ($7/month). Dyno stays live permanently. REACT-NATIVE-1 Sentry issue should stop recurring. |
| ~~Android v1.0.11 — awaiting Finnish tester confirmation~~ | **RESOLVED 2026-04-15.** The Android 16 Samsung S24 crash saga is closed. v1.0.19 is confirmed running without crashes, opening fast, with no lag on vattuoula@gmail.com's Samsung S24 Android 16 Finnish-locale device. The progression: v1.0.11 removed expo-localization (partial fix), v1.0.17 wrapped router.replace in setTimeout(0) to defer navigation out of React commit (Android 16/Hermes "Maximum update depth" fix), and v1.0.19 inherits both plus the BR 442/642 disambiguation and 3-scan paywall. Oula confirmed the green-circle scan screen UI bug is also fixed. Finnish-class vision rules for Dr18 and Dv12 (Oula's open feedback 2026-04-15) shipped 2026-04-18 — dedicated Fenniarail Dr18 rule (operator not VR, 6-unit fleet, CZ Loko builder, Co'Co' hood-unit, legendary rarity) and deepened Dv12 rule (livery corrected from orange/white to red-with-light-grey historic, 192 units, Valmet/Lokomo builder, disambiguation vs Dr14/Dr16/Dr19). Pending push to Render. |
| Android auto-submit to Play Store (v1.0.7) | Infrastructure set up (service account, API enabled, eas.json updated). Submit pending service account permission propagation. Retry: eas submit --platform android --profile production --id f040f353-97cf-4804-b1d6-11608f6706f0 --non-interactive. Note: do not commit eas.json with local absolute path to play-store-key.json — it will not exist in EAS Build environment. |
| Competitor noted: Traintrack (traintrack.app) | iOS/Android, 557 followers TikTok, aggressive paywall, launched 2026. Monitor. |
| Sentry source maps | Add SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT to EAS secrets |
| Offline spot sync | Spots scanned while offline are saved locally but never synced to Supabase when connectivity restores. Need to track unsynced items (local timestamp ID vs Supabase UUID) and sync on reconnect/foreground. Medium priority. |
| History pagination | MAX_HISTORY raised to 200 — no pagination yet |
| ICE 1 weight validation (< 10 tonnes = reject) | Pending |
| Dual-voltage Czech/Slovak trains in specs prompt | Pending |
| Czech tester's friend — add to TestFlight | Need Apple ID email |
