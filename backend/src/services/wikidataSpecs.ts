// ============================================================
// LocoSnap — Wikidata Specs Service
//
// Queries Wikidata for factual train specs to ground the AI
// output in real data. Runs in parallel with AI; Wikidata wins
// for any field it provides (voltage, speed, length, etc.).
//
// Coverage: excellent for mainline European/UK/Japanese stock.
// Falls back gracefully to null for anything not found.
//
// Known limitation: multi-voltage trains (e.g. Eurostar, Class 373)
// have multiple P2660 voltage claims in Wikidata. We read only the
// first claim, so the fuelType label may reflect a secondary voltage
// rather than the primary one. The AI fallback has the same weakness.
// ============================================================

import axios from "axios";

// ── Wikidata property IDs ────────────────────────────────────
const P = {
  MAX_SPEED:     "P4979", // maximum speed (quantity)
  LENGTH:        "P2043", // length (quantity, metres)
  MASS:          "P2067", // mass (quantity, kg or tonnes)
  POWER:         "P2818", // power (quantity, watts or kW)
  NUMBER_BUILT:  "P1098", // number produced (quantity)
  MANUFACTURER:  "P176",  // manufacturer (item → label)
  SERVICE_ENTRY: "P729",  // service entry date (time)
  VOLTAGE:       "P2660", // voltage (quantity, volts)
};

// ── Wikidata unit QIDs ───────────────────────────────────────
const UNIT = {
  METRE:    "Q11573",
  KM_PER_H: "Q180154",
  MPH:      "Q158081",
  KILOGRAM: "Q11570",
  TONNE:    "Q41803",
  WATT:     "Q25269",
  KILOWATT: "Q483551",
};

const USER_AGENT = "LocoSnap/1.0 (train identification app; contact@locosnap.app)";

// ── In-memory cache ──────────────────────────────────────────
// Keyed on normalised train class. Prevents duplicate Wikidata
// API calls for the same class within a server session.
// The outer trainCache already caches the final merged specs,
// but this saves the Wikidata round-trips on cache misses.
const MAX_CACHE_SIZE = 500;
const wikidataCache = new Map<string, WikidataTrainSpecs | null>();

function cacheKey(trainClass: string): string {
  return trainClass.toLowerCase().trim();
}

// Exported for test teardown only
export function clearWikidataCache(): void {
  wikidataCache.clear();
}

// ── Types ────────────────────────────────────────────────────

export interface WikidataTrainSpecs {
  maxSpeed?:       string;
  length?:         string;
  weight?:         string;
  power?:          string;
  numberBuilt?:    number;
  builder?:        string;
  fuelType?:       string;
  yearIntroduced?: string; // service entry year (P729) — available for facts enrichment
}

// ── Helpers ──────────────────────────────────────────────────

function getQuantity(claims: any, property: string): { amount: number; unit: string } | null {
  try {
    const dv = claims?.[property]?.[0]?.mainsnak?.datavalue;
    if (dv?.type !== "quantity") return null;
    const amount = parseFloat(dv.value.amount); // "+101" → 101
    const unit = (dv.value.unit as string).split("/").pop() ?? "";
    return { amount: Math.abs(amount), unit };
  } catch {
    return null;
  }
}

function getItemId(claims: any, property: string): string | null {
  try {
    return claims?.[property]?.[0]?.mainsnak?.datavalue?.value?.id ?? null;
  } catch {
    return null;
  }
}

function getYear(claims: any, property: string): string | null {
  try {
    const dv = claims?.[property]?.[0]?.mainsnak?.datavalue;
    if (dv?.type !== "time") return null;
    return (dv.value.time as string).substring(1, 5); // "+2020-00-00T..." → "2020"
  } catch {
    return null;
  }
}

function voltageToFuelType(volts: number): string {
  if (volts >= 14500 && volts <= 15500) return "Electric (15kV 16.7Hz AC)";
  // Note: no standard railway voltage exists between 15.5kV and 24kV,
  // so the gap between these two bands is intentional.
  if (volts >= 24000 && volts <= 26000) return "Electric (25kV 50Hz AC)";
  if (volts >= 2800  && volts <= 3200)  return "Electric (3kV DC)";
  if (volts >= 1400  && volts <= 1600)  return "Electric (1.5kV DC)";
  if (volts >= 700   && volts <= 800)   return "Electric (750V DC third rail)";
  if (volts >= 580   && volts <= 650)   return "Electric (600V DC)";
  return `Electric (${(volts / 1000).toFixed(1)}kV)`;
}

// ── Wikidata API calls ───────────────────────────────────────

async function searchForTrain(query: string): Promise<string | null> {
  const response = await axios.get("https://www.wikidata.org/w/api.php", {
    params: {
      action: "wbsearchentities",
      search: query,
      language: "en",
      type: "item",
      limit: 8,
      format: "json",
      origin: "*",
    },
    timeout: 6000,
    headers: { "User-Agent": USER_AGENT },
  });

  const results: any[] = response.data.search ?? [];
  const railKeywords = [
    "train", "locomotive", "railcar", "railway", "railroad",
    "tram", "streetcar", "metro", "subway", "electric multiple unit",
    "diesel multiple unit", "emu", "dmu", "intercity", "rolling stock",
    "passenger car", "rail vehicle",
  ];

  for (const result of results) {
    const desc = (result.description ?? "").toLowerCase();
    const label = (result.label ?? "").toLowerCase();
    if (railKeywords.some((k) => desc.includes(k) || label.includes(k))) {
      return result.id as string;
    }
  }
  return null;
}

async function fetchEntityClaims(qid: string): Promise<any> {
  const response = await axios.get(
    `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
    { timeout: 8000, headers: { "User-Agent": USER_AGENT } }
  );
  return response.data.entities?.[qid]?.claims ?? null;
}

async function fetchLabel(qid: string): Promise<string | null> {
  try {
    const response = await axios.get(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
      { timeout: 5000, headers: { "User-Agent": USER_AGENT } }
    );
    return response.data.entities?.[qid]?.labels?.en?.value ?? null;
  } catch {
    return null;
  }
}

// ── Main export ──────────────────────────────────────────────

export async function getWikidataSpecs(
  trainClass: string,
  operator: string,
  trainName?: string | null
): Promise<WikidataTrainSpecs | null> {
  // ── Cache check ──────────────────────────────────────────
  const key = cacheKey(trainClass);
  if (wikidataCache.has(key)) {
    console.log(`[WIKIDATA] Cache HIT for: ${trainClass}`);
    return wikidataCache.get(key) ?? null;
  }

  try {
    // Build search queries: name-first for disambiguation, then class variants.
    // Using trainName first (e.g. "ICE 3") avoids matching an older train that
    // shares the same class designation (e.g. old DB ET 403 vs modern BR 403).
    const queries = [
      trainName ? `${trainName} ${operator}`.trim() : null, // "ICE 3 Deutsche Bahn"
      trainName ?? null,                                      // "ICE 3"
      `${trainClass} ${operator}`.trim(),                    // "DB Class 403 Deutsche Bahn"
      trainClass,                                             // "DB Class 403"
      trainClass.replace(/^class\s+/i, ""),                  // "Class 387" → "387"
    ].filter((q): q is string => !!q && q.length > 1)
     .filter((q, i, arr) => arr.indexOf(q) === i); // dedupe

    // Run all search queries in parallel — worst case latency is
    // max(single query) ≈ 6s, not sum(queries) ≈ 18s
    const searchResults = await Promise.allSettled(
      queries.map((q) => searchForTrain(q))
    );

    // Take the first successful non-null result (preserving query preference order)
    const qid = searchResults
      .filter((r): r is PromiseFulfilledResult<string | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .find((id) => id !== null) ?? null;

    if (!qid) {
      console.log(`[WIKIDATA] No match for: ${trainClass}`);
      wikidataCache.set(key, null);
      return null;
    }

    console.log(`[WIKIDATA] Matched ${trainClass} → ${qid}`);

    const claims = await fetchEntityClaims(qid);
    if (!claims) {
      wikidataCache.set(key, null);
      return null;
    }

    const specs: WikidataTrainSpecs = {};

    // Max speed
    const speed = getQuantity(claims, P.MAX_SPEED);
    if (speed) {
      specs.maxSpeed = speed.unit === UNIT.MPH
        ? `${Math.round(speed.amount)} mph`
        : `${Math.round(speed.amount)} km/h`;
    }

    // Length
    const length = getQuantity(claims, P.LENGTH);
    if (length) {
      specs.length = `${length.amount.toFixed(1)} m`;
    }

    // Mass → tonnes
    const mass = getQuantity(claims, P.MASS);
    if (mass) {
      const tonnes = mass.unit === UNIT.TONNE ? mass.amount : mass.amount / 1000;
      specs.weight = `${tonnes.toFixed(0)} tonnes`;
    }

    // Power → kW
    const power = getQuantity(claims, P.POWER);
    if (power) {
      const kw = power.unit === UNIT.KILOWATT ? power.amount : power.amount / 1000;
      specs.power = `${Math.round(kw)} kW`;
    }

    // Number built
    const built = getQuantity(claims, P.NUMBER_BUILT);
    if (built) {
      specs.numberBuilt = Math.round(built.amount);
    }

    // Manufacturer label (secondary fetch)
    const mfgQid = getItemId(claims, P.MANUFACTURER);
    if (mfgQid) {
      const label = await fetchLabel(mfgQid);
      if (label) specs.builder = label;
    }

    // Voltage → fuelType string
    const voltage = getQuantity(claims, P.VOLTAGE);
    if (voltage) {
      specs.fuelType = voltageToFuelType(voltage.amount);
    }

    // Service entry year (e.g. "2020") — surfaced for future facts enrichment
    const entryYear = getYear(claims, P.SERVICE_ENTRY);
    if (entryYear) {
      specs.yearIntroduced = entryYear;
    }

    const found = Object.keys(specs).filter(
      (k) => specs[k as keyof WikidataTrainSpecs] !== undefined
    );

    if (found.length === 0) {
      console.log(`[WIKIDATA] Found ${qid} but no usable spec fields`);
      wikidataCache.set(key, null);
      return null;
    }

    console.log(`[WIKIDATA] ${found.length} fields from ${qid}: ${found.join(", ")}`);

    // Evict oldest entry if cache is full
    if (wikidataCache.size >= MAX_CACHE_SIZE) {
      wikidataCache.delete(wikidataCache.keys().next().value!);
    }
    wikidataCache.set(key, specs);

    return specs;
  } catch (error) {
    console.error("[WIKIDATA] Error:", (error as Error).message);
    return null;
  }
}
