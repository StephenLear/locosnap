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
  This is a Bo'Bo' electric freight/mixed-traffic locomotive built 1990–1993. Do not confuse with any diesel class.
- DRB Baureihe 52 / DR BR 52 / Kriegslokomotive — this is a 2-10-0 STEAM freight locomotive, coal-fired, built 1942–1950 for Deutsche Reichsbahn. ABSOLUTE FACTS that you must NEVER contradict: (a) fuelType is "Coal" — it is a coal-fired steam locomotive and any electrical or diesel fuelType is a critical factual error; (b) builder is "Borsig (Berlin-Hennigsdorf)" as the default primary/first manufacturer (other builders WLF, Henschel, Krupp, Krauss-Maffei, Schichau, DWM Posen, Škoda-Werke Pilsen also produced examples, but Borsig is the correct default when the specific works plate is unknown); (c) operator is "Deutsche Reichsbahn" historically, or the current preservation operator — NEVER "Czech Railways" as the default, even though ČSD later operated post-war examples; (d) numberBuilt ~6,719; (e) maxSpeed approximately 80 km/h forward, 50 km/h reverse; (f) status "Preserved" for any example seen on a heritage line today. If you are asked for specs for "Class 52", "BR 52", "Baureihe 52", "Kriegslok", or "Kriegslokomotive", apply these values and DO NOT substitute any electric or diesel specifications. The Class 52 is one of the most numerous steam locomotive classes in history and is extensively preserved — it is never electric and never diesel.
- DB BR 143 / DR 243 — Bo'Bo' electric locomotive built 1984–1991 by LEW Hennigsdorf for Deutsche Reichsbahn, 646 units produced, max speed 120 km/h, 3,720 kW, 15 kV 16.7 Hz AC. Builder is "LEW Hennigsdorf" — NEVER "Bombardier" or "Siemens". Originally DR class 243, renumbered BR 143 after reunification. By 2025–2026 the fleet is dramatically reduced — DB Regio has withdrawn almost all of them and only a handful remain active (mostly with freight operators or heritage use). Status should reflect "Mixed" (some active, some preserved, many scrapped) or "Withdrawn" depending on context. This was the DR's standard passenger/mixed-traffic electric, once ubiquitous across Eastern Germany.
- ADtranz DE-AC33C "Blue Tiger" (DB Class 250) — Co-Co diesel-electric mainline freight locomotive built by ADtranz (with GE Transportation) 1996–2002, approximately 30 units. In Germany numbered 250 001–250 030 (private operators: ITL, Captrain, HGK, MRCE). The name "Blue Tiger" belongs exclusively to this locomotive — NOT to the Vossloh Euro 4000. Builder must be "ADtranz / GE Transportation", NOT "Vossloh España" or "Stadler Valencia" (those are the different and separate Euro 4000). Max speed 120 km/h, power ~2,500 kW, fuelType "Diesel".
- DR BR 120 / Soviet M62 "Taigatrommel" — Co-Co Soviet-built diesel locomotive by Voroshilovgrad Locomotive Works (Luhansk, Ukrainian SSR), 1966–1975, 378 delivered to Deutsche Reichsbahn as class V200 / BR 120 (then DB BR 220 after 1992). Max speed 100 km/h, power ~1,470 kW, fuelType "Diesel". This is a completely different locomotive from the modern DB BR 120 electric (1979, Krauss-Maffei/Henschel/Krupp, 250 km/h). When asked about "BR 120" in the context of the Taigatrommel / preserved red diesel with a central cab, return these diesel values, NOT the modern DB BR 120 electric specifications.
- Tatra KT4 / KT4D — articulated two-section high-floor tram built by ČKD Tatra Smíchov (Prague) 1974–1997, widely used in East Germany (BVG Berlin, Potsdam ViP, Cottbus, Erfurt, Gera, Frankfurt Oder, etc.) and other Eastern Bloc cities. Builder is "ČKD Tatra Smíchov (Prague)", max speed ~65 km/h, fuelType "Electric (600 V DC)", type "Tram". Many variants exist (KT4DM, KT4DC, KT4Dt) with modernised electrical gear but the same bodyshell. The KT4 is NOT a Siemens Combino — the Combino is a 3+ section smooth low-floor modern tram, completely different in every way.
- Berlin S-Bahn BR 483/484 — the NEWEST S-Bahn Berlin fleet, built by a Stadler/Siemens consortium from 2020 onwards. CRITICAL FACTS: builder is "Stadler / Siemens" (NOT "Crewe Works" — that is a Wikidata hallucination from an entirely wrong entity), entered service 2020–2021, fuelType "Electric (750 V DC third rail)" (Berlin S-Bahn standard — NOT 15kV 16.7Hz AC), max speed 100 km/h, approximately 106 half-trains ordered. The BR 483 is the powered car and BR 484 is the intermediate/trailer car — together they form the new S-Bahn Berlin fleet replacing the older BR 480 and BR 485 classes. These are modern trains with a contemporary angular cab design, NOT wartime-era stock.
- OBB 1116 / OBB 1016 "Taurus" (Siemens ES64U2) — Austrian Federal Railways high-performance Bo'Bo' electric locomotive, built by Siemens 1999–2006, ~382 units (1016 + 1116 series combined). Max speed 230 km/h, power 6,400 kW, fuelType "Electric (15 kV 16.7 Hz AC)". The Taurus is a DIFFERENT generation from the Siemens Vectron (BR 193) — the Taurus (Eurosprinter ES64U2 platform) predates the Vectron (ES64F4 platform) by a full design generation. The Taurus has a characteristic ROUNDED, smooth cab nose with a large curved windscreen, while the Vectron has a more angular, squared-off cab front. Do NOT confuse these two — they are different locomotives despite both being Siemens single-unit electrics.
- DRG Class E 77 — pre-war German electric locomotive built 1924–1926 by BMAG (Berliner Maschinenbau), Krauss, and LHW for the Deutsche Reichsbahn-Gesellschaft. 56 units built. Max speed 65 km/h, power 1,880 kW, fuelType "Electric (15 kV 16.7 Hz AC)". This is a 1920s GERMAN locomotive — NOT Czech, NOT built by Skoda. E 77 10 is preserved at the Dresden Transport Museum. Do NOT confuse with the CSD E 669.1 (a completely different 1960s Czech Skoda-built Co'Co' freight electric running on 3 kV DC).`;

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
  // British Rail Class 201 / 202 / 203 "Hastings Thumper" — BR Eastleigh 1957-1958.
  // Narrow-profile (8ft 6.5in) 6-car DEMU for the Hastings line. English Electric
  // 4SRKT diesels mounted underfloor — the "thump" sound. 21 built total (7 each
  // sub-class). Withdrawn 1986 when line electrified. Only 2 preserved:
  // 1001 (Class 201 6S, sole survivor) and 1013 (Class 202 6L) — Hastings Diesels Ltd.
  "class 201": { maxSpeed: "75 mph", builder: "BR Eastleigh Works", numberBuilt: 7, fuelType: "Diesel-Electric (English Electric 4SRKT)" },
  "class 202": { maxSpeed: "75 mph", builder: "BR Eastleigh Works", numberBuilt: 7, fuelType: "Diesel-Electric (English Electric 4SRKT)" },
  "class 203": { maxSpeed: "75 mph", builder: "BR Eastleigh Works", numberBuilt: 7, fuelType: "Diesel-Electric (English Electric 4SRKT)" },
  "hastings thumper": { maxSpeed: "75 mph", builder: "BR Eastleigh Works", fuelType: "Diesel-Electric (English Electric 4SRKT)" },
  "hastings demu": { maxSpeed: "75 mph", builder: "BR Eastleigh Works", fuelType: "Diesel-Electric (English Electric 4SRKT)" },
  "thumper": { maxSpeed: "75 mph", builder: "BR Eastleigh Works", fuelType: "Diesel-Electric (English Electric 4SRKT)" },
  // British Rail Class 88 — Stadler Rail Valencia (Vossloh España) 2015-2017,
  // 10 units (88001-88010), Direct Rail Services (DRS). Bi-mode electric/diesel,
  // Bo-Bo, 5,400 hp electric / 950 hp diesel, max 100 mph. Based on Siemens Vectron
  // platform with added Caterpillar C27 diesel engine. Named after gods/goddesses.
  "class 88": { maxSpeed: "100 mph", power: "4,000 kW (electric) / 708 kW (diesel)", builder: "Stadler Rail Valencia (Vossloh España)", numberBuilt: 10, fuelType: "Bi-mode (25 kV AC overhead + Caterpillar C27 diesel)" },
  "br 88": { maxSpeed: "100 mph", power: "4,000 kW (electric) / 708 kW (diesel)", builder: "Stadler Rail Valencia (Vossloh España)", numberBuilt: 10, fuelType: "Bi-mode (25 kV AC overhead + Caterpillar C27 diesel)" },
  "br class 88": { maxSpeed: "100 mph", power: "4,000 kW (electric) / 708 kW (diesel)", builder: "Stadler Rail Valencia (Vossloh España)", numberBuilt: 10, fuelType: "Bi-mode (25 kV AC overhead + Caterpillar C27 diesel)" },
  "88005": { maxSpeed: "100 mph", power: "4,000 kW (electric) / 708 kW (diesel)", builder: "Stadler Rail Valencia (Vossloh España)", numberBuilt: 10, fuelType: "Bi-mode (25 kV AC overhead + Caterpillar C27 diesel)" },
  "88005 minerva": { maxSpeed: "100 mph", power: "4,000 kW (electric) / 708 kW (diesel)", builder: "Stadler Rail Valencia (Vossloh España)", numberBuilt: 10, fuelType: "Bi-mode (25 kV AC overhead + Caterpillar C27 diesel)" },
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
  // DRB Baureihe 52 / Kriegslokomotive — 2-10-0 STEAM freight locomotive, coal-fired.
  // Built 1942-1950 by Borsig (first/lead manufacturer) and others. ~6,719 built.
  // CRITICAL: Must NEVER show as Electric/Diesel — it is a STEAM locomotive.
  // Discovered 2026-04-15 when specs layer returned fuelType "Electric (3 kV DC)"
  // and builder "Škoda Plzeň" for a preserved Class 52 — both wrong.
  "class 52": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "br 52": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "baureihe 52": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "drb 52": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "drb class 52": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "dr 52": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "kriegslokomotive": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "kriegslok": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  // DB BR 143 (ex-DR BR 243) — LEW Hennigsdorf 1984-1991, 646 units built.
  // Main East German Bo'Bo' passenger/mixed-traffic electric. Being rapidly phased
  // out by DB Regio — only a handful still active in 2025-2026 (rest withdrawn or
  // transferred to freight operators). Builder was LEW, not "Bombardier" or "Siemens".
  "br 143": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "class 143": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "db class 143": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "baureihe 143": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "dr 243": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "dr class 243": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "br 243": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  // ADtranz DE-AC33C "Blue Tiger" / DB Class 250 — Co-Co diesel-electric, ADtranz
  // + GE Transportation 1996-2002, ~30 built. THE real Blue Tiger — NOT the Vossloh
  // Euro 4000. In Germany numbered 250 001-250 030 (private operators: ITL, Captrain,
  // HGK, MRCE). Also Pakistan Railways and Malaysian Railways. Discovered 2026-04-15
  // when Captrain 250 007-2 was misidentified as Vossloh Euro 4000.
  "class 250": { maxSpeed: "120 km/h", power: "2,500 kW", builder: "ADtranz / GE Transportation", numberBuilt: 30, fuelType: "Diesel" },
  "br 250": { maxSpeed: "120 km/h", power: "2,500 kW", builder: "ADtranz / GE Transportation", numberBuilt: 30, fuelType: "Diesel" },
  "baureihe 250": { maxSpeed: "120 km/h", power: "2,500 kW", builder: "ADtranz / GE Transportation", numberBuilt: 30, fuelType: "Diesel" },
  "adtranz de-ac33c": { maxSpeed: "120 km/h", power: "2,500 kW", builder: "ADtranz / GE Transportation", numberBuilt: 30, fuelType: "Diesel" },
  "de-ac33c": { maxSpeed: "120 km/h", power: "2,500 kW", builder: "ADtranz / GE Transportation", numberBuilt: 30, fuelType: "Diesel" },
  "blue tiger": { maxSpeed: "120 km/h", power: "2,500 kW", builder: "ADtranz / GE Transportation", numberBuilt: 30, fuelType: "Diesel" },
  // DR BR 120 / M62 "Taigatrommel" — Soviet-built diesel freight loco by
  // Voroshilovgrad (Luhansk) 1966-1975, 378 delivered to DR. Renumbered
  // BR 220 after 1992, mostly withdrawn. DO NOT confuse with the DB BR 120
  // electric (1979) which is a totally different locomotive.
  "dr br 120": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 378, fuelType: "Diesel" },
  "dr 120": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 378, fuelType: "Diesel" },
  "dr class 120": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 378, fuelType: "Diesel" },
  "db br 220": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 378, fuelType: "Diesel" },
  "db 220": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 378, fuelType: "Diesel" },
  "taigatrommel": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 378, fuelType: "Diesel" },
  "m62": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", fuelType: "Diesel" },
  // Tatra KT4 / KT4D — ČKD Tatra Smíchov articulated tram, 1974-1997. Two-section
  // high-floor tram. Widely used across East Germany (BVG Berlin, Potsdam ViP,
  // Cottbus, Erfurt, Gera, etc.). Many modernised to KT4DM/KT4Dt variants but same
  // bodyshell. Discovered 2026-04-15 when a Potsdam/Cottbus-style KT4D was
  // misidentified as a Siemens Combino.
  "tatra kt4d": { maxSpeed: "65 km/h", power: "4 × 40 kW", builder: "ČKD Tatra Smíchov (Prague)", fuelType: "Electric (600 V DC)" },
  "kt4d": { maxSpeed: "65 km/h", power: "4 × 40 kW", builder: "ČKD Tatra Smíchov (Prague)", fuelType: "Electric (600 V DC)" },
  "tatra kt4": { maxSpeed: "65 km/h", power: "4 × 40 kW", builder: "ČKD Tatra Smíchov (Prague)", fuelType: "Electric (600 V DC)" },
  "kt4dm": { maxSpeed: "65 km/h", power: "4 × 40 kW", builder: "ČKD Tatra Smíchov (Prague)", fuelType: "Electric (600 V DC)" },
  "kt4dc": { maxSpeed: "65 km/h", power: "4 × 40 kW", builder: "ČKD Tatra Smíchov (Prague)", fuelType: "Electric (600 V DC)" },
  "kt4dt": { maxSpeed: "65 km/h", power: "4 × 40 kW", builder: "ČKD Tatra Smíchov (Prague)", fuelType: "Electric (600 V DC)" },
  // DB BR 485 / ex-DR 270 — LEW Hennigsdorf 1987-1992, 166 half-sets for DR Berlin
  // S-Bahn. 750 V DC third-rail. Still in partial service 2025-2026 on S8/S85/S9/
  // S75/S47/S46 but being phased out. NOT an unpowered trailer of BR 480 — it is
  // a completely separate self-contained class. Discovered 2026-04-15 when a
  // BR 485 on S85 Pankow was misidentified as BR 481.
  "br 485": { maxSpeed: "100 km/h", builder: "LEW Hennigsdorf", numberBuilt: 166, fuelType: "Electric (750 V DC third rail)" },
  "class 485": { maxSpeed: "100 km/h", builder: "LEW Hennigsdorf", numberBuilt: 166, fuelType: "Electric (750 V DC third rail)" },
  "baureihe 485": { maxSpeed: "100 km/h", builder: "LEW Hennigsdorf", numberBuilt: 166, fuelType: "Electric (750 V DC third rail)" },
  "dr 270": { maxSpeed: "100 km/h", builder: "LEW Hennigsdorf", numberBuilt: 166, fuelType: "Electric (750 V DC third rail)" },
  "dr class 270": { maxSpeed: "100 km/h", builder: "LEW Hennigsdorf", numberBuilt: 166, fuelType: "Electric (750 V DC third rail)" },
  // Berlin S-Bahn BR 483/484 — the NEWEST S-Bahn Berlin fleet, built by Stadler/Siemens
  // consortium from 2020 onwards. 750 V DC third rail (Berlin S-Bahn standard).
  // CRITICAL: NOT built by "Crewe Works" and NOT from 1943 — those are hallucinated values
  // from a completely wrong Wikidata entity. Discovered 2026-04-16 when tester reported
  // specs card showing "Crewe Works", "1943", and "15kV 16.7Hz" — all wrong.
  "br 483": { maxSpeed: "100 km/h", power: "2,400 kW", builder: "Stadler / Siemens", numberBuilt: 106, fuelType: "Electric (750 V DC third rail)" },
  "class 483": { maxSpeed: "100 km/h", power: "2,400 kW", builder: "Stadler / Siemens", numberBuilt: 106, fuelType: "Electric (750 V DC third rail)" },
  "baureihe 483": { maxSpeed: "100 km/h", power: "2,400 kW", builder: "Stadler / Siemens", numberBuilt: 106, fuelType: "Electric (750 V DC third rail)" },
  "br 484": { maxSpeed: "100 km/h", power: "2,400 kW", builder: "Stadler / Siemens", numberBuilt: 106, fuelType: "Electric (750 V DC third rail)" },
  "class 484": { maxSpeed: "100 km/h", power: "2,400 kW", builder: "Stadler / Siemens", numberBuilt: 106, fuelType: "Electric (750 V DC third rail)" },
  "baureihe 484": { maxSpeed: "100 km/h", power: "2,400 kW", builder: "Stadler / Siemens", numberBuilt: 106, fuelType: "Electric (750 V DC third rail)" },
  // OBB 1116 Taurus (Siemens ES64U2) — Austrian Federal Railways (OBB) high-performance
  // electric locomotive. Bo'Bo', 230 km/h, 6,400 kW, 15kV 16.7Hz AC. Built by Siemens
  // 1999–2006, ~382 units (1016 + 1116 combined). NOT a Vectron — the Taurus predates
  // the Vectron by a full generation. Discovered 2026-04-16 when tester reported an
  // OBB 1116 being misidentified as BR 193 Vectron.
  "1116": { maxSpeed: "230 km/h", power: "6,400 kW", builder: "Siemens", numberBuilt: 382, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "obb 1116": { maxSpeed: "230 km/h", power: "6,400 kW", builder: "Siemens", numberBuilt: 382, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "obb 1016": { maxSpeed: "230 km/h", power: "6,400 kW", builder: "Siemens", numberBuilt: 382, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "taurus": { maxSpeed: "230 km/h", power: "6,400 kW", builder: "Siemens", numberBuilt: 382, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "es64u2": { maxSpeed: "230 km/h", power: "6,400 kW", builder: "Siemens", numberBuilt: 382, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  // DRG E 77 — pre-war German electric locomotive, built 1924–1926 by BMAG/Krauss/LHW.
  // 56 units built for Deutsche Reichsbahn-Gesellschaft. 15kV 16.7Hz AC, 65 km/h.
  // E 77 10 preserved at Dresden Transport Museum. NOT a Czech locomotive — NOT built
  // by Skoda, NOT 3kV DC. Discovered 2026-04-16 when a preserved E 77 was misidentified
  // as Skoda E 669.1 (which is a completely different 1960s Czech Co'Co' freight electric).
  "e 77": { maxSpeed: "65 km/h", power: "1,880 kW", builder: "BMAG (Berliner Maschinenbau)", numberBuilt: 56, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "e77": { maxSpeed: "65 km/h", power: "1,880 kW", builder: "BMAG (Berliner Maschinenbau)", numberBuilt: 56, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "drg e 77": { maxSpeed: "65 km/h", power: "1,880 kW", builder: "BMAG (Berliner Maschinenbau)", numberBuilt: 56, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "drg class e 77": { maxSpeed: "65 km/h", power: "1,880 kW", builder: "BMAG (Berliner Maschinenbau)", numberBuilt: 56, fuelType: "Electric (15 kV 16.7 Hz AC)" },
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
