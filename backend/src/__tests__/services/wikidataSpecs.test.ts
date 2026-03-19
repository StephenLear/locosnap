import axios from "axios";
import { getWikidataSpecs, clearWikidataCache } from "../../services/wikidataSpecs";

jest.mock("axios");
const mockAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;

// ── Mock helpers ─────────────────────────────────────────────
//
// Wikidata uses two distinct URL patterns:
//   /w/api.php?action=wbsearchentities  → train search
//   /wiki/Special:EntityData/{QID}.json → entity / label fetch
//
// Distinguishing by URL avoids any dependency on mock call order,
// which would break when parallel searches fire 2 vs 3 queries.

function makeSearchResponse(results: { id: string; label: string; description: string }[]) {
  return { data: { search: results } };
}

function makeQuantityClaim(amount: number, unitQid: string) {
  return {
    mainsnak: {
      datavalue: {
        type: "quantity",
        value: { amount: `+${amount}`, unit: `http://www.wikidata.org/entity/${unitQid}` },
      },
    },
  };
}

function makeTimeClaim(year: string) {
  return {
    mainsnak: {
      datavalue: {
        type: "time",
        value: { time: `+${year}-00-00T00:00:00Z` },
      },
    },
  };
}

function makeItemClaim(qid: string) {
  return { mainsnak: { datavalue: { value: { id: qid } } } };
}

function makeEntityResponse(qid: string, claims: Record<string, any[]>) {
  return { data: { entities: { [qid]: { claims } } } };
}

function makeLabelResponse(qid: string, label: string) {
  return { data: { entities: { [qid]: { labels: { en: { value: label } } } } } };
}

/** Set up axios.get to respond based on URL pattern rather than call order. */
function setupMocks(opts: {
  trainQid: string;
  trainLabel: string;
  trainDescription: string;
  claims: Record<string, any[]>;
  manufacturerQid?: string;
  manufacturerLabel?: string;
}) {
  mockAxiosGet.mockImplementation(async (url: string) => {
    if ((url as string).includes("/w/api.php")) {
      // Search endpoint — return the train match on every call
      return makeSearchResponse([
        { id: opts.trainQid, label: opts.trainLabel, description: opts.trainDescription },
      ]);
    }
    if ((url as string).includes(opts.trainQid)) {
      return makeEntityResponse(opts.trainQid, opts.claims);
    }
    if (opts.manufacturerQid && (url as string).includes(opts.manufacturerQid)) {
      return makeLabelResponse(opts.manufacturerQid, opts.manufacturerLabel!);
    }
    return makeSearchResponse([]);
  });
}

// ── Tests ────────────────────────────────────────────────────

describe("getWikidataSpecs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearWikidataCache();
  });

  it("returns null when no railway match found", async () => {
    mockAxiosGet.mockResolvedValue(
      makeSearchResponse([{ id: "Q123", label: "Something", description: "a cheese" }])
    );
    expect(await getWikidataSpecs("Class 43", "GWR")).toBeNull();
  });

  it("returns null when search returns empty results", async () => {
    mockAxiosGet.mockResolvedValue(makeSearchResponse([]));
    expect(await getWikidataSpecs("Unknown Train", "Unknown Op")).toBeNull();
  });

  it("extracts speed, length, weight and fuelType", async () => {
    setupMocks({
      trainQid: "Q555", trainLabel: "Desiro ML", trainDescription: "electric multiple unit",
      claims: {
        P4979: [makeQuantityClaim(160, "Q180154")],    // 160 km/h
        P2043: [makeQuantityClaim(101, "Q11573")],     // 101 m
        P2067: [makeQuantityClaim(185000, "Q11570")],  // 185,000 kg → 185 t
        P2660: [makeQuantityClaim(15000, "Q25250")],   // 15,000 V → 15kV
      },
    });

    const result = await getWikidataSpecs("Desiro ML", "ODEG");
    expect(result).not.toBeNull();
    expect(result!.maxSpeed).toBe("160 km/h");
    expect(result!.length).toBe("101.0 m");
    expect(result!.weight).toBe("185 tonnes");
    expect(result!.fuelType).toBe("Electric (15kV 16.7Hz AC)");
  });

  it("handles mph speed units correctly", async () => {
    setupMocks({
      trainQid: "Q100", trainLabel: "Class 43", trainDescription: "diesel locomotive railway",
      claims: { P4979: [makeQuantityClaim(125, "Q158081")] }, // 125 mph
    });
    const result = await getWikidataSpecs("Class 43", "GWR");
    expect(result!.maxSpeed).toBe("125 mph");
  });

  it("converts tonnes unit correctly (no division needed)", async () => {
    setupMocks({
      trainQid: "Q200", trainLabel: "ICE 3", trainDescription: "intercity railway train",
      claims: { P2067: [makeQuantityClaim(409, "Q41803")] }, // already in tonnes
    });
    const result = await getWikidataSpecs("ICE 3", "DB");
    expect(result!.weight).toBe("409 tonnes");
  });

  it("converts watts to kW for power", async () => {
    setupMocks({
      trainQid: "Q300", trainLabel: "Class 390", trainDescription: "electric multiple unit railway",
      claims: { P2818: [makeQuantityClaim(7500000, "Q25269")] }, // 7.5MW → 7,500kW
    });
    const result = await getWikidataSpecs("Class 390", "Avanti");
    expect(result!.power).toBe("7500 kW");
  });

  it("fetches manufacturer label via secondary lookup", async () => {
    setupMocks({
      trainQid: "Q400", trainLabel: "Class 800", trainDescription: "electric multiple unit railway",
      claims: { P176: [makeItemClaim("Q40993")] },
      manufacturerQid: "Q40993",
      manufacturerLabel: "Hitachi",
    });
    const result = await getWikidataSpecs("Class 800", "LNER");
    expect(result!.builder).toBe("Hitachi");
  });

  it("extracts service entry year as yearIntroduced", async () => {
    setupMocks({
      trainQid: "Q700", trainLabel: "Desiro ML", trainDescription: "electric multiple unit railway",
      claims: {
        P729: [makeTimeClaim("2020")],
        P4979: [makeQuantityClaim(160, "Q180154")],
      },
    });
    const result = await getWikidataSpecs("Desiro ML", "ODEG");
    expect(result!.yearIntroduced).toBe("2020");
  });

  // test.each gives isolated failure per voltage rather than stopping the loop
  test.each([
    [15000, "Electric (15kV 16.7Hz AC)"],
    [25000, "Electric (25kV 50Hz AC)"],
    [3000,  "Electric (3kV DC)"],
    [1500,  "Electric (1.5kV DC)"],
    [750,   "Electric (750V DC third rail)"],
    [600,   "Electric (600V DC)"],
  ])("maps %iV to fuelType '%s'", async (volts, expected) => {
    clearWikidataCache();
    setupMocks({
      trainQid: "Q999", trainLabel: "Test Train", trainDescription: "locomotive railway",
      claims: { P2660: [makeQuantityClaim(volts, "Q25250")] },
    });
    const result = await getWikidataSpecs("Test Train", "Test Op");
    expect(result!.fuelType).toBe(expected);
  });

  it("returns null when entity has no usable fields", async () => {
    mockAxiosGet.mockImplementation(async (url: string) => {
      if ((url as string).includes("/w/api.php")) {
        return makeSearchResponse([{ id: "Q500", label: "Mystery", description: "railway vehicle" }]);
      }
      return makeEntityResponse("Q500", {}); // empty claims
    });
    const result = await getWikidataSpecs("Mystery Train", "Unknown");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockAxiosGet.mockRejectedValue(new Error("Network timeout"));
    expect(await getWikidataSpecs("Class 43", "GWR")).toBeNull();
  });

  it("extracts numberBuilt correctly", async () => {
    setupMocks({
      trainQid: "Q600", trainLabel: "Class 158", trainDescription: "diesel multiple unit railway",
      claims: { P1098: [makeQuantityClaim(182, "Q")] },
    });
    const result = await getWikidataSpecs("Class 158", "Northern");
    expect(result!.numberBuilt).toBe(182);
  });

  it("returns cached result on second call without hitting Wikidata", async () => {
    setupMocks({
      trainQid: "Q800", trainLabel: "Class 390", trainDescription: "electric multiple unit railway",
      claims: { P4979: [makeQuantityClaim(225, "Q180154")] },
    });

    const first = await getWikidataSpecs("Class 390", "Avanti");
    expect(first!.maxSpeed).toBe("225 km/h");
    const callsAfterFirst = mockAxiosGet.mock.calls.length;

    // Second call — cache should absorb it with no new axios calls
    const second = await getWikidataSpecs("Class 390", "Avanti");
    expect(second!.maxSpeed).toBe("225 km/h");
    expect(mockAxiosGet.mock.calls.length).toBe(callsAfterFirst);
  });
});
