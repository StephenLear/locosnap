// ============================================================
// LocoSnap — Train Identification Route
// POST /api/identify — The main endpoint
//
// Cache-first: if we've seen this class+operator before,
// serve cached specs/facts/rarity/blueprint and skip 3-4 API calls.
// Only the Vision call always runs (to ID what's in the photo).
//
// Free scan:   Vision + Specs + Facts + Rarity (no blueprint) (~£0.018)
// Pro scan:    Vision + Specs + Facts + Rarity + Blueprint    (~£0.022)
// Cached scan: Vision only                                    (~£0.005)
// ============================================================

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { identifyTrainFromImage } from "../services/vision";
import { getTrainSpecs } from "../services/trainSpecs";
import { getTrainFacts } from "../services/trainFacts";
import { classifyRarity } from "../services/rarity";
import { startBlueprintGeneration } from "../services/imageGen";
import {
  getCachedTrainData,
  setCachedTrainData,
  setCachedBlueprint,
} from "../services/trainCache";
import { AppError } from "../middleware/errorHandler";
import { trackServerEvent } from "../services/analytics";
import { IdentifyResponse, TrainSpecs, TrainFacts, RarityInfo, BlueprintStyle } from "../types";

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

      // ── Step 1: Vision AI (always runs) ────────────────
      console.log("[IDENTIFY] Step 1: Identifying train via Vision AI...");
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

      // ── Blueprint gating (Pro-only feature) ────────
      // The frontend sends generateBlueprint=true only for Pro users.
      // Free / guest users skip blueprint generation entirely to save cost.
      const shouldGenerateBlueprint = req.body?.generateBlueprint === "true" || req.body?.generateBlueprint === true;

      const VALID_STYLES: BlueprintStyle[] = ["technical", "vintage", "schematic", "cinematic"];
      const requestedStyle = req.body?.blueprintStyle as string;
      const blueprintStyle: BlueprintStyle =
        requestedStyle && VALID_STYLES.includes(requestedStyle as BlueprintStyle)
          ? (requestedStyle as BlueprintStyle)
          : "technical";

      // ── Step 2: Check cache ────────────────────────────
      let specs: TrainSpecs;
      let facts: TrainFacts;
      let rarity: RarityInfo;
      let blueprintTaskId: string;
      let cacheHit = false;

      const cached = getCachedTrainData(train, blueprintStyle);

      if (cached) {
        // ── CACHE HIT ────────────────────────────────────
        cacheHit = true;
        specs = cached.specs;
        facts = cached.facts;
        rarity = cached.rarity;

        if (!shouldGenerateBlueprint) {
          // Free user — skip blueprint entirely
          blueprintTaskId = "";
          console.log(
            `[IDENTIFY] Cache HIT — blueprint skipped (free user)`
          );
        } else if (cached.blueprintUrl) {
          // Blueprint also cached — return a fake "completed" task
          // with the cached URL. No generation needed at all.
          blueprintTaskId = `cached-${Date.now()}`;
          console.log(
            `[IDENTIFY] Full cache HIT — all data + blueprint from cache`
          );
        } else {
          // Specs/facts/rarity cached but blueprint not yet — generate it
          console.log(
            `[IDENTIFY] Partial cache HIT — generating blueprint only`
          );
          blueprintTaskId = await startBlueprintGeneration(train, specs, blueprintStyle);

          // Store blueprint URL when it completes (fire and forget)
          monitorBlueprintForCache(blueprintTaskId, train, blueprintStyle);
        }
      } else {
        // ── CACHE MISS — full AI pipeline ────────────────
        console.log(
          "[IDENTIFY] Cache MISS — running full AI pipeline..."
        );

        // Fetch specs and facts in parallel (with graceful fallbacks)
        const [specsResult, factsResult] = await Promise.allSettled([
          getTrainSpecs(train),
          getTrainFacts(train),
        ]);

        specs = specsResult.status === "fulfilled"
          ? specsResult.value
          : {
              maxSpeed: null, power: null, weight: null, length: null,
              gauge: null, builder: null, numberBuilt: null,
              numberSurviving: null, status: null, route: null, fuelType: null,
            };

        facts = factsResult.status === "fulfilled"
          ? factsResult.value
          : {
              summary: `A ${train.class} operated by ${train.operator}.`,
              historicalSignificance: null, funFacts: [], notableEvents: [],
            };

        if (specsResult.status === "rejected") {
          console.error("[IDENTIFY] Specs fetch failed:", specsResult.reason);
        }
        if (factsResult.status === "rejected") {
          console.error("[IDENTIFY] Facts fetch failed:", factsResult.reason);
        }

        // Classify rarity (needs specs — use fallback if it fails)
        try {
          rarity = await classifyRarity(train, specs);
        } catch (rarityErr) {
          console.error("[IDENTIFY] Rarity classification failed:", rarityErr);
          rarity = {
            tier: "common",
            reason: "Could not determine rarity.",
            productionCount: null,
            survivingCount: null,
          };
        }

        // Store in cache for next time
        setCachedTrainData(train, specs, facts, rarity);

        // Start blueprint generation (Pro only — non-critical)
        if (shouldGenerateBlueprint) {
          try {
            blueprintTaskId = await startBlueprintGeneration(train, specs, blueprintStyle);
            monitorBlueprintForCache(blueprintTaskId, train, blueprintStyle);
          } catch (bpErr) {
            console.error("[IDENTIFY] Blueprint generation failed:", bpErr);
            blueprintTaskId = `failed-${Date.now()}`;
          }
        } else {
          blueprintTaskId = "";
          console.log("[IDENTIFY] Blueprint skipped (free user)");
        }
      }

      // ── Build response ─────────────────────────────────
      const processingTimeMs = Date.now() - startTime;

      // For fully cached responses (including blueprint), return
      // a special status so the frontend knows it's instantly ready
      const blueprintData = !shouldGenerateBlueprint
        ? null // Free user — no blueprint at all
        : cached?.blueprintUrl
          ? { taskId: blueprintTaskId, status: "completed" as const, imageUrl: cached.blueprintUrl }
          : { taskId: blueprintTaskId, status: "queued" as const };

      const response: IdentifyResponse = {
        success: true,
        data: {
          train,
          specs,
          facts,
          rarity,
          blueprint: blueprintData as any,
        },
        error: null,
        processingTimeMs,
      };

      const savedCalls = cacheHit
        ? cached?.blueprintUrl
          ? "4 API calls saved"
          : "3 API calls saved"
        : "fresh — all API calls made";

      console.log(
        `[IDENTIFY] Complete in ${processingTimeMs}ms (${savedCalls}). Blueprint: ${blueprintTaskId}`
      );

      // Track server-side identify event
      trackServerEvent("identify_request", "server", {
        train_class: train.class,
        operator: train.operator,
        confidence: train.confidence,
        cache_hit: cacheHit,
        processing_time_ms: processingTimeMs,
      });

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ── Blueprint cache monitor ─────────────────────────────────
// Polls for blueprint completion and stores the URL in cache.
// Runs in background — doesn't block the response.

import { getTaskStatus } from "../services/imageGen";

function monitorBlueprintForCache(
  taskId: string,
  train: any,
  style: BlueprintStyle = "technical"
): void {
  const checkInterval = setInterval(async () => {
    try {
      const task = await getTaskStatus(taskId);
      if (!task) {
        clearInterval(checkInterval);
        return;
      }

      if (task.status === "completed" && task.imageUrl) {
        setCachedBlueprint(train, task.imageUrl, style);
        clearInterval(checkInterval);
      } else if (task.status === "failed") {
        clearInterval(checkInterval);
      }
    } catch {
      clearInterval(checkInterval);
    }
  }, 5000); // Check every 5 seconds

  // Safety: stop checking after 5 minutes
  setTimeout(() => clearInterval(checkInterval), 5 * 60 * 1000);
}

export default router;
