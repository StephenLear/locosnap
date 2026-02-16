// ============================================================
// LocoSnap Backend — Express Server
// ============================================================

import express from "express";
import cors from "cors";
import { config } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import identifyRouter from "./routes/identify";
import blueprintStatusRouter from "./routes/imageStatus";
import webhooksRouter from "./routes/webhooks";
import { getVisionProvider } from "./services/vision";
import { getSupabase } from "./config/supabase";
import { loadCache, getCacheStats } from "./services/trainCache";
import { initAnalytics, Sentry, flushAnalytics } from "./services/analytics";
import { initRedis, getRedisStatus } from "./services/redis";

// ── Analytics + Error Tracking ───────────────────────────────
initAnalytics();

// ── Redis (blueprint task store) ─────────────────────────────
initRedis();

const app = express();

// ── Middleware ───────────────────────────────────────────────
// Sentry request handler must be the first middleware
Sentry.setupExpressErrorHandler(app);

// Build allowed origins — always include Expo dev URLs
const allowedOrigins: string[] = [
  config.frontendUrl,
  "exp://",
  "http://localhost:19006",
  "http://localhost:8081",
];
// In production, also allow the Render URL and any custom domain
if (config.nodeEnv === "production") {
  allowedOrigins.push("https://locosnap.app");
}

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// ── Routes ──────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "LocoSnap API",
    version: "1.0.0",
    visionProvider: getVisionProvider(),
    supabase: config.hasSupabase ? "connected" : "not configured",
    blueprintGenAvailable: config.hasImageGen,
    redis: getRedisStatus(),
    cache: getCacheStats(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/identify", identifyRouter);
app.use("/api/blueprint", blueprintStatusRouter);
app.use("/api/webhooks", webhooksRouter);

// ── Error Handling ──────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Load train cache from disk ──────────────────────────────
loadCache();

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
║  Redis:       ${getRedisStatus().padEnd(30)}║
║  Cache:       ${`${stats.totalEntries} trains cached`.padEnd(30)}║
╚══════════════════════════════════════════════╝

Endpoints:
  POST /api/identify        — Upload train photo for identification
  GET  /api/blueprint/:id   — Check blueprint generation status
  POST /api/webhooks/revenuecat — RevenueCat subscription webhook
  GET  /api/health          — Health check
  `);
});

export default app;
