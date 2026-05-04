# Leaderboard Phase 2-5 — Design Doc

**Date:** 2026-05-03
**Author:** Stephen Lear (with Claude brainstorm session)
**Status:** Design locked, awaiting implementation plan
**Estimated effort:** 23-29h for v1.0.25 ship (Phase 2 + 3 + 4 + Phase 5 schema stub). Phase 5 UX deferred until 1k+ active users. Phase 3.5 Station tab deferred until station GPS corpus density supports it.

## Why this design exists

LocoSnap's current leaderboard is a single all-time XP table — passive, low-engagement, doesn't reflect either the brand's collection-led positioning or the active-spotter behaviour we want to reward. Steph (our most engaged Pro tester) explicitly told us: *"the achievements are what pushed me more to spot and scan"* — and her instinct generalises.

This design replaces the existing 4-tab leaderboard with a Duolingo-style weekly league system supplemented by collection-led views, ships verification-aware photo treatment that protects competition fairness without stripping value from existing collections, and lays schema foundations for a deferred friends graph (Phase 5).

## Locked decisions log

Each decision below has a single locked answer and a short rationale. Decisions are numbered for cross-reference from the implementation plan.

### D1 — Phase 5 friends graph: schema-stub only

Phase 5 is included as schema-level placeholders only. The `friendships` table ships in v1.0.25 but is unused until a follow-up release activates the friends UX. Trigger to ship Phase 5 UX: 1k+ active users.

### D2 — League sizing: single-league-per-tier with `league_shard_id` for future sharding

At 50 active leaderboard users today, every Bronze user competes in one league row. `league_shard_id` column exists from day one (always 0 for now). Auto-shard trigger: any tier exceeds 60 active users in a week — sharding logic implementable just-in-time when threshold first fires.

### D3 — Competition metric: weekly XP with diminishing returns per repeat scan

XP per scan uses the existing rarity-weighted system. First scan of class X this week = 100% computed XP; each subsequent scan of the same class within the same week = **25%** (starting tunable). Solves the "Class 66 grind" anti-pattern while keeping legendary-find dopamine.

### D4 — Reset cadence: Sunday 23:59 UTC

Single global cron job. Client UI translates to user-local for "X days Y hours until reset" countdown. Simultaneous reset is the fairness floor for promotion races.

### D5 — Pro gating: Bronze/Silver/Gold free; Steam/Diesel/Electric/ICE/Vectron Pro

Promotion out of Gold = paywall trigger ("earn your way into Steam"). Earned-upgrade pattern (Pattern C from paywall research). Compounding paywall impressions: a blocked-at-Gold user sits at top of Gold the next week, hits the same paywall again at peak engagement.

### D6 — Promotion/demotion: top 10% / bottom 10%, minimum 1 each

Scales gracefully across league sizes (50 users = top 5/bottom 5; 10 users = top 1/bottom 1). Always-visible promotion + demotion zones preserve Duolingo loss-aversion at every league size. **Bronze never demotes** (floor); UI hides demote zone for Bronze users.

### D7 — Inactivity: skip-week + 4-week ghost cleanup

A "scan a train this week" qualifies as active. Inactive users (0 scans) skip the week — stay in tier, don't appear in week's competition. 4 consecutive inactive weeks = drop one tier (Bronze still doesn't demote). Streak freezes (D8) consume an inactive week and reset the cleanup counter.

### D8 — Streak freezes: A+D combined

| User | Earn trigger | Cap |
|---|---|---|
| Free | 1 freeze per 4 consecutive active weeks | 2 banked |
| Pro | 1 freeze auto-replenishes weekly | 3 banked |

Auto-burn at week close (no manual play). Push notification next morning: "Streak freeze used to protect your Steam league spot — 1 remaining". Pro retention hook beyond league access.

### D9 — Launch-day behaviour: auto-place all in Bronze at $0 weekly XP

Clean reset; everyone starts equal. First scan begins accumulating. Top performers naturally promote out by week 2-3. No retroactive XP conversion, no tier-skipping for engaged users — promotion races feel fair from week one.

### D10 — Tab structure: My League / Country / Collection (3 tabs)

Replaces the existing 4 tabs. All-Time + Rarity become sub-toggles inside their natural homes. Region tab evolves into proper Country tab. Sub-toggle pattern keeps the screen mobile-friendly (3 tabs comfortable; 5+ users miss tabs past index 2).

### D11 — Boost cards: scheduled themed days + earned inventory

| Day (UTC) | Theme | Effect |
|---|---|---|
| Tuesday | Rarity Day | 2× XP for rare / epic / legendary scans |
| Thursday | Consistency Day | +50 XP if scanned yesterday AND today |
| Saturday | Country Pride Day | 1.5× XP for trains operated in user's country |

Earned inventory: 1 "+100 XP" boost on league promotion (cap 3); 1 "2× XP next scan" on 4-week active streak (cap 2). Manual play. **Same mechanics for Free and Pro** — Pro is differentiated only by league access + freeze economy.

### D12 — Verification: three-tier visibility model with backwards-compat grandfathering

Three-tier `verification_tier` enum:

| Tier | Trigger | League XP | Public visibility |
|---|---|---|---|
| **VERIFIED** | Live capture + GPS + recent EXIF + no mock-location | Counts | Yes |
| **PERSONAL** | Gallery photo with intact EXIF, plausible date OR weak GPS on live capture | 0 | Yes (still on row, in friends feed, featured-card eligible) |
| **UNVERIFIED** | Stripped EXIF, implausible signals, suspected internet find | 0 | **No — private to user only** |

**Backwards-compat rule:** all pre-v1.0.25 spots without a tier are grandfathered as PERSONAL. Existing users keep all collection visibility, all featured-card eligibility, all collection metrics. The only thing that doesn't backfill is weekly League XP (which is by definition a "this week" race).

**Manual override:** card detail screen has an "I took this photo myself" toggle that promotes UNVERIFIED → PERSONAL. Honor system. Telemetry-flag if a user does it >50 times.

### D13 — Tier names: Memory's chronological draft

Bronze → Silver → Gold | Steam → Diesel → Electric → ICE → Vectron. Schema uses neutral keys `tier_1` through `tier_8`; display names map at runtime. Names tunable in implementation; conceptual count + Pro-gating boundary locked.

## Summary by phase

### Phase 2 — League system (~12-16h)

The Duolingo-style core loop. Adds `league_membership` table + cron coordinator + boost-card scoring service. Replaces "This Week" tab with My League. Streak freezes + earned boost cards. Verification gate on weekly XP. Auto-place all existing users in Bronze on v1.0.25 launch.

### Phase 3a — Country tab (~3-4h)

Replaces existing Region tab. Uses existing `profiles.country_code` from Phase 1 identity layer. DE/PL/UK as default selectors plus dynamic discovery (`select distinct country_code from profiles`). Same scoring as My League (VERIFIED-only, diminishing returns, themed multipliers).

### Phase 3b — Collection tab (~3-4h)

Steph's tab. Three sub-toggles: Unique classes (default) / Rarity score / Streak days. Achievements visible on each row. Replaces the existing Rarity tab. Counts VERIFIED + PERSONAL.

### Phase 4 — Boost cards (~4h)

Scheduled themed days + earned inventory. UI on League tab + Scan tab. Push notification on themed days at 08:00 user-local. Server-side scoring in `backend/src/services/leagues.ts`.

### Phase 5 schema stub (~1h)

`friendships` table ships in the migration but no UX. Activated by future release after 1k+ active users.

### Phase 3.5 — Station tab (deferred)

Strava-style station leaderboards — top spotters at a specific GPS-defined station this month. Activation trigger: average station has 5+ scans (currently most have 0-3). Likely 4-6 months out as the GPS corpus grows.

## Architecture overview (design-level only — implementation plan handles specifics)

**Three new components:**

1. **Backend service `leagues.ts`** — per-scan XP computation (base × diminishing returns × themed multiplier × verification tier), boost-card application, writes to events log. Called from existing `/api/identify`.

2. **Weekly cron** — Sunday 23:59 UTC, ~30 seconds. Reads each tier, computes top/bottom 10%, applies promotions/demotions, awards Pro freezes, awards Free freezes for 4-week streaks, awards earned boost cards for promotions, runs ghost-cleanup for 4-week inactives, resets weekly XP, opens next week. Hosted on Render alongside the API.

3. **Frontend `useLeaderboardStore`** — Zustand store handling tab/sub-toggle state, current league data, featured-card-picker. Replaces existing leaderboard hooks.

**Per-scan data flow:**

User scans → `/api/identify` runs as today → spot saved with `verification_tier` → `leagues.ts` checks `verification_tier = 'VERIFIED'`, computes weekly XP delta with diminishing returns + themed-day multiplier + active boost card, writes `weekly_xp_events` row, increments `league_membership.weekly_xp` → response includes `weekly_xp_delta` for UI feedback ("+45 XP toward Bronze League").

**Risk areas (flagged for the implementation plan):**

- **Cron failure recovery** — manual replay endpoint required. If Sunday 23:59 fails, must be replayable without double-promoting users.
- **Race conditions on featured-card backfill** — deterministic tiebreaker `(rarity_tier desc, created_at asc)` so the same legendary becomes everyone's featured card across re-runs.
- **UNVERIFIED false-positives** — legit gallery photos with corrupted EXIF could land in UNVERIFIED. Manual override exists. Telemetry-watch the override rate post-launch.

## Open implementation tunables

Deliberately left unfixed in the design; set during implementation with empirical refinement.

| Tunable | Starting value | When to revisit |
|---|---|---|
| Diminishing-returns % per repeat scan in same week | 25% | After 4 weeks of telemetry; raise if collection-grinding still dominates, lower if users feel punished |
| Themed-day push notification time | 08:00 user-local | After 1 week of open-rate data |
| Auto-shard threshold | 60 active users in a tier | When first tier hits 50 |
| Pro auto-freeze cap | 3 banked | If support tickets show users feel constrained |
| 4-week ghost-cleanup window | 4 weeks | Could lengthen to 6-8 weeks if it feels harsh on real-life-cadence users |

## Out of scope for v1.0.25

- DE Bundesländer / PL voivodeships region taxonomy (`frontend_backlog #22 Phase 2`)
- Station leaderboard tables (Phase 3.5)
- Friends UX (Phase 5)
- League invite codes / trophy artwork tables
- Random-drop boost cards (deferred unless engagement plateaus on scheduled+earned model)
- CLIP-embedding visual disambiguation
- League-tier-specific themed days (e.g. "Steam-only Saturday")

## Cross-references

- `project_leaderboard_redesign.md` — strategic genesis, Duolingo + best-in-class survey
- `project_status.md` — Steph's "achievements > leaderboard" insight, paywall research
- `project_competitive_positioning.md` — "collection is the moat" positioning
- `project_market_focus.md` — DE/PL/UK priority for Country tab
- `project_churn_patterns.md` — Pro retention drivers
- `frontend_backlog.md` items #22 (Phase 2 — this design), #23 (Phase 3), #24 (Phase 4), #25 (Phase 5)
- `docs/plans/2026-04-29-leaderboard-phase1-design.md` — Phase 1 (identity layer) design doc
- `docs/plans/2026-04-29-leaderboard-phase1-implementation.md` — Phase 1 implementation plan (shipped in v1.0.22)

## Next step

Implementation plan via the writing-plans skill. The plan turns this design into step-by-step tasks: SQL migration, backend service module, cron coordination, frontend store + tab components, push-notification scheduling, test coverage, sequencing across the four sub-phases.
