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
});
