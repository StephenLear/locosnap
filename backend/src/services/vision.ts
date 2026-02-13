// ============================================================
// CarSnap — Vision Service
// Car identification via Claude Vision OR OpenAI GPT-4 Vision
// Automatically uses whichever API key is available
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { config } from "../config/env";
import { CarIdentification } from "../types";

// The prompt is identical for both providers
const CAR_ID_PROMPT = `You are a car identification expert. Analyze this image and identify the vehicle.

If this is NOT a car/vehicle or the image is too unclear to identify, respond with exactly: {"error": "not_a_car"}

If you can identify the vehicle, respond with ONLY valid JSON in this exact format (no markdown, no explanation, no code fences):
{
  "make": "Toyota",
  "model": "Camry",
  "year": 2023,
  "trim": "XSE",
  "confidence": 85,
  "color": "Silver",
  "bodyStyle": "Sedan",
  "description": "A mid-size sedan known for reliability and comfort"
}

Rules:
- "year" should be your best estimate. If unsure, give the most likely year range midpoint.
- "confidence" is 0-100 indicating how confident you are in the identification.
- "trim" can be "Unknown" if you can't determine it.
- "bodyStyle" should be one of: Sedan, SUV, Truck, Coupe, Hatchback, Wagon, Van, Convertible, Crossover, Sports Car, Luxury, Other
- Be specific with the model name (e.g., "Camry" not "mid-size sedan")
- If you can narrow it down to 2-3 possible models, pick the most likely one and adjust confidence accordingly.`;

/**
 * Parse the JSON response from either provider
 */
function parseCarResponse(text: string): CarIdentification | null {
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    if (parsed.error === "not_a_car") {
      return null;
    }

    return {
      make: parsed.make,
      model: parsed.model,
      year: parsed.year,
      trim: parsed.trim || "Unknown",
      confidence: parsed.confidence || 50,
      color: parsed.color || "Unknown",
      bodyStyle: parsed.bodyStyle || "Other",
      description: parsed.description || "",
    };
  } catch {
    console.error("Failed to parse vision response:", text);
    return null;
  }
}

/**
 * Identify car using Claude Vision (Anthropic)
 */
async function identifyWithClaude(
  imageBuffer: Buffer,
  mimeType: string
): Promise<CarIdentification | null> {
  const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  const base64Image = imageBuffer.toString("base64");

  const mediaType = mimeType as
    | "image/jpeg"
    | "image/png"
    | "image/webp"
    | "image/gif";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Image },
          },
          { type: "text", text: CAR_ID_PROMPT },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") return null;
  return parseCarResponse(content.text);
}

/**
 * Identify car using OpenAI GPT-4 Vision
 */
async function identifyWithOpenAI(
  imageBuffer: Buffer,
  mimeType: string
): Promise<CarIdentification | null> {
  const base64Image = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: "gpt-4o",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
            { type: "text", text: CAR_ID_PROMPT },
          ],
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 60000,
    }
  );

  const text = response.data.choices?.[0]?.message?.content;
  if (!text) return null;
  return parseCarResponse(text);
}

/**
 * Identify a car from a photo — auto-selects the available vision provider
 * Priority: Claude Vision > OpenAI GPT-4 Vision
 */
export async function identifyCarFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<CarIdentification | null> {
  if (config.hasAnthropic) {
    console.log("[VISION] Using Claude Vision (Anthropic)");
    return identifyWithClaude(imageBuffer, mimeType);
  }

  if (config.hasOpenAI) {
    console.log("[VISION] Using GPT-4 Vision (OpenAI)");
    return identifyWithOpenAI(imageBuffer, mimeType);
  }

  throw new Error(
    "No vision API configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in your .env file."
  );
}

/**
 * Get the name of the active vision provider (for health check)
 */
export function getVisionProvider(): string {
  if (config.hasAnthropic) return "Claude Vision (Anthropic)";
  if (config.hasOpenAI) return "GPT-4 Vision (OpenAI)";
  return "None configured";
}
