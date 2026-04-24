// ============================================================
// Verification tier thresholds — frontend mirror of
// backend/src/config/verification.ts.
//
// ⚠ KEEP IN SYNC with the backend file. Values are ratified
// in the product decisions 2026-04-24 session (see
// docs/plans/2026-04-24-card-v2-implementation.md §1).
// ============================================================

export const VERIFICATION_CONFIG = {
  galleryRecencyDays: 7,
  liveCameraMaxAccuracyM: 50,
  galleryMaxAccuracyM: 100,
} as const;
