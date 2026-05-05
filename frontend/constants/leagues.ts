// ============================================================
// LocoSnap — League tier constants (Phase 2)
//
// Tier 1-3 (Bronze/Silver/Gold) are free; tier 4-8 (Steam/Diesel/
// Electric/ICE/Vectron) are Pro-gated. Promotion out of Gold is
// the canonical Pro upgrade moment per design doc D2 + Pattern C.
// ============================================================

export interface TierMeta {
  index: number;
  key: string;
  proGated: boolean;
  /** i18n key under leaderboard.league.tier.<key>.name */
  i18nNameKey: string;
  /** Hex color for tier badge rendering */
  color: string;
}

export const TIERS: ReadonlyArray<TierMeta> = [
  { index: 1, key: "bronze",   proGated: false, i18nNameKey: "leaderboard.league.tier.bronze",   color: "#cd7f32" },
  { index: 2, key: "silver",   proGated: false, i18nNameKey: "leaderboard.league.tier.silver",   color: "#94a3b8" },
  { index: 3, key: "gold",     proGated: false, i18nNameKey: "leaderboard.league.tier.gold",     color: "#f59e0b" },
  { index: 4, key: "steam",    proGated: true,  i18nNameKey: "leaderboard.league.tier.steam",    color: "#475569" },
  { index: 5, key: "diesel",   proGated: true,  i18nNameKey: "leaderboard.league.tier.diesel",   color: "#0f766e" },
  { index: 6, key: "electric", proGated: true,  i18nNameKey: "leaderboard.league.tier.electric", color: "#0284c7" },
  { index: 7, key: "ice",      proGated: true,  i18nNameKey: "leaderboard.league.tier.ice",      color: "#7c3aed" },
  { index: 8, key: "vectron",  proGated: true,  i18nNameKey: "leaderboard.league.tier.vectron",  color: "#dc2626" },
];

export const BRONZE_TIER = 1;
export const VECTRON_TIER = 8;

/** Top 10% promote per tier (min 1, except Vectron). */
export const PROMOTION_PCT = 0.1;
/** Bottom 10% demote per tier (min 1, except Bronze). */
export const DEMOTION_PCT = 0.1;

export function getTier(index: number): TierMeta {
  const found = TIERS.find((t) => t.index === index);
  if (!found) return TIERS[0];
  return found;
}

/**
 * Computes how many users from the top of the ranked list will promote
 * out of this tier. Returns 0 for Vectron (never promotes) or empty leagues.
 */
export function promotionSlots(tierIndex: number, leagueSize: number): number {
  if (tierIndex >= VECTRON_TIER) return 0;
  if (leagueSize === 0) return 0;
  return Math.max(1, Math.floor(leagueSize * PROMOTION_PCT));
}

/**
 * Computes how many users from the bottom of the ranked list will demote
 * out of this tier. Returns 0 for Bronze (never demotes) or empty leagues.
 */
export function demotionSlots(tierIndex: number, leagueSize: number): number {
  if (tierIndex <= BRONZE_TIER) return 0;
  if (leagueSize === 0) return 0;
  return Math.max(1, Math.floor(leagueSize * DEMOTION_PCT));
}
