// Mock react-native Platform (api.ts imports it for web/native branching)
jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

// Mock the api constants before importing
jest.mock("../../constants/api", () => ({
  API_BASE_URL: "http://localhost:3000",
  BLUEPRINT_POLL_INTERVAL: 100,
  BLUEPRINT_TIMEOUT: 500,
}));

// Mock settingsStore so api.ts can call getState().language without RN deps
jest.mock("../../store/settingsStore", () => ({
  useSettingsStore: {
    getState: jest.fn(() => ({ language: "en" })),
  },
}));

// Mock Supabase client — prevents "supabaseUrl is required" error in tests
// and provides a no-session stub for the auth token interceptor
jest.mock("../../config/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({ data: { session: null }, error: null })
      ),
    },
  },
}));

// Mock axios — includes interceptors stub so api.ts can call
// api.interceptors.request.use() without throwing
jest.mock("axios", () => {
  const mockAxiosInstance = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    create: jest.fn(() => mockAxiosInstance),
    __mockInstance: mockAxiosInstance,
  };
});

import axios from "axios";
import {
  identifyTrain,
  checkBlueprintStatus,
  healthCheck,
  pollBlueprintStatus,
} from "../../services/api";

const mockAxios = (axios as any).__mockInstance;

describe("API client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // mockReset clears the mockResolvedValueOnce / mockRejectedValueOnce queue
    // which clearAllMocks does not. Without this, queued one-time values can
    // leak into subsequent tests.
    mockAxios.post.mockReset();
    mockAxios.get.mockReset();
  });

  describe("identifyTrain", () => {
    it("sends FormData with image and returns response", async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            train: { class: "Class 390" },
            specs: { maxSpeed: "125 mph" },
            rarity: { tier: "common" },
            blueprint: { taskId: "task-1", status: "queued" },
          },
          error: null,
          processingTimeMs: 500,
        },
      };
      mockAxios.post.mockResolvedValue(mockResponse);

      const result = await identifyTrain("file:///train.jpg");
      expect(result.success).toBe(true);
      expect(result.data?.train.class).toBe("Class 390");
      expect(mockAxios.post).toHaveBeenCalledWith(
        "/api/identify",
        expect.any(FormData),
        expect.objectContaining({
          headers: { "Content-Type": "multipart/form-data" },
        })
      );
    });

    it("passes blueprint style parameter", async () => {
      mockAxios.post.mockResolvedValue({
        data: { success: true, data: null, error: null, processingTimeMs: 100 },
      });

      await identifyTrain("file:///train.jpg", "vintage");
      expect(mockAxios.post).toHaveBeenCalled();
    });

    it("throws on API error response", async () => {
      mockAxios.post.mockRejectedValue({
        response: { data: { error: "No train found" } },
      });

      await expect(identifyTrain("file:///cat.jpg")).rejects.toThrow(
        "No train found"
      );
    });

    it("retries once on ECONNABORTED and throws timeout if retry also times out", async () => {
      mockAxios.post.mockRejectedValue({ code: "ECONNABORTED" });

      await expect(identifyTrain("file:///train.jpg")).rejects.toThrow(
        "Request timed out"
      );
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
    });

    it("retries once on ECONNABORTED and succeeds if retry succeeds", async () => {
      mockAxios.post
        .mockRejectedValueOnce({ code: "ECONNABORTED" })
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              train: { class: "Class 390" },
              specs: { maxSpeed: "125 mph" },
              rarity: { tier: "common" },
              blueprint: { taskId: "task-1", status: "queued" },
            },
            error: null,
            processingTimeMs: 500,
          },
        });

      const result = await identifyTrain("file:///train.jpg");
      expect(result.success).toBe(true);
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
    });

    it("retries once on connection failure and throws generic error if retry also fails", async () => {
      mockAxios.post.mockRejectedValue(new Error("Network Error"));

      await expect(identifyTrain("file:///train.jpg")).rejects.toThrow(
        "Could not connect"
      );
      expect(mockAxios.post).toHaveBeenCalledTimes(2);
    });

    it("includes language field from settingsStore in the request body", async () => {
      const { useSettingsStore } = require("../../store/settingsStore");
      // Override to return "de" for this test
      (useSettingsStore.getState as jest.Mock).mockReturnValue({ language: "de" });

      mockAxios.post.mockResolvedValue({
        data: { success: true, data: null, error: null, processingTimeMs: 100 },
      });

      await identifyTrain("file:///train.jpg");

      const formDataArg: FormData = mockAxios.post.mock.calls[0][1];
      // FormData in Node/jest environment exposes _parts or get(); use the
      // internal jest FormData which has a .get() method via our global mock
      expect((formDataArg as any).get("language")).toBe("de");
    });
  });

  describe("checkBlueprintStatus", () => {
    it("returns blueprint status", async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          taskId: "task-1",
          status: "completed",
          imageUrl: "https://example.com/bp.png",
          error: null,
        },
      });

      const result = await checkBlueprintStatus("task-1");
      expect(result.status).toBe("completed");
      expect(result.imageUrl).toBe("https://example.com/bp.png");
    });

    it("throws on error", async () => {
      mockAxios.get.mockRejectedValue(new Error("Not found"));
      await expect(checkBlueprintStatus("bad-id")).rejects.toThrow(
        "Could not check blueprint status"
      );
    });
  });

  describe("healthCheck", () => {
    it("returns true when backend is healthy", async () => {
      mockAxios.get.mockResolvedValue({ data: { status: "ok" } });
      const result = await healthCheck();
      expect(result).toBe(true);
    });

    it("returns false on error", async () => {
      mockAxios.get.mockRejectedValue(new Error("ECONNREFUSED"));
      const result = await healthCheck();
      expect(result).toBe(false);
    });
  });

  describe("pollBlueprintStatus", () => {
    it("resolves with imageUrl when completed", async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          taskId: "task-1",
          status: "completed",
          imageUrl: "https://example.com/bp.png",
          error: null,
        },
      });

      const onUpdate = jest.fn();
      const { promise } = pollBlueprintStatus("task-1", onUpdate);
      const result = await promise;

      expect(result).toBe("https://example.com/bp.png");
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ status: "completed" })
      );
    });

    it("resolves with null when failed", async () => {
      mockAxios.get.mockResolvedValue({
        data: {
          taskId: "task-1",
          status: "failed",
          imageUrl: null,
          error: "Generation failed",
        },
      });

      const onUpdate = jest.fn();
      const { promise } = pollBlueprintStatus("task-1", onUpdate);
      const result = await promise;

      expect(result).toBeNull();
    });

    it("cancel stops further polling", async () => {
      let callCount = 0;
      mockAxios.get.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          data: {
            taskId: "task-1",
            status: "processing",
            imageUrl: null,
            error: null,
          },
        });
      });

      const onUpdate = jest.fn();
      const { cancel } = pollBlueprintStatus("task-1", onUpdate);

      // Let first poll complete and schedule next
      await new Promise((r) => setTimeout(r, 50));
      const callsBeforeCancel = callCount;
      cancel();

      // Wait long enough that more polls would have fired
      await new Promise((r) => setTimeout(r, 300));
      // After cancel, no additional polls should have been made
      expect(callCount).toBeLessThanOrEqual(callsBeforeCancel + 1);
    }, 10000);
  });
});
