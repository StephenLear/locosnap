// Canonical train-operator naming.
//
// Vision (Claude / GPT-4o) emits the SAME operator under several string forms —
// "DB Fernverkehr" vs "Deutsche Bahn (DB Fernverkehr)" vs "DB Fernverkehr AG".
// Because the cache key is `language::class::operator` (trainCache.getCacheKey),
// each spelling becomes a separate cache entry — the same train re-runs the full
// 4-call AI pipeline under each label (wasted spend) and shows up as a separate
// collection / leaderboard entry. Surfaced by the 2026-06-05 top-user spot audit
// (BR 412 stored as "DB Fernverkehr" / "DB (Deutsche Bahn)" / "Deutsche Bahn
// (DB Fernverkehr)"; same fragmentation on BR 403 / 182 / 185 / 103).
//
// canonicaliseOperator() collapses these to ONE canonical form BEFORE the
// operator is used for caching / display. It is DELIBERATELY CONSERVATIVE and
// matches ONLY exact (whitespace-normalised, lowercased) strings that provably
// denote the SAME operator. Two non-negotiable safety rules:
//
//   1. NEVER merge DB Cargo / DB Fernverkehr / DB Regio. They are distinct
//      operators; collapsing them would corrupt the collection + leaderboard
//      worse than the spelling clutter does.
//   2. The ambiguous bare strings "DB (Deutsche Bahn)" and "Deutsche Bahn"
//      are LEFT UNTOUCHED — they could mean any DB arm, so we cannot safely
//      assign them to one. (The real fix for those is to push the vision prompt
//      to always emit the specific arm; tracked separately.)
//
// Because it is exact-match only (no fuzzy/substring rules), it cannot
// accidentally rewrite an operator it was never taught. Extend the map as new
// fragmentation is observed in the scan-distribution audit.

// Keyed by the lowercased, whitespace-collapsed raw operator; value is the
// canonical display form. Add an entry ONLY when the key provably denotes the
// SAME operator as the value.
const OPERATOR_ALIASES: Record<string, string> = {
  // — DB Fernverkehr (long-distance / IC / ICE) —
  "db fernverkehr ag": "DB Fernverkehr",
  "deutsche bahn (db fernverkehr)": "DB Fernverkehr",
  "db fernverkehr (deutsche bahn)": "DB Fernverkehr",

  // — DB Cargo (freight) — includes its former trading names (same legal entity) —
  "db cargo ag": "DB Cargo",
  "deutsche bahn (db cargo)": "DB Cargo",
  "db cargo (deutsche bahn)": "DB Cargo",
  "db schenker rail": "DB Cargo",
  "railion": "DB Cargo",

  // — DB Regio (regional) —
  "db regio ag": "DB Regio",
  "deutsche bahn (db regio)": "DB Regio",
  "db regio (deutsche bahn)": "DB Regio",
};

/**
 * Collapse equivalent spellings of the same train operator to one canonical
 * form. Idempotent. Unknown / ambiguous operator strings are returned unchanged.
 */
export function canonicaliseOperator(raw: string): string {
  if (!raw || typeof raw !== "string") return raw;

  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return raw;

  const canonical = OPERATOR_ALIASES[cleaned.toLowerCase()];
  return canonical ?? cleaned;
}
