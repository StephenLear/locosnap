// One-off: run a single image through the production vision path.
// Usage: ANTHROPIC_API_KEY=... npx ts-node src/scripts/idOne.ts <imagePath>
import fs from "fs";
import path from "path";
import { identifyTrainFromImage } from "../services/vision";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("pass an image path");
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  const mime =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const result = await identifyTrainFromImage(buf, mime);
  console.log("\n=== RESULT ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
