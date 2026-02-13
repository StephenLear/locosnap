# Car Spotter — Product Specification

**Version:** 1.0 (MVP)
**Date:** 2026-02-13
**One-liner:** Pokemon Go meets Shazam — for cars.

---

## 1. Problem Statement

Car enthusiasts love spotting interesting vehicles in the wild, but there's no satisfying way to capture, collect, and share those moments. Existing car ID apps are utility-only (identify and forget), have aggressive paywalls, and compete directly with free AI chatbots. There's no app that turns car spotting into a hobby with progression, social proof, and collectibility.

## 2. Target Users

### Primary: Car Enthusiasts (18-35)
- Follow car accounts on Instagram/TikTok/YouTube
- Notice interesting cars on the street and want to know what they are
- Would enjoy building a collection and showing it off
- Active on r/cars, r/whatisthiscar, car forums

### Secondary: Casual Spotters
- See a cool car, get curious, snap a photo
- Don't know much about cars but think the blueprint card is cool
- Share to social media for engagement

### Tertiary: Car Content Creators
- YouTubers, TikTokers, Instagram pages about cars
- Use the blueprint cards as content assets
- Drive organic growth through sharing

## 3. Core Loop

```
SPOT → SCAN → COLLECT → SHARE → REPEAT
  |        |        |         |
  |   AI identifies  |    Post to social
  |   + generates    |    Compare w/ friends
  |   blueprint card |    Climb leaderboard
  |                  |
  |           Added to your Garage
  |           Rarity assigned
  |           Stats recorded
  |
  See a car in the wild
```

## 4. Feature Spec (MVP)

### 4.1 Scan (Home Screen)

**As a** car spotter,
**I want to** take a photo of a car I see,
**so that** I can identify it and add it to my collection.

**Acceptance criteria:**
- [ ] Camera viewfinder with "Scan" button
- [ ] Option to pick from photo library
- [ ] Loading state while AI processes (2-5 seconds)
- [ ] Shows identified car name + confidence score
- [ ] If confidence < 70%, show "Not sure — is this a [guess]?" with confirm/retry
- [ ] Rate limit: 5 free scans/day (no paywall, just daily reset)
- [ ] Counter showing remaining daily scans

### 4.2 Card Reveal

**As a** car spotter,
**I want to** see my newly identified car as a collectible card,
**so that** I feel a sense of reward and excitement.

**Acceptance criteria:**
- [ ] Animated card reveal (flip/slide animation)
- [ ] Card shows: car photo (user's photo), make/model/year, rarity tier badge
- [ ] Card back shows: key specs (HP, 0-60, price range), NHTSA safety rating, one-line AI review
- [ ] Rarity tier visually distinct (color border, badge, particle effects for Epic+)
- [ ] "New!" badge if this is a car model you haven't collected before
- [ ] "Duplicate" handling: still shows the card, adds to your spot count for that model
- [ ] "Add to Garage" button
- [ ] "Share" button (generates shareable image)

### 4.3 Garage (Collection Screen)

**As a** car spotter,
**I want to** browse all the cars I've collected,
**so that** I can see my progress and revisit past spots.

**Acceptance criteria:**
- [ ] Grid view of all collected cards (sorted by most recent)
- [ ] Filter by: rarity tier, brand, body type
- [ ] Sort by: date spotted, rarity, name
- [ ] Collection stats at top: total unique models, total spots, rarity breakdown
- [ ] Tap card to see full details (specs, review, map location if available, date spotted)
- [ ] "Spotted X times" counter on duplicates
- [ ] Empty state for new users: "Your garage is empty — go spot your first car!"

### 4.4 Blueprint Infographic

**As a** car spotter,
**I want to** see a detailed engineering-style blueprint of my spotted car,
**so that** I have a premium visual to save and share.

**Acceptance criteria:**
- [ ] Generated async after scan (15-60 seconds)
- [ ] Industrial blueprint aesthetic: steel grey, navy, orange accents, dimension lines
- [ ] Shows: profile view, key dimensions, engine specs, performance stats
- [ ] Notification/badge when blueprint is ready
- [ ] Full-screen viewer with pinch-to-zoom
- [ ] Save to camera roll
- [ ] Share to social media
- [ ] Blueprint is the "premium" version of the card — free users get basic card, blueprint is Pro

### 4.5 Leaderboard

**As a** car spotter,
**I want to** see how my collection compares to others,
**so that** I feel motivated to spot more cars.

**Acceptance criteria:**
- [ ] Global leaderboard: top spotters by unique models collected
- [ ] Weekly leaderboard: most spots this week (resets Monday)
- [ ] Rarity leaderboard: most Epic/Legendary cards
- [ ] Your rank highlighted
- [ ] Tap a user to see their public garage (top cards only)

### 4.6 Profile & Stats

**As a** car spotter,
**I want to** see my stats and achievements,
**so that** I can track my progress.

**Acceptance criteria:**
- [ ] Username + avatar (from sign-up)
- [ ] Stats: total spots, unique models, rarest find, longest streak, favourite brand
- [ ] Level system: Novice Spotter → Street Watcher → Car Hawk → Auto Legend → Grand Collector
- [ ] Level-up thresholds based on unique models collected
- [ ] Badges/achievements: "First Spot", "10 Unique Cars", "Spotted a Legendary", "7-Day Streak", "Brand Collector (10+ from one brand)"
- [ ] Daily streak tracker

### 4.7 Authentication

**As a** new user,
**I want to** create an account quickly,
**so that** my collection syncs across devices and appears on leaderboards.

**Acceptance criteria:**
- [ ] Sign up with Apple / Google (social auth)
- [ ] Magic link email as fallback
- [ ] No username/password flow (friction killer)
- [ ] Guest mode: can scan and collect locally, prompted to sign up to save to cloud + join leaderboards
- [ ] Account required for: leaderboards, sharing public garage, cloud sync

## 5. Rarity System

| Tier | Badge Colour | Car Type | Examples | Likelihood |
|------|-------------|----------|----------|------------|
| **Common** | Grey | Mass market sedans, SUVs, hatchbacks | Toyota Camry, Honda Civic, Ford Escape | ~55% |
| **Uncommon** | Green | Sports cars, trucks, popular premium | Mustang, F-150 Raptor, BMW 3 Series | ~25% |
| **Rare** | Blue | Luxury, performance variants | Mercedes AMG, Audi RS, Lexus LC | ~12% |
| **Epic** | Purple | Exotic sports, classic muscle | Porsche 911 GT3, Corvette Z06, vintage Mustang | ~6% |
| **Legendary** | Gold | Hypercars, ultra-rare, one-offs | Ferrari, Lamborghini, Bugatti, McLaren | ~2% |

**Rarity is determined by:**
1. Production volume (lower = rarer)
2. Price bracket (higher = rarer)
3. Age (classic/vintage = rarer)
4. Regional scarcity (based on NHTSA registration data if available)

## 6. Screens Map

```
App Launch
├── Auth (if not signed in)
│   ├── Sign in with Apple
│   ├── Sign in with Google
│   └── Continue as Guest
│
├── [Tab] Home / Scan
│   ├── Camera viewfinder
│   ├── Photo library picker
│   ├── Scanning animation
│   └── Card Reveal modal
│       ├── Card front (photo + ID)
│       ├── Card back (specs + review)
│       ├── Add to Garage
│       └── Share
│
├── [Tab] Garage
│   ├── Collection grid
│   ├── Filters / sort
│   ├── Card detail view
│   │   ├── Full specs
│   │   ├── Blueprint viewer
│   │   └── Spot history (dates, locations)
│   └── Collection stats
│
├── [Tab] Leaderboard
│   ├── Global ranking
│   ├── Weekly ranking
│   └── Rarity ranking
│
└── [Tab] Profile
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

### Car (Reference Table — populated from AI + NHTSA)
```
id: uuid (PK)
make: string
model: string
year: int
trim: string?
body_type: string
rarity_tier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
horsepower: int?
zero_to_sixty: float?
price_range_low: int?
price_range_high: int?
nhtsa_safety_rating: float?
review_summary: text?
review_score: float?
blueprint_prompt: text?
created_at: timestamp
```

### Spot (User's Collection)
```
id: uuid (PK)
user_id: uuid (FK → User)
car_id: uuid (FK → Car)
photo_url: string
blueprint_url: string?
blueprint_status: 'queued' | 'processing' | 'completed' | 'failed'
confidence: float
latitude: float?
longitude: float?
spotted_at: timestamp
is_first_spot: boolean (was this a new model for the user?)
```

### Achievement
```
id: uuid (PK)
user_id: uuid (FK → User)
achievement_type: string
unlocked_at: timestamp
```

## 8. Tech Stack

### Reuse from CarSnap
| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend framework | React Native (Expo) | Keep |
| Backend framework | Express + TypeScript | Keep |
| Car ID service | Claude/OpenAI Vision | Keep |
| Specs service | NHTSA API | Keep |
| Review service | Claude/OpenAI | Keep |
| Infographic gen | Replicate/DALL-E | Keep |
| State management | Zustand | Keep |

### New (Required for Pivot)
| Layer | Technology | Reason |
|-------|-----------|--------|
| Database | Supabase (Postgres) | User accounts, collection storage, leaderboards |
| Auth | Supabase Auth | Apple/Google sign-in, magic links, free tier |
| Cloud storage | Supabase Storage | User photos, blueprint images |
| Real-time | Supabase Realtime | Live leaderboard updates |
| Push notifications | Expo Notifications | Blueprint ready, streak reminders |
| Analytics | PostHog | Track scan rates, retention, collection progress |
| Error tracking | Sentry | Crash reports, API failure monitoring |

### Cost at Launch (Free Tiers)
| Service | Free Tier |
|---------|-----------|
| Supabase | 500MB DB, 1GB storage, 50K auth users |
| Vercel (backend) | 100GB bandwidth |
| PostHog | 1M events/month |
| Sentry | 5K errors/month |
| Expo | Unlimited OTA updates |
| **Total** | **$0/month until significant scale** |

## 9. Monetization

### Free Tier
- 5 scans per day (resets at midnight local time)
- Basic card art (clean, simple design)
- Collection + leaderboard access
- Share cards to social

### Pro ($2.99/month or $24.99/year)
- Unlimited scans
- Premium blueprint infographics for every car
- Exclusive card frames/styles
- Detailed spec comparisons between cars in your collection
- No ads (if ads are added to free tier later)

### Key Principle
**Never paywall the core identification.** Every competitor does this and users hate it. The 5 free daily scans are generous enough for casual use. Pro is for power users who spot 10+ cars a day and want the premium content.

## 10. MVP Scope (What to Build First)

### V1 — The Core Loop (2-3 weeks)
Build only what's needed to test: Spot → Card → Collect → Share

1. Scan screen (reuse existing camera + vision code)
2. Card reveal with rarity tier
3. Garage screen (grid of collected cards)
4. Card detail with specs
5. User auth (Supabase — Apple/Google sign-in)
6. Cloud storage for collection
7. Share card as image
8. Daily scan limit (5/day)

### V1 Does NOT Include
- Leaderboards (add in V1.1)
- Blueprint infographics (add in V1.1 — already built, just needs integration)
- Achievements/badges (add in V1.2)
- Pro subscription (add after validating retention)
- Push notifications (add after user base)
- Analytics (add before public launch, but not needed for testing)

## 11. Success Metrics (First 30 Days)

| Metric | Target | Why It Matters |
|--------|--------|---------------|
| Day 1 retention | >40% | Do people come back after first use? |
| Day 7 retention | >20% | Does the collection loop retain? |
| Scans per user per day | >2 | Are people actively spotting? |
| Unique models per user (30 days) | >15 | Is the collection growing? |
| Share rate | >10% of cards shared | Is the content worth sharing? |
| Organic installs from shares | Any | Is the viral loop working? |

## 12. Name — Needs Resolution

"CarSnap" is taken on the iOS App Store by another developer. Working title options:
- **SpotCar** / **CarSpot**
- **SpotDeck**
- **AutoSpotter**
- **CarDex** (Pokedex vibes)
- **SnapDeck**
- **SpotLog**

**Action needed:** Check App Store availability before committing to a name.
