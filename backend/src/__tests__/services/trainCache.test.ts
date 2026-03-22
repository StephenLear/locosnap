import { makeTrain, makeSpecs, makeFacts, makeRarity } from "../fixtures";

// Mock the redis layer so trainCache L2 is a no-op in tests
// L1 (in-memory Map) still works normally — that's what we're testing
jest.mock("../../services/redis", () => ({
  getTrainCache: jest.fn().mockResolvedValue(null),
  setTrainCache: jest.fn().mockResolvedValue(undefined),
}));

let getCachedTrainData: any;
let setCachedTrainData: any;
let setCachedBlueprint: any;
let getCacheStats: any;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  // Re-mock redis after resetModules so the fresh trainCache module gets the mock
  jest.mock("../../services/redis", () => ({
    getTrainCache: jest.fn().mockResolvedValue(null),
    setTrainCache: jest.fn().mockResolvedValue(undefined),
  }));

  const cache = require("../../services/trainCache");
  getCachedTrainData = cache.getCachedTrainData;
  setCachedTrainData = cache.setCachedTrainData;
  setCachedBlueprint = cache.setCachedBlueprint;
  getCacheStats = cache.getCacheStats;
});

describe("trainCache", () => {
  const train = makeTrain({ class: "Class 390", operator: "Avanti West Coast" });
  const specs = makeSpecs();
  const facts = makeFacts();
  const rarity = makeRarity();

  it("returns null on cache miss", async () => {
    const result = await getCachedTrainData(makeTrain({ class: "Nonexistent" }));
    expect(result).toBeNull();
  });

  it("returns cached data on hit", async () => {
    await setCachedTrainData(train, specs, facts, rarity);
    const result = await getCachedTrainData(train);
    expect(result).not.toBeNull();
    expect(result!.specs.maxSpeed).toBe("125 mph");
    expect(result!.rarity.tier).toBe("common");
  });

  it("returns null for blueprint before one is cached", async () => {
    await setCachedTrainData(train, specs, facts, rarity);
    const result = await getCachedTrainData(train);
    expect(result!.blueprintUrl).toBeNull();
  });

  it("stores and retrieves style-keyed blueprints", async () => {
    await setCachedTrainData(train, specs, facts, rarity);
    await setCachedBlueprint(train, "https://example.com/vintage.png", "vintage");

    const result = await getCachedTrainData(train, "vintage");
    expect(result!.blueprintUrl).toBe("https://example.com/vintage.png");
  });

  it("falls back to legacy blueprintUrl for technical style", async () => {
    await setCachedTrainData(train, specs, facts, rarity);
    await setCachedBlueprint(train, "https://example.com/tech.png", "technical");

    const result = await getCachedTrainData(train, "technical");
    expect(result!.blueprintUrl).toBe("https://example.com/tech.png");
  });

  it("returns null blueprint when requesting uncached style", async () => {
    await setCachedTrainData(train, specs, facts, rarity);
    await setCachedBlueprint(train, "https://example.com/tech.png", "technical");

    const result = await getCachedTrainData(train, "cinematic");
    expect(result!.blueprintUrl).toBeNull();
  });

  it("tracks cache stats correctly", async () => {
    await setCachedTrainData(train, specs, facts, rarity);
    await getCachedTrainData(train); // hit
    await getCachedTrainData(train); // hit
    await getCachedTrainData(makeTrain({ class: "Missing" })); // miss

    const stats = getCacheStats();
    expect(stats.totalEntries).toBe(1);
    expect(stats.totalHits).toBe(2);
    expect(stats.totalMisses).toBe(1);
  });
});
