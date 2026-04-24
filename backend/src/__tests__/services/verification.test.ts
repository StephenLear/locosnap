// ============================================================
// Verification logic tests
//
// Covers every edge case from the research brief §2.3 table
// plus the drift-guard: if the frontend mirror at
// frontend/services/verification.ts diverges from the backend
// canonical, this fixture set must fail on one side or the
// other, and the fix is to re-sync the implementations.
// ============================================================

import { computeVerification } from "../../services/verification";
import { ProvenanceInput } from "../../types";

const NOW = "2026-04-24T12:00:00.000Z";
const ONE_DAY_AGO = "2026-04-23T12:00:00.000Z";
const SIX_DAYS_AGO = "2026-04-18T12:00:00.000Z";   // inside 7-day window
const EIGHT_DAYS_AGO = "2026-04-16T12:00:00.000Z"; // outside 7-day window

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

    it("rejects live camera with GPS accuracy > 50m", () => {
      const r = computeVerification(baseInput({ photoAccuracyM: 120 }));
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.lowAccuracy).toBe(true);
    });

    it("rejects live camera with no GPS", () => {
      const r = computeVerification(baseInput({ latitude: null, longitude: null }));
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.noGps).toBe(true);
    });

    it("rejects live camera with mock-location flag", () => {
      const r = computeVerification(baseInput({ mockLocationFlag: true }));
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.mockLocation).toBe(true);
    });

    it("rejects live camera with null accuracy", () => {
      const r = computeVerification(baseInput({ photoAccuracyM: null }));
      expect(r.tier).toBe("unverified");
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

    it("rejects gallery scan 8 days old (outside window)", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: EIGHT_DAYS_AGO })
      );
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.staleExif).toBe(true);
    });

    it("rejects gallery scan with stripped EXIF (null timestamp)", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: null })
      );
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.strippedExif).toBe(true);
    });

    it("rejects gallery scan with GPS accuracy > 100m", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: SIX_DAYS_AGO, photoAccuracyM: 150 })
      );
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.lowAccuracy).toBe(true);
    });

    it("rejects gallery scan with no GPS even if EXIF is fresh", () => {
      const r = computeVerification(
        baseInput({
          captureSource: "gallery",
          exifTimestamp: ONE_DAY_AGO,
          latitude: null,
          longitude: null,
        })
      );
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.noGps).toBe(true);
    });

    it("rejects gallery scan with mock-location flag even if fresh + accurate", () => {
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

  describe("edge cases from research brief §2.3", () => {
    it("iOS share-sheet stripped GPS → gallery scan becomes unverified (noGps + strippedExif if EXIF also gone)", () => {
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

    it("DSLR AirDrop with no GPS → unverified (painful but unavoidable per brief §2.3)", () => {
      const r = computeVerification(
        baseInput({
          captureSource: "gallery",
          exifTimestamp: ONE_DAY_AGO,
          latitude: null,
          longitude: null,
        })
      );
      expect(r.tier).toBe("unverified");
      expect(r.riskFlags.noGps).toBe(true);
    });

    it("indoor museum scan (live camera) → stays verified (preserved-loco sightings are legitimate)", () => {
      // No special handling needed — live camera + GPS + good accuracy passes.
      const r = computeVerification(baseInput({ photoAccuracyM: 20 }));
      expect(r.tier).toBe("verified-live");
    });

    it("malformed EXIF timestamp → treated as no EXIF, gallery scan unverified", () => {
      const r = computeVerification(
        baseInput({ captureSource: "gallery", exifTimestamp: "not-a-date" })
      );
      expect(r.tier).toBe("unverified");
    });

    it("EXIF timestamp in the future (clock skew) → not treated as fresh, gallery unverified", () => {
      const r = computeVerification(
        baseInput({
          captureSource: "gallery",
          exifTimestamp: "2026-04-25T12:00:00.000Z", // +1 day future
        })
      );
      expect(r.tier).toBe("unverified");
    });
  });

  describe("risk-flag accumulation (used for server-side risk score)", () => {
    it("collects multiple flags when several things are wrong", () => {
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
