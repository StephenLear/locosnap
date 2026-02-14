import { makeTrain, makeSpecs } from "../fixtures";

jest.mock("../../config/env", () => ({
  config: {
    openaiApiKey: "test-openai-key",
    replicateApiToken: "",
    hasOpenAI: true,
    hasReplicate: false,
    hasImageGen: true,
    redisUrl: "",
    hasRedis: false,
  },
}));

// Mock axios for DALL-E 3 calls
jest.mock("axios", () => ({
  post: jest.fn(),
}));

// Mock Replicate (not used in these tests but imported at module level)
jest.mock("replicate", () => {
  return jest.fn().mockImplementation(() => ({}));
});

// Mock Redis — use in-memory fallback (no actual Redis needed)
jest.mock("../../services/redis", () => {
  const store = new Map<string, string>();
  return {
    initRedis: jest.fn(),
    setBlueprintTask: jest.fn(async (taskId: string, task: any) => {
      store.set(taskId, JSON.stringify({
        ...task,
        createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
        completedAt: task.completedAt instanceof Date ? task.completedAt.toISOString() : task.completedAt,
      }));
    }),
    getBlueprintTask: jest.fn(async (taskId: string) => {
      const raw = store.get(taskId);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
        completedAt: parsed.completedAt ? new Date(parsed.completedAt) : null,
      };
    }),
    deleteBlueprintTask: jest.fn(async (taskId: string) => {
      store.delete(taskId);
    }),
    getRedisStatus: jest.fn(() => "in-memory fallback"),
  };
});

import {
  startBlueprintGeneration,
  getTaskStatus,
} from "../../services/imageGen";
import axios from "axios";

const mockAxiosPost = axios.post as jest.Mock;

describe("imageGen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("startBlueprintGeneration returns a task ID", async () => {
    mockAxiosPost.mockResolvedValue({
      data: { data: [{ url: "https://example.com/blueprint.png" }] },
    });

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs());
    expect(taskId).toBeDefined();
    expect(typeof taskId).toBe("string");
    expect(taskId.length).toBeGreaterThan(0);
  });

  it("task starts in queued or processing status", async () => {
    mockAxiosPost.mockImplementation(() => new Promise(() => {})); // never resolves

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs());
    const task = await getTaskStatus(taskId);
    expect(task).not.toBeNull();
    expect(["queued", "processing"]).toContain(task!.status);
  });

  it("getTaskStatus returns null for unknown task", async () => {
    const result = await getTaskStatus("nonexistent-task-id");
    expect(result).toBeNull();
  });

  it("accepts different blueprint styles", async () => {
    mockAxiosPost.mockResolvedValue({
      data: { data: [{ url: "https://example.com/vintage.png" }] },
    });

    const taskId = await startBlueprintGeneration(
      makeTrain(),
      makeSpecs(),
      "vintage"
    );
    expect(taskId).toBeDefined();
  });

  it("defaults to technical style", async () => {
    mockAxiosPost.mockResolvedValue({
      data: { data: [{ url: "https://example.com/tech.png" }] },
    });

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs());
    expect(taskId).toBeDefined();
    // Verify the prompt was passed to axios containing engineering keywords
    const callArgs = mockAxiosPost.mock.calls[0];
    if (callArgs) {
      const body = callArgs[1];
      expect(body.prompt).toContain("engineering");
    }
  });
});
