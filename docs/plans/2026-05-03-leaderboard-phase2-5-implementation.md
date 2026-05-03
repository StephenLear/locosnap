# Leaderboard Phase 2-5 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a Duolingo-style weekly league system + three-tier verification model + collection/country tab restructure to LocoSnap, replacing the existing 4-tab leaderboard. Phase 5 friends-graph schema lands but unused until 1k+ active users.

**Architecture:** Extend Supabase with a `league_membership` table + `weekly_xp_events` audit trail + cron-coordinated weekly reset. Backend `leagues.ts` service handles per-scan XP computation; frontend `useLeaderboardStore` Zustand store drives the new tab UI. Backwards-compat migration grandfathers existing spots as PERSONAL so no historic value is lost.

**Tech Stack:** Supabase Postgres + Edge Functions (or Render cron); Express.js backend (TypeScript); React Native + Expo Router (TypeScript); Zustand state; React Query for server state on leaderboard fetches.

**Companion design doc:** `docs/plans/2026-05-03-leaderboard-phase2-5-design.md`

**Total estimated effort:** 23-29h. Sequencing detailed in "Phase Sequencing" section at the end.

---

## Pre-flight Checklist

Before starting any task:

- [ ] Working in a git worktree off `main` named `feat/v1.0.25-leaderboard-phase2`
- [ ] `backend/` tests pass (`cd backend && npm test` → 113/113)
- [ ] `frontend/` tests pass (`cd frontend && npm test` → 106/106)
- [ ] Supabase staging URL available for dry-run migration testing
- [ ] Render staging service available for cron testing
- [ ] Read the companion design doc end-to-end

---

## Section A — Migration & Schema (Phase 0, foundational)

This is the riskiest section. The migration touches existing user data via the verification-tier grandfathering update. Verify locally first, dry-run on staging, only then apply to production.

### Task A.1: Create migration 013 file

**Files:**
- Create: `supabase/migrations/013_leaderboard_phase2.sql`

**Steps:**

1. Copy the SQL from design doc Section 6 into the new file (the design doc contains the canonical migration text — use that verbatim, do not improvise).
2. Verify the file ends cleanly with no trailing comma or unfinished statement.
3. Commit immediately:
   ```bash
   git add supabase/migrations/013_leaderboard_phase2.sql
   git commit -m "feat(db): migration 013 leaderboard Phase 2 schema (uncommitted SQL)"
   ```

### Task A.2: Apply migration locally

**Steps:**

1. Start local Supabase: `supabase start` (from project root if Supabase CLI is configured).
2. Apply: `supabase db reset` then re-seed; OR if reset is too destructive locally, run the migration SQL via `psql` against the local connection string.
3. Verify tables exist: `psql ... -c "\dt league_membership weekly_xp_events user_boost_inventory friendships league_cycle_state"` — expect 5 rows.
4. Verify backfills: `psql -c "select count(*), verification_tier from spots group by verification_tier"` — expect no nulls; PERSONAL = previous null count + previous PERSONAL count.
5. Verify featured-card backfill: `psql -c "select count(*) from profiles where featured_spot_id is not null"` — should match count of profiles with at least one VERIFIED|PERSONAL spot.

### Task A.3: Dry-run on Supabase staging

**Steps:**

1. Take a snapshot of staging Supabase via the dashboard ("Database > Backups").
2. Apply the migration via the Supabase SQL Editor (paste verbatim, run as single transaction).
3. Repeat the verification queries from A.2 against staging.
4. Confirm no row counts changed unexpectedly on `spots` or `profiles` (only `verification_tier` and `featured_spot_id` should have been updated; row counts unchanged).
5. If any verification fails, restore from snapshot and diagnose.

### Task A.4: Apply to production Supabase

**Pre-condition:** A.3 dry-run on staging completed without issues.

**Steps:**

1. Take a fresh production snapshot via Supabase dashboard.
2. Announce in the session: "About to apply migration 013 to production. Snapshot taken at HH:MM."
3. Apply the migration via the production Supabase SQL Editor.
4. Run the verification queries against production.
5. Update `docs/CHANGELOG.md` with the migration date + version.
6. Commit changelog:
   ```bash
   git add docs/CHANGELOG.md
   git commit -m "chore(db): migration 013 applied to production"
   ```

### Task A.5: Update TypeScript types for verification_tier

**Files:**
- Modify: `frontend/types/index.ts` — add `'UNVERIFIED'` to the VerificationTier union
- Modify: `backend/src/types/index.ts` — same
- Modify: `frontend/services/supabase.ts` — verify any explicit type definitions allow the new value

**Steps:**

1. Find current type: `grep -n "VerificationTier" frontend/types/index.ts backend/src/types/index.ts`
2. Add `'UNVERIFIED'` to the union literal type
3. Run `cd frontend && npx tsc --noEmit && cd ../backend && npx tsc --noEmit` — expect clean
4. Commit:
   ```bash
   git add frontend/types/index.ts backend/src/types/index.ts frontend/services/supabase.ts
   git commit -m "feat(types): add UNVERIFIED verification_tier"
   ```

---

## Section B — Verification Tier Extension (frontend logic)

### Task B.1: Locate the existing verification classifier

**Steps:**

1. Find: `grep -rn "verificationTier\|verification_tier" frontend/services/ frontend/utils/` — identify the file that assigns the tier on a new scan
2. Read the file end-to-end so you understand the existing two-tier classifier logic
3. Document its current decision tree in a comment block at the top (you'll be extending it)

### Task B.2: Write failing tests for UNVERIFIED classification

**Files:**
- Modify or Create: `frontend/__tests__/services.verification.test.ts` (or wherever the existing verification tests live)

**Test cases to add:**

```typescript
describe('verification tier classifier — UNVERIFIED branch', () => {
  it('returns UNVERIFIED for stripped EXIF', () => {
    // Photo with no EXIF block at all
  });
  
  it('returns UNVERIFIED for implausible EXIF date (>5 years ago)', () => {
    // EXIF DateTimeOriginal = 2012-01-01
  });
  
  it('returns UNVERIFIED for implausible EXIF date (future)', () => {
    // EXIF date in the future
  });
  
  it('does NOT return UNVERIFIED for plausible older photo with valid EXIF', () => {
    // EXIF date 6 months ago — should be PERSONAL not UNVERIFIED
  });
  
  it('VERIFIED still wins when all signals present', () => {
    // Live capture + GPS + recent EXIF
  });
});
```

**Run:** `cd frontend && npm test -- verification` — expect FAIL on the new cases.

### Task B.3: Extend the classifier to assign UNVERIFIED

**Steps:**

1. Add the third-tier branch to the existing classifier logic
2. Decision order: VERIFIED first (most signal), PERSONAL middle, UNVERIFIED fallback
3. UNVERIFIED triggers: stripped EXIF OR implausible date (>5y old or future)
4. Run tests: `npm test -- verification` — expect PASS

**Commit:**
```bash
git add frontend/services/verification.ts frontend/__tests__/services.verification.test.ts
git commit -m "feat(verification): add UNVERIFIED tier for stripped/implausible EXIF"
```

### Task B.4: Manual override UI in card detail screen

**Files:**
- Modify: `frontend/app/card-reveal.tsx` (or `card-detail.tsx` if separated)
- Modify: `frontend/locales/en.json` + `frontend/locales/de.json`

**Steps:**

1. Add a small "I took this photo myself" toggle below the existing badges, visible ONLY when `verification_tier === 'UNVERIFIED'`
2. On toggle: call a new Supabase RPC `promote_unverified_to_personal(spot_id)` (Task B.5)
3. Add 4 new i18n keys: `card.verification.unverifiedHelp`, `card.verification.iTookThis`, `card.verification.promoted`, `card.verification.promotedFlagged`
4. EN/DE parity verify with `python3 -c "import json; ..."`

### Task B.5: Add the promotion RPC + telemetry

**Files:**
- Create: `supabase/migrations/014_unverified_promote_rpc.sql` (or fold into 013 if not yet applied)

**Steps:**

1. Create RPC `promote_unverified_to_personal(spot_id uuid)` with `SECURITY DEFINER`, validates ownership (`user_id = auth.uid()`), updates `verification_tier = 'PERSONAL'`, increments a `manual_overrides_count` column on profiles for telemetry
2. Add `manual_overrides_count int default 0` to profiles
3. Telemetry alert: log a Sentry breadcrumb when count > 50 for any user (post-launch task, not blocking ship)

**Commit after Section B:**
```bash
git commit -m "feat: UNVERIFIED tier classifier + manual-override UI"
```

---

## Section C — Backend Service: leagues.ts (Phase 2 core)

### Task C.1: Service skeleton

**Files:**
- Create: `backend/src/services/leagues.ts`
- Create: `backend/src/__tests__/services/leagues.test.ts`

**Module exports (skeleton, with TODOs for the implementation):**

```typescript
export interface XpComputationInput {
  userId: string;
  spotId: string;
  baseXp: number;
  classKey: string;  // for diminishing-returns lookup
  rarityTier: RarityTier;
  verificationTier: 'VERIFIED' | 'PERSONAL' | 'UNVERIFIED';
  scanDate: Date;
}

export interface XpComputationOutput {
  finalXp: number;
  diminishedXp: number;
  themedMultiplier: number;
  boostCardApplied: string | null;
  weekStartUtc: Date;
}

export async function computeWeeklyXp(input: XpComputationInput): Promise<XpComputationOutput> {
  // TODO Tasks C.2-C.5
  throw new Error('not implemented');
}

export async function applyBoostCard(userId: string, cardType: 'flat_100' | 'next_scan_2x'): Promise<void> {
  // TODO Task C.6
  throw new Error('not implemented');
}

export async function persistXpEvent(input: XpComputationInput, output: XpComputationOutput): Promise<void> {
  // TODO Task C.7
  throw new Error('not implemented');
}
```

### Task C.2: TDD computeWeeklyXp — verification gate

Test:
- VERIFIED scan → returns full base XP
- PERSONAL scan → returns 0
- UNVERIFIED scan → returns 0

Implementation: simplest possible — `if (verificationTier !== 'VERIFIED') return 0`.

Run, pass, commit.

### Task C.3: TDD computeWeeklyXp — diminishing returns

Test:
- First scan of class X this week → 100% baseXp
- Second scan of class X this week → 25% baseXp
- Third scan of class X this week → 25% baseXp
- First scan of class Y this week → 100% baseXp (different class, full)

Implementation: query `weekly_xp_events` for current week + class match, multiply by 0.25 if any prior event exists.

Run, pass, commit.

### Task C.4: TDD computeWeeklyXp — themed-day multipliers

Test cases:
- Tuesday + rare scan → 2× XP
- Tuesday + common scan → 1× XP (no boost)
- Thursday + scanned-yesterday + scanned-today → +50 flat XP added
- Saturday + train operated by user's country → 1.5× XP
- Wednesday → no multiplier

Constants: themed-day schedule lives at top of `leagues.ts` as `THEMED_DAYS` const, easy to feature-flag override.

Implementation, run, pass, commit.

### Task C.5: TDD computeWeeklyXp — combined order of operations

Test: VERIFIED + repeat scan + Tuesday + rare → `floor(baseXp * 0.25 * 2) = correct value`. Order: verification first → diminishing returns → themed multiplier → boost card.

Run, pass, commit.

### Task C.6: TDD applyBoostCard

Test cases:
- `flat_100` card consumed → +100 XP added to `weekly_xp`, card row marked `used_at = now()`
- `next_scan_2x` card consumed → next scan doubles, card row marked used
- Already-used card cannot be applied again
- User without inventory → silent no-op (don't error)

Implementation: transactional — read inventory, mark used, update league_membership.weekly_xp.

### Task C.7: TDD persistXpEvent — append-only audit row

Test: writing event row updates `league_membership.weekly_xp` by `finalXp`, increments `weekly_unique_classes` if first scan of that class this week.

Run, pass, commit.

### Task C.8: Wire leagues.ts into /api/identify

**Files:**
- Modify: `backend/src/routes/identify.ts`

**Steps:**

1. After existing spot-save logic, call `leagues.computeWeeklyXp(...)` and `leagues.persistXpEvent(...)`
2. Include `weekly_xp_delta` field in the response so the frontend can show "+45 XP toward Bronze League"
3. Failure-tolerant: if leagues service throws, log to Sentry but don't fail the scan response (a scan succeeding without XP is better than a scan failure)

Test: integration test in `__tests__/routes/identify.test.ts` verifies the response includes `weekly_xp_delta` for VERIFIED scans, omits or zeros it for PERSONAL.

Commit:
```bash
git commit -m "feat(api): wire leagues XP scoring into /api/identify"
```

---

## Section D — Cron Coordinator (weekly reset)

### Task D.1: Choose hosting

**Decision required at this step**: Render cron job vs Supabase Edge Function (cron via pg_cron extension).

**Recommendation:** Render cron — same deployment surface as the API, simpler to debug, existing patterns. Supabase pg_cron is fine but adds a separate operational thing.

Document the decision in `docs/CHANGELOG.md` at this point.

### Task D.2: Create the cron entrypoint

**Files:**
- Create: `backend/src/cron/leagueWeeklyReset.ts`
- Modify: `backend/src/index.ts` to register the cron route or wire to a node-cron scheduler

**Steps:**

1. Implement a single async function `runLeagueWeeklyReset(weekStartUtc: Date)` that:
   - Marks `league_cycle_state.last_reset_status = 'in_progress'`
   - Computes promotions/demotions for each tier (uses `top 10% / bottom 10%, min 1` rule)
   - Awards Pro freezes (1 per Pro user, capped at 3)
   - Awards Free freezes (1 to users with `consecutive_active_weeks >= 4`, capped at 2; resets counter)
   - Awards earned boost cards for promoted users (1 `flat_100` per promotion, capped at 3)
   - Runs ghost-cleanup (4-week inactives drop one tier, Bronze excluded)
   - Auto-burns streak freezes for inactive users with available freezes
   - Resets `weekly_xp = 0`, `weekly_unique_classes = 0` for next week
   - Updates `league_cycle_state.current_week_start`, `current_week_end`, `last_reset_at`
   - Marks `last_reset_status = 'completed'` (or 'failed' on error with full Sentry capture)
2. Idempotent: re-running with the same `weekStartUtc` is a no-op (check `last_reset_at` first)

### Task D.3: TDD for the cron logic

Test cases (use a test fixture of 50 users in Bronze with varying weekly_xp values):

- Top 10% (5 users) get tier_index incremented to 2 (Silver)
- Bottom 10% (5 users) — but Bronze is the floor, so they stay
- Pro users (3) get +1 freeze (capped at 3)
- Free users with consecutive_active_weeks >= 4 get +1 freeze
- Promoted users get a flat_100 boost card
- Inactive 4-week users (none in fixture) — verify the query is correct
- Re-running the same week is a no-op

Run, pass, commit.

### Task D.4: Manual-replay endpoint

**Files:**
- Modify: `backend/src/routes/admin.ts` (or create if not exists)

**Steps:**

1. Add `POST /api/admin/league-reset/:weekStartUtc` — auth-gated to a single admin token from env (`ADMIN_SECRET`)
2. Validates `weekStartUtc` is a Sunday boundary, calls `runLeagueWeeklyReset`
3. Returns the reset summary

Test: integration test verifies admin token gate, replay idempotency.

### Task D.5: Schedule the cron

**Steps:**

1. Render dashboard → Cron Jobs → Add new
2. Schedule: `59 23 * * 0` (Sunday 23:59 UTC)
3. Command: `node dist/cron/leagueWeeklyReset.js` (or a curl to a self-hosted endpoint)
4. Verify the next-run time in the dashboard matches expectations
5. Document in `docs/ARCHITECTURE.md` § Build & Distribution / Backend section

**Commit Section D:**
```bash
git commit -m "feat(cron): weekly league reset coordinator"
```

---

## Section E — Frontend: useLeaderboardStore + tab restructure

### Task E.1: Create useLeaderboardStore

**Files:**
- Create: `frontend/store/leaderboardStore.ts`
- Create: `frontend/__tests__/store/leaderboardStore.test.ts`

**Store shape:**

```typescript
interface LeaderboardState {
  activeTab: 'my_league' | 'country' | 'collection';
  myLeagueSubToggle: 'this_week' | 'all_time';
  countrySubToggle: 'this_week' | 'all_time';
  collectionSubToggle: 'unique_classes' | 'rarity_score' | 'streak_days';
  selectedCountry: string | null;
  setActiveTab: (tab) => void;
  setSubToggle: (tab, value) => void;
  setSelectedCountry: (code) => void;
}
```

TDD the state transitions, run tests pass, commit.

### Task E.2: My League tab component

**Files:**
- Create: `frontend/app/(tabs)/leaderboard/MyLeagueTab.tsx`

**Steps:**

1. Render: tier badge + countdown + freeze counter + themed-day banner + leaderboard list
2. Promotion zone separator — sticky `<View>` rendered at the top-10% index
3. Demotion zone separator — sticky `<View>` rendered at bottom-10% index, hidden for Bronze
4. Self-row pinned (highlighted, `position: sticky` style)
5. Inactive users rendered below as ghosted rows with "HASN'T SCANNED YET THIS WEEK"

Reference design doc Section 5 for the row layout spec.

### Task E.3: Country tab component

**Files:**
- Create: `frontend/app/(tabs)/leaderboard/CountryTab.tsx`

**Steps:**

1. Country selector pill row — populated from `select distinct country_code from profiles where country_code is not null` (cached via React Query)
2. Default selection: user's own country_code if set; else DE
3. Sub-toggle: This week / All-time
4. Same row component as MyLeagueTab (DRY: extract `<LeaderboardRow>` component)

### Task E.4: Collection tab component

**Files:**
- Create: `frontend/app/(tabs)/leaderboard/CollectionTab.tsx`

**Steps:**

1. Three sub-toggles: Unique classes / Rarity score / Streak days
2. Achievement badges visible on each row (left of username)
3. Rarity score lookups defined in a shared constants module (uncommon=2, rare=5, epic=8, legendary=15)

### Task E.5: Replace the existing leaderboard tab

**Files:**
- Modify: `frontend/app/(tabs)/leaderboard.tsx` — becomes a router that selects MyLeagueTab/CountryTab/CollectionTab
- Delete or archive: the existing 4-tab leaderboard logic

**Steps:**

1. Top tab bar: 3 tabs from useLeaderboardStore.activeTab
2. Render the active sub-component
3. Run all frontend tests — expect existing tests for the old leaderboard to fail (they reference removed code)

### Task E.6: Migrate or delete obsolete leaderboard tests

**Files:**
- Modify or Delete: `frontend/__tests__/leaderboard.test.tsx` (old)

**Steps:**

1. Decide per test: relevant to new tabs (migrate) or obsolete (delete)
2. Add new tests for MyLeagueTab / CountryTab / CollectionTab
3. Final run: 106+ existing + new tests all pass

**Commit Section E:**
```bash
git commit -m "feat(frontend): replace leaderboard tabs with My League / Country / Collection"
```

---

## Section F — Featured Card on Leaderboard Rows

### Task F.1: Featured card thumbnail in row component

**Files:**
- Create: `frontend/components/LeaderboardRow.tsx` (DRY: shared by all three tabs)

**Steps:**

1. Renders username + country flag + spotter emoji + featured-card thumbnail + stats
2. Featured card image fetched via `useQuery(['featured-card', userId])` — Supabase query for `profiles.featured_spot_id` joined to `spots.photoUrl`
3. UNVERIFIED spots filtered out at query level (defensive — backend should already enforce this)

### Task F.2: Featured-card picker UI

**Files:**
- Modify: `frontend/app/card-reveal.tsx` — add "Set as featured" button

**Steps:**

1. Visible only when `verification_tier in ('VERIFIED', 'PERSONAL')`
2. Button calls Supabase update on `profiles.featured_spot_id`
3. Optimistic update on the local profile store
4. Toast confirmation: "Featured card updated"

**Commit Section F:**
```bash
git commit -m "feat(frontend): featured card on leaderboard rows + user picker"
```

---

## Section G — Streak Freeze + Boost Card UI

### Task G.1: Freeze counter component

**Files:**
- Create: `frontend/components/FreezeCounter.tsx`

**Steps:**

1. Renders `❄ {count}` next to the league header
2. Tap → modal explaining freezes (i18n: 4 new keys EN+DE)
3. Counter pulls from `profiles.streak_freezes_available`

### Task G.2: Themed-day banner

**Files:**
- Create: `frontend/components/ThemedDayBanner.tsx`

**Steps:**

1. Computes today's themed day from UTC server time (synced via `/api/health` ping at app start)
2. Renders banner with multiplier ("Today: Rarity Day — 2× XP for rare classes")
3. Hidden on non-themed days

### Task G.3: Boost card inventory + use buttons

**Files:**
- Create: `frontend/app/(tabs)/leaderboard/BoostInventory.tsx`

**Steps:**

1. Renders user's available boost cards from `user_boost_inventory`
2. "Use boost" button per card — calls Supabase RPC to mark used
3. `next_scan_2x` cards trigger an in-memory flag the next scan reads

### Task G.4: Push notification for themed days

**Files:**
- Modify: `frontend/services/notifications.ts`

**Steps:**

1. Schedule a daily 08:00 user-local notification check
2. If today's UTC date is a themed day, send local push notification
3. Opt-in via existing notification permission flow

**Commit Section G:**
```bash
git commit -m "feat(frontend): freeze counter + themed-day banner + boost inventory UI"
```

---

## Section H — i18n + Polish + QA

### Task H.1: i18n key parity verification

**Files:**
- Modify: `frontend/locales/en.json` + `frontend/locales/de.json`

**Steps:**

1. Estimated ~30 new EN+DE keys across all the new UI surfaces (league names, tab labels, freeze tooltips, boost card descriptions, themed-day banners, promotion/demotion zone labels)
2. Run `python3 -c "import json; en=json.load(open('frontend/locales/en.json')); de=json.load(open('frontend/locales/de.json')); ..."` parity check
3. Verify DE diacritics correct in any string with ä/ö/ü/ß

### Task H.2: Tab migration tooltip

**Files:**
- Modify: `frontend/app/(tabs)/leaderboard.tsx` — add a one-time tooltip

**Steps:**

1. Use AsyncStorage flag `leaderboard_v2_tooltip_seen`
2. On first open after v1.0.25 install/update, show tooltip: "We've reorganised the leaderboards — find your old views inside the new tabs."
3. Dismiss → set flag

### Task H.3: TSC + tests

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm test
cd backend && npx tsc --noEmit
cd backend && npm test
```

All must pass. Resolve any drift before proceeding.

### Task H.4: Manual QA checklist

Before marking the implementation complete, verify in a development build:

- [ ] Existing user on v1.0.24 → updates to v1.0.25 → opens app → still has all collection items, all featured-card eligible
- [ ] Steph's account (test data clone) → Profile shows full collection, Rarest Find shows Legendary, Featured Card shows the Legendary
- [ ] New scan with live camera + GPS → returns VERIFIED, +XP added to weekly_xp visible in My League tab
- [ ] New scan with stripped-EXIF gallery photo → returns UNVERIFIED, no XP added, doesn't appear on leaderboard row
- [ ] Tuesday Rarity Day → rare scan returns 2× XP
- [ ] Sunday 23:59 UTC cron → fires (test on staging with manual replay endpoint)
- [ ] Promote out of Bronze (top 10%) → tier_index = 2 next week, freeze counter shows +0 (free user with <4 active weeks at start), boost card "+100 XP" appears in inventory
- [ ] Sign-out / sign-in → leaderboard state preserved
- [ ] Country tab → DE selector shows DE-only users
- [ ] Collection tab → Unique classes sub-toggle shows count, Rarity score shows weighted total
- [ ] DE locale toggle → all new UI text in German with correct diacritics

---

## Section I — Phase Sequencing

The 8 sections above can be reordered and parallelised at execution time, but the canonical sequence below minimises rework risk.

| Order | Section | Effort | Dependency |
|---|---|---|---|
| 1 | A — Migration & schema | 2-3h | None — foundational |
| 2 | B — Verification UNVERIFIED tier | 2h | A |
| 3 | C — Backend leagues.ts service | 5-6h | A, B |
| 4 | D — Cron coordinator | 3-4h | A, C |
| 5 | E — Frontend tab restructure | 6-7h | A, B (the verification UI) |
| 6 | F — Featured card thumbnails | 1-2h | A, E |
| 7 | G — Freeze + boost UI | 2-3h | A, C, E |
| 8 | H — i18n + polish + QA | 1-2h | All above |
| **Total** | | **22-29h** | |

**Critical path:** A → B → C → D + E in parallel → F + G → H.

**Parallelization:** D (backend cron) and E (frontend tabs) can be worked simultaneously by two engineers since they share only the schema (locked in A).

---

## Section J — Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Migration A.4 breaks production data | Low | Critical | Snapshot before; staging dry-run; verification queries |
| Cron D fails Sunday 23:59 | Medium | High | Manual replay endpoint (D.4); idempotent design; Sentry monitoring |
| UNVERIFIED false-positives anger legit users | Medium | Medium | Manual override toggle (B.4); telemetry alerting on override rate |
| Frontend tab restructure breaks existing tests | High | Low | E.6 explicitly migrates/deletes obsolete tests |
| Themed-day multiplier creates fairness perception issue | Low | Medium | Public schedule; same for all users; clearly communicated |
| Streak freeze auto-burn confuses users | Medium | Low | Push notification next morning explains what happened |
| Pro users on Steam tier feel league is empty initially | High | Medium | Acceptable — fills naturally in 2-3 weeks; Pro freeze keeps them engaged regardless |

---

## Section K — Out of Scope (explicitly deferred)

Per design doc:

- DE Bundesländer / PL voivodeships region taxonomy (Phase 2 of `frontend_backlog #22`)
- Station leaderboard tables (Phase 3.5)
- Friends UX (Phase 5 — only schema stub here)
- League invite codes / trophy artwork tables
- Random-drop boost cards
- CLIP-embedding visual disambiguation
- League-tier-specific themed days

---

## Companion docs

- Design: `docs/plans/2026-05-03-leaderboard-phase2-5-design.md`
- Phase 1 design: `docs/plans/2026-04-29-leaderboard-phase1-design.md`
- Phase 1 implementation: `docs/plans/2026-04-29-leaderboard-phase1-implementation.md`
- Strategic memory: `~/.claude/projects/.../memory/project_leaderboard_redesign.md`
