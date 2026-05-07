# Retention Messaging & Offer Architecture — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship Apple Retention Messaging + Google Play Win-back offers + Lifetime SKU + intro offer + review prompt + cancellation-reason capture as v1.0.29, addressing the immediate-cancellation churn pattern and the 4-review listing bottleneck.

**Architecture:** Three new offer SKUs (intro 30% off 3mo, win-back 30% off 3mo, lifetime $99.99/€99/399 zł) configured in App Store Connect + Play Console + RevenueCat. Apple Retention Messaging campaign with three locale messages (EN/DE/PL) attaches the win-back offer at cancel time. Backend extends RevenueCat webhook handler to capture CANCELLATION events into a new Supabase table (migration 015). Frontend adds Lifetime row to paywall and integrates `expo-store-review` at four "wow moment" triggers with a 90-day local throttle layered on top of iOS's 365-day rule.

**Tech Stack:** React Native + Expo, TypeScript, Express + Jest, Supabase + RLS, RevenueCat, App Store Connect, Google Play Console, `expo-store-review`.

**Reference:** Design doc at `docs/plans/2026-05-07-retention-and-offers-design.md`.

---

## Phase 0: Prerequisites — store config (no code)

These tasks are App Store Connect / Play Console UI clicks. They produce no commit-able code, but must complete first because RevenueCat product mapping (Phase 1) depends on the SKUs existing.

### Task 1: App Store Connect — create promotional offer SKUs

**Files:** none (App Store Connect UI only)

**Step 1: Open App Store Connect → My Apps → LocoSnap : Train Identifier → Subscriptions**

**Step 2: For the existing `pro_annual` subscription — add Introductory Offer**

Navigate: pro_annual → Introductory Offers → "+ Create Introductory Offer"
- Reference name: `intro_3mo_30off`
- Type: "Pay as you go"
- Duration: 3 months
- Discount: 30% off base price
- Eligible: New subscribers and existing subscribers who never had this intro offer
- Locale price overrides:
  - US: $24.84/year first 3mo equivalent (Apple computes from base × 0.7)
  - DE: €24.99/year equivalent
  - PL: 109 zł/year equivalent
  - Apply to all configured territories — Apple will compute the proportional price for each

**Step 3: For the existing `pro_monthly` subscription — add Win-back Offer**

Navigate: pro_monthly → Promotional Offers → "+ Create Promotional Offer"
- Reference name: `winback_3mo_30off`
- Eligibility: "Subscribers who have canceled" + "Subscribers who are within their grace period"
- Type: "Pay as you go"
- Duration: 3 months
- Discount: 30% off base monthly price
- Locale prices auto-compute from base × 0.7

**Step 4: Create new Lifetime non-consumable IAP**

Navigate: In-App Purchases → "+ Create" → Type: Non-Consumable
- Reference name: `pro_lifetime`
- Product ID: `pro_lifetime`
- Pricing:
  - US tier: $99.99 (Tier 100)
  - DE: override to €99.00
  - PL: override to 399 zł
  - GB: override to £89.99
- Localized display name: "LocoSnap Pro — Lifetime"
- Localized description (EN): "Unlock LocoSnap Pro forever — one payment, no subscription. Includes unlimited scans, full collection access, blueprints, and all future features."
- DE/PL translations to follow in Task 9 i18n pass

**Step 5: Submit pricing changes**

App Store Connect → confirm all three offers and the new IAP are in "Ready to Submit" state. Will need to be attached to a build (handled in Task 31 when v1.0.29 binary uploads).

**Step 6: Verification**

Take screenshot of all three offers visible in App Store Connect dashboard. Save to `~/Desktop/v1.0.29_offers/apple_offers_configured.png` for handoff.

---

### Task 2: Google Play Console — create equivalent SKUs

**Files:** none (Play Console UI only)

**Step 1: Open Play Console → LocoSnap → Monetize → Subscriptions**

**Step 2: For existing `pro_annual:annual` base plan — add Intro Offer**

Click pro_annual → "+ Add offer" → Type: Introductory
- ID: `intro_3mo_30off`
- Eligibility: "New subscribers"
- Phases: 1 phase, 3 billing periods, 30% off recurring price
- Locale price overrides matching Apple (109 zł, €24.99, etc.)

**Step 3: For existing `pro_monthly:monthly` base plan — add Win-back Offer**

Click pro_monthly → "+ Add offer" → Type: Win-back
- ID: `winback_3mo_30off`
- Eligibility window: cancelled within last 30 days
- Phases: 1 phase, 3 billing periods, 30% off
- Locale price overrides matching Apple

**Step 4: Create new Lifetime in-app product**

In-app products → "+ Create product" → Type: Managed product
- Product ID: `pro_lifetime`
- Default price: $99.99
- Locale overrides: 399 zł, €99.00, £89.99
- Localized title: "LocoSnap Pro — Lifetime"
- Localized description matching Apple (Task 1 step 4)

**Step 5: Activate offers**

Confirm all three offers + new product show "Active" state in Play Console.

**Step 6: Verification**

Screenshot saved to `~/Desktop/v1.0.29_offers/play_offers_configured.png`.

---

### Task 3: RevenueCat — map new products to existing entitlement

**Files:** none (RevenueCat dashboard UI only)

**Step 1: Open RevenueCat dashboard → locosnap project → Products**

**Step 2: Import new products**

For each store, click "Import from App Store Connect" / "Import from Play Console":
- Verify these new products appear:
  - `pro_lifetime` (Apple)
  - `pro_lifetime` (Play)
- Verify these existing products now show offer attachments:
  - `pro_annual:intro_3mo_30off` under Apple `pro_annual`
  - `pro_monthly:winback_3mo_30off` under Apple `pro_monthly`
  - Same for Play side

**Step 3: Attach to `pro` entitlement**

For each new product/offer:
- `pro_lifetime` (Apple) → attach to `pro` entitlement, type: lifetime
- `pro_lifetime` (Play) → attach to `pro` entitlement, type: lifetime
- Intro offers and win-back offers do NOT need separate entitlement attachment (they're discounts on existing products that already grant `pro`)

**Step 4: Update offerings**

Navigate: Offerings → `default` offering → Packages
- Add `$rc_lifetime` package → attach `pro_lifetime` (Apple + Play)
- Confirm `$rc_monthly`, `$rc_annual` packages still wired correctly
- Verify the `default` offering now has 3 packages: monthly, annual, lifetime

**Step 5: Sandbox verification**

In RevenueCat dashboard → Test purchase flows in Sandbox tab:
- Mock annual purchase with intro offer eligibility — confirm RC correctly applies the 30% off 3 months
- Mock lifetime purchase — confirm `pro` entitlement granted with `expires_date: null`
- Mock monthly cancellation — eligibility for win-back offer should appear in customer profile

**Step 6: Verification**

Screenshot RC offerings page and one sandbox-tested customer profile. Save both to `~/Desktop/v1.0.29_offers/rc_configured.png`.

---

## Phase 1: Backend cancellation tracking

### Task 4: Create Supabase migration 015 — cancellation_reasons table

**Files:**
- Create: `supabase/migrations/015_cancellation_reasons.sql`

**Step 1: Write migration file**

```sql
-- 015_cancellation_reasons.sql — log RevenueCat CANCELLATION events for closed-loop measurement
-- Applied: TBD via SQL Editor against production Supabase
-- Related: docs/plans/2026-05-07-retention-and-offers-design.md

CREATE TABLE IF NOT EXISTS public.cancellation_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rc_event_id TEXT UNIQUE NOT NULL,
  product_id TEXT NOT NULL,
  cancellation_reason TEXT,
  store TEXT NOT NULL CHECK (store IN ('app_store', 'play_store')),
  was_in_trial BOOLEAN NOT NULL DEFAULT FALSE,
  hours_since_purchase NUMERIC,
  hours_since_trial_start NUMERIC,
  retention_offer_shown BOOLEAN DEFAULT FALSE,
  retention_offer_redeemed BOOLEAN DEFAULT FALSE,
  raw_event JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cancellation_reasons_user ON public.cancellation_reasons(user_id);
CREATE INDEX idx_cancellation_reasons_created ON public.cancellation_reasons(created_at DESC);

ALTER TABLE public.cancellation_reasons ENABLE ROW LEVEL SECURITY;

-- Service role only — no client RLS policies; this is a server-side log table.
-- Read access for analytics queries via service role from backend or Stephen's admin.

COMMENT ON TABLE public.cancellation_reasons IS 'RevenueCat CANCELLATION webhook events captured for save-rate measurement. Server-write only.';
```

**Step 2: Verify schema syntactically**

```bash
cat supabase/migrations/015_cancellation_reasons.sql | head -30
```
Expected: file content as above, no syntax errors visible.

**Step 3: Commit**

```bash
git add supabase/migrations/015_cancellation_reasons.sql
git commit -m "db: add cancellation_reasons table (migration 015)

For closed-loop measurement on Apple Retention Messaging save rate.
Server-write only via service role; no client RLS.

Refs: docs/plans/2026-05-07-retention-and-offers-design.md"
```

---

### Task 5: Backend — write failing test for CANCELLATION event handling

**Files:**
- Create: `backend/src/__tests__/routes/webhooks-cancellation.test.ts`

**Step 1: Write the failing test**

```typescript
import request from "supertest";
import express from "express";
import webhooksRouter from "../../routes/webhooks";

// Mock supabase + analytics modules
jest.mock("../../config/supabase", () => {
  const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
  const mockFrom = jest.fn(() => ({ insert: mockInsert }));
  return {
    getSupabase: jest.fn(() => ({ from: mockFrom })),
    __mockInsert: mockInsert,
    __mockFrom: mockFrom,
  };
});

jest.mock("../../services/analytics", () => ({
  trackServerEvent: jest.fn(),
  captureServerError: jest.fn(),
}));

jest.mock("../../config/env", () => ({
  config: {
    hasRevenueCat: false,
    revenuecatWebhookSecret: "test-secret",
  },
}));

describe("POST /api/webhooks/revenuecat — CANCELLATION event", () => {
  let app: express.Express;
  let mocks: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mocks = require("../../config/supabase");
    app = express();
    app.use(express.json());
    app.use("/api/webhooks", webhooksRouter);
  });

  it("logs a CANCELLATION event into cancellation_reasons", async () => {
    const event = {
      event: {
        id: "rc-evt-cancel-001",
        type: "CANCELLATION",
        app_user_id: "00000000-0000-0000-0000-000000000001",
        product_id: "pro_monthly",
        store: "APP_STORE",
        cancel_reason: "USER_CANCELLED",
        period_type: "NORMAL",
        purchased_at_ms: Date.now() - 1000 * 60 * 60 * 12, // 12h ago
        event_timestamp_ms: Date.now(),
      },
    };

    const res = await request(app)
      .post("/api/webhooks/revenuecat")
      .send(event);

    expect(res.status).toBe(200);
    expect(mocks.__mockFrom).toHaveBeenCalledWith("cancellation_reasons");
    expect(mocks.__mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        rc_event_id: "rc-evt-cancel-001",
        product_id: "pro_monthly",
        store: "app_store",
        was_in_trial: false,
        cancellation_reason: "USER_CANCELLED",
      })
    );
  });

  it("marks was_in_trial=true when period_type is TRIAL", async () => {
    const event = {
      event: {
        id: "rc-evt-cancel-002",
        type: "CANCELLATION",
        app_user_id: "00000000-0000-0000-0000-000000000002",
        product_id: "pro_annual",
        store: "PLAY_STORE",
        cancel_reason: "USER_CANCELLED",
        period_type: "TRIAL",
        purchased_at_ms: Date.now() - 1000 * 60 * 60 * 24 * 3,
        event_timestamp_ms: Date.now(),
      },
    };

    await request(app).post("/api/webhooks/revenuecat").send(event);

    expect(mocks.__mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        was_in_trial: true,
        store: "play_store",
      })
    );
  });

  it("computes hours_since_purchase correctly", async () => {
    const purchasedHoursAgo = 5.5;
    const event = {
      event: {
        id: "rc-evt-cancel-003",
        type: "CANCELLATION",
        app_user_id: "00000000-0000-0000-0000-000000000003",
        product_id: "pro_monthly",
        store: "APP_STORE",
        cancel_reason: "USER_CANCELLED",
        period_type: "NORMAL",
        purchased_at_ms: Date.now() - purchasedHoursAgo * 60 * 60 * 1000,
        event_timestamp_ms: Date.now(),
      },
    };

    await request(app).post("/api/webhooks/revenuecat").send(event);

    const call = mocks.__mockInsert.mock.calls[0][0];
    expect(call.hours_since_purchase).toBeGreaterThan(5.4);
    expect(call.hours_since_purchase).toBeLessThan(5.6);
  });

  it("skips non-UUID app_user_id (anonymous users)", async () => {
    const event = {
      event: {
        id: "rc-evt-cancel-004",
        type: "CANCELLATION",
        app_user_id: "$RCAnonymousID:abc123",
        product_id: "pro_monthly",
        store: "APP_STORE",
        cancel_reason: "USER_CANCELLED",
        period_type: "NORMAL",
        purchased_at_ms: Date.now() - 1000 * 60 * 60,
        event_timestamp_ms: Date.now(),
      },
    };

    const res = await request(app)
      .post("/api/webhooks/revenuecat")
      .send(event);

    expect(res.status).toBe(200);
    expect(mocks.__mockInsert).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run the test, expect it to FAIL**

```bash
cd backend && npx jest src/__tests__/routes/webhooks-cancellation.test.ts
```
Expected: 4 tests fail with "Expected mockInsert to have been called" — because the current `webhooks.ts` returns 200 on CANCELLATION but does not write to a table.

**Step 3: Commit the failing test**

```bash
git add backend/src/__tests__/routes/webhooks-cancellation.test.ts
git commit -m "test(webhooks): expect CANCELLATION events to log to cancellation_reasons

Failing tests — implementation in next commit."
```

---

### Task 6: Backend — implement CANCELLATION event handler

**Files:**
- Modify: `backend/src/routes/webhooks.ts` (around line 30, where the comment "CANCELLATION is intentionally excluded" lives)

**Step 1: Read existing handler shape**

```bash
grep -n "PRO_GRANT_EVENTS\|PRO_REVOKE_EVENTS\|eventType ===" backend/src/routes/webhooks.ts | head -20
```

**Step 2: Add CANCELLATION handler**

Edit `backend/src/routes/webhooks.ts`. After the existing event handler logic (locate the `if (PRO_REVOKE_EVENTS.includes(eventType))` block) and before the catch-all log, insert:

```typescript
      // ── CANCELLATION event — log reason for save-rate measurement ──
      // We do NOT revoke access here (EXPIRATION handles that when the
      // current period ends). We just log the cancellation event for
      // analytics on retention messaging save rates.
      if (eventType === "CANCELLATION") {
        // Skip anonymous app_user_ids (RevenueCat assigns these to
        // pre-signin purchases — no Supabase user to attach to).
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(appUserId)) {
          console.log(
            `[WEBHOOK] Skipping CANCELLATION log for anonymous user ${appUserId}`
          );
          res.status(200).json({ received: true, skipped: "non_uuid_app_user_id" });
          return;
        }

        const purchasedAtMs: number = event.purchased_at_ms || 0;
        const eventTsMs: number = event.event_timestamp_ms || Date.now();
        const periodType: string = event.period_type || "NORMAL";
        const cancelReason: string | null = event.cancel_reason || null;
        const rcStore: string = event.store || "";

        const storeNormalized =
          rcStore === "APP_STORE" || rcStore === "MAC_APP_STORE"
            ? "app_store"
            : rcStore === "PLAY_STORE"
              ? "play_store"
              : "app_store"; // safe default

        const hoursSincePurchase = purchasedAtMs
          ? (eventTsMs - purchasedAtMs) / (1000 * 60 * 60)
          : null;

        try {
          const supabase = getSupabase();
          await supabase.from("cancellation_reasons").insert({
            user_id: appUserId,
            rc_event_id: eventId,
            product_id: productId,
            cancellation_reason: cancelReason,
            store: storeNormalized,
            was_in_trial: periodType === "TRIAL",
            hours_since_purchase: hoursSincePurchase,
            hours_since_trial_start: periodType === "TRIAL" ? hoursSincePurchase : null,
            retention_offer_shown: false,
            retention_offer_redeemed: false,
            raw_event: event,
          });

          trackServerEvent("cancellation_logged", appUserId, {
            product_id: productId,
            was_in_trial: periodType === "TRIAL",
            hours_since_purchase: hoursSincePurchase,
            store: storeNormalized,
          });
        } catch (err) {
          captureServerError(err as Error, {
            event: "cancellation_log_failed",
            rc_event_id: eventId,
            user_id: appUserId,
          });
        }

        res.status(200).json({ received: true, logged: true });
        return;
      }
```

**Step 3: Run tests, expect them to PASS**

```bash
cd backend && npx jest src/__tests__/routes/webhooks-cancellation.test.ts
```
Expected: 4/4 pass.

**Step 4: Run the full backend test suite**

```bash
cd backend && npx jest
```
Expected: 173/173 pass (169 existing + 4 new).

**Step 5: TS check**

```bash
cd backend && npx tsc --noEmit
```
Expected: clean.

**Step 6: Commit**

```bash
git add backend/src/routes/webhooks.ts
git commit -m "feat(webhooks): log CANCELLATION events to cancellation_reasons

Captures product_id, store, trial status, hours_since_purchase, and
the cancellation reason from RevenueCat for save-rate analytics.
Anonymous app_user_ids are skipped (no Supabase user to attach).

Refs: docs/plans/2026-05-07-retention-and-offers-design.md"
```

---

### Task 7: Apply migration 015 to production Supabase

**Files:** none (Supabase SQL Editor UI only)

**Step 1: Open Supabase production project → SQL Editor**

**Step 2: Paste the contents of `supabase/migrations/015_cancellation_reasons.sql`**

**Step 3: Run query**

Expected: "Success. No rows returned." Verify in Table Editor that `cancellation_reasons` appears with the expected columns and indexes.

**Step 4: Sanity-check RLS**

```sql
SELECT pg_policies.policyname, pg_policies.cmd
FROM pg_policies
WHERE pg_policies.tablename = 'cancellation_reasons';
```
Expected: 0 rows (table has RLS enabled but no policies; service role bypasses RLS, no client access).

**Step 5: Update memory**

In `~/.claude/projects/-Users-StephenLear-Projects-locosnap/memory/project_supabase_topology.md`, bump the migration count from 014 to 015 in the next session — `feedback_memory_hygiene.md` rule.

---

### Task 8: Push backend to Render

**Files:** none (git push)

**Step 1: Cherry-pick or merge the worktree branch to main**

If working on the worktree branch:

```bash
cd /Users/StephenLear/Projects/locosnap
git cherry-pick <commit-sha-from-task-6>
```

Or if working on main directly, skip cherry-pick.

**Step 2: Push**

```bash
git push origin main
```

**Step 3: Confirm Render auto-deploy**

Open Render dashboard → locosnap-backend service → Events tab. Wait for the new deploy to complete (~3-5 min).

**Step 4: Smoke test**

```bash
curl -s https://locosnap-backend.onrender.com/api/health | jq
```
Expected: `{ "status": "ok", ... }` with no error mentioning `cancellation_reasons`.

**Step 5: Per CLAUDE.md backend rule** — explicitly state to user: "Backend deployed to Render. Cancellation logging is now live."

---

## Phase 2: Frontend paywall — Lifetime + Intro

### Task 9: i18n strings for new offers + lifetime copy

**Files:**
- Modify: `frontend/i18n/en.json` (add new keys under `paywall.*`)
- Modify: `frontend/i18n/de.json`
- Modify: `frontend/i18n/pl.json`

**Step 1: Read current paywall key block**

```bash
grep -n "paywall" frontend/i18n/en.json | head -20
```

**Step 2: Add new keys to en.json**

Locate the `"paywall": {` object and add these keys before the closing `}`:

```json
"lifetime_title": "Lifetime",
"lifetime_subtitle": "One-time payment, never charged again",
"lifetime_price": "$99.99",
"intro_badge": "30% OFF FIRST 3 MONTHS",
"intro_disclaimer": "After 3 months, $35.49/year. Cancel anytime.",
"unlock_lifetime": "Unlock Lifetime"
```

**Step 3: Add equivalent keys to de.json**

```json
"lifetime_title": "Lebenslang",
"lifetime_subtitle": "Einmalzahlung, keine Folgekosten",
"lifetime_price": "€99",
"intro_badge": "30% RABATT FÜR 3 MONATE",
"intro_disclaimer": "Nach 3 Monaten 35,99 €/Jahr. Jederzeit kündbar.",
"unlock_lifetime": "Lebenslang freischalten"
```

**Step 4: Add equivalent keys to pl.json**

```json
"lifetime_title": "Na zawsze",
"lifetime_subtitle": "Jednorazowa płatność, bez subskrypcji",
"lifetime_price": "399 zł",
"intro_badge": "30% TANIEJ PRZEZ 3 MIESIĄCE",
"intro_disclaimer": "Po 3 miesiącach 159 zł/rok. Anuluj kiedy chcesz.",
"unlock_lifetime": "Odblokuj na zawsze"
```

**Step 5: Verify parity**

```bash
cd frontend && node -e "
const en = require('./i18n/en.json');
const de = require('./i18n/de.json');
const pl = require('./i18n/pl.json');
const enKeys = Object.keys(en.paywall);
const deKeys = Object.keys(de.paywall);
const plKeys = Object.keys(pl.paywall);
console.log('EN:', enKeys.length, 'DE:', deKeys.length, 'PL:', plKeys.length);
console.log('Missing in DE:', enKeys.filter(k => !deKeys.includes(k)));
console.log('Missing in PL:', enKeys.filter(k => !plKeys.includes(k)));
"
```
Expected: equal counts, empty "missing" arrays.

**Step 6: Run i18n parity tests**

```bash
cd frontend && npm test -- i18n
```
Expected: existing parity tests pass (typically `i18n.test.ts` checking key counts match).

**Step 7: Commit**

```bash
git add frontend/i18n/en.json frontend/i18n/de.json frontend/i18n/pl.json
git commit -m "i18n: add Lifetime + intro offer paywall strings (EN/DE/PL)"
```

---

### Task 10: Frontend — write failing test for paywall lifetime row

**Files:**
- Create: `frontend/__tests__/paywall-lifetime.test.tsx`

**Step 1: Write the test**

```typescript
// frontend/__tests__/paywall-lifetime.test.tsx
//
// Test discipline note: LocoSnap frontend uses pure-logic tests via ts-jest,
// avoiding RN rendering for reliability. This test exercises the pricing-row
// data shape function rather than full render.

import { buildPaywallPackages } from "../app/paywall-helpers";

describe("buildPaywallPackages", () => {
  it("returns three packages: monthly, annual, lifetime", () => {
    const offerings = {
      current: {
        availablePackages: [
          { identifier: "$rc_monthly", product: { priceString: "$5.99" } },
          { identifier: "$rc_annual", product: { priceString: "$35.49" } },
          { identifier: "$rc_lifetime", product: { priceString: "$99.99" } },
        ],
      },
    };

    const packages = buildPaywallPackages(offerings);

    expect(packages).toHaveLength(3);
    expect(packages.map(p => p.kind)).toEqual(["monthly", "annual", "lifetime"]);
  });

  it("flags annual as default when intro offer is present", () => {
    const offerings = {
      current: {
        availablePackages: [
          { identifier: "$rc_monthly", product: { priceString: "$5.99" } },
          {
            identifier: "$rc_annual",
            product: { priceString: "$35.49" },
            introPrice: { priceString: "$24.84" },
          },
          { identifier: "$rc_lifetime", product: { priceString: "$99.99" } },
        ],
      },
    };

    const packages = buildPaywallPackages(offerings);
    const annual = packages.find(p => p.kind === "annual");

    expect(annual?.isDefault).toBe(true);
    expect(annual?.introPrice).toBe("$24.84");
  });

  it("returns 2 packages when lifetime offering is absent", () => {
    const offerings = {
      current: {
        availablePackages: [
          { identifier: "$rc_monthly", product: { priceString: "$5.99" } },
          { identifier: "$rc_annual", product: { priceString: "$35.49" } },
        ],
      },
    };

    const packages = buildPaywallPackages(offerings);

    expect(packages).toHaveLength(2);
  });
});
```

**Step 2: Run test, expect FAIL**

```bash
cd frontend && npx jest __tests__/paywall-lifetime.test.tsx
```
Expected: fails with "Cannot find module '../app/paywall-helpers'".

**Step 3: Commit failing test**

```bash
git add frontend/__tests__/paywall-lifetime.test.tsx
git commit -m "test(paywall): expect lifetime + intro offer pricing rows

Failing test — helper implementation in next commit."
```

---

### Task 11: Frontend — implement paywall-helpers + paywall lifetime row

**Files:**
- Create: `frontend/app/paywall-helpers.ts`
- Modify: `frontend/app/paywall.tsx` (find the existing offerings render block and add lifetime)

**Step 1: Create helper**

```typescript
// frontend/app/paywall-helpers.ts
//
// Pure logic helpers for paywall offering composition. Keeps paywall.tsx
// rendering simple and unit-testable independently of RN.

export type PaywallPackageKind = "monthly" | "annual" | "lifetime";

export interface PaywallPackage {
  kind: PaywallPackageKind;
  packageRef: any;            // RevenueCat Package object
  priceString: string;
  introPrice?: string;        // present when an intro offer applies
  isDefault: boolean;         // which row to highlight
}

export function buildPaywallPackages(offerings: any): PaywallPackage[] {
  if (!offerings?.current?.availablePackages) return [];

  const result: PaywallPackage[] = [];

  for (const pkg of offerings.current.availablePackages) {
    if (pkg.identifier === "$rc_monthly") {
      result.push({
        kind: "monthly",
        packageRef: pkg,
        priceString: pkg.product.priceString,
        isDefault: false,
      });
    } else if (pkg.identifier === "$rc_annual") {
      result.push({
        kind: "annual",
        packageRef: pkg,
        priceString: pkg.product.priceString,
        introPrice: pkg.introPrice?.priceString,
        isDefault: true, // annual is the default selection
      });
    } else if (pkg.identifier === "$rc_lifetime") {
      result.push({
        kind: "lifetime",
        packageRef: pkg,
        priceString: pkg.product.priceString,
        isDefault: false,
      });
    }
  }

  // Sort: monthly, annual, lifetime
  const order: PaywallPackageKind[] = ["monthly", "annual", "lifetime"];
  result.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  return result;
}
```

**Step 2: Run unit tests, expect PASS**

```bash
cd frontend && npx jest __tests__/paywall-lifetime.test.tsx
```
Expected: 3/3 pass.

**Step 3: Update paywall.tsx to render the new rows**

Open `frontend/app/paywall.tsx`. Locate the section that maps over `offerings.current.availablePackages` and renders pricing rows.

Replace that mapping with a call to `buildPaywallPackages(offerings)`, then render each package using the existing pricing-row component. Conditionally render the intro-offer badge (`paywall.intro_badge`) when `pkg.introPrice` is truthy. Conditionally show the intro-disclaimer text below the annual row when `pkg.introPrice` is truthy.

For the lifetime row:
- Title: `t("paywall.lifetime_title")`
- Subtitle: `t("paywall.lifetime_subtitle")`
- Price: `pkg.priceString`
- CTA when selected: `t("paywall.unlock_lifetime")`

**Step 4: Run frontend tests**

```bash
cd frontend && npm test
```
Expected: 138/138 pass (135 existing + 3 new).

**Step 5: Run TS check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: clean (or pre-existing baseline errors only).

**Step 6: Manual sanity — start Expo dev server**

```bash
cd frontend && npx expo start
```

Open in Expo Go on a test device or simulator with sandbox sign-in. Trigger the paywall (e.g. tap "Upgrade" in profile). Confirm:
- Three rows visible: Monthly, Annual (default highlighted), Lifetime
- Annual row shows "30% OFF FIRST 3 MONTHS" badge
- Annual row shows intro disclaimer below
- Lifetime row shows "$99.99" / "€99" / "399 zł" depending on locale

Take screenshot, save to `~/Desktop/v1.0.29_offers/paywall_v1.0.29.png`.

**Step 7: Commit**

```bash
git add frontend/app/paywall-helpers.ts frontend/app/paywall.tsx
git commit -m "feat(paywall): add Lifetime + intro offer rows

Three-row paywall: monthly, annual (default, with intro 30% off
3mo badge + disclaimer), lifetime ($99.99/€99/399 zł, one-time).

Logic split into paywall-helpers.ts for unit testability.

Refs: docs/plans/2026-05-07-retention-and-offers-design.md"
```

---

## Phase 3: Apple Retention Messaging campaign

### Task 12: Configure Apple Retention Messaging campaign

**Files:** none (App Store Connect UI only)

**Step 1: Open App Store Connect → My Apps → LocoSnap → Subscriptions → "Subscription Messages"**

If "Subscription Messages" tab is not visible, the feature may need to be enabled per app. Check Apple developer beta enrollment (Retention Messaging is GA as of late 2024 but per-app activation may apply).

**Step 2: Create new campaign**

- Campaign name: `winback-v1-2026-05`
- Subscription group: select the group containing `pro_monthly` + `pro_annual`
- Audience: "Subscribers with active cancellation intent" (this is the trigger that fires the Retention Messaging UI)
- Active dates: today through 2027-05-07 (1 year)

**Step 3: Configure message — EN locale**

- Message header: "Don't lose your collection"
- Message body: "Keep going for 30% off, 3 months."
- Image: optional — for v1.0.29 leave unset to keep simple. Can A/B with image later.
- Promotional offer: select `winback_3mo_30off` (created in Task 1)

**Step 4: Configure message — DE locale**

- Message header: "Behalte deine Sammlung"
- Message body: "30% Rabatt für 3 Monate."
- Promotional offer: same `winback_3mo_30off`

**Step 5: Configure message — PL locale**

- Message header: "Zachowaj swoją kolekcję"
- Message body: "30% taniej przez 3 miesiące."
- Promotional offer: same `winback_3mo_30off`

**Step 6: Submit campaign for review**

Apple reviews retention messaging campaigns. Standard review time 1-3 days.

**Step 7: Verification**

Screenshot of campaign in "Submitted for Review" state. Save to `~/Desktop/v1.0.29_offers/apple_retention_campaign.png`.

---

## Phase 4: Play Console Win-back

### Task 13: Configure Play Console Win-back trigger

**Files:** none (Play Console UI, mostly bundled with Task 2)

**Step 1: Open Play Console → LocoSnap → Monetize → Subscriptions → pro_monthly → Offers → winback_3mo_30off**

**Step 2: Confirm eligibility settings**

- Eligibility: "Lapsed subscribers" (Google's term for users who cancelled)
- Window: cancelled within last 30 days
- Phases: 1 phase, 3 billing cycles, 30% off

**Step 3: Activate offer**

Click "Activate" → confirm.

**Step 4: Verification**

Screenshot of active win-back offer. Save to `~/Desktop/v1.0.29_offers/play_winback.png`.

---

## Phase 5: Review prompt at wow moments

### Task 14: i18n strings for review prompt context (if any)

**Step 1: Native StoreReview prompts use Apple/Google's own copy.**

`expo-store-review` triggers the OS-level prompt — there's no app-side copy to translate. Skip this task.

---

### Task 15: Frontend — write failing test for review prompt throttle

**Files:**
- Create: `frontend/__tests__/reviewPrompt.test.ts`

**Step 1: Write the test**

```typescript
// frontend/__tests__/reviewPrompt.test.ts

// Mock AsyncStorage and expo-store-review
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRequestReview = jest.fn();
const mockIsAvailableAsync = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: (k: string) => mockGetItem(k),
  setItem: (k: string, v: string) => mockSetItem(k, v),
}));

jest.mock("expo-store-review", () => ({
  requestReview: () => mockRequestReview(),
  isAvailableAsync: () => mockIsAvailableAsync(),
}));

import { maybePromptReview } from "../services/reviewPrompt";

describe("maybePromptReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailableAsync.mockResolvedValue(true);
  });

  it("prompts on legendary trigger when no prior prompt exists", async () => {
    mockGetItem.mockResolvedValue(null);

    await maybePromptReview({ trigger: "legendary_scan", scanCount: 5 });

    expect(mockRequestReview).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith(
      "last_review_prompt_at",
      expect.any(String)
    );
  });

  it("does NOT prompt if last prompt was within 90 days", async () => {
    const recent = Date.now() - 1000 * 60 * 60 * 24 * 30; // 30d ago
    mockGetItem.mockResolvedValue(String(recent));

    await maybePromptReview({ trigger: "legendary_scan", scanCount: 5 });

    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it("DOES prompt if last prompt was 91+ days ago", async () => {
    const old = Date.now() - 1000 * 60 * 60 * 24 * 91;
    mockGetItem.mockResolvedValue(String(old));

    await maybePromptReview({ trigger: "legendary_scan", scanCount: 5 });

    expect(mockRequestReview).toHaveBeenCalledTimes(1);
  });

  it("does NOT prompt if user has fewer than 3 scans (haven't earned the right)", async () => {
    mockGetItem.mockResolvedValue(null);

    await maybePromptReview({ trigger: "legendary_scan", scanCount: 2 });

    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it("rejects non-allowed triggers", async () => {
    mockGetItem.mockResolvedValue(null);

    await maybePromptReview({ trigger: "paywall_view" as any, scanCount: 100 });

    expect(mockRequestReview).not.toHaveBeenCalled();
  });

  it("accepts all four allowed triggers", async () => {
    mockGetItem.mockResolvedValue(null);

    const triggers = [
      "legendary_scan",
      "achievement_silver_gold",
      "streak_7d",
      "unique_classes_50",
    ] as const;

    for (const trigger of triggers) {
      mockSetItem.mockClear();
      mockRequestReview.mockClear();
      mockGetItem.mockResolvedValue(null);

      await maybePromptReview({ trigger, scanCount: 10 });

      expect(mockRequestReview).toHaveBeenCalledTimes(1);
    }
  });

  it("does not prompt if expo-store-review is unavailable", async () => {
    mockGetItem.mockResolvedValue(null);
    mockIsAvailableAsync.mockResolvedValue(false);

    await maybePromptReview({ trigger: "legendary_scan", scanCount: 5 });

    expect(mockRequestReview).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run test, expect FAIL**

```bash
cd frontend && npx jest __tests__/reviewPrompt.test.ts
```
Expected: fails with "Cannot find module '../services/reviewPrompt'".

**Step 3: Commit failing tests**

```bash
git add frontend/__tests__/reviewPrompt.test.ts
git commit -m "test(reviewPrompt): expect throttle + trigger gating

Failing tests — implementation in next commit."
```

---

### Task 16: Frontend — implement reviewPrompt service

**Files:**
- Create: `frontend/services/reviewPrompt.ts`

**Step 1: Implement**

```typescript
// frontend/services/reviewPrompt.ts
//
// Triggers `expo-store-review` at well-defined "wow moment" points
// in the user's collection journey. Layers a 90-day local throttle on
// top of iOS's native 365-day rate limit, so we don't burn three
// prompts in one good week.
//
// Allowed triggers (from docs/plans/2026-05-07-retention-and-offers-design.md):
// - legendary_scan         — first time a user sees a Legendary card
// - achievement_silver_gold — silver or gold tier achievement unlocked
// - streak_7d              — daily-streak counter hits 7
// - unique_classes_50      — 50th unique class scanned

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

export type ReviewTrigger =
  | "legendary_scan"
  | "achievement_silver_gold"
  | "streak_7d"
  | "unique_classes_50";

const ALLOWED_TRIGGERS: readonly ReviewTrigger[] = [
  "legendary_scan",
  "achievement_silver_gold",
  "streak_7d",
  "unique_classes_50",
] as const;

const STORAGE_KEY = "last_review_prompt_at";
const THROTTLE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const MIN_SCAN_COUNT = 3; // user must have earned the right to be asked

export interface MaybePromptReviewArgs {
  trigger: ReviewTrigger | string;
  scanCount: number;
}

export async function maybePromptReview(
  args: MaybePromptReviewArgs
): Promise<void> {
  // Reject non-allowed triggers
  if (!ALLOWED_TRIGGERS.includes(args.trigger as ReviewTrigger)) {
    return;
  }

  // Reject if user hasn't earned the prompt yet
  if (args.scanCount < MIN_SCAN_COUNT) {
    return;
  }

  // Reject if expo-store-review is not available on this platform/build
  const available = await StoreReview.isAvailableAsync();
  if (!available) {
    return;
  }

  // Throttle: must be ≥ 90 days since last prompt
  const lastRaw = await AsyncStorage.getItem(STORAGE_KEY);
  if (lastRaw) {
    const last = parseInt(lastRaw, 10);
    if (!Number.isNaN(last) && Date.now() - last < THROTTLE_MS) {
      return;
    }
  }

  // Fire the OS prompt and record the timestamp.
  // Note: requestReview returns void on most platforms — there's no
  // signal of whether the user actually wrote a review or dismissed.
  // Still record the timestamp so we don't ask again within 90 days.
  try {
    StoreReview.requestReview();
    await AsyncStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch (err) {
    // Silent failure — review prompt is fire-and-forget
    console.warn("[reviewPrompt] requestReview failed", err);
  }
}
```

**Step 2: Run tests, expect PASS**

```bash
cd frontend && npx jest __tests__/reviewPrompt.test.ts
```
Expected: 7/7 pass.

**Step 3: Run full frontend suite**

```bash
cd frontend && npm test
```
Expected: 145/145 (138 + 7).

**Step 4: TS check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: clean.

**Step 5: Commit**

```bash
git add frontend/services/reviewPrompt.ts
git commit -m "feat(reviewPrompt): wow-moment review prompt with 90d throttle

Triggers expo-store-review only at four whitelisted moments
(legendary scan, silver/gold achievement, 7-day streak, 50 unique
classes) and only after the user has scanned at least 3 trains.

Refs: docs/plans/2026-05-07-retention-and-offers-design.md"
```

---

### Task 17: Wire review prompt into card-reveal (Legendary trigger)

**Files:**
- Modify: `frontend/app/card-reveal.tsx`

**Step 1: Locate the Legendary classification render block**

```bash
grep -n "legendary\|Legendary\|RARITY_LEGENDARY" frontend/app/card-reveal.tsx | head -20
```

**Step 2: Add review prompt call**

In the `useEffect` that fires after the card has rendered (or wherever rarity tier is computed and stable), add:

```typescript
import { maybePromptReview } from "../services/reviewPrompt";
// ... existing imports

// Inside the existing post-render effect, after rarity is known:
useEffect(() => {
  if (rarity === "legendary") {
    const scanCount = useTrainStore.getState().history?.length ?? 0;
    maybePromptReview({ trigger: "legendary_scan", scanCount });
  }
}, [rarity]);
```

(Adapt to existing code style — the actual location depends on the current `card-reveal.tsx` shape. Find the post-render effect, don't add a new one if there's already one with the right deps.)

**Step 3: Manual test**

Trigger a legendary scan in dev (e.g. scan a known DRG Baureihe 35.10 or similar). Confirm the review prompt fires on first attempt, then does NOT fire on a second legendary within 90 days.

**Step 4: Commit**

```bash
git add frontend/app/card-reveal.tsx
git commit -m "feat(reviewPrompt): wire legendary_scan trigger into card-reveal"
```

---

### Task 18: Wire review prompt into achievement unlock (silver/gold tier)

**Files:**
- Modify: `frontend/store/trainStore.ts` OR wherever achievement unlocks are detected (look for `unlockAchievement`, `awardAchievement`, etc.)

**Step 1: Find the achievement unlock code path**

```bash
grep -rn "unlockAchievement\|awardAchievement\|silver\|gold" frontend/store/ | head -20
```

**Step 2: After silver or gold tier is awarded, trigger the prompt**

```typescript
import { maybePromptReview } from "../services/reviewPrompt";

// In the unlock code path, after the achievement is persisted:
if (achievement.tier === "silver" || achievement.tier === "gold") {
  const scanCount = get().history?.length ?? 0;
  maybePromptReview({ trigger: "achievement_silver_gold", scanCount });
}
```

**Step 3: Commit**

```bash
git add frontend/store/trainStore.ts
git commit -m "feat(reviewPrompt): wire silver/gold achievement unlock trigger"
```

---

### Task 19: Wire review prompt into 7-day streak hit

**Files:**
- Modify: wherever streak increments are computed (`store/leaderboardStore.ts` or `store/trainStore.ts` — depends on Phase 2 leaderboard wiring)

**Step 1: Find the streak increment**

```bash
grep -rn "streak\|streakDays\|streak_days" frontend/store/ | head -20
```

**Step 2: Trigger when streak first hits 7**

```typescript
import { maybePromptReview } from "../services/reviewPrompt";

// In the streak update code path:
if (newStreakDays === 7) {
  const scanCount = get().history?.length ?? 0;
  maybePromptReview({ trigger: "streak_7d", scanCount });
}
```

**Step 3: Commit**

```bash
git add frontend/store/<file>.ts
git commit -m "feat(reviewPrompt): wire 7-day streak trigger"
```

---

### Task 20: Wire review prompt into 50th unique class scanned

**Files:**
- Modify: `frontend/store/trainStore.ts` — wherever unique classes are tallied

**Step 1: Find the unique-class-counter**

```bash
grep -rn "uniqueClasses\|unique_classes\|distinct" frontend/store/trainStore.ts | head -20
```

**Step 2: Trigger when count hits 50**

```typescript
import { maybePromptReview } from "../services/reviewPrompt";

// After a scan completes and unique-classes count is updated:
if (uniqueClassCount === 50) {
  const scanCount = get().history?.length ?? 0;
  maybePromptReview({ trigger: "unique_classes_50", scanCount });
}
```

**Step 3: Commit**

```bash
git add frontend/store/trainStore.ts
git commit -m "feat(reviewPrompt): wire 50-unique-classes trigger"
```

---

## Phase 6: QA + ship

### Task 21: TestFlight build for v1.0.29 candidate

**Files:**
- Modify: `frontend/app.json` — bump version 1.0.28 → 1.0.29, iOS buildNumber 51 → 52, Android versionCode 16 → 17

**Step 1: Bump version**

```bash
cd /Users/StephenLear/Projects/locosnap/frontend
# Edit app.json manually:
# - "version": "1.0.28" → "1.0.29"
# - ios.buildNumber: "51" → "52"
# - android.versionCode: 16 → 17
```

**Step 2: Commit version bump**

```bash
git add frontend/app.json
git commit -m "chore: bump v1.0.28 → v1.0.29 (retention + offers)"
```

**Step 3: Trigger EAS production build for both platforms**

```bash
cd frontend && eas build --platform all --profile production --non-interactive
```

Expected: build IDs printed, both platforms queued.

**Step 4: Wait for builds + record artifact URLs**

Monitor at https://expo.dev/accounts/<account>/projects/locosnap/builds. Record:
- iOS build ID + .ipa URL
- Android build ID + .aab URL

Save to handover file.

---

### Task 22: Submit v1.0.29 to App Store + Play Store

**Step 1: Submit both**

```bash
cd frontend && eas submit --platform all --profile production --non-interactive --latest
```

**Step 2: Add release notes in App Store Connect + Play Console**

DE: "Lebenslang-Pro neu, 30% Rabatt für 3 Monate beim Jahresabo, Überraschungs-Bewertungs-Hinweis nach erstem Legendary-Fund."

EN: "New Lifetime Pro, 30% off first 3 months on Annual, gentle review prompt after your first Legendary find."

PL: "Nowy plan na zawsze, 30% taniej przez 3 miesiące rocznego abonamentu, prośba o ocenę po pierwszym Legendarnym znalezisku."

**Step 3: Submit Apple build for review** (Android auto-publishes per `eas.json` releaseStatus)

---

### Task 23: Manual QA on TestFlight + Internal track

**Step 1: Install TestFlight v1.0.29 on test iPhone**

**Step 2: Run through three personas**

Persona A — never-subscribed:
- Open paywall → confirm 3 rows visible (monthly, annual w/ intro badge, lifetime)
- Tap Annual → confirm 30% off price + intro disclaimer
- Sandbox-purchase → confirm successful Pro grant
- Cancel from Settings → confirm Apple Retention Messaging UI fires with the EN message + redeem CTA

Persona B — annual subscriber post-trial:
- Switch to a sandbox account that already has annual sub
- Cancel from Settings → confirm Retention Messaging fires
- Tap "Redeem" → confirm 30% off applied

Persona C — review prompt:
- Switch to fresh account, scan 5 known trains including one Legendary (e.g. preserved Class 37 / DRG 35.10)
- Confirm OS review prompt fires on first Legendary
- Re-trigger another Legendary scan within same session — confirm prompt does NOT re-fire

**Step 3: Document QA pass/fail in handover**

---

### Task 24: Update CHANGELOG.md and ARCHITECTURE.md

**Files:**
- Modify: `docs/CHANGELOG.md` — new 2026-05-07 entry
- Modify: `docs/ARCHITECTURE.md` — bump "Last updated" + add retention messaging architecture section

**Step 1: CHANGELOG entry**

Prepend to `docs/CHANGELOG.md`:

```markdown
## 2026-05-07

### v1.0.29 — Retention Messaging + Offer Architecture

Three new offer SKUs across both stores: introductory (30% off 3mo on annual), win-back (30% off 3mo on monthly), lifetime ($99.99 / €99 / 399 zł non-consumable). RevenueCat product mapping updated to include `pro_lifetime` package. Apple Retention Messaging campaign configured with three locale messages (EN/DE/PL). Google Play Win-back trigger active on `pro_monthly`. Backend RevenueCat webhook handler extended to log CANCELLATION events into new `cancellation_reasons` table (migration 015). Frontend paywall shows 3 rows with intro badge and intro disclaimer on annual. New `services/reviewPrompt.ts` triggers `expo-store-review` at four wow moments (legendary scan, silver/gold achievement unlock, 7-day streak, 50 unique classes) with a 90-day local throttle layered on top of iOS's 365-day rule. EAS production builds: iOS build 52, Android versionCode 17.

Tests: 173/173 backend, 145/145 frontend, tsc clean both sides.
```

**Step 2: ARCHITECTURE.md update**

Find the "Last updated" line at the top and prepend a 2026-05-07 entry summarising the new architecture pieces. Find the AI provider / monetization section and add a "Retention Messaging" subsection.

**Step 3: Commit both docs**

```bash
git add docs/CHANGELOG.md docs/ARCHITECTURE.md
git commit -m "docs: v1.0.29 retention messaging + offer architecture"
```

---

### Task 25: Push to main + Render auto-deploys backend

**Step 1: Cherry-pick (or merge) to main**

If on worktree, cherry-pick all backend commits to main; frontend commits travel with the EAS build artifact, not the main branch deploy.

```bash
cd /Users/StephenLear/Projects/locosnap
git cherry-pick <backend-commits...>
git push origin main
```

**Step 2: Confirm Render deploy**

Render dashboard → Events → wait for deploy completion.

**Step 3: Smoke test cancellation logging**

Trigger a sandbox cancellation in RevenueCat. Within 30 seconds, verify a row appears in `cancellation_reasons`:

```sql
SELECT * FROM cancellation_reasons ORDER BY created_at DESC LIMIT 1;
```

Expected: most recent test cancellation visible with correct fields.

---

## Phase 7: Memory + handover

### Task 26: Update memory files

**Files:**
- Modify: `~/.claude/projects/-Users-StephenLear-Projects-locosnap/memory/project_lifetime_pro_demand.md`
- Modify: `~/.claude/projects/-Users-StephenLear-Projects-locosnap/memory/project_churn_patterns.md`
- Modify: `~/.claude/projects/-Users-StephenLear-Projects-locosnap/memory/project_supabase_topology.md`

**Step 1: project_lifetime_pro_demand.md** — close out

Add note: "Lifetime SKU shipped in v1.0.29 (2026-05-07) at $99.99 / €99 / 399 zł — €99 lands at aurel's anchor. Tracker remains open for monitoring conversion volume; revisit pricing if no Lifetime purchases in first 30 days."

**Step 2: project_churn_patterns.md** — link to new instrumentation

Add note: "v1.0.29 ships Apple Retention Messaging + cancellation_reasons capture (migration 015). After 30 days in production, query cancellation_reasons for time-bucket distribution + save rate to validate whether the retention layer is moving the needle."

**Step 3: project_supabase_topology.md** — bump migration count

Update from "migration 014" → "migration 015" with brief note about cancellation_reasons table.

**Step 4: Commit (memory files are outside the repo; file edits commit themselves to the memory store automatically)**

---

### Task 27: Run /handover for session close

**Step 1: Invoke handover skill**

Type `/handover` in Claude.

**Step 2: Confirm handover doc captures:**

- v1.0.29 EAS build IDs
- App Store + Play Store submission state
- Apple Retention Messaging campaign review state
- Migration 015 applied to prod (yes/no)
- Test counts (173/173 backend, 145/145 frontend)
- Outstanding work for v1.0.30 candidates (Adam-style onboarding redesign, A/B test framework, per-user variable substitution in retention messages)

---

## Risk register (live)

- **Apple Retention Messaging campaign review** — Apple may take 1-3 days to approve the campaign. Build can ship before campaign is approved; campaign goes live retroactively when approved.
- **Lifetime cannibalisation** — monitor RevenueCat for Lifetime vs Annual mix in first 30 days. If lifetime is >50% of new purchases, may want to hide behind disclosure.
- **Cancellation event volume** — webhook traffic may spike when v1.0.29 hits stores. Watch Render error logs for any `cancellation_log_failed` events.
- **`expo-store-review` is platform-dependent** — confirm it's already in the Expo SDK version. If not, `expo install expo-store-review` is required and adds a native module — would require a new dev build for testing.

## Verification checklist before declaring v1.0.29 done

- [ ] All three offer SKUs visible in App Store Connect dashboard
- [ ] All three offer SKUs visible in Play Console
- [ ] RevenueCat default offering shows 3 packages (monthly, annual, lifetime)
- [ ] RevenueCat sandbox annual purchase applies 30% intro discount
- [ ] RevenueCat sandbox lifetime purchase grants `pro` entitlement with no expiry
- [ ] Migration 015 applied to production Supabase
- [ ] Backend deployed to Render with cancellation logging active
- [ ] Apple Retention Messaging campaign submitted (review pending)
- [ ] Play Console Win-back offer Active
- [ ] Frontend paywall shows 3 rows, intro badge on annual, intro disclaimer below
- [ ] Review prompt fires on first Legendary, NOT on second within 90 days
- [ ] EAS iOS build 52 + Android versionCode 17 both built and submitted
- [ ] CHANGELOG.md + ARCHITECTURE.md updated
- [ ] Test counts: 173/173 backend, 145/145 frontend, tsc clean both sides
