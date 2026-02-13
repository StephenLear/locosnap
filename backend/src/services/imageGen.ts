// ============================================================
// CarSnap — Infographic Generation Service
// Generates industrial engineering-style infographics of cars
// ============================================================

import Replicate from "replicate";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { config } from "../config/env";
import { CarIdentification, CarSpecs, InfographicTask } from "../types";

// In-memory task store (upgrade to Redis for production)
const taskStore = new Map<string, InfographicTask>();

// Initialize Replicate client (if available)
let replicate: Replicate | null = null;
if (config.hasReplicate) {
  replicate = new Replicate({
    auth: config.replicateApiToken,
  });
}

/**
 * Build the detailed infographic prompt based on Steve's template
 */
function buildInfographicPrompt(
  car: CarIdentification,
  specs: CarSpecs
): string {
  const hpText = specs.horsepower ? `${specs.horsepower} HP` : "N/A";
  const torqueText = specs.torque ? `${specs.torque} lb-ft` : "N/A";
  const engineText = specs.engine || "N/A";
  const weightText = specs.curbWeight || "N/A";
  const wheelbaseText = specs.wheelbase || "N/A";
  const safetyText = specs.safetyRating
    ? `${specs.safetyRating}/5 Stars`
    : "N/A";
  const transmissionText = specs.transmission || "N/A";
  const drivetrainText = specs.drivetrain || "N/A";

  const fuelText = specs.fuelEconomy
    ? `${specs.fuelEconomy.city}/${specs.fuelEconomy.highway} MPG`
    : "N/A";

  return `Industrial engineering-style infographic of a ${car.year} ${car.make} ${car.model} ${car.trim} (${car.color} ${car.bodyStyle}). Ultra-precise technical rendering of the vehicle placed at the center, with accurate proportions, textures, materials, and surface details. Surround the vehicle with industrial-grade technical elements:

• Blueprint-inspired dimension lines showing length, width, height, wheelbase (${wheelbaseText}), and ground clearance with tolerance annotations (±0.01mm).
• Cross-section cutaway view revealing the engine bay (${engineText}), transmission (${transmissionText}), suspension, exhaust system, and chassis structure with engineering hatching patterns.
• Exploded-view assembly diagram showing bolts, brackets, joints, wiring harness, bearings, brake components, and internal mechanisms.
• Material specification blocks: Aluminum Alloy body panels, High-Strength Steel frame, Carbon Fiber accents, Tempered Glass, Polyurethane bumpers, Chrome/Satin trim.
• Process flow arrows describing manufacturing steps: CNC Machining → Casting → Welding (TIG/MIG) → Injection Molding → Stamping.
• Load & stress indicator graphics with arrows, vector force diagrams showing suspension forces, aerodynamic flow vectors, thermal flow from engine bay, and torque direction indicators.
• Part numbering following industrial annotation style (Part A01, A02, B01, etc.) for major components.
• Tech data panels showing: Weight: ${weightText}, Engine: ${engineText}, Power: ${hpText}, Torque: ${torqueText}, Transmission: ${transmissionText}, Drivetrain: ${drivetrainText}, Fuel Economy: ${fuelText}, Safety: ${safetyText}.
• QR-style data block and barcode element in corner for extra industrial feel.

Design style:
- Clean, structured, engineering-oriented layout
- Color palette: steel grey, dark navy (#1a2332), orange/yellow safety accents (#ff6b00)
- Background: technical drafting sheet with subtle grid lines
- Sharp sans-serif typeface in engineering annotation style
- Minimal shadows, prioritizing clarity and precision
- Multiple viewing angles: 3/4 front view (main), side profile, and detail callouts

Aspect Ratio: 9:16 (portrait). Overall vibe: serious, precise, manufacturing-grade, like a factory technical poster or industrial tooling catalog.`;
}

/**
 * Start infographic generation (async)
 * Returns a task ID that can be polled for status
 */
export async function startInfographicGeneration(
  car: CarIdentification,
  specs: CarSpecs
): Promise<string> {
  const taskId = uuidv4();

  const task: InfographicTask = {
    taskId,
    status: "queued",
    imageUrl: null,
    error: null,
    createdAt: new Date(),
    completedAt: null,
  };

  taskStore.set(taskId, task);

  const prompt = buildInfographicPrompt(car, specs);

  // Run generation in background (don't await)
  generateImage(taskId, prompt).catch((error) => {
    console.error(`Image generation failed for task ${taskId}:`, error);
    const t = taskStore.get(taskId);
    if (t) {
      t.status = "failed";
      t.error = (error as Error).message || "Image generation failed";
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
              "blurry, low quality, cartoon, anime, watermark, text errors, distorted, unrealistic proportions",
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
 * Check the status of an infographic generation task
 */
export function getTaskStatus(taskId: string): InfographicTask | null {
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
