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

Rules:
- "class" should be the official class designation. UK: use TOPS class numbers (e.g. "Class 56", "Class 89", "Class 37"). Pre-TOPS: use named classes (e.g. "A4 Pacific", "Britannia"). European: use local designation (e.g. "BR 101", "SNCF Class BB 22200", "DB Class 612"). Nordic: e.g. "NSB Di 4", "SJ Rc", "DSB IC3", "VR Sr2". Japanese: e.g. "N700 Series", "KiHa 40". North American: e.g. "EMD GP38-2", "GE ES44AC".
- "name" should be the individual locomotive name if it has one (e.g. "Flying Scotsman", "Mallard", "Tornado"). Use null if unnamed.
- "operator" should be the current or most recent operator. UK examples: "LNER", "GWR", "Avanti West Coast", "DB Cargo UK", "Colas Rail", "GB Railfreight", "DRS", "DCRail". European: "DB", "SNCF", "ÖBB", "Trenitalia". Nordic: "Vy" (Norway), "SJ" (Sweden), "VR" (Finland), "DSB" (Denmark). If preserved, use the heritage railway name.
- "type" should be one of: Steam, Diesel, Electric, DMU, EMU, HST, Freight, Shunter, Railcar, Tram, Metro, Monorail, Maglev, Other
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
- Class 33 vs Class 73 disambiguation: Both are BR-era Bo-Bo locos, often in BR Blue + yellow warning panel, both associated with the Southern Region — but they are different locos. Class 33 ("Crompton", built by BRCW 1960–62): ROUNDED prominent nose with a domed cab front, characteristic "smiling face" profile, prominent louvred grilles along the LOWER bodyside, pure diesel (no third-rail electrical equipment visible), large flat windscreens set into the rounded nose. Class 73 (English Electric, built 1962–67): FLATTER, more rectangular cab front, less pronounced dome, electro-diesel (may have third-rail collection shoes visible at low level on the bogies/bodyside), different louvre arrangement. When in doubt on a rounded-nose BR blue diesel on the Southern: lean toward Class 33 unless third-rail equipment is clearly visible.
- Stadler KISS (Class 445) vs Alstom LINT 27 disambiguation: These are COMPLETELY DIFFERENT vehicles — do NOT confuse them under any circumstances. They differ in size, deck count, traction type, and operational role.
  **LINT 27** (Alstom Coradia LINT 27): a SHORT, SINGLE-DECK, SINGLE-CAR diesel DMU (~27 m long), designed for low-traffic rural and branch-line services. Key visual identifiers: NO pantograph (diesel only), low-floor profile with a low overall height, small rounded cab nose with curved front windows, narrow bodyside with small windows, typically operated by DB Regio or German regional operators on secondary routes, max ~120 km/h. The LINT 27 is a compact, modest-looking single-car unit.
  **Class 445 KISS** (Stadler KISS): a TALL, DOUBLE-DECK EMU, typically 4–6 cars long, built for high-capacity regional and intercity routes. Key visual identifiers: PANTOGRAPH(S) on the roof (electric), very tall and wide bodyside with TWO ROWS of large panoramic windows stacked vertically (double-deck), imposing height that dwarfs single-deck units, modern streamlined cab nose, operated in Germany, Switzerland, Austria, and the UK on main lines. The KISS is a large, prominent double-deck train — completely unlike the compact LINT 27.
  **Class 445 Twindex** (Bombardier Twindexx / IC2): a DISTINCT and SEPARATE variant from the KISS — do NOT treat these as the same train. The Twindex is a double-deck push-pull train set hauled by a separate locomotive, with a distinctive flat-fronted low-profile control car (Steuerwagen) at the non-loco end. Unlike the KISS (self-propelled EMU), the Twindex control car has no pantograph and requires a separate loco.
  CRITICAL RULE: If a train is DOUBLE-DECK (two rows of windows stacked vertically), it is the KISS or Twindex — it is NEVER a LINT 27. If a train is SINGLE-DECK and has NO pantograph and appears short and compact, it could be a LINT 27. Never identify a tall double-deck electric train as a LINT 27. Never identify a short single-car diesel as a Class 445 KISS.
- S-Bahn Berlin Class 480 vs 485 disambiguation: Both classes share the identical distinctive yellow/ochre + dark red DB S-Bahn Berlin livery and the same cab style, making them visually very similar. Key differences: **BR 480** is the POWERED motor car (Triebwagen) — it has a pantograph/current collector visible on the roof and a max speed of 100 km/h. **BR 485** is the UNPOWERED trailer/Beiwagen (Steuerwagen) — it has NO pantograph on the roof (it draws power from the coupled 480 motor car) and a max speed of 90 km/h. They typically run in 480+485+485+480 formations. CRITICAL RULE: If a pantograph is clearly visible on the roof, lean toward BR 480. If the roof is clean with no pantograph, lean toward BR 485. If the pantograph visibility is ambiguous or the roof is not clearly visible, note both possibilities (e.g. "Class 480/485") and lower confidence accordingly. Do NOT default to 480 simply because the S-Bahn Berlin yellow/red livery is the dominant visual cue.
- ICE 3 family disambiguation (BR 403 / BR 406 / BR 407 / BR 408): All four classes share the same basic ICE white livery with red stripe and a broadly similar streamlined nose profile, making them easy to confuse. They MUST be distinguished carefully — do NOT use the generic label "ICE 3" or the generic designation "Class 403" when a more specific class can be determined. Use all available visual cues:
  **BR 403 (ICE 3, original series)**: Built 2000–2006, 13 units. Rounder, more bulbous nose profile with softer curves. Single-voltage (15kV 16.7Hz AC). Operates on German domestic routes only. Fleet numbers 403 001–013.
  **BR 406 (ICE 3M/F, multi-system international variant)**: Built 1999–2001, 17 units. Visually very similar nose to the BR 403 — the same rounded, softer profile. Multi-system capability (15kV 16.7Hz, 25kV 50Hz, 3kV DC, 1.5kV DC) for cross-border operation. CRITICAL ROUTE INDICATOR: If the train is photographed at or near Amsterdam, Utrecht, Arnhem, or anywhere on the Amsterdam–Utrecht–Oberhausen–Cologne–Frankfurt (Thalys/ICE International) corridor, it is ALMOST CERTAINLY a BR 406. The BR 403 does NOT operate into the Netherlands. Fleet numbers 406 001–017 (also NS series 4651–4667 on Dutch side). If fleet number starts with "406" or "4651–4667", classify as BR 406.
  **BR 407 (ICE 3neo Velaro D)**: Built 2013–2018, 17 units. Noticeably MORE ANGULAR nose compared to 403/406 — the nose is sharper with a more pronounced crease line running along the cab front, and the cab windscreen is larger and more rectangular. The transition from cab front to bodyside is crisper. Entered service from 2014. Fleet numbers 407 001–030.
  **BR 408 (ICE 3neo, latest generation)**: Built 2022 onwards, most modern variant. SHARPEST, most angular nose of all ICE 3 variants — a very clean, modern, almost flat-faced cab with large rectangular windows and a prominent LED headlight cluster. Noticeably different from the softer 403/406 nose. Fleet numbers 408 001 onwards.
  Nose profile summary — use this as the primary discriminator: 403/406 = rounder, softer, more classic ICE 3 look; 407 = more angular, sharper crease lines, larger windows; 408 = sharpest, most modern, flattest cab front.
  Additional cues: pantograph type and position may differ between variants; cab window shape is more rectangular on 407/408 vs slightly more rounded on 403/406; visible "BR 406" or "406 xxx" fleet numbers are definitive.
  Speed note: all ICE 3 variants have a theoretical maximum of 330 km/h but operational maximum of 300 km/h in regular DB service. Use 300 km/h as the operational max speed, not 330 km/h.
  CRITICAL RULES: (1) Never classify a BR 406 at Utrecht Centraal or Amsterdam as a BR 403 — the 403 does not operate there. (2) Never use the vague label "ICE 3" as the class designation if you can narrow it down — always specify BR 403, BR 406, BR 407, or BR 408. (3) If the nose appears rounded/classic AND the location is the Netherlands or the Amsterdam–Frankfurt corridor, classify as BR 406. (4) If the nose appears angular with sharper creases, classify as BR 407. (5) If truly unable to distinguish, note "BR 406/403" with lower confidence rather than defaulting to BR 407 or a generic label.
- S-Bahn Berlin BR 480 vs BR 481 disambiguation: Both classes belong to the same S-Bahn Berlin family and share the same yellow/red DB S-Bahn livery. Key visual differences: **BR 480** is the older variant with a rounder, more bulbous front end and a SINGLE-PIECE windscreen — the cab front has softer, more rounded curves. **BR 481** has a flatter, more angular cab front with a SPLIT windscreen (two separate panes), giving it a crisper, more modern appearance. The BR 481 was built in far greater numbers than the BR 480 and is by far the more commonly seen variant on the Berlin S-Bahn network. CRITICAL RULE: If the cab is angular with a split windscreen, classify as BR 481. If the cab is rounder with a single-piece windscreen, classify as BR 480. If the windscreen arrangement is ambiguous from the angle shown, default to BR 481 as the statistically dominant class.
- BR 445 Twindexx vs Bombardier Talent 2 disambiguation: These are completely different vehicle types and must NEVER be confused. **BR 445 Twindexx** (Stadler Twindexx / IC2): a DOUBLE-DECK push-pull train set — always two visible stacked rows of windows, flat-fronted control car (Steuerwagen) with a large windscreen, requires a separate locomotive at one end, used on DB intercity routes. It is always double-deck — there are no single-deck Twindexx sets. **Bombardier Talent 2**: a SINGLE-DECK EMU with a distinctive smoothly CURVED nose, large wraparound windscreen, and a three-section articulated body. Never double-deck. CRITICAL RULE: If you can see two rows of windows stacked vertically (double-deck), it is the Twindexx. If the train has a curved nose and is single-deck, it is the Talent 2. Under no circumstances should a double-deck train be classified as a Talent 2, or a single-deck curved-nose EMU classified as a Twindexx.
- CD 380 (Škoda 109E) vs ČD Class 151 disambiguation: These are completely different Czech electric locomotive generations. **CD 380 / Škoda 109E**: a modern Škoda electric locomotive built 2009–2011, sleek angular bodyshell with a streamlined modern appearance, used on Czech high-speed and international services including Railjet workings for ÖBB, max speed 200 km/h. **ČD Class 151**: an older Bo'Bo' electric locomotive from the 1970s, distinctly boxy Soviet-era profile with a flat, angular body typical of Eastern Bloc industrial design, clearly pre-modern in appearance. CRITICAL RULE: If the locomotive on Czech Railways appears modern, angular, and streamlined, it is almost certainly CD 380 (Škoda 109E). If it has a boxy, clearly 1970s-era Eastern Bloc body shape, it is Class 151. Do not confuse these two — they represent entirely different eras of Czech rail traction.
- CD 654 (RegioPanter) vs Stadler FLIRT disambiguation: The CD 654 (ČD Class 654 / RegioPanter) is a Škoda-built Czech EMU/DMU for regional services, finished in green and white or yellow livery with a distinctive Škoda cab face — the nose has Škoda's characteristic design language, different from the forward-angled slanted windscreen of the Stadler FLIRT. The CD 654 is NOT a Stadler FLIRT and must never be classified as one. Additional operator cue: Leo Express operates Stadler FLIRTs in the Czech Republic — if the visible operator branding is Leo Express, it is a FLIRT. If the train is on ČD domestic regional service with a Škoda cab face, it is CD 654. CRITICAL RULE: Never return "Stadler FLIRT" for a train with a Škoda cab face, and never return "CD 654" for a train with Leo Express branding.
- ICE 4 (BR 412) vs ICE 3 family (BR 403/406/407/408) disambiguation: The ICE 4 and ICE 3 are completely different trains and must never be confused. **BR 412 (ICE 4)**: a much LONGER train (8, 12, or 13 cars) with DISTRIBUTED TRACTION (no dedicated power cars at the ends — every car contributes to traction), max speed 250 km/h (NOT 300 or 320 km/h), built from 2014 onwards by Siemens Mobility. The ICE 4 nose is DISTINCTLY DIFFERENT from the ICE 3 — it has a flatter, more upright cab front with a large rectangular windscreen, a more pronounced chin/undercut below the windscreen, and a less pointed profile overall. The ICE 4 body is also noticeably WIDER than the ICE 3. Both use the white with red stripe DB ICE livery. **ICE 3 family (BR 403/406/407/408)**: 8-car trains with a more pointed, streamlined nose, max speed 300 km/h (operational). CRITICAL RULES: (1) If the train is very long (12 or 13 cars visible), it is almost certainly a BR 412 ICE 4. (2) If the nose is flatter and more upright with a large windscreen and pronounced chin, classify as BR 412. (3) If the nose is more pointed and streamlined (classic ICE 3 profile), use the ICE 3 disambiguation rules above. (4) BR 412 fleet numbers start with "412" — if visible, this is definitive. (5) Never assign 300 or 320 km/h to a BR 412 — its operational max speed is 250 km/h.
- ICE T (BR 411 / BR 415) vs ICE 3 family disambiguation: The ICE T is a TILTING train (Neigezug) and must never be classified as an ICE 3. Key visual differences: **ICE T** has a noticeably ROUNDER and more BULBOUS nose compared to the sharper ICE 3 nose; the ICE T has visible TILT MECHANISM FAIRINGS on the bogies (streamlined covers over the bogie area to accommodate the tilting movement); the ICE T body is slightly narrower overall. BR 411 = 7-car ICE T; BR 415 = 5-car ICE T. ICE T operates on routes with significant curvature (Frankfurt–Dresden, Munich–Zurich corridor). **ICE 3** (BR 403/406/407/408) does NOT tilt — it has no tilt fairings and runs on higher-speed straighter routes. CRITICAL RULE: If the nose is round and bulbous and the bogies have tilt fairings, return "ICE T (BR 411)" or "ICE T (BR 415)" as appropriate — NEVER return "ICE 3" for a tilting ICE. Use car count to distinguish BR 411 (7-car) from BR 415 (5-car) where possible.
- ST 44 (PKP / M62 family) vs Class 159 (UK) disambiguation: These are completely different vehicles on different continents and must never be confused. **ST 44** is a Polish diesel locomotive, essentially a licence-built Soviet M62/TE3 heavy freight diesel — very distinctive Soviet-era styling with a long bonnet hood, twin cab windows, boxy long body, typically in red or green PKP Cargo livery, seen in Poland, Czech Republic, Hungary, and Slovakia. The entire M62 family (ST 44 in Poland, 781/T679 in Czech Republic, M62 in Hungary/Slovakia) shares this distinctive long-hood Soviet industrial aesthetic. **Class 159** is a British 3-car diesel multiple unit (DMU) operating in the South West of England, a completely different vehicle type — a passenger railcar set with no resemblance to a heavy freight locomotive. CRITICAL RULE: If the locomotive has a long bonnet hood with Soviet-era styling and is photographed in Central or Eastern Europe, it is an M62 family freight locomotive (ST 44 / 781 / T679 / M62 depending on country). It cannot be a Class 159.
- VT 650 (Regio-Shuttle RS1) vs VT 628 disambiguation: These are different generations of DB diesel railcar. **VT 650 (Stadler Regio-Shuttle RS1)**: a compact modern low-floor DMU, typically a short single-car or lightweight articulated unit, with a rounded modern cab design, low floor visible at door sills, and often found in various regional operator liveries (white/red/blue/green). Built from the mid-1990s onwards. **VT 628**: an older DB diesel railcar in a two-car set, higher floor, clearly 1980s boxy angular design with a flat cab front, distinctly pre-modern in appearance. CRITICAL RULE: If the DMU looks compact, modern, and low-floor with a rounded cab, it is almost certainly VT 650 / Regio-Shuttle RS1. If it has a boxy 1980s profile and two-car fixed formation, it is VT 628.
- EU07 vs EU07A disambiguation: These are related but distinct variants of the same Polish Bo'Bo' electric locomotive family and must be identified correctly. **EU07**: the original variant built 1963–1989 by Pafawag (Wroclaw), based on the British Class 83/84 design — classic boxy 1960s bodywork, original cab windows, original electrical equipment, older-style grilles and ventilation panels. Still in widespread use by PKP Intercity and PKP Cargo in Poland. **EU07A**: a modernised sub-variant of the EU07, rebuilt from the 1990s onwards — visually similar body but with updated cab equipment, modernised electronics, revised cab windows or interior fittings, and sometimes different horn/light arrangements. The EU07A retains the same basic bodyshell as the EU07 but has been significantly refurbished internally. CRITICAL RULES: (1) If the locomotive clearly shows modernised cab equipment, revised windows, or updated electronics visible externally, classify as EU07A. (2) If the locomotive retains the original 1960s cab appearance with no visible modernisation, classify as EU07. (3) When the variant cannot be determined from the image alone, classify as EU07 (the parent class) and note that it may be the EU07A sub-variant — do NOT omit the A suffix if modernisation features are clearly visible. (4) Both variants operate in Poland primarily on PKP Intercity and PKP Cargo services.
- EL2 / EU06 family vs E 94 disambiguation: Both are heavy electric locomotives but from different eras and different countries. **EL2 (EU06 / EP06 in Polish classification)**: a heavy Co'Co' electric locomotive built in the 1960s, seen in active freight service in Poland and the Czech Republic, with 1960s-era bodywork typical of the period. **E 94**: a German World War II-era electric locomotive (Kriegslokomotive, built 1940s), now almost exclusively preserved as a museum exhibit — very rarely seen in active service. CRITICAL RULE: If a heavy Co'Co' electric locomotive with 1960s-era bodywork is seen in active freight service in Poland or the Czech Republic, classify it as EL2 / EU06 family, NOT E 94. The E 94 is predominantly a museum piece and would only be seen at heritage events or in museum settings.
- BR 563 (Siemens Mireo) vs Alstom Coradia LINT 41 disambiguation: These are completely different traction types and must never be confused. **BR 563 (Siemens Mireo)**: an ELECTRIC multiple unit — it has PANTOGRAPHS on the roof, a modern Siemens design with a distinctive triangular/sharply angled nose profile, and smooth clean bodywork. The presence of pantographs is definitive — it draws power from overhead wires. **Alstom Coradia LINT 41**: a DIESEL DMU — NO pantograph anywhere on the roof, shorter body, Alstom cab design with a different, more rounded cab face. CRITICAL RULE: If there are pantographs on the roof, the train CANNOT be a LINT 41 — classify it as BR 563 (Mireo) or another electric unit. If there is no pantograph and the cab matches the Alstom LINT design, classify as LINT 41.
- BR 462 (ICE 3neo / Velaro MS) vs BR 642 (Siemens Desiro Classic) disambiguation: The number reversal (462 vs 642) is a known confusion point — these are completely different trains. **BR 462 (ICE 3neo / Siemens Velaro MS)**: the latest-generation ICE high-speed EMU, 320 km/h capable, white with red stripe in full ICE livery, long high-speed train formation, operates on DB main high-speed routes, large modern station stops (Frankfurt Hbf, Munich Hbf, etc.). **BR 642 (Siemens Desiro Classic)**: a small 2–3 car regional diesel DMU, max 120 km/h, used on secondary and branch-line routes, compact and modest appearance. CRITICAL RULE: A full-length white ICE train with the classic ICE nose at a major station is BR 462. A small DMU on a regional branch is BR 642. Context (station type, train length, livery, route) should resolve any remaining doubt. Never confuse these two classes.
- VT 646 Gen 1 (Bombardier Talent 1) vs DB Class 648 (LINT 48) disambiguation: **VT 646 Gen 1** is an older articulated DMU based on the Bombardier Talent 1 platform, with the distinctive boxy Talent 1 cab face and typically in DB Regio red livery. **DB Class 648 (Alstom Coradia LINT 48)**: a different DMU family entirely — longer body, completely different Alstom LINT cab design. CRITICAL RULE: If the DMU has a Bombardier Talent 1 cab face (boxy, with the characteristic flat Talent front end), classify it as VT 646. If the cab matches the Alstom LINT family design, classify as Class 648 / LINT 48.
- BR 646 Gen 2 (Talent 2 variant) vs Alstom Coradia LINT 41 disambiguation: **BR 646 Gen 2** is a Bombardier Talent 2 variant operated as DB VT 646 on specific routes — single-deck, with the Talent 2 curved-nose cab profile. It is operated by ODEG and other regional operators on certain routes. **Alstom Coradia LINT 41** has a completely different Alstom cab face. CRITICAL RULE: If the operator is ODEG and the cab has the Bombardier Talent 2 curved profile, classify as VT 646 / Talent 2, NOT LINT 41. The Talent 2 nose is smooth and curved; the LINT 41 nose is a different Alstom design.
- London Underground A Stock vs 1972 Tube Stock disambiguation: Both are now-withdrawn silver LU rolling stock but from different stock gauges. **A Stock (1961–2012, Metropolitan and Hammersmith & City lines)**: sub-surface gauge stock — noticeably WIDER body, silver/unpainted aluminium exterior with red doors, distinctive wide cab windows and a relatively flat roof profile. Ran on the sub-surface Metropolitan and Hammersmith & City lines. **1972 Tube Stock (Bakerloo and Northern lines)**: deep-tube gauge — NARROWER body than sub-surface stock, silver with red ends/cab fronts, different cab window arrangement. CRITICAL RULE: If the train body appears wider (sub-surface gauge proportions) and ran on the Metropolitan or Hammersmith & City lines, classify as A Stock. If the body is narrower (tube gauge proportions) and ran on the Bakerloo or Northern lines, classify as 1972 Tube Stock. Both are now withdrawn from normal passenger service.
- London Underground 1960 Tube Stock vs 1992 Tube Stock disambiguation: These are completely different generations of LU rolling stock. **1960 Tube Stock**: a small heritage fleet used on the Waterloo & City line, older rounded pre-modern body shape with pre-1980s styling — clearly vintage in appearance. **1992 Tube Stock (Central line and Waterloo & City line since 1993)**: a modern aluminium-bodied unit with flat ends, a distinctly modern cab front, AIR CONDITIONING DOMES on the roof (characteristic round/oval AC units visible on the roof), and deep windows. CRITICAL RULE: If the tube stock has a modern flat-ended aluminium body with roof-mounted AC domes and large windows, it is 1992 Tube Stock. If it has a clearly older, rounded vintage body shape with no roof AC domes, it may be 1960 Stock or older heritage stock.
- Class 810 Aurora vs Class 800/801/802 (IEP) disambiguation: The Class 810 "Aurora" is a brand new Hitachi bi-mode train built for East Midlands Railway, entering service December 2025. It is based on the Hitachi AT300 platform but with significant redesigns — it must NOT be classified as a Class 800, 801, or 802. Key visual identifiers: **distinctive purple EMR livery** with "Aurora" branding on the bodyside (not GWR green, not TPE livery), **reprofiled shorter nose cone** compared to Class 800/802 (the front end is noticeably more compact), **revised LED headlight cluster** (different arrangement from Class 800/802), 5-car formation with fleet numbers "810 001" to "810 033" visible on the cab front, single pantograph on the roof (bi-mode — runs on 25kV AC overhead or diesel). CRITICAL RULES: (1) If a Hitachi-style streamlined train is in purple EMR livery with "Aurora" on the side, it is Class 810 — not Class 800, 801, or 802. (2) The Class 810 entered service in December 2025 and is extremely new — AI training data on it will be sparse, so rely heavily on livery colour, "Aurora" branding, and fleet number format "810 xxx". (3) Do not confuse with the Class 360 EMR (a Siemens Desiro — completely different, shorter, suburban EMU with a boxy Siemens cab face). (4) "Evero" is NOT the name of this train — the correct name is "Aurora".
- London Underground CO/CP Stock vs 1938 Tube Stock disambiguation: Both are preserved vintage London Underground rolling stock, but from different gauges. **CO Stock (1937) and CP Stock (1939)**: pre-war sub-surface stock that ran on the Circle and Hammersmith & City lines — sub-surface gauge (wider body), with a distinctly different pre-war cab end design. **1938 Tube Stock**: ran on deep-tube lines (Northern and Bakerloo lines), tube gauge (narrower body), dark red/maroon livery, rounded cab ends typical of the 1938 design. CRITICAL RULE: If the preserved vintage LU stock appears wider (sub-surface gauge proportions) and is associated with the Circle or Hammersmith & City lines, return CO Stock or CP Stock as appropriate. If the stock is narrower (tube gauge), in dark red with rounded 1938-style cab ends, return 1938 Tube Stock. Both types are now preserved and may be seen at heritage railway events or LU depot open days.`;

function parseTrainResponse(text: string): TrainIdentification | null {
  try {
    const cleaned = text.replace(/\`\`\`json\n?/g, "").replace(/\`\`\`\n?/g, "").trim();
    console.log("[VISION] AI response:", cleaned.substring(0, 200));
    const parsed = JSON.parse(cleaned);

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
    console.error("Failed to parse vision response:", text);
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
