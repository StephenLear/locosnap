// ============================================================
// Admin route — gating + happy-path tests
// ============================================================

import request from "supertest";
import express from "express";

// Stub config so we can flip ADMIN_SECRET on/off per suite. Imported
// before the route module so the gate sees our mocked config.
jest.mock("../../config/env", () => ({
  config: {
    adminSecret: "test-secret",
    get hasAdminSecret() {
      return this.adminSecret.length > 0;
    },
  },
}));

const mockRunReset = jest.fn();
jest.mock("../../cron/leagueWeeklyReset", () => ({
  runLeagueWeeklyReset: (...args: unknown[]) => mockRunReset(...args),
}));

const mockGetSupabase = jest.fn();
jest.mock("../../config/supabase", () => ({
  getSupabase: () => mockGetSupabase(),
}));

import adminRouter from "../../routes/admin";
import { config } from "../../config/env";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin", adminRouter);
  return app;
}

describe("admin auth gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (config as { adminSecret: string }).adminSecret = "test-secret";
    mockGetSupabase.mockReturnValue({});
    mockRunReset.mockResolvedValue({ status: "completed" });
  });

  it("returns 401 without bearer token", async () => {
    const res = await request(buildApp()).post(
      "/api/admin/league-reset/2026-05-04T00:00:00.000Z"
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong bearer token", async () => {
    const res = await request(buildApp())
      .post("/api/admin/league-reset/2026-05-04T00:00:00.000Z")
      .set("authorization", "Bearer wrong");
    expect(res.status).toBe(401);
  });

  it("returns 503 when ADMIN_SECRET is unset", async () => {
    (config as { adminSecret: string }).adminSecret = "";
    const res = await request(buildApp())
      .post("/api/admin/league-reset/2026-05-04T00:00:00.000Z")
      .set("authorization", "Bearer test-secret");
    expect(res.status).toBe(503);
  });
});

describe("POST /api/admin/league-reset/:weekStartUtc", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (config as { adminSecret: string }).adminSecret = "test-secret";
    mockGetSupabase.mockReturnValue({});
    mockRunReset.mockResolvedValue({
      status: "completed",
      weekStartUtc: "2026-05-04T00:00:00.000Z",
      promoted: 5,
      demoted: 5,
      ghostsDropped: 0,
      freezesAwarded: 3,
      freezesBurned: 0,
      boostsAwarded: 5,
    });
  });

  it("rejects a non-Monday boundary with 400 + canonical hint", async () => {
    // Wednesday 2026-05-06 — not a Monday
    const res = await request(buildApp())
      .post("/api/admin/league-reset/2026-05-06T00:00:00.000Z")
      .set("authorization", "Bearer test-secret");
    expect(res.status).toBe(400);
    expect(res.body.expected).toBe("2026-05-04T00:00:00.000Z");
    expect(mockRunReset).not.toHaveBeenCalled();
  });

  it("rejects an unparseable date with 400", async () => {
    const res = await request(buildApp())
      .post("/api/admin/league-reset/not-a-date")
      .set("authorization", "Bearer test-secret");
    expect(res.status).toBe(400);
    expect(mockRunReset).not.toHaveBeenCalled();
  });

  it("returns 503 when supabase is not configured", async () => {
    mockGetSupabase.mockReturnValue(null);
    const res = await request(buildApp())
      .post("/api/admin/league-reset/2026-05-04T00:00:00.000Z")
      .set("authorization", "Bearer test-secret");
    expect(res.status).toBe(503);
  });

  it("invokes runLeagueWeeklyReset and returns the summary on a valid Monday", async () => {
    const res = await request(buildApp())
      .post("/api/admin/league-reset/2026-05-04T00:00:00.000Z")
      .set("authorization", "Bearer test-secret");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
    expect(res.body.promoted).toBe(5);
    expect(mockRunReset).toHaveBeenCalledTimes(1);
    const [, weekArg] = mockRunReset.mock.calls[0];
    expect((weekArg as Date).toISOString()).toBe("2026-05-04T00:00:00.000Z");
  });
});
