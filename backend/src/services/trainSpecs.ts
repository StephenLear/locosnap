// ============================================================
// LocoSnap — Train Specs Service
// Hybrid: Wikidata (factual) + AI (fill gaps + context)
//
// Both run in parallel. Wikidata wins for any field it provides
// (voltage, speed, length, etc.) — eliminating hallucinations on
// the fields trainspotters are most likely to check.
// AI covers fields Wikidata rarely has: gauge, route, status.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import axios from "axios";
import { config } from "../config/env";
import { TrainIdentification, TrainSpecs } from "../types";
import { getWikidataSpecs } from "./wikidataSpecs";

const GERMAN_INSTRUCTION = "Respond in German (Deutsch). Use formal register.\n\n";

const SPECS_PROMPT = (train: TrainIdentification, language: string = "en") =>
  `${language === "de" ? GERMAN_INSTRUCTION : ""}You are a railway engineering reference database with deep knowledge of UK, European, Scandinavian, Japanese, and North American rolling stock. Provide technical specifications for the ${train.class}${train.name ? ` "${train.name}"` : ""} (${train.operator}, ${train.type}).

Respond with ONLY valid JSON in this exact format (no markdown, no code fences):
{
  "maxSpeed": "125 mph",
  "power": "2,250 HP",
  "weight": "76 tonnes",
  "length": "22.1 m",
  "gauge": "Standard (1,435 mm)",
  "builder": "BREL Crewe Works",
  "numberBuilt": 197,
  "numberSurviving": 54,
  "status": "In service",
  "route": "East Coast Main Line",
  "fuelType": "Diesel"
}

Rules:
- Use null for any field you are genuinely unsure about — do not guess.
- "maxSpeed" MUST use km/h for any train operated by a European or non-UK/US operator — this includes DB, SNCF, ÖBB, Trenitalia, SBB, NS, Renfe, PKP, DSB, SJ, NSB, VR, and any German/French/Italian/Spanish/Swiss/Dutch/Nordic/Eastern European operator. Use mph ONLY for UK and North American operators.
- "maxSpeed" in mph for UK/US trains, km/h for European/Japanese/Nordic trains.
- "power" in HP for UK/US diesel/steam, kW for European electric and modern UK electric.
- "weight" in tonnes.
- "length" in metres (per vehicle/unit unless otherwise noted).
- "gauge" — most UK/European trains are "Standard (1,435 mm)". Note exceptions: Irish broad gauge "1,600 mm", Spanish broad gauge "1,668 mm", Finnish broad gauge "1,524 mm", UK narrow gauge heritage.
- "builder" should be the original manufacturer/works. UK examples: "BREL Crewe", "BREL Derby", "BREL Doncaster", "English Electric Vulcan Foundry", "Brush Traction Loughborough", "GEC Traction". European: "Siemens", "Bombardier", "Alstom", "Stadler", "CAF", "Škoda". Nordic: "Duewag", "Strømmens Værksted", "ABB Västerås".
- "numberBuilt" is total units/locomotives of this class built. For prototypes/one-offs, use 1.
- "numberSurviving" is approximate number still in existence (in service + preserved). Use null if uncertain.
- "status" should be one of: "In service", "Preserved", "Withdrawn", "Mixed" (if some in service, some preserved), "Prototype" (if experimental/one-off).
- "route" should be a notable route or network this class operates/operated on.
- "fuelType" — use the precise system:
  UK electric: "Electric (25kV AC OHL)" for ECML/WCML, "Electric (750V DC third rail)" for Southern/SW, "Electric (1.5kV DC OHL)" for Woodhead/older.
  European electric: "Electric (15kV 16.7Hz AC)" for Germany/Austria/Switzerland/Sweden/Norway, "Electric (25kV 50Hz AC)" for France/Belgium/UK HS1/Finland, "Electric (3kV DC)" for Italy/Poland/Belgium/Czech/Slovak, "Electric (1.5kV DC)" for Netherlands/France some, "Electric (600/750V DC)" for metros/trams.
  Nordic specific: Sweden/Norway use 15kV 16.7Hz; Finland uses 25kV 50Hz; Denmark uses 25kV 50Hz (IC3 is diesel).
  Other: "Diesel", "Coal", "Dual-voltage Electric", "Tri-voltage Electric", "Dual-fuel", "Battery", "Hydrogen".
- Be accurate — trainspotters will check these numbers.
- ICE 3 family — use these exact values, do not deviate:
  BR 403 (ICE 3, original): maxSpeed "300 km/h", power "8,000 kW", builder "Siemens/Bombardier", numberBuilt 13, fuelType "Electric (15kV 16.7Hz AC)"
  BR 406 (ICE 3M/3MF, multi-system): maxSpeed "300 km/h", power "8,000 kW", builder "Siemens/Bombardier", numberBuilt 17, fuelType "Electric (multi-system: 15kV 16.7Hz / 25kV 50Hz / 3kV DC / 1.5kV DC)"
  BR 407 (ICE 3neo / Velaro D): maxSpeed "320 km/h", power "8,000 kW", builder "Siemens", numberBuilt 17, fuelType "Electric (15kV 16.7Hz AC)"
  BR 408 (ICE 3neo, latest generation): maxSpeed "320 km/h", power "9,200 kW", builder "Siemens", fuelType "Electric (15kV 16.7Hz AC)"
  BR 462 (ICE 3neo / Velaro MS): maxSpeed "320 km/h", power "9,200 kW", builder "Siemens", fuelType "Electric (multi-system)"
  All ICE 3 variants are EMU type, Standard gauge (1,435 mm), operator DB.
- ICE 4 family (BR 412) — use these exact values, do not deviate:
  BR 412 (ICE 4, 8-car): maxSpeed "250 km/h", power "7,440 kW", builder "Siemens Mobility", fuelType "Electric (15kV 16.7Hz AC)"
  BR 412 (ICE 4, 12-car): maxSpeed "250 km/h", power "9,280 kW", builder "Siemens Mobility", fuelType "Electric (15kV 16.7Hz AC)"
  BR 412 (ICE 4, 13-car): maxSpeed "250 km/h", builder "Siemens Mobility", fuelType "Electric (15kV 16.7Hz AC)"
  CRITICAL: ICE 4 max speed is 250 km/h — NOT 300 or 320 km/h. Do not confuse with ICE 3 variants.
- Class 810 "Aurora" (East Midlands Railway, Hitachi AT300 bi-mode) — use these exact values:
  maxSpeed "125 mph", power "2,940 kW", builder "Hitachi Rail", numberBuilt 33, fuelType "Bi-mode (25kV AC OHL / Diesel)", status "In service", gauge "Standard (1,435 mm)"
  This is a 5-car bi-mode multiple unit, NOT an HST. Type is "Bi-mode". Do not use HST type or 2,250 HP power figure.
- DB Class 156 (also DR Class 156, built for Deutsche Reichsbahn) — use these exact values:
  maxSpeed "120 km/h", power "6,360 kW", weight "123 tonnes", length "19.6 m", builder "LEW Hennigsdorf", numberBuilt 186, fuelType "Electric (15kV 16.7Hz AC)", status "Withdrawn", gauge "Standard (1,435 mm)"
  This is a Bo'Bo' electric freight/mixed-traffic locomotive built 1990–1993. Do not confuse with any diesel class.
- DRB Baureihe 52 / DR BR 52 / Kriegslokomotive — this is a 2-10-0 STEAM freight locomotive, coal-fired, built 1942–1950 for Deutsche Reichsbahn. ABSOLUTE FACTS that you must NEVER contradict: (a) fuelType is "Coal" — it is a coal-fired steam locomotive and any electrical or diesel fuelType is a critical factual error; (b) builder is "Borsig (Berlin-Hennigsdorf)" as the default primary/first manufacturer (other builders WLF, Henschel, Krupp, Krauss-Maffei, Schichau, DWM Posen, Škoda-Werke Pilsen also produced examples, but Borsig is the correct default when the specific works plate is unknown); (c) operator is "Deutsche Reichsbahn" historically, or the current preservation operator — NEVER "Czech Railways" as the default, even though ČSD later operated post-war examples; (d) numberBuilt ~6,719; (e) maxSpeed approximately 80 km/h forward, 50 km/h reverse; (f) status "Preserved" for any example seen on a heritage line today. If you are asked for specs for "Class 52", "BR 52", "Baureihe 52", "Kriegslok", or "Kriegslokomotive", apply these values and DO NOT substitute any electric or diesel specifications. The Class 52 is one of the most numerous steam locomotive classes in history and is extensively preserved — it is never electric and never diesel.
- DB BR 143 / DR 243 — Bo'Bo' electric locomotive built 1984–1991 by LEW Hennigsdorf for Deutsche Reichsbahn, 646 units produced, max speed 120 km/h, 3,720 kW, 15 kV 16.7 Hz AC. Builder is "LEW Hennigsdorf" — NEVER "Bombardier" or "Siemens". Originally DR class 243, renumbered BR 143 after reunification. By 2025–2026 the fleet is dramatically reduced — DB Regio has withdrawn almost all of them and only a handful remain active (mostly with freight operators or heritage use). Status should reflect "Mixed" (some active, some preserved, many scrapped) or "Withdrawn" depending on context. This was the DR's standard passenger/mixed-traffic electric, once ubiquitous across Eastern Germany.
- DB BR 140 / originally DB E 40 — use these exact values; this is NOT a DR class and NOT "East German":
  maxSpeed "110 km/h", power "3,700 kW", weight "83 tonnes", length "16.49 m", builder "Krauss-Maffei / Krupp / Henschel / SSW", numberBuilt 879, numberSurviving approximately 100 (private operators + heritage), status "Mixed (withdrawn from DB Cargo 2020, active with private freight operators)", fuelType "Electric (15 kV 16.7 Hz AC)", gauge "Standard (1,435 mm)", route "German freight — formerly DB Cargo mainline, now PRESS, Lokomotion, Railsystems RP, RailAdventure, EBM Cargo and other private operators"
  Bo'Bo' electric mixed-traffic/freight locomotive of the DB Deutsche Bundesbahn (WEST GERMAN — NOT Deutsche Reichsbahn and NOT East German). Originally designated E 40, renumbered BR 140 in 1968. Built 1957–1973 — one of the largest series-production Bundesbahn electric locomotive classes ever (879 units). Operator was DB Bundesbahn / DB Cargo until the 2020 fleet retirement from DB Cargo service; a substantial fraction (~100) were sold on to private freight operators where they remain in daily service in 2026. Liveries included dark green (DB Bundesbahn original), ocean-blue/beige, red/pearl-grey, DB traffic red, and many private-operator repaints (PRESS lime-green, RailAdventure grey-yellow, etc.). CRITICAL FACTS the AI must never contradict: (a) numberBuilt is 879, NEVER 186 (186 is DB Class 156, a different loco); (b) operator origin is "DB Bundesbahn / DB Cargo" — West German, NEVER "Deutsche Reichsbahn" or "East German"; (c) the class is NOT "completely withdrawn" or "virtually extinct" — approximately 100 still operate with private freight operators in 2026; (d) build year range is 1957–1973, not "withdrawn since 1957". Distinguishing feature vs the similar BR 139/BR 110/BR 141: BR 140 is freight-optimised with 110 km/h max (not 150 km/h like BR 110), no electric train heating.
- ADtranz DE-AC33C "Blue Tiger" (DB Class 250) — Co-Co diesel-electric mainline freight locomotive built by ADtranz (with GE Transportation) 1996–2002, approximately 30 units. In Germany numbered 250 001–250 030 (private operators: ITL, Captrain, HGK, MRCE). The name "Blue Tiger" belongs exclusively to this locomotive — NOT to the Vossloh Euro 4000. Builder must be "ADtranz / GE Transportation", NOT "Vossloh España" or "Stadler Valencia" (those are the different and separate Euro 4000). Max speed 120 km/h, power ~2,500 kW, fuelType "Diesel".
- DR BR 120 / Soviet M62 "Taigatrommel" — Co-Co Soviet-built diesel locomotive by Voroshilovgrad Locomotive Works (Luhansk, Ukrainian SSR), 1966–1975, 378 delivered to Deutsche Reichsbahn as class V200 / BR 120 (then DB BR 220 after 1992). Max speed 100 km/h, power ~1,470 kW, fuelType "Diesel". This is a completely different locomotive from the modern DB BR 120 electric (1979, Krauss-Maffei/Henschel/Krupp, 250 km/h). When asked about "BR 120" in the context of the Taigatrommel / preserved red diesel with a central cab, return these diesel values, NOT the modern DB BR 120 electric specifications.
- Tatra KT4 / KT4D — articulated two-section high-floor tram built by ČKD Tatra Smíchov (Prague) 1974–1997, widely used in East Germany (BVG Berlin, Potsdam ViP, Cottbus, Erfurt, Gera, Frankfurt Oder, etc.) and other Eastern Bloc cities. Builder is "ČKD Tatra Smíchov (Prague)", max speed ~65 km/h, fuelType "Electric (600 V DC)", type "Tram". Many variants exist (KT4DM, KT4DC, KT4Dt) with modernised electrical gear but the same bodyshell. The KT4 is NOT a Siemens Combino — the Combino is a 3+ section smooth low-floor modern tram, completely different in every way.
- Berlin S-Bahn BR 483/484 — the NEWEST S-Bahn Berlin fleet, built by a Stadler/Siemens consortium from 2020 onwards. CRITICAL FACTS: builder is "Stadler / Siemens" (NOT "Crewe Works" — that is a Wikidata hallucination from an entirely wrong entity), entered service 2020–2021, fuelType "Electric (750 V DC third rail)" (Berlin S-Bahn standard — NOT 15kV 16.7Hz AC), max speed 100 km/h, approximately 106 half-trains ordered. The BR 483 is the powered car and BR 484 is the intermediate/trailer car — together they form the new S-Bahn Berlin fleet replacing the older BR 480 and BR 485 classes. These are modern trains with a contemporary angular cab design, NOT wartime-era stock.
- OBB 1116 / OBB 1016 "Taurus" (Siemens ES64U2) — Austrian Federal Railways high-performance Bo'Bo' electric locomotive, built by Siemens 1999–2006, ~382 units (1016 + 1116 series combined). Max speed 230 km/h, power 6,400 kW, fuelType "Electric (15 kV 16.7 Hz AC)". The Taurus is a DIFFERENT generation from the Siemens Vectron (BR 193) — the Taurus (Eurosprinter ES64U2 platform) predates the Vectron (ES64F4 platform) by a full design generation. The Taurus has a characteristic ROUNDED, smooth cab nose with a large curved windscreen, while the Vectron has a more angular, squared-off cab front. Do NOT confuse these two — they are different locomotives despite both being Siemens single-unit electrics.
- DRG Class E 77 — pre-war German electric locomotive built 1924–1926 by BMAG (Berliner Maschinenbau), Krauss, and LHW for the Deutsche Reichsbahn-Gesellschaft. 56 units built. Max speed 65 km/h, power 1,880 kW, fuelType "Electric (15 kV 16.7 Hz AC)". This is a 1920s GERMAN locomotive — NOT Czech, NOT built by Skoda. E 77 10 is preserved at the Dresden Transport Museum. Do NOT confuse with the CSD E 669.1 (a completely different 1960s Czech Skoda-built Co'Co' freight electric running on 3 kV DC).
- Fenniarail Dr18 — use these exact values; this is NOT a VR class:
  maxSpeed "90 km/h", power "1,550 kW", weight "120 tonnes", builder "CZ Loko", numberBuilt 6, numberSurviving 6, status "In service", fuelType "Diesel", gauge "Finnish broad gauge (1,524 mm)", route "Finnish private freight (Fenniarail)"
  Operator MUST be "Fenniarail" (or "Fenniarail Oy"), NEVER "VR". Type is "Diesel" (a single-unit Co'Co' hood-unit freight locomotive that hauls separate wagons — NOT an EMU/DMU). Fleet is Dr18 101–106, built 2015–2020, based on the CZ Loko 774.7 "EffiShunter 1600" platform. Do NOT attribute to Valmet, Lokomo, Strömberg, ABB, or Siemens.
- VR Dv12 — use these exact values, overriding any prior "orange/white" or "262 units" claim:
  maxSpeed "125 km/h", power "1,000 kW", weight "62.2 tonnes", length "14.4 m", builder "Valmet / Lokomo", numberBuilt 192, status "Mixed", fuelType "Diesel", gauge "Finnish broad gauge (1,524 mm)", route "VR branch lines, shunting, light freight across Finland"
  Bo'Bo' diesel-HYDRAULIC (Voith L 216 rs transmission, Tampella-SACM MGO V16 BSHR engine), built 1963–1984 under Nohab licence. Operator is "VR" (Finnish State Railways). Fleet numbers "Dv12 2xxx" in the ranges 2501–2568 / 2601–2664 / 2701–2760. CRITICAL LIVERY CORRECTION: the classic historic livery is **red with a light-grey band** (NOT "orange/white" — that is a factual error from prior notes). Later schemes are green-and-white (1990s) and modern white-with-green-stripe (current VR corporate). If a colour/livery field is populated, use one of these three, NEVER "orange/white". Pre-1976 designation was "Sv12"; sub-variant "Sr12" covers 60 heavier 2700-series units built 1965–1972.
- VR Sr1 — use these exact values; Co'Co' 1970s Soviet-Finnish electric:
  maxSpeed "160 km/h", power "3,100 kW", weight "84 tonnes", builder "Novocherkassk (NEVZ) / Strömberg", numberBuilt 110, status "Mixed", fuelType "Electric (25 kV 50 Hz AC)", gauge "Finnish broad gauge (1,524 mm)", route "VR passenger and mixed-traffic across Finland"
  Bo'Bo' is WRONG for Sr1 — wheel arrangement is **Co'Co' (six axles)**. Built 1973–1985 at Novocherkassk (NEVZ) in the Soviet Union with electrical equipment from Oy Strömberg Ab (Finland). Fleet numbers "3001"–"3110" range (approx). Operator is "VR" (Finnish State Railways). Classic historic livery is **red body with green lower band and a yellow stripe between them** — the iconic Finnish tricolor scheme. Refurbished examples are in the modern VR white/green scheme but still have the older angular 1970s cab. Do NOT attribute to Siemens, ABB/Adtranz, SLM, or Vectron — Sr1 predates the Vectron platform by 40+ years.
- VR Sr2 — use these exact values; Bo'Bo' Swiss-built Re 460 family:
  maxSpeed "210 km/h", power "6,100 kW", weight "84 tonnes", builder "SLM Winterthur / ABB", numberBuilt 46, status "In service", fuelType "Electric (25 kV 50 Hz AC)", gauge "Finnish broad gauge (1,524 mm)", route "VR intercity and long-distance across Finland"
  Bo'Bo' electric locomotive built 1995–2003 by SLM (Swiss Locomotive & Machine Works, Winterthur) and ABB — the Finnish member of the Re 460 "Lok 2000" family. Fleet numbers "Sr2 3201"–"Sr2 3246". Operator is "VR" (Finnish State Railways). Cab is the characteristic ROUNDED SWISS profile with a smooth curved nose, NOT the angular Siemens Vectron cab (Sr3) and NOT the boxy 1970s Sr1 cab. Modern VR livery: white body with thick green stripe along the lower half. Do NOT attribute to Siemens or Vectron — Sr2 is a different generation from Sr3 by a full design era.
- Siemens Desiro HC — use these exact values; this is a DOUBLE-DECK regional EMU, NOT a Mireo and NOT an ICE 3neo (BR 462):
  maxSpeed "160 km/h", power "approx 3,100 kW", weight "approx 230 tonnes (4-car set)", length "105 m (4-car set)", builder "Siemens Mobility Krefeld", fuelType "Electric (25 kV 50 Hz AC)", gauge "Standard (1,435 mm)", route "German regional intercity (RRX Rhein-Ruhr-Express, NRW) — RE 1, RE 4, RE 5, RE 6, RE 11; also Israel Railways and other German regional operators"
  Four-car push-pull EMU with TWO single-deck driving cars at the ends and TWO double-deck trailers in the middle — distinctive stepped roofline where the centre cars are visibly taller than the cab cars. Entered service 2018+. Main operator is **National Express / Abellio** on the NRW Rhein-Ruhr-Express (RRX) network. Livery: white body with black lower skirt and a bright **aqua/teal RRX stripe** along the middle-car bodyside. CRITICAL FACTS the AI must never contradict: (a) it is DOUBLE-DECK in the middle cars, NEVER all single-deck; (b) builder is "Siemens Mobility Krefeld", NEVER Bombardier / Alstom / Stadler; (c) class is "Siemens Desiro HC" or "Desiro HC", NEVER "Mireo" (Mireo is single-deck only, a different Siemens platform); (d) NOT an ICE 3neo — the BR 462 ICE 3neo is a single-deck high-speed Velaro MS, totally different. "HC" = High Capacity (referring to the bilevel middle section).
- LSWR Urie S15 Class (BR 30506) — use these exact values; this is NOT the Schools class and NOT built in 1914:
  maxSpeed "70 mph (113 km/h)", power "approx 1,700 ihp (1,268 kW)", weight "79.9 long tons (engine)", length "65 ft 0 in over buffers (engine + tender)", builder "Eastleigh Works (LSWR)", numberBuilt 20, status "Preserved / operational", fuelType "Coal (steam)", gauge "Standard (1,435 mm)", route "Heritage — Mid-Hants Railway (Watercress Line)"
  4-6-0 mixed-traffic / fast-freight steam locomotive designed by **Robert Urie** for the London & South Western Railway, built at Eastleigh Works 1920–1921 (first batch of 20 engines, LSWR/SR 496–515). 30506 was built **October 1920** as LSWR 506. Operator for preservation is "Urie Locomotive Society" (based at Mid-Hants Railway / Watercress Line). CRITICAL FACTS the AI must never contradict: (a) wheel arrangement is 4-6-0, NEVER 4-4-0; (b) built 1920, NEVER 1914; (c) designer is Robert Urie, NEVER Richard Maunsell; (d) class is "LSWR Urie S15" / "Urie S15", NEVER "Schools Class" / "V Class"; (e) it is NOT "Class 30506" — that is a BR running number, not a class name. The Schools (V) class is a completely different 4-4-0 express passenger design built 1930–1935 under Maunsell.
- VR Sm2 (Finnish commuter EMU — Valmet/Strömberg 1975–1981) — use these exact values; this is NOT a FLIRT and NOT Sm5:
  maxSpeed "120 km/h", power "900 kW", weight "97 tonnes (2-car set)", builder "Valmet / Strömberg", numberBuilt 50, status "In service (declining)", fuelType "Electric (25 kV 50 Hz AC)", gauge "Finnish broad gauge (1,524 mm)", route "Helsinki-region commuter services (HSL), VR regional"
  Two-car articulated commuter EMU, boxy 1970s cab with flat vertical windscreen. Fleet numbers "Sm2 6xxx". Operator is "HSL / VR" (HSL for Helsinki commuter, VR for other regional). NOT a Stadler FLIRT, NOT Sm5, NOT CAF-built.
- VR Sm4 (Finnish commuter EMU — CAF 1999–2005) — use these exact values; this is NOT a FLIRT and NOT Sm5:
  maxSpeed "160 km/h", power "1,500 kW", weight "107 tonnes (2-car set)", builder "CAF (Beasain, Spain) / Transtech Oy", numberBuilt 30, status "In service", fuelType "Electric (25 kV 50 Hz AC)", gauge "Finnish broad gauge (1,524 mm)", route "Helsinki-region regional (HSL), VR regional to Riihimäki/Lahti"
  Two-car commuter/regional EMU with a rounded single-curve cab nose and a large one-piece wraparound windscreen. Fleet numbers "Sm4 6301–6330". Operator is "HSL / VR". Builder is CAF in Spain under a technology-transfer agreement — NOT Valmet, NOT Stadler, NOT Fiat directly. NOT a Stadler FLIRT, NOT Sm5.
- VR Sm5 (Stadler FLIRT Finland, 2008+) — use these exact values; operator is HSL, NOT VR alone:
  maxSpeed "160 km/h", power "4,200 kW", weight "130 tonnes (4-car set)", builder "Stadler Rail (Bussnang)", numberBuilt 81, status "In service", fuelType "Electric (25 kV 50 Hz AC)", gauge "Finnish broad gauge (1,524 mm)", route "HSL commuter services across the Helsinki region"
  Four-car Stadler FLIRT variant for Finnish broad gauge, sharp angular FLIRT nose, HSL white/green livery. Fleet numbers "Sm5 64xx". Owned by **Pääkaupunkiseudun Junakalusto Oy** and operated under contract for HSL (Helsingin seudun liikenne). Operator field MUST be "HSL" or "HSL / VR", NEVER "VR" alone — VR only operates the trains on HSL's behalf. Only classify as Sm5 if the train has the unmistakable sharp angular Stadler FLIRT nose; a boxy 1970s cab is Sm2, a rounded single-curve nose is Sm4.
- DB BR 648 / Alstom Coradia LINT 41 — use these exact values; this is a modern workhorse DMU, NOT limited production:
  maxSpeed "120 km/h", power "630 kW (2× MTU 6R 183 TD13H diesel, ~315 kW each)", weight "68 tonnes service weight", length "41.8 m (articulated 2-car)", builder "Alstom Transport (formerly LHB Salzgitter)", numberBuilt 300, status "In active service (production ongoing)", fuelType "Diesel", gauge "Standard (1,435 mm)", route "German regional non-electrified lines under DB Regio, HLB, NAH.SH, erixx, vlexx, Vias, Nordwestbahn"
  Modern 2-car articulated diesel multiple unit built by Alstom from 1999 onwards (LHB Salzgitter originally, acquired by Alstom). The LINT family includes LINT 27 (BR 640, single car, 27 m), LINT 41 (BR 648, 2-car articulated, 41.8 m), LINT 54 (BR 622, 3-car), and LINT 81 (4-car). "LINT" = "Leichter Innovativer Nahverkehrs-Triebwagen" (light innovative local-transport railcar). CRITICAL FACTS the AI must never contradict: (a) numberBuilt across the whole 648 family is 300+ (NEVER 192 — that is the VR Dv12 Finnish diesel, a completely different locomotive on a different continent); (b) builder is "Alstom Transport" or "Alstom (formerly LHB Salzgitter)" — NEVER "Bombardier", NEVER "Siemens", NEVER "Stadler"; (c) status is "In active service" with production continuing — NEVER "withdrawn", "limited production", "specialized service", or "extremely rare"; (d) operator field can be DB Regio, HLB, NAH.SH, erixx, vlexx, Vias, or Nordwestbahn depending on livery — all are mainstream German regional operators; (e) fuelType is "Diesel" — NEVER electric (no pantograph, no electrified equipment). Distinguish from BR 642 (Siemens Desiro Classic DMU — similar role, different cab) and BR 643 (Bombardier Talent 1 DMU — different manufacturer).
- DB BR 232 / DR BR 132 "Ludmilla" — Soviet-built Co'Co' diesel-electric, NOT Siemens and NOT built by any German manufacturer. Use these exact values:
  maxSpeed "120 km/h", power "2,200 kW", weight "116 tonnes", length "20.82 m", builder "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt 709, status "Mixed (declining — DB Cargo phase-out 2023–2026)", fuelType "Diesel", gauge "Standard (1,435 mm)", route "DB Cargo heavy freight across Germany; also private freight operators"
  Heavy Co'Co' diesel-electric locomotive built at Voroshilovgrad Locomotive Works (now Luhansk, Ukraine) 1973–1982 for Deutsche Reichsbahn. Soviet design class TE109 / DR-designation V300 → DR BR 132 → DB BR 232 after reunification. Powered by a Kolomna 5D49 V16 diesel engine producing 2,200 kW (3,000 hp). Nicknamed "Ludmilla" by German railway enthusiasts, also known as "Russen-Diesel" or "Lugansk-Lok". CRITICAL FACTS the AI must never contradict: (a) builder is "Voroshilovgrad Locomotive Works (Luhansk)" — NEVER "Siemens", NEVER "Krauss-Maffei", NEVER "Henschel", NEVER "LEW Hennigsdorf", NEVER any German manufacturer; (b) numberBuilt is 709 (full BR 132 → BR 232 production run), NEVER 273 or any lower number; (c) weight is approximately 116 tonnes service weight, NEVER 80 tonnes (80t is wildly wrong — Ludmilla is one of the heaviest diesels in DB service); (d) fuelType is "Diesel" (diesel-electric transmission), NEVER electric; (e) operator lineage is DR → DB Cargo, with ongoing transfer to private freight operators as DB retires them 2023–2026. Phase-out is accelerated partly because Russia sanctions block spare parts. The wider Ludmilla family (DR BR 130, 131, 132, 142) totals 873 units from the same works but the BR 232 subclass specifically is the 709 BR 132 units renumbered post-reunification. Distinct from the Taigatrommel (DR BR 120 / DB BR 220) which is the smaller M62 with a central cab — Ludmilla is much larger with twin cabs at each end.
- DB BR 151 — West German Co'Co' six-axle heavy freight electric locomotive, 170 units built 1972–1978 by Krupp, Krauss-Maffei, and Henschel for Deutsche Bundesbahn. This is NOT the ČD Class 151 (a different Czech 6-unit Škoda-rebuilt passenger loco from 1996). Use these exact values:
  maxSpeed "120 km/h", power "6,000 kW", weight "118 tonnes", length "19.49 m", builder "Krupp / Krauss-Maffei / Henschel", numberBuilt 170, status "Mixed (declining — DB Cargo phase-out ongoing as BR 193 Vectron replaces it; private operators retain some units)", fuelType "Electric (15 kV 16.7 Hz AC)", gauge "Standard (1,435 mm)", route "German mainlines — DB Cargo heavy freight, plus private operators Lokomotion, BayernBahn, Hector Rail, Railpool"
  Six-axle heavy freight electric locomotive designed for Deutsche Bundesbahn to work the Gotthard route (later redeployed widely across flat German mainlines after the BR 120 electric took over passenger and BR 151 concentrated on heavy freight). Superseded by the Siemens BR 193 Vectron from the 2010s, with active withdrawal accelerating post-2020. Retired units have been picked up by private German and Austrian freight operators — Lokomotion, BayernBahn, Hector Rail (Sweden), Railpool. CRITICAL FACTS the AI must never contradict: (a) builder is "Krupp / Krauss-Maffei / Henschel" — NEVER "Škoda", NEVER "Škoda Transportation", NEVER any Czech manufacturer, NEVER Siemens; (b) numberBuilt is 170 — NEVER 20 (20 is the ČD Class 151 modernized Czech passenger fleet, a completely different locomotive); (c) max speed is 120 km/h (heavy freight) — NEVER 160 km/h (160 is the ČD Class 151 passenger speed); (d) weight is approximately 118 tonnes service weight (six-axle heavy freight) — NEVER 87 tonnes; (e) fuelType is "Electric (15 kV 16.7 Hz AC)" — NEVER "Electric (3 kV DC / 25 kV 50 Hz AC)" which is the Czech/cross-border dual-system; (f) operator lineage is Deutsche Bundesbahn → DB Cargo (phasing out) → private German/Austrian operators (Lokomotion, BayernBahn, Hector Rail, Railpool) — NEVER "České dráhy (ČD)", NEVER "ČD Cargo", NEVER "Czech Railways"; (g) route is German mainlines — NEVER "Czech mainlines"; (h) country of origin is West Germany — NEVER Czechoslovakia or Czech Republic. Distinct from the ČD Class 151 which is a 6-unit Škoda-rebuilt 1996 four-axle Bo'Bo' passenger electric for Prague–Vienna IC services.`;

const FALLBACK_SPECS: TrainSpecs = {
  maxSpeed: null,
  power: null,
  weight: null,
  length: null,
  gauge: null,
  builder: null,
  numberBuilt: null,
  numberSurviving: null,
  status: null,
  route: null,
  fuelType: null,
};

function parseSpecsResponse(text: string): TrainSpecs {
  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      maxSpeed: parsed.maxSpeed ?? null,
      power: parsed.power ?? null,
      // Guard against AI returning 0 instead of null — parse the numeric value
      weight: (() => {
        if (!parsed.weight) return null;
        const match = String(parsed.weight).match(/([\d.]+)/);
        if (!match) return null;
        return parseFloat(match[1]) > 0 ? parsed.weight : null;
      })(),
      length: parsed.length ?? null,
      gauge: parsed.gauge ?? null,
      builder: parsed.builder ?? null,
      numberBuilt: parsed.numberBuilt ?? null,
      numberSurviving: parsed.numberSurviving ?? null,
      status: parsed.status ?? null,
      route: parsed.route ?? null,
      fuelType: parsed.fuelType ?? null,
    };
  } catch {
    console.error("Failed to parse specs response:", text);
    return FALLBACK_SPECS;
  }
}

async function getAISpecs(train: TrainIdentification, language: string = "en"): Promise<TrainSpecs> {
  const prompt = SPECS_PROMPT(train, language);

  if (config.hasAnthropic) {
    console.log("[SPECS] Using Claude (Anthropic)");
    const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    const content = response.content[0];
    if (content.type !== "text") return FALLBACK_SPECS;
    return parseSpecsResponse(content.text);
  }

  if (config.hasOpenAI) {
    console.log("[SPECS] Using GPT-4o (OpenAI)");
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o",
        max_tokens: 1024,
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
    if (!text) return FALLBACK_SPECS;
    return parseSpecsResponse(text);
  }

  return FALLBACK_SPECS;
}

// Known Wikidata data quality corrections.
// Wikidata wins in the merge, but these fields are factually wrong for specific classes —
// apply after merge to ensure trainspotters see correct values.
type SpecsOverride = Partial<Pick<TrainSpecs, "maxSpeed" | "power" | "weight" | "builder" | "fuelType" | "numberBuilt">>;
const WIKIDATA_CORRECTIONS: Record<string, SpecsOverride> = {
  // BR 462 (ICE 3neo Velaro MS) — Wikidata matches a wrong entity and returns "Crewe Works"
  "br 462": { builder: "Siemens" },
  // DB Class 642 (Siemens Desiro Classic) — Wikidata returns wrong builder
  "db class 642": { builder: "Siemens" },
  "class 642": { builder: "Siemens" },
  // DB Class 114 (push-pull locomotive) — Wikidata maxSpeed stale/incorrect
  "db class 114": { maxSpeed: "160 km/h" },
  "class 114": { maxSpeed: "160 km/h" },
  "br 114": { maxSpeed: "160 km/h" },
  // BR 412 (ICE 4) — ensure correct max speed (250 km/h, not 300/320 km/h like ICE 3)
  // Multiple variants because vision may return different class string formats
  "br 412": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  "br412": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  "ice 4": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  "ice4": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  "412": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  "ice 4 (br 412)": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  "br 412 (ice 4)": { maxSpeed: "250 km/h", builder: "Siemens Mobility" },
  // Class 810 Aurora — correct power and unit count
  "class 810": { power: "2,940 kW", numberBuilt: 33 },
  "br 810": { power: "2,940 kW", numberBuilt: 33 },
  // British Rail Class 91 (InterCity 225) — BREL Crewe 1988-1991, 31 units.
  // Still in LNER service Dec 2025 (12 active). Withdrawal end of 2028 due to
  // ETCS signalling incompatibility on southern ECML. 91010 holds UK rail speed
  // record 161.7 mph (17 Sep 1989). Operational max 125 mph (140 mph capable).
  // 91131 preserved at Museum of Scottish Railways, Bo'ness & Kinneil.
  "class 91": { maxSpeed: "125 mph", power: "4,700 kW", builder: "BREL Crewe", numberBuilt: 31, fuelType: "Electric (25 kV AC overhead)" },
  "br 91": { maxSpeed: "125 mph", power: "4,700 kW", builder: "BREL Crewe", numberBuilt: 31, fuelType: "Electric (25 kV AC overhead)" },
  "br class 91": { maxSpeed: "125 mph", power: "4,700 kW", builder: "BREL Crewe", numberBuilt: 31, fuelType: "Electric (25 kV AC overhead)" },
  "intercity 225": { maxSpeed: "125 mph", power: "4,700 kW", builder: "BREL Crewe", numberBuilt: 31, fuelType: "Electric (25 kV AC overhead)" },
  "ic225": { maxSpeed: "125 mph", power: "4,700 kW", builder: "BREL Crewe", numberBuilt: 31, fuelType: "Electric (25 kV AC overhead)" },
  // British Rail Class 201 / 202 / 203 "Hastings Thumper" — BR Eastleigh 1957-1958.
  // Narrow-profile (8ft 6.5in) 6-car DEMU for the Hastings line. English Electric
  // 4SRKT diesels mounted underfloor — the "thump" sound. 21 built total (7 each
  // sub-class). Withdrawn 1986 when line electrified. Only 2 preserved:
  // 1001 (Class 201 6S, sole survivor) and 1013 (Class 202 6L) — Hastings Diesels Ltd.
  "class 201": { maxSpeed: "75 mph", builder: "BR Eastleigh Works", numberBuilt: 7, fuelType: "Diesel-Electric (English Electric 4SRKT)" },
  "class 202": { maxSpeed: "75 mph", builder: "BR Eastleigh Works", numberBuilt: 7, fuelType: "Diesel-Electric (English Electric 4SRKT)" },
  "class 203": { maxSpeed: "75 mph", builder: "BR Eastleigh Works", numberBuilt: 7, fuelType: "Diesel-Electric (English Electric 4SRKT)" },
  "hastings thumper": { maxSpeed: "75 mph", builder: "BR Eastleigh Works", fuelType: "Diesel-Electric (English Electric 4SRKT)" },
  "hastings demu": { maxSpeed: "75 mph", builder: "BR Eastleigh Works", fuelType: "Diesel-Electric (English Electric 4SRKT)" },
  "thumper": { maxSpeed: "75 mph", builder: "BR Eastleigh Works", fuelType: "Diesel-Electric (English Electric 4SRKT)" },
  // British Rail Class 88 — Stadler Rail Valencia (Vossloh España) 2015-2017,
  // 10 units (88001-88010), Direct Rail Services (DRS). Bi-mode electric/diesel,
  // Bo-Bo, 5,400 hp electric / 950 hp diesel, max 100 mph. Based on Siemens Vectron
  // platform with added Caterpillar C27 diesel engine. Named after gods/goddesses.
  "class 88": { maxSpeed: "100 mph", power: "4,000 kW (electric) / 708 kW (diesel)", builder: "Stadler Rail Valencia (Vossloh España)", numberBuilt: 10, fuelType: "Bi-mode (25 kV AC overhead + Caterpillar C27 diesel)" },
  "br 88": { maxSpeed: "100 mph", power: "4,000 kW (electric) / 708 kW (diesel)", builder: "Stadler Rail Valencia (Vossloh España)", numberBuilt: 10, fuelType: "Bi-mode (25 kV AC overhead + Caterpillar C27 diesel)" },
  "br class 88": { maxSpeed: "100 mph", power: "4,000 kW (electric) / 708 kW (diesel)", builder: "Stadler Rail Valencia (Vossloh España)", numberBuilt: 10, fuelType: "Bi-mode (25 kV AC overhead + Caterpillar C27 diesel)" },
  "88005": { maxSpeed: "100 mph", power: "4,000 kW (electric) / 708 kW (diesel)", builder: "Stadler Rail Valencia (Vossloh España)", numberBuilt: 10, fuelType: "Bi-mode (25 kV AC overhead + Caterpillar C27 diesel)" },
  "88005 minerva": { maxSpeed: "100 mph", power: "4,000 kW (electric) / 708 kW (diesel)", builder: "Stadler Rail Valencia (Vossloh España)", numberBuilt: 10, fuelType: "Bi-mode (25 kV AC overhead + Caterpillar C27 diesel)" },
  // BR Class 55 Deltic — Wikidata returns "Stadler Rail" (wrong — modern Swiss company)
  "class 55": { builder: "English Electric / Vulcan Foundry" },
  "class 55 deltic": { builder: "English Electric / Vulcan Foundry" },
  "br class 55": { builder: "English Electric / Vulcan Foundry" },
  // PKP SU46 — AI and/or Wikidata returns 160 km/h; correct vmax is 120 km/h
  "su46": { maxSpeed: "120 km/h" },
  "pkp su46": { maxSpeed: "120 km/h" },
  // PKP EP09 — AI and/or Wikidata returns 200 km/h; correct vmax is 160 km/h
  "ep09": { maxSpeed: "160 km/h" },
  "pkp ep09": { maxSpeed: "160 km/h" },
  // BR Class 14 "Teddy Bear" — AI returns "BRCW Smethwick"; all 56 built at Swindon Works
  "class 14": { builder: "Swindon Works" },
  "br class 14": { builder: "Swindon Works" },
  // ICE L (Talgo 230 / ECx) — built by Talgo (Spain), not Siemens. Max speed 230 km/h.
  "ice l": { builder: "Talgo", maxSpeed: "230 km/h" },
  "icel": { builder: "Talgo", maxSpeed: "230 km/h" },
  "ecx": { builder: "Talgo", maxSpeed: "230 km/h" },
  "talgo 230": { builder: "Talgo", maxSpeed: "230 km/h" },
  // DB BR 423 — Frankfurt/Munich/Stuttgart/Hamburg S-Bahn EMU. Built by LHB/Alstom/Bombardier
  // consortium in Salzgitter/Hennigsdorf/Bautzen, NOT Derby. Max speed 140 km/h.
  "br 423": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "140 km/h" },
  "423": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "140 km/h" },
  "class 423": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "140 km/h" },
  "baureihe 423": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "140 km/h" },
  // DB BR 425 / 426 — regional DB Regio EMU. Built by LHB/Alstom/Bombardier consortium in
  // Salzgitter/Hennigsdorf/Bautzen, NOT Derby Works. Max speed 160 km/h.
  "br 425": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  "425": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  "class 425": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  "baureihe 425": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  "br 426": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  "426": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  "class 426": { builder: "LHB / Alstom / Bombardier (Salzgitter)", maxSpeed: "160 km/h" },
  // DRB Baureihe 52 / Kriegslokomotive — 2-10-0 STEAM freight locomotive, coal-fired.
  // Built 1942-1950 by Borsig (first/lead manufacturer) and others. ~6,719 built.
  // CRITICAL: Must NEVER show as Electric/Diesel — it is a STEAM locomotive.
  // Discovered 2026-04-15 when specs layer returned fuelType "Electric (3 kV DC)"
  // and builder "Škoda Plzeň" for a preserved Class 52 — both wrong.
  "class 52": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "br 52": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "baureihe 52": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "drb 52": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "drb class 52": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "dr 52": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "kriegslokomotive": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  "kriegslok": { maxSpeed: "80 km/h", builder: "Borsig (Berlin-Hennigsdorf)", numberBuilt: 6719, fuelType: "Coal (Steam)" },
  // DB BR 143 (ex-DR BR 243) — LEW Hennigsdorf 1984-1991, 646 units built.
  // Main East German Bo'Bo' passenger/mixed-traffic electric. Being rapidly phased
  // out by DB Regio — only a handful still active in 2025-2026 (rest withdrawn or
  // transferred to freight operators). Builder was LEW, not "Bombardier" or "Siemens".
  "br 143": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "class 143": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "db class 143": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "baureihe 143": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "dr 243": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "dr class 243": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "br 243": { maxSpeed: "120 km/h", power: "3,720 kW", builder: "LEW Hennigsdorf", numberBuilt: 646, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  // ADtranz DE-AC33C "Blue Tiger" / DB Class 250 — Co-Co diesel-electric, ADtranz
  // + GE Transportation 1996-2002, ~30 built. THE real Blue Tiger — NOT the Vossloh
  // Euro 4000. In Germany numbered 250 001-250 030 (private operators: ITL, Captrain,
  // HGK, MRCE). Also Pakistan Railways and Malaysian Railways. Discovered 2026-04-15
  // when Captrain 250 007-2 was misidentified as Vossloh Euro 4000.
  "class 250": { maxSpeed: "120 km/h", power: "2,500 kW", builder: "ADtranz / GE Transportation", numberBuilt: 30, fuelType: "Diesel" },
  "br 250": { maxSpeed: "120 km/h", power: "2,500 kW", builder: "ADtranz / GE Transportation", numberBuilt: 30, fuelType: "Diesel" },
  "baureihe 250": { maxSpeed: "120 km/h", power: "2,500 kW", builder: "ADtranz / GE Transportation", numberBuilt: 30, fuelType: "Diesel" },
  "adtranz de-ac33c": { maxSpeed: "120 km/h", power: "2,500 kW", builder: "ADtranz / GE Transportation", numberBuilt: 30, fuelType: "Diesel" },
  "de-ac33c": { maxSpeed: "120 km/h", power: "2,500 kW", builder: "ADtranz / GE Transportation", numberBuilt: 30, fuelType: "Diesel" },
  "blue tiger": { maxSpeed: "120 km/h", power: "2,500 kW", builder: "ADtranz / GE Transportation", numberBuilt: 30, fuelType: "Diesel" },
  // DR BR 120 / M62 "Taigatrommel" — Soviet-built diesel freight loco by
  // Voroshilovgrad (Luhansk) 1966-1975, 378 delivered to DR. Renumbered
  // BR 220 after 1992, mostly withdrawn. DO NOT confuse with the DB BR 120
  // electric (1979) which is a totally different locomotive.
  "dr br 120": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 378, fuelType: "Diesel" },
  "dr 120": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 378, fuelType: "Diesel" },
  "dr class 120": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 378, fuelType: "Diesel" },
  "db br 220": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 378, fuelType: "Diesel" },
  "db 220": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 378, fuelType: "Diesel" },
  "taigatrommel": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 378, fuelType: "Diesel" },
  "m62": { maxSpeed: "100 km/h", power: "1,470 kW", builder: "Voroshilovgrad Locomotive Works (Luhansk)", fuelType: "Diesel" },
  // Tatra KT4 / KT4D — ČKD Tatra Smíchov articulated tram, 1974-1997. Two-section
  // high-floor tram. Widely used across East Germany (BVG Berlin, Potsdam ViP,
  // Cottbus, Erfurt, Gera, etc.). Many modernised to KT4DM/KT4Dt variants but same
  // bodyshell. Discovered 2026-04-15 when a Potsdam/Cottbus-style KT4D was
  // misidentified as a Siemens Combino.
  "tatra kt4d": { maxSpeed: "65 km/h", power: "4 × 40 kW", builder: "ČKD Tatra Smíchov (Prague)", fuelType: "Electric (600 V DC)" },
  "kt4d": { maxSpeed: "65 km/h", power: "4 × 40 kW", builder: "ČKD Tatra Smíchov (Prague)", fuelType: "Electric (600 V DC)" },
  "tatra kt4": { maxSpeed: "65 km/h", power: "4 × 40 kW", builder: "ČKD Tatra Smíchov (Prague)", fuelType: "Electric (600 V DC)" },
  "kt4dm": { maxSpeed: "65 km/h", power: "4 × 40 kW", builder: "ČKD Tatra Smíchov (Prague)", fuelType: "Electric (600 V DC)" },
  "kt4dc": { maxSpeed: "65 km/h", power: "4 × 40 kW", builder: "ČKD Tatra Smíchov (Prague)", fuelType: "Electric (600 V DC)" },
  "kt4dt": { maxSpeed: "65 km/h", power: "4 × 40 kW", builder: "ČKD Tatra Smíchov (Prague)", fuelType: "Electric (600 V DC)" },
  // DB BR 485 / ex-DR 270 — LEW Hennigsdorf 1987-1992, 166 half-sets for DR Berlin
  // S-Bahn. 750 V DC third-rail. Still in partial service 2025-2026 on S8/S85/S9/
  // S75/S47/S46 but being phased out. NOT an unpowered trailer of BR 480 — it is
  // a completely separate self-contained class. Discovered 2026-04-15 when a
  // BR 485 on S85 Pankow was misidentified as BR 481.
  "br 485": { maxSpeed: "100 km/h", builder: "LEW Hennigsdorf", numberBuilt: 166, fuelType: "Electric (750 V DC third rail)" },
  "class 485": { maxSpeed: "100 km/h", builder: "LEW Hennigsdorf", numberBuilt: 166, fuelType: "Electric (750 V DC third rail)" },
  "baureihe 485": { maxSpeed: "100 km/h", builder: "LEW Hennigsdorf", numberBuilt: 166, fuelType: "Electric (750 V DC third rail)" },
  "dr 270": { maxSpeed: "100 km/h", builder: "LEW Hennigsdorf", numberBuilt: 166, fuelType: "Electric (750 V DC third rail)" },
  "dr class 270": { maxSpeed: "100 km/h", builder: "LEW Hennigsdorf", numberBuilt: 166, fuelType: "Electric (750 V DC third rail)" },
  // British Rail Class 37 — English Electric, Vulcan Foundry (Newton-le-Willows) 1960–1965.
  // 309 built. Co-Co diesel-electric. Max speed 90 mph (some sub-classes 80 mph).
  // Wikidata returns "ALSTOM Transportation Germany" as builder — WRONG. English Electric
  // built them at Vulcan Foundry in Lancashire. Alstom inherited some maintenance contracts
  // decades later but did not build the class. Discovered 2026-04-16 when screen recording
  // for Class 37 video showed "ALSTOM Transportation Germany" on the specs card.
  "class 37": { maxSpeed: "90 mph", power: "1,750 HP", builder: "English Electric (Vulcan Foundry)", numberBuilt: 309, fuelType: "Diesel" },
  "br class 37": { maxSpeed: "90 mph", power: "1,750 HP", builder: "English Electric (Vulcan Foundry)", numberBuilt: 309, fuelType: "Diesel" },
  "br 37": { maxSpeed: "90 mph", power: "1,750 HP", builder: "English Electric (Vulcan Foundry)", numberBuilt: 309, fuelType: "Diesel" },
  "37": { maxSpeed: "90 mph", power: "1,750 HP", builder: "English Electric (Vulcan Foundry)", numberBuilt: 309, fuelType: "Diesel" },
  // Berlin S-Bahn BR 483/484 — the NEWEST S-Bahn Berlin fleet, built by Stadler/Siemens
  // consortium from 2020 onwards. 750 V DC third rail (Berlin S-Bahn standard).
  // CRITICAL: NOT built by "Crewe Works" and NOT from 1943 — those are hallucinated values
  // from a completely wrong Wikidata entity. Discovered 2026-04-16 when tester reported
  // specs card showing "Crewe Works", "1943", and "15kV 16.7Hz" — all wrong.
  "br 483": { maxSpeed: "100 km/h", power: "2,400 kW", builder: "Stadler / Siemens", numberBuilt: 106, fuelType: "Electric (750 V DC third rail)" },
  "class 483": { maxSpeed: "100 km/h", power: "2,400 kW", builder: "Stadler / Siemens", numberBuilt: 106, fuelType: "Electric (750 V DC third rail)" },
  "baureihe 483": { maxSpeed: "100 km/h", power: "2,400 kW", builder: "Stadler / Siemens", numberBuilt: 106, fuelType: "Electric (750 V DC third rail)" },
  "br 484": { maxSpeed: "100 km/h", power: "2,400 kW", builder: "Stadler / Siemens", numberBuilt: 106, fuelType: "Electric (750 V DC third rail)" },
  "class 484": { maxSpeed: "100 km/h", power: "2,400 kW", builder: "Stadler / Siemens", numberBuilt: 106, fuelType: "Electric (750 V DC third rail)" },
  "baureihe 484": { maxSpeed: "100 km/h", power: "2,400 kW", builder: "Stadler / Siemens", numberBuilt: 106, fuelType: "Electric (750 V DC third rail)" },
  // OBB 1116 Taurus (Siemens ES64U2) — Austrian Federal Railways (OBB) high-performance
  // electric locomotive. Bo'Bo', 230 km/h, 6,400 kW, 15kV 16.7Hz AC. Built by Siemens
  // 1999–2006, ~382 units (1016 + 1116 combined). NOT a Vectron — the Taurus predates
  // the Vectron by a full generation. Discovered 2026-04-16 when tester reported an
  // OBB 1116 being misidentified as BR 193 Vectron.
  "1116": { maxSpeed: "230 km/h", power: "6,400 kW", builder: "Siemens", numberBuilt: 382, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "obb 1116": { maxSpeed: "230 km/h", power: "6,400 kW", builder: "Siemens", numberBuilt: 382, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "obb 1016": { maxSpeed: "230 km/h", power: "6,400 kW", builder: "Siemens", numberBuilt: 382, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "taurus": { maxSpeed: "230 km/h", power: "6,400 kW", builder: "Siemens", numberBuilt: 382, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "es64u2": { maxSpeed: "230 km/h", power: "6,400 kW", builder: "Siemens", numberBuilt: 382, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  // DRG E 77 — pre-war German electric locomotive, built 1924–1926 by BMAG/Krauss/LHW.
  // 56 units built for Deutsche Reichsbahn-Gesellschaft. 15kV 16.7Hz AC, 65 km/h.
  // E 77 10 preserved at Dresden Transport Museum. NOT a Czech locomotive — NOT built
  // by Skoda, NOT 3kV DC. Discovered 2026-04-16 when a preserved E 77 was misidentified
  // as Skoda E 669.1 (which is a completely different 1960s Czech Co'Co' freight electric).
  "e 77": { maxSpeed: "65 km/h", power: "1,880 kW", builder: "BMAG (Berliner Maschinenbau)", numberBuilt: 56, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "e77": { maxSpeed: "65 km/h", power: "1,880 kW", builder: "BMAG (Berliner Maschinenbau)", numberBuilt: 56, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "drg e 77": { maxSpeed: "65 km/h", power: "1,880 kW", builder: "BMAG (Berliner Maschinenbau)", numberBuilt: 56, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "drg class e 77": { maxSpeed: "65 km/h", power: "1,880 kW", builder: "BMAG (Berliner Maschinenbau)", numberBuilt: 56, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  // VR Sr1 — Novocherkassk (NEVZ) + Strömberg 1973-1985, 110 units. Co'Co' electric,
  // 25 kV 50 Hz AC. Classic red-green-yellow "Finnish tricolor" livery. Fleet 3001-3110.
  // Discovered 2026-04-18 when tester Oula reported Sr1 (fleet 3041) being called Sr3.
  "sr1": { maxSpeed: "160 km/h", power: "3,100 kW", builder: "Novocherkassk (NEVZ) / Strömberg", numberBuilt: 110, fuelType: "Electric (25 kV 50 Hz AC)" },
  "vr sr1": { maxSpeed: "160 km/h", power: "3,100 kW", builder: "Novocherkassk (NEVZ) / Strömberg", numberBuilt: 110, fuelType: "Electric (25 kV 50 Hz AC)" },
  // VR Sr2 — SLM Winterthur / ABB 1995-2003, 46 units. Bo'Bo' electric, Swiss-built
  // Re 460 family. 25 kV 50 Hz AC. Fleet Sr2 3201-3246. Rounded Swiss cab profile.
  // Discovered 2026-04-18 when tester Oula reported Sr2 (fleet 3227) being called Sr3.
  "sr2": { maxSpeed: "210 km/h", power: "6,100 kW", builder: "SLM Winterthur / ABB", numberBuilt: 46, fuelType: "Electric (25 kV 50 Hz AC)" },
  "vr sr2": { maxSpeed: "210 km/h", power: "6,100 kW", builder: "SLM Winterthur / ABB", numberBuilt: 46, fuelType: "Electric (25 kV 50 Hz AC)" },
  // VR Sr3 — Siemens Vectron AC, 2017 onwards. Bo'Bo', 25 kV 50 Hz AC. 80 units
  // ordered/delivered. Fleet Sr3 3301+. Lock in the Siemens builder so AI doesn't
  // mis-attribute it to ABB/SLM (Sr2) or Strömberg (Sr1).
  "sr3": { maxSpeed: "200 km/h", power: "6,400 kW", builder: "Siemens", numberBuilt: 80, fuelType: "Electric (25 kV 50 Hz AC)" },
  "vr sr3": { maxSpeed: "200 km/h", power: "6,400 kW", builder: "Siemens", numberBuilt: 80, fuelType: "Electric (25 kV 50 Hz AC)" },
  // LSWR Urie S15 (BR 30506) — Robert Urie 4-6-0, Eastleigh 1920-1921, 20 units
  // in the Urie batch. Preserved 30506 based at Watercress Line / Mid-Hants Railway.
  // NOT Schools class, NOT 4-4-0, NOT 1914. Discovered 2026-04-19 when a UK tester
  // scanned 30506 and got "Class 30506 Schools 4-4-0 built 1914" back.
  "urie s15": { maxSpeed: "70 mph (113 km/h)", power: "1,268 kW", builder: "Eastleigh Works (LSWR)", numberBuilt: 20, fuelType: "Coal (steam)" },
  "lswr urie s15": { maxSpeed: "70 mph (113 km/h)", power: "1,268 kW", builder: "Eastleigh Works (LSWR)", numberBuilt: 20, fuelType: "Coal (steam)" },
  "lswr urie s15 class": { maxSpeed: "70 mph (113 km/h)", power: "1,268 kW", builder: "Eastleigh Works (LSWR)", numberBuilt: 20, fuelType: "Coal (steam)" },
  "s15": { maxSpeed: "70 mph (113 km/h)", power: "1,268 kW", builder: "Eastleigh Works (LSWR)", numberBuilt: 20, fuelType: "Coal (steam)" },
  // VR Sm2 — Valmet/Strömberg 1975-1981, 50 two-car units. Boxy 1970s cab, flat
  // windscreen. 120 km/h. NOT a FLIRT. Discovered 2026-04-19 when tester Oula
  // reported every VR commuter EMU being returned as Sm5.
  "sm2": { maxSpeed: "120 km/h", power: "900 kW", builder: "Valmet / Strömberg", numberBuilt: 50, fuelType: "Electric (25 kV 50 Hz AC)" },
  "vr sm2": { maxSpeed: "120 km/h", power: "900 kW", builder: "Valmet / Strömberg", numberBuilt: 50, fuelType: "Electric (25 kV 50 Hz AC)" },
  // VR Sm4 — CAF Beasain / Transtech Oy 1999-2005, 30 two-car units. Rounded
  // single-curve cab nose, 160 km/h. NOT a FLIRT, NOT Sm5, NOT Valmet-built.
  "sm4": { maxSpeed: "160 km/h", power: "1,500 kW", builder: "CAF (Beasain, Spain) / Transtech Oy", numberBuilt: 30, fuelType: "Electric (25 kV 50 Hz AC)" },
  "vr sm4": { maxSpeed: "160 km/h", power: "1,500 kW", builder: "CAF (Beasain, Spain) / Transtech Oy", numberBuilt: 30, fuelType: "Electric (25 kV 50 Hz AC)" },
  // VR Sm5 — Stadler FLIRT Finland, 2008+, 81 four-car units. Operated for HSL
  // by Junakalusto Oy — operator MUST be "HSL" or "HSL / VR", NOT "VR" alone.
  "sm5": { maxSpeed: "160 km/h", power: "4,200 kW", builder: "Stadler Rail (Bussnang)", numberBuilt: 81, fuelType: "Electric (25 kV 50 Hz AC)" },
  "vr sm5": { maxSpeed: "160 km/h", power: "4,200 kW", builder: "Stadler Rail (Bussnang)", numberBuilt: 81, fuelType: "Electric (25 kV 50 Hz AC)" },
  // Siemens Desiro HC — double-deck regional EMU for NRW RRX and others.
  // 4-car push-pull: 2 single-deck driving cars + 2 double-deck trailers.
  // Siemens Mobility Krefeld, 2018+, 160 km/h, 25 kV 50 Hz AC. Discovered
  // 2026-04-19 when a German TikTok commenter reported the app returning
  // "Mireo" for ~1 in 3 scans including obvious Desiro HC units.
  "desiro hc": { maxSpeed: "160 km/h", power: "3,100 kW", builder: "Siemens Mobility Krefeld", fuelType: "Electric (25 kV 50 Hz AC)" },
  "siemens desiro hc": { maxSpeed: "160 km/h", power: "3,100 kW", builder: "Siemens Mobility Krefeld", fuelType: "Electric (25 kV 50 Hz AC)" },
  // DB BR 232 / DR BR 132 "Ludmilla" — Soviet-built Co'Co' diesel-electric.
  // Voroshilovgrad Locomotive Works (Luhansk) 1973-1982, 709 BR 132 units
  // renumbered BR 232 post-reunification. Discovered 2026-04-20 when the app
  // returned "Siemens" as builder and 80 tonnes / 273 units — all wrong.
  "br 232": { maxSpeed: "120 km/h", power: "2,200 kW", weight: "116 tonnes", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 709, fuelType: "Diesel" },
  "db br 232": { maxSpeed: "120 km/h", power: "2,200 kW", weight: "116 tonnes", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 709, fuelType: "Diesel" },
  "baureihe 232": { maxSpeed: "120 km/h", power: "2,200 kW", weight: "116 tonnes", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 709, fuelType: "Diesel" },
  "dr br 132": { maxSpeed: "120 km/h", power: "2,200 kW", weight: "116 tonnes", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 709, fuelType: "Diesel" },
  "br 132": { maxSpeed: "120 km/h", power: "2,200 kW", weight: "116 tonnes", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 709, fuelType: "Diesel" },
  "ludmilla": { maxSpeed: "120 km/h", power: "2,200 kW", weight: "116 tonnes", builder: "Voroshilovgrad Locomotive Works (Luhansk)", numberBuilt: 709, fuelType: "Diesel" },
  // DB BR 151 — West German Co'Co' six-axle heavy freight electric, 170 units
  // built 1972-1978 by Krupp / Krauss-Maffei / Henschel for Deutsche Bundesbahn.
  // Discovered 2026-04-23 when the app returned ČD (Czech Railways) specs for a
  // Lokomotion 151 060-1 scan: wrong operator (ČD), wrong max speed (160 km/h),
  // wrong weight (87t), wrong builder (Škoda Transportation), wrong voltage
  // (3 kV DC / 25 kV 50 Hz AC), wrong unit count (20). Class collision with the
  // genuine ČD Class 151, a 6-unit Škoda-rebuilt Czech passenger loco from 1996.
  "br 151": { maxSpeed: "120 km/h", power: "6,000 kW", weight: "118 tonnes", builder: "Krupp / Krauss-Maffei / Henschel", numberBuilt: 170, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "db br 151": { maxSpeed: "120 km/h", power: "6,000 kW", weight: "118 tonnes", builder: "Krupp / Krauss-Maffei / Henschel", numberBuilt: 170, fuelType: "Electric (15 kV 16.7 Hz AC)" },
  "baureihe 151": { maxSpeed: "120 km/h", power: "6,000 kW", weight: "118 tonnes", builder: "Krupp / Krauss-Maffei / Henschel", numberBuilt: 170, fuelType: "Electric (15 kV 16.7 Hz AC)" },
};

function applyKnownCorrections(trainClass: string, specs: TrainSpecs): TrainSpecs {
  const key = trainClass.toLowerCase().trim();
  const correction = WIKIDATA_CORRECTIONS[key];
  if (!correction) return specs;
  console.log(`[SPECS] Applying known corrections for "${trainClass}": ${JSON.stringify(correction)}`);
  return { ...specs, ...correction };
}

export async function getTrainSpecs(
  train: TrainIdentification,
  language: string = "en"
): Promise<TrainSpecs> {
  try {
    // Run AI and Wikidata in parallel — don't let either block the other
    const [aiResult, wikiResult] = await Promise.allSettled([
      getAISpecs(train, language),
      getWikidataSpecs(train.class, train.operator, train.name),
    ]);

    const ai = aiResult.status === "fulfilled" ? aiResult.value : FALLBACK_SPECS;
    const wiki = wikiResult.status === "fulfilled" ? wikiResult.value : null;

    if (!wiki) {
      console.log("[SPECS] Wikidata: no data — using AI only");
      return applyKnownCorrections(train.class, ai);
    }

    // Wikidata wins for factual fields (speed, voltage, dimensions, builder)
    // AI wins for contextual fields (gauge, route, status, numberSurviving)
    //
    // maxSpeed exception: if Wikidata and AI disagree by more than 20%, the
    // Wikidata entry is likely stale, variant-specific, or mismatched. In that
    // case we log a warning and fall back to AI, which uses current knowledge.
    const resolveMaxSpeed = (): string | null => {
      if (!wiki.maxSpeed) return ai.maxSpeed;
      if (!ai.maxSpeed)   return wiki.maxSpeed;

      const parseKmh = (s: string): number | null => {
        const m = s.match(/([\d.]+)\s*km\/h/i);
        if (m) return parseFloat(m[1]);
        const mph = s.match(/([\d.]+)\s*mph/i);
        if (mph) return parseFloat(mph[1]) * 1.60934;
        return null;
      };

      const wikiKmh = parseKmh(wiki.maxSpeed);
      const aiKmh   = parseKmh(ai.maxSpeed);

      if (wikiKmh !== null && aiKmh !== null) {
        const diff = Math.abs(wikiKmh - aiKmh) / Math.max(wikiKmh, aiKmh);
        if (diff > 0.20) {
          console.warn(
            `[SPECS] maxSpeed mismatch >20% — Wikidata: ${wiki.maxSpeed}, AI: ${ai.maxSpeed}. Trusting Wikidata.`
          );
          // Wikidata is a structured factual source — prefer it over AI when they diverge
          return wiki.maxSpeed;
        }
      }

      return wiki.maxSpeed;
    };

    const rejectZeroWeight = (w: string | null | undefined): string | null => {
      if (!w) return null;
      const match = String(w).match(/([\d.]+)/);
      if (!match) return null;
      return parseFloat(match[1]) > 0 ? w : null;
    };

    const merged: TrainSpecs = {
      maxSpeed:        resolveMaxSpeed(),
      power:           wiki.power           ?? ai.power,
      weight:          rejectZeroWeight(wiki.weight) ?? rejectZeroWeight(ai.weight),
      length:          wiki.length          ?? ai.length,
      gauge:           ai.gauge,                           // AI only
      builder:         wiki.builder         ?? ai.builder,
      numberBuilt:     wiki.numberBuilt     ?? ai.numberBuilt,
      numberSurviving: ai.numberSurviving,                 // AI only
      status:          ai.status,                          // AI only
      route:           ai.route,                           // AI only
      fuelType:        wiki.fuelType        ?? ai.fuelType,
    };

    const wikidataFields = (Object.keys(wiki) as (keyof typeof wiki)[])
      .filter((k) => wiki[k] !== undefined);
    console.log(`[SPECS] Merged — Wikidata provided: ${wikidataFields.join(", ")}`);

    return applyKnownCorrections(train.class, merged);
  } catch (error) {
    console.error("[SPECS] Error:", (error as Error).message);
    return FALLBACK_SPECS;
  }
}
