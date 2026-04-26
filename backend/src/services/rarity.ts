// ============================================================
// LocoSnap — Rarity Classification Service
// Assigns Common → Legendary tiers based on train attributes
// Uses AI for context-aware rarity assessment
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { config } from "../config/env";
import { TrainIdentification, TrainSpecs, RarityInfo, RarityTier } from "../types";
import { getLanguageInstruction } from "../config/languageInstructions";

const RARITY_PROMPT = (train: TrainIdentification, specs: TrainSpecs, language: string = "en") =>
  `${getLanguageInstruction(language)}You are a trainspotting rarity expert. Classify the rarity of spotting a ${train.class}${train.name ? ` "${train.name}"` : ""} (${train.operator}, ${train.type}).

Known specs:
- Number built: ${specs.numberBuilt ?? "unknown"}
- Number surviving: ${specs.numberSurviving ?? "unknown"}
- Status: ${specs.status ?? "unknown"}
- Year built: ${train.yearBuilt ?? "unknown"}

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "tier": "rare",
  "reason": "Heritage steam locomotive — only 6 surviving Class A4s worldwide",
  "productionCount": 35,
  "survivingCount": 6
}

Rarity tiers (assign ONE):
- "common" — Everyday stock you'd see on most journeys. Modern EMUs/DMUs in regular service with hundreds in fleet (e.g. Class 350, Class 377, Class 800).
- "uncommon" — Regular but not everywhere. Older classes still in service, freight locos on specific routes, less common operators (e.g. Class 66, Class 37 on charters).
- "rare" — Special effort or luck needed. Heritage locos on mainline tours, withdrawn classes with few survivors, uncommon foreign visitors (e.g. Deltic on mainline, Class 50).
- "epic" — Genuinely exciting spot. Famous named locomotives, very few survivors, prototype/experimental stock, steam on mainline (e.g. Flying Scotsman, Tornado, APT).
- "legendary" — Once-in-a-lifetime spot. World-record holders, last of their kind, royal trains, unique prototypes (e.g. Mallard, LNER 4472 in original condition, working Garratt).

Rules:
- Consider both the CLASS rarity and the INDIVIDUAL locomotive rarity.
- A common class can have a legendary individual (e.g. a specific Class 43 used for the last HST service).
- Named heritage steam is usually "rare" minimum, famous named locos are "epic" or "legendary".
- Modern stock in regular daily service is almost always "common".
- If numberSurviving is known and very low (1-5), bump up the tier.
- "productionCount" and "survivingCount" should be your best estimates (use null if truly unknown).
- Be generous but honest — spotters want excitement but not inflated rarity.
- Freight context: assess rarity across ALL service types, not just passenger. A freight locomotive with a large fleet (e.g. Class 66 with 400+ units, DB BR 185/186/193) should be "common" or "uncommon" because spotters encounter them regularly on freight workings — do NOT bump it to "rare" simply because it rarely appears on passenger trains. The rarity tier reflects realistic overall spotting opportunity. A high-fleet freight loco that is everywhere on freight routes is not rare.
- Conversely, a loco that IS rare in freight service (small fleet, limited routes, or mostly withdrawn) should be classified as such even if it is not a passenger train.
- German regional fleet awareness: DB Class 643/644 (Talent) have been largely retired from DB mainline service and are now rare. DB Class 143 (ex-DR 243, LEW Hennigsdorf Bo'Bo' electric, 646 originally built) is NEAR-EXTINCT — DB Regio has withdrawn almost all of them by 2025–2026. The class is functionally gone from mainline passenger service despite the massive original production run. Classify BR 143 / CD Class 143 as "epic" — this is a genuinely exciting spot, not merely "rare". Do not be fooled by the historical fleet size of 646 — the active fleet is a tiny remnant.
- Berlin S-Bahn BR 485 (ex-DR Class 270, nicknamed "Coladose" / Cola can): LEW Hennigsdorf 1987–1992, 166 half-sets originally built. By 2025–2026 ALL BUT 3 units have been SCRAPPED. The BR 485 is the last surviving East German S-Bahn design on the Berlin network and is on the verge of total extinction. Classify BR 485 as "epic" — only 3 surviving units out of 166 is an extraordinary rarity. Do NOT classify as "common" or "uncommon" — a fleet reduced from 166 to 3 is epic-tier without question.
- Finnish fleet awareness: VR Sm3 (Pendolino) operates with 18 sets covering ALL main Finnish intercity routes (Helsinki–Tampere, Helsinki–Turku, Helsinki–Joensuu, Helsinki–Oulu) — it is the standard intercity train in Finland and a COMMON everyday sight. Do NOT rate it rare or uncommon based on the modest absolute fleet count; 18 sets serving an entire national intercity network means you see one on virtually every main line journey in Finland. VR Dv12 diesel locomotive: fleet is declining as Dr19 replacements arrive — classify as "uncommon" reflecting its diminishing presence. DB Class 628 is mostly withdrawn. DB Class 218 diesel locos are dwindling. DB Class 103 electric is essentially museum-only. Do not classify retired or near-retired German classes as "common".
- If a class was once common but is now largely withdrawn or transferred to secondary operators, classify based on its CURRENT rarity, not its historical abundance.
- DR Class 156 (LEW Class 252 prototype): ONLY 4 were ever built by LEW Hennigsdorf (1989–1991). This is an extremely rare prototype electric locomotive from Deutsche Reichsbahn. Any sighting of a DR Class 156 must be classified as "legendary" — a production run of 4 examples is one of the smallest of any mainline locomotive class. Do NOT classify it as "common", "uncommon", or "rare". It is LEGENDARY tier without exception.
- Fenniarail Dr18: ONLY 6 units exist worldwide (Dr18 101–106), built by CZ Loko 2015–2020 for Fenniarail Oy — a single private Finnish freight operator. With a global fleet of six and operation limited to specific Finnish freight flows, any sighting is a genuine rarity. Classify Dr18 as "legendary" — the 6-unit fleet size puts it alongside DR Class 156 in the smallest-fleet tier. Do NOT classify it as "common", "uncommon", or "rare". Operator must be recorded as Fenniarail, not VR.
- DB BR 140 / originally DB E 40: West German Bundesbahn Bo'Bo' electric mixed-traffic/freight locomotive built 1957–1973, 879 units produced by Krauss-Maffei / Krupp / Henschel / SSW. Withdrawn from DB Cargo mainline service in 2020 but a substantial remnant (~100 units) continues in daily freight service with private operators (PRESS, Lokomotion, Railsystems RP, RailAdventure, EBM Cargo, etc.) — not museum-only. Classify BR 140 as "legendary" — it is one of the last classic West German first-generation electric freight locomotives still working commercial freight in 2026, a direct survivor of the 1950s–1970s Bundesbahn electrification programme that defined post-war West German rail. Do NOT classify it as "common" or "uncommon" despite the large historical fleet — the DB-red/blue/green Bundesbahn BR 140s are now a spotter's prize. The "reason" field MUST reflect (a) West German Bundesbahn origin (NOT East German / Deutsche Reichsbahn), (b) 879 units originally built (NEVER 186 — that is a different class), (c) class retired from DB Cargo 2020 but living on with private operators. Never describe it as "extinct", "virtually no survivors", or "completely withdrawn".
- DB BR 648 / Alstom Coradia LINT 41: modern German regional DMU built by Alstom (formerly LHB Salzgitter) from 1999 onwards. 300+ units produced across all variants (BR 648.0, 648.1, 648.2, 648.4, 648.7) and operators. Operated in active daily service by DB Regio, HLB (Hessische Landesbahn), NAH.SH, erixx, vlexx, Vias, Nordwestbahn, and other German regional operators. Classify BR 648 as "common" — this is a workhorse regional DMU encountered on virtually every non-electrified German regional line. Do NOT classify it as "rare", "epic", or "legendary". The "reason" field MUST reflect (a) 300+ units built across the whole 648 family, NEVER 192 (192 is the VR Dv12 Finnish diesel production figure — different class entirely on a different continent), (b) active daily service across multiple operators with production continuing into the 2020s, (c) not "extremely limited production" or "specialized service" — it is a mainstream regional DMU that defines modern German regional rail on non-electrified lines. Never describe it as "extinct", "limited production", "specialized", or similar rarity-inflating language.
- British Rail Class 69: 16 units only, all rebuilt by Progress Rail Services UK from withdrawn Class 56 hulks for GB Railfreight, in service from 2021. Small modern fleet, all in active GBRf service across the UK network. Classify as "rare" — a 16-unit modern freight fleet on a single operator is genuinely uncommon to spot, especially the special-livery units (BTP yellow/chequered, war-themed, named-loco commemorative paintwork). Do NOT classify as "common" or "uncommon" — 16 active units across the entire UK network puts it firmly in rare territory. Do NOT classify as "epic" or "legendary" either — these are working freight locos in daily traffic, not heritage or near-extinct, and over-rating cheapens the genuinely epic/legendary tiers. The "reason" field MUST reflect (a) 16-unit modern fleet built 2021+ by Progress Rail UK, (b) GBRf-only operator, (c) rebuilt from Class 56 hulks not original — this is a brand-new class designation, (d) multiple distinctive special liveries on the small fleet make any individual unit a spotter's notebook entry. Discovered 2026-04-24.
- VR Sr-class rarity: three generations of VR electric locomotive with very different rarity profiles. **VR Sr1**: 110 units built 1973–1985 by Novocherkassk (NEVZ) + Strömberg. Being actively withdrawn as Sr3 Vectrons replace it — active fleet is shrinking. Classify as "rare" (heading toward "epic" as withdrawal continues through 2026–2028). The classic red-green-yellow Finnish tricolor livery is especially rare now; if that livery is visible, lean toward "epic". **VR Sr2**: only 46 units ever built (1995–2003 by SLM Winterthur / ABB, Re 460 family) — ALL still in service. Small fleet by international standards but reliable mainline presence on VR intercity routes. Classify as "rare" — a 46-unit fleet is genuinely small, but not vanishing. **VR Sr3**: 80 units ordered/delivered from Siemens 2017+ — the modern mainline backbone, actively growing. Classify as "uncommon" — it is the new standard Finnish mainline electric, so spotters encounter them often but the absolute fleet is still modest. Do NOT classify Sr3 as "common" (fleet is not large enough) or "rare" (it is now everyday infrastructure on VR mainlines).`;

const FALLBACK_RARITY: RarityInfo = {
  tier: "common",
  reason: "Unable to classify rarity.",
  productionCount: null,
  survivingCount: null,
};

function parseRarityResponse(text: string): RarityInfo {
  try {
    // Strip markdown fences first, then extract the first JSON object.
    // Haiku 4.5 occasionally wraps responses in preamble/postamble text —
    // grab the {...} substring rather than parsing the whole string.
    const stripped = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const match = stripped.match(/\{[\s\S]*\}/);
    const cleaned = match ? match[0] : stripped;
    const parsed = JSON.parse(cleaned);

    const validTiers: RarityTier[] = ["common", "uncommon", "rare", "epic", "legendary"];
    const tier = validTiers.includes(parsed.tier) ? parsed.tier : "common";

    return {
      tier,
      reason: parsed.reason ?? "No classification reason provided.",
      productionCount: parsed.productionCount ?? null,
      survivingCount: parsed.survivingCount ?? null,
    };
  } catch {
    console.error("Failed to parse rarity response:", text);
    return FALLBACK_RARITY;
  }
}

export async function classifyRarity(
  train: TrainIdentification,
  specs: TrainSpecs,
  language: string = "en"
): Promise<RarityInfo> {
  try {
    const prompt = RARITY_PROMPT(train, specs, language);

    if (config.hasAnthropic) {
      console.log("[RARITY] Using Claude (Anthropic)");
      const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      });
      const content = response.content[0];
      if (content.type !== "text") return FALLBACK_RARITY;
      return parseRarityResponse(content.text);
    }

    if (config.hasOpenAI) {
      console.log("[RARITY] Using GPT-4o (OpenAI)");
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-4o",
          max_tokens: 512,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${config.openaiApiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );
      const text = response.data.choices?.[0]?.message?.content;
      if (!text) return FALLBACK_RARITY;
      return parseRarityResponse(text);
    }

    return FALLBACK_RARITY;
  } catch (error) {
    console.error("[RARITY] Error:", (error as Error).message);
    return FALLBACK_RARITY;
  }
}
