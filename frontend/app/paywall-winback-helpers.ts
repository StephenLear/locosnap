// Pure logic helpers for the Android Play win-back tile. ts-jest
// testable in isolation (no RN / RevenueCat dependency).
//
// The Play win-back offer (`winback-annual-33off`, tag `winback-annual`,
// 1 year for ~€19.99 single payment, attached to pro_annual:annual-autorenew)
// is "Developer determined eligibility" — Google does NOT auto-surface it.
// The app has to detect an eligible lapsed user, find the tagged
// subscriptionOption on the annual product, and purchase it directly.
// Apple surfaces its own win-back automatically, so this tile is Android-only.
//
// Visibility decision + price extraction live here so the paywall component
// stays presentation-only and the truth table is unit-tested.

// ── Visibility decision ───────────────────────────────────────────
// Show the win-back tile only when ALL hold:
//   - platform is Android (iOS uses Apple's native auto-surfaced offer)
//   - the user is a lapsed Pro (had `pro`, now expired) — see
//     isLapsedProEligible() in services/purchases.ts
//   - the tagged subscriptionOption was actually found on the annual product
export interface WinBackVisibilityInputs {
  platform: string;
  lapsed: boolean;
  hasOption: boolean;
}

export function decideWinBackVisibility(
  inputs: WinBackVisibilityInputs
): boolean {
  return inputs.platform === "android" && inputs.lapsed && inputs.hasOption;
}

// ── Price extraction ──────────────────────────────────────────────
// Read the live, localized price string off the win-back subscriptionOption
// so we never hardcode "€19.99" (it varies per market and can be repriced).
// The win-back is a SINGLE_PAYMENT offer: its real charge lives in the first
// pricing phase whose amount is greater than zero. RevenueCat already exposes
// that as `fullPricePhase`; fall back to the first phase if absent.
// Returns null when no usable formatted price can be found.
interface PriceLike {
  formatted?: string | null;
  amountMicros?: number | null;
}
interface PricingPhaseLike {
  price?: PriceLike | null;
}
interface SubscriptionOptionLike {
  fullPricePhase?: PricingPhaseLike | null;
  pricingPhases?: PricingPhaseLike[] | null;
}

export function getWinBackPriceString(
  option: SubscriptionOptionLike | null | undefined
): string | null {
  if (!option) return null;

  // `fullPricePhase` is RC's first phase with amountMicros > 0 — the real
  // charge — so prefer it directly.
  const fromFullPrice = option.fullPricePhase?.price?.formatted;
  if (typeof fromFullPrice === "string" && fromFullPrice.length > 0) {
    return fromFullPrice;
  }

  // Fallback: first phase with a usable, NON-ZERO price. Skipping zero-amount
  // phases avoids advertising a "€0.00" free-trial phase as the offer price.
  const phases = option.pricingPhases ?? [];
  for (const phase of phases) {
    const price = phase?.price;
    if (!price) continue;
    if (price.amountMicros === 0) continue;
    if (typeof price.formatted === "string" && price.formatted.length > 0) {
      return price.formatted;
    }
  }

  return null;
}
