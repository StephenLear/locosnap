# LocoSnap — Changelog

All code changes to frontend and backend are recorded here.
Format: newest first within each date block.

---

## 2026-03-26

### Frontend

#### `app/paywall.tsx` — Fix silent purchase failure when only one RevenueCat package returns
- **Fixed** Silent no-op on purchase attempt — `selectedIndex` was hardcoded to `1` (annual), so if RevenueCat returned only one package (e.g. during a network hiccup or phased rollout), `packages[1]` was `undefined` and `handlePurchase` returned without error or feedback.
- **Changed** `selectedIndex` initial state from `1` to `0`. After offerings load, `loadOfferings` now finds the annual package index dynamically (`findIndex` on `packageType === "ANNUAL"` or identifier containing `"annual"`) and sets `selectedIndex` to that value, or `0` if no annual package exists. Eliminates the hardcoded assumption that annual is always at index 1.

#### `app/paywall.tsx` — Pull blueprint credit price from RevenueCat instead of hardcoding
- **Fixed** Hardcoded `£0.99` credit price on the blueprint credit card — would display the wrong currency and amount for any non-GBP storefront (e.g. German users from Frankfurt ad campaign seeing £ instead of €).
- **Added** `creditPrice` state variable (`string | null`). `loadOfferings` now reads `offerings.all["blueprint_credits"]?.availablePackages?.[0]?.product.priceString` and stores it in state.
- **Changed** Credit card price display from static `£0.99` to `{creditPrice ?? "—"}` — shows the App Store / Play Store localised price once loaded, or a neutral dash if unavailable.

#### `app/paywall.tsx` — Fix "Unlimited daily scans" copy
- **Fixed** Feature label read "Unlimited daily scans" — the app has no daily reset mechanic, so "daily" was misleading. Changed to "Unlimited scans".

#### `app/paywall.tsx` — Remove "Exclusive card frames" from Pro features list
- **Removed** "Exclusive card frames" feature row from `PRO_FEATURES` — this feature has not been built and was falsely advertising a capability that does not exist. Removed to avoid misleading users on the paywall.

#### `app/(tabs)/profile.tsx` — Remove hardcoded £4.99/month from upgrade button
- **Fixed** Upgrade button subtitle showed "Unlimited scans + premium blueprints · £4.99/month" — hardcoded GBP price would display incorrectly for any non-GBP storefront. Root cause: same Frankfurt ad / German market exposure risk as the paywall credit price.
- **Changed** Subtitle to "Unlimited scans · Premium blueprints · All styles" — factual, currency-neutral, and consistent with the corrected paywall feature list.

### Backend

#### `src/services/trainSpecs.ts` — Fix maxSpeed taking wrong Wikidata value when it conflicts with AI
- **Fixed** DB Class 403 (ICE 3) showing 265 km/h instead of 300/330 km/h — root cause: Wikidata `maxSpeed` was unconditionally preferred over AI output. The Wikidata entity being matched for the Class 403 contained a stale or variant-specific speed figure (265 km/h) that the "Wikidata wins" merge rule silently propagated into the response.
- **Added** `resolveMaxSpeed()` function in the merge block. Parses both Wikidata and AI speed strings into km/h for comparison. If the two values differ by more than 20%, logs a `WARN` and uses the AI figure instead. If only one source has speed data, that source wins as before. Disagreement under 20% continues to prefer Wikidata.
- **Changed** `merged.maxSpeed` from `wiki.maxSpeed ?? ai.maxSpeed` to `resolveMaxSpeed()`.

---

## 2026-03-25

### Backend

#### `src/services/vision.ts` — Add 15 tester-reported misidentification fixes to vision prompt
- **Fixed** BR 480 vs BR 481 (S-Bahn Berlin): added rule distinguishing BR 480 (rounder front, single-piece windscreen) from the far more numerous BR 481 (flatter angular front, split windscreen). BR 481 is now the default when windscreen detail is ambiguous.
- **Fixed** BR 445 Twindexx vs Bombardier Talent 2: added explicit double-deck (Twindexx) vs single-deck curved-nose (Talent 2) rule. A double-deck train can never be a Talent 2.
- **Fixed** CD 380 (Škoda 109E) vs ČD Class 151: modern angular Škoda loco on Czech Railways = CD 380; boxy 1970s Soviet-era body = Class 151.
- **Fixed** CD 654 (RegioPanter) vs Stadler FLIRT: Škoda cab face = CD 654; Leo Express branding = FLIRT. Never conflate these.
- **Fixed** ICE T (BR 411 / BR 415) vs ICE 3: tilting train with bogie tilt fairings and bulbous nose = ICE T; non-tilting = ICE 3. BR 411 = 7-car, BR 415 = 5-car.
- **Fixed** ST 44 (M62 family, Poland/Czech/Hungary) vs Class 159 (UK DMU): completely different vehicles on different continents. Long-hood Soviet-era freight loco in Central/Eastern Europe = M62 family.
- **Fixed** VT 650 (Regio-Shuttle RS1) vs VT 628: compact modern low-floor single car = VT 650; boxy 1980s two-car set = VT 628.
- **Fixed** EL2 / EU06 family vs E 94: active Co'Co' freight electric in Poland/Czech Republic = EL2/EU06 family; E 94 is a WWII museum piece, not in regular freight service.
- **Fixed** BR 563 (Siemens Mireo) vs Alstom Coradia LINT 41: pantographs on roof = cannot be LINT 41; no pantograph + Alstom cab = LINT 41.
- **Fixed** BR 462 (ICE 3neo / Velaro MS) vs BR 642 (Desiro Classic): number-reversal confusion. Full ICE high-speed train = BR 462; small regional DMU = BR 642.
- **Fixed** VT 646 Gen 1 (Talent 1) vs DB Class 648 (LINT 48): Talent 1 boxy cab face = VT 646; Alstom LINT cab = Class 648.
- **Fixed** BR 646 Gen 2 (Talent 2 variant) vs Alstom Coradia LINT 41: ODEG operator + Talent 2 curved nose = VT 646 / Talent 2, not LINT 41.
- **Fixed** LU A Stock vs 1972 Tube Stock: A Stock is sub-surface gauge (wider, Metropolitan/Hammersmith & City lines); 1972 Stock is tube gauge (narrower, Bakerloo/Northern lines).
- **Fixed** LU 1960 Tube Stock vs 1992 Tube Stock: 1992 Stock has modern flat-ended aluminium body with roof AC domes; 1960 Stock has older rounded pre-modern body shape.
- **Fixed** LU CO/CP Stock vs 1938 Tube Stock: CO/CP is sub-surface gauge (wider, Circle/Hammersmith); 1938 Stock is tube gauge (narrower), dark red with rounded 1938-style cab ends.

#### `src/services/vision.ts` — Add ICE 3 family disambiguation to vision prompt
- **Added** Explicit disambiguation block for the BR 403 / BR 406 / BR 407 / BR 408 ICE 3 family, matching the style of existing disambiguation entries (S-Bahn 480/485, Vectron variants, etc.). Root cause of the inconsistency: all four classes share the same white + red-stripe ICE livery and broadly similar nose profile, so without explicit guidance the model was freely cycling between "ICE 3", "BR 403", "BR 406", and "BR 407" on repeated scans of the same train.
- **Added** Route indicator rule: trains photographed at Amsterdam, Utrecht, Arnhem, or anywhere on the Amsterdam–Utrecht–Oberhausen–Cologne–Frankfurt corridor must be classified as BR 406. The BR 403 is single-voltage and does not operate into the Netherlands, so any ICE 3 at Utrecht Centraal is almost certainly a BR 406.
- **Added** Nose profile discriminator: 403/406 = rounder/softer classic ICE 3 nose; 407 = more angular with sharper crease lines and larger rectangular windscreen; 408 = sharpest and flattest, most modern LED headlight cluster.
- **Added** Fleet number rules: visible "406 xxx" or "4651–4667" (NS side numbers) confirm BR 406 definitively.
- **Added** Speed correction note: all ICE 3 variants have a 330 km/h theoretical max but 300 km/h operational max in regular DB service — instructs the model to use 300 km/h, preventing the incorrect 330 km/h figure from appearing in specs.
- **Added** Fallback rule: if 403 vs 406 is genuinely uncertain, output "BR 406/403" at lower confidence rather than defaulting to a generic label or the wrong class.

### Frontend

#### `store/authStore.ts` — Fix train history not cleared on auth-listener sign-out
- **Fixed** Cross-account collection contamination — when a genuine sign-out was detected via `onAuthStateChange` (e.g. token refresh failure, session expiry, or remote sign-out from another device), the handler only called `set({ profile: null })`, leaving the previous user's scans in Zustand memory. The explicit `signOut()` action already cleared trainStore, but any sign-out that bypassed that action (all non-explicit paths) did not.
- **Changed** Both branches of the `SIGNED_OUT` recovery path (recovery succeeded but session null, and recovery threw an error) now call `set({ session: null, user: null, profile: null })` followed by `useTrainStore.getState().clearHistory()`. Uses the same dynamic `require` pattern already present in `signOut()` to avoid the circular import between authStore and trainStore.

#### `app/_layout.tsx` — Clear stale history when switching between accounts
- **Fixed** Account B seeing Account A's local scans after a sign-in switch — root cause: the `user?.id` effect called `loadHistory()` on any new user ID; if Account B had zero cloud spots, `loadHistory()` fell through to AsyncStorage which still contained Account A's local backup written during their session.
- **Changed** `clearHistory` is now also subscribed from `useTrainStore` in `RootLayout`. When `user?.id` changes and `prevId` is not null (i.e. switching accounts, not a cold app start with no prior user), `clearHistory()` is awaited before `loadHistory()` is called. Cold-start behaviour (prevId is null → first sign-in) is unchanged and does not clear history first.

#### `app/card-reveal.tsx` — Fix fatal mixed animation driver crash on card reveal
- **Fixed** React Native fatal error caused by `glowAnim` (JS driver, `useNativeDriver: false`) and `flipAnim` (native driver, `useNativeDriver: true`) being applied to the same `Animated.View` node. RN cannot reconcile mixed driver types on a single view and throws at runtime.
- **Changed** View wrapping structure for both the front and back card faces — previously each face was an outer `Animated.View` (glow: JS driver) wrapping an inner `Animated.View` (flip transform + opacity: native driver), which still placed both driver types in a parent-child relationship on the same rendered node path. Now restructured to: outer `Animated.View` carries only the flip transform and opacity (`rotateY`, native driver); inner `Animated.View` carries only the glow shadow props (`shadowRadius`, `shadowOpacity`, JS driver); innermost card content is a plain `View` with no animation driver.
- **Changed** `styles.cardGlowWrapper` — removed `shadowOffset` and `elevation` from the stylesheet entry (they moved to the inner glow `Animated.View`'s inline style) since the outer wrapper no longer owns shadow props.
- **Note** No animation values, timing, sequences, or visual output were changed — only the JSX wrapper structure.

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

### Frontend (session 4 — evening)

#### `store/authStore.ts` — Fix magic link redirect on Android
- **Fixed** Magic link sign-in showing a white page with one line of code on Android — root cause was missing `emailRedirectTo` in `signInWithOtp`. Supabase was falling back to the Site URL (`exp://localhost:8081`) which doesn't exist in production, causing the browser to show a raw error page instead of returning the user to the app.
- **Added** `emailRedirectTo: "locosnap://auth/callback"` in the `signInWithMagicLink` options — Supabase now explicitly redirects to the app's custom URL scheme after link click.

#### `app/_layout.tsx` — Handle deep link auth callbacks
- **Added** `expo-linking` import and `supabase` import
- **Added** `useEffect` in `RootLayout` that listens for incoming deep links to `locosnap://auth/callback`
- **Added** Implicit flow handler — extracts `access_token` + `refresh_token` from URL hash and calls `supabase.auth.setSession()`. Used when Supabase is configured for implicit flow.
- **Added** PKCE flow handler — extracts `code` from query params and calls `supabase.auth.exchangeCodeForSession()`. Used when Supabase is configured for PKCE.
- **Added** `Linking.getInitialURL()` check for app opened from cold state via deep link
- **Added** `Linking.addEventListener("url", ...)` for deep links received while app is already running
- **Fixed** Without this handler, `setSession()` was never called on magic link return, leaving the user on a blank screen with no auth state set even if the redirect URL was correct.

### Infrastructure (session 4 — evening)

#### Supabase dashboard — URL Configuration
- **Changed** Site URL from `exp://localhost:8081` (dev default) to `https://locosnap.app` — the old value was the fallback Supabase used when no `emailRedirectTo` was specified, causing production magic links to redirect nowhere useful.

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
