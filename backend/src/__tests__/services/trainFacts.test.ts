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

// Mock Wikidata — returns null by default so existing tests are unaffected
const mockGetWikidataSpecs = jest.fn().mockResolvedValue(null);
jest.mock("../../services/wikidataSpecs", () => ({
  getWikidataSpecs: (...args: any[]) => mockGetWikidataSpecs(...args),
}));

import { getTrainFacts } from "../../services/trainFacts";

describe("getTrainFacts", () => {
  beforeEach(() => jest.clearAllMocks());

  it("parses a valid facts response", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            summary: "The Class 43 HST is the iconic InterCity 125.",
            historicalSignificance: "Held the world speed record for diesel traction.",
            funFacts: ["Nicknamed 'The Buffer Express'", "Over 2 billion miles in service"],
            notableEvents: ["Set diesel speed record of 148 mph in 1987"],
          }),
        },
      ],
    });

    const result = await getTrainFacts(makeTrain({ class: "Class 43" }));
    expect(result.summary).toContain("InterCity 125");
    expect(result.funFacts).toHaveLength(2);
    expect(result.notableEvents).toHaveLength(1);
  });

  it("handles missing optional fields", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            summary: "A modern commuter unit.",
          }),
        },
      ],
    });

    const result = await getTrainFacts(makeTrain());
    expect(result.summary).toBe("A modern commuter unit.");
    expect(result.historicalSignificance).toBeNull();
    expect(result.funFacts).toEqual([]);
    expect(result.notableEvents).toEqual([]);
  });

  it("returns fallback on API error", async () => {
    mockCreate.mockRejectedValue(new Error("timeout"));

    const result = await getTrainFacts(makeTrain());
    expect(result.summary).toContain("Unable to generate");
  });

  it("returns fallback for malformed JSON", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "{{broken" }],
    });

    const result = await getTrainFacts(makeTrain());
    expect(result.funFacts).toEqual([]);
  });

  it("includes verified entry year in the VERIFIED FACTS block when Wikidata has it", async () => {
    mockGetWikidataSpecs.mockResolvedValueOnce({ yearIntroduced: "2020" });
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        summary: "Test summary.",
        historicalSignificance: null,
        funFacts: [],
        notableEvents: [],
      }) }],
    });

    await getTrainFacts(makeTrain({ class: "Desiro ML" }));

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).toContain("VERIFIED FACTS");
    expect(promptSent).toContain("Year introduced: 2020");
  });

  it("always emits the VERIFIED FACTS block with class/operator/type (even without Wikidata)", async () => {
    mockGetWikidataSpecs.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        summary: "Test.", historicalSignificance: null, funFacts: [], notableEvents: [],
      }) }],
    });

    await getTrainFacts(makeTrain({ class: "Class 390", operator: "Avanti West Coast", type: "EMU" }));

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).toContain("VERIFIED FACTS");
    expect(promptSent).toContain("Class: Class 390");
    expect(promptSent).toContain("Operator: Avanti West Coast");
    expect(promptSent).toContain("Type: EMU");
  });

  it("emits KNOWN_SPECS hardcoded override values in the VERIFIED FACTS block", async () => {
    // BR 114 has a full KNOWN_SPECS block in WIKIDATA_CORRECTIONS (builder
    // LEW Hennigsdorf, 160 km/h, 4,220 kW, 82 t, 37 units, 15 kV 16.7 Hz AC).
    // The block must surface in the facts prompt to block the Krauss-Maffei
    // / multi-system / NRW hallucinations that triggered the 2026-05-24 fix.
    mockGetWikidataSpecs.mockResolvedValueOnce(null);
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        summary: "Test.", historicalSignificance: null, funFacts: [], notableEvents: [],
      }) }],
    });

    await getTrainFacts(makeTrain({ class: "BR 114", operator: "DB Regio", type: "Electric" }));

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).toContain("Builder: LEW Hennigsdorf");
    expect(promptSent).toContain("Max speed: 160 km/h");
    expect(promptSent).toContain("Power: 4,220 kW");
    expect(promptSent).toContain("Fleet built: 37");
    expect(promptSent).toContain("Fuel / electrification: Electric (15 kV 16.7 Hz AC)");
    expect(promptSent).toContain("Gauge: Standard (1,435 mm)");
  });

  it("prefers KNOWN_SPECS override over Wikidata when both provide a field", async () => {
    // Wikidata says builder "Wrong Builder", but BR 114 KNOWN_SPECS says
    // "LEW Hennigsdorf". The verified block must show LEW, not the Wikidata value.
    mockGetWikidataSpecs.mockResolvedValueOnce({
      builder: "Wrong Builder From Wikidata",
      maxSpeed: "999 km/h",
    });
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        summary: "Test.", historicalSignificance: null, funFacts: [], notableEvents: [],
      }) }],
    });

    await getTrainFacts(makeTrain({ class: "BR 114", operator: "DB Regio", type: "Electric" }));

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).toContain("Builder: LEW Hennigsdorf");
    expect(promptSent).not.toContain("Wrong Builder From Wikidata");
    expect(promptSent).toContain("Max speed: 160 km/h");
    expect(promptSent).not.toContain("999 km/h");
  });

  it("uses Wikidata to fill fields that KNOWN_SPECS does not cover", async () => {
    // Class 390 KNOWN_SPECS covers maxSpeed/power/builder/numberBuilt/fuelType
    // but NOT weight or yearIntroduced. Those come from Wikidata when available.
    mockGetWikidataSpecs.mockResolvedValueOnce({
      weight: "466 tonnes",
      yearIntroduced: "2002",
    });
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        summary: "Test.", historicalSignificance: null, funFacts: [], notableEvents: [],
      }) }],
    });

    await getTrainFacts(makeTrain({ class: "Class 390" }));

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).toContain("Weight: 466 tonnes");
    expect(promptSent).toContain("Year introduced: 2002");
  });

  it("prepends German instruction when language is 'de'", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        summary: "Ein moderner Triebzug.",
        historicalSignificance: null,
        funFacts: [],
        notableEvents: [],
      }) }],
    });

    await getTrainFacts(makeTrain({ class: "ICE 3" }), "de");

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).toMatch(/^Respond in German \(Deutsch\)\. Use formal register\./);
  });

  it("does not prepend German instruction when language is 'en'", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        summary: "A modern train.",
        historicalSignificance: null,
        funFacts: [],
        notableEvents: [],
      }) }],
    });

    await getTrainFacts(makeTrain(), "en");

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).not.toContain("Respond in German");
  });

  it("defaults to English when language param is omitted", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        summary: "A modern train.",
        historicalSignificance: null,
        funFacts: [],
        notableEvents: [],
      }) }],
    });

    await getTrainFacts(makeTrain());

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).not.toContain("Respond in German");
  });
});
