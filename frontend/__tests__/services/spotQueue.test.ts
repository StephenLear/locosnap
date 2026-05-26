// Pure-logic tests for the spot write queue. ts-jest convention —
// no RN render, mocked AsyncStorage.
//
// captureError is observed via jest.spyOn() against the mapped
// __mocks__/analytics.ts module rather than jest.mock(), because the
// project's jest.config.js moduleNameMapper rewrites ./analytics +
// ../services/analytics imports to __mocks__/analytics.ts globally,
// which overrides per-test jest.mock() calls. Spying on the mapped
// module gets us call-counting without disrupting the global stub.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import {
  SPOT_QUEUE_KEY,
  MAX_RETRY_ATTEMPTS,
  isTransientNetworkError,
  readQueue,
  writeQueue,
  enqueue,
  peek,
  size,
  flushQueue,
  _clearQueueForTest,
  type FlushAttemptResult,
} from "../../services/spotQueue";
import AsyncStorage from "@react-native-async-storage/async-storage";
// Import the mapped mock module directly so jest.spyOn can attach to
// the same captureError reference spotQueue.ts uses at runtime. The
// jest.config.js moduleNameMapper sends spotQueue's "./analytics"
// import to <rootDir>/__mocks__/analytics.ts; we reach it from the
// test via the same path to get a shared module instance.
import * as analytics from "../../__mocks__/analytics";

const captureErrorSpy = jest.spyOn(analytics, "captureError");

beforeEach(async () => {
  await _clearQueueForTest();
  captureErrorSpy.mockClear();
});

describe("isTransientNetworkError", () => {
  it("matches the canonical RN fetch failure", () => {
    expect(
      isTransientNetworkError({
        message: "TypeError: Network request failed",
      })
    ).toBe(true);
  });

  it.each([
    "Failed to fetch",
    "network error",
    "Request timeout",
    "ETIMEDOUT",
    "ECONNRESET",
    "ENETUNREACH 8.8.8.8",
  ])("matches transient string '%s'", (msg) => {
    expect(isTransientNetworkError({ message: msg })).toBe(true);
  });

  it("does NOT match terminal errors", () => {
    expect(
      isTransientNetworkError({
        message: "duplicate key value violates unique constraint",
      })
    ).toBe(false);
    expect(
      isTransientNetworkError({ message: "permission denied for table spots" })
    ).toBe(false);
  });

  it("returns false for null / undefined / no message", () => {
    expect(isTransientNetworkError(null)).toBe(false);
    expect(isTransientNetworkError(undefined)).toBe(false);
    expect(isTransientNetworkError({})).toBe(false);
    expect(isTransientNetworkError({ message: "" })).toBe(false);
  });
});

describe("queue I/O — readQueue / writeQueue / enqueue / peek / size", () => {
  it("starts empty", async () => {
    expect(await readQueue()).toEqual([]);
    expect(await peek()).toBeNull();
    expect(await size()).toBe(0);
  });

  it("returns empty queue on malformed JSON", async () => {
    await AsyncStorage.setItem(SPOT_QUEUE_KEY, "{not json");
    expect(await readQueue()).toEqual([]);
  });

  it("returns empty queue on non-array JSON", async () => {
    await AsyncStorage.setItem(SPOT_QUEUE_KEY, JSON.stringify({ a: 1 }));
    expect(await readQueue()).toEqual([]);
  });

  it("filters out malformed items", async () => {
    const corrupt = [
      { spotPayload: { user_id: "u1" }, queuedAt: "now", attempts: 0 }, // valid
      { spotPayload: "string-not-object", queuedAt: "now", attempts: 0 }, // invalid
      null, // invalid
      { spotPayload: {}, queuedAt: 123, attempts: 0 }, // invalid (queuedAt not string)
    ];
    await AsyncStorage.setItem(SPOT_QUEUE_KEY, JSON.stringify(corrupt));
    const out = await readQueue();
    expect(out).toHaveLength(1);
    expect(out[0].spotPayload).toEqual({ user_id: "u1" });
  });

  it("enqueue appends FIFO with timestamp + zero attempts", async () => {
    await enqueue({ user_id: "u1", train_id: "t1" });
    await enqueue({ user_id: "u1", train_id: "t2" });
    const queue = await readQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0].spotPayload).toEqual({ user_id: "u1", train_id: "t1" });
    expect(queue[1].spotPayload).toEqual({ user_id: "u1", train_id: "t2" });
    expect(queue[0].attempts).toBe(0);
    expect(typeof queue[0].queuedAt).toBe("string");
  });

  it("peek returns head without removing", async () => {
    await enqueue({ user_id: "u1" });
    expect(await peek()).not.toBeNull();
    expect(await size()).toBe(1);
  });

  it("writeQueue round-trips", async () => {
    const fixture = [
      { spotPayload: { a: 1 }, queuedAt: "2026-05-26T10:00:00Z", attempts: 1 },
    ];
    await writeQueue(fixture);
    expect(await readQueue()).toEqual(fixture);
  });
});

describe("flushQueue", () => {
  it("returns zeros when queue is empty", async () => {
    const out = await flushQueue(async () => ({ ok: true }));
    expect(out).toEqual({ succeeded: 0, dropped: 0, remaining: 0 });
  });

  it("succeeds + drains every item when all attempts succeed", async () => {
    await enqueue({ id: "a" });
    await enqueue({ id: "b" });
    await enqueue({ id: "c" });
    const attempt = jest.fn(
      async (): Promise<FlushAttemptResult> => ({ ok: true })
    );
    const out = await flushQueue(attempt);
    expect(out).toEqual({ succeeded: 3, dropped: 0, remaining: 0 });
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(await size()).toBe(0);
  });

  it("processes FIFO order", async () => {
    await enqueue({ id: "first" });
    await enqueue({ id: "second" });
    const seen: string[] = [];
    await flushQueue(async (p) => {
      seen.push(p.id as string);
      return { ok: true };
    });
    expect(seen).toEqual(["first", "second"]);
  });

  it("survives transient errors with attempt counter bumped", async () => {
    await enqueue({ id: "x" });
    const out = await flushQueue(async () => ({
      ok: false,
      transient: true,
      error: new Error("Network request failed"),
    }));
    expect(out).toEqual({ succeeded: 0, dropped: 0, remaining: 1 });
    const queue = await readQueue();
    expect(queue[0].attempts).toBe(1);
    expect(queue[0].spotPayload).toEqual({ id: "x" });
  });

  it("drops + captures after MAX_RETRY_ATTEMPTS transient failures", async () => {
    await enqueue({ id: "x" });
    // First MAX-1 retries leave the item in place
    for (let i = 0; i < MAX_RETRY_ATTEMPTS - 1; i++) {
      await flushQueue(async () => ({
        ok: false,
        transient: true,
        error: new Error("Network request failed"),
      }));
    }
    expect(await size()).toBe(1);
    expect(captureErrorSpy.mock.calls.length).toBe(0);
    // Final attempt exceeds the cap → drop + capture
    const out = await flushQueue(async () => ({
      ok: false,
      transient: true,
      error: new Error("Network request failed"),
    }));
    expect(out).toEqual({ succeeded: 0, dropped: 1, remaining: 0 });
    expect(captureErrorSpy).toHaveBeenCalledTimes(1);
    expect(
      captureErrorSpy.mock.calls[0][1]
    ).toEqual(
      expect.objectContaining({
        op: "spotQueue_flush_retry_exhausted",
        attempts: MAX_RETRY_ATTEMPTS,
      })
    );
  });

  it("drops + captures immediately on terminal (non-transient) error", async () => {
    await enqueue({ id: "x" });
    const out = await flushQueue(async () => ({
      ok: false,
      transient: false,
      error: new Error("permission denied"),
    }));
    expect(out).toEqual({ succeeded: 0, dropped: 1, remaining: 0 });
    expect(await size()).toBe(0);
    expect(captureErrorSpy).toHaveBeenCalledTimes(1);
    expect(captureErrorSpy.mock.calls[0][1]).toEqual(
      expect.objectContaining({ op: "spotQueue_flush_terminal" })
    );
  });

  it("treats a thrown attempt function as terminal", async () => {
    await enqueue({ id: "x" });
    const out = await flushQueue(async () => {
      throw new Error("programmer error");
    });
    expect(out).toEqual({ succeeded: 0, dropped: 1, remaining: 0 });
    expect(captureErrorSpy).toHaveBeenCalledTimes(1);
  });

  it("processes mixed batch: success + transient + terminal", async () => {
    await enqueue({ id: "ok" });
    await enqueue({ id: "transient" });
    await enqueue({ id: "terminal" });
    const out = await flushQueue(async (p) => {
      if (p.id === "ok") return { ok: true };
      if (p.id === "transient") {
        return {
          ok: false,
          transient: true,
          error: new Error("Network request failed"),
        };
      }
      return {
        ok: false,
        transient: false,
        error: new Error("permission denied"),
      };
    });
    expect(out).toEqual({ succeeded: 1, dropped: 1, remaining: 1 });
    const survivors = await readQueue();
    expect(survivors).toHaveLength(1);
    expect(survivors[0].spotPayload).toEqual({ id: "transient" });
    expect(survivors[0].attempts).toBe(1);
  });
});
