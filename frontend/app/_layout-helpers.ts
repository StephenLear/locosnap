// ============================================================
// LocoSnap — Root layout helpers
// Pure logic split out of _layout.tsx so it can be unit-tested.
// ============================================================

import { Profile } from "../store/authStore";

interface OnboardingGateInput {
  profile: Profile | null;
  anonymousFlag: string | null;
}

/**
 * Returns true if the identity-onboarding modal should be shown.
 * - Signed-in user: gated on profile.has_completed_identity_onboarding
 * - Anonymous user: gated on AsyncStorage flag locosnap_identity_onboarding_completed
 */
export function shouldShowOnboarding({
  profile,
  anonymousFlag,
}: OnboardingGateInput): boolean {
  if (profile) return !profile.has_completed_identity_onboarding;
  return anonymousFlag !== "true";
}
