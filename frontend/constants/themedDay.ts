// ============================================================
// LocoSnap — Themed day resolver (Phase 2 G.2)
//
// Pure helper extracted so the unit test doesn't pull in RN.
// Mirrors backend/src/services/leagues.ts THEMED_DAYS.
// ============================================================

export type ThemedDay =
  | { kind: "rare_tier"; multiplier: 2 }
  | { kind: "heritage"; multiplier: 1.5 }
  | null;

/**
 * Returns today's themed day (UTC weekday).
 *
 * - Tuesday (UTC 2): Rare-Tier-Tuesday → 2× XP for rare/epic/legendary
 * - Saturday (UTC 6): Heritage-Saturday → 1.5× XP, deferred to v1.0.27
 *   (banner stays hidden until country-match logic ships)
 */
export function todaysThemedDay(now: Date = new Date()): ThemedDay {
  const day = now.getUTCDay();
  if (day === 2) return { kind: "rare_tier", multiplier: 2 };
  return null;
}
