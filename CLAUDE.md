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

## Mandatory Workflow Rules

### After any code change — run `/changelog`
After every session where you edit, create, or delete files in `frontend/` or `backend/`, you **MUST** invoke the `/changelog` skill to record what changed in `docs/CHANGELOG.md`. This is non-negotiable — the changelog is the permanent record of what changed and why. Do not skip it.

### After any architectural change — update `docs/ARCHITECTURE.md`
`docs/ARCHITECTURE.md` must be kept in perfect sync with the codebase at all times. Update it in the same session as the change — never defer to a later session. Zero information loss is the standard.

Update `docs/ARCHITECTURE.md` whenever any of the following change:
- Auth flow, data persistence, API endpoints, monetisation model, scan limits, new services
- AI provider configuration — active provider, fallback, temperature, prompt strategy, hardcoded specs or disambiguation rules
- Cache version, cache strategy, or cache invalidation logic
- Wikidata integration behaviour — guards, conflict resolution rules, corrections map
- Database schema, table structure, or RLS rules
- Build versions, EAS configuration, or distribution status
- Tester list — additions, corrections, signup status, Pro grant status
- Infrastructure — Render, Supabase, Redis, Resend, RevenueCat, Sentry, PostHog
- Operational processes — any process documented in the architecture doc that changes

**The test:** if a new session reads only `docs/ARCHITECTURE.md`, it should have a complete and accurate picture of the system with no gaps. If a handover contains information not in the architecture doc, the architecture doc is wrong and must be fixed before the session closes.

### Changelog location
`docs/CHANGELOG.md` — all frontend and backend code changes recorded here with date, file, what changed, and why.

### No emojis — ever
Never use emojis in any response, output, file, caption, script, email, or message in this project. This applies everywhere without exception. No emoji characters of any kind.

### Before asserting what is or is not in a build
Always read `docs/CHANGELOG.md` first. Never state what a build contains or does not contain from memory.

### Before searching project files for a previous session output
When the user references a list, plan, schedule, or output created in a previous session, check `docs/handoffs/` newest-first before searching anywhere else. Handovers are the authoritative record of what was produced in each session.

### When writing German copy
Always verify umlaut characters are correct before outputting. Use the proper Unicode characters: ä, ö, ü, Ä, Ö, Ü, ß. Common failure points: schön (not schon), überzeugt (not uberzeugt), Grüße (not Gruse), für (not fur). Read back any German text once before sending.

### After any backend commit — push-or-hold decision required
After committing any backend change, explicitly state: "Not yet deployed — needs a push to go live on Render." Then ask: push now or hold? Never leave a backend commit sitting without a clear decision on deployment.

### After triggering an EAS build — confirm monitoring method
After any `eas build` command, confirm how the build will be monitored and how the APK/IPA link will be retrieved and distributed. Never ask the user to supply the link — handle it directly.

### Before every session ends — update changelog and architecture docs
Before closing any session, both `docs/CHANGELOG.md` and `docs/ARCHITECTURE.md` must be current. This is non-negotiable and applies to every session without exception — even sessions with no code changes (build submissions, stat logging, content work, and decisions still affect build status, scan limits, and distribution state in the architecture doc).

**Checklist before session close:**
1. `docs/CHANGELOG.md` — all frontend/backend file edits recorded with date, file, what changed, and why
2. `docs/ARCHITECTURE.md` — build versions, scan limits, distribution status, and any other changed state updated; last updated date bumped
3. Run `/handover` to capture session context

Do not treat this as optional when the session feels short or non-technical. A session that submits a build, changes a stat, or makes a product decision has architecture-doc-worthy state changes.

---

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
