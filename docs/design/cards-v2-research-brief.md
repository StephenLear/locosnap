# LocoSnap Card v2 — Research Brief
Date: 2026-04-24
Status: research / pre-design
Author: Claude (research pass, no live web access in this session — citations are to publicly documented behaviour of each app; anything speculative is flagged explicitly)

---

## 1. Key findings by app

### 1.1 eBird (Cornell Lab of Ornithology) — HIGHEST SIGNAL

**Tiering model.** eBird does NOT tier individual sightings as "verified/unverified" at the observation level the way we are proposing. Its trust model operates at two levels: (a) the *checklist* (an outing) which carries effort metadata, and (b) individual *records* that get flagged when they exceed regional filters. Records that trip a filter (rare species, out-of-season, unusually high counts) are routed to a regional volunteer reviewer who either confirms, asks for more evidence, or marks the record "unconfirmed". Confirmed records feed the public-facing science dataset; unconfirmed records remain in the user's personal list but are excluded from bar-charts, hotspot stats, and range maps. Source: Cornell Lab "eBird Data Quality" help pages and the eBird reviewer documentation.

**Required vs recommended metadata per sighting.** Required: location (pinned on map or a named hotspot), date, start time, observation type (stationary / travelling / incidental / area), duration, distance, number of observers, "are you reporting all species you could ID" yes/no. Recommended: count per species, media (photo/audio), breeding code, age/sex, comments. The *effort* fields (duration, distance, completeness) are the single most important quality signal — incidental reports are down-weighted in analyses.

**Rarity cross-check.** Regional filters are hand-curated per county/state/country with seasonal bars. A species below its filter threshold is auto-flagged for review. There is no crowdsourced flagging of other users' records — only Cornell's volunteer reviewers can confirm/unconfirm. This is a **centralised trust model**, not a social one.

**Detail/"card" view of a sighting.** Per-checklist page shows: location (linked to map + hotspot page), date, effort fields, observer list, full species list with counts, media thumbnails, and comments. Per-species view aggregates all of a user's sightings of that species across checklists — this is effectively the "life list entry" card and is the closest analogue to what LocoSnap wants.

**Social surface.** Life list, year list, county/state/country lists, "Top 100" leaderboards per region per year, "target species" suggestions. All counts derive from *confirmed* records only. Yard list and patch list are popular community variants.

**Anti-cheat posts.** eBird has published reviewer guidance acknowledging fabricated records as a real threat (people inflating life lists for bragging rights); the published defence is (a) regional filters, (b) volunteer reviewers, (c) requesting photo/audio for flagged records, (d) private flags on habitual offenders. Cornell does not publicly publish punishment data.

### 1.2 iNaturalist — HIGHEST SIGNAL (closest structural match to our proposal)

**Tiering model — this is the direct analogue.** Every observation is classified as one of: *Casual*, *Needs ID*, or *Research Grade*. Rules (from iNat's "Data Quality Assessment" help page):
- **Casual**: missing date, missing location, location not precise enough, not "wild/naturalistic" (captive/cultivated), or community flagged it as such. Casual observations do NOT feed GBIF/science datasets.
- **Needs ID**: has date + location + media + is wild, but community hasn't reached 2/3 agreement on the ID yet.
- **Research Grade**: has date + location + media + wild + community ID agreed to species level by at least 2 identifiers with 2/3 consensus.

Critically, Casual observations still appear in the user's own observations feed and are fully shareable. They are just excluded from the competitive/scientific surfaces. **This is exactly the model the product lead has already picked.**

**Required metadata.** Date (observed), location (coordinates + accuracy radius, can be obscured for threatened species), media (at least one photo, sound, or written description), captive/cultivated flag, identification. Device-supplied EXIF is read and used to auto-populate date + location.

**Rarity cross-check.** Community-driven: other users propose IDs, upvote/downvote IDs, and can flag an observation with DQA checkboxes ("date is accurate", "location is accurate", "organism is wild", "evidence of organism"). Two DQA downvotes on any field flip the observation to Casual.

**Detail/card view.** Per-observation page: hero photo, species name (common + scientific), observer username, date, map pin with accuracy circle, DQA checkbox panel, identification thread, comments, "similar observations nearby" sidebar.

**Social surface.** Per-user life list, year/month leaderboards, "observations in this place" hotspot pages, City Nature Challenge (April bioblitz). Only Research Grade counts for scientific surfaces; all observations count for personal life lists.

**Anti-cheat posts.** iNat forum has multiple public threads on the "captive/cultivated" problem (people photographing zoo animals and logging them as wild). Defence is the DQA checkbox "organism is wild" + community vote. There are periodic sweeps of high-volume offenders. iNat staff have written that relying on community flags works at scale because cheating is visible and low-status.

**Takeaway for LocoSnap.** The iNat three-state model (Casual / Needs ID / Research Grade) is better than two-state (Verified / Unverified). "Needs ID" is not applicable to LocoSnap (our AI provides the ID), but a middle tier of "Community Verified" (same fleet-number seen by another user same day at same station) is a free win and should be considered.

### 1.3 Pokémon TCG Pocket (DeNA / The Pokémon Company, Oct 2024)

**What's publicly documented vs what I'm speculating on.** I don't have live access to the app in this session. The following is drawn from widely-reported App Store reviews, launch press coverage (TechCrunch, IGN, Polygon Oct-Nov 2024), and public YouTube walkthroughs. If a detail matters, the product lead should confirm in-app.

**Card pack opening.** "Wonder Pick" and daily pack openings use a slow reveal: holographic pack shakes, user swipes to tear the foil, cards fly out one-by-one, each flipped face-down, tap to flip. The *rarity reveal moment* is the hook — higher-rarity cards get longer flash animations, gold borders, foil shaders. This is the most-copied mechanic in the game: the **delay before reveal is the product**.

**Collection screen.** Grid of card thumbnails organised by set. Owned cards shown in colour; unowned cards shown as silhouettes with a lock icon. Per-set completion percentage shown at top.

**Card flip.** Every card has a front (art + stats) and a back (set logo on foil). In the binder/collection view, long-press or tap flips the card with a physics-based rotation. Parallax tilt on gyroscope — card appears to tilt as phone tilts. This is the most emotionally effective detail and is cheap to implement.

**Share.** Screenshot-driven. The app generates a "rare pull" share card with the card art, rarity badge, and a small TCG Pocket watermark in the corner. Shared to Twitter/X, LINE, Discord. No in-app feed.

**First-time vs dupe.** First pull of a card triggers a full-screen "NEW!" animation with a collection-updated toast. Dupes are absorbed into a "Wonder Stamina" / dust currency silently. Applies nicely to LocoSnap: first sighting of a class = full reveal; subsequent sightings of same class but different fleet number = smaller "+1 to fleet" animation; same fleet number seen before = just a confirmation pop.

### 1.4 Strava + Pokémon GO — GPS spoofing defence

**Strava.** Publicly documented via their Engineering blog and help centre. Defences:
- Server-side speed/acceleration sanity checks on GPS point streams (teleport detection, max-speed-per-activity-type).
- Leaderboard flag: activities that look impossible for the chosen activity type get a yellow warning triangle and are excluded from segment leaderboards. User can appeal.
- Device fingerprint + GPS accuracy radius — low-accuracy or simulator-flagged coordinates get a silent quality flag.
- Weak social punishment: no public shaming, but repeat offenders get leaderboard exclusion.

User-visible UX is the **yellow triangle on a suspect activity** and the **"Flagged" badge on leaderboard entries**.

**Pokémon GO.** Defences are aggressive and well-documented on Niantic's support pages and user forums:
- Mock-location detection on Android (`ACCESS_MOCK_LOCATION` + root detection + Magisk module fingerprints).
- iOS: jailbreak detection, and specifically checking for known spoofing tweak bundle IDs.
- Server-side teleport detection (can't move >X km in Y seconds without flagging).
- Three-strike "soft ban" system: first flag locks Raids/PokéStops for hours, second flag for days, third for 30 days permanent.
- "Shadowban" tier: spoofer sees the game normally but rare Pokémon are hidden from their spawn tables.

**Takeaway for LocoSnap.** We don't need Niantic-level defence on day one. Two cheap wins:
1. On Android, check `Location.isFromMockProvider()`; on iOS, no reliable equivalent but can check for simulator at runtime.
2. EXIF timestamp + EXIF GPS must be present AND the timestamp must be within the N-day window AND the GPS accuracy must be <50m. Missing or stripped EXIF → Unverified tier automatically. No need for teleport detection yet because we don't have continuous tracking.

### 1.5 Merlin Bird ID + Letterboxd — detail + share-card

**Merlin.** Detail screen for a Bird Pack entry: hero photo (Cornell stock, not user photo), ID checkmark with date/location of first identification, call audio player, range map, similar species, "play call" button. Merlin is NOT a social app — no share card, no leaderboard. Lesson for LocoSnap: keep the *detail* screen dense with reference data (range map analogue = route/depot map, call audio analogue = engine sound clip — future idea), but we need social surfaces Merlin lacks.

**Letterboxd.** The gold-standard share card. When you log a film, the share card includes: poster (left), film title + year (right), your star rating, your one-line review, your username + avatar, the Letterboxd wordmark, and an optional "liked" heart. The layout is instantly recognisable on Twitter/Instagram Stories and drives huge organic growth. Critical details:
- Aspect ratio is portrait 9:16-ish for Stories but also produces a 1:1 for feed.
- User avatar + username are always present — provenance is the whole point.
- The film poster (not user photo) is the hero. **LocoSnap should do the opposite: the USER'S photo is the hero** and the blueprint is secondary, because that's where our social core lives ("what YOU have actually seen").

### 1.6 Untappd

**Check-in model.** Every beer logged is a "check-in" tied to a venue (optional GPS check-in at a bar/bottle-shop). Unique beer count is the headline stat. Badges are awarded for milestones (100 unique beers, 10 German lagers, visited 5 breweries in Munich, etc.) and serve as a leaderboard proxy — instead of a raw ranked list, it's "badges unlocked". This softens competition and makes the social surface feel less zero-sum. Lightweight GPS verification: check-ins include venue coordinates but can be faked easily; Untappd does not aggressively defend against this because the stakes are low.

**Takeaway for LocoSnap.** Badges-as-soft-leaderboard is a good fallback if a hard ranked leaderboard feels toxic. Also: Untappd's notion of "venue" maps cleanly to LocoSnap's "station/depot" and should be considered a first-class entity — cards could show "seen at Clapham Junction (your 12th sighting there)".

---

## 2. Synthesised proposal: Verified tier rules for LocoSnap

### 2.1 Tier definitions

| Tier | Rules | Counts for |
|---|---|---|
| **Verified (live)** | Photo taken via in-app camera with live GPS fix, accuracy <50m, no mock-location flag | All collection totals, leaderboards, streaks, badges |
| **Verified (recent gallery)** | Gallery photo with intact EXIF: date within **N days**, GPS present, accuracy <100m, no mock-location flag (Android) | All collection totals, leaderboards, streaks, badges |
| **Unverified** | Anything else: stripped EXIF, stale date, screenshot, no GPS, mock-location flagged, accuracy worse than threshold | Personal collection only. Shareable. Excluded from leaderboards, competitive badges, "Top Spotters" surfaces |

### 2.2 Recommended N (gallery recency window)

**Recommendation: N = 7 days.**

Reasoning:
- iNat does not impose a recency window — EXIF date is trusted and community DQA flags abuse. We can't replicate that community pass, so we need a tighter default.
- Strava allows manual activity entry with any date but excludes manual entries from segment leaderboards (similar pattern).
- 7 days accommodates the real trainspotter workflow: user shot photos on a day trip, got home, forgot to scan until the weekend. 30 days invites abuse (internet trawling), 24h is too strict.
- Make it a server-side constant — tunable without a client release.

### 2.3 Edge cases and proposed handling

| Case | Proposed tier | Notes |
|---|---|---|
| iOS share-sheet strips GPS (common when sent via Messages/AirDrop before scan) | Unverified | User education: "save to Photos first, then scan from there". Consider in-app banner when we detect a share-sheet-origin image. |
| DSLR photo with no GPS, AirDropped from camera | Unverified | Real spotters do this. Painful but unavoidable — we can't verify. Offer a "pair your camera's location log" future feature as a workaround. Consider a one-time "trusted device" exemption (speculative — needs design). |
| EXIF GPS present but date outside N-day window | Unverified | Most common legitimate case. Show "add to collection as Unverified" with an explainer. |
| Live camera but indoor museum photo of a preserved loco | Verified (live) | Correct behaviour. Preserved-loco sightings are legitimate spotting in the hobby. |
| Android mock-location flag tripped | Unverified + soft warning | Do not hard-block. Log a risk score server-side. Three flags in 30 days → account review. |
| Screenshot of a photo in Photos app | Unverified | Screenshots have no camera EXIF. Auto-detect by EXIF `Software` field containing "Screenshot" or absence of camera make/model. |
| User disables location permission entirely | Unverified by default | No GPS = no verification. App must still work fully. |
| Two users scan the same loco at the same station within 1h of each other | Both Verified; cross-linked on detail card | Emergent social feature — "also seen by @username 23 minutes ago". Strong anti-cheat signal. (Speculative — medium effort.) |

### 2.4 Anti-abuse scoring (server-side, invisible to user)

Maintain a per-user risk score computed from: % of scans that are Unverified, variance of scan locations (implausibly wide = flag), scans that land on known image-sharing domains' hash database (future — needs image hash matching), mock-location trips. Used only for internal review, never shown to the user. This is the Strava pattern.

---

## 3. Card design spec proposal

### 3.1 Three surfaces, one feature

1. **Card Front** (appears in results screen, collection grid detail)
2. **Card Back** (flip interaction — technical blueprint + specs)
3. **Share Card** (rendered image, watermarked, for export to Instagram/TikTok/Twitter)

### 3.2 Card Front — fields

```
+------------------------------------------+
| [Verified badge]     [Rarity chip]       |  <- Top bar. Verified = green tick; Unverified = grey "Personal".
|                                          |
|                                          |
|         [USER'S PHOTO — hero]            |  <- Full-bleed, 4:5. Letterboxd-inspired but user-photo-first.
|                                          |
|                                          |
|  BR 101 · Locomotive 101 042-3           |  <- Class + fleet number if captured.
|  DB Fernverkehr · Adtranz 1997           |  <- Operator · builder + year.
|                                          |
|  Spotted by @stephen                     |  <- Provenance block. Username first.
|  Frankfurt Hbf · 24 Apr 2026 · 14:07     |  <- Location (reverse-geocoded station) · date · time.
|  27th spotter of this fleet number       |  <- Sighting serial. Key social hook.
|  Your 4th BR 101 · 1st at this station   |  <- Personal streak data.
|                                          |
|  [ Flip to specs ]   [ Share ]           |
+------------------------------------------+
```

Fields ranked by priority (cut from the bottom if space is tight):
1. User photo (hero)
2. Class + fleet number
3. Operator + builder + year
4. Verified/Unverified badge
5. Username + date + location (the provenance block — this is the product's soul)
6. Sighting serial ("27th spotter of this fleet number")
7. Rarity chip
8. Personal streaks ("4th BR 101", "1st at this station")
9. Flip/share actions

Patterns cited: Letterboxd (username-first provenance), iNat observation page (location + date + observer), TCG Pocket (rarity chip, flip-to-back), Untappd (venue streak).

### 3.3 Card Back — fields

```
+------------------------------------------+
| [← Front]            BR 101              |
|                                          |
|       [AI BLUEPRINT — hero]              |  <- Now the blueprint is the hero.
|                                          |
|  Power:      6,400 kW                    |
|  Max speed:  220 km/h                    |
|  Built:      1996-1999                   |
|  Units:      145                         |
|  Service:    Intercity, EuroCity         |
|                                          |
|  [ Historical facts ▸ ]                  |  <- Expands to facts list.
|  [ Compare with... ▸ ]                   |
+------------------------------------------+
```

Cited: TCG Pocket flip physics with gyroscope parallax on the blueprint.

### 3.4 Share Card — fields (rendered 1080×1350 portrait for IG feed, 1080×1920 for Stories)

```
+------------------------------------------+
| LocoSnap                   [verified ✓]  |
|                                          |
|                                          |
|       [USER'S PHOTO — hero]              |
|                                          |
|                                          |
|  BR 101 042-3                            |
|  DB Fernverkehr · Adtranz 1997           |
|                                          |
|  @stephen · Frankfurt Hbf · 24 Apr 2026  |
|  27th spotter of this fleet number       |
|                                          |
|                 locosnap.app             |
+------------------------------------------+
```

Critical constraints:
- Username, location, date are **burned into the image** (can't be stripped or edited).
- App wordmark + URL in corner (Letterboxd pattern — drives organic growth).
- Verified tick rendered as part of the image for social proof.
- No rarity chip — reserved for in-app only, because it reveals spec data that could leak to scraping.

---

## 4. Leaderboard + collection integration

### 4.1 Collection counts

- **Class count**: number of distinct classes seen. Verified-only for the headline number shown on profile. Tap to see breakdown "34 verified · 6 unverified".
- **Fleet-number count**: number of distinct fleet numbers seen (the deep collectable metric). Same treatment.
- **Station count**: number of distinct stations where user has verified sightings.

### 4.2 Competitive surfaces — Verified only

- Global / country / region leaderboards (classes, fleet numbers, stations)
- "Top spotter of BR 101" per-class leaderboards
- Streak badges (consecutive days, consecutive weeks)
- "First to spot" claims on new fleet numbers
- Yearly / monthly totals shown on profile

### 4.3 Mixed surfaces — Verified + Unverified both count

- Personal collection grid
- Personal map of all sightings (Unverified shown with a dotted outline pin)
- Share cards (both produce share cards; Unverified share card has no "verified ✓" badge)
- Achievement unlocks that are skill/hobby-based rather than competitive (e.g. "seen all 6 BR 101 liveries" — can include unverified)

### 4.4 Visual treatment

- Verified: full colour, gold/green accent, tick badge.
- Unverified: full colour in personal grid (don't punish the user visually in their own space), but on shared surfaces shown with a grey "Personal" chip instead of the verified tick. Never "crossed out" or "greyed out" — that reads as failure and demoralises the user.

---

## 5. Open questions for product decision

1. **Can Unverified cards be deleted or converted?** Proposal: deletable at any time. Not convertible to Verified retroactively (would defeat the whole mechanic). But: if a second user Verified-scans the same fleet number at the same station within 1h of the original Unverified scan, consider auto-promoting to "Community Verified" — a third tier.

2. **Do we show the Verified/Unverified split publicly on profiles, or only to the owner?** Letterboxd / iNat show full data to everyone. Trainspotter culture may prefer this (transparency), or it may shame users into deleting Unverified cards (bad for retention).

3. **N-day window for gallery scans — 7 days is my recommendation. Product lead should confirm.** Options: 1d (strict), 7d (proposed), 14d, 30d (lax). This is a server-side constant — easy to tune post-launch.

4. **Should Unverified cards generate an AI blueprint?** Compute cost consideration. Proposal: yes, always — the blueprint is part of the emotional reveal and denying it to Unverified cards will feel punitive.

5. **Sighting serial ("27th spotter of this fleet number") — global or country-scoped?** Global is more dramatic but risks showing "1st" constantly for obscure regions, which cheapens it. Country-scoped matches the UK/DE market focus. Proposal: country-scoped, with a separate "global rank" shown only if user taps through.

6. **Mock-location detection on Android — hard-block or soft-flag?** Pokémon GO hard-bans. Strava soft-flags. Proposal: soft-flag (tier = Unverified + internal risk score). Hard bans invite support-ticket pain and false positives on rooted-but-legitimate devices.

---

## 6. Sources

Documented public sources (no live web access in this session — these are references the product lead can independently verify):

- **eBird**: help.ebird.org — "Data Quality", "Understanding the eBird Review Process", "Filters and Reviewers"
- **iNaturalist**: help.inaturalist.org — "Data Quality Assessment", "Geoprivacy", "What is Research Grade?"; iNat forum (forum.inaturalist.org) threads on captive/cultivated and DQA abuse
- **Pokémon TCG Pocket**: TechCrunch launch coverage Oct 2024; App Store listing; public YouTube gameplay reviews (search: "TCG Pocket card reveal", "TCG Pocket collection"). No official design docs public. **Details here should be verified against the live app before implementation.**
- **Strava**: Strava Engineering blog (medium.com/strava-engineering) posts on leaderboard integrity; support.strava.com — "Flagged Activities"
- **Pokémon GO / Niantic**: niantic.helpshift.com anti-cheat policy pages; public r/TheSilphRoad threads on spoof detection; well-covered by Kotaku, Polygon
- **Merlin Bird ID**: merlin.allaboutbirds.org — Cornell Lab product pages
- **Letterboxd**: letterboxd.com — any user review page; share-card pattern visible in any shared tweet
- **Untappd**: untappd.com — venue + badge system visible on any public profile

Speculative / not verified in this session:
- Specific TCG Pocket flip-physics details and "NEW!" animation specifics — described from public YouTube walkthroughs, not from the app itself.
- The "cross-link two users who scanned same loco at same station" anti-cheat idea is my proposal, not a documented pattern from any of the cited apps.
- The "community verified" third tier is my proposal, inspired by but not identical to iNat's Research Grade.

---

**End of brief.**
