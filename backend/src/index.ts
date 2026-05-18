// ============================================================
// LocoSnap Backend — Express Server
// ============================================================

import express from "express";
import cors from "cors";
import { config, assertProductionConfig } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import identifyRouter from "./routes/identify";
import blueprintStatusRouter from "./routes/imageStatus";
import webhooksRouter from "./routes/webhooks";
import creditsRouter from "./routes/credits";
import adminRouter from "./routes/admin";
import { getVisionProvider } from "./services/vision";
import { getSupabase } from "./config/supabase";
import { getCacheStats } from "./services/trainCache";
import { initAnalytics, Sentry, flushAnalytics } from "./services/analytics";
import { initRedis, getRedisStatus, pingRedis } from "./services/redis";

// ── Production env invariants — crash loud on misconfig ─────
assertProductionConfig();

// ── Analytics + Error Tracking ───────────────────────────────
initAnalytics();

// ── Redis (blueprint task store) ─────────────────────────────
initRedis();

const app = express();

// ── Middleware ───────────────────────────────────────────────
// Sentry request handler must be the first middleware
Sentry.setupExpressErrorHandler(app);

// Build allowed origins — always include Expo dev URLs.
// `cors` does exact string match, so `exp://` schemes need a function matcher.
const exactOrigins: string[] = [
  config.frontendUrl,
  "http://localhost:19006",
  "http://localhost:8081",
];
if (config.nodeEnv === "production") {
  exactOrigins.push("https://locosnap.app");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // No-origin requests (server-to-server, native fetch, curl) are allowed.
      if (!origin) return callback(null, true);
      if (exactOrigins.includes(origin)) return callback(null, true);
      // Expo dev clients send exp:// scheme origins.
      if (origin.startsWith("exp://") || origin.startsWith("exps://")) {
        return callback(null, true);
      }
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// ── Routes ──────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  await pingRedis(); // keeps Upstash alive — must send real traffic

  // Verify Supabase is actually reachable (not just configured).
  // A cheap RLS-safe ping on a single row that requires no auth context.
  let supabaseStatus: "ok" | "down" | "not_configured" = "not_configured";
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("trains")
        .select("id", { count: "exact", head: true })
        .limit(1);
      supabaseStatus = error ? "down" : "ok";
    } catch {
      supabaseStatus = "down";
    }
  }

  const overall = supabaseStatus === "down" ? "degraded" : "ok";
  res.status(overall === "ok" ? 200 : 503).json({
    status: overall,
    service: "LocoSnap API",
    version: "1.0.0",
    visionProvider: getVisionProvider(),
    supabase: supabaseStatus,
    blueprintGenAvailable: config.hasImageGen,
    redis: getRedisStatus(),
    cache: getCacheStats(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/identify", identifyRouter);
app.use("/api/blueprint", blueprintStatusRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/credits", creditsRouter);
app.use("/api/admin", adminRouter);

// ── Error Handling ──────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────
app.listen(config.port, () => {
  const stats = getCacheStats();
  console.log(`
╔══════════════════════════════════════════════╗
║          LocoSnap API Server                 ║
╠══════════════════════════════════════════════╣
║  Port:        ${String(config.port).padEnd(30)}║
║  Environment: ${config.nodeEnv.padEnd(30)}║
║  Vision:      ${getVisionProvider().padEnd(30)}║
║  Blueprints:  ${(config.hasImageGen ? "Ready" : "Not configured").padEnd(30)}║
║  Anthropic:   ${(config.hasAnthropic ? "Yes" : "No").padEnd(30)}║
║  OpenAI:      ${(config.hasOpenAI ? "Yes" : "No").padEnd(30)}║
║  Replicate:   ${(config.hasReplicate ? "Yes" : "No").padEnd(30)}║
║  Supabase:    ${(config.hasSupabase ? "Connected" : "Not configured").padEnd(30)}║
║  RevenueCat:  ${(config.hasRevenueCat ? "Webhook ready" : "Not configured").padEnd(30)}║
║  Resend:      ${(config.hasResend ? "Ready" : "Not configured").padEnd(30)}║
║  SupabaseHook:${(config.hasSupabaseWebhook ? "Ready" : "Not configured").padEnd(30)}║
║  Redis:       ${getRedisStatus().padEnd(30)}║
║  Cache:       ${`${stats.totalEntries} trains cached`.padEnd(30)}║
╚══════════════════════════════════════════════╝

Endpoints:
  POST /api/identify        — Upload train photo for identification
  GET  /api/blueprint/:id   — Check blueprint generation status
  POST /api/webhooks/revenuecat — RevenueCat subscription webhook
  POST /api/webhooks/supabase   — Supabase Auth user.created (welcome email)
  POST /api/credits/deduct      — Deduct 1 blueprint credit
  GET  /api/credits/balance     — Check credit balance
  GET  /api/health              — Health check
  `);
});

export default app;
