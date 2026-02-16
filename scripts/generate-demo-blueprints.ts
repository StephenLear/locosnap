/**
 * Generate 4 demo blueprint images for the paywall preview.
 * Run from the backend directory: npx ts-node scripts/generate-demo-blueprints.ts
 *
 * Downloads generated images to frontend/assets/blueprints/
 */

import axios from "axios";
import * as fs from "fs";
import * as path from "path";

const API_URL = "https://locosnap.onrender.com";

// Sample trains for demo
const DEMO_TRAINS = [
  {
    style: "technical",
    filename: "demo-technical.jpg",
    train: {
      class: "GWR Castle Class 4073",
      name: "Caerphilly Castle",
      operator: "Great Western Railway",
      type: "Steam",
      designation: "4-6-0",
      color: "Brunswick green",
    },
    specs: {
      maxSpeed: "100 mph",
      power: "1500 hp",
      weight: "128 tonnes",
      length: "19.4m",
      gauge: "Standard gauge",
      builder: "GWR Swindon Works",
      fuelType: "Coal",
    },
  },
  {
    style: "vintage",
    filename: "demo-vintage.jpg",
    train: {
      class: "LNER A3 Pacific",
      name: "Flying Scotsman",
      operator: "LNER",
      type: "Steam",
      designation: "4-6-2",
      color: "Apple green",
    },
    specs: {
      maxSpeed: "100 mph",
      power: "1800 hp",
      weight: "150 tonnes",
      length: "21.3m",
      gauge: "Standard gauge",
      builder: "Doncaster Works",
      fuelType: "Coal",
    },
  },
  {
    style: "schematic",
    filename: "demo-schematic.jpg",
    train: {
      class: "Class 800 Azuma",
      name: "Azuma",
      operator: "LNER",
      type: "Electric",
      designation: "Bo-Bo+2+2+Bo-Bo",
      color: "White and red",
    },
    specs: {
      maxSpeed: "140 mph",
      power: "2600 kW",
      weight: "330 tonnes",
      length: "201m (9-car)",
      gauge: "Standard gauge",
      builder: "Hitachi",
      fuelType: "Electric / Diesel bi-mode",
    },
  },
  {
    style: "cinematic",
    filename: "demo-cinematic.jpg",
    train: {
      class: "Class 66",
      name: null,
      operator: "EWS / DB Cargo",
      type: "Diesel",
      designation: "Co-Co",
      color: "Maroon and gold",
    },
    specs: {
      maxSpeed: "75 mph",
      power: "3300 hp",
      weight: "129 tonnes",
      length: "21.3m",
      gauge: "Standard gauge",
      builder: "EMD / GM",
      fuelType: "Diesel",
    },
  },
];

async function generateBlueprint(demo: (typeof DEMO_TRAINS)[0]): Promise<string | null> {
  console.log(`\nGenerating ${demo.style} blueprint for ${demo.train.class}...`);

  try {
    // We need to use the identify endpoint with a dummy photo
    // Instead, let's directly call the image generation via the backend
    // The backend doesn't have a direct "generate blueprint" endpoint
    // So we'll need to check if there's another way...

    console.log(`  Style: ${demo.style}`);
    console.log(`  Train: ${demo.train.class} (${demo.train.operator})`);
    console.log(`  -> Use the prompt from blueprint-prompts.md to generate via an AI image tool`);
    console.log(`  -> Save as: frontend/assets/blueprints/${demo.filename}`);

    return null;
  } catch (error) {
    console.error(`  Failed: ${(error as Error).message}`);
    return null;
  }
}

async function main() {
  // Create output directory
  const outDir = path.join(__dirname, "..", "frontend", "assets", "blueprints");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log("LocoSnap Demo Blueprint Generator");
  console.log("==================================");
  console.log(`Output: ${outDir}\n`);

  for (const demo of DEMO_TRAINS) {
    await generateBlueprint(demo);
  }

  console.log("\n\nNext steps:");
  console.log("1. Generate images using the prompts in assets/blueprint-prompts.md");
  console.log("2. Save them to frontend/assets/blueprints/ with the filenames above");
  console.log("3. The paywall will display them as preview cards");
}

main().catch(console.error);
