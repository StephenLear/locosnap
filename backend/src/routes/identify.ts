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
import rateLimit from "express-rate-limit";
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
import { getSupabase } from "../config/supabase";
import { IdentifyResponse, TrainSpecs, TrainFacts, RarityInfo, BlueprintStyle } from "../types";

const VALID_LANGUAGES = ["en", "de"] as const;
type Language = typeof VALID_LANGUAGES[number];

// Free users get 10 scans per calendar month (matches frontend MAX_MONTHLY_SCANS)
const MAX_FREE_MONTHLY_SCANS = 10;

// ── Server-side scan gate ───────────────────────────────────
// Verifies the bearer token (if present) and checks the user's
// monthly scan count against their plan. Fails open — any error
// (Supabase down, invalid token, missing profile) allows the scan
// through so legitimate users are never incorrectly blocked.
// Unauthenticated requests (no token) are allowed here; the IP
// rate limiter above handles trial-user abuse.
async function checkScanAllowed(
  req: Request
): Promise<{ allowed: boolean; reason?: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return { allowed: true }; // unauthenticated — rate limiter handles abuse
  }

  const token = authHeader.substring(7);
  const supabase = getSupabase();
  if (!supabase) return { allowed: true }; // Supabase not configured — allow

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) return { allowed: true }; // invalid token — allow

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_pro, daily_scans_used, daily_scans_reset_at")
      .eq("id", user.id)
      .single();

    if (!profile) return { allowed: true }; // no profile yet — allow
    if (profile.is_pro) return { allowed: true }; // Pro = unlimited

    // Check if we're in a new calendar month (reset resets the counter)
    const resetAt = new Date(profile.daily_scans_reset_at);
    const now = new Date();
    const isNewMonth =
      now.getMonth() !== resetAt.getMonth() ||
      now.getFullYear() !== resetAt.getFullYear();
    if (isNewMonth) return { allowed: true };

    if (profile.daily_scans_used >= MAX_FREE_MONTHLY_SCANS) {
      return {
        allowed: false,
        reason:
          "Monthly scan limit reached. Upgrade to Pro for unlimited scans.",
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: true }; // fail open — never block on unexpected errors
  }
}

const router = Router();

// ── Rate limiting ───────────────────────────────────────────
// 20 requests per IP per hour — enough for legitimate use,
// blocks runaway abuse that burns Vision API credits.
const identifyRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many scan requests. Please wait before trying again.",
    data: null,
  },
});

// Configure multer for image uploads (max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",   // Android sometimes sends this non-standard type
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
  identifyRateLimit,
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

      // ── Language validation ────────────────────────────
      // Accept "en" or "de". Any missing or unrecognised value defaults to "en".
      const requestedLanguage = req.body?.language as string;
      const language: Language =
        requestedLanguage && (VALID_LANGUAGES as readonly string[]).includes(requestedLanguage)
          ? (requestedLanguage as Language)
          : "en";

      // ── Scan gate (server-side limit check) ───────────
      const scanAllowed = await checkScanAllowed(req);
      if (!scanAllowed.allowed) {
        const response: IdentifyResponse = {
          success: false,
          data: null,
          error: scanAllowed.reason || "Scan limit reached.",
          processingTimeMs: Date.now() - startTime,
        };
        res.status(429).json(response);
        return;
      }

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

      const cached = await getCachedTrainData(train, blueprintStyle, language);

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
          monitorBlueprintForCache(blueprintTaskId, train, blueprintStyle, language);
        }
      } else {
        // ── CACHE MISS — full AI pipeline ────────────────
        console.log(
          "[IDENTIFY] Cache MISS — running full AI pipeline..."
        );

        // Fetch specs and facts in parallel (with graceful fallbacks)
        const [specsResult, factsResult] = await Promise.allSettled([
          getTrainSpecs(train, language),
          getTrainFacts(train, language),
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
          rarity = await classifyRarity(train, specs, language);
        } catch (rarityErr) {
          console.error("[IDENTIFY] Rarity classification failed:", rarityErr);
          rarity = {
            tier: "common",
            reason: "Could not determine rarity.",
            productionCount: null,
            survivingCount: null,
          };
        }

        // Store in cache for next time (fire and forget — non-blocking)
        setCachedTrainData(train, specs, facts, rarity, language).catch((err) =>
          console.warn("[IDENTIFY] Cache write failed:", err)
        );

        // Start blueprint generation (Pro only — non-critical)
        if (shouldGenerateBlueprint) {
          try {
            blueprintTaskId = await startBlueprintGeneration(train, specs, blueprintStyle);
            monitorBlueprintForCache(blueprintTaskId, train, blueprintStyle, language);
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
          blueprint: blueprintData,
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
  style: BlueprintStyle = "technical",
  language: string = "en"
): void {
  const checkInterval = setInterval(async () => {
    try {
      const task = await getTaskStatus(taskId);
      if (!task) {
        clearInterval(checkInterval);
        return;
      }

      if (task.status === "completed" && task.imageUrl) {
        setCachedBlueprint(train, task.imageUrl, style, language);
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
