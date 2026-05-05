// ============================================================
// LocoSnap — Shared Types
// ============================================================

export type RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type BlueprintStyle = "technical" | "vintage" | "schematic" | "cinematic";

export interface TrainIdentification {
  class: string; // e.g. "Class 43", "A4", "Class 800"
  name: string | null; // e.g. "Flying Scotsman", "Mallard" (named locos only)
  operator: string; // e.g. "LNER", "GWR", "Network Rail"
  type: string; // e.g. "Steam", "Diesel", "Electric", "DMU", "EMU", "HST"
  designation: string; // e.g. "4-6-2 Pacific", "Bo-Bo", "2-Co-Co-2"
  yearBuilt: number | null;
  confidence: number; // 0-100
  color: string; // livery colour
  description: string;
}

export interface TrainSpecs {
  maxSpeed: string | null; // e.g. "125 mph"
  power: string | null; // e.g. "2,250 HP" or "5,000 kW"
  weight: string | null; // e.g. "76 tonnes"
  length: string | null; // e.g. "22.1 m"
  gauge: string | null; // e.g. "Standard (1,435 mm)"
  builder: string | null; // e.g. "Doncaster Works", "Hitachi"
  numberBuilt: number | null;
  numberSurviving: number | null;
  status: string | null; // e.g. "In service", "Preserved", "Withdrawn"
  route: string | null; // e.g. "East Coast Main Line"
  fuelType: string | null; // e.g. "Coal", "Diesel", "Electric (25kV AC)"
}

export interface TrainFacts {
  summary: string;
  historicalSignificance: string | null;
  funFacts: string[];
  notableEvents: string[];
}

export interface RarityInfo {
  tier: RarityTier;
  reason: string; // e.g. "Heritage steam locomotive — only 1 surviving"
  productionCount: number | null;
  survivingCount: number | null;
}

// ── Card v2 provenance (Phase 0.3) ───────────────────────────
// Mirrors frontend/types/index.ts — keep in sync. The mirror
// copy lives there and both files share the same shape for
// HistoryItem extensions. computeVerification() in both
// backend/services/verification.ts and frontend/services/
// verification.ts consume/emit these types.

export type CaptureSource = "camera" | "gallery";

export type VerificationTier =
  | "verified-live"            // live camera + GPS + accuracy < threshold — counts for League XP
  | "verified-recent-gallery"  // gallery <=7d EXIF + GPS + accuracy < threshold — counts for League XP
  | "personal"                 // legit gallery upload, no recency proof — visible everywhere, NO League XP
  | "unverified";              // stripped EXIF or implausible date — private to user, NO League XP

export interface ProvenanceInput {
  captureSource: CaptureSource;
  exifTimestamp: string | null;   // ISO datetime — from EXIF DateTimeOriginal
  latitude: number | null;
  longitude: number | null;
  photoAccuracyM: number | null;  // GPS horizontal accuracy in metres
  mockLocationFlag: boolean;      // Android-only; false on iOS
  capturedAt: string;             // ISO datetime — "now" at scan time
}

export interface VerificationResult {
  verified: boolean;
  tier: VerificationTier;
  riskFlags: {
    mockLocation?: boolean;
    strippedExif?: boolean;
    staleExif?: boolean;
    lowAccuracy?: boolean;
    noGps?: boolean;
    screenshot?: boolean;       // heuristic — EXIF Software contains "Screenshot"
    implausibleDate?: boolean;  // EXIF >5 years ago or in the future
  };
}

export interface BlueprintTask {
  taskId: string;
  status: "queued" | "processing" | "completed" | "failed";
  imageUrl: string | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface IdentifyResponse {
  success: boolean;
  data: {
    train: TrainIdentification;
    specs: TrainSpecs;
    facts: TrainFacts;
    rarity: RarityInfo;
    blueprint: {
      taskId: string;
      status: string;
      imageUrl?: string | null;
    } | null;
    // ── Card v2 provenance (Phase 0.5) ──────────────────
    // Server-canonical verification result. Client provides the
    // raw provenance fields; server runs computeVerification() and
    // returns the canonical tier here. Null when the client did not
    // supply enough provenance data to classify (e.g. older client
    // build pre-v1.0.21). Frontend persists tier + riskFlags onto
    // the spot row when saveSpot writes to Supabase.
    verification: {
      verified: boolean;
      tier: VerificationTier;
      riskFlags: Record<string, boolean>;
    } | null;
  } | null;
  error: string | null;
  processingTimeMs: number;
}

export interface BlueprintStatusResponse {
  taskId: string;
  status: "queued" | "processing" | "completed" | "failed";
  imageUrl: string | null;
  error: string | null;
}
