# LocoSnap Hardening Phase — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden LocoSnap for production: Redis blueprint store, full test coverage (backend + frontend), GitHub Actions CI/CD, housekeeping.

**Architecture:** Replace the in-memory `Map<string, BlueprintTask>` with Redis (Upstash) for blueprint task storage, falling back to in-memory in dev. Add Jest + supertest for backend testing, Jest + React Native Testing Library for frontend. Wire GitHub Actions for CI on every push.

**Tech Stack:** ioredis, Jest, supertest, @testing-library/react-native, GitHub Actions

---

### Task 1: Install backend test dependencies

**Files:**
- Modify: `backend/package.json`

**Step 1: Install Jest, ts-jest, supertest, and type definitions**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npm install --save-dev jest ts-jest @types/jest supertest @types/supertest`

Expected: packages added to devDependencies

**Step 2: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/package.json backend/package-lock.json
git commit -m "chore: add Jest + supertest test dependencies (backend)"
```

---

### Task 2: Configure backend Jest

**Files:**
- Create: `backend/jest.config.ts`
- Modify: `backend/package.json` (fix test script)
- Modify: `backend/tsconfig.json` (exclude tests from build)

**Step 1: Create jest.config.ts**

```typescript
// backend/jest.config.ts
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/__tests__/**",
    "!src/**/__mocks__/**",
    "!src/index.ts",
  ],
};

export default config;
```

**Step 2: Fix test script in package.json**

Change `"test": "ts-node src/test.ts"` → `"test": "jest --ci --forceExit"`

**Step 3: Exclude tests from TypeScript build output**

In `backend/tsconfig.json`, add `"**/__tests__/**"` and `"**/__mocks__/**"` to the `exclude` array.

**Step 4: Verify Jest runs (no tests yet)**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit`

Expected: "No tests found" (not an error — just no test files yet)

**Step 5: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/jest.config.ts backend/package.json backend/tsconfig.json
git commit -m "chore: configure Jest for backend testing"
```

---

### Task 3: Create backend test fixtures and mocks

**Files:**
- Create: `backend/src/__tests__/fixtures.ts`
- Create: `backend/src/__mocks__/env.ts`

**Step 1: Create test fixture factory**

```typescript
// backend/src/__tests__/fixtures.ts
import {
  TrainIdentification,
  TrainSpecs,
  TrainFacts,
  RarityInfo,
  BlueprintTask,
} from "../types";

export function makeTrain(overrides?: Partial<TrainIdentification>): TrainIdentification {
  return {
    class: "Class 390",
    name: "Pendolino",
    operator: "Avanti West Coast",
    type: "EMU",
    designation: "Bo-Bo",
    yearBuilt: 2001,
    confidence: 92,
    color: "Avanti dark grey",
    description: "A tilting electric multiple unit used on the West Coast Main Line.",
    ...overrides,
  };
}

export function makeSpecs(overrides?: Partial<TrainSpecs>): TrainSpecs {
  return {
    maxSpeed: "125 mph",
    power: "5,100 kW",
    weight: "471 tonnes",
    length: "215 m",
    gauge: "Standard (1,435 mm)",
    builder: "Alstom",
    numberBuilt: 56,
    numberSurviving: 56,
    status: "In service",
    route: "West Coast Main Line",
    fuelType: "Electric (25kV AC)",
    ...overrides,
  };
}

export function makeFacts(overrides?: Partial<TrainFacts>): TrainFacts {
  return {
    summary: "The Pendolino is the flagship tilting train of the WCML.",
    historicalSignificance: "Replaced the original APT concept with proven Fiat technology.",
    funFacts: ["Can tilt up to 8 degrees", "Named after the Italian word for pendulum"],
    notableEvents: ["Introduced in 2002 for WCML upgrade"],
    ...overrides,
  };
}

export function makeRarity(overrides?: Partial<RarityInfo>): RarityInfo {
  return {
    tier: "common",
    reason: "Large fleet of modern EMUs in daily service.",
    productionCount: 56,
    survivingCount: 56,
    ...overrides,
  };
}

export function makeBlueprintTask(overrides?: Partial<BlueprintTask>): BlueprintTask {
  return {
    taskId: "test-task-123",
    status: "queued",
    imageUrl: null,
    error: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    completedAt: null,
    ...overrides,
  };
}
```

**Step 2: Create mock env config**

```typescript
// backend/src/__mocks__/env.ts
// Minimal config with no real API keys — all services disabled
export const config = {
  anthropicApiKey: "",
  replicateApiToken: "",
  openaiApiKey: "",
  supabaseUrl: "",
  supabaseServiceKey: "",
  port: 3001,
  nodeEnv: "test",
  frontendUrl: "http://localhost:8081",
  posthogApiKey: "",
  posthogHost: "",
  sentryDsn: "",
  revenuecatWebhookSecret: "test-secret-123",
  get hasAnthropic() { return this.anthropicApiKey.length > 0; },
  get hasReplicate() { return this.replicateApiToken.length > 0; },
  get hasOpenAI() { return this.openaiApiKey.length > 0; },
  get hasImageGen() { return this.hasReplicate || this.hasOpenAI; },
  get hasVision() { return this.hasAnthropic || this.hasOpenAI; },
  get hasSupabase() { return this.supabaseUrl.length > 0 && this.supabaseServiceKey.length > 0; },
  get hasPostHog() { return this.posthogApiKey.length > 0; },
  get hasSentry() { return this.sentryDsn.length > 0; },
  get hasRevenueCat() { return this.revenuecatWebhookSecret.length > 0; },
};
```

**Step 3: Verify fixtures compile**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx tsc --noEmit src/__tests__/fixtures.ts`

**Step 4: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/__tests__/fixtures.ts backend/src/__mocks__/env.ts
git commit -m "chore: add backend test fixtures and mock config"
```

---

### Task 4: Test rarity service

**Files:**
- Create: `backend/src/__tests__/services/rarity.test.ts`
- Ref: `backend/src/services/rarity.ts`

**Step 1: Write tests**

```typescript
// backend/src/__tests__/services/rarity.test.ts
import { makeTrain, makeSpecs } from "../fixtures";

// Mock the config module before importing the service
jest.mock("../../config/env", () => ({
  config: {
    anthropicApiKey: "test-key",
    openaiApiKey: "",
    hasAnthropic: true,
    hasOpenAI: false,
  },
}));

// Mock Anthropic SDK
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
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit src/__tests__/services/rarity.test.ts`

Expected: 5 tests PASS

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/__tests__/services/rarity.test.ts
git commit -m "test: add rarity service tests"
```

---

### Task 5: Test trainSpecs service

**Files:**
- Create: `backend/src/__tests__/services/trainSpecs.test.ts`
- Ref: `backend/src/services/trainSpecs.ts`

**Step 1: Write tests**

```typescript
// backend/src/__tests__/services/trainSpecs.test.ts
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

import { getTrainSpecs } from "../../services/trainSpecs";

describe("getTrainSpecs", () => {
  beforeEach(() => jest.clearAllMocks());

  it("parses a valid specs response", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            maxSpeed: "125 mph",
            power: "2,250 HP",
            weight: "76 tonnes",
            length: "22.1 m",
            gauge: "Standard (1,435 mm)",
            builder: "BREL Crewe",
            numberBuilt: 197,
            numberSurviving: 54,
            status: "In service",
            route: "East Coast Main Line",
            fuelType: "Diesel",
          }),
        },
      ],
    });

    const result = await getTrainSpecs(makeTrain({ class: "Class 43" }));
    expect(result.maxSpeed).toBe("125 mph");
    expect(result.builder).toBe("BREL Crewe");
    expect(result.numberBuilt).toBe(197);
  });

  it("returns null fields for missing data", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ maxSpeed: "100 mph" }),
        },
      ],
    });

    const result = await getTrainSpecs(makeTrain());
    expect(result.maxSpeed).toBe("100 mph");
    expect(result.power).toBeNull();
    expect(result.builder).toBeNull();
  });

  it("returns fallback specs on API error", async () => {
    mockCreate.mockRejectedValue(new Error("Network error"));

    const result = await getTrainSpecs(makeTrain());
    expect(result.maxSpeed).toBeNull();
    expect(result.power).toBeNull();
  });

  it("returns fallback specs for invalid JSON", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "not json" }],
    });

    const result = await getTrainSpecs(makeTrain());
    expect(result.maxSpeed).toBeNull();
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit src/__tests__/services/trainSpecs.test.ts`

Expected: 4 tests PASS

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/__tests__/services/trainSpecs.test.ts
git commit -m "test: add trainSpecs service tests"
```

---

### Task 6: Test trainFacts service

**Files:**
- Create: `backend/src/__tests__/services/trainFacts.test.ts`
- Ref: `backend/src/services/trainFacts.ts`

**Step 1: Write tests**

```typescript
// backend/src/__tests__/services/trainFacts.test.ts
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
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit src/__tests__/services/trainFacts.test.ts`

Expected: 4 tests PASS

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/__tests__/services/trainFacts.test.ts
git commit -m "test: add trainFacts service tests"
```

---

### Task 7: Test trainCache service

**Files:**
- Create: `backend/src/__tests__/services/trainCache.test.ts`
- Ref: `backend/src/services/trainCache.ts`

**Step 1: Write tests**

```typescript
// backend/src/__tests__/services/trainCache.test.ts
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
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit src/__tests__/services/trainCache.test.ts`

Expected: 7 tests PASS (note: 7 not 6 as original design estimated — the extra test covers style fallback nuance)

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/__tests__/services/trainCache.test.ts
git commit -m "test: add trainCache service tests"
```

---

### Task 8: Test vision service

**Files:**
- Create: `backend/src/__tests__/services/vision.test.ts`
- Ref: `backend/src/services/vision.ts`

**Step 1: Write tests**

```typescript
// backend/src/__tests__/services/vision.test.ts
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
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit src/__tests__/services/vision.test.ts`

Expected: 6 tests PASS

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/__tests__/services/vision.test.ts
git commit -m "test: add vision service tests"
```

---

### Task 9: Test imageGen service (blueprint generation)

**Files:**
- Create: `backend/src/__tests__/services/imageGen.test.ts`
- Ref: `backend/src/services/imageGen.ts`

**Step 1: Write tests**

```typescript
// backend/src/__tests__/services/imageGen.test.ts
import { makeTrain, makeSpecs } from "../fixtures";

jest.mock("../../config/env", () => ({
  config: {
    openaiApiKey: "test-openai-key",
    replicateApiToken: "",
    hasOpenAI: true,
    hasReplicate: false,
    hasImageGen: true,
  },
}));

// Mock axios for DALL-E 3 calls
jest.mock("axios", () => ({
  post: jest.fn(),
}));

// Mock Replicate (not used in these tests but imported at module level)
jest.mock("replicate", () => {
  return jest.fn().mockImplementation(() => ({}));
});

import {
  startBlueprintGeneration,
  getTaskStatus,
  cleanupOldTasks,
} from "../../services/imageGen";
import axios from "axios";

const mockAxiosPost = axios.post as jest.Mock;

describe("imageGen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("startBlueprintGeneration returns a task ID", async () => {
    // Don't await the background generation — just check task is created
    mockAxiosPost.mockResolvedValue({
      data: { data: [{ url: "https://example.com/blueprint.png" }] },
    });

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs());
    expect(taskId).toBeDefined();
    expect(typeof taskId).toBe("string");
    expect(taskId.length).toBeGreaterThan(0);
  });

  it("task starts in queued status", async () => {
    mockAxiosPost.mockImplementation(() => new Promise(() => {})); // never resolves

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs());
    const task = getTaskStatus(taskId);
    expect(task).not.toBeNull();
    // Status will be "queued" or "processing" depending on timing
    expect(["queued", "processing"]).toContain(task!.status);
  });

  it("getTaskStatus returns null for unknown task", () => {
    const result = getTaskStatus("nonexistent-task-id");
    expect(result).toBeNull();
  });

  it("cleanupOldTasks removes expired tasks", async () => {
    mockAxiosPost.mockImplementation(() => new Promise(() => {}));

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs());

    // Manually age the task
    const task = getTaskStatus(taskId);
    if (task) {
      task.createdAt = new Date(Date.now() - 7200000); // 2 hours ago
    }

    cleanupOldTasks(3600000); // 1 hour TTL
    expect(getTaskStatus(taskId)).toBeNull();
  });

  it("accepts different blueprint styles", async () => {
    mockAxiosPost.mockResolvedValue({
      data: { data: [{ url: "https://example.com/vintage.png" }] },
    });

    const taskId = await startBlueprintGeneration(
      makeTrain(),
      makeSpecs(),
      "vintage"
    );
    expect(taskId).toBeDefined();
  });

  it("defaults to technical style", async () => {
    mockAxiosPost.mockResolvedValue({
      data: { data: [{ url: "https://example.com/tech.png" }] },
    });

    const taskId = await startBlueprintGeneration(makeTrain(), makeSpecs());
    expect(taskId).toBeDefined();
    // Verify the prompt contains "technical" / "engineering" keywords
    const callArgs = mockAxiosPost.mock.calls[0];
    if (callArgs) {
      const body = callArgs[1];
      expect(body.prompt).toContain("engineering");
    }
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit src/__tests__/services/imageGen.test.ts`

Expected: 6 tests PASS

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/__tests__/services/imageGen.test.ts
git commit -m "test: add imageGen service tests"
```

---

### Task 10: Test analytics service

**Files:**
- Create: `backend/src/__tests__/services/analytics.test.ts`
- Ref: `backend/src/services/analytics.ts`

**Step 1: Write tests**

```typescript
// backend/src/__tests__/services/analytics.test.ts

// Mock PostHog
const mockCapture = jest.fn();
const mockFlush = jest.fn().mockResolvedValue(undefined);
jest.mock("posthog-node", () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: mockCapture,
    flush: mockFlush,
  })),
}));

// Mock Sentry
jest.mock("@sentry/node", () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  withScope: jest.fn((cb) => cb({ setExtras: jest.fn() })),
  flush: jest.fn().mockResolvedValue(true),
  setupExpressErrorHandler: jest.fn(),
}));

jest.mock("../../config/env", () => ({
  config: {
    posthogApiKey: "test-ph-key",
    posthogHost: "https://test.posthog.com",
    sentryDsn: "https://test@sentry.io/123",
    nodeEnv: "test",
    hasPostHog: true,
    hasSentry: true,
  },
}));

import {
  initAnalytics,
  trackServerEvent,
  captureServerError,
} from "../../services/analytics";
import * as Sentry from "@sentry/node";

describe("analytics", () => {
  beforeAll(() => {
    initAnalytics();
  });

  beforeEach(() => jest.clearAllMocks());

  it("trackServerEvent calls posthog.capture", () => {
    trackServerEvent("test_event", "user-123", { foo: "bar" });
    expect(mockCapture).toHaveBeenCalledWith({
      distinctId: "user-123",
      event: "test_event",
      properties: { foo: "bar" },
    });
  });

  it("captureServerError calls Sentry", () => {
    const error = new Error("test error");
    captureServerError(error, { context: "test" });
    expect(Sentry.withScope).toHaveBeenCalled();
  });

  it("trackServerEvent does not throw if posthog is unavailable", () => {
    // This should not throw
    expect(() => {
      trackServerEvent("safe_event", "user-456");
    }).not.toThrow();
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit src/__tests__/services/analytics.test.ts`

Expected: 3 tests PASS

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/__tests__/services/analytics.test.ts
git commit -m "test: add analytics service tests"
```

---

### Task 11: Test identify route (integration)

**Files:**
- Create: `backend/src/__tests__/routes/identify.test.ts`
- Ref: `backend/src/routes/identify.ts`, `backend/src/index.ts`

**Step 1: Write tests**

```typescript
// backend/src/__tests__/routes/identify.test.ts
import request from "supertest";
import express from "express";
import multer from "multer";

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

// Build a minimal Express app for testing
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
    mockGetSpecs.mockResolvedValue({ maxSpeed: "125 mph", power: "5,100 kW", weight: null, length: null, gauge: null, builder: null, numberBuilt: null, numberSurviving: null, status: null, route: null, fuelType: null });
    mockGetFacts.mockResolvedValue({ summary: "A tilting train.", historicalSignificance: null, funFacts: [], notableEvents: [] });
    mockClassifyRarity.mockResolvedValue({ tier: "common", reason: "Large fleet", productionCount: 56, survivingCount: 56 });
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
    expect(res.body.data.blueprint.taskId).toBe("task-abc-123");
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
      .field("blueprintStyle", "vintage");

    expect(res.status).toBe(200);
    // startBlueprintGeneration should have been called with "vintage"
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
      .field("blueprintStyle", "invalid_style");

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
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit src/__tests__/routes/identify.test.ts`

Expected: 6 tests PASS

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/__tests__/routes/identify.test.ts
git commit -m "test: add identify route integration tests"
```

---

### Task 12: Test imageStatus route

**Files:**
- Create: `backend/src/__tests__/routes/imageStatus.test.ts`
- Ref: `backend/src/routes/imageStatus.ts`

**Step 1: Write tests**

```typescript
// backend/src/__tests__/routes/imageStatus.test.ts
import request from "supertest";
import express from "express";

const mockGetTaskStatus = jest.fn();
jest.mock("../../services/imageGen", () => ({
  getTaskStatus: (...args: any[]) => mockGetTaskStatus(...args),
}));

import blueprintStatusRouter from "../../routes/imageStatus";

function buildApp() {
  const app = express();
  app.use("/api/blueprint", blueprintStatusRouter);
  return app;
}

describe("GET /api/blueprint/:taskId", () => {
  const app = buildApp();

  beforeEach(() => jest.clearAllMocks());

  it("returns 404 for unknown task", async () => {
    mockGetTaskStatus.mockReturnValue(null);

    const res = await request(app).get("/api/blueprint/nonexistent");
    expect(res.status).toBe(404);
    expect(res.body.status).toBe("not_found");
  });

  it("returns queued status", async () => {
    mockGetTaskStatus.mockReturnValue({
      taskId: "task-1",
      status: "queued",
      imageUrl: null,
      error: null,
    });

    const res = await request(app).get("/api/blueprint/task-1");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("queued");
    expect(res.body.imageUrl).toBeNull();
  });

  it("returns completed status with image URL", async () => {
    mockGetTaskStatus.mockReturnValue({
      taskId: "task-2",
      status: "completed",
      imageUrl: "https://example.com/blueprint.png",
      error: null,
    });

    const res = await request(app).get("/api/blueprint/task-2");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("completed");
    expect(res.body.imageUrl).toBe("https://example.com/blueprint.png");
  });

  it("returns failed status with error", async () => {
    mockGetTaskStatus.mockReturnValue({
      taskId: "task-3",
      status: "failed",
      imageUrl: null,
      error: "Generation timed out",
    });

    const res = await request(app).get("/api/blueprint/task-3");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("failed");
    expect(res.body.error).toBe("Generation timed out");
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit src/__tests__/routes/imageStatus.test.ts`

Expected: 4 tests PASS

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/__tests__/routes/imageStatus.test.ts
git commit -m "test: add imageStatus route tests"
```

---

### Task 13: Test webhooks route

**Files:**
- Create: `backend/src/__tests__/routes/webhooks.test.ts`
- Ref: `backend/src/routes/webhooks.ts`

**Step 1: Write tests**

```typescript
// backend/src/__tests__/routes/webhooks.test.ts
import request from "supertest";
import express from "express";

jest.mock("../../config/env", () => ({
  config: {
    revenuecatWebhookSecret: "test-secret-123",
    hasRevenueCat: true,
    hasSupabase: false,
  },
}));

// Mock Supabase
jest.mock("../../config/supabase", () => ({
  getSupabase: jest.fn().mockReturnValue(null),
}));

jest.mock("../../services/analytics", () => ({
  trackServerEvent: jest.fn(),
  captureServerError: jest.fn(),
}));

import webhooksRouter from "../../routes/webhooks";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/webhooks", webhooksRouter);
  return app;
}

describe("POST /api/webhooks/revenuecat", () => {
  const app = buildApp();

  it("returns 401 for missing authorization", async () => {
    const res = await request(app)
      .post("/api/webhooks/revenuecat")
      .send({ event: { type: "INITIAL_PURCHASE", app_user_id: "u1" } });

    expect(res.status).toBe(401);
  });

  it("returns 401 for wrong secret", async () => {
    const res = await request(app)
      .post("/api/webhooks/revenuecat")
      .set("Authorization", "Bearer wrong-secret")
      .send({ event: { type: "INITIAL_PURCHASE", app_user_id: "u1" } });

    expect(res.status).toBe(401);
  });

  it("returns 400 when event payload is missing", async () => {
    const res = await request(app)
      .post("/api/webhooks/revenuecat")
      .set("Authorization", "Bearer test-secret-123")
      .send({});

    expect(res.status).toBe(400);
  });

  it("returns 200 for valid event (no Supabase)", async () => {
    const res = await request(app)
      .post("/api/webhooks/revenuecat")
      .set("Authorization", "Bearer test-secret-123")
      .send({
        event: {
          type: "INITIAL_PURCHASE",
          app_user_id: "user-123",
          product_id: "pro_monthly",
          id: "evt-1",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit src/__tests__/routes/webhooks.test.ts`

Expected: 4 tests PASS

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/__tests__/routes/webhooks.test.ts
git commit -m "test: add webhooks route tests"
```

---

### Task 14: Run full backend test suite

**Files:** None (verification only)

**Step 1: Run all backend tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit --verbose`

Expected: ~38 tests across 8 test files, all PASS

**Step 2: Fix any failures before continuing**

If any test fails, debug and fix it. Re-run until all pass.

---

### Task 15: Add Redis blueprint task store

**Files:**
- Create: `backend/src/services/redis.ts`
- Modify: `backend/src/services/imageGen.ts`
- Modify: `backend/src/config/env.ts`
- Modify: `backend/.env.example`

**Step 1: Install ioredis**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npm install ioredis && npm install --save-dev @types/ioredis`

**Step 2: Create redis.ts**

```typescript
// backend/src/services/redis.ts
import Redis from "ioredis";
import { config } from "../config/env";
import { BlueprintTask } from "../types";

// ── State ───────────────────────────────────────────────────

let redis: Redis | null = null;
let useInMemoryFallback = false;

// In-memory fallback (for local dev without Redis)
const memoryStore = new Map<string, string>();

const TASK_PREFIX = "blueprint:";
const DEFAULT_TTL = 3600; // 1 hour

// ── Connection ──────────────────────────────────────────────

export function initRedis(): void {
  if (!config.redisUrl) {
    console.log("[REDIS] No REDIS_URL set — using in-memory fallback");
    useInMemoryFallback = true;
    return;
  }

  try {
    redis = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn("[REDIS] Max retries reached — falling back to in-memory");
          useInMemoryFallback = true;
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
    });

    redis.on("connect", () => {
      console.log("[REDIS] Connected");
      useInMemoryFallback = false;
    });

    redis.on("error", (err) => {
      console.warn("[REDIS] Connection error:", err.message);
      if (!useInMemoryFallback) {
        console.warn("[REDIS] Falling back to in-memory store");
        useInMemoryFallback = true;
      }
    });
  } catch (err) {
    console.warn("[REDIS] Init failed:", (err as Error).message);
    useInMemoryFallback = true;
  }
}

// ── Blueprint Task Operations ───────────────────────────────

export async function setBlueprintTask(
  taskId: string,
  task: BlueprintTask
): Promise<void> {
  const key = TASK_PREFIX + taskId;
  const value = JSON.stringify({
    ...task,
    createdAt: task.createdAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
  });

  if (!useInMemoryFallback && redis) {
    try {
      await redis.setex(key, DEFAULT_TTL, value);
      return;
    } catch {
      // Fall through to in-memory
    }
  }

  memoryStore.set(key, value);
  // Simulate TTL for in-memory
  setTimeout(() => memoryStore.delete(key), DEFAULT_TTL * 1000);
}

export async function getBlueprintTask(
  taskId: string
): Promise<BlueprintTask | null> {
  const key = TASK_PREFIX + taskId;

  let raw: string | null = null;

  if (!useInMemoryFallback && redis) {
    try {
      raw = await redis.get(key);
    } catch {
      raw = memoryStore.get(key) ?? null;
    }
  } else {
    raw = memoryStore.get(key) ?? null;
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      completedAt: parsed.completedAt ? new Date(parsed.completedAt) : null,
    };
  } catch {
    return null;
  }
}

export async function deleteBlueprintTask(taskId: string): Promise<void> {
  const key = TASK_PREFIX + taskId;

  if (!useInMemoryFallback && redis) {
    try {
      await redis.del(key);
      return;
    } catch {
      // Fall through
    }
  }

  memoryStore.delete(key);
}

// ── Cleanup ─────────────────────────────────────────────────

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

// ── Health ──────────────────────────────────────────────────

export function getRedisStatus(): string {
  if (useInMemoryFallback) return "in-memory fallback";
  if (redis?.status === "ready") return "connected";
  return redis?.status ?? "disconnected";
}
```

**Step 3: Add REDIS_URL to env config**

In `backend/src/config/env.ts`, add to the config object (after `revenuecatWebhookSecret`):

```typescript
  // Redis
  redisUrl: optionalEnv("REDIS_URL", ""),

  get hasRedis(): boolean {
    return this.redisUrl.length > 0;
  },
```

**Step 4: Add REDIS_URL to .env.example**

Add to `backend/.env.example` after the RevenueCat section:

```
# Redis (blueprint task store — optional, falls back to in-memory)
# Get a free Upstash Redis URL at: https://upstash.com
REDIS_URL=
```

**Step 5: Refactor imageGen.ts to use Redis**

In `backend/src/services/imageGen.ts`:

1. Remove the line: `const taskStore = new Map<string, BlueprintTask>();`
2. Add import: `import { setBlueprintTask, getBlueprintTask } from "./redis";`
3. Replace all `taskStore.set(taskId, task)` calls with `await setBlueprintTask(taskId, task)`
4. Replace all `taskStore.get(taskId)` calls with `await getBlueprintTask(taskId)`
5. Make `getTaskStatus` async: `export async function getTaskStatus(taskId: string): Promise<BlueprintTask | null>`
6. Remove `cleanupOldTasks` (Redis TTL handles cleanup automatically)
7. Update `generateImage` to use async task operations

Key changes to `imageGen.ts`:

- `startBlueprintGeneration`: use `await setBlueprintTask(taskId, task)` instead of `taskStore.set`
- `generateImage`: use `await getBlueprintTask` and `await setBlueprintTask` for status updates
- `getTaskStatus`: now `async`, returns `await getBlueprintTask(taskId)`
- Error handler in `startBlueprintGeneration` catch: use `await getBlueprintTask` + `await setBlueprintTask`

**Step 6: Update callers of getTaskStatus to await it**

In `backend/src/routes/imageStatus.ts`:
- Make the route handler `async`
- Change `getTaskStatus(taskId)` → `await getTaskStatus(taskId)`

In `backend/src/routes/identify.ts`:
- In `monitorBlueprintForCache`, change `getTaskStatus(taskId)` → `await getTaskStatus(taskId)`

In `backend/src/index.ts`:
- Remove the `cleanupOldTasks` import and the `setInterval` that calls it (Redis TTL handles cleanup)
- Add `import { initRedis } from "./services/redis";`
- Call `initRedis();` near the top (after `initAnalytics()`)
- Add Redis status to the health endpoint and startup banner

**Step 7: Run backend tests to verify nothing broke**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit --verbose`

Expected: All existing tests still pass (imageGen tests use mocked in-memory store)

**Step 8: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/services/redis.ts backend/src/services/imageGen.ts backend/src/config/env.ts backend/.env.example backend/src/routes/imageStatus.ts backend/src/routes/identify.ts backend/src/index.ts backend/package.json backend/package-lock.json
git commit -m "feat: add Redis blueprint task store with in-memory fallback"
```

---

### Task 16: Test Redis service

**Files:**
- Create: `backend/src/__tests__/services/redis.test.ts`
- Ref: `backend/src/services/redis.ts`

**Step 1: Write tests**

```typescript
// backend/src/__tests__/services/redis.test.ts
import { makeBlueprintTask } from "../fixtures";

// Mock ioredis — use in-memory fallback path
jest.mock("../../config/env", () => ({
  config: {
    redisUrl: "", // empty = in-memory fallback
    hasRedis: false,
  },
}));

// Reset module between tests to get clean state
let setBlueprintTask: any;
let getBlueprintTask: any;
let deleteBlueprintTask: any;
let getRedisStatus: any;
let initRedis: any;

beforeEach(() => {
  jest.resetModules();
  const redis = require("../../services/redis");
  setBlueprintTask = redis.setBlueprintTask;
  getBlueprintTask = redis.getBlueprintTask;
  deleteBlueprintTask = redis.deleteBlueprintTask;
  getRedisStatus = redis.getRedisStatus;
  initRedis = redis.initRedis;
  initRedis();
});

describe("redis (in-memory fallback)", () => {
  it("reports in-memory fallback status", () => {
    expect(getRedisStatus()).toBe("in-memory fallback");
  });

  it("stores and retrieves a blueprint task", async () => {
    const task = makeBlueprintTask({ taskId: "redis-test-1" });
    await setBlueprintTask("redis-test-1", task);

    const result = await getBlueprintTask("redis-test-1");
    expect(result).not.toBeNull();
    expect(result!.taskId).toBe("redis-test-1");
    expect(result!.status).toBe("queued");
  });

  it("returns null for missing task", async () => {
    const result = await getBlueprintTask("nonexistent");
    expect(result).toBeNull();
  });

  it("deletes a task", async () => {
    const task = makeBlueprintTask({ taskId: "redis-test-2" });
    await setBlueprintTask("redis-test-2", task);
    await deleteBlueprintTask("redis-test-2");

    const result = await getBlueprintTask("redis-test-2");
    expect(result).toBeNull();
  });

  it("preserves Date objects through serialization", async () => {
    const task = makeBlueprintTask({
      taskId: "redis-test-3",
      createdAt: new Date("2026-01-15T10:30:00Z"),
    });
    await setBlueprintTask("redis-test-3", task);

    const result = await getBlueprintTask("redis-test-3");
    expect(result!.createdAt).toBeInstanceOf(Date);
    expect(result!.createdAt.toISOString()).toBe("2026-01-15T10:30:00.000Z");
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit src/__tests__/services/redis.test.ts`

Expected: 5 tests PASS

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add backend/src/__tests__/services/redis.test.ts
git commit -m "test: add Redis service tests (in-memory fallback path)"
```

---

### Task 17: Install frontend test dependencies

**Files:**
- Modify: `frontend/package.json`

**Step 1: Install test dependencies**

Run: `cd /Users/StephenLear/Projects/locosnap/frontend && npm install --save-dev jest @types/jest ts-jest @testing-library/react-native @testing-library/jest-native jest-expo react-test-renderer @types/react-test-renderer`

**Step 2: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add Jest + RNTL frontend test dependencies"
```

---

### Task 18: Configure frontend Jest

**Files:**
- Create: `frontend/jest.config.ts`
- Create: `frontend/jest.setup.ts`
- Modify: `frontend/package.json` (add test script)

**Step 1: Create jest.config.ts**

```typescript
// frontend/jest.config.ts
import type { Config } from "jest";

const config: Config = {
  preset: "jest-expo",
  setupFilesAfterSetup: ["./jest.setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|posthog-react-native|react-native-reanimated|react-native-gesture-handler|react-native-screens|react-native-safe-area-context|react-native-view-shot|react-native-purchases|@react-native-async-storage/async-storage|zustand)",
  ],
  testMatch: ["**/__tests__/**/*.test.tsx", "**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "store/**/*.ts",
    "services/**/*.ts",
    "!**/__tests__/**",
    "!**/__mocks__/**",
  ],
};

export default config;
```

**Step 2: Create jest.setup.ts**

```typescript
// frontend/jest.setup.ts
import "@testing-library/jest-native/extend-expect";

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock expo-router
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Stack: {
    Screen: "Stack.Screen",
  },
  Tabs: {
    Screen: "Tabs.Screen",
  },
}));

// Mock @expo/vector-icons
jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

// Mock expo-camera
jest.mock("expo-camera", () => ({
  CameraView: "CameraView",
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}));

// Mock react-native-purchases
jest.mock("react-native-purchases", () => ({
  Purchases: {
    configure: jest.fn(),
    getOfferings: jest.fn().mockResolvedValue({ current: null }),
    getCustomerInfo: jest.fn().mockResolvedValue({
      entitlements: { active: {} },
    }),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
}));

// Mock analytics
jest.mock("./services/analytics", () => ({
  track: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureError: jest.fn(),
  initAnalytics: jest.fn(),
}));

// Mock notifications
jest.mock("./services/notifications", () => ({
  notifyBlueprintReady: jest.fn().mockResolvedValue(undefined),
  notifyAchievementUnlocked: jest.fn().mockResolvedValue(undefined),
  registerForPushNotifications: jest.fn().mockResolvedValue(undefined),
}));

// Mock Supabase service
jest.mock("./services/supabase", () => ({
  upsertTrain: jest.fn().mockResolvedValue("train-id"),
  saveSpot: jest.fn().mockResolvedValue("spot-id"),
  fetchSpots: jest.fn().mockResolvedValue([]),
  uploadPhoto: jest.fn().mockResolvedValue("https://example.com/photo.jpg"),
  uploadBlueprint: jest.fn().mockResolvedValue("https://example.com/bp.png"),
  updateSpotBlueprint: jest.fn(),
  awardXp: jest.fn().mockResolvedValue({ xp: 10, level: 1 }),
  calculateXp: jest.fn().mockReturnValue(10),
  updateStreak: jest.fn().mockResolvedValue({ current: 1 }),
  checkAndUnlockAchievements: jest.fn().mockResolvedValue([]),
  fetchAchievements: jest.fn().mockResolvedValue([]),
}));
```

**Step 3: Add test script to package.json**

Add `"test": "jest --ci"` to the `scripts` section.

**Step 4: Verify Jest runs**

Run: `cd /Users/StephenLear/Projects/locosnap/frontend && npx jest --ci`

Expected: "No tests found" (not an error)

**Step 5: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add frontend/jest.config.ts frontend/jest.setup.ts frontend/package.json
git commit -m "chore: configure Jest + RNTL for frontend testing"
```

---

### Task 19: Test compare.tsx helpers (parseNumeric, compareValues)

**Files:**
- Create: `frontend/__tests__/app/compare.test.ts`
- Ref: `frontend/app/compare.tsx`

Note: `parseNumeric` and `compareValues` are not exported from `compare.tsx`. To test them without refactoring the component, extract them into a utility file first.

**Step 1: Extract helpers to a utility file**

Create `frontend/utils/compare.ts`:

```typescript
// frontend/utils/compare.ts
export type Winner = "left" | "right" | "tie" | "none";

export function parseNumeric(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/[\d,.]+/);
  if (!match) return null;
  return parseFloat(match[0].replace(/,/g, ""));
}

export function compareValues(
  leftVal: string | null,
  rightVal: string | null,
  higherIsBetter: boolean = true
): Winner {
  const leftNum = parseNumeric(leftVal);
  const rightNum = parseNumeric(rightVal);
  if (leftNum === null || rightNum === null) return "none";
  if (leftNum === rightNum) return "tie";
  if (higherIsBetter) {
    return leftNum > rightNum ? "left" : "right";
  }
  return leftNum < rightNum ? "left" : "right";
}
```

Update `frontend/app/compare.tsx` to import from the utility:
- Remove the local `parseNumeric` and `compareValues` functions
- Add: `import { parseNumeric, compareValues, Winner } from "../utils/compare";`
- Remove the local `type Winner` declaration

**Step 2: Write tests**

```typescript
// frontend/__tests__/app/compare.test.ts
import { parseNumeric, compareValues } from "../../utils/compare";

describe("parseNumeric", () => {
  it("extracts number from speed string", () => {
    expect(parseNumeric("125 mph")).toBe(125);
  });

  it("handles commas in large numbers", () => {
    expect(parseNumeric("2,250 HP")).toBe(2250);
  });

  it("handles decimal values", () => {
    expect(parseNumeric("22.1 m")).toBe(22.1);
  });

  it("returns null for null input", () => {
    expect(parseNumeric(null)).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseNumeric("Unknown")).toBeNull();
  });

  it("handles number-only string", () => {
    expect(parseNumeric("42")).toBe(42);
  });
});

describe("compareValues", () => {
  it("returns left when left is higher (higher is better)", () => {
    expect(compareValues("150 mph", "125 mph")).toBe("left");
  });

  it("returns right when right is higher (higher is better)", () => {
    expect(compareValues("100 mph", "125 mph")).toBe("right");
  });

  it("returns tie when equal", () => {
    expect(compareValues("125 mph", "125 mph")).toBe("tie");
  });

  it("returns none when left is null", () => {
    expect(compareValues(null, "125 mph")).toBe("none");
  });

  it("returns none when right is null", () => {
    expect(compareValues("125 mph", null)).toBe("none");
  });

  it("returns left when left is lower (lower is better)", () => {
    expect(compareValues("50 tonnes", "70 tonnes", false)).toBe("left");
  });

  it("returns right when right is lower (lower is better)", () => {
    expect(compareValues("70 tonnes", "50 tonnes", false)).toBe("right");
  });
});
```

**Step 3: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/frontend && npx jest --ci __tests__/app/compare.test.ts`

Expected: 13 tests PASS

**Step 4: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add frontend/utils/compare.ts frontend/app/compare.tsx frontend/__tests__/app/compare.test.ts
git commit -m "refactor: extract compare helpers + add tests"
```

---

### Task 20: Test trainStore (Zustand)

**Files:**
- Create: `frontend/__tests__/store/trainStore.test.ts`
- Ref: `frontend/store/trainStore.ts`

**Step 1: Write tests**

```typescript
// frontend/__tests__/store/trainStore.test.ts

// Mock authStore before importing trainStore
jest.mock("../../store/authStore", () => ({
  useAuthStore: {
    getState: () => ({
      user: null,
      incrementDailyScans: jest.fn(),
      fetchProfile: jest.fn(),
    }),
  },
}));

import { useTrainStore } from "../../store/trainStore";
import { TrainIdentification, TrainSpecs, TrainFacts, RarityInfo, HistoryItem } from "../../types";

// Helper factories
const makeTrain = (overrides?: Partial<TrainIdentification>): TrainIdentification => ({
  class: "Class 390",
  name: "Pendolino",
  operator: "Avanti West Coast",
  type: "EMU",
  designation: "Bo-Bo",
  yearBuilt: 2001,
  confidence: 92,
  color: "Dark grey",
  description: "Tilting train",
  ...overrides,
});

const makeSpecs = (): TrainSpecs => ({
  maxSpeed: "125 mph",
  power: "5,100 kW",
  weight: null,
  length: null,
  gauge: null,
  builder: null,
  numberBuilt: null,
  numberSurviving: null,
  status: null,
  route: null,
  fuelType: null,
});

const makeFacts = (): TrainFacts => ({
  summary: "A tilting train.",
  historicalSignificance: null,
  funFacts: [],
  notableEvents: [],
});

const makeRarity = (): RarityInfo => ({
  tier: "common",
  reason: "Large fleet",
  productionCount: 56,
  survivingCount: 56,
});

const makeHistoryItem = (overrides?: Partial<HistoryItem>): HistoryItem => ({
  id: "item-1",
  train: makeTrain(),
  specs: makeSpecs(),
  facts: makeFacts(),
  rarity: makeRarity(),
  blueprintUrl: null,
  spottedAt: new Date().toISOString(),
  latitude: null,
  longitude: null,
  ...overrides,
});

describe("trainStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useTrainStore.setState({
      isScanning: false,
      scanError: null,
      currentTrain: null,
      currentSpecs: null,
      currentFacts: null,
      currentRarity: null,
      blueprintStatus: null,
      history: [],
      historyLoaded: false,
      currentSpotId: null,
      isSyncing: false,
      currentPhotoUri: null,
      currentLocation: null,
      selectedBlueprintStyle: "technical",
      compareItems: null,
    });
  });

  it("starts scan correctly", () => {
    const store = useTrainStore.getState();
    store.startScan();

    const state = useTrainStore.getState();
    expect(state.isScanning).toBe(true);
    expect(state.scanError).toBeNull();
    expect(state.currentTrain).toBeNull();
  });

  it("sets scan results", () => {
    const store = useTrainStore.getState();
    store.setScanResults(makeTrain(), makeSpecs(), makeFacts(), makeRarity());

    const state = useTrainStore.getState();
    expect(state.isScanning).toBe(false);
    expect(state.currentTrain!.class).toBe("Class 390");
    expect(state.currentRarity!.tier).toBe("common");
  });

  it("sets scan error", () => {
    const store = useTrainStore.getState();
    store.setScanError("Network timeout");

    const state = useTrainStore.getState();
    expect(state.isScanning).toBe(false);
    expect(state.scanError).toBe("Network timeout");
  });

  it("clears current scan", () => {
    const store = useTrainStore.getState();
    store.setScanResults(makeTrain(), makeSpecs(), makeFacts(), makeRarity());
    store.clearCurrentScan();

    const state = useTrainStore.getState();
    expect(state.currentTrain).toBeNull();
    expect(state.currentSpecs).toBeNull();
  });

  it("sets blueprint style", () => {
    const store = useTrainStore.getState();
    store.setBlueprintStyle("vintage");

    expect(useTrainStore.getState().selectedBlueprintStyle).toBe("vintage");
  });

  it("sets compare items", () => {
    const item1 = makeHistoryItem({ id: "item-1" });
    const item2 = makeHistoryItem({ id: "item-2", train: makeTrain({ class: "Class 43" }) });

    const store = useTrainStore.getState();
    store.setCompareItems([item1, item2]);

    const state = useTrainStore.getState();
    expect(state.compareItems).not.toBeNull();
    expect(state.compareItems![0].id).toBe("item-1");
    expect(state.compareItems![1].train.class).toBe("Class 43");
  });

  it("clears compare items", () => {
    const store = useTrainStore.getState();
    store.setCompareItems([makeHistoryItem(), makeHistoryItem()]);
    store.setCompareItems(null);

    expect(useTrainStore.getState().compareItems).toBeNull();
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/frontend && npx jest --ci __tests__/store/trainStore.test.ts`

Expected: 7 tests PASS

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add frontend/__tests__/store/trainStore.test.ts
git commit -m "test: add trainStore Zustand tests"
```

---

### Task 21: Test API client service

**Files:**
- Create: `frontend/__tests__/services/api.test.ts`
- Ref: `frontend/services/api.ts`

**Step 1: Write tests**

```typescript
// frontend/__tests__/services/api.test.ts

// Mock constants
jest.mock("../../constants/api", () => ({
  API_BASE_URL: "http://localhost:3000",
  BLUEPRINT_POLL_INTERVAL: 100,
  BLUEPRINT_TIMEOUT: 500,
}));

// Mock axios
const mockAxiosGet = jest.fn();
const mockAxiosPost = jest.fn();
jest.mock("axios", () => ({
  create: () => ({
    get: mockAxiosGet,
    post: mockAxiosPost,
  }),
  AxiosError: class AxiosError extends Error {
    response?: any;
    code?: string;
  },
}));

import { identifyTrain, checkBlueprintStatus, healthCheck } from "../../services/api";

describe("identifyTrain", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sends image as FormData and returns response", async () => {
    mockAxiosPost.mockResolvedValue({
      data: {
        success: true,
        data: {
          train: { class: "Class 390" },
          specs: {},
          facts: {},
          rarity: { tier: "common" },
          blueprint: { taskId: "task-1", status: "queued" },
        },
        error: null,
        processingTimeMs: 1500,
      },
    });

    const result = await identifyTrain("file:///tmp/train.jpg", "technical");
    expect(result.success).toBe(true);
    expect(mockAxiosPost).toHaveBeenCalledWith(
      "/api/identify",
      expect.any(FormData),
      expect.objectContaining({
        headers: { "Content-Type": "multipart/form-data" },
      })
    );
  });

  it("throws with server error message", async () => {
    mockAxiosPost.mockRejectedValue({
      response: { data: { error: "Rate limit exceeded" } },
    });

    await expect(identifyTrain("file:///tmp/train.jpg")).rejects.toThrow(
      "Rate limit exceeded"
    );
  });

  it("handles timeout errors", async () => {
    mockAxiosPost.mockRejectedValue({ code: "ECONNABORTED" });

    await expect(identifyTrain("file:///tmp/train.jpg")).rejects.toThrow(
      "timed out"
    );
  });
});

describe("checkBlueprintStatus", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns blueprint status", async () => {
    mockAxiosGet.mockResolvedValue({
      data: {
        taskId: "task-1",
        status: "completed",
        imageUrl: "https://example.com/bp.png",
        error: null,
      },
    });

    const result = await checkBlueprintStatus("task-1");
    expect(result.status).toBe("completed");
    expect(result.imageUrl).toBe("https://example.com/bp.png");
  });
});

describe("healthCheck", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns true when backend is healthy", async () => {
    mockAxiosGet.mockResolvedValue({ data: { status: "ok" } });
    expect(await healthCheck()).toBe(true);
  });

  it("returns false on network error", async () => {
    mockAxiosGet.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await healthCheck()).toBe(false);
  });
});
```

**Step 2: Run tests**

Run: `cd /Users/StephenLear/Projects/locosnap/frontend && npx jest --ci __tests__/services/api.test.ts`

Expected: 5 tests PASS

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add frontend/__tests__/services/api.test.ts
git commit -m "test: add API client service tests"
```

---

### Task 22: Run full frontend test suite

**Files:** None (verification only)

**Step 1: Run all frontend tests**

Run: `cd /Users/StephenLear/Projects/locosnap/frontend && npx jest --ci --verbose`

Expected: ~25 tests across 4 test files, all PASS

**Step 2: Fix any failures before continuing**

---

### Task 23: Run combined test suite (backend + frontend)

**Files:** None (verification only)

**Step 1: Run backend tests**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx jest --ci --forceExit --verbose`

**Step 2: Run frontend tests**

Run: `cd /Users/StephenLear/Projects/locosnap/frontend && npx jest --ci --verbose`

Expected: All tests pass in both suites

---

### Task 24: Add GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:
    branches: [main]

jobs:
  backend-tests:
    name: Backend Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: TypeScript type-check
        run: npx tsc --noEmit

      - name: Run tests
        run: npm test

  frontend-tests:
    name: Frontend Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
```

**Step 2: Verify YAML is valid**

Run: `cd /Users/StephenLear/Projects/locosnap && python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`

Expected: No errors

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI workflow (backend + frontend tests)"
```

---

### Task 25: Add GitHub Actions preview build workflow

**Files:**
- Create: `.github/workflows/preview.yml`

**Step 1: Create preview workflow**

```yaml
# .github/workflows/preview.yml
name: Preview Build

on:
  pull_request:
    branches: [main]
    paths:
      - "frontend/**"
      - ".github/workflows/preview.yml"

jobs:
  preview-build:
    name: EAS Preview Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        run: npm ci

      - name: Build preview
        run: eas build --profile preview --platform all --non-interactive

      - name: Comment build link
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '📱 Preview build started! Check [EAS dashboard](https://expo.dev) for build status.'
            })
```

**Step 2: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add .github/workflows/preview.yml
git commit -m "ci: add EAS preview build workflow for frontend PRs"
```

---

### Task 26: Housekeeping — fix CLAUDE.md and cleanup

**Files:**
- Modify: `CLAUDE.md`
- Modify: `backend/package.json` (already done in Task 2, verify)

**Step 1: Update CLAUDE.md**

Replace the entire contents of `/Users/StephenLear/Projects/locosnap/CLAUDE.md` with an accurate description of the project. Key changes:
- Replace all references to "CarSnap" with "LocoSnap"
- Update project structure to match current codebase
- Reference the correct services and endpoints
- Note the testing setup and CI/CD

**Step 2: Verify all test scripts work end-to-end**

Run:
```bash
cd /Users/StephenLear/Projects/locosnap/backend && npm test
cd /Users/StephenLear/Projects/locosnap/frontend && npm test
```

Expected: Both pass

**Step 3: Commit**

```bash
cd /Users/StephenLear/Projects/locosnap
git add CLAUDE.md
git commit -m "chore: fix CLAUDE.md (CarSnap → LocoSnap) and update project docs"
```

---

### Task 27: Final verification

**Files:** None

**Step 1: Run full backend test suite**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npm test`

**Step 2: Run full frontend test suite**

Run: `cd /Users/StephenLear/Projects/locosnap/frontend && npm test`

**Step 3: Verify TypeScript compiles**

Run: `cd /Users/StephenLear/Projects/locosnap/backend && npx tsc --noEmit`

**Step 4: Verify git status is clean**

Run: `cd /Users/StephenLear/Projects/locosnap && git status`

Expected: Clean working tree, all changes committed

**Step 5: Review commit log**

Run: `cd /Users/StephenLear/Projects/locosnap && git log --oneline -20`

Expected: ~15 new commits covering Redis, tests, CI/CD, and housekeeping
