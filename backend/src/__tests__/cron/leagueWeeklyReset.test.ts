// ============================================================
// Weekly League Reset — pure-helper tests (Phase 2 cron)
//
// DB-touching orchestrator (runLeagueWeeklyReset) is covered by an
// integration test in routes/admin.test.ts via the manual-replay
// endpoint after migration 013 is applied. The pure helpers below
// are the algorithmic core — exhaustively testable without a DB.
// ============================================================

import {
  computeTierMoves,
  decideFreezeAward,
  computeGhostMove,
  shouldAwardPromotionBoost,
  nextWeekBoundaries,
  BRONZE_TIER,
  VECTRON_TIER,
  PRO_FREEZE_CAP,
  FREE_FREEZE_CAP,
  FREE_FREEZE_STREAK_THRESHOLD,
  FLAT_100_BOOST_CAP,
  GHOST_INACTIVITY_THRESHOLD,
  type LeagueMember,
} from "../../cron/leagueWeeklyReset";

// Helper: build a fixture league of N members with deterministic XP.
function buildLeague(size: number, xpFn: (i: number) => number): LeagueMember[] {
  const baseTime = Date.UTC(2026, 4, 4, 12, 0, 0);
  return Array.from({ length: size }, (_, i) => ({
    userId: `user_${String(i).padStart(3, "0")}`,
    weeklyXp: xpFn(i),
    updatedAt: baseTime + i * 1000,
  }));
}

describe("computeTierMoves", () => {
  it("returns empty array for an empty league", () => {
    expect(computeTierMoves(3, [])).toEqual([]);
  });

  it("promotes top 10% and demotes bottom 10% in a 50-user Silver league", () => {
    const members = buildLeague(50, (i) => 100 - i); // descending XP
    const moves = computeTierMoves(3, members);

    const promoted = moves.filter((m) => m.action === "promote");
    const demoted = moves.filter((m) => m.action === "demote");
    const stays = moves.filter((m) => m.action === "stay");

    expect(promoted).toHaveLength(5);
    expect(demoted).toHaveLength(5);
    expect(stays).toHaveLength(40);
    expect(promoted.every((m) => m.toTier === 4)).toBe(true);
    expect(demoted.every((m) => m.toTier === 2)).toBe(true);
  });

  it("enforces minimum 1 promotion + 1 demotion in a 5-user league (10% would round to 0)", () => {
    const members = buildLeague(5, (i) => 100 - i * 10);
    const moves = computeTierMoves(3, members);
    expect(moves.filter((m) => m.action === "promote")).toHaveLength(1);
    expect(moves.filter((m) => m.action === "demote")).toHaveLength(1);
  });

  it("Bronze league never demotes (floor)", () => {
    const members = buildLeague(50, (i) => 100 - i);
    const moves = computeTierMoves(BRONZE_TIER, members);
    expect(moves.filter((m) => m.action === "demote")).toHaveLength(0);
    expect(moves.filter((m) => m.action === "promote")).toHaveLength(5);
  });

  it("Vectron league never promotes (ceiling)", () => {
    const members = buildLeague(50, (i) => 100 - i);
    const moves = computeTierMoves(VECTRON_TIER, members);
    expect(moves.filter((m) => m.action === "promote")).toHaveLength(0);
    expect(moves.filter((m) => m.action === "demote")).toHaveLength(5);
  });

  it("ranks ties by updatedAt ascending (earlier wins)", () => {
    const members: LeagueMember[] = [
      { userId: "late", weeklyXp: 100, updatedAt: 2000 },
      { userId: "early", weeklyXp: 100, updatedAt: 1000 },
      { userId: "loser", weeklyXp: 50, updatedAt: 500 },
    ];
    const moves = computeTierMoves(3, members);
    const promoted = moves.find((m) => m.action === "promote");
    expect(promoted?.userId).toBe("early");
  });

  it("does not promote a user with zero XP even if they're top of an empty league", () => {
    const members = buildLeague(10, () => 0);
    const moves = computeTierMoves(3, members);
    expect(moves.filter((m) => m.action === "promote")).toHaveLength(0);
    // Bottom 10% (1 user) still demotes — inactive users are bottom-rankable.
    expect(moves.filter((m) => m.action === "demote")).toHaveLength(1);
  });

  it("does not place the same user in both promote and demote (1-user league guard)", () => {
    const members = buildLeague(1, () => 100);
    const moves = computeTierMoves(3, members);
    // Top 1 (min) wants to promote; bottom 1 (min) wants to demote — must not collide.
    const promoted = moves.filter((m) => m.action === "promote");
    const demoted = moves.filter((m) => m.action === "demote");
    expect(promoted.length + demoted.length).toBe(1);
    expect(promoted).toHaveLength(1); // promotion wins
  });

  it("handles a 10-user league correctly: top 1 promotes, bottom 1 demotes", () => {
    const members = buildLeague(10, (i) => 100 - i * 10);
    const moves = computeTierMoves(3, members);
    expect(moves.filter((m) => m.action === "promote")).toHaveLength(1);
    expect(moves.filter((m) => m.action === "demote")).toHaveLength(1);
    expect(moves.filter((m) => m.action === "stay")).toHaveLength(8);
  });
});

describe("decideFreezeAward", () => {
  it("Pro user below cap gets +1 freeze every week", () => {
    const result = decideFreezeAward({
      isPro: true,
      freezesAvailable: 1,
      consecutiveActiveWeeks: 0,
      scannedThisWeek: false,
    });
    expect(result.delta).toBe(1);
    expect(result.resetActiveStreak).toBe(false);
  });

  it("Pro user at cap gets no freeze", () => {
    const result = decideFreezeAward({
      isPro: true,
      freezesAvailable: PRO_FREEZE_CAP,
      consecutiveActiveWeeks: 0,
      scannedThisWeek: true,
    });
    expect(result.delta).toBe(0);
  });

  it("Free user with < threshold active weeks gets nothing", () => {
    const result = decideFreezeAward({
      isPro: false,
      freezesAvailable: 0,
      consecutiveActiveWeeks: 3,
      scannedThisWeek: true,
    });
    expect(result.delta).toBe(0);
    expect(result.resetActiveStreak).toBe(false);
  });

  it("Free user hitting threshold gets +1 freeze and resets the streak", () => {
    const result = decideFreezeAward({
      isPro: false,
      freezesAvailable: 0,
      consecutiveActiveWeeks: FREE_FREEZE_STREAK_THRESHOLD,
      scannedThisWeek: true,
    });
    expect(result.delta).toBe(1);
    expect(result.resetActiveStreak).toBe(true);
  });

  it("Free user at cap with hit threshold still resets streak (so we don't infinite-trigger)", () => {
    const result = decideFreezeAward({
      isPro: false,
      freezesAvailable: FREE_FREEZE_CAP,
      consecutiveActiveWeeks: FREE_FREEZE_STREAK_THRESHOLD,
      scannedThisWeek: true,
    });
    expect(result.delta).toBe(0);
    expect(result.resetActiveStreak).toBe(true);
  });
});

describe("computeGhostMove", () => {
  it("active user resets inactive counter, no tier drop", () => {
    const result = computeGhostMove({
      consecutiveInactiveWeeks: 2,
      freezesAvailable: 0,
      currentTier: 3,
      scannedThisWeek: true,
    });
    expect(result.newInactiveCount).toBe(0);
    expect(result.tierDrop).toBe(0);
    expect(result.freezeDelta).toBe(0);
  });

  it("inactive user with a freeze burns 1 freeze and stays put", () => {
    const result = computeGhostMove({
      consecutiveInactiveWeeks: 3,
      freezesAvailable: 1,
      currentTier: 3,
      scannedThisWeek: false,
    });
    expect(result.freezeDelta).toBe(-1);
    expect(result.newInactiveCount).toBe(0);
    expect(result.tierDrop).toBe(0);
  });

  it("inactive user without freeze, counter < 4, increments counter", () => {
    const result = computeGhostMove({
      consecutiveInactiveWeeks: 1,
      freezesAvailable: 0,
      currentTier: 3,
      scannedThisWeek: false,
    });
    expect(result.newInactiveCount).toBe(2);
    expect(result.tierDrop).toBe(0);
    expect(result.freezeDelta).toBe(0);
  });

  it("inactive user hitting 4-week threshold drops one tier and resets counter", () => {
    const result = computeGhostMove({
      consecutiveInactiveWeeks: GHOST_INACTIVITY_THRESHOLD - 1,
      freezesAvailable: 0,
      currentTier: 3,
      scannedThisWeek: false,
    });
    expect(result.newInactiveCount).toBe(0);
    expect(result.tierDrop).toBe(1);
  });

  it("Bronze user hitting 4-week threshold does NOT drop tier (floor)", () => {
    const result = computeGhostMove({
      consecutiveInactiveWeeks: GHOST_INACTIVITY_THRESHOLD - 1,
      freezesAvailable: 0,
      currentTier: BRONZE_TIER,
      scannedThisWeek: false,
    });
    expect(result.tierDrop).toBe(0);
    expect(result.newInactiveCount).toBe(0);
  });
});

describe("shouldAwardPromotionBoost", () => {
  it("awards when user has 0 active flat_100 cards", () => {
    expect(shouldAwardPromotionBoost(0)).toBe(true);
  });

  it("awards when user has fewer than the cap", () => {
    expect(shouldAwardPromotionBoost(FLAT_100_BOOST_CAP - 1)).toBe(true);
  });

  it("does not award at the cap", () => {
    expect(shouldAwardPromotionBoost(FLAT_100_BOOST_CAP)).toBe(false);
  });
});

describe("nextWeekBoundaries", () => {
  it("returns Monday + 7 days as next start", () => {
    const monday = new Date(Date.UTC(2026, 4, 4, 0, 0, 0));
    const { nextStart, nextEnd } = nextWeekBoundaries(monday);
    expect(nextStart.toISOString()).toBe("2026-05-11T00:00:00.000Z");
    expect(nextEnd.toISOString()).toBe("2026-05-17T23:59:59.000Z");
  });
});
