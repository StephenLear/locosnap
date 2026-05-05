// ============================================================
// League XP service — pure-helper tests (Phase 2)
//
// DB-touching wrappers (computeWeeklyXp, persistXpEvent) are
// covered by integration tests in routes/identify.test.ts after
// migration 013 is applied. The pure helpers below are the
// algorithmic core — small, deterministic, exhaustively testable
// without a DB mock.
// ============================================================

import {
  weekStartUtc,
  resolveBaseXp,
  rarityThemedMultiplier,
  isVerifiedForXp,
  computeFinalXp,
  BASE_XP_BY_RARITY,
  REPEAT_SCAN_MULTIPLIER,
  RARE_TIER_THEMED_MULTIPLIER,
  THEMED_DAYS,
} from "../../services/leagues";

describe("leagues — pure helpers", () => {
  describe("weekStartUtc", () => {
    it("returns the Monday that begins the ISO week for a Wednesday", () => {
      // Wednesday 2026-04-22 12:34:56 UTC → Monday 2026-04-20 00:00 UTC
      const wednesday = new Date(Date.UTC(2026, 3, 22, 12, 34, 56));
      const result = weekStartUtc(wednesday);
      expect(result.toISOString()).toBe("2026-04-20T00:00:00.000Z");
    });

    it("returns the same Monday for a Sunday late at night", () => {
      // Sunday 2026-04-26 23:59 UTC → Monday 2026-04-20 (still in same ISO week)
      const sunday = new Date(Date.UTC(2026, 3, 26, 23, 59, 0));
      expect(weekStartUtc(sunday).toISOString()).toBe("2026-04-20T00:00:00.000Z");
    });

    it("returns the Monday for the Monday itself", () => {
      const monday = new Date(Date.UTC(2026, 3, 20, 8, 0, 0));
      expect(weekStartUtc(monday).toISOString()).toBe("2026-04-20T00:00:00.000Z");
    });

    it("rolls over correctly across a month boundary", () => {
      // Friday 2026-05-01 → Monday 2026-04-27
      const friday = new Date(Date.UTC(2026, 4, 1, 9, 0, 0));
      expect(weekStartUtc(friday).toISOString()).toBe("2026-04-27T00:00:00.000Z");
    });
  });

  describe("resolveBaseXp", () => {
    it("returns the rarity-tier base XP when no override is given", () => {
      expect(resolveBaseXp("common")).toBe(BASE_XP_BY_RARITY.common);
      expect(resolveBaseXp("rare")).toBe(BASE_XP_BY_RARITY.rare);
      expect(resolveBaseXp("legendary")).toBe(BASE_XP_BY_RARITY.legendary);
    });

    it("respects an explicit override", () => {
      expect(resolveBaseXp("common", 999)).toBe(999);
    });

    it("ignores a negative override and falls back to the table", () => {
      expect(resolveBaseXp("rare", -5)).toBe(BASE_XP_BY_RARITY.rare);
    });
  });

  describe("isVerifiedForXp", () => {
    it("returns true for verified-live", () => {
      expect(isVerifiedForXp("verified-live")).toBe(true);
    });
    it("returns true for verified-recent-gallery", () => {
      expect(isVerifiedForXp("verified-recent-gallery")).toBe(true);
    });
    it("returns false for personal", () => {
      expect(isVerifiedForXp("personal")).toBe(false);
    });
    it("returns false for unverified", () => {
      expect(isVerifiedForXp("unverified")).toBe(false);
    });
  });

  describe("rarityThemedMultiplier", () => {
    // Tuesday 2026-04-21 (UTC weekday 2)
    const tuesday = new Date(Date.UTC(2026, 3, 21, 10, 0, 0));
    // Wednesday 2026-04-22 (UTC weekday 3)
    const wednesday = new Date(Date.UTC(2026, 3, 22, 10, 0, 0));

    it("doubles XP on Tuesday for rare scans", () => {
      expect(rarityThemedMultiplier(tuesday, "rare")).toBe(RARE_TIER_THEMED_MULTIPLIER);
      expect(THEMED_DAYS.rareTier).toBe(2); // sanity-check the constant
    });

    it("doubles XP on Tuesday for epic scans", () => {
      expect(rarityThemedMultiplier(tuesday, "epic")).toBe(RARE_TIER_THEMED_MULTIPLIER);
    });

    it("doubles XP on Tuesday for legendary scans", () => {
      expect(rarityThemedMultiplier(tuesday, "legendary")).toBe(RARE_TIER_THEMED_MULTIPLIER);
    });

    it("does NOT double XP on Tuesday for common scans", () => {
      expect(rarityThemedMultiplier(tuesday, "common")).toBe(1.0);
    });

    it("does NOT double XP on Tuesday for uncommon scans", () => {
      expect(rarityThemedMultiplier(tuesday, "uncommon")).toBe(1.0);
    });

    it("does NOT apply the rare-tier bonus on Wednesday for any rarity", () => {
      expect(rarityThemedMultiplier(wednesday, "rare")).toBe(1.0);
      expect(rarityThemedMultiplier(wednesday, "legendary")).toBe(1.0);
    });
  });

  describe("computeFinalXp", () => {
    it("returns full base XP on first scan of a class with no themed bonus", () => {
      const r = computeFinalXp({ baseXp: 50, hasPriorThisWeek: false, themedMultiplier: 1.0 });
      expect(r.diminishedXp).toBe(50);
      expect(r.finalXp).toBe(50);
    });

    it("applies the diminishing-returns multiplier on a repeat scan", () => {
      const r = computeFinalXp({ baseXp: 100, hasPriorThisWeek: true, themedMultiplier: 1.0 });
      expect(r.diminishedXp).toBe(Math.floor(100 * REPEAT_SCAN_MULTIPLIER));
      expect(r.finalXp).toBe(Math.floor(100 * REPEAT_SCAN_MULTIPLIER));
    });

    it("applies the themed multiplier to a first scan", () => {
      const r = computeFinalXp({ baseXp: 50, hasPriorThisWeek: false, themedMultiplier: 2.0 });
      expect(r.finalXp).toBe(100);
    });

    it("composes diminishing-returns then themed multiplier (order matters)", () => {
      // baseXp=100, repeat → 25, themed 2× → 50
      const r = computeFinalXp({ baseXp: 100, hasPriorThisWeek: true, themedMultiplier: 2.0 });
      expect(r.diminishedXp).toBe(25);
      expect(r.finalXp).toBe(50);
    });

    it("floors fractional results so XP is always an integer", () => {
      // 25 base, repeat → 6 (Math.floor(25 * 0.25) = 6), themed 1.5× → 9
      const r = computeFinalXp({ baseXp: 25, hasPriorThisWeek: true, themedMultiplier: 1.5 });
      expect(r.diminishedXp).toBe(6);
      expect(r.finalXp).toBe(9);
    });
  });
});
