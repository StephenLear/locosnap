// ============================================================
// LocoSnap — authStore helpers
// Pure logic split out of authStore.ts for unit testing.
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Profile } from "./authStore";

// Single source of truth for the identity AsyncStorage keys. Both
// authStore (for write paths) and the migration helpers (for read/clear)
// must import from here to avoid drift.
export const ANONYMOUS_COUNTRY_KEY = "locosnap_anonymous_identity_country";
export const ANONYMOUS_EMOJI_KEY = "locosnap_anonymous_identity_emoji";
export const IDENTITY_ONBOARDING_KEY = "locosnap_identity_onboarding_completed";

export interface AnonymousIdentityUpdates {
  country_code?: string;
  spotter_emoji?: string;
  has_completed_identity_onboarding?: boolean;
}

/**
 * After OTP signup completes, lift any anonymous-stage identity values from
 * AsyncStorage onto the new Supabase profile. Server values always win on
 * conflict (e.g. signed in on another device).
 *
 * Returns the patch object to apply, or null if no migration is needed.
 *
 * Side-effect: when both server-side identity fields are already populated
 * (server wins), we clear the stale anonymous AsyncStorage keys here so they
 * don't leak forever and re-fire on every signin. The caller is still
 * responsible for clearing keys after a successful PATCH (see
 * clearAnonymousIdentity).
 */
export async function migrateAnonymousIdentity({
  profile,
}: {
  profile: Profile | null;
}): Promise<AnonymousIdentityUpdates | null> {
  if (!profile) return null;

  const [country, emoji, onboardingFlag] = await Promise.all([
    AsyncStorage.getItem(ANONYMOUS_COUNTRY_KEY),
    AsyncStorage.getItem(ANONYMOUS_EMOJI_KEY),
    AsyncStorage.getItem(IDENTITY_ONBOARDING_KEY),
  ]);

  // If both identity fields are already populated server-side, server wins.
  // Clear the AsyncStorage values now so they don't re-apply on next launch
  // (the onboarding flag is intentionally left intact since it gates the
  // onboarding modal regardless of identity values).
  if (profile.country_code !== null && profile.spotter_emoji !== null) {
    if (country || emoji) {
      await Promise.all([
        AsyncStorage.removeItem(ANONYMOUS_COUNTRY_KEY),
        AsyncStorage.removeItem(ANONYMOUS_EMOJI_KEY),
      ]);
    }
    // Still need to migrate the onboarding flag if anonymous user completed
    // onboarding before signup but server has it false.
    if (onboardingFlag === "true" && !profile.has_completed_identity_onboarding) {
      return { has_completed_identity_onboarding: true };
    }
    return null;
  }

  const hasAnonValues = country || emoji || onboardingFlag === "true";
  if (!hasAnonValues) return null;

  const updates: AnonymousIdentityUpdates = {};
  if (country && profile.country_code === null) updates.country_code = country;
  if (emoji && profile.spotter_emoji === null) updates.spotter_emoji = emoji;
  if (onboardingFlag === "true" && !profile.has_completed_identity_onboarding) {
    updates.has_completed_identity_onboarding = true;
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

/**
 * Clear all anonymous-stage AsyncStorage keys. Called after a successful
 * migration so we don't re-apply values on subsequent launches.
 */
export async function clearAnonymousIdentity(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(ANONYMOUS_COUNTRY_KEY),
    AsyncStorage.removeItem(ANONYMOUS_EMOJI_KEY),
    // Note: IDENTITY_ONBOARDING_KEY intentionally NOT cleared here — the gate
    // also reads it for unauthenticated users on subsequent launches before
    // a profile exists. fetchProfile only runs when a session is live.
  ]);
}
