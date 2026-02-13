// ============================================================
// CarSnap — Car Identification Route
// POST /api/identify — The main endpoint
// ============================================================

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { identifyCarFromImage } from "../services/vision";
import { getReviewSummary } from "../services/reviews";
import { getCarSpecs } from "../services/nhtsa";
import { startInfographicGeneration } from "../services/imageGen";
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

      // Step 1: Identify the car using Vision API (Claude or OpenAI)
      console.log("[IDENTIFY] Step 1: Identifying car...");
      const car = await identifyCarFromImage(
        req.file.buffer,
        req.file.mimetype
      );

      if (!car) {
        const response: IdentifyResponse = {
          success: false,
          data: null,
          error:
            "Could not identify a vehicle in this image. Please try a clearer photo of a car.",
          processingTimeMs: Date.now() - startTime,
        };
        res.status(422).json(response);
        return;
      }

      console.log(
        `[IDENTIFY] Found: ${car.year} ${car.make} ${car.model} (${car.confidence}% confidence)`
      );

      // Step 2 & 3: Fetch specs and reviews in parallel
      console.log(
        "[IDENTIFY] Step 2-3: Fetching specs and reviews in parallel..."
      );
      const [specs, reviews] = await Promise.all([
        getCarSpecs(car.make, car.model, car.year),
        getReviewSummary(car.make, car.model, car.year),
      ]);

      // Step 4: Start infographic generation (async — returns immediately)
      console.log("[IDENTIFY] Step 4: Starting infographic generation...");
      const taskId = await startInfographicGeneration(car, specs);

      // Return full results (infographic still generating in background)
      const response: IdentifyResponse = {
        success: true,
        data: {
          car,
          specs,
          reviews,
          infographic: {
            taskId,
            status: "queued",
          },
        },
        error: null,
        processingTimeMs: Date.now() - startTime,
      };

      console.log(
        `[IDENTIFY] Complete in ${response.processingTimeMs}ms. Infographic task: ${taskId}`
      );

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
