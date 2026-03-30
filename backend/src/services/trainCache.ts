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

// Bump this version when cached specs/facts data is known to be stale
// (e.g. after fixing AI prompt or Wikidata corrections). Old entries are
// automatically orphaned and will be recomputed on next scan.
const CACHE_VERSION = "v3";

function getCacheKey(train: TrainIdentification): string {
  return `${CACHE_VERSION}::${train.class}::${train.operator}`.toLowerCase().trim();
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
  style: BlueprintStyle = "technical"
): Promise<{
  specs: TrainSpecs;
  facts: TrainFacts;
  rarity: RarityInfo;
  blueprintUrl: string | null;
} | null> {
  const key = getCacheKey(train);

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
  rarity: RarityInfo
): Promise<void> {
  const key = getCacheKey(train);

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
  style: BlueprintStyle = "technical"
): Promise<void> {
  const key = getCacheKey(train);

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
      const [cls, operator] = key.split("::");
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
