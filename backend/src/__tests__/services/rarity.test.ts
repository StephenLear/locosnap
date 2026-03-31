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

  it("prepends German instruction when language is 'de'", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tier: "common",
            reason: "Häufiger moderner Zug.",
            productionCount: 56,
            survivingCount: 56,
          }),
        },
      ],
    });

    await classifyRarity(makeTrain(), makeSpecs(), "de");

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).toMatch(/^Respond in German \(Deutsch\)\. Use formal register\./);
  });

  it("does not prepend German instruction when language is 'en'", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tier: "common",
            reason: "Large fleet",
            productionCount: 56,
            survivingCount: 56,
          }),
        },
      ],
    });

    await classifyRarity(makeTrain(), makeSpecs(), "en");

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).not.toContain("Respond in German");
  });

  it("defaults to English when language param is omitted", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            tier: "common",
            reason: "Large fleet",
            productionCount: 56,
            survivingCount: 56,
          }),
        },
      ],
    });

    await classifyRarity(makeTrain(), makeSpecs());

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptSent).not.toContain("Respond in German");
  });
});
