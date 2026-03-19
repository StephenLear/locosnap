// ============================================================
// LocoSnap — Wikidata Specs Service
//
// Queries Wikidata for factual train specs to ground the AI
// output in real data. Runs in parallel with AI; Wikidata wins
// for any field it provides (voltage, speed, length, etc.).
//
// Coverage: excellent for mainline European/UK/Japanese stock.
// Falls back gracefully to null for anything not found.
// ============================================================

import axios from "axios";

// ── Wikidata property IDs ────────────────────────────────────
const P = {
  MAX_SPEED: "P4979",   // maximum speed (quantity)
  LENGTH: "P2043",      // length (quantity, metres)
  MASS: "P2067",        // mass (quantity, kg or tonnes)
  POWER: "P2818",       // power (quantity, watts or kW)
  NUMBER_BUILT: "P1098",// number produced (quantity)
  MANUFACTURER: "P176", // manufacturer (item → label)
  SERVICE_ENTRY: "P729",// service entry date (time)
  VOLTAGE: "P2660",     // voltage (quantity, volts)
};

// ── Wikidata unit QIDs ───────────────────────────────────────
const UNIT = {
  METRE: "Q11573",
  KM_PER_H: "Q180154",
  MPH: "Q158081",
  KILOGRAM: "Q11570",
  TONNE: "Q41803",
  WATT: "Q25269",
  KILOWATT: "Q483551",
};

const USER_AGENT = "LocoSnap/1.0 (train identification app; contact@locosnap.app)";

export interface WikidataTrainSpecs {
  maxSpeed?: string;
  length?: string;
  weight?: string;
  power?: string;
  numberBuilt?: number;
  builder?: string;
  fuelType?: string;
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
  operator: string
): Promise<WikidataTrainSpecs | null> {
  try {
    // Build search queries: try specific first, then broader
    const queries = [
      trainClass,
      `${trainClass} ${operator}`.trim(),
      trainClass.replace(/^class\s+/i, ""), // "Class 387" → "387"
    ].filter((q, i, arr) => q.length > 1 && arr.indexOf(q) === i); // dedupe

    let qid: string | null = null;
    for (const q of queries) {
      qid = await searchForTrain(q);
      if (qid) break;
    }

    if (!qid) {
      console.log(`[WIKIDATA] No match for: ${trainClass}`);
      return null;
    }

    console.log(`[WIKIDATA] Matched ${trainClass} → ${qid}`);

    const claims = await fetchEntityClaims(qid);
    if (!claims) return null;

    const specs: WikidataTrainSpecs = {};

    // Max speed
    const speed = getQuantity(claims, P.MAX_SPEED);
    if (speed) {
      if (speed.unit === UNIT.MPH) {
        specs.maxSpeed = `${Math.round(speed.amount)} mph`;
      } else {
        specs.maxSpeed = `${Math.round(speed.amount)} km/h`;
      }
    }

    // Length
    const length = getQuantity(claims, P.LENGTH);
    if (length) {
      specs.length = `${length.amount.toFixed(1)} m`;
    }

    // Mass → tonnes
    const mass = getQuantity(claims, P.MASS);
    if (mass) {
      const tonnes = mass.unit === UNIT.TONNE
        ? mass.amount
        : mass.amount / 1000; // kg → tonnes
      specs.weight = `${tonnes.toFixed(0)} tonnes`;
    }

    // Power → kW
    const power = getQuantity(claims, P.POWER);
    if (power) {
      const kw = power.unit === UNIT.KILOWATT
        ? power.amount
        : power.amount / 1000; // W → kW
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

    const found = Object.keys(specs).filter(
      (k) => specs[k as keyof WikidataTrainSpecs] !== undefined
    );

    if (found.length === 0) {
      console.log(`[WIKIDATA] Found ${qid} but no usable spec fields`);
      return null;
    }

    console.log(`[WIKIDATA] ${found.length} fields from ${qid}: ${found.join(", ")}`);
    return specs;
  } catch (error) {
    console.error("[WIKIDATA] Error:", (error as Error).message);
    return null;
  }
}
