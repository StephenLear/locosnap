import {
  computeRarityScore,
  buildRarityScoreBreakdown,
  RARITY_SCORE_WEIGHTS,
} from "../../constants/rarityScore";

describe("computeRarityScore", () => {
  it("returns 0 for an empty collection", () => {
    expect(computeRarityScore({})).toBe(0);
  });

  it("weights legendary (15) > epic (8) > rare (5) > uncommon (2) > common (0)", () => {
    expect(RARITY_SCORE_WEIGHTS.legendary).toBeGreaterThan(
      RARITY_SCORE_WEIGHTS.epic
    );
    expect(RARITY_SCORE_WEIGHTS.epic).toBeGreaterThan(RARITY_SCORE_WEIGHTS.rare);
    expect(RARITY_SCORE_WEIGHTS.rare).toBeGreaterThan(
      RARITY_SCORE_WEIGHTS.uncommon
    );
    expect(RARITY_SCORE_WEIGHTS.common).toBe(0);
  });

  it("computes 1 legendary + 2 epic = 31", () => {
    expect(
      computeRarityScore({ legendaryCount: 1, epicCount: 2 })
    ).toBe(15 + 16);
  });

  it("treats missing counts as zero", () => {
    expect(computeRarityScore({ rareCount: 4 })).toBe(20);
  });
});

describe("buildRarityScoreBreakdown", () => {
  it("decomposes a score and the total matches computeRarityScore", () => {
    const counts = { rareCount: 6, epicCount: 3, legendaryCount: 2 };
    const result = buildRarityScoreBreakdown(counts);
    // 6×5 + 3×8 + 2×15 = 30 + 24 + 30 = 84
    expect(result.total).toBe(84);
    expect(result.total).toBe(computeRarityScore(counts));
    expect(result.lines).toEqual([
      { tier: "rare", count: 6, weight: 5, subtotal: 30 },
      { tier: "epic", count: 3, weight: 8, subtotal: 24 },
      { tier: "legendary", count: 2, weight: 15, subtotal: 30 },
    ]);
  });

  it("omits tiers with zero count from the lines but keeps the total correct", () => {
    const result = buildRarityScoreBreakdown({ legendaryCount: 1 });
    expect(result.total).toBe(15);
    expect(result.lines).toEqual([
      { tier: "legendary", count: 1, weight: 15, subtotal: 15 },
    ]);
  });

  it("returns an empty breakdown for no rare-or-above finds", () => {
    expect(buildRarityScoreBreakdown({})).toEqual({ lines: [], total: 0 });
    // uncommon/common never contribute to the leaderboard score
    expect(buildRarityScoreBreakdown({ uncommonCount: 99 })).toEqual({
      lines: [],
      total: 0,
    });
  });
});
