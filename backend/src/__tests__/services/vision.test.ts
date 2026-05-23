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

import { identifyTrainFromImage, getVisionProvider, downscaleForVision } from "../../services/vision";
import sharp from "sharp";

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

describe("downscaleForVision", () => {
  it("downscales a 1920px image to 1280px on longest edge", async () => {
    const oversized = await sharp({
      create: { width: 1920, height: 1080, channels: 3, background: { r: 100, g: 100, b: 100 } },
    })
      .jpeg()
      .toBuffer();

    const { buffer, mimeType } = await downscaleForVision(oversized, "image/jpeg");
    const meta = await sharp(buffer).metadata();

    expect(meta.width).toBe(1280);
    expect(meta.height).toBe(720);
    expect(mimeType).toBe("image/jpeg");
    expect(buffer.length).toBeLessThan(oversized.length);
  });

  it("leaves small images unchanged (no re-encode)", async () => {
    const small = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 200, b: 200 } },
    })
      .jpeg()
      .toBuffer();

    const { buffer, mimeType } = await downscaleForVision(small, "image/jpeg");
    expect(buffer).toBe(small);
    expect(mimeType).toBe("image/jpeg");
  });

  it("falls back to original buffer on a corrupt image", async () => {
    const corrupt = Buffer.from("not-an-image");
    const { buffer, mimeType } = await downscaleForVision(corrupt, "image/jpeg");
    expect(buffer).toBe(corrupt);
    expect(mimeType).toBe("image/jpeg");
  });
});
