// ============================================================
// LocoSnap — Vision Service
// Train identification via Claude Vision OR OpenAI GPT-4 Vision
// Automatically uses whichever API key is available
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { config } from "../config/env";
import { TrainIdentification } from "../types";
import { AppError } from "../middleware/errorHandler";

const TRAIN_ID_PROMPT = `You are a railway and locomotive identification expert with deep knowledge of trains worldwide, especially UK, European, Japanese, and North American rolling stock.

Analyze this image and identify the train, locomotive, or multiple unit.

If this is NOT a train/locomotive/railway vehicle or the image is too unclear to identify, respond with exactly: {"error": "not_a_train"}

If you can identify the railway vehicle, respond with ONLY valid JSON in this exact format (no markdown, no explanation, no code fences):
{
  "class": "Class 43",
  "name": null,
  "operator": "Great Western Railway",
  "type": "HST",
  "designation": "Bo-Bo",
  "yearBuilt": 1976,
  "confidence": 85,
  "color": "GWR Green",
  "description": "High Speed Train power car, the iconic InterCity 125"
}

Rules:
- "class" should be the official class designation (e.g. "Class 43", "A4", "Class 800 Azuma", "Class 66", "BR Standard Class 7"). For non-UK trains use their local designation system.
- "name" should be the individual locomotive name if it has one (e.g. "Flying Scotsman", "Mallard", "Tornado"). Use null if unnamed or unknown.
- "operator" should be the current or most recent operator/railway company (e.g. "LNER", "GWR", "Avanti West Coast", "DB", "SNCF", "JR East").
- "type" should be one of: Steam, Diesel, Electric, DMU, EMU, HST, Freight, Shunter, Railcar, Tram, Metro, Monorail, Maglev, Other
- "designation" is the wheel arrangement (e.g. "4-6-2 Pacific", "0-6-0", "Bo-Bo", "Co-Co") or unit type (e.g. "3-car EMU", "5-car Pendolino").
- "yearBuilt" is your best estimate of when this class was first built. Use null if very uncertain.
- "confidence" is 0-100 indicating how confident you are in the identification.
- "color" describes the livery (e.g. "BR Blue", "LNER Apple Green", "Virgin Red", "Intercity Swallow").
- "description" should be a brief, enthusiastic description a trainspotter would appreciate.
- Be specific — trainspotters know their classes. Don't say "a diesel locomotive" when you can say "Class 37".
- For preserved/heritage locos, identify the original class and note it's preserved.`;

function parseTrainResponse(text: string): TrainIdentification | null {
  try {
    const cleaned = text.replace(/\`\`\`json\n?/g, "").replace(/\`\`\`\n?/g, "").trim();
    console.log("[VISION] AI response:", cleaned.substring(0, 200));
    const parsed = JSON.parse(cleaned);

    if (parsed.error === "not_a_train") {
      console.log("[VISION] AI says: not a train");
      return null;
    }

    return {
      class: parsed.class,
      name: parsed.name || null,
      operator: parsed.operator,
      type: parsed.type || "Other",
      designation: parsed.designation || "Unknown",
      yearBuilt: parsed.yearBuilt || null,
      confidence: parsed.confidence || 50,
      color: parsed.color || "Unknown",
      description: parsed.description || "",
    };
  } catch {
    console.error("Failed to parse vision response:", text);
    return null;
  }
}

async function identifyWithClaude(
  imageBuffer: Buffer,
  mimeType: string
): Promise<TrainIdentification | null> {
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
          { type: "text", text: TRAIN_ID_PROMPT },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") return null;
  return parseTrainResponse(content.text);
}

async function identifyWithOpenAI(
  imageBuffer: Buffer,
  mimeType: string
): Promise<TrainIdentification | null> {
  const base64Image = imageBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  console.log(`[VISION] Sending to OpenAI: ${(imageBuffer.length / 1024).toFixed(1)}KB, mime: ${mimeType}, base64 length: ${base64Image.length}`);

  try {
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
              { type: "text", text: TRAIN_ID_PROMPT },
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
    return parseTrainResponse(text);
  } catch (error: any) {
    const status = error.response?.status;
    const errorData = error.response?.data;
    console.error(`[VISION] OpenAI API error (${status}):`, JSON.stringify(errorData || error.message));

    if (status === 400) {
      // Bad request — image might be invalid, too small, or wrong format
      throw new AppError(
        "Could not process this image. Please try a different photo.",
        422
      );
    }
    throw error;
  }
}

/**
 * Identify a train from a photo — auto-selects the available vision provider
 * Priority: Claude Vision > OpenAI GPT-4 Vision
 */
export async function identifyTrainFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<TrainIdentification | null> {
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
