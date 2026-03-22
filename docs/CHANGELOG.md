# LocoSnap — Changelog

All code changes to frontend and backend are recorded here.
Format: newest first within each date block.

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
