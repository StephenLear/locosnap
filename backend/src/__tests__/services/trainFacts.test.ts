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

  it("injects verified entry year into prompt when Wikidata has it", async () => {
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

    // Verify the prompt sent to the AI contains the verified year
    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).toContain("entered service in 2020");
  });

  it("omits year injection when Wikidata has no entry year", async () => {
    mockGetWikidataSpecs.mockResolvedValueOnce({ maxSpeed: "160 km/h" }); // no yearIntroduced
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({
        summary: "Test.", historicalSignificance: null, funFacts: [], notableEvents: [],
      }) }],
    });

    await getTrainFacts(makeTrain());

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).not.toContain("VERIFIED FACT");
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
