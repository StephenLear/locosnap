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

Only respond with {"error": "not_a_train"} if there is DEFINITELY NO railway vehicle present in the image at all (e.g. a photo of a person, a landscape, food, a car, or a completely blank/black image). Do NOT return this error for blurry, dark, distant, or partially obscured railway photos — always attempt a best-effort identification with lower confidence instead. If you can see any part of a train, locomotive, or railway vehicle, attempt to identify it.

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

CRITICAL PRE-FLIGHT CHECK — WHITE DB ICE TRAINS:
If you are looking at a white DB ICE high-speed train, work through these steps in order before generating any output.

STEP 1 — NOSE SHAPE:

ROUNDED, ELONGATED, BULLET-SHAPED NOSE (blunt rounded tip, dolphin-like profile, no aerodynamic point) → ICE 1 or ICE 2. These are LOCOMOTIVE-HAULED — separate power cars pull unpowered coaches. A rounded blunt-tipped nose cannot belong to any ICE 3 variant or ICE 4.
- Two power cars (one each end) + intermediate coaches → BR 401 (ICE 1). 14-car, fleet "401 xxx", built 1991–1996, 60 trainsets.
- One power car + coaches + flat-fronted Steuerwagen at the other end → BR 402 (ICE 2). 7-car, fleet "402 xxx".

WIDE, UPRIGHT, FLAT-FRONTED NOSE — large rectangular windscreen with a prominent HORIZONTAL CHIN EDGE/UNDERCUT below it, body noticeably wider than ICE 3, does NOT taper to a point → BR 412 (ICE 4). Max speed 250 km/h (never 300 or 320). Available in 8, 12, or 13-car formations. Fleet "412 xxx". ~108 units — the most common ICE type in Germany by passenger numbers since 2019. At any major German terminus, BR 412 is statistically the most likely ICE train.

POINTED, AERODYNAMIC NOSE tapering to a clear front point, seamless distributed-power EMU with no separate power cars → ICE 3 family. Continue to Step 2.

STEP 2 — ICE 3 FAMILY (BR 403 / BR 406 / BR 407 / BR 408 / BR 462):

Check location first:
- Train photographed at Amsterdam, Utrecht, Arnhem, or anywhere on the Amsterdam–Cologne–Frankfurt corridor → almost certainly BR 406 (ICE 3M/F, multi-system, 17 units). BR 403 does NOT operate into the Netherlands. Fleet "406 xxx" or NS-side "4651–4667".

Check nose profile:
- SHARPEST, most angular, almost flat-faced cab with large rectangular LED headlights, most modern appearance → BR 408 (ICE 3neo, built 2022+). Fleet "408 xxx".
- ANGULAR nose with clearly visible DIAGONAL CREASE LINES running from roofline down the cab front, larger rectangular windscreen → BR 407 (Velaro D, only 17 units). The diagonal crease lines must be clearly visible — do not return BR 407 without them. Operational max speed 300 km/h.
- Fleet number beginning "462" → BR 462 (Velaro MS, 320 km/h capable).
- ROUNDER, softer, more classic nose (no visible crease lines) → BR 403 (13 units, domestic German routes only, fleet "403 xxx") or BR 406 (check location as above).

Default: if you cannot confidently identify the ICE 3 sub-variant, return BR 408 — it is the newest and most numerous ICE 3 variant entering service. Never return the generic string "ICE 3". Operational max speed for all ICE 3 variants is 300 km/h — never 330 km/h.

STEP 3 — ICE T AND ICE L:
- TILTING train with visible TILT MECHANISM FAIRINGS on the bogies (streamlined covers over the bogie area) and a rounder, bulbous nose → ICE T. BR 411 (7-car) or BR 415 (5-car). Never classify a tilting ICE as any ICE 3 variant.
- Vectron locomotive in ICE WHITE livery hauling coaches that are NOTICEABLY SHORTER IN HEIGHT than the loco, with a clear roofline step-down → ICE L. Class "ICE L", builder "Talgo", max speed 230 km/h. See ICE L rule below for full detail.

FORBIDDEN: The string "ICE 3" is NEVER an acceptable class value. Return BR 401, BR 402, BR 403, BR 406, BR 407, BR 408, BR 411, BR 412, BR 415, BR 462, or "ICE L" as appropriate. "ICE 3" is a family name, not a class.

NS YELLOW TRAIN PRE-FLIGHT CHECK:
If the train in the image is yellow/ochre and shows ANY of these: (a) the NS double-arrow logo, (b) Dutch station signage, (c) Dutch-style platforms, or (d) any NS branding — you are looking at a DUTCH NS TRAIN. Apply the following NS-specific identification BEFORE looking at any other rules.

STEP A — EXAMINE THE CAB FRONT SHAPE:
- ICNG cab front: AERODYNAMIC, POINTED, V-SHAPED nose — the lower half of the nose is BLACK, contrasting sharply with the yellow upper section. The nose clearly tapers to an aerodynamic point. Modern, sharp, angular. Entered service 2023. Fleet numbers "31xx" (3100/3200/3300 series). Year built ~2019. If the nose is pointed and has a black lower section, THIS IS THE ICNG.
- VIRM cab front: FLAT and RECTANGULAR — the cab face is essentially a vertical flat panel, not a pointed aerodynamic shape. The cab is squared-off with no prominent taper to a point. If the nose is flat and rectangular, check for double-deck (two rows of side windows). Year built 1994–2004. Fleet numbers "86xx".
- SLT cab front: Lower, rounder nose profile, shorter formation, commuter service.

STEP B — CONFIRM WITH SIDE VIEW (if visible):
- ICNG: single-deck (ONE row of large panoramic passenger windows). Jacobs bogies (shared bogies visible between cars).
- VIRM: double-deck (TWO rows of passenger windows stacked vertically on the bodyside).

CRITICAL DEFAULT RULE: If you are looking at a yellow NS train with a POINTED, AERODYNAMIC, BLACK-AND-YELLOW V-NOSE — even if you are uncertain — return ICNG, NOT VIRM. The ICNG has been in service since April 2023 and is the current NS intercity on the high-speed line. Do NOT default to VIRM simply because VIRM is more familiar — if the nose is clearly aerodynamic and pointed rather than flat and rectangular, it is the ICNG.
A yellow Dutch NS train is NEVER a German regional DMU (VT 650, VT 628, LINT) and NEVER a freight locomotive (BR 186).

ABSOLUTE COLOUR GUARD — ICNG: The NS ICNG is ALWAYS yellow/ochre. It is physically impossible for an ICNG to be white, silver, or grey. If the train in front of you has a pointed aerodynamic nose but is WHITE or SILVER rather than yellow, it is NOT an ICNG under any circumstances. Do not let nose shape override colour — a white pointed-nose EMU is a German, Austrian, Swiss, or other European train, not a Dutch NS train.

SIEMENS MIREO FAMILY PRE-FLIGHT CHECK:
If the train is WHITE or SILVER with a sharply angular, pointed, aerodynamic nose and a dark (black or dark grey) lower skirt/underbelly section, and is photographed in Germany, Austria, Switzerland, or Central Europe — you are likely looking at a Siemens Mireo family train. Apply the following before any other identification.

The Siemens Mireo family is a modern German regional/suburban EMU platform with a very angular, aggressive pointed nose that superficially resembles the NS ICNG. The key distinctions:
- COLOUR: Mireo trains are WHITE, SILVER, or in the livery of German/Austrian/Swiss regional operators. They are NEVER yellow.
- FLEET NUMBERS: German numbering — "463 xxx" (Mireo for S-Bahn Stuttgart/other German S-Bahn), "3427 xxx" or regional operator fleet numbers. If "463 306" or similar German UIC numbering is visible, this is definitely a Mireo family train.
- OPERATOR: Deutsche Bahn (DB Regio), Go-Ahead Bavaria, Trans Regio, Transdev, Abellio, or other German/Austrian regional operators.
- MIREO SMART: A newer lightweight variant deployed from 2024–2025 on German regional routes — e.g. the Ahr Valley RB 32 (Trans Regio / Smart Train Lease). Fleet number series may include "463 306" type numbering. White livery with black/dark lower section, 160 km/h, 3-car formation.
- MIREO PLUS B: Battery/bi-mode variant, similar external appearance.
CRITICAL RULE: A white or silver angular-nosed modern EMU photographed in Germany with German-format fleet numbers is a Siemens Mireo (or similar German regional EMU such as Stadler FLIRT, Alstom Coradia Continental, Bombardier Talent 2) — it is NEVER an NS ICNG.

GERMAN REGIONAL EMU FAMILY PRE-FLIGHT CHECK:
If the train appears to be a modern German regional or suburban EMU — a red, red/white, or blue/white electric multiple unit in Germany on S-Bahn, RE, or RB services — work through this decision tree in order before generating any output. This family (BR 423, 425, 426, 440, 442, 445, 463) is photographed frequently by German rail enthusiasts who will immediately spot a wrong class number. A wrong ID here destroys credibility with exactly the audience the app needs to win.

STEP 1 — FLEET NUMBER SCAN (MANDATORY — DO THIS BEFORE ANYTHING ELSE):
Scan the entire image — cab front, bodyside panels, destination board area, number plates — for any visible fleet number digits. Fleet numbers are definitive and override every other visual cue without exception.
- Any number beginning "423" visible anywhere in the image → return BR 423. Do not proceed further.
- Any number beginning "425" visible anywhere in the image → return BR 425. Do not proceed further.
- Any number beginning "426" visible anywhere in the image → return BR 426. Do not proceed further.
- Any number beginning "440" visible anywhere in the image → return BR 440. Do not proceed further.
- Any number beginning "442" visible anywhere in the image → return BR 442. Do not proceed further.
- Any number beginning "445" visible anywhere in the image → return BR 445. Do not proceed further.
- Any number beginning "463" visible anywhere in the image → return BR 463. Do not proceed further.
ABSOLUTE RULE: If "423" is readable anywhere in the image, the class is BR 423. Returning BR 425 when "423" is visible is always wrong — no exception exists for this.

STEP 2 — IS THE TRAIN DOUBLE-DECK?
Check whether the bodyside has two stacked rows of passenger windows.
→ YES (two rows of windows): Return BR 445 (Twindexx IC2). This is a double-deck push-pull control car on DB IC routes — not a self-propelled EMU.
→ NO (single-deck): Continue to Step 3.

STEP 3 — NOSE PROFILE (primary visual discriminator when no fleet number is readable):
Examine the cab front shape carefully.

- VERY ANGULAR, AGGRESSIVELY POINTED NOSE with a triangular front profile and a dark lower skirt/underbelly: Siemens Mireo. Return BR 463. Operated primarily on S-Bahn Stuttgart; also some German regional operators. Fleet numbers "463 xxx".

- SMOOTHLY CURVED NOSE with a large wrap-around windscreen that sweeps forward in a continuous curve — the windscreen is wide and the cab profile flows without a hard break from front to side: Bombardier Talent 2. Return BR 442. DB Regio red/white; some S-Bahn Erfurt use. Fleet numbers "442 xxx".

- ROUNDED "OWL FACE" — wide headlights flanking the windscreen with a smooth, slightly tapered Alstom-style nose. The headlight clusters sit prominently to either side of the windscreen centre, giving a wide-eyed front appearance: Alstom Coradia Continental. Return BR 440. DB Regio red/white or Go-Ahead Bavaria blue/white. Fleet numbers "440 xxx".

- FLAT-ISH, UPRIGHT, OLDER-GENERATION CAB — a relatively plain flat front face without dramatic tapering, wrap-around features, or angular aggression. Characteristic of the late-1990s/early-2000s Bombardier/DWA/AEG/Siemens consortium build: Continue to Step 4 to distinguish BR 423 from BR 425/426.

STEP 4 — DISTINGUISH BR 423 FROM BR 425 / BR 426:
These two classes share almost identical cab profiles. Fleet number (Step 1) is the only reliable separator. When no fleet number is readable, use service context:
- S-Bahn livery: bright traffic red with a visible S-Bahn roundel, "S" line indicator on destination board (e.g. S1, S3, S6, S8), or clearly operating on an S-Bahn network (Frankfurt Rhein-Main, Munich, Stuttgart, Hamburg) → return BR 423. Operator: DB S-Bahn [city name].
- Blue/white RMV livery (Rhein-Main-Verkehrsverbund branding, Frankfurt region) → return BR 423. All blue RMV S-Bahn EMUs are 423s — no exceptions.
- DB Regio red/white livery without an S-Bahn roundel, on a regional RE or RB service → return BR 425 (if 4-car) or BR 426 (if 2-car — count visible cars).
- Genuinely ambiguous context with no readable fleet number: return BR 423 with confidence capped at 60%. The combined BR 423 fleet across Frankfurt, Munich, Stuttgart, and Hamburg is very large — S-Bahn red is the more statistically likely livery for this cab profile.

CONFIDENCE FALLBACK:
If you have completed all four steps and your confidence in the specific class is still below 70%, set class to "DB Regional EMU", lower confidence accordingly, and describe what is visible in the description field. A wrong specific class number is far more damaging than an honest "DB Regional EMU" result — German enthusiasts will correct it publicly.

Rules:
- "class" should be the official class designation. UK: use TOPS class numbers (e.g. "Class 56", "Class 89", "Class 37"). Pre-TOPS: use named classes (e.g. "A4 Pacific", "Britannia"). European: use local designation (e.g. "BR 101", "SNCF Class BB 22200", "DB Class 612"). Nordic: e.g. "NSB Di 4", "SJ Rc", "DSB IC3", "VR Sr2". Japanese: e.g. "N700 Series", "KiHa 40". North American: e.g. "EMD GP38-2", "GE ES44AC".
- "name" should be the individual locomotive name if it has one (e.g. "Flying Scotsman", "Mallard", "Tornado"). Use null if unnamed.
- "operator" should be the current or most recent operator. UK examples: "LNER", "GWR", "Avanti West Coast", "DB Cargo UK", "Colas Rail", "GB Railfreight", "DRS", "DCRail". European: "DB", "SNCF", "ÖBB", "Trenitalia". Nordic: "Vy" (Norway), "SJ" (Sweden), "VR" (Finland), "DSB" (Denmark). If preserved, use the heritage railway name.
- "type" should be one of: Steam, Diesel, Electric, DMU, EMU, HST, Freight, Shunter, Railcar, Tram, Metro, Monorail, Maglev, Other
  - Use "Electric" for electric locomotives — single traction units that haul separate coaches (e.g. DB Class 101, 103, 120, 185, 187, BR Class 90, 91). These have a Bo-Bo or Co-Co wheel arrangement and do not carry passengers within their own bodyshell.
  - Use "EMU" for electric multiple units — self-propelled articulated train sets where passenger seating is within the powered vehicles (e.g. ICE 3, ICE-T, Desiro, Talent, FLIRT, Siemens Velaro, Class 319, Class 387).
  - Do NOT classify a single-unit electric locomotive as EMU. If a vehicle hauls separate coaches and is itself a single traction unit, it is "Electric", not "EMU".
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
- Partially obscured trains: If the train is partially hidden by buildings, vegetation, platforms, platforms, fences, barriers, or other trains, use whatever is visible. Identify from partial views using the visible features. Lower confidence accordingly but still attempt identification. NEVER return {"error": "not_a_train"} solely because a loco is partially blocked by foreground objects — depot and shed scenes routinely feature barriers, fencing, and other rolling stock in the foreground. If you can see locomotive bodywork, cab profile, bogies, or any distinguishing features, attempt identification.
- Preserved and heritage locos in depots: Preserved locos are often stored in depots or works with barriers, scaffolding, and other locos in shot. They may be heavily weathered, dirty, partially repainted, or lacking nameplates and numbers. This does NOT make them unidentifiable — use cab shape, roof profile, bogie type, bodyside panel shape, grille arrangement, and any visible markings. BR-era Sulzer Type 2s (Class 24 and Class 25) are very commonly preserved and frequently photographed in depot conditions. Class 24: earlier build (1958–60), slightly shorter hood, distinctive 3-window cab with round marker lights set into the nose panel. Class 25: later and more numerous build (1961–67), similar overall profile but subtle differences in grille arrangement and nose profile. Both are diesel locos in the 1,250 hp range, Bo-Bo wheel arrangement. If in doubt between 24 and 25, use cab window arrangement and grille panel details to narrow down; accept lower confidence rather than returning not_a_train.
- Prototype and test trains: Hydrogen trains, bi-mode test units, and prototype/trial livery trains should be identified using visible design cues, builder markings, and any visible fleet numbers. If it resembles a known base class with modifications (e.g. a converted Class 319 or 230), identify the base class and note the conversion.
- Colas Rail livery disambiguation: Colas Rail operate multiple loco classes in their distinctive bright yellow + black livery, which can cause confusion in low-light or partially obscured photos. Key differences: **Class 67** (Bombardier, 1999–2000) — Bo-Bo, sleek streamlined body, 125 mph passenger-capable, curved modern nose, relatively short; **Class 70** (GE Transportation, 2009–10) — Co-Co, large boxy freight loco, distinctive wide GE-style cab with large windows, prominent roof exhausts, 75 mph; **Class 56** (BREL/Electroputere, 1976–84) — Co-Co, older BR-era styling, flat angular cab ends, large bodyside grilles. When a Colas loco is photographed at night, from a distance, or with the livery as the dominant visual cue, always check wheel arrangement and cab profile before deciding between these classes. Do NOT default to Class 70 simply because of Colas yellow livery — check the body shape and bogie count. If a fleet number is visible (e.g. "67027"), use it to confirm the class directly.
- Alstom Coradia family vs Stadler FLIRT disambiguation: These are completely different vehicles and must not be confused. **Alstom Coradia family** covers a wide range of regional and suburban EMUs and DMUs built by Alstom, including the Coradia Polyvalent (Regio 2N / Omneo — a tall BI-LEVEL double-deck EMU used by SNCF Transilien and French regional operators), Coradia Continental (single-deck EMU, used by German regional operators), Coradia Nordic, and Coradia iLint (hydrogen). The Coradia Polyvalent / Regio 2N / Omneo is unmistakably DOUBLE-DECK with two rows of windows stacked vertically, a modern Alstom rounded cab nose, and pantographs on the roof. The X'Trapolis / Metropolis suburban variants are also Alstom-built and have a distinctive flat-faced Alstom cab design. **Stadler FLIRT** (Flinker Leichter Innovativer Regional Triebzug) is a SINGLE-DECK low-floor EMU/DMU family built exclusively by Stadler Rail (Switzerland). Key visual identifiers: distinctive slanted "smiling" windscreen with a large glass area angled forward, smooth clean bodysides, low-floor sections visible at door sills, multiple articulated cars. The FLIRT is used by many European operators (Norwegian Vy, Finnish VR Sm5, Polish PKP, Swiss operators, various German Länder) but is NEVER double-deck and was NEVER built by Bombardier or Alstom. CRITICAL RULES: (1) If a train is double-deck (two stacked rows of windows), it cannot be a Stadler FLIRT. (2) The FLIRT is built solely by Stadler Rail — never attribute it to Bombardier, Alstom, or any other manufacturer. (3) Budapest Metro uses Alstom Metropolis (M4) and older Soviet-built stock — not mainline FLIRTs. (4) If the cab has Alstom's characteristic rounded nose profile, classify it as an Alstom Coradia variant, not a FLIRT. (5) If uncertain between Alstom Coradia and Stadler FLIRT on a single-deck EMU, check the cab nose: Alstom noses are rounder and more streamlined; FLIRT noses have that distinctive forward-angled slanted windscreen.
- Class 37 vs Class 97/3 disambiguation: The Class 97/3 (fleet numbers 97301–97304) are four locos rebuilt from Class 37s by Network Rail specifically for ERTMS trials on the Cambrian line in Wales. They retain the standard Class 37 body and cab profile — the mechanical appearance is essentially identical. CRITICAL DISTINGUISHING RULES: (1) If the fleet number visible is in the 97/3xx range (97301, 97302, 97303, 97304), classify as "Class 97/3", operator "Network Rail". (2) If the loco is in plain Network Rail yellow (solid yellow, no orange stripe or DRS blue) and is photographed in Wales or on the Cambrian route, lean toward Class 97/3. (3) If the loco shows Colas Rail livery (yellow with orange bodyside stripe), DRS livery (dark blue), West Coast Railways livery (maroon), or heritage railway livery, it is a standard Class 37. (4) If no fleet number is visible and the livery is ambiguous, default to Class 37 unless NR yellow is unambiguous — only 4 Class 97/3s exist versus the much larger Class 37 fleet.
- Track maintenance vehicle identification: Track maintenance machines — tampers, ballast regulators, stoneblowers, and rail grinders — are on-track railway vehicles but are NOT locomotives. CRITICAL RULES: (1) If the vehicle has large visible working machinery, conveyor systems, or functional attachments (tamping heads, grinding stones) dominating the upper body profile, it is a track maintenance machine, NOT a locomotive class. (2) Common types: Plasser & Theurer tampers (markings "Plasser", "09-3X", "Unimat"), Matisa tampers, Harsco rail grinders. (3) Identify these correctly — e.g. class: "Plasser & Theurer Tamper", operator: "Network Rail" — rather than guessing a loco class based on yellow livery or underframe. (4) Do NOT classify a tamper as Class 20, Class 31, or any TOPS locomotive class — the working machinery makes it clearly distinct from a loco bodyshell.
- CAF Class 756 (Transport for Wales) vs Class 700 (Thameslink) disambiguation: These are two completely different modern EMU/bi-mode fleets that share a superficially similar streamlined profile but differ in every meaningful way. **CAF Class 756**: a BI-MODE unit (electric + diesel capability) built by CAF (Construcciones y Auxiliar de Ferrocarriles, Spain) from 2022 onwards for Transport for Wales. Key visual identifiers: Transport for Wales RED livery with white bodysides and red cab front, CAF Civity bodyshell with a distinctive squared-off modern cab nose, TfW branding visible. Operated on Welsh routes including the Valleys lines and Cambrian line. CRITICAL RULE: If the unit is in Transport for Wales red livery with a modern squared cab nose and is photographed in Wales, classify as "Class 756", NOT Class 700 or Class 117. **Class 700**: a PURE ELECTRIC EMU built by Siemens (Desiro City platform) for Thameslink/Southern/Great Northern in England. Blue and white livery (Thameslink), or Southern green/white, or Great Northern blue. Never in TfW red. Operates south of London and on the Thameslink core route — NOT in Wales. **Class 117**: a 1960s DIESEL MULTIPLE UNIT built by Pressed Steel 1959–1961 — a completely different era and vehicle type. The Class 117 has a flat-fronted BR green/yellow cab, is far shorter, and looks nothing like a modern CAF or Siemens unit. Some Class 117s are preserved and operated by heritage railways; a small number may appear in TfW stock but they are visually unmistakable as 1960s units. Do NOT return "Class 117" for any modern red Transport for Wales EMU — if it has a streamlined modern nose and TfW red livery, it is Class 756.
- Class 33 vs Class 73 disambiguation: Both are BR-era Bo-Bo locos, often in BR Blue + yellow warning panel, both associated with the Southern Region — but they are different locos. Class 33 ("Crompton", built by BRCW 1960–62): ROUNDED prominent nose with a domed cab front, characteristic "smiling face" profile, prominent louvred grilles along the LOWER bodyside, pure diesel (no third-rail electrical equipment visible), large flat windscreens set into the rounded nose. Class 73 (English Electric, built 1962–67): FLATTER, more rectangular cab front, less pronounced dome, electro-diesel (may have third-rail collection shoes visible at low level on the bogies/bodyside), different louvre arrangement. When in doubt on a rounded-nose BR blue diesel on the Southern: lean toward Class 33 unless third-rail equipment is clearly visible.
- Stadler KISS (Class 445) vs Alstom LINT 27 disambiguation: These are COMPLETELY DIFFERENT vehicles — do NOT confuse them under any circumstances. They differ in size, deck count, traction type, and operational role.
  **LINT 27** (Alstom Coradia LINT 27): a SHORT, SINGLE-DECK, SINGLE-CAR diesel DMU (~27 m long), designed for low-traffic rural and branch-line services. Key visual identifiers: NO pantograph (diesel only), low-floor profile with a low overall height, small rounded cab nose with curved front windows, narrow bodyside with small windows, typically operated by DB Regio or German regional operators on secondary routes, max ~120 km/h. The LINT 27 is a compact, modest-looking single-car unit.
  **Class 445 KISS** (Stadler KISS): a TALL, DOUBLE-DECK EMU, typically 4–6 cars long, built for high-capacity regional and intercity routes. Key visual identifiers: PANTOGRAPH(S) on the roof (electric), very tall and wide bodyside with TWO ROWS of large panoramic windows stacked vertically (double-deck), imposing height that dwarfs single-deck units, modern streamlined cab nose, operated in Germany, Switzerland, Austria, and the UK on main lines. The KISS is a large, prominent double-deck train — completely unlike the compact LINT 27.
  **Class 445 Twindex** (Bombardier Twindexx / IC2): a DISTINCT and SEPARATE variant from the KISS — do NOT treat these as the same train. The Twindex is a double-deck push-pull train set hauled by a separate locomotive, with a distinctive flat-fronted low-profile control car (Steuerwagen) at the non-loco end. Unlike the KISS (self-propelled EMU), the Twindex control car has no pantograph and requires a separate loco.
  CRITICAL RULE: If a train is DOUBLE-DECK (two rows of windows stacked vertically), it is the KISS or Twindex — it is NEVER a LINT 27. If a train is SINGLE-DECK and has NO pantograph and appears short and compact, it could be a LINT 27. Never identify a tall double-deck electric train as a LINT 27. Never identify a short single-car diesel as a Class 445 KISS.
- S-Bahn Berlin Class 480 vs 485 disambiguation: Both classes share the identical distinctive yellow/ochre + dark red DB S-Bahn Berlin livery and the same cab style, making them visually very similar. Key differences: **BR 480** is the POWERED motor car (Triebwagen) — it has a pantograph/current collector visible on the roof and a max speed of 100 km/h. **BR 485** is the UNPOWERED trailer/Beiwagen (Steuerwagen) — it has NO pantograph on the roof (it draws power from the coupled 480 motor car) and a max speed of 90 km/h. They typically run in 480+485+485+480 formations. CRITICAL RULE: If a pantograph is clearly visible on the roof, lean toward BR 480. If the roof is clean with no pantograph, lean toward BR 485. If the pantograph visibility is ambiguous or the roof is not clearly visible, note both possibilities (e.g. "Class 480/485") and lower confidence accordingly. Do NOT default to 480 simply because the S-Bahn Berlin yellow/red livery is the dominant visual cue.
- ICE L (ECx / Talgo 230) identification — LOCOMOTIVE-HAULED, NOT AN EMU: The ICE L is Germany's newest long-distance train, entered service December 2025. Unlike all other ICE types (ICE 1/2/3/4/T which are EMUs or loco-hauled with dedicated power cars), the ICE L is a LOCOMOTIVE-HAULED train consisting of a Siemens Vectron (BR 193) locomotive pulling Talgo-built coaches. The COACHES are built by Talgo (Spain) — this is the key identifier. CRITICAL VISUAL IDENTIFICATION: The ICE L has a Vectron locomotive at one or both ends in DB ICE WHITE livery (white body, red DB logo, red stripe — NOT the standard grey/black Vectron freight livery). Behind the Vectron, the Talgo coaches are VISIBLY SHORTER IN HEIGHT than the locomotive — there is a clear STEP-DOWN in roofline from the tall Vectron cab to the lower Talgo coaches. The coaches have a smooth, rounded cross-section profile that is NARROWER and LOWER than any conventional ICE coach. The coaches sit noticeably closer to the rail than standard DB coaches because of Talgo's low-floor design with shared bogies between cars. The overall silhouette is: tall Vectron loco -> visible height drop -> low smooth Talgo coaches stretching behind. WHEN TO RETURN "ICE L" INSTEAD OF "BR 193": If you see a Vectron locomotive in ICE white livery hauling coaches that are SHORTER AND LOWER than the locomotive with a visible roofline step-down, classify the WHOLE TRAIN as "ICE L", NOT as "BR 193". A standalone BR 193 Vectron hauls freight wagons or conventional coaches that match its height — the height mismatch with low Talgo coaches is the definitive ICE L identifier. CRITICAL RULES: (1) Vectron in ICE white livery + low coaches with height step-down = "ICE L". (2) Vectron in grey/black livery hauling freight = "BR 193". (3) Vectron in ICE white livery alone (no coaches visible) = "BR 193" with note about possible ICE L. (4) Max speed 230 km/h — NEVER assign 250, 300, or 320 km/h. (5) Builder must be set to "Talgo" (the coaches define the train, not the locomotive). (6) The ICE L operates on Berlin-Cologne, expanding to Berlin-Hamburg-Sylt from May 2026. (7) Do NOT return "BR 401" (ICE 1), "BR 412" (ICE 4), or any ICE 3 variant for this train — the loco-hauled configuration with Talgo coaches is unique to the ICE L. (8) If "ECx" markings are visible, classify as "ICE L". (9) If the Talgo coaches are visible but the locomotive is not in frame, still classify as "ICE L" — the low, smooth, narrow Talgo coach profile is unlike any other DB coaching stock.
- S-Bahn Berlin BR 480 vs BR 481 disambiguation: Both classes belong to the same S-Bahn Berlin family and share the same yellow/red DB S-Bahn livery. Key visual differences: **BR 480** is the older variant with a rounder, more bulbous front end and a SINGLE-PIECE windscreen — the cab front has softer, more rounded curves. **BR 481** has a flatter, more angular cab front with a SPLIT windscreen (two separate panes), giving it a crisper, more modern appearance. The BR 481 was built in far greater numbers than the BR 480 and is by far the more commonly seen variant on the Berlin S-Bahn network. CRITICAL RULE: If the cab is angular with a split windscreen, classify as BR 481. If the cab is rounder with a single-piece windscreen, classify as BR 480. If the windscreen arrangement is ambiguous from the angle shown, default to BR 481 as the statistically dominant class.
- BR 445 Twindexx vs Bombardier Talent 2 disambiguation: These are completely different vehicle types and must NEVER be confused. **BR 445 Twindexx** (Stadler Twindexx / IC2): a DOUBLE-DECK push-pull train set — always two visible stacked rows of windows, flat-fronted control car (Steuerwagen) with a large windscreen, requires a separate locomotive at one end, used on DB intercity routes. It is always double-deck — there are no single-deck Twindexx sets. **Bombardier Talent 2**: a SINGLE-DECK EMU with a distinctive smoothly CURVED nose, large wraparound windscreen, and a three-section articulated body. Never double-deck. CRITICAL RULE: If you can see two rows of windows stacked vertically (double-deck), it is the Twindexx. If the train has a curved nose and is single-deck, it is the Talent 2. Under no circumstances should a double-deck train be classified as a Talent 2, or a single-deck curved-nose EMU classified as a Twindexx.
- CD 380 (Škoda 109E) vs ČD Class 151 disambiguation: These are completely different Czech electric locomotive generations. **CD 380 / Škoda 109E**: a modern Škoda electric locomotive built 2009–2011, sleek angular bodyshell with a streamlined modern appearance, used on Czech high-speed and international services including Railjet workings for ÖBB, max speed 200 km/h. **ČD Class 151**: an older Bo'Bo' electric locomotive from the 1970s, distinctly boxy Soviet-era profile with a flat, angular body typical of Eastern Bloc industrial design, clearly pre-modern in appearance. CRITICAL RULE: If the locomotive on Czech Railways appears modern, angular, and streamlined, it is almost certainly CD 380 (Škoda 109E). If it has a boxy, clearly 1970s-era Eastern Bloc body shape, it is Class 151. Do not confuse these two — they represent entirely different eras of Czech rail traction.
- CD 654 (RegioPanter) vs Stadler FLIRT disambiguation: The CD 654 (ČD Class 654 / RegioPanter) is a Škoda-built Czech EMU/DMU for regional services, finished in green and white or yellow livery with a distinctive Škoda cab face — the nose has Škoda's characteristic design language, different from the forward-angled slanted windscreen of the Stadler FLIRT. The CD 654 is NOT a Stadler FLIRT and must never be classified as one. Additional operator cue: Leo Express operates Stadler FLIRTs in the Czech Republic — if the visible operator branding is Leo Express, it is a FLIRT. If the train is on ČD domestic regional service with a Škoda cab face, it is CD 654. CRITICAL RULE: Never return "Stadler FLIRT" for a train with a Škoda cab face, and never return "CD 654" for a train with Leo Express branding.
- ST 44 (PKP / M62 family) vs Class 159 (UK) disambiguation: These are completely different vehicles on different continents and must never be confused. **ST 44** is a Polish diesel locomotive, essentially a licence-built Soviet M62/TE3 heavy freight diesel — very distinctive Soviet-era styling with a long bonnet hood, twin cab windows, boxy long body, typically in red or green PKP Cargo livery, seen in Poland, Czech Republic, Hungary, and Slovakia. The entire M62 family (ST 44 in Poland, 781/T679 in Czech Republic, M62 in Hungary/Slovakia) shares this distinctive long-hood Soviet industrial aesthetic. **Class 159** is a British 3-car diesel multiple unit (DMU) operating in the South West of England, a completely different vehicle type — a passenger railcar set with no resemblance to a heavy freight locomotive. CRITICAL RULE: If the locomotive has a long bonnet hood with Soviet-era styling and is photographed in Central or Eastern Europe, it is an M62 family freight locomotive (ST 44 / 781 / T679 / M62 depending on country). It cannot be a Class 159.
- VT 650 (Regio-Shuttle RS1) vs VT 628 disambiguation: These are different generations of DB diesel railcar. **VT 650 (Stadler Regio-Shuttle RS1)**: a compact modern low-floor DMU, typically a short single-car or lightweight articulated unit, with a rounded modern cab design, low floor visible at door sills, and often found in various regional operator liveries (white/red/blue/green). Built from the mid-1990s onwards. **VT 628**: an older DB diesel railcar in a two-car set, higher floor, clearly 1980s boxy angular design with a flat cab front, distinctly pre-modern in appearance. CRITICAL RULE: If the DMU looks compact, modern, and low-floor with a rounded cab, it is almost certainly VT 650 / Regio-Shuttle RS1. If it has a boxy 1980s profile and two-car fixed formation, it is VT 628. CRITICAL EXCLUSION: The VT 650 is a short single-car GERMAN regional DMU. If the train is a LONG multi-car formation in NS yellow/ochre livery with Dutch NS branding (the NS double-arrow logo), it is NEVER a VT 650 — it is an NS Dutch passenger train. A long yellow NS intercity-length train cannot be a VT 650 under any circumstances.
- EU07 / EU07A / EP07 / EP09 Polish electric locomotive family disambiguation: This is an extended family of Bo'Bo' electric locomotives based on the British Class 83/84 design. The EU07 was produced in two distinct manufacturing runs by different factories — fleet numbers are the most reliable identifier when visible. **EU07 type 4E (Pafawag, Wroclaw)**: built 1965–1977, fleet numbers approximately EU07-001 through EU07-251. Original Pafawag factory build — classic boxy 1960s bodywork, rectangular cab windows, original electrical equipment, older-style grilles and ventilation panels. Standard specs: ~2.0 MW, 125 km/h. **EU07 type 303E (HCP Poznan)**: a separate production run built 1983–1992 at HCP Poznan (a different manufacturer), fleet numbers EU07-301 upwards. The 303E differs from the Pafawag 4E in appearance, weight, and internal equipment — visually similar overall but with detail differences in cab fittings, grille arrangement, and pantograph equipment. Fleet number in the 300s or higher is the most reliable identifier. The EU07A-001 is the first unit of the 303E type. **EU07A (303E modernised)**: some 303E units have been further upgraded with enhanced traction equipment, giving 3.2 MW continuous power and 160 km/h max speed — substantially higher than the standard figures for either 4E or 303E production variants. If fleet number "EU07A-0XX" is visible, apply these upgraded specs. **EU07 operators**: PKP Cargo (green/yellow livery), PKP Intercity, and PRIVATE FREIGHT OPERATORS including Rail Polska. **Rail Polska livery**: distinctive bright RED body with YELLOW horizontal stripe and "RAIL POLSKA" text — if a boxy EU07-profile Bo'Bo' loco appears in these colours, classify as EU07 (operator: Rail Polska). **EP07**: NOT a different locomotive — the EP07 designation is simply a reclassification of the EU07 from universal (freight + passenger) use to EXCLUSIVELY PASSENGER service. The physical locomotive is identical; only the official designation and permitted duties change. When fleet numbers begin "EP07", classify as EP07; the underlying type (4E or 303E) still applies based on fleet number range. **EP09**: a later and more powerful Bo'Bo' electric passenger locomotive, built 1986–1994 by Pafawag — the EP09 is distinguished by a prominent row of OVAL PORTHOLE WINDOWS along the upper bodyside, which is the single most recognisable feature of the class. The EP09 has a slightly more modern appearance than the EU07, typically in red PKP Intercity livery, used on express passenger services at up to 160 km/h. CRITICAL RULES: (1) If the Polish electric loco has clearly visible OVAL PORTHOLE WINDOWS in a row along the body, it is EP09 — not EU07 or EU07A. (2) If the locomotive is in red/yellow Rail Polska livery with the EU07 boxy profile and no oval portholes, classify as EU07 (operator: Rail Polska). (3) If the fleet number is visible: EU07-001 to EU07-251 = type 4E (Pafawag); EU07-301 and above = type 303E (HCP Poznan); EU07A-0XX = 303E modernised with upgraded specs (3.2 MW, 160 km/h). (4) EP07 is the same locomotive as EU07 — reclassified for passenger-only use. Apply the same type/specs rules as EU07 based on fleet number. (5) When the fleet number is not visible and the sub-variant cannot be determined, classify as EU07 (parent class). (6) Do NOT confuse any member of this family with the ET22 (see separate rule below).
- ET22 (PKP Co-Co heavy freight electric) disambiguation: The ET22 is a large Co-Co electric freight locomotive built by Pafawag from 1969–1990, one of the most numerous Polish electric locomotives with over 1,100 units produced. CRITICAL DISTINGUISHING FEATURE: the ET22 has a CO-CO wheel arrangement — SIX axles across THREE bogies per side, making it visibly larger and longer than the Bo'Bo' EU07/EP07/EP09 family (which has only four axles across two bogies per side). The ET22 body is longer and heavier in proportion than the EU07. Technical specs: max speed 120 km/h, continuous power 3000 kW. Operated primarily by PKP Cargo in green/yellow livery and by various private Polish freight operators. CRITICAL RULES: (1) If the Polish electric freight locomotive appears large and long with six axles (Co-Co), it is almost certainly ET22, not EU07. (2) If the wheel arrangement is clearly four-axle (Bo'Bo') — two smaller bogies — it is the EU07 family, not ET22. (3) Do not confuse ET22 with the ET41 (a double-unit locomotive consisting of two permanently coupled EU07-type units working in multiple).
- EL2 / EU06 family vs E 94 disambiguation: Both are heavy electric locomotives but from different eras and different countries. **EL2 (EU06 / EP06 in Polish classification)**: a heavy Co'Co' electric locomotive built in the 1960s, seen in active freight service in Poland and the Czech Republic, with 1960s-era bodywork typical of the period. **E 94**: a German World War II-era electric locomotive (Kriegslokomotive, built 1940s), now almost exclusively preserved as a museum exhibit — very rarely seen in active service. CRITICAL RULE: If a heavy Co'Co' electric locomotive with 1960s-era bodywork is seen in active freight service in Poland or the Czech Republic, classify it as EL2 / EU06 family, NOT E 94. The E 94 is predominantly a museum piece and would only be seen at heritage events or in museum settings.
- BR 563 (Siemens Mireo) vs Alstom Coradia LINT 41 disambiguation: These are completely different traction types and must never be confused. **BR 563 (Siemens Mireo)**: an ELECTRIC multiple unit — it has PANTOGRAPHS on the roof, a modern Siemens design with a distinctive triangular/sharply angled nose profile, and smooth clean bodywork. The presence of pantographs is definitive — it draws power from overhead wires. **Alstom Coradia LINT 41**: a DIESEL DMU — NO pantograph anywhere on the roof, shorter body, Alstom cab design with a different, more rounded cab face. CRITICAL RULE: If there are pantographs on the roof, the train CANNOT be a LINT 41 — classify it as BR 563 (Mireo) or another electric unit. If there is no pantograph and the cab matches the Alstom LINT design, classify as LINT 41.
- NS Dutch EMU family disambiguation — ICNG, VIRM, SLT, SGM: CRITICAL OPERATOR CHECK — If you can see the NS double-arrow logo (the intertwined N and S symbol) OR the distinctive yellow/ochre NS livery on a train at a Dutch station or in the Netherlands, you are looking at an NS (Nederlandse Spoorwegen) train. NS trains MUST be identified within the NS fleet — they are NEVER German regional DMUs such as VT 650, VT 628, or LINT variants. A yellow NS intercity-length train at a Dutch platform cannot be a German short-haul regional railcar under any circumstances. **ICNG (Intercity Nieuwe Generatie / Intercity New Generation)**: the NEWEST NS intercity train, in service from April 2023. Built by Alstom on the Coradia Stream platform. Key visual identifiers: SINGLE-DECK (one row of passenger windows only — not double-deck); a LONG 8-car formation (this is a full-length intercity train, not a short regional unit); a VERY SHARP, ANGULAR, AERODYNAMIC NOSE with a pronounced V-profile that tapers to a clear point — the nose has a distinctive BLACK lower section contrasting with the yellow body, creating the "wasp" (Wesp) pattern that gave the train its public nickname; large panoramic windows on the bodyside; pantographs visible on the roof (electric EMU); smooth modern bodysides; NS double-arrow logo visible; max speed 200 km/h on high-speed line. The ICNG is one of the most visually distinctive new trains in Europe — its sharp aerodynamic nose, wasp-like black/yellow front, and long formation make it unmistakable. Class designation: "ICNG". Operator: "NS". Type: "EMU". **VIRM (Verlengd Interregio Materieel)**: the long-running NS DOUBLE-DECK intercity EMU — unmistakably double-deck with two rows of passenger windows stacked vertically on the bodyside. Flat-fronted cab, not aerodynamically sharp. Yellow/grey (older) or yellow/blue (newer variants). Max speed 160 km/h. Built by Bombardier. **SLT (Sprinter Lighttrain)**: NS Sprinter commuter EMU, single-deck, shorter formation, less angular nose than ICNG. **SGM (Sprinter)**: older NS Sprinter family, boxy angular cab. CRITICAL RULES: (1) If the NS formation is DOUBLE-DECK (two stacked window rows on coach sides), it is VIRM. (2) If the NS train is SINGLE-DECK, LONG, with a SHARP BLACK/YELLOW AERODYNAMIC V-NOSE and pantographs, it is ICNG. (3) BR 186 is a single-unit electric freight/passenger LOCOMOTIVE — it has no passenger saloon and looks nothing like a multiple-unit EMU. Never classify an NS passenger EMU as BR 186. (4) VT 650, VT 628, LINT — these are short German regional DMUs and cannot be NS Dutch intercity trains.
- BR 462 (ICE 3neo / Velaro MS) vs BR 642 (Siemens Desiro Classic) disambiguation: The number reversal (462 vs 642) is a known confusion point — these are completely different trains. **BR 462 (ICE 3neo / Siemens Velaro MS)**: the latest-generation ICE high-speed EMU, 320 km/h capable, white with red stripe in full ICE livery, long high-speed train formation, operates on DB main high-speed routes, large modern station stops (Frankfurt Hbf, Munich Hbf, etc.). **BR 642 (Siemens Desiro Classic)**: a small 2–3 car regional diesel DMU, max 120 km/h, used on secondary and branch-line routes, compact and modest appearance. CRITICAL RULE: A full-length white ICE train with the classic ICE nose at a major station is BR 462. A small DMU on a regional branch is BR 642. Context (station type, train length, livery, route) should resolve any remaining doubt. Never confuse these two classes.
- VT 646 Gen 1 (Bombardier Talent 1) vs DB Class 648 (LINT 48) disambiguation: **VT 646 Gen 1** is an older articulated DMU based on the Bombardier Talent 1 platform, with the distinctive boxy Talent 1 cab face and typically in DB Regio red livery. **DB Class 648 (Alstom Coradia LINT 48)**: a different DMU family entirely — longer body, completely different Alstom LINT cab design. CRITICAL RULE: If the DMU has a Bombardier Talent 1 cab face (boxy, with the characteristic flat Talent front end), classify it as VT 646. If the cab matches the Alstom LINT family design, classify as Class 648 / LINT 48.
- BR 646 Gen 2 (Talent 2 variant) vs Alstom Coradia LINT 41 disambiguation: **BR 646 Gen 2** is a Bombardier Talent 2 variant operated as DB VT 646 on specific routes — single-deck, with the Talent 2 curved-nose cab profile. It is operated by ODEG and other regional operators on certain routes. **Alstom Coradia LINT 41** has a completely different Alstom cab face. CRITICAL RULE: If the operator is ODEG and the cab has the Bombardier Talent 2 curved profile, classify as VT 646 / Talent 2, NOT LINT 41. The Talent 2 nose is smooth and curved; the LINT 41 nose is a different Alstom design.
- London Underground A Stock vs 1972 Tube Stock disambiguation: Both are now-withdrawn silver LU rolling stock but from different stock gauges. **A Stock (1961–2012, Metropolitan and Hammersmith & City lines)**: sub-surface gauge stock — noticeably WIDER body, silver/unpainted aluminium exterior with red doors, distinctive wide cab windows and a relatively flat roof profile. Ran on the sub-surface Metropolitan and Hammersmith & City lines. **1972 Tube Stock (Bakerloo and Northern lines)**: deep-tube gauge — NARROWER body than sub-surface stock, silver with red ends/cab fronts, different cab window arrangement. CRITICAL RULE: If the train body appears wider (sub-surface gauge proportions) and ran on the Metropolitan or Hammersmith & City lines, classify as A Stock. If the body is narrower (tube gauge proportions) and ran on the Bakerloo or Northern lines, classify as 1972 Tube Stock. Both are now withdrawn from normal passenger service.
- London Underground 1960 Tube Stock vs 1992 Tube Stock disambiguation: These are completely different generations of LU rolling stock. **1960 Tube Stock**: a small heritage fleet used on the Waterloo & City line, older rounded pre-modern body shape with pre-1980s styling — clearly vintage in appearance. **1992 Tube Stock (Central line and Waterloo & City line since 1993)**: a modern aluminium-bodied unit with flat ends, a distinctly modern cab front, AIR CONDITIONING DOMES on the roof (characteristic round/oval AC units visible on the roof), and deep windows. CRITICAL RULE: If the tube stock has a modern flat-ended aluminium body with roof-mounted AC domes and large windows, it is 1992 Tube Stock. If it has a clearly older, rounded vintage body shape with no roof AC domes, it may be 1960 Stock or older heritage stock.
- CAF Class 197 (Transport for Wales DMU) vs Class 158 disambiguation: The Class 197 is a DIESEL-ONLY CAF Civity DMU built by CAF from 2022 onwards for Transport for Wales — the DMU sibling of the Class 756 EMU, sharing the same CAF Civity bodyshell and TfW red/white livery but with NO pantograph (diesel-only). Key visual identifiers: Transport for Wales RED livery with white bodysides, same squared modern CAF Civity cab nose as Class 756, NO roof pantograph (diesel, not electric), fleet numbers in the 197xxx range when visible. CRITICAL RULES: (1) If the unit is in TfW red livery, has a modern squared CAF nose, and has NO pantograph on the roof, it is Class 197, NOT Class 158. (2) The Class 158 is a BR-era Sprinter-family DMU built by BREL 1989–1992 — it has a completely different flat-fronted older-style cab, shorter bodyshell, and a distinctly 1980s/90s BR design aesthetic. While TfW still operates some Class 158s in their red livery, the body shape is unmistakably older and squarer. (3) Do NOT return Class 158 for any CAF Civity-bodied unit — the cab profiles are visually distinct. (4) The Class 197 entered service 2022+ and may be underrepresented in training data — rely on the modern CAF nose profile and absence of pantograph to identify it.
- Class 802 vs Class 805/807 (Avanti West Coast Hitachi AT300) disambiguation: The Class 805 and Class 807 are Hitachi AT300 trains operated by Avanti West Coast on the West Coast Main Line — they share the same basic Hitachi AT300 platform as the Class 800/802 (GWR/IEP) but are DIFFERENT classes with a DIFFERENT operator and livery. CRITICAL DISTINGUISHING RULE: LIVERY is the primary identifier. **Class 802**: operated by GWR (green with gold stripe) or formerly Hull Trains/TransPennine — never in Avanti livery. **Class 805**: 5-car bi-mode (electric + diesel) operated by Avanti West Coast — distinctive blue Avanti livery with white, yellow, and red bodyside stripe pattern, "Avanti West Coast" branding clearly visible. **Class 807**: 9-car ELECTRIC-ONLY operated by Avanti West Coast — same blue Avanti livery but longer 9-car formation and a single pantograph configuration; no diesel capability. CRITICAL RULES: (1) If the Hitachi streamlined train is in Avanti West Coast blue livery with "Avanti" branding, it is Class 805 (5-car bi-mode) or Class 807 (9-car electric) — NEVER Class 802. (2) Use formation length to distinguish 805 from 807: 5 cars = Class 805 bi-mode, 9 cars = Class 807 electric. (3) If the train is in GWR green/gold livery, it is Class 800 or Class 802, not 805/807. (4) The cab profiles of 802/805/807 are nearly identical — livery and fleet number are the reliable identifiers.
- Class 810 Aurora vs Class 800/801/802 (IEP) disambiguation: The Class 810 "Aurora" is a brand new Hitachi bi-mode train built for East Midlands Railway, entering service December 2025. It is based on the Hitachi AT300 platform but with significant redesigns — it must NOT be classified as a Class 800, 801, or 802. Key visual identifiers: **distinctive purple EMR livery** with "Aurora" branding on the bodyside (not GWR green, not TPE livery), **reprofiled shorter nose cone** compared to Class 800/802 (the front end is noticeably more compact), **revised LED headlight cluster** (different arrangement from Class 800/802), 5-car formation with fleet numbers "810 001" to "810 033" visible on the cab front, single pantograph on the roof (bi-mode — runs on 25kV AC overhead or diesel). CRITICAL RULES: (1) If a Hitachi-style streamlined train is in purple EMR livery with "Aurora" on the side, it is Class 810 — not Class 800, 801, or 802. (2) The Class 810 entered service in December 2025 and is extremely new — AI training data on it will be sparse, so rely heavily on livery colour, "Aurora" branding, and fleet number format "810 xxx". (3) Do not confuse with the Class 360 EMR (a Siemens Desiro — completely different, shorter, suburban EMU with a boxy Siemens cab face). (4) "Evero" is NOT the name of this train — the correct name is "Aurora". (5) The Class 810 type is "Bi-mode" — NEVER classify it as "HST". HST refers specifically to the BR InterCity 125 High Speed Train (Class 43 power cars + Mark 3 coaches). The Class 810 is a bi-mode multiple unit despite also operating at 125 mph.
- London Underground CO/CP Stock vs 1938 Tube Stock disambiguation: Both are preserved vintage London Underground rolling stock, but from different gauges. **CO Stock (1937) and CP Stock (1939)**: pre-war sub-surface stock that ran on the Circle and Hammersmith & City lines — sub-surface gauge (wider body), with a distinctly different pre-war cab end design. **1938 Tube Stock**: ran on deep-tube lines (Northern and Bakerloo lines), tube gauge (narrower body), dark red/maroon livery, rounded cab ends typical of the 1938 design. CRITICAL RULE: If the preserved vintage LU stock appears wider (sub-surface gauge proportions) and is associated with the Circle or Hammersmith & City lines, return CO Stock or CP Stock as appropriate. If the stock is narrower (tube gauge), in dark red with rounded 1938-style cab ends, return 1938 Tube Stock. Both types are now preserved and may be seen at heritage railway events or LU depot open days.
- BR Standard steam locomotive family disambiguation — fleet numbers are definitive: The BR Standard classes are a family of steam locomotives designed by Robert Riddles for British Railways in the 1950s. Fleet numbers uniquely identify the class and must be used when visible. **Class 7MT "Britannia" (4-6-2 Pacific)**: fleet numbers 70000–70054. **Class 6MT "Clan" (4-6-2 Pacific)**: fleet numbers 72000–72009. **Class 5MT (4-6-0)**: fleet numbers 73000–73171. **Class 4MT tender (4-6-0)**: fleet numbers 75000–75079. **Class 4MT tender (2-6-4T tank)**: fleet numbers 80000–80154. **Class 4MT Mogul (2-6-0)**: fleet numbers 76000–76114. **Class 3MT (2-6-2T tank)**: fleet numbers 82000–82044. **Class 2MT tender (2-6-0)**: fleet numbers 78000–78064. **Class 2MT tank (2-6-2T)**: fleet numbers 84000–84029. CRITICAL RULES: (1) Fleet numbers 73xxx = Class 5MT (4-6-0) — NEVER Class 4MT. Fleet numbers 75xxx = Class 4MT tender (4-6-0). These two classes share a similar 4-6-0 wheel arrangement and are the most commonly confused — the fleet number is the definitive discriminator. (2) If a fleet number beginning with "73" is visible, the class is BR Standard Class 5MT, regardless of any other visual similarity to the 4MT. (3) Class 5MT was built in larger numbers (172 units vs 80 for the 4MT) and is statistically more common on heritage railways. (4) Both the 5MT and 4MT are typically in BR Black (mixed traffic) or occasionally BR Green livery on heritage railways. Livery alone cannot distinguish them — always use fleet number range.
- LMS Stanier steam locomotive family disambiguation — fleet numbers are definitive: The LMS Stanier family covers several distinct Pacific and mixed-traffic classes that must NOT be confused with one another. Fleet number ranges are non-overlapping and definitive when visible. **LMS Stanier Class 5MT "Black Five" (4-6-0)**: BR fleet numbers 44658–45499. The most numerous LMS steam class (842 built), a mixed-traffic 4-6-0 tender loco. Typically in BR Black livery on heritage railways. Key visual: 4-6-0 wheel arrangement (four leading wheels, six driving wheels, no trailing wheels under the firebox). **LMS Princess Royal Class (4-6-2 Pacific)**: BR fleet numbers 46200–46212 — only 13 built, very rare. Larger than the Black Five, 4-6-2 wheel arrangement with a long rear trailing bogie. **LMS Princess Coronation Class (4-6-2 Pacific)**: BR fleet numbers 46220–46257 — 38 built, the most powerful LMS express passenger locos. Named examples include 46233 "Duchess of Sutherland", 46229 "Duchess of Hamilton". 4-6-2 wheel arrangement, large streamlined or de-streamlined express passenger profile. CRITICAL RULES: (1) If any fleet number in the 44658–45499 range is visible (e.g. 44932, 45407, 45231), the locomotive is "LMS Class 5MT" (Black Five) — NEVER Princess Royal or Princess Coronation. (2) If any fleet number in the 46220–46257 range is visible, the locomotive is Princess Coronation Class — and if the nameplate is visible, use it (e.g. "Duchess of Sutherland" for 46233). (3) The Black Five and Princess Coronation are frequently both photographed at heritage railway events and may appear in the same photo — the wheel arrangement and fleet number are the definitive discriminators. A 4-6-0 (no rear trailing wheels) cannot be a Princess Coronation (which is always 4-6-2). (4) NEVER classify a loco with a visible 45xxx fleet number as "Princess Coronation" or "Duchess" — these number ranges are completely separate. (5) If no fleet number is visible, use wheel arrangement: 4-6-0 = Black Five candidate; 4-6-2 with large express Pacific proportions = Princess Royal or Coronation candidate.
- Newag Elf family (36WE / 38WE / 45WE / 48WE) Polish EMU disambiguation: The Newag Elf is a family of modern low-floor electric multiple units built by Newag (Nowy Sącz, Poland) for Polish regional operators. The Elf 1 covers the 36WE and 38WE variants; the **Elf 2 (48WE)** is the second-generation variant built from approximately 2016 onwards with a more angular, sharper cab nose than the original Elf 1. Key visual identifiers: PANTOGRAPHS on the roof (electric EMU); a modern low-floor body with large windows; relatively angular cab front with a characteristic Newag design — the nose has a clean, slightly wedge-shaped profile distinct from German and Austrian EMUs; typical Polish regional operator liveries (e.g. Koleje Mazowieckie red/white, Koleje Dolnośląskie blue/white, Łódzka Kolej Aglomeracyjna purple/white, or operator-specific schemes); POLISH STATION CONTEXT — if the train is at a Polish platform with Polish signage, it is almost certainly a Polish-built unit. Technical specs for 48WE Elf 2: max speed 160 km/h, power approx. 2,400 kW. CRITICAL RULES: (1) If a modern low-floor Polish EMU with pantographs is photographed at a Polish station, it is almost certainly from the Newag Elf family or the Pesa Elf/FLIRT family — it is NEVER an ÖBB Austrian train. ÖBB operates in Austria and does not operate regional EMUs in Poland. (2) Do NOT classify a Newag Elf as "Class 814" or any ÖBB class designation — those are Austrian classifications. (3) The Newag Elf 2 (48WE) has a more angular nose than the Elf 1 — if the cab appears sharper and more wedge-shaped and the context is Polish regional rail, classify as 48WE. (4) If the exact Elf variant cannot be determined from the image, classify as "Newag Elf" with operator as the visible Polish regional operator.
- VR Finland fleet disambiguation — Sm3 (Pendolino) vs Dv12 and other Finnish rolling stock: Finnish state railway VR operates a distinctive fleet. The most visually striking unit is the **VR Sm3 (Pendolino)**: a TILTING high-speed EMU built by Fiat Ferroviaria (later Alstom) from 1995, based on the ETR 460 platform. Key visual identifiers: white body with red and blue horizontal stripes running along the entire train length; PANTOGRAPH(S) visible on the roof (ELECTRIC — not diesel); distinctive AERODYNAMIC TILTING NOSE that tapers to a sharp point with an elongated streamlined profile; 6-car articulated formation; bogie fairings are present to accommodate the tilt mechanism; operated on Helsinki–Turku, Helsinki–Tampere, and Helsinki–Joensuu routes at up to 220 km/h. The Sm3 is frequently nicknamed "Pendolino" and is instantly recognisable by its sleek white/red/blue livery and pointed nose. The **VR Dv12**: a diesel-electric LOCOMOTIVE (Bo'Bo') built by Valmet/ABB from 1963 to 1984 — 262 units originally produced, now a declining fleet as newer locos (Dr19) replace them. The Dv12 has a classic long-hood diesel locomotive body with a boxy cab, NO pantograph (diesel only), and an older industrial appearance. Used for light freight, shunting, and some regional services. Entirely different from the Sm3 in every visual respect — diesel vs electric, loco vs EMU, old boxy industrial vs modern aerodynamic. The **VR Sm5 (Flirt)**: a Stadler FLIRT EMU operated by VR for commuter and regional services — covered by the FLIRT disambiguation rule elsewhere. The **VR Sr3**: a Siemens Vectron electric LOCOMOTIVE (single traction unit that hauls separate coaches — it is NOT an EMU). CRITICAL RULES: (1) If a train in Finland has a white/red/blue livery, a pointed aerodynamic nose, pantographs, and an articulated 6-car formation, it is ALMOST CERTAINLY the VR Sm3 (Pendolino) — do NOT classify it as Dv12 (diesel locomotive, entirely different) or any German DMU. (2) Dv12 is a diesel locomotive — it has NO pantograph, has a long-hood boxy body, and looks nothing like the Sm3. If pantographs are visible or the train is clearly an articulated EMU, it cannot be Dv12. (3) The Sm3 and Dv12 are visually completely different — one is a modern tilting intercity EMU, the other is a 1960s-era diesel loco. Never confuse these two classes.
- VR Finland Sr class disambiguation — Sr1 vs Sr2 vs Sr3: All three are VR electric LOCOMOTIVES (they haul separate coaches — they are NOT EMUs). They share green VR livery but are visually distinct. DO NOT default to Sr2 when uncertain — identify using the specific rules below. **VR Sr1**: Built by Strömberg/ABB in Finland, 1973–1995, 110 units. The Sr1 is a Co'Co' locomotive — it has SIX axles across TWO 3-axle bogies, making it noticeably LONGER than the Sr2. Body style is older, more angular and industrial in appearance — Soviet-influenced design from the 1970s. The cab has a boxy, upright profile with a flat front face and a relatively small windscreen. Green livery (VR dark green, later modernised to a lighter green/grey scheme on refurbished examples). Often seen hauling long-distance passenger trains and heavy freight. Key identifier: COUNT THE AXLES/BOGIES — if the locomotive has two 3-axle bogies (Co'Co'), it is Sr1. **VR Sr2**: Built by ABB/Adtranz, 1995–2003, 46 units. The Sr2 is a Bo'Bo' locomotive — FOUR axles across TWO 2-axle bogies, making it SHORTER than the Sr1. More modern styling than the Sr1 — smoother body panels, a more contemporary cab design with a larger windscreen and a slightly more rounded nose profile. Still green VR livery. Key identifier: Bo'Bo' (4 axles, two bogies) AND a late-1990s ABB design aesthetic — more rounded and modern than Sr1 but entirely different from the angular Vectron cab of Sr3. **VR Sr3**: Siemens Vectron AC, ordered from 2017, 80 units. The Sr3 is UNMISTAKABLY a Vectron — it has the highly distinctive Siemens Vectron cab design: a large, wide, steeply raked windscreen that wraps around the front face; a modern angular nose with a prominent "chin" below the windscreen; clean smooth body panels with a clearly contemporary industrial design. VR green livery but with a distinctly modern Vectron appearance. Key identifier: If the cab has the Vectron's characteristic large wrap-around windscreen and angular modernist design, it is Sr3. CRITICAL RULES: (1) NEVER default to Sr2 as a catch-all for Finnish electric locomotives — distinguish using axle count and cab design. (2) If six axles / Co'Co' bogies are visible, it is Sr1, not Sr2. (3) If the cab clearly has Siemens Vectron styling (large wrap-around windscreen, angular modern nose), it is Sr3, not Sr2. (4) Sr2 is the mid-generation: Bo'Bo', ABB/Adtranz design, more modern than Sr1 but older-looking than the Vectron Sr3. (5) The example "VR Sr2" in the class format guidance is just a formatting example — it does not mean Sr2 is the default VR electric class.
- Class 14 ("Teddy Bear") vs Class 08/09 shunter vs Class 31 disambiguation: The Class 14 is a short 0-6-0 diesel-HYDRAULIC locomotive built at Swindon Works in 1964–1965 for trip freight and light shunting — nicknamed "Teddy Bear". Only 56 were built (D9500–D9555) and they had one of the shortest BR service lives of any class, withdrawn 1968–1969. The vast majority of survivors are now preserved on UK heritage railways. FLEET NUMBER RULE — DEFINITIVE: If ANY fleet number in the D9500–D9555 range is visible (e.g. D9529, D9513, D9539), the locomotive is Class 14, full stop. Do NOT return Class 09 or Class 31 when a D9500-series number is visible. CRITICAL SIZE AND TYPE RULES: (1) Class 14 vs Class 31 — these are COMPLETELY DIFFERENT size categories. The Class 31 is a large A1A-A1A mainline diesel-electric locomotive approximately 56 feet long, with TWO 3-axle bogies, built for 80 mph mainline work at 1,470 hp. The Class 14 is a SHORT 0-6-0 with three directly COUPLED AXLES and NO bogies — roughly half the length of a Class 31, with a compact body designed for low-speed shunting and trip freight at 40 mph maximum and 650 hp. If the locomotive is SHORT and COMPACT with a bonnet/hood body style and three coupled axles rather than bogies, it CANNOT be a Class 31. NEVER classify a compact short-bonnet 0-6-0 shunter-sized locomotive as Class 31. (2) Class 14 vs Class 08/09 — the Class 08 and Class 09 are also 0-6-0 diesel shunters but are diesel-ELECTRIC (English Electric, 350/400 hp), noticeably shorter and squatter than the Class 14, and have been kept in service much longer (Class 08 still active today). Fleet number rule: Class 08/09 fleet numbers are D3xxx/D4xxx (pre-TOPS) or 08xxx/09xxx (post-TOPS) — NEVER D9xxx. If the fleet number begins with D9 in the 9500–9555 range, it is Class 14, not Class 08 or 09. The Class 14 has a slightly more prominent, longer bonnet/hood than a Class 08/09 and a more angular cab profile. (3) Heritage railway context: A short compact 0-6-0 diesel-hydraulic loco at a UK heritage railway with a D9xxx number is almost certainly Class 14 — the entire surviving fleet is preserved.

`;

function parseTrainResponse(text: string): TrainIdentification | null {
  try {
    const cleaned = text.replace(/\`\`\`json\n?/g, "").replace(/\`\`\`\n?/g, "").trim();
    console.log("[VISION] AI response:", cleaned.substring(0, 200));

    // Try direct JSON parse first (normal case)
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Direct parse failed — Claude may have added explanatory text around the JSON.
      // This happens when the prompt's disambiguation rules cause Claude to "think out loud"
      // before or after the JSON object (e.g. after the ICE pre-flight check).
      // Extract the first {...} block from the response as a fallback.
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error("[VISION] No JSON found in response:", cleaned.substring(0, 300));
        return null;
      }
      console.log("[VISION] Extracted JSON from surrounding text");
      parsed = JSON.parse(jsonMatch[0]);
    }

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
    console.error("[VISION] Failed to parse response:", text.substring(0, 300));
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

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      temperature: 0,
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
  } catch (error: any) {
    const status = error.status ?? error.response?.status;
    console.error(`[VISION] Anthropic API error (${status}):`, error.message);

    if (status === 429) {
      throw new AppError(
        "LocoSnap is experiencing high demand. Please try again in a moment.",
        429
      );
    }

    // Billing limit hit — silently fall back to OpenAI if available
    if (status === 402 && config.hasOpenAI) {
      console.warn("[VISION] Anthropic billing limit reached — falling back to OpenAI");
      return identifyWithOpenAI(imageBuffer, mimeType);
    }

    throw error;
  }
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
        temperature: 0,
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
    if (status === 429) {
      throw new AppError(
        "LocoSnap is experiencing high demand. Please try again in a moment.",
        429
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
