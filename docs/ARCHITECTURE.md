# LocoSnap — Full Architecture Reference

> Last updated: 2026-03-31

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
| iOS Version | 1.0.17 build 38 — **Live on App Store** 2026-04-09. Includes all changes from v1.0.8–v1.0.17: language picker (EN/DE), deferred i18n init, Android 16 crash fix (setTimeout(0)), viewfinder glow alignment, FCM token skip, all train ID disambiguation improvements. Previous App Store release: v1.0.7 build 36 (2026-03-31). IPA: https://expo.dev/artifacts/eas/kWHhX6gcrPpUBYT9Ky1AZg.ipa |
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
- **DSB Danish Train PRE-FLIGHT CHECK added** — Covers DSB Class ME, ER, IC3, and ET as a named decision tree block positioned before the rules section. Step 1 is a mandatory fleet number scan: 15xx range (1501–1542) = Class ME (diesel loco, Bo'Bo', built 1981–1984, hauls coaches); 2xxx range (e.g. 2001–2240) = Class ER (Copenhagen S-tog EMU, third-rail 1650V DC, operator "DSB S-tog"). Step 2 is a visual type fallback when no number is readable: large diesel loco cab = ME; rubber flexible nose/bellows = IC3 (DMU); rounded dark EMU on urban service = ER; modern silver/white EMU on Oresund corridor = Class ET. Critical rule: a DSB 2xxx fleet number is always Class ER — never Class ME. Triggered by a TikTok comment on the BR 101 video confirming the app returned "DSB Class ME" for fleet number 2143 (a Class ER S-tog EMU).

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
| Free account | 10 per calendar month — resets on new month (`daily_scans_used` / `daily_scans_reset_at`) |
| Pro | Unlimited |

**Important:** Guest mode was removed in 2026-03-22 because `canScan()` returned `true` unconditionally for guests (a loophole giving unlimited free scans). The sign-in screen no longer shows "Continue as Guest". Unauthenticated users can scan 3 times before being prompted to create a free account.

The DB columns are named `daily_scans_used` / `daily_scans_reset_at` (legacy names) but are now used as **monthly** counters. The reset logic checks `getMonth()` + `getFullYear()` rather than `toDateString()`.

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
| Latest iOS Build | Build 38 (v1.0.17) — **Live on App Store** 2026-04-09. Submitted to TestFlight 2026-04-08, approved 2026-04-09. IPA: https://expo.dev/artifacts/eas/kWHhX6gcrPpUBYT9Ky1AZg.ipa |
| Latest Android Production Build | v1.0.17 AAB (versionCode 8) — built 2026-04-07 — https://expo.dev/artifacts/eas/9iNjvH7L9AFjeVq8KB1uhp.aab — Submitted to Play Store closed testing track 2026-04-07, in review by Google |
| Latest Android Preview Build | v1.0.17 APK — https://expo.dev/accounts/stephenlear1/projects/locosnap/builds/be527909-08eb-4ef9-b95e-d6ba89180f6f — sent to vattuoula 2026-04-07. Wraps router.replace() in setTimeout(0) to prevent synchronous React commit cascade crash on Android 16 (Hermes). Also adds authIsLoading guard to prevent navigation before Stack is mounted. |

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
5. User creates free account → 10 scans/month, cloud sync, leaderboard
6. User upgrades to Pro → unlimited scans, all blueprint styles
```

**Key constants** (`authStore.ts`):
- `PRE_SIGNUP_FREE_SCANS = 3` — trial scans before sign-up required
- `MAX_MONTHLY_SCANS = 10` — monthly limit for free accounts
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

**Hook structure:**
- Frame 1 must be a pattern interrupt — moving train or strongest visual asset
- Never open on the scan UI or app chrome
- Blueprint reveals go after the footage cut, not before

---

## 20. Known Limitations / Pending Work

| Item | Status |
|------|--------|
| iOS App Store (v1.0.17) | **v1.0.17 live on App Store since 2026-04-09.** Language picker (EN/DE), all disambiguation improvements, Android 16 crash fix. Previous: v1.0.7 (2026-03-31). |
| Render cold start | Resolved 2026-03-31 — upgraded to Starter ($7/month). Dyno stays live permanently. REACT-NATIVE-1 Sentry issue should stop recurring. |
| Android APK for testers (v1.0.7) | Build 5 sent to 14 testers 2026-03-29, 2 new testers 2026-03-30 — APK: https://expo.dev/artifacts/eas/ibpfRqcwWrjvvGuYB1M6y9.apk |
| Android v1.0.11 — awaiting Finnish tester confirmation | v1.0.11 sent to Finnish tester (vattuoula@gmail.com) 2026-04-01. Removes expo-localization entirely. If confirmed fixed, send to all 18 remaining testers (bilingual EN/DE, mention German language support). |
| Android auto-submit to Play Store (v1.0.7) | Infrastructure set up (service account, API enabled, eas.json updated). Submit pending service account permission propagation. Retry: eas submit --platform android --profile production --id f040f353-97cf-4804-b1d6-11608f6706f0 --non-interactive. Note: do not commit eas.json with local absolute path to play-store-key.json — it will not exist in EAS Build environment. |
| Competitor noted: Traintrack (traintrack.app) | iOS/Android, 557 followers TikTok, aggressive paywall, launched 2026. Monitor. |
| Sentry source maps | Add SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT to EAS secrets |
| Offline spot sync | Spots scanned while offline are saved locally but never synced to Supabase when connectivity restores. Need to track unsynced items (local timestamp ID vs Supabase UUID) and sync on reconnect/foreground. Medium priority. |
| History pagination | MAX_HISTORY raised to 200 — no pagination yet |
| ICE 1 weight validation (< 10 tonnes = reject) | Pending |
| Dual-voltage Czech/Slovak trains in specs prompt | Pending |
| Czech tester's friend — add to TestFlight | Need Apple ID email |
