import { makeTrain, makeSpecs, makeFacts, makeRarity } from "../fixtures";

// Mock fs module to avoid disk I/O in tests
jest.mock("fs", () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn(),
}));

// We need to re-import after mocking
let getCachedTrainData: any;
let setCachedTrainData: any;
let setCachedBlueprint: any;
let getCacheStats: any;

beforeEach(() => {
  jest.resetModules();
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

  it("returns null on cache miss", () => {
    const result = getCachedTrainData(makeTrain({ class: "Nonexistent" }));
    expect(result).toBeNull();
  });

  it("returns cached data on hit", () => {
    setCachedTrainData(train, specs, facts, rarity);
    const result = getCachedTrainData(train);
    expect(result).not.toBeNull();
    expect(result!.specs.maxSpeed).toBe("125 mph");
    expect(result!.rarity.tier).toBe("common");
  });

  it("returns null for blueprint before one is cached", () => {
    setCachedTrainData(train, specs, facts, rarity);
    const result = getCachedTrainData(train);
    expect(result!.blueprintUrl).toBeNull();
  });

  it("stores and retrieves style-keyed blueprints", () => {
    setCachedTrainData(train, specs, facts, rarity);
    setCachedBlueprint(train, "https://example.com/vintage.png", "vintage");

    const result = getCachedTrainData(train, "vintage");
    expect(result!.blueprintUrl).toBe("https://example.com/vintage.png");
  });

  it("falls back to legacy blueprintUrl for technical style", () => {
    setCachedTrainData(train, specs, facts, rarity);
    setCachedBlueprint(train, "https://example.com/tech.png", "technical");

    const result = getCachedTrainData(train, "technical");
    expect(result!.blueprintUrl).toBe("https://example.com/tech.png");
  });

  it("returns null blueprint when requesting uncached style", () => {
    setCachedTrainData(train, specs, facts, rarity);
    setCachedBlueprint(train, "https://example.com/tech.png", "technical");

    const result = getCachedTrainData(train, "cinematic");
    expect(result!.blueprintUrl).toBeNull();
  });

  it("tracks cache stats correctly", () => {
    setCachedTrainData(train, specs, facts, rarity);
    getCachedTrainData(train); // hit
    getCachedTrainData(train); // hit
    getCachedTrainData(makeTrain({ class: "Missing" })); // miss

    const stats = getCacheStats();
    expect(stats.totalEntries).toBe(1);
    expect(stats.totalHits).toBe(2);
    expect(stats.totalMisses).toBe(1);
  });
});
