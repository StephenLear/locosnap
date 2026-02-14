# LocoSnap — Project Context

## What Is This?

LocoSnap is a mobile app that identifies trains from photos. Users take a photo of any train, and the app tells them the class, operator, year built, and type — along with technical specs, historical facts, rarity classification, and an AI-generated blueprint-style illustration.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo (TypeScript) |
| Navigation | Expo Router (file-based) |
| State Management | Zustand + AsyncStorage |
| Backend | Express.js (TypeScript) |
| Train Identification | Claude Vision OR OpenAI GPT-4o Vision (auto-detected) |
| Train Specs | Claude OR OpenAI GPT-4o (auto-detected) |
| Train Facts | Claude OR OpenAI GPT-4o (auto-detected) |
| Rarity Classification | Claude OR OpenAI GPT-4o (auto-detected) |
| Blueprint Generation | Replicate API (SDXL) or OpenAI DALL-E 3 |
| Blueprint Task Store | Redis (Upstash) with in-memory fallback |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Analytics | PostHog + Sentry |
| Monetization | RevenueCat |
| CI/CD | GitHub Actions |

## Multi-Provider Support

The backend auto-detects which API keys you have and uses the right provider:

- **Vision (train ID):** Prefers Claude Vision, falls back to OpenAI GPT-4o Vision
- **Specs/Facts/Rarity:** Prefers Claude, falls back to OpenAI GPT-4o
- **Blueprints:** Prefers Replicate (SDXL), falls back to OpenAI DALL-E 3

You only need ONE of: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to run the full app. Having both is fine — it'll prefer Anthropic.

## Project Structure

```
locosnap/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Server entry point
│   │   ├── config/
│   │   │   ├── env.ts            # Environment config + feature flags
│   │   │   └── supabase.ts       # Supabase client
│   │   ├── routes/
│   │   │   ├── identify.ts       # POST /api/identify (main endpoint)
│   │   │   ├── imageStatus.ts    # GET /api/blueprint/:taskId
│   │   │   └── webhooks.ts       # POST /api/webhooks/revenuecat
│   │   ├── services/
│   │   │   ├── vision.ts         # Train ID (Claude Vision / OpenAI GPT-4o)
│   │   │   ├── trainSpecs.ts     # Technical specifications (Claude / OpenAI)
│   │   │   ├── trainFacts.ts     # Historical facts (Claude / OpenAI)
│   │   │   ├── rarity.ts         # Rarity classification (Claude / OpenAI)
│   │   │   ├── imageGen.ts       # Blueprint generation (Replicate / DALL-E 3)
│   │   │   ├── redis.ts          # Blueprint task store (Redis / in-memory)
│   │   │   ├── trainCache.ts     # In-memory train data cache
│   │   │   └── analytics.ts      # PostHog + Sentry
│   │   ├── middleware/
│   │   │   └── errorHandler.ts
│   │   ├── __tests__/            # Jest test suites (53 tests)
│   │   └── types/index.ts
│   ├── jest.config.ts
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── app/
│   │   ├── _layout.tsx           # Root layout
│   │   ├── (tabs)/_layout.tsx    # Tab navigation
│   │   ├── (tabs)/index.tsx      # Camera/scan screen
│   │   ├── (tabs)/history.tsx    # Scan history
│   │   ├── (tabs)/profile.tsx    # User profile + achievements
│   │   ├── results.tsx           # Train details + specs + facts
│   │   ├── blueprint.tsx         # Full-screen blueprint viewer
│   │   └── compare.tsx           # Side-by-side train comparison
│   ├── services/
│   │   ├── api.ts                # Backend API client
│   │   ├── supabase.ts           # Supabase operations
│   │   ├── analytics.ts          # PostHog + Sentry
│   │   └── notifications.ts     # Push notifications
│   ├── store/
│   │   ├── trainStore.ts         # Zustand train state
│   │   └── authStore.ts          # Zustand auth state
│   ├── utils/
│   │   └── compare.ts            # Comparison helper functions
│   ├── constants/
│   │   ├── theme.ts              # Design system
│   │   └── api.ts                # API config
│   ├── types/index.ts
│   ├── __tests__/                # Jest test suites (39 tests)
│   ├── jest.config.js
│   ├── app.json                  # Expo config
│   ├── eas.json                  # EAS Build config
│   └── package.json
│
├── .github/workflows/
│   ├── ci.yml                    # CI: backend + frontend tests on push
│   └── preview.yml               # EAS preview build on frontend PRs
│
├── .gitignore
└── CLAUDE.md                     # This file
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/identify | Upload train photo -> train ID, specs, facts, rarity, blueprint task ID |
| GET | /api/blueprint/:taskId | Poll blueprint generation status |
| GET | /api/health | Health check (shows active providers + Redis status) |
| POST | /api/webhooks/revenuecat | RevenueCat subscription webhooks |

## Data Flow

1. User takes/selects photo -> frontend uploads to `/api/identify`
2. Backend sends image to Vision API (Claude or OpenAI) -> identifies train
3. Backend fetches specs, facts, and rarity in parallel (all AI-powered)
4. Backend starts blueprint generation (async, returns task ID)
5. Backend returns train data immediately (blueprint still generating)
6. Frontend displays results, polls `/api/blueprint/:taskId`
7. When blueprint is ready, user can view/save/share it
8. Train data is synced to Supabase (spots, XP, achievements)

## Environment Variables (Backend)

```
# At minimum, you need ONE of these:
ANTHROPIC_API_KEY=sk-ant-...     # For Claude Vision + specs/facts/rarity
OPENAI_API_KEY=sk-...            # For GPT-4o Vision + specs/facts/rarity + DALL-E 3

# Optional (for blueprints if not using OpenAI):
REPLICATE_API_TOKEN=r8_...

# Redis (blueprint task store — optional, falls back to in-memory):
REDIS_URL=

# Supabase (optional — app works without it):
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

# Analytics (optional):
POSTHOG_API_KEY=
POSTHOG_HOST=
SENTRY_DSN=

# RevenueCat (optional):
REVENUECAT_WEBHOOK_SECRET=

# Server config:
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:8081
```

## Testing

```bash
# Backend (53 tests across 11 suites)
cd backend && npm test

# Frontend (39 tests across 3 suites)
cd frontend && npm test
```

Tests cover:
- **Backend services:** vision, trainSpecs, trainFacts, rarity, imageGen, trainCache, redis, analytics
- **Backend routes:** identify (integration), imageStatus, webhooks
- **Frontend utils:** compare (parseNumeric, compareValues)
- **Frontend store:** trainStore (Zustand state management)
- **Frontend services:** API client (identifyTrain, checkBlueprintStatus, healthCheck, pollBlueprintStatus)

## Key Design Decisions

1. **Multi-provider architecture** — Works with either Anthropic or OpenAI keys
2. **Redis with in-memory fallback** — Production uses Upstash Redis for blueprint task store; local dev uses in-memory Map
3. **Blueprint style system** — Users choose from technical, vintage, watercolor, or cinematic styles
4. **Async blueprint generation** — Returns train data immediately, polls for blueprint
5. **Zustand over Redux** — Minimal boilerplate for state management
6. **Dark theme** — Industrial aesthetic matches the blueprint style
7. **ts-jest for frontend tests** — Pure logic tests (no RN rendering) for reliability across Node versions

## How to Run (Development)

```bash
# Backend
cd backend
cp .env.example .env  # Add your API keys
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npx expo start
# Scan QR code with Expo Go on your phone
```

## Deployment

### Backend -> Render.com
1. Push code to GitHub
2. Create Web Service on Render, connect to repo
3. Set root directory: `backend`
4. Build command: `npm install && npm run build`
5. Start command: `npm start`
6. Add environment variables in Render dashboard
7. Add Upstash Redis URL for production blueprint storage

### Frontend -> App Store / Google Play
1. Install EAS CLI: `npm install -g eas-cli`
2. Login: `eas login`
3. Build: `eas build --platform all --profile production`
4. Submit: `eas submit --platform all`
