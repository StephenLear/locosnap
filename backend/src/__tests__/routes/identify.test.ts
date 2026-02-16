import request from "supertest";
import express from "express";

// Mock all service dependencies
jest.mock("../../config/env", () => ({
  config: {
    anthropicApiKey: "test-key",
    openaiApiKey: "",
    replicateApiToken: "",
    hasAnthropic: true,
    hasOpenAI: false,
    hasReplicate: false,
    hasImageGen: false,
    hasVision: true,
    hasSupabase: false,
    hasPostHog: false,
    hasSentry: false,
    hasRevenueCat: false,
    frontendUrl: "http://localhost:8081",
    nodeEnv: "test",
  },
}));

const mockIdentify = jest.fn();
jest.mock("../../services/vision", () => ({
  identifyTrainFromImage: (...args: any[]) => mockIdentify(...args),
}));

const mockGetSpecs = jest.fn();
jest.mock("../../services/trainSpecs", () => ({
  getTrainSpecs: (...args: any[]) => mockGetSpecs(...args),
}));

const mockGetFacts = jest.fn();
jest.mock("../../services/trainFacts", () => ({
  getTrainFacts: (...args: any[]) => mockGetFacts(...args),
}));

const mockClassifyRarity = jest.fn();
jest.mock("../../services/rarity", () => ({
  classifyRarity: (...args: any[]) => mockClassifyRarity(...args),
}));

const mockStartBlueprint = jest.fn();
const mockGetTaskStatus = jest.fn();
jest.mock("../../services/imageGen", () => ({
  startBlueprintGeneration: (...args: any[]) => mockStartBlueprint(...args),
  getTaskStatus: (...args: any[]) => mockGetTaskStatus(...args),
}));

jest.mock("../../services/trainCache", () => ({
  getCachedTrainData: jest.fn().mockReturnValue(null),
  setCachedTrainData: jest.fn(),
  setCachedBlueprint: jest.fn(),
}));

jest.mock("../../services/analytics", () => ({
  trackServerEvent: jest.fn(),
  captureServerError: jest.fn(),
}));

jest.mock("../../middleware/errorHandler", () => ({
  AppError: class AppError extends Error {
    statusCode: number;
    constructor(msg: string, code: number) {
      super(msg);
      this.statusCode = code;
    }
  },
}));

import identifyRouter from "../../routes/identify";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/identify", identifyRouter);
  return app;
}

describe("POST /api/identify", () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIdentify.mockResolvedValue({
      class: "Class 390",
      name: "Pendolino",
      operator: "Avanti West Coast",
      type: "EMU",
      designation: "Bo-Bo",
      yearBuilt: 2001,
      confidence: 92,
      color: "Dark grey",
      description: "Tilting EMU",
    });
    mockGetSpecs.mockResolvedValue({
      maxSpeed: "125 mph", power: "5,100 kW", weight: null, length: null,
      gauge: null, builder: null, numberBuilt: null, numberSurviving: null,
      status: null, route: null, fuelType: null,
    });
    mockGetFacts.mockResolvedValue({
      summary: "A tilting train.", historicalSignificance: null,
      funFacts: [], notableEvents: [],
    });
    mockClassifyRarity.mockResolvedValue({
      tier: "common", reason: "Large fleet",
      productionCount: 56, survivingCount: 56,
    });
    mockStartBlueprint.mockResolvedValue("task-abc-123");
  });

  it("returns 400 when no image is uploaded", async () => {
    const res = await request(app).post("/api/identify");
    expect(res.status).toBe(400);
  });

  it("identifies a train from an uploaded image", async () => {
    const res = await request(app)
      .post("/api/identify")
      .attach("image", Buffer.from("fake-image"), {
        filename: "train.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.train.class).toBe("Class 390");
    expect(res.body.data.specs.maxSpeed).toBe("125 mph");
    expect(res.body.data.rarity.tier).toBe("common");
    // No generateBlueprint flag → blueprint should be null (free user)
    expect(res.body.data.blueprint).toBeNull();
  });

  it("returns blueprint task when generateBlueprint is true (Pro user)", async () => {
    const res = await request(app)
      .post("/api/identify")
      .attach("image", Buffer.from("fake-image"), {
        filename: "train.jpg",
        contentType: "image/jpeg",
      })
      .field("generateBlueprint", "true");

    expect(res.status).toBe(200);
    expect(res.body.data.blueprint.taskId).toBe("task-abc-123");
    expect(res.body.data.blueprint.status).toBe("queued");
  });

  it("returns 422 when vision can't identify a train", async () => {
    mockIdentify.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/identify")
      .attach("image", Buffer.from("not-a-train"), {
        filename: "cat.jpg",
        contentType: "image/jpeg",
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain("Could not identify");
  });

  it("validates blueprint style parameter", async () => {
    const res = await request(app)
      .post("/api/identify")
      .attach("image", Buffer.from("fake"), {
        filename: "train.jpg",
        contentType: "image/jpeg",
      })
      .field("blueprintStyle", "vintage")
      .field("generateBlueprint", "true");

    expect(res.status).toBe(200);
    expect(mockStartBlueprint).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      "vintage"
    );
  });

  it("defaults invalid style to technical", async () => {
    const res = await request(app)
      .post("/api/identify")
      .attach("image", Buffer.from("fake"), {
        filename: "train.jpg",
        contentType: "image/jpeg",
      })
      .field("blueprintStyle", "invalid_style")
      .field("generateBlueprint", "true");

    expect(res.status).toBe(200);
    expect(mockStartBlueprint).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      "technical"
    );
  });

  it("rejects non-image file types", async () => {
    const res = await request(app)
      .post("/api/identify")
      .attach("image", Buffer.from("fake"), {
        filename: "train.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(400);
  });
});
