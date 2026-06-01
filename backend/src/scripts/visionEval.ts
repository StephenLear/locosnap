// ============================================================
// Vision accuracy eval harness
// ============================================================
// Runs a fixed set of labelled train photos through the live vision
// identification path and reports pass/fail against the expected class.
//
// Purpose: a regression safety net for the two-stage prompt refactor.
// Run it BEFORE the refactor (baseline) and again with TWO_STAGE_VISION=true
// (once that flag exists) — the flag-on result must match the baseline.
//
// Requires a real ANTHROPIC_API_KEY (and optionally OPENAI_API_KEY) in the
// environment / backend/.env — it makes real vision API calls.
//
// Run:  cd backend && npx ts-node src/scripts/visionEval.ts
//       PHOTO_DIR="/path/to/photos" npx ts-node src/scripts/visionEval.ts
//
// Photos default to ~/Desktop/train photos/.

import fs from "fs";
import path from "path";
import os from "os";
import { identifyTrainFromImage } from "../services/vision";

// filename -> expected canonical class + acceptable alternative substrings.
// A result PASSES if the returned class (case-insensitive) equals or contains
// the expected string OR any `accept` entry. `mustNot` fails the case if the
// returned class contains a forbidden string (e.g. the historical misID).
type Case = { expected: string; accept?: string[]; mustNot?: string[]; note?: string };

const MANIFEST: Record<string, Case> = {
  // ── Tier A: high-traffic confusable families ──
  "ICE4.jpg": { expected: "BR 412", accept: ["412", "ICE 4"], mustNot: ["408", "403"] },
  "ICE3-Neo-1-.jpg": { expected: "BR 408", accept: ["408", "ICE 3neo"] },
  "ICE1.webp": { expected: "BR 401", accept: ["401", "ICE 1"] },
  "RegioJet_Pool_Bombardier_TRAXX_MS3.jpg": { expected: "TRAXX MS3", accept: ["TRAXX", "BR 187", "BR 188"], mustNot: ["Vectron", "193"] },
  "die-oebb-taurus-iii-1216-534249.jpg": { expected: "ÖBB 1216", accept: ["1216"], mustNot: ["193"] },
  "DB 193 vectron.jpg": { expected: "BR 193", accept: ["193", "Vectron"], mustNot: ["Taurus", "1116", "1016", "TRAXX"] },
  "ÖBB_1016_038_in_Don_Bosco.jpg": { expected: "ÖBB 1016", accept: ["1016", "1116", "Taurus"], mustNot: ["193", "Vectron"] },
  "OBB tarus RJ_568.jpg": { expected: "ÖBB 1116", accept: ["1116", "1016", "Taurus"], mustNot: ["193", "Vectron"] },
  "442_729_in_Nürnberg,_2014_(02).JPG": { expected: "BR 442", accept: ["442", "Talent 2"] },
  "Siemens Mireo.jpg": { expected: "BR 463", accept: ["463", "Mireo"] },
  "Liesel_28-11-10_642_055-8_im_Bahnhof_Scharfenstein.JPG": { expected: "BR 642", accept: ["642", "Desiro Classic"], mustNot: ["442"] },
  "EU07_364_Wawa.jpg": { expected: "EU07", accept: ["EU07"] },
  "Lokomotywa_EP07-335.jpg": { expected: "EP07", accept: ["EP07"] },
  "EN57 59757_51466.jpg": { expected: "EN57", accept: ["EN57"] },
  "EN57-2011_IMG_2900_filtered.jpg": { expected: "EN57", accept: ["EN57"] },
  "ET22-692_DSC_4762_Jaksice.jpg": { expected: "ET22", accept: ["ET22"], mustNot: ["Dragon"] },
  "Newag dragon ET26-006._Bydgoszcz_Wschód.jpg": { expected: "Newag Dragon", accept: ["Dragon", "E6ACT", "ET26"], mustNot: ["ET22"] },
  "NS ICNG 1682026854_6441b16678665.jpg": { expected: "ICNG", accept: ["ICNG", "ICNG"] },
  "NS ICNG DSC_2433.jpeg": { expected: "ICNG", accept: ["ICNG"] },

  // ── Tier B: tester-flagged, regression-sensitive ──
  "DRG E 77.jpeg": { expected: "DRG E 77", accept: ["E 77", "E77"], mustNot: ["E 669", "E669", "669.1"] },
  "159_224_HHPI_Eurodual.jpg": { expected: "BR 159", accept: ["159", "EuroDual"], mustNot: ["Vectron"] },
  "BR_110_110_166_2080401004.jpg": { expected: "BR 110", accept: ["110"] },
  "DB 232 088-5.jpeg": { expected: "BR 232", accept: ["232", "Ludmilla"] },
  "Class 69 69009 repaint 2_0.jpeg": { expected: "Class 69", accept: ["69"], mustNot: ["Class 37", "Class 56"] },
  "DB 628 1280px-Db-628695-01-orig.jpg": { expected: "BR 628", accept: ["628"], mustNot: ["LINT", "640", "648"] },

  // ── Tier C: long-tail (verifies lazy-loaded rules still fire) ──
  "Loram c21 12119982823_d294ce8166_b.jpg": { expected: "Loram C21", accept: ["Loram", "C21", "rail grinder"], mustNot: ["Class 66", "Class 70", "Class 67"] },
  "EMD SW1001 Mendip 102829146_103321131417953_1288168478569660416_n.jpg": { expected: "SW1001", accept: ["SW1001"], mustNot: ["Class 08"] },
  "EMD SW1001 dem-sw1001-02.jpg": { expected: "SW1001", accept: ["SW1001"], mustNot: ["Class 08"] },
  "RAe TEE II 527273670_1413904597026976_7630425509611463527_n.jpg": { expected: "RAe TEE II", accept: ["RAe TEE", "TEE II", "Gottardo"], mustNot: ["RAe 4/8", "Churchill"] },
  "RAeTEEAirolo.jpg": { expected: "RAe TEE II", accept: ["RAe TEE", "TEE II", "Gottardo"], mustNot: ["RAe 4/8"] },
  "VR Sr1 (finland)I11_610_Bf_Turku,_Sr1_3084.jpg": { expected: "VR Sr1", accept: ["Sr1"], mustNot: ["Sr3", "Sr2"] },
  "tatra-kt4d-triebwagen-1308-in-leipzig-vorher-berlin-kuehlschrankmagnet.webp": { expected: "Tatra KT4D", accept: ["KT4D", "KT4"], mustNot: ["Combino"] },
  "BR_201 thumper.jpg": { expected: "Class 201", accept: ["201", "Thumper", "202", "203"] },
  "SBB_Ae_8_14_11801_Rail_Top.jpg": { expected: "Ae 8/14", accept: ["Ae 8/14", "8/14"], mustNot: ["Ae 4/7"] },

  // ── Bonus / informational (not on the original list) ──
  "ÖBB_5022_038_in_Graz_Don_Bosco.jpg": { expected: "ÖBB 5022", accept: ["5022", "Desiro"], note: "bonus" },
  "130_101_Luetzel_03042010.JPG": { expected: "BR 130", accept: ["130", "V300", "Ludmilla"], note: "bonus / uncertain canonical" },
};

function mimeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function matches(got: string, c: Case): boolean {
  const g = (got || "").toLowerCase();
  if (c.mustNot?.some((m) => g.includes(m.toLowerCase()))) return false;
  const targets = [c.expected, ...(c.accept ?? [])].map((s) => s.toLowerCase());
  return targets.some((t) => g.includes(t) || t.includes(g));
}

async function main() {
  const dir = process.env.PHOTO_DIR || path.join(os.homedir(), "Desktop", "train photos");
  const mode = process.env.TWO_STAGE_VISION === "true" ? "TWO-STAGE" : "single-stage (baseline)";
  console.log(`\nVision eval — mode: ${mode}\nphotos: ${dir}\n`);

  let pass = 0, fail = 0, missing = 0;
  const fails: string[] = [];

  for (const [file, c] of Object.entries(MANIFEST)) {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) { console.log(`  SKIP (missing)  ${file}`); missing++; continue; }
    try {
      const buf = fs.readFileSync(full);
      const result = await identifyTrainFromImage(buf, mimeFor(file));
      const got = result?.class ?? "(no train)";
      const ok = result ? matches(got, c) : false;
      const tag = c.note ? ` [${c.note}]` : "";
      if (ok) { pass++; console.log(`  PASS  ${c.expected.padEnd(16)} got "${got}"${tag}`); }
      else { fail++; fails.push(`${file}: expected ${c.expected}, got "${got}"`); console.log(`  FAIL  ${c.expected.padEnd(16)} got "${got}"  <-- ${file}${tag}`); }
    } catch (err) {
      fail++; fails.push(`${file}: ERROR ${(err as Error).message}`);
      console.log(`  ERROR ${file}: ${(err as Error).message}`);
    }
  }

  console.log(`\n──────────────\n${mode}: ${pass} pass / ${fail} fail / ${missing} missing (of ${Object.keys(MANIFEST).length})`);
  if (fails.length) { console.log("\nFailures:"); fails.forEach((f) => console.log("  - " + f)); }
  process.exit(fail > 0 ? 1 : 0);
}

main();
