// ============================================================
// LocoSnap — Train Identification Route
// POST /api/identify — The main endpoint
// ============================================================

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { identifyTrainFromImage } from "../services/vision";
import { getTrainSpecs } from "../services/trainSpecs";
import { getTrainFacts } from "../services/trainFacts";
import { classifyRarity } from "../services/rarity";
import { startBlueprintGeneration } from "../services/imageGen";
import { AppError } from "../middleware/errorHandler";
import { IdentifyResponse } from "../types";

const router = Router();

// Configure multer for image uploads (max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          "Invalid file type. Please upload a JPEG, PNG, or WebP image.",
          400
        )
      );
    }
  },
});

router.post(
  "/",
  upload.single("image"),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    try {
      // Validate image was uploaded
      if (!req.file) {
        throw new AppError("No image uploaded. Please include an image file.", 400);
      }

      console.log(
        `[IDENTIFY] Processing image: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)}KB)`
      );

      // Step 1: Identify the train using Vision API (Claude or OpenAI)
      console.log("[IDENTIFY] Step 1: Identifying train...");
      const train = await identifyTrainFromImage(
        req.file.buffer,
        req.file.mimetype
      );

      if (!train) {
        const response: IdentifyResponse = {
          success: false,
          data: null,
          error:
            "Could not identify a train in this image. Please try a clearer photo of a locomotive or train.",
          processingTimeMs: Date.now() - startTime,
        };
        res.status(422).json(response);
        return;
      }

      console.log(
        `[IDENTIFY] Found: ${train.class}${train.name ? ` "${train.name}"` : ""} (${train.confidence}% confidence)`
      );

      // Step 2: Fetch specs and facts in parallel
      console.log(
        "[IDENTIFY] Step 2: Fetching specs and facts in parallel..."
      );
      const [specs, facts] = await Promise.all([
        getTrainSpecs(train),
        getTrainFacts(train),
      ]);

      // Step 2b: Classify rarity (needs specs)
      console.log("[IDENTIFY] Step 2b: Classifying rarity...");
      const rarity = await classifyRarity(train, specs);

      // Step 3: Start blueprint generation (async — returns immediately)
      console.log("[IDENTIFY] Step 3: Starting blueprint generation...");
      const taskId = await startBlueprintGeneration(train, specs);

      // Return full results (blueprint still generating in background)
      const response: IdentifyResponse = {
        success: true,
        data: {
          train,
          specs,
          facts,
          rarity,
          blueprint: {
            taskId,
            status: "queued",
          },
        },
        error: null,
        processingTimeMs: Date.now() - startTime,
      };

      console.log(
        `[IDENTIFY] Complete in ${response.processingTimeMs}ms. Blueprint task: ${taskId}`
      );

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
