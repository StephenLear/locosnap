// ============================================================
// LocoSnap — Blueprint Credits Route
// POST /api/credits/deduct — Deduct 1 credit for blueprint gen
// GET  /api/credits/balance — Check user's credit balance
// ============================================================

import { Router, Request, Response, NextFunction } from "express";
import { getSupabase } from "../config/supabase";
import { AppError } from "../middleware/errorHandler";
import { trackServerEvent } from "../services/analytics";

const router = Router();

/**
 * POST /api/credits/deduct
 * Body: { userId: string, blueprintTaskId?: string }
 * Atomically deducts 1 blueprint credit and logs the transaction.
 */
router.post(
  "/deduct",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, blueprintTaskId } = req.body;

      if (!userId) {
        throw new AppError("userId is required", 400);
      }

      const supabase = getSupabase();
      if (!supabase) {
        throw new AppError("Database not configured", 503);
      }

      // Fetch current credits
      const { data: profile, error: fetchErr } = await supabase
        .from("profiles")
        .select("blueprint_credits")
        .eq("id", userId)
        .single();

      if (fetchErr || !profile) {
        throw new AppError("User not found", 404);
      }

      if (profile.blueprint_credits <= 0) {
        throw new AppError("No blueprint credits remaining", 402);
      }

      // Deduct 1 credit
      const newCredits = profile.blueprint_credits - 1;
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ blueprint_credits: newCredits })
        .eq("id", userId);

      if (updateErr) {
        throw new AppError("Failed to deduct credit", 500);
      }

      // Log the transaction
      await supabase.from("credit_transactions").insert({
        user_id: userId,
        amount: -1,
        reason: "blueprint_generation",
        blueprint_task_id: blueprintTaskId || null,
      });

      trackServerEvent("blueprint_credit_deducted", "server", {
        user_id: userId,
        remaining: newCredits,
      });

      res.json({
        success: true,
        creditsRemaining: newCredits,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/credits/balance?userId=xxx
 * Returns the user's current blueprint credit balance.
 */
router.get(
  "/balance",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.query.userId as string;

      if (!userId) {
        throw new AppError("userId query parameter is required", 400);
      }

      const supabase = getSupabase();
      if (!supabase) {
        throw new AppError("Database not configured", 503);
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("blueprint_credits")
        .eq("id", userId)
        .single();

      if (error || !profile) {
        throw new AppError("User not found", 404);
      }

      res.json({
        credits: profile.blueprint_credits,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
