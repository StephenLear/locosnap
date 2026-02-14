import request from "supertest";
import express from "express";

jest.mock("../../config/env", () => ({
  config: {
    revenuecatWebhookSecret: "test-secret-123",
    hasRevenueCat: true,
    hasSupabase: false,
  },
}));

jest.mock("../../config/supabase", () => ({
  getSupabase: jest.fn().mockReturnValue(null),
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

describe("POST /api/webhooks/revenuecat", () => {
  const app = buildApp();

  it("returns 401 for missing authorization", async () => {
    const res = await request(app)
      .post("/api/webhooks/revenuecat")
      .send({ event: { type: "INITIAL_PURCHASE", app_user_id: "u1" } });

    expect(res.status).toBe(401);
  });

  it("returns 401 for wrong secret", async () => {
    const res = await request(app)
      .post("/api/webhooks/revenuecat")
      .set("Authorization", "Bearer wrong-secret")
      .send({ event: { type: "INITIAL_PURCHASE", app_user_id: "u1" } });

    expect(res.status).toBe(401);
  });

  it("returns 400 when event payload is missing", async () => {
    const res = await request(app)
      .post("/api/webhooks/revenuecat")
      .set("Authorization", "Bearer test-secret-123")
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 200 for valid event (no Supabase)", async () => {
    const res = await request(app)
      .post("/api/webhooks/revenuecat")
      .set("Authorization", "Bearer test-secret-123")
      .send({
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user-123",
          product_id: "pro_monthly",
          id: "evt-1",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
