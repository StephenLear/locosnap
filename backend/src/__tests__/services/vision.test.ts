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

import { identifyTrainFromImage, getVisionProvider } from "../../services/vision";

describe("identifyTrainFromImage", () => {
  const testBuffer = Buffer.from("fake-image-data");

  beforeEach(() => jest.clearAllMocks());

  it("returns parsed train identification", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            class: "Class 43",
            name: null,
            operator: "GWR",
            type: "HST",
            designation: "Bo-Bo",
            yearBuilt: 1976,
            confidence: 85,
            color: "GWR Green",
            description: "High Speed Train power car",
          }),
        },
      ],
    });

    const result = await identifyTrainFromImage(testBuffer, "image/jpeg");
    expect(result).not.toBeNull();
    expect(result!.class).toBe("Class 43");
    expect(result!.confidence).toBe(85);
  });

  it("returns null for not-a-train response", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: "not_a_train" }),
        },
      ],
    });

    const result = await identifyTrainFromImage(testBuffer, "image/jpeg");
    expect(result).toBeNull();
  });

  it("returns null for malformed JSON", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "not valid json" }],
    });

    const result = await identifyTrainFromImage(testBuffer, "image/jpeg");
    expect(result).toBeNull();
  });

  it("handles non-text content blocks", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
    });

    const result = await identifyTrainFromImage(testBuffer, "image/jpeg");
    expect(result).toBeNull();
  });

  it("defaults missing fields gracefully", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            class: "Unknown Class",
            operator: "Unknown",
          }),
        },
      ],
    });

    const result = await identifyTrainFromImage(testBuffer, "image/jpeg");
    expect(result).not.toBeNull();
    expect(result!.name).toBeNull();
    expect(result!.type).toBe("Other");
    expect(result!.confidence).toBe(50);
  });
});

describe("getVisionProvider", () => {
  it("returns Claude when Anthropic key is set", () => {
    expect(getVisionProvider()).toBe("Claude Vision (Anthropic)");
  });
});
