import { makeTrain, makeSpecs } from "../fixtures";

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

import { classifyRarity } from "../../services/rarity";

describe("classifyRarity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns parsed rarity for a valid AI response", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tier: "rare",
            reason: "Heritage steam — only 6 surviving",
            productionCount: 35,
            survivingCount: 6,
          }),
        },
      ],
    });

    const result = await classifyRarity(
      makeTrain({ class: "A4", type: "Steam" }),
      makeSpecs({ numberSurviving: 6 })
    );

    expect(result.tier).toBe("rare");
    expect(result.reason).toContain("surviving");
    expect(result.survivingCount).toBe(6);
  });

  it("handles JSON wrapped in code fences", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '```json\n{"tier":"epic","reason":"Famous named loco","productionCount":1,"survivingCount":1}\n```',
        },
      ],
    });

    const result = await classifyRarity(makeTrain(), makeSpecs());
    expect(result.tier).toBe("epic");
  });

  it("returns fallback for invalid JSON", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot identify this train" }],
    });

    const result = await classifyRarity(makeTrain(), makeSpecs());
    expect(result.tier).toBe("common");
    expect(result.reason).toBe("Unable to classify rarity.");
  });

  it("returns fallback when API throws", async () => {
    mockCreate.mockRejectedValue(new Error("API timeout"));

    const result = await classifyRarity(makeTrain(), makeSpecs());
    expect(result.tier).toBe("common");
  });

  it("clamps invalid tier to common", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tier: "mythical",
            reason: "Invalid tier",
            productionCount: 1,
            survivingCount: 1,
          }),
        },
      ],
    });

    const result = await classifyRarity(makeTrain(), makeSpecs());
    expect(result.tier).toBe("common");
  });
});
