# LocoSnap — Full Architecture Reference

> Last updated: 2026-03-21

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
| iOS Version | 1.0.2 (live on App Store) |
| Android Version | In closed testing (Google Play) |
| App Store ID | 6741445220 |
| App Store URL | https://apps.apple.com/app/locosnap/id6741445220 |
| Bundle ID | com.stephenlear.locosnap |

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
| Supported Methods | Google OAuth, Apple OAuth, Email magic link |
| Guest Mode | Yes — app works without sign-in |
| Auth Email Sender | noreply@locosnap.app (via Resend SMTP) |
| Sender Name | LocoSnap |

**Known fix (implemented):** Android session expiry — `onAuthStateChange` now handles `TOKEN_REFRESHED` and unexpected `SIGNED_OUT` events with session recovery before clearing state.

---

## 6. Blueprint Task Store — Redis

| Property | Value |
|----------|-------|
| Production | Upstash Redis |
| Local Dev | In-memory Map (automatic fallback) |
| Purpose | Stores async blueprint generation task status |

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

---

## 8. Domain & DNS — locosnap.app

| Property | Value |
|----------|-------|
| Registrar | Hostinger |
| Domain | locosnap.app |
| Expires | 2027-03-21 |
| DNS Panel | hPanel → Domains → locosnap.app → DNS / Nameservers |

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
| From address | hello@locosnap.app |
| Auth email | noreply@locosnap.app (Supabase auth) |
| Dashboard | https://resend.com |

### Receiving / Forwarding (ImprovMX)
| Property | Value |
|----------|-------|
| Provider | ImprovMX |
| hello@locosnap.app | Forwards to unsunghistories@proton.me |
| Catch-all (*) | Forwards to unsunghistories@proton.me |
| Dashboard | https://improvmx.com |

---

## 11. Analytics & Monitoring

| Service | Purpose |
|---------|---------|
| PostHog | Product analytics — scan events, feature usage, funnels |
| Sentry | Error tracking + crash reporting |

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
| Latest Android Build | https://expo.dev/accounts/stephenlear1/projects/locosnap/builds/5437bbd6-bb1c-464c-8d8c-f7cb18675d8b |

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

## 17. Data Flow (Single Scan)

```
1. User takes photo
2. App uploads photo to POST /api/identify
3. Backend pre-warms on app mount (healthCheck) to avoid cold start
4. Vision API identifies the train (Claude or GPT-4o)
5. Specs + Facts + Rarity fetched in parallel (Claude or GPT-4o)
6. Blueprint generation starts async → returns taskId
7. Train data returned immediately to app
8. App displays results + polls GET /api/blueprint/:taskId
9. Blueprint completes → uploaded to Supabase Storage
10. Spot saved to Supabase (spots table)
11. XP awarded, streak updated, achievements checked
12. Leaderboard updated
```

---

## 18. Known Limitations / Pending Work

| Item | Status |
|------|--------|
| iOS update with latest fixes | Needs EAS build + App Store submission |
| Google Play closed testing | In Review |
| Scan history on guest → sign-in migration | Not implemented |
| Cloud sync race condition fix | Committed, needs EAS build to reach users |
