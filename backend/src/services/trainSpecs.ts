// ============================================================
// LocoSnap — Train Specs Service
// Hybrid: Wikidata (factual) + AI (fill gaps + context)
//
// Both run in parallel. Wikidata wins for any field it provides
// (voltage, speed, length, etc.) — eliminating hallucinations on
// the fields trainspotters are most likely to check.
// AI covers fields Wikidata rarely has: gauge, route, status.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { config } from "../config/env";
import { TrainIdentification, TrainSpecs } from "../types";
import { getWikidataSpecs } from "./wikidataSpecs";

const GERMAN_INSTRUCTION = "Respond in German (Deutsch). Use formal register.\n\n";

const SPECS_PROMPT = (train: TrainIdentification, language: string = "en") =>
  `${language === "de" ? GERMAN_INSTRUCTION : ""}You are a railway engineering reference database with deep knowledge of UK, European, Scandinavian, Japanese, and North American rolling stock. Provide technical specifications for the ${train.class}${train.name ? ` "${train.name}"` : ""} (${train.operator}, ${train.type}).

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "maxSpeed": "125 mph",
  "power": "2,250 HP",
  "weight": "76 tonnes",
  "length": "22.1 m",
  "gauge": "Standard (1,435 mm)",
  "builder": "BREL Crewe Works",
  "numberBuilt": 197,
  "numberSurviving": 54,
  "status": "In service",
  "route": "East Coast Main Line",
  "fuelType": "Diesel"
}

Rules:
- Use null for any field you are genuinely unsure about — do not guess.
- "maxSpeed" MUST use km/h for any train operated by a European or non-UK/US operator — this includes DB, SNCF, ÖBB, Trenitalia, SBB, NS, Renfe, PKP, DSB, SJ, NSB, VR, and any German/French/Italian/Spanish/Swiss/Dutch/Nordic/Eastern European operator. Use mph ONLY for UK and North American operators.
- "maxSpeed" in mph for UK/US trains, km/h for European/Japanese/Nordic trains.
- "power" in HP for UK/US diesel/steam, kW for European electric and modern UK electric.
- "weight" in tonnes.
- "length" in metres (per vehicle/unit unless otherwise noted).
- "gauge" — most UK/European trains are "Standard (1,435 mm)". Note exceptions: Irish broad gauge "1,600 mm", Spanish broad gauge "1,668 mm", Finnish broad gauge "1,524 mm", UK narrow gauge heritage.
- "builder" should be the original manufacturer/works. UK examples: "BREL Crewe", "BREL Derby", "BREL Doncaster", "English Electric Vulcan Foundry", "Brush Traction Loughborough", "GEC Traction". European: "Siemens", "Bombardier", "Alstom", "Stadler", "CAF", "Škoda". Nordic: "Duewag", "Strømmens Værksted", "ABB Västerås".
- "numberBuilt" is total units/locomotives of this class built. For prototypes/one-offs, use 1.
- "numberSurviving" is approximate number still in existence (in service + preserved). Use null if uncertain.
- "status" should be one of: "In service", "Preserved", "Withdrawn", "Mixed" (if some in service, some preserved), "Prototype" (if experimental/one-off).
- "route" should be a notable route or network this class operates/operated on.
- "fuelType" — use the precise system:
  UK electric: "Electric (25kV AC OHL)" for ECML/WCML, "Electric (750V DC third rail)" for Southern/SW, "Electric (1.5kV DC OHL)" for Woodhead/older.
  European electric: "Electric (15kV 16.7Hz AC)" for Germany/Austria/Switzerland/Sweden/Norway, "Electric (25kV 50Hz AC)" for France/Belgium/UK HS1/Finland, "Electric (3kV DC)" for Italy/Poland/Belgium/Czech/Slovak, "Electric (1.5kV DC)" for Netherlands/France some, "Electric (600/750V DC)" for metros/trams.
  Nordic specific: Sweden/Norway use 15kV 16.7Hz; Finland uses 25kV 50Hz; Denmark uses 25kV 50Hz (IC3 is diesel).
  Other: "Diesel", "Coal", "Dual-voltage Electric", "Tri-voltage Electric", "Dual-fuel", "Battery", "Hydrogen".
- Be accurate — trainspotters will check these numbers.
- ICE 3 family — use these exact values, do not deviate:
  BR 403 (ICE 3, original): maxSpeed "300 km/h", power "8,000 kW", builder "Siemens/Bombardier", numberBuilt 13, fuelType "Electric (15kV 16.7Hz AC)"
  BR 406 (ICE 3M/3MF, multi-system): maxSpeed "300 km/h", power "8,000 kW", builder "Siemens/Bombardier", numberBuilt 17, fuelType "Electric (multi-system: 15kV 16.7Hz / 25kV 50Hz / 3kV DC / 1.5kV DC)"
  BR 407 (ICE 3neo / Velaro D): maxSpeed "320 km/h", power "8,000 kW", builder "Siemens", numberBuilt 17, fuelType "Electric (15kV 16.7Hz AC)"
  BR 408 (ICE 3neo, latest generation): maxSpeed "320 km/h", power "9,200 kW", builder "Siemens", fuelType "Electric (15kV 16.7Hz AC)"
  BR 462 (ICE 3neo / Velaro MS): maxSpeed "320 km/h", power "9,200 kW", builder "Siemens", fuelType "Electric (multi-system)"
  All ICE 3 variants are EMU type, Standard gauge (1,435 mm), operator DB.
- ICE 4 family (BR 412) — use these exact values, do not deviate:
  BR 412 (ICE 4, 8-car): maxSpeed "250 km/h", power "7,440 kW", builder "Siemens Mobility", fuelType "Electric (15kV 16.7Hz AC)"
  BR 412 (ICE 4, 12-car): maxSpeed "250 km/h", power "9,280 kW", builder "Siemens Mobility", fuelType "Electric (15kV 16.7Hz AC)"
  BR 412 (ICE 4, 13-car): maxSpeed "250 km/h", builder "Siemens Mobility", fuelType "Electric (15kV 16.7Hz AC)"
  CRITICAL: ICE 4 max speed is 250 km/h — NOT 300 or 320 km/h. Do not confuse with ICE 3 variants.
- Class 810 "Aurora" (East Midlands Railway, Hitachi AT300 bi-mode) — use these exact values:
  maxSpeed "125 mph", power "2,940 kW", builder "Hitachi Rail", numberBuilt 33, fuelType "Bi-mode (25kV AC OHL / Diesel)", status "In service", gauge "Standard (1,435 mm)"
  This is a 5-car bi-mode multiple unit, NOT an HST. Type is "Bi-mode". Do not use HST type or 2,250 HP power figure.
- DB Class 156 (also DR Class 156, built for Deutsche Reichsbahn) — use these exact values:
  maxSpeed "120 km/h", power "6,360 kW", weight "123 tonnes", length "19.6 m", builder "LEW Hennigsdorf", numberBuilt 186, fuelType "Electric (15kV 16.7Hz AC)", status "Withdrawn", gauge "Standard (1,435 mm)"
  This is a Bo'Bo' electric freight/mixed-traffic locomotive built 1990–1993. Do not confuse with any diesel class.`;

const FALLBACK_SPECS: TrainSpecs = {
  maxSpeed: null,
  power: null,
  weight: null,
  length: null,
  gauge: null,
  builder: null,
  numberBuilt: null,
  numberSurviving: null,
  status: null,
  route: null,
  fuelType: null,
};

function parseSpecsResponse(text: string): TrainSpecs {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      maxSpeed: parsed.maxSpeed ?? null,
      power: parsed.power ?? null,
      // Guard against AI returning 0 instead of null — parse the numeric value
      weight: (() => {
        if (!parsed.weight) return null;
        const match = String(parsed.weight).match(/([\d.]+)/);
        if (!match) return null;
        return parseFloat(match[1]) > 0 ? parsed.weight : null;
      })(),
      length: parsed.length ?? null,
      gauge: parsed.gauge ?? null,
      builder: parsed.builder ?? null,
      numberBuilt: parsed.numberBuilt ?? null,
      numberSurviving: parsed.numberSurviving ?? null,
      status: parsed.status ?? null,
      route: parsed.route ?? null,
      fuelType: parsed.fuelType ?? null,
    };
  } catch {
    console.error("Failed to parse specs response:", text);
    return FALLBACK_SPECS;
  }
}

async function getAISpecs(train: TrainIdentification, language: string = "en"): Promise<TrainSpecs> {
  const prompt = SPECS_PROMPT(train, language);

  if (config.hasAnthropic) {
    console.log("[SPECS] Using Claude (Anthropic)");
    const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    const content = response.content[0];
    if (content.type !== "text") return FALLBACK_SPECS;
    return parseSpecsResponse(content.text);
  }

  if (config.hasOpenAI) {
    console.log("[SPECS] Using GPT-4o (OpenAI)");
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        max_tokens: 1024,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );
    const text = response.data.choices?.[0]?.message?.content;
    if (!text) return FALLBACK_SPECS;
    return parseSpecsResponse(text);
  }

  return FALLBACK_SPECS;
}

// Known Wikidata data quality corrections.
// Wikidata wins in the merge, but these fields are factually wrong for specific classes —
// apply after merge to ensure trainspotters see correct values.
type SpecsOverride = Partial<Pick<TrainSpecs, "maxSpeed" | "power" | "weight" | "builder" | "fuelType" | "numberBuilt">>;
const WIKIDATA_CORRECTIONS: Record<string, SpecsOverride> = {
  // BR 462 (ICE 3neo Velaro MS) — Wikidata matches a wrong entity and returns "Crewe Works"
  "br 462": { builder: "Siemens" },
  // DB Class 642 (Siemens Desiro Classic) — Wikidata returns wrong builder
  "db class 642": { builder: "Siemens" },
  "class 642": { builder: "Siemens" },
  // DB Class 114 (push-pull locomotive) — Wikidata maxSpeed stale/incorrect
  "db class 114": { maxSpeed: "160 km/h" },
  "class 114": { maxSpeed: "160 km/h" },
  "br 114": { maxSpeed: "160 km/h" },
  // BR 412 (ICE 4) — ensure correct max speed (250 km/h, not 300/320 km/h like ICE 3)
  // Multiple variants because vision may return different class string formats
  "br 412": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  "br412": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  "ice 4": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  "ice4": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  "412": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  "ice 4 (br 412)": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  "br 412 (ice 4)": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  // Class 810 Aurora — correct power and unit count
  "class 810": { power: "2,940 kW", numberBuilt: 33 },
  "br 810": { power: "2,940 kW", numberBuilt: 33 },
  // British Rail Class 91 (InterCity 225) — BREL Crewe 1988-1991, 31 units.
  // Still in LNER service Dec 2025 (12 active). Withdrawal end of 2028 due to
  // ETCS signalling incompatibility on southern ECML. 91010 holds UK rail speed
  // record 161.7 mph (17 Sep 1989). Operational max 125 mph (140 mph capable).
  // 91131 preserved at Museum of Scottish Railways, Bo'ness & Kinneil.
  "class 91": { maxSpeed: "125 mph", power: "4,700 kW", builder: "BREL Crewe", numberBuilt: 31, fuelType: "Electric (25 kV AC overhead)" },
  "br 91": { maxSpeed: "125 mph", power: "4,700 kW", builder: "BREL Crewe", numberBuilt: 31, fuelType: "Electric (25 kV AC overhead)" },
  "br class 91": { maxSpeed: "125 mph", power: "4,700 kW", builder: "BREL Crewe", numberBuilt: 31, fuelType: "Electric (25 kV AC overhead)" },
  "intercity 225": { maxSpeed: "125 mph", power: "4,700 kW", builder: "BREL Crewe", numberBuilt: 31, fuelType: "Electric (25 kV AC overhead)" },
  "ic225": { maxSpeed: "125 mph", power: "4,700 kW", builder: "BREL Crewe", numberBuilt: 31, fuelType: "Electric (25 kV AC overhead)" },
  // BR Class 55 Deltic — Wikidata returns "Stadler Rail" (wrong — modern Swiss company)
  "class 55": { builder: "English Electric / Vulcan Foundry" },
  "class 55 deltic": { builder: "English Electric / Vulcan Foundry" },
  "br class 55": { builder: "English Electric / Vulcan Foundry" },
  // PKP SU46 — AI and/or Wikidata returns 160 km/h; correct vmax is 120 km/h
  "su46": { maxSpeed: "120 km/h" },
  "pkp su46": { maxSpeed: "120 km/h" },
  // PKP EP09 — AI and/or Wikidata returns 200 km/h; correct vmax is 160 km/h
  "ep09": { maxSpeed: "160 km/h" },
  "pkp ep09": { maxSpeed: "160 km/h" },
  // BR Class 14 "Teddy Bear" — AI returns "BRCW Smethwick"; all 56 built at Swindon Works
  "class 14": { builder: "Swindon Works" },
  "br class 14": { builder: "Swindon Works" },
  // ICE L (Talgo 230 / ECx) — built by Talgo (Spain), not Siemens. Max speed 230 km/h.
  "ice l": { builder: "Talgo", maxSpeed: "230 km/h" },
  "icel": { builder: "Talgo", maxSpeed: "230 km/h" },
  "ecx": { builder: "Talgo", maxSpeed: "230 km/h" },
  "talgo 230": { builder: "Talgo", maxSpeed: "230 km/h" },
  // DB BR 423 — Frankfurt/Munich/Stuttgart/Hamburg S-Bahn EMU. Built by LHB/Alstom/Bombardier
  // consortium in Salzgitter/Hennigsdorf/Bautzen, NOT Derby. Max speed 140 km/h.
  "br 423": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "140 km/h" },
  "423": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "140 km/h" },
  "class 423": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "140 km/h" },
  "baureihe 423": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "140 km/h" },
  // DB BR 425 / 426 — regional DB Regio EMU. Built by LHB/Alstom/Bombardier consortium in
  // Salzgitter/Hennigsdorf/Bautzen, NOT Derby Works. Max speed 160 km/h.
  "br 425": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  "425": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  "class 425": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  "baureihe 425": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  "br 426": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  "426": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  "class 426": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
};

function applyKnownCorrections(trainClass: string, specs: TrainSpecs): TrainSpecs {
  const key = trainClass.toLowerCase().trim();
  const correction = WIKIDATA_CORRECTIONS[key];
  if (!correction) return specs;
  console.log(`[SPECS] Applying known corrections for "${trainClass}": ${JSON.stringify(correction)}`);
  return { ...specs, ...correction };
}

export async function getTrainSpecs(
  train: TrainIdentification,
  language: string = "en"
): Promise<TrainSpecs> {
  try {
    // Run AI and Wikidata in parallel — don't let either block the other
    const [aiResult, wikiResult] = await Promise.allSettled([
      getAISpecs(train, language),
      getWikidataSpecs(train.class, train.operator, train.name),
    ]);

    const ai = aiResult.status === "fulfilled" ? aiResult.value : FALLBACK_SPECS;
    const wiki = wikiResult.status === "fulfilled" ? wikiResult.value : null;

    if (!wiki) {
      console.log("[SPECS] Wikidata: no data — using AI only");
      return applyKnownCorrections(train.class, ai);
    }

    // Wikidata wins for factual fields (speed, voltage, dimensions, builder)
    // AI wins for contextual fields (gauge, route, status, numberSurviving)
    //
    // maxSpeed exception: if Wikidata and AI disagree by more than 20%, the
    // Wikidata entry is likely stale, variant-specific, or mismatched. In that
    // case we log a warning and fall back to AI, which uses current knowledge.
    const resolveMaxSpeed = (): string | null => {
      if (!wiki.maxSpeed) return ai.maxSpeed;
      if (!ai.maxSpeed)   return wiki.maxSpeed;

      const parseKmh = (s: string): number | null => {
        const m = s.match(/([\d.]+)\s*km\/h/i);
        if (m) return parseFloat(m[1]);
        const mph = s.match(/([\d.]+)\s*mph/i);
        if (mph) return parseFloat(mph[1]) * 1.60934;
        return null;
      };

      const wikiKmh = parseKmh(wiki.maxSpeed);
      const aiKmh   = parseKmh(ai.maxSpeed);

      if (wikiKmh !== null && aiKmh !== null) {
        const diff = Math.abs(wikiKmh - aiKmh) / Math.max(wikiKmh, aiKmh);
        if (diff > 0.20) {
          console.warn(
            `[SPECS] maxSpeed mismatch >20% — Wikidata: ${wiki.maxSpeed}, AI: ${ai.maxSpeed}. Trusting Wikidata.`
          );
          // Wikidata is a structured factual source — prefer it over AI when they diverge
          return wiki.maxSpeed;
        }
      }

      return wiki.maxSpeed;
    };

    const rejectZeroWeight = (w: string | null | undefined): string | null => {
      if (!w) return null;
      const match = String(w).match(/([\d.]+)/);
      if (!match) return null;
      return parseFloat(match[1]) > 0 ? w : null;
    };

    const merged: TrainSpecs = {
      maxSpeed:        resolveMaxSpeed(),
      power:           wiki.power           ?? ai.power,
      weight:          rejectZeroWeight(wiki.weight) ?? rejectZeroWeight(ai.weight),
      length:          wiki.length          ?? ai.length,
      gauge:           ai.gauge,                           // AI only
      builder:         wiki.builder         ?? ai.builder,
      numberBuilt:     wiki.numberBuilt     ?? ai.numberBuilt,
      numberSurviving: ai.numberSurviving,                 // AI only
      status:          ai.status,                          // AI only
      route:           ai.route,                           // AI only
      fuelType:        wiki.fuelType        ?? ai.fuelType,
    };

    const wikidataFields = (Object.keys(wiki) as (keyof typeof wiki)[])
      .filter((k) => wiki[k] !== undefined);
    console.log(`[SPECS] Merged — Wikidata provided: ${wikidataFields.join(", ")}`);

    return applyKnownCorrections(train.class, merged);
  } catch (error) {
    console.error("[SPECS] Error:", (error as Error).message);
    return FALLBACK_SPECS;
  }
}
