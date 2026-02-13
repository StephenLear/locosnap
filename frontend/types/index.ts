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
}
