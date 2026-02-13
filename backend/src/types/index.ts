// ============================================================
// CarSnap — Shared Types
// ============================================================

export interface CarIdentification {
  make: string;
  model: string;
  year: number;
  trim: string;
  confidence: number; // 0-100
  color: string;
  bodyStyle: string; // sedan, SUV, truck, coupe, etc.
  description: string;
}

export interface CarSpecs {
  safetyRating: number | null; // 1-5 stars (NHTSA)
  crashTestRatings: {
    overall: number | null;
    frontal: number | null;
    side: number | null;
    rollover: number | null;
  };
  fuelEconomy: {
    city: number | null; // MPG
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
  score: number; // 0-10
  url: string;
}

export interface AggregatedReviews {
  overallScore: number; // 0-10
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

export interface InfographicTask {
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

export interface ImageStatusResponse {
  taskId: string;
  status: "queued" | "processing" | "completed" | "failed";
  imageUrl: string | null;
  error: string | null;
}
