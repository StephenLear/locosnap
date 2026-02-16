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
