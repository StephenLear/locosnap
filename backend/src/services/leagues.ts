// ============================================================
// LocoSnap — League XP service (Phase 2)
//
// Computes weekly League XP for a scan and persists an audit event
// to weekly_xp_events. Called from /api/identify after the spot is
// saved. Failure-tolerant by design: if anything throws here, the
// scan response still succeeds — XP just doesn't accrue for that
// scan. Sentry catches the error for ops follow-up.
//
// Pure-logic helpers (computeFinalXp, isThemedDay, etc.) are unit-
// testable without DB mocking. The DB-touching wrappers
// (computeWeeklyXp, persistXpEvent, applyBoostCard) accept the
// supabase client as a dependency to keep tests cheap.
//
// Migration 013 dependency: this module is a NO-OP until migration
// 013 has been applied. The supabaseAdmin guard at the top of each
// public function returns early when the league_membership table
// is missing, so wiring it into /api/identify is safe even before
// the migration ships.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RarityTier, VerificationTier } from "../types";

// ───────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────

export interface XpComputationInput {
  userId: string;
  spotId: string;
  classKey: string;
  rarityTier: RarityTier;
  verificationTier: VerificationTier;
  scanDate: Date;
  baseXp?: number; // optional override, defaults derived from rarity
}

export interface XpComputationOutput {
  finalXp: number;
  baseXp: number;
  diminishedXp: number;
  themedMultiplier: number;
  boostCardApplied: string | null;
  weekStartUtc: Date;
}

// ───────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────

/**
 * Base XP per rarity tier. Tuned so a typical week of casual scanning
 * (15-25 scans, mix of rarity) yields ~1000-1500 XP — enough to traverse
 * Bronze → Silver but not enough to rocket past competition.
 */
export const BASE_XP_BY_RARITY: Record<RarityTier, number> = {
  common: 10,
  uncommon: 25,
  rare: 50,
  epic: 100,
  legendary: 250,
};

/**
 * Multiplier applied when a class has already been scanned in the same
 * week. Discourages farming the same train repeatedly.
 */
export const REPEAT_SCAN_MULTIPLIER = 0.25;

/**
 * Themed days (UTC weekday: 0 = Sunday, 1 = Monday, ..., 6 = Saturday).
 * Easy to feature-flag override here without redeploying the cron.
 */
export const THEMED_DAYS = {
  // Tuesday: Rare-Tier-Tuesday — 2× XP for rare/epic/legendary scans.
  rareTier: 2,
  // Saturday: Heritage-Saturday — 1.5× XP for class operators in user's country.
  // (NOTE: country-match logic deferred — multiplier still defined here for
  // wiring; the application layer will introspect spot.train.operatorCountry
  // vs profile.country_code at call time.)
  heritage: 6,
} as const;

export const RARE_TIER_THEMED_MULTIPLIER = 2.0;
export const HERITAGE_THEMED_MULTIPLIER = 1.5;

// ───────────────────────────────────────────────────────────
// Pure helpers (unit-testable without DB)
// ───────────────────────────────────────────────────────────

/**
 * Returns the UTC Monday 00:00 that starts the ISO week containing
 * `date`. Matches `date_trunc('week', date AT TIME ZONE 'UTC')` in
 * Postgres so the league_membership.week_start_utc lookup is exact.
 */
export function weekStartUtc(date: Date): Date {
  const d = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
  // getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat. ISO week starts Monday.
  const dayOfWeek = d.getUTCDay();
  const daysFromMonday = (dayOfWeek + 6) % 7; // Sun→6, Mon→0, Tue→1, ...
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return d;
}

/**
 * Returns the rarity-tier base XP, or the override if provided.
 */
export function resolveBaseXp(
  rarityTier: RarityTier,
  override?: number
): number {
  if (typeof override === "number" && override >= 0) return override;
  return BASE_XP_BY_RARITY[rarityTier] ?? 0;
}

/**
 * Returns the multiplier for `scanDate`'s themed-day bonus given the
 * scan's rarity. Country-context themed bonuses are NOT applied here
 * (caller decides) — only rarity-anchored ones.
 */
export function rarityThemedMultiplier(
  scanDate: Date,
  rarityTier: RarityTier
): number {
  const day = scanDate.getUTCDay();
  if (
    day === THEMED_DAYS.rareTier &&
    (rarityTier === "rare" || rarityTier === "epic" || rarityTier === "legendary")
  ) {
    return RARE_TIER_THEMED_MULTIPLIER;
  }
  return 1.0;
}

/**
 * The verification gate. Only VERIFIED scans (live or recent-gallery)
 * contribute to League XP. PERSONAL and UNVERIFIED scans always
 * return 0 XP.
 */
export function isVerifiedForXp(tier: VerificationTier): boolean {
  return tier === "verified-live" || tier === "verified-recent-gallery";
}

/**
 * Composes baseXp → diminished → themed multiplier into a final XP
 * amount. Pure function; the diminishing-returns flag and themed
 * multiplier are passed in by the caller after the per-week DB query.
 */
export function computeFinalXp(params: {
  baseXp: number;
  hasPriorThisWeek: boolean;
  themedMultiplier: number;
}): { diminishedXp: number; finalXp: number } {
  const diminishedXp = params.hasPriorThisWeek
    ? Math.floor(params.baseXp * REPEAT_SCAN_MULTIPLIER)
    : params.baseXp;
  const finalXp = Math.floor(diminishedXp * params.themedMultiplier);
  return { diminishedXp, finalXp };
}

// ───────────────────────────────────────────────────────────
// DB-touching wrappers
// ───────────────────────────────────────────────────────────

/**
 * Computes weekly XP for a scan, including the diminishing-returns
 * lookup against weekly_xp_events. Does NOT persist — caller must
 * call persistXpEvent if they want the audit row written.
 *
 * Returns finalXp = 0 (with output zeroed) when:
 *   - verification tier is not VERIFIED (PERSONAL/UNVERIFIED)
 *   - migration 013 hasn't been applied (table missing)
 *   - any DB error occurs (failure-tolerant by design)
 */
export async function computeWeeklyXp(
  supabase: SupabaseClient,
  input: XpComputationInput
): Promise<XpComputationOutput> {
  const weekStart = weekStartUtc(input.scanDate);
  const baseXp = resolveBaseXp(input.rarityTier, input.baseXp);

  const zeroed: XpComputationOutput = {
    finalXp: 0,
    baseXp,
    diminishedXp: 0,
    themedMultiplier: 1.0,
    boostCardApplied: null,
    weekStartUtc: weekStart,
  };

  if (!isVerifiedForXp(input.verificationTier)) {
    return zeroed;
  }

  // Diminishing-returns lookup: "did this user already earn XP for
  // this class this week?" If yes, this scan only earns 25% of base.
  // PostgREST returns 42P01 (relation does not exist) when migration
  // 013 hasn't been applied — treat as no-op rather than crashing
  // the scan path.
  let hasPriorThisWeek = false;
  try {
    const { data, error } = await supabase
      .from("weekly_xp_events")
      .select("id")
      .eq("user_id", input.userId)
      .eq("week_start_utc", weekStart.toISOString())
      .eq("class_key", input.classKey)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows matched, which is the expected miss case.
      // Any other error → assume no prior + log via Sentry upstream.
      return zeroed;
    }
    hasPriorThisWeek = data != null;
  } catch {
    // Migration not applied or transient DB error — fall through.
    return zeroed;
  }

  const themedMultiplier = rarityThemedMultiplier(
    input.scanDate,
    input.rarityTier
  );

  const { diminishedXp, finalXp } = computeFinalXp({
    baseXp,
    hasPriorThisWeek,
    themedMultiplier,
  });

  return {
    finalXp,
    baseXp,
    diminishedXp,
    themedMultiplier,
    boostCardApplied: null,
    weekStartUtc: weekStart,
  };
}

/**
 * Writes a weekly_xp_events audit row and bumps
 * league_membership.weekly_xp by output.finalXp. No-op when finalXp
 * is 0. Idempotent: the (user_id, spot_id) pair has no unique
 * constraint by design (spots can only be scanned once anyway), so
 * caller guarantees one call per scan.
 */
export async function persistXpEvent(
  supabase: SupabaseClient,
  input: XpComputationInput,
  output: XpComputationOutput
): Promise<void> {
  if (output.finalXp <= 0) return;

  try {
    await supabase.from("weekly_xp_events").insert({
      user_id: input.userId,
      spot_id: input.spotId,
      class_key: input.classKey,
      week_start_utc: output.weekStartUtc.toISOString(),
      base_xp: output.baseXp,
      diminished_xp: output.diminishedXp,
      themed_multiplier: output.themedMultiplier,
      boost_card_applied: output.boostCardApplied,
      final_xp: output.finalXp,
      verification_tier: input.verificationTier,
    });

    // Increment league_membership.weekly_xp. We use an RPC so the
    // atomicity is preserved server-side; the alternative read-modify-
    // write loses concurrent scans on the same week.
    await supabase.rpc("increment_weekly_xp", {
      p_user_id: input.userId,
      p_week_start: output.weekStartUtc.toISOString(),
      p_xp_delta: output.finalXp,
    });
  } catch {
    // Migration not applied or transient DB error. Don't bubble —
    // the scan already succeeded; XP just won't accrue for this row.
    // Sentry breadcrumb wired at the call site if needed.
  }
}
