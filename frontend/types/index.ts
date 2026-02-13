// ============================================================
// CarSnap Frontend — Shared Types
// Mirrors backend types for type safety
// ============================================================

export interface CarIdentification {
  make: string;
  model: string;
  year: number;
  trim: string;
  confidence: number;
  color: string;
  bodyStyle: string;
  description: string;
}

export interface CarSpecs {
  safetyRating: number | null;
  crashTestRatings: {
    overall: number | null;
    frontal: number | null;
    side: number | null;
    rollover: number | null;
  };
  fuelEconomy: {
    city: number | null;
    highway: number | null;
    combined: number | null;
  } | null;
  engine: string | null;
  horsepower: number | null;
  torque: number | null;
  transmission: string | null;
  drivetrain: string | null;
  wheelbase: string | null;
  curbWeight: string | null;
  dimensions: {
    length: string | null;
    width: string | null;
    height: string | null;
  } | null;
}

export interface ReviewSource {
  name: string;
  score: number;
  url: string;
}

export interface AggregatedReviews {
  overallScore: number;
  safetyScore: number;
  reliabilityScore: number;
  performanceScore: number;
  comfortScore: number;
  valueScore: number;
  summary: string;
  pros: string[];
  cons: string[];
  sources: ReviewSource[];
}

export interface InfographicStatus {
  taskId: string;
  status: "queued" | "processing" | "completed" | "failed";
  imageUrl: string | null;
  error: string | null;
}

export interface IdentifyResponse {
  success: boolean;
  data: {
    car: CarIdentification;
    specs: CarSpecs;
    reviews: AggregatedReviews;
    infographic: {
      taskId: string;
      status: string;
    };
  } | null;
  error: string | null;
  processingTimeMs: number;
}

export interface HistoryItem {
  id: string;
  car: CarIdentification;
  specs: CarSpecs;
  reviews: AggregatedReviews;
  infographicUrl: string | null;
  scannedAt: string; // ISO date string
}
