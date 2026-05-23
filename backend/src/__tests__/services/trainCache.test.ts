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

  it("uses a language-prefixed cache key (no global version)", async () => {
    const { setTrainCache } = require("../../services/redis");
    await setCachedTrainData(train, specs, facts, rarity);
    const keyUsed: string = setTrainCache.mock.calls[0][0];
    // Format: "<language>::<class>::<operator>" all lowercase, no version prefix.
    // The version prefix was removed in favour of per-class invalidation —
    // see CLASS_INVALIDATIONS in trainCache.ts.
    expect(keyUsed).toMatch(/^[a-z]{2}::/);
    expect(keyUsed).not.toMatch(/^v\d+::/);
  });

  it("includes language in cache key — English", async () => {
    const { setTrainCache } = require("../../services/redis");
    await setCachedTrainData(train, specs, facts, rarity, "en");
    const keyUsed: string = setTrainCache.mock.calls[0][0];
    expect(keyUsed).toMatch(/^en::/);
  });

  it("includes language in cache key — German", async () => {
    const { setTrainCache } = require("../../services/redis");
    await setCachedTrainData(train, specs, facts, rarity, "de");
    const keyUsed: string = setTrainCache.mock.calls[0][0];
    expect(keyUsed).toMatch(/^de::/);
  });

  it("German and English entries do not collide", async () => {
    await setCachedTrainData(train, specs, facts, rarity, "en");
    await setCachedTrainData(
      train,
      makeSpecs({ maxSpeed: "300 km/h" }),
      facts,
      rarity,
      "de"
    );

    const enResult = await getCachedTrainData(train, "technical", "en");
    const deResult = await getCachedTrainData(train, "technical", "de");

    expect(enResult!.specs.maxSpeed).toBe("125 mph");
    expect(deResult!.specs.maxSpeed).toBe("300 km/h");
  });

  it("defaults to 'en' language when language param is omitted", async () => {
    const { setTrainCache } = require("../../services/redis");
    await setCachedTrainData(train, specs, facts, rarity);
    const keyUsed: string = setTrainCache.mock.calls[0][0];
    expect(keyUsed).toMatch(/^en::/);
  });

  it("invalidates a cached entry when its class is added to CLASS_INVALIDATIONS after caching", async () => {
    const { CLASS_INVALIDATIONS } = require("../../services/trainCache");

    // Cache the entry first
    await setCachedTrainData(train, specs, facts, rarity);
    expect(await getCachedTrainData(train)).not.toBeNull();

    // Now add an invalidation timestamp in the FUTURE relative to the entry
    CLASS_INVALIDATIONS[train.class.toLowerCase().trim()] = new Date(
      Date.now() + 1000
    ).toISOString();

    // The previously-cached entry should now be treated as a miss
    const result = await getCachedTrainData(train);
    expect(result).toBeNull();
  });

  it("does not invalidate other classes when one class is invalidated", async () => {
    const { CLASS_INVALIDATIONS } = require("../../services/trainCache");
    const otherTrain = makeTrain({ class: "Class 91", operator: "LNER" });

    await setCachedTrainData(train, specs, facts, rarity);
    await setCachedTrainData(otherTrain, specs, facts, rarity);

    CLASS_INVALIDATIONS[train.class.toLowerCase().trim()] = new Date(
      Date.now() + 1000
    ).toISOString();

    // The invalidated class is gone, but the other class still hits
    expect(await getCachedTrainData(train)).toBeNull();
    expect(await getCachedTrainData(otherTrain)).not.toBeNull();
  });

  it("does not invalidate when entry was cached AFTER the invalidation timestamp", async () => {
    const { CLASS_INVALIDATIONS } = require("../../services/trainCache");

    // Set the invalidation timestamp in the PAST first
    CLASS_INVALIDATIONS[train.class.toLowerCase().trim()] = new Date(
      Date.now() - 60_000
    ).toISOString();

    // Cache the entry now (after the invalidation timestamp)
    await setCachedTrainData(train, specs, facts, rarity);

    // The entry should still be valid since it was cached after the invalidation
    expect(await getCachedTrainData(train)).not.toBeNull();
  });
});
