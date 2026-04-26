# Paywall Review — Prep Brief
Date: 2026-04-24
Status: data-gathering / pre-review (not a decision document)

> Companion docs:
> - Card v2 plan: `docs/plans/2026-04-24-card-v2-implementation.md` — the card v2 work changes what "Pro" naturally gates and may fix conversion partially before any pricing change
> - Earlier paywall work: `docs/plans/2026-04-12-paywall-deep-assessment.md`
> - Live paywall enforcement: `frontend/store/authStore.ts:52-54` (`MAX_FREE_SCANS = 3` lifetime); backend `routes/identify.ts checkScanAllowed`
> - Architecture reference: `docs/ARCHITECTURE.md` §"Free account" line 267

---

## 1. Why this brief exists

Two signals on 2026-04-24 forced this:

1. **Steph's catch** — `frontend/app/(tabs)/profile.tsx:541` is still showing "10 scans/month free" to guest users while enforcement is 3 lifetime. Bait-and-switch territory.
2. **DE TikTok comment on the Frankfurt airport video** — *"warum aber nur drei gratis am tag das übelst nervig"* — a real DE user thinks 3 scans = daily limit AND finds that "extremely annoying". If they understood it's actually 3 lifetime, the reaction would be worse.

Combined with the unit economics (below), the existing model is too tight on perception AND too generous on absolute compute cost. The review needs to happen.

---

## 2. Current state — the unit-economics reality

### 2.1 Revenue (30 days, ending 2026-04-22, iOS only)

| Metric | Value |
|---|---|
| First-time downloads | 134 |
| Redownloads | 7 |
| Impressions | 1,720 |
| Product page views | 203 |
| Conversion rate (impressions → install, daily avg) | 11.4% |
| Conversion rate (download → paid) | 3.0% (4 IAPs / 134 FTDs) |
| In-app purchases (count) | 4 |
| Proceeds | $26 |

### 2.2 Estimated variable costs per scan (rough, needs audit — see §5.1)

| Component | Provider | Approx. cost per call |
|---|---|---|
| Vision (train ID) | Claude Sonnet 4 OR GPT-4o Vision | $0.01–$0.03 |
| Specs | Claude Sonnet 4 OR GPT-4o | $0.005–$0.015 |
| Facts | Claude Sonnet 4 OR GPT-4o | $0.005–$0.015 |
| Rarity | Claude Sonnet 4 OR GPT-4o | $0.003–$0.008 |
| Blueprint | Replicate SDXL OR DALL-E 3 | $0.03–$0.05 |
| Wikidata enrichment | Free | — |
| **Per-scan total** | | **~$0.05–$0.12** |

### 2.3 Implied unit economics (very rough)

- 134 downloads × ~4 scans average = ~536 scans/month
- API cost: 536 × $0.05–$0.12 = **$27–$65 per month in variable cost alone**
- Revenue: $26
- **Conclusion: roughly breakeven-to-loss at unit level**, before fixed costs (Render Starter $7/mo, Supabase free tier, EAS pay-as-you-go, Sentry/PostHog free tiers, RevenueCat fees)

This is the actual structural problem, not the perceived stinginess.

### 2.4 Where the paywall sits today (mechanics, for reference)

- **Anonymous (no signup):** `PRE_SIGNUP_FREE_SCANS = 3` — 3 trial scans before signup wall
- **Free account (signed in):** `MAX_FREE_SCANS = 3` lifetime (column legacy-named `daily_scans_used` but is actually a lifetime counter since 2026-04-12)
- **Pro:** unlimited scans, all blueprint styles, full leaderboard
- **Theoretical max free lifetime:** 3 anonymous + 3 post-signup = 6 scans (assuming user does anonymous trial then converts to free account)
- **In-app messaging:** trial banner on scan screen says "{{remaining}} free scans left" (correct); profile guest CTA says "10 scans/month free" (STALE — Steph's catch)

---

## 3. The real question — is the gate on the right thing?

The current gate punishes the **core magic moment** (the reveal). User scans, sees the AI identify a train + show a blueprint + call out rarity, feels the magic — then hits the wall at scan 4 before they've felt enough product to justify paying.

The card v2 plan proposes a richer card surface: provenance, Verified vs Unverified tiers, collectible card feel, share card with burned-in identity, sighting serial. **Pro could naturally gate the "collectable hobby" dimension** rather than the count of identifications. That's a fundamentally different value prop and may convert better — because the user has already *felt* the magic before being asked to pay for the *deepening* of it.

This is the same model as Letterboxd (free = log films, Pro = stats / lists / extras), eBird (free = log birds, Pro features layered on), Strava (free = log activities, Pro = analytics).

---

## 4. Three model directions to evaluate (NOT picking one yet)

### 4.1 Option A — Gate depth, not count (recommended for evaluation)

- Free: unlimited identifications. Class + operator + 1–2 fun facts + thumbnail card.
- Pro: full specs, full facts, rarity tier, AI blueprint, collectible card with provenance, leaderboard eligibility, share card with verified watermark, all blueprint styles.
- **Pros:** preserves the magic of "scan anything"; aligns Pro with the deepening-engagement loop; matches every successful hobby-collector app.
- **Cons:** requires significant per-scan cost reduction (every scan now costs us — see §5.2); risks free tier being "good enough" for some users who'd otherwise have converted; needs UI rework to render the "depth gate" elegantly.
- **Compatible with card v2:** yes — directly. This is what card v2 makes possible.

### 4.2 Option B — Credit / one-off purchase model

- Free: 3 lifetime scans (current).
- Tier 1: £0.99 → 10 scans (no time limit).
- Tier 2: £2.99 → 50 scans.
- Pro subscription: £4.99/mo → unlimited.
- **Pros:** captures revenue from the 90% who'll never subscribe but might drop a quid; price-anchors the subscription as good value.
- **Cons:** more SKUs to manage in App Store + Play; subscription LTV may suffer if users park on tier 1; requires rebuilding the paywall UX.
- **Compatible with card v2:** yes — Pro still gates collectable features. Credit packs just add a fourth path.

### 4.3 Option C — Time-refreshing free tier

- Free: 3 scans per week (refreshes Mondays).
- Pro: unlimited.
- **Pros:** reframes the limit favourably ("back Monday" reads better than "gone forever"); keeps users engaged at low intensity.
- **Cons:** more expensive per user (52 weeks × 3 = up to 156 free scans/year vs current 3 lifetime); only viable if we also slash per-scan cost (see §5.2); potential abuse vector (delete app, reinstall = fresh 3).
- **Compatible with card v2:** yes — orthogonal to the gate-on-depth question.

### 4.4 Stub options noted but not detailed (for future consideration)

- **Ad-supported free tier** — pre-roll an interstitial before each free scan beyond 3. Adds revenue from non-payers but risks brand quality on TikTok-driven traffic.
- **Free tier requires sign-in immediately** — no anonymous trial. Tightens the loop but probably hurts top-of-funnel.
- **Regional pricing** — App Store + RevenueCat already handle this; not a structural change.

---

## 5. Data pulls needed BEFORE the review session

Three pieces of information that will turn this from speculation into a decision.

### 5.1 Per-scan API cost audit

**Goal:** know exactly what each scan costs us, broken down by provider and call type.

**How:**
- Anthropic Console → Usage tab: pull token spend for the past 30 days, grouped by model.
- OpenAI Platform → Usage: same.
- Replicate dashboard: image-generation count + cost.
- Cross-reference against PostHog `train_identified` event count for the same period.
- Compute: total cost ÷ total scans = real per-scan cost.

**Output:** populate the §2.2 table with verified numbers.

**Estimated time:** 30–45 min of dashboard work.

### 5.2 Scans-per-user histogram

**Goal:** see whether users are clustering at exactly 3 scans (the gate) or distributing along a long tail.

**How:** Supabase SQL on `spots` joined to `profiles`:

```sql
SELECT
  scan_count,
  COUNT(*) AS users_at_count
FROM (
  SELECT
    p.id AS user_id,
    p.is_pro,
    COUNT(s.id) AS scan_count
  FROM profiles p
  LEFT JOIN spots s ON s.user_id = p.id
  WHERE p.created_at >= '2026-03-25'  -- last 30 days
  GROUP BY p.id, p.is_pro
) AS counts
GROUP BY scan_count
ORDER BY scan_count;
```

Plus a Pro-vs-free split:

```sql
SELECT
  is_pro,
  COUNT(*) AS users,
  AVG(scan_count) AS avg_scans,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY scan_count) AS median_scans,
  MAX(scan_count) AS max_scans
FROM (
  SELECT
    p.id, p.is_pro, COUNT(s.id) AS scan_count
  FROM profiles p
  LEFT JOIN spots s ON s.user_id = p.id
  WHERE p.created_at >= '2026-03-25'
  GROUP BY p.id, p.is_pro
) c
GROUP BY is_pro;
```

**Output:** if the histogram has a sharp spike at exactly 3, the gate is the bottleneck. If it's long-tail with no spike, the gate isn't what's killing conversion — marketing/onboarding is.

**Estimated time:** 15 min in Supabase SQL editor.

### 5.3 Cohort first-scan funnel

**Goal:** of users who download, how many actually do their first scan, and how quickly?

**How:** PostHog cohort analysis (already integrated) — funnel from `app_launched` → `train_identified`. Time buckets: 1 hour, 24 hours, 7 days, never.

**Output:** if a large fraction never scans even once, the paywall isn't even where we're losing them. Onboarding fix is upstream of any paywall change.

**Estimated time:** 20 min in PostHog.

---

## 6. Cheap near-term mitigation (independent of the review)

Independent of the strategic review, **per-scan cost can probably be cut 30–60% with no UX impact**:

- **Specs + facts + rarity prompts on Haiku 4.5 instead of Sonnet 4.** Haiku is roughly 10× cheaper for these short, structured calls. Quality in practice should be indistinguishable for the prompt patterns we use (per the model card and our own existing override logic). Vision stays on Sonnet (image quality matters more there).
- **Aggressive trainCache lookups.** `trainCache.ts` already exists. Ensure it short-circuits before any AI call when class+operator+language hash matches a recent entry (within N days). Most popular classes (BR 101, Class 66, Sm5, etc.) get scanned repeatedly across users — those scans become near-free after the first.
- **Defer blueprint generation for free users until they convert.** Show the placeholder + "Pro to unlock blueprint" CTA. Cuts the most expensive single component ($0.03–$0.05 per scan) entirely from free-tier compute.

These three together could halve the variable cost without any pricing change. **Worth a separate ~90-min session before the review** so we're not running the strategic conversation under cost pressure that we could have already eased.

---

## 7. Open questions for the review session

1. **Are we willing to make the free tier "feel unlimited" if the cost economics support it?** Option A (gate depth not count) only works if §5.2 audit + §6 mitigations make per-scan cost trivial.
2. **What's the right anchor price for Pro?** Currently the Pro tier price isn't documented in this brief — needs pulling. Is it £2.99/mo, £4.99/mo, £9.99/mo? Annual vs monthly mix?
3. **Do we want one-off purchases (Option B) at all, or is subscription-only cleaner?** RevenueCat supports both; the question is whether the SKU complexity is worth the revenue from non-subscribers.
4. **How do we handle the existing Pro grants** (Steph, Oula, vattuoula, etc.) under any new model? They keep what they have, full stop — but worth saying that explicitly so they hear it from us.
5. **Marketing copy alignment.** Whatever model we pick, every external surface needs to match in one pass: profile.tsx:541 ("10 scans/month free" → fix), App Store + Play Store listings, TikTok ad scripts, launch videos, in-app trial banner.
6. **Refund policy for users who paid at a less-favourable model that we're then deprecating?** Edge case but worth thinking about before we change anything.

---

## 8. Suggested timing

1. **Now → next session:** §5.1, §5.2, §5.3 data pulls. Populate the brief.
2. **Next 1–2 sessions:** Card v2 Phase 0.4d → Phase 1 ships in v1.0.21. Don't change the paywall mid-flight.
3. **After v1.0.21 lands and we have first real Verified-tier data:** dedicated paywall review session. Walk through the data, pick a direction, write an implementation plan.
4. **Before v1.0.22 ships:** §6 cost mitigations, in parallel with the review.

**Do not change the paywall before card v2 phase 1.** The card v2 work changes what Pro naturally gates; making a pricing decision before that lands is decision-making with old context.

---

**End of brief — to be populated as data is pulled and decisions are made.**
