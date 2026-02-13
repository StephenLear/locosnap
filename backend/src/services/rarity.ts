// ============================================================
// LocoSnap — Rarity Classification Service
// Assigns Common → Legendary tiers based on train attributes
// Uses AI for context-aware rarity assessment
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { config } from "../config/env";
import { TrainIdentification, TrainSpecs, RarityInfo, RarityTier } from "../types";

const RARITY_PROMPT = (train: TrainIdentification, specs: TrainSpecs) =>
  `You are a trainspotting rarity expert. Classify the rarity of spotting a ${train.class}${train.name ? ` "${train.name}"` : ""} (${train.operator}, ${train.type}).

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
- Be generous but honest — spotters want excitement but not inflated rarity.`;

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
  specs: TrainSpecs
): Promise<RarityInfo> {
  try {
    const prompt = RARITY_PROMPT(train, specs);

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
