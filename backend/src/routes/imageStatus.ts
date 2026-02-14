// ============================================================
// LocoSnap — Blueprint Status Route
// GET /api/blueprint/:taskId — Poll blueprint generation status
// ============================================================

import { Router, Request, Response } from "express";
import { getTaskStatus } from "../services/imageGen";
import { BlueprintStatusResponse } from "../types";

const router = Router();

router.get("/:taskId", (req: Request, res: Response): void => {
  const taskId = req.params.taskId as string;

  const task = getTaskStatus(taskId);

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
