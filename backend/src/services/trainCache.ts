// ============================================================
// LocoSnap — Train Data Cache
// Caches specs, facts, rarity, AND blueprints for known classes
// Eliminates 3 AI calls + 1 image gen per repeat scan
//
// First scan of a class:  ~£0.028 (vision + specs + facts + rarity + blueprint)
// Repeat scans (cached):  ~£0.005 (vision only)
// Saving per cached scan: ~£0.023 (82% reduction)
//
// Strategy: in-memory cache + JSON file persistence
// Key: normalised "class::operator" (e.g. "class 390::avanti west coast")
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import {
  TrainIdentification,
  TrainSpecs,
  TrainFacts,
  RarityInfo,
} from "../types";

// ── Types ───────────────────────────────────────────────────

interface CachedTrainData {
  specs: TrainSpecs;
  facts: TrainFacts;
  rarity: RarityInfo;
  blueprintUrl: string | null; // cached blueprint image URL
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

const CACHE_DIR = join(process.cwd(), ".cache");
const CACHE_FILE = join(CACHE_DIR, "train-data.json");
const MAX_CACHE_SIZE = 500;
const CACHE_TTL_DAYS = 30;

// Cost saved per cached scan (specs + facts + rarity + blueprint) in GBP
const COST_PER_CACHED_HIT = 0.023;

// ── In-memory cache ─────────────────────────────────────────

let cache: Map<string, CachedTrainData> = new Map();
let totalHits = 0;
let totalMisses = 0;

// ── Helpers ─────────────────────────────────────────────────

/**
 * Create a normalised cache key from train identification.
 * Same class + operator = same specs/facts/rarity/blueprint.
 */
function getCacheKey(train: TrainIdentification): string {
  return `${train.class}::${train.operator}`.toLowerCase().trim();
}

function isExpired(entry: CachedTrainData): boolean {
  const cachedDate = new Date(entry.cachedAt);
  const ageDays = (Date.now() - cachedDate.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > CACHE_TTL_DAYS;
}

// ── Load / Save ─────────────────────────────────────────────

export function loadCache(): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }

    if (existsSync(CACHE_FILE)) {
      const raw = readFileSync(CACHE_FILE, "utf-8");
      const data: Record<string, CachedTrainData> = JSON.parse(raw);
      cache = new Map(Object.entries(data));

      // Prune expired entries
      let pruned = 0;
      for (const [key, entry] of cache) {
        if (isExpired(entry)) {
          cache.delete(key);
          pruned++;
        }
      }

      console.log(
        `[CACHE] Loaded ${cache.size} train classes from disk` +
          (pruned > 0 ? ` (pruned ${pruned} expired)` : "")
      );
    } else {
      console.log("[CACHE] No cache file found — starting fresh");
    }
  } catch (error) {
    console.warn("[CACHE] Failed to load cache:", (error as Error).message);
    cache = new Map();
  }
}

function saveCache(): void {
  try {
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }

    const data: Record<string, CachedTrainData> = Object.fromEntries(cache);
    writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.warn("[CACHE] Failed to save cache:", (error as Error).message);
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Look up cached data for a train.
 * Returns null on cache miss.
 */
export function getCachedTrainData(
  train: TrainIdentification
): {
  specs: TrainSpecs;
  facts: TrainFacts;
  rarity: RarityInfo;
  blueprintUrl: string | null;
} | null {
  const key = getCacheKey(train);
  const entry = cache.get(key);

  if (!entry) {
    totalMisses++;
    return null;
  }

  if (isExpired(entry)) {
    cache.delete(key);
    totalMisses++;
    return null;
  }

  // Cache hit!
  entry.hitCount++;
  totalHits++;

  console.log(
    `[CACHE] HIT for "${key}" (${entry.hitCount} total hits)` +
      (entry.blueprintUrl ? " [has blueprint]" : " [no blueprint yet]")
  );

  return {
    specs: entry.specs,
    facts: entry.facts,
    rarity: entry.rarity,
    blueprintUrl: entry.blueprintUrl,
  };
}

/**
 * Store specs/facts/rarity in the cache after a fresh AI call.
 * Blueprint URL can be added later via setCachedBlueprint().
 */
export function setCachedTrainData(
  train: TrainIdentification,
  specs: TrainSpecs,
  facts: TrainFacts,
  rarity: RarityInfo
): void {
  const key = getCacheKey(train);

  // Evict least-used entry if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    let lowestKey = "";
    let lowestHits = Infinity;
    for (const [k, v] of cache) {
      if (v.hitCount < lowestHits) {
        lowestKey = k;
        lowestHits = v.hitCount;
      }
    }
    if (lowestKey) {
      cache.delete(lowestKey);
      console.log(`[CACHE] Evicted least-used entry: "${lowestKey}"`);
    }
  }

  cache.set(key, {
    specs,
    facts,
    rarity,
    blueprintUrl: null,
    cachedAt: new Date().toISOString(),
    hitCount: 0,
  });

  console.log(`[CACHE] Stored new entry: "${key}" (${cache.size} total)`);
  saveCache();
}

/**
 * Update a cached entry with a completed blueprint URL.
 * Called when blueprint generation finishes.
 */
export function setCachedBlueprint(
  train: TrainIdentification,
  blueprintUrl: string
): void {
  const key = getCacheKey(train);
  const entry = cache.get(key);

  if (entry) {
    entry.blueprintUrl = blueprintUrl;
    console.log(`[CACHE] Blueprint URL stored for "${key}"`);
    saveCache();
  }
}

/**
 * Get cache statistics for the health endpoint.
 */
export function getCacheStats(): CacheStats {
  const total = totalHits + totalMisses;
  const hitRate = total > 0 ? ((totalHits / total) * 100).toFixed(1) : "0.0";
  const estimatedSavings = (totalHits * COST_PER_CACHED_HIT).toFixed(2);

  let entriesWithBlueprints = 0;
  for (const entry of cache.values()) {
    if (entry.blueprintUrl) entriesWithBlueprints++;
  }

  return {
    totalEntries: cache.size,
    totalHits,
    totalMisses,
    hitRate: `${hitRate}%`,
    estimatedSavings: `£${estimatedSavings}`,
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
  return Array.from(cache.entries())
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
