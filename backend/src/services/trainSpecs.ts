// ============================================================
// LocoSnap — Train Specs Service
// Generates detailed specs via AI
// Train data APIs are fragmented — AI is the unified source
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { config } from "../config/env";
import { TrainIdentification, TrainSpecs } from "../types";

const SPECS_PROMPT = (train: TrainIdentification) =>
  `You are a railway engineering reference database. Provide technical specifications for the ${train.class}${train.name ? ` "${train.name}"` : ""} (${train.operator}, ${train.type}).

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
- Use null for any field you are unsure about.
- "maxSpeed" in mph for UK/US, km/h for European/Japanese trains.
- "power" in HP or kW as commonly cited for this locomotive.
- "weight" in tonnes.
- "length" in metres.
- "builder" should be the original manufacturer/works.
- "numberBuilt" is total units/locomotives of this class built.
- "numberSurviving" is approximate number still in existence (in service + preserved).
- "status" should be one of: "In service", "Preserved", "Withdrawn", "Mixed" (if some in service, some preserved).
- "route" should be a notable route this class operates/operated on.
- "fuelType" should be: "Coal", "Diesel", "Electric (25kV AC)", "Electric (750V DC)", "Electric (3kV DC)", "Dual-fuel", "Battery", "Hydrogen", or other as appropriate.
- Be accurate — trainspotters will check these numbers.`;

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
      weight: parsed.weight ?? null,
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

export async function getTrainSpecs(
  train: TrainIdentification
): Promise<TrainSpecs> {
  try {
    const prompt = SPECS_PROMPT(train);

    if (config.hasAnthropic) {
      console.log("[SPECS] Using Claude (Anthropic)");
      const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
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
  } catch (error) {
    console.error("[SPECS] Error:", (error as Error).message);
    return FALLBACK_SPECS;
  }
}
