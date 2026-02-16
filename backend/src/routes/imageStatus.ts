// ============================================================
// LocoSnap — Blueprint Routes
// GET  /api/blueprint/:taskId — Poll blueprint generation status
// POST /api/blueprint/generate — Generate blueprint using credits
// ============================================================

import { Router, Request, Response, NextFunction } from "express";
import { getTaskStatus, startBlueprintGeneration } from "../services/imageGen";
import { BlueprintStatusResponse, BlueprintStyle, TrainIdentification, TrainSpecs } from "../types";
import { getSupabase } from "../config/supabase";
import { AppError } from "../middleware/errorHandler";
import { trackServerEvent } from "../services/analytics";

const router = Router();

/**
 * POST /api/blueprint/generate
 * Generate a blueprint using 1 credit (for non-Pro users).
 * Body: { userId, train, specs, style }
 */
router.post(
  "/generate",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, train, specs, style } = req.body;

      if (!userId || !train) {
        throw new AppError("userId and train data are required", 400);
      }

      const supabase = getSupabase();
      if (!supabase) {
        throw new AppError("Database not configured", 503);
      }

      // Check credit balance
      const { data: profile, error: fetchErr } = await supabase
        .from("profiles")
        .select("blueprint_credits, is_pro")
        .eq("id", userId)
        .single();

      if (fetchErr || !profile) {
        throw new AppError("User not found", 404);
      }

      // Pro users should use the regular identify flow
      if (profile.is_pro) {
        throw new AppError("Pro users get blueprints via the identify endpoint", 400);
      }

      if (profile.blueprint_credits <= 0) {
        throw new AppError("No blueprint credits remaining", 402);
      }

      // Validate style
      const VALID_STYLES: BlueprintStyle[] = ["technical", "vintage", "schematic", "cinematic"];
      const blueprintStyle: BlueprintStyle =
        style && VALID_STYLES.includes(style) ? style : "technical";

      // Deduct 1 credit atomically
      const newCredits = profile.blueprint_credits - 1;
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ blueprint_credits: newCredits })
        .eq("id", userId);

      if (updateErr) {
        throw new AppError("Failed to deduct credit", 500);
      }

      // Start blueprint generation
      const taskId = await startBlueprintGeneration(
        train as TrainIdentification,
        (specs || {}) as TrainSpecs,
        blueprintStyle
      );

      // Log the transaction
      await supabase.from("credit_transactions").insert({
        user_id: userId,
        amount: -1,
        reason: "blueprint_generation",
        blueprint_task_id: taskId,
      });

      trackServerEvent("blueprint_credit_generation", "server", {
        user_id: userId,
        style: blueprintStyle,
        remaining: newCredits,
      });

      res.json({
        success: true,
        taskId,
        creditsRemaining: newCredits,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/:taskId", async (req: Request, res: Response): Promise<void> => {
  const taskId = req.params.taskId as string;

  const task = await getTaskStatus(taskId);

  if (!task) {
    res.status(404).json({
      taskId,
      status: "not_found",
      imageUrl: null,
      error: "Task not found. It may have expired.",
    });
    return;
  }

  const response: BlueprintStatusResponse = {
    taskId: task.taskId,
    status: task.status,
    imageUrl: task.imageUrl,
    error: task.error,
  };

  res.json(response);
});

export default router;
