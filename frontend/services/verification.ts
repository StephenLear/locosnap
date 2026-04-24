// ============================================================
// Verification — classify a spot as Verified or Unverified.
//
// Client-side mirror of backend/src/services/verification.ts.
// Used for optimistic UI at scan time (render Verified badge
// before server round-trip). The server re-runs the same logic
// on persist and the server result is authoritative — if the
// server returns a different tier, update the local record.
//
// ⚠ KEEP IN SYNC with backend/src/services/verification.ts.
// Drift is guarded against by a shared-fixture test at
// backend/src/__tests__/verification.test.ts. If you change
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

  let exifFresh = false;
  if (input.exifTimestamp) {
    const exifMs = new Date(input.exifTimestamp).getTime();
    if (!Number.isNaN(exifMs)) {
      const ageMs = now - exifMs;
      const maxAgeMs = VERIFICATION_CONFIG.galleryRecencyDays * MS_PER_DAY;
      exifFresh = ageMs >= 0 && ageMs <= maxAgeMs;
      if (!exifFresh && ageMs > maxAgeMs) riskFlags.staleExif = true;
    }
  } else if (input.captureSource === "gallery") {
    riskFlags.strippedExif = true;
  }

  if (input.mockLocationFlag) riskFlags.mockLocation = true;

  let tier: VerificationTier;

  if (input.captureSource === "camera" && hasGps && liveAccuracyOk && !input.mockLocationFlag) {
    tier = "verified-live";
  } else if (
    input.captureSource === "gallery" &&
    hasGps &&
    galleryAccuracyOk &&
    exifFresh &&
    !input.mockLocationFlag
  ) {
    tier = "verified-recent-gallery";
  } else {
    tier = "unverified";
    if (accuracy !== null && !galleryAccuracyOk) riskFlags.lowAccuracy = true;
  }

  return {
    verified: tier !== "unverified",
    tier,
    riskFlags,
  };
}

export function isCaptureSource(value: unknown): value is CaptureSource {
  return value === "camera" || value === "gallery";
}
