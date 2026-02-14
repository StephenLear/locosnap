import { makeTrain, makeSpecs } from "../fixtures";

jest.mock("../../config/env", () => ({
  config: {
    openaiApiKey: "test-openai-key",
    replicateApiToken: "",
    hasOpenAI: true,
    hasReplicate: false,
    hasImageGen: true,
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

import {
  startBlueprintGeneration,
  getTaskStatus,
  cleanupOldTasks,
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

  it("task starts in queued status", async () => {
    mockAxiosPost.mockImplementation(() => new Promise(() => {})); // never resolves

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs());
    const task = getTaskStatus(taskId);
    expect(task).not.toBeNull();
    expect(["queued", "processing"]).toContain(task!.status);
  });

  it("getTaskStatus returns null for unknown task", () => {
    const result = getTaskStatus("nonexistent-task-id");
    expect(result).toBeNull();
  });

  it("cleanupOldTasks removes expired tasks", async () => {
    mockAxiosPost.mockImplementation(() => new Promise(() => {}));

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs());

    // Manually age the task
    const task = getTaskStatus(taskId);
    if (task) {
      task.createdAt = new Date(Date.now() - 7200000); // 2 hours ago
    }

    cleanupOldTasks(3600000); // 1 hour TTL
    expect(getTaskStatus(taskId)).toBeNull();
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
