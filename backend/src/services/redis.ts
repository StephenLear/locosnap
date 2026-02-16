// ============================================================
// LocoSnap — Redis Blueprint Task Store
// Stores blueprint generation tasks in Redis (or in-memory fallback)
// Uses ioredis + Upstash for production, falls back to Map for dev
// ============================================================

import Redis from "ioredis";
import { config } from "../config/env";
import { BlueprintTask } from "../types";

// ── State ───────────────────────────────────────────────────

let redis: Redis | null = null;
let useInMemoryFallback = false;

// In-memory fallback (for local dev without Redis)
const memoryStore = new Map<string, string>();

const TASK_PREFIX = "blueprint:";
const DEFAULT_TTL = 3600; // 1 hour

// ── Connection ──────────────────────────────────────────────

export function initRedis(): void {
  if (!config.redisUrl) {
    console.log("[REDIS] No REDIS_URL set — using in-memory fallback");
    useInMemoryFallback = true;
    return;
  }

  try {
    redis = new Redis(config.redisUrl, {
      tls: config.redisUrl.startsWith("rediss://") ? {} : undefined,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn("[REDIS] Max retries reached — falling back to in-memory");
          useInMemoryFallback = true;
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
    });

    redis.on("connect", () => {
      console.log("[REDIS] Connected");
      useInMemoryFallback = false;
    });

    redis.on("error", (err) => {
      console.warn("[REDIS] Connection error:", err.message);
      if (!useInMemoryFallback) {
        console.warn("[REDIS] Falling back to in-memory store");
        useInMemoryFallback = true;
      }
    });
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

  if (!useInMemoryFallback && redis) {
    try {
      await redis.setex(key, DEFAULT_TTL, value);
      return;
    } catch {
      // Fall through to in-memory
    }
  }

  memoryStore.set(key, value);
  // Simulate TTL for in-memory
  setTimeout(() => memoryStore.delete(key), DEFAULT_TTL * 1000);
}

export async function getBlueprintTask(
  taskId: string
): Promise<BlueprintTask | null> {
  const key = TASK_PREFIX + taskId;

  let raw: string | null = null;

  if (!useInMemoryFallback && redis) {
    try {
      raw = await redis.get(key);
    } catch {
      raw = memoryStore.get(key) ?? null;
    }
  } else {
    raw = memoryStore.get(key) ?? null;
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

  if (!useInMemoryFallback && redis) {
    try {
      await redis.del(key);
      return;
    } catch {
      // Fall through
    }
  }

  memoryStore.delete(key);
}

// ── Cleanup ─────────────────────────────────────────────────

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// ── Health ──────────────────────────────────────────────────

export function getRedisStatus(): string {
  if (useInMemoryFallback) return "in-memory fallback";
  if (redis?.status === "ready") return "connected";
  return redis?.status ?? "disconnected";
}
