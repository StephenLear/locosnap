// ============================================================
// Verification logic tests
//
// Covers every edge case from the research brief §2.3 table
// plus the drift-guard: if the frontend mirror at
// frontend/services/verification.ts diverges from the backend
// canonical, this fixture set must fail on one side or the
// other, and the fix is to re-sync the implementations.
//
// Three-tier model (as of 2026-05-04, leaderboard Phase 2 prep):
//   verified-live / verified-recent-gallery — count for League XP
//   personal — legit but no recency proof (intact EXIF, weak GPS, etc.)
//                — visible everywhere, no XP
//   unverified — actively suspicious (stripped EXIF, implausible date,
//                mock location) — private to user, no XP
// ============================================================

import { computeVerification } from "../../services/verification";
import { ProvenanceInput } from "../../types";

const NOW = "2026-04-24T12:00:00.000Z";
const ONE_DAY_AGO = "2026-04-23T12:00:00.000Z";
const SIX_DAYS_AGO = "2026-04-18T12:00:00.000Z";   // inside 7-day window
const EIGHT_DAYS_AGO = "2026-04-16T12:00:00.000Z"; // outside 7-day window
const SIX_YEARS_AGO = "2020-04-24T12:00:00.000Z";  // implausible (>5y) — UNVERIFIED
const ONE_DAY_FUTURE = "2026-04-25T12:00:00.000Z"; // implausible (future) — UNVERIFIED

function baseInput(overrides: Partial<ProvenanceInput> = {}): ProvenanceInput {
  return {
    captureSource: "camera",
    exifTimestamp: NOW,
    latitude: 50.1109,
    longitude: 8.6821,
    photoAccuracyM: 10,
    mockLocationFlag: false,
    capturedAt: NOW,
    ...overrides,
  };
}

describe("computeVerification", () => {
  describe("verified-live tier (camera)", () => {
    it("verifies live camera with good GPS and no mock flag", () => {
      const r = computeVerification(baseInput());
      expect(r.tier).toBe("verified-live");
      expect(r.verified).toBe(true);
    });

    it("downgrades live camera with GPS accuracy > 50m to PERSONAL (weak GPS, not suspicious)", () => {
      const r = computeVerification(baseInput({ photoAccuracyM: 120 }));
      expect(r.tier).toBe("personal");
      expect(r.verified).toBe(false);
      expect(r.riskFlags.lowAccuracy).toBe(true);
    });

    it("downgrades live camera with no GPS to PERSONAL (no recency proof, not suspicious)", () => {
      const r = computeVerification(baseInput({ latitude: null, longitude: null }));
      expect(r.tier).toBe("personal");
      expect(r.riskFlags.noGps).toBe(true);
    });

    it("rejects live camera with mock-location flag as UNVERIFIED (suspicious)", () => {
      const r = computeVerification(baseInput({ mockLocationFlag: true }));
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.mockLocation).toBe(true);
    });

    it("downgrades live camera with null accuracy to PERSONAL", () => {
      const r = computeVerification(baseInput({ photoAccuracyM: null }));
      expect(r.tier).toBe("personal");
    });
  });

  describe("verified-recent-gallery tier", () => {
    it("verifies gallery scan with EXIF within 7 days and GPS ok", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: SIX_DAYS_AGO, photoAccuracyM: 80 })
      );
      expect(r.tier).toBe("verified-recent-gallery");
      expect(r.verified).toBe(true);
    });

    it("verifies gallery scan 1 day old with tight accuracy", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: ONE_DAY_AGO, photoAccuracyM: 30 })
      );
      expect(r.tier).toBe("verified-recent-gallery");
    });

    it("allows gallery accuracy up to 100m (looser than live camera 50m)", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: SIX_DAYS_AGO, photoAccuracyM: 95 })
      );
      expect(r.tier).toBe("verified-recent-gallery");
    });

    it("downgrades gallery scan 8 days old to PERSONAL (legit, just not fresh)", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: EIGHT_DAYS_AGO })
      );
      expect(r.tier).toBe("personal");
      expect(r.riskFlags.staleExif).toBe(true);
    });

    it("rejects gallery scan with stripped EXIF as UNVERIFIED (suspicious)", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: null })
      );
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.strippedExif).toBe(true);
    });

    it("downgrades gallery scan with GPS accuracy > 100m to PERSONAL", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: SIX_DAYS_AGO, photoAccuracyM: 150 })
      );
      expect(r.tier).toBe("personal");
      expect(r.riskFlags.lowAccuracy).toBe(true);
    });

    it("downgrades gallery scan with no GPS but fresh EXIF to PERSONAL", () => {
      const r = computeVerification(
        baseInput({
          captureSource: "gallery",
          exifTimestamp: ONE_DAY_AGO,
          latitude: null,
          longitude: null,
        })
      );
      expect(r.tier).toBe("personal");
      expect(r.riskFlags.noGps).toBe(true);
    });

    it("rejects gallery scan with mock-location flag as UNVERIFIED even if fresh + accurate", () => {
      const r = computeVerification(
        baseInput({
          captureSource: "gallery",
          exifTimestamp: ONE_DAY_AGO,
          mockLocationFlag: true,
        })
      );
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.mockLocation).toBe(true);
    });
  });

  describe("UNVERIFIED branch — implausible-date guards", () => {
    it("rejects gallery scan with EXIF >5 years old as UNVERIFIED (suspected internet find)", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: SIX_YEARS_AGO })
      );
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.implausibleDate).toBe(true);
    });

    it("rejects gallery scan with EXIF in the future as UNVERIFIED", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: ONE_DAY_FUTURE })
      );
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.implausibleDate).toBe(true);
    });

    it("rejects gallery scan with malformed EXIF as UNVERIFIED (treated as stripped)", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: "not-a-date" })
      );
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.strippedExif).toBe(true);
    });

    it("does NOT reject 5-year-old plausible photo (boundary check)", () => {
      // EXIF 4y 11m old — still implausibly old? Boundary is 5y; 4y inside.
      const fourYearsAgo = "2022-04-24T12:00:00.000Z";
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: fourYearsAgo })
      );
      expect(r.tier).toBe("personal");
      expect(r.riskFlags.implausibleDate).toBeUndefined();
    });
  });

  describe("edge cases from research brief §2.3", () => {
    it("iOS share-sheet stripped GPS + EXIF → UNVERIFIED (suspicious — both signals stripped)", () => {
      const r = computeVerification(
        baseInput({
          captureSource: "gallery",
          exifTimestamp: null,
          latitude: null,
          longitude: null,
        })
      );
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.noGps).toBe(true);
      expect(r.riskFlags.strippedExif).toBe(true);
    });

    it("DSLR AirDrop with intact EXIF but no GPS → PERSONAL (legit, just no location proof)", () => {
      const r = computeVerification(
        baseInput({
          captureSource: "gallery",
          exifTimestamp: ONE_DAY_AGO,
          latitude: null,
          longitude: null,
        })
      );
      expect(r.tier).toBe("personal");
      expect(r.riskFlags.noGps).toBe(true);
    });

    it("indoor museum scan (live camera) → stays VERIFIED (preserved-loco sightings are legitimate)", () => {
      // No special handling needed — live camera + GPS + good accuracy passes.
      const r = computeVerification(baseInput({ photoAccuracyM: 20 }));
      expect(r.tier).toBe("verified-live");
    });
  });

  describe("risk-flag accumulation (used for server-side risk score)", () => {
    it("collects multiple flags when several things are wrong (UNVERIFIED)", () => {
      const r = computeVerification(
        baseInput({
          captureSource: "gallery",
          exifTimestamp: null,
          latitude: null,
          longitude: null,
          mockLocationFlag: true,
          photoAccuracyM: null,
        })
      );
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.noGps).toBe(true);
      expect(r.riskFlags.strippedExif).toBe(true);
      expect(r.riskFlags.mockLocation).toBe(true);
    });

    it("emits no risk flags on a perfectly clean verified-live scan", () => {
      const r = computeVerification(baseInput());
      expect(r.tier).toBe("verified-live");
      expect(Object.keys(r.riskFlags)).toHaveLength(0);
    });
  });
});
