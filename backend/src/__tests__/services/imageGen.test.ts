import { makeTrain, makeSpecs } from "../fixtures";

jest.mock("../../config/env", () => ({
  config: {
    openaiApiKey: "test-openai-key",
    replicateApiToken: "",
    hasOpenAI: true,
    hasReplicate: false,
    hasImageGen: true,
    hasSupabase: true,
    redisUrl: "",
    hasRedis: false,
  },
}));

// Mock axios for OpenAI gpt-image-1 calls (preserve isAxiosError for error path)
jest.mock("axios", () => ({
  post: jest.fn(),
  isAxiosError: (e: any) => Boolean(e?.isAxiosError),
}));

// Mock Supabase Storage — gpt-image-1 base64 is uploaded, returns a public URL
const mockStorageUpload = jest.fn(async () => ({ error: null }));
const mockGetPublicUrl = jest.fn((path: string) => ({
  data: { publicUrl: `https://supabase.test/storage/v1/object/public/blueprints/${path}` },
}));
jest.mock("../../config/supabase", () => ({
  getSupabase: jest.fn(() => ({
    storage: {
      from: () => ({ upload: mockStorageUpload, getPublicUrl: mockGetPublicUrl }),
    },
  })),
}));

// Mock analytics (Sentry capture) — keep failure path quiet in tests
jest.mock("../../services/analytics", () => ({
  captureServerError: jest.fn(),
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

const B64_PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mნ"; // dummy base64

/** Poll the task store until the background generateImage settles. */
async function waitForSettled(taskId: string) {
  for (let i = 0; i < 50; i++) {
    const task = await getTaskStatus(taskId);
    if (task && (task.status === "completed" || task.status === "failed")) return task;
    await new Promise((r) => setTimeout(r, 5));
  }
  return getTaskStatus(taskId);
}

describe("imageGen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageUpload.mockResolvedValue({ error: null });
  });

  it("startBlueprintGeneration returns a task ID", async () => {
    mockAxiosPost.mockResolvedValue({ data: { data: [{ b64_json: B64_PIXEL }] } });

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

  it("calls OpenAI with gpt-image-1 params (size/quality, no style)", async () => {
    mockAxiosPost.mockResolvedValue({ data: { data: [{ b64_json: B64_PIXEL }] } });

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs());
    await waitForSettled(taskId);

    const body = mockAxiosPost.mock.calls[0][1];
    expect(body.model).toBe("gpt-image-1");
    expect(body.size).toBe("1024x1536");
    expect(body.quality).toBe("medium");
    expect(body.style).toBeUndefined();
    expect(body.prompt).toContain("engineering");
  });

  it("uploads base64 to Supabase Storage and completes with the public URL", async () => {
    mockAxiosPost.mockResolvedValue({ data: { data: [{ b64_json: B64_PIXEL }] } });

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs());
    const task = await waitForSettled(taskId);

    expect(mockStorageUpload).toHaveBeenCalledTimes(1);
    expect(task!.status).toBe("completed");
    expect(task!.imageUrl).toBe(
      `https://supabase.test/storage/v1/object/public/blueprints/${taskId}.png`
    );
  });

  it("fails with OpenAI's real reason when the API rejects the request", async () => {
    mockAxiosPost.mockRejectedValue({
      isAxiosError: true,
      message: "Request failed with status code 400",
      response: { data: { error: { message: "Invalid model 'dall-e-3'" } } },
    });

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs());
    const task = await waitForSettled(taskId);

    expect(task!.status).toBe("failed");
    expect(task!.error).toContain("Invalid model 'dall-e-3'");
  });

  it("accepts different blueprint styles", async () => {
    mockAxiosPost.mockResolvedValue({ data: { data: [{ b64_json: B64_PIXEL }] } });

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs(), "vintage");
    expect(taskId).toBeDefined();
  });
});
