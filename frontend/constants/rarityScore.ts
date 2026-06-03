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

// ── Score breakdown (transparency explainer) ──────────────────
// Decomposes a user's own rarity score into its contributing tiers so
// the leaderboard can show "your 552 = … Rare ×5 + … Epic ×8 …". Covers
// ONLY rare/epic/legendary — the `leaderboard_rarity` view exposes only
// those counts, and the displayed score (CollectionTab) is computed from
// them, so commons/uncommons are correctly absent here. The returned
// `total` therefore always equals the score shown on the row.
export type RarityScoreTier = "rare" | "epic" | "legendary";

export interface RarityScoreLine {
  tier: RarityScoreTier;
  count: number;
  weight: number;
  subtotal: number;
}

export interface RarityScoreBreakdown {
  /** Only tiers the user actually has (count > 0), in rarity order. */
  lines: RarityScoreLine[];
  total: number;
}

export function buildRarityScoreBreakdown(
  counts: RarityCounts
): RarityScoreBreakdown {
  const order: RarityScoreTier[] = ["rare", "epic", "legendary"];
  const countByTier: Record<RarityScoreTier, number> = {
    rare: counts.rareCount ?? 0,
    epic: counts.epicCount ?? 0,
    legendary: counts.legendaryCount ?? 0,
  };

  const lines: RarityScoreLine[] = [];
  let total = 0;
  for (const tier of order) {
    const count = countByTier[tier];
    const weight = RARITY_SCORE_WEIGHTS[tier];
    const subtotal = count * weight;
    total += subtotal;
    if (count > 0) {
      lines.push({ tier, count, weight, subtotal });
    }
  }

  return { lines, total };
}
