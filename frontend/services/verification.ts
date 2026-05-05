// ============================================================
// Verification — classify a spot into one of four tiers.
//
// Client-side mirror of backend/src/services/verification.ts.
// Used for optimistic UI at scan time (render Verified badge
// before server round-trip). The server re-runs the same logic
// on persist and the server result is authoritative — if the
// server returns a different tier, update the local record.
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
// ⚠ KEEP IN SYNC with backend/src/services/verification.ts.
// Drift is guarded against by a shared-fixture test at
// backend/src/__tests__/services/verification.test.ts. If you change
// the logic here, change it there too, and extend the fixtures.
// ============================================================

import {
  CaptureSource,
  ProvenanceInput,
  VerificationResult,
  VerificationTier,
} from "../types";
import { VERIFICATION_CONFIG } from "../constants/verification";

const MS_PER_DAY = 86_400_000;
const MS_PER_YEAR = 365.25 * MS_PER_DAY;

export function computeVerification(input: ProvenanceInput): VerificationResult {
  const riskFlags: VerificationResult["riskFlags"] = {};
  const now = new Date(input.capturedAt).getTime();

  const hasGps = input.latitude !== null && input.longitude !== null;
  if (!hasGps) riskFlags.noGps = true;

  const accuracy = input.photoAccuracyM;
  const liveAccuracyOk =
    accuracy !== null && accuracy <= VERIFICATION_CONFIG.liveCameraMaxAccuracyM;
  const galleryAccuracyOk =
    accuracy !== null && accuracy <= VERIFICATION_CONFIG.galleryMaxAccuracyM;
  if (accuracy !== null && !galleryAccuracyOk) riskFlags.lowAccuracy = true;

  let exifFresh = false;
  let exifIntact = false;
  let exifImplausible = false;
  if (input.exifTimestamp) {
    const exifMs = new Date(input.exifTimestamp).getTime();
    if (Number.isNaN(exifMs)) {
      if (input.captureSource === "gallery") riskFlags.strippedExif = true;
    } else {
      exifIntact = true;
      const ageMs = now - exifMs;
      const maxFreshMs = VERIFICATION_CONFIG.galleryRecencyDays * MS_PER_DAY;
      const maxPlausibleAgeMs = VERIFICATION_CONFIG.implausibleEXIFAgeYears * MS_PER_YEAR;
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

  if (input.mockLocationFlag) riskFlags.mockLocation = true;

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
    tier = "personal";
  }

  return {
    verified: tier === "verified-live" || tier === "verified-recent-gallery",
    tier,
    riskFlags,
  };
}

export function isCaptureSource(value: unknown): value is CaptureSource {
  return value === "camera" || value === "gallery";
}
