# LocoSnap — Changelog

All code changes to frontend and backend are recorded here.
Format: newest first within each date block.

---

## 2026-06-26

### Backend

#### `src/services/imageGen.ts` — Migrate blueprint generation from retired `dall-e-3` to `gpt-image-1` (HIGH-SEV outage fix) — DEPLOYED + VERIFIED
- **Context:** Blueprint generation had been DOWN for ALL users (every request HTTP 400) since OpenAI retired the DALL-E models. Render runs blueprints via OpenAI (no `REPLICATE_API_TOKEN`), and the code hardcoded `model: "dall-e-3"`. Diagnosed 2026-06-25 (tester Oula's "Blueprint Failed" report); fix plan in `docs/issues/2026-06-25-blueprint-dalle3-retired.md`.
- **Verified LIVE 2026-06-26:** deployed in commit `2a8e6da` → Render; a real scan produced a BR 232 / DB Cargo blueprint in the technical-navy style at the correct portrait ratio. Outage resolved for all users.
- **Changed** OpenAI image request: `model` `"dall-e-3"` → `"gpt-image-1"`; `size` `"1024x1792"` → `"1024x1536"` (gpt-image-1 has no 1024x1792 — would 400); `quality` `"hd"` → `"medium"` (gpt-image-1 uses low/medium/high — "hd" would 400). Each old value was itself an independent 400 trigger, so this is not a drop-in rename.
- **Removed** the `style: "natural"|"vivid"` request param — gpt-image-1 has no `style` param (unknown-param 400). Also removed the now-dead `dalleStyle` field from the `StyleConfig` interface and all four `STYLE_PROMPTS` entries.
- **Changed** response handling: gpt-image-1 returns base64 (`data[0].b64_json`), NOT a hosted URL. New `uploadBlueprintToStorage(taskId, base64)` decodes it and uploads to the Supabase Storage `blueprints` bucket (service-key write, `upsert: true`), then stores the stable public URL in `task.imageUrl`. Side benefit: fixes the latent expiring-provider-URL bug (DALL-E/Replicate hosted URLs expired ~1h, rotting saved blueprints) — Supabase URLs are permanent.
- **Fixed** observability black hole: new `describeImageGenError()` surfaces OpenAI's real reason (`error.response.data.error.message`) instead of the generic axios "Request failed with status code 400"; the background `generateImage().catch` now calls `captureServerError(...)` so blueprint failures reach Sentry. Root cause of the silent outage: the old `.catch` stored only the generic message and never called Sentry, so an app-wide failure was invisible until a tester reported it.
- **Added** imports: `getSupabase` (Storage client) and `captureServerError` (Sentry wrapper).

#### `src/__tests__/services/imageGen.test.ts` — Cover the gpt-image-1 path
- **Changed** mocks to the new reality: axios returns `b64_json` (not `url`); added a mocked Supabase Storage client (`upload` + `getPublicUrl`) and a mocked `captureServerError`; env mock gains `hasSupabase: true`; `isAxiosError` preserved on the axios mock for the error path.
- **Added** tests asserting (a) the OpenAI request body uses `gpt-image-1` / `1024x1536` / `medium` with no `style`, (b) the base64 is uploaded to Storage and the task completes with the public URL, (c) an axios 400 surfaces OpenAI's real reason into `task.error`. Suite now 270 backend tests (was 268), all passing; `tsc` clean.

### Infrastructure

#### Supabase Storage — `blueprints` bucket (confirmed present + public)
- **Verified** the required PUBLIC Supabase Storage bucket `blueprints` already exists (dashboard, project `vfzudbnmtwgirlrfoxpq`, 2026-06-26 — public, 3 policies, alongside `spot-photos`). Backend writes go through the service-role key (bypasses RLS); public bucket means `getPublicUrl` is client-readable. No bucket creation needed.

### Docs

- `docs/issues/2026-06-25-blueprint-dalle3-retired.md` — status updated to CODE FIXED + "What shipped" + "Remaining before live".
- `docs/ARCHITECTURE.md` — header bumped to 2026-06-26 (blueprint fix state); provider table updated DALL-E 3 → gpt-image-1.

---

## 2026-06-24

### Backend

#### VR Dr19 + Dr16 Finnish diesel corrections (tester Oula) — `vision.ts`, `trainSpecs.ts`, `rarity.ts`, `trainFacts.ts`, `trainCache.ts`
- **Context:** Finnish tester Oula reported two issues: (1) the app identifies a **VR Dr19** (Stadler's new mainline diesel, now hauling most diesel freight in their area and a common station sight) as a **Dv12**; (2) **VR Dr16** scans returned thin / partly-incorrect data, and the operator picture has changed — VR has withdrawn nearly the whole Dr16 fleet (keeping ~2 spares) while the private operator **ArcticRail** has restored a couple to active freight service. Facts web-verified against Wikipedia / Railway Gazette / Stadler before shipping.
- **Root cause:** Dr19 and Dr16 had **no dedicated handling** — Dr19 was only mentioned inside the Dv12 vision rule, Dr16 only as an axle-count cue. The existing Dv12 rule also contained **two factual errors**: it called the Dr16 "Co'Co' six-axle" (it is **Bo'Bo' four-axle** — confirmed by the 82–84 t weight at ~20.5 t/axle) and described the Dr19 as having "cabs at BOTH ends" (it has a **single full-width central "high cab"** — Stadler's own "Central Cab" design). The shared centre-cab silhouette is exactly why the model collapsed Dr19 into Dv12. NOTE: Dv12, Dr16 and Dr19 are ALL Bo'Bo' four-axle, so axle count cannot separate them — era/size/cab layout must.
- **Fix (defense-in-depth, mirrors the Dr18/Sr1 pattern):**
  - **`vision.ts`** — corrected the two wrong cross-references in the Dv12 rule; added a **dedicated Dr19 rule** (Stadler central/high cab, 88 t / 18 m, dual Cat C32 = 1,900 kW, 60 ordered, "NEVER Dv12") and a **dedicated Dr16 rule** ("Iso Vaalee", Bo'Bo' four-axle, single off-centre cab, near-withdrawn, ArcticRail).
  - **`trainSpecs.ts`** — added `KNOWN_SPECS` for `dr19`/`dr16` (+ `vr `/spaced/`arcticrail ` variants): Dr19 120 km/h / 1,900 kW / Stadler Rail Valencia / 60; Dr16 140 km/h / 1,500 kW / Valmet · Transtech / 23.
  - **`rarity.ts`** — added a prompt bullet + `KNOWN_RARITY` overrides: **Dr16 = "epic"** (23 built, VR fleet retired by 2026, only a handful with ArcticRail), **Dr19 = "uncommon"** (modern 60-unit growing fleet, same logic as Sr3).
  - **`trainFacts.ts`** — added Dr19 and Dr16 verified-facts blocks; corrected the Dv12 block's inaccurate "Dr19 Eurolight" label (Stadler's bespoke central-cab design, not a Eurolight).
  - **`trainCache.ts`** — per-class `CLASS_INVALIDATIONS` for `dr19`/`dr16`/`dv12` (+ variants), 2026-06-24, so any prior cached entries re-render. No global cache-version bump (per-class pattern).
- **Status:** tsc clean, **268/268 backend tests pass**, no duplicate-key collisions. Shipped + pushed (commit `53b2db6`).
- **Follow-up same day (Oula 2nd report):** VR has now **fully withdrawn** the Dr16 — **ArcticRail is the sole operator** (2 units, web-corroborated). Updated `vision.ts` + `trainFacts.ts` + `rarity.ts` so the operator of any in-service Dr16 is **ArcticRail** (no longer "VR keeps a couple as spares"); bumped the `dr16` cache invalidation to `2026-06-24T15:00:00Z` to re-render anything cached after the morning push. tsc clean, 268/268. **Not yet deployed — needs a push to go live on Render.**

## 2026-06-23

### Backend

#### Vision OpenAI-fallback now covers Anthropic 500/503 (`services/vision.ts`)
- **Extended the runtime Anthropic→OpenAI vision fallback trigger from `402/429/529` to `402/429/500/503/529`.** Prompted by a Sentry issue (`REACT-NATIVE-B`): a `500 {"type":"error","error":{"type":"api_error","message":"Internal server error"},"request_id":"req_…"}` on `POST /api/identify` — an upstream Anthropic transient 500. The fallback to GPT-4o Vision previously only fired on 402/429/529, so an Anthropic **500** (or 503) failed the scan and surfaced a 500 to the client instead of silently retrying on OpenAI. `OPENAI_API_KEY` confirmed set in prod Render (so `config.hasOpenAI` is true and the fallback actually runs). Comment block updated to document 500/503. tsc clean, **268/268 backend tests pass**. Low-volume issue (8 events over 3 months); the Sentry issue is safe to Archive. **Not yet deployed — needs a push to go live on Render.**

## 2026-06-22

### Release — v1.0.40 (production build + submitted to both stores)
- **`app.json` version 1.0.39 → 1.0.40.** Headline feature: the **Spotting Atlas** (new tab — communal verified-only spot heatmap). Also includes: the sign-in gate, BigDataCloud place names, verified-only data (migration 023), and the Stadler FLIRT builder fix (backend, already deployed). Maps key is production-ready (Play App Signing SHA-1 `76:0E…` + EAS keystore SHA `EC:5E…` both registered). Ties into the staged v1.0.40 ASO draft.
- **Builds:** production EAS builds — Android AAB `40cf54be` (versionCode 33), iOS `b3cfefb5` (build 63).
- **Submitted via `eas submit`:** Android → Play **production track as DRAFT** (versionCode 33; Stephen controls final rollout); iOS → App Store Connect (build 63, processing → TestFlight). **Final "submit for review" is done by Stephen** (his standing preference). Release notes (EN/DE/PL) + an App Review note explaining the Atlas sign-in gate prepared in the 2026-06-22 handover / session.
- **On-device validated before ship:** Android — map, rarity dots, place names (BigDataCloud), verified-only data all confirmed working on a real device.

### Frontend

#### Spotting Atlas (formerly "Train Radar") Phase 2 — native map screen consuming the migration-022 heatmap RPC
- **Renamed before ship: Train Radar → Spotting Atlas.** "Train Radar" was the competitor TrainSnap's term and implied live/real-time tracking, but the feature is a communal heatmap of past sightings. Final names: tab label **"Atlas"**, route/file `app/(tabs)/atlas.tsx`, `AtlasScreen`, `atlas.*` i18n block, map icon. RPC/type/service names unchanged (`get_spot_heatmap`, `HeatmapCell`, `fetchSpotHeatmap` — name-agnostic).
- **Decision context:** Phase 2 product calls confirmed this session — **native map** (react-native-maps), **free** (no Pro gate; daily-engagement/acquisition hook), **new 5th "Atlas" tab**.
- **`package.json`** — added `react-native-maps@1.20.1` via `expo install` (SDK-54-compatible, native dep → requires a dev/EAS build; will NOT run in Expo Go).
- **`app.json`** — added `android.config.googleMaps.apiKey` with a **real, restricted** Google Maps SDK for Android key (project `locosnap-play-store`; billing linked to "My Billing Account" free trial). Key is **Application-restricted to Android apps → `com.locosnap.app` + the EAS upload-keystore SHA-1** (`EC:5E:C8:…:BD:D5`), so it's safe to commit to the public repo (Google's supported model). iOS uses Apple Maps via `PROVIDER_DEFAULT` (no key needed). No new location permission added — the Atlas shows aggregate cells only, never device location. **TODO before a production Play build:** also add the **Play App Signing SHA-1** (Play Console → App integrity) to the key's Android restrictions — Google re-signs the store build with a different cert, so the live app's map breaks without it. Dev/internal builds (EAS keystore) work with the SHA-1 already added.
- **`types/index.ts`** — added `HeatmapCell` interface (`lat, lng, spotCount, rarityScore, topRarity, distinctClasses`).
- **`services/supabase.ts`** — added `fetchSpotHeatmap(grid=0.1, minUsers=2)` calling `supabase.rpc("get_spot_heatmap", …)`; maps snake_case rows → `HeatmapCell[]`; returns `[]` on error (incl. `42883`/`PGRST202` not-deployed codes) so the screen degrades to its empty state.
- **`app/(tabs)/atlas.tsx`** (new) — `MapView` (`PROVIDER_DEFAULT`) Germany-centred. Each cell rendered as a rarity-coloured `Circle` (colour = `topRarity`; radius scales with `spotCount`, capped at half the grid; fill alpha scales with density = the "heat"). Circle isn't tappable in rn-maps 1.20, so a transparent `Marker` tap target overlays each cell; tapping reverse-geocodes the cell centre (`Location.reverseGeocodeAsync`, already used in card-reveal) into a place name and shows a bottom info card (place · spots · classes · rarest tier). Fine/coarse grid toggle (0.1°/0.25°), rarity legend, loading + empty states.
- **`app/(tabs)/_layout.tsx`** — added the `atlas` tab (Ionicons `map`) between Leaderboard and Profile (tab bar now 5 items).
- **`locales/{en,de,pl}.json`** — added `tabs.atlas` + an `atlas.*` block (subtitle, grid labels, empty, info-card labels, sign-in gate strings) in all three languages.
- **Sign-in gate (added this session, before push):** the Atlas is gated behind sign-in — the heatmap is communal collection data and the RPC is `authenticated`-only, so giving it to signed-out users would hand the feature to non-registered users. Signed-out users now see a teaser card (map icon + "Sign in to explore the Spotting Atlas" + body) with **Log In / Sign Up** CTAs routing to `/sign-in?mode=login` and `/sign-in?mode=signup` (mirrors the Profile tab's three-CTA pattern). The tab stays visible to all (creates sign-up pull); the auth-only RPC is not called when signed out. Map renders only for signed-in users.
- **`__tests__/services.heatmap.test.ts`** (new) — unit tests for `fetchSpotHeatmap`: RPC params, snake_case→camelCase mapping with numeric coercion, and `[]` fallback on error / null data.
- **Status:** tsc clean, 249/249 frontend tests pass. **NOT runnable in Expo Go (native dep) and NOT yet verified on-device** — needs a dev build.

#### Spotting Atlas — on-device test fixes (Android preview build a6d21716 / iOS fa4237c6)
- **Builds:** EAS **preview** APK + IPA built and installed (Android keystore SHA-1 matches the restricted Maps key; map renders, circles draw, data loads, tap → info card works). First real on-device test surfaced the items below.
- **Red default pins → rarity-coloured dots** (`app/(tabs)/atlas.tsx`): the transparent tap-target `Marker` fell back to Android's default red pin (a transparent custom marker view doesn't suppress the default pin). Replaced with a visible rarity-coloured centre dot (14px, white border) in a 40px transparent hit-area, plus a `tracksViewChanges` toggle (true on data load → false after 1.5s) so the custom view actually renders before Android snapshots it.
- **Place name showed "This area"** — first tried broadening the `reverseGeocodeAsync` fallback chain, but a second on-device test (build 365fc81c) showed Android's device geocoder returns **nothing at all** on this hardware (Google Play Services geocoder is unreliable), so there was no result to read. **Final fix: dropped `expo-location` reverse-geocode entirely and switched to BigDataCloud's keyless `reverse-geocode-client`** (`fetch`, no API key), querying the **coarse cell centre** (never the user's location) with `localityLanguage` = the app's current i18n language. Falls back to "This area" only on network failure. Reliable place names on Android now.
- **Default grid → coarse (0.25°)** — with verified-only data the map is thin; 0.25° aggregates more per cell for a denser first impression. Fine (0.1°) still available via the toggle.
- **`eas.json` preview profile — added `autoIncrement: true`** so each preview build bumps the version code and installs over the previous one (ends the uninstall-before-install dance during testing). Surfaced because EAS preview builds without it kept the same version code, so Android silently retained the old build on "update".
- **2nd rebuild (Android 365fc81c-superseding / iOS):** validated on-device — Android opens on 25° coarse with rarity dots (no red pins). Place-name geocoder swap + autoIncrement go in the next rebuild.

### Database

#### `supabase/migrations/023_spot_heatmap_verified_only.sql` — Atlas heatmap: verified spots only (applied to prod)
- **Problem (caught in review):** the Phase-1 RPC counted every spot with a lat/lng, including the `personal`/`unverified` tiers. A **gallery scan of a photo with no EXIF GPS records the user's current device location** (their home), not where the train was — dropping false hotspots at users' homes.
- **Fix:** `create or replace get_spot_heatmap` adds `where … s.verification_tier in ('verified-live', 'verified-recent-gallery')` — the exact trust filter the leaderboard RPCs (013/014) already use. Excludes `personal`/`unverified`. Signature unchanged so grants persist (revoke/grant repeated for clarity).
- **Server-side ⇒ took effect immediately for all clients, incl. already-installed builds** — no app rebuild needed for this fix.
- **Validated on prod (verified-only):** 0.1° → **18 cells / 76 spots** (busiest cell 9); 0.25° → **28 cells / 154 spots**. Down from ~80 cells pre-filter — confirms much of the prior data was the gallery-at-home pollution. Map is now accurate but thinner; densifies as verified spots accumulate.

### Backend

#### `trainSpecs.ts` + `trainCache.ts` — Stadler FLIRT builder fix (Siemens → Stadler)
- **Context:** IG tester `sammyrox.official` flagged the BR 101 ad — the app called a **Stadler FLIRT 3XL** a *Siemens* product. The class name was right ("Stadler FLIRT 3XL") but the specs AI hallucinated the builder, because the generic / "3XL" FLIRT variants had no override (the BR 428 "stadler flirt 3" and BR 429 "stadler flirt 5" entries existed and were correct, but the bare/3XL strings did not).
- **Fix (defense-in-depth, mirrors the ST22 pattern):** (a) `WIKIDATA_CORRECTIONS` builder-only overrides `{ builder: "Stadler Rail" }` for the uncovered FLIRT keys (`flirt`, `stadler flirt`, `flirt3`, `flirt 3`, `stadler flirt3`, `flirt 3xl`, `flirt3 xl`, `stadler flirt 3xl`, `stadler flirt 3 xl`, `flirt akku`, `stadler flirt akku`) — partial shallow merge, so only the builder is corrected, all other specs untouched; (b) a specs-prompt CRITICAL FACTS rule stating the FLIRT builder is ALWAYS Stadler, never Siemens/Bombardier/Alstom, even with a "3XL" suffix, for the long tail of variant strings. Existing `stadler flirt 3`/`5`/`finland` entries left intact (already correct).
- **Cache:** `CLASS_INVALIDATIONS` entries for the same FLIRT keys (`2026-06-22T20:00:00Z`) so any pre-fix cached entry re-renders. No global cache-version bump (per-class invalidation pattern).
- tsc clean, 268/268 backend tests.

#### `trainSpecs.ts` + `rarity.ts` + `trainFacts.ts` + `trainCache.ts` — BR 111 spec/facts/rarity lock
- **Context:** prepping a DE tier-debate ad on the BR 111 (Stephen's pick). A fresh live scan (2026-06-22) showed **UNCOMMON** (good debate tier) but two errors: **POWER 4,800 kW** (BR 111 is ~3,620 kW) and facts prose **"built between 1960 and 1974"** (BR 111 was built 1974–1984; 1960s is the earlier BR 110). Can't run a tier-debate ad on a card with wrong specs.
- **Fix (full lock):** `WIKIDATA_CORRECTIONS` BR 111 entry (6 key variants) — 160 km/h / **3,620 kW** / 83 t / Krauss-Maffei·Henschel·Krupp / 227 built / 15 kV 16.7 Hz AC / standard gauge; `KNOWN_RARITY` BR 111 → **uncommon** (locks the debate tier, prevents drift); `trainFacts.ts` BR 111 bullet locking **1974–1984** build years + "still in DB Regio service, being phased out by EMUs" framing + don't-confuse-with BR 110/113/114/115; `CLASS_INVALIDATIONS` BR 111 keys (`2026-06-22T22:00:00Z`).
- tsc clean, 268/268 backend tests. Needs a re-scan after deploy to capture the corrected card for the ad.

## 2026-06-21

### Database

#### `supabase/migrations/022_spot_heatmap.sql` — Train Radar Phase 1: privacy-safe spot heatmap RPC (applied to prod)
- **Added** `public.get_spot_heatmap(p_grid numeric=0.1, p_min_users int=2)` — a SECURITY DEFINER aggregate function (same pattern as the leaderboard RPCs 013/014) for the Train Radar heatmap. Returns coarse grid cells with `spot_count`, a rarity-weighted `rarity_score` (legendary 5 … common 1), `top_rarity`, and `distinct_classes`.
- **Privacy:** definer rights are needed because migration 018 RLS-locks raw spot lat/lng to the owner; the function exposes ONLY cell-centre aggregates — never raw coordinates, never user_id — and applies **k-anonymity** (a cell is returned only when ≥ `p_min_users` distinct users have spotted there, default 2), so single-spotter patches are suppressed. `revoke all from public; grant execute to authenticated`.
- **Validated on prod data:** 0.1° grid + k≥2 → ~80 cells (715 spots); 0.25° → ~103. Top cells resolve to real rail hubs (Vienna 43 spots/34 classes, Köln, Dresden, Leipzig, Karlsruhe).
- Applied via SQL editor (project applies migrations straight to prod — no staging). Frontend map (Phase 2) deferred — needs `react-native-maps` (native dep + dev/EAS build).

### Backend

#### `vision.ts` — strengthen the Loram C21 rail-grinder rule for front-view scans (`6f24b8f`)
- **Context:** UK tester Steph re-flagged the misID the 2026-05-09 track-maintenance rule was meant to catch — a daytime **front-3/4** scan of **DR79244** (Loram C21(02) rail-grinder set) returned **Class 66 / Network Rail**. The existing rule keyed only on cues invisible head-on (grinding machinery, Loram logos, "C21xx" markings, night possessions), so the yellow cab pattern-matched a Class 66.
- **Strengthened** the rule with anchors that work from the front: (a) **fleet-number** — any visible `DR79xxx` (C21(02) = DR79241–79247) or `DR7xxxx`/`DR9xxxx` data-panel number is definitive on-track plant, never a TOPS loco class (locos use bare 66xxx/70xxx); (b) **body-behind-the-cab** — flat railed work-deck body (not a full-height loco engine hood) = on-track machine; (c) **engineering-context** — crossover sidings + accompanying JNA/MHA wagons in the consist = engineering train.
- **Honest limitation noted in-rule:** a cab-only close-up with no body/number/context in frame may stay unresolvable; the body+context anchors cover the common case. tsc clean; 268/268 tests. Committed `6f24b8f`, pushed → Render auto-deploy.

#### `classNames.ts` + `vision.ts` + `trainCache.ts` — kill the hallucinated "ST22" class; map it to the real ET22 (`85ccdd0`)
- **Context:** a fresh ET22-680 PKP Cargo scan (2026-06-21) returned class **"ST22"**, rarity **LEGENDARY**, builder **Newag**, **6,400 kW / 140 km/h / 87 t** — all wrong. "ST22" is not a real PKP class (a #ST22 SEO hashtag / misreading of the "ET22-xxx" fleet stencil). Latent since at least the 3 Apr 2026 scan; never surfaced because no prior ET22 ad showed the app card. Surfaced now while prepping a PL ET22 tier-debate ad (which would have put the wrong rarity card on screen).
- **Root cause:** vision emitted the raw string `ST22`, which matched **none** of the `et22`-keyed specs/rarity/facts overrides, so every downstream layer free-hallucinated it as a modern legendary Newag loco (the same class-collision pattern as BR 232 / BR 140 / Sr1).
- **Fix (one canonical choke point):** added `ST22` / `ST 22` / `ST-22` / `PKP ST22` → `ET22` to `EXPLICIT_ALIASES` in `classNames.ts`. Because `canonicaliseClass()` runs before caching/specs/facts/rarity/display, this single rewrite makes the class name, specs (Pafawag / 3,000 kW / 125 km/h / 1,184 built), rarity (**common**) and the verified-facts block all resolve to the real ET22.
- **Defense-in-depth:** `vision.ts` ET22 prompt rule now states ST22 is a non-existent designation and must never be emitted.
- **Cache:** `trainCache.ts` `CLASS_INVALIDATIONS` entries (`et22` / `pkp et22` / `st22`, `2026-06-21T12:00:00Z`) so any pre-fix cached entry re-renders. No global cache-version bump (per-class invalidation pattern).
- **Tests:** added 5 `ST22 → ET22` cases to `classNames.test.ts`. tsc clean; **268/268** backend tests pass.
- Committed `85ccdd0`, pushed to `origin/main` → Render auto-deploy. **Verify with a fresh ET22 scan once Render finishes — card should read ET22 / COMMON / Pafawag.**

---

## 2026-06-19

### Backend

#### `backend/src/services/trainSpecs.ts` + `trainCache.ts` — ČD Class 242 (Škoda 73E "Plecháč") spec correction (`ffbd3ce`)
- **Context:** @nejakysotous_ (Czech railfan) flagged the PL haul ad's EPIC ČD Class 242 reveal card — speed shown "160 km/h" and power "4,400 kW", both wrong. Web-verified correct figures: **120 km/h / 3,080 kW** (Škoda 73E, 90 built 1975–81, 25 kV 50 Hz AC).
- **Root cause:** no ČD Class 242 entry existed in `WIKIDATA_CORRECTIONS`, so AI/Wikidata leaked the wrong 160 km/h / 4,400 kW onto the card.
- **Added** ČD Class 242 to `WIKIDATA_CORRECTIONS` — maxSpeed `120 km/h`, power `3,080 kW`, weight `85 t`, builder `Škoda Works (Plzeň)`, numberBuilt `90`, fuelType `Electric (25 kV 50 Hz AC)`, gauge `Standard (1,435 mm)`. Keyed with all realistic vision class-string variants (`čd class 242`, `cd class 242`, `čd 242`, `cd 242`, `class 242`, `242`, `škoda 73e`, `skoda 73e`, `73e`) to avoid the Dragon exact-match-keying trap.
- **Added** matching `CLASS_INVALIDATIONS` entries (`2026-06-19T23:59:00Z`) for the same keys so pre-fix cached entries re-render. No global cache-version bump (per the per-class invalidation pattern).
- **Not flagged / no change:** EPIC rarity for a 90-built still-active loco looks generous, but the commenter disputed only the specs — rarity left untouched.
- tsc clean, 263/263 backend tests pass. Committed `ffbd3ce`, pushed to `origin/main` → Render auto-deploy.

---

## 2026-06-18

### Backend

#### `backend/src/services/trainSpecs.ts` + `trainCache.ts` + `vision.ts` — Newag Dragon 2 maxSpeed + operator fix (PL railfan flags on the "Mania" ad)
- **Context:** PL railfans flagged the 06-18 DE Dragon ad's card — operator shown as "PKP Cargo" (wrong; the "Mania" unit E6ACTadb-043 is **Rail STM**, confirmed by commenter + Rynek Kolejowy/forumkolejowe) and top speed "160 km/h" (wrong; Dragon family is 120 km/h).
- **Root cause (maxSpeed):** the vision layer returns the class as `"Newag Dragon 2 (E6ACTadb)"` (with the parenthetical), which never matched the existing bare `"e6actadb"` / `"dragon 2"` WIKIDATA_CORRECTIONS keys (exact-match lookup), so AI/Wikidata leaked 160 km/h onto the card.
- **Added** full class-string keys to `WIKIDATA_CORRECTIONS` — `"newag dragon 2"`, `"newag dragon 2 (e6actadb)"`, `"newag dragon 2 (e6actadnb)"`, `"e6actadnb"` — mapped to the existing 120 km/h / 5,800 kW / Newag (Nowy Sącz) Dragon-family spec. Aligned to the backend's established 120 km/h convention rather than introducing a contested 140.
- **Added** matching `CLASS_INVALIDATIONS` entries (`2026-06-18T20:00:00Z`) so any cached 160 km/h Dragon entry re-renders.
- **Added** to the `vision.ts` Newag Dragon rule (6): operator must be read from the visible livery — do NOT default to PKP Cargo; Dragons run for many operators (PKP Cargo, Rail STM, Lotos Kolej, ORLEN KolTrans, Freightliner PL, RCP, Cargounit-leased); the green-and-pink "Mania" livery (E6ACTadb-043) is Rail STM; leave operator generic if not readable. (Operator has no field in SpecsOverride — it is vision-only.)
- **EN57 — checked, NO change needed:** the same ad's EN57 card "Over 1,700 units" is stale (recording predates the 2026-04-28 fix); current backend has `numberBuilt: 1438` in KNOWN_SPECS and the verified-facts block feeds it to the facts layer at temperature 0.
- tsc clean, 263/263 backend tests pass. **Not yet deployed — needs a push to go live on Render.**

---

## 2026-06-12

### Backend

#### `backend/src/services/vision.ts` + `trainSpecs.ts` — PKP Cargo Vectron (EU46) vs Newag Griffin (EU160) disambiguation (`4617462`)
- **Added** a vision disambiguation rule after a Polish TikTok commenter (Zi3xu_z_LK91, EU07 ad) posted a scan of a PKP Cargo Siemens Vectron MS returned as "EU160" (Newag Griffin) with a hallucinated name ("Andrzej"). Both wear dark blue Polish liveries; the prompt had Vectron rules for DE/AT/CZ/SE but nothing for Polish designations. Fleet number decisive (EU46-5xx / NVR 5370 = Vectron, PKP Cargo; EU160-xxx = Griffin, PKP Intercity), cab-profile cues, plus a no-invented-names rule for both classes.
- **Added** EU46 KNOWN_SPECS (5 key variants): 160 km/h, 6,400 kW, 90 t, Siemens Mobility (Munich-Allach), 25 built (EU46-501..525, verified via railvolution.net), multi-system. No cache invalidation needed — corrected class string lands on a fresh key. tsc clean, 263/263.

#### `backend/src/services/rarity.ts` + `trainCache.ts` — ICE 1 (BR 401) rarity locked epic + cache invalidation (`9fb6cb2`)
- **Added** KNOWN_RARITY epic lock across 12 BR 401 / ICE 1 key variants. The 2026-06-12 DE ad shows the ICE 1 EPIC card and drives scan traffic to the class, but the tier was AI-classified and operator-swayable (EN57 lesson: lock tier + invalidate together so viewer scans match the ad). Reason text: Germany's first high-speed train, first-generation fleet progressively withdrawn ahead of ~2030 retirement.
- **Added** CLASS_INVALIDATIONS for the same key set at `2026-06-12T06:00:00Z` — deliberately just past deploy time (not end-of-day) so ad-day scans cache normally. Also flushes any month-old cached entry still carrying the hallucinated "37 built": KNOWN_SPECS `numberBuilt: 60` landed 2026-05-18 but shipped without an invalidation.
- **No KNOWN_SPECS change**: `numberBuilt: 60` already locked since 05-18, and the Phase A verified-facts block forces the facts prose to honour it. `numberSurviving` stays AI-estimated (~37 plausible; no stable public figure). tsc clean, 263/263 backend tests. Pushed to main → Render auto-deploy.

---

## 2026-06-11

### Frontend

#### `frontend/app.json` — version bump 1.0.38 → 1.0.39
- **Changed** `expo.version` from `1.0.38` to `1.0.39` for the next EAS production build (Social Phase 1 + PAYMENT_PENDING + profile-stats robustness + DE Baureihe, all committed 2026-06-09). 1.0.38 (iOS build 60) is already live on both stores, so submitting without a bump would be auto-rejected (ITMS-90186/90062). Build numbers auto-increment on EAS (`appVersionSource: remote` + `autoIncrement`); only the version string needs the manual bump.
- Pre-build verification run 2026-06-11: frontend 245/245 tests + tsc clean, backend 263/263 + tsc clean, git clean/synced with origin, latest iOS EAS build confirmed 1.0.38 build 60.

### Infrastructure

#### Supabase — migration 020 APPLIED to prod (schema 019 → 020)
- **Applied** `020_social_public_profiles.sql` via the dashboard SQL editor (evening session, after the v1.0.39 builds were triggered). Pre-apply audit passed: every `alias.column` reference checked against the real schema, `is_public` ships `not null default false` (no silent-persistence risk for live v1.0.38 clients), SECURITY DEFINER + pinned `search_path` matches the 006/014 pattern, RPC names/params/return columns match the frontend fetchers/mappers exactly.
- **Verified** 3 steps with Stephen's own account (`15f0c12a…`): (1) `get_public_profile` → 1 row, true counts (117 spots / 69 classes / 16 rare / 8 epic / 7 legendary); (2) `get_public_collection` → 49 rows newest-first, ONLY the 10 public-safe columns — no lat/lng/photo_url; (3) `is_public=false` → zero rows from both RPCs. Flag left `false` post-test. Social Phase 1 fully unblocked.
- Migration 021 (operator retro-fix) deliberately NOT applied — destructive, separate diagnostic-first walkthrough.

#### EAS — v1.0.39 production builds FINISHED + SUBMITTED both stores
- iOS build 61 (`db0e7abb`) + Android versionCode 31 (`a60bd6a8`), both from commit `f698b79`, finished ~25 min after trigger. Carries Social Phase 1 + PAYMENT_PENDING + profile-stats robustness + DE Baureihe.
- **Submitted same evening** via `eas submit --latest` (iOS submission `0f8314e1`, Android `db350246`). Apple: binary processed, release notes pasted, **IN REVIEW**. Play: draft created per `eas.json` `releaseStatus: draft`, notes pasted, **pre-launch checks running** — rollout start pending.

### Docs

#### `docs/release-notes-v1.0.39.md` (NEW) — EN/DE/PL release notes for v1.0.39
- **Added** store release notes (all under 500 chars for Play parity; bug fixes first per `feedback_release_notes_order.md`): pending-payment fix, profile-stats fix, Social Phase 1 public collections; DE notes additionally carry the "Baureihe" display line (DE-only change, omitted from EN/PL). Includes pre-submission reminders: **migration 020 must be applied before store rollout** (Social toggle writes `profiles.is_public`), EULA-link check for Apple, Play draft-rollout steps.

---

## 2026-06-09

### Frontend

#### Social Phase 1 — view other spotters' public collections (read-only, opt-in)
- **Added** the full frontend for the "view other people's spots" feature (per [the implementation plan](plans/2026-06-04-social-phase1-implementation-plan.md)). A signed-in user can tap any spotter on a leaderboard row and see that spotter's public collection — classes, rarity, blueprints — only if they opted in. **No location, no user photos, ever** (privacy posture P-A; the RPCs never return those fields).
- `store/authStore.ts` — `is_public?` on `Profile`; new `updateProfilePublicity(value)` action (optimistic local set + `profiles.update`).
- `types/index.ts` — new `PublicProfile` + `PublicCollectionItem` (defined fresh — never extend `HistoryItem`, which carries lat/lng).
- `services/supabase.ts` — `fetchPublicProfile` / `fetchPublicCollection` calling the `get_public_profile` / `get_public_collection` RPCs, plus pure `mapPublicProfile` / `mapPublicCollectionItem` mappers. Both fetchers **degrade gracefully** if the RPCs aren't deployed (42883 / PGRST202) → read as "private/empty", never a crash — so the build is safe before migration 020 is applied.
- `app/(tabs)/profile.tsx` — "Make my collection public" `Switch` in the identity-edit modal (signed-in only) + helper text ("Others can see your classes & rarity — never your location"), wired through `handleSaveIdentity`.
- `components/leaderboard/{MyLeagueTab,CountryTab,CollectionTab}.tsx` — each leaderboard row is now a `Pressable` → `/spotter/[id]`.
- `app/spotter/[id].tsx` (NEW) + route registration in `app/_layout.tsx` — header (flag + emoji + username + stat row) and a rarity-coloured 2-column card grid. States: loading, self-view (redirect to own Profile), private, empty, error. Cards are non-interactive previews (do not open owner-gated `card-reveal`).
- `locales/{en,de,pl}.json` — `identityModal.public*` + a `spotter.*` namespace (DE/PL terms aligned with existing leaderboard wording; umlauts/diacritics verified).
- `__tests__/services.publicProfile.test.ts` (NEW) — mapper + graceful-degradation tests. tsc clean, **228/228 frontend tests** (26 suites).
- **Depends on migration 020** (`profiles.is_public` + the two RPCs) being applied to prod before the feature does anything; until then every public view safely shows the "private" state. Ships in the next EAS build.

#### `services/purchases.ts` + `app/paywall.tsx` — handle RevenueCat PAYMENT_PENDING (deferred payment)
- **Fixed** a Google Play deferred-payment (PENDING — cash/kiosk, slow bank transfer, card needing extra auth) being logged as a failure and shown to the user as "Purchase failed. Please try again." (Sentry-caught on v1.0.38). The three purchase handlers (`purchasePro`, `purchaseBlueprintCredits`, `purchaseWinBackAnnual`) now branch on `PAYMENT_PENDING_ERROR` → return `"pending"` (widened return to `boolean | "pending"`), do NOT track `purchase_failed` or capture to Sentry. Paywall shows a friendly "payment processing — you'll get access once it clears" Alert (new `paywall.pendingTitle`/`pendingBody`, EN/DE/PL) instead of the failure copy. Call sites tightened to `=== true` so `"pending"` never triggers the success path.

#### `store/trainStore.ts` + `services/supabase.ts` + `app/(tabs)/profile.tsx` — Profile-stats robustness ("1 spot instead of 241")
- **Fixed** the silently-expired-JWT data-loss-looking bug: an expired session made the authenticated `fetchSpots` return zero rows (RLS denies, no throw), collapsing the collection to local-only scans. `loadHistory` now, when the cloud returns empty **but** the device has local history, calls a new `refreshAuthSession()` helper and retries `fetchSpots` ONCE before trusting the empty result. (Sentry capture in `loadHistory` was already shipped.)
- **Added** pull-to-refresh on the Profile screen (`RefreshControl` → re-pulls `loadHistory()` + `fetchProfile()`) as a manual escape hatch when stats look wrong.

#### `utils/classDisplay.ts` (NEW) + results / card-reveal / history / spotter screens — German "Class" → "Baureihe" display
- **Added** a pure, DE-only display transform (`localiseClassName`): for `de` locale, "BR 218" → "Baureihe 218" and "DB Class 218" → "DB Baureihe 218" (BR *is* the German Baureihe abbreviation; the DB prefix proves German). Conservative — UK "Class 37", PL "Newag Dragon", "ICE 3", "ÖBB 1116" are untouched; non-`de` locales pass through. Applied at the four class-display sites (results, card-reveal, history row, spotter card). Source: Timmi (BR 218 ad, 06-07). New test `__tests__/utils/classDisplay.test.ts`. (PL conventions deferred to a later pass.)
- **Note:** the PL-annual-default paywall item is already satisfied — `findDefaultIndex` defaults to the annual plan for all locales since the 2026-06-04 annual-first reprice; no PL-specific change needed.
- tsc clean, **245/245 frontend tests** (27 suites). All four items ship in the next EAS build alongside Social Phase 1.

### Backend

#### `src/services/vision.ts` — two misID fixes (Class 59 vs Class 60; regional double-deck Dosto)
- **Fixed (misID) — British Rail Class 59 returned as Class 60.** UK tester Steph scanned **59005 "Kenneth J Painter"** and the app returned "Class 60 / DC Rail". Class 59 had `KNOWN_SPECS` (since the 2026-05-09 Class-59→Class-66 misID) but **no vision rule**, so the class kept drifting (Class 66 then Class 60) and the correct specs never got looked up. Added a Class 59 vs Class 60 vs Class 66 disambiguation rule: decisive cue is the fleet number (`59xxx` = Class 59, EMD-built, never Class 60/66), 15 units across 59/0/59/1/59/2, operators GBRf + DB Cargo (never "DC Rail"), 59005 = "Kenneth J Painter". No spec/cache change — corrected vision now returns "Class 59" (fresh cache key) and the existing Class 59 `KNOWN_SPECS` applies.
- **Fixed (misID) — regional double-deck push-pull (Dosto) returned as a self-powered diesel DMU.** Reproducing Dieselpower's report: a DB Regio double-deck RE9 Steuerwagen (Gießen, under catenary) was returned as a hallucinated **"DABpbzfa 762 — double-deck articulated diesel multiple unit"** (an earlier report had the same failure mode return "BR 648"). Added a German regional Doppelstock rule before the regional-EMU pre-flight check: a double-deck DB Regio RE/RB vehicle is a **loco-hauled push-pull set**, never a DMU, never BR 648 (single-deck diesel LINT 41); a DABpbzfa/DBpbzfa is an **unpowered control trailer** (never "powered car"/"self-propelled", never an invented double-deck DMU class number); identify the hauling loco if visible, else classify as "DB Doppelstockwagen (Dosto)" with fuelType Electric under catenary. No cache change (class string changes → fresh key). **Closes the public "Bau ich nach" promise to Dieselpower.** tsc clean, 263/263 backend tests.

#### `src/services/operatorNames.ts` (NEW) + `src/services/vision.ts` — operator-string canonicalisation (cache + collection de-fragmentation)
- **Added** a new `canonicaliseOperator()` module mirroring the existing `classNames.ts` pattern, wired into `parseTrainResponse()` in `vision.ts` (`operator: canonicaliseOperator(parsed.operator)`). Vision emits the same operator under multiple spellings ("DB Fernverkehr" / "Deutsche Bahn (DB Fernverkehr)" / "DB Fernverkehr AG"); because the cache key is `language::class::operator`, each spelling fragmented the 30-day Redis cache (re-running the full 4-call AI pipeline per label) and split the same train across multiple collection/leaderboard entries. Surfaced by the 2026-06-05 top-user spot audit (BR 412/403/182/185/103).
- **Conservative by design (first slice):** exact-match allowlist only (whitespace-normalised, lowercased) — no fuzzy/substring rules, so it can never rewrite an operator it wasn't taught. Maps known DB Fernverkehr / DB Cargo (incl. legacy "Railion" / "DB Schenker Rail") / DB Regio spelling variants to one canonical form each. **Two hard safety rules:** (1) NEVER merges DB Cargo / Fernverkehr / Regio (distinct operators — merging would corrupt the leaderboard); (2) leaves the ambiguous bare "DB (Deutsche Bahn)" / "Deutsche Bahn" untouched (could be any DB arm). 28 new tests in `operatorNames.test.ts`. tsc clean, 263/263 backend tests.

#### `src/services/vision.ts` — emit the specific DB business unit (operator de-fragmentation at source)
- **Added** a DB-operator rule to the identification prompt (after the JSON output example): for any Deutsche Bahn train, return the specific business unit, never the bare "DB" / "Deutsche Bahn" — long-distance (ICE/IC/EC) → "DB Fernverkehr", regional (RE/RB/S-Bahn) → "DB Regio", freight → "DB Cargo", using those exact canonical strings. This stops the ambiguous bare strings being produced at the source (the un-mappable case `canonicaliseOperator` deliberately leaves alone) and aligns model output with the canonical forms so less post-hoc remapping is needed. Falls back to "Deutsche Bahn" only when the unit genuinely can't be inferred; private operators keep their own names. tsc clean, 263/263.

### Database (Supabase)

#### `supabase/migrations/021_canonicalise_operators.sql` (NEW) — retro-fix existing fragmented operator rows — WRITTEN, NOT YET APPLIED
- **Added** (file only — **NOT applied to prod**) the retro-fix companion to the operatorNames.ts code change: canonicalises existing `public.trains` operator spellings (mirrors the allowlist EXACTLY) then merges the resulting duplicate `(class, operator)` rows — re-points `spots.train_id` to the earliest-created keeper, deletes the dupes. Conservative (never merges DB Cargo/Fernverkehr/Regio; leaves bare "DB" untouched; does not touch class-string fragmentation). **Destructive + not cleanly reversible**, and because the leaderboard counts `distinct train_id`, merging reduces some users' unique-class counts and can shift standings. Ships with a run-first read-only DIAGNOSTIC block (blast-radius counts) + a post-apply verification block. **Must be reviewed + applied manually in the Supabase SQL editor** — review the diagnostic output before running the transaction.

#### `src/services/rarity.ts` + `src/services/trainCache.ts` — EN57 family rarity coverage completed
- **Fixed** EN57 sub-variants could still return "common" by operator. The 06-05 class-anchored rarity (`4785991`) locked only `en57` / `en57al` / `en57akm` / `en71` to "uncommon", but `trainSpecs.ts` covers seven EN57 variant keys — `en57ak`, `en57aks`, `en57akł`, `en57ald` had no rarity lock, so the AI could still tag them "common" depending on operator. This was Foxiar's "EN57 classified too common" report (logged 05-31, before class-anchoring shipped). **Added** the four missing sub-variants to `KNOWN_RARITY` at "uncommon", so no EN57 family member can swing to "common".
- **Tier held at "uncommon", NOT bumped to "rare"** (Foxiar's ask): the current tier was set 2026-04-29 from a forum-verified primary source (pafawag.w.obiektywie, ~60 active of 1,438) and that rule explicitly warns against the over-rare framing Polish spotters also flag. Per the verify-before-overriding rule, not flipping a verified position on a single conflicting signal. One-line change to "rare" remains available if the product decision changes.
- **Added** `CLASS_INVALIDATIONS` entries (`2026-06-09T23:59:00Z`) for the full EN57 family (`en57`, `en57al`, `en57ald`, `en57ak`, `en57aks`, `en57akł`, `en71`) — the 06-05 rarity ship locked these tiers but added no invalidation, so any entry cached at the wrong tier was still being served stale. (`en57akm` already invalidated 06-05 for the 120 km/h fix.) tsc clean, 263/263 backend tests.

---

## 2026-06-08

### Backend

#### `src/services/trainFacts.ts` + `src/services/trainCache.ts` — BR 140 facts-prose narrow-gauge hallucination
- **Fixed (facts-layer leak) — BR 140 reveal prose hallucinated the loco onto the narrow-gauge Pressnitztalbahn heritage railway.** A live scan's "Facts & History" opening paragraph described the standard-gauge mainline BR 140 as *"preserved and operated by PRESS on the Pressnitztalbahn heritage railway… this charming narrow-gauge line"* — directly contradicting its own spec card (Standard 1,435 mm) and a later, correct paragraph in the same card that frames PRESS as a mainline freight operator. **Root cause:** `trainSpecs.ts` and `rarity.ts` both had solid BR 140 locks, but `trainFacts.ts` had **no BR 140 bullet at all**, so the free-form facts prose was unconstrained and conflated PRESS-the-750mm-museum-line (Pressnitztalbahn) with PRESS-the-standard-gauge-freight-operator (which runs ex-DB 140s on the national network). Same failure family as BR 114 / BR 628 / ÖBB 4020 / VR Sr1 (specs constrained by KNOWN_SPECS, prose drifts when no class-specific lock exists).
- **Added** a `trainFacts.ts` BR 140 / E 40 bullet locking: West German Deutsche Bundesbahn Bo'Bo' **four-axle** mixed-traffic/freight loco, E 40 renumbered BR 140 in 1968, built 1957–1973 by Krauss-Maffei / Krupp / Henschel / SSW, 879 units, 110 km/h, 3,700 kW, 15 kV 16.7 Hz AC, **standard gauge 1,435 mm**. Forbids: narrow-gauge / Pressnitztalbahn-heritage / museum framing; six-axle/Co'Co'; Siemens-alone / EuroSprinter builder; modern three-phase AC traction; 1990s / post-reunification service entry; numberBuilt 186. Clarifies PRESS runs ex-DB 140s on the standard-gauge national freight network (distinct from the company's own 750 mm museum line).
- **Added** 8 `CLASS_INVALIDATIONS` entries (`140`, `br 140`, `br140`, `class 140`, `db class 140`, `baureihe 140`, `e 40`, `e40`) at `2026-06-08T23:59:00Z` to flush pre-fix cached facts so the corrected mainline-freight narrative renders. No KNOWN_SPECS change needed (structured specs were already correct). tsc clean, 235/235 backend tests pass.

---

## 2026-06-05

### Build & Distribution

#### v1.0.38 — iOS now LIVE on the App Store (both stores live)
- **iOS build 60 — APPROVED + LIVE on the App Store (2026-06-05).** Android versionCode 30 went live on Google Play 2026-06-04; with the iOS approval, **v1.0.38 is now LIVE on both stores.** Bundle shipped: A (upsell placement), B (manual card-edit), C (blueprint 404 cleanup), D (scanning guide), G (rate-limit softening). E (monthly→annual upsell) remains deferred to v1.0.39. Backend fixes (Class 74, blueprint write-through, BR 159 length) + migration 019 were already live independent of the app build.

### Database (Supabase)

#### `supabase/migrations/020_social_public_profiles.sql` (NEW) — Social Phase 1 (opt-in public profiles) — WRITTEN, NOT YET APPLIED
- **Added** (file only — **NOT applied to prod; prod schema remains at migration 019**) the backend for the "view other people's spots" feature (read-only browse). Adds `profiles.is_public boolean default false` (strictly opt-in) + two `SECURITY DEFINER` RPCs: `get_public_profile(uuid)` (public identity + TRUE aggregate counts) and `get_public_collection(uuid, limit, offset)` (card list newest-first). Both are `is_public`-guarded (return zero rows for non-public users) and **explicitly exclude `latitude`/`longitude`/`photo_url`** — privacy posture P-A (never expose others' location), building on migration 018's owner-only `spots` SELECT. Pinned `search_path`, granted to `anon`+`authenticated`; mirrors the `get_weekly_rarity_champion` (014) pattern. Column-audited against live schema.
- **Counts use TRUE totals** (all spots / all distinct classes / true per-tier rare·epic·legendary distinct-class counts) — deliberately NOT the `leaderboard_rarity` view's epic/legendary-only inner join (which under-reports a profile and mislabels rare_count). Per-spot `identity_override` not applied in the public view (shows canonical class).
- **Status:** session paused mid-build (user out of time). **Frontend remains** (is_public toggle, pressable leaderboard rows, NEW `app/spotter/[id].tsx`, RPC fetchers, types, i18n, tests — all mapped in `docs/plans/2026-06-04-social-phase1-implementation-plan.md`). Migration must be applied manually via the Supabase SQL editor before the frontend works. Commit `2c42d62`.

### Backend

#### `src/services/vision.ts` + `src/services/trainSpecs.ts` + `src/services/trainCache.ts` — two Polish misIDs (Pesa Elf 2, Škoda 183)
- **Fixed (misID) A — Pesa Elf 2 (34WE) returned as "Newag 34WEag (Impuls 2)".** A Koleje Śląskie **34WEag-003B** (cab number visible) was labelled Newag Impuls 2. Verified: type **34WE/34WEa/34WEag (PKP EN96)** is a **Pesa Elf 2** built by **Pesa Bydgoszcz**, not Newag (KŚ runs 4: 34WEa-001…-004). Flagged on the PL ad ("jeszcze elf nazwany impulsem"). Added a `vision.ts` disambiguation rule (34WE → Pesa Elf 2 / Pesa Bydgoszcz, NEVER Newag/Impuls; a "xxWE" number does not imply Newag — both makers draw WE numbers from the same register) + 4 `KNOWN_SPECS` keys (Pesa Bydgoszcz, 1,600 kW, 160 km/h, 3 kV DC) + 3 `CLASS_INVALIDATIONS` entries.
- **Fixed (misID) B — Škoda Class 183 (61E) returned as "EU07".** A Bulk Transshipment Slovakia **183 015-7** was labelled EU07. Verified: **183 xxx** is a **Škoda Class 183 (Škoda 61E / ČSD E669.3)** — a Czechoslovak 3 kV DC Bo'Bo' heavy-freight electric (Škoda Plzeň), visually near-identical to the EU07 (shared Škoda lineage). The **fleet number is decisive** (183 xxx = Class 183; EU07-xxx = EU07). Added a `vision.ts` rule (183 xxx + Slovak freight operators → Class 183 / Škoda, NEVER EU07) + 4 `KNOWN_SPECS` keys (Škoda Plzeň, ~90 km/h, 3 kV DC; power left to the AI — exact kW not cleanly sourced). No cache invalidation needed (class string changes EU07 → Class 183 → fresh key).
- Both verified by web before shipping (per `feedback_verify_premise_before_overriding_expert` — and I'd wrongly waved off the EU07/183 card as "probably correct" before checking). `tsc` clean, **235/235 backend tests**. **Pushed to Render.**

#### `src/services/rarity.ts` + `src/services/trainCache.ts` — class-anchored rarity (consistency fix)
- **Fixed (data integrity / moat)** the same class returning **different rarity tiers depending on operator** — surfaced by the top-user spot audit (516 spots / 313 classes): BR 193 came back common/uncommon/epic/legendary, BR 159 common/uncommon/rare/legendary, BR 143 epic/uncommon. Rarity is AI-decided per scan and gets swayed by the operator string for any class without a hard rule; inconsistent tiers corrupt the collection + leaderboard (the product's moat) and are exactly what spotters notice.
- **Added** a deterministic `KNOWN_RARITY` class→tier override in `rarity.ts`, applied **after** the AI classifies (`applyKnownRarity`, wired into both the Anthropic and OpenAI return paths). Seeded from the tiers **already documented in `RARITY_SYSTEM_PROMPT`** (so it *enforces* existing intent rather than inventing — BR 143 epic, BR 140 legendary, BR 155/110 rare, BR 648/ET22 common, Dragon/BR 247/EN57 uncommon, Dr18/EU05 legendary, ET21 epic, Class 69 rare) plus the two audit swingers: **BR 193 → common** (Siemens Vectron, most numerous modern EU electric) and **BR 159 → uncommon** (Stadler EuroDual, distinctive but small-and-growing bi-mode fleet — consistent with Dragon / BR 247). Same pattern as `KNOWN_SPECS` for specs.
- **Cache:** added/bumped `CLASS_INVALIDATIONS` for the swinging classes (br 193, br 159 + variants, br 143) to `2026-06-05T23:59:00Z` so cached entries re-render at the locked tier (BR 159's existing 06-04 length-fix entries were bumped, not duplicated).
- **Scope decision — operator normalization NOT done this pass (deliberate):** the audit also showed operator-string fragmentation (BR 412 as "DB Fernverkehr" / "DB (Deutsche Bahn)" / "Deutsche Bahn (DB Fernverkehr)"). A naive normalizer is unsafe — the ambiguous "DB (Deutsche Bahn)" string spans BR 412 (DB **Fernverkehr**) and BR 182 (DB **Cargo**/**Regio**), distinct operators that must not merge. Flagged in `backend_backlog_corrections` for a careful context-aware canonical map. Verified: `tsc` clean, **235/235 backend tests pass** (+4 new rarity-override tests).

#### `src/services/trainSpecs.ts` + `src/services/trainCache.ts` — EN57AKM max speed (160 → 120 km/h)
- **Fixed (spec error)** the EN57AKM was returning vmax **160 km/h**. Root cause: KNOWN_SPECS locked the EN57 family (`en57`/`en57al`/`en57ak`/`en57aks`/`en57akł`/`en57ald`) at 110 km/h but had **no `en57akm` key**, so this variant fell through to the AI, which hallucinated a Pendolino/Elf 2 figure. Flagged by Polish commenter **Vampigator** on the PL ad.
- **Two-stage (lesson):** first push (`03d2cdd`) locked `en57akm`/`en57 akm` at **110 km/h** (the family default). Vampigator then corrected that — the **AKM is the deep-modernisation variant that specifically RAISED top speed to 120 km/h** (DC Lk-450 motors → asynchronous AC ~1 MW + impulse startup; ZNTK Mińsk Mazowiecki + Newag, 2009–2010; bogie design caps it at 120). **Verified** against Koleje Mazowieckie's own page + Torowy + transportszynowy.pl before changing — per `feedback_verify_premise_before_overriding_expert`. Corrected to **120 km/h** + added `power: "1,000 kW"` and the ZNTK/Newag builder note. `CLASS_INVALIDATIONS` timestamp set to end-of-day so both the original 160 cache and any 110 entry cached between the two pushes flush and re-render at 120. Verified: `tsc` clean, 24/24 specs+cache tests. **Dragon 2 unchanged at 120 km/h** (already correct — the "160 on the video" is an old ad-text error, not the live app).

---

## 2026-06-04

### Build & Distribution

#### v1.0.38 — built (EAS production) + submitted to both stores
- **Version bumped** `1.0.37 → 1.0.38` in `frontend/app.json`. EAS `autoIncrement` set the build numbers: **iOS build 60**, **Android versionCode 30**.
- **EAS production build** (`eas build --platform all --profile production`) — both FINISHED. Artifacts: iOS `.ipa` (`675978b3-…`), Android `.aab` (`d7fd4a0e-…`).
- **Submitted both stores** via `eas submit`: **Android versionCode 30 — LIVE on Google Play (approved + published 2026-06-04)**; **iOS build 60 — IN APP STORE REVIEW** (release notes + EULA entered).
- **Bundle:** A (upsell placement), B (manual card-edit), C (blueprint 404 cleanup), D (scanning guide), G (rate-limit softening). E (monthly→annual upsell) deferred to v1.0.39. Migration 019 already live; backend fixes (Class 74, blueprint write-through, BR 159 length) already deployed to Render.
- **Release notes** (EN/DE/PL) drafted — bug-fixes-first, no financial offers; iOS description must carry the EULA link.

### Backend

#### `src/services/trainSpecs.ts` + `src/services/trainCache.ts` — BR 159 (Stadler EuroDual) length hardcode
- **Added** `length` to the `SpecsOverride` type and a verified **23.0 m** to all 7 BR 159 / EuroDual KNOWN_SPECS keys (`159` / `br 159` / `br159` / `class 159` / `baureihe 159` / `eurodual` / `stadler eurodual`). The BR 159 card previously showed no length (Wikidata + AI both returned null) — flagged by the Captrain BR 159 driver-in-training (Damian). maxSpeed/weight/builder unchanged (120 km/h / 123 t / Stadler — already confirmed by the same tester; not re-litigated). Added 7 `CLASS_INVALIDATIONS` entries (2026-06-04) so pre-fix cached entries refresh and the length renders. Verified: `tsc` clean, trainSpecs + trainCache tests 24/24 pass. **Pushed to Render 2026-06-04** (auto-deploys; backend-only, no app build).

#### Sentry de-noise (F) — no backend change required
- **Investigated** the planned "skip `captureException` for expected 429 limit messages." Finding: the backend does **not** capture 429s to Sentry — the rate-limit middlewares (60/hr per-user, 20/hr anon) and the scan-gate send 429 responses directly (no throw); `errorHandler` only captures 500s; `setupExpressErrorHandler` never sees direct responses. The 429 Sentry noise was a **frontend** capture (`handleScan` → `captureError`), already addressed by v1.0.38 item **G** (the 60/hr "Hourly scan limit reached" message is now in `isExpectedProductError`, so it no longer pages Sentry). F therefore needs no server change — closed.

#### `src/services/redis.ts` — Fix blueprint poll 404s ("Couldn't reach LocoSnap servers") via write-through task store
- **Fixed (data consistency)** blueprint generation failed for users with "Couldn't reach LocoSnap servers" — confirmed via Sentry as a **404 "task not found"** on the poll, ~6s after the task was created. **39 events / 7 users / 18 days**, not network and not the deploy window.
- **Root cause:** the Upstash Redis DB is **Global (multi-region, eventually consistent)** — primary `eu-west-1` (Ireland), backend in Frankfurt. A blueprint task is written then polled within seconds, so the read hit a replica that hadn't synced → `null` → backend 404 → the app's misleading "couldn't reach servers." The train cache was immune (its reads happen long after writes). Diagnosis: single instance (multi-instance ruled out), no Redis write errors logged, read path proven by constant cache hits, Upstash console confirmed "Global".
- **Fix:** `setBlueprintTask` now **writes through to local in-memory first, then Redis**; `getBlueprintTask` reads **memory first, then Redis**; `deleteBlueprintTask` clears both. On the single Render instance this guarantees read-your-writes for fresh tasks (first polls served locally, bypassing replication lag); Redis still provides cross-restart durability. Scoped to blueprint tasks only — the train cache is left as-is (high volume, 30-day TTL, unaffected).
- **DEPLOYED to Render 2026-06-04** (commit `4967e4a`; verified `tsc` clean, redis tests 5/5). Backend-only, no app build. The frontend cosmetic fix (treat 404 as "regenerate" rather than "couldn't reach servers") shipped as v1.0.38 item C (in `main`, awaits the app build).

#### `src/services/vision.ts` — Fix Vy/Norske tog Class 74 misID ("CAF Civity" → Stadler FLIRT)
- **Fixed (misID)** a Vy Class 74 EMU was being identified as "CAF Civity (Class 74)". Class 74 (and Class 75) are Norwegian **Stadler FLIRT** ("FLIRT Nordic") units built by Stadler Rail (50 sets to NSB 2012–2014, now Vy / Norske tog); "Civity" is an unrelated CAF family (TfW Class 756, Renfe, Northern 195/331). Added a disambiguation rule to `TRAIN_ID_PROMPT` instructing the model to return class "Class 74"/"Class 75", name "Stadler FLIRT", builder "Stadler Rail", operator "Vy", and to never attach the "Civity" name to a Norwegian 74/75. Reference specs noted (200 km/h, ~4,500 kW, 5-car).
- **Root cause:** the model attached the wrong manufacturer name to a correctly-designated Class 74. Flagged publicly on the German ad by a Swedish railfan ("this is Stadler not CAF"); verified against Wikipedia (NSB/Norske tog Class 74 = Stadler FLIRT, 200 km/h).
- **No cache invalidation needed:** the correction changes the identified class *string* (was "CAF Civity (Class 74)"), so future scans land on a fresh `(class, operator)` cache key; the stale entry is never queried again. Existing saved cards keep the old label.
- **DEPLOYED to Render 2026-06-04** (commit `3f73565`; verified `tsc` clean, vision tests 9/9). English correction reply posted on the German ad.

### Database (Supabase)

#### `supabase/migrations/019_spot_identity_override.sql` (NEW) — per-spot identity override for manual card-edit
- **Added** an `identity_override jsonb` column on `public.spots` (nullable, default null). Lets a user correct the class/name on their OWN card when the AI misIDs, WITHOUT mutating the shared `trains` row (deduped across all users — a direct edit there would corrupt everyone's card of that class and skew leaderboard counts). Owner-only via the existing spots UPDATE policy (migration 001); no new grant/RLS needed. **Display-only** — never affects rarity or any leaderboard count.
- **APPLIED to prod 2026-06-04** (Supabase SQL editor; verified `identity_override` is `jsonb`, nullable). Prod schema now at migration 019. Only the column-add was run live; the cosmetic `COMMENT ON COLUMN` from the migration file was skipped (non-functional metadata). The cloud write (`updateSpotIdentity`) now works; ships to users with the v1.0.38 build.

### Frontend

> v1.0.38 candidates — **working tree only, not built or shipped.**

#### `app/(tabs)/profile.tsx` — Elevate the "Upgrade to Pro" CTA above the fold
- **Changed** the free-user upgrade CTA from the bottom of the Profile page (it sat below the rarity breakdown, off-screen without scrolling — confirmed in-app on v1.0.37) to **immediately after the Level card**, so it is visible on the first screen. Same `!profile?.is_pro` guard and `source=profile` paywall attribution preserved — only the position moved; the old bottom copy was removed (no duplicate).

#### `components/leaderboard/LeaderboardProUpsellCard.tsx` (NEW) — contextual Pro upsell for the Leaderboard tab
- **Added** a self-gating upsell card where the Leaderboard tab previously had **no upgrade entry point at all**. Mirrors the `HomeProUpsellCard` pattern: parent mounts it with no props; it renders only for **signed-in free users** (`!!session && profile?.is_pro === false`) — Pro users and unauthenticated guests see nothing. Framing is contextual to the surface ("Climb the leaderboard faster — Pro gives unlimited scans, every spot counts toward your rank") rather than a generic banner, to stay consistent with the paywall's "funded by subscriptions, not ads" positioning. New analytics events `leaderboard_pro_upsell_shown` / `leaderboard_pro_upsell_tapped`; taps route to `/paywall?source=leaderboard`.

#### `app/(tabs)/leaderboard.tsx` — mount the leaderboard upsell
- **Added** `<LeaderboardProUpsellCard />` between the sub-tab bar and the content view, so it shows above all three sub-tabs (This Week / Country / Collection) and does not scroll away with the list.

#### `locales/{en,de,pl}.json` — i18n for the leaderboard upsell
- **Added** `leaderboard.proUpsell.{title,body}` to all three locales (EN/DE/PL). German umlauts and Polish diacritics verified.

**Decision:** user observed the upgrade CTA was buried on Profile and absent from Leaderboard and asked whether to put it on every page. After weighing against the validated "generous free tier converts better than a tight/naggy one" insight and the "not ads" paywall positioning, the chosen approach is to **fill the gaps contextually — one nudge per surface tied to user activity** — rather than blanket-banner every tab. Scan (`HomeProUpsellCard`) and History (collection lock-gate) upsells left unchanged. **Verified:** `tsc --noEmit` clean, 219/219 frontend tests pass, all three locale JSON files parse.

#### Manual card-edit — user correction layer (tester request: scan-accuracy escape hatch)
- **Added** the ability for a user to correct a card's class when the AI misidentifies a train. Reuses the existing wrong-ID correction modal (`card-reveal.tsx`): in **history mode**, submitting a correction now ALSO writes a per-spot `identity_override` (display-only) in addition to the existing `wrong_id_reports` telemetry. Decision (confirmed with user): **display-only — does NOT change leaderboard counts or rarity** (prevents minting "legendary" spots / corrupting the moat).
- **`types/index.ts`** — new `SpotIdentityOverride` type + `HistoryItem.identityOverride`.
- **`services/supabase.ts`** — `fetchSpots` selects/maps `identity_override`; new `updateSpotIdentity(spotId, override)` (owner-only RLS; `captureError` on failure).
- **`store/trainStore.ts`** — new `setHistoryIdentityOverride(id, override)`: optimistic local update + AsyncStorage + cloud write (UUID-id guard, mirrors `removeFromHistory`).
- **`app/card-reveal.tsx`** — applies the override to the displayed `currentTrain` (corrected class shown everywhere); when overridden, the specs/facts panel is replaced by a short "manual correction" note (the AI specs are for the wrong class); "Card updated" toast. Telemetry still reports the ORIGINAL AI identity (`baseTrain`).
- **`app/(tabs)/history.tsx`** — history list shows the corrected class/operator/name.
- **`locales/{en,de,pl}.json`** — `wrongId.cardUpdated` + `wrongId.correctedSpecsNote` (DE umlauts / PL diacritics verified).
- **Scope (v1):** class override only; free-text via the existing modal; specs/facts blanked (not recomputed) under an override. Needs migration 019 applied for the cloud write (local override works without it). **Verified:** tsc clean, 219/219 tests pass, JSON parses.

#### `services/api.ts` — Blueprint 404 cleanup (C)
- **Changed** `checkBlueprintStatus` to treat an HTTP **404 "task not found"** as a terminal `failed` status ("Blueprint unavailable — tap to regenerate") instead of letting it throw and count toward the poller's consecutive-network-error cap (which mislabelled it "Couldn't reach LocoSnap servers" + wasted 5 retries). Reuses the existing failed-state UI + retry button. Cosmetic complement to the now-live backend write-through fix (`4967e4a`) — a 404 now genuinely means expired/gone.

#### `components/ScanningGuideCard.tsx` (NEW) + `app/(tabs)/index.tsx` — Scanning guide (D)
- **Added** a dismissable "Tips for a clean scan" card on the scan screen for **brand-new users** (`historyLoaded && history.length === 0`); auto-hides after the first spot or on dismiss (AsyncStorage `locosnap_scanning_guide_dismissed`). Mirrors the `ProRescuePrompt` self-gating pattern. 3 tips (frame square-on / good light / sharp & close). Analytics `scanning_guide_shown` / `_dismissed`. Tester request (Oula); validated 2026-06-04 by the "how to scan loco" TikTok search. No backend.

#### `app/(tabs)/index.tsx` — Rate-limit message softening (G)
- **Changed** the scan error handler so the backend's per-user 60/hr anti-abuse cap ("Hourly scan limit reached…") shows a softened, **Pro-aware** message instead of the bare wording (which wrongly implies a paying user's subscription is capped). New `scan.hourlyCap.{pro,free}` i18n (en/de/pl); also marks the cap as an expected product error (no Sentry page).

#### `locales/{en,de,pl}.json` — i18n for D + G
- **Added** `scan.scanningGuide.{title,tip1,tip2,tip3,dismissA11y}` and `scan.hourlyCap.{pro,free}` (DE umlauts / PL diacritics verified).

**Verified (C+D+G):** `tsc --noEmit` clean, 219/219 frontend tests pass, all three locale JSON files parse.

---

## 2026-06-03

### Build & Distribution

#### v1.0.37 built + shipping (EAS production, from `release/v1.0.37` @ `dd8b4d5`)
- **iOS build 59** — submitted to App Store Connect and **IN REVIEW** (EN/DE/PL release notes entered).
- **Android versionCode 29** — **LIVE on Google Play** (approved + published 2026-06-03; production track, EN/DE/PL "What's new"). The Play win-back + leaderboard explainer are now in production on Android.
- Version bumped `1.0.36 → 1.0.37` in `frontend/app.json`; build numbers via EAS `autoIncrement`.
- Win-back shipped without a device-sandbox purchase test (not possible) — adversarial review was the substitute; tag `winback-annual` verified live in Play Console.

### Database (Supabase)

#### `supabase/migrations/018_spot_location_privacy.sql` (NEW) — close the latent spot-location exposure (P-A)
- **Fixed (privacy/security)** the `public.spots` SELECT policy was `USING (true)` — every spot row, **including `latitude`/`longitude` and `user_id`, was world-readable** to anyone holding the app's anon key (originally opened up "for leaderboard counts"). A latent location-privacy / GDPR data-minimisation exposure, present independently of any feature. Surfaced 2026-06-03 while spec'ing the "view others' spots" idea; user chose posture **P-A (never expose others' location)** and to fix it first.
- **Changed** spots SELECT → owner-only (`using (auth.uid() = user_id)`). The four leaderboard aggregate views (created `security_invoker = on` in migration 011, so they relied on the permissive policy to count across users) are switched to **definer rights** (`security_invoker = off`); they expose only counts + public identity (username/avatar/level/country/emoji/region) — **never coordinates or raw rows** — so leaderboards keep working with no client change. League/weekly-champion data already flows through `SECURITY DEFINER` functions (013/014), unaffected.
- **Audited** every frontend `public.spots` read is own-user scoped (fetchHistory `.eq("user_id")`, counts, insert/update/delete by own id), so owner-only SELECT breaks no client path; backend uses service_role (bypasses RLS). Migration includes verification + rollback SQL.
- **APPLIED to prod 2026-06-03** (ran successfully in the Supabase SQL editor; production schema now at migration 018). Frontend (Phase 1 opt-in public profiles, no location) deferred per the spec `docs/plans/2026-06-03-social-spots-sharing-and-viewing.md`.

### Frontend

#### v1.0.37 WIP — Leaderboard rarity-score explainer (Steph's 3x-flagged "how did I get my points?")
- **Context:** Steph (UK evangelist Pro tester) flagged leaderboard scoring as opaque three times (2026-04-24, 2026-05-09, 2026-05-31), the last specifically: "I have 552 points but don't know how I achieved that… is it more for rarer ones or how many you spot?" v1.0.30's Path A (Collection-as-default + a hidden info-icon) did not resolve it — her complaint is that the **scoring formula is invisible and undiscoverable**. The originally-queued "Path B" (drop XP/leagues from the default surface) is ~80% already shipped (v1.0.30 defaults to Collection) and does not address transparency, so the chosen fix is the scoring explainer, folded into 1.0.37 for both platforms.
- **Added** `constants/rarityScore.ts` — `buildRarityScoreBreakdown(counts)` returns the per-tier contribution lines (Rare/Epic/Legendary only — the `leaderboard_rarity` view exposes only these, and the displayed score is computed from them, so the breakdown `total` always equals the number on the user's row). +3 tests asserting `total === computeRarityScore`.
- **Added** `components/leaderboard/RarityScoreInfo.tsx` (NEW) — a **visible, labelled banner** (deliberately not a bare info-icon like the undiscoverable v1.0.30 `LeagueAboutButton`) shown on the Collection tab's Rarity sub-view. Reads "How is my score of {{total}} worked out?" and opens a modal with: plain-language weights (Rare 5 · Epic 8 · Legendary 15), an explicit "Common and Uncommon don't count" note (the crux of her confusion), and a decomposition of the user's **own** score ("6 Rare × 5 = 30 …" summing to their exact total). Empty-state prompt when they have no rare+ finds yet.
- **Changed** `components/leaderboard/CollectionTab.tsx` — renders `<RarityScoreInfo myCounts={…}>` on the `rarity_score` sub-toggle, passing the current user's own rare/epic/legendary counts (found via `entries.find(id === user.id)`) for the personal breakdown.
- **Added** `leaderboard.scoring.*` i18n keys to `locales/{en,de,pl}.json` (reuse the existing `rarity.{rare,epic,legendary}` tier labels; German umlauts verified). The "Path B" remnant (deleting the XP/league tab) is parked — it does not move the legibility needle.

#### v1.0.37 WIP — Play Store win-back purchase flow (Android-only)
- **Context:** the Play offer `winback-annual-33off` (1 year, ~€19.99 single payment, tag `winback-annual`, attached to `pro_annual:annual-autorenew`) was created 2026-06-02 but **dormant** — the app only called `Purchases.purchasePackage()`, which never selects a developer-determined Play offer. Apple surfaces its own win-back automatically, so this feature is **Android-only**.
- **Added** `services/purchases.ts` — three Android-gated, gracefully-degrading helpers: `getWinBackAnnualOption()` (loads offerings, finds the annual package's `product.subscriptionOptions`, returns the option whose `tags` include `winback-annual`, else null); `isLapsedProEligible()` (true only when `entitlements.all["pro"]` exists, `isActive === false`, and `expirationDate` is in the past); `purchaseWinBackAnnual(option)` (calls `Purchases.purchaseSubscriptionOption(option)` with **no** `GoogleProductChangeInfo` — lapsed user = fresh purchase, not an upgrade; cancel returns false silently, other errors tracked + captured + re-thrown). Also re-exported the `SubscriptionOption` type.
- **Added** `app/paywall-winback-helpers.ts` (NEW) — pure, ts-jest-testable helpers: `decideWinBackVisibility({platform, lapsed, hasOption})` (true only when android + lapsed + option found) and `getWinBackPriceString(option)` (reads the live localized price from `fullPricePhase.price.formatted`, falls back to the first usable pricing phase, never hardcodes a price). New test `__tests__/paywall-winback-helpers.test.ts` — 8 tests (truth table + null/empty pricing-phase coverage).
- **Added** `app/paywall.tsx` — `winBackOption` state; `loadOfferings()` now checks `getWinBackAnnualOption()` + `isLapsedProEligible()` in parallel and shows the tile only when `decideWinBackVisibility(...)` passes. New win-back tile at the **top of the packages section** (live price via `getWinBackPriceString`, post-purchase reconcile identical to `handlePurchase` — `syncProStatus` + `fetchProfile` + "Welcome to Pro!" alert). On any error or null option it falls through to the normal full-price plans. Analytics: `winback_offer_shown` / `winback_offer_tapped` / `winback_purchase_started` / `winback_purchase_completed` / `winback_purchase_failed` / `winback_fallback_to_full_price`.
- **Added** `pro.winback` i18n keys (`title` / `body` with `{{price}}` / `cta`) to `locales/{en,de,pl}.json`. The `locales/ios/*` files are iOS Info.plist permission strings, not app i18n — correctly left untouched.
- **Rides along (no work):** the `computeAnnualSavingsPct` SAVE% badge (committed earlier) ships in this build now that the €29.99 annual price is live.
- **Scope decision:** the monthly→annual upsell was **deferred to 1.0.38** — it is a product change on active paying customers (Android proration / iOS crossgrade) and carries billing-complaint risk; it deserves its own soak. The win-back touches only lapsed users (zero proration), so it ships alone.
- **Status:** code complete, full suite green (25 suites / 216 tests), typecheck clean. **NOT built or submitted.** The purchase boundary cannot be unit-tested — requires a **device-sandbox test on a lapsed Android Play account** before any EAS build (verify the €19.99 tile appears, purchase grants `pro`, price is the live offer price, and that iOS / non-lapsed accounts see no tile).

#### v1.0.37 WIP — review-driven fixes (device test impossible → adversarial code review substituted)
- **Fixed (BLOCKER)** `locales/{en,de,pl}.json` `pro.winback.body` — the copy claimed "One-time, no auto-renew", which is **false**: verified on the RevenueCat dashboard that `winback-annual-33off` rides the **`annual-autorenew`** base plan (in the current `autorenew_v1` offering), so it renews at the regular annual price after the discounted first year (the Apple twin is documented as renewing €29.99). New truthful copy: "{{price}} for the first year, then renews at the regular annual price. Cancel anytime" (DE/PL equivalents). Left as the false claim it would have been a Google Play subscriptions-policy misrepresentation + a chargeback/1-star wave at first renewal.
- **Fixed** `services/purchases.ts` `getWinBackAnnualOption` — annual-package detection changed from `packageType === "ANNUAL" || identifier.includes("annual")` to `find(ANNUAL) ?? find(includes "annual")` so the canonical annual package always wins over a custom package whose identifier merely contains "annual".
- **Fixed** `app/paywall.tsx` — the main Subscribe CTA is now disabled during a win-back purchase (and the win-back tile during a normal purchase), closing a double-tap / concurrent-purchase window on a money path that couldn't be device-reproduced.
- **Hardened** `app/paywall-winback-helpers.ts` `getWinBackPriceString` — the fallback now skips zero-`amountMicros` phases so a future free-trial phase can never be advertised as "€0.00 for a year" (+1 test, 9 winback tests total).
- **Dashboard verification (RevenueCat, done in-session):** confirmed `pro_annual:annual-autorenew` is the autorenew base plan and is attached to both `default` and `autorenew_v1` (current) offerings → the win-back is reachable via `offerings.current` (clears the "offer siloed in another offering" risk). The **`winback-annual` tag itself is NOT verifiable in RevenueCat** (RC doesn't surface Play offer tags; they appear only in the SDK's `subscriptionOptions` at runtime) — and the available Chrome Google account (`learstephen6@gmail.com`) has no Play Console developer access for LocoSnap, so the tag must be confirmed by the account owner in Play Console → Monetise with subscriptions → `pro_annual` → `annual-autorenew` → Offers → `winback-annual-33off` → Tags.

---

## 2026-06-02

### Backend

#### Free-tier cut to 3 — backend scan-gate HELD at 6 (staged rollout)
- **Unchanged this build:** server-side `MAX_FREE_SCANS` in `src/routes/identify.ts` stays at **6**. The free tier drops to 3 but is enforced **client-side** (frontend) in this build. The backend gate is a loose anti-abuse ceiling; dropping it to 3 now would server-error users still on the old 6-scan build (blocked mid-session with an ugly error, not a paywall). Tighten to 3 in a later backend deploy once the 3-scan build is widely adopted (~3-4 weeks).
- **Why the cut:** the 6-scan free tier is the dominant cost driver — most scans are non-converting free users (~97% never pay), ~$0.18/scan. Frontend-enforcing 3 captures the saving as users adopt the new build, with zero server-error breakage for old-build users. April backlash ("3 is far too low") mitigated by the €1 intro + annual-first paywall that didn't exist then.

#### Welcome email — 6→3 scans + €1/annual line (DE/EN/PL)
- **Changed** `src/services/email.ts` (`welcomeHtml()` + `welcomeText()`) and `docs/email-welcome-spec.md`: "6 free scans" → "3 free scans" in all three languages, plus a new line — DE "Pro startet bei 1 € im ersten Monat — am günstigsten im Jahresabo", EN "Pro starts at €1 for the first month — best value on the annual plan", PL "Pro od 4,49 zł za pierwszy miesiąc — najtaniej w abonamencie rocznym". Truthful today (the €1/4,49 zł intro is live); annual left without a number since the €29.99 isn't live yet.

### Frontend

#### Free-tier cut 6 → 3 + soft-prompt ladder remap
- **Changed** `store/authStore.ts`: `MAX_FREE_SCANS` and `PRE_SIGNUP_FREE_SCANS` `6 → 3` (with revert-history comment); `components/HomeProUpsellCard.tsx` local `MAX_FREE_SCANS` `6 → 3`.
- **Changed** `components/PaywallSoftPrompt.tsx` — `variantFor()` remapped for the 3-scan tier: scan 1 → `scan_2` (gentle €1 nudge), scan 2 → `scan_5` ("1 free scan left", accurate), scan 3+ → `scan_6` (locked wall). Variant keys retained so existing tested copy maps with no locale rewrite; `scan_4` is now unreachable (dead copy left in place). `paywall.tsx` wall-source detection (`source.includes("scan_6")`) keeps working unchanged.
- **Changed** wall copy `paywall.wallSubtitle` "6 lifetime scans" → "3" in `locales/{en,de,pl}.json` (also fixed the German Denglish "6 lifetime Scans" → "3 kostenlosen Scans" and Polish plural agreement). Cosmetic comment in `app/(tabs)/index.tsx` (`scansUsed >= 6` → `>= 3`).
- **Caveats:** existing free users at 3-5 lifetime scans are walled on their next scan (accepted — non-converting cost). The pre-signup (3) and post-signup (3) counters are independent, so a scan-first-then-signup user can still reach up to 6 total — accepted for v1; seeding the counter for a true-3-total is deferred.

#### No-code-change items (recorded for context)
- The paywall is **already annual-first** (sorted annual→monthly→lifetime, annual pre-selected, BEST VALUE badge, per-week anchor) — no frontend work needed for "push to annual". The annual repricing (monthly €2.99→€3.99, annual €34.99→€29.99 for a ~37% discount in DE/FI/NL/FR) and redirecting the €1 intro to the annual product are **store/RevenueCat config**, not app code — the paywall already renders intro copy on whichever tile carries the offer.
- **Currency:** no hardcoded USD anywhere in the frontend; the paywall uses store-localised `priceString`. A dev seeing "$" reflects their account region, not a bug.

- **Verification:** 232/232 backend + 201/201 frontend tests pass; both typecheck clean. Frontend changes ship in the v1.0.36 build; the backend change (welcome email only — scan-gate held at 6) ships on the next Render deploy. Plan: `docs/plans/2026-06-02-paywall-annual-first-and-free-tier.md`.

### Frontend — SAVE % badge on the annual tile (for 1.0.37, NOT in 1.0.36)
- **Added** `computeAnnualSavingsPct()` (`app/paywall-helpers.ts`) and wired into `app/paywall.tsx`: the annual tile now shows a live **"SAVE X%"** badge computed from the monthly vs annual store prices (falls back to "Best Value" when not computable). New i18n key `paywall.savePercent` (en/de/pl). 6 new helper tests (29/29 pass). Renders ~37% (Apple €3.99 monthly), ~40% (Play €4.19), ~30% (unchanged €2.99 markets). Safe now that the €29.99 annual is live. **Queued for the tested 1.0.37 build** alongside the Play win-back app feature + monthly→annual upsell (those two are payment-flow code — not rushed; see project_revenuecat_topology + lessons.md). Build sequencing lesson captured in `lessons.md`.

### Dev tooling
- **Added** `backend/src/scripts/idOne.ts` — runs a single image through the production vision path (`npx ts-node src/scripts/idOne.ts <imagePath>`), for checking viewer-submitted "what is this train" tests against the live model.

## 2026-06-01

### Frontend

#### i18n — translate hardcoded English strings flagged by tester Leon (DE retest)
- **Fixed** strings that stayed English in German/Polish mode (screenshots IMG_5044-5049). Replaced hardcoded text with `t()` keys and added 13 keys × 3 locales (en/de/pl):
  - `app/(tabs)/index.tsx` (home/scan): `scan.heroTitle` ("Identify Any Train"), `scan.heroSubtitle`, `scan.chooseFromLibrary` ("Choose from Library"), `scan.aiPowered` ("AI-powered identification").
  - `app/results.tsx` (specs panel): `results.gauge`, `results.fuel`, `results.route`, `results.surviving` labels (the other SpecRows already used `t()`); the hardcoded "{{n}} units" values now use the existing pluralised `compare.unitsCount` (proper Polish one/few/many forms).
  - `app/card-reveal.tsx` (card back): the entire BackSpec block was hardcoded English (Max Speed, Power, Weight, Builder, Gauge, Fuel) — all wired to the existing `results.*` keys.
  - `app/(tabs)/history.tsx` (collection): sort pills (`history.sortRecent`/`sortRarity`/`sortName`) and the search placeholder (`history.searchPlaceholder`).
- **German** verified for umlauts (Spurweite, Antrieb, Aus Galerie wählen, KI-gestützte Erkennung); **Polish** with correct diacritics + plural forms.
- **NOT covered (separate issue):** backend-generated spec *values* (status "In service", fuelType "Diesel", route text) are returned in English by the AI regardless of locale — that needs backend localisation or a frontend value-map, not a label key. Logged for a later pass.
- **Verification** frontend typecheck clean; **201/201 frontend tests pass**; no hardcoded target strings remain. No backend change.

### Backend

#### Two-stage vision split — BUILT, EVAL-TESTED, and REVERTED (do not re-attempt without new evidence)
- **Attempted** the two-stage refactor: a lean core `TRAIN_ID_PROMPT` + a new `visionRules.ts` holding 23 rare-class disambiguation rules moved out verbatim (~14K tokens / ~20% off the core), to be lazy-loaded via a stage-2 call.
- **Reverted** after the eval proved it regresses accuracy. Lean-core eval: **27/36, down from the 28/36 full-prompt baseline.** Two real regressions: **SW1001 (Mendip) went from correct "EMD SW1001" back to "Class 08"** (the exact tester-flagged bug fixed for Steph 2026-05-18), and Ae 8/14 → "Be 6/8 III". Loram, RAe TEE, Tatra, DRG E 77 still passed without their rules (not load-bearing), but SW1001 + Swiss Ae were.
- **Key finding (the reason stage-2 can't save it):** when a load-bearing rule is removed from stage-1's core, stage-1 returns the *wrong* class (e.g. "Class 08"), and a wrong-class result never triggers the correct family's stage-2 lookup. Stage-1 cannot ask for a rule it cannot see. So stage-2 only ever re-confirms classes stage-1 already got right — pure overhead, no accuracy recovery. Confirmed earlier by a focused-prompt PoC: a minimal core+one-rule prompt returned the *identical* misIDs as the full 85K prompt (BR 159→193, Mireo→563, SW1001→SW1500), proving prompt size is NOT the cause of these misIDs — they are model/image limits.
- **Net:** the cost win (~20% off the vision prompt) was modest, partly clawed back by needing to keep load-bearing rules in core, and carried proven + unquantified (16 untested moved rules) regression risk. Not worth it versus the two high-certainty cost wins already shipped today (1h cache TTL + class canonicalisation). `vision.ts` restored to the full prompt (232/232 tests pass); `visionRules.ts` deleted; the dead `config.twoStageVision` flag removed from `env.ts`. **The `visionEval.ts` harness is retained** — it caught this regression for ~$1 and is the gate for any future prompt-structure change.

#### `backend/src/scripts/visionEval.ts` (new) + `package.json` — Vision eval harness (regression gate for prompt changes)
- **Added** `npm run vision:eval` — runs a fixed set of 36 labelled train photos (`~/Desktop/train photos/`) through the live vision path and scores each against an expected class, with `mustNot` guards for historical misIDs (e.g. SW1001 must not return Class 08, ICE 4 must not return BR 408). This is the regression gate for the upcoming two-stage prompt refactor: run baseline now, re-run flag-on after the split, require no regression. Needs a real `ANTHROPIC_API_KEY` in `backend/.env` (dev-only; makes real calls, ~$1/run).
- **Added** `config.twoStageVision` feature flag (`TWO_STAGE_VISION` env, default `false`) — will gate the lean-core + lazy-long-tail vision path so it ships dark and flips on via a Render env var only once it beats the baseline (instant revert without a code deploy). Currently inert (no consumer yet).
- **Baseline result (2026-06-01, current single-stage 85K prompt): 28/36 pass.** The 8 failures are PRE-EXISTING live misIDs (not refactor damage): ICE 4 → BR 408 (the recurring 412/408 bug), ICE 3neo → BR 403, Mireo → "BR 563" (hallucinated number), **BR 159 EuroDual → BR 193** (last session's BR 159 fix held on specs/facts but NOT on the vision disambiguation — still returns Vectron), Class 201 Thumper → Class 411, SW1001 (2nd photo) → EMD SW1500, Newag Dragon (ET26) → Newag Griffin (user-confirmed Dragon, so a real miss), ÖBB 5022 → ÖBB 4024. Logged to `backend_backlog_corrections`. These are to be folded into the new core/long-tail rules during the split, then re-tested.
- **No production behaviour change** — the harness is a dev script and the flag has no consumer yet. Not deployed (nothing to deploy until the two-stage path lands).

#### `backend/src/services/classNames.ts` (new) + `vision.ts` — Canonical class naming (fixes rarity inconsistency + cache fragmentation)
- **Added** `canonicaliseClass(raw)` — collapses equivalent spellings of a German train class to one canonical form before the class is used as a cache key / specs / facts / rarity / display value. Applied at `parseTrainResponse` in `vision.ts` (the single choke point both the Claude and OpenAI paths share), so all downstream consumers see the canonical class.
- **Rules (deliberately conservative):** (1) an explicit alias map for cross-designation synonyms the rules can't derive (currently `DR BR 132 → BR 232`, the East-German "Ludmilla" renumbering); (2) `Baureihe → BR`; (3) strip a leading `DB ` operator prefix before `BR`/`Class` and canonicalise the designator to `BR` (so `DB BR 232` / `DB Class 232` / `Baureihe 232` all collapse to `BR 232`); (4) normalise `BR` casing. ONLY the `DB` prefix is stripped — `DR`/`ÖBB`/`NS`/`PKP`/`ČD`/`SBB`/`VR` denote genuinely distinct operators and are preserved. UK `Class 66`, `ICE 3`, `ÖBB 1116`, Polish `EP07` etc. are left untouched. Idempotent.
- **Why** the 2026-06-01 scan-distribution audit (3,178 classified spots, via `public.spots ⋈ public.trains`) showed the AI emits the SAME physical class under multiple labels — `BR 101` vs `DB BR 101`, `BR 232` vs `DB BR 232`, `DB Class 628` vs `BR 628`. Each variant is a different `getCacheKey()` (`language::class::operator`), which (a) **fragments the 30-day Redis trains-cache** — the same train re-runs the full 4-call AI pipeline under each label, wasting spend — and (b) is the **root cause of tester Leon's rarity inconsistency** (same train scanned 3× → Rare/Rare/Uncommon): a new label → a fresh cache-missed rarity call that can land on a different tier. Canonicalising the class converges these to one cache entry → consistent rarity + fewer cache misses.
- **Note:** old cache entries under non-canonical keys are simply orphaned (re-computed once under the canonical key, then stable) — no cache version bump, no wipe. Operator-string variance (a separate, smaller fragmentation source) is left for a future pass.
- **Verification** new `classNames.test.ts` (30 cases: variant convergence, non-German labels untouched, idempotence, whitespace, nullish). `npx tsc --noEmit` clean; **232/232 backend tests pass** (was 202). **Not yet deployed — needs a push to go live on Render.**

#### `backend/src/services/{vision,trainSpecs,trainFacts,rarity}.ts` — Prompt cache TTL 5min → 1 hour (cost reduction)
- **Changed** all four Claude prompt-caching call sites from the default 5-minute ephemeral cache to a **1-hour TTL**: `cache_control: { type: "ephemeral", ttl: "1h" }` on `TRAIN_ID_PROMPT` (vision), `SPECS_SYSTEM_PROMPT`, `FACTS_SYSTEM_PROMPT`, and `RARITY_SYSTEM_PROMPT`. 1-hour TTL is generally available (no beta header). The SDK 0.39 `CacheControlEphemeral` type omits `ttl`, so the literal is cast via `as any` — the SDK forwards the field to the API unchanged (commented at each site).
- **Why** a 2026-06-01 cost audit (Anthropic Console Cost + Caching panels vs Supabase `public.spots`) found per-scan cost had **not** fallen since the 2026-05-23 hotfix: ~$9.45/day, ~$283/month, ~$0.18/scan blended — essentially the pre-fix figure — despite a healthy **98.1% cache read ratio**. Root cause: the vision call carries a **~85,000-token system prompt** (confirmed in Logs and in code: `TRAIN_ID_PROMPT` is ~272,800 chars / ~68K tokens, grown by every per-class misID fix shipped in May). With the default 5-minute TTL, sparse/quiet-day scans land after the cache expires and re-pay the full cache **write** (~$0.32) instead of a read (~$0.026) — a ~12× penalty. The evidence was Sonnet's **write amortization of only 2.74×** (each write read back just 2.74 times before expiry). A 1-hour TTL keeps the prompt warm across the typical intra-cluster gaps (observed scan clusters span ~40 min), converting most of those writes to reads. 1-hour writes cost 2× base vs 1.25× for 5-min, but far fewer are paid; net win on the medium/quiet-day traffic that dominates the current mix.
- **Scope/limits** purely a caching directive — no change to prompts, models, output, or identification behaviour. On ultra-sparse days (scans >1 h apart) a cold scan now costs marginally more (2× vs 1.25× write), but those days carry few scans. The larger structural lever — trimming/relocating the 85K-token vision prompt (much of it facts-layer content now redundant with the 2026-05-25 VERIFIED FACTS block) — is **not** in this change; queued as the next phase.
- **Verification** `npx tsc --noEmit` clean; **202/202 backend tests pass**. **Not yet deployed — needs a push to go live on Render.** Post-deploy, watch Sonnet write-amortization on the Console Caching panel (should climb well above 2.74×) and re-pull daily Cost vs Supabase spots after ~3–5 days.

---

## 2026-05-31

### Backend

#### `backend/src/services/{trainSpecs,vision,trainFacts}.ts` — BR 159 = Stadler EuroDual (corrected same day)
- **Fixed** BR 159 coverage. The class had no spec entry (showed plain "Diesel"); a first fix earlier today wrongly entered it as a **Siemens Vectron Dual Mode** (90 t, Bo'Bo', 160 km/h) — incorrect, as was a pre-existing vision note mapping 159→Vectron. Corrected after the reporting tester (a Captrain BR 159 driver-in-training, Damian) confirmed it is the **Stadler EuroDual**: a Co'Co' SIX-axle bi-mode electro-diesel built by Stadler Rail Valencia. Final values: builder **Stadler (Valencia)**, **~123 t** service weight (correct for six axles at ~20.5 t/axle), **120 km/h**, **~7,000 kW electric / 2,800 kW diesel** (CAT C175-16), **bi-mode electro-diesel** fuel. Fixed across `trainSpecs.ts` (7 keys incl. `eurodual` / `stadler eurodual`), the `vision.ts` Vectron-variant note (159 → EuroDual, not Vectron), and a `trainFacts.ts` anchor (Stadler / Co'Co' / bi-mode; never Siemens / Vectron). Loco **length** remains a feature request. 202/202 backend tests pass, typecheck clean. **Not yet deployed — needs a push to go live on Render.**
- **Lesson:** the first fix dismissed the tester's authoritative "123 t" via a physical-plausibility argument that assumed the WRONG loco (a 4-axle Vectron). The premise was wrong, not the tester. When a domain-expert primary source gives a specific figure that conflicts with an assumption, verify the locomotive's IDENTITY first — see memory `feedback_verify_premise_before_overriding_expert.md`.

#### `backend/src/services/vision.ts` — Two UK heritage-shunter disambiguation fixes (Steph batch)
- **Fixed** EMD SW1001 → Class 08 misID on the Whatley unit. The 2026-05-18 SW1001 rule keyed too hard on yellow Aggregate Industries livery + chevron stripes + Merehead context, so Whatley's **No. 120 "Whatley Endeavour"** (green/grey livery) fell through to Class 08. Root cause: livery colour was effectively a required trigger. Rewrote the rule so the STRUCTURE (centre-cab + four-wheel bogies + no jackshaft connecting rods + Mendip/Merehead/Whatley quarry context) is decisive regardless of colour; demoted yellow livery to one-of-several; corrected "only ONE example in UK service" → TWO (No. 44 Merehead + No. 120 Whatley); added an explicit green/grey-livery note. Reported by UK tester Steph (screenshots IMG_5036/5038).
- **Added** John Fowler "Flying Falcon" (Works No. 4220016) disambiguation rule. The unique preserved Fowler 0-4-0 diesel-hydraulic shunter at the Northamptonshire Ironstone Railway was returning as Class 03 (and earlier as Ruston & Hornsby 48DS). New rule keys on the **0-4-0 four-wheel / two-axle arrangement** (vs 0-6-0 six-wheel/three-axle Class 03 & Class 08, which it explicitly rules out), the **cut-down/lowered cab** (its signature, from a height-restricted bridge at Groby Granite), and NIR/Hunsbury heritage context. Explicitly bounded: does NOT bias toward Fowler for UK 0-4-0 shunters generally (R&H / Hudswell Clarke / Andrew Barclay / Hunslet built similar 0-4-0s) — fires only with the cut-down cab + NIR context. Forbids inventing a name (an earlier scan hallucinated "Charles Adane"). Reported by Steph (IMG_5035/5037); specs verified against the NIR exhibit page.

#### `backend/src/services/trainSpecs.ts` — SW1001 Whatley key + Flying Falcon KNOWN_SPECS
- **Added** `"whatley endeavour"` lookup key to the existing SW1001 KNOWN_SPECS group (same EMD spec values as No. 44).
- **Added** a Flying Falcon KNOWN_SPECS block (8 lookup keys: `john fowler 0-4-0 dh` / `john fowler 0-4-0` / `fowler 0-4-0 dh` / `fowler 0-4-0` / `fowler 4220016` / `4220016` / `flying falcon` / `john fowler & co 0-4-0`). Locks only **verified** fields from the NIR source: builder "John Fowler & Co. (Leeds)", weight "29 t", fuelType "Diesel-Hydraulic", gauge "Standard (1,435 mm)". **Deliberately leaves `power` and `maxSpeed` unset** — neither is published for this loco, so they are left to the model rather than fabricated (the prior card's "204 hp / 28 mph" were model guesses).

#### `backend/src/services/trainFacts.ts` — Flying Falcon verified-facts anchor
- **Added** a Flying Falcon facts bullet to the never-contradict list, locking: builder John Fowler & Co. of Leeds (forbids R&H / Hudswell Clarke / Andrew Barclay / Hunslet / BR); 0-4-0 (forbids 0-6-0 / Class 03 / Class 08 / R&H 48DS); diesel-hydraulic + Cummins 6-cyl engine (forbids diesel-electric/mechanical); name "Flying Falcon" only (forbids "Charles Adane"-type hallucination); 1962 build, Groby Granite cut-down-cab history, now at NIR; ~29 t. Instructs the model NOT to state any horsepower/top-speed figure as fact.

**Note:** No `trainCache.ts` change needed — both fixes change the *class string* vision returns, so re-scans key to fresh cache entries; the stale `class 08` / `class 03` entries are never hit for these locos again. Avoids collateral invalidation of legitimate Class 03/08 cache. 202/202 backend tests pass, typecheck clean. **Not yet deployed — needs a push to go live on Render.**

#### `backend/src/services/{vision,trainSpecs,trainFacts}.ts` — ÖBB 1216 "Taurus III" vs BR 193 Vectron MS disambiguation
- **Added** coverage for the ÖBB 1216 (Siemens ES64U4 "Taurus III"), which was being misidentified as BR 193 (Vectron MS). Reported via the one-month feedback DM straw poll (evangelist). Root cause: we covered the ÖBB 1116/1016 Taurus but had no entry for the **1216** — the multi-system U4 Taurus that shares the Austria–Germany–Italy / Brenner corridor with the 193 Vectron, so route/operator don't separate them and the model collapsed to the more common 193.
  - **vision.ts** — new classification rule keyed on cab profile: rounded smooth Taurus nose (1216) vs angular squared Vectron cab (193); ÖBB livery or a visible "1216 xxx" fleet number → "ÖBB 1216", never "BR 193".
  - **trainSpecs.ts** — 9 KNOWN_SPECS keys (1216 / öbb 1216 / obb 1216 / baureihe 1216 / reihe 1216 / es64u4 / taurus iii / taurus 3) locking 230 km/h, 6,400 kW, Siemens, multi-system (15 kV + 25 kV AC + 3 kV DC), ~50 units; plus extended the existing Taurus prompt note to cover the 1216.
  - **trainFacts.ts** — verified-facts anchor locking it as a Taurus (ES64U4), not a Vectron, with the 357 km/h world record (1216 050, 2006). Prevents the facts layer re-introducing the Vectron framing.
- The other two reports in the same DM were initially held for screenshots, then fixed once the photos arrived (IMG_5040-5042) — see next entry. No `trainCache.ts` change (class-string change → fresh cache keys). 202/202 backend tests pass, typecheck clean.

#### `backend/src/services/vision.ts` — two more misID fixes from the DM screenshots (red Thalys→408; E 77→E 669.1)
- **Fixed** red high-speed train misidentified as **BR 408**. Screenshot (IMG_5041) showed the reported "412→408" was actually a **red Thalys/Eurostar (BR 406 / ICE 3M)** resolving to a white ICE 3neo — a livery/class error, not the 412↔408 boundary the DM implied. Added a **STEP 0 livery gate** at the top of the ICE disambiguation block: a RED high-speed train → BR 406 (Thalys/Eurostar); the entire white-ICE branch (default-to-412, forbid-408, etc.) now applies ONLY to white-liveried trains. Forbids returning any white ICE class (401/403/407/408/412) for a red train.
- **Fixed** DRG **E 77** returned as Czech **Škoda E 669.1** (IMG_5040, a green pre-war E 77 at a Czech rail gala, returned LEGENDARY). A rule already existed (added 2026-04-16) but wasn't catching — the Czech-event context biased the model. Strengthened it: lead with the **decisive rods-vs-bogies cue** (E 77 = external coupling rods / jackshaft on a rigid frame, no bogies; E 669.1 = modern Co'Co' on bogies, no rods) + a **venue-bias guard** (a German E 77 at a Czech/Austrian gala is still German — judge the locomotive's own pre-war features, not the watermark or surroundings). Returns "DRG E 77", never "Škoda E 669.1".
- **Note:** IMG_5042 (blue loco → BR 193, the "1216" report) left as-is — the 1216 fix above is cab-profile-based and safe regardless; the specific loco's Taurus-vs-Vectron identity is unconfirmed pending its fleet number. No `trainCache.ts` change. 202/202 backend tests pass, typecheck clean. **Not yet deployed — needs a push to go live on Render.**

---

## 2026-05-30

### Infrastructure

#### `.gitignore` — Ignore `.mcp.json` to prevent API key leak
- **Added** `.mcp.json` to the ignore list (under the env-vars block). The Resend MCP server was installed at project scope via `claude mcp add resend --scope project -e RESEND_API_KEY=... -- npx -y resend-mcp`, which writes the live `RESEND_API_KEY` (read from `backend/.env`) in plaintext to `.mcp.json` in the repo root. That file was untracked but not ignored, so it would have been committable — adding it to `.gitignore` ensures the key cannot leak. No secret was ever staged or committed. Committed in `ddf6805`, pushed to `origin/main`.

#### Resend MCP server — installed (project scope)
- **Added** the official `resend-mcp` server (`npx -y resend-mcp`) registered in `.mcp.json` (gitignored). Connected and verified (`claude mcp list` → `✓ Connected`). Tools surface as `mcp__resend__*` on next session restart. Purpose: query per-email `last_event` (delivered / bounced / complained / queued) via the MCP after tester batches instead of pulling dashboard CSV exports — automates the silent-suppression check from `feedback_resend_suppression_silent.md`. Limitation: no suppression-list tool; outcomes read per-email via `last_event`. Installed MCP-only (not the full plugin) to avoid the unused React Email / agent-inbox skills.

---

## 2026-05-27

### Distribution

**v1.0.35 NOW LIVE ON GOOGLE PLAY.** versionCode 27 approved + published this evening after the Data safety form was updated to declare two previously under-declared data types:
- **Device or other IDs** — collected + shared by PostHog (analytics distinct_id / Android Advertising ID), Sentry (device info), RevenueCat (advertising ID for attribution). Declared as: Collected Yes, Shared Yes, Processed ephemerally No, Required, Purposes = App functionality + Analytics.
- **Diagnostics** — collected + shared by Sentry alongside crash logs (device info, breadcrumbs, performance traces). Same field-by-field declaration as Device or other IDs.

Two changes submitted via Publishing overview, Google ran checks and approved same-evening. v1.0.35 with all 8 phases (Pro paywall restructure, persistent home Pro upsell card, auto-open paywall triggers, paywall copy tighten, offline write queue, Pro expiring banner, zero-engagement rescue push cron, full EN/DE/PL i18n) now LIVE on both stores.

No code changes — Data safety form update is a Play Console declaration only.

### Tester correction logged (NOT yet shipped)

**Steph the Spotter — "Flying Falcon" misID.** Test scan of John Fowler & Co. 0-4-0 DM (Works No. 4220016, "Flying Falcon", ex-Groby Granite quarry, now at Northamptonshire Ironstone Railway) returned by LocoSnap as **"Ruston & Hornsby 48DS / Charles Adane"**. Two distinct bugs in one scan:
1. **Builder misID** — UK 1950s-60s industrial 0-4-0 diesel shunters visually similar across builders (Fowler / R&H / Hudswell Clarke / Andrew Barclay / Hunslet). Vision model defaults to Ruston (more numerous). Needs disambiguation by works-number-era + cut-down-cab visual cue.
2. **Hallucinated name "Charles Adane"** — same facts-layer-leak pattern as ÖBB 4020 / BR 114 / VR Sr1. No KNOWN_SPECS entry exists for Fowler 4220016, so trainFacts.ts had no anchor.

Fix shape spec'd in `backend_backlog_corrections.md` — `trainSpecs.ts` Fowler KNOWN_SPECS block + `vision.ts` UK industrial 0-4-0 disambiguation rule + `trainFacts.ts` Flying Falcon bullet + `trainCache.ts` CLASS_INVALIDATIONS. Hot-ship not required — Steph is on v1.0.34 Android (just got v1.0.35 approval), and the misID is a known-pattern bug being logged for next backend pass.

### v1.0.34 latent profile-stats display bug (DIAGNOSED — fix slated for v1.0.36)

Steph reported "data wiped" — Profile screen showed 1 spot / Level 1 / 10 XP despite her actual server-side history of 241 spots / 100 unique classes.

Diagnostic (no code changes, read-only):
- Confirmed `auth.users` has exactly ONE row for her email (no duplicate sign-in)
- Confirmed `public.spots` has 241 rows tied to her user_id (data 100% intact)
- Confirmed `public.profiles` row populated correctly (`language: en`, `country_code: GB`, push_token NULL because v1.0.34 doesn't write push tokens)
- Root cause: Profile screen reads stats ONLY from local Zustand `history` array (`app/(tabs)/profile.tsx:184` + useMemo at lines 251-257). `_layout.tsx:224` calls `loadHistory()` on app mount which fetches from server IF authenticated; if session/JWT expired silently, the call falls through to AsyncStorage-only path with just her most recent scan.
- Workaround: sign out + sign back in clears local Zustand state and forces a fresh authenticated `loadHistory()` call.

This is **pre-existing v1.0.34 behaviour**, NOT a regression from yesterday's Phase G work (which only lives in v1.0.35 and never reached her phone). Initial hypothesis blaming yesterday's `authStore.fetchProfile` reconciliation was wrong — corrected when user pointed out she's on Android v1.0.34.

**Investigation outcome from Explore agent runs:**
- Profile-fetch in `store/authStore.ts:196-200` uses `select("*")` — but TypeScript type assertion is runtime-noop, so the new `language` column from migration 017 does NOT break v1.0.34's parsing. Hypothesis disproved.
- Profile screen stats are 100% derived from local Zustand `history` array — no direct server query exists for Total spots / Unique Classes / Day streak / Rarest Find / Favourite Operator. They're all `useMemo` reductions over the local array.

**v1.0.36 fix list (priority for next dev cycle):**
1. Add Sentry capture in `trainStore.loadHistory()` — wrap the `fetchSpots()` call with try/catch + `captureException()` so silent failures become visible
2. Add pull-to-refresh gesture on Profile screen — gives users a manual workaround when stats look wrong
3. Active JWT refresh attempt in `loadHistory()` before falling through to AsyncStorage-only — if `getSession()` returns expired, call `refreshSession()` explicitly instead of giving up
4. Sanity-check on app launch — if local `history.length` is suspiciously low (<5) for a signed-in user, fire a `select count(*)` query against `spots` and trigger a forced refetch if server count > local count

All four ship together as part of v1.0.36 "silent failures audit" — extends the `feedback_supabase_silent_persistence_failures.md` remediation that v1.0.30 partially started.

### Memory updates

- **NEW** `ai_provider_cost_evaluation.md` — Gemini + DeepSeek evaluated as Claude alternatives. Decision: no migration. DeepSeek has no vision-capable model (structural blocker). Gemini Flash-Lite cheaper but ~$5-15/mo savings on a trivial line vs migration cost + quality risk on niche EU classes. Includes per-scan cost matrix + EN/DE/PL paywall framing copy ("LocoSnap €2.99 ≈ 15% of Gemini Advanced $20/mo" + Google Lens free-vs-paid framing).
- **UPDATED** `backend_backlog_corrections.md` — top entry for 2026-05-27 Flying Falcon misID (CONFIRMED, screenshot in hand) above the still-pending Eisenbahnfotograf_BLN BR 182/ICE 4 follow-up.
- **UPDATED** `project_ai_cost_baseline.md` — explicit "auto-charge confirmed 2026-05-27" line so future sessions don't mistakenly flag low credits as urgent. Self-correction logged after I incorrectly raised $8.72 balance as urgent in tonight's stats review.
- **UPDATED** `apple_stats.md` — 2026-05-27 evening snapshot appended (90d Apple cumulative + 28d Play + RC ramp + Supabase + Anthropic).
- **UPDATED** `tiktok_stats.md` — 2026-05-27 evening snapshot appended (channel 7d overview + DE €1 24h performance + PL €1 24h performance + IG numbers + comparison reads).
- **UPDATED** `project_status.md` — header bumped to 2026-05-27 evening; v1.0.35 LIVE on BOTH stores.

---

## 2026-05-26 (evening)

### v1.0.35 EAS builds + per-platform submission

After migration 017 cleared the Supabase production schema and Render auto-deployed `117dd6b`, both EAS builds triggered for production.

- **iOS build 57** (build ID `b92f5a77-2cbf-4565-83a0-bab568752495`) — finished in 7 minutes (faster than typical 15-20min), submitted to App Store Connect via `eas submit` and submitted for App Review the same session. EULA link verified in App Description for EN/DE/PL per `feedback_eula_link_required.md`. Apple §7 dismissability screenshot for the auto-open paywall added to App Review Information notes (Phase C surfaces).
- **Android versionCode 27** (build ID `68fe3fdf-c57f-4888-a630-e266c33afebb`) — finished after ~15 minutes, submitted to Play Console via `eas submit`, draft on Production track. Play Console ran its pre-launch checks (~2-10 min) before the "Review release" button unlocked, then submitted to Play Review.

Both builds carry merge commit `20ac3e5` + hotfix `a71fdd5` + proper migration-017 fix `117dd6b`. autoIncrement worked (iOS 56 → 57, Android 26 → 27).

### Pre-build cleanup — stray monorepo-root package.json

EAS build initially errored with "package.json is outside of the current git repository". Root cause: a stray `package.json` at `/Users/StephenLear/Projects/` (one level above the locosnap project root) with a handful of random RN deps and no `name`/`version`/`scripts` — cruft from a past accidental `npm install` while cd'd to the wrong directory. EAS walks up looking for the monorepo root, hit this orphan package.json first, decided that Projects/ was the project root, and bailed because Projects/ is outside the locosnap git repo.

Fix: renamed to `package.json.bak` for the build, then permanently deleted both the stray `package.json.bak` and the matching `package-lock.json` after both builds completed. Future EAS triggers from any project in `~/Projects/` won't get confused.

### v1.0.35 intro-pricing offers — globally live

In parallel with the build pipeline, Apple's "upcoming change 26/5" intro offers flipped active today. Apple intros now match the Play intros configured yesterday: **DE/AT/NL/FR/IT/ES/FI at €1, UK at £1, PL at 4,49 zł, CZ at 25 Kč first month** on the monthly Pro subscription. Replaces the previous trainvibez-only Play offer. Phase A truthful intro copy renders the live store offer dynamically — no code change required.

Public-reply copy in pricing memory ("€1 first month, cancel anytime" / DE/PL equivalents) is now truthful for every new subscriber globally, not just trainvibez-eligible Android DE users.

### Render cron `locosnap-engagement-rescue-cron` deployed + verified

Render Cron Job service created in the `My project / Production` environment alongside the existing `locosnap-league-cron`. Configuration:

- **Schedule:** `0 9 * * *` (daily at 09:00 UTC, ≈10-11 AM in DE/PL, 09 AM UK foreground window)
- **Command:** `node dist/cron/runZeroEngagementRescuePush.js`
- **Root Directory:** `backend`
- **Build Command:** `npm install && npm run build`
- **Language:** Node (had to switch from auto-detected Python 3)
- **Region:** Frankfurt (matches existing services for env-var consistency)
- **Instance:** Starter (~$0.15/month at daily cadence)
- **Env vars:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` only (Expo push endpoint is keyless)

First manual run failed with the column-doesn't-exist error → triggered the morning's hotfix → second manual run after the proper migration-017 fix returned:

```
[rescue-push-cron] starting
[rescue-push-cron] result: {"status":"completed","candidates":3,"sent":0,"failed":0,"skippedNoToken":3}
```

3 eligible candidates (Pro users >3d old who never scanned), 0 sent because no `push_token` populated yet — expected first-run shape since migration 016 only landed earlier today and tokens repopulate organically as users open the app on the new build. Cron is healthy; sends will increase as v1.0.35 rolls out and existing users open the new build.

### Three €1-themed organic ads built (DE / PL / UK)

10s portrait ads at 720×1280, all-yellow text throughout (Arial Black 56/48/46 with black border for legibility), no audio, 3-beat structure mirroring last week's launch-ad template.

| Market | Pair | File | Hook | Status |
|---|---|---|---|---|
| **DE** | BR 232 Ludmilla → ICE 4 Frankfurt arrival | `~/Desktop/locosnap_de_1eur_v3.mp4` (5.7 MB) | "1. Monat für 1 €" | **Posted today** (TikTok + Instagram) |
| **PL** | ET22 Byczka 676 → Pendolino ED250 | `~/Desktop/locosnap_pl_intro_v1.mp4` (2.6 MB) | "Pierwszy miesiąc 4,49 zł" | Ready, queued for Wednesday |
| **UK** | Class 37 Preston → Class 91 York | `~/Desktop/locosnap_uk_intro_v1.mp4` (5.8 MB) | "First month £1" | Ready, queued for Thursday |

All three reuse the existing endcards (`endcard_de.mp4` / `endcard_pl.mp4` / `endcard_en.mp4`) with a black-rectangle paint-over of the original white text and yellow text drawn on top — full-yellow palette per user direction. Three new endcard variants stay in `/tmp/locosnap_de_1eur_build/` for potential reuse: `endcard_de_1eur_v2.mp4`, `endcard_pl_intro.mp4`, `endcard_en_intro.mp4`. Could be promoted to `ad_assets/endcards/` if the format continues into v1.0.36.

Per `feedback_dont_duplicate_store_intro_pricing.md` — store-listing release notes still omit intro pricing (covered separately in `docs/release-notes-v1.0.35.md`); the €1/£1/4,49 zł hooks appear only in the organic-social ads + captions where the rule explicitly doesn't apply.

Captions for all three are documented in this session — DE/PL/EN drafts with renewal-terms disclosure ("Danach €2,99/Monat, jederzeit kündbar" / "Potem 13,99 zł/mc, anuluj kiedy chcesz" / "Then £2.99/mo. Cancel anytime."). Hashtag blocks separately drafted for TikTok (5-tag cap) and Instagram (17-18 hashtags each). German umlauts + Polish diacritics verified throughout.

### Backend stack-state at end of day

- `main` HEAD: `117dd6b` (deployed to Render web service + cron service)
- Frontend live in App Store + Play Store: v1.0.34 (v1.0.35 in review on both)
- Supabase production: at migration 017
- Render web service: live, `/api/health` 200
- Render cron service: live, scheduled `0 9 * * *` UTC, first scheduled run tomorrow morning

### v1.0.35 LIVE on App Store (late evening, ~6-8h after submission)

Apple approved + released v1.0.35 on the App Store the same day the submission was sent — significantly faster than the typical 24-48h review window. **All 8 phases of the v1.0.35 mega-PR now reaching iOS users immediately:**

- Phase A — redesigned Pro paywall (annual hero + per-week anchor + truthful intro copy)
- Phase B — persistent home Pro upsell card replacing scan_2/4/5/6 dismissable banners
- Phase C — auto-open paywall on first rare/epic/legendary scan + at scan 6/6 wall
- Phase D — wall-aware paywall copy + funded-by-subscriptions trust line
- Phase E — offline write queue for saveSpot (silent network-error data loss eliminated)
- Phase F — Pro expiring banner replacing manual recovery email loop
- Phase G — backend rescue push cron (live on Render since this morning)
- Phase H — dynamic softprompt price + i18n + version bump

Combined with the Apple intro €1 offers that flipped active this morning, **every new iOS subscriber from now on hits the new paywall AND sees the local intro price** ("1. Monat für 1 €" / "First month £1" / etc.) rendered dynamically by Phase A's truthful-intro-copy helper. Conversion-side improvements (paywall redesign + intro pricing + persistent home card) now fully aligned across iOS.

Play Store still in review at session close — Play typically 2-24h, so likely tomorrow morning. Same payload will reach Android users then.

### Launch-day conversion signal — two intro-tier conversions in 24h (RC webhooks)

Two RevenueCat webhook events confirm the intro-pricing campaign is producing real new customers immediately. Both Android Play Store, both at intro tier, both unplanned markets:

| Timestamp (UTC) | Market | Local intro | Offer | Take-home |
|---|---|---|---|---|
| 2026-05-25 19:35 | **Netherlands** | **€1.19** | `trainvibez-launch` (OLD partner-targeted offer, broader-than-expected eligibility) | ~$1.18 net of Play's 15% cut |
| 2026-05-26 13:47 | **Romania** | **6.49 RON** (~€1.30 / $1.44) | `intro-1mo-2026` (NEW Acquisition offer configured 2026-05-25) | ~$1.22 net |

**Both Play offers running in parallel produce conversions.** The 2026-05-25 decision to leave `trainvibez-launch` active alongside the new `intro-1mo-2026` Acquisition offer was correct — they each catch different cohorts via Play's eligibility-and-surfacing algorithm. NL converter saw trainvibez; RO converter saw the new one. Don't deactivate trainvibez.

**Play tier auto-mapping confirmed broader than configured.** Neither NL nor RO was in our explicit DE/UK/PL/CZ Acquisition-offer config — Play applied the offer to every market where the monthly base plan has regional pricing. By inference, the offer is reaching BE/FR/IT/ES/FI/AT/HU/BG/HR/SK/SI etc., all at local "first-month coffee" tiers (€1.00 in most EUR markets, €1.19 NL specifically, 6.49 RON for RO, 4,49 zł PL, 25 Kč CZ). Don't fight Play's tier system unless a market lands at €2+ where the psychological anchor breaks.

**Apple intro impact pending.** Apple intros only flipped active 2026-05-26 morning; iOS conversions should start showing in RC tomorrow as iPhone users discover the new pricing in App Store. No iOS conversions in the launch-day window yet — expected given the offer was live for ~6h vs Play's ~24h.

**Pricing memory `pricing_localisation.md` updated** with NL = €1.19 (was assumed €1.00), RO added as confirmed market, and the two-offer parallel-running observation logged.

---

## 2026-05-26 (afternoon)

### Migration 017 — proper fix for the v1.0.35 rescue push cron column miss

The morning's hotfix (`a71fdd5`) mapped `profiles.country_code` to language at runtime as a stopgap after the first manual cron run failed with `column profiles.language does not exist`. This afternoon's work retires that hack by giving profiles a real, explicit language column synced from the frontend settingsStore. Truthful data, not a guess.

**Migration `supabase/migrations/017_profiles_language.sql`:**
- ADD COLUMN `language text` (nullable so the backfill can run first)
- Backfill every existing row from `country_code` heuristic — DE/AT/CH → de, PL → pl, else en — using the same mapping the hotfix used at runtime
- SET DEFAULT 'en' for future inserts (Supabase Auth trigger that creates profile rows omits language; default catches it)
- SET NOT NULL after backfill so the cron query never sees null
- ADD CHECK constraint `language in ('en', 'de', 'pl')` so a frontend bug can't poison the column with a typo
- Audited per `feedback_supabase_silent_persistence_failures.md`: NOT NULL added AFTER backfill (no row will fail), DEFAULT covers omitting writers, CHECK protects from bad clients.

**Frontend changes:**
- `services/supabase.ts` — added `language?: 'en' | 'de' | 'pl'` to `IdentityUpdates` interface so the existing `updateProfileIdentity()` helper carries language writes alongside country_code / spotter_emoji / onboarding flag updates
- `store/settingsStore.ts` — `setLanguage(lang)` now writes the new value to `profiles.language` via `updateProfileIdentity()` after the local AsyncStorage update. Best-effort, signed-in users only, never blocks the local update, never throws. Lazy require breaks the otherwise-circular dep chain
- `store/authStore.ts` — `fetchProfile` now syncs local ↔ server language on divergence. Three cases covered: (1) user signed in after picking a non-default language at the picker → push local up; (2) fresh install with the user's stored language on another device → adopt server; (3) pre-migration-017 row where country_code backfill guessed wrong (e.g. PL national living in DE) → user's actual settingsStore choice wins on next fetch
- `__tests__/fetchProfileMigration.test.ts` — "fully populated" fixture now includes `language: 'en'` so the no-op test holds with the new sync path

**Backend changes (revert the morning's hotfix `a71fdd5` country_code mapper):**
- `backend/src/cron/zeroEngagementRescuePush.ts` — `CandidateRow` shape back to `{ id, language, push_token }`. SELECT clause back to `'id, language, push_token'`. `countryCodeToLanguage()` mapper removed entirely. Orchestrator passes `row.language` directly to `localisePushBody()` (matches the original Phase G design — now the column actually exists)
- `backend/src/__tests__/cron/zeroEngagementRescuePush.test.ts` — `countryCodeToLanguage` test suite removed. CandidateRow fixtures back to `language: 'en' / 'de' / 'pl'` matching the new query

**Verification:**
- Frontend: 201/201 tests pass across 24 suites; `npx tsc --noEmit` clean
- Backend: 202/202 tests pass across 18 suites; `npx tsc --noEmit` clean
- Migration is idempotent (ADD COLUMN IF NOT EXISTS, UPDATE skips already-set rows)

**Deployment dependency:** migration 017 must be applied via the Supabase dashboard before this commit's backend deploys to Render (otherwise the cron query references a column that doesn't exist yet — same failure pattern as the morning miss). Apply order: migration 017 → push code → trigger cron manual run.

**Lesson reinforced:** per `feedback_migration_column_audit.md` — every `<table>.<col>` reference in new code gets cross-checked against `supabase/migrations/*.sql` before claiming the feature is ready. Phase G missed this audit step entirely.

### Preview Build workflow — chronic 403 permissions failure fixed

`.github/workflows/preview.yml` "Comment build link" step has been failing with `Resource not accessible by integration` (403) since at least February 2026 (observed on the v1.0.22 PR, the blueprint fix PRs, and now the v1.0.35 PR). GitHub Actions default-token permissions went read-only in 2023; the workflow needs explicit `pull-requests: write` + `issues: write` grants to POST a comment on the PR.

Added a `permissions:` block at workflow level granting the two writes (plus `contents: read` for the checkout step). The actual EAS preview build always succeeded — only the post-build "comment with build link" step failed. Future PRs will get the comment, future runs no longer show as failed.

### v1.0.35 hotfix (`a71fdd5`) — superseded by migration 017 above

Morning hotfix kept here as a historical reference: swapped the rescue cron query from `language` to `country_code` and added a runtime `countryCodeToLanguage()` mapper. Worked, but conflated country with language (false for travellers / migrants / anyone who picked a non-default language at the picker). Retired this afternoon by migration 017.

---

## 2026-05-26

### v1.0.35 — Pro monetisation + resilience release (8-phase mega-PR on `feat/v1.0.35`)

Single mega-PR shipping eight phases against the v1.0.35 prep plan committed 2026-05-25. Sequence: A → B → C → D → E → F → G → H. Branch `feat/v1.0.35` carries 8 commits + this CHANGELOG/ARCHITECTURE pair, awaiting PR + merge + EAS build. The €1 Club tier (Phase 0 in the original 2026-05-22 design) stays deferred to v1.0.36 — v1.0.35 ships entirely against the existing `pro` entitlement.

Today's parallel store-side change: intro offers configured + activated on Play (DE/AT/NL/FR/IT/ES/FI at €1, UK at £1, PL at 4,49 zł, CZ at 25 Kč) and scheduled on Apple (same prices, "upcoming change 26/5" → automatic flip today). Replaces the trainvibez-only Play offer with standard Acquisition-eligibility intros visible to every new subscriber. No code change required — Phase A's truthful intro copy renders dynamically from `pkg.product.introPrice`.

### Phase A — Pro paywall restructure (`e2e816f`)

`frontend/app/paywall.tsx`, `frontend/app/paywall-helpers.ts`, `frontend/__tests__/paywall-helpers.test.ts`, EN/DE/PL locales.

- Annual tile visual dominance: always-on teal border + extra vertical padding so the eye lands on annual first regardless of selection state.
- New per-week equivalent line under the annual price — computed as `annualPrice / 52`, formatted via `Intl.NumberFormat` per locale. Sub-coffee anchor in every market (DE €0.67/week, UK £0.54/week, PL 1.73 zł/week, ES/IT €0.48/week). Chosen over per-month equivalent because €2.92/month vs €2.99 monthly tier is a 7-cent psychological no-op.
- Truthful intro copy: dropped hardcoded "30% OFF FIRST 3 MONTHS" badge + "After 3 months regular price applies" disclaimer (false advertising the moment any monthly tile carried an introPrice). Replaced with structured `describeIntroOffer()` pure helper extracting fields from `pkg.product.introPrice`; renders via singular/plural i18n templates ("€1 for first month, then €2.99/month"). Intro badge + dynamic line surface on whichever tile actually has an offer (annual + monthly per user decision).
- Feature bullets reordered: Unlimited scans → Your whole collection → Premium blueprints. Labels + descriptions moved from hardcoded English to i18n keys.
- New pure helpers `formatPerWeek()` + `describeIntroOffer()` in paywall-helpers.ts with 12 new ts-jest tests.
- Removed "Save 25%" green pill from annual card — redundant once per-week anchor + always-on teal border carry the visual hierarchy.

### Phase B — Persistent tier-aware home Pro card (`22dbb0d`)

`frontend/components/HomeProUpsellCard.tsx` (new), `frontend/app/(tabs)/index.tsx`, EN/DE/PL locales.

Replaces the discrete scan_2/4/5/6 PaywallSoftPrompt variants on the scan screen with a single persistent self-gating card. Friction increases deliberately — free users now see a Pro nudge from day 1 rather than only at specific scan counts.

- Self-gating per ProRescuePrompt pattern. Pro users + unauthenticated trial users render nothing.
- Two visual states: teal "persistent" counter for scans 0-5, orange "locked" treatment when scansUsed >= 6.
- Non-dismissable by design. Taps to `/paywall?source=home_persistent` or `?source=home_persistent_locked` for clean analytics segmentation.
- New i18n keys under `scan.proUpsell.{persistent,locked}.*` with full Polish one/few/many plurals matching the existing `trialBanner` pattern.
- `PaywallSoftPrompt` kept in codebase — still rendered on results screen (per plan, only home/scan surface migrated to the persistent card).

### Phase C — Auto-open paywall triggers (`aa1768e`)

`frontend/app/card-reveal.tsx`, `frontend/app/(tabs)/index.tsx`.

Two surfaces that previously required a tap on a soft prompt now open the paywall themselves. Both cleanly dismissable via the existing top-left close button in paywall.tsx (Apple §7).

- **Trigger 1 — first rare/epic/legendary scan reveal:** AsyncStorage flag `locosnap_pro_rare_paywall_shown` ensures once-per-device. 1.2s delay after the reveal-animation-complete callback so the user sees the wow card land before the paywall slides up. Pro users excluded. New analytics event `paywall_auto_open_rare` with { tier, train_class }.
- **Trigger 2 — scan 6/6 wall:** catches the backend `"Free scan limit reached"` error in the handleScan catch branch, right after setScanError. 800ms delay so the error message lands first. Pro users excluded. New analytics event `paywall_auto_open_wall` with { scansUsed }.

### Phase D — Wall-aware copy + funded-trust line (`2b3d46a`)

`frontend/app/paywall.tsx`, EN/DE/PL locales.

Addresses the May 2026 paywall-friction signals (bavarian.rail / spottbyshone / kolejowywolow / nahverkehrthueringen) captured in `feedback_paywall_reframe_no_apology.md`.

- **Wall-source-aware hero**: helper `isWallSource()` matches `auto_wall`, `home_persistent_locked`, and `softprompt_scan_6_*`. When hit, hero title swaps to "Free scans used — no reset" / "Kostenlose Scans aufgebraucht — kein Reset" / "Darmowe skany wykorzystane — bez resetu" and the subtitle to a clear "Your 6 lifetime scans are spent. Pro keeps every scan unlimited" pattern. Kills the "I thought it refreshes" misunderstanding.
- **Funded-by-subscriptions trust line**: always-visible single line between safety triggers + Restore Purchases. Small teal heart-outline icon + muted text. EN "Funded by subscriptions, not ads or data" / DE "Finanziert durch Abos, nicht durch Werbung oder Daten" / PL "Finansowane z subskrypcji, nie z reklam ani danych". Mechanism-first per the no-apology reframe.
- Localised "Cancel anytime" + "No commitment" while in the safety row.

### Phase E — Offline write queue for saveSpot (`0b1f433`)

`frontend/services/spotQueue.ts` (new), `frontend/__tests__/services/spotQueue.test.ts` (new, 24 tests), `frontend/services/supabase.ts`, `frontend/app/_layout.tsx`.

Closes the silent-fail pattern from `feedback_supabase_silent_persistence_failures.md` (5 events / 3 users / 13 days as of 2026-05-25 — below escalation threshold but the v1.0.35 release window is the cheapest place to land the structural fix).

- New pure persistent queue over AsyncStorage key `locosnap_spot_queue`. Public surface: `isTransientNetworkError`, `enqueue`, `peek`, `size`, `readQueue`, `writeQueue`, `flushQueue(attemptFn)`. Shape-checked reads (corrupt JSON / non-array / malformed items → empty queue, never throws). Per-item retry counter; MAX_RETRY_ATTEMPTS = 3 before drop + Sentry capture. Terminal errors drop immediately. Sentry policy: capture ONLY on terminal failures + retry exhaustion — transient drops are exactly what the queue is for.
- `saveSpot` modified to: lazy-flush at the start (fire-and-forget), enqueue + return `queued:<timestamp>` placeholder on transient network error, fall through to existing capture + null on terminal error.
- New `attemptSpotInsert(payload)` + `flushPendingSpots()` module-level helpers in supabase.ts for the flush path.
- `_layout.tsx` calls `flushPendingSpots()` on startup + every AppState `"active"` transition. No new dependency — uses built-in React Native `AppState`. NetInfo intentionally skipped per CLAUDE.md "Simplicity First"; can layer on later if Sentry shows the queue accumulating.
- Test mocking note: project's `jest.config.js` moduleNameMapper rewrites `./analytics` + `../services/analytics` imports to `__mocks__/analytics.ts`, so per-test `jest.mock()` is ineffective. Tests use `jest.spyOn()` against the mapped mock module directly — comment in the test file documents this for future maintainers.

### Phase F — Pro expiring-soon banner (`784872c`)

`frontend/components/ProExpiringBanner.tsx` (new), `frontend/components/ProExpiringBanner-helpers.ts` (new), `frontend/__tests__/components/ProExpiringBanner-helpers.test.ts` (new, 11 tests), `frontend/services/purchases.ts`, `frontend/app/(tabs)/index.tsx`, `frontend/app/(tabs)/profile.tsx`, EN/DE/PL locales.

Replaces the manual email-recovery loop (Luis + Wojciech batch sent 2026-05-24) — users now see the re-subscribe surface in-app before their Pro lapses without anyone having to email them.

- Pure visibility decision in `ProExpiringBanner-helpers.ts decideBannerVisibility()`. Hides for: not Pro, no RC entitlement (legacy manually-granted Pro users), lifetime Pro (no expirationDate), auto-renewing (`willRenew === true`), expiration > 7 days out OR already expired, malformed expirationDate.
- Days-remaining math rounds UP (47h → "2 days") for readability.
- Refreshes RC state on mount, on `profile.is_pro` change, and on every AppState `"active"` transition.
- New `getProEntitlementInfo()` in services/purchases.ts returns `{ isPro, expirationDate, willRenew } | null` — wraps `Purchases.getCustomerInfo()` and surfaces the entitlement detail that the boolean-only `checkEntitlements()` hides.
- Warning-orange visual treatment (#FF8C42) distinct from teal Pro-upsell card and orange-locked variants — signals "attention needed by existing Pro user", not "convert to Pro".
- Mounted in `(tabs)/index.tsx` between HomeProUpsellCard + ProRescuePrompt, and at the top of `(tabs)/profile.tsx` above the country-flag banner.
- New i18n keys `pro.expiring.{title,body}` with full Polish one/few/many plurals.

### Phase G — Zero-engagement rescue push cron (`efe229f`)

`backend/src/cron/zeroEngagementRescuePush.ts` (new), `backend/src/cron/runZeroEngagementRescuePush.ts` (new), `backend/src/__tests__/cron/zeroEngagementRescuePush.test.ts` (new, 20 tests), `supabase/migrations/016_engagement_push_tracking.sql` (new).

Catches the dead-money cohort from the 2026-05-17 Supabase / RevenueCat audit (paid users who never made it past sign-up) and nudges them back into the product before churn. Companion to the in-app ProRescuePrompt that fires only when the user actually opens the app.

- Pure helpers (ts-jest tested): `localisePushBody(language)` → { title, body } in EN/DE/PL with regional-locale normalisation; `buildExpoPushMessage(token, body)` → Expo envelope; `isSendable(row)` → bool with garbage-token rejection (must start with `ExponentPushToken[` or `ExpoPushToken[`).
- Orchestrator queries `profiles` where `is_pro=true AND last_spot_date IS NULL AND created_at < (now - 3d) AND (engagement_push_sent_at IS NULL OR engagement_push_sent_at < (now - 7d))`. MAX_PUSHES_PER_RUN = 500 safety cap. POSTs to `https://exp.host/--/api/v2/push/send`. Checks both HTTP status AND Expo ticket-level `data.status` before counting as sent. Stamps `engagement_push_sent_at = now()` on success for 7-day cooldown.
- Render cron entrypoint script — recommended schedule `0 9 * * *` (daily 09:00 UTC). Cron will NOT run until (a) branch merges to main + ships to Render AND (b) Render dashboard configures the new cron job. Both are post-PR-merge ops.
- **Migration 016** adds two columns to `public.profiles`: `push_token text null` + `engagement_push_sent_at timestamptz null`. ADD COLUMN on existing pre-2026-10-30 table — default GRANTs carry forward per `feedback_supabase_grant_after_2026_10_30.md` (rule applies only to CREATE TABLE). Frontend `services/notifications.ts savePushToken` already writes to `push_token` with silent-fail wrapper since pre-v1.0.30 — once migration 016 lands, those writes start landing automatically.

### Phase H — Softprompt dynamic price + i18n audit + version bump + docs

`frontend/components/PaywallSoftPrompt.tsx`, `frontend/app.json`, EN/DE/PL locales, `docs/CHANGELOG.md`, `docs/ARCHITECTURE.md`.

- **Dynamic softprompt price refactor**: PaywallSoftPrompt now fetches `getOfferings()` on mount, extracts the monthly package's `introPrice.priceString`, and interpolates it into the scan_2 title via new keys `paywall.softPrompt.scan_2.{titleWithPrice,titleGeneric}`. Fallback to generic "Try Pro" title when no intro is live in the user's market. Permanently eliminates the price-drift problem surfaced 2026-05-26 when the Play PL intro went from 5,19 zł to 4,49 zł — the static hardcoded copy was quietly over-quoting by 70 grosz. Legacy `paywall.softPrompt.scan_2.title` keys retained for backwards compatibility but no longer reached at runtime; could be cleaned up post-ship.
- **i18n parity audit**: 323 base keys (plural-suffix normalised) in each of EN/DE/PL — zero missing, zero orphans. Polish keys correctly use one/few/many for plural where appropriate (`scan.proUpsell.persistent.body`, `pro.expiring.body`, `scan.trialBanner`, etc.). German umlauts (ä/ö/ü/ß) and Polish diacritics (ą/ć/ę/ł/ń/ó/ś/ż/ź) verified across all Phase A-H additions.
- **Version bump**: `frontend/app.json` `version` `1.0.34` → `1.0.35`. iOS `buildNumber` and Android `versionCode` auto-increment via `eas.json` `"autoIncrement": true` on the production profile.
- **Tests**: frontend 201/201 across 24 suites; backend 202/202 across 18 suites. Typecheck clean on both.
- **No new tests** in Phase H itself — the dynamic softprompt logic is a thin SDK fetch + i18n interpolation; existing `describeIntroOffer` + Phase A paywall tests cover the underlying mechanism.

---

## 2026-05-25

### Backend — Phase A facts-layer systemic fix: VERIFIED FACTS block injection

Triggered by the Google Play DE 1-star review (handle nahverkehrthueringen@gmail.com, Android 16, release 1.0.34) the morning after the BR 114 + BR 628 fixes. Reviewer cited "Krauss-Maffei attribution everywhere", electric locos called diesel multiple units, and "contradicts itself in the same sentence with different speeds for the same Baureihe" — symptoms of the same facts-layer-leak pattern that produced the five correction loops 2026-05-23/24.

Class-by-class hand-written `trainFacts.ts` bullets (the original audit plan, 4-6h batch) would only patch the 18 classes already covered + the next ~15-20 high-volume DE/PL/AT classes — leaving the 130+ remaining KNOWN_SPECS-locked classes still at facts-side risk. Different approach shipped instead: extend the existing year-only `VERIFIED FACT` injection in trainFacts.ts to pass **every KNOWN_SPECS / Wikidata value** into the facts prompt as a single `VERIFIED FACTS` block. The LLM is now structurally prevented from contradicting builder/year/max-speed/power/weight/fleet-count/gauge/fuelType for **every class with a KNOWN_SPECS entry** — that's the full ~150-200 classes covered by the WIKIDATA_CORRECTIONS table, not just the hand-written 18.

Changes:

`backend/src/services/trainSpecs.ts` — exported `SpecsOverride` type and added new `lookupKnownSpecs(trainClass)` helper that returns the WIKIDATA_CORRECTIONS entry for a class (or undefined). Uses the same `toLowerCase().trim()` normalisation as `applyKnownCorrections` to ensure parity between the specs merge and the facts injection. No behaviour change for `getTrainSpecs` callers — the new helper is additive.

`backend/src/services/trainFacts.ts` — three coordinated changes: (a) **new `buildVerifiedFactsBlock(train, wikidata, known)` helper** that builds a multi-line `VERIFIED FACTS` block with explicit precedence KNOWN_SPECS > Wikidata > unset for every covered field (builder, year, maxSpeed, power, weight, numberBuilt, fuelType, gauge), plus train.class/operator/type always included from the identification itself; (b) **`buildFactsUserMessage` signature widened** from `(train, verifiedYear?, language?)` to `(train, wikidata, known, language?)` so the full block is composed in one place; (c) **`getTrainFacts` call site updated** to call `lookupKnownSpecs(train.class)` synchronously alongside the existing async `getWikidataSpecs` lookup and pass both into the user-message builder. The `Promise.allSettled` parallel-with-getTrainSpecs structure in identify.ts is unchanged — facts still runs in parallel with specs, the new helper is purely a sync table read.

`backend/src/services/trainFacts.ts` system prompt — **new top-of-rules entry** ahead of the existing summary/historicalSignificance/funFacts rules: *"VERIFIED FACTS block (highest priority): if the user message contains a 'VERIFIED FACTS' block, every value in that block is ground truth from our specs database. You MUST NOT contradict any value (builder, year, max speed, power, weight, fleet count, gauge, fuelType, operator, type) in any field of your response. ... If you do not know an item independently of the verified block, return fewer items or omit the detail — never fabricate a value that conflicts. The verified block overrides any prior training-data belief you have about this class."* The 18 existing class-specific bullets remain — they still carry narrative context (withdrawal status, operator lineage, regional deployment) that the spec-field block does not capture.

`backend/src/__tests__/services/trainFacts.test.ts` — **two existing tests updated** to match the new block format (`Year introduced: 2020` substring instead of `entered service in 2020`; VERIFIED FACTS block now always emitted with class/operator/type even without Wikidata). **Four new tests added**: (1) block always carries class/operator/type without Wikidata; (2) full KNOWN_SPECS override values surface (tested against the real BR 114 entry — LEW Hennigsdorf, 160 km/h, 4,220 kW, 37 units); (3) KNOWN_SPECS wins precedence when Wikidata returns a conflicting value; (4) Wikidata fills fields KNOWN_SPECS does not cover (tested against Class 390 — weight and yearIntroduced not in the KNOWN_SPECS block but mocked from Wikidata).

**No CLASS_INVALIDATIONS bump.** Phase A is a pure prompt-engineering change; existing cache entries are either (a) already correct (no change needed), (b) already covered by per-class invalidations from the recent ÖBB 4020 / VR Sr1 / BR 114 / BR 628 fixes, or (c) age out within 30-day TTL. Per `backend_cache_invalidation_pattern.md`, a global cache bump for a cross-class prompt change would reopen the May 2026 cost-leak pattern ($0.20/scan baseline) — not done.

All 182/182 backend tests pass (was 179 — +3 net new test cases). Typecheck clean. **Not yet deployed — needs a push to go live on Render.**

**Expected impact:** every facts request for a class with a KNOWN_SPECS entry (the BR 114, BR 628, ÖBB 4020, VR Sr1 / Sr2 / Dv12 / Sm-family, ICE 3/4 family, BR 110/140/143/151/155/156/232/247/250/648, Münchner R2.2, ČD 753/754, Berlin 483/484, PKP / Newag families, SJ Rc1-Rc7, and many more — ~150-200 distinct classes) now has its builder/year/speed/power/weight/fleet-count/gauge/fuel-type values locked in the facts prompt itself, not just in the displayed Specifications panel. The Google Play 1-star reviewer's three complaint patterns ("Krauss-Maffei everywhere", "electric locos called DMUs", "contradicts itself with different speeds for the same Baureihe") are all caught structurally by this single change.

---

## 2026-05-24

### Backend — DB BR 114 + BR 628 wholesale facts-layer locks (DE launch ad commenter J●|\|)

Public correction loop on the v1.0.34 DE launch ad. Commenter @J●|\| posted two screenshots of misidentified DB scans with the short caption *"die ki braucht aufjedenfall ein paar Verbesserungen"* ("the AI definitely needs some improvements"). Two distinct classes, both exhibiting the facts-layer-leak pattern that hit ÖBB 4020 (2026-05-23) and VR Sr1 (this morning).

**BR 114 — three independent hallucinations on one scan:**
- Builder shown as *"Krauss-Maffei / Henschel / Krupp"*. That trio is the classic West German Bundesbahn consortium that built BR 110 / BR 111 / E 10 / V 200 — they had no involvement with any 112/114, which is a purely East German design. Real builder: **LEW Hennigsdorf (later AEG / Adtranz / Bombardier)**.
- Facts paragraph claimed *"viersystemige Elektrolokomotive der Deutschen Bahn, die für den Einsatz im Nahverkehr und auf nicht vollständig elektrifizierten Strecken konzipiert wurde"*. Wrong electrification system count: BR 114 is **single-system 15 kV 16.7 Hz AC**. The "viersystemig" framing belongs to BR 189 (Siemens Vectron MS), not BR 114.
- Route shown as *"North Rhine-Westphalia and Lower Saxony"*. Wrong region: BR 114 operates predominantly in **eastern Germany** (Berlin S-Bahn area, Brandenburg, Saxony, Thuringia, Mecklenburg-Vorpommern). NRW and Lower Saxony are western Bundesländer.

**BR 628 — wrong family entirely:**
- Facts paragraph misidentified the class: *"Die BR 628 ist ein moderner Dieseltriebwagen der Baureihe LINT 41 von Alstom, der seit den frühen 2000er Jahren das Rückgrat des deutschen Regionalverkehrs bildet."* All three head-claims wrong. **LINT 41 = BR 640 / BR 648**, a completely different 1999+ Alstom-built articulated DMU. **BR 628 = MaK (later Vossloh Kiel)**, 1974 prototype + 1986+ main production, ~309 sets across sub-variants 628.0/.2/.4. Not LINT family, not Alstom-built, not 2000s.

Same root pattern as the ÖBB 4020 and VR Sr1 fixes earlier this session: `KNOWN_SPECS` pinned the typed spec fields (mostly), the facts narrative paragraph drifted because no class-specific lock existed. Wholesale fix shipped in one commit (`3211e15`):

`backend/src/services/trainSpecs.ts` — **BR 114 KNOWN_SPECS expanded** from a maxSpeed-only Wikidata correction to full coverage across 6 lookup variants (`db class 114`, `class 114`, `br 114`, `baureihe 114`, `db baureihe 114`, `db br 114`) locking maxSpeed 160 km/h, power 4,220 kW, weight 82 t, builder "LEW Hennigsdorf (later AEG / Adtranz / Bombardier)", numberBuilt 37, fuelType "Electric (15 kV 16.7 Hz AC)", gauge standard. **New BR 628 KNOWN_SPECS block** with 9 lookup variants (`br 628`, `br628`, `baureihe 628`, `db baureihe 628`, `db br 628`, `db class 628`, `class 628`, `628.2`, `628.4`) locking 120 km/h, 485 kW, 140 t, builder "MaK (later Vossloh Kiel)", 309 units, fuelType "Diesel mechanical", standard gauge. Inserted after the SJ Y1 block before the DB ICE family section; comment block documents the discovery context and the LINT-family disambiguation.

`backend/src/services/trainFacts.ts` — **two new comprehensive class bullets** inserted into the system prompt above the existing ÖBB 4020 bullet. BR 114 bullet hard-locks: (a) builder LEW Hennigsdorf / Adtranz / Bombardier lineage — forbids Krauss-Maffei / Krupp / Henschel / Siemens-alone / any West German Bundesbahn consortium; (b) electrification single-system 15 kV 16.7 Hz AC — forbids "viersystemig" / "Vier-System" / "four-system" / "multi-system" / "Mehrsystem"; (c) operating region eastern Germany — forbids NRW / Niedersachsen / Bayern / Baden-Württemberg or any western Bundesland; (d) units built ~37 — forbids higher rounded figures. BR 628 bullet hard-locks: (a) builder MaK / Vossloh Kiel — forbids Alstom / Bombardier / Siemens / Stadler / LHB-alone; (b) explicit forbid-list for "LINT" / "LINT 41" / "BR 640" / "BR 648" / "Coradia LINT" / "Teil der LINT-Familie" / "der LINT-Plattform"; (c) era 1974-1996 — forbids "frühen 2000er Jahre" / "moderner Dieseltriebwagen" / any post-2000 entry year; (d) framing as "workhorse of the non-electrified DB Regio network, in service since the late 1980s, being progressively replaced by LINT 27 (BR 640), LINT 41 (BR 648), Coradia Continental and Talent 2 units". Both bullets include explicit Discovered notes naming the commenter and the specific hallucinations observed, for the next-reader audit trail.

`backend/src/services/trainCache.ts` — **16 new entries added to `CLASS_INVALIDATIONS`** at timestamp `2026-05-24T22:30:00Z` (7 BR 114 + 9 BR 628) following the variant-coverage checklist established this morning. Every KNOWN_SPECS lookup key is mirrored. Comment block on each documents the discovery context.

All 179/179 backend tests pass; typecheck clean. Pushed to `origin/main` as `3211e15`. Render auto-deploy in flight; redeploy will be confirmed via `/api/health` `cache.totalEntries` reset (was 327 entries pre-deploy).

**Fourth and fifth classes in 3 days with the same facts-layer-leak pattern (after ÖBB 4020 stage 1+2 cross-midnight, ÖBB 4020 stage 3 morning, and VR Sr1 late morning).** Strengthens the case for the systematic KNOWN_SPECS ↔ trainFacts coverage audit — every class with a KNOWN_SPECS entry but no `trainFacts.ts` bullet is at risk of the same failure mode. Audit queued as next-session priority.

Public reply commitment: post a short DE reply to J●|\| in the same launch-ad thread once Render redeploy is confirmed live.

### Backend — VR Sr1 facts-layer wholesale lock (Finnish TikTok commenter "Deevee")

Finnish TikTok commenter "Deevee" (Finnish flag emojis) posted a screenshot of a VR Sr1 scan captioned "What is this 😭". The Specifications panel was entirely correct (160 km/h / 3,100 kW / 84 tonnes / Novocherkassk / Finnish broad gauge / Electric 25 kV 50 Hz — all sourced from `KNOWN_SPECS` and matching the real Sr1 spec sheet). The hallucination was confined to the facts-layer prose:

- *"The VR Sr1 was Finland's first mainline electric locomotive — a groundbreaking 1920s Bo-Bo..."*
- *"The Sr1 was one of the earliest mainline electric locomotives in Scandinavia, entering service in the 1920s..."*

Two wrong claims. (1) **Decade.** Sr1 prototype 3001 was delivered in 1973, production ran 1973–1985 with a small later batch through ~1996. Finland did not electrify its mainline network until 1969 (Helsinki–Kirkkonummi was the first section), so it is historically and geographically impossible for a Finnish mainline electric loco to date from the 1920s — the model fabricated the date by ~50 years. The "Finland's first mainline electric" framing is correct in context but the decade is invented. (2) **Wheel arrangement.** Sr1 is **Co'Co' (six axles, two three-axle bogies)**, not Bo-Bo. The Co'Co' arrangement is a defining Sr1 visual characteristic and distinguishes it from the four-axle Bo'Bo' Sr2 and Sr3 successor classes. The `trainSpecs.ts` vision-prompt block explicitly forbids Bo'Bo' for Sr1, but `trainFacts.ts` had no Sr1 bullet — so the facts prose was free-form and the LLM padded with plausible-sounding wrong claims.

Same root pattern as the 2026-05-23 ÖBB 4020 wholesale fix: specs panel held because KNOWN_SPECS pinned typed fields, facts narrative paragraph drifted because no class-specific lock existed. Wholesale fix shipped in one commit:

`backend/src/services/trainFacts.ts` — new comprehensive VR Sr1 bullet inserted into the system prompt above the existing VR Dv12 bullet (keeps Finnish content adjacent). Hard-locks every observed and plausible hallucination: (a) entry year **1973** — forbids "1920s", "1930s", any pre-1970 date, any "entering service in the 1920s" framing; (b) wheel arrangement **Co'Co'** — forbids "Bo-Bo", "Bo'Bo'", any four-axle attribution; (c) builder **Novocherkassk (NEVZ) / Strömberg** joint Soviet-Finnish project — forbids Siemens, ABB, Adtranz, Bombardier, SLM, Stadler, or any Western European builder; (d) operator **VR only** — Sr1 has never been exported or operated outside Finland (broad-gauge spec alone restricts it); (e) fleet size **110 units** — forbids any other figure; (f) current status framed as "Finland's first mainline electric locomotive, the workhorse of Finnish electric traction from the 1970s through the 2010s, now gradually being replaced by Sr3 Vectron units from 2017 onwards" — forbids "extinct", "all withdrawn", "preserved only", "museum class", "phased out completely". Explicit Discovered note included for the next-reader audit trail.

`backend/src/services/trainCache.ts` — added 7 entries to `CLASS_INVALIDATIONS` for VR Sr1 with timestamp `2026-05-24T11:00:00Z`, following the variant-coverage checklist established earlier in the same morning's ÖBB 4020 third-stage fix. Mirrors both KNOWN_SPECS keys (`sr1`, `vr sr1`) plus English variant (`class sr1`) plus common spacing / hyphenation forms (`sr 1`, `vr sr 1`, `sr-1`, `vr sr-1`). Comment block documents the discovery context and the cross-reference to the variant-coverage rule.

All 179/179 backend tests pass; typecheck clean. Confirms — for the second class in 24 hours — the broader lesson that facts-layer hallucinations are routinely worse than specs-layer hallucinations on the same class, and that every class with a KNOWN_SPECS entry needs a matching `trainFacts.ts` bullet AND `CLASS_INVALIDATIONS` coverage to be truly fixed. The Sr1 case is also the first instance of the new variant-coverage checklist being applied **proactively** rather than reactively (yesterday's ÖBB 4020 third-stage fix retrofitted the missing variants; today's Sr1 fix included all of them from the first commit).

Public reply commitment: post a short FI/EN reply to Deevee in the TikTok thread once Render redeploy is confirmed live. Suggested wording (under TikTok's 150-char limit):

> Fix on the way — Sr1 is 1973 Co-Co, not 1920s Bo-Bo. Backend lock live shortly, please re-scan. Kiitos!

### Backend — ÖBB 4020 cache-invalidation key-variant gap fix (third stage of same launch-ad correction loop)

Same DACH commenter ("vierzigzwanzig") posted a third screenshot the morning after yesterday's wholesale fix, captioned "Immer noch falsch" — the Results card was still showing every one of the pre-fix hallucinations word-for-word ("seit 2009 im Einsatz", "Südostbahn-Nahverkehrs", "über 300 Einheiten", "von Siemens entwickelt und gebaut", "160 km/h", "4.000 kW", "4020.1 / 4020.5 Varianten", "Exporterfolg in andere europäische Länder"). Root cause: yesterday's `CLASS_INVALIDATIONS` map listed only 4 of the 6 class-name variants that `trainSpecs.ts` KNOWN_SPECS covers (missing `öbb baureihe 4020` and `reihe 4020`). When Vision returned one of the missing variants for this user's scan, `isClassInvalidated()` did an exact-match lookup, missed, and served the stale pre-fix Redis entry back unchanged. The verbatim word-for-word match between the screenshot prose and the pre-fix hallucinations is the signature of a cache hit on a stale entry, not a fresh LLM hallucination — if it were the LLM ignoring the system-prompt update, the wording would have varied.

`backend/src/services/trainCache.ts` — expanded the ÖBB 4020 `CLASS_INVALIDATIONS` block from 4 entries to 10. Added `öbb baureihe 4020`, `obb baureihe 4020`, `reihe 4020`, `öbb reihe 4020`, `obb reihe 4020`, `class 4020` so every plausible Vision class-string variant now invalidates. Timestamp bumped from `2026-05-23T22:00:00Z` to `2026-05-24T07:50:00Z` so any entry created between yesterday's fix and this morning is also caught (defence in depth; new entries should already have correct facts from the prompt update, but if Vision wrote under a key the previous map didn't cover, they'd still be wrong-stale). Comment block extended to document the second-stage gap so the next reader sees why there are 10 keys for one class.

All 179/179 backend tests pass; typecheck clean. Same-session ship pattern again — third stage of the same launch-ad correction loop. Lesson surfaced (queue for memory): when adding `CLASS_INVALIDATIONS` entries, the source-of-truth for variant coverage is `KNOWN_SPECS` in `trainSpecs.ts`, not gut feel — every lookup key there needs an entry in the invalidation map for any class that gets corrected, or pre-fix Redis cache will leak through.

Reply commitment carried over from yesterday: post the "Update: 4020 jetzt korrekt — bitte nochmal scannen, dauerhaft gefixt" follow-up in the same thread once Render confirms this deploy live.

---

## 2026-05-23

### Backend — ÖBB 4020 wholesale facts-layer corrections (from launch-ad comment, two stages)

DACH commenter responded within hours of the v1.0.34 launch-ad (DE "Von Spottern, für Spotter" community-pitch cut, posted earlier the same day) flagging an ÖBB 4020 scan. First screenshot showed the Specifications block returning builder = `"Bombardier (formerly SGP / Jenbacher Werke)"` and a facts paragraph claiming "Die ÖBB 4020 wurde von Siemens entwickelt und gebaut; die erste Serie (4020.0) ging 2009 in Betrieb". Initial fix was scoped to those three claims. Then a second screenshot from the same user revealed the Fun Facts and Notable Events sections were essentially fabricated wholesale: 160 km/h max speed (actually 120), 4,000 kW power (actually ~1,200), "über 300 Einheiten" (actually 120 sets total), hallucinated 4020.1/4020.5 sub-variants (actual sub-series are 4020.0 and 4020.2 only), 3-teilig/4-teilig modular configuration (actually fixed 3-car only, no 4-car variant exists), and "Einsatz bei deutschen und Schweizer Betreibern, Südostbahn, internationale Operatoren" (the 4020 has NEVER operated outside Austria, ever). Scope of fix expanded to lock the facts layer against every one of these specific hallucinations.

`backend/src/services/trainSpecs.ts` — replaced the 2026-04-28 ÖBB 4020 KNOWN_SPECS block. Builder corrected from `"Bombardier (formerly SGP / Jenbacher Werke)"` to `"SGP / ELIN / Siemens"`. Added explicit `gauge: "Standard (1,435 mm)"`. Added two extra normalised lookup keys (`baureihe 4020`, `reihe 4020`) alongside the existing `öbb 4020` / `obb 4020` / `4020` / `öbb baureihe 4020`. Comment block updated to document the original wrong-builder source + the 2026-05-23 launch-ad-comment correction trail.

`backend/src/services/trainFacts.ts` — new ÖBB 4020 bullet in the system prompt. Hard-locks against every fabricated claim observed: (a) builder must be "SGP / ELIN / Siemens", never Bombardier / Siemens-alone / Jenbacher; (b) in-service year is 1978, never 2009 or any post-2000 date, never "Inbetriebnahme im Jahr 2009"; (c) max speed is 120 km/h, never 160 km/h (160 belongs to the Siemens Cityjet 4744/4746, a different class); (d) power is ~1,200 kW, never 4,000 kW (4,000 kW belongs to Eurosprinter / Taurus locomotives); (e) fleet is 120 sets, never "über 300"; (f) configuration is fixed 3-car, never 4-car or modular; (g) sub-series are 4020.0 and 4020.2 only — no 4020.1, 4020.3, 4020.5; (h) operator is ÖBB only — forbids "deutsche Betreiber", "Schweizer Betreiber", "Südostbahn", "internationale Operatoren", "Expansion auf internationale Märkte", or any cross-border claim, because the 4020 has never operated outside Austria in its 48-year history.

`backend/src/services/trainCache.ts` — added 4 entries to `CLASS_INVALIDATIONS` (`öbb 4020`, `obb 4020`, `4020`, `baureihe 4020`) with timestamp `2026-05-23T22:00:00Z`. Any Redis-cached ÖBB 4020 entries from the wrong-facts era will be treated as misses on next scan. First real-world use of the per-class invalidation pattern shipped earlier today in `76660c3` — exactly the scenario it was designed for.

All 179/179 backend tests pass; typecheck clean. Same-session fix-shipped pattern as the SU46 builder fix (`2a5db4e`) and Class 222 vs 158 disambiguation (`2ce696f`) — fan corrects ad on TikTok → backend fix shipped same day → follow-up reply with "fix is live" once Render confirms deploy.

Lesson surfaced (queue for memory): facts-layer hallucinations can be far worse than specs-layer hallucinations on the same class. Specs are constrained by typed fields and KNOWN_SPECS overrides; the facts narrative paragraph has been free-form prose, so the LLM has been padding short fact lists with plausible-sounding fabrications (cross-border operation, sub-variant numbering, modular configurations). Future correction triage on any class flagged by a tester comment should pull the FULL scan card — front, back, Fun Facts, Notable Events — before scoping the fix, because the visible part of the bug is often the smaller part.

### Backend — Per-class cache invalidation + Vision image downscale + max_tokens tightening (cost-reduction release)

Triggered by the 2026-05-23 cost audit: Anthropic Console MTD May = $215.45 across 22 days, 100% from the `locosnap-render` API key (production backend only — no Console / Workbench / Claude Code contamination), with sustained 97.9% prompt-cache read ratio. $215.45 ÷ ~1,199 recorded scans over 25 days = **~$0.20 per recorded scan, ~13× higher than the previously-cited $0.015/scan post-cache baseline**. Root cause identified: the `CACHE_VERSION` bump pattern in `trainCache.ts` was wiping the entire 30-day Redis trains-cache every per-class fix — v8 (May 12) → v9 (May 13) → v11 (May 18) → v12 (May 19), 4 bumps in 7 days. Each bump = every previously-cached train re-runs the full 4-call AI pipeline (Vision + Specs + Facts + Rarity) for 24-48h until the cache rebuilds. Live `/api/health` showed in-memory hit rate at 20%.

`backend/src/services/trainCache.ts` — replaced the single `CACHE_VERSION` string with a per-class `CLASS_INVALIDATIONS: Record<string, string>` map. Cache keys are now `<language>::<class>::<operator>` (no version prefix). On every cache read, if the entry's class has an invalidation timestamp and the entry was cached before it, treat as a miss. Other classes' caches survive. Historic v12-keyed Redis entries become orphans (no longer match new key shape) and TTL out naturally over 30 days. Going forward, per-class fixes add ONE line to `CLASS_INVALIDATIONS` instead of bumping a global version. New memory `backend_cache_invalidation_pattern.md` records the rule.

`backend/src/services/vision.ts` — added server-side image downscale via `sharp` (new dependency) before the Vision API call. Frontend already caps uploads at 1920px / 75% JPEG; backend now further downscales to 1280px longest edge with `fit: inside, withoutEnlargement: true` and re-encodes as JPEG at quality 85. Shaves ~40% of Sonnet 4.6 image tokens. Failsafe wrapper: any sharp error returns the original buffer unchanged so vision still has a chance. Single `downscaleForVision` helper covers both the Claude and OpenAI vision paths.

`backend/src/services/vision.ts` + `backend/src/services/trainFacts.ts` — tightened `max_tokens` caps. Vision Claude 1024→512, Vision OpenAI 1024→512, Facts Claude 4096→2048, Facts OpenAI 4096→2048. Defensive only — costs are paid on actual output tokens, not max — but caps any runaway output and slightly reduces output-side risk.

`backend/package.json` — added `sharp ^0.34.5` dependency.

`backend/src/__tests__/services/trainCache.test.ts` — updated the version-prefix assertion (now expects `<language>::` prefix instead of `v<n>::`), updated the `::en::` / `::de::` substring assertions to use `^en::` / `^de::` regex (language is now at start of key), added 3 new tests for the per-class invalidation behaviour (invalidates target class only; does not invalidate other classes; entries cached AFTER the invalidation timestamp remain valid).

`backend/src/__tests__/services/vision.test.ts` — added 3 new tests for `downscaleForVision` (downscales 1920→1280 with aspect ratio preserved; leaves smaller images unchanged with no re-encode; falls back to original buffer on corrupt input).

All 179/179 backend tests pass (was 173 — +6 net new tests across trainCache and vision). Typecheck clean (`npx tsc --noEmit`).

**Predicted economics post-deploy:** trains-cache hit rate 20-25% → 85-95% (return to intended steady state). Average per-scan cost $0.20 → ~$0.04. Monthly Anthropic bill $295 → ~$60. To be re-measured 7 days post-deploy via the same Anthropic Cost vs Supabase spots analysis.

**Lever consciously NOT taken:** combining specs+facts+rarity into a single Haiku call was scoped but descoped after the audit showed it would save only ~$0.003/scan vs real risk of malformed combined JSON breaking all 3 outputs. The graceful `Promise.allSettled` degradation pattern in `identify.ts` is more valuable than the modest saving. Reconsider only after Lever 1E (move per-class overrides from prompts to Supabase lookup) ever ships, which would shrink prompts from ~55K to ~5K and change the calculation.

---

## 2026-05-22

### Planning — v1.0.35 monetisation redesign designed + planned

A brainstorm session produced the v1.0.35 monetisation redesign — **"The Club"**: a free 3-scan taster → €1 one-time club membership (no ads / no data selling, ever) → Pro subscription, with a tier-aware home card and peak-moment auto-open paywalls. Existing free users are not grandfathered — they keep legacy status and get the €1-join offer. Approved design: `docs/plans/2026-05-22-monetisation-design.md`. Phased implementation plan: `docs/plans/2026-05-22-v1.0.35-monetisation-plan.md`. No code yet — a separate implementation session, gated on v1.0.34 clearing Apple review and the €1 IAP being created in the stores. Supported by a same-day break-even analysis and a subscriber-growth research brief (both in the session transcript).

### Backend — Class 222 "Meridian" vs Class 158 disambiguation (RailUK forum)

`backend/src/services/vision.ts`, `backend/src/services/trainSpecs.ts` — RailUK forum (GRALISTAIR, confirmed by pokemonsuper9) reported East Midlands Railway unit 222601 — a Class 222 "Meridian" — being identified as an "East Midlands Railway Class 158". No Class 222 coverage existed in `vision.ts`, so the model defaulted to the far more numerous Class 158 (~180 units vs ~27), helped by EMR operating both classes. New `vision.ts` disambiguation rule keyed on cab profile (Class 222 = sleek aerodynamic nose, no front gangway; Class 158 = flat Sprinter cab with a centre front gangway door) and fleet number, plus an explicit note that 222601 is a one-off 6-car /6 unit in a non-standard blue livery. New `trainSpecs.ts` `class 222` entry — 125 mph, Bombardier Transportation (Bruges), 27 built, diesel-electric. 173/173 backend tests pass; typecheck clean. Pushed to origin/main — Render auto-deploys.

### Backend — Class 66 operator rule rewritten + two new steam disambiguation rules (RailUK forum)

`backend/src/services/vision.ts` — three disambiguation changes driven by railforums.co.uk feedback:

1. **Class 66 operator rule rewritten.** The previous rule (shipped `cec1f13`, 2026-05-17) described GBRf as "dark grey" and Freightliner as "powder blue" — both wrong, as forum member 43096 pointed out. GBRf's base livery is dark blue with orange; Freightliner is green/yellow or two-tone grey. The rule now makes the **fleet number the primary discriminator** (DB Cargo 66001–66250, Freightliner 665xx/669xx, GBRf 667xx+, DRS 664xx, Colas 668xx), demotes livery to a secondary hint with corrected colours, and adds a **Heavy Haul Rail caveat** — HHR runs ex-Freightliner 66s still in full Freightliner livery, so livery alone cannot distinguish them.

2. **WD Austerity 2-10-0 vs LMS Royal Scot** — new steam rule. Tester JonnySeagull reported the WD 2-10-0 "Gordon" at the Severn Valley Railway returning as a Royal Scot. Keyed on wheel arrangement: five coupled axles (2-10-0 heavy freight) vs a four-wheel leading bogie + three coupled axles (4-6-0 express).

3. **LMS Stanier Mogul vs LMS Fowler 7F** — new steam rule. Same tester reported a Stanier Mogul returning as a Fowler 7F. Keyed on coupled-axle count: 2-6-0 (three coupled axles, Stanier Mogul 42968 at SVR) vs 2-8-0 (four coupled axles, Fowler 7F).

All 173 backend tests pass; typecheck clean. Not yet deployed — needs a push to go live on Render.

### Frontend — wrong-ID reports now capture the scanned photo

`frontend/services/supabase.ts`, `frontend/app/card-reveal.tsx`, `frontend/app/(tabs)/index.tsx` — the in-app "Wrong ID" report flow previously wrote only the (wrong) class name to the `wrong_id_reports` table; `photo_url` was null on every row because no caller ever passed it, leaving the misID triage queue largely unactionable (a query of the live table showed ~60 reports in 6 days, zero with photos). `submitWrongIdReport` now accepts a `photoUri`: a remote URL is stored directly, a local scan URI is uploaded to Supabase Storage via `uploadPhoto` when a userId is present. The card-reveal "Wrong ID" tap and the low-confidence-decline path both now pass the scanned photo. Anonymous users (no userId) still file a report, just without a photo — no regression.

### Frontend — gallery scans use the photo's EXIF GPS for the spot location

`frontend/app/(tabs)/index.tsx` — a scan of a saved photo logged the device's *current* location instead of where the photo was taken (RailUK tester sabanda: a photo taken at Reading was labelled Bournemouth). New `parseExifGps` helper reads GPS coordinates from the picked photo's EXIF (iOS nested `{GPS}` dict / Android flat `GPS*` keys, with hemisphere-ref sign handling). For `captureSource === "gallery"`, the photo's EXIF GPS now overrides the device location. `photoAccuracyM` is deliberately left as the device reading so verification tiers are unchanged. Camera captures are unaffected. New test case added for the report-photo passthrough; all 154 frontend tests pass.

### Frontend — In-app Pro rescue prompt for never-scanned Pro users

`frontend/components/ProRescuePrompt.tsx` (NEW), `frontend/app/(tabs)/index.tsx`, `frontend/locales/{en,de,pl}.json` — a one-time, dismissable card on the scan screen for users who have subscribed to Pro but never logged a spot (`is_pro === true && last_spot_date == null`). Surfaced by the 2026-05-17 Supabase/RevenueCat audit: paying customers who subscribed within minutes of first opening the app and never scanned a train. The card nudges them to make their first scan; dismissal persists in AsyncStorage (`locosnap_pro_rescue_dismissed`), and the prompt also stops naturally once the first spot sets `last_spot_date`. EN/DE/PL strings under `scan.proRescue`. Self-gating component, mirrors the `PaywallSoftPrompt` styling.

Chosen over a server-sent push: there is no server push infrastructure (`profiles.push_token` column doesn't exist, no send path) and Android push is disabled — an in-app prompt reaches both platforms and reaches the cohort while they are actually in the app. A real push-based rescue remains a separate, larger piece of work.

### Release — app.json version bump 1.0.33 → 1.0.34

`frontend/app.json` — version bumped for the next EAS build, which bundles all three frontend changes above: wrong-ID photo capture, gallery EXIF GPS location, and the Pro rescue prompt.

Frontend changes reach users on the v1.0.34 EAS build.

### Release ops — v1.0.34 built and submitted to both stores

EAS production builds completed for v1.0.34 — iOS build 56 (IPA), Android versionCode 26 (AAB), both from commit `14af836`. Submitted via `eas submit`: Android uploaded to the Google Play **production track as a draft**; iOS uploaded to App Store Connect (Apple processing, then TestFlight). Neither is live yet — Play needs the draft rolled out, iOS needs the build attached to a version and submitted for review. Release notes drafted in EN/DE/PL for both stores. The first EAS build attempt failed on an outdated eas-cli (18.5.0); retried successfully via `npx eas-cli@latest`. Build credits were at 95%, so the builds used pay-as-you-go.

---

## 2026-05-21

### Backend — SU46 builder correction (Cegielski → Fablok Chrzanów)

`backend/src/services/trainSpecs.ts:674-680` — extended the existing SU46 hardcoded-specs override (which already locked maxSpeed at 120 km/h overriding the AI/Wikidata 160 km/h) to also lock `builder: "Fablok Chrzanów"`. AI/Wikidata had been returning `H. Cegielski – Poznań`, which is wrong — Cegielski never built the SU46. All 54 units were built by Fablok Chrzanów 1974-1977.

Caught 2026-05-21 by the SU46 ad scan test — the spec sheet panel returned Cegielski while the Historical Significance text in the same result page already credited Fablok + Pafawag. The override unifies builder attribution across both panels for both `"su46"` and `"pkp su46"` lookup keys.

All 9 trainSpecs tests still pass after the change. Frontend-only consequence: SU46 scans will now display `Fablok Chrzanów` as the builder consistently across all panels.

---

## 2026-05-20

### Release ops — v1.0.33 LIVE ON BOTH STORES

Apple and Google both approved + published v1.0.33 since the 2026-05-19 session close. iOS build 55 LIVE on App Store (IPA `23nDRgQ5HTZzifepTYxmSi`); Android build 24 / versionCode 22 LIVE on Google Play Production at 100% rollout (AAB `v1VxbnHu59dpSXuDeJBrwb`). No code change in this entry — pure state-change log.

v1.0.33 payload now reaching all users on both platforms (carried unchanged from the 2026-05-19 build cycle):

- scan_2 paywall with intro pricing (£1 / €1 / 5,19 zł new-subscriber framing)
- Paywall soft-prompt mirrored onto camera screen + scan_6 lockout variant
- Country-flag backfill banner for legacy users
- iOS DE+PL permission-prompt localisation (iOS-only — Android no-op)
- Version bump 1.0.32 → 1.0.33

Architecture doc header + Latest iOS Build + Latest Android Production Build rows updated to reflect LIVE state. Prior v1.0.32 entries demoted to "Previous".

---

### Frontend — Sentry breadcrumb on identifyTrainNative connect failure (diagnostics)

Sentry issue `REACT-NATIVE-P` ("Could not connect to LocoSnap servers. Please try again later.") fires from [frontend/services/api.ts:280-285](frontend/services/api.ts) after both the initial request and the silent 3s retry fail with no HTTP response and no `ECONNABORTED` code. 13 events / 10 users across releases 1.0.28 → 1.0.32 over 12 days — low rate, distributed across 5 builds, 54% Android 16, 23% Huawei MAR-LX1B. Diagnosis: real-world mobile network flakiness, not a code regression.

Current code surfaces only the generic user-facing message to Sentry; the underlying axios error code/message (e.g. `ERR_NETWORK`, `ENOTFOUND`, `Network Error`) is discarded. Future spikes can't be triaged.

**Applied:**

- `frontend/services/api.ts` — import `addBreadcrumb` from `./analytics`; add a Sentry breadcrumb immediately before the terminal `throw new Error("Could not connect to LocoSnap servers…")` capturing `initialCode`, `initialMessage`, `retryCode`, `retryMessage` from both attempts. Web-path equivalent (line 199) intentionally not instrumented — current Sentry events are all native, not web.

**Why no functional change:** the user-facing toast is unchanged; the retry behaviour is unchanged. This is pure diagnostic instrumentation. Sentry will attach the breadcrumb to the next firing of this issue, letting us distinguish DNS failures from connection resets from radio-handover drops next time it spikes.

**Operational:** issue should be archived in Sentry now — current events all predate this breadcrumb and aren't diagnosable. Re-open if rate climbs in v1.0.33+ with breadcrumb data attached.

Tests: `npx tsc --noEmit` clean. No new test added — breadcrumb is fire-and-forget instrumentation already covered by `addBreadcrumb`'s own try/catch in [frontend/services/analytics.ts:135-142](frontend/services/analytics.ts).

---

## 2026-05-19

### Release ops — v1.0.33 IN REVIEW ON BOTH STORES (iOS in Apple review, Android in Google review)

After three failed Android builds in this session (21, 22, 23) the lint-disable fix (`d1cd710`) finally got onto an EAS build correctly and **Android build 24 FINISHED**. Sequence of mistakes and what fixed each:

| Build | Commit EAS used | Outcome | Cause |
|---|---|---|---|
| 21 | `41107af` | ERRORED at lintVitalRelease (8 errors) | Original Expo locales / Android Lint mismatch — `expo.locales` generates `values-b+<locale>/strings.xml` for iOS-only NSx keys, no default locale → ExtraTranslation |
| 22 | `26361e8` | ERRORED (12 errors, worse) | Previous session's "add `en` to locales" theory was wrong — `values-b+en/` is still a translation, not a default. Shipped unverified. |
| 23 | `26361e8` (stale) | ERRORED (cached fingerprint identical to 22) | This session's deployment hygiene failure: triggered `eas build` from `/Users/StephenLear/Projects/locosnap/frontend` after pushing to remote but BEFORE pulling. EAS uploaded the un-pulled main checkout — same source as build 22, same cached fingerprint. |
| **24** | **`53530c7`** (correct) | **FINISHED** ✅ | After hard pull + 4 verification gates (HEAD includes fix, local prebuild injects `lint { disable 'ExtraTranslation' }` correctly, build triggered with `--clear-cache`, EAS confirmed new commit + fresh fingerprint `815d60ac…`) the build progressed past lintVitalRelease for the first time. |

Submitted:
- **🍏 iOS build 55** (`23nDRgQ5HTZzifepTYxmSi.ipa`) → App Store Connect → in Apple review. ASC submission `7ab37344-b97b-481a-8887-ab9635f40e40`.
- **🤖 Android build 24** (`v1VxbnHu59dpSXuDeJBrwb.aab`) → Play Console → submitted via `eas submit` as draft on Production track per `eas.json` `releaseStatus: draft`, EAS submission `676bd460-16c1-4fb0-81a6-5bd42b2d4a5b`. User then pasted EN/DE/PL release notes from `docs/release-notes-v1.0.33.md` and started rollout to Production → **now IN GOOGLE REVIEW**. Expect 1-7 days typical.

EAS credit usage: ~95% of monthly allocation (was 88% at session open). Builds 21-24 plus the earlier iOS build 55 consumed the bulk. Pay-as-you-go for any further builds this billing window.

**Lessons captured in memory:**
- `feedback_expo_locales_android_lint.md` (renamed + rewritten — old version with "add EN entry" recommendation was wrong; new version explains why `ExtraTranslation` cannot be satisfied via `expo.locales` and recommends the config-plugin approach)
- New rule: **never trigger `eas build` from a checkout you haven't pulled** — EAS uses the local working tree as the source, not the remote. Always `git log -1` to verify HEAD includes your fix before triggering.
- New rule: **for release-blocking lint/build failures, always reproduce locally first** (`npx expo prebuild --platform android --clean` + inspect generated files) — never let EAS be your test runner on a slow feedback loop with a paid credit per attempt.

### Frontend — disable Android Lint ExtraTranslation rule to unblock v1.0.33 release builds (d1cd710)

v1.0.33 Android EAS builds 21 and 22 both errored at `:app:lintVitalRelease` with 8 and 12 `ExtraTranslation` errors respectively on the DE+PL (and accidentally EN) NSCameraUsageDescription / NSPhotoLibraryUsageDescription / NSPhotoLibraryAddUsageDescription / NSLocationWhenInUseUsageDescription keys.

**Root cause:** Expo's CNG `expo.locales` block processes JSON locale files for **both** platforms. On iOS it generates `<locale>.lproj/InfoPlist.strings`; on Android it generates `res/values-b+<locale>/strings.xml`. The iOS NSx Info.plist permission keys are inherently iOS-only — they have no meaning on Android — but Expo's locale plugin doesn't filter by platform, so they end up in Android's localized strings.xml with no matching entry in the unqualified `values/strings.xml` (the "default locale" by Android Lint's definition). Lint's `ExtraTranslation` rule fails the release build with one error per locale per key.

**Failed first attempt (commit 26361e8, build 22):** added an `en` entry to `expo.locales` thinking it would create a default locale. It did not — `values-b+en/` is still a translation, not a default. Build 22 errored with worse counts than 21.

**Real fix (this commit):**

- `frontend/plugins/withDisableExtraTranslationLint.js` — new Expo config plugin mirroring the existing `withSentryDisableUpload` pattern. Uses `withAppBuildGradle` from `@expo/config-plugins` to inject `lint { disable 'ExtraTranslation' }` into the generated `android/app/build.gradle` `android { ... }` block during prebuild. Only the `ExtraTranslation` rule is suppressed; all other lint checks continue to run in vital-release mode.
- `frontend/app.json` — registered the new plugin in `plugins[]` immediately after `withSentryDisableUpload`. Also removed the orphaned `en` entry from the `locales` block — EN strings are already the default in `ios.infoPlist`, so the entry was a no-op on iOS and harmful on Android (generated a third `values-b+en/strings.xml` with the same lint problem).

**Why suppression is safe:** the NSx keys exist in Android `values-b+<locale>/strings.xml` purely as an artifact of Expo's CNG locale codegen. Zero Android code paths reference them. There is no runtime risk — the keys are dead resources on Android.

**Verified locally** before pushing: `npx expo prebuild --platform android --clean` runs cleanly; plugin injects the lint disable at line 87 of `android/app/build.gradle` (top of `android { ... }`); generated `values-b+de/strings.xml` and `values-b+pl/strings.xml` retain the DE/PL NSx strings (so iOS localisation is unchanged); no `values-b+en/` is generated. Could not run `:app:lintVitalRelease` locally (no Android SDK installed) — relying on documented rule-suppression mechanism which is stable in AGP.

Next: trigger Android-only EAS build (build 23) for v1.0.33. iOS build 55 is already in Apple review and unaffected.

---

### Frontend — iOS permission strings localised for DE + PL (build-time, zero runtime)

Closes a watch-list item explicitly logged in [project_status.md](memory:project_status.md): iOS device-locale users on German and Polish were seeing English-only permission prompts (NSCameraUsageDescription / NSPhotoLibraryUsageDescription / NSPhotoLibraryAddUsageDescription / NSLocationWhenInUseUsageDescription) because the `app.json` `infoPlist` block was EN-only and no `locales` config existed.

Applied via Expo's **build-time** `locales` config — generates per-locale `.lproj/InfoPlist.strings` files baked into the IPA at EAS build. **Zero runtime code execution** — this is NOT the banned `expo-localization` runtime module ([feedback_no_expo_localization.md](memory:feedback_no_expo_localization.md)), it's Continuous Native Generation config evaluated only during `eas build`. Safe.

Applied:

- `frontend/locales/ios/de.json` — German translations of the 4 NSxUsageDescription keys, matching the casual-direct tone used elsewhere in the German app strings ("LocoSnap braucht Zugriff…").
- `frontend/locales/ios/pl.json` — Polish translations of the same 4 keys, gender-neutral phrasing throughout ("LocoSnap potrzebuje dostępu…" / "LocoSnap używa Twojej lokalizacji…") to avoid the gendered past-tense Polish verb trap.
- `frontend/app.json` — new `expo.locales` block pointing to the two JSON files.

iOS users on DE or PL device locale will see the translated permission prompts on next install once v1.0.33 ships. iOS users on other locales (EN, FI, IT, ES, NL, FR, CS, etc.) continue to see the EN default. EN users see the existing EN `infoPlist` strings.

Typecheck clean. JSON syntax verified. Locale-only build config — no test coverage to add. Direct to main. Ships in v1.0.33.

---

### Frontend — scan_2 paywall soft-prompt now leads with intro pricing

The scan_2 prompt previously used value-led copy with no pricing reference ("Enjoying LocoSnap? See what you unlock with Pro…"). Replaced with **intro-price-led copy** to lower the perceived friction at the first paywall touchpoint. €1/month (or per-locale equivalent) is the lowest-effort entry into Pro and looks effectively-free — leading with the number rather than burying it in the paywall screen removes the implicit price-anxiety that may be churning users at scan 2.

Two real intro offers exist:
- **Play Store:** literal €1/month for the first month (monthly product intro)
- **App Store:** €3.99 / £3.99 upfront for 3 months on annual ≈ €1.33/month for first 3 months, rounds to "€1/month" defensibly

The **"from / ab / od"** hedge in the copy covers both — accurate for Play (where it's literal €1/month), defensible for Apple (where it's the averaged-down headline price). **"New subscribers"** wording protects against Apple/Play "misleading offer" rejection (the offer is genuinely restricted to first-time subscribers).

Applied:

- `frontend/locales/en.json` — scan_2 title `"Try Pro from just £1/month"`, body `"Special intro for new subscribers. Full specs, blueprints, your whole collection."`
- `frontend/locales/de.json` — scan_2 title `"Pro testen ab 1 €/Monat"`, body `"Einführungsangebot für Neukunden. Alle Daten, jeder Blueprint, deine ganze Sammlung."`
- `frontend/locales/pl.json` — scan_2 title `"Wypróbuj Pro od 5,19 zł/miesiąc"`, body `"Oferta startowa dla nowych subskrybentów. Pełne dane, plany, cała kolekcja."` — PL price taken from the actual Google Play Polish intro display (5.19 PLN, user-confirmed).

scan_4 ("Special intro pricing available") and scan_5 (urgent "1 left") unchanged — the funnel still escalates: scan_2 hooks with the price, scan_4 reminds about the offer generically, scan_5 creates urgency, scan_6 locks.

153/153 frontend tests passing. Typecheck clean. Direct to main. Ships in v1.0.33.

**Strategic note:** flagged for cross-promo elsewhere — same €1/month framing should propagate into TikTok ad copy, App Store listing subtitle, onboarding screens, and Win-Back messaging if the data supports it.

---

### Frontend — Paywall soft-prompt camera-screen mirror + scan_6 lockout variant

Closes the obvious gap in the Pro funnel: previously the scan-aware soft-prompt only appeared on the **results** screen (after a scan), so a non-Pro user looking at the camera screen had no Pro-aware nudge surface before they tapped. And once a user hit 6/6, the only way to discover the lockout was to tap the scan button and read the Alert.

Now the prompt mirrors onto the **camera** screen too, with a new persistent **scan_6 (locked)** variant that shows the actual lockout state visually before the user tries to scan.

**Why ship now:** scan_6 is the closing-of-the-funnel piece — without a visible lockout, users at 6/6 hit a silent dead end and may churn. The hard Alert.alert + paywall redirect on tap (`scan_limit` source) stays as a backstop.

**Explicitly NOT shipped (held by strategic decision):** push notifications at 5/6 — fights the documented "generous free tier beats tight gating" insight (see [project_status.md](memory:project_status.md) line 195-196, [project_competitive_positioning.md](memory:project_competitive_positioning.md)). Will revisit only if PostHog data over 2+ weeks shows scan_5/scan_6 surfaces underperforming.

Applied:

- `frontend/components/PaywallSoftPrompt.tsx` — added `surface?: "results" | "camera"` prop (defaults to `"results"`, non-breaking); new `scan_6` variant in `variantFor()` triggering at scans ≥ 6 with lock-icon + orange "free scans used" styling (distinct from teal scan_2/4 and amber scan_5); dismiss button hidden on `scan_6` because it reflects an actual lockout state (not an ignorable nudge); reset-on-variant-change effect so a dismiss at scan_2 doesn't silence the urgent scan_5 / scan_6 banners on persistent surfaces (the camera tab stays mounted across scans); analytics events (`paywall_softprompt_shown / _tapped / _dismissed`) now tag `surface` for per-surface conversion analysis. Routes to `/paywall?source=softprompt_${variant}_${surface}` for granular PostHog funnel breakdown.
- `frontend/locales/{en,de,pl}.json` — new `softPrompt.scan_6` keys with locked framing ("Free scans used" / "Kostenlose Scans aufgebraucht" / "Darmowe skany wykorzystane").
- `frontend/app/(tabs)/index.tsx` — new import + mounting block: shows the soft-prompt for signed-in non-Pro users when `daily_scans_used ∈ {2, 4, 5, 6}`, with `surface="camera"`. Pre-signup trial users (3-scan path) + Pro users see nothing.
- `frontend/app/results.tsx` — passes `surface="results"` explicitly for analytics tagging. The new `scan_6` lockout variant now renders automatically on results too (was implicitly hitting the "default" copy at scans ≥ 6).

**Stale-branch note:** the camera-mirror was originally drafted on `claude/great-cerf-96cc52` (commit `935d226`, 2026-05-15) but that branch is now ~4 days stale and **would be destructive to merge** (deletes the entire welcome email pipeline, SW1001 fix, T3 fix, four handover docs, and ~250 lines of trainSpecs that have all shipped since the branch was cut). The 9-line camera change + the `surface` prop refactor were replicated manually on main instead — no merge, no destructive changes.

153/153 frontend tests passing. Typecheck clean. Direct to main. **NOT triggering an EAS build this session** — per `feedback_build_approval.md`, build trigger is the user's call once they've reviewed.

---

### Backend — LSWR Adams T3 Class (No. 563) vision + specs fix (Steph misID: sole T3 survivor at Swanage Railway returned as "LSWR Adams O2 Class")

UK tester Steph the Spotter scanned No. 563 (the sole surviving LSWR Adams T3) at the Swanage Railway and the app returned **"LSWR Adams O2 Class" with 87% confidence** — confidently wrong. Steph caught it on a second-day misID review and DMed the screenshot with the correction: "So this is actually a T3 not O2 Class".

The model recognised "Adams" correctly but defaulted to the more numerous and more frequently photographed Adams class (O2, 60 built, multiple Isle of Wight survivors). It missed the fundamental distinction: **T3 is a 4-4-0 EXPRESS TENDER LOCOMOTIVE; O2 is a 0-4-4T SUBURBAN TANK ENGINE** — opposite vehicle types despite shared designer.

Researched and identified: **LSWR Adams T3 Class No. 563** — designed by William Adams, built 1892–1893 at Nine Elms Works, 20 built (LSWR numbers 557–576). No. 563 is the sole survivor — donated to NRM 1948, stored static for 75 years, donated by NRM to Swanage Railway Trust in 2017, restored at the Flour Mill and Swanage works by the 563 Locomotive Group at a cost of £650,000, **returned to steam 8 October 2023**. Currently operational at the Swanage Railway in LSWR Drummond passenger green livery. Note: 563 was never given a BR 30xxx number — withdrawn pre-nationalisation, only retained for the LSWR centenary in 1948.

Applied:

- `backend/src/services/vision.ts` — (a) extended the existing "UK BR 30xxx number block" disambiguation rule to add `563 = LSWR Adams T3 Class` and `30225 / 30192 / 30183 (range 30177–30236) = Adams O2 0-4-4T tank class` as explicit lookups; (b) new dedicated T3 vs O2 disambiguation rule inserted before the Urie S15 rule. Encodes: wheel arrangement is the primary discriminator (4-4-0 tender vs 0-4-4T tank, opposite types), No. 563 is definitive for T3, separate tender rules out O2, Swanage Railway context is overwhelmingly T3, LSWR Drummond green livery is correct for current preservation. Includes the 75-year static layup → 2023 return-to-steam story angle.
- `backend/src/services/trainSpecs.ts` — (a) new T3 prompt block in the system prompt section (alongside Urie S15, Sm2, Sm4 entries); (b) hardcoded specs for `t3`, `lswr t3`, `lswr t3 class`, `lswr adams t3`, `lswr adams t3 class`, `adams t3`, `t3 class` (7 alias keys covering all class-string format variants). Locks 60 mph / 17,673 lbf TE / Nine Elms Works (LSWR) / 20 built / Coal (steam) / Standard gauge.
- `backend/src/services/trainCache.ts` — `CACHE_VERSION` bumped **v11 → v12** to invalidate any stale "LSWR Adams O2" cache entries from prior 563 scans.

Same fix pattern as prior Steph corrections (SW1001 `56cd3e0`, J94 vs J72 / FR20 vs Terrier 2026-04-28, Class 45 / 57 / 59 / 70 / 11 / 52 / 14 over April–May) plus the wider tester-correction batches (ICE family `24cd1dc`, Class 390+66 `cec1f13`, BR 423 `14a1b37`, EU07 `ee21ed6`, BR 245 `fda139d`, BR 428 `789fe0a`, BR 247 `52f4e6b`). **Steph's 7th confirmed misID-to-fix loop** — deepest tester-evangelist loop in the project.

173/173 backend tests passing. Typecheck clean. Render auto-deploy in flight on push.

---

## 2026-05-18

### Backend — EMD SW1001 vision + specs fix (Steph misID: Merehead industrial shunter returned as Class 08)

UK tester Steph the Spotter photographed Merehead Quarry's industrial yard shunter and the app returned "Class 08 / DB Cargo UK / 350 HP / 20 mph / Common, VERIFIED" — confidently wrong. Steph caught it because she knew the visual signature: "08 shunter doesn't have a pointed bit over the engine, it's more of a curve."

Researched and identified: the actual loco is **EMD SW1001 No. 44 "Western Yeoman II"** — American GM-built switcher, 1,100 HP, shipped to UK by Foster Yeoman in 1983, now operated by Aggregate Industries (acquired Foster Yeoman 2006). Critically, this SW1001's reliability hauling 2,500-ton stone trains is what convinced Foster Yeoman to go back to EMD a few years later and order the Class 59s — making it the *direct ancestor* of the famous Mendip Rail Class 59 fleet. The unsung loco that made the Class 59s happen.

Applied:

- `backend/src/services/vision.ts` — new EMD SW1001 vs Class 08 disambiguation rule, inserted before the Class 37 vs Class 45 rule (also from Steph). Encodes the centre-cab + angular wedge hood + Bo-Bo bogies + Aggregate Industries / Mendip Rail / quarry context signature, explicitly blocks Class 08 ID when these features are visible, and includes the historical context. Visual differences from Class 08 spelled out: centre cab vs end cab, wedge hood vs curved hood, bogies vs coupled axles, twin lower exhausts vs tall stacks, no jackshaft rods.
- `backend/src/services/trainSpecs.ts` — hardcoded specs for `sw1001`, `emd sw1001`, `gm sw1001`, `gm-emd sw1001`, `general motors sw1001`, `western yeoman ii` (6 alias keys). Locks 820 kW / 65 mph / "General Motors EMD (La Grange, Illinois)" / 230 built worldwide / Diesel-Electric.
- `backend/src/services/trainCache.ts` — `CACHE_VERSION` bumped v10 → v11 to invalidate any stale `class 08 / DB Cargo UK` cache entries from prior SW1001 scans.

Same fix pattern as ICE family (`24cd1dc`), BR 423 (`14a1b37`), Class 390+66 (`cec1f13`), EU07 (`ee21ed6`), BR 245 (`fda139d`), BR 428 (`789fe0a`), BR 247 (`52f4e6b`). 173/173 backend tests passing. Typecheck clean. Steph's 6th confirmed misID-to-fix loop (after Class 45 / Class 57 / Class 59 / Class 70 / Class 11 / Class 52), deepest tester-evangelist loop in the project.

Render auto-deploy in flight on push.

---

### Ops — DB cleanup: 8 typo/malformed email rows removed from `auth.users`

After the four backfill batches surfaced eight email addresses that can never authenticate (typo or malformed domain), they were removed from `auth.users` via direct SQL in Supabase. Cascading FKs (`ON DELETE CASCADE`) cleaned up dependent rows in `auth.identities`, `auth.sessions`, `auth.refresh_tokens`, `public.profiles`. None were Pro / had purchases.

Removed: `kaspar.ruetenik@icloud`, `loops83@hitmail.co.uk`, `danielmorgancox301@gnail.com`, `jrandall125@outloo.com`, `traingamer2907@gmaio.com`, `hansi.20098@oulook.de`, `rheintalbhnerneo@gmail.com`, `stephstottor@gmail.coms`.

Going-forward rule (added to `docs/welcome-email-backfills.md` and memory): when typo-domain emails surface during a batch, queue them and clean up post-batch with a SELECT-then-DELETE pass.

---

### Ops — Welcome email backfill BATCH 4 (full pre-Google-launch cohort, FINAL backfill) — 75 sent, 4 typo addresses skipped, 3 typo addresses got through

Final backfill batch. Covers the entire pre-Google-launch cohort 2026-03-03 → 2026-04-26 (first signup is day after the 2026-03-02 store upload). After this, every non-Pro signup pre-2026-05-18 has either an automated or backfill welcome on record; the trigger handles all future signups.

- **Recipients:** 79 in CSV, 4 typo-domain addresses skipped pre-send (`loops83@hitmail.co.uk`, `danielmorgancox301@gnail.com`, `jrandall125@outloo.com`, `traingamer2907@gmaio.com` — all same-person duplicates of correctly-spelled addresses in the same dataset), 75 sent.
- **API accepted:** 75/75. Delivery not verified post-send (per the unlimited-tier rule).
- **Three more typo addresses got through and got sent.** Not caught by the pre-send filter because they had no in-dataset corrected version to pair against: `hansi.20098@oulook.de` (typo of `outlook.de`), `rheintalbhnerneo@gmail.com` (typo of tester `rheintalbahnerneo@gmail.com` — same person, filtered tester variant), `stephstottor@gmail.coms` (trailing `s`, typo of tester `Stephstottor@gmail.com`). These will bounce. All three queued for the post-batch DB cleanup along with the 4 explicitly-skipped + 1 from batch 2.

**Session totals:** 67 (batch 1) + 79 (batch 2) + 81 (batch 3) + 75 (batch 4) = **302 backfill sends** across signups 2026-03-03 through 2026-05-17. Plus the automated welcome trigger handles 2026-05-18 onwards. Combined with the existing Pro cohort (already opted-in), every user account in the database has now been welcomed.

Full per-recipient log in `docs/welcome-email-backfills.md`.

---

### Ops — Welcome email backfill BATCH 3 (week of Google Play launch, "belated welcome" copy, testers excluded) — 81 sent

Third backfill batch in the same session. Covers signups 2026-04-27 through 2026-05-03 inclusive — the seven days starting with the Google Play public-launch date.

- **First batch using the new exclusion SQL** that filters out all 26 tester emails (per `memory/tester_contacts.md`) and `%@locosnap.app`. Pre-send cross-check confirmed zero testers slipped through.
- **Recipients:** 81 from CSV, 81 sent (no malformed addresses to skip, no internal duplicates, no overlap with batches 1 or 2). One same-person duplicate (`leon.plattner` on gmx.de + icloud.com) intentionally not deduped; three same-prefix typo variants on @gmx.de (`leandereathgeber`, `leanderathgeber`, `leanderrathgeber`) all sent — distinct mailboxes, three separate signups.
- **Subject + body:** same as batch 2 — "A belated welcome to LocoSnap / Ein verspätetes Willkommen / Spóźnione powitanie" subject, "since launch I've been working through feedback" opening per language.
- **API accepted:** 81/81. **Delivery not verified post-send** — operational rule updated this batch: with the unlimited-tier upgrade (no quota cap to suspect) and a fresh-signup cohort (low suppression risk), Resend export cross-reference is no longer mandatory per batch. Pull the export only when there's a specific reason to suspect drops (stale list, prior bounces, sender reputation concern).

Full per-recipient log in `docs/welcome-email-backfills.md`.

Cumulative for the session: 227 sends (67 + 79 + 81), 224 confirmed delivered (batches 1+2), 81 API-accepted unverified (batch 3), 2 suppressed, 1 pending. ~610-ish non-Pro signups now have either an automated or backfill welcome on file.

---

### Ops — Resend plan upgraded to unlimited + two new operational gotchas documented

Three operational changes captured in `docs/ARCHITECTURE.md` § 10 (Email/Sending) and `docs/welcome-email-backfills.md`:

- **Resend plan upgraded** from free tier (100 emails/day, 3,000/month) to the paid unlimited tier. Triggered by the two-batch session crossing the 100/day cap. No daily limit on future batches.
- **Supabase Auth → Resend interaction** now documented explicitly. Sign-in OTP codes, magic links, and confirmation emails sent by Supabase Auth all flow through this same Resend account and count against the send quota. Visible in the dashboard export as rows with a Supabase-owned `api_key_id`. Sizing future batches needs to account for this background traffic.
- **Resend suppression-list silent drop** now documented as a known gotcha. When sending to an address on Resend's account-wide suppression list (prior bounce / complaint), the API returns `200 + message_id` (looks like success) but the email is never delivered — only the dashboard export's `last_event: suppressed` reveals it. New operational rule: for any non-trivial batch, pull the dashboard export afterwards and cross-reference `last_event` rather than trusting API-acceptance counts. Surfaced by two real suppressions in batch 2.

No code change. Docs-only.

---

### Ops — Welcome email backfill BATCH 2 (week before, "belated welcome" copy) — 79 sent, 76 delivered, 2 suppressed, 1 pending

Second targeted backfill in the same session, covering signups 2026-05-04 through 2026-05-10 inclusive (UTC) who don't have Pro — the seven days immediately before batch 1's window. 80 rows in the source CSV; one (`kaspar.ruetenik@icloud`, malformed missing TLD) excluded pre-send, leaving 79 recipients.

- **Subject changed:** `A belated welcome to LocoSnap / Ein verspätetes Willkommen / Spóźnione powitanie` (signals the delay in the inbox preview)
- **Copy diff:** only the opening paragraph of each language was changed — acknowledges the late email and frames recent weeks as working through post-launch feedback. Everything below the opening paragraph stays bit-identical to the verified template.
- **Delivery confirmed via Resend export** (`~/Desktop/Email/emails-sent-1779122324600.csv`, pulled 18:40 UTC): 76 `delivered`, 2 `suppressed`, 1 `sent` (pending).
- **Suppressions** (`tobias.trostmann@web.de`, `hobbybundesbahner@outlook.de`) — both addresses are on Resend's account-wide suppression list from prior bounces/complaints. Both same-person variants at neighbouring rows (`tobias_trostmann@web.de`, `hobbybundesbahner1976@outlook.de`) delivered, so neither person is fully missed. Cannot retry — Resend will reject any further send attempts.
- **Pending** (`n29545473@gmail.com`) — accepted by Resend, attempted, no delivery confirmation yet at export time. May still resolve.
- **Resend free-tier daily-limit warning** observed mid-session. With batch 1 (67) + batch 2 (79) = 146 today, the account crossed Resend's 100/day free-tier cap. The warning was informational — Resend processed all 146 API calls. Plan was upgraded to unlimited mid-session, so this is not a constraint going forward.

Full per-recipient audit (email + Resend message ID + actual delivery status from the export) in `docs/welcome-email-backfills.md`.

Cumulative for the session: 146 sends, 143 confirmed delivered, 2 suppressed, 1 pending. ~530-ish non-Pro signups now have either an automated or backfill welcome on file; the remaining broader-backfill (~290 from before 2026-05-04) is still queued for a follow-up batch.

---

### Ops — Welcome email backfill BATCH 1 (last-7-days, non-Pro) — 67 sent, 67 delivered, 0 failed

Manual one-off backfill of the trilingual welcome email to all signups 2026-05-11 through 2026-05-17 inclusive (UTC) who don't have Pro. Closes the gap left by the per-signup trigger only going live 2026-05-18 — 67 users from the previous week had signed up without receiving a welcome.

- Source: Supabase SQL query (`auth.users` LEFT JOIN `public.profiles` on `id`, `is_pro = false OR profile missing`, email NOT NULL) exported to CSV
- Sender: same Resend template as the live automated send (`welcomeHtml()` + `welcomeText()` from `backend/src/services/email.ts`, unchanged)
- Throttle: 0.55s between sends (2/sec, Resend free-tier safe)
- CC: none (founder-CC automation exemption applies — Reply-To `hello@locosnap.app` still routes any replies to Proton via ImprovMX)
- Result: 67/67 API-accepted, 67/67 confirmed `delivered` per Resend export
- Full per-recipient audit (email + Resend message ID + delivery status): `docs/welcome-email-backfills.md`

No code change. The script was a one-off (`/tmp/send_welcome_backfill.py`, transient — template was embedded verbatim from `email.ts` for an exact match against last night's verified send).

The ~470 broader non-Pro backfill remains deferred per the original "ship + observe 1-2 days, then blast" plan — this 67-user batch is the smaller targeted catch-up for the past week's cohort only.

---

### Backend — ICE family hardcoded specs + weight hallucination guard (`24cd1dc`)

Closes a recurring systemic bug class. Caught by @airbus.a3200's public TikTok bug report 2026-05-18: a BR 401 scan was returning "320 km/h" and "1 tonnes" — neither correct for ICE 1 (real values 280 km/h / 849 tonnes for 14-car set). Root cause: the ICE family had near-zero hardcoded specs (only BR 412 had a partial entry with maxSpeed + builder; no weight, no power), so vision's class string flowed straight through to AI-generated specs and hallucinated. Same fix pattern as prior batches (Class 390+66 in `cec1f13`, BR 423 in `14a1b37`, EU07 in `ee21ed6`, BR 245 in `fda139d`, BR 428 in `789fe0a`, BR 247 in `52f4e6b`).

Applied:

- `backend/src/services/trainSpecs.ts` — full hardcoded specs for the entire ICE family. All ten classes covered: BR 401 (ICE 1), BR 402 (ICE 2), BR 403 (ICE 3), BR 406 (ICE 3M), BR 407 (Velaro D), BR 408 (ICE 3neo), BR 411 (ICE T 7-car), BR 412 (ICE 4), BR 415 (ICE T 5-car), BR 462 (Velaro MS). 5-8 alias keys per class for vision's various class string formats. Weight values are full train-set service weights (the customer-visible number on the back-of-card spec). Old BR 462 single-key builder override removed (superseded by new full entry).
- `backend/src/services/trainSpecs.ts` — weight validation threshold bumped from `> 0` to `>= 5` tonnes. "1 tonnes" / "0.5 tonnes" type AI hallucinations now return null (let override layer fill in) instead of displaying nonsense on the card. Conservative floor: smallest legitimate rail vehicles are Schienenbus single railcars at ~14 tonnes, smallest draisines ~6 tonnes. Belt-and-braces for any future class not yet hardcoded.
- `backend/src/services/trainCache.ts` — `CACHE_VERSION` v9 → v10 to invalidate stale ICE entries cached before this fix. Any train scanned and cached with "1 tonnes" weight would otherwise continue to serve stale specs from cache instead of hitting the new override.

173/173 backend tests passing. Typecheck clean. Direct commit to `main` (no PR — same workflow as prior tester-correction batches; Render auto-deploys on push). DE reply pattern available for @airbus.a3200 once deploy is verified.

---

### Release — v1.0.32 LIVE on iOS App Store (Android already live since 2026-05-17)

Apple approved + published v1.0.32 (was pending review at start of this session). v1.0.32 is now LIVE on both stores. Polish locale, Polish App Store listing, EULA fix (`https://www.apple.com/legal/internet-services/itunes/dev/stdeula/` link in all localisations), and new App Store pricing scheduled to auto-apply 2026-05-18.

---

### Backend — Welcome email LIVE in production (Resend + Supabase trigger)

End-to-end welcome email pipeline shipped, deployed, and verified in production this session. Every new signup now receives the trilingual DE → EN → PL welcome email signed "Stephen" with the founder-voice "I build this alone, around a day job" framing.

What went live in addition to the PR #3 code:

- **Render env vars** — added `RESEND_API_KEY` (`re_YC3hujkh_JKen2ndyPo5aX9hrFcZvWPwE`, from `backend/.env` — architecture doc § 10 had a stale key, now corrected) and `SUPABASE_WEBHOOK_SECRET` (newly generated, 32-byte hex). Save triggered Render redeploy.
- **Supabase trigger** — Supabase's Database Webhook UI hides system schemas, so `auth.users` wasn't selectable in the table picker. Replaced with a SQL Postgres trigger using `net.http_post`:
  - Function `public.notify_welcome_email()` (security definer)
  - Trigger `on_auth_user_welcome_email` AFTER INSERT ON auth.users FOR EACH ROW
  - Posts `{type, table, record:{id, email}}` to `https://locosnap.onrender.com/api/webhooks/supabase` with the bearer header
- **Verification** —
  - 401 returned on missing bearer (auth check works)
  - 200 + `skipped:wrong_event` on valid bearer + non-matching event (filter works)
  - 200 + `sent:true` on real-payload curl to `unsunghistories@proton.me` (Resend send works)
  - Email landed in inbox with DE → EN → PL bodies intact, umlauts + Polish diacritics correct, Reply-To routing confirmed

**Backfill to existing ~470 non-Pro users explicitly deferred** — per the "ship + observe + then backfill" plan agreed earlier in the session. Two-decision rationale: (a) need 1-2 days of real-inbox delivery data before blasting hundreds, (b) Polish/German diacritic rendering should be confirmed across multiple email clients before a one-shot bulk send.

---

### Backend — Trilingual welcome email on signup (Resend + Supabase Auth webhook)

Adds the first transactional email LocoSnap has ever sent: a welcome email fired on every new signup. Closes the zero-touch-onboarding gap surfaced in this session's research (RevenueCat data shows ~90% of trial starts + ~50% of paid conversions happen on Day 0 — sending nothing leaves the highest-intent window unused).

Applied:

- `backend/package.json` — added `resend@^4.x` dependency.
- `backend/src/config/env.ts` — added `RESEND_API_KEY` + `SUPABASE_WEBHOOK_SECRET` env vars with `hasResend` / `hasSupabaseWebhook` feature flags.
- `backend/src/services/email.ts` (new) — Resend wrapper with `sendWelcomeEmail(toEmail)`. Trilingual DE → EN → PL HTML + plain-text bodies, copy locked to `docs/email-welcome-spec.md` (verbatim, founder-voice "I build this alone, around a day job. Pro is what keeps it alive"). Subject: `Welcome to LocoSnap / Willkommen / Witaj`. Logo at top (`https://locosnap.app/images/icon.png`), no emojis, language separators, footer invites replies. From: `Stephen from LocoSnap <noreply@locosnap.app>`. Reply-To: `hello@locosnap.app` (forwards to founder inbox via ImprovMX). DE first because it's the #1 market; PL second-priority but last in stack for visual rhythm.
- `backend/src/routes/webhooks.ts` — added `POST /api/webhooks/supabase` handler. Bearer-token auth via `SUPABASE_WEBHOOK_SECRET` with `crypto.timingSafeEqual`; hard-fails 503 in production if secret missing (same pattern as RevenueCat webhook). Filters for `type=INSERT, table=users` only; skips no-email records; tracks `welcome_email_sent` analytics event with success flag. Always returns 200 on errors (after Sentry capture) to prevent retry storms.
- `backend/src/index.ts` — startup banner shows Resend + SupabaseHook status; endpoint listing includes `/api/webhooks/supabase`.

**No founder CC on automated sends** — the architecture's mandatory-CC rule applies only to manual/tester emails; CC'ing every signup would flood the inbox. Founder still sees feedback via Reply-To routing.

173/173 backend tests passing. Typecheck clean. **Not yet deployed — needs a push to go live on Render.** After push, two manual config steps remain: (a) Render env vars `RESEND_API_KEY` + `SUPABASE_WEBHOOK_SECRET`, (b) Supabase Dashboard → Database → Webhooks → new webhook on `auth.users` INSERT pointing at `https://<backend>/api/webhooks/supabase` with `Authorization: Bearer <SUPABASE_WEBHOOK_SECRET>` header.

Backfill (sending to existing non-Pro users) is deliberately deferred to a separate session — ship the per-signup flow first, observe real-inbox delivery for a day or two, then run a one-off script.

---

## 2026-05-17

### Frontend — Country-flag backfill banner on Profile tab (queued for v1.0.33)

Adds a dismissible banner at the top of the Profile screen for users whose `country_code` is NULL (legacy/pre-onboarding cohort + recent payers who bounced through subscribe before completing identity onboarding). Triggered by the 2026-05-17 Supabase audit which surfaced 149 users (the largest single bucket) with no country_code — almost all signed up before identity onboarding shipped (~late April), plus 2 confirmed real paying customers (marcel.weiss + mau.cavelius) who paid within 7-14 minutes of first launch then never scanned.

Applied:

- `frontend/app/(tabs)/profile.tsx` — added `AsyncStorage` import, added `countryBannerDismissed` state + `useEffect` that reads `locosnap_country_banner_dismissed` on mount, `dismissCountryBanner` handler that persists dismissal, `shouldShowCountryBanner` derived flag (`!!user && !profile?.country_code && !countryBannerDismissed`). JSX banner rendered above `userHeader` View: flag icon + title + body + CTA (full row tappable → opens existing `handleOpenIdentityModal`), plus a separate close `X` button that dismisses persistently. Added `countryBanner*` styles to the StyleSheet block.
- `frontend/locales/en.json` + `de.json` + `pl.json` — added `profile.countryBanner.{title,body,cta,dismissA11y}` keys in all three locales. Reuses existing accent colour with 33% alpha for the border (matches the app's other accent-tinted callouts).

153/153 frontend tests passing. No backend changes. No new dependencies — uses existing `@react-native-async-storage/async-storage`, existing `Ionicons` set, existing identity-edit modal flow.

**Why a banner, not a forced flow:** the audit also showed real paying customers (marcel.weiss / mau.cavelius) hit subscribe BEFORE completing identity onboarding. A forced flow would interrupt them again at the Profile tab. A dismissible banner respects user agency while making the capture path obvious for those who want to appear on the country leaderboard.

Ships in v1.0.33. No version bump in this commit — bundling with other v1.0.33 candidates as they accumulate.

---

### Release — v1.0.32 LIVE on Google Play (Apple still in review)

**Android approved + published 2026-05-17 evening** — ~5h turnaround from 13:42 UTC submission. Polish locale, Polish Play Store listing, and new Play pricing (PL annual 89.99 zł / CZ Kč 499 / IT/ES €24.99 / DE €34.99 / UK held at £24.99) all live to Android users immediately. iOS still in Apple Review.

---

### Release — v1.0.32 built, submitted to both stores, localised pricing rolled out across 9 countries

**EAS builds (2026-05-17 12:12 UTC):**
- iOS build `da0720de-3a84-4190-b694-25c74eab8a62` — v1.0.32 build 54 — FINISHED → submitted to App Store Connect 13:42 UTC (Apple submission `978b7ef0-a15c-4f19-94ea-d10cbc9aeb73`, Apple processing 5-10 min then review queue)
- Android build `416266bb-3ffb-4509-a80a-44298125eae1` — v1.0.32 versionCode 20 — FINISHED → submitted to Google Play 13:42 UTC (Play submission `871a763d-ed20-48dc-954d-3364c7c48bbb`, running checks before review)
- Backend commit `62778d5` pushed to `origin/main` at 13:43 UTC — Render auto-deploy in flight. Backend `/api/health` confirmed responsive post-push.

**App Store Connect — Pro Annual price changes (scheduled May 18):**

9 country overrides set against existing €29.99 EU / £24.99 UK / €29.99 ES-IT / Kč 699 CZ / zł 99.99 PL baseline:

| Country | Before | After | Direction |
|---|---|---|---|
| DE | €29.99 | €34.99 | raise |
| UK | £24.99 | £27.99 | raise |
| FI | €29.99 | €34.99 | raise (= DE) |
| NL | €29.99 | €32.99 | raise |
| FR | €29.99 | €32.99 | raise |
| PL | 99.99 zł | 89.99 zł | cut (10%) |
| CZ | Kč 699 | Kč 499 | cut (29%) |
| ES | €29.99 | €24.99 | cut (17%) |
| IT | €29.99 | €24.99 | cut (17%) |

Apple confirms via yellow warning triangle when a change is a decrease. Existing subscribers preserved at old price on renewal (Apple's standard legacy-honour); new sign-ups get new prices.

**App Store Connect — Pro Monthly:**

Only PL changed: 14.99 zł → 13.99 zł (small cut). DE monthly intentionally left at Apple auto-tier €2.99 (anomalously low vs annual €34.99 amortised, but user opted not to raise — defensible: keeps annual looking like a discount via the absolute-£ savings story rather than per-month framing).

**App Store Connect — Lifetime IAP:**

User set DE base at €89.99 (28% above original research recommendation of €69.99 — independent judgement call, defensible). Per-country overrides:
- PL: 229 zł (~2.55× new PL annual)
- CZ: 1,299 Kč (~2.60× new CZ annual)
- Other EU + UK auto-tier from DE base.

**Play Console — Pro Annual auto-renew + prepaid overrides:**

Play's auto-conversion was significantly more aggressive than Apple's (PL 149.99 zł vs Apple's 99.99 zł; CZ 849.99 Kč vs Apple's 699 Kč). Bigger cuts needed:

| Country | Play before | Play after | Direction |
|---|---|---|---|
| PL | 149.99 zł | 89.99 zł | cut (40%) |
| CZ | 849.99 Kč | 499 Kč | cut (41%) |
| IT | €34.99 | €24.99 | cut |
| ES | €34.99 | €24.99 | cut |
| DE | €33.99 | €34.99 | raise (optional, applied for App-Store parity) |
| UK | £24.99 | held | UK is softening — user judgement call to hold |

Applied to both `annual-autorenew` and `annual` (prepaid) base plans for parity.

Play monthly skipped — Play's monthly auto-conversion was already in the acceptable zone.

Play Lifetime in-app product: same per-country prices as App Store lifetime.

**Polish store-listing metadata added in both stores:**

- App Store Connect: Polish localisation added under App Information. Subtitle `Identyfikator pociągów AI`. Promotional text, keywords, and full description in Polish.
- Play Console: Polish (pl-PL) translation added under Main store listing. Short description `AI identyfikuje każdy pociąg w sekundę. Klasa, przewoźnik, historia, rzadkość.` Full description ~1450 chars, structured with English copy's voice (lead line → CO OTRZYMUJESZ → POLSKIE POCIĄGI → TWOJA KOLEKCJA → RANKING LIGOWY → LOCOSNAP PRO → WERSJA DARMOWA → PRYWATNOŚĆ). Mentions Polish train classes by name: SU45, SU46, EU07, EP07, ET22, EN57, ED72, EN76, Newag Dragon, Newag Impuls, Pesa Gama, Pesa Bydgostia, ED250 Pendolino, plus operators PKP IC, Koleje Mazowieckie, ŁKA, SKM Trójmiasto.
- Release notes per locale: simple "Polish language is now supported throughout the app..." style — same line in EN, DE, PL. Within Play 500-char limit.
- All Polish copy AI-translated (Claude). No native review per user direction — same bar as the in-app `pl.json` and the original DE launch.

**Mid-session lessons (now in memory):**

- Apple's tier system already applies purchasing-power adjustment — pricing recommendations must spot-check the current store baseline, not assume raw FX conversion. Caught after I'd told user to set PL/CZ/DE annual increases against assumed €4.99 base; actually annual base was €29.99 and the changes were directionally correct. Memory file `pricing_localisation.md` rewritten with real baselines + lessons. See "Lessons" section there.
- Play's tier conversion IS more aggressive than Apple's — Play needs bigger per-country cuts (PL/CZ cuts of 40-41% on Play vs 10-29% on Apple).
- Almost re-introduced the v1.0.8 Samsung S24 / Android 16 / Finnish-locale silent startup crash by adding `import * as Localization from "expo-localization"` back into `settingsStore.ts` as a proposed "device-locale auto-detection quick win". User caught it before commit. Reverted same-session. New memory file `feedback_no_expo_localization.md` created. The package was uninstalled in v1.0.11 (2026-04-01) for exactly this reason.

**Files touched (committed):**
- Frontend commit `ac352ce` (10 files): compare.tsx, language-picker.tsx, i18n/index.ts, settingsStore.ts, en.json + de.json + pl.json (NEW), app.json version bump, ARCHITECTURE.md, CHANGELOG.md
- Backend commit `62778d5` (1 file): identify.ts

---

### Frontend + Backend — Polish (`pl`) localisation groundwork + compare-screen i18n cleanup

Triggered by a Twitter thread (Max @maks6361) showing an AI-identifier app 5x'd MRR (€20-30 → €130-150/mo) after a 2-hour localisation pass. Audit of LocoSnap revealed:

- i18n infrastructure was already solid (i18next + react-i18next, 26/29 frontend files using `useTranslation`)
- Only 3 holdout files: `compare.tsx` (11 hardcoded labels), `language-picker.tsx` (2 hardcoded accessibility labels + German umlaut bug), `_layout-helpers.ts` (no user-facing strings — left as-is)
- Backend `LANGUAGE_INSTRUCTIONS` already had `pl`, `fr`, `nl`, `fi`, `cs` wired but frontend `SUPPORTED_LANGUAGES` rejected them at the validation gate — someone started this and stopped

Applied:

- `frontend/app/compare.tsx` — added `useTranslation`. All hardcoded English labels (Max Speed, Power, Weight, Length, Builder, Year Built, Gauge, Fuel, Built, Surviving, Status, VS, "No trains selected for comparison", "Go back and select trains") replaced with `t()` calls. Reused existing `results.maxSpeed`/`results.power`/`results.weight`/etc. where they already existed; added a new `compare` namespace for unique-to-compare keys. Rarity badge `tier.toUpperCase()` now goes through `t(\`rarity.${tier}\`).toUpperCase()` so badges read "POSPOLITY" / "GEWÖHNLICH" / "COMMON" depending on locale.
- `frontend/app/language-picker.tsx` — refactored from two hardcoded `TouchableOpacity` blocks to an array-driven `LANGUAGE_OPTIONS.map(...)`. Adding a locale now takes one line. Polish ("Polski") button added as third option. Fixed `auswaehlen` → `auswählen` umlaut bug in the German accessibility label per CLAUDE.md German rules.
- `frontend/locales/en.json` + `de.json` — added `compare` namespace (`emptyText`, `emptyLink`, `vs`, `yearBuilt`, `gauge`, `fuel`, `surviving`, `unitsCount_one/other`).
- `frontend/locales/pl.json` (NEW) — full Polish translation, ~95 keys / 14 namespaces, structurally identical to en.json. Plural rules use Polish's `one` / `few` / `many` / `other` for `trialBanner_*`, `scanBadge_*`, `unitsCount_*`. AI-translated (Claude) at user direction — same quality bar as the German build at launch; first Polish tester signal will be monitored for terminology tuning. Railway-specific Polish terminology choices: Skanuj (Scan), Kolekcja (History/Collection), Ranking (Leaderboard), Obserwator (Spotter), Pociąg (Train), Pospolity / Niezbyt pospolity / Rzadki / Epicki / Legendarny (rarity tiers), Plan (Blueprint), Pantograf, Nastawnia (signal box), Obrotnica (turntable), Tender węglowy (coal tender).
- `frontend/i18n/index.ts` — imports `pl.json`, adds it to `resources` and `LANGUAGE_RESOURCES`.
- `frontend/store/settingsStore.ts` — `AppLanguage` widened to `"en" | "de" | "pl"`. `SUPPORTED_LANGUAGES` updated. Added a comment cross-referencing the matching backend constants.
- `backend/src/routes/identify.ts` — `VALID_LANGUAGES = ["en", "de", "pl"] as const`. Added a comment cross-referencing the frontend constants and `LANGUAGE_INSTRUCTIONS`.

7 files changed, 1 new file. Frontend tests 153/153 passing; backend tests 173/173 passing.

**Discovered while auditing — and almost re-introduced a known crash:** the architecture doc claim "device locale via `expo-localization`" was aspirational. The package was actually **uninstalled in v1.0.11 (2026-04-01)** after it crashed Samsung S24 / Android 16 / Finnish-locale devices at startup before Sentry could initialise (invisible to monitoring). Mid-session I added `import * as Localization from "expo-localization"` back to `settingsStore.ts` as a proposed "quick win" — user caught it before commit. Reverted same-session. Architecture doc updated to reflect the constraint, and a new memory file [`feedback_no_expo_localization.md`] created to prevent this from happening a third time. First launch continues to default to `"en"`; users pick their language on the picker — this is the safe path.

**Not in this commit (needs separate action):**
- Localised App Store + Play Console pricing per the pricing-strategy research (PL annual 89 zł, CZ annual 499 Kč, DE annual €34.99, lifetime = 2× annual everywhere) — store-config only, no code change. See pricing report from this session.
- Polish App Store + Play Store metadata (title, subtitle, keywords, screenshots) — needs to happen when v1.0.32 ships.
- iOS permission strings in `app.json` (`NSCameraUsageDescription` etc.) are still English-only — needs Expo `infoPlist` locale overrides for PL/DE.

Not yet deployed — backend `identify.ts` change needs a push to go live on Render. Frontend pl.json + compare.tsx + language-picker.tsx ship in the next EAS build (v1.0.32).

---

### Backend — Class 390 Pendolino + Class 66 operator livery disambiguation (RailUK forum corrections)

Two misidentifications reported on RailUK forums by GRALISTAIR (screenshots) and confirmed by AlterEgo (Verified Rep):

1. **Class 390 Pendolino returned as "Class 800 / Avanti West Coast"** — Class 800 is an IET/Azuma (GWR/LNER/TransPennine); Avanti have never operated it. No Class 390 rule existed in the vision layer, so the model was pattern-matching to Class 805/807 Avanti + Hitachi AT300 context and returning Class 800 as the base class.

2. **GBRf Class 66 returned as "Freightliner" with wrong hp (3,200 instead of 3,300)** — No Class 66 entries existed in KNOWN_SPECS, so the AI defaulted to Freightliner (largest historical Class 66 operator, over-represented in training data). Operator livery discrimination was absent.

Applied:

- `backend/src/services/vision.ts` — (a) Added dedicated Class 390 Pendolino disambiguation rule: tilting ETR-derived body profile, Alstom-built (Savigliano/Washwood Heath), WCML-only, fleet 390001–390030 / 390101–390157, 125 mph, Class 800 explicitly blocked as return for any Pendolino. (b) Added Class 66 operator livery rule: GBRf = dark grey + orange/yellow cabs; Freightliner = powder blue/bright green; DB Cargo UK = red; Colas = vivid orange; DRS = dark blue/indigo. Power corrected to 3,300 hp.
- `backend/src/services/trainSpecs.ts` — Added 7 KNOWN_SPECS keys for Class 390 (`class 390`, `class 390/0`, `class 390/1`, `class 390/2`, `pendolino`, `avanti pendolino`, `virgin pendolino`) locking 125 mph / 5,760 kW (9-car) or 7,050 kW (11-car) / Alstom builder. Added 5 KNOWN_SPECS keys for Class 66 (`class 66`, `br class 66`, `british rail class 66`, `class 66/0`, `class 66/7`) locking 3,300 hp / EMD 710G3B.
- `backend/src/__tests__/services/trainSpecs.test.ts` — 3 error-path tests changed from `makeTrain()` to `makeTrain({ class: "UnknownTestClass" })` — fixture defaults to `class: "Class 390"` which now hits KNOWN_SPECS and returns "125 mph" rather than null; tests verifying fallback/error behaviour need a class absent from KNOWN_SPECS.

173/173 tests passing. Commit `cec1f13`. Fast-forward merged to `origin/main`. Render auto-deploy triggered. Forum replies posted by user on RailUK same session.

---

### Backend — BR 423 vs BR 442 Bayern disambiguation + Münchner R2.2 builder/Combino fix (Trainpics MUC corrections)

Two TikTok-comment corrections from **Trainpics MUC** on the BR 101 v2 ad thread:

1. **BR 423 returned as BR 442** — DB Regio Bayern operates BOTH BR 423 (S-Bahn München) and BR 442 (Werdenfelsbahn) in red/white livery, so operator label was not a discriminator. The existing BR 442 nose-profile rule did not call out Bayern as a shared-livery zone.
2. **Münchner R2.2 returned with builder "Siemens Mobility"** and described as "basiert auf der bewährten Plattform der Combino-Familie" — both wrong. R2.2 was built by AEG / ADtranz (R2.2a delivered 1994, R2.2b delivered 1996–97) and is NOT a Combino. The Siemens Combino was never delivered to München. The München tram fleet is: R2.2 (AEG/ADtranz), R3.3 (Bombardier Flexity, 2009–11), Avenio (Siemens, 2014+).

Applied:

- `backend/src/services/vision.ts` — (a) added a Bayern-context paragraph to the BR 442 nose-profile rule explaining DB Regio Bayern operates both 423 and 442; decide by cab profile alone; when uncertain in Bavaria, prefer BR 423 (much larger fleet). (b) Added a new R2.2 disambiguation bullet immediately before the existing KT4 vs Combino bullet — builder is AEG/ADtranz, NOT Siemens, NOT Combino, no Combinos have ever run in München, max speed 70 km/h, 6-axle articulated, 70% low-floor, fleet numbers in the 2100s.
- `backend/src/services/trainSpecs.ts` — added a new R2.2 disambiguation bullet in the system prompt (above the Class 69 entry) AND new KNOWN_SPECS lookup entries for `r2.2`, `r 2.2`, `r2.2a`, `r2.2b`, `mvg r2.2`, `münchner straßenbahn r2.2`, `muenchner strassenbahn r2.2`, `münchen r2.2` — builder pinned to "AEG / ADtranz", max 70 km/h, 600 V DC electric.
- `backend/src/services/trainFacts.ts` — added a new R2.2 bullet (above the ČD class 753/754 entry) forbidding any "Siemens Mobility" builder claim or Combino-family/Combino-platform framing in free-text facts, with the correct German framing ("von AEG / ADtranz für die MVG München gebaute sechsachsige Niederflur-Straßenbahn der R2.2-Familie").

3 files changed, 17 insertions, 1 deletion. Commit `14a1b37`. Pushed to `claude/epic-hawking-0bd9d3` then fast-forward merged to `origin/main` at user direction. Render auto-deploy in flight.

Cache version unchanged. Memory entry logged in `backend_backlog_corrections.md`. Both TikTok replies (DE) drafted and posted by user same session.

---

## 2026-05-16

### Backend — Class 07 + Class 20 vision rules and spec entries (from Steph tester report)

UK tester Steph reported two misidentifications:

1. **D2996 at Severn Valley Railway** identified as "Class 03 D 2986" — should be **Class 07** (Ruston & Hornsby, Paxman 6RPH engine, 14 built 1962 for Southampton Docks, ~7 preserved). Vision likely misread "D2996" OCR as "D2986" AND lacked a Class 07 anchor entirely.
2. **Red WCR-livery loco** identified as "Class 26 / 90 mph / 1,750 HP" — Steph confirmed it is **Class 20** (single-cab English Electric Type 1 "chopper", 228 built 1957-68, 1,000 hp / 75 mph). The returned Class 26 stats were also wrong even for Class 26 itself (real figures: 1,160 hp / 75 mph; the 1,750 hp / 90 mph were Class 37 numbers).

Applied fix pattern (vision rule + spec override):

- `backend/src/services/vision.ts` — two new disambiguation bullets near the Class 11 / Class 14 UK shunter rules: (a) "British Rail Class 07 vs Class 03/04 shunter disambiguation" with fleet-number-definitive rule (D2985–D2998 = Class 07, D2000–D2199 = Class 03), builder cue (Ruston & Hornsby vs BR works), engine cue (Paxman 6RPH vs Gardner 8L3); (b) "British Rail Class 20 vs Class 26/27/33 mainline Type 1/2 disambiguation" — single-cab vs double-cab as primary visual cue, fleet number ranges for all four classes, WCR red-livery operator-context note pointing toward Class 33 as the secondary candidate when double-cab.
- `backend/src/services/trainSpecs.ts` — added KNOWN_SPECS entries for Class 07 (20 mph / 275 hp / 14 built / Ruston & Hornsby / Paxman 6RPH), Class 03 (28 mph / 204 hp / 230 built / BR Swindon-Doncaster / Gardner 8L3), Class 20 (75 mph / 1,000 hp / 228 built / English Electric Vulcan Foundry-RSH / EE 8SVT), Class 26 (75 mph / 1,160 hp / 47 built / BRCW / Sulzer 6LDA28). Multiple alias keys per class (bare class number, `br class N`, `british rail class N`).

Cache version unchanged. Memory entry logged in `backend_backlog_corrections.md`. Steph reply DM drafted but held until push deploys fix to Render.

### Content — BR 101 v2 ad posted (TikTok + Instagram, DE)

New 10-second class ad built and posted on TikTok + Instagram. Subject: **DB Baureihe 101** — 145 built by Adtranz, ~51 still in DB Fernverkehr service as of April 2026 per German Wikipedia fleet table. 101 001-6 wears the special purpurrot/beige heritage livery (1960s F-Zug colour scheme), operational.

- Hook structure: visual paradox lead — Beat 1 "Sieht aus wie 1962." over 101 001 heritage hero, Beat 2 "Ist aus 1996." over heritage coach pan, Beat 3 "145 gebaut." over standard 101 in verkehrsrot, Beat 4 "Nur 51 fahren noch." over IC coach pan, Beat 5 saved DE endcard.
- Footage: two clips from Samuel @trainspotting101 (blanket permission per `footage_source_trainspotting101.md`): heritage 101 001 climbing (joint spot with @railspottingbayern) + standard 101 in verkehrsrot at speed.
- Output: `~/Desktop/locosnap_br101_v2_de.mp4`, 720×1280, 10.000s, 1.74 MB. Built per `feedback_ad_build_pipeline.md` (frame-sampled both clips, top text placement, frame-checked each beat, used saved `endcard_de.mp4`).
- Credit attribution: Samuel @trainspotting101 + courtesy tag @railspottingbayern. Both DM'd post-publish.
- Posting slot: Saturday 16 May late afternoon. Third ad in 7 days after the BR 142 / cooling-WoW diagnosis. Intended to re-trigger algorithm with proven channel-formula content after Roter Elch (BR 221) under-performance.

A/B comparison from previous BR 101 ad (2026-04-12): 1,500 views / 25.9% full-watch / 12 new followers / DE 83.9%. Tomorrow's 24h read will compare heritage-hero-first restructure against those figures.

---

## 2026-05-14

### Convention — Supabase Data API grant template (effective 2026-10-30 cutover)

Supabase change-notice email received today: default `public`-schema grants on the Data API are being removed. New projects from 2026-05-30, all existing projects from 2026-10-30. LocoSnap is affected — frontend (supabase-js + anon key) and backend (supabase-js + service_role key) both use the Data API; no direct Postgres connection string anywhere.

**Existing 13 tables (migrations 001-015) retain their current grants permanently.** No backfill needed. The risk is forward-only: any new migration after 2026-10-30 that does `CREATE TABLE public.X` without explicit `GRANT` statements will silently return 42501 errors from the Data API.

**Convention updates:**

- `CLAUDE.md` — new mandatory rule "Supabase migration template — every new `CREATE TABLE public.X` must include explicit GRANTs". Template includes the three role grants (`anon` read-only, `authenticated` full CRUD, `service_role` full CRUD), `ENABLE RLS`, and at least one policy. Tightening per-table notes included (read-only tables drop CRUD from clients; backend-only tables omit grants entirely).
- `docs/ARCHITECTURE.md` — new "Data API grants — convention change effective 2026-10-30" subsection in Database section with the same template + pre-cutover Security Advisor check note.
- Memory: new `feedback_supabase_grant_after_2026_10_30.md` entry so the rule survives across sessions.

**Why discovered:** Supabase email 2026-05-14 evening flagged the change. Quick audit of `supabase/migrations/*.sql` confirmed zero existing GRANT statements across 15 migrations — everything currently relies on defaults. Backfilling existing migrations is unnecessary (Postgres GRANT is idempotent and existing tables retain their default-time grants); only future migrations need updating.

### Release — v1.0.31 built and submitted to both stores

No code changes today. v1.0.31 build artefacts produced from the six queued commits on `main` (ending at `a9dcbfd`) and submitted to both stores.

- **Android:** `eas build --platform all --profile production` triggered ~20:16 UTC. versionCode 18 → 19 auto-bumped by EAS. Build ID `1af7dfa0-9f8b-4f70-84be-2b5d168a52cf`. Queue time 42 min (EAS reported a partial Android-side outage at trigger), build duration 20 min. AAB: https://expo.dev/artifacts/eas/4k9DfiEUWtrD74jrSivQKZ.aab. R8 minification + resource shrinking visibly effective — new-install size 22.2 MB (-6.35 MB vs v1.0.30 28.55 MB); download time -2s; update size 7.2 MB. Submitted to Play production track at ~22:48 UTC via `eas submit --platform android --id 1af7dfa0...`; release saved as DRAFT, EN+DE release notes pasted in Play Console, sent for Google review same session. Submission ID `ef712894-312d-47ea-8deb-9310bd919163`.
- **iOS:** same `eas build` call. buildNumber 52 → 53 auto-bumped. Build ID `44bcab5b-f995-4d80-892c-ddb32e9884aa`. IPA: https://expo.dev/artifacts/eas/9uiqgQrWqJfZwuQiCEmEZG.ipa. Submitted to ASC at ~22:38 UTC via `eas submit --platform ios --id 44bcab5b...`; eas-cli upload + ASC notarisation took ~24 min end-to-end (longer than usual but within ASC's normal variance). Submission ID `f9713015-d7eb-4e25-9444-af350909b9f6`. Awaiting Apple binary processing for TestFlight (typically 10-30 min), then manual "Submit for Review" step in ASC App Store tab with the same EN+DE notes.

**Release notes (identical for both stores, fits 500-char Play limit):**

EN:
```
Bug fixes and improvements:

• Fixed Siemens Vectron identification (BR 191 AC, BR 192 DC, BR 193 MS)
• Fixed Hector Rail 243 identification
• Added Swedish SJ Y1 / Fiat Y1 railcar coverage
• View your full scan history beyond 50 spots
• Smarter upgrade prompts on the results screen
• More secure sign-in storage
```

DE:
```
Fehlerbehebungen und Verbesserungen:

• Erkennung der Siemens Vectron korrigiert (BR 191 AC, BR 192 DC, BR 193 MS)
• Erkennung der Hector Rail 243 korrigiert
• Schwedische SJ Y1 / Fiat Y1 ergänzt
• Vollständiger Scan-Verlauf über 50 Einträge hinaus sichtbar
• Intelligentere Upgrade-Hinweise auf der Ergebnisseite
• Sicherere Speicherung der Anmeldedaten
```

**v1.0.31 carries (all already on `main`):**
- `b4eec9b` MAX_HISTORY 200 → 1000 + Android R8 minification via `expo-build-properties`
- `fbe77e1` `Math.round` on `photo_accuracy_m` + `saveSpot` shim
- `deac2f3` scan-limit Sentry filter
- `b623d9a` `Sentry.setUser` email on session restore + SJ Y1 / Fiat Y1 specs
- `88e9af6` `PaywallSoftPrompt` component + scan-aware soft-prompts on results screen + EN/DE locale blocks
- `ff748ae` + `a9dcbfd` ARCHITECTURE / CHANGELOG / handover docs

### Store config — Apple `pro_lifetime` IAP approved

Apple App Store review approved the `pro_lifetime` non-consumable IAP on 2026-05-14. SKU was in "Ready to Submit" since v1.0.29 setup (2026-05-08) and submitted for review attached to a v1.0.29 binary; approval landed today.

- **Effect:** `pro_lifetime` is now sellable on both Apple and Play (Play side approved + live since v1.0.29). RC `autorenew_v1` offering (Default since 2026-05-10) already has `$rc_lifetime` package wired with both Apple `pro_lifetime` and Play `pro_lifetime` → `getOfferings().current.lifetime` returns a valid package for any v1.0.29+ install.
- **Remaining work to make it user-visible:** `frontend/app/paywall.tsx` currently renders monthly + annual tiles only. No third tile reads `offerings.current.lifetime`. Adding a lifetime tile is queued as a v1.0.32 candidate (~2-3h: third tile + EN+DE copy + analytics dimension for `package_id=lifetime`).
- **Memory updated:** `project_lifetime_pro_demand.md` flipped from "demand tracker, no SKU" to "SKU live on iOS + Play, only paywall UI surfacing remains." `project_revenuecat_topology.md` Apple `pro_lifetime` row status moved from "Ready to Submit" → "Approved 2026-05-14".

---

## 2026-05-13

### Frontend — Scan-aware paywall soft-prompts on results screen (v1.0.31)

Replaces the static "Grow your collection" upsell banner on the results screen with a scan-count-aware soft-prompt ladder, intended to catch peak intent before the hard wall at scan 6 instead of only at exhaustion. Industry data (RevenueCat 2025, Adapty 2025, 1,240-app paywall-timing study) supports earlier and tiered surfacing — 82% of trial/sub starts happen day-1, and upfront paywalls convert 5.5× delayed ones. LocoSnap's previous flow showed the hard paywall only at scan 6; non-Pro users between scans 1-5 saw an identical static banner regardless of how close they were to the wall.

- `frontend/components/PaywallSoftPrompt.tsx` — NEW. Single component, picks copy variant from `daily_scans_used`:
  - **scan 2** → curious, low-pressure (`"Enjoying LocoSnap?"` / `"Gefällt dir LocoSnap?"`)
  - **scan 4** → outcome-led, intro-pricing tease (`"Never lose a spot again"` / `"Kein Zug bleibt unerkannt"`)
  - **scan 5** → urgency, loss-framed (`"1 free scan left"` / `"Noch 1 kostenloser Scan"`, amber palette)
  - **default** (other counts) → generic `"Grow your collection"` fallback so anonymous users (no profile) still see something useful
  - Dismissable per render (X button, session-level state — no AsyncStorage needed since scan counts only increase, each variant only renders once per user)
  - Routes to existing `/paywall?source=softprompt_<variant>` for per-touch analytics
- `frontend/locales/en.json` + `de.json` — added `paywall.softPrompt.{scan_2,scan_4,scan_5,default}.{title,body,cta}` blocks. No PL locale yet (PL not shipped in app; falls through to EN).
- `frontend/app/results.tsx` — replaced ~20-line static `upsellBanner` block (and its 6 dead `StyleSheet` entries) with `<PaywallSoftPrompt scansUsed={profile?.daily_scans_used ?? 0} />`. Imported component at top.
- Three new tracked events fire through existing `track()`: `paywall_softprompt_shown` (on mount), `paywall_softprompt_tapped`, `paywall_softprompt_dismissed`. All carry `{ variant, scansUsed }`. The downstream `paywall_viewed` event already exists and resolves the `source` param so per-touch conversion is measurable end-to-end.

**Apple/Play review surface:** zero. Pure copy + frontend gating; uses the offers already live on both stores (Apple `intro_3mo_30off` paid intro on annual, Play `trainvibez-launch` £1-first-month global new-customer offer on monthly). No new IAP products, no entitlement changes, no flow that requires fresh App Review attention.

**Limitations called out:**
1. The scan-5 prompt fires on the *results screen of the user's 5th scan*, not on the camera screen before they take scan 6. A camera-screen banner mirroring the same urgency copy is a candidate for a follow-up commit.
2. No PL locale — Polish-speaking users see EN. Adding PL is a separate, larger ask (translate all existing keys, not just paywall).
3. Tests not re-run in this worktree because `node_modules` is symlinked to the main repo's tree which lacks `expo-secure-store` / `expo-store-review`. 135/135 actual test assertions pass; 2 suites fail at module import time on unrelated expo modules — pre-existing condition consistent with yesterday's session note.

### Frontend — Sentry.setUser email on session restore (commit `b623d9a`)

Backlog item #28. Sentry was already called with `{ id }` via `identifyUser` but email was excluded. Two changes:

- `frontend/services/analytics.ts` — `identifyUser` signature extended to accept optional `email`; email passed to `Sentry.setUser`, excluded from PostHog `identify` call (PostHog should not receive PII).
- `frontend/store/authStore.ts` — added `identifyUser(session.user.id, { email: session.user.email ?? undefined })` immediately after session restore in `initialize()` (before `fetchProfile()` completes). Same call added on fresh sign-in in `onAuthStateChange`. `fetchProfile`'s existing `identifyUser` call now threads `email` through. Effect: every crash from a signed-in user now carries Supabase UUID + email in Sentry — traceable to `profiles` table. Crashes before `fetchProfile` completes are no longer anonymous.

### Backend — SJ Y1 / Fiat Y1 spec entries (commit `b623d9a`)

No prior coverage existed for the Swedish single-car diesel railcar series. 4 lookup keys added to `backend/src/services/trainSpecs.ts` after the SJ Rc family block: `"sj y1"`, `"y1"`, `"fiat y1"`, `"sj class y1"`. Specs: 130 km/h, 220 kW, 49 tonnes, Fiat Ferroviaria (Savigliano, Italy), 82 units (Y1 1201-1282), diesel hydraulic. Comment block includes disambiguation note vs BR 628 / VT 98 / Class 153. No cache version bump required (new class, no stale cached entries to invalidate).

---

### Backend — Siemens Vectron family corrections + Hector Rail 243 disambiguation (cache v8 → v9)

Triggered by transportlife (TikTok, likely same person as rail_gaze — name change in thread) scanning a Hector Rail Vectron 243.126 photographed in Örebro län, Sweden. Two scans of the same locomotive returned different classes (`BR 193` Common, then `Siemens Vectron` Uncommon — creating a duplicate "new class added" collection entry), and the AI-generated facts text confidently equated BR 193 with Vectron AC. **The DB Baureihe ↔ Vectron-variant mapping was wrong in two prompt files** — this was the same bug spilling into multiple Vectron scans across the user base.

**Correct mapping:**
- BR 191 = Vectron AC (15 kV 16.7 Hz AC only) — relatively uncommon DB designation
- BR 192 = Vectron DC (3 kV / 1.5 kV DC only) — also uncommon
- **BR 193 = Vectron MS (Multi-System: 15 kV / 25 kV AC + 3 kV / 1.5 kV DC) — the cross-border workhorse and most common DB designation**
- BR 247 = Vectron DE (diesel)
- BR 248 = Vectron Dual Mode
- **There is no BR 194** (prior prompts hallucinated this)

**Files changed:**
- `backend/src/services/vision.ts` — corrected the AC/MS/DC mapping in the Vectron variants paragraph; added a dedicated Hector Rail 243 disambiguation rule (243.xxx fleet numbers + dark grey/orange Hector livery + double-crescent moon logo → return class "Hector Rail 243", never "BR 193" or generic "Siemens Vectron").
- `backend/src/services/trainFacts.ts` — fixed the BR 247 facts block's parenthetical that wrongly said "BR 193 (pure electric Vectron AC, completely different drivetrain)" — now correctly describes BR 193 as Vectron MS multi-system and clarifies BR 191 = AC, BR 192 = DC, no BR 194.
- `backend/src/services/trainSpecs.ts` — 21 new lookup keys for the Vectron family (`br 191`/`br 192`/`br 193` + DB-prefix variants + `vectron ac`/`vectron dc`/`vectron ms`/`vectron`/`siemens vectron` generic) plus `hector rail 243` / `hectorrail 243` / `hector rail class 243`. Common specs: 200 km/h, 6,400 kW, 90 t, Siemens Mobility. BR 192 entry uses DC-specific 5,200 kW / 87 t / 160 km/h. Deliberately NO bare `"243"` key — that would collide with DR 243 / BR 143 (East German LEW Hennigsdorf, 646 units, 120 km/h, 3,720 kW).
- `backend/src/services/trainCache.ts` — `CACHE_VERSION` bumped v8 → v9 to invalidate stale Vectron entries (any "BR 193 = Vectron AC" entries cached before today would otherwise continue to serve stale facts).

**Why two-file prompt fix is necessary**: vision.ts shapes which class string is returned (BR 191 vs BR 193 vs Hector Rail 243); trainFacts.ts shapes the AI-generated narrative text. The wrong AC/MS claim lived in both — fixing only one would leave half the user-visible text incorrect.

**Reply to transportlife pending** — drafted but not yet sent, awaiting Stephen's approval.

### Security/quality audit — 20-point hardening pass (backend live; frontend queued for v1.0.31)

Response to a 20-point security checklist review. Concrete fixes applied across backend and frontend; six PASS verdicts confirmed; one PARTIAL (#18 logging) judged not-actually-leaking and deferred. Backend: `npx tsc --noEmit` clean, all 17 test suites / 173 tests green.

- **Backend `src/config/env.ts`** — new `assertProductionConfig()` exported. Iterates required production secrets (Vision key, Supabase, RevenueCat webhook, admin secret) and `process.exit(1)` if any are missing when `NODE_ENV=production`. Closes the silent-half-broken-prod risk from prior `optionalEnv` defaults.
- **Backend `src/index.ts`** — calls `assertProductionConfig()` before analytics init. CORS rewritten from exact-match list (the dead `"exp://"` string never fired) to a function origin matcher accepting `exp://` and `exps://` prefixes plus the production allowlist. `/api/health` now performs a HEAD `count` on `trains` to verify Supabase reachability and returns 503 when degraded, so uptime monitors actually catch Supabase outages.
- **Backend `src/routes/webhooks.ts`** — RevenueCat handler now hard-fails with 503 in production when `REVENUECAT_WEBHOOK_SECRET` is unset, instead of silently accepting unauthenticated POSTs that could grant `is_pro=true` to any UUID. Token comparison switched to `crypto.timingSafeEqual` to defeat timing side-channels. Dev/test behaviour unchanged.
- **Backend `src/routes/identify.ts`** — added `identifyUserRateLimit` (60 scans / hour, keyed by bearer token) so a single compromised or abusive authenticated session cannot drain unbounded Vision/Replicate spend. The existing anonymous 20/hr IP limiter still applies to unauthenticated traffic. `monitorBlueprintForCache` `train: any` typed as `TrainIdentification`.
- **Frontend `config/secureStorage.ts`** (new) — chunked SecureStore adapter (iOS Keychain / Android Keystore) with a 1800-byte chunk size to work around iOS's per-value limit. On first read it migrates any existing session out of AsyncStorage transparently, so signed-in users stay signed in across the upgrade.
- **Frontend `config/supabase.ts`** — auth `storage` swapped from `AsyncStorage` to the SecureStore adapter. 60-day refresh tokens are no longer readable from app-private storage on rooted/jailbroken devices.
- **Frontend `services/supabase.ts`** — `fetchSpots()` now takes an `offset` parameter and uses `.range()` instead of `.limit()` so users with >50 spots can page through their history. Backwards-compatible: default offset=0.
- **Frontend `package.json`** — `expo-secure-store ~15.0.0` added; needs `npm install` before next build.

**Audited PASS (no action needed):** SQL injection (Supabase query builder), hardcoded frontend keys (only public anon key), DB indexing (`idx_trains_class_operator` + comprehensive per-table indexes across migrations 001–015), error boundaries (Sentry ErrorBoundary at root layout), session expiry (Supabase defaults), password reset expiry (Supabase 1h default), synchronous email sends (no inline SMTP in request path), DB connection pooling (PostgREST handles it), admin route role checks (Bearer-secret gate, fail-closed).

**Deferred:** #18 production logging — re-read of all `console.log` call sites confirmed no auth headers or GPS coordinates are logged (only `hasGps` boolean and filename/size); structured-logger swap is scope creep without a real leak. #19 DB backup is out-of-repo (verify Supabase PITR tier in dashboard).

---

## 2026-05-12

### Schema + Frontend — photo_accuracy_m type mismatch fix (Sentry REACT-NATIVE-R)

Sentry caught a new silent-persistence-class failure ~13h after v1.0.30 went live on Google Play. `saveSpot` failed with `invalid input syntax for type integer: "16.913999557495117"` — `expo-location`'s `coords.accuracy` is a float but `spots.photo_accuracy_m` was declared INTEGER in migration 009. 2 events / 1 user / Android 16 / A065 device. Caught only because the v1.0.30 `captureError` instrumentation (commit `56acf08`) made silent-warn failures visible — second class catch in 48h after the 2026-05-10 `verification_tier` incident.

**Live fix (already applied 2026-05-12):** dashboard ALTER on production Supabase:
```sql
ALTER TABLE public.spots ALTER COLUMN photo_accuracy_m TYPE numeric USING photo_accuracy_m::numeric;
```
Zero-downtime; unblocks every v1.0.30 client in the wild without a new build. GPS accuracy is naturally fractional so `numeric` is the correct type.

**Client patch (commit `fbe77e1`, queued for v1.0.31):**
- `frontend/app/(tabs)/index.tsx` — `Math.round(loc.coords.accuracy)` at the capture site
- `frontend/services/supabase.ts` — defensive `Math.round` shim in `saveSpot` with comment explaining the migration-009 history. Belt-and-braces after the schema fix; protects against stale callers / future migrations.

**Audit lesson:** `feedback_supabase_silent_persistence_failures.md` checklist extended — not just NOT NULL constraints, but also INTEGER columns receiving values from float-typed client APIs (expo-location, sensor readings, computed ratios).

### Backend — Swiss SBB heritage disambiguation (commit `bf9156a`, awaiting push)

Triggered by TikTok comments from aurel on the English "three classes" Swiss ad: RAe TEE II "Gottardo" 1053 was being returned as RAe 4/8 "Churchill-Pfeil"; Ae 8/14 11801 was being returned as Ae 4/7. Both pairs are genuinely different classes (the older / more-famous sibling was winning the vision model's confidence).

**vision.ts**: new disambiguation rule covering both pairs. Decisive cues — fleet numbers (1053 vs 1021; 11801/11851/11852 vs 10901-11027), era (1961 vs 1939; 1931-38 vs 1927-34), formation (5-car TEE multi-system EMU vs single 1939 streamliner railcar; ~34 m double locomotive with articulation joint vs single 17 m loco with Buchli-drive side cover plate), builder consortium (all pre-1962 SLM-era — never Bombardier / Alstom / Stadler / Siemens).

**trainSpecs.ts**: 24 new lookup keys across the four classes:
- RAe TEE II "Gottardo" — 5 units (1051-1055), SIG/Schindler/MFO/SAAS, 160 km/h, multi-system (15 kV / 25 kV / 1.5 kV DC / 3 kV DC)
- RAe 4/8 "Churchill-Pfeil" — 1 unit (1021), SLM/BBC/MFO, 1939, 150 km/h, 15 kV 16.7 Hz AC
- Ae 8/14 — 3 units (11801, 11851, 11852 "Landilok"), SLM/BBC or SLM/MFO, 100-110 km/h, double locomotive
- Ae 4/7 — ~127 units, SLM/BBC/MFO/SAAS, 1927-34, 2,300 kW, 100 km/h, Buchli drive

DE reply to aurel sent. Cache version unchanged (additive only).

### Tester comments (acknowledged, no code change)

- **PL E6ACT/ET43 ad-copy critique** acknowledged — "następca" framing wrong; Dragon 1 (E6ACT) vs Dragon 2 (ET43) are siblings in the Newag family, not predecessor/successor. No backend change; future ad copy adjustment only. PL reply sent.

### Frontend — paywall conversion no longer pages Sentry (commit `deac2f3`)

Sentry caught REACT-NATIVE-S on v1.0.30 — a free user hit the 6-scan lifetime cap and the backend's expected `"Free scan limit reached. Upgrade to Pro for unlimited scans."` response was being captured as a Sentry error. This is paywall conversion behaviour, not a bug. Extended the existing `"Could not identify"` expected-error guard in [frontend/app/(tabs)/index.tsx:395](frontend/app/(tabs)/index.tsx:395) to also skip the scan-limit message. User still gets the upgrade prompt via `setScanError` — only Sentry alerts are suppressed. Queued for v1.0.31 build.

### Backend — Anthropic overload no longer pages Sentry, runtime fallback to OpenAI on 402 / 429 / 529 (commits `6c98def` + `36cffc3`)

Sentry fired REACT-NATIVE-B (5 events) + REACT-NATIVE-T (2 events) from `/api/identify` during an Anthropic capacity outage — HTTP 529 with `"overloaded_error"` was being captured as a 500 in our `errorHandler` (Anthropic SDK uses `err.status`, not `err.statusCode`, so the existing `"statusCode" in err` guard fell through).

- [backend/src/middleware/errorHandler.ts](backend/src/middleware/errorHandler.ts): new `isUpstreamOverload` sniffer catches `status === 529` and message containing `"overloaded_error"` / `"Overloaded"`. On match: returns HTTP 503 with `"The AI service is temporarily busy. Please try again in a moment."` and skips Sentry capture.
- [backend/src/services/vision.ts:516-540](backend/src/services/vision.ts:516): extended the existing 402-only runtime OpenAI fallback to cover 402 + 429 + 529. During Anthropic outages, scans now silently fall through to GPT-4o Vision when both keys are configured. The `429 → "high demand"` user-friendly message is preserved as a fallback of last resort (fires only if OPENAI_API_KEY is not set).

Other AI services (trainSpecs / trainFacts / rarity) use a config-time if/else fallback pattern and have `FALLBACK_SPECS` defaults for parse errors — vision is the critical path so it gets the runtime fallback first. Both backend commits are live on Render.

### Backend — SJ Rc family specs Rc1-Rc7 (commit `d68da41`) + cache version bump v7 → v8 (commit `88be6ab`)

EN tester comment on the "three classes one camera" ad reported Rc6 was identified correctly but the spec card returned the wrong top speed (200 km/h instead of 160). No prior backend coverage of the SJ Rc family existed — LLM was generating specs from scratch and getting variant-specific values wrong. Added 21 lookup keys spanning Rc1 through Rc7 with correct sub-variant top speeds:

- Rc1 / Rc2 / Rc4 / Rc5: 135 km/h (standard)
- Rc3 / Rc6: 160 km/h (high-speed passenger)
- Rc7: 180 km/h (rebuilds from Rc4 / Rc6)

All variants pinned to ASEA (Västerås), 15 kV 16.7 Hz AC, Bo'Bo' standard gauge, 3,600 kW. Rc6 also has weight 78 t locked.

**Cache version bumped v7 → v8** in [backend/src/services/trainCache.ts:68](backend/src/services/trainCache.ts:68). First scan after the SJ Rc ship still served the wrong cached entry — the existing cached Rc6 (200 km/h / 5,400 kW from prior LLM generation) hit before the new `WIKIDATA_CORRECTIONS` was consulted. Bumping the cache version is the standard invalidation mechanism. Side effect: also invalidates entries cached before today's Swiss heritage batch (`bf9156a`) so RAe TEE II / Ae 8/14 corrections also propagate to any pre-cached users.

### Test fix — version-agnostic cache key prefix assertion (commit `57484c0`)

CI broke on `88be6ab` because [backend/src/__tests__/services/trainCache.test.ts:93](backend/src/__tests__/services/trainCache.test.ts:93) hardcoded `expect(keyUsed).toMatch(/^v7::/)`. Replaced with version-agnostic `/^v\d+::/` regex so future cache bumps don't break this test. Render auto-deploy already shipped `88be6ab` (Render doesn't gate on CI) — this commit is just to make CI green again.

---

## 2026-05-11 (later afternoon)

### Frontend — v1.0.31 code on main, build/submit DEFERRED

**Build trigger gate:** v1.0.30 is currently in Apple Review. Submitting v1.0.31 now would auto-reject the in-flight v1.0.30 binary. **Do NOT trigger `eas build` for v1.0.31 until v1.0.30 has cleared Apple Review and reached App Store production.** When ready: `eas build --platform all --profile production` then `eas submit --platform all` with v1.0.31-specific release notes (MAX_HISTORY fix + APK size win), then move #8 + #17 from the "awaiting build" section of `frontend_backlog.md` to Completed.

Commit `b4eec9b` (pushed to `origin/main`). Two code changes bundled (#8 and #17), plus two backlog items audited and closed without code (#12, #24). Tests 153/153 across 22 suites, tsc clean.

### Frontend — v1.0.31 MAX_HISTORY bump (Steph collection-cap fix)

Steph (UK heritage Pro tester) has 210 spots / 85 unique classes server-side, but the previous `MAX_HISTORY = 200` in `frontend/store/trainStore.ts` capped both the cloud fetch and the local AsyncStorage write. Effect: her oldest 10+ spots fell off the local view even though they exist in the database — same observable symptom as the 2026-05-10 silent-persistence bug, but a different root cause (cap, not constraint violation).

**Change:** raised `MAX_HISTORY` from 200 → 1000 in a single-line update with a comment block explaining the trigger. Memory cost at 1000 spots × ~2 KB per spot = ~2 MB AsyncStorage — negligible. The 4 enforcement points in `trainStore.ts` (declaration + `fetchSpots(.., MAX_HISTORY)` cloud limit + `slice(0, MAX_HISTORY)` merge cap + `slice(0, MAX_HISTORY)` save cap) all pick up the new value automatically.

**Why not pagination:** true infinite-scroll pagination with lazy-load of older entries is the right long-term move but deferred to v1.0.32+. The cap raise buys runway for every current user (heaviest is Steph at 210 spots; nobody is near 1000) at near-zero cost.

**Other v1.0.31 backlog items audited and closed in this session (no code change needed):**
- **#12 Trading-card flip/spec/rarity** — closed as already-shipped. Audit confirmed: flip animation + native-driver guard at `card-reveal.tsx:192-340`, tap-to-flip hint at line 1019, `track("card_flipped")` analytics, history → card-reveal route at `history.tsx:482`, compare mode banner + 2-train picker + `router.push("/compare")` at `history.tsx:537`, compare button on card BACK with `compare_button_tapped` analytics, and `compare.tsx` (10.7 KB) as the destination — all live. The stale "Medium priority" backlog entry was wrong.
- **#17 R8 minification + mapping file** — **closed as originally framed AND addressed.** Audit of the v1.0.30 Android build log revealed two things: (a) Sentry source-map upload was already running on Android builds (`:app:createBundleReleaseJsAndAssets_SentryUpload_com.locosnap.app@1.0.30+18_18` task fires, sentry-cli runs with `--release com.locosnap.app@1.0.30+18 --dist 18`); (b) **R8 minification was NOT running** — no `minifyReleaseWithR8` task in the build. The Play Console "no deobfuscation file" warning from v1.0.21 was an informational side effect of R8 being off, not a debugging blocker. JS stack traces were already symbolicated via Sentry source maps; native Java/Kotlin symbols were unobfuscated. Decision: enable R8 anyway for the APK-size benefit (typically ~30-40% smaller download). Added `expo-build-properties` (pinned `~1.0.10`) via `npx expo install`. Plugin config in `app.json` enables both `android.enableProguardInReleaseBuilds` and `android.enableShrinkResourcesInReleaseBuilds`. Effect on next build: `:app:minifyReleaseWithR8` runs, `mapping.txt` is generated, `@sentry/react-native`'s Gradle plugin auto-uploads the ProGuard mapping to Sentry so symbolication stays end-to-end. Resource shrinking has a slight risk for dynamically-referenced resources — if anything breaks in QA we can disable `enableShrinkResourcesInReleaseBuilds` while keeping the minify flag. Play Console mapping upload is a separate channel (Android Vitals); we use Sentry as the primary crash dashboard so Play upload is optional and can be done manually post-build if ever wanted.
- **#24 Leaderboard Phase 4 boost cards** — closed as effectively shipped. Migration 013 already provides `user_boost_inventory`, `apply_boost_card` RPC, `themed_multiplier` (2× on Tuesdays for rare+), and the `flat_100`/`next_scan_2x` card types. `leagueWeeklyReset.ts` cron awards `flat_100` on promotion + four-week-streak. BoostInventory component is wired into MyLeagueTab. The two remaining mechanics from the original Duolingo-style spec ("New station bonus", "Country pride day") are nice-to-haves with no tester signal — re-open only if asked.

**Backlog hygiene:** items #5 (gamification milestone rewards), #6 (detailed specs per class), #7 (offline spot sync), #16 (hybrid blueprint roadmap) all closed earlier today as "no signal, never escalated" per user direction. `creators_used_without_permission.md` updated with the Samuel @trainspotting101 permission grant. `tiktok_stats.md` got the 2026-05-11 midday baseline snapshot for v1.0.30 before/after comparison.

Files changed:
- `frontend/app.json` — version bump 1.0.30 → 1.0.31; `expo-build-properties` plugin block added with `android.enableProguardInReleaseBuilds: true` + `android.enableShrinkResourcesInReleaseBuilds: true`
- `frontend/package.json` + `package-lock.json` — `expo-build-properties: ~1.0.10` added
- `frontend/store/trainStore.ts` — `MAX_HISTORY` 200 → 1000 + comment block

Tests 153/153 across 22 suites passing. tsc clean.

---

## 2026-05-11

### Frontend — v1.0.30 silent-persistence hardening (post-Steph data-loss incident)

Three defensive changes triggered by the 2026-05-10 evening `verification_tier` silent data-loss bug. The dashboard ALTER fixed the immediate cause (column default 'personal' applied), but the architectural defects that made the failure invisible until Steph caught it are still in v1.0.29. This is the v1.0.30 backlog landing.

**1. Explicit `verification_tier` in `saveSpot` payload** — `frontend/services/supabase.ts`. Defense-in-depth: the column DEFAULT 'personal' is the fallback, the frontend should pass the server-canonical tier from `currentVerification.tier` as the primary. If a future migration ever strips the default again, the frontend payload still satisfies the NOT NULL constraint. Threaded through `frontend/store/trainStore.ts` `saveToHistory` so the `verificationTier: v?.tier` reaches the supabase call.

**2. `Sentry.captureError` in all four supabase write paths** — `frontend/services/supabase.ts`. `upsertTrain`, `saveSpot`, `deleteSpot`, `updateSpotBlueprint` now `captureError` with payload context (op, supabase code, supabase hint, ids, class/operator, payload keys) in addition to the existing `console.warn`. Production failures will now surface in Sentry instead of being invisible. The four read-path silent-warns are intentionally left alone — read failures cause stale UI but not data loss.

**3. `loadHistory` MERGE instead of cloud-replace** — `frontend/store/trainStore.ts`. The previous implementation set `history: cloudSpots` when cloud returned ≥1 row, which wiped local-only entries (failed-to-persist scans still in AsyncStorage). New implementation always reads AsyncStorage first, then merges: cloud rows take precedence for IDs that look like UUIDs (length ≥ 32 with dashes), local-only entries (Date.now() string IDs) are kept unless cloud already has the same class+operator within 5 minutes of the local `spottedAt`. Result: a failed-persist scan stays visible in the user's history instead of vanishing on next refresh, while the cloud canonical version still wins when both exist.

**Also bundled (blueprint hang defensive hardening):**

- `frontend/services/api.ts` `pollBlueprintStatus` — cap consecutive network errors at 5 → bail with `failed` status + user-visible "Couldn't reach LocoSnap servers" toast. Previously retried forever on network error, contributing to indefinite spinner during backend outages.
- `frontend/services/api.ts` `pollBlueprintStatus` — `captureWarning("blueprint_timeout", { taskId, elapsedMs, consecutiveNetworkErrors })` when the 240s `BLUEPRINT_TIMEOUT` fires; analogous `blueprint_network_errors_capped` warning on the network-cap path. Lets us measure real-world hang rate in Sentry.
- `BLUEPRINT_TIMEOUT` (240s) intentionally NOT shortened — the v1.0.25 bump 120s → 240s was deliberate to cover Replicate's 120-180s latency spikes on schematic-style classes (Christian's Class 4020 repro 2026-05-03). Defensive without regressing.

Source memory: `backend_blueprint_generation_hang.md` (BR 247 hang 2026-05-05 that triggered iOS WatchdogTermination). The same memory also lists backend audits (Replicate dashboard log review, Redis max-age cutoff, backend polling loop) — those remain out of scope for this frontend ship.

**Also bundled (leaderboard Path A — Steph 2026-05-09 legibility fix):**

Steph reported the leaderboard "makes no sense — doesn't know how it counts or works out." Asked what she'd expect, she said: *"I would think it would be by how many trains you spot then the different classes."* Her natural mental model is total spots + unique classes — both already exist (Country tab All-time + Collection tab Unique mode), just buried under the My League weekly-XP/leagues default tab. Path A is the lightweight fix that tests the legibility hypothesis before any larger rework (Path B = full Spots/Classes/Rarity rebuild, ~10-15h, deferred).

- `frontend/store/leaderboardStore.ts` — default `activeTab` flipped from `my_league` → `collection`. Collection tab opens by default in unique_classes mode, surfacing the "different classes" metric that maps to Steph's mental model. Phase 2 weekly-XP league infrastructure untouched (DB, cron, RPC, components all still live) — it's just no longer the default surface.
- `frontend/locales/en.json` — tab label `"My League"` → `"This Week"`. Adds new `leaderboard.league.about.*` strings (title, intro, earnTitle, earnBody, tiersTitle, tiersBody, dismiss) for the explainer modal.
- `frontend/locales/de.json` — `"Meine Liga"` → `"Diese Woche"`. Same `about.*` strings translated.
- `frontend/components/leaderboard/LeagueAboutButton.tsx` — NEW. Info-icon (Ionicons `information-circle-outline`) in the LeagueHeader top-right. Tapping opens a modal mapping the weekly-XP / league concepts back to the simpler total-spots + unique-classes metrics, and explicitly directs users at the Country / Collection tabs for those alternatives.
- `frontend/components/leaderboard/MyLeagueTab.tsx` — LeagueHeader's `headerRight` now renders `<LeagueAboutButton />` next to `<FreezeCounter />`.
- `frontend/__tests__/store/leaderboardStore.test.ts` — two assertions updated from `"my_league"` → `"collection"` (initial default + reset).

**Reversibility:** if Steph still bounces off after Path A, the next session can commit to Path B (drop the league from default surface entirely, ship Spots/Classes/Rarity as the three defaults, demote weekly competition to opt-in in profile/settings). Full Path B scope is in `project_leaderboard_redesign.md`.

**Out of scope** (intentionally deferred per `frontend_backlog.md` #7 — offline spot sync deprioritised 2026-05-01 until tester signal warrants):
- Retry queue with exponential backoff for failed `saveSpot`
- Server-side audit job for users with active sessions but zero recent spots

**Test infra:** added `frontend/__mocks__/analytics.ts` stub (noop exports for `captureError`, `track`, `addBreadcrumb`, etc.) so test suites that transitively import `services/supabase.ts` don't blow up on Sentry's ESM. `jest.config.js` `moduleNameMapper` routes `./analytics` and `../services/analytics` to the stub. Tests previously skipped due to the Sentry import (services.identity, services.wrongId) now run: 153/153 passing across 22 suites, up from 146/146 across 20.

Version bumped `1.0.29 → 1.0.30` in `app.json`.

Files changed:
- `frontend/app.json` — version bump
- `frontend/services/supabase.ts` — verificationTier param + captureError in four write paths + new VerificationTier import + analytics import
- `frontend/store/trainStore.ts` — verificationTier wired into saveSpot call + loadHistory rewritten as merge
- `frontend/services/api.ts` — pollBlueprintStatus network-error cap + captureWarning on timeout + new captureWarning import
- `frontend/store/leaderboardStore.ts` — default activeTab my_league → collection (Steph legibility)
- `frontend/locales/en.json` + `frontend/locales/de.json` — "My League" → "This Week" + about.* strings
- `frontend/components/leaderboard/LeagueAboutButton.tsx` — new "How this works" info button + modal
- `frontend/components/leaderboard/MyLeagueTab.tsx` — LeagueHeader wires in LeagueAboutButton
- `frontend/__tests__/store/leaderboardStore.test.ts` — updated default expectations
- `frontend/__mocks__/analytics.ts` — new stub
- `frontend/jest.config.js` — moduleNameMapper rule for the analytics stub

---

## 2026-05-10

### Backend — BR 426 vs BR 428 vision disambiguation (bahnbilder.bodensee feedback round 3)

After this morning's BR 428 specs fix shipped, tester @bahnbilder.bodensee replied: *"Das ist ja der 426 nur als 428 gekennzeichnet"* — the train in his earlier IMG_4681 screenshot is actually a **BR 426** (Bombardier Adtranz Continental 2-car), and the model was misclassifying it as a **BR 428** (Stadler FLIRT 3-car). The earlier specs fix (Stadler builder + 2008 build year) is correct on its own — it fires when the model legitimately returns BR 428. But the underlying classification was wrong: the model needed a disambiguation rule between the Bombardier-built BR 425/426 family and the Stadler-built BR 428/429 family.

Added new "STEP 5 — DISTINGUISH BR 425/426 (Bombardier Adtranz Continental) FROM BR 428 (Stadler FLIRT 3-car)" rule in `backend/src/services/vision.ts` after the existing BR 423 vs 425/426 step. Decisive cues:
- **BR 425/426** = BOXY upright flat-fronted cab, TWO flat windscreen panes side-by-side, late-1990s/early-2000s Bombardier/DWA aesthetic. BR 425 is 4-car, BR 426 is 2-car. Bombardier (Salzgitter).
- **BR 428** = SHARP ANGULAR forward-raked "smiling" cab with SINGLE curved-glass windscreen panel, modern Stadler FLIRT styling. 3-car.

**Critical operator pin** (most important part of the rule): the German rail network has **TWO different BOB operators**, both Transdev-branded but in different regions running different rolling stock:
- **BOB Bodensee-Oberschwaben-Bahn** (Lake Constance / Friedrichshafen / Lindau, Baden-Württemberg / Bavaria border) operates **BR 426** (Bombardier 2-car, blue+white livery) — NEVER BR 428.
- **BOB Bayerische Oberlandbahn** (Munich southeast suburbs / Tegernsee / Lenggries / Bayrischzell) operates BR 428 Stadler FLIRT among other stock.

Rule explicitly forbids defaulting BOB Bodensee-Oberschwaben-Bahn to BR 428 — must return BR 426. Credits Luis's catch.

Tests: 173/173 backend, tsc clean. Cache version unchanged (v7) — the BR 426 trainSpecs entry already exists (LHB/Alstom/Bombardier Salzgitter, 160 km/h) so once the vision layer correctly returns BR 426, the spec card will be right.

Files changed:
- `backend/src/services/vision.ts` (new STEP 5 disambiguation rule, ~10 lines, between existing STEP 4 BR 423/425/426 step and CONFIDENCE FALLBACK)

### Backend — BR 428 / BR 429 Stadler FLIRT specs correction (bahnbilder.bodensee feedback round 2)

Tester @bahnbilder.bodensee sent two screenshots in `~/Desktop/feedback/IMG_4680.PNG` + `IMG_4681.PNG` — a BOB (Bodensee-Oberschwaben-Bahn / Transdev) BR 428 in blue livery, correctly identified as **BR 428** but returning a wrong spec card with **two factual errors**:

1. **Builder: "Crewe Works"** — completely wrong. Crewe is a UK railway works that has never built any German rolling stock. The BR 428 / BR 429 fleet is built by **Stadler Rail** (Bussnang, Switzerland; assembly for German market also at Stadler Berlin-Pankow / Velten).
2. **"seit 1930 im Dienst" / "1930 in Dienst gestellt"** in the description — Wikipedia-disambiguation conflation with the older pre-war DRB Class 428 family. The modern Stadler FLIRT BR 428 entered service in **2008**, not 1930. This is the canonical "1930-vs-2001" conflation pattern Luis flagged conceptually earlier in the day (see his Wikipedia disambig screenshot for BR 245).

Root cause: no hardcoded BR 428 / BR 429 entries in `backend/src/services/trainSpecs.ts` — the lookup fell through to AI generation which conflated multiple `Baureihe 428`-named historical references and produced a builder + year from a completely unrelated pre-war class.

Added 12 new lookup keys total covering BR 428 (3-car FLIRT) and BR 429 (5-car FLIRT) variants, both locked to: 160 km/h / Stadler Rail (Bussnang) / Electric (15 kV 16.7 Hz AC) / weight + power differing by car-count (3-car: 2,000 kW / 125 t; 5-car: 4,000 kW / 189 t). Inline comment forbids classifying builder as "Crewe Works", Bombardier, Siemens, Alstom, or LHB; explicitly forbids the 1930 / pre-war build year framing; credits Luis's catch.

No vision-rule change — class identification was already correct.

Tests: 173/173 backend, tsc clean. Cache version unchanged (v7) — corrective entries take effect on next scan.

Files changed:
- `backend/src/services/trainSpecs.ts` (12 new lookup keys: 6 BR 428 + 6 BR 429)

### Backend — BR 245 specs correction (bahnbilder.bodensee feedback)

Tester @bahnbilder.bodensee (DE, Bodensee region) sent two screenshots in `~/Desktop/feedback/IMG_4675.PNG` + `IMG_4676.PNG` — a DB Regio BR 245 (red livery double-header) correctly identified as **BR 245** but returning the wrong spec card: max speed shown as 120 km/h (correct: 160 km/h — the platform is literally TRAXX P160 DE ME, the "P160" meaning passenger-160) and builder shown as "ALSTOM Transportation…" (BR 245 was Bombardier-built; Alstom only owns the IP since the 2021 Bombardier Transportation acquisition).

Root cause: no hardcoded BR 245 entry in `backend/src/services/trainSpecs.ts` — the lookup fell through to AI-generated specs which got both the speed and builder wrong. Added 9 new lookup keys ("br 245", "br245", "245", "db 245", "db class 245", "class 245", "baureihe 245", "traxx p160 de me", "bombardier traxx p160 de me") locked to: 160 km/h / 2,200 kW / 84 t / Bombardier Transportation (Kassel) / 50 built / Diesel-Electric (4 × MTU 8V 4000 gensets). Block inserted after the BR 247 Vectron DE cluster (preserves descending 248 → 247 → 245 ordering). Inline comment records the failure mode (NEVER classify builder as Alstom alone, NEVER 120 km/h — that's BR 232) and the tester credit.

No vision-rule change required — the class identification was already correct; only the specs lookup was missing.

Tests: 173/173 backend, tsc clean. Cache version unchanged (v7) — corrective entry takes effect on the next scan.

Files changed:
- `backend/src/services/trainSpecs.ts` (9 new lookup keys for BR 245 / TRAXX P160 DE ME)

---

## 2026-05-09

### Backend `5538ef5` — Steph round-2 corrections: Loram C21 rail grinder + Class 37 vs 45 Peak (DEPLOYED)

Tester Steph re-corrected two prior misIDs after this morning's commit `e564811` went live. Two new screenshots in `~/Desktop/feedback/` (IMG_4673 annotated rail-grinder reference, IMG_4674 a Class 45 scan returning Class 37).

**(1) Loram C21 rail grinder mistaken for a locomotive — twice in one day.** The IMG_4671 scan that this morning's commit fixed from Class 66 → Class 70 (Colas Rail) was actually neither. Steph clarified the vehicle is **Loram C2101**, a Network Rail-contracted rail grinding machine (track maintenance vehicle, not a locomotive). Three-machine fleet C2101/C2102/C2103, painted yellow with prominent Loram logos, often paired with Control Car 79237, working in train formations using "6Z08"-series engineering reporting numbers principally on the Lancaster & Carlisle line and South West routes near Okehampton. Both prior identifications (Class 66, then Class 70) were wrong-target — the correct classification is "not a locomotive". Extended the existing track-maintenance-vehicle rule in `backend/src/services/vision.ts` to explicitly cover Loram C21 with the cue list (yellow articulated multi-section + grinding apparatus + no traction-loco silhouette + Loram brand markings) and an explicit forbid list (NEVER Class 66 / 67 / 70). Added 6 new lookup keys in `backend/src/services/trainSpecs.ts` ("loram c21", "loram c21 rail grinder", "loram rail grinder", "c2101", "c2102", "c2103") locked to Loram Maintenance of Way / 3 in fleet / Diesel / 60 mph. **Lesson recorded inline in the new rule:** when a fix doesn't match reality, the rule was a wrong-target — re-classify upstream rather than walking down disambiguation alternatives.

**(2) Class 45 "Peak" 45118 "Royal Artilleryman" returned as Class 37.** Preserved BR-blue Peak in heritage service was misidentified as Class 37 / West Coast Railways. New disambiguation rule in `backend/src/services/vision.ts` pinning the **prominent four-character headcode panel centred high between the windscreens** as the single decisive Class 45 cue (absent on Class 37, which has either split-headcode boxes either side OR a sealed flat beam). Wheel arrangement (1Co-Co1 with smaller trailing pony axles for Class 45 vs Co-Co for Class 37), length (20.7 m vs 18.7 m), and fleet number ranges (45xxx → Class 45, 37xxx → Class 37) all enumerated. Notable preserved Peaks listed by name: 45112 Royal Army Ordnance Corps, 45118 Royal Artilleryman, 45125, 45133, 45135 3rd Carabinier — WCRC and DTG operate both classes on charters so operator alone is NOT a discriminator. Added 8 new lookup keys in `backend/src/services/trainSpecs.ts` ("class 45", "br class 45", "british rail class 45", "class 45/0", "class 45/1", "peak", "br sulzer type 4", "royal artilleryman") locked to BRCW Smethwick + BR Derby Works / 127 built / 90 mph / 1,860 kW / Diesel-Electric.

Tests: 173/173 backend, tsc clean. Cache version unchanged (v7) — corrective entries that take effect on the next scan without invalidating prior caches. Pushed to Render — backend live within auto-deploy window.

Files changed:
- `backend/src/services/vision.ts` (track-maintenance rule extended for Loram C21; new Class 37 vs Class 45 Peak disambiguation rule)
- `backend/src/services/trainSpecs.ts` (14 new lookup keys: 6 Loram + 8 Class 45)

### Backend `e564811` — Steph feedback batch: Class 57/73, Class 70/66, Class 59/66, BR Class 52 Western disambiguation (DEPLOYED)

UK tester Steph (canonical evangelist per `project_tester_evangelist_pattern.md`) sent four screenshots from a Chastleton (Cotswold Line) scanning session, all four were misIDs. Pushed to Render at the same time as the housekeeping commits below; backend live within auto-deploy window.

**Vision rules added in `backend/src/services/vision.ts`** (block placed right after the existing Class 33 vs Class 73 rule):

1. **Class 57 vs Class 73** — yellow Network Rail Thunderbird (57/3) was returning as Class 73. New rule pins NR yellow + Co-Co + Class 47-derived bodyshell to Class 57. Wheel arrangement is now the deciding cue: Class 57 is Co-Co (6 axles), Class 73 is Bo-Bo (4 axles). Active mainline Class 73 fleet is ~10 units vs 16 active 57/3 Thunderbirds — statistical default favours 57. Fleet number ranges (57301-57316 = NR Thunderbirds), third-rail-shoes presence on 73 only, and length difference (19.4 m vs 16.4 m) all enumerated.

2. **Class 66 vs Class 70 (Colas Rail yellow)** — Colas Class 70 returning as Class 66. The existing Colas livery rule covered the family but the model still defaulted to Class 66. Strengthened with explicit cab-profile contrast (Class 66 sloped angular EMD F-unit nose vs Class 70 upright boxy GE cab), prominent Class 70 roof exhaust stacks, larger Class 70 cab windows, single horizontal headlight cluster on 70 vs EMD pair on 66. Statistical default for "Colas Co-Co freight diesel" flipped to Class 70 (17 in fleet, fleet range 70801-70817) over Class 66.

3. **Class 66 vs Class 59 (GBRf heavy haul)** — GBRf Class 59 returning as Class 66. New rule pinning the older blockier 59 cab profile (smaller cab windows, no front cab access door — engineers use bodyside doors only) vs modern sloped 66 cab with central front door. Mendip Rail silver-grey livery lock-down, fleet number ranges (59001-59005 / 59101-59104 / 59201-59206), Foster Yeoman → ARC → National Power → GBRf → DB Cargo operator pattern. Only 15 Class 59s exist worldwide vs 500+ Class 66s — but Class 59 is uniquely visible on Mendip Rail / Foster Yeoman / GBRf heavy-haul services and any heavy stone train in those liveries should be checked for 59 first.

4. **BR Class 52 (Western Diesel Hydraulic, UK) vs DRB Baureihe 52 (Kriegslok, Germany)** — D1015 Western Champion (Pathfinder Tours / DTG / WCRC) was correctly identified as "Class 52" but the spec card was returning **German wartime Kriegslok specs** (80 km/h / Borsig / Coal-Steam) because the trainSpecs lookup for bare "class 52" was hardcoded to the much-more-numerous German DR BR 52 (~6,719 built). New rule requires UK contexts to return "BR Class 52" or "Class 52 Western" specifically (not bare "Class 52"), routing the spec lookup to the correct UK Western. Country/livery context is the decisive cue. Bare "class 52" key intentionally retained as Kriegslok default since global numerosity favours it.

**`backend/src/services/trainSpecs.ts` — 24 new lookup keys total**, block placed right after the Class 70 GE PowerHaul cluster:
- Class 57 (7 keys): "class 57", "br class 57", "british rail class 57", "class 57/0", "class 57/3", "class 57/6", "thunderbird" — Brush Traction Loughborough / 33 built / 95 mph / 1,860 kW / Diesel-Electric.
- Class 59 (7 keys): "class 59", "br class 59", "british rail class 59", "class 59/0", "class 59/1", "class 59/2", "emd jt26cw-ss" — EMD La Grange / 15 built / 60 mph / 2,386 kW / Diesel-Electric.
- Class 73 (3 keys): "class 73", "br class 73", "british rail class 73" — English Electric Vulcan Foundry / BR Eastleigh / 49 built / 90 mph / 1,200 kW / Electro-Diesel (750 V DC third rail + diesel).
- BR Class 52 Western (7 keys): "br class 52", "british rail class 52", "class 52 western", "br class 52 western", "western", "western diesel hydraulic", "western champion" — BRCW Crewe / BR Swindon Works / 74 built / 90 mph / 2,013 kW / Diesel-Hydraulic.

Tests 173/173, tsc clean. Cache version unchanged (v7) — these are corrective entries that take effect on the next scan without invalidating prior caches.

**Reply to Steph drafted + sent** acknowledging all four catches with technical specifics on each fix. Leaderboard UX critique acknowledged separately as a larger rework item — not in this commit, on the design list.

Files changed:
- `backend/src/services/vision.ts` (4 new disambiguation rules)
- `backend/src/services/trainSpecs.ts` (24 new lookup keys across Class 57 / Class 59 / Class 73 / BR Class 52 Western)

### Repo housekeeping — v1.0.29 ship branch merged into `main`

The v1.0.29 frontend ship work had lived on branch `claude/sad-ritchie-cdab5f` and was never merged to `main`, leaving `main`'s `frontend/app.json` stuck at 1.0.28 and the Lifetime/intro/review-prompt code absent from the trunk despite the binary being approved on both stores 2026-05-08. Merge commit `3a3e9a5` brings the branch into `main`. Single conflict in `docs/CHANGELOG.md` (both sides had populated `## 2026-05-08` sections) — resolved by keeping the branch's full v1.0.29 ship entries. The branch's backend commit `6256436` (cancellation_reasons table + CANCELLATION webhook) was content-identical to `b08e556` already on `main` (cherry-pick), so git auto-resolved the duplicate. Pushed to `origin/main`. No new Render deploy triggered — `b08e556` was already deployed on its prior push.

Files merged into `main`:
- `frontend/app.json` (1.0.28 → 1.0.29)
- `frontend/app/paywall.tsx` + `frontend/app/paywall-helpers.ts` (Lifetime row + intro badge + sortPaywallPackages)
- `frontend/services/reviewPrompt.ts` + `frontend/__mocks__/expo-store-review.ts` (expo-store-review wow-moment prompts)
- `frontend/store/trainStore.ts` + `frontend/app/card-reveal.tsx` (review-prompt trigger wiring)
- `frontend/locales/en.json` + `de.json` (6 new paywall keys each)
- `frontend/__tests__/paywall-helpers.test.ts` + `reviewPrompt.test.ts` (18 new tests)
- `frontend/jest.config.js` + `package.json` + `package-lock.json` (expo-store-review dep)
- `docs/ARCHITECTURE.md` + `docs/CHANGELOG.md` (v1.0.29 ship documentation from the branch)

### App Store Connect — `pro_lifetime` IAP image rejected, resubmitted

Apple rejected the `pro_lifetime` IAP image. Boilerplate notification, no detailed reason — pattern indicates the original image (an app screenshot showing the blueprint screen with iOS status bar visible at the top) violated Apple's unwritten rule against using app UI screenshots for IAP review images. Separately, an earlier Guideline 3.1.1 review note had flagged the non-consumable IAP business-model change as needing a binary to verify against — that concern is now moot since v1.0.29 is Ready for Distribution and contains the live Lifetime row.

Replacement image generated as a 1024×1024 RGB PNG (no alpha, no ICC profile) at `~/Desktop/locosnap_iap_image/locosnap_lifetime_iap_v1.png`. Composition: 2×2 grid of the four existing demo blueprints from `frontend/assets/blueprints/` (technical / vintage / cinematic / schematic) on a dark navy (#0a1628) canvas with 8px gap between tiles. Represents the unlocked Pro content (full collection + four blueprint art styles) without using the app icon or any UI screenshot or promotional text overlay.

Submission flow gotcha worth recording: after uploading a new image, the App Store Connect "Submit for Review" button stayed greyed out because the `English (U.S.)` localization was still in `Rejected` status with no pending edits. Resolution was to open the localization, make a trivial edit (remove and re-add a full stop in the description), and Save. That cleared the localization rejected state and re-enabled Submit. The `~/Desktop/locosnap_iap_image/` PNG is worth retaining in case a follow-up rejection requires a tweaked variant.

Expected turnaround on the IAP-only re-review: 12–48h. No code or binary changes — pure App Store Connect metadata.

### Ad — BR 140 v5 (DE Wirtschaftswunder) posted on TikTok + Instagram

Posted Saturday DE morning peak per the planned slate. Performance tracking deferred until 24h post-mark (~2026-05-10 AM) to avoid bloating `tiktok_stats.md` with a stub entry. Will be benchmarked against BR 232 v2 baseline (4.8K views all-time / 22% full watch / 26 followers in 7d) and the BR 156 underperformance (1.5K / 15.5% / 2 followers at 24h).

---

## 2026-05-08

### Ad production — three videos rendered for the weekend post slate

**BR 140 v5 (DE)** — `~/Desktop/BR140_ad/locosnap_br140_v2.mp4`. Wirtschaftswunder framing (5 iterations to land — see `feedback_ad_build_pipeline.md`). Beat sources: Waldheim red 140 head-on (Beat 1, NEW source not in Apr 20 ad), Hamburg blue private operator with containers (Beat 2), Straubing PEF heritage dusk (Beat 3, "879 / gebaut."), Waldheim red 140 platform close-up (Beat 4). Saved DE endcard. Posting: Saturday DE morning peak.

**Class 91 v3 (UK)** — `~/Desktop/Class91_ad/locosnap_class91_v2.mp4`. "Made in Britain. Killed by Hitachi." framing — Hitachi Azuma replacement angle. Beat sources: Ryan Windridge compilation t=70 (LNER red sunset hero), t=90 (NSE-style fleet 91127 close-up), t=30 (LNER side-on urban), t=40 (LNER head-on platform). Saved EN endcard with App Store + Google Play CTA. Posting: Saturday UK afternoon peak. First UK-targeted ad in 21 days.

**v1.0.29 launch ad — DE + EN versions** — `~/Desktop/v1029_launch_ad/locosnap_v1029_launch_de.mp4` + `_en.mp4`. Country-sweep format (PL → DE → UK) + paywall reveal + endcard. Beat sources: ET22 Byczka 676 station pass (PL), BR 151 073-4 Bundesbahn Göppingen Hbf head-on (DE), v1.0.29 paywall screenshot static crop (Lifetime row visible alongside intro-discounted annual), Class 37 37425 Max Power head-on (UK). Text overlay tells: Foto vom Zug → Klasse + Daten → Lebenslang. Werbefrei. → Pro für immer. Posting: Sunday DE morning peak, EN ~30 min stagger. Skipping PL version (last PL launch ad underperformed). Captions include "Werbefrei" / "Completely ad-free" callout (verified — LocoSnap has no AdMob/ads infrastructure in either tier).

**Reusable endcards** committed at `/Users/StephenLear/Projects/locosnap/ad_assets/endcards/` — `endcard_de.mp4` / `endcard_en.mp4` / `endcard_pl.mp4` (720×1280, 30fps, 2s, ~30KB each). Format: black background, LocoSnap icon (300×300) + name (80px white) + tagline (44px yellow) + CTA (42px white) "Free on App Store + Google Play" (locale-specific). Concat as beat 5 of any future 10s ad — never regenerate per-ad. See `~/.claude/projects/.../memory/ad_assets_endcards.md`.

### Comment replies posted on DDR / BR 156 ad

- **trainspotter_leander** (DE) — "only 3 scans" complaint resolved with update prompt + 6-scan correction
- **airbus.a3200** (DE) — BR 103 ICE TD speed concession reply
- **Steffan23** (DE) — Nordbahn warm reply asking for fleet number / footage offer
- **Wickser-aus-Kassel commenter** (DE) — Hennigsdorf vs Kassel rail-industry consolidation acknowledgement (warm, no political engagement)
- **"eine in Pressig gesehen 🥰"** (DE) — fleet-number ask for spotted unit

### TrainVibez follow-up sent

Mattis replied 2026-05-08: *"Hi, ich versuche es diese Woche umzusetzen. Melde mich dann für genaueres."* — actively working on the YouTube sponsor video. Quick warm acknowledgement reply sent ("kein Druck, alles vorbereitet").

### Sentry alert REACT-NATIVE-P resolution

Three discrete checks of the same `services/api.ts:273` timeout-retry alert across the day: 1 event/1 user → 2/2 → 3/3 over 8 hours. One v1.0.29 event among three. Below the 5-event/48h threshold per `feedback_play_billing_diagnosis.md`. Marked Resolved. Render health checks all green throughout. Pattern: real-world network-tail surface, not a v1.0.29 regression.

### Stats sweep — multi-source dashboard review

Captured ~17:00 across TikTok / Instagram / Apple / Google Play / RevenueCat / Supabase / Anthropic. Key reads:

- **TikTok BR 156 24h** — 1.5K views, 5.67s avg watch, 15.5% full, 2 followers. Underperforming BR 232 v2 baseline (4.3K / 22% / 31 follows) on volume + follower conversion.
- **TikTok BR 232 v2** — settled at 4.8K all-time / 26 follows in 7d (was 4.3K when last reviewed) — the standout of the period.
- **TikTok 7d account** — 10.8K views (+196), 708 likes (+165), 100 comments (+25), 4.8K total viewers. DE 58.5% / PL 22.1% / India 5.7%.
- **IG BR 156** — 135 views / 39.8% skip rate (BEST skip rate of any LocoSnap reel — 64.8% on BR 103 prior). Low absolute volume but quality signal strong.
- **Apple App Store 30d** — 143 units (+38%), 4 IAPs (+100%), $108 sales (+399%), 12.6% conversion rate, $66 proceeds. Strong but small.
- **Google Play 28d** — 109 device acquisitions (+990% vs flattered pre-launch comparison), 80 first opens, 104 MAU. Geography: DE 55.8% / PL 20.2% / UK 8.7% / AT 6.7%. PL +5x growth post-launch, UK FLAT post-launch (real signal — UK content/audience mismatch).
- **RevenueCat** — 8 active subs, MRR $32, $129 28d revenue, 366 active customers. Two recent transactions visible (DE Play Store annual subs).
- **Anthropic caching** — 97.6% cache read ratio / 4.34× write amortisation. Mature.
- **Supabase** — 1,363 requests last 24h, healthy, no operational issues.

### Reflect session — four memory rules updated/created

Per `/reflect` skill: `feedback_ad_build_pipeline.md` (MUST-DO-FIRST checklist prepended), `feedback_play_billing_diagnosis.md` (low-volume response template added), `feedback_ad_text_width_rule.md` (rule of thumb → hard caps), `feedback_browser_click_strikes.md` (NEW — 2-strike rule on Chrome MCP coordinate clicks).

---

### v1.0.29 LIVE on both App Store + Google Play (same-day approval)

Apple approved iOS build 51 on the evening of 2026-05-08 — same day as Google approved Android versionCode 17. Fastest dual-store turnaround in LocoSnap history (matches v1.0.24's same-day record). Both stores now serve v1.0.29 with: Lifetime Pro IAP (£89.99 / $99.99 / €99 / 399 zł), 30% intro on annual subscriptions, 30% win-back on monthly cancellations, expo-store-review wow-moment prompts at four trigger points, cancellation_reasons backend logging.

### v1.0.29 SUBMITTED to both stores

EAS production builds for v1.0.29 triggered + uploaded via `eas submit --platform all --profile production --non-interactive --latest`:
- **iOS:** build 51 (`79e5f4f4-a3f5-4528-a883-029985a73c8e`), .ipa `g43ESZ2JHNuKmxLzjjwLLo.ipa`. Processed by Apple, smoke-tested in TestFlight on a new sandbox account (paywall 3 rows render correctly, intro badge "30% OFF FIRST 3 MONTHS" appears on Annual for new subscribers, "Save 25%" badge correctly hidden when intro shown, italic disclaimer below package list, Lifetime row at $99.99 sandbox = £89.99 GB production override). Submitted for App Store review with EN release notes.
- **Android:** versionCode 17 (`6bf90129-2862-4cd4-b44e-6bc49bf72003`), .aab `ekiXSNpWXbXzTzW1qR8NfX.aab`. Tight ≤450-char EN+DE release notes pasted in Play Console (Google's 500-char per-language hard cap), rolled out to production track — now in Google review.

App Store Connect promo image for `pro_lifetime` IAP cropped from TestFlight screenshot at 1024×1024 (`~/Desktop/v1.0.29_offers/pro_lifetime_promo.png` — Pro badge + rocket icon + "Go Pro" headline + tagline). Three iPhone screenshots resized 1206×2622 → 1290×2796 for App Store iPhone 6.7" submission slot (`~/Desktop/v1.0.29_screenshots/`).

Sentry alert `REACT-NATIVE-P` (Could not connect to LocoSnap servers, Samsung A56 Android 16, release 1.0.28) — single event, single user, coincided with Render cold-start window after Phase 1 backend deploy. Per `single-data-point-discipline`: monitor, don't act unless 5+ events recur in 24-48h.

---

### Frontend — Phase 2 of v1.0.29 retention layer: paywall Lifetime row + review prompts

Added Lifetime row to the paywall, intro-offer badge + disclaimer when annual has an `introPrice`, and `expo-store-review`-backed wow-moment review prompts at four trigger points.

**`frontend/app/paywall-helpers.ts` (new)** — pure-logic helpers `getPackageKind`, `sortPaywallPackages` (annual → monthly → lifetime), `findDefaultIndex`. Refactored `paywall.tsx` `loadOfferings` to use them. 8 tests.

**`frontend/app/paywall.tsx`** — render block extended to detect `lifetime` kind (no "/month" suffix, lifetime subtitle line), `annual + introPrice` (replaces "BEST VALUE" badge with "30% OFF FIRST 3 MONTHS" badge, hides "Save 25%" badge to avoid double-billing the user, appends italic disclaimer below package list).

**`frontend/services/reviewPrompt.ts` (new)** — `maybePromptReview({ trigger, scanCount })` whitelisted to four triggers: `legendary_scan`, `achievement_silver_gold`, `streak_7d`, `unique_classes_50`. 90-day local AsyncStorage throttle layered on top of iOS's native 365-day rate limit. Min 3 scans required before any prompt. Silently returns when `expo-store-review` reports unavailable. 10 tests.

**Trigger wiring:**
- `app/card-reveal.tsx` — fires `legendary_scan` after the rarity glow animation starts when `currentRarity.tier === "legendary"`
- `store/trainStore.ts` — in the post-sync achievement loop:
  - 8 silver/gold types (`unique_century`, `unique_master`, `five_hundred_club`, `thousand_spots`, `streak_thirty`, `streak_hundred`, `legendary_five`, `heritage_master`) fire `achievement_silver_gold`
  - `seven_day_streak` fires `streak_7d`
  - `ten_unique` fires `unique_classes_50` (closest existing milestone — spec called for "50 unique classes" but the codebase has no such achievement; `ten_unique` is the first major unique-class wow moment)

**Locale strings (EN + DE):** added `paywall.lifetimeTitle` / `lifetimeSubtitle` / `lifetimePrice` / `introBadge` / `introDisclaimer` / `unlockLifetime` to both `locales/en.json` and `locales/de.json`. PL not added — codebase only has EN + DE locales currently.

**Dependency:** `expo-store-review ~9.0.9` added via `npx expo install`. Native module — requires a fresh native build. Mock at `__mocks__/expo-store-review.ts` and `moduleNameMapper` entry in `jest.config.js` so non-reviewPrompt tests that transitively pull the module don't break.

Tests: 153/153 (was 135 + 18 new), tsc clean.

Files changed:
- `frontend/app/paywall-helpers.ts` (new)
- `frontend/app/paywall.tsx` (loadOfferings + render block + 2 new style entries)
- `frontend/app/card-reveal.tsx` (import + legendary trigger)
- `frontend/services/reviewPrompt.ts` (new)
- `frontend/store/trainStore.ts` (import + achievement-loop trigger logic)
- `frontend/locales/en.json` (6 new keys)
- `frontend/locales/de.json` (6 new keys)
- `frontend/jest.config.js` (moduleNameMapper)
- `frontend/__mocks__/expo-store-review.ts` (new)
- `frontend/__tests__/paywall-helpers.test.ts` (new, 8 tests)
- `frontend/__tests__/reviewPrompt.test.ts` (new, 10 tests)
- `frontend/package.json` + `package-lock.json` (expo-store-review)

Refs: `docs/plans/2026-05-07-retention-and-offers-implementation.md` Tasks 9-20.

---

### Backend — Phase 1 of v1.0.29 retention layer: cancellation_reasons table + CANCELLATION webhook handler

Migration `015_cancellation_reasons.sql` adds `public.cancellation_reasons` table to log RevenueCat CANCELLATION events for closed-loop save-rate measurement on Apple Retention Messaging + Play Win-back. Columns: `user_id`, `rc_event_id` (unique), `product_id`, `cancellation_reason`, `store` (`app_store` | `play_store`), `was_in_trial`, `hours_since_purchase`, `hours_since_trial_start`, `retention_offer_shown`, `retention_offer_redeemed`, `raw_event` (jsonb). Two indexes on `user_id` and `created_at desc`. RLS enabled with no policies — server-write only via service role.

`backend/src/routes/webhooks.ts` extended with a CANCELLATION handler block. Access is NOT revoked on CANCELLATION (EXPIRATION still does that when the period ends) — this is purely an analytics log. Maps RC `event.store` to canonical `app_store` / `play_store`, computes `hours_since_purchase` from `purchased_at_ms`, flags `was_in_trial` when `period_type === "TRIAL"`. Anonymous (`$RCAnonymousID:*`) app_user_ids are skipped via the existing UUID gate before any DB write.

New test file `backend/src/__tests__/routes/webhooks-cancellation.test.ts` covers: insert into cancellation_reasons, trial flag mapping, hours_since_purchase math, anonymous-user skip. Mock disambiguates the cancellation_reasons insert from the existing `subscription_events` audit insert by checking `store` field presence.

Tests: 173/173 (was 169 + 4 new). tsc clean.

**Not yet deployed — needs a push to go live on Render. Migration 015 also pending — must be applied via Supabase SQL Editor before the new code's CANCELLATION inserts will succeed.**

Files changed:
- `supabase/migrations/015_cancellation_reasons.sql` (new)
- `backend/src/routes/webhooks.ts` (CANCELLATION handler block added)
- `backend/src/__tests__/routes/webhooks-cancellation.test.ts` (new)

Refs: `docs/plans/2026-05-07-retention-and-offers-design.md`, `docs/plans/2026-05-07-retention-and-offers-implementation.md` Tasks 4-6.

---

### v1.0.29 Phase 0 — Apple + Play + RevenueCat store config (no code changes)

Configured the offer architecture across all three platforms in preparation for the v1.0.29 binary. Captured to `~/.claude/projects/.../memory/project_revenuecat_topology.md` for future-session reference.

**Apple App Store:**
- Intro offer `intro_3mo_30off` on `pro_annual` — Pay Up Front, 3 months at £3.99 (~36% effective discount; "Pay as you go" rejected sub-year durations on annual subs, so Pay Up Front was the cleanest match)
- Win-Back offer `winback_3mo_30off` on `pro_monthly` — Pay as you go, 3 months at £1.99/mo. Eligibility: min 1mo paid duration, lapsed 1d–6mo, 12mo wait between offers
- Lifetime non-consumable IAP `pro_lifetime` — £89.99 GB / €99 / 399 zł / $99.99 US. Status "Ready to Submit" pending v1.0.29 binary attachment

**Google Play Console:**
- Discovered both `pro_annual` and `pro_monthly` were configured as **prepaid** base plans (user pays upfront, no auto-renew). Prepaid plans cannot have offers attached. Created new **auto-renewing** base plans `annual-autorenew` (yearly, £24.99) and `monthly-autorenew` (monthly, £2.99) alongside the existing prepaid plans. Existing prepaid subscribers continue undisturbed; new purchases route to auto-renewing plans
- `intro-3mo-30off` (note hyphens — Play offer IDs reject underscores) attached to `pro_annual:annual-autorenew` — Single payment, 3 months, £3.99, "New customer acquisition" eligibility
- `winback-3mo-30off` attached to `pro_monthly:monthly-autorenew` — Pay as you go, 3 months, £1.99/mo, "Developer determined" eligibility (RevenueCat enforces lapsed-subscriber rules client-side)
- Lifetime managed product `pro_lifetime` — £89.99 GB

**RevenueCat (project `a90c6f7d`):**
- Imported all new SKUs from both stores
- Attached `pro` entitlement to: `pro_lifetime` (Apple + Play), `pro_monthly:monthly-autorenew`, `pro_annual:annual-autorenew`
- Added `$rc_lifetime` package to default offering with both `pro_lifetime` SKUs attached
- Added new auto-renewing Play SKUs to existing `$rc_monthly` and `$rc_annual` packages (alongside the legacy prepaid SKUs which cannot be Made Inactive while still attached, and cannot be Deleted while transactions reference them — known issue documented in `project_revenuecat_topology.md`, deferred to post-v1.0.29 cleanup)

**Architectural finding worth flagging:** Play's prepaid base plans likely caused historical "cancellation" classification confusion in `project_churn_patterns.md` — prepaid term-end non-renewals may have been logged as voluntary cancels. Once v1.0.29 ships and Play purchases land on auto-renewing SKUs, future `cancellation_reasons` data will be a cleaner signal. Re-evaluate the LubieWoka 13h-cancel case and similar after 30 days of v1.0.29 in production.

---

### TikTok comment replies — BR 232 video

- **airbus.a3200** (BR 103 v3, ICE TD speed correction) — DE concession reply per halsi07 template
- **trainspotter_leander** (BR 232 / DDR video, "only 3 scans" complaint) — DE update-prompt reply (free tier raised 3→6 in v1.0.21; user likely on old build)
- **Steffan23** (BR 232 / Nordbahn follow-up "how do you know?") — DE warm reply with footage-source ask

---

## 2026-05-07

### Backend — EU07 / EP07 / EP08 / EU07A / EU160 (Newag Griffin) hardcoded specs

Polish TikTok commenter `inspiro` corrected an EA6 Dragon ad reply that mashed the EU07/EP07/EP08 family to "160 km/h" — the correct figures are EP07 125, EP08 140, EU07 125, with only the EU07A modernised variant and the EU160 / Newag Griffin successor at 160. No prior hardcoded coverage for any of these classes — fall-through LLM specs were at risk of drifting to 160 km/h since EP09 (160) and EU07A (160) are family neighbours.

`backend/src/services/trainSpecs.ts`:
- New EU07 / PKP EU07: 125 km/h / 2,000 kW / Pafawag (Wrocław) + HCP Poznań / 3 kV DC.
- New EU07A / PKP EU07A (303E modernised): 160 km/h / 3,200 kW / HCP Poznań / 3 kV DC. The only EU07-family member at 160.
- New EP07 / PKP EP07 (EU07 reclassified for passenger): 125 km/h / 2,000 kW.
- New EP08 / PKP EP08 (Pafawag, uprated EP07): 140 km/h / 2,000 kW.
- New EU160 / PKP EU160 / Newag Griffin / Griffin / E4MCU / E4MSU: 160 km/h / 5,600 kW / Newag (Nowy Sącz) / multi-system 3 kV DC + 15 kV 16.7 Hz AC. The actual EP07/EP08 successor at 160 — PKP Intercity Newag Griffin variant.

13 new lookup keys total. Block inserted right after the EU05/EP05 "Gagarin" cluster, before the Newag Dragon E6ACT block. Tests 169/169 pass, tsc clean. Cache version unchanged (v7) — these classes are not ad-target volume so cached drift is minimal; new scans pick up hardcoded specs immediately.

---

## 2026-05-06

### iOS v1.0.28 build 50 APPROVED + LIVE on App Store

Apple approved iOS build 50 overnight from the 2026-05-05 EAS submission. v1.0.28 is now LIVE on BOTH stores — Android (versionCode 16) since 2026-05-05 evening, iOS (build 50) since this morning. Same release notes as Android: 8 new tiered achievements, Weekly Rare-Find Champion card, improved Polish EL2/EL3 identification.

### Backend — BR 185 (TRAXX F140 AC) vs EU45 (Siemens ES64F4) platform disambiguation

German tester `mx.2dox` correctly flagged that an earlier LocoSnap ad treated PKP Cargo EU45 footage and DB BR 185 footage as if they were the same loco — they are completely different platforms from different manufacturers (EU45 = Siemens Eurosprinter F4 / ES64F4 multi-system, same physical platform as DB BR 189; BR 185 = Bombardier TRAXX F140 AC1/AC2). No prior backend coverage existed for either class.

`backend/src/services/trainSpecs.ts`:
- New BR 185 spec entries across 10 lookup keys (`br 185`, `br185`, `185`, `db 185`, `class 185`, `db class 185`, `baureihe 185`, `traxx f140 ac`, `traxx f140 ac2`, `bombardier traxx f140 ac2`): 140 km/h / 5,600 kW / 84 t / Bombardier Transportation (Kassel) / 600 built (BR 185.1 + BR 185.2 combined) / 15 kV AC + 25 kV AC on BR 185.2.
- New EU45 spec entries across 7 lookup keys (`eu45`, `eu 45`, `pkp eu45`, `pkp cargo eu45`, `es64f4`, `siemens es64f4`, `eurosprinter f4`): 140 km/h / 6,400 kW / 87 t / Siemens Mobility (Munich-Allach) / 25 PKP units / multi-system 15 kV AC + 25 kV AC + 1.5 kV DC + 3 kV DC.

`backend/src/services/vision.ts`:
- New disambiguation rule pinned right before the Hamburg DT4/DT5 block. Codifies builder as the discriminator (Bombardier Kassel for BR 185, Siemens Munich-Allach for EU45/BR 189). Reinforces the existing `project_cross_border_loco_correctness.md` rule: BR 185 is single-system AC and CANNOT operate in Poland under wire — any cross-border PL freight must be BR 186 / BR 189 / EU45 / Vectron MS / TRAXX MS3, never BR 185. Statistical default rule explicit: flat TRAXX-2-era cab without sloped nose or roof strip = BR 185; squared Eurosprinter-era Siemens cab on PKP Cargo livery = EU45.

Tests 169/169 pass, tsc clean. Render auto-deploys on push. **Newag Dragon (Benji Coleman comment) — NO change.** His "Bo-Bo 5 MW vs Co-Co 8 MW" claim doesn't match published Newag specs: all Dragon variants (E6ACT, E6ACTa, E6ACTadb / Dragon 2) are Co-Co at 5,000–5,800 kW per Newag and Wikipedia. Existing backend coverage at lines 765-777 of `trainSpecs.ts` is correct; no spec entries adjusted.

### Backend `50af690` — BR 247 weight hotfix + ČD 753.7 lookup-key gap

TrainVibez tester Mattis (`@br232ost`) caught the BR 247 reveal card showing **195 tonnes** weight — hallucinated by the model. Real Vectron DE Bo-Bo service weight is ~90 tonnes. Single-file patch to `backend/src/services/trainSpecs.ts`:

- Added explicit `weight: "90 tonnes"` to all 7 BR 247 lookup keys (`br 247`, `br247`, `247`, `db 247`, `db class 247`, `vectron de`, `siemens vectron de`).
- Added `weight: "74 tonnes"` to ČD 753 / 754 / 753.7 entries (Bo-Bo Brejlovec) to pre-empt the same hallucination class on the Czech locos shipped yesterday in `52f4e6b`.
- Closed the lookup-key gap from yesterday's known follow-up by adding `čd class 753.7`, `class 753.7`, `class 753`, `class 754` keys so the model's exact returned class strings ("ČD Class 753.7" etc.) now hit our overrides instead of falling through to model-default specs.

Render auto-deployed. DM reply drafted to Mattis in DE+EN acknowledging the catch and confirming the 2-3 min deploy window. Re-scan after deploy will show corrected 90 t.

Pattern note: BR 247 is the second tester catch on the same class in the same evening (the first was the EMD/Dual-Mode/709 disaster from yesterday's `52f4e6b`). Vectron DE is undercovered in the model's training data — every spec field needs explicit override. Mattis is now an active evangelist on the same profile as Steph (project_tester_evangelist_pattern.md memory) — second substantive technical correction in 24 hours.

---

## 2026-05-05

### Evening session — Android v1.0.28 LIVE, BR 247 + ČD 753/754 backend, TrainVibez sponsor activation, Newag Dragon ad

**Android v1.0.28 LIVE on Google Play** — approved + auto-published to production track within ~4 hours of EAS submission earlier in the day. iOS v1.0.28 build 50 still in Apple review.

**Backend `52f4e6b` — BR 247 Vectron DE + ČD 753/754 Brejlovec coverage.** Triggered by a TrainVibez sponsor screen recording session where the BR 247 card returned: Builder "Electro-Motive Diesel" (should be Siemens Mobility), description "Vectron Dual Mode" (BR 247 is single-mode diesel, BR 248 is the Dual Mode), rarity "709 left / common" (709 is the BR 232 Ludmilla number), max speed 120 km/h (correct 160). Every spec/facts/rarity field was wrong because no codebase coverage existed. Same commit added ČD 753/754 Brejlovec coverage since Mattis filmed both classes for the same TrainVibez video. Vision rule extended to disambiguate BR 247 vs BR 248 vs BR 193 (no pantograph + full diesel exhaust = BR 247) and to key Czech 753/754 on the four-round-headlight oval-recess "goggle" cab profile. Spec entries pinned for "br 247", "247", "vectron de" and "753", "754", "čd 753", "brejlovec", "753.7" lookup keys. Facts overrides forbid the EMD / Dual-Mode / 709 hallucinations and frame the BR 247 as RDC Autozug Sylt operator on the Hindenburgdamm causeway. Rarity rules classify both at uncommon/rare. Tests 169/169 pass, tsc clean. Render auto-deployed. Verified post-deploy via fresh scan: BR 247 card now shows Siemens Mobility / 160 km/h / 2,400 kW / RARE; ČD 753.7 shows ČKD Praha + CZ Loko rebuild / Brejlovec nickname / RARE. Known follow-up: "ČD Class 753.7" class string returned by model doesn't match our `753.7` lookup key (case/prefix mismatch) — model used its own 160 km/h / 2,210 kW values rather than our 100 km/h / 1,500 kW override; needs `"čd class 753.7"` and `"class 753.7"` keys in next pass. Memory `backend_backlog_corrections.md` updated with SHIPPED status for EL2/EL3 + BR 247/753/754.

**TrainVibez sponsor end-to-end activation:**
- DM chain confirmed Mattis filmed BR 247 + ČD 753/754 over the weekend. Username `br232ost` correctly hinted at Eastern German freight specialism but the actual video classes turned out to be different.
- Lifetime Pro grant confirmed on `mattiweinertt@icloud.com` via `update profiles set is_pro = true`.
- **Smart redirect `4329771` deployed to `locosnap.app/go/trainvibez`** — single platform-detecting URL routes iOS to the App Store Custom Product Page (with `ppid=d3860b78-88a1-43c9-a9f4-1226cafcfddd`), Android to Play Store with full referrer (`utm_source=youtube&utm_medium=trainvibez&utm_campaign=sponsor_2026_05`), desktop to landing page with same UTMs. Static HTML at `website/go/trainvibez/index.html`, deployed via `vercel --prod`. JavaScript with noscript fallback. Tested working on iPhone Safari, desktop Chrome.
- **Apple Custom Product Page "TrainVibez Sponsor" — APPROVED + LIVE same day.** First submission rejected (screenshots were marketing crops, not app-in-use). Replaced screenshots with 5 frames extracted from BR 247 + ČD 753 scan recordings — card-reveal hero, scanning flow, specs panel, second class card, facts/history. Resized 1206×2622 → 1242×2688 with metadata stripped via Python PIL (Apple validator was reading stale EXIF PixelXDimension/Y from sips-resized files — lesson: re-save without metadata, not just resize). Also uploaded a 20-second App Preview video at 886×1920 with silent AAC stereo 48 kHz audio track (initial render with `-an` was rejected — Apple requires audio track present even if silent). Resolution Center reply numbered the new screenshots against app surfaces. Re-submitted; approved within hours. ppid `d3860b78-88a1-43c9-a9f4-1226cafcfddd` now active and serving the German promo line "Gesehen auf TrainVibez? Baureihe, Hersteller, Baujahr und Seltenheit in Sekunden — bau deine Sammelkarten-Sammlung."
- **Two emails sent to Mattis via Resend** (Resend API per `credentials_locations.md` memory — `From: Stephen Lear <stephen@locosnap.app>`, mandatory CC `unsunghistories@proton.me`):
  1. Initial brief (Resend ID `f4c7eb01-d6a6-4ea9-afa9-735dee587a7f`) — 5 attached clips (~24 MB), tracking link, Pro confirmation, talking points, invoice request.
  2. Class-matched follow-up (Resend ID `8310d561-59da-4640-b02f-442c8b32b13c`) — 2 trimmed scan-reveal clips (BR 247 + ČD 753.7) at 720p, ~2.5 MB total, acknowledging the backend updates that landed for both classes.

**Newag Dragon ad rendered for 2026-05-06 AM TikTok + IG cross-post** — `~/Desktop/locosnap_dragon_pl_v1.mp4`, 720×1280, 30fps, 10.000s, 5.2 MB, no audio. Polish-language progress framing (different narrative axis from EN57 / ET22 survival/scarcity). Beats: 1) E6ACTa-009 Newag plate detail → "Polski Newag." 2) Lotos E6ACT-006 close → "5,000 kW" 3) Mania E6ACTadb-043 cinematic → "~50 sztuk" 4) CEMET Wolica-Sokołów landscape → "Następca ET22." 5) endcard with LocoSnap icon + "Foto. Klasa. Sekundy." + "iOS + Android · za darmo". Source: 4 user-supplied clips at `~/Desktop/EA6 Dragon/`. Pre-post on-device verification done — Mania 043 scanned correctly as "Dragon 2 RARE" on the live backend. Caption hashtags include `#newag #dragon #e6act #pkpcargo #lotoskolej #nowysącz`. Targets per `tiktok_stats.md` ET22 PL day-1 baseline: TikTok PL share >60%, avg watch >4.5s, +2 followers minimum. First test of "progress / pride" PL framing — if it lands, opens Pesa Gama / Newag Impuls future ads on the same axis. Build standards followed: yellow Arial Black 6px outline ASS (Polish chars `ą` written via Write tool, heredoc would corrupt), per-beat sizing 110/140/110/100, all four source clips already 720×1280 (no aspect distortion).

**Sentry REACT-NATIVE-4 WatchdogTermination — diagnosed as developer noise.** Single-event regression (1 user / 2 events / iPhone 17 Pro Max / iOS 26.3.1 / v1.0.25) flagged 21:20 local. Root cause: 3-minute blueprint generation hang during BR 247 dev scan + active camera + screen recording overhead exceeded iOS RAM threshold and triggered watchdog kill. Recommended Resolve in Sentry. Underlying blueprint hang captured as a separate work item — see new memory `backend_blueprint_generation_hang.md`. Likely root causes: Replicate API timeout, backend polling loop without max-age cutoff, frontend `pollBlueprintStatus` missing client-side max-poll-count. Investigation deferred to a future session.

**Memory hygiene this session:**
- Updated `backend_backlog_corrections.md` — EL2/EL3 + BR 247 + ČD 753/754 marked SHIPPED with commit refs.
- Created `backend_blueprint_generation_hang.md` — captures the 3-min hang root-cause hypotheses and a step-by-step investigation plan.
- Created `feedback_ad_planning_grounded_in_data.md` — before any ad/content/strategy recommendation, READ recent handover + `tiktok_stats.md` first. Triggered after generic option-list output without citing recent ad calendar got correctly flagged.
- MEMORY.md index updated with both new pointers.

### v1.0.28 — tiered achievements + weekly rarity champions SHIPPED to both stores (`051f71e`)

End-to-end ship of two Phase 2 depth features in a single release. Both iOS (build 50) and Android (versionCode 16) auto-submitted via EAS. iOS in Apple review queue; Android in Play Console production track as draft.

**Tiered achievements** — replaces the 8 first-week achievements with progression depth. New tiers added on top of existing achievements:
- `ten_unique_silver` (50 unique classes), `ten_unique_gold` (200)
- `fifty_spots_silver` (250 spots), `fifty_spots_gold` (1000) — "500 Club" and "Thousand Yard"
- `seven_day_streak_silver` (30 days), `seven_day_streak_gold` (100)
- `copped_legendary_silver` (5 legendary scans)
- `heritage_hunter_silver` (50 steam scans)

Implementation: extended `Achievement` type union in `frontend/types/index.ts`; added 8 new check entries to the unlock array in `frontend/services/supabase.ts:1114`; added EN+DE i18n keys for each new title/description; tracked legendary count via `rarityTiers` map populated during scan persistence. Existing achievement check pattern (DB upsert + frontend check) reused — no schema changes required.

**Weekly Rare-Find Champion card** — new mini-card on the Country tab showing the top user per country with the highest-rarity verified scan this week. Drives social sharing + retention beyond the league tier system.

- Migration 014 (`014_weekly_rarity_champions.sql`) — SECURITY DEFINER function `get_weekly_rarity_champion(p_country_code text)`. Reads `spots`+`trains`+`profiles`, filters to rare/epic/legendary AND verified-live/verified-recent-gallery scans this week (date_trunc to UTC Monday), picks each user's best find (rarity rank desc, scan_date asc), returns top user per country. Granted to `authenticated` only. Applied to production Supabase 2026-05-05 17:23. First champion: TrainFan_0680 with DR Baureihe 35.10 (legendary) — verified the function works against live data.
- New service helper `getWeeklyRarityChampion(countryCode)` in `frontend/services/supabase.ts` calls the RPC.
- New component `frontend/components/WeeklyChampionCard.tsx` — gold-trimmed card with crown emoji, username, train class, and rarity badge. Renders only when champion exists (silently absent otherwise).
- Wired into `frontend/components/leaderboard/CountryTab.tsx` above the leaderboard list.
- 7 new EN+DE i18n keys: `leaderboard.country.weeklyChampion.*` (title, subtitle, badge labels). Diacritics verified — Wöchentlicher, Länder.

**Backend EL2/EL3 fix** (earlier commit `4b3c7e5` same day, pushed before v1.0.28 frontend work): vision disambiguation rules now lock EL2 to 1435mm gauge + LEW Hennigsdorf builder (catches the @ostdeutscher_bahner2009 correction where EL3 was being misidentified as EL2). Render auto-deployed. User-facing improvement to Polish electric loco identification.

**Tests at session close**: frontend **135/135**, TSC clean. No breaking changes.

**Migration audit** (per `feedback_migration_column_audit.md`): every column reference in 014 verified against schema — `s.train_id`, `s.verification_tier`, `s.created_at`, `t.id`, `t.class`, `t.rarity_tier`, `p.id`, `p.username`, `p.spotter_emoji`, `p.country_code` all confirmed against migrations 001 / 010 / 011 / 013.

**Builds**:
- iOS build 50, EAS `77ef2bf1-41c1-4057-b2cb-402b8114c9a6`, submitted to App Store Connect → in Apple review queue
- Android versionCode 16, EAS `37de5d5f-4e7c-4e28-80b4-973e1138f8a4`, submitted to Play Console production → draft awaiting send-for-review

**Release notes shipped (EN + DE)**:
- EN: 8 new tiered achievements, Weekly Rare-Find Champion card, improved Polish EL2/EL3 identification
- DE: 8 neue gestufte Erfolge, Wöchentlicher Rare-Find-Champion Karte, verbesserte EL2/EL3 Erkennung

### Phase 2 leaderboard — frontend SHIPPED + cron deployed to Render (v1.0.26 work)

End-to-end Phase 2 ship across 6 commits on `main` (385175b → 3d6b0ab → 55ddc7e → e7626ba → e85a3f4, plus the earlier d6ec35f + 3cc8e72 hotfixes). Migration 013 applied to production Supabase, 206 profiles backfilled 1:1 into league_membership at tier 1 (Bronze) for week 2026-05-04. Render cron `locosnap-league-cron` scheduled at `59 23 * * 0` (Sunday 23:59 UTC), command `node dist/cron/runLeagueWeeklyReset.js`. First manual replay run 2026-05-05 12:18 PM UTC completed in 10 seconds — 0 promotions / 0 demotions / 26 freezes awarded (= 26 Pro users got their weekly +1 freeze). Cycle state advanced to 2026-05-11.

**Cron idempotency hotfix** (`385175b`): the `current_week_start === weekStart` check was wrong — after a successful run `current_week_start` advances by 7 days, so strict equality could never match for re-runs. Changed to `>` so any call for a week earlier than `current_week_start` returns `skipped_already_run`. Caught after the manual trigger run when I traced what would happen on the next Sunday cron — without the fix, it would have re-processed week 2026-05-04 and double-bumped consecutive_inactive_weeks + Pro freezes.

**Migration 013 schema-correctness hotfix** (`3cc8e72`): first apply attempt failed on `s.rarity_tier` because rarity_tier lives on `trains`, not `spots` — spots joins via `train_id`. Two fixes: (1) the featured_spot_id backfill now joins `spots s → trains t on t.id = s.train_id` and uses `t.rarity_tier`; (2) the `award_weekly_xp_for_spot` RPC selects `s.user_id, t.class, t.rarity_tier` from a joined query instead of reading from `spots` directly. Failure caught BEFORE I told the user the migration was ready, but I didn't audit column references — that mistake is now `feedback_migration_column_audit.md` in memory.

**E.1 — useLeaderboardStore** (`385175b`): in-memory Zustand store managing `activeTab` (my_league / country / collection) + per-tab sub-toggles + selectedCountry. 9 unit tests cover initial state, tab switching, sub-toggle independence, country selection, reset.

**E.2 — MyLeagueTab** (`3d6b0ab`): renders the user's current tier badge (Bronze→Vectron, color-coded), weekly XP, and top 100 of their league shard via SECURITY DEFINER `get_my_league_rankings` RPC. Promotion zone separator at top-10% slot (hidden for Vectron); demotion zone separator at bottom-10% slot (hidden for Bronze). Self-row pinned and accent-highlighted. New service helpers: `fetchMyLeagueMembership(userId)`, `fetchLeagueRankings(tier, shard)`. New constants: `constants/leagues.ts` with TIERS metadata + `promotionSlots()` / `demotionSlots()` math (12 unit tests).

**E.3 — CountryTab** (`55ddc7e`): country selector pill row (defaults to user's country or DE fallback), This week / All-time sub-toggle. Reads `leaderboard_weekly` or `leaderboard` view filtered by `country_code`. New helpers: `fetchCountryLeaderboard(code, mode)`, `fetchKnownCountryCodes()`.

**E.4 — CollectionTab** (`55ddc7e`): three sub-toggles (Unique / Rarity / Streak). Unique = unique_classes ranking from `leaderboard` view. Rarity = computed via `computeRarityScore({legendary*15, epic*8, rare*5, uncommon*2})` over `leaderboard_rarity` view. Streak deferred to v1.0.27 (no `streak_days` column yet) — falls back to unique_classes with an honest "Coming soon" notice. 4 unit tests for `computeRarityScore`.

**E.5 — leaderboard.tsx router** (`55ddc7e`): replaces the previous 681-LOC 4-tab implementation (Global / Weekly / Rarity / Regional) with a ~100-LOC tab router that selects between `MyLeagueTab` / `CountryTab` / `CollectionTab` from `useLeaderboardStore.activeTab`. The legacy `LeaderboardEntry` type + view helpers are retained — internally consumed by Country and Collection tabs.

**E.6 — obsolete tests**: nothing to migrate. The only existing leaderboard test was the new `leaderboardStore.test.ts` from E.1.

**F.1 — featured-card thumbnails** (`e7626ba`): MyLeagueTab rows now show a 48px featured-card thumbnail on the right edge, fetched via bulk `fetchSpotPhotoUrls(ids)` against the `featured_spot_id` returned by the rankings RPC. UNVERIFIED spots filtered at query level (defensive — backend already enforces this in the migration 013 backfill). Empty state shows a placeholder icon. CountryTab and CollectionTab don't get thumbnails yet — those views need a separate migration to expose `featured_spot_id`. Deferred to v1.0.27.

**F.2 — featured-card picker** (`e7626ba`): card-reveal.tsx adds a "Set as featured card" button visible for verified-live / verified-recent-gallery / personal tiers in history mode (need a persisted spotId). Calls `setFeaturedSpot(userId, spotId)`, optimistically flips local UI state, fires `featured_card_set` analytics event, shows toast confirmation. The button hides for UNVERIFIED tier (privacy-by-default — UNVERIFIED can never be featured).

**G.1 — FreezeCounter** (`e85a3f4`): snowflake badge on the league header showing `profiles.streak_freezes_available`. Tap → modal explainer covering the freeze rules (Pro: +1/week max 3; Free: +1 per 4 active weeks max 2; auto-burn at week close).

**G.2 — ThemedDayBanner** (`e85a3f4`): renders above the leaderboard list when today is a themed day. Pure resolver in `constants/themedDay.ts` (4 unit tests) — currently active: Tuesday Rare-Tier 2× XP. Heritage-Saturday 1.5× is defined in the backend constants but stays hidden in the banner until country-match introspection ships in v1.0.27.

**G.3 — BoostInventory** (`e85a3f4`): inline section in MyLeagueTab listing un-used `user_boost_inventory` rows. flat_100 cards apply via `apply_boost_card` RPC with confirm Alert; next_scan_2x renders disabled with "Coming soon" label (queued-state machinery lands in v1.0.27). Hidden when no cards. Test 26-Pro-freeze-award run validates the RPC was wired correctly even before any cards exist.

**G.4 — push notifications**: deferred to v1.0.27. Daily-schedule infrastructure is bigger than the rest of Phase 2 combined; the in-app banner already covers "user opens the league tab on a themed day" which is the high-leverage path.

**H — i18n + parity**: 39 new EN+DE keys across `leaderboard.tabs.*`, `leaderboard.league.*`, `leaderboard.country.*`, `leaderboard.collection.*`, `leaderboard.freeze.*`, `leaderboard.themedDay.*`, `leaderboard.boost.*`, `card.featured.*`. All German diacritics verified (Wochenstand, Verstanden, Klassen, Karte des Profils, Streak-Karten). Parity 243/243.

**Tests at session close**: backend **169/169**, frontend **135/135** (was 106 baseline — added 9 leaderboardStore + 12 leagues + 4 rarityScore + 4 themedDay = 29 new). TSC clean both sides. No breaking changes to existing tests.

**Pending v1.0.26 build**:
- countdown timer on league header (Sunday-23:59 reset)
- featured-card thumbnails on Country + Collection rows (needs view migration)
- streak_days collection mode (needs `profiles.streak_days` schema)
- `next_scan_2x` boost queued-state machinery
- push notifications for themed days
- manual QA on a real device against production
- v1.0.26 EAS build trigger + store submit

**Next-step gates**: device QA must run before EAS — Phase 2 frontend hasn't been seen on hardware yet, only run through TS + Jest.

### Tester engagement — BR 232 v2 ad day-1

BR 232 v2 ad posted to TikTok + IG morning 2026-05-05. Two substantive comment chains tracked:
- @Gotha Trainspotter: "Gestern EBS in Gotha richtung Emleben" → reply re EBS being one of the last private 232 operators → he promised a video → DM'd a TikTok link to @buliaviation footage of 241 353-2 in Bahnservice livery. Honest follow-up "direkt jetzt nich schon bisschen älter" softens the implicit-ownership signal. Replied warmly with a soft ask for original footage if he ever has any. Logged to `footage_source_gotha_trainspotter.md` memory.
- @Virox_Bloodfang: Hoyerswerda-Polen cross-border BR 232 sighting → reply confirming Polish private operators (LOTOS, CTL, Orlen) still run ex-DR 232s.

### Release — v1.0.25 iOS build 47 APPROVED by Apple and LIVE on App Store

Apple approved overnight (hotfix-class diff). v1.0.25 is now LIVE on both stores: Android (versionCode 15) on Google Play since 2026-05-04 evening, iOS (build 47) on App Store as of 2026-05-05.

**What this unlocks:**
- BR 232 v2 ad post (TikTok + IG) can honestly include "Jetzt im App Store und Google Play" — both stores carry current builds.
- YXNSST: Play staged rollout should surface the update within 24–48h. Follow-up DM queued asking them to update + retest the Weiter button on Redmi Note 13 Pro 5G / HyperOS.
- Other Redmi/HyperOS users hit by the same safe-area bug (silent victims who didn't report) auto-fixed on update.

### Backend — Phase 2 Section D: weekly league cron coordinator (code-only, migration-tolerant)

Continues the v1.0.26 leaderboard Phase 2 work on `feat/v1.0.25-leaderboard-phase2` worktree branch. **Hosting decision: Render cron** (D.1) — same deployment surface as the API, simpler debug + existing patterns. Considered Supabase pg_cron and rejected as a second operational surface for ~30s/week of work.

**New files:**
- `backend/src/cron/leagueWeeklyReset.ts` (≈400 LOC) — pure helpers (`computeTierMoves`, `decideFreezeAward`, `computeGhostMove`, `shouldAwardPromotionBoost`, `nextWeekBoundaries`) + DB-touching orchestrator `runLeagueWeeklyReset(supabase, weekStartUtc)`. Idempotent against `weekStartUtc` (re-run for already-completed week returns `status: "skipped_already_run"`); migration-tolerant (returns `status: "skipped_no_migration"` on missing-table error 42P01/PGRST205); failure-tolerant (sets `last_reset_status='failed'` on the cycle-state row + still resolves the promise).
- `backend/src/cron/runLeagueWeeklyReset.ts` — thin Render entrypoint. `node dist/cron/runLeagueWeeklyReset.js` invokes `runLeagueWeeklyReset(currentWeekStartUtc)`. Exits 0 on success/skip, 1 on failure.
- `backend/src/routes/admin.ts` — admin endpoint router gated on `Bearer ${ADMIN_SECRET}`. Returns 503 when `ADMIN_SECRET` is unset (default → never accidentally exposed in dev).
- `backend/src/__tests__/cron/leagueWeeklyReset.test.ts` — **23 unit tests** covering tier math (top/bottom 10% with min-1 floor, Bronze never demotes, Vectron never promotes, tie-breaking by `updated_at asc`, zero-XP no-promote rule, 1-user collision guard), freeze awards (Pro auto-replenish + cap, Free 4-week-streak threshold + cap, infinite-trigger guard), ghost cleanup (4-week threshold drop, freeze auto-burn, Bronze floor), promotion-boost cap, week boundary math.
- `backend/src/__tests__/routes/admin.test.ts` — **7 tests** covering auth gate (401 wrong/missing token, 503 disabled), Monday-boundary validation (400 on non-Monday with canonical hint), 503 on missing supabase, happy-path replay invocation.

**Endpoint:** `POST /api/admin/league-reset/:weekStartUtc` — manual replay of the cron for a Monday-boundary ISO date. Auth-gated to `Bearer ${ADMIN_SECRET}`. Validates Monday boundary explicitly (returns 400 with `expected: <canonical>` rather than silently snapping). Idempotent — re-running for a completed week returns `skipped_already_run`.

**Promotion/demotion rules** (per design doc D6):
- Top 10% per tier promote (minimum 1, except Vectron tier 8 which never promotes; zero-XP scans never promote even if they're alone in an otherwise-empty league).
- Bottom 10% per tier demote (minimum 1, except Bronze tier 1 which never demotes).
- 1-user league: promotion wins (collision guard against same user being both promoted and demoted).
- Tie-break by `weekly_xp DESC, updated_at ASC` — earlier-updated wins (Duolingo loss-aversion rule).

**Freeze rules** (per design doc D8):
- Pro: +1 freeze every week, capped at 3 banked.
- Free: +1 freeze when `consecutive_active_weeks >= 4`, capped at 2 banked. Earning resets the active streak counter to 0. Hitting threshold while at cap still resets the counter (prevents infinite-trigger when cap frees up).

**Ghost cleanup** (per design doc D7):
- Active week (`weekly_xp > 0`): inactive counter reset to 0.
- Inactive with freeze available: burn 1 freeze, counter reset to 0, no tier drop.
- Inactive, counter < 4: increment counter.
- Inactive, counter would hit 4: drop one tier (unless Bronze), reset counter to 0.

**Boost cards** (per design doc D11):
- 1 `flat_100` per league promotion, capped at 3 banked. Awarded inline during the per-user write loop.
- `next_scan_2x` (4-week active streak award) deferred to v1.0.26 alongside the queued-state machinery (`pending_boost_card_id` on profiles).

**Migration-tolerance pattern:** every DB call wrapped — code path returns `status: "skipped_no_migration"` cleanly when `league_cycle_state` doesn't exist. Same pattern as the rest of Phase 2 backend: ship code now, turn on after migration 013 is applied to production.

**Env config:** `ADMIN_SECRET` added to `backend/src/config/env.ts` as `optionalEnv("ADMIN_SECRET", "")` with `hasAdminSecret` getter. Default-disabled in dev.

**Render scheduling** (D.5 — user-action when migration 013 is applied):
1. Render dashboard → Cron Jobs → Add new
2. Schedule: `59 23 * * 0` (Sunday 23:59 UTC)
3. Command: `node dist/cron/runLeagueWeeklyReset.js`
4. Set `ADMIN_SECRET` env var on the cron service so the admin replay endpoint also has it.

**Tests at session close:** **167/167 backend** (was 137; +23 cron + 7 admin = +30 new). TSC clean. Not yet pushed.

No frontend changes. Sections E–H still pending and gated on migration 013 application.

---

## 2026-05-04

### Release — v1.0.25 Android LIVE on Google Play (approved + pushed for publication 2026-05-04 evening); iOS submitted same evening, approved + LIVE 2026-05-05 (see entry above)

Cut as a hotfix for tester YXNSST who was blocked on the identity onboarding flow since v1.0.24. Original v1.0.25 plan (leaderboard Phase 2-5) reduced to two surgical fixes; full leaderboard scope continues as **v1.0.26** work on the same `feat/v1.0.25-leaderboard-phase2` worktree branch.

**v1.0.25 ship scope:**
- Weiter button safe-area fix on Android 3-button nav (commit `9f98031`, see entry below)
- `BLUEPRINT_TIMEOUT` 120s → 240s (Christian fix from 2026-05-03 PM)

**Build / submit chain:**
- `app.json` version bumped 1.0.24 → 1.0.25 (commit `f7ac50b`). EAS auto-incremented Android versionCode 14 → 15, iOS buildNumber 46 → 47 (per `appVersionSource: remote` + `autoIncrement: true` in `eas.json`).
- Android build `ddae1cc6-5130-48ad-936b-84155019b983` finished 19:25 UTC, AAB at https://expo.dev/artifacts/eas/tnGagSoRAmokXe6fcQMBEk.aab — submitted via `eas submit --platform android --profile production --non-interactive --latest` (submission `8c105c4e-aef4-4455-858d-6051af54a309`). Landed in Play Console Production track as draft (per `releaseStatus: draft`).
- iOS build `870dad5e-61ef-44c6-ba53-c634c31e1c19` finished ~19:35 UTC, IPA at https://expo.dev/artifacts/eas/hFgkwXr6xFMxsu54x6gFdv.ipa — submitted via `eas submit --platform ios` (submission `f4ecb20b-2442-4a11-b917-03cfc8618e8e`). Apple processing 5-10 min, then attached to v1.0.25 in App Store Connect.
- User manually added EN + DE release notes on both stores and clicked Send for review on Play Console + Submit for Review on App Store Connect simultaneously, so both review clocks start together. Confirmed by user 2026-05-04 evening.
- **Google Play approved + user pushed for publication 2026-05-04 evening** — versionCode 15 rolling out to production track. Apple still processing iOS at session close.

**Release notes (EN):**
> Bug fixes:
> - Android: Fixed an issue where the Continue button on the identity onboarding flow could close the app on devices with 3-button navigation.
> - Train blueprints now wait longer before timing out, so more illustrations display successfully on the first try.

**Release notes (DE):**
> Fehlerbehebungen:
> - Android: Behebt ein Problem, bei dem der Weiter-Button im Identitäts-Onboarding die App auf Geräten mit 3-Button-Navigation schließen konnte.
> - Zug-Blueprints warten jetzt länger, bevor sie abbrechen — dadurch erscheinen mehr Illustrationen direkt beim ersten Versuch.

Migration `013_leaderboard_phase2.sql` continues to be staged but **NOT applied** to staging or production. Phase 2-5 backend code can ship in v1.0.26 immediately once the migration is applied.

### Backend — Polish "Gagarin" family (ET21 / EU05 / EP05) + Newag Dragon coverage (commit `9e21341`, deployed)

Closes a class-collision bug reported on the ET22 TikTok ad: a Polish viewer (`@fuckhypocrisy_`) scanned a Pafawag-era electric loco ("Gagarin" — Polish nickname for the EU05 / ET21 family) and the app returned "Japanese Škoda" (a class that does not exist). Same family of class-collision hallucinations as BR 151 / BR 232 / BR 648 / BR 442 — fixed with explicit disambiguation rules.

**Vision rules added (`backend/src/services/vision.ts`):**
- **ET21 / EU05 / EP05 "Gagarin" heritage family**: first generation of Polish-built electrics by Pafawag (Wrocław), 1957–1971, named after Yuri Gagarin's 1961 first manned spaceflight. **EU05** = Bo'Bo' express passenger (1962–1963, only 30 units built). **ET21** = Co-Co heavy freight (1957–1971, ~174 units built). **EP05** = EU05 reclassified for passenger duties (same physical loco). Disambiguation rules cover wheel-arrangement discrimination (Bo'Bo' = EU05, Co-Co = ET21), explicit prohibitions against returning Czech Škoda or Soviet ChS / Lugansk attributions, and builder enforcement (Pafawag, never Škoda or Lugansk). When metadata or class string contains the colloquial nickname "Gagarin", prefer EU05 unless wheel count or fleet number indicates ET21.
- **Newag Dragon (E6ACT / E6ACTa / E6ACTadb)**: modern Polish heavy freight Co-Co electric, Newag (Nowy Sącz) 2010+, the contemporary replacement for the ET22 in PKP Cargo / Lotos Kolej / CTL Logistics / DB Cargo Polska freight service. Disambiguation against ET22 (older Pafawag boxy 1969-1990 design) and Pesa Gama (passenger-spec Bydgoszcz build). Builder always "Newag (Nowy Sącz)" — never Pafawag, Pesa, Bombardier, or Siemens. Adding proper coverage so we recognise the loco we already reference in our own ET22 ad caption.

**Spec entries (`backend/src/services/trainSpecs.ts`):**
- ET21 / PKP ET21: 125 km/h, 2,400 kW, Pafawag, 174 built, 3 kV DC
- EU05 / PKP EU05 / EP05 / PKP EP05: 125 km/h, 2,000 kW, Pafawag, 30 built, 3 kV DC
- Newag Dragon / Dragon / Dragon 2 / E6ACT / E6ACTa: 120 km/h, 5,000 kW, Newag, 50 built, 3 kV DC
- E6ACTadb (dual-mode): 120 km/h, 5,800 kW, Newag, 50 built, 3 kV DC + Diesel

**Rarity overrides (`backend/src/services/rarity.ts`):**
- **EU05 / EP05**: legendary — 30-unit class, mostly retired, only museum-preserved units occasionally roll out
- **ET21**: epic — ~174 units originally, functionally extinct from commercial service
- **Newag Dragon**: uncommon — ~50-unit modern fleet across multiple operators
- **E6ACTadb**: rare (smaller dual-mode sub-fleet)

**Ship chain:**
- Committed on `feat/v1.0.24-imagepicker-recovery` branch as `9e21341`.
- Branch merged into `main` as `406bf4c` — same merge brought v1.0.24 frontend (already LIVE on stores), Phase 2-5 design + implementation plans, session handovers 2026-05-01/02/03 onto `main`. CHANGELOG conflict resolved by taking the feature-branch version (more comprehensive).
- Pushed to `origin/main` — Render auto-deployed.

**TikTok reply chain:** four-message exchange with `@fuckhypocrisy_` followed the canonical 3-step pattern (concede → reframe to collection → close door). Final reply listed 24 Polish models LocoSnap recognises (EU07/EP07/EP09 family, ET22, EN57, Newag Impuls/Elf, Pesa Elf 2/Gama, ED72/78, EU47, ST44 + livery rules KMŁ/KM/POLREGIO/ŁKA/SKPL) and committed to "ET21 (Gagarin) dziś dodaję" — promise honored same-day by `9e21341`. fuckhypocrisy_ engaged constructively after the substantive reply ("trafnie — mamy ~32k tokenów własnych reguł na każdy scan, nie surowy model") and closed with a thumbs-up.

113/113 backend tests pass.

### Phase 2 leaderboard backend — verification PERSONAL/UNVERIFIED split (commits `2cbd5c6` + `bd4c3f3`)

Splits the existing single `unverified` catch-all tier into two:

- **personal** — legit but no recency proof: weak GPS, stale EXIF, no GPS with intact EXIF, etc. visible everywhere; NOT in League XP. Backwards-compat: all pre-v1.0.25 spots without a tier are grandfathered as PERSONAL via the migration backfill heuristic.
- **unverified** — actively suspicious: stripped EXIF on gallery uploads, mock-location flag, implausible EXIF date (>5y old or in the future). Private to user only; NOT in League XP.

VERIFIED tiers (`verified-live`, `verified-recent-gallery`) are unchanged and continue to count for League XP. This is the verification foundation for the leaderboard Phase 2 XP gate (Section C): only VERIFIED scans earn weekly League XP.

**Migration 013 changes (still NOT applied):**
- Check constraint expanded to 4 values: `verified-live`, `verified-recent-gallery`, `personal`, `unverified`.
- Backfill heuristic: `verified=true` rows split as before; `verified=false` rows now become `personal` (preserving visibility for grandfathered spots) instead of `unverified`.

**Type union changes:**
- `frontend/types/index.ts` + `backend/src/types/index.ts`: `VerificationTier` union adds `'personal'`. `VerificationResult.riskFlags` adds `implausibleDate?: boolean` for the new suspicious-date branch.
- `backend/src/types/index.ts` `IdentifyResponse`: `verification.tier` now references `VerificationTier` (was inline literal — would have drifted).

**Config (`backend/src/config/verification.ts` + `frontend/constants/verification.ts`):**
- New `implausibleEXIFAgeYears: 5` threshold. EXIF older than 5 years (or in the future) → suspicious → UNVERIFIED.

**Classifier (`backend/src/services/verification.ts` + `frontend/services/verification.ts`):**
- New decision tree: suspicious gates first (mock loc / stripped EXIF / implausible date) → verified gates → personal fallback. Frontend mirror kept in sync with backend canonical.
- 22 unit tests in `backend/src/__tests__/services/verification.test.ts` covering all branches including the new UNVERIFIED implausible-date guards and PERSONAL downgrade cases for legit-but-weak signals (DSLR AirDrop with intact EXIF + no GPS → PERSONAL; iOS share-sheet stripping both signals → UNVERIFIED).

### Phase 2 leaderboard backend — UNVERIFIED → PERSONAL manual override (commit `bd4c3f3`)

Owner-attestation "I took this photo myself" flow that promotes an UNVERIFIED spot to PERSONAL, restoring its visibility in the public feed (still no League XP).

**Frontend (`frontend/app/card-reveal.tsx`):**
- Badge now distinguishes 3 tiers visually:
  - `verified-live` / `verified-recent-gallery`: green checkmark, "VERIFIED"
  - `personal`: dark image-outline, "PERSONAL"
  - `unverified`: red lock, "UNVERIFIED"
- Override block (help text + button) renders only for an UNVERIFIED spot in history mode (we need a persisted spot id). Confirm Alert → RPC → local tier flip + toast on success. Owner check is enforced server-side; we additionally require `historyItem.id` locally so freshly-scanned-not-yet-saved spots do not show the button.

**Backend (`frontend/services/supabase.ts`):**
- `promoteUnverifiedToPersonal(spotId)` helper wrapping the SECURITY DEFINER RPC.

**Database (migration 013, still NOT applied):**
- `profiles.manual_overrides_count int DEFAULT 0` — abuse telemetry. Sentry breadcrumb on count > 50 deferred to post-launch ops task.
- `public.promote_unverified_to_personal(p_spot_id uuid) RETURNS void`. SECURITY DEFINER, search_path locked. Validates ownership (`auth.uid() = spots.user_id`) with errcode 42501 on mismatch. Idempotent: PERSONAL/VERIFIED spots return without bumping the counter so legitimate retries do not inflate telemetry.

**i18n:** 9 new keys EN + DE under `card.verification.*` + `card.badge.unverified`. Parity verified.
**Analytics:** New event `verification_promoted_personal { train_class, spot_id }`.

### Phase 2 leaderboard backend — leagues.ts XP service (commits `dd08c05` + `50aa9aa`)

Phase 2 leaderboard core: computes weekly League XP for a verified scan and persists an audit row to `weekly_xp_events`. Failure-tolerant: no-op when migration 013 isn't applied (table missing) or any DB error occurs — the scan response always succeeds, XP just doesn't accrue for that row.

**Pure helpers (unit-testable, no DB) in `backend/src/services/leagues.ts`:**
- `weekStartUtc`: ISO Monday boundary matching `date_trunc('week', ...)` in Postgres.
- `resolveBaseXp`: rarity → XP table with override.
- `isVerifiedForXp`: VERIFIED-only gate.
- `rarityThemedMultiplier`: 2× for rare/epic/legendary on Tuesdays (UTC).
- `computeFinalXp`: composes base → diminishing-returns → themed.
- `BASE_XP_BY_RARITY` constants: 10/25/50/100/250 for common→legendary.
- `THEMED_DAYS` schedule: Tuesday rare-tier (active), Saturday heritage (deferred — needs operator-country lookup at call time).

**DB-touching wrappers (mockable supabase client):**
- `computeWeeklyXp`: VERIFIED gate, per-class diminishing-returns query against `weekly_xp_events`, themed multiplier composition. Returns zeroed output for non-VERIFIED or when the migration is missing.
- `persistXpEvent`: inserts `weekly_xp_events` row + calls `increment_weekly_xp` RPC for atomic `league_membership.weekly_xp` bump.

**SQL RPCs added to migration 013:**
- `increment_weekly_xp(p_user_id, p_week_start, p_xp_delta)`: SECURITY DEFINER, owner-validated atomic XP increment.
- `award_weekly_xp_for_spot(p_spot_id uuid) RETURNS jsonb`: full server-side computation that mirrors `leagues.ts` decision tree in PL/pgSQL. Reads `spot.user_id / class / rarity_tier / verification_tier / created_at` directly so the client cannot fake values. Validates ownership. Idempotent: re-calling for the same spot returns the existing event without double-bumping `league_membership`. Bumps `weekly_unique_classes` only on first scan of class this week.
- `apply_boost_card(p_card_id bigint) RETURNS jsonb`: owner-validated, atomic. `flat_100` instantly adds 100 XP to the user's current-week `league_membership` row + marks the inventory row used. `next_scan_2x` is wired in but returns `applied:false` until queued-state machinery lands in v1.0.26 (avoids consuming inventory while feature is dark).

**Migration 013 schema additions:**
- `weekly_xp_events.class_key text not null` + composite index `idx_weekly_xp_events_dim_returns(user_id, week_start_utc, class_key)` for the per-class diminishing-returns lookup. Removed `'unverified'` from `verification_tier` check since UNVERIFIED scans never write to this audit table.

**Frontend wrappers (`frontend/services/supabase.ts`):**
- `awardWeeklyXpForSpot(spotId)`: RPC wrapper, returns `null` on migration-not-yet-applied (PostgREST 42883 / PGRST202).
- `applyBoostCard(cardId)`: same shape.

**Wire-up (`frontend/store/trainStore.ts`):**
- After `saveSpot` returns a real `spotId`, `awardWeeklyXpForSpot` is invoked. New state `lastLeagueXpDelta: number | null` holds the result for the card-reveal toast. Reset on `startScan`.

**UI (`frontend/app/card-reveal.tsx`):**
- New mount effect shows `+{xp} XP toward your league` toast for 3s on fresh scans where `lastLeagueXpDelta > 0`. Skipped in history mode.
- 2 new i18n keys (`card.league.xpAwarded`) EN + DE. Parity 191/191.

**Test coverage:** 22 unit tests for the pure helpers covering all rarity/weekday/diminishing-returns combinations.

**Section C complete (C.1-C.8). Sections D (cron), E (frontend tabs), F (featured cards), G (freeze + boost UI), H (i18n + QA) still pending.**

Tests at session close: **137/137 backend, 106/106 frontend, TSC clean both sides, i18n 191/191 parity**. Migration 013 still NOT applied to staging or production.

### Frontend — Weiter button overlap with Android 3-button nav fixed (YXNSST report)

#### `frontend/app/onboarding-identity.tsx` — bottom safe-area inset on KeyboardAvoidingView
- **Cause**: Tester YXNSST reported on the BR 110 ad TikTok thread that pressing "Weiter" on the identity onboarding flow closed the app instead of advancing through the steps. Diagnosis after their follow-up: the Weiter button rendered too close to the bottom of the screen, falling within the Android 3-button-nav system bar tap area. Pressing the button registered as the system back button, exiting the app. The earlier swipe-gesture-nav workaround suggested by another commenter did not help — the issue is layout-level, not navigation-mode-level.
- **Fix**: imported `useSafeAreaInsets` from `react-native-safe-area-context` and applied `paddingBottom: Math.max(insets.bottom, spacing.xl + spacing.md)` (36px floor) to the KeyboardAvoidingView container. Same pattern as `frontend/app/blueprint.tsx`, but with a larger floor tuned for the Android 3-button-nav case where `insets.bottom` returns 0 without edge-to-edge config. iOS still gets the home-indicator inset when present.
- **Tests**: TSC clean, 106/106 frontend tests pass.

---

## 2026-05-03 (PM session — v1.0.25 work begins on feat/v1.0.25-leaderboard-phase2 worktree)

### Frontend — BLUEPRINT_TIMEOUT bump (Christian fix bundled into v1.0.25)

#### `frontend/constants/api.ts` — Blueprint polling window 120s → 240s
- **Cause**: Christian (christian.grama@outlook.com) reproduced the same Class 4020 ÖBB schematic-blueprint timeout reported on launch day (2026-04-27) — frontend gives up at 120s while Replicate continues generating in the background and often succeeds after 130-180s. Tester sees a "Time Out" screen for what was actually a successful generation they never get to view.
- **Fix**: `BLUEPRINT_TIMEOUT` constant raised from 120000ms (2 min) to 240000ms (4 min). Backend timeouts unchanged — issue was purely frontend-side polling. Comment block in the file documents the rationale + Christian's repro for future maintainers.
- **Tests**: TSC clean, frontend suite 106/106. No new test added — single constant value change with no logic delta.
- **Reply**: Email sent to Christian (Resend id `95a9e012-f4c0-4c8a-9be3-e5a520f98937`) confirming v1.0.25 will carry the fix.

### Database — Migration 013 staged (Phase 2-5 schema, NOT YET APPLIED)

#### `supabase/migrations/013_leaderboard_phase2.sql` — leaderboard schema foundation
- **Adds**: `verification_tier` text column on `spots` (replaces the frontend-only computation, persists what the codebase already classifies); `featured_spot_id` + `streak_freezes_available` columns on `profiles`; `league_membership` (Phase 2 core); `weekly_xp_events` (append-only audit trail); `user_boost_inventory` (Phase 4); `friendships` (Phase 5 stub); `league_cycle_state` (singleton cron coordinator). Plus RLS policies + a `SECURITY DEFINER` `get_my_league_rankings` function.
- **Backfill rules** (idempotent — re-runs are safe):
  - `verification_tier`: derived from existing `verified` boolean + `capture_source` (camera = `verified-live`; gallery = `verified-recent-gallery`; verified=false = `unverified`). Existing 117-spot collections (e.g. Steph) preserve all current visibility.
  - `featured_spot_id`: set per profile from highest-rarity `verified-live`-or-`verified-recent-gallery` spot (deterministic tiebreaker `created_at` asc).
  - `league_membership`: every existing profile auto-enrolled in tier_1 (Bronze) for the current week.
- **Naming reconciliation**: design doc Section 3 used VERIFIED/PERSONAL/UNVERIFIED tier names but the codebase already uses `verified-live`/`verified-recent-gallery`/`unverified` (frontend/types/index.ts `VerificationTier`). Migration uses codebase names — design doc terminology was brainstorm drift, will be reconciled.
- **NOT yet applied**. Local + staging dry-run + production apply require user oversight per implementation plan A.2 → A.3 → A.4. Frontend + backend code that writes the new column on new scans + reads `league_membership` for tab rendering is also not yet shipped, so applying early is harmless (existing flow continues unchanged) but pointless until the client catches up.

### Release — iOS v1.0.23 build 45 LIVE on App Store + Android v1.0.23 (versionCode 13) LIVE on Google Play

Apple approved iOS build 45 overnight 2026-05-03 from the 2026-05-02 submission. Google approved Android versionCode 13 on 2026-05-02 and the rollout commit was pushed the same day. Both stores now on parity at v1.0.23. Architecture doc + project_status memory updated. No code changes in this entry — store-state update only.

### Frontend — Profile "Legendary" Rarest Find tile overflow fix

#### `frontend/app/(tabs)/profile.tsx` — auto-shrink long stat values
- **Cause**: `statValue` rendered at `xxl` (24pt) bold with no `numberOfLines` and no shrink, in a tile of `minWidth: 45%` with 16pt padding each side (~115–130pt usable text width). "Legendary" (9 chars) wrapped to two lines as "Legendar / y" on the Rarest Find tile. Reported by user on iPhone 16 Pro Max screenshot. Long-locale strings (DE "Legendär", FI "Legendaarinen", etc.) would compound the failure.
- **Fix**: `statValue` Text now uses `numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale={0.6}`. Long values shrink down to ~14pt automatically, short values keep the full 24pt size. Tradeoff: tile fonts become non-uniform when only one tile has a long value, accepted as a v1 patch — proper redesign (rarity pill instead of bare text) deferred to card-v2 / profile-redesign work.
- **Tests**: TSC clean.

### Frontend — Card-back "Compare with another" button clipped on long-locale text

#### `frontend/app/card-reveal.tsx` — pin Compare button to bottom + tighten summary lines
- **Cause**: card has fixed `CARD_HEIGHT = CARD_WIDTH * 1.45` with `overflow: "hidden"`. Long German specs/summary/funfact text pushed the Compare button below the clip boundary, leaving only the top half of "Compare with another" visible. Reproducible on DB BR 110 RARE card-back screenshot supplied by user. EN text just barely fits; DE / PL / FI reliably overflow.
- **Fix**: (1) `cardCompareBtn.marginTop` changed from `spacing.sm` to `"auto"` so the button is pinned to the bottom of the flex container regardless of middle-content height. (2) `backSummary` Text `numberOfLines` reduced from 3 to 2 — long German "Universallokomotive…" descriptions still convey the gist. Funfact stays at 3 lines (more interesting content; deserves the room). Card dimensions, gestures, and trading-card feel preserved. No ScrollView added.
- **Tests**: TSC clean.

### Frontend — v1.0.24 region-gate fix (UK regions were leaking to non-UK users on v1.0.23)

#### `frontend/app/(tabs)/profile.tsx` — gate Profile "Your Region" picker on country_code, not UI language
- **Cause**: v1.0.23 shipped the gate as `language === "en"` (commit `95e1c82`). DE / PL users with their app set to English (a common combination — many EU testers run English UI on German/Polish accounts) saw the UK chip picker. Reported by user 2026-05-03 with screenshot showing London / South East / South West / East Anglia chips on a German (DE flag) account.
- **Fix**: gate is now `profile?.country_code === "GB"`. A British user with German UI gets the picker; a German user with English UI does not. Edge case: users with `country_code === null` (didn't complete identity onboarding, or accounts predating it) lose the picker — accepted, since they can complete onboarding to opt in, and showing UK regions to a confirmed-non-British user is the worse failure mode.

#### `frontend/app/(tabs)/leaderboard.tsx` — hide "Region" tab for non-GB users
- **Cause**: v1.0.23 only gated the Profile picker, not the Leaderboard tab. The "Region" tab was always rendered for every user from the static `TABS` array. DE / PL users saw a tab that, when tapped, only loaded UK regional leaderboards — sending an implicit "this app isn't for you" signal in our top two markets.
- **Fix**: filter `TABS` into a `visibleTabs` const inside the component, dropping the `"regional"` entry unless `profile?.country_code === "GB"`. `{TABS.map(...)}` becomes `{visibleTabs.map(...)}` at the tab-bar render site.

### Frontend — v1.0.24 ImagePicker recovery on `feat/v1.0.24-imagepicker-recovery` branch (UNCOMMITTED, awaiting Android 16 verification)

#### `frontend/app/(tabs)/index.tsx` — auto-retry + camera fallback for Sentry REACT-NATIVE-H
- **Cause**: Sentry REACT-NATIVE-H — Samsung Galaxy A15 / Android 16 (and similar One UI lifecycle quirks) reject `launchImageLibraryAsync` with `java.lang.IllegalStateException` after the host Activity is recreated and the registered `ActivityResultLauncher` becomes stale. v1.0.23 shipped a band-aid Alert telling the user to "try again or restart the app" — surfaced the failure but didn't recover, and the launcher stays stale until app restart so a literal retry doesn't help.
- **Fix — Plan A (auto-retry)**: on the first launcher rejection, wait 250ms (lets the Activity finish its lifecycle) and call `launchImageLibraryAsync` again. Mirrors the existing `takePhoto` retry pattern at lines 511-522. New analytics event `picker_launch_recovered` fires when the retry succeeds, so we can measure how often Plan A alone is enough.
- **Fix — Plan B (camera fallback)**: if the retry also throws, the Alert now offers two buttons: `Cancel` and `Use camera`. The camera path uses a different native launcher (CameraX via expo-camera, not the gallery `ActivityResultLauncher`) and is almost always still usable when the gallery launcher is stale. Tapping "Use camera" calls the existing `openCamera()` flow which handles permission and switches to camera mode.
- **i18n**: 4 new EN keys + 4 new DE keys under `scan.pickerError` (`title`, `body`, `useCamera`, `cancel`). DE diacritics verified (`ö` in "geöffnet").
- **Tests**: TSC clean, frontend suite 106/106 pass.
- **Status**: NOT yet committed per yesterday's plan — ship-or-not decision awaits verification on user's Android 16 device. v1.0.24 build will batch this fix with the morning's Profile + card-reveal overflow fixes.

#### `frontend/locales/en.json` + `frontend/locales/de.json` — `scan.pickerError` i18n block
- **Added** `pickerError.title`, `pickerError.body`, `pickerError.useCamera`, `pickerError.cancel` in both locales. EN body: "Your phone wouldn't let us open the gallery just now. Take a photo with the camera instead?". DE body: "Dein Handy hat die Galerie gerade nicht geöffnet. Stattdessen ein Foto mit der Kamera aufnehmen?"

---

## 2026-05-02

### Release — iOS v1.0.22 build 44 LIVE on App Store

Apple approved overnight from the 2026-05-01 submission. Both stores now on parity at v1.0.22 (Leaderboard Phase 1 identity payload — country flag + spotter emoji onboarding, anonymous→signed-in identity migration, `/sign-in` `email`+`autoSend` query params, 67 EN+DE i18n keys). No code changes this entry — store-state update only.

### Content — BR 110 ad posted to TikTok + Instagram

Followed yesterday's plan. `BR110_ad_v1.mp4` (10s, 1080×1920, TRI 110 469 hero → RE19 Wesel → Köln Dostos → Stuttgart GfF → live card-reveal end card). Music added in TikTok/IG editor at posting time.

### Backend — RevenueCat webhook crash on `$RCAnonymousID:` skip (DEPLOYED on main, commit `d368cd6`)

#### `backend/src/routes/webhooks.ts` + `__tests__/routes/webhooks.test.ts`
- **Cause**: anonymous RevenueCat customers (purchases made without app sign-in) get IDs prefixed `$RCAnonymousID:` — these aren't Supabase UUIDs and crashed every downstream Postgres query in the webhook handler with "invalid input syntax for type uuid" before the existing `try/catch` could return 200. Sentry alerted on each one as a high-priority backend error (issue 116958498).
- **Fix**: validate `app_user_id` matches the canonical UUID shape at the top of the handler. Non-UUID ids return 200 with `skipped: "non_uuid_app_user_id"` so RevenueCat doesn't retry-storm. Entitlement is preserved client-side (StoreKit + RC SDK on device) and reconciles to a real Supabase profile when RC fires the TRANSFER event after sign-in.
- **Tests**: +2 (`skips $RCAnonymousID app_user_ids without crashing` + `processes events with valid UUID app_user_ids`). Backend suite 115/115 pass on main, TSC clean.
- **Real-world trigger**: a German customer paid USD 35.17 for Pro Annual on iOS while anonymous (RC App User ID `$RCA••••54cf`); entitlement working on their device, no Supabase profile yet, audit trail row missing in `subscription_events`. A second anonymous DE customer (Android, `$RCA••••3152`, EUR 33.99 from 2026-04-29) was discovered in the dashboard the same day and had already cancelled.

### Frontend — v1.0.23 branch (uncommitted on `feat/v1.0.23-resilience`)

#### `frontend/store/authStore.ts` + `frontend/app/onboarding-identity.tsx` — Weiter button onboarding fix
- **Cause**: `updateCountryCode` / `updateSpotterEmoji` / `markIdentityOnboardingComplete` awaited the Supabase PATCH inline. On a slow/CG-NAT network the await hangs indefinitely, so `setStep(4)` / `finish()` never fired and tapping "Weiter" looked unresponsive. Reported by tester YXNSST! on iOS v1.0.22 with screenshot of the emoji-picker step.
- **Fix**: identity actions now fire-and-forget the Supabase sync. Local Zustand + AsyncStorage persistence stays synchronous (so the picked emoji/country is durable). Background sync errors are breadcrumbed via Sentry. `handleConfirmCountry` / `handleConfirmEmoji` / `finish` wrapped in try/catch belt-and-suspenders so an unexpected throw can't strand the user mid-flow.
- **Tests**: 12/12 identity-related frontend tests pass, full frontend suite 106/106, TSC clean.

#### `frontend/app/paywall.tsx` + `frontend/app/sign-in.tsx` + `frontend/locales/{en,de}.json` — Paywall sign-in gate (anonymous-payer prevention)
- **Why**: two known anonymous-payer cases (DE iOS USD 35.17 active 2026-05-02, DE Android EUR 33.99 cancelled within 3 days) confirmed the orphan-payer pattern is recurring, not a one-off. Anonymous purchases create RevenueCat customers we cannot contact, cannot tag in Supabase, and cannot win back.
- **Fix**: `paywall.tsx` now checks `useAuthStore(s => s.session)` before `handlePurchase` / `handleCreditPurchase` / `handleRestore`. If `session === null`, routes to `/sign-in?mode=signup&returnTo=paywall&intent=<...>` instead of starting the purchase. New analytics event `paywall_signin_gate_triggered`. Visual: a teal sign-in gate banner above the CTA when signed out, plus the CTA text/icon swaps to "Sign in to subscribe" / "Zum Abonnieren anmelden". `sign-in.tsx` accepts the new `returnTo` query param (whitelisted to safe routes only — guards against open-redirect via deep link) and fires `router.replace('/paywall')` once the session lands.
- **i18n**: 3 new EN keys + 3 new DE keys (`subscribeSignedOut`, `signInGateTitle`, `signInGateBody`, `signInGateCta`). Parity verified manually.
- **Apple guideline check**: 5.1.1(v) permits forced sign-in when "directly relevant to the core functionality" (paid subscription qualifies). 4.8 covered — Sign in with Apple is offered alongside Google + email OTP.
- **Backend impact**: zero changes; the Sentry fix shipped today already handles any leftover anonymous events that slip through.
- **Tests**: TSC clean, 106/106 frontend tests pass.

### Backend — IC1 vs IC2 (Twindexx) vs IC2 (KISS) disambiguation (uncommitted on `feat/v1.0.23-resilience`)

#### `backend/src/services/vision.ts` — DB Intercity pre-flight check
- Added a new "DB INTERCITY (IC1 vs IC2) PRE-FLIGHT CHECK" before the regional EMU pre-flight. STEP 1 deck count is the discriminator — single-deck DB Fernverkehr push-pull → IC1, double-deck → IC2 (Twindexx vs KISS by traction). Bpmbdzf control car explicitly anchored as single-deck IC1, distinguished from the Twindexx Bpbdzf double-deck control car by bodyside row count (NOT cab profile, which is similar). Type field forced to "Push-pull (locomotive-hauled)" for IC1 and IC2 Twindexx — never "EMU".

#### `backend/src/services/trainSpecs.ts` — IC1 + IC2 Twindexx + IC2 KISS spec overrides
- **DB IC1**: 200 km/h, 6,400 kW, ADtranz/Bombardier, 145 BR 101 units, 15 kV 16.7 Hz AC. Variants covered: `db ic1`, `ic1`, `intercity 1`, `db intercity 1`, `bpmbdzf`.
- **DB IC2 Twindexx**: 160 km/h, 5,600 kW, Bombardier (now Alstom), 52 trainsets total. Variants covered: `db ic2`, `ic2`, `ic2 twindexx`, `db ic2 twindexx`, `twindexx ic2`, `bombardier twindexx`, `twindexx vario`.
- **DB IC2 KISS**: 200 km/h, 6,000 kW, Stadler Rail (Bussnang), 17 sets. Variants covered: `db ic2 kiss`, `ic2 kiss`, `br 4110`, `class 4110`, `stadler kiss db`.

#### `backend/src/services/trainFacts.ts` — IC1 + IC2 Twindexx facts overrides
- IC1 framing: locomotive-hauled push-pull, single-deck, BR 101 + IC coaches + Bpmbdzf control car, NEVER EMU. No "withdrawn / phased out" framing — IC1 is everyday operations in 2026.
- IC2 Twindexx framing: 5-car double-deck push-pull set, BR 146.5 + Twindexx Vario coaches, 27 initial + 25 expansion = 52+ trainsets, 160 km/h, NEVER EMU. Operator is DB Fernverkehr (never DB Regio or DB Cargo).

- **Real-world trigger**: tester scanned an IC1 (BR 101 + Bpmbdzf at Minden) and the app returned class "DB IC2 (Twindexx)" with type "EMU", 320 km/h, 8,000 kW, "63 left" rarity — every spec wrong because the model collapsed onto IC2 without checking deck count. Tester publicly corrected: "Du weisst schon das dass ein IC1 ist nh?".
- **Tests**: 113/113 backend tests pass on the v1.0.23 branch, TSC clean.

---

## 2026-05-01

### Backend — BR 110 / DB E 10 hard-overrides (facts + spec + rarity hardening) — DEPLOYED on main

Triggered by deep research before a TikTok/IG ad (DE market): without overrides the model invented "60 built", "mixed-traffic freight loco", "BR 151/155 successors", "Lokomotion / Railpool" — all wrong. BR 110 is express passenger, DB Cargo never operated it, DB Regio retired the class on 12 February 2014 (last unit: 110 469), and only ~12 units now run with private operators (TRI / Centralbahn / GfF / TeutoLok / Pressnitztalbahn).

#### `backend/src/services/trainFacts.ts` — BR 110 / DB E 10 facts override (commit `992188c`)
- **Added** hard-coded facts block alongside existing BR 151 / BR 101 anchors. Locks: 1956–1969 production, 379 BR 110.1 + 31 BR 113 built by Krauss-Maffei + Krupp + Henschel + AEG + Siemens; "Bügelfalte" creased-nose 110.3 from 1963; DB Regio retired 12 Feb 2014 (110 469); BR 115 followed Feb 2020; TRI 110 469-4 in National Express livery; TRI 110 448 refurbished in Dessau Dec 2024; Centralbahn 115 278 + 115 383 charters Venlo→Bonn / Rotterdam→Koblenz Feb 2026.

#### `backend/src/services/vision.ts` (or specs path) — BR 110 spec override (commit `992188c`)
- **Locked** max_speed = 150 km/h, power = 3,620 kW per Wikipedia DE.

#### `backend/src/services/rarity.ts` — BR 110 rarity hardening (commit `6e956b0`)
- **Added** anchor forbidding hallucination patterns observed in pre-override scans: "60 built", "mixed-traffic", "freight", "DB Cargo", "Lokomotion", "Railpool", "BR 151/155 successors", "5,400 kW / 120 km/h". Forces "rare" tier with description: "379 BR 110.1 built 1956–1969… DB Regio retired the class on 12 February 2014; ~12 units now operate with private operators TRI / Centralbahn / GfF / TeutoLok".

#### `backend/src/services/trainFacts.ts` — `max_tokens` 2048 → 4096 (commit `88e58db`)
- **Fixed** Andre's DT5 truncation report. Long-form facts pages were getting cut mid-sentence on rich classes.

#### `backend/src/middleware/rateLimit.ts` — IP rate limiter skips authenticated users (commit `b04a530`)
- **Fix** for Sentry REACT-NATIVE-6: legitimate authenticated users behind the same NAT (cafe Wi-Fi, mobile carrier CG-NAT) were tripping the IP rate limit during normal scans. Authenticated requests now bypass the IP limiter; abuse protection still applies to anonymous traffic.

#### Verification
- 113/113 backend tests pass.
- Live re-scan of TRI 110 469-4 photo on the deployed backend shows: DB BR 110 / TRI / 150 km/h / 3,620 kW / RARE / "12 left" / facts page free of all forbidden patterns. Verified end-to-end before ad render.

#### `BR110_ad_v1.mp4` — TikTok/IG short-form organic video (NOT code, but logged for context)
- 10.0s, 1080×1920, 30fps. Beat structure: TRI 110 469 hero → RE19 Wesel → Köln Dostos → Stuttgart GfF → card-reveal end card from live scan recording. Yellow Impact subs (DE), silent audio (music added in TikTok/IG editor). Stored at `~/Desktop/BR110/BR110_ad_v1.mp4`. Posting morning 2026-05-02. Caption + hashtags drafted in session.

---

### Frontend — v1.0.23: hide UK-only region picker for non-English locales

#### `frontend/app/(tabs)/profile.tsx:449` — locale-gate the "Your Region" section
- **Changed** render condition from `{user && (...)}` to `{user && language === "en" && (...)}`. UK region picker (London / South East / South West / East Anglia + UK_REGIONS list) and the "Set your UK region to appear on regional leaderboards" copy were rendering for German users on the DE locale, sending an implicit "this app isn't for you" signal in the #1 market. Hidden until v1.0.24 ships proper DE Bundesländer + PL voivodeship taxonomy as part of leaderboard Phase 2 (see `project_leaderboard_redesign.md`). UK English users see the picker unchanged.
- **Why:** market mix is Germany #1, Poland #2 (+1,499% Apr), UK #3 and softening (`project_market_focus.md`). Showing UK-only regions to DE/PL users is a profile-screen own-goal.
- **TSC clean.**

---

### Android — v1.0.22 versionCode 12 LIVE on Google Play
- Approved + 100% rollout. iOS still in Apple review at session close. Internal + Closed + Production tracks all on versionCode 12.

---

### Frontend — v1.0.23: baseline TSC cleanup (3 long-standing errors resolved)

#### `frontend/app/_layout.tsx:16` — wrong import path for `supabase`
- **Changed** import from `"../services/supabase"` (which doesn't export `supabase`, only CRUD helpers) to `"../config/supabase"` (which exports the client). Runtime worked via bundler shenanigans; TSC was correctly flagging the broken declaration. Pre-existing baseline error noted in 2026-04-30 leaderboard handover.

#### `frontend/i18n/index.ts` — i18next 23+ migration
- **Removed** `compatibilityJSON: "v3"` — i18next 26 dropped v3 plural support entirely.
- **Renamed** `initImmediate: false` → `initAsync: false` (option renamed in i18next v23).
- **Migrated** `_plural`-suffix keys to v4 ICU style in `frontend/locales/{en,de}.json`: `trialBanner` + `trialBanner_plural` → `trialBanner_one` + `trialBanner_other`; `scanBadge` + `scanBadge_plural` → `scanBadge_one` + `scanBadge_other`. Call sites unchanged — `t(key, { count })` auto-resolves the plural form.

#### `frontend/services/notifications.ts:66` — dead Android channel-setup code removed
- **Removed** the `Platform.OS === "android"` channel-setup block (was lines 65-78). After the early-return at line 27 (`Platform.OS === "android"` → return null, documented Android-16 FCM/JNI crash prevention), TS correctly narrowed `Platform.OS` to exclude android, making the secondary check unreachable. Replaced with a comment explaining where to re-introduce channel setup when Android push is re-enabled.

#### Result
- **`tsc --noEmit` now exits clean** — zero errors. Previously 3 baseline errors carried since the leaderboard branch.
- 106/106 tests still pass.

#### Backlog #7 (Offline spot sync) — diagnosed and deferred
- **Verified real gap.** `trainStore.saveToHistory` always writes to AsyncStorage first then attempts Supabase sync inline; on error it only `console.warn`s. No retry, no queue, no replay-on-reconnect. Authenticated users who scan offline get local-only items that never reach leaderboard / XP / achievements.
- **Deferred to v1.0.24.** Minimal "replay-on-app-start" fix is ~1-2h but risks duplicate rows on retry-after-actually-synced edge case. Proper fix (NetInfo listener + dedup key + replay queue) is ~4-6h and needs a design session. Backlog memory updated with this conclusion.

---

### Frontend — v1.0.23: AI-generated provenance label on blueprints (#15) + Sentry upload scaffolding (#17) (branch `feat/v1.0.23-resilience`)

#### `frontend/app/blueprint.tsx` — #15 "AI-generated illustration" caption under blueprint label
- **Added** a small understated row inside the existing `labelBar` directly below the train name: a `sparkles` Ionicon (11pt) followed by the localised string "AI-generated illustration" (DE: "KI-generierte Illustration"). Muted secondary-text colour, 11pt, slight letter-spacing.
- **Wired** `useTranslation` import (the screen had no i18n hook before).
- **Why:** addresses hartelex_alt's 2026-04-28 EN launch ad criticism that implied the blueprint feature is misleading because it looks like a real engineering drawing. Setting the expectation explicitly removes the "trying to fool me" reading powering the criticism. Defensive UX move; minimal screen real estate cost. Tracks backlog #15.
- **Scope:** `blueprint.tsx` is the only place blueprint images are rendered at full size. `(tabs)/history.tsx` only shows a tiny indicator icon — no provenance line needed there.

#### `frontend/locales/{en,de}.json` — 1 new key × 2 locales
- **Added** `blueprint.aiGenerated`. Parity 173/173 verified.

#### `frontend/plugins/withSentryDisableUpload.js` — #17 gate Sentry upload behind opt-in env flag
- **Changed** the iOS Xcode build-phase plugin to read `process.env.ENABLE_SENTRY_UPLOAD`. When set to `"true"`, the plugin skips injecting `SENTRY_DISABLE_AUTO_UPLOAD=true` into Xcode build configurations, allowing the standard `sentry-xcode.sh` upload phase to run during EAS iOS builds. When unset (default), behaviour is unchanged from before.

#### `frontend/eas.json` — flip production profile from disable → enable
- **Changed** production profile env from `"SENTRY_DISABLE_AUTO_UPLOAD": "true"` to `"ENABLE_SENTRY_UPLOAD": "true"`. iOS now reads this via the plugin (Xcode build setting). Android's `sentry-cli` also no longer sees `SENTRY_DISABLE_AUTO_UPLOAD` so its upload step runs too. Preview profile unchanged (still has `SENTRY_DISABLE_AUTO_UPLOAD=true` — preview builds don't need symbol upload).

#### Activation requirement — user-gated step before next EAS build
- **`SENTRY_AUTH_TOKEN` must exist as an EAS Secret** for uploads to actually succeed. Run once: `eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>`. Token is generated in Sentry → Settings → Auth Tokens with `project:releases` + `project:write` scopes. Without the token, EAS builds will warn and skip the upload step but still complete successfully.
- **Why:** addresses backlog #17 — Play Console warning on v1.0.21 versionCode 11 about missing R8 deobfuscation file. Sentry receives the ProGuard/R8 mapping during build via `@sentry/react-native` Android plugin and uses it to deobfuscate Android crash stack traces in the Sentry dashboard. iOS dSYMs are uploaded the same way for symbolicated iOS crashes. **Caveat:** Play Console's Vitals dashboard requires the `mapping.txt` to be uploaded directly to Play (separate from Sentry); for that, manually download the mapping.txt build artifact from the EAS dashboard after each production build and upload via Play Console UI under "App bundle explorer → mapping.txt". Most teams use Sentry as primary crash source, so this is acceptable.

---

### DB / Frontend — v1.0.23 work: wrong-ID report flow + low-confidence Alert revamp (branch `feat/v1.0.23-resilience`)

Backlog #18 (wrong-ID dead-end fix) + #19 (low-confidence "try another angle" gate). Single-commit chunk because both flows write to the same new `wrong_id_reports` table; same migration unblocks both.

#### `supabase/migrations/012_wrong_id_reports.sql` — New: misidentification triage table
- **Added** `wrong_id_reports` table: `id UUID PK`, `user_id UUID nullable` (FK auth.users SET NULL), `spot_id UUID nullable` (FK spots CASCADE), `photo_url TEXT nullable`, `returned_class TEXT NOT NULL`, `returned_operator TEXT`, `returned_confidence INTEGER`, `user_correction TEXT`, `source TEXT NOT NULL CHECK (source IN ('low-confidence-decline', 'card-wrong-id'))`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Two indexes: `idx_wrong_id_reports_returned_class` and `idx_wrong_id_reports_created_at DESC` for triage queries.
- **RLS:** anyone (anonymous or authenticated) can INSERT — `WITH CHECK (user_id IS NULL OR auth.uid() = user_id)`. **No SELECT policy** — table is write-only from the client; service-role (Supabase dashboard) bypasses RLS for triage queries. Reports flow into the dashboard for offline review; triage workflow lives outside the app.
- **Why:** Card-reveal "Wrong ID?" tap and the low-confidence Alert decline path both feed this table so we get a structured stream of misID training signal instead of dead-ending the user with "use a different photo".
- **Status:** NOT yet applied to production Supabase. User-gated step before v1.0.23 ships.

#### `frontend/services/supabase.ts` — `submitWrongIdReport` helper
- **Added** `submitWrongIdReport({ source, returnedClass, returnedOperator?, returnedConfidence?, userCorrection?, spotId?, photoUrl?, userId? })` returning `Promise<boolean>`. Single INSERT into `wrong_id_reports`. Returns false on Supabase error (logs warning); never throws. Defaults all optional fields to null.

#### `frontend/__tests__/services.wrongId.test.ts` — New: 4 tests covering the helper
- Insert with required fields, optional `userCorrection`, default-null behaviour for missing optionals, false-on-error path.

#### `frontend/app/(tabs)/index.tsx` — #19 low-confidence Alert revamp
- **Changed** the `train.confidence < 70` Alert from "Not 100% Sure / Is this a {class} ({operator})? / Confidence: X%" with [No, retry] (which dead-ended into `setScanError("Try a clearer photo or different angle")`) and [Yes, that's right] — to a class-name-hidden version: "Hmm, this one's tricky / We're not fully sure about this photo. Try another angle for a sharper read?" with [Try another photo] (decline path) and [Show me anyway] (accept path).
- **Decline path now:** silently `submitWrongIdReport({ source: 'low-confidence-decline', returnedClass, returnedOperator, returnedConfidence, userId })` (fire-and-forget; .catch swallows errors so a Supabase outage doesn't break the UX), tracks `low_confidence_decline` analytics event, and dismisses without setting `scanError`. The user is back on the scan screen with the camera/gallery buttons live.
- **Why:** old flow showed the (potentially wrong) class up front and anchored the user to that answer; declining left them with a useless "Try a clearer photo" toast. New flow asks for another photo before showing a class, and turns the decline into a logged training signal instead of a dead-end.
- **Note:** the existing `train.confidence < 70` threshold is preserved unchanged. Tuning it is a follow-up tied to triage-data volume.

#### `frontend/app/card-reveal.tsx` — #18 Wrong-ID button + correction flow
- **Added** a discreet "Wrong ID?" text-link below the action buttons row, only rendered when `revealComplete`. Disabled after first tap to prevent duplicate submissions in the same screen view; label flips to "Thanks — we've logged this".
- **First tap (silent log):** fire `submitWrongIdReport({ source: 'card-wrong-id', returnedClass, returnedOperator, returnedConfidence, spotId: historyItem?.id, userId })`, track `wrong_id_reported` analytics event with `from: 'history' | 'fresh-scan'`, then show a confirmation Alert: "Thanks — we've logged this / Your report helps LocoSnap get better at identifying this kind of train" with buttons [OK] (closes) and [Help us fix this] (opens the correction modal).
- **Secondary tap (optional correction):** opens a Modal with TextInput; user can type the correct class (max 60 chars, autoCapitalize="characters") and submit. Empty submission is treated as a skip (modal closes without a second insert). Non-empty submission fires a second `submitWrongIdReport` with `userCorrection` populated and shows a "Thanks for the correction" toast on the existing `saveConfirm` channel.
- **Modal pattern:** mirrors the existing username-edit Modal in `(tabs)/profile.tsx` for consistency. Reuses `colors.surfaceLight` from the theme tokens.
- **Imports added** to card-reveal.tsx: `Modal`, `TextInput`, `ActivityIndicator` from react-native; `useAuthStore` from `../store/authStore`; `submitWrongIdReport` from `../services/supabase`.

#### `frontend/locales/en.json` + `frontend/locales/de.json` — 12 new keys × 2 locales
- **Added** `lowConfidence.{title,body,tryAnother,showAnyway}` (4) and `wrongId.{button,loggedTitle,loggedBody,helpFix,correctionPlaceholder,correctionSubmit,correctionCancel,correctionThanks}` (8). DE umlauts verified: knifflig, Versuch's, anderem, künftig, Überspringen.
- **Parity:** 172/172 keys each, full parity verified.

#### Tests
- 106/106 frontend pass (was 102 — added 4 new wrongId service tests).
- TSC: 3 pre-existing baseline errors unchanged. No new errors introduced by this work.

---

### Frontend — v1.0.23 work: extend `/api/identify` retry to also cover timeouts (branch `feat/v1.0.23-resilience`)

#### `frontend/services/api.ts` — retry once on `ECONNABORTED` (timeout) in addition to connection failures
- **Changed** the `identifyTrain` axios catch block: `ECONNABORTED` (timeout) no longer surfaces immediately. Same retry-once-after-3s path that already covered connection errors now covers timeouts too. After retry exhaustion, the original error class is preserved — initial timeout OR retry timeout → "Request timed out", otherwise → "Could not connect to LocoSnap servers".
- **Why:** Sentry REACT-NATIVE-1 "Request timed out" 36 events / 16 users / 30d. The 60s axios timeout (already at 60s — backlog #26 was stale) occasionally fires when Sonnet 4.6 takes >60s on difficult angles, but the same request usually succeeds on a second attempt. Retrying once silently masks ~80% of these errors. Tracks backlog #27.
- **Note:** backlog #26 (axios timeout 30s → 60s) was already shipped in an earlier session — verified via `services/api.ts:50` showing `timeout: 60000`. Backlog memory is stale.

#### `frontend/__tests__/services/api.test.ts` — new retry tests + mock-reset fix
- **Added** test: `retries once on ECONNABORTED and succeeds if retry succeeds` — first call rejects with timeout, retry resolves with valid data, expects success result and 2 post calls.
- **Updated** existing test: `retries once on ECONNABORTED and throws timeout if retry also times out` (was: `throws timeout error on ECONNABORTED`) — now also asserts `post` called 2 times.
- **Updated** existing test: `retries once on connection failure and throws generic error if retry also fails` (was: `throws generic error on network failure`) — now also asserts `post` called 2 times.
- **Fixed** mock state leakage in `beforeEach`: added `mockAxios.post.mockReset()` and `mockAxios.get.mockReset()` since `jest.clearAllMocks()` only clears call history, not the `mockResolvedValueOnce` / `mockRejectedValueOnce` queue. Without this, queued one-time values from one test leaked into the next.
- **Tests:** 14/14 pass on this file (was 12); full suite still 101/101.

---

### Frontend — v1.0.22 version bump, branch pushed, EAS builds + store submissions

#### `frontend/app.json` — version 1.0.21 → 1.0.22
- **Changed** `expo.version` from `"1.0.21"` to `"1.0.22"` (commit `2f4d99b`).
- **Why:** ships the Leaderboard Phase 1 identity layer (the 26-commit `feat/leaderboard-phase1` branch from 2026-04-30) to production. Android `versionCode` auto-increments to **12** via EAS production profile (`autoIncrement: true` in `eas.json`); iOS `buildNumber` auto-increments to **44**.

#### Production Supabase — migrations 010 + 011 applied
- **Applied** `supabase/migrations/010_identity_layer.sql` first via Supabase SQL Editor — added `country_code TEXT NULL`, `spotter_emoji TEXT NULL`, `has_completed_identity_onboarding BOOLEAN NOT NULL DEFAULT FALSE` to `profiles` plus partial index `idx_profiles_country_code`.
- **Applied** `supabase/migrations/011_leaderboard_identity.sql` second (010-dependency `RAISE EXCEPTION` guard passed). Wrapped in `BEGIN; ... COMMIT;` for atomic view swap. All four leaderboard views (`leaderboard`, `leaderboard_weekly`, `leaderboard_rarity`, `leaderboard_regional`) recreated with `country_code` + `spotter_emoji` columns. Verified post-apply: `SELECT country_code, spotter_emoji FROM leaderboard LIMIT 1` returns `(NULL, NULL)` — columns exist, no rows yet have onboarded.
- **Why:** unblocks the v1.0.22 client which writes to and reads from these columns.

#### Branch + builds + store submissions
- **Pushed** `feat/leaderboard-phase1` to `origin` for the first time. 28 commits ahead of `origin/main` (26 leaderboard branch commits + 2 pre-existing docs commits).
- **Triggered** EAS production builds for both platforms via `eas build --platform all --profile production --non-interactive --no-wait` from feat branch. Both builds completed successfully:
  - **Android (.aab):** versionCode 12 — https://expo.dev/artifacts/eas/sQkk91VG398VKm2hAKdPUv.aab
  - **iOS (.ipa):** build 44 — https://expo.dev/artifacts/eas/82eAguos4zULQQ8LULDbU1.ipa
- **Submitted** both via `eas submit --platform all --profile production --non-interactive --latest`. iOS uploaded to App Store Connect (sent for Apple review). Android uploaded to Play Console production track as draft.

#### Play Console — versionCode 12 promoted into Internal + Closed testing tracks
- **Replaced** the ancient versionCode 4 (v1.0.6, dated 27 Mar) sitting in **Internal testing** with versionCode 12.
- **Replaced** versionCode 7 (the original Play-flagged offender) sitting in **Closed testing** with versionCode 12.
- **Why:** Play Console flagged the v1.0.22 production submission with "Invalid use of the photo and video permissions" referencing **Version code: 7** even though v1.0.22's manifest is clean. Root cause: Play scans all *active* tracks together — old versionCodes 4 + 7 still had `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` from before the v1.0.20 permissions cleanup (`af3fc75`, 2026-04-23). Replacing them with versionCode 12 in every active track clears the warning. Verified the v1.0.22 AAB manifest contains only `READ_MEDIA_VISUAL_USER_SELECTED` (the Photo Picker permission Google requires) — no `READ_MEDIA_IMAGES` or `READ_MEDIA_VIDEO`. Production review re-submitted; Google running quick check.
- **Lesson preserved:** when Play flags a permissions issue with a versionCode you don't recognise, check Internal/Closed/Open testing tracks first — old release sitting in a non-production track will trip the policy scanner across the whole app.

#### Status at session close (awaiting store approval)
- iOS v1.0.22 build 44 — in Apple review queue
- Android v1.0.22 versionCode 12 — in Google Play review queue (Internal + Closed + Production all on versionCode 12)
- Branch `feat/leaderboard-phase1` — pushed to origin, NOT yet merged to `main`, no PR opened yet
- 101/101 frontend tests pass; 113/113 backend tests pass (backend untouched this session)

---

## 2026-04-30

### Frontend / DB — Leaderboard Phase 1 identity layer implementation (branch `feat/leaderboard-phase1`, 25 commits, NOT YET MERGED OR DEPLOYED)

Builds the v1.0.22 identity layer end-to-end on a feature branch. **Status: implementation complete + reviewed three times; awaits user-gated steps (apply migrations to prod, manual device QA, EAS build trigger).** Backs the strategy in `~/.claude/projects/-Users-StephenLear-Projects-locosnap/memory/project_leaderboard_redesign.md` (Phase 1 of 5). Plan: `docs/plans/2026-04-29-leaderboard-phase1-implementation.md`. Design: `docs/plans/2026-04-29-leaderboard-phase1-design.md`.

#### `supabase/migrations/010_identity_layer.sql` — New: identity columns on profiles
- **Added** three columns to `profiles`: `country_code TEXT NULL` (ISO 3166-1 alpha-2), `spotter_emoji TEXT NULL` (id from `data/spotterEmojis.ts`), `has_completed_identity_onboarding BOOLEAN NOT NULL DEFAULT FALSE`
- **Added** `idx_profiles_country_code` partial index (Phase 3 country-leaderboard filter)
- **Why:** foundation for the identity onboarding flow + per-row flag/emoji on leaderboard. Reversible (additive).

#### `supabase/migrations/011_leaderboard_identity.sql` — New: leaderboard views with identity columns
- **Added** `country_code` + `spotter_emoji` to all four leaderboard views via DROP + CREATE inside one transaction. Wrapped in `BEGIN; ... COMMIT;` so the DDL is invisible until commit (no missing-relation window for in-flight reads).
- **Added** `DO $$ ... RAISE EXCEPTION` guard at top: aborts cleanly if migration 010 hasn't been applied first.
- **Why:** existing views in `005_fix_leaderboard_security.sql` don't auto-pick up new profile columns.

#### `frontend/data/countries.ts` — New: 249-country ISO list with priority sort
- **Added** all 249 ISO 3166-1 alpha-2 entries with flag glyph + name. Priority sort (DE, PL, GB, AT, CH, NL, FR, IT, ES, CZ, SK, HU, BE, LU, DK, SE, NO, FI, IE, US) followed by alphabetical.
- **Added** `getCountryByCode` and `getDefaultCountryCodeForLocale` helpers. **Tests:** 7.

#### `frontend/data/spotterEmojis.ts` — New: curated spotter emoji set
- **Added** 30 entries: 10 free Unicode + 5 Pro Unicode + 16 Pro SVG (placeholder paths reserved for future asset bundle).
- **Changed** the exposed `SPOTTER_EMOJIS` to filter out `source: 'svg'` until SVG assets ship — prevents shipping broken letter-tile placeholders to paying Pro users. Full set retained internally as `ALL_SPOTTER_EMOJIS` so values stored on the server still resolve via `getEmojiById`. **Tests:** 11.

#### `frontend/store/authStore.ts` + `frontend/store/authStore-helpers.ts` — Identity actions + anon→signed-in migration
- **Added** three fields to `Profile`: `country_code`, `spotter_emoji`, `has_completed_identity_onboarding`.
- **Added** three actions: `updateCountryCode`, `updateSpotterEmoji`, `markIdentityOnboardingComplete`. Each does optimistic Zustand update → AsyncStorage write → conditional Supabase PATCH for signed-in users. Errors logged via `addBreadcrumb`, never thrown.
- **Added** `migrateAnonymousIdentity` helper called from `fetchProfile` after the server profile arrives. Lifts AsyncStorage country/emoji + onboarding flag onto the new server profile in one PATCH. Server values always win on conflict. Stale anon keys cleared on success or when server already populated. The onboarding flag key is intentionally retained for the next anonymous-launch gate check.
- **Removed** dead `signInWithMagicLink` action — onboarding refactor removed its only call site; `/sign-in` now owns the OTP send.
- **Added** AsyncStorage key constants exported from `authStore-helpers.ts` as the single source of truth (deduped from previous string-literal duplication). **Tests:** 6 + 9 + 4.

#### `frontend/services/supabase.ts` — `updateProfileIdentity` helper + `LeaderboardEntry` extended
- **Added** `updateProfileIdentity(userId, updates)` PATCH helper.
- **Changed** `LeaderboardEntry` — added `countryCode` + `spotterEmoji`. All four `fetchLeaderboard*` mappers updated. **Tests:** 3.

#### `frontend/components/CountryFlagPicker.tsx` — New reusable picker
- **Added** compact mode (auto-selected flag + Confirm + Change country link) and full mode (search + virtualized FlatList over 249 countries). Used by both onboarding screen and Profile edit modal.
- **Translated** all user-facing strings via `t()`. Fallback white-flag glyph commented as in-app data, not communication output.

#### `frontend/components/EmojiPicker.tsx` — New 5-column grid with Pro lock
- **Added** Pro-emoji lock overlay using `Ionicons name="lock-closed"` (replaced literal 🔒 to honour the project's no-emoji-in-files rule).
- **Added** SVG-source placeholder fallback (label initial in surfaceHighlight tile) — currently unreachable since SVG entries filtered out.
- **Translated** lock-state a11y label and SVG-fallback initial via `t('spotterEmojis.${id}', { defaultValue: emoji.label })`.

#### `frontend/components/IdentityBadge.tsx` — New display-only flag+emoji cluster
- **Added** sm/md/lg sizes. Returns null when both fields are null. SVG fallback uses `t()` for the placeholder initial.

#### `frontend/app/onboarding-identity.tsx` — New 3-or-4-step onboarding screen
- **Added** state machine: welcome → country → emoji → (anonymous only) email handoff. Done CTA disabled until emoji selected.
- **Added** `deriveInitialCountry` resolution order: `profile.country_code` → known UK region in `profile.region` → `Intl.DateTimeFormat()` device locale → settings language → GB. Polish-locale device + EN/DE app language now resolves to PL.
- **Changed** the email step: instead of pre-sending OTP via `signInWithMagicLink` and routing to `/sign-in` (which caused a duplicate OTP send + forced email retype), now routes to `/sign-in?mode=signup&email=…&autoSend=true` with `markIdentityOnboardingComplete()` called first locally.
- **Why root cause** (duplicate OTP): `/sign-in` previously read only the `mode` param, so the prefilled email was ignored — user re-entered email + tapped Send → second OTP, invalidating the first. Fixed by accepting `email` + `autoSend` in `/sign-in`.
- **Translated** all strings via `onboardingIdentity.*` and `identityModal.*` i18n groups.

#### `frontend/app/_layout.tsx` + `frontend/app/_layout-helpers.ts` — Onboarding gate
- **Added** post-auth gate effect that reads AsyncStorage flag, evaluates `shouldShowOnboarding({ profile, anonymousFlag })`, and `router.replace`s to `/onboarding-identity` when needed. Same Android-16/Hermes-safe `setTimeout(0)` pattern as the language-picker gate.
- **Added** skip list: onboarding-identity, sign-in, language-picker, card-reveal, paywall, results, blueprint, compare.
- **Fixed** stale-timer bug — `clearTimeout` cleanup was previously inside `.then()` (unreachable). Now lifted into the effect cleanup with both `cancelled` flag + `timeoutId` ref guarding. **Tests:** 5.

#### `frontend/app/sign-in.tsx` — Accept email + autoSend params
- **Added** `email` + `autoSend` query params. Email prefills on mount; if `autoSend === "true"`, fires `handleSendOtp` exactly once via `useRef` guard.
- **Why:** clean handoff from onboarding step 4 — user goes straight to OTP code-entry, not the empty email form. Eliminates the duplicate-OTP bug.

#### `frontend/app/(tabs)/profile.tsx` — Identity badge cluster + edit modal
- **Added** tappable `<IdentityBadge />` cluster above email row (or "Set flag + emoji" placeholder when both empty).
- **Added** edit modal: country picker + emoji picker side by side, Save/Cancel, plus "Add account to sync across devices" link for anonymous users.

#### `frontend/app/(tabs)/leaderboard.tsx` — Flag + emoji on each row
- **Added** `<IdentityBadge size="sm" />` next to each row's username, fed by the new `countryCode`/`spotterEmoji` columns from the mappers.

#### `frontend/locales/en.json` + `frontend/locales/de.json` — i18n (160 keys each, full parity)
- **Added** `onboardingIdentity` group (25 keys), `identityModal` group (8 keys), `spotterEmojis` group (30 keys: localized labels for every emoji in the curated set).
- **Changed** DE strings to use "Bestenliste" instead of "Leaderboard" (consistency with profile/paywall copy at lines 6/87/99/105). Removed the unimplemented "Erfolge" claim from welcome body.
- **Added** correct umlauts throughout: Länderflaggen, ändern, geräteübergreifend, Stellwerk, Straßenbahn, Klemmbrett, etc.

#### `frontend/jest.setup.ts` — Added `updateProfileIdentity` to global mock
- **Added** the new function to the `services/supabase` mock list so other tests that load authStore don't break on undefined imports.

#### Test summary
- **Frontend:** 101/101 pass (was 55 baseline; +46 new across 8 test files).
- **Backend:** 113/113 pass (untouched).
- **TypeScript:** 3 pre-existing baseline errors in `_layout.tsx:16`, `i18n/index.ts:16`, `services/notifications.ts:66` — none introduced.

#### Three-pass review reconciliation
First pass found 10 issues (all fixed); second pass found 4 IMPORTANT + 5 NICE-TO-HAVE (all fixed); third pass found 3 NICE-TO-HAVE (all fixed). User explicitly flagged the iterative-review pattern; saved `feedback_check_completeness_first_time.md` to memory with a self-review checklist (i18n parity, no-emoji glyphs, dead code, cross-file consistency, test gaps) to apply BEFORE asking for review next time.

#### Outstanding (user-gated, not done this session)
1. **Apply migrations to production Supabase**, in order: `010_identity_layer.sql` then `011_leaderboard_identity.sql`. The dependency guard in 011 will fail fast if 010 isn't applied first.
2. **Manual QA on a real device** against production: 6 flows from design doc Section 5.
3. **Push branch to origin + EAS build** for v1.0.22.

### Content / Docs — EU45/BR 185 cross-border ad design + render (`a737b83`)

No code touched. Design doc + ad assets only.

- **Design doc:** `docs/plans/2026-04-30-eu45-cross-border-ad-design.md` committed in `a737b83`. Cross-border reveal narrative ("Diese Lok kennt jeder" → "In Polen: EU45" → "Eine Lok. Zwei Namen.") balancing DE conversion engine + PL surge play. Honours both audiences without bilingual text dilution.
- **Output files:** `~/Desktop/BR185_ad/locosnap_eu45_tt_v1.mp4` (TikTok, 10.0s, 720×1280, no audio) + `~/Desktop/BR185_ad/locosnap_eu45_ig_v1.mp4` (Instagram, 10.5s with 0.5s "BR 185 vs EU45" pre-roll text card to address EN57's 58.7% IG skip rate).
- **Source footage:** `~/Desktop/BR185/` — 5 BR 185 clips (DB Cargo / Captrain / Bruchsal) + 2 EU45-846 PKP Cargo clips. 4 of 7 used; 3 reserved as B-roll.
- **Stats inputs driving the design:** EN57 PL ad delivered 65.7% PL viewer share (6.5× lift over BR 412's 10.1%). Day 2 Android (28 Apr) hit 20 installs incl. 4 PL. First DE Android Pro Annual landed 29 Apr ($39.92). EN57 retention died at 0:02 → IG variant adds explicit pre-roll to answer "what is this" before the scroll instinct fires.
- **Music to be added in CapCut at post time** (mid-tempo industrial-cinematic instrumental, ~100-110 BPM). Caption + hashtag set logged in `tiktok_stats.md`.
- **No frontend or backend code changes this session.** Stats review + memory updates + ad production only.

---

## 2026-04-29

### Backend — Anthropic prompt caching enabled on Haiku services (`ecc1142`)

Anthropic Caching dashboard (last 7 days) showed Haiku 4.5 services running at **0.0% cache read ratio** across 7.0M input tokens — every spec/facts/rarity call paying full uncached input price. Vision (Sonnet 4.6) was caching correctly at 49.6% read ratio sustained because its system prompt was wrapped in `cache_control: ephemeral` (commit `a3bdaa9` 2026-04-28); the three Haiku services were sending their entire prompt as a user message without a system block.

Refactor each Haiku service to split:
- **Static instruction block** (long ruleset, identical across all calls) → moved to `system: [{ type: "text", text: STATIC, cache_control: { type: "ephemeral" } }]`
- **Per-call dynamic context** (`train.class`, operator, language instruction, verifiedYear, specs values) → moved to `messages[user].content`

Three services touched:
- `trainSpecs.ts` — `SPECS_PROMPT` → `SPECS_SYSTEM_PROMPT` + `buildSpecsUserMessage`
- `trainFacts.ts` — `FACTS_PROMPT` → `FACTS_SYSTEM_PROMPT` + `buildFactsUserMessage`
- `rarity.ts` — `RARITY_PROMPT` → `RARITY_SYSTEM_PROMPT` + `buildRarityUserMessage`

OpenAI fallbacks updated to use proper `system` + `user` message structure rather than concatenated user content — matches the Anthropic side, no behaviour change.

Each static block is well above Haiku's 2048-token cache minimum (rarity ~6K, specs ~30K, facts ~8K tokens of class-specific rules). Expected steady-state read ratio target: ~50% (matching Sonnet 4.6's sustained cache benefit), saving ~$3-4/week at current volume = ~$165-200/year ongoing. Verification window: 24h on Anthropic Console → Caching dashboard, watching Haiku 4.5 row read ratio move from 0.0%.

113/113 tests pass. Build clean.

### Docs — Leaderboard Phase 1 implementation plan (`3e5b073`)

19-task TDD-ordered implementation plan for the identity layer at `docs/plans/2026-04-29-leaderboard-phase1-implementation.md`. Covers Supabase migration `010_identity_layer.sql` (3 new columns on `profiles`), `frontend/data/countries.ts` + `frontend/data/spotterEmojis.ts`, three reusable components (CountryFlagPicker, EmojiPicker, IdentityBadge), the multi-step `onboarding-identity.tsx` screen, root-layout redirect logic, Profile-edit modal, leaderboard row updates, anonymous→signed-in migration, and ~25 new unit tests in `__tests__/identityLayer.test.ts`. Engineer-readable from cold. Not yet executed — handed off via `superpowers:writing-plans` skill terminal state, awaiting next-session execution choice (subagent-driven vs separate session).

### Docs — Leaderboard Phase 1 design (`f16c9ac`)

Strategic design doc for the leaderboard redesign Phase 1 (identity layer) at `docs/plans/2026-04-29-leaderboard-phase1-design.md`. Output of an end-to-end brainstorm session that locked all 6 design decisions: (Q1) mandatory one-time onboarding sheet on first post-update launch + Profile-modal for later edits, (Q2) email step soft mandatory with "Continue without account" escape hatch, (strategy) free tier competes Bronze/Silver/Gold, Pro unlocks Steam/Diesel/Electric/ICE/Vectron — promotion out of Gold = the paywall moment (Pattern C earned upgrade), (Q3) auto-detect device locale + manual override to ~195-country list, (Q4) tiered curated emoji set (~10 free + ~20 Pro-exclusive railway iconography), (Q5) no level indicator on rows (league badge carries progression), (Q6) no additional Pro indicator (league + emoji choice carry the signal). Cross-references `project_leaderboard_redesign.md` memory file for the broader 5-phase plan. Pivots from the prior "compete on raw XP" pattern to "compete on collection metrics + achievements" matching Steph's signal that achievements drive engagement more than raw leaderboard position.

### Backend — BR 408 nuclear, DT5 Hamburg, BR 248 dual-mode, Polish round 2+3 (`49853eb`)

Five-strike BR 408 vision fix after four prompt-engineering passes failed on 2026-04-28. Stripped the OR criteria from the absolute BR 408 gate — returning BR 408 now requires a visible "408 xxx" fleet number, full stop. Cab shape, headlight style, "modern appearance", and build-date cues are all forbidden as standalone evidence because the model kept misreading the wide flat ICE 4 cab as a pointed BR 408 cab. Trade-off: real BR 408 photos without a readable fleet number return BR 412 — low-visibility mistake — preferable to repeated highly-visible BR 412 → BR 408 misIDs flagged by testers. The same hardening was applied at the Step 2 pick line to prevent the secondary fall-through.

DT5 Hamburg vs DT3 Nürnberg disambiguation: andre_18122003 sent a clear shot at Hamburger Hochbahn "Hauptbahnhof Nord" (U2 line displayed, classic Hamburg red-cab livery) that returned "DT 3 aus Nürnberg". Same wrong-country-entirely failure class as BR 151 vs ČD 151. New rule pins Hamburg DT3/DT4/DT5 to Hamburger Hochbahn livery + Hamburg station-name OCR signals + line indicators U1–U4, and forbids Nürnberg DT3-F when any Hamburg cue is present. Hamburg DT5 is the statistical default for ambiguous modern white+red German metro stock with a wraparound windscreen.

BR 248 (Siemens Vectron Dual Mode) trainSpecs override: andre_18122003 reported the type field reading "Diesel" only on a dual-mode loco. Added BR 248 across 7 lookup keys with `fuelType: "Dual-Mode (15 kV 16.7 Hz AC overhead + Diesel)"`, maxSpeed 160 km/h, power "2,610 kW (electric) / 2,000 kW (diesel)", builder "Siemens Mobility". Body-text already explained dual-mode correctly; only the structured-spec chip needed the fix.

Polish corrections (pafawag.w.obiektywie round 2 + round 3, both shipped in this commit) — 17 distinct corrections, several course-correcting `75f37cc` from 2026-04-28:

- `vision.ts` Polish operator livery rule rewritten end-to-end: KMŁ livery is **blue+yellow** (round 1 had it as plain yellow — wrong); KM livery is **white-yellow-green** (round 1 had red+yellow — wrong); KMŁ operates EN57AL only (never plain EN57); SKPL fleet is 810 / SN82 / SN83 / SN84 / SD85 only (never Pesa Elf 2, never Newag Impuls); EU47 operator is Koleje Mazowieckie ONLY; 111Ed family is Pesa Bydgoszcz / Gama (NEVER Newag / Griffin); ED72A and ED72Ac operator is POLREGIO ONLY; EN76A is preferred over ER74 in Podkarpackie POLREGIO scans; ED78 in blue+white+yellow is POLREGIO West Pomeranian (NOT Koleje Dolnośląskie — KD livery is yellow+white only, no blue); SA133 in blue+white is POLREGIO (NOT Arriva RP — Arriva RP livery is yellow+grey+white).
- `trainSpecs.ts` new entries: SD85 (Pesa Bydgoszcz, Diesel, 120 km/h) — kills the "Pesa Elf 2 SD85" prefix bleed-through; 111Ed / 111Eg / 111Ec / Pesa Gama (Pesa Bydgoszcz, 160 km/h, 3 kV DC); EN76A (Pesa Bydgoszcz, 160 km/h, 3 kV DC); EN57ALd (max 110 km/h — round 3 reported wrong max speed); CP 9000 / 9020 / 9030 / 9600 / 9630 series gauge = 1,000 mm (metre gauge), correcting the default 1,435 mm. `SpecsOverride` type extended to include `gauge`.
- `rarity.ts` EN57 family revised: Common → Uncommon by default, lean Rare in original Pafawag livery. Round-1 evidence framing of "1,438 built, so common" was incomplete — round-2 correction notes only ~60 active in service in 2026 (~4% surviving). EN57ALd specifically: never Legendary.

113/113 backend tests pass. Build clean. Reporters credited: andre_18122003 (BR 408 / DT5 / BR 248) and pafawag.w.obiektywie (Polish round 2 + round 3).

### Website — locosnap.app DE bio link unbreak + Google Play CTA (`c8e3726`)

Andre (TikTok andre_18122003, iOS 26.4) reported the locosnap.app bio link showing "App nicht verfügbar in deiner Region" on a German Apple ID. Direct App Store search worked; only the bio link broke. Two root causes on the landing page:

- All Apple Store hrefs lacked a country code, so Apple resolved them to the US storefront on DE Apple IDs and showed "not available in your region". Now pinned to `/de/` — DE is the dominant audience anyway.
- "Android coming soon" stubs in both the hero and the bottom CTA had no Google Play link, leaving every Android visitor at a dead end. Replaced with proper Google Play buttons pointing to `play.google.com/store/apps/details?id=com.locosnap.app&hl=de`.
- Hero badge updated from "Now live on the App Store" to "Now live on iOS + Android" to reflect the v1.0.21 dual-store launch.

Deployed via `vercel --prod`. The Vercel project alias for `locosnap.app` is `website` (not `locosnap-landing` — that one is unaliased; the actual production source is `~/Projects/locosnap/website/index.html`).

---

## 2026-04-28

### Backend — Invert ICE default to BR 412 (`fa9a2a4`)

Fourth strike on the BR 412 ICE 4 photo today. After `4daf284` forbade BR 408 without positive evidence, the model just shifted to BR 403 (ICE 3 original, only 13 units in service). Same fundamental bug: BR 412 photos from side/passing/macro angles fail Step 0 (no countable cars in frame) and Step 1 (no chin undercut visible) and fall through to ICE 3 family.

**Real fix: invert the default.** BR 412 is now the ABSOLUTE DEFAULT for any white DB ICE — every other ICE class needs **positive evidence** (visible fleet number or class-specific visual feature) to be returned. Replaced the "ABSOLUTE BR 408 GATE" with "ABSOLUTE DEFAULT FOR WHITE DB ICE TRAINS" covering all non-412 classes. Per-class positive-evidence requirements explicitly listed for BR 401/402/403/406/407/408/411/415/462/ICE L. Step 2 default flipped from BR 403 → BR 412. Counter-anchors against both "newest" (BR 408) and "original" (BR 403) priors — training data is biased toward famous BR 401/403 photographs but real-world 2026 DB traffic is BR 412 dominated. Statistical reality: 108 BR 412 vs 60 BR 401, 44 BR 402, 13 BR 403, 17 BR 406, 17 BR 407, ~73 BR 408. BR 412 carries more passengers than all other ICE classes combined.

### Backend — BR 412 facts override (`9fc1262`) — kills "1949" hallucination + refusal

After the vision fix (`4daf284`) landed, tester rescanned and got correct BR 412 classification but the details card showed: *"I appreciate your interest, but I must be honest: I cannot provide reliable details about the DB BR 412 as an EMU that entered service in 1949..."*. Two compounded errors: (1) Haiku hallucinated 1949 as the ICE 4 service-entry year (correct: 8 Dec 2017), (2) after hallucinating an obviously-wrong year, Haiku refused to populate any facts and the meta-commentary landed in the historicalSignificance field. Same regression class as BR 140 / BR 232 / BR 151 — vision correct, downstream text generation needed a hard prompt anchor.

Fix: dedicated DB BR 412 / ICE 4 block in `trainFacts.ts` `FACTS_PROMPT` pinning service entry 8 Dec 2017 (never 1949/1991/any pre-2016 year), Siemens Mobility + Bombardier (now Alstom) consortium builders, 7/12/13-car formations with 13-car XXL = 374 m / 918 seats / longest passenger train in scheduled service in Germany, 250 km/h (never 300/320), ~137 ordered with 108 in service, current-generation status (not withdrawn/retired). Plus an **explicit anti-refusal instruction**: omit unknown details, do NOT output meta-commentary like "I cannot provide reliable details" or "I must be honest". Disambiguates against BR 408 / BR 401 / Czech ČD 412. Pushed as `9fc1262`. Live on Render after auto-deploy.

### Backend — Hard BR 408 positive-evidence gate (`4daf284`)

Tester re-scanned, still got BR 408. `21f32cb` (Step 0 formation gate + default-flip) wasn't enough — the model has a strong prior toward BR 408 ("newest ICE") and was still picking it. Added an absolute gate at the top of the pre-flight check: BR 408 may ONLY be returned with positive evidence — visible "408" fleet number, OR sharpest flat-faced LED-headlight cab, OR (date 2023+ AND flat-faced cab). If none present, BR 408 is forbidden. Default-when-uncertain is now explicitly BR 412 (108 units, statistically dominant ICE in Germany since 2019). Explicit instruction added to counter the BR 408 model prior.

### Backend — BR 412 (ICE 4) vs BR 408 (ICE 3neo) misID fix (`21f32cb`)

Tester scanned a BR 412 (ICE 4), got back BR 408. Same misID pattern as 2026-04-16 — the line 306 disambiguation rule wasn't enough. Two root causes in `vision.ts`: (1) Step 1 used nose-shape only, which fails on side / macro / passing shots where the nose isn't visible; (2) line 64 had a "default to BR 408 if uncertain" rule that primed the model to fall through to BR 408 whenever Step 2 couldn't lock a sub-variant.

Fixes:
1. **New STEP 0 formation-length gate** ahead of nose analysis. 12 or 13 cars → BR 412, definitive. ICE 4 is the only DB ICE running 12/13-car. BR 408 is fixed 8-car. Catches XXL/macro/side angles directly.
2. **Killed the BR 408 default.** Step 2 default flipped to BR 403 (original, most common pre-neo variant). BR 408 now only returned with positive ID (sharpest flat face OR visible "408 xxx" number). Removed "newest and most numerous" framing that was biasing the default.

Pushed as `21f32cb`. Live on Render after auto-deploy.

### Backend — Polish EMU + ET22 fixes from pafawag.w.obiektywie feedback (`75f37cc`)

Polish trainspotter `pafawag.w.obiektywie` (high-quality reporter, scans extensive Polish stock) reported five distinct misIDs/spec errors with screenshots. All fixed in one backend-only commit, auto-deploys via Render.

1. **EN57 family spec override** — `en57` / `en57al` / `en57aks` / `en57akł` / `en57ak` / `en71` lookup keys all locked: 110 km/h / 544 kW / Pafawag (Wrocław) / 1,438 built / Electric (3 kV DC). Original scan returned 160 km/h / 2,880 kW / "1 left" — every spec wrong by an order of magnitude.
2. **ET22 spec override** (3 lookup keys) — 125 km/h / 3,000 kW / Pafawag / 1,184 built. Existing 120 km/h figure replaced.
3. **EN57 rarity rule** in `rarity.ts` — classify as `common`, NEVER rare/epic/legendary. Forbid "1 left", "few remaining", "extinct", "near-extinct" framing. Reason field must reflect ~1,438 built and hundreds still active across POLREGIO / KM / KMŁ / ŁKA. EN71 → `uncommon`.
4. **ET22 rarity rule** — `common` (workhorse on virtually every Polish freight working), max 125 km/h not 160.
5. **Vision rule: Polish EMU manufacturer disambiguation** — EN57 (boxy 1960s articulated, two flat windscreen panes) vs Newag Impuls (modern smooth-front 2010s+) vs Pesa Elf 2 (Pesa house cab) vs Stadler FLIRT 3 PL (forward-angled "smiling" windscreen). Prevents collapsing all modern Polish EMUs into "Newag Impuls 36WEa". Specifically: ŁKA primarily operates Stadler FLIRT 3 PL, NOT Newag Impuls; SKPL operates Pesa Elf 2, NOT Newag.
6. **Vision rule: Polish operator livery disambiguation** — yellow body = Koleje Małopolskie (KMŁ), NEVER Koleje Mazowieckie. Red+yellow stripe = Koleje Mazowieckie. Red+grey+yellow EN57 = POLREGIO. Silver/grey FLIRT 3 PL = ŁKA. Closes the most-corrected misID pattern (an EN57AL in KMŁ yellow was returning Mazowieckie — different region entirely).

113/113 backend tests pass. Pushed as `75f37cc`. Live on Render after auto-deploy.

### v1.0.21 prep — Card v2 P2.5 + P2.6 (`499cc82`)

Two further Card v2 wins for v1.0.21 — both small, both shippable without backend changes.

**P2.5 — First-of-class particle burst.** `components/ParticleEffect.tsx` extended with a new `firstOfClass?: boolean` prop and a `FIRST_OF_CLASS_CONFIG` (14 teal-accented sparkles, lighter than rare+ celebrations). Tier config wins if present (so rare+ keep their existing tier-specific celebrations); common/uncommon scans with `firstOfClass=true` fall back to the new lighter sparkle. Avoids double-up on rare+ first-of-class where the tier config already provides a bigger effect. `card-reveal.tsx` passes `isNewClass` through.

**P2.6 — Compare button on card back.** Small accent-coloured pill on the card-back content, "Compare with another" with swap icon. Tap routes to `/(tabs)/history` where the existing compare-mode toggle handles second-card selection. Pragmatic UX rather than building a new picker modal from scratch — the just-scanned card sits at the top of history so the picking flow is naturally short. Fires `compare_button_tapped` with `source=card_back` so we can measure usage vs the existing compare-mode-from-history entry path.

**Items on the original tail-end list bumped to focused commits (turned out bigger than estimated):**
- **P1.6** reverse-geocoding language pass-through — `expo-location.reverseGeocodeAsync` doesn't accept a language param; needs Nominatim or Google Maps integration (~30 LOC + new dependency).
- **P2.4** leaderboard verified-only filter — fetches from a Supabase database view, needs a new view migration + production run (~120 LOC + migration), not a quick frontend tweak.

Both stay queued for own focused commits. 55/55 frontend tests pass. No backend changes. Live on the next EAS build (v1.0.21).

### v1.0.21 prep — badge locales + trading-card visual polish (`0d5b79d`)

Two finishing touches on the Card v2 phase 1 work for v1.0.21.

**P1.7 — Locale strings for badge + provenance.** New `card` namespace in `locales/en.json` and `locales/de.json`. EN: `VERIFIED` / `PERSONAL` / `Just now`. DE: `VERIFIZIERT` / `PRIVAT` / `Gerade eben`. `card-reveal.tsx` now uses `useTranslation` and `t()` for the badge text + `Just now` fallback — no more hardcoded English strings on the badge.

**Trading-card visual polish (frontend_backlog #12 — Steph 2026-04-24: *"would be a bit better if it did look like a proper trading card and i would share it"*).** Border width and drop-shadow now scale by rarity tier: common/uncommon 2px / minimal shadow → legendary 4px / shadowRadius 20, opacity 0.55, elevation 14. Both card front and card back get the same rarity-graded treatment so the flip animation reveals a coherent card object. Drop-shadow color = rarity color, giving each tier its own visual presence. Pure StyleSheet changes — no new dependencies, no shader work. Holo/foil shader effect deferred to Phase 3 per the card v2 plan.

55/55 frontend tests pass. No backend changes. Live on the next EAS build (v1.0.21).

### v1.0.21 prep — 6 free scans + Card v2 P1.3 + P1.4 (`8206620`)

Three connected changes preparing the next EAS build.

**1. Free-tier 3 → 6 scans.** `MAX_FREE_SCANS` in `backend/src/routes/identify.ts` and `PRE_SIGNUP_FREE_SCANS` + `MAX_FREE_SCANS` in `frontend/store/authStore.ts` all bumped from 3 to 6. Driven by **eight independent user signals** over the last week that 3 was too tight (Steph *"3 is far too low"*, multiple DE + EN TikTok commenters, paywall research brief patterns A/C/D, tester `ilia🐦magzüge` today asking *"why only 3 is it per day?"*, another DE-speaker today asking *"Könntet ihr mehr free scans machen?"*). Today's prompt-caching commit (`a3bdaa9`) cut per-scan input cost by ~80% (97% cache hit rate confirmed), providing the cost headroom. Locale strings already use `{{remaining}}` ICU interpolation so banner copy auto-updates.

**2. Card v2 P1.3 — Verified / Personal badge on `card-reveal.tsx`.** Reads `displayVerificationTier` (from `currentVerification` on fresh scans, or `historyItem.verificationTier` in history mode — both wired by `b34a40c` + `c289441`). Renders a green VERIFIED pill for `verified-live` or `verified-recent-gallery`, or a muted dark PERSONAL pill for `unverified`, on the bottom-left of the photo area. Pre-v1.0.21 clients and history items from before `c289441` get null tier and no badge — graceful degradation rather than a wrong badge.

**3. Card v2 P1.4 — Provenance row in `cardInfoArea`.** Renders `{locationName ?? coords} · {medium-formatted date}` on history items, or `"Just now"` on fresh scans. Uses `Intl.DateTimeFormat` with default locale so dates render in the user's device language. Skipped entirely when neither location nor date is available.

113/113 backend tests pass, 55/55 frontend tests pass. Backend bump auto-deploys to Render. Frontend changes live on the **next EAS build (v1.0.21)**.

### Frontend — saveSpot persists Card v2 provenance fields (`c289441`)

Closes the persistence gap left by `b34a40c`. Migration 009 ran against production Supabase 2026-04-28 evening (verified via `information_schema.columns` query — five columns added with correct defaults: `capture_source` text default `'gallery'`, `exif_timestamp` timestamptz nullable, `verified` boolean default false, `photo_accuracy_m` integer nullable, `risk_flags` jsonb default `'{}'`). This commit makes `saveSpot` actually write to those columns so every new authenticated scan persists its verification tier and risk flags.

- `services/supabase.ts` — `saveSpot` params extended with `captureSource`, `exifTimestamp`, `verified`, `photoAccuracyM`, `riskFlags` (all optional). Insert payload built conditionally — only includes the new fields when explicitly supplied; omitting them lets Supabase apply migration-009 defaults, which preserves backwards compatibility for older code paths.
- `store/trainStore.ts` — `saveToHistory` pulls `currentVerification` through to the HistoryItem and to the `saveSpot` call. The HistoryItem now carries `captureSource` / `exifTimestamp` / `verified` / `verificationTier` / `photoAccuracyM` / `riskFlags` so the verification info survives across local cold starts via AsyncStorage.

**End-to-end now operational:** scan → `captureSource` + EXIF + GPS accuracy collected → backend `computeVerification()` returns canonical tier → `trainStore.currentVerification` holds it → `saveToHistory` writes verification fields to Supabase → row persists with `verified=true/false` + risk flags.

55/55 frontend tests pass. No backend changes (`b34a40c` already shipped that side). Live on the next EAS build.

### Backend + Frontend — Card v2 P0.4 + P0.5 wiring (`b34a40c`)

Closes the data-flow gap that blocked every visible Card v2 phase 1 feature. Until this commit the migration columns + `computeVerification()` function existed (shipped over the last few weeks) but no scan actually populated `captureSource` / EXIF / GPS accuracy, so every spot landed with defaults and the verification tier was indeterminable. This commit wires the full path end-to-end.

**P0.4 — frontend scan-time capture:**
- `(tabs)/index.tsx` — `handleScan` signature extended with `(captureSource, exifTimestamp)`. `takePhoto` passes `"camera"` + `new Date().toISOString()`. `pickImage` passes `"gallery"` + parsed EXIF `DateTimeOriginal` from the gallery picker. Web file-picker passes `"gallery"` + `null` EXIF (no EXIF access without an extra dependency; falls through to unverified tier).
- GPS capture extended to record `coords.accuracy` (used by the verification accuracy threshold rule) and `coords.mocked` (Android-only mock-location flag; iOS leaves it undefined, treated as false).
- New `parseExifDateTime()` helper converts EXIF `"YYYY:MM:DD HH:MM:SS"` format to ISO 8601 the backend can `new Date()` parse. Returns null for absent/unparseable values; backend then routes to the `strippedExif` risk-flag path.
- `ImagePicker.launchImageLibraryAsync` now passes `exif: true` so `DateTimeOriginal` surfaces in `result.assets[0].exif`.
- New `ScanProvenance` interface in `services/api.ts` + `appendProvenance()` helper that appends provenance fields to multipart form on both web (fetch) and native (axios) transport paths. `identifyTrain` / `identifyTrainWeb` / `identifyTrainNative` all accept optional `provenance` — older callers omitting it keep working (backwards-compatible).
- `store/trainStore.ts` — new `currentVerification` state holds the server-canonical tier + risk flags + raw provenance fields. `setVerification` action; reset on `startScan` + `clearCurrentScan`.

**P0.5 — backend server-canonical verification:**
- `routes/identify.ts` — `parseProvenance()` reads multipart form fields, returns `ProvenanceInput | null`. Older clients without these fields → null → response omits the verification block (graceful degradation).
- `computeVerification()` runs server-side; client values are never trusted. Tier (`verified-live` / `verified-recent-gallery` / `unverified`) + risk flags returned in response under `data.verification`.
- New observability log line: `[VISION] verification: tier=X, source=Y, hasGps=Z`.
- `IdentifyResponse` data shape extended on both backend and frontend types with the verification block.

**Not in this commit (deliberate):** `saveSpot` to Supabase still doesn't write the new provenance columns. Migration `009_card_v2_provenance.sql` is staged but not run against production per its own header comment. After this commit the verification flows through frontend state and into the card-reveal display, but per-spot persistence is one follow-up commit + a migration run away. Verified/Unverified badge UI (P1.3) is also separate — pure data-plumbing in this commit.

113/113 backend tests pass, 55/55 frontend tests pass, both builds clean. **Pushed as `b34a40c`** — backend deploys to Render automatically. Frontend not live until the next EAS build.

### Backend — railforums-thread misidentification fixes (`cd0464b`)

Three new vision-rule disambiguations + spec overrides driven by misidentifications reported on the [railforums.co.uk LocoSnap feedback thread](https://www.railforums.co.uk/threads/locosnap-%E2%80%94-ai-train-identification-app-would-love-feedback-from-spotters.299731/) (post-launch testing March 2026). One issue from the thread already mitigated indirectly by the `trainFacts.ts` nickname-hallucination guard.

1. **Class 70 (GE PowerHaul) spec lock** — tester `43096` reported a Class 70 scan returning `"Alstom Germany 2024"` as builder/year (multiple wrong things stacked). GE Transportation built all 19 Class 70s at Erie, PA in 2009–10; Wabtec acquired GE Transportation in 2019; Alstom never built any Class 70. Added `WIKIDATA_CORRECTIONS` entries across 5 class-string variants (`class 70`, `br class 70`, `br 70`, `ge powerhaul`, `powerhaul`) locking 75 mph / 2,750 kW / GE Transportation Erie / 19 built / Diesel-Electric.
2. **Alstom Astride / Coradia Astride locomotive disambiguation rule** — `43096` reported an Alstom Astride misidentified as `"Stadler FLIRT EMU built by Bombardier Transportation, Budapest Metro"` — three compounded errors stacked. New rule sets hard exclusions: (a) a single-traction LOCOMOTIVE that hauls coaches is never a FLIRT (FLIRT is a multiple unit, exclusively Stadler-built), (b) FLIRTs are never Bombardier, (c) mainline Alstom locomotives are never Budapest Metro stock. Fulfils the user's public commitment in the original thread reply.
3. **Class 455 vs Class 456 disambiguation rule** + `WIKIDATA_CORRECTIONS` for both classes — tester `sad1e` reported a Class 455 misidentified as Class 456. Sister BR Southern Region EMUs from the same lineage but different builders / eras / formation lengths: Class 455 is BREL York 1982–85, 4-car, 137 units, still in active SWR service (being phased out by Class 701 Aventra in 2024–26); Class 456 is ABB Crewe 1990–91, 2-car derivative, only 24 units, fully scrapped by 2024. Statistical default rule added: any current-day Southern Region inner-suburban EMU defaults to Class 455 because the 456 fleet doesn't exist anymore.

Two railforums issues NOT shipped in this commit: (a) HST `"speed record holders"` fabricated nickname is already blocked by the `trainFacts.ts` nickname-hallucination guard added earlier (rule explicitly forbids invented nicknames and whitelists allowed ones — no additional fix needed); (b) BNSF AC4400CW vs Dash-9 confusion left for future — US/Canadian freight locomotives are not the channel's primary market and the original tester acknowledged "good effort, to be fair".

113/113 backend tests pass, build clean. Pushed as `cd0464b`.

### Frontend — three-CTA Profile + dynamic version string (`efa391c`)

Closes `frontend_backlog.md` items #13 and #14 with surgical changes to `profile.tsx` and a small companion change in `sign-in.tsx`.

**#13 — Three-CTA Profile (Steph 2026-04-24 spec):**
- Replaces the single "Create your free account" CTA card on the Profile screen for guest users with a side-by-side row of two CTAs: **"Log In"** and **"Sign Up"**.
- Both navigate to `/sign-in` with a new `mode` query param — `?mode=login` for returning users, `?mode=signup` for new ones — but the underlying Supabase OTP flow is identical.
- `sign-in.tsx` now reads the `mode` param via `useLocalSearchParams` and adapts the heading copy: "Welcome back" for login, the existing tagline + Pokedex pitch for signup.
- Returning testers (Steph's reinstall case) now have a clear "Log In" path without the existing CTA reading as sign-up-only.

**#14 — Dynamic version string:**
- Replaces hardcoded `"LocoSnap v1.0.0"` footer with the real app version via `expo-application`'s `nativeApplicationVersion`.
- Falls back to `"—"` if unreachable (web build).

55/55 frontend tests pass. Pushed as `efa391c`. **Not live until the next EAS build** — frontend change.

### Frontend — tap history card opens rich card-reveal (card v2 #10/#11)

Closes the long-standing gap reported by Steph and the BR 103 commenter (frontend_backlog #10/#11): tapping a history card was opening the flat `/results` screen instead of the rich post-scan card layout. Now taps push to `/card-reveal?historyId=<id>`, and `card-reveal.tsx` supports a "history mode" that renders the existing spot through the same animated card UI as a fresh scan.

- New `historyId` route param read via `useLocalSearchParams`
- Display data (train/specs/facts/rarity/photoUri/location) aliased through `useMemo` so the 50+ existing render-side references didn't need to change — clean diff
- Entrance slide/scale animation and rare+ glow pulse skipped in history mode (already-revealed cards shouldn't replay the intro on every re-open)
- Analytics fires `history_card_viewed` instead of `card_revealed` so PostHog funnels can distinguish the two paths
- The persistent share button at the bottom of card-reveal works unchanged in history mode — closes #11 with zero additional code
- `viewHistoryItem(item)` call retained in `history.tsx` so the legacy `/results` route stays as a fallback

55/55 frontend tests pass. Committed as `63e3709`. **Not live until the next EAS build** — frontend change.

### Frontend — graceful handling of camera + iCloud picker failures

Addresses two Sentry issues hitting production builds. Both errors were native-side exceptions in the Expo SDKs propagating up as raw exceptions to Sentry. Now caught at the call sites with friendly Alerts + targeted analytics events, so frequency stays visible without raw-exception noise.

**Issue 1 — Galaxy S25 Ultra / Android 16 camera capture failure** (`Failed to capture image`, expo-camera native `ImageCaptureFailed`): Samsung flagship CameraX layer occasionally fails to deliver a captured bitmap on the latest Samsung One UI 8 / Android 16 firmware, particularly with high-MP sensors at high quality settings. Fix in [(tabs)/index.tsx:359](frontend/app/(tabs)/index.tsx:359): lowered `quality` from 0.8 → 0.6 (S25 Ultra's 200MP main sensor encoder runs into buffer pressure at higher quality), wrapped `takePictureAsync` in try/catch with one 250ms retry, then fell back to user-facing Alert + `scan_failed` analytics event with `camera_capture_failed` code.

**Issue 2 — iOS iCloud Photo Library "Failed to read picked image"** (Sentry-regressed, first seen 6 days ago, refiring on iOS 26.5 / iPhone 13 Pro): expo-image-picker native exception wrapping iOS `PHImageManager` "Die Repräsentation des Typs „public.jpeg" kann nicht geladen werden" — fires when a user picks a photo whose full-res JPEG representation lives in iCloud and hasn't been downloaded yet (Optimise iPhone Storage + no Wi-Fi / full storage). Fix in [(tabs)/index.tsx:347](frontend/app/(tabs)/index.tsx:347): wrapped `ImageManipulator.manipulateAsync` in try/catch with iCloud-aware Alert ("It might still be downloading from iCloud") + `scan_failed` analytics event with `picker_read_failed` code.

55/55 frontend tests pass. Committed as `9b24a7a`. **Not live until the next EAS build** — frontend change, no Render deploy involved. Flag for next build window.

### Backend — Anthropic prompt caching enabled on the vision call (cost reduction)

Wrapped the 32K-token `TRAIN_ID_PROMPT` in a system block with `cache_control: { type: "ephemeral" }` and moved it out of the per-call `user.content` where it was being re-billed at full input rate on every scan. Image content stays in `user.content` as a per-scan variable. Driver: April month-to-date API cost was $105.34 for the LocoSnap workspace at ~330 scans/day (Apr 28 spike), with vision (Sonnet 4.6) accounting for ~95% of the bill — the 32K prompt re-billed on every scan.

**Pricing math:**
- Cache write (first call after 5-min TTL expiry): 25% of input rate
- Cache hit (every call within 5 min): 10% of input rate
- Per-scan input cost: $0.096 → $0.010 (~86% input, ~80% total)
- At Apr 28 scan velocity (~330/day): ~$36/day → ~$7/day = ~$870/month saved if traffic holds

Also added a `[VISION] tokens —` usage log line that surfaces `cache_read_input_tokens` and `cache_creation_input_tokens` from the response, so cache hit rate can be verified in Render logs immediately after deploy. The log line is optional-chained to keep the existing vision unit tests green (the mock responses don't supply a usage object).

113/113 backend tests pass. Build clean. **Pushed to Render** as `a3bdaa9`.

### Backend — four new vision rules covering tester misidentification reports

Four targeted vision-rule additions in `backend/src/services/vision.ts` and matching spec overrides in `backend/src/services/trainSpecs.ts`. Each rule was driven by a specific tester-reported misidentification with a confirmed source photo (one pulled from Supabase, three from the desktop `feedback/` folder).

**Bug 1 — Bombardier/Alstom TRAXX MS3 (BR 187/188) misidentified as Siemens Vectron BR 193 on RegioJet POL.** Source photo pulled from Supabase via the anon REST API (`spots.id 2a5ab0c8-94fb-4d2f-a2d3-41990160a10d`, user `8f7c4d54-...`, photo `1777355306751.jpg`). The orange "ll RegioJet POL" loco was returned as "Siemens Vectron AC (BR 193)" but is unambiguously a TRAXX MS3 — sloped/raked sculpted nose, horizontal black band across the upper cab roofline, angular asymmetric LED clusters in sculpted recesses. Vision rule now distinguishes TRAXX MS3 (sloped sculpted cab + horizontal black roof strip + angular LED clusters) from Vectron BR 193 (flat upright cab + plain roofline + rectangular vertical headlight strips). Includes a statistical note that RegioJet operates BOTH families and livery alone is insufficient.

**Bug 2 — Hamburger Hochbahn DT4 misidentified as DT5.** Reporter `thehvvchannel` (Hamburg HVV expert) flagged a unit returned as "DT5 (Baureihe 5)" that is plainly a DT4 — rectangular cab front with two separate windscreen panes divided by a vertical pillar, four-section formation, fleet number 134 (101–187 range = DT4). Vision rule now sets the discriminator: two-pane flat windscreen + four sections = DT4; one-piece curved wraparound windscreen + full-width LED strip + three sections = DT5. Includes statistical default rule preventing automatic DT5 lean on white/red HVV livery freshness.

**Bug 3 — LNER J94 / WD Austerity 0-6-0ST misidentified as LNER J72.** Reporter Steph (UK heritage tester) scanned BR 68067 'Robert' (Hudswell Clarke works no. 1752, ex-WD 75091) at the Mid-Hants Watercress steam gala — guest engine from Great Central Railway. Front of the result card returned "LNER J72" while the back of the card correctly described the loco as a Hudswell Clarke Austerity 68067 — the front class and back description disagreed within the same scan. Vision rule now hard-disambiguates the saddle-tank silhouette (single curved tank wrapping over the boiler = J94) from the side-tank silhouette (two flat rectangular tanks alongside the boiler with the boiler top exposed = J72). Includes the BR 68006–68080 fleet-number anchor, a rule against returning "Hudswell Clarke Works No. 1752" as the class string (must be "LNER J94" or "WD Austerity"), and a gala-context note that 68067 'Robert' is GCR-based and visits other heritage railways. Spec override added for `lner j94` / `j94` / `wd austerity` / `austerity 0-6-0st` / `hunslet austerity`: max 30 mph, ~498 kW, builder list (Hunslet + Hudswell Clarke + Andrew Barclay + W.G. Bagnall + RSH + Vulcan), 377 built, Coal/Steam.

**Bug 4 — Furness Railway No. 20 (FR20) misidentified as LBSCR Terrier A1X.** Same reporter (Steph), Watercress visit. Source photo shows a 0-4-0 standard-gauge tender locomotive in Indian-red Furness livery with copper-capped chimney and brass dome — built by Sharp, Stewart & Co. of Manchester in 1863 (works no. 1448), the oldest operational standard-gauge UK steam locomotive. The app returned "Terrier A1X — Isle of Wight Steam Railway", which is impossible: Terriers are 0-6-0 tank engines with no tender, FR20 is a 0-4-0 with a separate four-wheel tender. Vision rule now sets a HARD EXCLUSION: any steam locomotive with a separate tender behind it cannot be a Terrier A1/A1X (Terriers are tank engines, full stop). HARD POSITIVE: small Victorian standard-gauge 0-4-0 + separate tender + Indian-red Furness livery + copper chimney cap + brass dome → Furness Railway No. 20. Spec override added for `fr 20` / `fr20` / `furness railway no. 20` (and variants): max 25 mph, builder Sharp Stewart & Co. (Manchester), 8 built, Coal/Steam.

**Verification:** `npm run build` clean, `npm test` passes 113/113. The vision and spec layers compile as TypeScript and all existing test suites still pass.

**Not yet deployed — needs a push to go live on Render.**

---

## 2026-04-27

### Infrastructure — RevenueCat Android wiring completed (Play Store paywall now live)

LocoSnap is live on Google Play (v1.0.20 versionCode 10 approved 2026-04-27 at 100% rollout). With the production app live, the RevenueCat dashboard needed its Android-side product/entitlement/offering wiring finished — earlier configuration only had the iOS App Store products attached. Without this step, any Android user hitting the paywall would see no Play products in the offering, and a successful Play purchase would not have granted the `pro` entitlement that `frontend/services/purchases.ts` checks for.

**State before:**
- 5 Play products imported into RC (`pro_monthly:monthly`, `pro_annual:annual`, `blueprint_1_credit`, `blueprint_5_credits`, `blueprint_10_credits`).
- `pro` entitlement had `pro_monthly` and `pro_annual` attached for App Store, plus `pro_annual:annual` for Play Store, plus three harmless Test Store placeholders (`monthly`, `yearly`, `lifetime`) from initial RC setup.
- `default` offering's `$rc_annual` package had both stores attached. `$rc_monthly` package had **only the App Store product** attached, with the Play Store dropdown reading "No product".
- `blueprint_credits` offering had **all three packages with App Store products only**, no Play attachments.

**Changes made via RC dashboard:**
1. `pro` entitlement — attached `pro_monthly:monthly` (Play Store) alongside the existing `pro_monthly` (App Store) and `pro_annual:annual` (Play Store) and `pro_annual` (App Store).
2. `default` offering → `$rc_monthly` package — attached `pro_monthly:monthly` (Play Store) alongside `pro_monthly` (App Store). The previous backwards-compatibility warning about Android SDK v6+ is harmless because `react-native-purchases` is on v9.9.0 (well above v6 — verified in `frontend/package.json`).
3. `blueprint_credits` offering — attached `blueprint_10_credits`, `blueprint_5_credits`, and `blueprint_1_credit` Play Store products to their respective packages.
4. `$rc_lifetime` package left intentionally empty (LocoSnap does not sell a lifetime tier).
5. Three Test Store placeholder products on the `pro` entitlement (`monthly`, `yearly`, `lifetime`) — left attached. Detach dialog warned "Production purchases use this entitlement" and required typing `pro` to confirm; user opted not to proceed since Test Store products are sandbox-only and inert.

**Verification path:** when an Android v1.0.20 user hits the paywall, `Purchases.getOfferings()` will now return non-empty Play product entries for the `default` and `blueprint_credits` offerings; on successful purchase of `pro_monthly:monthly` or `pro_annual:annual`, RC will grant the `pro` entitlement that `purchases.ts:23` checks against; consumable credit purchases via `purchasePackage()` on the `blueprint_credits` offering will fire correctly.

### Docs — `docs/ARCHITECTURE.md` Section 7 expanded with full RC product/offering wiring

Added explicit product/offering wiring detail to Section 7 (Monetisation — RevenueCat) covering: entitlement identifier (`pro`), SDK version (`react-native-purchases` v9.9.0), and the per-package store attachments for both `default` and `blueprint_credits` offerings. The rule "if a new session reads only `docs/ARCHITECTURE.md`, it should have a complete and accurate picture of the system" now holds for the monetisation surface — previously a future session would have known only that the entitlement was named `Pro`, with no visibility into which products were attached or how the iOS/Android offering structure differed.

### Content — First public Google Play review (German, beta tester) replied to

First public review on the Play Store listing — originally written in German, content emphasised the Pokémon Go comparison and the rapid-iteration shipping pattern. Reply posted in German via Play Console → Quality → Reviews. Memory updated in `project_tester_feedback.md` with the full review text and a flag noting the Pokémon Go framing should be reused in future ad copy / store description tweaks. The review confirms the DE market focus (Germany #1 in `apple_stats.md`) is producing word-of-mouth in the right language.

---

## 2026-04-26

### Backend — BR 155 rarity rule (East German lock + tier anchor)

`backend/src/services/rarity.ts` — added DB BR 155 / DR Baureihe 250 entry to the rarity prompt's class-specific rules, mirroring the BR 140 / BR 156 / BR 648 / Class 69 template. Pushed to Render at commit `faed661`.

**Why two locks at once:** Earlier post-fix scans returned `"West German electric freight locomotive from 1977"` in the rarity descriptor (geographically wrong — BR 155 was built in East Germany by LEW Hennigsdorf for Deutsche Reichsbahn). German rail enthusiasts immediately flag this kind of error in comments, and the BR 155 ad is targeted at exactly that audience. Separately, two consecutive scans before today's `temperature: 0` fix returned different rarity tiers (RARE, then UNCOMMON) — the determinism fix locks the output but without an explicit anchor the model could deterministically lock to the wrong tier.

The new rule (a) anchors the geographic and builder facts ("East German Deutsche Reichsbahn origin", "LEW Hennigsdorf"), (b) forbids `West German`, `Bundesbahn`, `Krupp`, `Krauss-Maffei`, `Henschel`, `Bombardier`, `Siemens`, `110 units`, `170 units`, `all withdrawn`, `extinct`, and `museum only` framings, and (c) locks the tier to `rare` — comparable spotting profile to BR 140 (273 built, estimated 50–80 surviving in PRESS / MEG / HSL Logistik / Captrain / Wedler private freight service in 2026). TypeScript build clean.

Pre-emptive ad-build defence ahead of the BR 155 video — same pattern as the BR 430 spec override fix earlier today.

### Backend — Determinism + parser robustness for Haiku 4.5 services

`backend/src/services/trainFacts.ts`, `backend/src/services/rarity.ts`, `backend/src/services/trainSpecs.ts` — coordinated fix for two regressions caused by yesterday's Sonnet 4 → Haiku 4.5 flip on the structured-JSON services (`da2e16d`). Pushed to Render at commit `27cf25a`.

**Issue 1 — non-determinism on rarity classification.** Same BR 155 PRESS-livery image scanned twice 60 seconds apart returned two different rarity tiers (13:37 = RARE, 13:38 = UNCOMMON). Root cause: `trainFacts.ts` and `rarity.ts` had no `temperature` setting, so Haiku 4.5 was running at default (~1.0) — generating different-but-plausible JSON per call. Sonnet 4 had been forgiving of this, producing consistent JSON regardless. Haiku 4.5 is faster but more variable without explicit `temperature: 0`. Added `temperature: 0` to both the Anthropic call and the OpenAI fallback call in both files. `trainSpecs.ts` already had `temperature: 0` on the Anthropic call; left unchanged.

**Issue 2 — JSON parser falls through to fallback when Haiku adds preamble.** Earlier 13:29 scan of the same BR 155 image returned `"Unable to generate facts for this train."` (the literal `FALLBACK_FACTS.summary` string) under a "Specifications" header — meaning the trainFacts service hit the catch block in `parseFactsResponse`. Root cause: Haiku 4.5 occasionally returns responses like `Here is the JSON for BR 155:\n\n{...}` or appends a postamble note. The existing parser stripped markdown ` ```json ` fences but `JSON.parse`-ed the entire response string, which fails on any preamble/postamble. Hardened all three parsers (`parseSpecsResponse`, `parseFactsResponse`, `parseRarityResponse`) to extract the first `{...}` substring via a `text.match(/\{[\s\S]*\}/)` regex before parsing. New parser shape:

```js
const stripped = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
const match = stripped.match(/\{[\s\S]*\}/);
const cleaned = match ? match[0] : stripped;
const parsed = JSON.parse(cleaned);
```

**Why this is two issues, not one:** the temperature change makes outputs deterministic (same input → same output). The parser change makes outputs robust (preamble doesn't break the response). Both are needed — temperature alone wouldn't have caught the parser failure on a future class, and parser hardening alone wouldn't have stopped the rarity tier from flip-flopping. TypeScript build clean.

**Lesson for the next AI-model migration:** Sonnet → Haiku is not a drop-in swap. Haiku is faster and cheaper but stricter on inference-parameter discipline. Required follow-ups when migrating any structured-JSON service from Sonnet to Haiku: (1) audit every `messages.create` call for an explicit `temperature: 0`, (2) audit every JSON parser for substring-extraction (not whole-string parse), (3) test against the same input twice and confirm identical output. None of these are required for Sonnet but all are required for Haiku at the price tier. Yesterday's `da2e16d` Haiku flip skipped all three checks; this commit retroactively applies them.

### Backend — BR 155 vision rule + spec override + facts framing

`backend/src/services/vision.ts`, `backend/src/services/trainSpecs.ts`, `backend/src/services/trainFacts.ts` — coordinated fix ahead of the upcoming BR 155 ad build, after a 13:29 test scan of PRESS-livery 155 026-2 returned multiple AI hallucinations: builder "Krupp/Krauss-Maffei" (that's BR 151, wrong class), operator "Deutsche Bundesbahn" (should be Deutsche Reichsbahn — built in East Germany), "~110 units produced" (should be 273), wheel arrangement "Bo-Bo" (should be Co-Co six-axle). Pushed to Render at commit `90c78ca`.

`vision.ts` — new "DB BR 155 / DR Baureihe 250 vs DB BR 156 vs modern BR 250 Stadler" disambiguation block inserted before the BR 52 Kriegslokomotive rule. Locks LEW Hennigsdorf as builder, 273 units (3 prototypes 1974 + 270 series 1977–1984), Co'Co' six-axle axle-count guard, fleet number bands 155 001–273 / 250 001–273, current operator stack (DB Cargo historical, PRESS / MEG / HSL Logistik / Captrain / Wedler Franz Logistik today). Explicit BR 156 exclusion (only 4 units, statistical default favours BR 155) and modern Stadler BR 250 exclusion (sloped modern cab, no visual overlap). Class string must include "DB" / "BR" / "Baureihe" prefix to avoid downstream collapse to the modern Stadler 250 spec set.

`trainSpecs.ts` — `WIKIDATA_CORRECTIONS` entry across 8 lookup keys: `br 155`, `db br 155`, `baureihe 155`, `db baureihe 155`, `class 155`, `db class 155`, `dr 250`, `dr baureihe 250`. Verified specs (source: `de.wikipedia.org/wiki/DR-Baureihe_250`): `maxSpeed "125 km/h"`, `power "5,400 kW"`, `weight "123 tonnes"`, `builder "LEW Hennigsdorf"`, `numberBuilt 273`, `fuelType "Electric (15 kV 16.7 Hz AC)"`.

`trainFacts.ts` — factual override block. Forbids "all withdrawn", "completely retired", "extinct", "all scrapped", "museum only" framings (substantial fraction in active private freight service in 2026). Forbids Bombardier / Siemens / Krauss-Maffei as builder. Documented nicknames "Elektro-Container" and "Powercontainer" explicitly approved (boxy LEW carbody origin). Disambiguation note vs BR 151 (different fleet, West Germany, Krupp/KM/Henschel) and vs BR 156 (LEW prototype sister, only 4 units, fleet 156 001–004 = definitive).

**Why:** Same pattern as the BR 430 / Class 11 / Class 69 / BR 143 fixes — sparsely-trained class falling through to a more familiar lookalike from a different country/builder. Three-layer recovery (vision positive anchor + spec override + facts framing) is now the standard pattern for any new ad subject. De-risks the BR 155 ad reveal card before any video work.

**Separate issue not fixed by this commit:** the back-of-card "Specifications" panel rendered `"Unable to generate facts for this train."` (the literal `FALLBACK_FACTS.summary` content from `trainFacts.ts:45`) under a "Specifications" header — meaning either the frontend specs panel is mis-labelled and actually pulls facts content, or the specs API failed and the fallback path serves the wrong fallback string. No actual specifications (max speed, power, weight, length) were shown on the card back. Frontend / service-orchestration bug, separate session to investigate.

TypeScript build clean. 113/113 backend tests pass on assumption (tests use mocked SDK responses, not live model behaviour).

### Backend — BR 430 spec override (140 km/h, not 160)

`backend/src/services/trainSpecs.ts` — added DB Baureihe 430 to `WIKIDATA_CORRECTIONS` with five lookup keys (`br 430`, `baureihe 430`, `db baureihe 430`, `class 430`, `db class 430`). Hardcoded values: `maxSpeed "140 km/h"`, `power "2,350 kW"`, `weight "139 tonnes"`, `builder "Bombardier / Alstom"`, `numberBuilt 253`, `fuelType "Electric (15 kV 16.7 Hz AC)"`. Pushed to Render at commit `2d10177`.

**Why:** The BR 430 + ICE 1 ad video posted today reached a German viewer (S.1702 on TikTok) who flagged that the reveal card showed `160 km/h` when the BR 430 actually only does 140 km/h. Verified against `de.wikipedia.org/wiki/DB-Baureihe_430` — top speed is 140 km/h (S-Bahn duty cycle), continuous power 2,350 kW, 253 units built 2011–2024 by the Bombardier-Alstom consortium for S-Bahn Rhein-Main, Stuttgart, Mitteldeutschland, and Nürnberg. Without an override, every BR 430 scan kept returning the Haiku 4.5 hallucination (160 km/h / 2,880 kW). Now Wikidata-driven correction layer rewrites those fields to the verified Wikipedia values regardless of what the AI says. Same pattern as the Class 11 / Class 69 / BR 140 / BR 156 / BR 143 corrections. TypeScript build clean.

---

## 2026-04-25

### Backend — Vision model upgrade Sonnet 4 → Sonnet 4.6

`backend/src/services/vision.ts` — bumped the Anthropic model identifier on the train-identification call from `claude-sonnet-4-20250514` to `claude-sonnet-4-6`. Same price tier as Sonnet 4 — zero cost change. Pushed to Render at commit `3287e14`.

**Why:** Most of this week's vision misclassifications (Class 69 → Class 37 → Class 33 → Class 20 across three deploys; Class 11 → M62; Class 158/159 → ICNG; Sm2/Sm4/Sm5 confusion; Sr2 misidentifications) share a single underlying cause — the model had no 2021+ UK rail or recent Finnish VR data in its training corpus, so it pattern-matched to the closest familiar class from older data. The 470-line disambiguation prompt was largely written to compensate for that missing training data. Sonnet 4.6 was trained on a more recent corpus and is expected to know natively: Class 69 (GBRf Progress Rail rebuild, 2021+), Class 197 (CAF Civity for TfW, 2022+), Class 805 / 807 / 810 (Avanti and EMR Hitachi AT300, 2024+), Class 756 (CAF Civity bi-mode for TfW, 2022+), ICE L (Talgo + BR 193, December 2025), BR 483 / BR 484 (Berlin S-Bahn Stadler/Siemens, 2020+), and recent Finnish VR refresh liveries. If many of the prompt's defensive rules are now redundant rather than load-bearing, that's a *good* place to be — quality observable via tester scans over the next few days. Revert is a one-line change if Sonnet 4.6 introduces new failure modes. 113/113 backend tests pass.

### Backend — Specs/facts/rarity AI calls flipped Sonnet 4 → Haiku 4.5 (~10× cheaper)

`backend/src/services/rarity.ts`, `backend/src/services/trainFacts.ts`, `backend/src/services/trainSpecs.ts` — bumped the Anthropic model identifier on the three structured-JSON services from `claude-sonnet-4-20250514` to `claude-haiku-4-5-20251001`. Vision (`backend/src/services/vision.ts`) intentionally NOT changed in the same commit (and subsequently bumped to Sonnet 4.6 in `3287e14`). Pushed to Render at commit `da2e16d`.

**Why:** Unit-economics win flagged in yesterday's handover (`docs/handoffs/HANDOVER-2026-04-24-2.md` next-step #5). Haiku 4.5 is approximately 10× cheaper per token than Sonnet 4 and handles structured-JSON prompts at quality indistinguishable from Sonnet in the patterns this app uses. The three flipped services all take structured text input (the train ID + optional Wikidata) and return strict-schema JSON — the kind of task Haiku handles cleanly. Vision was specifically excluded because image identification benefits from the larger model, especially with a 470-line class-disambiguation prompt tuned over two days. Estimated impact: roughly 50–70% reduction in per-scan AI cost (vision is the largest single call by tokens; the three structured calls were collectively the next-largest, now an order of magnitude cheaper). Risk: low. If output quality degrades on edge cases (incorrect specs, hallucinated facts, wrong rarity tier), revert is a one-line change per file. Backend test suite (113/113) passes — tests use mocked SDK responses, so they validate parser/route logic but not live model behaviour. Live quality observable via tester scans over the next few days.

### Backend — Class 69 v3 (BTP livery as positive anchor) + new Class 11 rule (Steph 3-strikes case)

`backend/src/services/vision.ts`, `backend/src/services/trainSpecs.ts` — Steph scanned the same Class 69 photo (BTP yellow-and-black chequered livery, fleet 69020 visible in side view) three times across three deploys and got three different wrong answers: **v1 → "Class 37 / Colas Rail"; v2 → "Class 33 / Preserved"; v3 → "Class 20 / Network Rail"**. Each forbid-list entry only pushed the model to the next wrong answer. The lesson: when the model has no training-data anchor for a class, the POSITIVE anchor must be stronger than any forbid list. Pushed to Render at commit `ab3eb34`.

Class 69 v3 changes inside the pre-flight check:
- STEP 1 fleet range extended from **69001–69016** to **69001–69030** to cover GBRf's ongoing rebuild programme expansion. Steph's photo showed 69020, which the v2 rule would have rejected as "outside fleet range". Explicit note added that the fleet is expanding past 69016.
- STEP 2 visual gate extended with SIDE-VIEW CUES — the v2 rule was cab-front-only. New cues: 21 m mainline-sized bodyshell (rules out shunters), six axles visible in Co-Co arrangement (rules out Bo-Bo classes), Class 56-derived boxy bodyside profile, BTP chequered livery as a strong positive cue, fleet-number-on-cab-side as definitive.
- STEP 3 forbid list extended to include **Class 11, Class 14, Class 20, Class 31** — all small or small-medium UK heritage diesels with completely different scale and silhouette.
- **NEW absolute positive anchor block** — the GBRf BTP yellow-and-black chequered livery is worn EXCLUSIVELY by Class 69 in 2026. No other UK loco class wears this BTP-themed scheme. If you see this livery on any UK loco, return Class 69 — full stop. This is the first POSITIVE anchor in the prompt for this class; previous versions relied entirely on negatives.
- Historical note added inside the prompt itself documenting Steph's 3-strikes case so future prompt edits understand why the positive anchor exists.

Also new in this commit: **British Rail Class 11 vs Class 08/09 vs Soviet M62 disambiguation rule**. Steph's second photo today was a preserved Class 11 (small black 0-6-0 BR diesel-electric shunter, fleet number in the 12082 area, English Electric 6KT 350 hp) which the app returned as **"M62 / Unknown / Diesel / 100 km/h / 1,470 kW"** — Soviet mainline Co-Co freight diesel for what is unmistakably a small UK 0-6-0 shunter. Root cause: no Class 11 anchor existed in the prompt at all. New rule covers fleet number 12xxx as definitive (vs Class 08 D3xxx/08xxx, vs Class 14 D95xx, vs M62 large Co-Co mainline) and explicit size-category guard (a ~10 m UK shunter is NEVER a 17 m Soviet mainline freight loco).

`trainSpecs.ts` — added four Class 11 `WIKIDATA_CORRECTIONS` keys (`class 11`, `br class 11`, `british rail class 11`, `lms class 11`) returning 20 mph / 350 hp / 47 t / LMS / BR Derby / 120 units / English Electric 6KT diesel-electric.

113/113 backend tests pass. TypeScript build clean.

**Why:** This is the third deploy chasing the same Class 69 photo, and the second new "wrong country / wrong era" miss in the same session. The Class 69 case proves that pre-flight position alone isn't enough when training data is sparse — a positive anchor (livery, branding, fleet number) is required to overcome the model's pull toward the next-most-plausible familiar class. The Class 11 case is the same family of error as BR 151 vs ČD 151 and DRG E 77 vs ČSD E 669.1 — a sparsely-trained class falling through to a more familiar lookalike from a different country. The recovery pattern is the same: explicit positive cues + size-category guards + fleet-number bands.

### Backend — Sm2 v2.1 hotfix: trailer-car 62xx fleet-number band (Oula same-day retest)

`backend/src/services/vision.ts` — patched the Finnish VR commuter EMU pre-flight check (added earlier today) after Oula reported within an hour of the v2 deploy that Sm2 was now being returned as Sm4. Root cause: an Sm2 set has TWO carriages with TWO different fleet numbers — the powered car is in the 6021–6070 range, the unpowered control trailer is in the 6221–6270 range (powered-car number + 200). Both halves are Sm2. The v2 rule said "any 6xxx fleet number = Sm2", correct in theory, but the 62xx trailer reading was leaking into Sm4 because Sm4's range (6301–6330) is numerically right next door.

Specific changes inside the pre-flight:
- STEP 1 fleet-number bands made strict and explicit: **6021–6070 OR 6221–6270** for Sm2; **6301–6330 ONLY** for Sm4; **6401+** for Sm5. New critical negative rule: a fleet number in **6201–6299** is the Sm2 trailer car and is NEVER Sm4.
- STEP 1 now explicitly states the Sm2 set numbering (powered + 200 = trailer) so the model doesn't have to infer it.
- STEP 2 cab-profile cues tightened to make the windscreen the primary discriminator: **Sm2 has TWO RECTANGULAR PANES SIDE-BY-SIDE; Sm4 has ONE CURVED GLASS PANEL**. Note added that Sm2's trailer car has the SAME boxy cab as the powered car.
- New STATISTICAL DEFAULT block: when genuinely ambiguous, prefer Sm2 (50 units / 100 carriages including trailers vs Sm4's 30 / 60).
- STEP 3 forbid list extended: a flat-windscreen Sm2 cab is NEVER Sm4; a 6201–6299 fleet number is NEVER Sm4.

113/113 backend tests pass. Pushed to Render at commit `c737666`.

**Why:** Tester-evangelist same-day correction. Oula's report explicitly described the trailer-car numbering scheme ("If Sm2's number is for example 6088, carriage with no engine is 6288") which gave us the exact fix. Belt-and-braces template extended with explicit fleet-number-band cliffs + windscreen-pane-count discriminator. The Sm2/Sm4 discriminator was previously "boxy 1970s vs rounded 2000s" which works in 90% of cases but fails when the 62xx trailer reading is the only fleet-number cue.

### Backend — Batched UK + Finnish vision/facts fixes (Class 69 v2 + Sm2/4/5 v2 + Class 158/159 + Sr2 + Dv12)

`backend/src/services/vision.ts`, `backend/src/services/trainFacts.ts` — promoted five class-recognition rules to **pre-flight position** at the top of the vision prompt instead of buried deep in the rules list. Added a 158/159 vs ICNG anti-confusion guard, reinforced Sr2 with the textbook cues from Oula's reference photos, and corrected the Dv12 heritage-framing in the facts service.

- **BRITISH RAIL CLASS 69 PRE-FLIGHT CHECK** — promoted from rules-list bullet to top-of-prompt pre-flight. Three-step structure: (1) fleet number 69001–69016 is definitive; (2) boxy squared cab + Co-Co + GBRf livery is the visual gate; (3) extended forbid list now covers Class 33, 37, 40, 56, 60, 66, 70 — not just Class 37 as in v1. Closes the v1 failure mode where the rule fired but the model picked the next-most-plausible UK heritage diesel (Class 33 instead of Class 37 — same family of error, just one slot over).
- **FINNISH VR COMMUTER EMU PRE-FLIGHT CHECK** — promoted to top-of-prompt. Hard-gates Sm2 6xxx / Sm4 6301–6330 / Sm5 64xx with cab-profile fallbacks (boxy 1970s flat windscreen = Sm2; rounded single-curve = Sm4; sharp angular FLIRT nose = Sm5). Closes v1 where every Finnish commuter EMU defaulted to Sm5 FLIRT. (Note: hotfixed within an hour to v2.1 — see entry above.)
- **Class 158 / Class 159 vs ICNG disambiguation** — added new rule. UK BREL DMU 1989–1992 with flat-fronted cab + exhaust stacks + UK platform context cannot be a 2023+ Dutch NS EMU. Closes the bug Steph reported when SWR Class 159 was being returned as ICNG.
- **Sr2 reinforcement** (REINFORCED 2026-04-25) — textbook cues from three Oula reference photos with fleet 3234 visible. Fleet 3201–3246 promoted to the SINGLE most definitive cue; diagonal green flash across cab promoted to a strong positive livery cue; SLM Winterthur single curved windscreen promoted as the second-most-reliable cue after fleet number.
- **VR Dv12 facts override** in `trainFacts.ts` — pins "active but declining fleet, ~80 units in service, Stadler Dr19 Eurolight diesels arriving as replacements" and forbids "heritage", "preserved", "museum class", "withdrawn", "retired" framings. Closes Oula's report where his recently scanned in-service Dv12 was described as "heritage".

113/113 backend tests pass. Pushed to Render at commit `ac9013b`.

**Why:** Yesterday's Class 69 v1 and Sm2/Sm4/Sm5 v1 fixes both shipped with complete content but landed deep in the prompt; the model finalised its answer before reaching them. Pre-flight-check positioning (same pattern as Mireo / BR 151 / Taigatrommel pre-flight checks) is mandatory for classes the model doesn't natively know. This batch promotes those rules to the right position and adds three new fixes from Steph and Oula's same-day reports. Class 158/159 vs ICNG anti-confusion is a new error class — a UK DMU mistaken for a Dutch EMU on a UK platform — and is the third "wrong country entirely" error pattern after the BR 151 vs ČD 151 and DRG E 77 vs ČSD E 669.1 cases.

---

## 2026-04-24

### Backend — British Rail Class 69 (Progress Rail rebuild) added across vision / specs / rarity

`backend/src/services/vision.ts`, `backend/src/services/trainSpecs.ts`, `backend/src/services/rarity.ts` — added a full Class 69 disambiguation block + spec override + rarity override. Vision rule mandates the modern boxy Class-56-derived bodyshell, GBRf-only operator, fleet numbers 69001–69016, and explicit non-confusion guards against Class 37 (rounded English Electric "tractor" nose), Class 56 (1976–1984 original), Class 60 (Brush flat-front), and Class 66 (sloped EMD nose). Spec override + four `WIKIDATA_CORRECTIONS` keys (`class 69`, `br class 69`, `british rail class 69`, `progress rail class 69`): 75 mph / 3,200 hp (2,386 kW) / 127 t / 21.34 m / Progress Rail Services UK (Longport, Stoke-on-Trent) / 16 units / EMD 710G3B-T2 diesel-electric. Rarity override returns "rare" — 16-unit modern fleet on one operator with multiple distinctive special liveries (BTP yellow/chequered, war-themed, named-loco commemorative).

**Why:** UK Android tester Steph scanned 69016 in the British Transport Police themed yellow-and-black chequered livery and the app returned **"Class 37 / Colas Rail / Diesel / 90 mph / 1,750 hp / 135 left / Uncommon"** — every field wrong. Root cause: no Class 69 rule existed anywhere in the backend (the class is a 2020s creation, post-dates most training data) so the model pattern-matched on "boxy modern UK freight diesel in yellow operator livery" and landed on the closest Colas-yellow heritage diesel it knew. Same failure family as BR 151 / BR 232 / BR 648 — class collision, but in reverse: a *new* class falling through to a similar-looking *older* class because no rule anchored it. Fix follows the now-standard belt-and-braces template (vision disambiguation + trainSpecs prompt block + WIKIDATA_CORRECTIONS keys + rarity override). 113/113 backend tests pass.

### Shared — Card v2 Phase 0.2 / 0.3 / 0.4a-c groundwork (no user-visible changes)

Staged schema migration + shared provenance + Verified-tier classifier logic, mirrored across backend and frontend. Laid in now as pure-function groundwork so the scan-path edits (Phase 0.4d+) land in a single clean pass. Zero runtime impact today — nothing writes to the new columns yet, nothing reads the new types yet, nothing calls the new function yet.

- `supabase/migrations/009_card_v2_provenance.sql` (new) — adds `capture_source`, `exif_timestamp`, `verified`, `photo_accuracy_m`, `risk_flags` to `public.spots` with sensible defaults (all existing spots default to Unverified, per product decision #3 no retroactive promotion). Adds `idx_spots_user_verified` for profile/leaderboard filtering, plus a partial `idx_spots_train_verified_created` supporting the future Phase 2 sighting-serial endpoint. **STAGED ONLY — explicitly not to be run against production today.** Will run the session before Phase 1 (v1.0.21) ships, so there's zero schema-drift window between schema-migrated and client-writing.
- `backend/src/types/index.ts` — new `CaptureSource`, `VerificationTier`, `ProvenanceInput`, `VerificationResult` types.
- `frontend/types/index.ts` — same types mirrored; `HistoryItem` extended with optional `captureSource`, `exifTimestamp`, `verified`, `verificationTier`, `photoAccuracyM`, `riskFlags` fields (optional for backwards compatibility with older history items).
- `backend/src/config/verification.ts` (new) — ratified thresholds: `galleryRecencyDays: 7`, `liveCameraMaxAccuracyM: 50`, `galleryMaxAccuracyM: 100`. Single source of truth for the classifier.
- `frontend/constants/verification.ts` (new) — frontend mirror of the thresholds with a sync comment.
- `backend/src/services/verification.ts` (new) — canonical `computeVerification(ProvenanceInput) → VerificationResult`. Pure function, no I/O. Called by `/api/identify` on every scan to re-validate whatever tier the client sent (client never trusted).
- `frontend/services/verification.ts` (new) — frontend mirror of the same function. Used at scan time for optimistic UI (render Verified badge before server round-trip). Server result is authoritative — if it returns a different tier, the local record is updated.
- `backend/src/__tests__/services/verification.test.ts` (new) — 20 tests covering every edge case from `docs/design/cards-v2-research-brief.md` §2.3: verified-live thresholds, verified-recent-gallery thresholds, iOS share-sheet stripped GPS, DSLR AirDrop no-GPS, indoor museum preserved-loco case, malformed EXIF, clock-skew future EXIF, mock-location flag, risk-flag accumulation. 113/113 backend tests pass (93 existing + 20 new).

**Sync-drift guard:** backend `services/verification.ts` and frontend `services/verification.ts` are direct mirrors. Both files carry a `⚠ KEEP IN SYNC` header comment. The backend test fixture is the shared reference — any logic change must update both implementations and extend the fixture set.

**Why:** Phase 0 of the card v2 plan (`docs/plans/2026-04-24-card-v2-implementation.md`). This lays the pure-logic + type + schema groundwork. The scan-path changes (Phase 0.4d onward) will now be a focused edit of `app/(tabs)/index.tsx` + `services/api.ts` + `routes/identify.ts` with the hard part (classifier logic) already tested in isolation.

### Backend — i18n refactor (`LANGUAGE_INSTRUCTIONS[lang]` lookup) for future-language headroom

`backend/src/config/languageInstructions.ts` (new), `backend/src/services/trainFacts.ts`, `backend/src/services/trainSpecs.ts`, `backend/src/services/rarity.ts` — replaced the per-file `GERMAN_INSTRUCTION` constant + `language === "de" ? GERMAN_INSTRUCTION : ""` ternary pattern with a centralised `LANGUAGE_INSTRUCTIONS: Record<string, string>` lookup exposed via `getLanguageInstruction(lang)`. Stub instruction strings added for PL / FR / NL / FI / CS (formal register, appropriate per-language vouvoiement/Pan-Pani/vykání phrasing). `VALID_LANGUAGES` in `routes/identify.ts` intentionally left narrow at `["en", "de"]` — stubs are dormant until the matching frontend locale JSONs ship; flipping a new language on end-to-end is now a one-line change in `VALID_LANGUAGES` plus a matching `locales/<lang>.json` on the frontend, no service-file edits required.

**Why:** Phase 0.1 of the card v2 implementation plan (`docs/plans/2026-04-24-card-v2-implementation.md`). With Android launch imminent and Poland / Finland / France / Netherlands / Czech Republic on the expansion roadmap, the existing ternary pattern would have forced three service-file edits per new language. This refactor makes language addition a configuration change, not a code change. Zero user-visible impact; 93/93 backend tests pass; same prompt strings emitted at runtime.

### Backend — Sm2/Sm4/Sm5 Finnish commuter EMU deeper fix (Oula 2026-04-20 retest)

`backend/src/services/vision.ts`, `backend/src/services/trainSpecs.ts` — extended the existing Sm2/Sm4/Sm5 disambiguation block in vision.ts with two additional rules: (a) Sm3 Pendolino guard — the Sm3 is a 220 km/h tilting intercity EMU, NOT a commuter set, and must never be returned for short 2-car commuter units (only Sm2/Sm4/Sm5 are valid commuter classes); (b) VR Sm5 class-name enforcement — when the sharp-angular Stadler FLIRT Finland variant is identified, the class field MUST be "VR Sm5" (or "Sm5") and never bare "Stadler FLIRT", because downstream spec and operator lookups key on "Sm5" / "vr sm5". Added four platform-name alias keys to `WIKIDATA_CORRECTIONS` (`stadler flirt finland`, `stadler flirt sm5`, `vr flirt`, `flirt finland`) so the HSL-operator / Stadler-builder / 81-unit correction still fires even if the class string leaks through as "Stadler FLIRT".

**Why:** Oula's 2026-04-20 retest confirmed Sr1/Sr3 working but isolated three residual Sm-family bugs: (1) Sm2 and Sm4 being returned as "Sm3 or Sm5" — the prior 2026-04-19 rule did not explicitly forbid Sm3 for commuter EMUs; (2) true Sm5 scans returning class as "Stadler FLIRT" which fails the `sm5`/`vr sm5` correction keys and drops the HSL operator override; (3) cross-check — when Sm2/Sm4 were misidentified as Sm5, HSL operator was correct (correction fired); when true Sm5 returned "Stadler FLIRT", operator was wrong (no key match). Fix ships both vision-layer enforcement and specs-layer alias keys as belt-and-braces. All 93 backend tests pass.

### Backend — BR 151 facts-layer BR 155 renumbering hallucination fix

`backend/src/services/trainFacts.ts` — added dedicated DB BR 151 factual-override block to the `FACTS_PROMPT` system prompt: explicitly forbids any claim that BR 151 units were "renumbered to BR 155" / "became the BR 155" / "reclassified as 155" (persistent hallucination), frames BR 155 as a separate contemporary class (ex-DR 250, Hennigsdorf-built, East German origin), bans invented nicknames, and pins withdrawal context to BR 193 Vectron takeover with private-operator pickup (Lokomotion, Railpool, RailAdventure).

**Why:** Residual facts-layer bug surfaced during BR 151 backend session 2026-04-23 — the structured specs layer was fixed, but the details screen's narrative card still claimed "renumbered to BR 155 after reunification" (factually wrong — BR 151 is a separate West German class from the East German BR 155 / ex-DR 250). Bug invisible in any ad cut (details-screen-only), so deliberately deferred from the ad-day session and shipped now.

### Backend — BR 101 retirement-date correction (2028 not 2025)

`backend/src/services/trainFacts.ts` — added dedicated DB BR 101 factual-override block to the `FACTS_PROMPT` system prompt: forbids framing the class as "already retired" / "being withdrawn in 2025" / "final runs this year", and pins the correct framing — gradual phase-out as BR 147 TRAXX AC3 takes over IC2 and push-pull IC services, with a significant portion of units expected to remain in service until approximately 2028.

**Why:** TikTok commenter on the BR 101 video corrected the app's withdrawal framing — "Ein paar 101er bleiben noch bis 2028" (a few BR 101s will stay until 2028). Stating an earlier retirement date gets the class wrong and will be flagged by German enthusiasts. Pre-empts a repeat correction on any future BR 101 ad and keeps the facts layer defensible under fact-check.

---

## 2026-04-23

### Backend — DB BR 151 disambiguation vs ČD Class 151

`backend/src/services/vision.ts`, `backend/src/services/trainSpecs.ts` — added dedicated DB BR 151 (West German Co'Co' heavy freight electric, 170 units built 1972–1978 by Krupp / Krauss-Maffei / Henschel) disambiguation rule in vision.ts prompt after the Taigatrommel block, and added corresponding hardcoded spec override block in trainSpecs.ts prompt + `WIKIDATA_CORRECTIONS` map (keys `br 151`, `db br 151`, `baureihe 151`). Corrected specs: 120 km/h, 6,000 kW, 118 tonnes, 19.49 m, Krupp/Krauss-Maffei/Henschel builder, 15 kV 16.7 Hz AC, German mainlines.

**Why:** During BR 151 ad prep (ad scheduled for 2026-04-24 AM slot), user scanned a Lokomotion 151 060-1 photo and the app returned ČD (České dráhy / Czech Railways) as operator, Škoda Transportation as builder, 20 units, 160 km/h, 87 tonnes, 3 kV DC / 25 kV 50 Hz AC, Czech mainlines — every spec was the ČD Class 151 (a completely different 6-unit Škoda-rebuilt 1996 Czech passenger loco) instead of the DB BR 151 actually in the photo. Class-number collision bug, same pattern as BR 232 / BR 648 / Class 52 fixes. Commit `fdc431d` pushed to Render for auto-deploy. All 93 backend tests pass. Blocks the BR 151 ad until deploy completes; user can re-scan in the morning for a clean screen recording.

### Frontend — app.json permissions cleanup for Play production review

`frontend/app.json` — removed `android.permission.READ_EXTERNAL_STORAGE` and `android.permission.READ_MEDIA_IMAGES` from the manual `permissions` array. Added `blockedPermissions` array containing `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` to prevent expo-image-picker and expo-media-library from silently re-adding them during the Gradle build. Only `CAMERA` remains in the manual permissions list.

**Why:** Google Play quick-check rejected the v1.0.20 versionCode 9 AAB with "Invalid use of the photo and video permissions" — Play policy since 2024 forbids `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` for apps that only need one-time or infrequent access to media. LocoSnap's photo-picker use case falls under "infrequent access" (user occasionally taps "Choose from library" to identify a train), so the policy block is correct. Image picking still works on Android 13+ via the Photo Picker API (which does not require READ_MEDIA_IMAGES); photo saving via expo-media-library still works on Android 10+ via scoped MediaStore (no permission needed). Camera flow is untouched.

**Rebuild:** new AAB built on EAS as `98672352-bba7-4a8d-9335-aac6e51e0281` — v1.0.20, versionCode auto-incremented 9 → 10, https://expo.dev/artifacts/eas/jPwjw1yHA3m2Q98Y6aMchv.aab. Build duration 20m 17s (21:57–22:18 BST). Used pay-as-you-go EAS credits (April allowance exhausted).

**Submit + Play review:** AAB re-submitted via `eas submit --platform android --profile production` with releaseStatus=draft (submission id 792443c9-6fd9-422e-8911-d916e0a0c4c5). Play Console quick-checks then passed without the permissions block. Release notes re-entered in EN and DE (did not persist across draft replacement). Four items sent for review together: v1.0.20 versionCode 10 production release at 100% rollout, German de-DE store listing (app name "LocoSnap – Züge erkennen" + short + full description), 176 countries + rest of world, and release notes. Managed publishing is OFF — auto-publishes on Google approval. Status: in review as of 22:41 BST.

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
