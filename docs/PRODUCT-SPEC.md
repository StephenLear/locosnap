# LocoSnap — Product Specification

**Version:** 2.0 (MVP)
**Date:** 2026-02-13
**One-liner:** Pokemon Go meets Shazam — for trains.

---

## 1. Problem Statement

Trainspotters love identifying and collecting sightings of locomotives, but there's no satisfying way to capture, classify, and share those moments. Existing train ID apps are utility-only (identify and forget), have zero gamification, and miss the rich collecting culture that trainspotters already have. There's no app that turns trainspotting into a digital hobby with progression, rarity tiers, and collectible cards — despite a passionate global community and mainstream cultural momentum (Francis Bourgeois: 3.3M TikTok followers).

## 2. Target Users

### Primary: Active Trainspotters (16-45)
- Regular platform visitors, heritage railway goers, mainline bashers
- Keep notebooks/spreadsheets of sightings
- Active on r/trainspotting, r/trains, RealTimeTrains, Railcam communities
- Would love a digital "book" that replaces pen-and-paper logging
- UK-centric initially (strongest culture), expanding to Europe/US/Japan

### Secondary: Casual Enthusiasts / Francis Bourgeois Fans
- Think trains are cool but don't call themselves "trainspotters"
- Drawn in by TikTok/YouTube trainspotting content
- Would enjoy a fun way to identify trains they see on commutes
- Share blueprint cards to social media

### Tertiary: Heritage Railway Visitors & Families
- Visit preserved railways on weekends
- Kids who love trains — parents want an educational, fun activity
- Heritage steam = guaranteed "rare" or better rarity tier = satisfying experience

## 3. Core Loop

```
SPOT → SNAP → IDENTIFY → COLLECT → SHARE → REPEAT
  |          |           |          |
  |     AI identifies    |     Post to social
  |     class, operator, |     Compare collections
  |     type, rarity     |     Climb leaderboard
  |                      |
  |             Added to your Shed
  |             Rarity assigned (Common → Legendary)
  |             Blueprint generated
  |
  See a train at the station/trackside/heritage railway
```

## 4. Feature Spec (MVP)

### 4.1 Spot (Home Screen)

**As a** trainspotter,
**I want to** take a photo of a train I see,
**so that** I can identify it and add it to my collection.

**Acceptance criteria:**
- [x] Camera viewfinder with "Spot" button
- [x] Option to pick from photo library
- [x] Loading state while AI processes (2-8 seconds)
- [x] Shows identified class + operator + confidence score
- [x] If confidence < 70%, show "Not sure — is this a [guess]?" with confirm/retry
- [x] Rate limit: 5 free spots/day (no paywall, just daily reset)
- [x] Counter showing remaining daily spots

### 4.2 Card Reveal

**As a** trainspotter,
**I want to** see my newly identified train as a collectible card,
**so that** I feel a sense of reward and excitement.

**Acceptance criteria:**
- [x] Animated card reveal (flip/slide animation)
- [x] Card shows: user's photo, class name, named loco if applicable, rarity tier badge
- [x] Card back shows: key specs (power, max speed, builder), one-line AI summary, fun fact
- [x] Rarity tier visually distinct (colour border, badge, glow effects for Rare+)
- [x] "New!" badge if this is a class you haven't collected before
- [x] "Duplicate" handling: still shows the card, adds to your spot count for that class
- [x] "Add to Shed" button (auto-saves on scan)
- [x] "Share" button (generates shareable image)

### 4.3 The Shed (Collection Screen)

**As a** trainspotter,
**I want to** browse all the trains I've collected,
**so that** I can see my progress and revisit past spots.

**Acceptance criteria:**
- [x] List/grid of collected cards (sorted by most recent)
- [x] Filter by: rarity tier, operator, train type (Steam/Diesel/Electric/DMU/EMU/HST)
- [x] Sort by: date spotted, rarity, class name
- [x] Collection stats at top: total unique classes, total spots, rarity breakdown
- [x] Tap card to see full details (specs, facts, blueprint, date spotted)
- [x] "Spotted X times" counter on duplicates
- [x] Empty state: "Your shed is empty — go spot your first train!"

### 4.4 Technical Blueprint

**As a** trainspotter,
**I want to** see a detailed engineering-style blueprint of my spotted train,
**so that** I have a premium visual to save and share.

**Acceptance criteria:**
- [x] Generated async after scan (15-60 seconds)
- [x] Locomotive works drawing aesthetic: steel grey, navy, orange accents, dimension lines
- [x] Shows: side elevation, cross-section, tech specs panel, wheel arrangement
- [x] Full-screen viewer with save + share
- [x] Save to camera roll
- [x] Share to social media
- [x] Blueprint is the "premium" version — free users get basic card, blueprint is Pro

### 4.5 Results Detail

**As a** trainspotter,
**I want to** see comprehensive info about my spotted train,
**so that** I can learn about it and satisfy my curiosity.

**Acceptance criteria:**
- [x] Rarity badge with tier, reason, production/surviving counts
- [x] Train identity: class, name, operator, type, designation, year built
- [x] Confidence score with colour coding
- [x] Full specs: max speed, power, weight, length, gauge, builder, fuel, route, status
- [x] Facts: summary, historical significance, fun facts, notable events
- [x] Blueprint status/viewer link

### 4.6 Leaderboard (V1.1)

**As a** trainspotter,
**I want to** see how my collection compares to others,
**so that** I feel motivated to spot more trains.

**Acceptance criteria:**
- [x] Global leaderboard: top spotters by unique classes collected
- [x] Weekly leaderboard: most spots this week
- [x] Rarity leaderboard: most Epic/Legendary cards
- [x] Your rank highlighted
- [x] Regional leaderboards (UK regions initially)

### 4.7 Profile & Stats (V1.1)

**As a** trainspotter,
**I want to** see my stats and achievements,
**so that** I can track my progress.

**Acceptance criteria:**
- [x] Username + avatar
- [x] Stats: total spots, unique classes, rarest find, longest streak, favourite operator
- [x] Level system: Platform Newbie → Casual Spotter → Basher → Grinder → Copping Legend
- [x] Badges/achievements: "First Cop" (first spot), "10 Unique Classes", "Copped a Legendary", "7-Day Streak", "Shed Full" (50+ unique), "Heritage Hunter" (10+ steam locos)
- [x] Daily streak tracker

### 4.8 Authentication (V1)

**As a** new user,
**I want to** create an account quickly,
**so that** my collection syncs across devices and appears on leaderboards.

**Acceptance criteria:**
- [x] Sign up with Apple / Google (social auth)
- [x] Magic link email as fallback
- [x] No username/password flow (friction killer)
- [x] Guest mode: can scan and collect locally, prompted to sign up to save to cloud
- [x] Account required for: leaderboards, sharing public shed, cloud sync

## 5. Rarity System

| Tier | Badge Colour | Train Type | Examples | Likelihood |
|------|-------------|------------|----------|------------|
| **Common** | Grey | Modern EMUs/DMUs in regular service | Class 350, Class 377, Class 800, Class 158 | ~50% |
| **Uncommon** | Green | Freight locos, older classes still running | Class 66, Class 37 on charters, Class 68 | ~25% |
| **Rare** | Blue | Heritage locos on mainline, withdrawn survivors | Deltic on mainline, Class 50, preserved diesel | ~15% |
| **Epic** | Purple | Famous named locomotives, few survivors | Flying Scotsman, Tornado, APT prototype | ~7% |
| **Legendary** | Gold | World-record holders, last of kind, royal trains | Mallard, unique prototypes, working Garratts | ~3% |

**Rarity is determined by:**
1. Number surviving (fewer = rarer)
2. Age and historical significance
3. Operational status (in-service = more common than preserved)
4. Named locomotive status (named individuals score higher than unnamed classmates)

## 6. Screens Map

```
App Launch
├── Auth (if not signed in)
│   ├── Sign in with Apple
│   ├── Sign in with Google
│   └── Continue as Guest
│
├── [Tab] Spot (Home)
│   ├── Camera viewfinder
│   ├── Photo library picker
│   ├── Scanning animation ("Identifying train...")
│   └── Card Reveal modal
│       ├── Card front (photo + class + rarity)
│       ├── Card back (specs + fun fact)
│       ├── Add to Shed
│       └── Share
│
├── [Tab] Shed (Collection)
│   ├── Collection grid with rarity borders
│   ├── Filters / sort
│   ├── Card detail view
│   │   ├── Full specs
│   │   ├── Facts & history
│   │   ├── Blueprint viewer
│   │   └── Spot history (dates)
│   └── Collection stats header
│
├── [Tab] Leaderboard (V1.1)
│   ├── Global ranking
│   ├── Weekly ranking
│   └── Rarity ranking
│
└── [Tab] Profile (V1.1)
    ├── Stats overview
    ├── Level + progress bar
    ├── Achievements / badges
    ├── Settings
    └── Sign up prompt (if guest)
```

## 7. Data Model

### User
```
id: uuid (PK)
username: string (unique)
email: string (unique)
avatar_url: string?
auth_provider: 'apple' | 'google' | 'email'
level: int (default 1)
xp: int (default 0)
streak_current: int (default 0)
streak_best: int (default 0)
last_spot_date: date?
daily_scans_used: int (default 0)
daily_scans_reset_at: timestamp
is_pro: boolean (default false)
created_at: timestamp
```

### Train (Reference Table — populated from AI identification)
```
id: uuid (PK)
class: string
name: string? (named locos only)
operator: string
type: string (Steam, Diesel, Electric, DMU, EMU, HST)
designation: string (wheel arrangement)
rarity_tier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
max_speed: string?
power: string?
weight: string?
length: string?
gauge: string?
builder: string?
number_built: int?
number_surviving: int?
status: string?
fuel_type: string?
summary: text?
historical_significance: text?
fun_facts: jsonb (string array)
blueprint_prompt: text?
created_at: timestamp
```

### Spot (User's Collection)
```
id: uuid (PK)
user_id: uuid (FK → User)
train_id: uuid (FK → Train)
photo_url: string
blueprint_url: string?
blueprint_status: 'queued' | 'processing' | 'completed' | 'failed'
confidence: float
latitude: float?
longitude: float?
spotted_at: timestamp
is_first_spot: boolean (new class for this user?)
```

### Achievement
```
id: uuid (PK)
user_id: uuid (FK → User)
achievement_type: string
unlocked_at: timestamp
```

## 8. Tech Stack

### Built (Complete)
| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend framework | React Native (Expo) | Done |
| Backend framework | Express + TypeScript | Done |
| Train ID service | Claude/OpenAI Vision | Done |
| Specs service | AI-generated (train APIs fragmented) | Done |
| Facts service | AI-generated history & trivia | Done |
| Rarity service | AI-classified (Common → Legendary) | Done |
| Blueprint generation | Replicate SDXL / DALL-E 3 | Done |
| State management | Zustand + AsyncStorage | Done |
| API client | Axios with polling | Done |

| Database | Supabase (Postgres) | Done |
| Auth | Supabase Auth (Apple/Google) | Done |
| Cloud storage | Supabase Storage | Done |
| Card capture | react-native-view-shot + expo-sharing | Done |

### To Add (Required for Full MVP)
| Layer | Technology | Reason |
|-------|-----------|--------|
| Push notifications | Expo Notifications | Blueprint ready, streak reminders |
| Analytics | PostHog | Track scan rates, retention, collection progress |
| Error tracking | Sentry | Crash reports, API failure monitoring |

### Cost at Launch (Free Tiers)
| Service | Free Tier |
|---------|-----------|
| Supabase | 500MB DB, 1GB storage, 50K auth users |
| Render/Railway (backend) | Free tier |
| PostHog | 1M events/month |
| Sentry | 5K errors/month |
| Expo | Unlimited OTA updates |
| **Total** | **$0/month until significant scale** |

## 9. Monetization

### Free Tier
- 5 spots per day (resets at midnight local time)
- Basic card art
- Collection + leaderboard access
- Share cards to social

### Pro (£4.99/month or £45/year)
- Unlimited spots
- Premium technical blueprints for every train
- Exclusive card frames/styles (heritage livery, British Rail blue, etc.)
- Detailed spec comparisons between trains in your collection
- No ads (if ads are added to free tier later)

### Unit Economics (with caching)

**Train data cache** reduces repeat scan costs by ~82%. Once a Class 390 has been identified, all subsequent Class 390 scans serve cached specs/facts/rarity/blueprint — only the Vision call runs.

| Scan Type | API Calls | Cost |
|-----------|----------|------|
| First scan (new class) | Vision + Specs + Facts + Rarity + Blueprint | ~£0.028 |
| Repeat scan (cached) | Vision only | ~£0.005 |
| **Blended average** (est. 70% cache hit rate) | | **~£0.012** |

| User Type | Scans/month | Cost/month | Revenue | Margin |
|-----------|-------------|-----------|---------|--------|
| Free (casual) | 60 | £0.72 | £0 | -£0.72 |
| Free (daily) | 150 | £1.80 | £0 | -£1.80 |
| Pro (moderate) | 200 | £2.40 | £4.99 | +£2.59 |
| Pro (heavy) | 500 | £6.00 | £4.99 | -£1.01 |
| Pro (annual) | 300/avg | £3.60 | £3.75/avg | +£0.15 |

**Break-even**: ~5% Pro conversion rate covers free tier costs. Heritage railway visitors (high rarity, more shareable) are the most likely converters.

### Key Principle
**Never paywall the core identification.** The 5 free daily spots are generous for casual use. Pro is for power users who spot 10+ trains a day and want the premium content. This is the same mistake every competitor makes — and their 1-star reviews prove users hate it.

## 10. MVP Scope

### V1 — The Core Loop (current + 2-3 weeks)
Build only what's needed to test: Spot → Card → Collect → Share

1. ~~Spot screen (camera + vision AI)~~ **DONE**
2. ~~Results screen (specs, facts, rarity)~~ **DONE**
3. ~~Collection screen (list of past spots)~~ **DONE**
4. ~~Blueprint generation + viewer~~ **DONE**
5. ~~Card reveal animation (flip/slide)~~ **DONE**
6. ~~User auth (Supabase — Apple/Google sign-in)~~ **DONE**
7. ~~Cloud storage for collection (Supabase)~~ **DONE**
8. ~~Share card as image~~ **DONE**
9. ~~Daily scan limit (5/day)~~ **DONE**

### V1.1 — Social & Gamification (+2 weeks)
1. ~~Global leaderboard (ranked by unique classes)~~ **DONE**
2. ~~Profile + stats page (level, XP, streak, rarity breakdown)~~ **DONE**
3. ~~Achievement badges (8 badges: First Cop → Full Spectrum)~~ **DONE**
4. ~~Level system (rarity-based XP: 10-250 per spot, 2x for first-of-class)~~ **DONE**
5. ~~Streak tracking (daily check, auto-increment, auto-reset)~~ **DONE**

### V1.2 — Polish & Growth (+2 weeks)
- ~~Push notifications (blueprint ready, streak reminders, achievement alerts)~~ **DONE**
- ~~Analytics (PostHog)~~ **DONE**
- ~~Error tracking (Sentry)~~ **DONE**
- ~~Card animations and particle effects for rare+~~ **DONE**
- ~~Location tagging (optional GPS)~~ **DONE**

### V2 — Pro & Monetization
- Pro subscription via App Store
- Pro-exclusive blueprint styles
- Collection comparisons
- Advanced filters and search

## 11. Success Metrics (First 30 Days)

| Metric | Target | Why It Matters |
|--------|--------|---------------|
| Day 1 retention | >40% | Do people come back after first use? |
| Day 7 retention | >20% | Does the collection loop retain? |
| Spots per user per day | >2 | Are people actively spotting? |
| Unique classes per user (30 days) | >10 | Is the collection growing? |
| Share rate | >15% of cards shared | Are blueprints/cards worth sharing? |
| Organic installs from shares | Any | Is the viral loop working? |

## 12. Competitive Advantage

1. **No gamified trainspotting app exists.** Train Identifier (only competitor) has Pokemon-style cards but 0 ratings — land-grab opportunity.
2. **Cultural moment.** Francis Bourgeois (3.3M TikTok, BBC appearances) has made trainspotting mainstream cool. Timing is perfect.
3. **Deep collecting culture.** Trainspotters already collect — they've just never had a digital tool that respects the hobby. We're digitising an analog behaviour.
4. **Blueprint virality.** The engineering-style blueprints are the "screenshot moment" — shareable content that markets the app organically.
5. **Never paywall identification.** Every car ID app competitor paywalls scans and gets destroyed in 1-star reviews. We won't make that mistake.
