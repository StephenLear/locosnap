# LocoSnap Hardening Phase — Design Doc

**Date:** 2026-02-14
**Status:** DRAFT — awaiting approval
**Prereq:** V2 complete (commits `aaf1a17`, `d5e6355`)

---

## Goal

Harden LocoSnap for production before App Store submission: replace the in-memory blueprint store with Redis, add comprehensive test coverage (backend + frontend), set up CI/CD, and clean up housekeeping items.

---

## 1. Redis Blueprint Task Store

### Problem
Blueprint generation uses an in-memory `Map<string, BlueprintTask>` in `imageGen.ts`. This loses all in-flight tasks on restart and can't scale past a single process.

### Solution
- **Client:** `ioredis` (TypeScript support, connection pooling, battle-tested)
- **Provider:** Upstash Redis (free tier: 10K commands/day, serverless)
- **TTL:** 1 hour per task — blueprint tasks are transient (queued → processing → completed/failed)
- **Fallback:** If no `REDIS_URL` is set, fall back to the existing in-memory Map with a console warning. Local dev stays friction-free.

### Files Touched
| File | Change |
|------|--------|
| `backend/src/services/redis.ts` | **NEW** — Redis client wrapper (connect, get, set, expire, health check) |
| `backend/src/services/imageGen.ts` | Swap `taskStore` Map → Redis get/set calls |
| `backend/src/config/env.ts` | Add `REDIS_URL` to env config |
| `backend/.env.example` | Add `REDIS_URL` placeholder |

### Design Details
- `redis.ts` exports `getRedisClient()` which lazy-initialises the connection
- `setBlueprintTask(taskId, task)` → `SET blueprint:{taskId} {JSON} EX 3600`
- `getBlueprintTask(taskId)` → `GET blueprint:{taskId}` → parse JSON
- If `ioredis` connection fails on startup, log warning and set `useInMemoryFallback = true`
- Existing `Map` code stays as the fallback path — zero risk of breaking local dev

---

## 2. Testing Framework & Coverage

### Infrastructure
- **Runner:** Jest (Expo's default — same runner for backend and frontend)
- **Backend config:** `backend/jest.config.ts`
- **Frontend config:** `frontend/jest.config.ts` + `jest.setup.ts` (React Native mocks)
- **Frontend testing lib:** `@testing-library/react-native`
- **Mocks directory:** `backend/src/__mocks__/` and `frontend/__mocks__/`
- **Common test utilities:** Mock train data factory, mock user factory

### Backend Tests (~45 tests)

| Service | What's Tested | ~Tests |
|---------|--------------|--------|
| `vision.ts` | Mocked AI calls, confidence thresholds, fallback provider logic, error handling | 6 |
| `trainCache.ts` | Cache hit/miss, style-keyed lookups, legacy `blueprintUrl` fallback | 6 |
| `rarity.ts` | Tier classification, surviving count boundaries, edge cases | 5 |
| `trainSpecs.ts` | Spec extraction, missing/partial data handling | 4 |
| `trainFacts.ts` | Fact generation, empty/error states | 4 |
| `imageGen.ts` | Task lifecycle (queued → processing → complete → failed), style prompt selection, Redis integration, fallback to in-memory | 8 |
| `analytics.ts` | Event firing, disabled state (no API key) | 3 |
| **Routes** | | |
| `identify.ts` | Full pipeline (mocked services), style param validation, rate limit enforcement | 6 |
| `imageStatus.ts` | Polling happy path, task not found (404), completed with URL | 4 |
| `webhooks.ts` | RevenueCat signature validation, subscription event processing | 4 |

### Frontend Tests (~35 tests)

| Screen/Component | What's Tested | ~Tests |
|-----------------|--------------|--------|
| `(tabs)/index.tsx` | Renders camera, scan button, daily limit counter, Pro style picker gating | 5 |
| `results.tsx` | Spec display, rarity badge colour, blueprint link, share button | 5 |
| `(tabs)/history.tsx` | Text search filtering, builder chip filtering, compare mode toggle, "Has Blueprint" switch | 6 |
| `compare.tsx` | `parseNumeric()` extraction, `compareValues()` winner logic, CompRow highlight rendering | 5 |
| `card-reveal.tsx` | Animation trigger, new vs duplicate badge display | 3 |
| `paywall.tsx` | Paywall renders, entitlement check routing | 3 |
| `store/trainStore.ts` | Zustand actions: set blueprint style, set compare items, add/clear | 5 |
| `services/api.ts` | `identifyTrain()` FormData construction, error handling, style param inclusion | 4 |

### Mock Strategy
All external services are mocked at the module boundary:
- Anthropic SDK → mock response objects
- OpenAI SDK → mock response objects
- Replicate SDK → mock prediction objects
- Supabase client → mock query builder
- RevenueCat → mock entitlements
- Redis → mock get/set (or use in-memory fallback)
- PostHog → mock capture (no-op)

No real API keys needed in CI.

---

## 3. GitHub Actions CI/CD

### Workflow 1: `ci.yml` (every push & PR)

```
Trigger: push to any branch, PR to main
Steps:
  1. Checkout
  2. Setup Node 20
  3. Cache node_modules (npm ci)
  4. TypeScript type-check (backend + frontend)
  5. Backend tests (jest --ci)
  6. Frontend tests (jest --ci)
Env: Mock values only (no real API keys)
Est. runtime: ~2-3 minutes
```

### Workflow 2: `preview.yml` (PR to main, frontend changes only)

```
Trigger: PR to main (paths: frontend/**)
Steps:
  1. Checkout
  2. Setup Node 20 + Expo CLI
  3. Run eas build --profile preview --platform all --non-interactive
  4. Post build link as PR comment
Env: Requires EAS_TOKEN secret
Est. runtime: ~10-15 minutes (EAS build)
```

---

## 4. Housekeeping

| Item | Detail |
|------|--------|
| Fix `CLAUDE.md` | "CarSnap" → "LocoSnap", update project structure & current state |
| Fix `backend/package.json` test script | `"test": "ts-node src/test.ts"` → `"test": "jest --ci"` |
| Add `REDIS_URL` to both `.env.example` files | Document the new env var |
| Archive plan file | `~/.claude/plans/warm-humming-codd.md` — mark as complete |

---

## Implementation Order

| Phase | What | Dependencies | Est. Size |
|-------|------|-------------|-----------|
| 1 | Redis task store | None | ~4 files, small |
| 2 | Test framework setup | None | Config + mocks |
| 3 | Backend tests | Phase 1 + 2 | ~45 tests |
| 4 | Frontend tests | Phase 2 | ~35 tests |
| 5 | GitHub Actions | Phase 3 + 4 (tests must exist) | 2 workflow files |
| 6 | Housekeeping | None | Trivial |

Phases 1 and 2 can run in parallel. Phase 3+4 can run in parallel. Phase 5 depends on tests existing. Phase 6 is independent.

---

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Redis provider | Upstash | Free tier, serverless, no always-on process |
| Redis client | ioredis | TypeScript, connection pooling, most popular |
| Fallback strategy | In-memory Map | Keeps local dev friction-free |
| Test runner | Jest | Expo default, works for both backend + frontend |
| Frontend testing lib | @testing-library/react-native | Standard, focuses on user behaviour |
| CI platform | GitHub Actions | Free for public repos, native to GitHub |
| Test scope | Full (backend + frontend) | User chose comprehensive coverage |
