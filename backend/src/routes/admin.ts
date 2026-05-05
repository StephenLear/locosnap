// ============================================================
// LocoSnap — Admin endpoints
//
// All routes here are gated on a bearer token matching env
// ADMIN_SECRET. When ADMIN_SECRET is empty (default), every request
// returns 503 — never accidentally exposed in dev.
// ============================================================

import { Router, type Request, type Response, type NextFunction } from "express";
import { config } from "../config/env";
import { getSupabase } from "../config/supabase";
import { runLeagueWeeklyReset } from "../cron/leagueWeeklyReset";
import { weekStartUtc } from "../services/leagues";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!config.hasAdminSecret) {
    res.status(503).json({ error: "admin endpoints disabled" });
    return;
  }
  const auth = req.header("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1] !== config.adminSecret) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

router.use(requireAdmin);

// POST /api/admin/league-reset/:weekStartUtc
// Manual replay of the weekly league cron for a specific Sunday-boundary
// week. Idempotent — re-running for an already-completed week returns
// status: "skipped_already_run".
router.post("/league-reset/:weekStartUtc", async (req: Request, res: Response) => {
  const supabase = getSupabase();
  if (!supabase) {
    res.status(503).json({ error: "supabase not configured" });
    return;
  }

  const raw = req.params.weekStartUtc;
  if (typeof raw !== "string") {
    res.status(400).json({ error: "invalid weekStartUtc" });
    return;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    res.status(400).json({ error: "invalid weekStartUtc — expected ISO date" });
    return;
  }

  // Normalize to the canonical Monday 00:00 UTC for the week. Reject if
  // the caller-supplied value isn't already on that boundary — forces
  // explicit intent rather than silently snapping.
  const canonical = weekStartUtc(parsed);
  if (canonical.getTime() !== parsed.getTime()) {
    res.status(400).json({
      error: "weekStartUtc must be Monday 00:00 UTC",
      expected: canonical.toISOString(),
    });
    return;
  }

  const summary = await runLeagueWeeklyReset(supabase, canonical);
  res.json(summary);
});

export default router;
