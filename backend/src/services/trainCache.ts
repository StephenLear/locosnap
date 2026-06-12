// ============================================================
// LocoSnap — Train Data Cache
// Caches specs, facts, rarity, AND blueprints for known classes
// Eliminates 3 AI calls + 1 image gen per repeat scan
//
// First scan of a class:  ~$0.031 (vision + specs + facts + rarity)
// Repeat scans (cached):  ~$0.005 (vision only)
// Saving per cached scan: ~$0.026 (84% reduction)
//
// Strategy:
//   L1 — in-memory Map  (fast, resets on restart)
//   L2 — Redis/Upstash  (persistent across deploys and restarts)
//        Falls back to in-memory if Redis unavailable (local dev)
//
// Key: normalised "class::operator" (e.g. "class 390::avanti west coast")
// ============================================================

import {
  TrainIdentification,
  TrainSpecs,
  TrainFacts,
  RarityInfo,
  BlueprintStyle,
} from "../types";
import { getTrainCache, setTrainCache } from "./redis";

// ── Types ───────────────────────────────────────────────────

interface CachedTrainData {
  specs: TrainSpecs;
  facts: TrainFacts;
  rarity: RarityInfo;
  blueprintUrl: string | null; // legacy: default "technical" style
  blueprintUrls?: Record<string, string>; // style-keyed blueprint URLs
  cachedAt: string; // ISO timestamp
  hitCount: number;
}

interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: string;
  estimatedSavings: string;
  entriesWithBlueprints: number;
}

// ── Constants ───────────────────────────────────────────────

const CACHE_TTL_DAYS = 30;

// Cost saved per cached scan (specs + facts + rarity) in USD
const COST_PER_CACHED_HIT = 0.026;

// ── L1 In-memory cache ──────────────────────────────────────
// Fast lookup within a single server session.
// Populated from Redis on first access of each key.

const memoryCache = new Map<string, CachedTrainData>();
let totalHits = 0;
let totalMisses = 0;

// ── Helpers ─────────────────────────────────────────────────

// Per-class cache invalidation.
//
// Replaces the previous global CACHE_VERSION bump pattern (v8 → v12 over
// 7 days in May 2026, where each bump wiped the entire 30-day Redis cache
// and forced every subsequent scan back through the full 4-call AI pipeline
// for ~24-48h until the cache rebuilt — the single biggest unforced cost
// leak in the May 2026 audit).
//
// New rule: when a fix ships that invalidates one class's specs/facts/rarity,
// add ONE entry to CLASS_INVALIDATIONS keyed by the normalised class name
// (lowercased, trimmed — matches getCacheKey()). Cache entries for THAT
// class cached before the timestamp are treated as misses; every other
// class's cache survives.
//
// Historic v8-v12 bumps are NOT backfilled here. The key format has changed
// (no version prefix), so all previously-cached v12::* keys become orphans
// in Redis and TTL out naturally over 30 days. The cache rebuilds organically
// from the next scan of each class, exactly as if a single final bump had
// happened — but it's the LAST one.
//
// Going forward, instead of bumping a version, add one line like:
//   "class 222": "2026-05-22T10:00:00Z",
// Exported so tests can populate entries; production code only reads.
export const CLASS_INVALIDATIONS: Record<string, string> = {
  // Add entries here when a class's cached specs/facts/rarity must be
  // invalidated due to a backend correction. Key is normalised class name.
  // BR 159 (Stadler EuroDual): added a verified length (23.0 m) to the
  // KNOWN_SPECS override 2026-06-04 (was null — flagged by Captrain BR 159
  // driver-in-training Damian). Invalidate pre-fix cached entries so the
  // length now renders. All KNOWN_SPECS key variants covered.
  // Timestamps bumped 2026-06-05T23:59:00Z so the rarity anchor (BR 159 -> rare)
  // refreshes alongside the original 2026-06-04 length fix (23.0 m).
  "159": "2026-06-05T23:59:00Z",
  "br 159": "2026-06-05T23:59:00Z",
  "br159": "2026-06-05T23:59:00Z",
  "class 159": "2026-06-05T23:59:00Z",
  "baureihe 159": "2026-06-05T23:59:00Z",
  "eurodual": "2026-06-05T23:59:00Z",
  "stadler eurodual": "2026-06-05T23:59:00Z",
  // BR 140 / E 40: added a trainFacts.ts lock 2026-06-08 — the facts prose had
  // NO BR 140 bullet and hallucinated the loco onto the Pressnitztalbahn 750 mm
  // narrow-gauge heritage line (contradicting its own standard-gauge spec card).
  // Structured KNOWN_SPECS were already correct; this invalidates pre-fix cached
  // facts so the corrected mainline-freight narrative renders.
  "140": "2026-06-08T23:59:00Z",
  "br 140": "2026-06-08T23:59:00Z",
  "br140": "2026-06-08T23:59:00Z",
  "class 140": "2026-06-08T23:59:00Z",
  "db class 140": "2026-06-08T23:59:00Z",
  "baureihe 140": "2026-06-08T23:59:00Z",
  "e 40": "2026-06-08T23:59:00Z",
  "e40": "2026-06-08T23:59:00Z",
  // ÖBB 4020: builder was returning "Bombardier" + facts text claimed
  // "Siemens entwickelt und gebaut, 2009 in Betrieb". Correct: SGP / ELIN /
  // Siemens consortium, in-service 1978. Caught 2026-05-23 by a DACH commenter
  // on the v1.0.34 launch ad. Timestamp bumped + extra variants added 2026-05-24
  // after the same commenter posted "Immer noch falsch" — the previous map
  // missed the "öbb baureihe 4020" / "reihe 4020" / "öbb reihe 4020" / "class
  // 4020" class-string variants that Vision can return, so pre-fix Redis
  // entries keyed under those variants were still being served stale.
  "öbb 4020": "2026-05-24T07:50:00Z",
  "obb 4020": "2026-05-24T07:50:00Z",
  "4020": "2026-05-24T07:50:00Z",
  "baureihe 4020": "2026-05-24T07:50:00Z",
  "öbb baureihe 4020": "2026-05-24T07:50:00Z",
  "obb baureihe 4020": "2026-05-24T07:50:00Z",
  "reihe 4020": "2026-05-24T07:50:00Z",
  "öbb reihe 4020": "2026-05-24T07:50:00Z",
  "obb reihe 4020": "2026-05-24T07:50:00Z",
  "class 4020": "2026-05-24T07:50:00Z",
  // VR Sr1: facts-layer was hallucinating "groundbreaking 1920s Bo-Bo" and
  // "entering service in the 1920s" — actual entry year is 1973 (Finland did
  // not electrify its mainlines until 1969) and wheel arrangement is Co'Co',
  // not Bo-Bo. Specs panel from KNOWN_SPECS was correct (160 km/h, 3,100 kW,
  // 84t, Novocherkassk + Strömberg), facts prose was free-form because
  // trainFacts.ts had no Sr1 bullet. Wholesale Sr1 facts-layer lock added the
  // same session. Variant coverage per the 2026-05-24 checklist — every
  // KNOWN_SPECS lookup key + English variant + common spacing/hyphenation
  // forms. Caught 2026-05-24 by Finnish TikTok commenter "Deevee".
  "sr1": "2026-05-24T11:00:00Z",
  "vr sr1": "2026-05-24T11:00:00Z",
  "sr 1": "2026-05-24T11:00:00Z",
  "vr sr 1": "2026-05-24T11:00:00Z",
  "sr-1": "2026-05-24T11:00:00Z",
  "vr sr-1": "2026-05-24T11:00:00Z",
  "class sr1": "2026-05-24T11:00:00Z",
  // DB BR 114: facts-layer claimed "viersystemige Elektrolokomotive" + NRW/Lower-
  // Saxony routing + "Krauss-Maffei / Henschel / Krupp" builder — three independent
  // fabrications. Reality: single-system 15 kV 16.7 Hz AC, eastern Germany only,
  // LEW Hennigsdorf / Adtranz / Bombardier builder. Wholesale KNOWN_SPECS expansion
  // (was maxSpeed-only) + new trainFacts bullet hard-locking all three claims.
  // Variant coverage per the 2026-05-24 checklist — every KNOWN_SPECS lookup key.
  // Caught 2026-05-24 evening by DE launch ad commenter J●|\|.
  "114": "2026-05-24T22:30:00Z",
  "br 114": "2026-05-24T22:30:00Z",
  "baureihe 114": "2026-05-24T22:30:00Z",
  "db baureihe 114": "2026-05-24T22:30:00Z",
  "db br 114": "2026-05-24T22:30:00Z",
  "class 114": "2026-05-24T22:30:00Z",
  "db class 114": "2026-05-24T22:30:00Z",
  // DB BR 628: facts-layer misidentified the entire family — claimed "Baureihe LINT 41
  // von Alstom" from "frühen 2000er Jahre". Reality: NOT LINT (LINT 41 = BR 640/648,
  // completely different 1999+ Alstom design); BR 628 is a MaK / Vossloh Kiel 1974
  // prototype / 1986+ series diesel multiple unit, ~309 sets across 628.0/.2/.4. New
  // KNOWN_SPECS block + new trainFacts bullet forbidding Alstom / LINT attribution and
  // any post-2000 era framing. Variant coverage per the 2026-05-24 checklist.
  // Caught 2026-05-24 evening by DE launch ad commenter J●|\|.
  "628": "2026-05-24T22:30:00Z",
  "br 628": "2026-05-24T22:30:00Z",
  "baureihe 628": "2026-05-24T22:30:00Z",
  "db baureihe 628": "2026-05-24T22:30:00Z",
  "db br 628": "2026-05-24T22:30:00Z",
  "class 628": "2026-05-24T22:30:00Z",
  "db class 628": "2026-05-24T22:30:00Z",
  "628.2": "2026-05-24T22:30:00Z",
  "628.4": "2026-05-24T22:30:00Z",
  // EN57AKM: the AI returned vmax 160 km/h (no KNOWN_SPECS key existed). First
  // fix locked 110 (EN57 family default) — but Vampigator (PL ad) corrected that:
  // the AKM is the deep-mod variant uprated to 120 km/h (asynchronous motors).
  // Verified + KNOWN_SPECS bumped 110 -> 120 same day. Timestamp set to end-of-day
  // so BOTH the original 160 cache AND any 110 entry cached between the two
  // pushes get flushed and re-render at 120.
  "en57akm": "2026-06-05T23:59:00Z",
  "en57 akm": "2026-06-05T23:59:00Z",
  // Class-anchored rarity overrides added 2026-06-05 (rarity.ts KNOWN_RARITY) after
  // the top-user spot audit showed the same class returning different rarity tiers
  // by operator. Invalidate cached entries for the classes whose tier was swinging
  // so they re-render at the locked tier (BR 193 -> common, BR 159 -> uncommon,
  // BR 143 -> epic) across all operator variants.
  "br 193": "2026-06-05T23:59:00Z",
  "br193": "2026-06-05T23:59:00Z",
  "baureihe 193": "2026-06-05T23:59:00Z",
  "br 159 (stadler eurodual)": "2026-06-05T23:59:00Z",
  "br 143": "2026-06-05T23:59:00Z",
  "class 143": "2026-06-05T23:59:00Z",
  "baureihe 143": "2026-06-05T23:59:00Z",
  // Pesa Elf 2 (34WEa) was returned as "Newag ... Impuls 2"; vision + KNOWN_SPECS
  // corrected 2026-06-05 (Pesa Bydgoszcz, not Newag). Flush any stale 34WE cache
  // entry in case the corrected vision output reuses the same class string.
  // (Class 183-vs-EU07 needs no invalidation — the class string changes EU07 →
  // Class 183, so corrected scans land on a fresh key.)
  "34we": "2026-06-05T23:59:00Z",
  "34wea": "2026-06-05T23:59:00Z",
  "34weag": "2026-06-05T23:59:00Z",
  // EN57 family rarity coverage completed 2026-06-09 (rarity.ts KNOWN_RARITY) —
  // the 06-05 anchor locked en57 / en57al / en57akm to "uncommon" but added no
  // invalidation for them, and the en57ak / en57aks / en57akł / en57ald / en71
  // sub-variants had no rarity lock at all (could still swing to "common" by
  // operator via the AI — exactly Foxiar's "too common" complaint). All family
  // variants now locked "uncommon"; invalidate so any entry cached at the wrong
  // tier re-renders. (en57akm already invalidated above for the 120 km/h fix.)
  "en57": "2026-06-09T23:59:00Z",
  "en57al": "2026-06-09T23:59:00Z",
  "en57ald": "2026-06-09T23:59:00Z",
  "en57ak": "2026-06-09T23:59:00Z",
  "en57aks": "2026-06-09T23:59:00Z",
  "en57akł": "2026-06-09T23:59:00Z",
  "en71": "2026-06-09T23:59:00Z",
  // ICE 1 (BR 401) — rarity locked "epic" 2026-06-12 (rarity.ts KNOWN_RARITY)
  // because the 2026-06-12 DE ad shows the EPIC card and drives scan traffic.
  // Also flushes any pre-2026-05-18 entry still carrying the hallucinated
  // "37 built" (KNOWN_SPECS numberBuilt 60 landed 05-18 but had no
  // invalidation, so month-old cached entries could still serve 37).
  // Timestamp is mid-day deploy time, NOT end-of-day, so today's ad-driven
  // scans cache normally after the deploy instead of missing all day.
  "401": "2026-06-12T06:00:00Z",
  "br 401": "2026-06-12T06:00:00Z",
  "br401": "2026-06-12T06:00:00Z",
  "db 401": "2026-06-12T06:00:00Z",
  "db br 401": "2026-06-12T06:00:00Z",
  "baureihe 401": "2026-06-12T06:00:00Z",
  "db baureihe 401": "2026-06-12T06:00:00Z",
  "class 401": "2026-06-12T06:00:00Z",
  "db class 401": "2026-06-12T06:00:00Z",
  "ice 1": "2026-06-12T06:00:00Z",
  "ice1": "2026-06-12T06:00:00Z",
  "db ice 1": "2026-06-12T06:00:00Z",
};
// Note: the `br 159` / `br159` keys already exist above (06-04 length fix) and were
// bumped to 2026-06-05T23:59:00Z so the rarity anchor also refreshes their cache.

function normaliseClass(className: string): string {
  return className.toLowerCase().trim();
}

function getCacheKey(train: TrainIdentification, language: string = "en"): string {
  return `${language}::${train.class}::${train.operator}`.toLowerCase().trim();
}

function isClassInvalidated(className: string, cachedAt: string): boolean {
  const invalidatedAt = CLASS_INVALIDATIONS[normaliseClass(className)];
  if (!invalidatedAt) return false;
  return new Date(cachedAt).getTime() < new Date(invalidatedAt).getTime();
}

function isExpired(entry: CachedTrainData): boolean {
  const cachedDate = new Date(entry.cachedAt);
  const ageDays = (Date.now() - cachedDate.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > CACHE_TTL_DAYS;
}

async function readFromRedis(key: string): Promise<CachedTrainData | null> {
  try {
    const raw = await getTrainCache(key);
    if (!raw) return null;
    return JSON.parse(raw) as CachedTrainData;
  } catch {
    return null;
  }
}

async function writeToRedis(key: string, entry: CachedTrainData): Promise<void> {
  try {
    await setTrainCache(key, JSON.stringify(entry));
  } catch (err) {
    console.warn("[CACHE] Redis write failed:", (err as Error).message);
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Look up cached data for a train.
 * Checks L1 (memory) first, then L2 (Redis).
 * Returns null on cache miss.
 */
export async function getCachedTrainData(
  train: TrainIdentification,
  style: BlueprintStyle = "technical",
  language: string = "en"
): Promise<{
  specs: TrainSpecs;
  facts: TrainFacts;
  rarity: RarityInfo;
  blueprintUrl: string | null;
} | null> {
  const key = getCacheKey(train, language);

  // L1 check
  let entry = memoryCache.get(key);

  // L2 check (Redis) if not in memory
  if (!entry) {
    const redisEntry = await readFromRedis(key);
    if (redisEntry) {
      memoryCache.set(key, redisEntry); // populate L1
      entry = redisEntry;
    }
  }

  if (!entry) {
    totalMisses++;
    return null;
  }

  if (isExpired(entry)) {
    memoryCache.delete(key);
    totalMisses++;
    return null;
  }

  if (isClassInvalidated(train.class, entry.cachedAt)) {
    memoryCache.delete(key);
    totalMisses++;
    console.log(
      `[CACHE] INVALIDATED for "${key}" (class invalidation rule)`
    );
    return null;
  }

  // Cache hit
  entry.hitCount++;
  totalHits++;

  const blueprintUrl =
    entry.blueprintUrls?.[style] ??
    (style === "technical" ? entry.blueprintUrl : null);

  console.log(
    `[CACHE] HIT for "${key}" style="${style}" (${entry.hitCount} total hits)` +
    (blueprintUrl ? " [has blueprint]" : " [no blueprint yet]")
  );

  return {
    specs: entry.specs,
    facts: entry.facts,
    rarity: entry.rarity,
    blueprintUrl,
  };
}

/**
 * Store specs/facts/rarity in the cache after a fresh AI call.
 * Writes to both L1 (memory) and L2 (Redis).
 */
export async function setCachedTrainData(
  train: TrainIdentification,
  specs: TrainSpecs,
  facts: TrainFacts,
  rarity: RarityInfo,
  language: string = "en"
): Promise<void> {
  const key = getCacheKey(train, language);

  const entry: CachedTrainData = {
    specs,
    facts,
    rarity,
    blueprintUrl: null,
    cachedAt: new Date().toISOString(),
    hitCount: 0,
  };

  memoryCache.set(key, entry);
  await writeToRedis(key, entry);

  console.log(`[CACHE] Stored: "${key}" (memory + Redis)`);
}

/**
 * Update a cached entry with a completed blueprint URL.
 * Writes updated entry back to both L1 and L2.
 */
export async function setCachedBlueprint(
  train: TrainIdentification,
  blueprintUrl: string,
  style: BlueprintStyle = "technical",
  language: string = "en"
): Promise<void> {
  const key = getCacheKey(train, language);

  // Get from L1, or pull from Redis if not in memory
  let entry = memoryCache.get(key);
  if (!entry) {
    const redisEntry = await readFromRedis(key);
    if (redisEntry) {
      memoryCache.set(key, redisEntry);
      entry = redisEntry;
    }
  }

  if (!entry) {
    console.warn(`[CACHE] setCachedBlueprint: no entry found for "${key}"`);
    return;
  }

  if (!entry.blueprintUrls) entry.blueprintUrls = {};
  entry.blueprintUrls[style] = blueprintUrl;

  if (style === "technical") {
    entry.blueprintUrl = blueprintUrl;
  }

  memoryCache.set(key, entry);
  await writeToRedis(key, entry);

  console.log(`[CACHE] Blueprint stored for "${key}" style="${style}" (memory + Redis)`);
}

/**
 * Get cache statistics for the health endpoint.
 */
export function getCacheStats(): CacheStats {
  const total = totalHits + totalMisses;
  const hitRate = total > 0 ? ((totalHits / total) * 100).toFixed(1) : "0.0";
  const estimatedSavings = (totalHits * COST_PER_CACHED_HIT).toFixed(2);

  let entriesWithBlueprints = 0;
  for (const entry of memoryCache.values()) {
    if (entry.blueprintUrl || (entry.blueprintUrls && Object.keys(entry.blueprintUrls).length > 0)) {
      entriesWithBlueprints++;
    }
  }

  return {
    totalEntries: memoryCache.size,
    totalHits,
    totalMisses,
    hitRate: `${hitRate}%`,
    estimatedSavings: `$${estimatedSavings}`,
    entriesWithBlueprints,
  };
}

/**
 * Get the most frequently spotted trains (for analytics).
 */
export function getTopTrains(limit: number = 10): Array<{
  class: string;
  operator: string;
  hits: number;
  rarity: string;
}> {
  return Array.from(memoryCache.entries())
    .map(([key, data]) => {
      const [, , cls, operator] = key.split("::");
      return {
        class: cls,
        operator,
        hits: data.hitCount,
        rarity: data.rarity.tier,
      };
    })
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit);
}

// ── Removed: loadCache() / saveCache() ──────────────────────
// Previously loaded/saved a local JSON file — broken on Render
// (ephemeral filesystem wipes on every deploy).
// Redis handles persistence now. No startup load needed —
// cache entries are lazy-loaded from Redis on first access.
