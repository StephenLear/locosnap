# LocoSnap Monetisation Redesign — "The Club" (v1.0.35)

**Date:** 2026-05-22
**Status:** Design approved — ready for implementation planning
**Origin:** Brainstorm session 2026-05-22, following the break-even analysis and the subscriber-growth research brief of the same day.

## 1. Why

LocoSnap is losing money. Costs run ~$300-375/month (dominated by the Anthropic API at ~$295; caching is at 97.9% — maxed — so it will not fall). Net revenue is ~$35-85/month. Break-even needs roughly 120-140 paying subscribers; there are ~12.

Root causes:
- Free users cost API money (~$0.008/scan) and the overwhelming majority never pay.
- Of 374 registered users: **137 (37%) have never scanned, 125 (33%) did 1-5 scans, 112 (30%) used all 6 free scans and hit the wall.**
- Free-to-paid conversion (~2%) is the freemium median — not broken, but the structural floor.
- The paywall is subscription-only and buried on the Profile tab — a non-subscriber has no way to become a payer except a €2.99/month commitment.

## 2. The model — "The Club"

LocoSnap is reframed as **a club for trainspotters, by trainspotters**, with two plainly-stated promises: **no ads, ever. No data selling, ever.** This is the product's character and its sharpest line against Google Lens / big tech — they monetise the user; the club does not.

Three tiers:

### Free taster
- ~3 scans, no account, no payment. Full results (class, specs, facts, rarity); the 3 spots are visible.
- Purpose: feel the magic before any ask. Deliberately small — fair *only because* the next step is just €1. (A 3-scan taster in front of a subscription would be far too tight, as tester Steph said of the old model.)

### €1 club membership — one-time
- A one-time €1 payment, framed as **joining the club**: the €1 genuinely helps run the club (contributes to API/server cost).
- Member gets: their **collection** (kept and viewable), an **ongoing allowance of ~4 scans/week**, the no-ads / no-data guarantee, achievements.
- Implemented as a **non-consumable** in-app purchase (permanent; restorable).
- Why it cannot grant unlimited scans: scans are an ongoing per-use cost; a single payment cannot fund an unbounded ongoing cost. Membership carries a capped allowance; unlimited scanning lives in Pro, where recurring revenue funds recurring cost.

### Pro — subscription
- Unlimited scans + the premium depth: blueprints, rarity analytics, comparison, leaderboard.
- Plans: **Annual ~€24.99/yr — the hero** (visually pushed as best value), Monthly, Lifetime €79.99.
- The €1 membership **replaces** the old "€1 first month of Pro" intro — there must be only one "€1" in the app. Pro is priced normally.

## 3. The member scan allowance

A €1 member gets **~4 scans/week**, ongoing. Per-scan ≈ $0.008; €1 ≈ $0.92 net after the store cut.
- A member who maxes 4/week ≈ 17 scans/month ≈ **$0.13/month** — the €1 covers ~7 months of even a maxing member; a casual member costs cents per year.
- Bounded and negligible against the ~$295/month Anthropic bill.
- Small enough that Pro's "unlimited" stays clearly worth paying for.
- **Tunable** — 4/week is the starting point; adjust from data.

## 4. Placement & UX

### Home screen — tier-aware Pro card
Replace today's thin dismissable banner with a **prominent, persistent, tier-aware card** near the top of the scan screen:
- Taster: "Join the LocoSnap club — €1. No ads, no data selling, ever." → opens the Join screen.
- Member (not Pro): a Pro upsell → opens the Pro paywall.
- Pro: no card.

### Auto-open (Approach B — visible + peak-moment)
The relevant offer opens itself:
- **Once**, after the user's first RARE/LEGENDARY scan (peak excitement) — persisted flag, no repeat nagging.
- At the **scan wall**: taster's 3 used → Join screen; member's weekly allowance used → Pro paywall.
- Pro users never see auto-opens.
- **Every auto-open must be cleanly dismissable** — see §7.

### New "Join the Club" screen
A dedicated, warm screen: the club, the two promises, €1 one-time. Distinct from the Pro paywall.

### Pro paywall restructure
- **Annual = hero** — largest tile, pre-selected, "best value" badge, per-month equivalent shown.
- Monthly and Lifetime €79.99 below.
- **Fix the confusing intro copy** — the current "30% OFF FIRST 3 MONTHS / after 3 months regular price applies" on the *annual* tile is contradictory for a yearly plan; state each plan's terms clearly and accurately.
- Lead the feature bullets with "Unlimited scans" and "Your whole collection."

## 5. Existing users — convert, don't grandfather

Existing users are **not** grandfathered into the member tier — that would upgrade hundreds of non-payers from a finite, zero-ongoing-cost state (6 lifetime scans) into an ongoing-cost tier for €0.
- **Existing Pro subscribers and lifetime buyers** keep their entitlement (via RevenueCat).
- **Existing free users** keep their legacy 6-lifetime-scan status — they lose nothing (their wall just gains a cheaper €1 door). On next app open they get the taster → €1-join offer.
- **The 112 wall-hitters are the priority conversion pool** — pre-qualified, and the €1-join is the cheap door built for them.
- The 137 zero-scan users cost ~nothing and convert ~nothing; email re-engagement is the only lever and is out of scope for v1.0.35.

## 6. What v1.0.35 builds
- New €1 one-time non-consumable IAP ("club membership") — App Store Connect + Play Console + RevenueCat.
- The "Join the Club" screen.
- Tier logic: taster (3 scans) / member (collection + ~4/week) / Pro; the member weekly-allowance counter.
- The tier-aware persistent home card (replaces the dismissable banner).
- Auto-open triggers (first rare/legendary scan; the walls) — all dismissable.
- Pro paywall restructure (annual hero; corrected subscription/intro copy).
- Club positioning + no-ads/no-data guarantee copy throughout, EN/DE/PL.
- Retire the "€1 first month of Pro" intro.

## 7. Review readiness (Apple + Google)
- **Auto-open paywall must be cleanly dismissable** — clear working X; never a "choose a plan to continue" hard block; the user can always dismiss and use the app. (Top rejection risk.)
- **Subscription terms clear at the point of purchase** (Apple 3.1.2) — price, period, renewal, intro stated by the buy button.
- **Keep the Terms-of-Use (EULA) link** in the app description (all locales) and on the paywall — v1.0.32 was rejected for omitting it on auto-renewable subscriptions.
- **"No ads, no data selling" must match the App Privacy label / Play Data-safety form** — both accurate; wording precise ("we don't sell your data"). No ad SDK means no IDFA/tracking prompt.
- **€1 IAP** = non-consumable, must work with Restore Purchases; use a clean icon-style review image (the Lifetime IAP was auto-rejected when its image was classified as a screenshot).

## 8. Honest scope — what this does and doesn't do
- This is the **monetisation/conversion layer**. It makes nearly every user either a €1+ payer or a cheap 3-scan taster — stopping the per-user bleed — and builds a warm pipeline into Pro.
- It does **not**, alone, reach break-even or fix retention. The 2026-05-22 research brief found the Day-1 retention cliff is the larger gate; that is a **separate work stream** (onboarding / time-to-first-value / the collection habit loop).
- It deliberately trades **free-user volume for revenue-per-user** — there will be fewer "members" than today's free users, because those free users were a cost, not customers.
- Break-even still depends on growing Pro subscribers (~120-140) plus sustained acquisition.

## 9. Open parameters to tune from data
- Member allowance: 4 scans/week (starting point).
- Free taster: 3 scans (starting point).
- Auto-open: which rarity tiers trigger it (RARE + LEGENDARY assumed).
- Annual price and intro structure on the Pro paywall.
