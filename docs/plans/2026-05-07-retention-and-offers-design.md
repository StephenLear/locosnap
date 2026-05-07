# LocoSnap — Retention Messaging & Offer Architecture Design

> Date: 2026-05-07
> Target ship: v1.0.29
> Estimated effort: ~21 hours across frontend, backend, App Store Connect, Play Console
> Status: design draft, awaiting implementation plan

## Problem

Two adjacent gaps surfaced in the same week:

1. **Immediate-cancellation churn.** RevenueCat cancellation events show subscribers cancelling within hours/days of subscribing — not at trial end, not at first renewal. The 2026-04-28 LubieWoka case (PL user, burned 60+ scans then cancelled within 13h) was treated as a single data point at the time. Today's review surfaces a multi-case pattern. `project_churn_patterns.md` is now an active concern, not a log.
2. **Review count: 4 total App Store reviews.** Low review count damages the listing → install conversion AND the App Store ranking algorithm. We can't borrow Adam Lyttle's "embed a 5-star review on the paywall" pattern because we don't have any to embed.

Both gaps share a root: **we have no offer architecture configured anywhere.** No introductory offer, no win-back offer, no lifetime SKU, no Apple Retention Messaging campaign, no Play Console win-back. The only purchase paths are flat monthly + flat annual.

## Goals

- Reduce voluntary cancellations at the moment of decision (Apple Retention Messaging API + Google Play Win-back).
- Increase first-paid conversion via an introductory offer on the paywall.
- Capture lifetime-tier demand (`project_lifetime_pro_demand.md`: aurel's €100 anchor, multi-signal trend).
- Increase App Store review count via well-timed `expo-store-review` prompts at "wow moments".
- Capture cancellation reasons via RevenueCat webhook → Supabase, so we can iterate on retention copy after launch.

## Non-goals

- Adam-style multi-step onboarding redesign — separate, bigger workstream queued for v1.0.30 if this proves out.
- A/B testing framework for retention copy — use cancel-reason data for now, ship variants if signal emerges.
- Trading-card #12 visual polish — held by user direction 2026-05-07.
- Push-notification streak reminders — separate workstream.

## Offer architecture

Three offer SKUs, configured in App Store Connect + Play Console, surfaced through RevenueCat:

| Internal name | Apple product ID | Play product ID | Type | Price | When shown |
|---|---|---|---|---|---|
| `pro_annual_intro` | `pro_annual:intro_3mo_30off` | `pro_annual:intro_3mo_30off` | Introductory offer (Apple) / Intro offer (Google) | $24.84 / €24.99 / 109 zł first 3 months, then $35.49 / €35.99 / 159 zł annual | Paywall, never-subscribed users |
| `pro_winback_3mo` | `pro_monthly:winback_3mo_30off` | `pro_monthly:winback_3mo_30off` | Win-back offer (Apple) / Win-back offer (Google) | 30% off monthly for 3 months ($2.79 / €2.79 / 12 zł × 3) | Apple Retention Messaging at cancel time / Play Console win-back trigger |
| `pro_lifetime` | `pro_lifetime` | `pro_lifetime` | Non-consumable IAP | $99.99 / €99 / 399 zł | Paywall "More options" pane + cancel-screen escape for lifetime-curious cancellers |

The lifetime SKU folds in the `project_lifetime_pro_demand.md` ask (aurel's €100 anchor, 2026-04-30 → 2026-05-01). €99 lands right at the anchor and gives Adam-style "More options" Lifetime escape on the paywall. It also doubles as a non-recurring escape for users about to cancel a recurring sub.

### Pricing locale notes

- DE primary market — €99 lifetime feels right for the "premium" framing; €24.99 intro-3mo is psychologically below €25 threshold.
- PL #2 surging — 399 zł lifetime is below the 400 zł psychological round; 109 zł intro-3mo aligns with PL pricing conventions (per `project_market_focus.md` PL annual-first framing observation).
- UK/EN — $99.99 lifetime; $24.84 intro is the dollar equivalent of €24.99.
- Win-back is symmetric across locales at 30% off the monthly tier the user is leaving.

### Symmetry note

Intro and win-back are both 30% off 3 months for operational simplicity at this scale. They serve different purposes (acquisition vs retention) and can be tuned independently after launch if cancel-reason data shows different elasticities.

## Apple Retention Messaging — Approach C

Loss-framing message + win-back offer combined. Locale-aware. Personalised with streak / league tier / collection size pulled from Supabase via the existing profile context.

### Message templates (per locale)

Three message templates per locale, selected at cancel-time based on user state:

**Streak holders** (`profile.streak_days >= 7`):
- EN: "Don't lose your {streak_days}-day streak. Keep going for $2.79/month (30% off, 3 months)."
- DE: "Verlier deine {streak_days}-Tage-Serie nicht. Weiter für 2,79 €/Monat (30% Rabatt, 3 Monate)."
- PL: "Nie trać swojej {streak_days}-dniowej serii. Kontynuuj za 12 zł/miesiąc (30% taniej, 3 miesiące)."

**League members** (`profile.league_tier in (diesel, electric, ice, vectron)`):
- EN: "You'd drop from {league_tier} this week. Stay for $2.79/month (30% off, 3 months)."
- DE: "Du würdest diese Woche aus {league_tier} absteigen. Bleib für 2,79 €/Monat (30% Rabatt, 3 Monate)."
- PL: "Spadniesz z ligi {league_tier}. Zostań za 12 zł/miesiąc (30% taniej, 3 miesiące)."

**Default fallback** (`else`):
- EN: "You'd lose your collection of {unique_classes} trains. Keep it for $2.79/month (30% off, 3 months)."
- DE: "Deine Sammlung von {unique_classes} Zügen geht verloren. Behalte sie für 2,79 €/Monat (30% Rabatt, 3 Monate)."
- PL: "Stracisz kolekcję {unique_classes} pociągów. Zachowaj ją za 12 zł/miesiąc (30% taniej, 3 miesiące)."

### Variable substitution

Apple's Retention Messaging API does NOT directly support per-user variable substitution in the displayed message text. The API accepts static strings configured in App Store Connect. To get personalised messages we have two options:

- **Option A (simpler):** Configure 3 static templates per locale with generic copy that doesn't require variables (e.g. "Don't lose your collection — keep it for 30% off"). Lose personalisation, gain simplicity.
- **Option B (richer):** Use the Subscription Messaging API endpoint that allows our backend to push a custom message with substituted variables when a cancellation event fires (Apple "Active Retention" feature, beta as of late 2024). Requires backend webhook handling and live message construction.

**Decision: ship Option A in v1.0.29.** Personalisation is a v1.0.30+ stretch once we have data on save rate baseline.

Actual configured strings per locale (Option A — generic):

- EN: "Don't lose your collection — keep going for 30% off, 3 months."
- DE: "Behalte deine Sammlung — 30% Rabatt für 3 Monate."
- PL: "Zachowaj swoją kolekcję — 30% taniej przez 3 miesiące."

### Win-back offer attached

Each message displays the `pro_winback_3mo` offer as a redeemable CTA. Apple renders this as the "Redeem" button visible in the example screenshots (cat-academy + cherry-blossom variants).

## Google Play Win-back mirror

Play Console rolled out Win-back Offers in 2024. Different UX from Apple (no "FROM THE DEVELOPER" custom message UI yet — pure offer-only as of 2026-05-07).

Setup:
- App bundle: `com.locosnap.app`
- In Play Console → Monetize → Subscriptions → `pro_monthly` → "Add new offer" → Type: "Win-back"
- Eligibility: cancelled within last 30 days OR currently in cancellation flow
- Discount: 30% off for 3 billing periods
- Locale: per-locale price overrides matching the table above
- No copy field — Google handles message UX automatically

Android side is closer to "Approach B" (offer-only) than "Approach C" until Google ships custom messaging UI. Acceptable gap — Apple is the higher-revenue store anyway (per today's stats: $66 Apple proceeds vs €16.6 Play revenue).

## Lifetime SKU on the paywall

Update `paywall.tsx` to surface a third option:

```
[Annual — 30% off first 3 months, then $35.49/yr]  ← default selection
[Monthly — $5.99/mo]
[Lifetime — $99.99 one-time]
```

The lifetime row should NOT be hidden behind a "More options" expander (Adam pattern). At our scale we want to make Lifetime visible to all paywall viewers — it's a real product, not a Hail Mary. If conversion data later shows it cannibalises annual subs >50%, revisit and hide behind a disclosure.

Lifetime entitlement maps to the existing `pro` entitlement in RevenueCat (no new entitlement needed). RevenueCat handles non-consumable entitlement lifetime correctly out of the box.

### Cancel-screen escape (Apple side)

When a user with an ACTIVE recurring sub taps cancel and Apple fires the Retention Messaging flow, we present:
1. The win-back offer (30% off 3 months) — primary
2. A secondary message: "Or switch to Lifetime — $99.99 one-time, never charged again."

Apple's API allows two CTAs in a Retention Messaging campaign. Use both.

## Review prompt — separate but bundled

`expo-store-review` (already in the Expo SDK, no new dependency) triggered at clean "wow moments". Native iOS rate-limits to 3 prompts per 365 days, so the trigger has to be picky.

Trigger conditions (must be true to fire):
- User has scanned ≥3 trains (felt value before being asked)
- One of the following just happened:
  - First Legendary scan
  - Tiered achievement unlock (silver or gold tier)
  - 7-day streak hit
  - 50th unique class scanned
- Last prompt was ≥90 days ago (we layer our own throttle on top of iOS's 365-day rule, to spread prompts across multiple wow moments rather than burning all 3 in one week)
- App is in foreground, no modal open, no error state in current session

Do NOT fire on:
- Errors / failed scans
- Paywall views / Pro purchase flow
- Cancel screen / cancel events
- Onboarding flow (user hasn't earned the right to be asked yet)

Implementation:
- New file `frontend/services/reviewPrompt.ts` exporting `maybePromptReview(trigger: string)`
- Trigger calls injected at:
  - `card-reveal.tsx` after Legendary classification (post-render)
  - Achievement unlock effect (post-toast dismissal)
  - Streak increment on day 7
  - Profile unique-classes counter crossing 50
- Persists last-prompt-timestamp in AsyncStorage, key `last_review_prompt_at`

## Cancellation reason capture

Hook RevenueCat's webhook events (`CANCELLATION` event type) to write a `cancellation_reasons` table in Supabase. Lets us A/B test retention copy after launch and validate whether retention messaging is moving the needle.

Schema (Supabase migration 015):

```sql
CREATE TABLE cancellation_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rc_event_id TEXT UNIQUE NOT NULL,
  product_id TEXT NOT NULL,
  cancellation_reason TEXT,           -- RevenueCat-provided reason code
  store TEXT NOT NULL,                -- 'app_store' | 'play_store'
  was_in_trial BOOLEAN NOT NULL,
  hours_since_purchase NUMERIC,
  hours_since_trial_start NUMERIC,
  retention_offer_shown BOOLEAN,      -- did we show the win-back?
  retention_offer_redeemed BOOLEAN,   -- did they accept it?
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cancellation_reasons_user ON cancellation_reasons(user_id);
CREATE INDEX idx_cancellation_reasons_created ON cancellation_reasons(created_at DESC);
```

Backend:
- Extend `routes/webhooks.ts` `revenuecat` handler to detect `CANCELLATION` event type
- Write row with `was_in_trial`, `hours_since_purchase` computed from RC event payload
- `retention_offer_shown` / `retention_offer_redeemed` come from later events (Apple `OFFER_REDEEMED`)

Reporting query (run weekly):
```sql
SELECT
  CASE
    WHEN was_in_trial THEN 'trial'
    WHEN hours_since_purchase < 24 THEN 'paid_<24h'
    WHEN hours_since_purchase < 168 THEN 'paid_<7d'
    ELSE 'paid_>7d'
  END AS bucket,
  COUNT(*) AS cancellations,
  SUM(retention_offer_shown::int) AS shown,
  SUM(retention_offer_redeemed::int) AS saved,
  ROUND(SUM(retention_offer_redeemed::int)::numeric / NULLIF(SUM(retention_offer_shown::int), 0) * 100, 1) AS save_rate_pct
FROM cancellation_reasons
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY bucket;
```

This is the closed-loop measurement. After 2-4 weeks of v1.0.29 in production we'll know whether the messaging is moving the needle and on which buckets.

## Implementation order

1. **App Store Connect — promotional offers config** — create `pro_annual:intro_3mo_30off`, `pro_monthly:winback_3mo_30off`, `pro_lifetime` non-consumable. Locale price overrides for DE/PL/UK/US/AT/CH (~2h)
2. **Play Console — equivalent config** — same three SKUs, same locale prices, win-back offer eligibility (~2h)
3. **RevenueCat product mapping** — attach all three new products to the existing `pro` entitlement; verify offerings render correctly in sandbox (~1h)
4. **Frontend paywall update** — add Lifetime row + Intro pricing display logic (`app/paywall.tsx`); strings + DE/PL locales (~3h)
5. **Apple Retention Messaging campaign** — App Store Connect → Subscription messages → win-back campaign tied to `pro_monthly` and `pro_annual`. Configure the 3 locale messages from Approach A. Attach win-back offer + lifetime escape CTA (~2h)
6. **Play Console Win-back trigger** — eligibility window (cancelled within 30d OR mid-cancel-flow), discount config (~1h, mostly bundled with #2 since Play Console UX combines them)
7. **Backend cancellation-reason capture** — migration 015, webhook handler extension, RC event parsing (~3h)
8. **Review prompt timing** — `services/reviewPrompt.ts`, trigger injection at 4 sites, AsyncStorage throttle, EN/DE/PL strings (~3h)
9. **Locale copy DE/PL/EN polish** — final pass on all offer titles, paywall strings, review prompt copy (~2h)
10. **Manual QA — TestFlight + Internal track** — sandbox subscriptions, cancel flow walkthrough across 3 personas (streak holder / league member / default user), Lifetime purchase flow, win-back redemption, intro-offer first-charge transition (~3h)

**Total: ~22h**, fits a focused v1.0.29 build cycle.

## Risk register

- **Apple "Subscription messages" feature is GA but lightly documented.** Real config UX may diverge from current Apple developer docs. Buffer +2h for App Store Connect surprises.
- **Lifetime cannibalisation of annual subs.** If users who would have signed up annual instead pick lifetime, MRR drops in exchange for one-time revenue. At current scale (8 active subs, $32 MRR), the LTV math favours lifetime if even 30% of would-be-annual buyers convert to lifetime. Re-evaluate after v1.0.29 has been live 60 days.
- **Review prompts firing during peak negative state.** If a user has had 2 failed scans then a successful Legendary scan, the wow moment lands but they may still be irritated. Mitigate by checking session error count before firing — if `session_errors > 0`, defer.
- **Play Console Win-back UX is opaque.** Google doesn't surface clear save-rate metrics in Play Console (Apple does). We rely on the `cancellation_reasons` table for closed-loop measurement on Android.

## Out of scope (named explicitly)

- Adam-style multi-step onboarding redesign — v1.0.30+ candidate
- A/B testing framework — manual variant rotation only for now
- Trading-card #12 work — held by user 2026-05-07
- Push notifications for streak reminders — separate workstream
- Per-user variable substitution in retention messages — Option B in Apple Retention Messaging section, deferred
- Apple "Subscribe and Save" multi-month bundle pricing — out of scope
- Family Sharing on Pro — out of scope

## Success criteria

After 30 days in production with v1.0.29 shipped:

- **Retention save rate ≥ 15%** on cancellations where retention messaging fires (industry baseline 5-25%)
- **Net new paid subs from intro offer ≥ 5/month** (current baseline ~5 paying users / 30d on iOS — even doubling that is the target)
- **App Store review count ≥ 12** (up from 4) — review prompt firing at wow moments should drive ≥8 net new reviews in 30 days at current install volume
- **At least one Lifetime purchase** in the first 30 days (validates the SKU exists in user mental space)
- **Cancel-reason capture working** — `cancellation_reasons` table populated, weekly report query runs, signals identifiable

If success criteria fail:
- Retention save rate < 5%: messaging copy isn't landing — revisit personalisation (Option B)
- No Lifetime purchases: pricing wrong or visibility wrong — A/B test placement
- Review count not moving: trigger frequency too conservative — loosen the wow-moment definitions

## Dependencies

- App Store Connect access (Stephen Lear admin account)
- Google Play Console access (StephenLear merchant account, verified)
- RevenueCat dashboard access
- Supabase production migrations (next available: 015)
- Render deploy pipeline (auto-deploys on `main` push)
- EAS Build for v1.0.29

## File-level changes (preview)

| File | Change |
|---|---|
| `frontend/app/paywall.tsx` | Add Lifetime row, Intro pricing, locale-aware offer rendering |
| `frontend/services/reviewPrompt.ts` | NEW — `maybePromptReview()` with throttle + trigger gate |
| `frontend/app/card-reveal.tsx` | Inject review prompt after Legendary post-render |
| `frontend/store/trainStore.ts` | Inject review prompt on achievement unlock |
| `frontend/store/leaderboardStore.ts` | Inject review prompt on streak increment to 7 |
| `frontend/i18n/{en,de,pl}.json` | New strings for Lifetime, Intro, retention messages, review prompt |
| `backend/src/routes/webhooks.ts` | Handle `CANCELLATION` event, write to `cancellation_reasons` |
| `supabase/migrations/015_cancellation_reasons.sql` | NEW table + indexes |

## Open questions to confirm before implementation plan

- **Locale price exact values:** the table above is a first pass. Need to confirm exact PL zł values against current PKB exchange and round-number conventions. Stephen to confirm or delegate.
- **Lifetime tax handling:** non-consumable IAP tax handling differs from subscription. Apple handles VAT for EU buyers automatically, Play same. Confirm RevenueCat's Reports tab treats lifetime revenue correctly in MRR vs one-time buckets.
- **Existing trial offer for `pro_annual`:** does the current annual SKU have any trial today? If yes, intro offer needs to replace it (Apple doesn't allow both).
