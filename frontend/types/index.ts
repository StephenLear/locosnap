// ============================================================
// LocoSnap Frontend — Shared Types
// Mirrors backend types for type safety
// ============================================================

export type RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type BlueprintStyle = "technical" | "vintage" | "schematic" | "cinematic";

export const BLUEPRINT_STYLES: { id: BlueprintStyle; label: string; description: string; icon: string; proOnly: boolean }[] = [
  { id: "technical", label: "Technical", description: "Engineering works drawing", icon: "construct", proOnly: false },
  { id: "vintage", label: "Vintage", description: "Victorian hand-drawn illustration", icon: "book", proOnly: true },
  { id: "schematic", label: "Schematic", description: "Clean minimalist line art", icon: "grid", proOnly: true },
  { id: "cinematic", label: "Cinematic", description: "Dramatic hero-shot render", icon: "film", proOnly: true },
];

export interface TrainIdentification {
  class: string;
  name: string | null;
  operator: string;
  type: string;
  designation: string;
  yearBuilt: number | null;
  confidence: number;
  color: string;
  description: string;
}

export interface TrainSpecs {
  maxSpeed: string | null;
  power: string | null;
  weight: string | null;
  length: string | null;
  gauge: string | null;
  builder: string | null;
  numberBuilt: number | null;
  numberSurviving: number | null;
  status: string | null;
  route: string | null;
  fuelType: string | null;
}

export interface TrainFacts {
  summary: string;
  historicalSignificance: string | null;
  funFacts: string[];
  notableEvents: string[];
}

export interface RarityInfo {
  tier: RarityTier;
  reason: string;
  productionCount: number | null;
  survivingCount: number | null;
}

export interface BlueprintStatus {
  taskId: string;
  status: "queued" | "processing" | "completed" | "failed";
  imageUrl: string | null;
  error: string | null;
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
    // Card v2 provenance (Phase 0.5) — server-canonical verification.
    // Null when client did not supply provenance fields (older builds).
    verification: {
      verified: boolean;
      tier: VerificationTier;
      riskFlags: Record<string, boolean>;
    } | null;
  } | null;
  error: string | null;
  processingTimeMs: number;
}

export interface HistoryItem {
  id: string;
  train: TrainIdentification;
  specs: TrainSpecs;
  facts: TrainFacts;
  rarity: RarityInfo;
  blueprintUrl: string | null;
  blueprintStyle?: BlueprintStyle;
  photoUri: string | null;
  spottedAt: string; // ISO date string
  latitude: number | null;
  longitude: number | null;
  // ── Card v2 provenance (Phase 0.3) ─────────────────────────
  // Added 2026-04-24. All optional for backwards compatibility
  // with history items from earlier builds.
  captureSource?: CaptureSource;
  exifTimestamp?: string | null;
  verified?: boolean;
  verificationTier?: VerificationTier;
  photoAccuracyM?: number | null;
  riskFlags?: Record<string, boolean>;
}

// ── Card v2 provenance types (Phase 0.3) ─────────────────────
// Mirrors backend/src/types/index.ts — keep in sync.
// computeVerification() in both frontend/services/verification.ts
// and backend/src/services/verification.ts consume/emit these.

export type CaptureSource = "camera" | "gallery";

export type VerificationTier =
  | "verified-live"
  | "verified-recent-gallery"
  | "personal"
  | "unverified";

export interface ProvenanceInput {
  captureSource: CaptureSource;
  exifTimestamp: string | null;
  latitude: number | null;
  longitude: number | null;
  photoAccuracyM: number | null;
  mockLocationFlag: boolean;
  capturedAt: string;
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
    screenshot?: boolean;
    implausibleDate?: boolean;
  };
}

// ── Achievement definitions ──────────────────────────────────

export type AchievementType =
  // Bronze tier (the original 8 — first-week onboarding)
  | "first_cop"
  | "ten_unique"
  | "copped_legendary"
  | "seven_day_streak"
  | "shed_full"
  | "heritage_hunter"
  | "fifty_spots"
  | "rarity_collector"
  // Silver / Gold tier (added 2026-05-05 for engaged users who maxed Bronze)
  | "unique_century"        // 100 unique classes
  | "unique_master"         // 200 unique classes
  | "five_hundred_club"     // 500 total spots
  | "thousand_spots"        // 1000 total spots
  | "streak_thirty"         // 30-day streak
  | "streak_hundred"        // 100-day streak
  | "legendary_five"        // 5 legendary scans
  | "heritage_master";      // 50 steam locomotives

export interface AchievementDefinition {
  type: AchievementType;
  name: string;
  description: string;
  icon: string; // Ionicons name
  color: string;
}

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    type: "first_cop",
    name: "First Cop",
    description: "Spot your first train",
    icon: "flag",
    color: "#22c55e",
  },
  {
    type: "ten_unique",
    name: "10 Unique Classes",
    description: "Collect 10 different train classes",
    icon: "layers",
    color: "#3b82f6",
  },
  {
    type: "fifty_spots",
    name: "Half Century",
    description: "Log 50 total spots",
    icon: "camera",
    color: "#60a5fa",
  },
  {
    type: "copped_legendary",
    name: "Copped a Legendary",
    description: "Spot a Legendary-tier train",
    icon: "star",
    color: "#f59e0b",
  },
  {
    type: "seven_day_streak",
    name: "7-Day Streak",
    description: "Spot a train every day for a week",
    icon: "flame",
    color: "#00D4AA",
  },
  {
    type: "shed_full",
    name: "Shed Full",
    description: "Collect 50+ unique classes",
    icon: "home",
    color: "#a855f7",
  },
  {
    type: "heritage_hunter",
    name: "Heritage Hunter",
    description: "Spot 10+ steam locomotives",
    icon: "leaf",
    color: "#14b8a6",
  },
  {
    type: "rarity_collector",
    name: "Full Spectrum",
    description: "Spot at least one train of every rarity tier",
    icon: "prism",
    color: "#e879f9",
  },
  // ── Silver / Gold tier ──────────────────────────────────────
  {
    type: "unique_century",
    name: "Century Collector",
    description: "Collect 100 unique train classes",
    icon: "trophy",
    color: "#94a3b8",
  },
  {
    type: "unique_master",
    name: "Master Spotter",
    description: "Collect 200 unique train classes",
    icon: "trophy",
    color: "#fbbf24",
  },
  {
    type: "five_hundred_club",
    name: "500 Club",
    description: "Log 500 total spots",
    icon: "albums",
    color: "#38bdf8",
  },
  {
    type: "thousand_spots",
    name: "Thousand Yard",
    description: "Log 1,000 total spots",
    icon: "albums",
    color: "#fbbf24",
  },
  {
    type: "streak_thirty",
    name: "Month on the Rails",
    description: "Spot a train every day for 30 days",
    icon: "flame",
    color: "#f97316",
  },
  {
    type: "streak_hundred",
    name: "Century Streak",
    description: "Spot a train every day for 100 days",
    icon: "flame",
    color: "#dc2626",
  },
  {
    type: "legendary_five",
    name: "Legend Hunter",
    description: "Spot 5 Legendary-tier trains",
    icon: "star",
    color: "#fbbf24",
  },
  {
    type: "heritage_master",
    name: "Heritage Master",
    description: "Spot 50 steam locomotives",
    icon: "leaf",
    color: "#0d9488",
  },
];
