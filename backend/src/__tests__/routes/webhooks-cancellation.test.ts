import request from "supertest";
import express from "express";

const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
const mockFrom = jest.fn(() => ({ insert: mockInsert }));

jest.mock("../../config/env", () => ({
  config: {
    revenuecatWebhookSecret: "test-secret-123",
    hasRevenueCat: true,
    hasSupabase: true,
  },
}));

jest.mock("../../config/supabase", () => ({
  getSupabase: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock("../../services/analytics", () => ({
  trackServerEvent: jest.fn(),
  captureServerError: jest.fn(),
}));

import webhooksRouter from "../../routes/webhooks";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/webhooks", webhooksRouter);
  return app;
}

const VALID_UUID = "00000000-0000-0000-0000-000000000001";

describe("POST /api/webhooks/revenuecat — CANCELLATION event", () => {
  const app = buildApp();

  beforeEach(() => {
    mockInsert.mockClear();
    mockFrom.mockClear();
  });

  it("logs a CANCELLATION event into cancellation_reasons", async () => {
    const purchasedHoursAgo = 12;
    const event = {
      id: "rc-evt-cancel-001",
      type: "CANCELLATION",
      app_user_id: VALID_UUID,
      product_id: "pro_monthly",
      store: "APP_STORE",
      cancel_reason: "USER_CANCELLED",
      period_type: "NORMAL",
      purchased_at_ms: Date.now() - purchasedHoursAgo * 60 * 60 * 1000,
      event_timestamp_ms: Date.now(),
    };

    const res = await request(app)
      .post("/api/webhooks/revenuecat")
      .set("Authorization", "Bearer test-secret-123")
      .send({ event });

    expect(res.status).toBe(200);
    expect(mockFrom).toHaveBeenCalledWith("cancellation_reasons");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        rc_event_id: "rc-evt-cancel-001",
        product_id: "pro_monthly",
        store: "app_store",
        was_in_trial: false,
        cancellation_reason: "USER_CANCELLED",
      })
    );
  });

  it("marks was_in_trial=true when period_type is TRIAL", async () => {
    const event = {
      id: "rc-evt-cancel-002",
      type: "CANCELLATION",
      app_user_id: VALID_UUID,
      product_id: "pro_annual",
      store: "PLAY_STORE",
      cancel_reason: "USER_CANCELLED",
      period_type: "TRIAL",
      purchased_at_ms: Date.now() - 1000 * 60 * 60 * 24 * 3,
      event_timestamp_ms: Date.now(),
    };

    await request(app)
      .post("/api/webhooks/revenuecat")
      .set("Authorization", "Bearer test-secret-123")
      .send({ event });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        was_in_trial: true,
        store: "play_store",
      })
    );
  });

  it("computes hours_since_purchase correctly", async () => {
    const purchasedHoursAgo = 5.5;
    const event = {
      id: "rc-evt-cancel-003",
      type: "CANCELLATION",
      app_user_id: VALID_UUID,
      product_id: "pro_monthly",
      store: "APP_STORE",
      cancel_reason: "USER_CANCELLED",
      period_type: "NORMAL",
      purchased_at_ms: Date.now() - purchasedHoursAgo * 60 * 60 * 1000,
      event_timestamp_ms: Date.now(),
    };

    await request(app)
      .post("/api/webhooks/revenuecat")
      .set("Authorization", "Bearer test-secret-123")
      .send({ event });

    const cancelInsertCall = mockInsert.mock.calls.find(
      (c) =>
        c[0].rc_event_id === "rc-evt-cancel-003" &&
        c[0].store !== undefined
    );
    expect(cancelInsertCall).toBeDefined();
    const payload = cancelInsertCall![0];
    expect(payload.hours_since_purchase).toBeGreaterThan(5.4);
    expect(payload.hours_since_purchase).toBeLessThan(5.6);
  });

  it("skips non-UUID app_user_id (anonymous users)", async () => {
    const event = {
      id: "rc-evt-cancel-004",
      type: "CANCELLATION",
      app_user_id: "$RCAnonymousID:abc123",
      product_id: "pro_monthly",
      store: "APP_STORE",
      cancel_reason: "USER_CANCELLED",
      period_type: "NORMAL",
      purchased_at_ms: Date.now() - 1000 * 60 * 60,
      event_timestamp_ms: Date.now(),
    };

    const res = await request(app)
      .post("/api/webhooks/revenuecat")
      .set("Authorization", "Bearer test-secret-123")
      .send({ event });

    expect(res.status).toBe(200);
    expect(mockFrom).not.toHaveBeenCalledWith("cancellation_reasons");
  });
});
