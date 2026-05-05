// ============================================================
// LocoSnap — Rarity score weights (Phase 2 E.4)
//
// Weighting collection rarity for the Collection tab leaderboard.
// Designed so a Legendary find dominates the score (one Legendary
// scan ≈ three Rare or 7-8 Uncommon scans).
// ============================================================

export const RARITY_SCORE_WEIGHTS = {
  common: 0,
  uncommon: 2,
  rare: 5,
  epic: 8,
  legendary: 15,
} as const;

export interface RarityCounts {
  uncommonCount?: number;
  rareCount?: number;
  epicCount?: number;
  legendaryCount?: number;
}

/** Computes the weighted rarity score from per-tier counts. */
export function computeRarityScore(counts: RarityCounts): number {
  return (
    (counts.uncommonCount ?? 0) * RARITY_SCORE_WEIGHTS.uncommon +
    (counts.rareCount ?? 0) * RARITY_SCORE_WEIGHTS.rare +
    (counts.epicCount ?? 0) * RARITY_SCORE_WEIGHTS.epic +
    (counts.legendaryCount ?? 0) * RARITY_SCORE_WEIGHTS.legendary
  );
}
