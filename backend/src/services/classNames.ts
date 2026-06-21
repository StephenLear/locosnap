// Canonical train-class naming.
//
// Vision (Claude / GPT-4o) emits the SAME physical class under several string
// forms — "BR 232" vs "DB BR 232", "Baureihe 628" vs "DB Class 628" vs "BR 628".
// Each variant becomes a different cache key in trainCache.getCacheKey()
// (`language::class::operator`), which (a) fragments the 30-day Redis trains
// cache — the same train re-runs the full 4-call AI pipeline under each label,
// wasting spend — and (b) produces inconsistent rarity for the same train (a
// fresh, cache-missed, separately-generated rarity each time a new label
// appears). Reported 2026-06-01 by tester Leon (same train scanned 3x →
// Rare/Rare/Uncommon) and corroborated by the 2026-06-01 scan-distribution
// audit (BR 101 vs DB BR 101, BR 232 vs DB BR 232, DB Class 628 vs BR 628, ...).
//
// canonicaliseClass() collapses these to ONE canonical form BEFORE the class is
// used for caching / specs / facts / rarity / display. It is deliberately
// CONSERVATIVE: it only rewrites unambiguous German-designation variants and
// never touches a label whose meaning could change — UK "Class 66", "ICE 3",
// "ÖBB 1116", Polish "EP07" are all left exactly as-is.

// Exact-match overrides for cross-designation synonyms the general rules below
// cannot derive (e.g. an East-German renumbering). Keyed by the lowercased,
// whitespace-collapsed raw class; value is the canonical display form. Add an
// entry ONLY when the two strings are provably the SAME physical class. Extend
// as new fragmentation is observed in the scan-distribution audit.
const EXPLICIT_ALIASES: Record<string, string> = {
  "dr br 132": "BR 232", // DR 132 was renumbered to DB 232 "Ludmilla" post-1992
  // "ST22" is NOT a real PKP class — it is a non-existent designation that
  // vision hallucinates for the ET22 (a #ST22 SEO-hashtag / OCR misread of the
  // "ET22-xxx" fleet stencil). Without this rewrite, the raw string "ST22"
  // misses every et22-keyed specs/rarity/facts override and free-hallucinates
  // as a LEGENDARY Newag 6,400 kW / 140 km/h loco (flagged 2026-06-21 on an
  // ET22-680 PKP Cargo scan). Canonicalising to ET22 makes the class name,
  // specs (Pafawag / 3,000 kW / 125 km/h / 1,184 built), rarity (common) and
  // the verified-facts block all resolve to the real Pafawag workhorse.
  "st22": "ET22",
  "st 22": "ET22",
  "st-22": "ET22",
  "pkp st22": "ET22",
};

/**
 * Collapse equivalent spellings of a German train class to one canonical form.
 * Idempotent. Non-German / non-Baureihe labels are returned unchanged.
 */
export function canonicaliseClass(raw: string): string {
  if (!raw || typeof raw !== "string") return raw;

  let c = raw.trim().replace(/\s+/g, " ");
  if (!c) return raw;

  // 1. Explicit cross-designation override (checked on the cleaned, lowercased form).
  const explicit = EXPLICIT_ALIASES[c.toLowerCase()];
  if (explicit) return explicit;

  // 2. "Baureihe" (German full word) → "BR" (abbreviation).
  c = c.replace(/\bBaureihe\b/gi, "BR");

  // 3. Strip a leading "DB " operator prefix before a German class designator,
  //    canonicalising the designator to "BR". Merges "DB BR 232" / "DB Class 232"
  //    with bare "BR 232". ONLY the "DB" prefix is stripped — other railway
  //    prefixes (DR, ÖBB, NS, PKP, ČD, SBB, VR) denote genuinely distinct
  //    operators/eras and are preserved.
  const dbPrefixed = c.match(/^DB\s+(?:BR|Class)\s+(.+)$/i);
  if (dbPrefixed) c = `BR ${dbPrefixed[1]}`;

  // 4. Normalise the leading "BR" token's casing (e.g. "br 232" → "BR 232")
  //    without disturbing the rest of the label.
  c = c.replace(/^br(\s+)/i, "BR$1");

  return c;
}
