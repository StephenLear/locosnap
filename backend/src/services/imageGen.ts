// ============================================================
// LocoSnap — Blueprint Generation Service
// Generates engineering-style blueprint illustrations of trains
// ============================================================

import Replicate from "replicate";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env";
import { TrainIdentification, TrainSpecs, BlueprintTask } from "../types";

// In-memory task store (upgrade to Redis for production)
const taskStore = new Map<string, BlueprintTask>();

// Initialize Replicate client (if available)
let replicate: Replicate | null = null;
if (config.hasReplicate) {
  replicate = new Replicate({
    auth: config.replicateApiToken,
  });
}

/**
 * Build the detailed blueprint prompt for a train
 */
function buildBlueprintPrompt(
  train: TrainIdentification,
  specs: TrainSpecs
): string {
  const powerText = specs.power ?? "N/A";
  const weightText = specs.weight ?? "N/A";
  const lengthText = specs.length ?? "N/A";
  const speedText = specs.maxSpeed ?? "N/A";
  const gaugeText = specs.gauge ?? "Standard gauge";
  const builderText = specs.builder ?? "N/A";
  const fuelText = specs.fuelType ?? "N/A";
  const designationText = train.designation || "N/A";

  return `Industrial engineering-style blueprint of a ${train.class}${train.name ? ` "${train.name}"` : ""} ${train.type} locomotive/train (${train.operator}, ${train.color} livery). Ultra-precise technical rendering of the railway vehicle placed at centre, with accurate proportions, wheel arrangement (${designationText}), boiler/body details, and surface textures.

Surround the train with industrial-grade technical elements:

• Blueprint-inspired dimension lines showing overall length (${lengthText}), height, width, wheelbase, bogie centres, and buffer height with tolerance annotations (±0.01mm).
• Cross-section cutaway view revealing ${train.type === "Steam" ? "boiler, firebox, cylinders, valve gear, smokebox, tender" : train.type === "Electric" ? "traction motors, pantograph mechanism, transformer, power electronics" : "engine block, turbocharger, transmission, final drive, fuel tanks"} with engineering hatching patterns.
• Exploded-view assembly diagram showing bogies, coupling rods, ${train.type === "Steam" ? "driving wheels, connecting rods, piston assemblies, safety valves" : "suspension units, brake discs, wheel sets, traction motor mounts"}.
• Material specification blocks: ${train.type === "Steam" ? "Boiler plate steel, Cast iron cylinders, Copper firebox, Brass fittings" : "Aluminium alloy body, High-strength steel underframe, Glass fibre nose cone, Composite brake pads"}.
• Wheel arrangement diagram: ${designationText} with numbered axles and power transmission paths.
• Tech data panels showing: Power: ${powerText}, Max Speed: ${speedText}, Weight: ${weightText}, Length: ${lengthText}, Gauge: ${gaugeText}, Builder: ${builderText}, Fuel: ${fuelText}.
• Railway-specific elements: loading gauge outline, coupling height markers, signal sighting line.
• Works plate style data block in corner: ${train.class}, ${train.operator}, built by ${builderText}.

Design style:
- Clean, structured, engineering-oriented layout
- Color palette: steel grey, dark navy (#1a2332), orange/yellow safety accents (#ff6b00), white technical lines
- Background: technical drafting sheet with subtle grid lines and drawing border
- Sharp sans-serif typeface in engineering annotation style (like a railway works drawing)
- Minimal shadows, prioritising clarity and precision
- Multiple viewing angles: side elevation (main), front/rear end views, and detail callouts
- Include a small track/rail cross-section detail

Aspect Ratio: 9:16 (portrait). Overall vibe: serious, precise, locomotive works drawing — like a Swindon, Crewe, or Doncaster works technical poster.`;
}

/**
 * Start blueprint generation (async)
 * Returns a task ID that can be polled for status
 */
export async function startBlueprintGeneration(
  train: TrainIdentification,
  specs: TrainSpecs
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

  const prompt = buildBlueprintPrompt(train, specs);

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
        : (output as string);

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
