import axios from "axios";
import { getWikidataSpecs } from "../../services/wikidataSpecs";

jest.mock("axios");
const mockAxiosGet = axios.get as jest.MockedFunction<typeof axios.get>;

// ── Helpers to build Wikidata API responses ──────────────────

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

function makeItemClaim(qid: string) {
  return {
    mainsnak: {
      datavalue: { value: { id: qid } },
    },
  };
}

function makeEntityResponse(qid: string, claims: Record<string, any[]>) {
  return {
    data: {
      entities: {
        [qid]: { claims },
      },
    },
  };
}

function makeLabelResponse(qid: string, label: string) {
  return {
    data: {
      entities: {
        [qid]: { labels: { en: { value: label } } },
      },
    },
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("getWikidataSpecs", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when no railway match found", async () => {
    mockAxiosGet.mockResolvedValue(
      makeSearchResponse([
        { id: "Q123", label: "Something else", description: "a cheese" },
      ])
    );

    const result = await getWikidataSpecs("Class 43", "GWR");
    expect(result).toBeNull();
  });

  it("returns null when search returns empty results", async () => {
    mockAxiosGet.mockResolvedValue(makeSearchResponse([]));

    const result = await getWikidataSpecs("Unknown Train", "Unknown Operator");
    expect(result).toBeNull();
  });

  it("extracts speed, length, weight and fuelType from Wikidata", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(
        makeSearchResponse([{ id: "Q555", label: "Desiro ML", description: "electric multiple unit" }])
      )
      .mockResolvedValueOnce(
        makeEntityResponse("Q555", {
          P4979: [makeQuantityClaim(160, "Q180154")],   // 160 km/h
          P2043: [makeQuantityClaim(101, "Q11573")],    // 101 m
          P2067: [makeQuantityClaim(185000, "Q11570")], // 185,000 kg → 185 tonnes
          P2660: [makeQuantityClaim(15000, "Q25250")],  // 15,000 V → 15kV
        })
      );

    const result = await getWikidataSpecs("Desiro ML", "ODEG");
    expect(result).not.toBeNull();
    expect(result!.maxSpeed).toBe("160 km/h");
    expect(result!.length).toBe("101.0 m");
    expect(result!.weight).toBe("185 tonnes");
    expect(result!.fuelType).toBe("Electric (15kV 16.7Hz AC)");
  });

  it("handles mph speed units correctly", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(
        makeSearchResponse([{ id: "Q100", label: "Class 43", description: "diesel locomotive railway" }])
      )
      .mockResolvedValueOnce(
        makeEntityResponse("Q100", {
          P4979: [makeQuantityClaim(125, "Q158081")], // 125 mph
        })
      );

    const result = await getWikidataSpecs("Class 43", "GWR");
    expect(result!.maxSpeed).toBe("125 mph");
  });

  it("converts tonnes unit correctly", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(
        makeSearchResponse([{ id: "Q200", label: "ICE 3", description: "intercity railway train" }])
      )
      .mockResolvedValueOnce(
        makeEntityResponse("Q200", {
          P2067: [makeQuantityClaim(409, "Q41803")], // 409 tonnes (already in tonnes)
        })
      );

    const result = await getWikidataSpecs("ICE 3", "DB");
    expect(result!.weight).toBe("409 tonnes");
  });

  it("converts watts to kW for power", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(
        makeSearchResponse([{ id: "Q300", label: "Class 390", description: "electric multiple unit railway" }])
      )
      .mockResolvedValueOnce(
        makeEntityResponse("Q300", {
          P2818: [makeQuantityClaim(7500000, "Q25269")], // 7,500,000 W → 7,500 kW
        })
      );

    const result = await getWikidataSpecs("Class 390", "Avanti");
    expect(result!.power).toBe("7500 kW");
  });

  it("fetches manufacturer label via secondary lookup", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(
        makeSearchResponse([{ id: "Q400", label: "Class 800", description: "electric multiple unit railway" }])
      )
      .mockResolvedValueOnce(
        makeEntityResponse("Q400", {
          P176: [makeItemClaim("Q40993")], // Hitachi QID
        })
      )
      .mockResolvedValueOnce(makeLabelResponse("Q40993", "Hitachi"));

    const result = await getWikidataSpecs("Class 800", "LNER");
    expect(result!.builder).toBe("Hitachi");
  });

  it("maps common voltages to correct fuelType strings", async () => {
    const voltageTests = [
      { volts: 15000, expected: "Electric (15kV 16.7Hz AC)" },
      { volts: 25000, expected: "Electric (25kV 50Hz AC)" },
      { volts: 3000,  expected: "Electric (3kV DC)" },
      { volts: 1500,  expected: "Electric (1.5kV DC)" },
      { volts: 750,   expected: "Electric (750V DC third rail)" },
    ];

    for (const { volts, expected } of voltageTests) {
      mockAxiosGet
        .mockResolvedValueOnce(
          makeSearchResponse([{ id: "Q999", label: "Test Train", description: "locomotive railway" }])
        )
        .mockResolvedValueOnce(
          makeEntityResponse("Q999", {
            P2660: [makeQuantityClaim(volts, "Q25250")],
          })
        );

      const result = await getWikidataSpecs("Test Train", "Test Op");
      expect(result!.fuelType).toBe(expected);
    }
  });

  it("returns null when entity has no usable fields", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(
        makeSearchResponse([{ id: "Q500", label: "Mystery Train", description: "railway vehicle" }])
      )
      .mockResolvedValueOnce(makeEntityResponse("Q500", {})); // empty claims

    const result = await getWikidataSpecs("Mystery Train", "Unknown");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockAxiosGet.mockRejectedValue(new Error("Network timeout"));

    const result = await getWikidataSpecs("Class 43", "GWR");
    expect(result).toBeNull();
  });

  it("extracts numberBuilt correctly", async () => {
    mockAxiosGet
      .mockResolvedValueOnce(
        makeSearchResponse([{ id: "Q600", label: "Class 158", description: "diesel multiple unit railway" }])
      )
      .mockResolvedValueOnce(
        makeEntityResponse("Q600", {
          P1098: [makeQuantityClaim(182, "Q")], // 182 units built
        })
      );

    const result = await getWikidataSpecs("Class 158", "Northern");
    expect(result!.numberBuilt).toBe(182);
  });
});
