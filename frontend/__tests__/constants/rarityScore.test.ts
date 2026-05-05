import {
  computeRarityScore,
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
