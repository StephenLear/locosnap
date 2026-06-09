// Locale-aware display of AI-returned train class names.
//
// The class string is *data* from the vision/specs layer (e.g. "BR 218",
// "DB Class 218", "Class 37", "Newag Dragon"), not a static UI label — so it
// can't be a plain i18n key. German users expect "Baureihe 218", not the
// English "Class"/"BR" abbreviation (flagged by Timmi on the BR 218 ad,
// 2026-06-07: "es ist keine 'Class' sondern ne Baureihe").
//
// This is DELIBERATELY CONSERVATIVE and DE-only:
//   - "BR 218" → "Baureihe 218"  (BR *is* the German Baureihe abbreviation;
//     UK classes are "Class 37" with no "BR" token, so this never touches them)
//   - "DB Class 218" → "DB Baureihe 218"  (the "DB" prefix proves it's German)
//   - "Class 37" (UK), "Newag Dragon" (PL), "ICE 3", "ÖBB 1116" → untouched
// Non-`de` locales return the name unchanged. (PL conventions are a later pass.)
export function localiseClassName(className: string, locale: string): string {
  if (!className || typeof className !== "string") return className;
  if (locale !== "de") return className;

  let c = className;
  // "BR 218" / "DB BR 218" → "...Baureihe 218". Only when followed by a digit,
  // so a stray "BR" word elsewhere can't be rewritten.
  c = c.replace(/\bBR(\s+\d)/g, "Baureihe$1");
  // English "DB Class 218" (if it slips past backend canonicalisation / from a
  // stale cache entry) → "DB Baureihe 218". The DB prefix guarantees German.
  c = c.replace(/\bDB Class\b/g, "DB Baureihe");
  return c;
}
