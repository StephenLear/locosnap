# Paywall Strategy — Competitor Research
Date: 2026-04-24
Status: research / pre-decision

> **CORRECTION 2026-04-24 (after user review):** The initial research pass did not have access to LocoSnap's live RevenueCat pricing and speculated that Pro was monthly-only. This was wrong. **LocoSnap Pro is £24.99/year annual or £2.99/month monthly**, with a one-off blueprint-credits pack also available. The §1 "headline finding" claiming "4× Letterboxd" / "no annual option" is RETRACTED. See §1.0 below for corrected comparison table and §3 + §4 are updated accordingly.

## 1.0 Corrected price comparison (added 2026-04-24)

| App | Annual price (GBP approx.) | LocoSnap vs this |
|---|---|---|
| Letterboxd Pro | £15/yr ($19) | LocoSnap is 1.67× |
| Letterboxd Patron | £62/yr ($79) | LocoSnap is 0.40× |
| Geocaching Premium | £31/yr ($39.99) | LocoSnap is **20% CHEAPER** |
| Untappd Insider | £43/yr ($54.99) | LocoSnap is **42% CHEAPER** |
| Duolingo Super | £47/yr ($59.99) | LocoSnap is **47% CHEAPER** |
| Strava Subscription | £54.99/yr (direct) | LocoSnap is **55% CHEAPER** |
| Flightradar24 Silver | £30/yr (approx, unverified) | LocoSnap ~17% cheaper |

**Corrected conclusion:** LocoSnap Pro at £24.99/yr is **the cheapest annual tier in the relevant hobby-collector set** apart from Letterboxd (who have no AI compute costs to carry). Pricing is NOT the conversion bottleneck. The 3% download→paid conversion is almost certainly a product + messaging problem, not a price problem.

**Monthly→annual anchor:** £2.99 × 12 = £35.88/yr sticker vs £24.99 actual = **30% annual discount**. In line with Untappd (24%), below Duolingo (62%). Respectable, could be sharpened — raising monthly to £3.99 would widen the anchor to 48% without touching annual revenue.

---

Author: Claude (research pass — citations are to publicly documented behaviour and reporting; speculation flagged explicitly)

Context: LocoSnap hobby-collector paywall review. 30-day iOS data: 134 first-time downloads, 4 IAPs, $26 proceeds. Per-scan API cost ~$0.05–$0.12. Three models under evaluation: (A) gate depth not count, (B) credit packs, (C) weekly-refresh free tier.

Note on currency: Most competitor pricing is published in USD. GBP conversions below use an approximate rate (~$1.25 = £1, ~€1.08 = £1) and are indicative, not live.

---

## 1. Findings by app

### 1.1 Letterboxd (HIGHEST PRIORITY — direct structural analogue)

**Pricing:** Pro $19/year (~£15/year, ~€17/year) — **annual only, no monthly option**. Patron $49/year (~£39). Pro→Patron mid-term upgrade $20.

**Free tier:** Unlimited film logging, reviews, lists, diary, watchlist, following, activity feed. Third-party ads shown. This is the core product — the free tier is deliberately generous.

**Pro gates:**
- Removal of third-party ads
- Personalised annual + all-time stats pages
- Filter by favourite streaming services (per country)
- Push/email notifications when watchlist films arrive on streaming
- Filter by films you own physically/digitally
- Change username

**Patron gates (adds on top of Pro):**
- Custom posters/backdrops on profile, lists, diary entries, individual films
- Profile listed in Patrons directory
- Early access to new features
- Bulk-add visible films to list/watchlist
- Extra stats components (films rated higher/lower than community average, most-watched themes/nanogenres)

**Conversion data:** Not publicly disclosed. Tiny (Canadian holding co) acquired majority stake in 2023, no public financials. This is a genuine gap — despite being the most-cited structural analogue, Letterboxd has never published conversion % or ARPU. **Flagged as speculation:** the community consensus on Reddit/threads is "low single-digit %", but no founder or investor statement confirms this.

**In-app CTA copy (from letterboxd.com/pro/):** Emphasises "personalised stats" and "ad-free" as the two lead benefits. Annual sale runs ~once/year at ~$12/year ("$1 a month") — suggests heavy acquisition discounting.

**Key insight:** Letterboxd gates **reflection and analytics**, never the core act (logging a film). The core loop — log, rate, review, follow — is 100% free and always will be. Paid tier monetises users who are already deeply engaged and want to look at their own data.

Sources: [letterboxd.com/about/pro](https://letterboxd.com/about/pro/), [letterboxd.com/pro](https://letterboxd.com/pro/), [Five Star Insider Pro vs Patron](https://www.fivestarinsider.com/letterboxd-pro-vs-patron/), [Letterboxd Wikipedia](https://en.wikipedia.org/wiki/Letterboxd), [annual sale post](https://x.com/letterboxd/status/1331870887168012290).

---

### 1.2 iNaturalist + Merlin Bird ID + eBird (Cornell ecosystem)

**Pricing:** Free. No paywall, no IAPs, no ads. Forever.

**Funding model — Merlin (Cornell Lab of Ornithology):** NSF grant DRL-1010818 (initial build), plus ongoing support from Pennington Wild Bird Food, Swarovski Optik, Faucett Catalyst Fund, Cornell Lab members/donors. When the NSF grant wound down, the Lab explicitly chose not to charge — the stated reasoning was that free distribution drove far more downloads, especially in lower-income regions where any fee is prohibitive. Cornell's mandate is conservation/education, not revenue.

**Funding model — iNaturalist:** 501(c)(3) nonprofit (EIN 92-1296468) since July 2023. Previously joint initiative of California Academy of Sciences (from 2014) and National Geographic Society (from 2017). Spun out in 2023 with a **$10M startup grant**. Funded by grants + individual tax-deductible donations.

**Key insight:** Both are structurally incompatible with LocoSnap's situation. They have institutional backers with non-commercial mandates (university, science nonprofit, major foundations). LocoSnap has no foundation backer, no university, no conservation mandate. **This route is closed unless a rail-heritage foundation or museum partnership is actively pursued** — and even then, $10M grants are vanishingly rare.

What IS transferable: the data-contribution framing. Users who log observations feel they're contributing to science. LocoSnap has a latent version of this (rail-enthusiast community data, historical photography of current rolling stock) but doesn't currently tell that story.

Sources: [Merlin story page](https://merlin.allaboutbirds.org/the-story/), [iNaturalist financials](https://www.inaturalist.org/pages/financials), [iNaturalist spinoff FAQ](https://www.inaturalist.org/pages/spinoff_faq), [Bay Nature 2023 spin-out piece](https://baynature.org/2023/09/12/science-nature/urban-nature/inaturalist-strikes-out-on-its-own/).

---

### 1.3 Strava

**Pricing (current, 2024–2025):** Subscription ~$11.99/month or $79.99/year in US (~£6.99/mo or £54.99/year in UK as of last public pricing). Single tier, no free-trial-of-paid on all features anymore.

**The 2020 paywall tightening:** On 18 May 2020, Strava moved the following previously-free features behind subscription:
- Segment leaderboards (kept top-10 free as a tease, full leaderboard paid)
- Route planning
- Matched runs
- Training log
- Monthly activity trends and comparisons
- Year In Sport (moved paid later)

**User reaction:** Loud and sustained. The timing (mid-COVID, home workouts booming) was widely criticised; competitors (Fitbit, Peloton) went the other way with free-content expansions. Subreddit threads, support forum backlash, negative press coverage (Gizmodo, SlashGear, Wareable). **Crucially, Strava did not reverse course** — they absorbed the PR hit and the business is materially healthier now.

**Public CEO/CRO statement (David Lorsch, Strava CRO, 2022 Robbie Baxter interview — paraphrased from cited Medium piece):** free-user research in late 2019 showed users saying "the free product is so good, why would I ever bother to subscribe?" That was the trigger. Take-away: **if the free tier is too good, you never convert, no matter how large the funnel.** This is directly relevant to LocoSnap's current 3% IAP rate.

**Key insight:** Users will tolerate a paywall-tightening if the core social/tracking loop remains free and the gate falls on analytics + planning. Year-in-review paywalling (Strava 2023/2024) was controversial but survived — **gating a nostalgia/reflection artefact at year-end is high-conversion, low-churn.**

Sources: [the5krunner](https://the5krunner.com/2020/05/18/strava-turn-off-key-features-welcome-to-the-paywall/), [road.cc on Year in Sport paywall](https://road.cc/content/news/strava-year-sport-now-only-subscribers-317425), [Outside Online](https://www.outsideonline.com/outdoor-gear/bikes-and-biking/strava-paywall-core-users-future/), [Wareable](https://www.wareable.com/sport/strava-update-2020-subscription-7978), [David Lorsch CRO interview via Robbie Baxter](https://robbiebax.medium.com/how-strava-built-a-subscription-business-within-a-social-platform-with-strava-cro-david-lorsch-c3779712a30c).

---

### 1.4 Duolingo Super / Duolingo Max

**Pricing:** Super $12.99/mo OR $59.99/year (~£4.00/mo equivalent annual, ~£10.40/mo billed monthly). Super Family $119.99/year for up to 6 users (~£16/user/year). Max tier (adds GPT-4-powered "Roleplay" and "Explain My Answer") sits above Super at a higher price.

**The conversion miracle:** Per a well-circulated Medium breakdown (Nicolas Bottaro), Duolingo grew MAU-to-premium from **~3% to ~8.8% over five years** — a 176% increase. Mechanics cited:
- **Annual price anchor** — $59.99/year displayed next to $12.99/mo creates a "68% off" optical frame
- **Hearts system (now Energy, July 2025):** 25 energy units deplete on errors/lessons. Recharge in ~24h, OR watch rewarded ads, OR spend gems, OR subscribe. The punitive-but-recoverable mechanic is the load-bearing piece.
- **Streak + leagues + leaderboard shame:** social pressure drives daily return, which drives exposure to the upsell
- **Contextual upsell timing:** after each completed lesson, ML decides whether to show a Super upsell or a third-party ad — i.e. they A/B the exact moment of satisfaction

**Key insight for LocoSnap:** the hearts/energy mechanic is the single most-studied freemium-gate in mobile. It works because (a) the user causes the gate themselves (by making mistakes / using up lessons), (b) the gate is temporary, not permanent, and (c) there are multiple escape hatches (wait, ads, gems, subscribe) so it never feels extractive. **LocoSnap's current "3 lifetime scans" gate has NONE of these properties — it's permanent, externally imposed, and the only escape is paying.** That is likely the root cause of the DE TikTok "übelst nervig" comment.

Sources: [Medium — Nicolas Bottaro, Duolingo monetization lessons](https://medium.com/@nicobottaro/monetization-7-lessons-on-how-duolingo-increased-premium-users-by-176-from-3-to-8-8-42e8d63b58f2), [Papora pricing 2026](https://www.papora.com/learn-english/super-duolingo-prices/), [checkthat.ai Duolingo pricing](https://checkthat.ai/brands/duolingo/pricing).

---

### 1.5 Pokémon TCG Pocket

**Pricing:** Premium Pass $9.99/month (~£8/month). 14-day free trial (one-time, only unlocked by purchasing first month). No annual tier — monthly only.

**What it unlocks:**
- +1 extra booster pack per day (i.e. 30 extra packs / month — this is the headline benefit)
- Monthly premium missions: 11 Pack Hourglasses, 8 Wonder Hourglasses, 29 Premium Tickets
- Exclusive cosmetic rewards and promo cards

**Wonder Stamina mechanic:** the "Wonder Pick" feature (pick a random card from someone else's recent pull) is gated by Wonder Stamina, which regenerates on a timer OR can be instantly recharged with Poké Gold (paid currency). This is structurally a dual gate — time-based (free path) OR wallet-based (pay path).

**Revenue:** $1.25B–$1.3B in first year (launch Oct 2024 → Oct 2025). Crossed $1B in 204 days — **fastest Pokémon title ever** to $1B, beating Pokémon Go's 282-day run. Nov 2024 peak: $236.4M/month. Subsequent months declined but stabilised $100M+.

**Revenue breakdown speculation:** public reports do not split subscription vs gacha pull revenue. Industry consensus (flagged as speculation, from gacha-revenue trackers like Ennead) is that gacha/one-off purchases dominate subscription substantially — Premium Pass is likely <20% of total revenue, with Poké Gold purchases for hourglasses, stamina, and card pulls making up the bulk.

**Key insight:** The Pass is a **utility subscription** (+1 pack/day) sitting alongside a gacha economy. It doesn't try to unlock everything — it's specifically priced low ($9.99) as a "daily drip" product. This maps interestingly to LocoSnap Option B (credits): the Pass is Nintendo's version of "buy a little extra volume" rather than "unlock everything".

Sources: [PokeBeach $1.25B first year](https://www.pokebeach.com/2025/10/pokemon-tcg-pocket-earned-record-1-25-billion-in-its-first-year-sparked-current-pokemon-tcg-shortages), [PocketGamer.biz $1B in 200 days](https://www.pocketgamer.biz/pokmon-tcg-pocket-surpasses-1bn-in-just-over-200-days/), [Premium Pass FAQ](https://support.pokemon.com/hc/en-us/articles/30331739144596-Pok%C3%A9mon-TCG-Pocket-Purchase-and-Premium-Pass-FAQ), [Game8 Premium Pass guide](https://game8.co/games/Pokemon-TCG-Pocket/archives/474488).

---

### 1.6 Untappd

**Pricing:** Insider $5.99/month OR $54.99/year (~£4.80/mo or £44/year). Annual saves ~23%.

**Free tier:** Unlimited beer check-ins, badges (most of them), friends, venues, basic stats.

**Insider gates:**
- 10% discount in Untappd Shop
- Finer rating scale (0.25 or 0.1 stars vs 0.5 default)
- **Retroactive check-ins** — can backdate a check-in to any prior date/location
- In-depth stats and analytics year-round (free users see only limited/recent stats)
- Insider-exclusive "Super Style" badges that level up every 5 check-ins of a given style
- Limited/reduced ads
- Early festival-ticket access

**Badge mechanic:** badges are the core collection loop. Most badges are free. Insider-only badges are positioned as **status flex**, not functional unlock. Works because the free user still gets the collection dopamine loop — Insider badges are peacock feathers.

**Key insight:** **The "retroactive check-in" gate is elegant.** It's not a limit on the core act, it's a premium convenience for power users who occasionally forget to log in the moment. Low API cost, high perceived value, zero disruption to casual users. LocoSnap analogue would be "edit scan date/location after the fact" or "bulk-import historical spots from photo library metadata".

Sources: [Untappd Insiders page](https://insiders.untappd.com/), [Untappd Insider pricing help](https://help.untappd.com/hc/en-us/articles/4409476745492-What-are-my-pricing-options-to-become-an-Untappd-Insider), [Untappd blog magnet post](https://untappd.com/blog/become-an-annual-untappd-insider-get-a-collectible-magnet/1365).

---

### 1.7 Geocaching Premium

**Pricing (post-June 2023):** $39.99/year OR $6.99/month in US. €39.99/year OR €7.99/month in EU (~£34/year or £5.99/mo).

**Free tier:** Unlimited logging of Traditional caches, basic map, basic search.

**Premium gates:**
- **Premium-only caches** (the famous one — many of the most interesting/creative caches are Premium-locked by cache-owner choice, not platform-enforced). This is a creator-side gate, not a corporate-imposed limit.
- Advanced map filters (hide found, filter by difficulty/terrain/size)
- Offline maps
- Detailed personal stats: best caching day, milestones, streaks
- Custom pocket queries (pre-filtered cache lists for download)
- Challenges / statbars

**Conversion data:** Not publicly disclosed. Geocaching HQ (Groundspeak) is privately held.

**Key insight:** Geocaching's strongest mechanic is **community-contributed premium content** — Premium caches exist because cache-placers choose to restrict them. This creates a scarcity that Groundspeak doesn't manufacture. LocoSnap can't replicate this directly (train sightings aren't user-curated rarities), but there's an analogue: **user-submitted fact corrections / spotting-location contributions that only Pro users can contribute** (inverts the dynamic — Pro earns contributor status) would create a status-layer that free users opt into.

Sources: [Geocaching Newsroom Premium](https://newsroom.geocaching.com/premium), [2023 pricing update FAQ](https://www.geocaching.com/blog/2023/04/faq-updates-to-geocaching-premium-for-new-subscribers/), [Premium features help](https://www.geocaching.com/help/index.php?pg=kb.chapter&id=7&pgid=283).

---

### 1.8 Flightradar24 (sibling real-world-sighting app)

**Pricing:** Could not retrieve live pricing this session (WebFetch was denied). Public pricing historically (not confirmed current as of 2026-04-24, **flagged as speculation**):
- Silver: ~$1.99/month or ~$14.99/year
- Gold: ~$3.99/month or ~$39.99/year
- Business: ~$49.99/month or ~$499.99/year

**Free tier:** Live map, basic aircraft info, 7 days of history.

**Silver gates:** 90 days of flight history, basic filters, no ads.

**Gold gates:** 365 days of flight history, 3D cockpit view, weather layers, aircraft photos inline, route info, live CO₂ emissions data, advanced filters.

**Business gates:** Unrestricted history, airport disruption data, commercial-use license, API access.

**Key insight:** Four-tier ladder with clear functional differentiation. Gold is clearly the "enthusiast" tier — the sweet spot for hobby users. **Business tier exists primarily as a price anchor** and to capture the rare commercial user; its existence makes Gold look reasonable. The **depth of historical data** is the primary gate — very applicable to LocoSnap ("see your spotting history from any year" as a Pro feature).

Sources: [Flightradar24 premium page](https://www.flightradar24.com/premium), [Flightradar24 Gold blog](https://www.flightradar24.com/blog/inside-flightradar24/going-for-gold-exploring-some-of-our-favorite-flightradar24-subscription-features/). **Pricing figures above are from historical knowledge, not verified against the 2026-04-24 live page — verify before quoting externally.**

---

## 2. Patterns across apps

### Pattern A — Nobody gates the core loop
Letterboxd: log a film = free forever. Strava: record a run = free. Untappd: check in a beer = free. iNaturalist: log an observation = free. Duolingo: do a lesson = free (with energy cap). Even Pokémon TCG Pocket gives free daily packs. **The act the user came for is always free or very-generously-rate-limited.** What gets gated is **analytics, reflection, power-user convenience, and cosmetic status**. LocoSnap currently gates the core act (scanning) at 3 lifetime. This is the odd one out in the entire sample.

### Pattern B — Annual pricing is always anchored heavily against monthly
Duolingo: $12.99/mo vs $59.99/year (62% cheaper annually). Untappd: $5.99/mo vs $54.99/year (24% cheaper). Strava: similar ratio. Letterboxd: annual only, no monthly option at all (strongest version). Pokémon TCG Pocket: monthly only, no annual (opposite extreme — keeps hook short). **The monthly price exists mainly as a decoy to make annual feel obvious.** LocoSnap currently only offers monthly — this leaves money on the table and foregoes the commitment-device annual provides.

### Pattern C — Time-based gates with multiple escape hatches outperform count-based gates with only one escape
Duolingo hearts/energy: wait, watch ad, spend gems, OR subscribe. Pokémon Wonder Stamina: wait, OR spend gold. Flightradar24: 7 days of history free, more with Silver/Gold. All of these give users agency — they can survive the gate without paying. LocoSnap's 3-lifetime-scan gate has only one escape: pay. This is why users experience it as "übelst nervig" even though 3 scans is a lot more than most users will use.

### Pattern D — "Reflection and collection" features convert best
Strava Year in Sport, Letterboxd personalised stats, Untappd yearly analytics, Flightradar24 historical flight depth. **Users pay to look back at what they've done.** This is particularly powerful 6–12 months into their journey — by which point the backlog is substantial and losing it feels like loss-aversion. LocoSnap's blueprint cards + collection are already structurally this, but currently they're FREE and the scan itself is GATED — this is the inverse of the winning pattern.

### Pattern E — Foundation/nonprofit funding is a genuinely closed door
Cornell Lab and iNaturalist each have $10M+ institutional backers. Neither is a template for a solo-founder hobby app. Stop thinking about this path unless a specific rail-heritage foundation comes knocking.

---

## 3. What this means for LocoSnap's three model options

### Option A — Gate depth, not count (STRONGLY SUPPORTED)
This is the Letterboxd / Untappd / Flightradar24 / Strava pattern. **Four out of five most relevant competitors do exactly this.** The user can scan freely, gets class + operator + 1–2 facts + a low-res / un-watermarked blueprint. Pro unlocks full specs, full facts, rarity classification, high-res downloadable blueprint, collectible card, leaderboard eligibility, and historical stats.

**Risk:** per-scan API cost of $0.05–$0.12. If a free user scans 50 times and never converts, that's $2.50–$6.00 of cost against zero revenue. **Before switching to Option A, per-scan cost must drop to ~$0.01–$0.02.** That means: aggressive vision-model cache for repeat scans of same classes, cheaper tier for free-user fact generation (truncated / cached only), free tier does NOT trigger blueprint generation (biggest cost line), blueprint only triggered on save/share.

**Specific implementation the research suggests:**
- Free tier: vision ID + operator + 1 headline fact, cached + served from the in-memory trainCache for any class already seen
- Pro gates: full specs panel, full facts (AI-generated per-scan), rarity, blueprint (biggest cost, biggest perceived value), collection history beyond last 30 days, leaderboards, annual "Year In Trains" reflection artefact (Strava-style)

### Option B — Credit packs alongside subscription (WEAKLY SUPPORTED)
Pokémon TCG Pocket is the only direct analogue in this sample, and their credit system sits inside a gacha economy that LocoSnap does not have. Untappd, Letterboxd, Strava, Duolingo, Geocaching, Flightradar24 — **none** of them sell credit packs. This is a signal.

**When credits make sense:** high-variance usage where some users want a burst (photograph a rally day, scan 30 trains in 4 hours). For steady-state use, subscription dominates. The DE TikTok commenter doesn't want credits, they want the limit not to feel punitive.

**Verdict:** not the primary mechanic, but potentially a secondary offering for specific use cases (one-off £2.99 "heritage weekend pack" of 20 scans). Do not make this the headline.

### Option C — Time-refreshing free tier (MODERATELY SUPPORTED — but as a stopgap)
Duolingo hearts, Pokémon Wonder Stamina, Flightradar24 history-depth limit. All three use time-refresh as part of a broader system, not as the primary gate.

**Verdict:** better than current "3 lifetime" in every way. Cheaper framing, same enforcement. But if per-scan costs remain at $0.05–$0.12, a weekly-refresh tier at 3 scans/week = 156/year/user = $7.80–$18.72 cost/user/year against £0 revenue from the 95% who never convert. **Option C is a band-aid, not a model.**

### Fourth option the patterns suggest — Option D: "Depth gate + generous time-refresh free trial of depth"
Combine A and C. Free tier: unlimited scans, but shallow info. AND once a month, every free user gets 3 "full Pro" scans (with full specs, facts, rarity, blueprint) as a taste. This is the Merlin/iNaturalist "free forever core + occasional enhanced taste" model merged with Letterboxd depth-gating. Converts on the hook of **already knowing what Pro feels like**, not on the shame of a locked door.

Per-scan cost stays manageable because most free scans are cache-hits on common classes (DB 101, BR 158, Eurostar e320 etc.) and never trigger expensive blueprint generation.

---

## 4. Specific quotes / data points worth pulling into the paywall review session

1. **Duolingo 3%→8.8% conversion over 5 years** — "By layering micro-optimizations across every user interaction, Duolingo turned a modest 3% MAU-to-premium conversion into an industry-leading 8.8%: a 176% jump in five years." Source: [Nicolas Bottaro on Medium](https://medium.com/@nicobottaro/monetization-7-lessons-on-how-duolingo-increased-premium-users-by-176-from-3-to-8-8-42e8d63b58f2). This is the industry benchmark — if LocoSnap can get from ~3% to even 6% over 18 months, the unit economics change entirely.

2. **Strava CRO David Lorsch (2022) on why the 2020 tightening happened** — "subscribed users said they subscribed because they loved Strava, while free users said 'I love Strava but honestly, the free product is so good. Why would I ever bother to subscribe?'" Source: [Robbie Baxter interview, Medium](https://robbiebax.medium.com/how-strava-built-a-subscription-business-within-a-social-platform-with-strava-cro-david-lorsch-c3779712a30c). Directly applicable: is LocoSnap's free tier TOO good (unlimited blueprints on the 3 lifetime scans = gives away the hero feature) rather than too restrictive?

3. **Letterboxd Pro pricing — $19/year, annual only** ([letterboxd.com/about/pro](https://letterboxd.com/about/pro/)). This is a remarkable anchor — £15/year for the hobby-collector benchmark. LocoSnap Pro at ~£4.99/month = £60/year is 4x more expensive than Letterboxd Pro. Worth asking: can LocoSnap justify being 4x Letterboxd? Probably yes because of API costs, but it's a real customer-perception risk.

4. **Pokémon TCG Pocket: $1.25B in Year 1, monthly-only $9.99 subscription** ([PokeBeach](https://www.pokebeach.com/2025/10/pokemon-tcg-pocket-earned-record-1-25-billion-in-its-first-year-sparked-current-pokemon-tcg-shortages)). Demonstrates that **monthly-only, no-annual** can work IF paired with a daily-drip benefit. Inverse of Letterboxd's annual-only. Either extreme works — what doesn't work well is pure-monthly with no daily hook.

5. **Geocaching raised prices in June 2023** (US annual from $29.99 → $39.99). Did not reverse. Evidence that established hobby-collector audiences tolerate ~33% price rises without mass defection once they're embedded. Source: [Geocaching 2023 FAQ](https://www.geocaching.com/blog/2023/04/faq-updates-to-geocaching-premium-for-new-subscribers/).

---

## 5. Open questions the research surfaced

1. **What's the LocoSnap free-user scan distribution in week 1?** If median free user scans 2 of their 3 lifetime scans and stops, the paywall is barely doing anything — they're not hitting the gate, they're just losing interest. If median is 3/3 and they bounce, the gate is the blocker. These need radically different fixes. Priority: pull PostHog data before the review session.

2. **What % of LocoSnap API cost per scan is blueprint generation vs vision+facts+specs+rarity?** If blueprint is >60% of per-scan cost (plausible given Replicate SDXL/DALL-E 3 pricing), then Option A becomes genuinely cheap to run because free-tier scans just don't trigger blueprints. If blueprint is <30%, Option A doesn't fix the unit econ.

3. **What does a returning Pro subscriber's 6-month retention look like?** Letterboxd/Strava/Untappd pro users are stickier than monthly-averaged Mobile-SaaS because the collection becomes a sunk-cost they don't want to walk away from. If LocoSnap Pro retention is already >70% at month 6, that's the goldmine and the focus should be conversion, not retention. If <50%, the depth-gate features need to be better before raising conversion.

4. **Does the UK vs DE free-tier perception differ materially?** The DE "übelst nervig" comment and the UK tester's "stale 10-scans/month" catch are both negative but different. DE audience may be more sensitive to restrictiveness; UK may be more sensitive to messaging inconsistency. Worth pulling any NPS / review-rating geo split.

5. **Is there appetite for a one-time "£9.99 lifetime Hobbyist" tier as a low-friction step between free and subscription?** Pokémon Go did well with one-time raid passes; Geocaching has no equivalent. Could be an A/B test.

6. **What's the hard API cost audit number?** The brief says "$0.05–$0.12 per scan, real cost audit pending." Without a confirmed number, the Option A feasibility assessment above is directional only. Priority: complete cost audit this week.

---

## 6. Sources

**Letterboxd**
- [letterboxd.com/about/pro](https://letterboxd.com/about/pro/)
- [letterboxd.com/pro](https://letterboxd.com/pro/)
- [Five Star Insider — Pro vs Patron](https://www.fivestarinsider.com/letterboxd-pro-vs-patron/)
- [Letterboxd on X — annual sale post](https://x.com/letterboxd/status/1331870887168012290)
- [Letterboxd Wikipedia](https://en.wikipedia.org/wiki/Letterboxd)

**iNaturalist / Merlin / eBird**
- [Merlin — The Story](https://merlin.allaboutbirds.org/the-story/)
- [iNaturalist Financials](https://www.inaturalist.org/pages/financials)
- [iNaturalist spin-off FAQ](https://www.inaturalist.org/pages/spinoff_faq)
- [Bay Nature — iNaturalist strikes out on its own (Sept 2023)](https://baynature.org/2023/09/12/science-nature/urban-nature/inaturalist-strikes-out-on-its-own/)
- [Cornell Lab — The Magic of Merlin](https://www.birds.cornell.edu/home/the-magic-of-merlin/)

**Strava**
- [the5krunner — STRAVA Turns Off Key Features (May 2020)](https://the5krunner.com/2020/05/18/strava-turn-off-key-features-welcome-to-the-paywall/)
- [Outside Online — Strava Wants You Back](https://www.outsideonline.com/outdoor-gear/bikes-and-biking/strava-paywall-core-users-future/)
- [road.cc — Year In Sport paywall](https://road.cc/content/news/strava-year-sport-now-only-subscribers-317425)
- [Wareable — Strava 2020 update](https://www.wareable.com/sport/strava-update-2020-subscription-7978)
- [Robbie Baxter / Medium — Strava CRO David Lorsch interview](https://robbiebax.medium.com/how-strava-built-a-subscription-business-within-a-social-platform-with-strava-cro-david-lorsch-c3779712a30c)
- [Gizmodo — Strava's best features will be subscription-only](https://gizmodo.com/stravas-best-features-will-now-be-subscription-only-1843540292)

**Duolingo**
- [Nicolas Bottaro on Medium — Duolingo 3→8.8% monetization lessons](https://medium.com/@nicobottaro/monetization-7-lessons-on-how-duolingo-increased-premium-users-by-176-from-3-to-8-8-42e8d63b58f2)
- [Papora — Super Duolingo prices 2026](https://www.papora.com/learn-english/super-duolingo-prices/)
- [checkthat.ai — Duolingo pricing](https://checkthat.ai/brands/duolingo/pricing)
- [DealNews — Super Duolingo April 2026 pricing](https://www.dealnews.com/features/duolingo/cost/)

**Pokémon TCG Pocket**
- [PokeBeach — $1.25B first year (Oct 2025)](https://www.pokebeach.com/2025/10/pokemon-tcg-pocket-earned-record-1-25-billion-in-its-first-year-sparked-current-pokemon-tcg-shortages)
- [PocketGamer.biz — $1B in 200+ days](https://www.pocketgamer.biz/pokmon-tcg-pocket-surpasses-1bn-in-just-over-200-days/)
- [Pokémon official Premium Pass FAQ](https://support.pokemon.com/hc/en-us/articles/30331739144596-Pok%C3%A9mon-TCG-Pocket-Purchase-and-Premium-Pass-FAQ)
- [Game8 — Premium Pass worth it?](https://game8.co/games/Pokemon-TCG-Pocket/archives/474488)
- [Screen Rant — TCG Pocket subscription & microtransactions](https://screenrant.com/pokemon-tcg-pocket-subscription-prices-shop-microtransactions-cost/)

**Untappd**
- [Untappd Insiders landing](https://insiders.untappd.com/)
- [Untappd Insider pricing help](https://help.untappd.com/hc/en-us/articles/4409476745492-What-are-my-pricing-options-to-become-an-Untappd-Insider)
- [Untappd blog — annual Insider magnet](https://untappd.com/blog/become-an-annual-untappd-insider-get-a-collectible-magnet/1365)

**Geocaching**
- [Geocaching Newsroom — Premium](https://newsroom.geocaching.com/premium)
- [Geocaching — 2023 pricing update FAQ](https://www.geocaching.com/blog/2023/04/faq-updates-to-geocaching-premium-for-new-subscribers/)
- [Geocaching — Premium features help](https://www.geocaching.com/help/index.php?pg=kb.chapter&id=7&pgid=283)

**Flightradar24**
- [Flightradar24 Premium page](https://www.flightradar24.com/premium)
- [Flightradar24 — Going for Gold](https://www.flightradar24.com/blog/inside-flightradar24/going-for-gold-exploring-some-of-our-favorite-flightradar24-subscription-features/)
- [Flightradar24 — Business subscription](https://www.flightradar24.com/blog/b2b/3-reasons-business-subscription/)
