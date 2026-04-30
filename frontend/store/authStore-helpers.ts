// ============================================================
// LocoSnap — authStore helpers
// Pure logic split out of authStore.ts for unit testing.
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Profile } from "./authStore";

const ANONYMOUS_COUNTRY_KEY = "locosnap_anonymous_identity_country";
const ANONYMOUS_EMOJI_KEY = "locosnap_anonymous_identity_emoji";

export interface AnonymousIdentityUpdates {
  country_code?: string;
  spotter_emoji?: string;
}

/**
 * After OTP signup completes, lift any anonymous-stage identity values from
 * AsyncStorage onto the new Supabase profile. If the profile already has
 * values from another device they win, per the design doc edge-case rule.
 *
 * Returns the patch object to apply (or null if no migration is needed).
 * Caller is responsible for the actual Supabase PATCH and AsyncStorage clear.
 */
export async function migrateAnonymousIdentity({
  profile,
}: {
  profile: Profile | null;
}): Promise<AnonymousIdentityUpdates | null> {
  if (!profile) return null;
  // If both fields already populated server-side, no migration needed.
  if (profile.country_code !== null && profile.spotter_emoji !== null) {
    return null;
  }

  const [country, emoji] = await Promise.all([
    AsyncStorage.getItem(ANONYMOUS_COUNTRY_KEY),
    AsyncStorage.getItem(ANONYMOUS_EMOJI_KEY),
  ]);

  if (!country && !emoji) return null;

  const updates: AnonymousIdentityUpdates = {};
  if (country && profile.country_code === null) updates.country_code = country;
  if (emoji && profile.spotter_emoji === null) updates.spotter_emoji = emoji;

  return Object.keys(updates).length > 0 ? updates : null;
}

/**
 * Clear the anonymous-stage AsyncStorage keys. Called after a successful
 * migration so we don't re-apply values on subsequent launches.
 */
export async function clearAnonymousIdentity(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(ANONYMOUS_COUNTRY_KEY),
    AsyncStorage.removeItem(ANONYMOUS_EMOJI_KEY),
  ]);
}
