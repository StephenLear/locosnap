# LocoSnap — Changelog

All code changes to frontend and backend are recorded here.
Format: newest first within each date block.

---

## 2026-03-24

### Backend

#### `package.json` — Switch Redis client from ioredis to @upstash/redis
- **Removed** `ioredis` and `@types/ioredis` — ioredis uses TCP on port 6379, which is blocked by Render's free-tier firewall. This was silently causing every Redis connection attempt to time out (`connect ETIMEDOUT`), causing the server to fall back to in-memory storage with misleading `[REDIS] connected` log output.
- **Added** `@upstash/redis` — Upstash REST client uses HTTPS on port 443, which is not blocked. This is the officially recommended client for Render free tier + Upstash.

#### `src/services/redis.ts` — Rewrite from ioredis TCP to @upstash/redis REST
- **Changed** `initRedis()` — was creating an `ioredis` client with `REDIS_URL`; now creates an `@upstash/redis` `Redis` instance with `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. REST client is stateless (no persistent TCP connection), so `disconnectRedis()` simply nulls the reference.
- **Fixed** Root cause of Upstash showing 0 commands processed — all commands were timing out before reaching Upstash because Render free tier blocks outbound TCP/6379. Switching to REST/HTTPS means commands now reach Upstash and the 30-day train data cache is actually used (~84% AI cost saving on repeat scans).
- **Changed** Connection detection in `initRedis()` — now checks `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (both required); falls back to in-memory if either is missing.

#### `src/config/env.ts` — Update Redis env var names
- **Changed** Redis config block — was reading `UPSTASH_REDIS_REST_URL` (already correct) but the `hasRedis` getter was checking the old combined field. Updated `upstashRedisRestUrl` and `upstashRedisRestToken` to match new env var names, with a comment explaining why REST is used over TCP.

#### `.env.example` — Update Redis env var documentation
- **Changed** Redis section — replaced `REDIS_URL` with `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, with a comment explaining the REST vs TCP distinction and where to find the values in the Upstash console.

### Infrastructure

#### `render.yaml` — Replace REDIS_URL with Upstash REST vars
- **Changed** `REDIS_URL` env var entry replaced with two entries: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (both `sync: false`, set in Render dashboard)

#### Render dashboard — Update Redis environment variables
- **Removed** `REDIS_URL` — old TCP-based var, no longer used
- **Added** `UPSTASH_REDIS_REST_URL` = `https://innocent-pup-44610.upstash.io`
- **Added** `UPSTASH_REDIS_REST_TOKEN` = Upstash REST token (from Upstash console → Connect → REST tab)
- **Deployed** Render re-deployed the service with the new vars; backend will now initialise with a live Upstash REST connection instead of falling back to in-memory

#### `docs/ARCHITECTURE.md` — Redact exposed Sentry token
- **Fixed** Sentry auth token `sntryu_e89687...` was committed in plain text in section 11 (Sentry Source Maps). Replaced with `sntryu_****` placeholder. GitHub push protection blocked the push until the secret was unblocked via the GitHub secret scanning UI.
- **Note** The exposed token should be revoked in Sentry → User Settings → Auth Tokens and a new one generated, then added to EAS secrets as `SENTRY_AUTH_TOKEN`.

#### `docs/ARCHITECTURE.md` — iOS testers section reformatted
- **Changed** iOS TestFlight Testers section — reformatted to match Android tester list style (bullet email list + email format note). Added `rheintalbahnerneo@gmail.com` (@Rheintalbahner_Neo) as first confirmed iOS tester. Removed duplicate pending item from section 20.

### Backend (session 3)

#### `src/services/vision.ts` — Alstom Coradia family vs Stadler FLIRT disambiguation
- **Fixed** Misidentification of Alstom Coradia variants (incl. Coradia Polyvalent / Regio 2N / X'Trapolis) as Stadler FLIRT — reported by tester on RailUK forum, where an Alstom Astride loco was returned as "Stadler FLIRT EMU, built by Bombardier Transportation, Budapest Metro" (three simultaneous errors: wrong class, wrong manufacturer, wrong country/operator)
- **Added** Detailed disambiguation rule covering the full Alstom Coradia family vs Stadler FLIRT. Key rules: (1) FLIRT is Stadler-only — never Bombardier or Alstom; (2) double-deck trains are never FLIRTs; (3) Budapest Metro uses Alstom Metropolis, not mainline FLIRTs; (4) Alstom cab noses are rounder vs the FLIRT's distinctive forward-angled slanted windscreen; (5) if uncertain on a single-deck EMU, use cab nose profile to distinguish

#### `src/services/trainFacts.ts` — Eliminate hallucinated nicknames and tighten accuracy rules
- **Fixed** "AI slop" in fun facts — model was inventing plausible-sounding nicknames when none were known (e.g. HST described as "speed record holders" — a hallucinated nickname not used by any spotter, flagged immediately by the RailUK community). Root cause: prompt instructed the model to "include nicknames" with no guardrail against invention.
- **Changed** `funFacts` instruction — removed open invitation to include nicknames; replaced with explicit rule: only include nicknames that are genuinely well-known and documented within the rail community, with examples given (Deltic, Shed, Thunderbird, Granny, Bones). Added hard rule: "A missing nickname is far better than a hallucinated one."
- **Changed** `notableEvents` instruction — tightened from "real, verifiable events only" to "if you cannot recall a specific verifiable event, return fewer items or an empty array rather than fabricating plausible-sounding events"
- **Added** Overarching accuracy mandate at end of prompt: explicit instruction to use cautious language ("reportedly", "approximately") or omit details when uncertain, rather than stating guesses confidently

### Backend (session 2)

#### `src/services/vision.ts` — LINT 27 vs Class 445 KISS/Twindex disambiguation
- **Fixed** Misidentification of Class 445 KISS (Stadler double-deck EMU) as LINT 27 (Alstom Coradia single-car diesel DMU) — reported by tester @Rheintalbahner_Neo
- **Added** Explicit disambiguation rule covering all three Class 445 variants: KISS (self-propelled double-deck EMU, pantographs on roof, multi-car, main-line routes), Twindex/Twindexx IC2 (double-deck push-pull set with separate loco and flat-fronted control car), and LINT 27 (single-deck diesel DMU, no pantograph, short, branch-line use). Key visual tells: KISS/Twindex are double-deck with pantographs; LINT 27 is single-deck diesel. The two are completely different size classes — a KISS towers over a LINT.

---

## 2026-03-23

### Frontend

#### `app/card-reveal.tsx` — Fix card flip crash on Android + clean up animation drivers
- **Fixed** App force-close on Android when tapping the card to flip it — root cause: `{ perspective: 1000 }` was included in the same animated `transform` array as `rotateY` with `useNativeDriver: true`. Android's native animation driver does not support `perspective` as a transform property; including it causes a native thread crash that bypasses Sentry entirely.
- **Fixed** Latent iOS crash — `backfaceVisibility: "hidden"` in `styles.card` is incompatible with `useNativeDriver: true` on iOS and crashes the native rendering thread at the 90° rotation point. Removed; the existing `opacity` interpolation (`frontOpacity`/`backOpacity`) already correctly hides the inactive face and is the proper substitute.
- **Changed** `{ perspective: 1000 }` moved from the animated card `transform` arrays to a static `transform` on `cardTouchable` — preserves the 3D depth effect safely without involving the native driver.
- **Fixed** Mixed animation driver instability — `glowAnim` (`useNativeDriver: false`, drives `shadowRadius`/`shadowOpacity`) and `flipAnim` (`useNativeDriver: true`, drives `rotateY`/`opacity`) were both applied to the same `Animated.View` nodes. React Native requires a single driver per animated node; mixed drivers can produce warnings and crashes on Fabric/New Architecture. Fixed by introducing a `cardGlowWrapper` `Animated.View` for each face that owns the glow shadow (JS driver), with the inner card `Animated.View` handling only the flip (native driver).
- **Removed** `shimmerAnim` — `Animated.Value` was declared and looped indefinitely on every card reveal but was never consumed by any element in the render tree. Removed the declaration and the loop to eliminate the wasted CPU and animation thread overhead.
- **Changed** `styles.card` — removed `position: "absolute"`, `shadowOffset`, and `elevation` (moved to new `styles.cardGlowWrapper`). Card no longer needs absolute positioning as it fills its wrapper.
- **Added** `styles.cardGlowWrapper` — absolutely-positioned container matching card dimensions; owns `shadowOffset` and `elevation` (static) plus the animated glow shadow properties (JS driver).

---

## 2026-03-22 (session 4)

### Frontend

#### `services/analytics.ts` — Added captureWarning for expected user-facing failures
- **Added** `captureWarning(message, context?)` — calls `Sentry.captureMessage()` at `"warning"` severity instead of `captureException`. Warning-level messages appear in Sentry's data but do not trigger high-priority alert rules.
- **Why** Identification failures ("Could not identify a train") are expected product behaviour — unclear photo, non-train subject, depot obstruction. Routing them through `captureException` was creating high-priority Sentry issues for normal user flow outcomes, generating alert noise.

#### `app/(tabs)/index.tsx` — Route identification failures to captureWarning
- **Changed** `handleScan` catch block — was calling `captureError()` (→ `captureException`) for all errors
- **Changed** Now checks error message prefix: `"Could not identify"` → `captureWarning`; all other errors (network timeout, server fault, unexpected exception) → `captureError` as before
- **Added** Import of `captureWarning` from analytics
- **Fixed** Sentry alert noise — "Could not identify" errors will no longer trigger high-priority notifications. Real crashes and network failures still alert correctly.

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
