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

// Static instruction block — cacheable via Anthropic prompt caching.
// MUST NOT contain any per-call interpolation. Per-train context goes in the user message.
const RARITY_SYSTEM_PROMPT = `You are a trainspotting rarity expert. Classify the rarity of spotting the train identified in the user message.

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
- DB BR 110 / DB E 10: West German Bundesbahn Bo'Bo' four-axle electric **EXPRESS PASSENGER** locomotive, NOT a freight loco — DB Cargo NEVER operated BR 110. 379 BR 110.1 + 31 BR 113 built 1956–1969 by Krauss-Maffei (prime), Krupp, Henschel, AEG, Siemens. Max 150 km/h, 3,620 kW. **DB Regio retired the class on 12 February 2014** (last DB Regio 110 in scheduled service was 110 469); the related BR 115 sub-class continued at DB Fernverkehr until February 2020. As of 2026 approximately 11–15 units remain operational with private operators including TRI / Train Rental International (running 110 428, 110 448, 110 469 — the literal last DB Regio 110, now in National Express livery, plus 113 309 and E 10 1309), Centralbahn AG (115 278, 115 383), Gesellschaft für Fahrzeugtechnik / GfF (110 459), TeutoLok (110 350), Lok Partner (which rented 110 350 to VIAS as RE-19 Ersatzzug to Emmerich on 19 May 2025), Schienenverkehrsgesellschaft (115 261), and Pressnitztalbahn (110 511), plus DB Museum heritage examples. Use cases today: replacement trains (Ersatzzüge), Sonderzüge / charter runs, occasional regional cover. Classify BR 110 as "rare" — the surviving ~12-unit private-operator fleet from a 379-unit original production is a dwindling cohort of classic Bundesbahn first-generation electric express muscle. Do NOT classify as "common" or "uncommon" (it has been gone from DB Regio scheduled service for over a decade and total active count is in the low double digits), and do NOT classify as "epic" or "legendary" (still in regular working order across multiple private operators in 2026, not yet near-extinct). The "reason" field MUST reflect: (a) **West German Bundesbahn origin** (DB E 10 → BR 110, NEVER East German / Reichsbahn), (b) **express passenger locomotive** (NEVER freight, NEVER mixed-traffic) — describing BR 110 as freight would be the same class of error as describing BR 155 as West German, (c) 379 BR 110.1 originally built (NEVER 60 — 60 is a hallucinated figure; NEVER 879 — that is the freight BR 140 / E 40), (d) DB Regio retired 12 February 2014 (the last unit was 110 469) and BR 115 continued at DB Fernverkehr until February 2020, (e) the surviving units operate with private charter and rental operators (TRI, Centralbahn, GfF, TeutoLok, Lok Partner, Pressnitztalbahn) — NEVER describe operators as "Lokomotion" or "Railpool" (those are freight operators that don't operate BR 110), (f) builder is "Krauss-Maffei + Krupp + Henschel + AEG + Siemens" — NEVER "Bombardier", "Siemens" alone, or "Adtranz" (that's BR 101). Never describe it as "all withdrawn", "completely retired", "extinct", "scrapped", "museum only", "freight loco", "DB Cargo veteran", "phased out by BR 151/155 freight" (factually nonsense — those are heavy freight classes that never replaced a passenger loco), or any framing implying current DB operation. Discovered 2026-05-01 during pre-ad recording when the rarity card hallucinated "only 60 units built", "mixed-traffic", "5,400 kW for heavy freight on Alpine and Ruhr Valley routes" (those are BR 155 specs), and "Lokomotion or Railpool" operators — every claim wrong. The class is heavily photographed; spotters notice and publicly correct mistakes within minutes.
- DB BR 140 / originally DB E 40: West German Bundesbahn Bo'Bo' electric mixed-traffic/freight locomotive built 1957–1973, 879 units produced by Krauss-Maffei / Krupp / Henschel / SSW. Withdrawn from DB Cargo mainline service in 2020 but a substantial remnant (~100 units) continues in daily freight service with private operators (PRESS, Lokomotion, Railsystems RP, RailAdventure, EBM Cargo, etc.) — not museum-only. Classify BR 140 as "legendary" — it is one of the last classic West German first-generation electric freight locomotives still working commercial freight in 2026, a direct survivor of the 1950s–1970s Bundesbahn electrification programme that defined post-war West German rail. Do NOT classify it as "common" or "uncommon" despite the large historical fleet — the DB-red/blue/green Bundesbahn BR 140s are now a spotter's prize. The "reason" field MUST reflect (a) West German Bundesbahn origin (NOT East German / Deutsche Reichsbahn), (b) 879 units originally built (NEVER 186 — that is a different class), (c) class retired from DB Cargo 2020 but living on with private operators. Never describe it as "extinct", "virtually no survivors", or "completely withdrawn".
- DB BR 155 / DR Baureihe 250: East German Co'Co' six-axle heavy freight electric, built 1974–1984 by VEB LEW Hennigsdorf for Deutsche Reichsbahn, originally classed DR 250 and renumbered DB BR 155 on 1 January 1992 after reunification. 273 units total (3 prototypes 1974 + 270 series 1977–1984). Withdrawn from DB Cargo by approximately 2019, but a substantial surviving fraction (estimated 50–80 units) remains in active heavy freight service with private operators including PRESS, MEG, HSL Logistik, Captrain, and Wedler Franz Logistik in 2026. Classify BR 155 as "rare" — the surviving private-operator fleet represents a dwindling cohort of classic East German LEW freight muscle still working commercial trains, comparable in spotting profile to BR 140. Do NOT classify as "common" or "uncommon" (the active fleet is far below the historical 273), and do NOT classify as "epic" or "legendary" (these are working freight locos in daily traffic, not heritage or near-extinct — over-rating cheapens those tiers). The "reason" field MUST reflect: (a) **East German Deutsche Reichsbahn origin** (NOT West German, NOT Bundesbahn — BR 155 was built in East Germany by LEW Hennigsdorf, this is the most-corrected fact by German rail enthusiasts), (b) 273 units built (NEVER 110, NEVER 170 — 170 is the West German BR 151), (c) class withdrawn from DB Cargo by 2019 but living on with private freight operators, (d) builder is LEW Hennigsdorf — NEVER Krupp, Krauss-Maffei, Henschel, Bombardier, or Siemens. Never describe it as "all withdrawn", "completely retired", "extinct", "all scrapped", or "museum only". Discovered 2026-04-26 when a post-fix scan returned "West German electric freight locomotive from 1977" in the rarity descriptor — geographically wrong and would be flagged immediately by the German rail audience the BR 155 ad targets.
- DB BR 648 / Alstom Coradia LINT 41: modern German regional DMU built by Alstom (formerly LHB Salzgitter) from 1999 onwards. 300+ units produced across all variants (BR 648.0, 648.1, 648.2, 648.4, 648.7) and operators. Operated in active daily service by DB Regio, HLB (Hessische Landesbahn), NAH.SH, erixx, vlexx, Vias, Nordwestbahn, and other German regional operators. Classify BR 648 as "common" — this is a workhorse regional DMU encountered on virtually every non-electrified German regional line. Do NOT classify it as "rare", "epic", or "legendary". The "reason" field MUST reflect (a) 300+ units built across the whole 648 family, NEVER 192 (192 is the VR Dv12 Finnish diesel production figure — different class entirely on a different continent), (b) active daily service across multiple operators with production continuing into the 2020s, (c) not "extremely limited production" or "specialized service" — it is a mainstream regional DMU that defines modern German regional rail on non-electrified lines. Never describe it as "extinct", "limited production", "specialized", or similar rarity-inflating language.
- British Rail Class 69: 16 units only, all rebuilt by Progress Rail Services UK from withdrawn Class 56 hulks for GB Railfreight, in service from 2021. Small modern fleet, all in active GBRf service across the UK network. Classify as "rare" — a 16-unit modern freight fleet on a single operator is genuinely uncommon to spot, especially the special-livery units (BTP yellow/chequered, war-themed, named-loco commemorative paintwork). Do NOT classify as "common" or "uncommon" — 16 active units across the entire UK network puts it firmly in rare territory. Do NOT classify as "epic" or "legendary" either — these are working freight locos in daily traffic, not heritage or near-extinct, and over-rating cheapens the genuinely epic/legendary tiers. The "reason" field MUST reflect (a) 16-unit modern fleet built 2021+ by Progress Rail UK, (b) GBRf-only operator, (c) rebuilt from Class 56 hulks not original — this is a brand-new class designation, (d) multiple distinctive special liveries on the small fleet make any individual unit a spotter's notebook entry. Discovered 2026-04-24.
- VR Sr-class rarity: three generations of VR electric locomotive with very different rarity profiles. **VR Sr1**: 110 units built 1973–1985 by Novocherkassk (NEVZ) + Strömberg. Being actively withdrawn as Sr3 Vectrons replace it — active fleet is shrinking. Classify as "rare" (heading toward "epic" as withdrawal continues through 2026–2028). The classic red-green-yellow Finnish tricolor livery is especially rare now; if that livery is visible, lean toward "epic". **VR Sr2**: only 46 units ever built (1995–2003 by SLM Winterthur / ABB, Re 460 family) — ALL still in service. Small fleet by international standards but reliable mainline presence on VR intercity routes. Classify as "rare" — a 46-unit fleet is genuinely small, but not vanishing. **VR Sr3**: 80 units ordered/delivered from Siemens 2017+ — the modern mainline backbone, actively growing. Classify as "uncommon" — it is the new standard Finnish mainline electric, so spotters encounter them often but the absolute fleet is still modest. Do NOT classify Sr3 as "common" (fleet is not large enough) or "rare" (it is now everyday infrastructure on VR mainlines).
- **Polish EN57 family rarity (originally added 2026-04-28, REVISED 2026-04-29 after pafawag.w.obiektywie round-2 + round-3 corrections):** EN57 / EN57AL / EN57AKŁ / EN57AKS / EN57AK / EN57ALd was by FAR the most numerous Polish EMU ever built — **1,438 units produced 1962–1993 by Pafawag (Wrocław)** — but the **active fleet has been heavily reduced**. Per pafawag's correction (verified against ilostan.forumkolejowe.pl): only approximately **60 EN57 units remain in active service** in 2026 out of the original 1,438 — that is about **4% surviving in service**. This is no longer a "common" classification. Classify EN57 and all sub-variants (AL / AKŁ / AKS / AK / ALd / etc.) as **"uncommon"** by default. If the specific photographed unit is in original Pafawag livery (red+grey+yellow) or in an unmodernised state, lean toward **"rare"**. Modernised variants (AL / ALd / AKŁ / AKS) are still uncommon — the survivor count is the dominant rarity factor. ABSOLUTELY **NEVER "legendary"** for any EN57 family member. NEVER "common" — the round-1 "common" classification was based on the 1,438 production figure without accounting for withdrawals; round-2 evidence corrects this. The "reason" field MUST reflect (a) ~1,438 units built — Poland's most numerous historical EMU class, (b) only ~60 in active service in 2026 (~4% surviving), (c) being gradually replaced by Newag Impuls and Pesa Elf 2 — replacement is well underway with most of the fleet already withdrawn. Never describe EN57 as "extinct", "near-extinct", "1 left", "few remaining" (overshooting in the rare direction also flagged by Polish trainspotters), or as "common" / "everyday" / "ubiquitous" (the round-1 framing — Polish testers will flag it). **EN71** is a closely related 4-car derivative (~67 units built); classify as "uncommon". **EN57ALd** specifically is the deep-modernisation variant — operated by POLREGIO; rarity stays "uncommon" or "rare" — never legendary.
- **Polish ET22 rarity:** PKP Co-Co heavy freight electric, ~1,184 units built 1969–1990 by Pafawag — one of the most numerous Polish electric locomotives ever, alongside the EN57. Still extensively operated by PKP Cargo, Lotos Kolej, CTL Logistics, and various private Polish freight operators across the entire Polish electrified network in 2026. Classify as **"common"** — encountered on virtually every Polish freight workings. Do NOT classify as "rare", "epic", or "legendary". Reason field must reflect (a) ~1,184 units built — Poland's most numerous freight electric, (b) Co-Co heavy freight workhorse still in daily service, (c) max 125 km/h (NEVER 160 — it's a freight loco, not a passenger express).
- **Polish "Gagarin" heritage family rarity (ET21 / EU05 / EP05) — added 2026-05-04 evening:** the FIRST GENERATION of Polish-built electric locomotives (Pafawag Wrocław, 1957–1971), nicknamed "Gagarin" after Yuri Gagarin's 1961 first manned spaceflight. **EU05 / EP05**: only 30 units built 1962–1963 (Bo'Bo' express passenger), all-but-fully retired from regular service today; preserved examples remain at the Polish Railway Museum and at Skansen Tabor Kolejowy heritage events. Classify as **"legendary"** — a 30-unit class with most withdrawn and only museum-preserved units occasionally rolling out is a genuine legendary spot. **ET21**: ~174 units built 1957–1971 (Co-Co heavy freight); also overwhelmingly retired with only a handful preserved or operated on enthusiast services. Classify as **"epic"** — a few units survive in private/heritage hands but the class is functionally extinct from commercial service. The reason field MUST reflect (a) first generation of Polish-built electric locomotives, (b) Pafawag heritage (1957–1971), (c) tiny surviving fleet — preserved/heritage status, (d) the Gagarin nickname is a notable Polish trainspotter cultural marker. NEVER classify EU05 / ET21 as "common" or "uncommon" — the survivor counts make these spotting-trophy tier.
- **Newag Dragon (E6ACT) rarity — added 2026-05-04 evening:** modern Polish heavy freight Co-Co electric (Newag Nowy Sącz, 2010+). Approximately 50+ units built across the E6ACT / E6ACTa / E6ACTadb variants, in active service with PKP Cargo, Lotos Kolej, CTL Logistics, DB Cargo Polska, and various private freight operators. Classify as **"uncommon"** — a 50-unit modern freight fleet across multiple operators is genuinely encounterable on Polish mainlines but not as ubiquitous as the ET22 (1,184-unit common workhorse). Lean **"rare"** for the dual-mode E6ACTadb variant (smaller sub-fleet). Do NOT classify Dragon as "common" (fleet not large enough) or "epic"/"legendary" (active modern production class, not a heritage rarity). Reason field must reflect (a) modern Newag Co-Co freight loco, 2010+, (b) ~50 units built — small modern fleet, (c) the contemporary replacement for the ET22 in heavy freight service, (d) multiple variants including the dual-mode E6ACTadb.
- **DB BR 247 / Siemens Vectron DE rarity — added 2026-05-05:** the diesel-only Vectron variant. ~80 units in service since 2018+ for DB Cargo, RDC Autozug Sylt, ELL, MRCE, Lokomotion, BoxXpress and other private operators on non-electrified routes. Classify as **"uncommon"** — an 80-unit modern diesel mainline fleet across multiple operators is genuinely spottable but not everyday. Do NOT classify as "common" (fleet too small), "rare" (fleet still actively growing, not heritage), or "epic"/"legendary" (modern production class). Reason field MUST reflect (a) ~80 units built — small but growing modern fleet, (b) Siemens Mobility Munich-Allach build (NEVER Electro-Motive Diesel / EMD / GM), (c) the diesel-only Vectron variant — distinct from BR 248 dual-mode and BR 193 electric, (d) RDC Autozug Sylt is the highest-profile operator (Hindenburgdamm causeway to Sylt). NEVER cite "709" as a number-built or number-surviving figure (709 is BR 232 Ludmilla — completely different class).
- **ČD class 753 / 754 (Brejlovec) rarity — added 2026-05-05:** Czech Bo-Bo diesel-electric mainline locos. **Class 753**: ~322 originally built by ČKD Praha 1968-1977, with ~60+ rebuilt by CZ Loko 2010+ as the "753.7" sub-class — the original 753 fleet has been heavily reduced through retirement, rebuild, or scrapping; the rebuilt 753.7 sub-fleet is the active modern cohort. Classify class 753 as **"uncommon"** in active form (the rebuilt 753.7 fleet is a recognizable modern Czech freight workhorse), bumping to **"rare"** if an unmodified original 753.0 unit in heritage ČSD livery is visible. **Class 754**: ~86 originally built 1979+, mostly still in active passenger service though aging. Classify as **"rare"** — small original fleet with no rebuild programme, regular but not common to encounter. Both classes are routinely seen in Saxony / Bavaria / Slovakia on cross-border running. Reason field MUST reflect (a) Czech ČKD Praha original build (NEVER Siemens / Škoda / German), (b) "Brejlovec" goggle-eyed nickname is a notable Czech trainspotter cultural marker, (c) for 753 specifically the rebuild programme by CZ Loko keeps the class active, (d) for 754 the smaller passenger fleet aging without rebuild. Do NOT classify 753 or 754 as "common" (neither fleet is large enough) or "legendary" (they are working revenue locos, not heritage trophies).`;

// Per-call dynamic message — small, varies per request, NOT cached.
const buildRarityUserMessage = (train: TrainIdentification, specs: TrainSpecs, language: string = "en") =>
  `${getLanguageInstruction(language)}Train to classify: ${train.class}${train.name ? ` "${train.name}"` : ""} (${train.operator}, ${train.type}).

Known specs:
- Number built: ${specs.numberBuilt ?? "unknown"}
- Number surviving: ${specs.numberSurviving ?? "unknown"}
- Status: ${specs.status ?? "unknown"}
- Year built: ${train.yearBuilt ?? "unknown"}`;

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
    const userMessage = buildRarityUserMessage(train, specs, language);

    if (config.hasAnthropic) {
      console.log("[RARITY] Using Claude (Anthropic)");
      const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        temperature: 0,
        system: [
          {
            type: "text",
            text: RARITY_SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userMessage }],
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
          messages: [
            { role: "system", content: RARITY_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
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
