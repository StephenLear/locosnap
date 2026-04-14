# LocoSnap Paywall Deep Assessment
Date: 2026-04-12

## Current Implementation Summary

| User State | Scan Limit | Collection | Blueprints | Enforcement |
|------------|-----------|------------|------------|-------------|
| Pre-signup (no account) | 3 lifetime | None | None | AsyncStorage + frontend gate |
| Signed-in free | 10/month | 5 items | Pay per credit (0.99) | Supabase profile + backend HTTP 429 |
| Pro subscriber | Unlimited | Unlimited | Unlimited (4 styles) | is_pro flag |

**Pricing:** Pro = 4.99/month or 45/year (25% annual discount). Blueprint credit = 0.99 each.

**Backend enforcement:** Dual gate -- frontend canScan() check + backend scan gate on POST /api/identify. IP rate limit: 20 req/hr. Backend fails open on errors (defensive).

---

## Cost Per Scan -- Actual Breakdown

Each scan triggers 4 parallel API calls to Claude (Anthropic):

| Call | Purpose | Est. Input Tokens | Est. Output Tokens | Est. Cost |
|------|---------|-------------------|--------------------|-----------|
| Vision (claude-3-5-sonnet) | Identify train from image | ~2,000 (incl. image) | ~500 | $0.014 |
| Specs (claude-3-5-sonnet) | Technical specifications | ~800 | ~600 | $0.011 |
| Facts (claude-3-5-sonnet) | Historical facts + summary | ~800 | ~600 | $0.011 |
| Rarity (claude-3-5-sonnet) | Rarity classification | ~800 | ~400 | $0.008 |
| **Total per scan** | | | | **~$0.044** |

Blueprint (if generated): Replicate SDXL ~$0.002 or DALL-E 3 ~$0.04. Not triggered on every scan.

**Working figure: $0.05 per scan** (rounded up for safety margin + Render hosting amortised).

---

## Revenue Per Subscriber

| | Monthly | Annual |
|---|---------|--------|
| Gross price | 4.99 | 45.00 (3.75/mo) |
| App Store/Play Store cut (30% Y1, 15% Y2+) | -1.50 | -13.50 |
| Net revenue | 3.49/mo | 31.50/yr (2.63/mo) |

**Note:** Apple reduces to 15% after year 1 for auto-renewing subscriptions. First-year economics are worse than steady-state.

---

## Current Model Economics

### Scenario: Free user scans 5 times then churns (never subscribes)
- API cost: 5 x $0.05 = $0.25
- Revenue: $0
- Loss: -$0.25

### Scenario: Free user scans 10 times per month for 3 months then subscribes
- API cost during free period: 30 x $0.05 = $1.50
- Revenue once subscribed: $3.49/month net
- Payback: month 1 of subscription
- **This is the ideal conversion path — and the economics work.**

### Scenario: Free user scans 10 times per month indefinitely, never subscribes
- API cost: $0.50/month ongoing
- Revenue: $0
- Loss: -$6.00/year per persistent free user
- **This is the drain — "happy free users" who never convert.**

### Customer Acquisition Cost (CAC)
At different conversion rates, with average 5 scans per free user:

| Conversion Rate | Free Users per Subscriber | API Cost of Free Users | CAC |
|----------------|--------------------------|----------------------|-----|
| 2% (freemium median) | 50 | $12.50 | $12.50 |
| 5% (good freemium) | 20 | $5.00 | $5.00 |
| 12% (hard paywall + trial) | 8.3 | $2.08 | $2.08 |

At $3.49/month net revenue:
- 2% conversion: payback in 3.6 months (if user retains)
- 5% conversion: payback in 1.4 months
- 12% conversion: payback in under 1 month

---

## The Pre-Signup Problem

Current: 3 scans before any account creation. These users:
- Cost $0.15 each in API calls
- Have ZERO conversion path to Pro (no account = no subscription)
- Cannot be emailed, retargeted, or nudged
- Their scan data is lost (AsyncStorage only, not synced)

This is pure cost with no revenue possibility. The only value is "proof of concept" to drive sign-up. The question is whether 3 anonymous scans is the right number, or whether 1 scan then "sign up to continue" would be better.

---

## The "Unlimited for Logged-In" Model (train_lover51 suggestion)

If scanning becomes unlimited for all logged-in users:

### Best case (light users)
- Average user scans 5 times/month = $0.25/month cost
- Revenue from Pro comes only from blueprints + collection lock
- Blueprint credits at $0.99: need 1 purchase every 4 months to cover scanning cost
- **Marginally viable if most users are light scanners.**

### Worst case (power users)
- Enthusiast scans 50+ times per month = $2.50+/month cost
- If they never buy Pro or credits: pure loss
- 100 power users = $250/month in API costs with $0 revenue
- **Not viable at any realistic scale.**

### The fundamental problem
Removing the scan limit removes the primary reason to upgrade to Pro. "Unlimited scans" is the headline Pro feature (per the current paywall UI feature list). If free users already have unlimited scans, Pro becomes "blueprints + collection" — both secondary features that only matter after the user is already deeply engaged. The upgrade trigger moves from scan 11 (immediate, habitual) to "I want a blueprint" (optional, sporadic).

**Verdict: Not viable.** The scan limit IS the paywall. Remove it and the business model collapses.

---

## Model Comparison -- Five Options

### Option A: Current Model (10 scans/month free)
- **Pros:** Generous enough for habit formation. Monthly reset keeps users coming back. 10 is enough to see the product working.
- **Cons:** 10 might be too generous — a trainspotter doing 2-3 outings per month can stay free indefinitely. The monthly reset means no pressure to convert.
- **API cost per free user:** ~$0.25-$0.50/month
- **Expected conversion:** 2-5% (freemium)
- **Risk:** Persistent happy free users who never convert

### Option B: Reduce Free to 5 Scans/Month
- **Pros:** Tighter limit creates conversion pressure earlier. Still enough to prove value. Halves API cost per free user.
- **Cons:** May feel stingy to new users. "5 scans remaining" is less inviting than "10 scans remaining."
- **API cost per free user:** ~$0.13-$0.25/month
- **Expected conversion:** 3-7% (tighter limit = more pressure)
- **Risk:** Higher churn if users feel limited too early

### Option C: Hard Paywall with 7-Day Free Trial
- **Pros:** Highest conversion rate (12% median per RevenueCat). Full access during trial forms the habit. Clear deadline creates urgency. Users who trial are high-intent.
- **Cons:** Downloads will drop — many users won't start a trial for an unknown app. TikTok viral moments (where someone scans a train they just saw) are killed if there's a paywall in the way.
- **API cost:** Only during 7-day trial (~3-5 scans = $0.15-$0.25 per trial user)
- **Expected conversion:** 10-15%
- **Risk:** Kills organic discovery and TikTok-driven impulse downloads. Bad for a new app still building awareness.

### Option D: 3 Lifetime Scans Then Hard Paywall with 7-Day Trial
- **Pros:** Discovery period (3 scans) proves the app works without any commitment. Then trial converts serious users. Low API cost exposure.
- **Cons:** 3 scans may not be enough to form a habit. Users may scan 3 times, think "cool", and leave without ever hitting the trial. The jump from "free scans" to "start a subscription" is jarring.
- **API cost:** $0.15 per user who scans 3 times, then trial users cost ~$0.15-$0.25 more
- **Expected conversion:** 8-12% of those who start the trial, but trial start rate is the question
- **Risk:** Two-step funnel (scan → trial → subscribe) has more drop-off points than one-step

### Option E: Tiered Limits (Recommended)
- **Pre-signup:** 1 scan (prove it works, not 3 — reduce wasted API cost on anonymous users)
- **Signed-in free:** 5 scans/month (enough for casual interest, not enough for regular use)
- **Pro trial:** 7-day unlimited trial offered at scan 3 or 4 (after value is demonstrated but before frustration)
- **Pro:** Unlimited scans, unlimited collection, unlimited blueprints
- **Pricing:** Keep 4.99/month, 45/year

**Why this works:**
1. Anonymous scan reduced from 3 to 1 — enough to see the magic, saves $0.10 per non-converting anonymous user. The "sign up to scan more" trigger is immediate.
2. 5/month for free users is generous enough that nobody feels cheated, but tight enough that a trainspotter who goes out twice a month will hit it.
3. The trial offer appears AFTER the user has seen 3-4 successful scans — they know the product works, the trial feels like an upgrade, not a trap.
4. Collection lock at 5 items (already implemented) creates a secondary trigger: "I have 5 trains saved and can't save more."

---

## UK Download Factor

UK downloads are 2:1 over Germany. This changes the paywall analysis:

1. **UK users are the primary conversion target right now** — not German users
2. **UK users are on iOS primarily** — iOS users convert to subscriptions at higher rates than Android
3. **UK App Store pricing is in GBP** — the 4.99/month price is natural for UK users
4. **UK rail content does not exist yet** — there's an untapped content-to-download pipeline for UK trains
5. **Implication for paywall:** The paywall should be optimised for UK users first. UK trainspotters are more likely to be habitual (UK has a strong spotting culture) and more likely to hit the scan limit regularly.

If UK users are converting at 2:1, the paywall may actually be working well for UK users but poorly for German users (who may be Android-heavy and waiting for Play Store, or less likely to subscribe in general). The paywall change should not hurt the UK conversion that's already working.

---

## The CTA Button Issue

Current CTA: "Subscribe" (paywall.tsx line 515)

The app-paywall-strategy skill specifically flags this: "Replace every paywall CTA button with 'Continue' instead of 'Subscribe', 'Unlock', or 'Get Premium'."

"Subscribe" signals commitment. "Continue" signals a next step. This is a zero-code-risk change that could improve conversion immediately.

---

## Recommendation

**Short-term (next build, low risk):**
1. Change CTA button from "Subscribe" to "Continue" — proven uplift, zero risk
2. Add "We'll remind you before your trial ends" safety text below CTA
3. Reduce pre-signup scans from 3 to 1 — saves ~$0.10 per anonymous user, drives account creation earlier

**Medium-term (requires testing):**
4. Reduce free monthly scans from 10 to 5 — halves API cost per free user, creates earlier conversion pressure
5. Add "Start 7-day free trial" offer at scan 3 for logged-in free users — appears in context when user has seen value
6. Add trial-end push notification 24h before charge

**Not recommended:**
- Unlimited scanning for logged-in users (not viable at $0.05/scan)
- Hard paywall on install (kills TikTok-driven impulse downloads while the app is still building awareness)
- Removing the monthly limit entirely (primary upgrade trigger)

---

## Open Questions for User Decision

1. Is 1 pre-signup scan too aggressive, or is it the right balance of "show the magic" vs "sign up now"?
2. Is 5 scans/month the right number for logged-in free, or should it be 3?
3. Should the 7-day trial be offered proactively at scan 3, or only when the user hits the limit?
4. Should blueprint credits remain as a separate purchase, or fold them into Pro only?
5. Should UK-specific pricing be considered (e.g. 3.99 instead of 4.99 to test price sensitivity)?
