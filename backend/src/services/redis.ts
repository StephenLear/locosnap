// ============================================================
// LocoSnap — Redis Blueprint Task Store
// Uses @upstash/redis REST client (HTTPS/443) instead of ioredis
// (TCP/6379 is blocked on Render free tier — REST works fine)
// Falls back to in-memory Map for local dev without credentials
// ============================================================

import { Redis } from "@upstash/redis";
import { config } from "../config/env";
import { BlueprintTask } from "../types";

// ── State ───────────────────────────────────────────────────

let redis: Redis | null = null;
let useInMemoryFallback = false;

// In-memory fallback (for local dev without Upstash credentials)
const memoryStore = new Map<string, string>();

const TASK_PREFIX = "blueprint:";
const DEFAULT_TTL = 3600; // 1 hour

// ── Connection ──────────────────────────────────────────────

export function initRedis(): void {
  if (!config.upstashRedisRestUrl || !config.upstashRedisRestToken) {
    console.log("[REDIS] No Upstash credentials set — using in-memory fallback");
    useInMemoryFallback = true;
    return;
  }

  try {
    redis = new Redis({
      url: config.upstashRedisRestUrl,
      token: config.upstashRedisRestToken,
    });
    console.log("[REDIS] Upstash REST client initialised");
  } catch (err) {
    console.warn("[REDIS] Init failed:", (err as Error).message);
    useInMemoryFallback = true;
  }
}

// ── Blueprint Task Operations ───────────────────────────────

export async function setBlueprintTask(
  taskId: string,
  task: BlueprintTask
): Promise<void> {
  const key = TASK_PREFIX + taskId;
  const value = JSON.stringify({
    ...task,
    createdAt: task.createdAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
  });

  // Write-through to local memory FIRST, always. The Upstash DB is Global
  // (multi-region, eventually consistent; primary eu-west-1 Ireland, backend
  // in Frankfurt). A read issued seconds after a write can hit a replica
  // that hasn't synced yet and return null. Blueprint tasks are created and
  // then polled within seconds, so a Redis-only store hit that lag window
  // and 404'd — surfacing in the app as "Couldn't reach LocoSnap servers"
  // (39 events / 7 users / 18 days, confirmed 2026-06-04). On a single
  // instance the local copy makes the first polls read-your-writes
  // consistent; Redis still gives cross-restart durability. (The train cache
  // is unaffected — its reads happen long after writes, replica caught up.)
  memoryStore.set(key, value);
  setTimeout(() => memoryStore.delete(key), DEFAULT_TTL * 1000);

  if (!useInMemoryFallback && redis) {
    try {
      await redis.setex(key, DEFAULT_TTL, value);
    } catch (err) {
      console.warn("[REDIS] setBlueprintTask failed:", (err as Error).message);
    }
  }
}

export async function getBlueprintTask(
  taskId: string
): Promise<BlueprintTask | null> {
  const key = TASK_PREFIX + taskId;

  // Local memory first — guarantees read-your-writes for freshly created
  // tasks on this instance, bypassing Global-Redis replication lag (see
  // setBlueprintTask). Falls back to Redis for tasks created before a
  // restart (memory cleared, Redis durable).
  let raw: string | null = memoryStore.get(key) ?? null;

  if (!raw && !useInMemoryFallback && redis) {
    try {
      raw = await redis.get<string>(key);
    } catch {
      raw = null;
    }
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      completedAt: parsed.completedAt ? new Date(parsed.completedAt) : null,
    };
  } catch {
    return null;
  }
}

export async function deleteBlueprintTask(taskId: string): Promise<void> {
  const key = TASK_PREFIX + taskId;

  // Clear both layers (write-through store, see setBlueprintTask).
  memoryStore.delete(key);

  if (!useInMemoryFallback && redis) {
    try {
      await redis.del(key);
    } catch {
      // best-effort
    }
  }
}

// ── Train Cache Operations ───────────────────────────────────
// Persistent train data cache (specs/facts/rarity/blueprints).
// Survives server restarts and Render deploys via Redis.
// Falls back to in-memory if Redis unavailable.

const TRAIN_CACHE_PREFIX = "traindata:";
const TRAIN_CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

export async function setTrainCache(key: string, data: string): Promise<void> {
  const redisKey = TRAIN_CACHE_PREFIX + key;

  if (!useInMemoryFallback && redis) {
    try {
      await redis.setex(redisKey, TRAIN_CACHE_TTL, data);
      return;
    } catch (err) {
      console.warn("[REDIS] setTrainCache failed:", (err as Error).message);
      // Fall through to in-memory
    }
  }

  memoryStore.set(redisKey, data);
  setTimeout(() => memoryStore.delete(redisKey), TRAIN_CACHE_TTL * 1000);
}

export async function getTrainCache(key: string): Promise<string | null> {
  const redisKey = TRAIN_CACHE_PREFIX + key;

  if (!useInMemoryFallback && redis) {
    try {
      return await redis.get<string>(redisKey);
    } catch {
      return memoryStore.get(redisKey) ?? null;
    }
  }

  return memoryStore.get(redisKey) ?? null;
}

// ── Cleanup ─────────────────────────────────────────────────

export async function disconnectRedis(): Promise<void> {
  // @upstash/redis is stateless (REST) — nothing to disconnect
  redis = null;
}

// ── Health ──────────────────────────────────────────────────

export function getRedisStatus(): string {
  if (useInMemoryFallback) return "in-memory fallback";
  if (redis) return "connected";
  return "disconnected";
}

export async function pingRedis(): Promise<boolean> {
  if (!useInMemoryFallback && redis) {
    try {
      await redis.ping();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
