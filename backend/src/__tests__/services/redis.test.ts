import { makeBlueprintTask } from "../fixtures";

// Mock ioredis — use in-memory fallback path
jest.mock("../../config/env", () => ({
  config: {
    redisUrl: "", // empty = in-memory fallback
    hasRedis: false,
  },
}));

// Reset module between tests to get clean state
let setBlueprintTask: any;
let getBlueprintTask: any;
let deleteBlueprintTask: any;
let getRedisStatus: any;
let initRedis: any;

beforeEach(() => {
  jest.resetModules();
  const redis = require("../../services/redis");
  setBlueprintTask = redis.setBlueprintTask;
  getBlueprintTask = redis.getBlueprintTask;
  deleteBlueprintTask = redis.deleteBlueprintTask;
  getRedisStatus = redis.getRedisStatus;
  initRedis = redis.initRedis;
  initRedis();
});

describe("redis (in-memory fallback)", () => {
  it("reports in-memory fallback status", () => {
    expect(getRedisStatus()).toBe("in-memory fallback");
  });

  it("stores and retrieves a blueprint task", async () => {
    const task = makeBlueprintTask({ taskId: "redis-test-1" });
    await setBlueprintTask("redis-test-1", task);

    const result = await getBlueprintTask("redis-test-1");
    expect(result).not.toBeNull();
    expect(result!.taskId).toBe("redis-test-1");
    expect(result!.status).toBe("queued");
  });

  it("returns null for missing task", async () => {
    const result = await getBlueprintTask("nonexistent");
    expect(result).toBeNull();
  });

  it("deletes a task", async () => {
    const task = makeBlueprintTask({ taskId: "redis-test-2" });
    await setBlueprintTask("redis-test-2", task);
    await deleteBlueprintTask("redis-test-2");

    const result = await getBlueprintTask("redis-test-2");
    expect(result).toBeNull();
  });

  it("preserves Date objects through serialization", async () => {
    const task = makeBlueprintTask({
      taskId: "redis-test-3",
      createdAt: new Date("2026-01-15T10:30:00Z"),
    });
    await setBlueprintTask("redis-test-3", task);

    const result = await getBlueprintTask("redis-test-3");
    expect(result!.createdAt).toBeInstanceOf(Date);
    expect(result!.createdAt.toISOString()).toBe("2026-01-15T10:30:00.000Z");
  });
});
