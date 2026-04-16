// ============================================================
// LocoSnap — Rarity Classification Service
// Assigns Common → Legendary tiers based on train attributes
// Uses AI for context-aware rarity assessment
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { config } from "../config/env";
import { TrainIdentification, TrainSpecs, RarityInfo, RarityTier } from "../types";

const GERMAN_INSTRUCTION = "Respond in German (Deutsch). Use formal register.\n\n";

const RARITY_PROMPT = (train: TrainIdentification, specs: TrainSpecs, language: string = "en") =>
  `${language === "de" ? GERMAN_INSTRUCTION : ""}You are a trainspotting rarity expert. Classify the rarity of spotting a ${train.class}${train.name ? ` "${train.name}"` : ""} (${train.operator}, ${train.type}).

Known specs:
- Number built: ${specs.numberBuilt ?? "unknown"}
- Number surviving: ${specs.numberSurviving ?? "unknown"}
- Status: ${specs.status ?? "unknown"}
- Year built: ${train.yearBuilt ?? "unknown"}

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "tier": "rare",
  "reason": "Heritage steam locomotive — only 6 surviving Class A4s worldwide",
  "productionCount": 35,
  "survivingCount": 6
}

Rarity tiers (assign ONE):
- "common" — Everyday stock you'd see on most journeys. Modern EMUs/DMUs in regular service with hundreds in fleet (e.g. Class 350, Class 377, Class 800).
- "uncommon" — Regular but not everywhere. Older classes still in service, freight locos on specific routes, less common operators (e.g. Class 66, Class 37 on charters).
- "rare" — Special effort or luck needed. Heritage locos on mainline tours, withdrawn classes with few survivors, uncommon foreign visitors (e.g. Deltic on mainline, Class 50).
- "epic" — Genuinely exciting spot. Famous named locomotives, very few survivors, prototype/experimental stock, steam on mainline (e.g. Flying Scotsman, Tornado, APT).
- "legendary" — Once-in-a-lifetime spot. World-record holders, last of their kind, royal trains, unique prototypes (e.g. Mallard, LNER 4472 in original condition, working Garratt).

Rules:
- Consider both the CLASS rarity and the INDIVIDUAL locomotive rarity.
- A common class can have a legendary individual (e.g. a specific Class 43 used for the last HST service).
- Named heritage steam is usually "rare" minimum, famous named locos are "epic" or "legendary".
- Modern stock in regular daily service is almost always "common".
- If numberSurviving is known and very low (1-5), bump up the tier.
- "productionCount" and "survivingCount" should be your best estimates (use null if truly unknown).
- Be generous but honest — spotters want excitement but not inflated rarity.
- Freight context: assess rarity across ALL service types, not just passenger. A freight locomotive with a large fleet (e.g. Class 66 with 400+ units, DB BR 185/186/193) should be "common" or "uncommon" because spotters encounter them regularly on freight workings — do NOT bump it to "rare" simply because it rarely appears on passenger trains. The rarity tier reflects realistic overall spotting opportunity. A high-fleet freight loco that is everywhere on freight routes is not rare.
- Conversely, a loco that IS rare in freight service (small fleet, limited routes, or mostly withdrawn) should be classified as such even if it is not a passenger train.
- German regional fleet awareness: DB Class 643/644 (Talent) have been largely retired from DB mainline service and are now rare. DB Class 143 (ex-DR 243, LEW Hennigsdorf Bo'Bo' electric, 646 originally built) is NEAR-EXTINCT — DB Regio has withdrawn almost all of them by 2025–2026. The class is functionally gone from mainline passenger service despite the massive original production run. Classify BR 143 / CD Class 143 as "epic" — this is a genuinely exciting spot, not merely "rare". Do not be fooled by the historical fleet size of 646 — the active fleet is a tiny remnant.
- Berlin S-Bahn BR 485 (ex-DR Class 270, nicknamed "Coladose" / Cola can): LEW Hennigsdorf 1987–1992, 166 half-sets originally built. By 2025–2026 ALL BUT 3 units have been SCRAPPED. The BR 485 is the last surviving East German S-Bahn design on the Berlin network and is on the verge of total extinction. Classify BR 485 as "epic" — only 3 surviving units out of 166 is an extraordinary rarity. Do NOT classify as "common" or "uncommon" — a fleet reduced from 166 to 3 is epic-tier without question.
- Finnish fleet awareness: VR Sm3 (Pendolino) operates with 18 sets covering ALL main Finnish intercity routes (Helsinki–Tampere, Helsinki–Turku, Helsinki–Joensuu, Helsinki–Oulu) — it is the standard intercity train in Finland and a COMMON everyday sight. Do NOT rate it rare or uncommon based on the modest absolute fleet count; 18 sets serving an entire national intercity network means you see one on virtually every main line journey in Finland. VR Dv12 diesel locomotive: fleet is declining as Dr19 replacements arrive — classify as "uncommon" reflecting its diminishing presence. DB Class 628 is mostly withdrawn. DB Class 218 diesel locos are dwindling. DB Class 103 electric is essentially museum-only. Do not classify retired or near-retired German classes as "common".
- If a class was once common but is now largely withdrawn or transferred to secondary operators, classify based on its CURRENT rarity, not its historical abundance.
- DR Class 156 (LEW Class 252 prototype): ONLY 4 were ever built by LEW Hennigsdorf (1989–1991). This is an extremely rare prototype electric locomotive from Deutsche Reichsbahn. Any sighting of a DR Class 156 must be classified as "legendary" — a production run of 4 examples is one of the smallest of any mainline locomotive class. Do NOT classify it as "common", "uncommon", or "rare". It is LEGENDARY tier without exception.`;

const FALLBACK_RARITY: RarityInfo = {
  tier: "common",
  reason: "Unable to classify rarity.",
  productionCount: null,
  survivingCount: null,
};

function parseRarityResponse(text: string): RarityInfo {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const validTiers: RarityTier[] = ["common", "uncommon", "rare", "epic", "legendary"];
    const tier = validTiers.includes(parsed.tier) ? parsed.tier : "common";

    return {
      tier,
      reason: parsed.reason ?? "No classification reason provided.",
      productionCount: parsed.productionCount ?? null,
      survivingCount: parsed.survivingCount ?? null,
    };
  } catch {
    console.error("Failed to parse rarity response:", text);
    return FALLBACK_RARITY;
  }
}

export async function classifyRarity(
  train: TrainIdentification,
  specs: TrainSpecs,
  language: string = "en"
): Promise<RarityInfo> {
  try {
    const prompt = RARITY_PROMPT(train, specs, language);

    if (config.hasAnthropic) {
      console.log("[RARITY] Using Claude (Anthropic)");
      const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });
      const content = response.content[0];
      if (content.type !== "text") return FALLBACK_RARITY;
      return parseRarityResponse(content.text);
    }

    if (config.hasOpenAI) {
      console.log("[RARITY] Using GPT-4o (OpenAI)");
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o",
          max_tokens: 512,
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
      if (!text) return FALLBACK_RARITY;
      return parseRarityResponse(text);
    }

    return FALLBACK_RARITY;
  } catch (error) {
    console.error("[RARITY] Error:", (error as Error).message);
    return FALLBACK_RARITY;
  }
}
