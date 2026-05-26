// Pure logic helper for the Pro expiring-soon banner. ts-jest
// testable in isolation (no RN / RevenueCat dependency).
//
// Days-remaining math + gating decision live here so the component
// itself is just presentation. Banner shows when:
//   - is_pro is true (caller's local profile state)
//   - RevenueCat entitlement info has an expirationDate (not lifetime)
//   - willRenew is false (auto-renewing users don't need a banner)
//   - days remaining is between 0 and 7 inclusive (1 week window)
//
// Edge cases handled here so the UI never has to:
//   - missing entitlement info → hide (legacy manually-granted Pro)
//   - already expired (negative days) → hide (RC sweep should
//     downgrade is_pro shortly; banner not the right surface to
//     surface "expired today" — the paywall lockout handles that)
//   - more than 7 days remaining → hide

export interface BannerInputs {
  isPro: boolean;
  entitlement: {
    expirationDate: string | null;
    willRenew: boolean;
  } | null;
  // ISO timestamp the caller treats as "now" (real `Date` in
  // production, fixed string in tests).
  now: string;
}

export type BannerDecision =
  | { show: false }
  | { show: true; daysRemaining: number };

export const BANNER_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function decideBannerVisibility(inputs: BannerInputs): BannerDecision {
  if (!inputs.isPro) return { show: false };
  if (!inputs.entitlement) return { show: false };
  if (!inputs.entitlement.expirationDate) return { show: false }; // lifetime
  if (inputs.entitlement.willRenew) return { show: false }; // auto-renewing

  const expiry = Date.parse(inputs.entitlement.expirationDate);
  const nowMs = Date.parse(inputs.now);
  if (!Number.isFinite(expiry) || !Number.isFinite(nowMs)) {
    return { show: false };
  }

  const msRemaining = expiry - nowMs;
  if (msRemaining < 0) return { show: false }; // already expired

  // Round up — "47 hours remaining" reads better as "2 days" than "1 day"
  const daysRemaining = Math.ceil(msRemaining / MS_PER_DAY);
  if (daysRemaining > BANNER_WINDOW_DAYS) return { show: false };

  return { show: true, daysRemaining };
}
