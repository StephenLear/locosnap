# Leaderboard Redesign — Phase 1 Identity Layer Design

**Date:** 2026-04-29
**Status:** Approved (brainstorm complete, all 6 questions + strategic decisions locked)
**Implementation:** Pending — to be planned via writing-plans skill

## Context

LocoSnap launched on Google Play 2026-04-27. v1.0.21 live on both stores 2026-04-29. Tester feedback (Steph, Oula, pafawag, andre) plus 27/4 download record day plus the surfacing 10.1% Polish viewership on TikTok ads all point to a need for stronger retention and conversion mechanics.

Inspired by Duolingo's Pearl League screenshot (named tiers, country flags, custom emoji per user, promotion/demotion zones, weekly XP boost cards), this design specifies a Phase 1 identity layer that establishes the foundation for a 5-phase leaderboard redesign.

Strategic decisions for the broader redesign (full context in `~/.claude/projects/-Users-StephenLear-Projects-locosnap/memory/project_leaderboard_redesign.md`):

- Complement the existing leaderboard, don't replace it (existing becomes "All-time" tab)
- Achievement-led not pure-XP (per Steph's "achievements > leaderboard" feedback)
- Collection-metric leaderboards alongside XP (per collection-as-moat positioning)
- Country flags + per-country leaderboards mandatory (per DE/PL/UK market focus)
- **Pro-tier gating model:** free tier competes in Bronze/Silver/Gold; Pro unlocks Steam/Diesel/Electric/ICE/Vectron — promotion out of Gold = paywall moment, an earned upgrade trigger; solves cold-start problem at current 3-active-Pro-user scale

## Phase 1 scope

Three deliverables:

1. Country flag picker
2. Custom emoji/badge picker (curated trainspotter set, ~10 free + ~20 Pro-exclusive)
3. Identity badge cluster on Profile and on leaderboard rows
4. One-time mandatory onboarding flow on first post-update launch (folds in account-conversion email step for anonymous users)

Phases 2-5 are out of scope for this design (covered in the project memory file).

## Decisions locked (brainstorm 2026-04-29)

| # | Question | Decision |
|---|---|---|
| Q1 | Picker UI location | C — mandatory one-time onboarding sheet on first post-update launch + Profile-modal for later edits |
| Q2 | Email step within onboarding | B — soft mandatory: flag + emoji non-skippable, email shows value prop with small "Continue without account" escape hatch |
| Strategy | Tier gating | C — free tier competes in Bronze/Silver/Gold; Pro unlocks Steam/Diesel/Electric/ICE/Vectron (8 leagues total, lower 3 free, upper 5 Pro). Promotion out of Gold = the paywall moment |
| Q3 | Country flag list scope | C — auto-detect device locale + manual override to full ~195-country searchable list |
| Q4 | Emoji set | C — tiered curated set: ~10 free + ~20 Pro-exclusive (railway-specific iconography: signal lights, signal box, semaphore, etc.) |
| Q5 | Level icon style on rows | D — no level indicator on leaderboard rows; level shown on Profile only; league badge carries the progression story |
| Q6 | Pro indicator style | A — no additional indicator on rows; Pro signalled by league tier (Phase 2) + Pro-exclusive emoji choice (Phase 1) |

## Section 1 — User flow

Three flow variants based on user state when v1.0.22 first launches:

### Flow A: existing user, already signed in (Steph, Oula, etc.)

1. App launches normally. Detects user has not seen the v1.0.22 identity onboarding (`profile.has_completed_identity_onboarding === false`).
2. Onboarding sheet 1/3 — Welcome: "We've added country flags, achievements, and a new leaderboard. Set up your spotter identity in 30 seconds." CTA: Continue.
3. Onboarding sheet 2/3 — Pick country flag: device locale auto-detected, shows pre-selected flag with "Looks right? Confirm." Below: "Change country" link opening full searchable list. CTA: Confirm.
4. Onboarding sheet 3/3 — Pick spotter emoji: visual grid of free emoji (Pro users see all 30, Pro-exclusive marked). Tap to select. CTA: Done.
5. Email step SKIPPED (already signed in).
6. Sets `has_completed_identity_onboarding=true` in Supabase. App proceeds to home.

### Flow B: existing user, anonymous (never signed in)

Steps 1-4 same as Flow A. Then:

5. Onboarding sheet 4/4 — Sign in or continue without account:
   - Email input at top
   - Headline: *"Save your spots and join the leaderboard"*
   - Subhead: *"We'll email you a code. No password needed."*
   - Primary CTA: *"Send code"*
   - Small grey link: *"Continue without account"*
   - Send code → standard OTP flow (existing `/sign-in`) → on success, identity values cloud-sync.
   - Continue without account → identity stored locally only (AsyncStorage) + `identity_onboarding_completed=true` flag.
6. App proceeds to home.

### Flow C: brand new install (post-v1.0.22)

Identical to Flow B. Maintains existing anonymous-trial onboarding compatibility.

### Later edits (post-onboarding)

Profile screen shows the user's flag + emoji + sign-in state as a tappable badge cluster next to their name. Tap opens "Edit identity" modal with the same three pickers + an "Add account" button if anonymous.

## Section 2 — Components

### New files

| File | Purpose |
|---|---|
| `frontend/app/onboarding-identity.tsx` | Multi-step onboarding screen, modal-presented from root layout when onboarding flag is false |
| `frontend/components/CountryFlagPicker.tsx` | Reusable picker. `compact` mode (auto-detected + confirm) and `full` mode (searchable list). Used by both onboarding and edit modal |
| `frontend/components/EmojiPicker.tsx` | Reusable picker. Renders Pro-exclusive emoji as locked overlays for free users with paywall upsell |
| `frontend/components/IdentityBadge.tsx` | Display-only component. Renders flag + emoji as compact badge cluster. Used on Profile and leaderboard rows |
| `frontend/data/countries.ts` | Static list — ISO code, localised name, flag emoji. Sort: top LocoSnap markets first, then alphabetical |
| `frontend/data/spotterEmojis.ts` | Curated emoji set. Schema: `{ id, glyph, label, isPro, source: 'unicode' \| 'svg' }` |

### Modified files

| File | Change |
|---|---|
| `frontend/app/_layout.tsx` | Add post-auth-load redirect to `/onboarding-identity` if not completed |
| `frontend/app/(tabs)/profile.tsx` | Add `IdentityBadge` cluster above existing username controls. Tappable — opens edit modal |
| `frontend/app/(tabs)/leaderboard.tsx` | Each row renders flag (left of name) + emoji (under name). No level icon |
| `frontend/store/authStore.ts` | Extend `Profile` interface with `country_code`, `spotter_emoji`, `has_completed_identity_onboarding`. Add `updateCountryCode`, `updateSpotterEmoji`, `markIdentityOnboardingComplete` actions |
| `frontend/services/supabase.ts` | Add `updateProfileIdentity(updates)` PATCH helper |
| i18n EN/DE strings | Add onboarding copy. Other locales skipped per existing language-rollout policy |

### Backend

| Item | Change |
|---|---|
| Supabase migration `010_identity_layer.sql` | Add three columns to `profiles`: `country_code TEXT NULL`, `spotter_emoji TEXT NULL`, `has_completed_identity_onboarding BOOLEAN NOT NULL DEFAULT FALSE`. Existing user-scoped RLS policies cover the new columns. No new tables |
| Supabase setup-bundle SQL | Update bundle to include new columns for env-spinup parity |

## Section 3 — Data flow

### Storage layers

- **Signed-in users:** Supabase `profiles` row = source of truth. Zustand mirrors. AsyncStorage caches for offline app open.
- **Anonymous users:** AsyncStorage = source of truth (key: `locosnap_anonymous_identity`). On signup, AsyncStorage values migrate up to Supabase as initial profile values.

### Write paths (3 actions, all routed through `authStore`)

1. `updateCountryCode(code)` — optimistic Zustand update → AsyncStorage write → if signed-in, Supabase PATCH. On error, revert local + toast.
2. `updateSpotterEmoji(emojiId)` — same pattern. Stores `id` not `glyph` (forward-compat for SVG migration).
3. `markIdentityOnboardingComplete()` — sets flag in both stores; triggers `_layout.tsx` redirect logic.

All debounced 300ms.

### Read paths

1. **Profile screen:** reads from authStore, renders `<IdentityBadge />`. Live-updates via Zustand.
2. **Leaderboard rows:** reads from leaderboard query result (per-row data, not authStore — because rows show OTHER users). Backend leaderboard query needs `country_code, spotter_emoji` added to SELECT.
3. **Onboarding pre-select:** reads device locale via `expo-localization`; falls back to `profile.region`; falls back to GB.

### Anonymous → signed-in migration

- Anonymous user picks identity → AsyncStorage only.
- User taps "Add account" from Profile-edit modal → routes to `/sign-in?mode=signup`.
- OTP completes → `profile_create` Supabase trigger fires → frontend reads new profile.
- **Migration step:** before Zustand syncs from Supabase, AsyncStorage `locosnap_anonymous_identity` is read and PATCHed onto the new profile. Then cleared.
- **Edge case:** if the new profile already has identity values (e.g. user signed in on another device), existing Supabase values win. Sentry breadcrumb logged for visibility.

## Section 4 — Error handling

### Onboarding flow errors

- Device locale unavailable: fallback to `profile.region`, then GB.
- "Done" with no emoji: button disabled until selection.
- Network down during submit: AsyncStorage + retry queue. Sentry breadcrumb if queue eventually fails.
- App killed mid-onboarding: state lost; user re-runs from step 1 (acceptable — flow is <30 sec).

### Picker errors

- CountryFlagPicker no search match: empty state copy, defaults still selectable.
- EmojiPicker free user taps locked Pro emoji: toast + paywall bottom sheet (re-uses existing paywall component). Selection rejected.
- SVG emoji asset fails to load: fallback to placeholder grey box + text label. Sentry log. Won't crash.

### Identity sync errors

- Supabase PATCH fails: optimistic local stays, Sentry breadcrumb, retry on next foreground.
- 3+ consecutive retry failures: toast "Your changes are saved on this device — they'll sync when we reconnect."
- AsyncStorage write fails (full disk): Sentry log, in-memory Zustand preserves session state.

### Edit-identity modal errors

Same as onboarding pickers (same components). Modal dismissible without commit; CTA = Save (commits) or Cancel (discards).

### Email/OTP errors (anonymous flow only)

Re-uses existing `/sign-in` OTP error handling — no new error paths.

### Anonymous → signed-in migration

- AsyncStorage empty during migration: no-op; user re-picks via onboarding-not-completed flag.
- PATCH succeeds but AsyncStorage clear fails: stale AsyncStorage values logged. Mitigation: migration version counter to detect-and-clean across versions.
- Both PATCH and AsyncStorage clear fail: identity values stay in AsyncStorage, profile has NULLs. Eventually consistent on next launch. Sentry alert.

### Logging

- **Sentry breadcrumbs:** every Supabase PATCH attempt, every AsyncStorage op, every migration step, every Pro-emoji rejection.
- **Sentry errors:** persistent retry-queue failure (3+ retries), AsyncStorage write failure, migration partial failure.
- **PostHog events:** `identity_onboarding_started`, `_country_picked`, `_emoji_picked`, `_email_provided`, `_email_skipped`, `_completed`. Used to measure soft-mandatory email step's actual skip rate.

## Section 5 — Testing

### Frontend unit tests (`frontend/__tests__/identityLayer.test.ts`)

Six test groups, ~25 tests total, pure logic (existing project convention):

1. Country list — entries, ISO uniqueness, priority sort, locale-to-flag mapping.
2. Emoji set — free/Pro split, no id collisions, SVG entries have valid asset paths, Unicode entries have valid glyphs.
3. AuthStore identity actions — optimistic update, revert on error, debounce.
4. Anonymous → signed-in migration logic — picks AsyncStorage on first signup, prefers Supabase on subsequent.
5. Onboarding gate logic — should-show decision in `_layout.tsx`.
6. Pro emoji rejection — `EmojiPicker.canSelectEmoji(emojiId, isPro)` matrix.

Target: 100% coverage of new logic.

### Backend tests

No new backend tests — leaderboard reads identity from `profiles` via existing Supabase query patterns.

### Migration validation (manual, before production push)

1. Apply `010_identity_layer.sql` to staging Supabase first.
2. `\d+ profiles` to confirm columns + types + defaults.
3. SELECT existing profiles → `country_code, spotter_emoji` are NULL, `has_completed_identity_onboarding` is FALSE.
4. RLS test: user A insert, user B can't read identity fields except via existing public-leaderboard view.
5. Apply to production during low-traffic window.
6. Rollback: `ALTER TABLE profiles DROP COLUMN ...` (reversible since columns are additive).

### Manual QA checklist (before EAS build)

1. Anonymous → email-skip path
2. Anonymous → email-submit path (OTP completion)
3. Existing signed-in user (Steph/Oula simulated)
4. Pro user picks Pro emoji
5. Free user attempts Pro emoji (paywall upsell)
6. Edit flow post-onboarding (change flag from DE to PL, verify cross-surface update)

### Performance

- Existing 55 frontend tests must still pass.
- App cold-start regression budget: ≤100ms.
- Supabase profile fetch latency: unchanged (3 nullable columns ≈ zero overhead).

## Out of scope (Phase 2-5)

- Phase 2: Named leagues + weekly reset + promotion/demotion zones (~12-16h)
- Phase 3: Country / station / collection leaderboard tabs (~6-8h)
- Phase 4: Variable XP boost cards (~4h)
- Phase 5: Friends graph (~20-30h, defer to 1k+ users)

Strategic context for Phase 2-5 in `project_leaderboard_redesign.md` memory file.

## Memory cross-references

- `project_leaderboard_redesign.md` — full strategic analysis + 5-phase plan
- `project_status.md` — Steph's "achievements > leaderboard" signal
- `project_competitive_positioning.md` — collection is the moat
- `project_market_focus.md` — DE/PL/UK priority for country flags
- `project_churn_patterns.md` — 3 active Pro user count (cold-start consideration)
- `frontend_backlog.md` items #21-25 — tracking entries for Phases 1-5

## Effort estimate

~4-6 hours implementation + ~2 hours emoji curation/asset work + ~1 hour QA + EAS build cycle.

Bundles into the next feature build (v1.0.22) alongside #15 (provenance label), #19 (confidence display), #18 (wrong-ID flow), and the already-coded #20 deletion fix.
