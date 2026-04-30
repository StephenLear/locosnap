jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateAnonymousIdentity, clearAnonymousIdentity } from '../store/authStore-helpers';
import type { Profile } from '../store/authStore';

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1', username: null, avatar_url: null, level: 1, xp: 0,
    streak_current: 0, streak_best: 0, last_spot_date: null,
    daily_scans_used: 0, is_pro: false, blueprint_credits: 0, region: null,
    country_code: null, spotter_emoji: null,
    has_completed_identity_onboarding: false,
    ...overrides,
  };
}

describe('migrateAnonymousIdentity', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns updates from AsyncStorage when profile has NULLs', async () => {
    await AsyncStorage.setItem('locosnap_anonymous_identity_country', 'DE');
    await AsyncStorage.setItem('locosnap_anonymous_identity_emoji', 'train_steam');
    const updates = await migrateAnonymousIdentity({ profile: profile() });
    expect(updates).toEqual({ country_code: 'DE', spotter_emoji: 'train_steam' });
  });

  it('returns null when AsyncStorage is empty', async () => {
    const updates = await migrateAnonymousIdentity({ profile: profile() });
    expect(updates).toBeNull();
  });

  it('returns null and clears AsyncStorage when profile already has both values (server wins)', async () => {
    await AsyncStorage.setItem('locosnap_anonymous_identity_country', 'DE');
    await AsyncStorage.setItem('locosnap_anonymous_identity_emoji', 'train_steam');
    const updates = await migrateAnonymousIdentity({
      profile: profile({ country_code: 'PL', spotter_emoji: 'train_diesel' }),
    });
    expect(updates).toBeNull();
    // Stale anon values should be cleared to prevent re-application on next launch
    expect(await AsyncStorage.getItem('locosnap_anonymous_identity_country')).toBeNull();
    expect(await AsyncStorage.getItem('locosnap_anonymous_identity_emoji')).toBeNull();
  });

  it('lifts onboarding completion flag onto profile when anon flag is set', async () => {
    await AsyncStorage.setItem('locosnap_identity_onboarding_completed', 'true');
    const updates = await migrateAnonymousIdentity({
      profile: profile({ has_completed_identity_onboarding: false }),
    });
    expect(updates).toEqual({ has_completed_identity_onboarding: true });
  });

  it('combines identity values + onboarding flag in a single patch', async () => {
    await AsyncStorage.setItem('locosnap_anonymous_identity_country', 'DE');
    await AsyncStorage.setItem('locosnap_anonymous_identity_emoji', 'train_steam');
    await AsyncStorage.setItem('locosnap_identity_onboarding_completed', 'true');
    const updates = await migrateAnonymousIdentity({ profile: profile() });
    expect(updates).toEqual({
      country_code: 'DE',
      spotter_emoji: 'train_steam',
      has_completed_identity_onboarding: true,
    });
  });

  it('does not migrate onboarding flag when server already has it true', async () => {
    await AsyncStorage.setItem('locosnap_identity_onboarding_completed', 'true');
    const updates = await migrateAnonymousIdentity({
      profile: profile({ has_completed_identity_onboarding: true }),
    });
    expect(updates).toBeNull();
  });

  it('returns partial updates when only one field is missing on profile', async () => {
    await AsyncStorage.setItem('locosnap_anonymous_identity_country', 'DE');
    await AsyncStorage.setItem('locosnap_anonymous_identity_emoji', 'train_steam');
    const updates = await migrateAnonymousIdentity({
      profile: profile({ country_code: 'PL', spotter_emoji: null }),
    });
    expect(updates).toEqual({ spotter_emoji: 'train_steam' });
  });

  it('returns null when profile is null', async () => {
    const updates = await migrateAnonymousIdentity({ profile: null });
    expect(updates).toBeNull();
  });

  it('clearAnonymousIdentity removes both keys', async () => {
    await AsyncStorage.setItem('locosnap_anonymous_identity_country', 'DE');
    await AsyncStorage.setItem('locosnap_anonymous_identity_emoji', 'train_steam');
    await clearAnonymousIdentity();
    expect(await AsyncStorage.getItem('locosnap_anonymous_identity_country')).toBeNull();
    expect(await AsyncStorage.getItem('locosnap_anonymous_identity_emoji')).toBeNull();
  });
});
