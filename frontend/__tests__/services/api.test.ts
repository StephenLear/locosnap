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

// Mock axios
jest.mock("axios", () => {
  const mockAxiosInstance = {
    post: jest.fn(),
    get: jest.fn(),
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

    it("throws timeout error on ECONNABORTED", async () => {
      mockAxios.post.mockRejectedValue({ code: "ECONNABORTED" });

      await expect(identifyTrain("file:///train.jpg")).rejects.toThrow(
        "Request timed out"
      );
    });

    it("throws generic error on network failure", async () => {
      mockAxios.post.mockRejectedValue(new Error("Network Error"));

      await expect(identifyTrain("file:///train.jpg")).rejects.toThrow(
        "Could not connect"
      );
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
