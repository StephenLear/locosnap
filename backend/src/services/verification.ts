// ============================================================
// Verification — classify a spot into one of four tiers.
//
// Pure function, no I/O. Called both at scan time (client, for
// optimistic UI) and on persist (server, canonical). Client is
// never trusted: /api/identify re-runs this server-side and
// overrides whatever the client sent.
//
// Four tiers (leaderboard Phase 2 split, 2026-05-04):
//   verified-live           — live camera + GPS + accuracy <= 50m + not mocked
//                             counts for League XP.
//   verified-recent-gallery — gallery + GPS + accuracy <= 100m + EXIF <= 7d
//                             + not mocked. counts for League XP.
//   personal                — legit but no recency proof: weak GPS, stale
//                             EXIF, no GPS with intact EXIF, etc. visible
//                             everywhere; NOT in League XP.
//   unverified              — actively suspicious: stripped EXIF (gallery),
//                             mock location, implausible date (>5y or
//                             future). private to user; NOT in League XP.
//
// Ordering matters: suspicious-signal checks (mock loc, stripped EXIF,
// implausible date) run BEFORE the legit-but-weak fallthrough so a
// scan with both suspicious AND weak signals lands in UNVERIFIED.
//
// ⚠ KEEP IN SYNC with frontend/services/verification.ts — the
// frontend copy is a direct mirror of this file. If you change
// the logic here, change it there too, and update
// backend/src/__tests__/services/verification.test.ts.
// ============================================================

import {
  CaptureSource,
  ProvenanceInput,
  VerificationResult,
  VerificationTier,
} from "../types";
import { VERIFICATION_CONFIG } from "../config/verification";

const MS_PER_DAY = 86_400_000;
const MS_PER_YEAR = 365.25 * MS_PER_DAY;

export function computeVerification(input: ProvenanceInput): VerificationResult {
  const riskFlags: VerificationResult["riskFlags"] = {};
  const now = new Date(input.capturedAt).getTime();

  // ── GPS presence & accuracy ──
  const hasGps = input.latitude !== null && input.longitude !== null;
  if (!hasGps) riskFlags.noGps = true;

  const accuracy = input.photoAccuracyM;
  const liveAccuracyOk =
    accuracy !== null && accuracy <= VERIFICATION_CONFIG.liveCameraMaxAccuracyM;
  const galleryAccuracyOk =
    accuracy !== null && accuracy <= VERIFICATION_CONFIG.galleryMaxAccuracyM;
  if (accuracy !== null && !galleryAccuracyOk) riskFlags.lowAccuracy = true;

  // ── EXIF parsing (gallery only) ──
  let exifFresh = false;
  let exifIntact = false;
  let exifImplausible = false;
  if (input.exifTimestamp) {
    const exifMs = new Date(input.exifTimestamp).getTime();
    if (Number.isNaN(exifMs)) {
      // Malformed string — treat as stripped on the gallery path.
      if (input.captureSource === "gallery") riskFlags.strippedExif = true;
    } else {
      exifIntact = true;
      const ageMs = now - exifMs;
      const maxFreshMs = VERIFICATION_CONFIG.galleryRecencyDays * MS_PER_DAY;
      const maxPlausibleAgeMs = VERIFICATION_CONFIG.implausibleEXIFAgeYears * MS_PER_YEAR;
      // Future timestamps OR EXIF older than the implausibility threshold
      // → treat as suspected internet find / clock tampering.
      if (ageMs < 0 || ageMs > maxPlausibleAgeMs) {
        exifImplausible = true;
        riskFlags.implausibleDate = true;
      } else if (ageMs <= maxFreshMs) {
        exifFresh = true;
      } else {
        riskFlags.staleExif = true;
      }
    }
  } else if (input.captureSource === "gallery") {
    riskFlags.strippedExif = true;
  }

  // ── Mock-location flag (Android) ──
  if (input.mockLocationFlag) riskFlags.mockLocation = true;

  // ── Tier assignment ──
  // Suspicious gates first, then verified gates, then personal fallback.
  let tier: VerificationTier;

  const isSuspicious =
    input.mockLocationFlag ||
    exifImplausible ||
    (input.captureSource === "gallery" && !exifIntact);

  if (isSuspicious) {
    tier = "unverified";
  } else if (
    input.captureSource === "camera" &&
    hasGps &&
    liveAccuracyOk
  ) {
    tier = "verified-live";
  } else if (
    input.captureSource === "gallery" &&
    hasGps &&
    galleryAccuracyOk &&
    exifFresh
  ) {
    tier = "verified-recent-gallery";
  } else {
    // Legit but no recency proof: weak GPS, stale EXIF, etc.
    tier = "personal";
  }

  return {
    verified: tier === "verified-live" || tier === "verified-recent-gallery",
    tier,
    riskFlags,
  };
}

/**
 * Guard for callers wiring up the type. Narrows a string to CaptureSource.
 */
export function isCaptureSource(value: unknown): value is CaptureSource {
  return value === "camera" || value === "gallery";
}
