import { makeTrain } from "../fixtures";

jest.mock("../../config/env", () => ({
  config: {
    anthropicApiKey: "test-key",
    openaiApiKey: "",
    hasAnthropic: true,
    hasOpenAI: false,
  },
}));

const mockCreate = jest.fn();
jest.mock("@anthropic-ai/sdk", () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
});

// Mock Wikidata — returns null by default so existing tests are unaffected.
// Override per-test to verify merge logic.
const mockGetWikidataSpecs = jest.fn().mockResolvedValue(null);
jest.mock("../../services/wikidataSpecs", () => ({
  getWikidataSpecs: (...args: any[]) => mockGetWikidataSpecs(...args),
}));

import { getTrainSpecs } from "../../services/trainSpecs";

describe("getTrainSpecs", () => {
  beforeEach(() => jest.clearAllMocks());

  it("parses a valid specs response", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            maxSpeed: "125 mph",
            power: "2,250 HP",
            weight: "76 tonnes",
            length: "22.1 m",
            gauge: "Standard (1,435 mm)",
            builder: "BREL Crewe",
            numberBuilt: 197,
            numberSurviving: 54,
            status: "In service",
            route: "East Coast Main Line",
            fuelType: "Diesel",
          }),
        },
      ],
    });

    const result = await getTrainSpecs(makeTrain({ class: "Class 43" }));
    expect(result.maxSpeed).toBe("125 mph");
    expect(result.builder).toBe("BREL Crewe");
    expect(result.numberBuilt).toBe(197);
  });

  it("returns null fields for missing data", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ maxSpeed: "100 mph" }),
        },
      ],
    });

    const result = await getTrainSpecs(makeTrain());
    expect(result.maxSpeed).toBe("100 mph");
    expect(result.power).toBeNull();
    expect(result.builder).toBeNull();
  });

  it("returns fallback specs on API error", async () => {
    mockCreate.mockRejectedValue(new Error("Network error"));

    const result = await getTrainSpecs(makeTrain());
    expect(result.maxSpeed).toBeNull();
    expect(result.power).toBeNull();
  });

  it("returns fallback specs for invalid JSON", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "not json" }],
    });

    const result = await getTrainSpecs(makeTrain());
    expect(result.maxSpeed).toBeNull();
  });

  it("Wikidata fields override AI fields when both present", async () => {
    // AI says 25kV and 75m — Wikidata says 15kV and 101m (correct)
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            maxSpeed: "160 km/h",
            length: "75 m",
            fuelType: "Electric (25kV 50Hz AC)",
            gauge: "Standard (1,435 mm)",
            route: "Berlin–Rostock",
          }),
        },
      ],
    });
    mockGetWikidataSpecs.mockResolvedValueOnce({
      length: "101.0 m",
      fuelType: "Electric (15kV 16.7Hz AC)",
      numberBuilt: 26,
    });

    const result = await getTrainSpecs(makeTrain({ class: "Desiro ML" }));
    expect(result.length).toBe("101.0 m");              // Wikidata wins
    expect(result.fuelType).toBe("Electric (15kV 16.7Hz AC)"); // Wikidata wins
    expect(result.numberBuilt).toBe(26);                // Wikidata wins
    expect(result.gauge).toBe("Standard (1,435 mm)");   // AI kept (Wikidata had none)
    expect(result.route).toBe("Berlin–Rostock");        // AI kept (Wikidata had none)
  });

  it("falls back to AI when Wikidata returns null", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ maxSpeed: "125 mph", builder: "BREL Crewe" }),
        },
      ],
    });
    mockGetWikidataSpecs.mockResolvedValueOnce(null);

    const result = await getTrainSpecs(makeTrain({ class: "Class 43" }));
    expect(result.maxSpeed).toBe("125 mph");
    expect(result.builder).toBe("BREL Crewe");
  });
});
