import request from "supertest";
import express from "express";

const mockGetTaskStatus = jest.fn();
jest.mock("../../services/imageGen", () => ({
  getTaskStatus: (...args: any[]) => mockGetTaskStatus(...args),
}));

import blueprintStatusRouter from "../../routes/imageStatus";

function buildApp() {
  const app = express();
  app.use("/api/blueprint", blueprintStatusRouter);
  return app;
}

describe("GET /api/blueprint/:taskId", () => {
  const app = buildApp();

  beforeEach(() => jest.clearAllMocks());

  it("returns 404 for unknown task", async () => {
    mockGetTaskStatus.mockResolvedValue(null);

    const res = await request(app).get("/api/blueprint/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.status).toBe("not_found");
  });

  it("returns queued status", async () => {
    mockGetTaskStatus.mockResolvedValue({
      taskId: "task-1",
      status: "queued",
      imageUrl: null,
      error: null,
    });

    const res = await request(app).get("/api/blueprint/task-1");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("queued");
    expect(res.body.imageUrl).toBeNull();
  });

  it("returns completed status with image URL", async () => {
    mockGetTaskStatus.mockResolvedValue({
      taskId: "task-2",
      status: "completed",
      imageUrl: "https://example.com/blueprint.png",
      error: null,
    });

    const res = await request(app).get("/api/blueprint/task-2");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
    expect(res.body.imageUrl).toBe("https://example.com/blueprint.png");
  });

  it("returns failed status with error", async () => {
    mockGetTaskStatus.mockResolvedValue({
      taskId: "task-3",
      status: "failed",
      imageUrl: null,
      error: "Generation timed out",
    });

    const res = await request(app).get("/api/blueprint/task-3");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");
    expect(res.body.error).toBe("Generation timed out");
  });
});
