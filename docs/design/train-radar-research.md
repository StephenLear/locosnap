# Train Radar — Feasibility Research (2026-06-18)

Source idea: TrainSnap competitor teardown (2026-06-16). "Train Radar" = live departures from
the user's nearest stations, flagging which classes are "confirmed / likely / worth chasing" —
a daily-engagement prompt that gives a reason to open the app *before* spotting anything.

This doc records the feasibility research. It is research, not a committed build.

## The crux question

The whole concept depends on predicting the **locomotive class / Baureihe** that will pass a
station. Departure-board feeds expose the **service product** (ICE/IC/RE/RB/S, line, time,
platform, delay) — but almost never the **traction**. If no feed exposes class, the "live
confirmed class" version of Radar is impossible. Research answer: **largely confirmed — no
clean live class feed exists in any market, with narrow partial exceptions.**

## Per-market findings

### Germany (#1 market)
- Official DB Timetable / HAFAS / `v6.db.transport.rest`: **service product only, no Baureihe.**
- **Long-distance (ICE/IC/EC): PARTIAL-LIVE is real.** The DB Wagenreihung (coach-sequence)
  API — via `bahn.expert` v4 or the `derf`/DBRIS libraries, or the official DB Marketplace
  "Fahrzeugreihenfolge" product — returns per-car UIC numbers, and the Baureihe falls out of
  the UIC digits (401/402/403 = ICE 1/2/3, 412 = ICE 4, etc.). Free, no-auth on the unofficial
  bahn.de path; ~2h departure window; "known to be bogus from time to time"; bahn.expert is no
  longer open-source (personal project, no SLA — needs a fallback).
- **Regional (BR 218 / 245 / 232 — the bulk of spotting variety): DARK.** No live feed names
  the traction. This is the case the camera exists for.

### UK (#3 market)
- Darwin / OpenLDBWS and the RealTime Trains API top out at operator + `powerType`
  (EMU/DMU/loco) + seating-class coaches — **no TOPS class, no unit number.**
- True live unit allocation exists only for ~5-6 TOCs (Southern/Thameslink/GN/SE/GatEx), is
  sourced via Rail Record (paid membership), and is **deliberately excluded from APIs for
  contractual reasons**; RTT commercial use needs a separate agreement.
- **But UK class is highly inferable from timetable + fixed fleet:** UK runs a fixed class of
  fixed-formation multiple unit per route (loco-hauled is rare), so a maintained
  "TOC route → class" table predicts the class for most services. **PARTIAL via inference.**

### Poland (#2 market)
- portalpasazera.pl / PKP PLK open data / Koleo / regional GTFS-RT: **category only, no
  traction.** Structural reason: data originates from PKP PLK (infrastructure manager), which
  never knows which physical unit the operator rostered.
- Exceptions: **Koleo renders composition for fixed EMUs** (ED250 Pendolino, ED160/161, ED74) —
  for an EMU the unit *is* the traction. **bocznica.eu** publishes planned PKP Intercity
  diagrams searchable by loco type (the PL analogue of RTT allocations) — but PKP IC only,
  hobbyist-grade, substitution-blind.
- Loco-hauled IC/TLK, POLREGIO regional, and freight (EU07, Dragon, Vectron, EN57): **NO.**

## What is actually buildable (universal answer)

Three approaches, ranked for a solo dev / few-thousand users / DE-first:

1. **Static route→class probability map (BUILD THIS — the MVP).** No live feed, no density
   requirement. "Classes commonly seen at this station." Runs almost entirely on data we
   already own (geotagged scan history) plus seed data from DE-Wikipedia Bahnstrecke/Baureihe
   articles and OpenRailwayMap electrification (non-electrified line ⇒ diesel prior). Useful
   from day one; degrades gracefully; no empty-screen failure mode. Ties cleanly to collection
   completion ("you've spotted 7 of 9 classes seen at München Hbf").
2. **Hybrid: live timetable times + static class layer (the immediate next step).** Free DB
   Timetable feed for *times* + the static map for *likely class* = "RE due 14:32, this line is
   usually BR 218 (likely) / BR 245 (possible)." Plus, for DE long-distance, the live
   Wagenreihung layer can name the actual ICE/IC Baureihe. This is the full TrainSnap-style
   "confirmed / likely / worth chasing" experience, and where it becomes genuinely compelling.
3. **Live crowdsourced from our own scans (DEFER).** "3 users scanned a BR 232 at Leipzig Hbf
   in the last hour." Mechanically trivial (a `GROUP BY station, class, time-bucket` on the
   spots table) but **cold-start-fatal at current scale** — users are geographically diffuse,
   a scan is Radar-useful for ~30-60 min at one station, and an empty Radar signals a dead app.
   Re-evaluate at hundreds of DAU per region. Every scan collected now feeds approach 1's
   histogram *and* is the on-ramp to this later.

## TrainSnap's Radar, demystified

It is **not a data moat.** Their "confirmed / likely / worth chasing" is almost certainly live
public timetable data + a hand-curated line→class table + good gamified copy. No live traction
feed, no meaningful crowdsourcing. The compelling part is the **framing language**, not the
data — and LocoSnap already computes the rarity layer ("worth chasing") that TrainSnap does
only crudely, plus has a richer auto-growing sighting log via AI scans.

## Key facts already true in our codebase

- Scans **already store lat/lng** (`trainStore.ts:353`, `supabase.ts:38`, migration 009),
  nullable (depends on location permission grant). The blocking prerequisite is done.
- We already compute rarity per class — the "worth chasing" signal is free.

## Open decisions (for Stephen)

- Is this a real candidate for a build, or a parked idea? (Research only commits us to nothing.)
- If yes: confirm MVP = approach 1 (static "commonly seen here" map), DE-first.
- Data-model question: what % of existing spots actually have lat/lng (location-permission
  grant rate)? Determines how good the day-one histogram is. Worth a quick Supabase query
  before any build.
- Strategic fit: Radar is a daily-engagement / retention play, and connects to the
  leaderboard-redesign and collection-as-moat positioning. Sequence vs other backlog?

## Sources
DE: bahn.expert (docs.bahn.expert Reihung v4), derf Travel-Status-DE-DBWagenreihung, DB API
Marketplace Fahrzeugreihenfolge, v6.db.transport.rest, OpenRailwayMap. UK: Darwin/OpenLDBWS,
realtimetrains.co.uk API, raildata.org.uk, rail-record.co.uk. PL: portalpasazera.pl, koleo.pl,
bocznica.eu, dane.gov.pl GTFS-RT. Precedent: spotters.sgtrains.com (working crowdsourced model).
