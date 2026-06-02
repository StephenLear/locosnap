# Plan — Annual-first paywall, free-tier tightening, and cliff-conversion comms

> Written 2026-06-02. Status: **Move C (free-tier 6→3) IMPLEMENTED in code** (frontend uncommitted/awaits build, backend awaits Render deploy; 232/232 + 201/201 tests pass). Welcome email updated. Move A (annual repricing €3.99/€29.99) + €1-intro-on-annual + Move B (cliff comms) **still pending — store/RC config + comms, not done.** Decisions locked: 3 free scans (not 4), monthly €3.99 / annual €29.99 (~37% off) in DE/FI/NL/FR, €1-first-month→annual as the Pro trial. Complements `project_ai_cost_baseline` + the pHash lever in `docs/plans/2026-05-24-vision-skip-on-warm-match.md`. Decision memory: `project_monetization_strategy`.

## Why this exists — the unit-economics problem

LocoSnap is deeply underwater on unit economics:

- **Revenue (RevenueCat, 2026-06-02):** MRR US$41; **US$28 actually collected in the last 28 days.**
- **Cost:** Anthropic API ~US$140–283/mo (the $283 is pre the 2026-06-01 1h-cache-TTL fix; clean post-fix number due ~2026-06-04/05). On 2026-06-01: 107 spots / $23.34 = $0.218/scan raw, ~$0.19/scan after removing dev-eval contamination — still ~the old baseline (deploy day, TTL benefit not yet accrued).
- **Conversion:** 16 active subs / 588 active customers ≈ **2.7%** — sitting almost exactly on the freemium floor (RevenueCat freemium median 2.1%).
- **Install volume:** ~17 new customers/day (479/28d) — **too low for clean A/B testing** (industry threshold ~300/day; Cal AI needed 123 experiments to tune its paywall).

**The structural trap:** at 2.7% conversion with a real per-scan cost, *every new free user enlarges the loss.* Growth makes it worse, not better. Cost reduction is largely exhausted (1h TTL + canonicalisation shipped; prompt-trim, two-stage, Haiku-vision, GPT-4o all tested and rejected — see `project_ai_cost_baseline`). So the lever must be **monetisation: conversion, LTV, and the cost of free users.**

## The 16 subscribers are really 5 stable + 11 at risk

Parsed from RevenueCat recent transactions (2026-06-02):

- **Stable (5):** 3× App Store Pro Annual (~$35, locked 10–11 months) + 2× monthly full-price (~$3.50, one a proven renewal). ~$15-16/mo of the $41 MRR.
- **At risk (11):**
  - **8× monthly on the £1/€1 intro** — hit ~$4.80 at renewal in the next 11-30 days; convert or cancel. **This is the cliff.**
  - **3× legacy Play prepaid** — expire in 9h / 3d / 7d and **do not auto-renew** (legacy base plan). Near-certain churn unless manually re-purchased.

The data *is* the annual-retention finding made flesh: the only stable cohort is annual; the fragile cohort is monthly-intro.

## What the research says (deep-research pass, 2026-06-02; 21 sources, 25 claims adversarially verified)

Verified (high confidence unless noted):

1. **Hard paywall converts ~5× better than freemium** on D35 download-to-paid (10.7% vs 2.1%, RevenueCat 2026) — **but survivorship-biased**: it filters harder, doesn't convert better. Y1 retention near-identical (hard 27% vs freemium 28%). Advantage is **softening** (12.1%→10.7% YoY). Adapty finds *soft* paywalls convert ~50% better at a different funnel stage.
2. **Hard paywall risks:** higher refunds (5.8% vs 3.4%), negative App Store reviews, and Apple rejection (RevenueCat's two named risks).
3. **RevenueCat explicitly recommends a hard paywall / gating for "high unit economics — AI features with significant per-user costs"** — textbook LocoSnap. *But the recommended mechanism is a credit/quota model (free allowance → paid packages), and LocoSnap's 6-free-scans is already a primitive version of that.* Tune it, don't switch paradigms.
4. **AI free trials are a specific cost-abuse vector** ("generate high-cost output, then churn before paying"); AI apps churn ~30% faster. Favour a **credit-capped** trial over an unlimited long one.
5. **Annual-first confirmed:** annual retains **2.6× better** than monthly (44.1% vs 17.0% Y1).
6. **Longer trials convert better:** 17-32 day 42.5% vs ≤4-day 25.5% (~1.7×) — weigh against AI cost-abuse → credit-cap it.
7. **Higher price as quality signal (correlational):** high-priced apps convert ~2× better and earn ~6× LTV/payer ($62.19 vs $10.69). €2.99 is low-end. Handle carefully given DE/PL price sensitivity.
8. **Closest analog Cal AI** (AI photo-scan): onboarding hard paywall + 3-day trial — but tuned via **123 A/B experiments**, which LocoSnap cannot replicate at 17 installs/day. Directional only.

Refuted in verification (do not use): airbridge.io 12.1%/2.2% and 45.7%/26.8% trial figures. Use only RevenueCat numbers.

Unverified / open: exact best free-tier **size** (1 vs 3 vs 5), annual **conversion** (only retention confirmed), and the specific paywall models of PlantNet/Merlin/Seek/Blinkist.

## Decision

**Do NOT switch to a full onboarding hard paywall** (survivorship-biased, softening, collapses the 17/day organic funnel, review-bomb + Apple-rejection risk, un-A/B-testable). **Instead:** tune the metered/credit model already in place, make **annual the hero**, and **win back the cliff** — measured by phased before/after cohorts, not A/B tests.

User-chosen sequencing (2026-06-02): **(1) paywall work to prioritise annual over monthly + a real annual cost reduction, then (2) comms to all cliff subs to convert them to annual.** Free-tier cut and win-back follow.

## The plan (sequenced, costed, measurable at low volume)

Change ONE thing at a time; read as before/after over 2–4 weeks.

### Move A — Annual-first paywall + real annual discount (FIRST, user-prioritised)
- **Reorder the paywall** so annual is the hero/default tile; monthly secondary; simplify (one hero plan, others a tap away — "simpler paywalls outperform").
- **Give annual a real discount.** Today €34.99/yr vs €2.99×12 = €35.88 = **2.5% off (no incentive).** Candidate: **~€24.99/yr (≈8 months, ~30% off)** — a genuine reason to choose annual.
  - Cost check passes: €25–35 upfront covers ~140–190 scans; most users won't exceed that in a year, so annual is good for cost too.
  - Per-country tiers (DE/PL/UK) must be set deliberately — see `pricing_localisation` memory. PL especially needs annual-first framing.
- **Point the €1 intro hook at annual** (or add an annual intro) instead of monthly, so acquisition stops manufacturing the monthly cliff.
- **Implementation surface:** `frontend/app/paywall.tsx` (reads `offerings.current.availablePackages`); RevenueCat offering/package order; App Store Connect + Play Console price points for the new annual price. No app rebuild needed for offering/price changes; paywall *reorder* is a code change → needs a build.

### Move B — Comms to cliff subs → convert to annual (SECOND, user-prioritised)
- Target: the 8 monthly-intro subs (+ 3 prepaid) before they lapse.
- Mechanism options (verify in RC/stores): an **annual upgrade/cross-grade offer**, or a **win-back annual offer**; the existing `winback_3mo_30off` is monthly-oriented — may need an annual win-back variant.
- Comms channel: email where we have addresses (some captured in `project_revenuecat_topology`), in-app message, or store-surfaced offer. **Sending requires explicit confirmation per send; draft + recipient list reviewed before anything goes out.** Translate per locale (DE/PL/EN) with English under each draft.
- Mind the mechanics: you generally can't silently move a monthly sub to annual — the user cancels monthly and buys annual, or accepts an upgrade offer. Make the path one-tap.

### Move C — Cut the free tier (cost + conversion; biggest single cost lever)
- 6 free scans × ~$0.18 ≈ **$1.08 of pure cost per new user** before they pay; ~97% never convert.
- **Recommended: 6 → 3** (halves free-tier cost, preserves a minimal collection/wow, reversible). Step to **1 ("one wow scan, then the wall")** only if cost stays underwater and conversion doesn't move after 3–4 weeks.
- Source of truth: `MAX_FREE_SCANS` in backend (see `project_scan_limits`). Free tier = 6 **lifetime** (not daily).

### Annual-discount publicity — NEXT-BUILD touchpoints (decided 2026-06-02, not yet built)
The €1-intro stays on **monthly** (a 1-month intro can't cleanly attach to a yearly plan; and €1-not-free is the cost-safe trial for an AI app). Annual is pushed by the discount + placement instead. To publicise the ~37% annual discount:
- **Sign-up:** welcome email already mentions "best value annual" (done, ships with backend deploy).
- **Paywall SAVE % badge:** dynamic "SAVE 37%" badge on the annual tile, computed from monthly vs annual `priceString` (stays truthful if prices change). Highest-leverage single touchpoint. **Bundle into the next build** (NOT v1.0.36 — would show a misleading ~3% until the €29.99 was live; now it's live, so safe for the next build).
- **Monthly → annual upsell nudge:** prompt existing monthly subscribers (~1 week in) to switch to annual and save ~40%. Converts the monthly / £1-intro cohort into higher-LTV annual (annual retains 2.6× better). New feature, next build / backlog.
- Note: with the free tier now 3 scans, there is little scan-runway to drip annual messaging to *free* users — the two real homes are the paywall badge and the monthly-subscriber upsell.

### Move D — Do NOT
- No full onboarding hard paywall. No weekly tier (lowest LTV, cannibalises annual, dangerous at per-scan cost). No blind monthly price hike (DE/PL sensitivity). Reconsider **€89.99 lifetime** (one payment, unlimited scans forever = long-term-loss risk for heavy users) — de-emphasise or reprice.

## Free-tier trade-off table (Move C)

| Option | Free cost/user | Conversion pressure | Wow / word-of-mouth | Review risk | Reversible |
|---|---|---|---|---|---|
| Keep 6 | ~$1.08 | Weak (2.7% today) | Full | None | — |
| **Cut to 3 (recommended)** | ~$0.54 | Moderate | Good | Low | Yes |
| 1 wow → wall | ~$0.18 | Strong | Thin | Medium | Yes |
| Full onboarding hard paywall | ~$0 | Strongest | None | High | Funnel-damaging |
| Credit packages (buy more) | metered | Moderate | Good | Low | Yes |

## Measurement (because 17 installs/day defeats A/B)
- **Sequential before/after cohort comparison**, one change at a time, 2–4 week windows.
- Pull from Supabase: distribution of scans-per-free-user (sharpens the free-tier-size decision and the cost estimate), conversion rate by week, annual:monthly mix.
- Baseline the clean post-TTL-fix cost first (~2026-06-04/05) before crediting any cost change to a paywall move.

## Open questions to resolve before/while implementing
1. Exact free-tier size (research unverified) — let the phased Move C answer it with our own data.
2. RC/store mechanics for monthly→annual conversion and an annual win-back offer (verify before drafting comms).
3. Which cliff subs we can actually reach (email coverage) and via which channel.
4. New annual price per country (DE/PL/UK) — model against heavy-scanner cost and `pricing_localisation`.

## Caveats (weight the data honestly)
- Every benchmark is a **correlational tier median**, not a controlled experiment — hard-paywall apps self-select for high-value categories; the 5×/8× gaps are partly selection bias, NOT a guaranteed lift from switching.
- RevenueCat is the canonical benchmark but is a paywall-optimisation vendor; treat "works well when" framing accordingly.
- Hard-paywall advantage is softening; hybrid/credit is the emerging 2026 default for AI apps — a live trend, not a settled standard.

## Sources (verified)
RevenueCat State of Subscription Apps 2025 + 2026; RevenueCat hard-paywall playbook + AI-cost/AI-pricing guides; Adapty 2026 paywall report; Superwall Cal AI case study; SaaStr RevenueCat summary; neoads survivorship-bias analysis. Full claim-level citations in the 2026-06-02 deep-research output.
