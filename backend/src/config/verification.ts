// ============================================================
// Verification tier thresholds
//
// Single source of truth for the constants that decide whether
// a spot counts as Verified or Unverified. Tuning any value here
// changes behaviour without a client release — the frontend
// mirror reads the same constants via the computeVerification
// function result, and the server re-validates on every write.
//
// Values ratified in the product decisions 2026-04-24 session
// (see docs/plans/2026-04-24-card-v2-implementation.md §1).
// ============================================================

export const VERIFICATION_CONFIG = {
  // Gallery photo EXIF timestamp must be within this many days
  // of scan time to count as "verified-recent-gallery".
  galleryRecencyDays: 7,

  // Max acceptable GPS horizontal accuracy (metres). Looser for
  // gallery (device may no longer be at the location) than for
  // live camera.
  liveCameraMaxAccuracyM: 50,
  galleryMaxAccuracyM: 100,
} as const;
