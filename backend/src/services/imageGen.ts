// ============================================================
// LocoSnap — Blueprint Generation Service
// Generates engineering-style blueprint illustrations of trains
// ============================================================

import Replicate from "replicate";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env";
import { TrainIdentification, TrainSpecs, BlueprintTask, BlueprintStyle } from "../types";

// In-memory task store (upgrade to Redis for production)
const taskStore = new Map<string, BlueprintTask>();

// Initialize Replicate client (if available)
let replicate: Replicate | null = null;
if (config.hasReplicate) {
  replicate = new Replicate({
    auth: config.replicateApiToken,
  });
}

// ── Blueprint Style Definitions ─────────────────────────────
// Each style provides a distinct visual aesthetic for the blueprint

const STYLE_PROMPTS: Record<BlueprintStyle, { design: string; vibe: string }> = {
  technical: {
    design: `Design style:
- Clean, structured, engineering-oriented layout
- Color palette: steel grey, dark navy (#1a2332), orange/yellow safety accents (#ff6b00), white technical lines
- Background: technical drafting sheet with subtle grid lines and drawing border
- Sharp sans-serif typeface in engineering annotation style (like a railway works drawing)
- Minimal shadows, prioritising clarity and precision
- Multiple viewing angles: side elevation (main), front/rear end views, and detail callouts
- Include a small track/rail cross-section detail`,
    vibe: `Aspect Ratio: 9:16 (portrait). Overall vibe: serious, precise, locomotive works drawing — like a Swindon, Crewe, or Doncaster works technical poster.`,
  },
  vintage: {
    design: `Design style:
- Hand-drawn Victorian engineering illustration aesthetic
- Sepia-toned color palette: warm browns, aged cream parchment, burnt sienna, dark umber ink lines
- Background: aged yellowed drafting paper with subtle foxing, worn edges, coffee-ring stains
- Hand-lettered copperplate serif typography for labels and annotations
- Fine cross-hatching and stipple shading for depth (pen-and-ink technique)
- Ornamental cartouche title block with decorative border, railway company crest
- Single side-elevation view with generous annotation callouts, hand-drawn dimension arrows
- Visible construction lines and pencil guidelines as if drawn by a Victorian draughtsman`,
    vibe: `Aspect Ratio: 9:16 (portrait). Overall vibe: a priceless original engineering drawing from the 1890s, discovered in the archives of a Great Western Railway works — hand-inked by a master draughtsman.`,
  },
  schematic: {
    design: `Design style:
- Ultra-clean minimalist circuit-diagram / technical schematic aesthetic
- Monochrome palette: crisp white background, thin precise black lines (#1a1a1a), single accent colour (#0066ff) for key dimensions
- Background: pure white with faint 5mm grid dots
- Modern geometric sans-serif typeface (Helvetica/DIN style), small precise labels
- No shading, no gradients — pure line art with uniform stroke weights
- Exploded isometric view showing major subassemblies separated with connection indicators
- Numbered part callouts with a clean legend/parts list panel
- Wiring-diagram style power flow arrows showing energy path from source to wheels`,
    vibe: `Aspect Ratio: 9:16 (portrait). Overall vibe: a modern technical manual illustration — clean, minimal, information-dense, like an IKEA assembly guide meets Japanese train technical manual.`,
  },
  cinematic: {
    design: `Design style:
- Dramatic cinematic hero-shot rendering of the locomotive in motion
- Moody atmospheric lighting: golden hour / blue hour, volumetric fog, rain-slicked tracks
- Depth of field: sharp focus on the locomotive, beautifully blurred background (railway station, countryside, or depot)
- Hyperrealistic rendering with metallic reflections, steam/exhaust effects, motion blur on wheels
- Low-angle three-quarter perspective showing the locomotive's imposing scale and power
- Subtle lens flare from headlight, dynamic cloud formations in sky
- Cinematic color grading: deep shadows, lifted blacks, warm highlights
- Tech data overlaid as subtle HUD-style transparent panels (like a movie title card)`,
    vibe: `Aspect Ratio: 9:16 (portrait). Overall vibe: a hero shot from a prestige BBC railway documentary — dramatic, beautiful, awe-inspiring — the locomotive as protagonist.`,
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

  taskStore.set(taskId, task);

  const prompt = buildBlueprintPrompt(train, specs, style);

  // Run generation in background (don't await)
  generateImage(taskId, prompt).catch((error) => {
    console.error(`Blueprint generation failed for task ${taskId}:`, error);
    const t = taskStore.get(taskId);
    if (t) {
      t.status = "failed";
      t.error = (error as Error).message || "Blueprint generation failed";
    }
  });

  return taskId;
}

/**
 * Actually generate the image (runs in background)
 */
async function generateImage(taskId: string, prompt: string): Promise<void> {
  const task = taskStore.get(taskId);
  if (!task) return;

  task.status = "processing";

  if (config.hasReplicate && replicate) {
    // Use Replicate (Stable Diffusion XL or similar)
    try {
      const output = await replicate.run(
        "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
        {
          input: {
            prompt: prompt,
            negative_prompt:
              "blurry, low quality, cartoon, anime, watermark, text errors, distorted, unrealistic proportions, cars, automobiles",
            width: 768,
            height: 1344, // 9:16 ratio
            num_inference_steps: 50,
            guidance_scale: 12,
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
    } catch (error) {
      throw error;
    }
  } else if (config.hasOpenAI) {
    // Fallback to OpenAI DALL-E 3
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/images/generations",
        {
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: "1024x1792", // Closest to 9:16
          quality: "hd",
          style: "natural",
        },
        {
          headers: {
            Authorization: `Bearer ${config.openaiApiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 120000,
        }
      );

      const imageUrl = response.data.data[0]?.url;

      if (!imageUrl) {
        throw new Error("No image URL in OpenAI response");
      }

      task.status = "completed";
      task.imageUrl = imageUrl;
      task.completedAt = new Date();
    } catch (error) {
      throw error;
    }
  } else {
    task.status = "failed";
    task.error =
      "No image generation API configured. Set REPLICATE_API_TOKEN or OPENAI_API_KEY in your .env file.";
  }
}

/**
 * Check the status of a blueprint generation task
 */
export function getTaskStatus(taskId: string): BlueprintTask | null {
  return taskStore.get(taskId) || null;
}

/**
 * Clean up old tasks (call periodically)
 */
export function cleanupOldTasks(maxAgeMs: number = 3600000): void {
  const now = Date.now();
  for (const [taskId, task] of taskStore.entries()) {
    if (now - task.createdAt.getTime() > maxAgeMs) {
      taskStore.delete(taskId);
    }
  }
}
