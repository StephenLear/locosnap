# CarSnap — Project Context

## What Is This?

CarSnap is a mobile app that identifies cars from photos. Users take a photo of any car, and the app tells them the make, model, year, and trim — along with aggregated review scores and an AI-generated industrial engineering-style infographic of the vehicle.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native + Expo (TypeScript) |
| Navigation | Expo Router (file-based) |
| State Management | Zustand + AsyncStorage |
| Backend | Express.js (TypeScript) |
| Car Identification | Claude Vision OR OpenAI GPT-4o Vision (auto-detected) |
| Vehicle Specs | NHTSA API (free, no key required) |
| Review Summaries | Claude OR OpenAI GPT-4o (auto-detected) |
| Infographic Gen | Replicate API (SDXL) or OpenAI DALL-E 3 |

## Multi-Provider Support

The backend auto-detects which API keys you have and uses the right provider:

- **Vision (car ID):** Prefers Claude Vision, falls back to OpenAI GPT-4o Vision
- **Reviews:** Prefers Claude, falls back to OpenAI GPT-4o
- **Infographics:** Prefers Replicate (SDXL), falls back to OpenAI DALL-E 3

You only need ONE of: `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` to run the full app. Having both is fine — it'll prefer Anthropic.

## Project Structure

```
carsnap/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Server entry point
│   │   ├── config/env.ts         # Environment config + feature flags
│   │   ├── routes/
│   │   │   ├── identify.ts       # POST /api/identify (main endpoint)
│   │   │   └── imageStatus.ts    # GET /api/image/:taskId
│   │   ├── services/
│   │   │   ├── vision.ts         # Car ID (Claude Vision / OpenAI GPT-4o)
│   │   │   ├── reviews.ts        # Review summaries (Claude / OpenAI)
│   │   │   ├── nhtsa.ts          # NHTSA vehicle specs (free API)
│   │   │   └── imageGen.ts       # Infographic gen (Replicate / OpenAI)
│   │   ├── middleware/
│   │   │   └── errorHandler.ts
│   │   └── types/index.ts
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
│   │   ├── results.tsx           # Car details + reviews
│   │   └── infographic.tsx       # Full-screen infographic viewer
│   ├── services/api.ts           # Backend API client
│   ├── store/carStore.ts         # Zustand state
│   ├── constants/
│   │   ├── theme.ts              # Design system
│   │   └── api.ts                # API config
│   ├── types/index.ts
│   ├── app.json                  # Expo config
│   ├── eas.json                  # EAS Build config
│   └── package.json
│
├── .gitignore
└── CLAUDE.md                     # This file
```

**Note:** `backend/src/services/claude.ts` is deprecated dead code — delete it. The functionality was split into `vision.ts` and `reviews.ts`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/identify | Upload car photo -> car ID, specs, reviews, infographic task ID |
| GET | /api/image/:taskId | Poll infographic generation status |
| GET | /api/health | Health check (shows active providers) |

## Data Flow

1. User takes/selects photo -> frontend uploads to `/api/identify`
2. Backend sends image to Vision API (Claude or OpenAI) -> identifies car
3. Backend fetches NHTSA specs + AI review summaries in parallel
4. Backend starts infographic generation (async, returns task ID)
5. Backend returns car data immediately (infographic still generating)
6. Frontend displays results, polls `/api/image/:taskId` every 3s
7. When infographic is ready, user can view/save/share it

## Environment Variables (Backend)

```
# At minimum, you need ONE of these:
ANTHROPIC_API_KEY=sk-ant-...     # For Claude Vision + reviews
OPENAI_API_KEY=sk-...            # For GPT-4o Vision + reviews + DALL-E 3 infographics

# Optional (for infographics if not using OpenAI):
REPLICATE_API_TOKEN=r8_...

# Server config:
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:8081
```

## Key Design Decisions

1. **Multi-provider architecture** — Works with either Anthropic or OpenAI keys
2. **Express.js over FastAPI** — Same language ecosystem as frontend (JS/TS)
3. **Async infographic generation** — Returns car data immediately, polls for image
4. **In-memory task store** — Upgrade to Redis when scaling
5. **Zustand over Redux** — Minimal boilerplate
6. **Dark theme** — Industrial aesthetic matches the infographic style

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

### Frontend -> App Store / Google Play
1. Install EAS CLI: `npm install -g eas-cli`
2. Login: `eas login`
3. Build: `eas build --platform all --profile production`
4. Submit: `eas submit --platform all`

## What's Next (v2)

- User accounts / authentication
- Cloud sync of history
- Freemium monetization (5 free scans/month)
- Edmunds/MotorTrend API integration
- Dealer inventory integration
- Web version
- Push notifications
