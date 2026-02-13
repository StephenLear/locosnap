// ============================================================
// CarSnap — Review Aggregation Service
// Generates review summaries via Claude OR OpenAI
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { config } from "../config/env";
import { AggregatedReviews } from "../types";

const REVIEW_PROMPT_TEMPLATE = (year: number, make: string, model: string) =>
  `You are an automotive journalist. Provide a comprehensive review summary for the ${year} ${make} ${model}.

Respond with ONLY valid JSON in this exact format (no markdown, no code fences, no explanation):
{
  "overallScore": 7.5,
  "safetyScore": 8.0,
  "reliabilityScore": 7.0,
  "performanceScore": 6.5,
  "comfortScore": 8.0,
  "valueScore": 7.5,
  "summary": "A brief 2-3 sentence summary of the car's reputation and key selling points.",
  "pros": ["Pro 1", "Pro 2", "Pro 3"],
  "cons": ["Con 1", "Con 2", "Con 3"],
  "sources": [
    {"name": "Edmunds", "score": 7.8, "url": "https://www.edmunds.com"},
    {"name": "Car and Driver", "score": 7.5, "url": "https://www.caranddriver.com"},
    {"name": "MotorTrend", "score": 7.2, "url": "https://www.motortrend.com"},
    {"name": "Kelley Blue Book", "score": 8.0, "url": "https://www.kbb.com"}
  ]
}

Rules:
- All scores are on a 0-10 scale (one decimal place).
- Base your scores on what major automotive publications have historically rated this vehicle.
- The "sources" array should include the major review publications and approximate scores they would give.
- URLs should point to the publication's homepage (the user can search from there).
- "pros" and "cons" should each have exactly 3 items.
- Be fair and balanced — mention both strengths and weaknesses.
- If the specific year is unusual or you're less sure, note that in the summary.`;

const FALLBACK_REVIEWS: AggregatedReviews = {
  overallScore: 0,
  safetyScore: 0,
  reliabilityScore: 0,
  performanceScore: 0,
  comfortScore: 0,
  valueScore: 0,
  summary: "Unable to generate review summary for this vehicle.",
  pros: [],
  cons: [],
  sources: [],
};

function parseReviewResponse(text: string): AggregatedReviews {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      overallScore: parsed.overallScore ?? 7.0,
      safetyScore: parsed.safetyScore ?? 7.0,
      reliabilityScore: parsed.reliabilityScore ?? 7.0,
      performanceScore: parsed.performanceScore ?? 7.0,
      comfortScore: parsed.comfortScore ?? 7.0,
      valueScore: parsed.valueScore ?? 7.0,
      summary: parsed.summary ?? "Review information unavailable.",
      pros: parsed.pros ?? [],
      cons: parsed.cons ?? [],
      sources: parsed.sources ?? [],
    };
  } catch {
    console.error("Failed to parse review response:", text);
    return FALLBACK_REVIEWS;
  }
}

async function reviewsWithClaude(
  make: string,
  model: string,
  year: number
): Promise<AggregatedReviews> {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      { role: "user", content: REVIEW_PROMPT_TEMPLATE(year, make, model) },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response format");
  return parseReviewResponse(content.text);
}

async function reviewsWithOpenAI(
  make: string,
  model: string,
  year: number
): Promise<AggregatedReviews> {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o",
      max_tokens: 2048,
      messages: [
        { role: "user", content: REVIEW_PROMPT_TEMPLATE(year, make, model) },
      ],
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
  if (!text) throw new Error("Empty response from OpenAI");
  return parseReviewResponse(text);
}

/**
 * Get aggregated review summaries — auto-selects provider
 * Priority: Claude > OpenAI
 */
export async function getReviewSummary(
  make: string,
  model: string,
  year: number
): Promise<AggregatedReviews> {
  try {
    if (config.hasAnthropic) {
      console.log("[REVIEWS] Using Claude (Anthropic)");
      return await reviewsWithClaude(make, model, year);
    }

    if (config.hasOpenAI) {
      console.log("[REVIEWS] Using GPT-4o (OpenAI)");
      return await reviewsWithOpenAI(make, model, year);
    }

    console.warn("[REVIEWS] No AI provider configured");
    return FALLBACK_REVIEWS;
  } catch (error) {
    console.error("[REVIEWS] Error generating reviews:", (error as Error).message);
    return FALLBACK_REVIEWS;
  }
}
