// ============================================================
// Verification — classify a spot as Verified or Unverified.
//
// Pure function, no I/O. Called both at scan time (client, for
// optimistic UI) and on persist (server, canonical). Client is
// never trusted: /api/identify re-runs this server-side and
// overrides whatever the client sent.
//
// ⚠ KEEP IN SYNC with frontend/services/verification.ts — the
// frontend copy is a direct mirror of this file. If you change
// the logic here, change it there too, and update
// backend/src/__tests__/verification.test.ts. A drift test
// there asserts both implementations produce identical results
// for the shared fixture set.
// ============================================================

import {
  CaptureSource,
  ProvenanceInput,
  VerificationResult,
  VerificationTier,
} from "../types";
import { VERIFICATION_CONFIG } from "../config/verification";

const MS_PER_DAY = 86_400_000;

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

  // ── EXIF freshness (gallery only) ──
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

  // ── Mock-location flag (Android) ──
  if (input.mockLocationFlag) riskFlags.mockLocation = true;

  // ── Tier assignment ──
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

/**
 * Guard for callers wiring up the type. Narrows a string to CaptureSource.
 */
export function isCaptureSource(value: unknown): value is CaptureSource {
  return value === "camera" || value === "gallery";
}
