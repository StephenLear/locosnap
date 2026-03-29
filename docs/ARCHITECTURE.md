# LocoSnap — Full Architecture Reference

> Last updated: 2026-03-27

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
| iOS Version | 1.0.7 build 33 — **Submitted to TestFlight** 2026-03-29. Shareable train card (Save to Photos + Share sheet). translateX fix for iOS GPU rendering of off-screen captureRef view. |
| Android Version | 1.0.6 build 4 — production AAB built 2026-03-27, preview APK sent to 13 testers. Auto-submit to internal track pending service account permission propagation. |
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
| URL | https://locosnap-backend.onrender.com (or similar) |
| Cold Start | ~60s after inactivity — pre-warmed by healthCheck() on app mount |
| Source | `/backend/src/` |

### Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/identify | Upload photo → train ID, specs, facts, rarity, blueprint task ID |
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

**Known fix (implemented):** Android session expiry — `onAuthStateChange` now handles `TOKEN_REFRESHED` and unexpected `SIGNED_OUT` events with session recovery before clearing state.

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
| Latest iOS Build | Build 35 (v1.0.7) — Submitted to TestFlight 2026-03-29 — IPA: https://expo.dev/artifacts/eas/av6agRFTb5uSZBVJh1U5tt.ipa |
| Latest Android Production Build | Build 4 (v1.0.6) AAB — https://expo.dev/accounts/stephenlear1/projects/locosnap/builds/f040f353-97cf-4804-b1d6-11608f6706f0 — submit to internal track pending service account permission propagation |
| Latest Android Preview Build | Build 4 (v1.0.6) APK — https://expo.dev/artifacts/eas/uiYbj1NQVidPWUR3JhuQqW.apk |

### Android APK Build History

Every APK shipped to testers must be recorded here on the day it is sent.

| Date | Version | What Was In It | APK Link | Sent To |
|------|---------|---------------|----------|---------|
| 2026-03-24 | v1.0.5 (preview build 3) | Card-reveal animation crash fix (native driver separation on Android). authStore SIGNED_OUT recovery fix. Account cross-contamination fix (_layout). S-Bahn 480/485 pantograph disambiguation. LU vintage stock fixes (A Stock, 1960 Stock, CO/CP). 15 new German class disambiguation rules in vision prompt. | https://expo.dev/artifacts/eas/9Zk2rLcqzY9n8Ruc4Sk9Bj.apk | 13 Android testers (full list) |
| 2026-03-26 | v1.0.5 (preview) | Card-reveal animation crash fix. S-Bahn 480/485 now distinguished by pantograph check. DR Class 156 corrected to Legendary rarity (only 4 built). | https://expo.dev/artifacts/eas/uhB5zAZwTry8AiX5Y5QEaB.apk | Nero (gerlachr70@gmail.com) — new tester onboarding |
| 2026-03-27 | v1.0.6 (preview build 4) | ICE 3 family disambiguation (BR 403/406/407/408). 15 identification fixes including ICE T, BR 462/642, BR 480/481, LINT 41/Mireo, FLIRT/CD 654, VT 650/628, Twindexx/Talent 2. ICE 3 max speed corrected to 300 km/h. Paywall display bug fixes (currency localisation, purchase failure, copy). Account history no longer persists after sign-out. | https://expo.dev/artifacts/eas/uiYbj1NQVidPWUR3JhuQqW.apk | 13 Android testers (full list) |

---

## 14. CI/CD — GitHub Actions

| Workflow | Trigger | Description |
|----------|---------|-------------|
| ci.yml | Push to any branch | Runs backend (53) + frontend (39) tests |
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

### Android Testers (14) — notified by email
- gerlachr70@gmail.com (Nero — German ICE enthusiast, recruited via Frankfurt TikTok/Instagram ad 2026-03-26)
- Stephstottor@gmail.com
- esseresser07@gmail.com
- gazthomas@hotmail.com
- jlison1154@gmail.com
- kt4d.vip@gmail.com
- leander.jakowski@gmail.com
- mike.j.harvey@gmail.com
- muz.campanet@gmail.com
- qwertylikestrains@gmail.com
- scr.trainmad@gmail.com
- scrtrainmadother@gmail.com
- unsunghistories@proton.me
- vattuoula@gmail.com

**Email format:** Bilingual EN/DE. Logo (https://locosnap.app/images/icon.png) at top. No emojis. Include APK download link from EAS.

### iOS TestFlight Testers (1) — notified by email
- rheintalbahnerneo@gmail.com (@Rheintalbahner_Neo)

**Email format:** English only. Include TestFlight link. No emojis.

| Tester | Email | Status |
|--------|-------|--------|
| @Rheintalbahner_Neo | rheintalbahnerneo@gmail.com | Invited ✅ |
| Czech tester's friend | unknown | Apple ID email still outstanding |

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
- "Free on App Store" in yellow Impact text
- "Coming soon to Android" in white Impact text
- Dark background (#0d0d0d)
- Duration: 2 seconds minimum

**Text overlays:**
- Font: Impact
- Colour: yellow (#FFFF00) with black border, borderwidth 6
- Large size (90-95px at 1080px wide)
- Two lines maximum — one top-left, one bottom-left
- No time claims for blueprint generation (takes up to 60 seconds in the app)

**Hook structure:**
- Frame 1 must be a pattern interrupt — moving train or strongest visual asset
- Never open on the scan UI or app chrome
- Blueprint reveals go after the footage cut, not before

---

## 20. Known Limitations / Pending Work

| Item | Status |
|------|--------|
| iOS App Store submission (v1.0.7) | Submitted to TestFlight 2026-03-29, build 33 — shareable card feature (Save + Share) |
| Android APK for testers (v1.0.6) | Sent to 13 testers 2026-03-27 — APK: https://expo.dev/artifacts/eas/uiYbj1NQVidPWUR3JhuQqW.apk |
| Android auto-submit to Play Store (v1.0.6) | Infrastructure set up (service account, API enabled, eas.json updated). Submit pending service account permission propagation. Retry: eas submit --platform android --profile production --id f040f353-97cf-4804-b1d6-11608f6706f0 --non-interactive |
| Competitor noted: Traintrack (traintrack.app) | iOS/Android, 557 followers TikTok, aggressive paywall, launched 2026. Monitor. |
| Sentry source maps | Add SENTRY_AUTH_TOKEN + SENTRY_ORG + SENTRY_PROJECT to EAS secrets |
| Offline spot sync | Spots scanned while offline are saved locally but never synced to Supabase when connectivity restores. Need to track unsynced items (local timestamp ID vs Supabase UUID) and sync on reconnect/foreground. Medium priority. |
| History pagination | MAX_HISTORY raised to 200 — no pagination yet |
| ICE 1 weight validation (< 10 tonnes = reject) | Pending |
| Dual-voltage Czech/Slovak trains in specs prompt | Pending |
| Czech tester's friend — add to TestFlight | Need Apple ID email |
