// ============================================================
// LocoSnap Backend — Express Server
// ============================================================

import express from "express";
import cors from "cors";
import { config } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import identifyRouter from "./routes/identify";
import blueprintStatusRouter from "./routes/imageStatus";
import { cleanupOldTasks } from "./services/imageGen";
import { getVisionProvider } from "./services/vision";
import { getSupabase } from "./config/supabase";
import { loadCache, getCacheStats } from "./services/trainCache";

const app = express();

// ── Middleware ───────────────────────────────────────────────
app.use(
  cors({
    origin: [config.frontendUrl, "exp://", "http://localhost:19006"],
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
    cache: getCacheStats(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/identify", identifyRouter);
app.use("/api/blueprint", blueprintStatusRouter);

// ── Error Handling ──────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Periodic Cleanup ────────────────────────────────────────
// Clean up old blueprint generation tasks every 30 minutes
setInterval(
  () => {
    cleanupOldTasks();
  },
  30 * 60 * 1000
);

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
║  Cache:       ${`${stats.totalEntries} trains cached`.padEnd(30)}║
╚══════════════════════════════════════════════╝

Endpoints:
  POST /api/identify        — Upload train photo for identification
  GET  /api/blueprint/:id   — Check blueprint generation status
  GET  /api/health          — Health check
  `);
});

export default app;
