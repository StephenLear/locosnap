// ============================================================
// LocoSnap — Blueprint Generation Service
// Generates engineering-style blueprint illustrations of trains
// ============================================================

import Replicate from "replicate";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env";
import { getSupabase } from "../config/supabase";
import { captureServerError } from "./analytics";
import { TrainIdentification, TrainSpecs, BlueprintTask, BlueprintStyle } from "../types";
import { setBlueprintTask, getBlueprintTask } from "./redis";

// Supabase Storage bucket holding generated blueprint images.
// Must exist and be PUBLIC (Supabase dashboard → Storage → New bucket → "blueprints", public).
const BLUEPRINT_BUCKET = "blueprints";

/**
 * Decode a base64 image and upload it to Supabase Storage, returning a stable
 * public URL. gpt-image-1 returns base64 (not a hosted URL), and provider-hosted
 * URLs expire (~1h) anyway — Supabase-hosted URLs are permanent.
 */
async function uploadBlueprintToStorage(
  taskId: string,
  base64: string
): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase not configured — cannot store gpt-image-1 blueprint (base64) image"
    );
  }

  const buffer = Buffer.from(base64, "base64");
  const path = `${taskId}.png`;

  const { error } = await supabase.storage
    .from(BLUEPRINT_BUCKET)
    .upload(path, buffer, { contentType: "image/png", upsert: true });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BLUEPRINT_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Extract the real, human-readable reason from an image-gen failure.
 * OpenAI returns the actual cause in error.response.data.error.message
 * (e.g. model_not_found / invalid size), which axios otherwise hides behind
 * the generic "Request failed with status code 400".
 */
function describeImageGenError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data?.error;
    if (apiError?.message) return `OpenAI image error: ${apiError.message}`;
    return `OpenAI request failed: ${error.message}`;
  }
  return (error as Error)?.message || "Blueprint generation failed";
}

// Initialize Replicate client (if available)
let replicate: Replicate | null = null;
if (config.hasReplicate) {
  replicate = new Replicate({
    auth: config.replicateApiToken,
  });
}

// ── Blueprint Style Definitions ─────────────────────────────
// Each style provides a distinct visual aesthetic for the blueprint

interface StyleConfig {
  design: string;
  vibe: string;
  negativePrompt: string;
  guidanceScale: number;
}

const STYLE_PROMPTS: Record<BlueprintStyle, StyleConfig> = {
  technical: {
    design: `Design style:
- PORTRAIT poster layout — content must fill the FULL canvas top to bottom, no white space or empty margins
- Large main side-elevation drawing in the upper two-thirds of the poster, train running full width
- Lower third: two stacked sub-panels — (1) detailed underframe/bogie cross-section, (2) spec data table
- Color palette: dark navy background (#1a2332), white/light-grey technical lines, orange safety accents (#ff6b00)
- Background: dark navy drafting sheet with subtle white grid lines and technical drawing border
- Sharp sans-serif typeface in engineering annotation style (like a railway works drawing)
- Minimal shadows, prioritising clarity and precision
- Annotation leader lines and dimension arrows filling available space around the train
- IMPORTANT: Fill every part of the canvas — no blank white areas, no empty space`,
    vibe: `Aspect Ratio: 9:16 (portrait). This is a TALL PORTRAIT poster. The locomotive side elevation must be LARGE, spanning the full width of the canvas. Content fills top to bottom. Overall vibe: serious, precise, locomotive works drawing — like a Swindon, Crewe, or Doncaster works technical poster printed in A2 portrait format.`,
    negativePrompt: "blurry, low quality, cartoon, anime, watermark, text errors, distorted, unrealistic proportions, cars, automobiles, photograph, photo, sepia, old paper, vintage, white background, blank space, empty canvas, landscape orientation, wide format",
    guidanceScale: 12,
  },
  vintage: {
    design: `Design style:
- Hand-drawn Victorian engineering illustration aesthetic, pen and ink on aged parchment
- Sepia-toned color palette: warm browns, aged cream parchment, burnt sienna, dark umber ink lines
- Background: aged yellowed drafting paper with subtle foxing, worn edges, coffee-ring stains
- Hand-lettered copperplate serif typography for labels and annotations
- Fine cross-hatching and stipple shading for depth (pen-and-ink technique)
- Ornamental cartouche title block with decorative border, railway company crest
- Single side-elevation view with generous annotation callouts, hand-drawn dimension arrows
- Visible construction lines and pencil guidelines as if drawn by a Victorian draughtsman
- IMPORTANT: Must look hand-drawn with visible pen strokes, NOT digital or computer-generated`,
    vibe: `Aspect Ratio: 9:16 (portrait). Overall vibe: a priceless original engineering drawing from the 1890s, discovered in the archives of a Great Western Railway works — hand-inked by a master draughtsman. Sepia and brown tones throughout, aged paper texture.`,
    negativePrompt: "blurry, low quality, anime, watermark, modern, digital art, 3D render, photograph, photo, neon colours, bright colours, blue background, navy background, computer generated, clean lines",
    guidanceScale: 10,
  },
  schematic: {
    design: `Design style:
- Ultra-clean minimalist circuit-diagram / technical schematic aesthetic
- Monochrome palette: crisp WHITE background, thin precise black lines (#1a1a1a), single accent colour (#0066ff electric blue) for key dimensions
- Background: pure bright white with faint 5mm grid dots
- Modern geometric sans-serif typeface (Helvetica/DIN style), small precise labels
- No shading, no gradients — pure line art with uniform stroke weights
- Exploded isometric view showing major subassemblies separated with connection indicators
- Numbered part callouts with a clean legend/parts list panel
- Wiring-diagram style power flow arrows showing energy path from source to wheels
- IMPORTANT: WHITE background, NOT dark/navy. Black line art on white paper like a technical manual.`,
    vibe: `Aspect Ratio: 9:16 (portrait). Overall vibe: a modern technical manual illustration — clean, minimal, information-dense, like an IKEA assembly guide meets Japanese train technical manual. Pure white background with black line art.`,
    negativePrompt: "blurry, low quality, anime, watermark, dark background, navy background, colourful, photograph, photo, shading, gradients, shadows, 3D render, realistic, sepia, vintage, aged paper",
    guidanceScale: 14,
  },
  cinematic: {
    design: `Design style:
- Dramatic cinematic hero-shot photorealistic rendering of the locomotive in motion
- Moody atmospheric lighting: golden hour / blue hour, volumetric fog, rain-slicked tracks
- Depth of field: sharp focus on the locomotive, beautifully blurred background (railway station, countryside, or depot)
- Hyperrealistic rendering with metallic reflections, steam/exhaust effects, motion blur on wheels
- Low-angle three-quarter perspective showing the locomotive's imposing scale and power
- Subtle lens flare from headlight, dynamic cloud formations in sky
- Cinematic color grading: deep shadows, lifted blacks, warm highlights
- IMPORTANT: This is a PHOTOREALISTIC cinematic shot, NOT a technical drawing or blueprint`,
    vibe: `Aspect Ratio: 9:16 (portrait). Overall vibe: a hero shot from a prestige BBC railway documentary — dramatic, beautiful, awe-inspiring — the locomotive as protagonist. Photorealistic, cinematic, dramatic lighting.`,
    negativePrompt: "blurry, low quality, anime, watermark, text, labels, annotations, diagram, blueprint, technical drawing, schematic, line art, flat, 2D, cartoon, dimension lines",
    guidanceScale: 8,
  },
};

/**
 * Build the detailed blueprint prompt for a train
 */
function buildBlueprintPrompt(
  train: TrainIdentification,
  specs: TrainSpecs,
  style: BlueprintStyle = "technical"
): string {
  const powerText = specs.power ?? "N/A";
  const weightText = specs.weight ?? "N/A";
  const lengthText = specs.length ?? "N/A";
  const speedText = specs.maxSpeed ?? "N/A";
  const gaugeText = specs.gauge ?? "Standard gauge";
  const builderText = specs.builder ?? "N/A";
  const fuelText = specs.fuelType ?? "N/A";
  const designationText = train.designation || "N/A";

  const styleConfig = STYLE_PROMPTS[style] || STYLE_PROMPTS.technical;

  const baseDescription = `${style === "cinematic" ? "Cinematic hero-shot rendering" : style === "vintage" ? "Hand-drawn Victorian engineering illustration" : style === "schematic" ? "Clean minimalist technical schematic" : "Industrial engineering-style blueprint"} of a ${train.class}${train.name ? ` "${train.name}"` : ""} ${train.type} locomotive/train (${train.operator}, ${train.color} livery). Ultra-precise ${style === "cinematic" ? "photorealistic rendering" : "technical rendering"} of the railway vehicle placed at centre, with accurate proportions, wheel arrangement (${designationText}), boiler/body details, and surface textures.`;

  const technicalElements = `
Technical elements:

• Dimension lines showing overall length (${lengthText}), height, width, wheelbase, and buffer height.
• ${train.type === "Steam" ? "Boiler, firebox, cylinders, valve gear, smokebox, tender" : train.type === "Electric" ? "Traction motors, pantograph mechanism, transformer, power electronics" : "Engine block, turbocharger, transmission, final drive, fuel tanks"} visible.
• Material specs: ${train.type === "Steam" ? "Boiler plate steel, Cast iron cylinders, Copper firebox, Brass fittings" : "Aluminium alloy body, High-strength steel underframe, Glass fibre nose cone"}.
• Wheel arrangement: ${designationText} with numbered axles.
• Tech data: Power: ${powerText}, Max Speed: ${speedText}, Weight: ${weightText}, Length: ${lengthText}, Gauge: ${gaugeText}, Builder: ${builderText}, Fuel: ${fuelText}.
• Works plate: ${train.class}, ${train.operator}, built by ${builderText}.`;

  return `${baseDescription}

${technicalElements}

${styleConfig.design}

${styleConfig.vibe}`;
}

/**
 * Start blueprint generation (async)
 * Returns a task ID that can be polled for status
 */
export async function startBlueprintGeneration(
  train: TrainIdentification,
  specs: TrainSpecs,
  style: BlueprintStyle = "technical"
): Promise<string> {
  const taskId = uuidv4();

  const task: BlueprintTask = {
    taskId,
    status: "queued",
    imageUrl: null,
    error: null,
    createdAt: new Date(),
    completedAt: null,
  };

  await setBlueprintTask(taskId, task);

  const prompt = buildBlueprintPrompt(train, specs, style);

  // Run generation in background (don't await)
  generateImage(taskId, prompt, style).catch(async (error) => {
    console.error(`Blueprint generation failed for task ${taskId}:`, error);
    // Report to Sentry so an app-wide blueprint outage is visible without a
    // user report (the dall-e-3 retirement was invisible until a tester hit it).
    captureServerError(error as Error, { taskId, stage: "blueprint-generation" });
    const t = await getBlueprintTask(taskId);
    if (t) {
      t.status = "failed";
      t.error = (error as Error).message || "Blueprint generation failed";
      await setBlueprintTask(taskId, t);
    }
  });

  return taskId;
}

/**
 * Actually generate the image (runs in background).
 * Replicate path uses per-style negative prompts + guidance scale; OpenAI path
 * uses gpt-image-1 (base64 → Supabase Storage).
 */
async function generateImage(
  taskId: string,
  prompt: string,
  style: BlueprintStyle = "technical"
): Promise<void> {
  const task = await getBlueprintTask(taskId);
  if (!task) return;

  task.status = "processing";
  await setBlueprintTask(taskId, task);

  const styleConfig = STYLE_PROMPTS[style] || STYLE_PROMPTS.technical;

  if (config.hasReplicate && replicate) {
    // Use Replicate (Stable Diffusion XL or similar)
    try {
      const output = await replicate.run(
        "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
        {
          input: {
            prompt: prompt,
            negative_prompt: styleConfig.negativePrompt,
            width: 768,
            height: 1344, // 9:16 ratio
            num_inference_steps: 50,
            guidance_scale: styleConfig.guidanceScale,
            scheduler: "K_EULER",
          },
        }
      );

      // Replicate returns an array of URLs
      const imageUrl = Array.isArray(output)
        ? (output[0] as string)
        : (output as unknown as string);

      task.status = "completed";
      task.imageUrl = imageUrl;
      task.completedAt = new Date();
      await setBlueprintTask(taskId, task);
    } catch (error) {
      throw error;
    }
  } else if (config.hasOpenAI) {
    // OpenAI gpt-image-1 (dall-e-3 was retired by OpenAI 2026 → HTTP 400).
    // gpt-image-1 differs from dall-e-3: size enum is 1024x1536 (no 1024x1792),
    // quality is low/medium/high (no "hd"), there is NO style param, and it
    // returns base64 (b64_json), never a hosted URL.
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/images/generations",
        {
          model: "gpt-image-1",
          prompt: prompt,
          n: 1,
          size: "1024x1536", // Portrait — closest gpt-image-1 size to 9:16
          quality: "medium",
        },
        {
          headers: {
            Authorization: `Bearer ${config.openaiApiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 120000,
        }
      );

      const b64 = response.data.data[0]?.b64_json;

      if (!b64) {
        throw new Error("No base64 image in gpt-image-1 response");
      }

      // gpt-image-1 returns base64 — persist to Supabase Storage for a stable URL.
      const imageUrl = await uploadBlueprintToStorage(taskId, b64);

      task.status = "completed";
      task.imageUrl = imageUrl;
      task.completedAt = new Date();
      await setBlueprintTask(taskId, task);
    } catch (error) {
      // Surface OpenAI's real reason (model/size/quality) instead of the
      // generic axios 400 — Sentry capture happens at the outer chokepoint.
      throw new Error(describeImageGenError(error));
    }
  } else {
    task.status = "failed";
    task.error =
      "No image generation API configured. Set REPLICATE_API_TOKEN or OPENAI_API_KEY in your .env file.";
    await setBlueprintTask(taskId, task);
  }
}

/**
 * Check the status of a blueprint generation task
 */
export async function getTaskStatus(taskId: string): Promise<BlueprintTask | null> {
  return getBlueprintTask(taskId);
}
