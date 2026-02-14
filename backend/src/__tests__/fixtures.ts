import {
  TrainIdentification,
  TrainSpecs,
  TrainFacts,
  RarityInfo,
  BlueprintTask,
} from "../types";

export function makeTrain(overrides?: Partial<TrainIdentification>): TrainIdentification {
  return {
    class: "Class 390",
    name: "Pendolino",
    operator: "Avanti West Coast",
    type: "EMU",
    designation: "Bo-Bo",
    yearBuilt: 2001,
    confidence: 92,
    color: "Avanti dark grey",
    description: "A tilting electric multiple unit used on the West Coast Main Line.",
    ...overrides,
  };
}

export function makeSpecs(overrides?: Partial<TrainSpecs>): TrainSpecs {
  return {
    maxSpeed: "125 mph",
    power: "5,100 kW",
    weight: "471 tonnes",
    length: "215 m",
    gauge: "Standard (1,435 mm)",
    builder: "Alstom",
    numberBuilt: 56,
    numberSurviving: 56,
    status: "In service",
    route: "West Coast Main Line",
    fuelType: "Electric (25kV AC)",
    ...overrides,
  };
}

export function makeFacts(overrides?: Partial<TrainFacts>): TrainFacts {
  return {
    summary: "The Pendolino is the flagship tilting train of the WCML.",
    historicalSignificance: "Replaced the original APT concept with proven Fiat technology.",
    funFacts: ["Can tilt up to 8 degrees", "Named after the Italian word for pendulum"],
    notableEvents: ["Introduced in 2002 for WCML upgrade"],
    ...overrides,
  };
}

export function makeRarity(overrides?: Partial<RarityInfo>): RarityInfo {
  return {
    tier: "common",
    reason: "Large fleet of modern EMUs in daily service.",
    productionCount: 56,
    survivingCount: 56,
    ...overrides,
  };
}

export function makeBlueprintTask(overrides?: Partial<BlueprintTask>): BlueprintTask {
  return {
    taskId: "test-task-123",
    status: "queued",
    imageUrl: null,
    error: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    completedAt: null,
    ...overrides,
  };
}
