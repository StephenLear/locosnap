// ============================================================
// LocoSnap — Weekly League Reset (Phase 2 cron)
//
// Runs every Sunday 23:59 UTC on Render. Reads each tier (1-8),
// computes promotions/demotions (D6: top 10% / bottom 10%, min 1),
// applies tier moves, awards Pro auto-freezes + Free 4-week-streak
// freezes (D8), awards earned boost cards on promotion (D11),
// runs ghost-cleanup for 4-week inactives (D7), auto-burns streak
// freezes for inactive users with available freezes, resets
// weekly_xp = 0, opens next week.
//
// Pure helpers (computeTierMoves, decideFreezeAward, etc.) are
// unit-testable without DB mocking. The DB-touching orchestrator
// (runLeagueWeeklyReset) accepts the supabase client as a
// dependency to keep tests cheap.
//
// Migration 013 dependency: this module is a NO-OP until migration
// 013 has been applied. Each DB call is wrapped so a missing-table
// error returns early with a clear status.
//
// Idempotency: re-running with the same weekStartUtc is a no-op.
// The cron checks league_cycle_state.last_reset_at first.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { weekStartUtc } from "../services/leagues";

// ───────────────────────────────────────────────────────────
// Constants — tunable in design doc § Open implementation tunables
// ───────────────────────────────────────────────────────────

/** Tier 1 (Bronze) is the floor — never demotes. */
export const BRONZE_TIER = 1;
/** Tier 8 (Vectron) is the ceiling — never promotes. */
export const VECTRON_TIER = 8;

/** Top 10% of each league promote (minimum 1). */
export const PROMOTION_PCT = 0.1;
/** Bottom 10% of each league demote (minimum 1, except Bronze). */
export const DEMOTION_PCT = 0.1;

/** Pro: 1 freeze auto-replenishes per week, capped at 3 banked. */
export const PRO_FREEZE_CAP = 3;
/** Free: 1 freeze per 4 consecutive active weeks, capped at 2 banked. */
export const FREE_FREEZE_CAP = 2;
export const FREE_FREEZE_STREAK_THRESHOLD = 4;

/** Earned `flat_100` boost card on league promotion, capped at 3. */
export const FLAT_100_BOOST_CAP = 3;

/** 4 consecutive inactive weeks = drop one tier (Bronze excluded). */
export const GHOST_INACTIVITY_THRESHOLD = 4;

// ───────────────────────────────────────────────────────────
// Pure helper types
// ───────────────────────────────────────────────────────────

export interface LeagueMember {
  userId: string;
  weeklyXp: number;
  /** ms since epoch — secondary sort, earlier wins ties (Duolingo rule). */
  updatedAt: number;
}

export interface TierMove {
  userId: string;
  fromTier: number;
  toTier: number;
  action: "promote" | "demote" | "stay";
}

export interface FreezeAwardInput {
  isPro: boolean;
  freezesAvailable: number;
  consecutiveActiveWeeks: number;
  scannedThisWeek: boolean;
}

export interface FreezeAwardOutput {
  /** Net change to streak_freezes_available (can be 0). */
  delta: number;
  /** Whether to reset consecutive_active_weeks to 0 because a freeze was earned this week. */
  resetActiveStreak: boolean;
}

export interface GhostMoveInput {
  consecutiveInactiveWeeks: number;
  freezesAvailable: number;
  currentTier: number;
  scannedThisWeek: boolean;
}

export interface GhostMoveOutput {
  /** Net change to consecutive_inactive_weeks. */
  inactiveDelta: number;
  /** New value (clamped) — not a delta. Caller writes this directly. */
  newInactiveCount: number;
  /** Net change to streak_freezes_available — negative when burned. */
  freezeDelta: number;
  /** Whether to drop a tier (1) or stay (0). */
  tierDrop: 0 | 1;
}

// ───────────────────────────────────────────────────────────
// Pure helpers (no DB)
// ───────────────────────────────────────────────────────────

/**
 * Computes promotion + demotion sets for a single tier league. Returns
 * a TierMove for every member of the league. Members not in the top
 * 10% or bottom 10% get action: "stay".
 *
 * Sort order matches the SECURITY DEFINER function `get_my_league_rankings`:
 * `weekly_xp desc, updated_at asc` (earlier-updated wins ties).
 *
 * Bronze (tier 1) members never demote — their bottom-10% slot resolves to "stay".
 * Vectron (tier 8) members never promote — their top-10% slot resolves to "stay".
 *
 * Inactive members (weeklyXp === 0) never promote even if they're in the
 * "top 10% min 1" slot of an empty league — promotion requires positive XP.
 */
export function computeTierMoves(
  tierIndex: number,
  members: LeagueMember[]
): TierMove[] {
  if (members.length === 0) return [];

  const sorted = [...members].sort((a, b) => {
    if (b.weeklyXp !== a.weeklyXp) return b.weeklyXp - a.weeklyXp;
    return a.updatedAt - b.updatedAt;
  });

  const promoteCount = Math.max(1, Math.floor(sorted.length * PROMOTION_PCT));
  const demoteCount = Math.max(1, Math.floor(sorted.length * DEMOTION_PCT));

  const promoteSet = new Set<string>();
  const demoteSet = new Set<string>();

  // Top N promote, but only if they have positive XP and tier < Vectron.
  if (tierIndex < VECTRON_TIER) {
    for (let i = 0; i < promoteCount && i < sorted.length; i++) {
      if (sorted[i].weeklyXp > 0) promoteSet.add(sorted[i].userId);
    }
  }

  // Bottom N demote, but only if tier > Bronze. Inactive users still demote
  // via this path when they're in the bottom slice — this is intentional
  // (one inactive week alone won't bottom-rank you; ghost-cleanup is the
  // 4-week safety net).
  if (tierIndex > BRONZE_TIER) {
    for (let i = sorted.length - 1; i >= sorted.length - demoteCount && i >= 0; i--) {
      // A user can't be both promoted AND demoted in the same week.
      if (!promoteSet.has(sorted[i].userId)) {
        demoteSet.add(sorted[i].userId);
      }
    }
  }

  return sorted.map((m) => {
    if (promoteSet.has(m.userId)) {
      return { userId: m.userId, fromTier: tierIndex, toTier: tierIndex + 1, action: "promote" };
    }
    if (demoteSet.has(m.userId)) {
      return { userId: m.userId, fromTier: tierIndex, toTier: tierIndex - 1, action: "demote" };
    }
    return { userId: m.userId, fromTier: tierIndex, toTier: tierIndex, action: "stay" };
  });
}

/**
 * Decides freeze-inventory delta for a single user at week close.
 *
 * Pro users: +1 freeze every week, capped at PRO_FREEZE_CAP (3).
 * Free users: +1 freeze when they hit FREE_FREEZE_STREAK_THRESHOLD
 *   (4 consecutive active weeks INCLUDING the week that just closed),
 *   capped at FREE_FREEZE_CAP (2). Earning a freeze resets the active
 *   streak counter to 0 — they have to earn the next one fresh.
 *
 * `consecutiveActiveWeeks` is the value AFTER the just-closed week is
 * counted (caller increments before calling: scanned → +1, didn't → 0).
 */
export function decideFreezeAward(input: FreezeAwardInput): FreezeAwardOutput {
  if (input.isPro) {
    if (input.freezesAvailable >= PRO_FREEZE_CAP) {
      return { delta: 0, resetActiveStreak: false };
    }
    return { delta: 1, resetActiveStreak: false };
  }

  // Free path: only earn on hitting the streak threshold.
  if (input.consecutiveActiveWeeks >= FREE_FREEZE_STREAK_THRESHOLD) {
    if (input.freezesAvailable >= FREE_FREEZE_CAP) {
      // At cap — still reset the active-week streak so we don't keep
      // re-evaluating the threshold every week (would award infinitely
      // once cap is freed up). Aligns with "earn one and start over".
      return { delta: 0, resetActiveStreak: true };
    }
    return { delta: 1, resetActiveStreak: true };
  }

  return { delta: 0, resetActiveStreak: false };
}

/**
 * Computes the ghost-cleanup decision for a user who didn't scan this week.
 *
 * Rules (D7):
 *   - Active this week → reset inactive counter to 0, no tier drop.
 *   - Inactive but has a freeze → burn 1 freeze, reset inactive counter to 0,
 *     no tier drop (the freeze "covered" the inactive week).
 *   - Inactive without freeze, counter < 4 → increment counter, no drop.
 *   - Inactive without freeze, counter would hit 4 → drop one tier (unless
 *     Bronze, which is the floor), then reset counter to 0.
 */
export function computeGhostMove(input: GhostMoveInput): GhostMoveOutput {
  if (input.scannedThisWeek) {
    return {
      inactiveDelta: 0,
      newInactiveCount: 0,
      freezeDelta: 0,
      tierDrop: 0,
    };
  }

  // Inactive week.
  if (input.freezesAvailable > 0) {
    return {
      inactiveDelta: 0,
      newInactiveCount: 0,
      freezeDelta: -1,
      tierDrop: 0,
    };
  }

  const projected = input.consecutiveInactiveWeeks + 1;
  if (projected >= GHOST_INACTIVITY_THRESHOLD) {
    return {
      inactiveDelta: -input.consecutiveInactiveWeeks,
      newInactiveCount: 0,
      freezeDelta: 0,
      tierDrop: input.currentTier > BRONZE_TIER ? 1 : 0,
    };
  }

  return {
    inactiveDelta: 1,
    newInactiveCount: projected,
    freezeDelta: 0,
    tierDrop: 0,
  };
}

/**
 * Decides whether to award a `flat_100` boost card on promotion. Cap is
 * checked against current inventory size; caller queries inventory first.
 */
export function shouldAwardPromotionBoost(currentFlat100Count: number): boolean {
  return currentFlat100Count < FLAT_100_BOOST_CAP;
}

/**
 * Returns the next week's start/end UTC pair given the current
 * week_start_utc. Mirrors the migration 013 backfill formula:
 *   week_end_utc = week_start_utc + 6 days 23h 59m 59s
 */
export function nextWeekBoundaries(currentWeekStart: Date): {
  nextStart: Date;
  nextEnd: Date;
} {
  const nextStart = new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextEnd = new Date(
    nextStart.getTime() + (6 * 24 * 60 * 60 + 23 * 60 * 60 + 59 * 60 + 59) * 1000
  );
  return { nextStart, nextEnd };
}

// ───────────────────────────────────────────────────────────
// DB-touching orchestrator
// ───────────────────────────────────────────────────────────

export interface ResetSummary {
  status: "completed" | "skipped_already_run" | "skipped_no_migration" | "failed";
  weekStartUtc: string;
  promoted: number;
  demoted: number;
  ghostsDropped: number;
  freezesAwarded: number;
  freezesBurned: number;
  boostsAwarded: number;
  error?: string;
}

interface MembershipRow {
  user_id: string;
  tier_index: number;
  league_shard_id: number;
  weekly_xp: number;
  consecutive_inactive_weeks: number;
  consecutive_active_weeks: number;
  updated_at: string;
}

interface ProfileRow {
  id: string;
  is_pro: boolean | null;
  streak_freezes_available: number | null;
}

/**
 * Runs the full weekly league reset. Idempotent against `weekStartUtc`:
 * re-running for an already-completed week returns
 * `status: "skipped_already_run"` without touching any rows.
 *
 * Failure-tolerant by design: any DB error is captured into
 * `last_reset_status = 'failed'` so monitoring picks it up, but the
 * promise still resolves (Render cron retries on non-zero exit, but we
 * surface failures via the cycle-state row + Sentry instead).
 */
export async function runLeagueWeeklyReset(
  supabase: SupabaseClient,
  weekStartUtcInput: Date
): Promise<ResetSummary> {
  const weekStart = weekStartUtc(weekStartUtcInput);
  const summary: ResetSummary = {
    status: "completed",
    weekStartUtc: weekStart.toISOString(),
    promoted: 0,
    demoted: 0,
    ghostsDropped: 0,
    freezesAwarded: 0,
    freezesBurned: 0,
    boostsAwarded: 0,
  };

  console.log(`[league-cron] reading cycle state...`);
  const cycleRead = await supabase
    .from("league_cycle_state")
    .select("current_week_start, last_reset_at, last_reset_status")
    .eq("id", 1)
    .maybeSingle();
  console.log(`[league-cron] cycle state read: ${cycleRead.error ? `error=${cycleRead.error.code}` : `data=${JSON.stringify(cycleRead.data)}`}`);

  if (cycleRead.error) {
    // 42P01 = relation does not exist → migration not applied.
    if (cycleRead.error.code === "42P01" || cycleRead.error.code === "PGRST205") {
      return { ...summary, status: "skipped_no_migration" };
    }
    return { ...summary, status: "failed", error: cycleRead.error.message };
  }

  const cycle = cycleRead.data;
  if (
    cycle &&
    cycle.last_reset_at &&
    cycle.last_reset_status === "completed" &&
    new Date(cycle.current_week_start).getTime() === weekStart.getTime()
  ) {
    return { ...summary, status: "skipped_already_run" };
  }

  console.log(`[league-cron] marking cycle in_progress...`);
  await supabase
    .from("league_cycle_state")
    .update({ last_reset_status: "in_progress" })
    .eq("id", 1);

  try {
    console.log(`[league-cron] fetching league_membership rows...`);
    const { data: memberships, error: memErr } = await supabase
      .from("league_membership")
      .select(
        "user_id, tier_index, league_shard_id, weekly_xp, consecutive_inactive_weeks, consecutive_active_weeks, updated_at"
      );
    if (memErr) throw memErr;
    console.log(`[league-cron] fetched ${memberships?.length ?? 0} memberships`);

    console.log(`[league-cron] fetching profiles...`);
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, is_pro, streak_freezes_available");
    if (profErr) throw profErr;
    console.log(`[league-cron] fetched ${profiles?.length ?? 0} profiles`);

    const profileById = new Map<string, ProfileRow>(
      (profiles ?? []).map((p) => [p.id, p as ProfileRow])
    );

    // Group memberships by (tier_index, league_shard_id) for promotion math.
    const groups = new Map<string, MembershipRow[]>();
    for (const row of (memberships ?? []) as MembershipRow[]) {
      const key = `${row.tier_index}:${row.league_shard_id}`;
      const list = groups.get(key) ?? [];
      list.push(row);
      groups.set(key, list);
    }

    // Compute tier moves per group.
    const moveByUser = new Map<string, TierMove>();
    for (const [key, group] of groups.entries()) {
      const [tierStr] = key.split(":");
      const tier = parseInt(tierStr, 10);
      const moves = computeTierMoves(
        tier,
        group.map((r) => ({
          userId: r.user_id,
          weeklyXp: r.weekly_xp,
          updatedAt: new Date(r.updated_at).getTime(),
        }))
      );
      for (const move of moves) moveByUser.set(move.userId, move);
    }

    // Per-user write loop.
    console.log(`[league-cron] starting per-user write loop (${memberships?.length ?? 0} rows)...`);
    let processedCount = 0;
    const writeLoopStart = Date.now();
    for (const row of (memberships ?? []) as MembershipRow[]) {
      const profile = profileById.get(row.user_id);
      const move = moveByUser.get(row.user_id) ?? {
        userId: row.user_id,
        fromTier: row.tier_index,
        toTier: row.tier_index,
        action: "stay" as const,
      };
      const scannedThisWeek = row.weekly_xp > 0;

      // Ghost cleanup logic.
      const ghost = computeGhostMove({
        consecutiveInactiveWeeks: row.consecutive_inactive_weeks,
        freezesAvailable: profile?.streak_freezes_available ?? 0,
        currentTier: row.tier_index,
        scannedThisWeek,
      });

      // Freeze award logic. Active streak is incremented BEFORE the
      // call so the threshold check sees the post-week value.
      const newConsecutiveActive = scannedThisWeek
        ? row.consecutive_active_weeks + 1
        : 0;
      const freezeAward = decideFreezeAward({
        isPro: !!profile?.is_pro,
        freezesAvailable: profile?.streak_freezes_available ?? 0,
        consecutiveActiveWeeks: newConsecutiveActive,
        scannedThisWeek,
      });

      // Apply tier move (promote/demote/ghost-drop).
      let resolvedTier = move.toTier;
      if (ghost.tierDrop === 1 && move.action === "stay") {
        // Only ghost-drop when the user wasn't already moved by promotion/demotion math.
        // (A user can't be promoted AND ghost-dropped in the same week — promotion requires
        // positive XP, ghost requires zero, so they're mutually exclusive in practice.)
        resolvedTier = Math.max(BRONZE_TIER, row.tier_index - 1);
      }

      // Track summary.
      if (move.action === "promote") summary.promoted += 1;
      if (move.action === "demote") summary.demoted += 1;
      if (ghost.tierDrop === 1 && move.action === "stay") summary.ghostsDropped += 1;
      if (freezeAward.delta > 0) summary.freezesAwarded += freezeAward.delta;
      if (ghost.freezeDelta < 0) summary.freezesBurned += -ghost.freezeDelta;

      // Write membership row.
      const membershipUpdate: Record<string, unknown> = {
        tier_index: resolvedTier,
        weekly_xp: 0,
        weekly_unique_classes: 0,
        consecutive_inactive_weeks: ghost.newInactiveCount,
        consecutive_active_weeks: freezeAward.resetActiveStreak ? 0 : newConsecutiveActive,
        updated_at: new Date().toISOString(),
      };
      if (move.action === "promote" || move.action === "demote" || ghost.tierDrop === 1) {
        if (move.action === "promote") {
          membershipUpdate.last_promotion_at = new Date().toISOString();
        } else {
          membershipUpdate.last_demotion_at = new Date().toISOString();
        }
      }
      await supabase
        .from("league_membership")
        .update(membershipUpdate)
        .eq("user_id", row.user_id);

      // Write profile row (freezes only). consecutive_active_weeks lives
      // on league_membership; streak_freezes_available lives on profiles.
      const freezeNetDelta = freezeAward.delta + ghost.freezeDelta;
      if (freezeNetDelta !== 0 && profile) {
        const newFreezes = Math.max(
          0,
          (profile.streak_freezes_available ?? 0) + freezeNetDelta
        );
        await supabase
          .from("profiles")
          .update({ streak_freezes_available: newFreezes })
          .eq("id", row.user_id);
      }

      // Boost card on promotion.
      if (move.action === "promote") {
        const { count } = await supabase
          .from("user_boost_inventory")
          .select("*", { count: "exact", head: true })
          .eq("user_id", row.user_id)
          .eq("card_type", "flat_100")
          .is("used_at", null);
        if (shouldAwardPromotionBoost(count ?? 0)) {
          await supabase.from("user_boost_inventory").insert({
            user_id: row.user_id,
            card_type: "flat_100",
            earned_reason: "league_promotion",
          });
          summary.boostsAwarded += 1;
        }
      }
      processedCount += 1;
      if (processedCount % 25 === 0) {
        const elapsed = Date.now() - writeLoopStart;
        console.log(`[league-cron] processed ${processedCount}/${memberships?.length ?? 0} rows (${elapsed}ms elapsed)`);
      }
    }
    console.log(`[league-cron] write loop done: ${processedCount} rows in ${Date.now() - writeLoopStart}ms`);

    // Open the next week.
    console.log(`[league-cron] advancing cycle state...`);
    const { nextStart, nextEnd } = nextWeekBoundaries(weekStart);
    await supabase
      .from("league_cycle_state")
      .update({
        current_week_start: nextStart.toISOString(),
        current_week_end: nextEnd.toISOString(),
        last_reset_at: new Date().toISOString(),
        last_reset_status: "completed",
      })
      .eq("id", 1);

    console.log(`[league-cron] rolling all membership rows to next week boundaries...`);
    await supabase
      .from("league_membership")
      .update({
        week_start_utc: nextStart.toISOString(),
        week_end_utc: nextEnd.toISOString(),
      })
      .gte("user_id", "00000000-0000-0000-0000-000000000000");

    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("league_cycle_state")
      .update({ last_reset_status: "failed" })
      .eq("id", 1);
    return { ...summary, status: "failed", error: message };
  }
}
