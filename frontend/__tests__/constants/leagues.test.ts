// ============================================================
// League tier constants — promotion / demotion math tests
// ============================================================

import {
  TIERS,
  BRONZE_TIER,
  VECTRON_TIER,
  getTier,
  promotionSlots,
  demotionSlots,
} from "../../constants/leagues";

describe("TIERS metadata", () => {
  it("has exactly 8 tiers", () => {
    expect(TIERS).toHaveLength(8);
  });

  it("tier indices are 1..8 in order", () => {
    expect(TIERS.map((t) => t.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("tiers 1-3 are free, tiers 4-8 are Pro-gated", () => {
    expect(TIERS.slice(0, 3).every((t) => !t.proGated)).toBe(true);
    expect(TIERS.slice(3).every((t) => t.proGated)).toBe(true);
  });

  it("Bronze is the floor and Vectron is the ceiling", () => {
    expect(BRONZE_TIER).toBe(1);
    expect(VECTRON_TIER).toBe(8);
  });
});

describe("getTier", () => {
  it("returns the matching tier", () => {
    expect(getTier(3).key).toBe("gold");
  });

  it("falls back to Bronze for an invalid index", () => {
    expect(getTier(99).key).toBe("bronze");
    expect(getTier(0).key).toBe("bronze");
  });
});

describe("promotionSlots", () => {
  it("returns 0 for Vectron (no further promotion)", () => {
    expect(promotionSlots(VECTRON_TIER, 100)).toBe(0);
  });

  it("returns 0 for an empty league", () => {
    expect(promotionSlots(3, 0)).toBe(0);
  });

  it("rounds 10% down with a minimum of 1", () => {
    expect(promotionSlots(3, 50)).toBe(5);
    expect(promotionSlots(3, 5)).toBe(1); // 10% of 5 = 0.5, min 1
    expect(promotionSlots(3, 1)).toBe(1); // 10% of 1 = 0.1, min 1
  });
});

describe("demotionSlots", () => {
  it("returns 0 for Bronze (the floor)", () => {
    expect(demotionSlots(BRONZE_TIER, 100)).toBe(0);
  });

  it("returns 0 for an empty league", () => {
    expect(demotionSlots(3, 0)).toBe(0);
  });

  it("rounds 10% down with a minimum of 1", () => {
    expect(demotionSlots(5, 50)).toBe(5);
    expect(demotionSlots(5, 3)).toBe(1);
  });
});
