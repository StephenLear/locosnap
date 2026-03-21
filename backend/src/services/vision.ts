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

const TRAIN_ID_PROMPT = `You are a railway and locomotive identification expert with encyclopaedic knowledge of trains worldwide — UK, European, Scandinavian, Japanese, North American, and beyond. You know both common and rare classes, including prototypes and one-off locos.

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
- "class" should be the official class designation. UK: use TOPS class numbers (e.g. "Class 56", "Class 89", "Class 37"). Pre-TOPS: use named classes (e.g. "A4 Pacific", "Britannia"). European: use local designation (e.g. "BR 101", "SNCF Class BB 22200", "DB Class 612"). Nordic: e.g. "NSB Di 4", "SJ Rc", "DSB IC3", "VR Sr2". Japanese: e.g. "N700 Series", "KiHa 40". North American: e.g. "EMD GP38-2", "GE ES44AC".
- "name" should be the individual locomotive name if it has one (e.g. "Flying Scotsman", "Mallard", "Tornado"). Use null if unnamed.
- "operator" should be the current or most recent operator. UK examples: "LNER", "GWR", "Avanti West Coast", "DB Cargo UK", "Colas Rail", "GB Railfreight", "DRS", "DCRail". European: "DB", "SNCF", "ÖBB", "Trenitalia". Nordic: "Vy" (Norway), "SJ" (Sweden), "VR" (Finland), "DSB" (Denmark). If preserved, use the heritage railway name.
- "type" should be one of: Steam, Diesel, Electric, DMU, EMU, HST, Freight, Shunter, Railcar, Tram, Metro, Monorail, Maglev, Other
- "designation" is the wheel arrangement (e.g. "4-6-2 Pacific", "0-6-0T", "Bo-Bo", "Co-Co", "A1A-A1A") or unit type (e.g. "3-car EMU", "5-car Pendolino").
- "yearBuilt" is your best estimate of when this class was first built. Use null if very uncertain.
- "confidence" is 0-100. Be honest — a partially obscured or distant loco should score lower.
- "color" describes the livery (e.g. "BR Blue", "LNER Apple Green", "Railfreight Grey", "Intercity Swallow", "EWS Maroon", "DCRail Blue", "DB Red").
- "description" should be a brief, enthusiastic description a trainspotter would appreciate. Include key facts: builder, role, what makes it notable.
- Be specific — trainspotters know their classes. Don't say "a diesel locomotive" when you can say "Class 56 Co-Co freight loco". Don't say "an electric train" when you can say "Class 89 prototype Bo-Bo".
- For rare or prototype locos (e.g. Class 89, Class 210, DP2, GT3), name them explicitly even if confidence is lower.
- For preserved/heritage locos, identify the original class and note it's preserved.
- Visual cues to use: cab shape, bogie type, roof equipment (pantographs, exhausts), number/nameplates visible, bodyside grilles, livery details, coupling type, and any visible fleet numbers.
- Siemens Desiro family: use exact names — "Desiro Classic" (BR 642/643/644 in Germany), "Desiro UK" (Class 185/360/444/450 in UK), "Desiro City" (S-Bahn variants). Never abbreviate or misspell these names.
- DB/German operators: BR 642 = Siemens Desiro Classic, BR 643/644 = Talent (Bombardier), BR 612 = RegioSwinger (Bombardier), BR 628 = older DB DMU. Be precise with German class numbers.
- Siemens Vectron variants: always specify the exact variant, not just "Siemens Vectron". BR 193 = Vectron AC (pure electric AC, most common). BR 191/192 = Vectron DC. BR 248 = Vectron Dual Mode (diesel + electric, shorter, distinctive diesel exhaust on roof). BR 159 = Vectron Dual Mode operated in Germany by private operators (Captrain, TX Logistik, etc.) — if fleet numbers "159 xxx" are visible, classify as "Class 159" (Vectron Dual Mode), NOT just "Siemens Vectron". The Vectron MS (multi-system) = BR 193 with multi-system capability. Use visible fleet numbers, roof exhausts, and pantograph configuration to distinguish variants.
- Vossloh/Stadler Euro 4000 ("Blue Tiger"): a large Co-Co diesel-electric locomotive built by Vossloh in Spain, now produced by Stadler. Distinctive flat square cab ends, boxy body, high short hood. Used by Captrain (fleet numbers "250 xxx"), TX Logistik, and other European freight operators. Also known as "Blue Tiger" or "G 2000 BB" in German rail communities. Do NOT confuse with Class 66 (which has a very different angular sloped nose and is built by EMD/Progress Rail). If "250 xxx" fleet numbers are visible on a boxy flat-fronted diesel in Captrain livery, identify as "Vossloh Euro 4000" (Blue Tiger), not Class 66.
- Czech/Slovak DMU disambiguation: ČD Class 814 (Regionova) is a low-floor articulated 2-car DMU with a flat-fronted cab and blue/white or regional livery — it is NOT a RegioSprinter. ČD Class 818 / 841 is the Siemens RegioSprinter: a single-car DMU with a distinctive rounded nose, large windows, and often yellow, green, or bright regional livery. If "ČD 818" or "841" markings are visible, or the unit is a single car with rounded ends, classify it as "Class 818" (RegioSprinter), NOT Class 814.
- Viewing angle: Identify from ANY angle — front, rear, 3/4, side, or overhead. Do not require a front-facing view. Use roof profile, bogie type, pantograph position, bodyside grilles, exhaust placement, and livery to identify from rear or side views. A rear 3/4 view of a Class 66 is still identifiable by its roof, bogies, and livery.
- Trains with carriages: If a locomotive is shown hauling or coupled to coaches/wagons, focus identification on the locomotive unit itself. Ignore the carriages for identification purposes — identify the loco at the front or rear of the formation.
- Partially obscured trains: If the train is partially hidden by buildings, vegetation, platforms, or other trains, use whatever is visible. Identify from partial views using the visible features. Lower confidence accordingly but still attempt identification.
- Prototype and test trains: Hydrogen trains, bi-mode test units, and prototype/trial livery trains should be identified using visible design cues, builder markings, and any visible fleet numbers. If it resembles a known base class with modifications (e.g. a converted Class 319 or 230), identify the base class and note the conversion.`;

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
