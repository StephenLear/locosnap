// ============================================================
// LocoSnap — Spot write queue (v1.0.35 Phase E)
//
// Persistent queue for spots that couldn't be written to Supabase
// due to transient network failures. Replaces the silent-fail
// pattern surfaced by "TypeError: Network request failed" Sentry
// events (saveSpot swallowed network errors; the user saw the
// card-reveal celebration but their spot never landed).
//
// The queue is invisible to the user — saveSpot returns optimistic
// success, the queue persists to AsyncStorage, and pending items
// flush opportunistically:
//   - lazy:  next time saveSpot runs successfully (we know network
//            is up because we're about to make an insert ourselves)
//   - active: on AppState transition to "active" (wired in
//            app/_layout.tsx)
//
// NetInfo dependency intentionally avoided per CLAUDE.md
// "Simplicity First" — AppState + lazy flush cover the common case
// (user comes back to the app or makes another scan). NetInfo can
// be layered on later if Sentry signals indicate the queue is
// accumulating without flushing.
//
// Error policy:
//   - Transient network error  → enqueue + return optimistic success
//   - Terminal error (RLS, 5xx, validation) → existing capture +
//     null behaviour, no queue interaction
//   - Per-item retries bounded to MAX_RETRY_ATTEMPTS; on exhaustion
//     the item is dropped + sent to Sentry with context for triage.
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import { captureError } from "./analytics";

export const SPOT_QUEUE_KEY = "locosnap_spot_queue";
export const MAX_RETRY_ATTEMPTS = 3;

export interface QueuedSpot {
  // The Supabase insert payload exactly as it would have been sent.
  // Values must be JSON-serialisable when enqueued — Date / Buffer
  // values should already be ISO strings or null.
  spotPayload: Record<string, unknown>;
  queuedAt: string; // ISO timestamp for triage
  attempts: number; // bounded retry counter (0 on enqueue)
}

export type FlushAttemptResult =
  | { ok: true }
  | { ok: false; transient: boolean; error: Error };

export type FlushAttemptFn = (
  payload: Record<string, unknown>
) => Promise<FlushAttemptResult>;

// ── Network-error detection ───────────────────────────────────
// Anything matching here is treated as transient and queued for
// retry. Anything else is terminal and goes to Sentry per the
// existing saveSpot path. Keep the keyword list narrow — false
// positives here mean spots get silently queued instead of being
// surfaced as bugs.
export function isTransientNetworkError(
  error: { message?: string | null } | null | undefined
): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("network request failed") ||
    msg.includes("network error") ||
    msg.includes("failed to fetch") ||
    msg.includes("timeout") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("enetunreach")
  );
}

// ── Storage I/O ───────────────────────────────────────────────
// Defensive: malformed JSON or AsyncStorage failure returns an
// empty queue rather than throwing, so a corrupt queue never
// breaks a fresh saveSpot call.

export async function readQueue(): Promise<QueuedSpot[]> {
  try {
    const raw = await AsyncStorage.getItem(SPOT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Shape-check each item; drop anything that doesn't look like a QueuedSpot
    return parsed.filter(
      (it): it is QueuedSpot =>
        typeof it === "object" &&
        it !== null &&
        typeof (it as QueuedSpot).spotPayload === "object" &&
        typeof (it as QueuedSpot).queuedAt === "string" &&
        typeof (it as QueuedSpot).attempts === "number"
    );
  } catch {
    return [];
  }
}

export async function writeQueue(queue: QueuedSpot[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SPOT_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    // Storage failure isn't recoverable from here. Capture and continue —
    // the caller has already produced the optimistic-success effect.
    captureError(e as Error, { op: "spotQueue_write" });
  }
}

// ── Queue operations ──────────────────────────────────────────

export async function enqueue(
  spotPayload: Record<string, unknown>
): Promise<void> {
  const queue = await readQueue();
  queue.push({
    spotPayload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
  });
  await writeQueue(queue);
}

export async function peek(): Promise<QueuedSpot | null> {
  const queue = await readQueue();
  return queue[0] ?? null;
}

export async function size(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

// Process every queued item via the caller-provided flush function
// (decoupling lets us test the queue without instantiating Supabase).
// Items are processed in FIFO order; on transient error the attempt
// counter increments and the item survives, on terminal error or
// retry exhaustion the item is dropped and a Sentry event is fired.
export async function flushQueue(
  attemptFlush: FlushAttemptFn
): Promise<{ succeeded: number; dropped: number; remaining: number }> {
  const queue = await readQueue();
  if (queue.length === 0) {
    return { succeeded: 0, dropped: 0, remaining: 0 };
  }

  let succeeded = 0;
  let dropped = 0;
  const surviving: QueuedSpot[] = [];

  for (const item of queue) {
    let result: FlushAttemptResult;
    try {
      result = await attemptFlush(item.spotPayload);
    } catch (e) {
      // The attempt function itself threw — treat as a terminal failure
      // so we don't loop forever on a programmer error.
      result = {
        ok: false,
        transient: false,
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }

    if (result.ok) {
      succeeded += 1;
      continue;
    }

    if (!result.transient) {
      dropped += 1;
      captureError(result.error, {
        op: "spotQueue_flush_terminal",
        queuedAt: item.queuedAt,
        attempts: item.attempts,
      });
      continue;
    }

    const nextAttempts = item.attempts + 1;
    if (nextAttempts >= MAX_RETRY_ATTEMPTS) {
      dropped += 1;
      captureError(result.error, {
        op: "spotQueue_flush_retry_exhausted",
        queuedAt: item.queuedAt,
        attempts: nextAttempts,
      });
      continue;
    }

    surviving.push({ ...item, attempts: nextAttempts });
  }

  await writeQueue(surviving);
  return { succeeded, dropped, remaining: surviving.length };
}

// Test-only helper. Production code never calls this directly —
// items leave the queue via flushQueue.
export async function _clearQueueForTest(): Promise<void> {
  await AsyncStorage.removeItem(SPOT_QUEUE_KEY);
}
