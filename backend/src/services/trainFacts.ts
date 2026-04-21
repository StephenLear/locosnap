// ============================================================
// LocoSnap — Train Facts & History Service
// Generates historical facts, fun trivia, and notable events
// via AI — trainspotters want facts, not reviews!
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { config } from "../config/env";
import { TrainIdentification, TrainFacts } from "../types";
import { getWikidataSpecs } from "./wikidataSpecs";

const GERMAN_INSTRUCTION = "Respond in German (Deutsch). Use formal register.\n\n";

const FACTS_PROMPT = (train: TrainIdentification, verifiedYear?: string, language: string = "en") =>
  `${language === "de" ? GERMAN_INSTRUCTION : ""}You are a railway historian and trainspotting enthusiast. Provide fascinating facts and history for the ${train.class}${train.name ? ` "${train.name}"` : ""} (${train.operator}, ${train.type}).
${verifiedYear ? `\nVERIFIED FACT — use this exactly, do not contradict it: This class entered service in ${verifiedYear}.\n` : ""}
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
- "summary" should be enthusiastic but accurate — write as a fellow trainspotter, not a textbook. Only state things you are certain about.
- "historicalSignificance" can be null for unremarkable modern stock (e.g. a Class 150 Sprinter). But if it's a famous class (A4, Deltic, HST, Class 37, Shinkansen), give it proper credit.
- "funFacts" should have 2-5 items. Focus on: documented speed records, unusual operational history, specific notable roles (royal train workings, railtours, film appearances), preservation status, fleet numbers of notable survivors. DO NOT invent or guess nicknames — only include a nickname if it is genuinely well-known and documented within the rail community (e.g. "Deltic", "Shed" for Class 66, "Thunderbird" for Class 57, "Granny" for Class 73, "Bones" for Class 20). If you are not certain a nickname exists and is widely used, omit it entirely. A missing nickname is far better than a hallucinated one. Trainspotters will immediately know if a nickname is invented.
- "notableEvents" should have 1-3 items. Real, verifiable events only — specific dates, locations, and outcomes where you are confident. If you cannot recall a specific verifiable event, return fewer items or an empty array rather than fabricating plausible-sounding events.
- If this is a named locomotive (e.g. Flying Scotsman, Mallard), include facts specific to that individual loco as well as the class.
- ACCURACY IS PARAMOUNT. Trainspotters are experts who will fact-check every claim. Do not state a year, manufacturer, speed record, or operator unless you are confident it is correct. When uncertain, use cautious language ("reportedly", "approximately") or omit the detail entirely. Never state something confidently that you are guessing at.
- DB BR 648 / Alstom Coradia LINT 41: this is a mainstream modern regional DMU — NOT a rare, limited, or specialized class. Over 300 units built across the LINT 41 family from 1999 onwards by Alstom (formerly LHB Salzgitter). Operated in daily service by DB Regio, HLB, NAH.SH, erixx, vlexx, Vias, Nordwestbahn and other German regional operators. Do NOT describe it as "extremely limited production", "only 192 units built" (192 is the VR Dv12 Finnish diesel — a completely different class on a different continent), "specialized service", "withdrawn", "rare", or "legendary". The correct framing is workhorse, everyday, defining modern non-electrified German regional rail. Builder is Alstom (never Bombardier, Siemens, or Stadler). "historicalSignificance" should generally be null or very modest for this class — it is a modern everyday unit, not a historically significant locomotive.`;

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
  train: TrainIdentification,
  language: string = "en"
): Promise<TrainFacts> {
  try {
    // Pull Wikidata year if available — hits cache instantly if specs already ran.
    // Injects the verified entry year into the prompt to prevent hallucinated dates.
    const wikidata = await getWikidataSpecs(train.class, train.operator).catch(() => null);
    const prompt = FACTS_PROMPT(train, wikidata?.yearIntroduced, language);

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
