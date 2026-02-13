// ============================================================
// LocoSnap Frontend — Shared Types
// Mirrors backend types for type safety
// ============================================================

export type RarityTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

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
    };
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
  spottedAt: string; // ISO date string
  latitude: number | null;
  longitude: number | null;
}

// ── Achievement definitions ──────────────────────────────────

export type AchievementType =
  | "first_cop"
  | "ten_unique"
  | "copped_legendary"
  | "seven_day_streak"
  | "shed_full"
  | "heritage_hunter"
  | "fifty_spots"
  | "rarity_collector";

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
    color: "#ff6b00",
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
];
