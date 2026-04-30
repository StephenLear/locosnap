// End-to-end test for the anon→signed-in migration wiring inside
// authStore.fetchProfile. Helper-level behaviour is covered in
// anonymousMigration.test.ts; this test asserts the integration:
//   - successful PATCH triggers clearAnonymousIdentity
//   - failed PATCH does NOT trigger clearAnonymousIdentity
//   - the merged profile is set into Zustand

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../services/analytics', () => ({
  track: jest.fn(),
  identifyUser: jest.fn(),
  resetIdentity: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock('../services/purchases', () => ({
  loginRevenueCat: jest.fn(),
  logoutRevenueCat: jest.fn(),
  syncProStatus: jest.fn().mockResolvedValue(false),
}));

const updateProfileIdentityMock = jest.fn();
jest.mock('../services/supabase', () => ({
  updateProfileIdentity: updateProfileIdentityMock,
}));

// Build a programmable supabase mock — fetchProfile calls
// supabase.from('profiles').select('*').eq('id', userId).single().
const singleMock = jest.fn();
const eqMock = jest.fn(() => ({ single: singleMock }));
const selectMock = jest.fn(() => ({ eq: eqMock }));
const fromMock = jest.fn(() => ({ select: selectMock }));

jest.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(),
    },
    from: fromMock,
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';

const ANON_COUNTRY = 'locosnap_anonymous_identity_country';
const ANON_EMOJI = 'locosnap_anonymous_identity_emoji';
const ANON_ONBOARDING = 'locosnap_identity_onboarding_completed';

const baseServerProfile = {
  id: 'u1', username: null, avatar_url: null, level: 1, xp: 0,
  streak_current: 0, streak_best: 0, last_spot_date: null,
  daily_scans_used: 0, is_pro: false, blueprint_credits: 0, region: null,
  country_code: null, spotter_emoji: null,
  has_completed_identity_onboarding: false,
};

describe('fetchProfile anon→signed-in migration wiring', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    updateProfileIdentityMock.mockReset();
    singleMock.mockReset();
    useAuthStore.setState({
      session: null,
      user: { id: 'u1' } as any,
      profile: null,
    });
  });

  it('on successful PATCH: merges profile into Zustand AND clears anon AsyncStorage keys', async () => {
    await AsyncStorage.setItem(ANON_COUNTRY, 'DE');
    await AsyncStorage.setItem(ANON_EMOJI, 'train_steam');

    singleMock.mockResolvedValue({ data: baseServerProfile, error: null });
    updateProfileIdentityMock.mockResolvedValue({ data: null, error: null });

    await useAuthStore.getState().fetchProfile();

    expect(updateProfileIdentityMock).toHaveBeenCalledWith('u1', {
      country_code: 'DE',
      spotter_emoji: 'train_steam',
    });

    const profile = useAuthStore.getState().profile;
    expect(profile?.country_code).toBe('DE');
    expect(profile?.spotter_emoji).toBe('train_steam');

    expect(await AsyncStorage.getItem(ANON_COUNTRY)).toBeNull();
    expect(await AsyncStorage.getItem(ANON_EMOJI)).toBeNull();
  });

  it('on failed PATCH: keeps server profile in Zustand AND does NOT clear AsyncStorage', async () => {
    await AsyncStorage.setItem(ANON_COUNTRY, 'DE');
    await AsyncStorage.setItem(ANON_EMOJI, 'train_steam');

    singleMock.mockResolvedValue({ data: baseServerProfile, error: null });
    updateProfileIdentityMock.mockResolvedValue({
      data: null,
      error: { message: 'network down' },
    });

    await useAuthStore.getState().fetchProfile();

    // Profile reflects the un-merged server state — local optimistic merge
    // is intentionally skipped on PATCH failure (server is the source of truth).
    const profile = useAuthStore.getState().profile;
    expect(profile?.country_code).toBeNull();
    expect(profile?.spotter_emoji).toBeNull();

    // Anon keys preserved so the next fetchProfile attempt can retry.
    expect(await AsyncStorage.getItem(ANON_COUNTRY)).toBe('DE');
    expect(await AsyncStorage.getItem(ANON_EMOJI)).toBe('train_steam');
  });

  it('lifts the onboarding flag onto the server profile when AsyncStorage flag is set', async () => {
    await AsyncStorage.setItem(ANON_ONBOARDING, 'true');

    singleMock.mockResolvedValue({ data: baseServerProfile, error: null });
    updateProfileIdentityMock.mockResolvedValue({ data: null, error: null });

    await useAuthStore.getState().fetchProfile();

    expect(updateProfileIdentityMock).toHaveBeenCalledWith('u1', {
      has_completed_identity_onboarding: true,
    });
    expect(useAuthStore.getState().profile?.has_completed_identity_onboarding).toBe(true);
  });

  it('no-ops when AsyncStorage is empty and profile is fully populated', async () => {
    singleMock.mockResolvedValue({
      data: {
        ...baseServerProfile,
        country_code: 'PL',
        spotter_emoji: 'train_diesel',
        has_completed_identity_onboarding: true,
      },
      error: null,
    });

    await useAuthStore.getState().fetchProfile();

    expect(updateProfileIdentityMock).not.toHaveBeenCalled();
  });
});
