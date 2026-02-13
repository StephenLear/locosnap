// ============================================================
// LocoSnap — Train Facts & History Service
// Generates historical facts, fun trivia, and notable events
// via AI — trainspotters want facts, not reviews!
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { config } from "../config/env";
import { TrainIdentification, TrainFacts } from "../types";

const FACTS_PROMPT = (train: TrainIdentification) =>
  `You are a railway historian and trainspotting enthusiast. Provide fascinating facts and history for the ${train.class}${train.name ? ` "${train.name}"` : ""} (${train.operator}, ${train.type}).

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "summary": "A 2-3 sentence enthusiastic overview that a trainspotter would enjoy reading. Include what makes this class special.",
  "historicalSignificance": "Why this class/locomotive matters in railway history. Use null if it's a modern everyday unit with no particular historical note.",
  "funFacts": [
    "Interesting fact 1 — the kind of thing you'd tell a fellow spotter",
    "Interesting fact 2",
    "Interesting fact 3"
  ],
  "notableEvents": [
    "A notable event involving this class (record-breaking run, famous accident, royal train duty, last-of-class withdrawal, etc.)",
    "Another notable event"
  ]
}

Rules:
- "summary" should be enthusiastic but accurate — write as a fellow trainspotter, not a textbook.
- "historicalSignificance" can be null for unremarkable modern stock (e.g. a Class 150 Sprinter). But if it's a famous class (A4, Deltic, HST, Class 37, Shinkansen), give it proper credit.
- "funFacts" should have 2-5 items. Include things like nicknames, speed records, unusual uses, pop culture appearances, preservation stories.
- "notableEvents" should have 1-3 items. Real, verifiable events only.
- If this is a named locomotive (e.g. Flying Scotsman, Mallard), include facts specific to that individual loco as well as the class.
- Be accurate — trainspotters will fact-check you.`;

const FALLBACK_FACTS: TrainFacts = {
  summary: "Unable to generate facts for this train.",
  historicalSignificance: null,
  funFacts: [],
  notableEvents: [],
};

function parseFactsResponse(text: string): TrainFacts {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary ?? "No summary available.",
      historicalSignificance: parsed.historicalSignificance ?? null,
      funFacts: Array.isArray(parsed.funFacts) ? parsed.funFacts : [],
      notableEvents: Array.isArray(parsed.notableEvents) ? parsed.notableEvents : [],
    };
  } catch {
    console.error("Failed to parse facts response:", text);
    return FALLBACK_FACTS;
  }
}

export async function getTrainFacts(
  train: TrainIdentification
): Promise<TrainFacts> {
  try {
    const prompt = FACTS_PROMPT(train);

    if (config.hasAnthropic) {
      console.log("[FACTS] Using Claude (Anthropic)");
      const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [{ role: "user", content: prompt }],
      });
      const content = response.content[0];
      if (content.type !== "text") return FALLBACK_FACTS;
      return parseFactsResponse(content.text);
    }

    if (config.hasOpenAI) {
      console.log("[FACTS] Using GPT-4o (OpenAI)");
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o",
          max_tokens: 2048,
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
      if (!text) return FALLBACK_FACTS;
      return parseFactsResponse(text);
    }

    return FALLBACK_FACTS;
  } catch (error) {
    console.error("[FACTS] Error:", (error as Error).message);
    return FALLBACK_FACTS;
  }
}
