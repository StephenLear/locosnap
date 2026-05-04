// Mock all deep dependencies before importing authStore
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../services/analytics', () => ({
  track: jest.fn(),
  identifyUser: jest.fn(),
  resetIdentity: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock('../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const updateProfileIdentityMock = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock('../services/supabase', () => ({
  updateProfileIdentity: updateProfileIdentityMock,
}));

jest.mock('../services/purchases', () => ({
  loginRevenueCat: jest.fn(),
  logoutRevenueCat: jest.fn(),
  syncProStatus: jest.fn().mockResolvedValue(false),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore, Profile } from '../store/authStore';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    username: null,
    avatar_url: null,
    level: 1,
    xp: 0,
    streak_current: 0,
    streak_best: 0,
    last_spot_date: null,
    daily_scans_used: 0,
    is_pro: false,
    blueprint_credits: 0,
    region: null,
    country_code: null,
    spotter_emoji: null,
    has_completed_identity_onboarding: false,
    ...overrides,
  };
}

function makeSession(): any {
  return { user: { id: 'u1' } };
}

describe('authStore identity actions', () => {
  beforeEach(() => {
    useAuthStore.setState({ profile: null, session: null, user: null });
    updateProfileIdentityMock.mockClear();
    (AsyncStorage.setItem as jest.Mock).mockClear?.();
  });

  it('updateCountryCode optimistically updates Zustand', async () => {
    useAuthStore.setState({
      profile: makeProfile({ country_code: null }),
      session: makeSession(),
      user: makeSession().user,
    });
    await useAuthStore.getState().updateCountryCode('DE');
    expect(useAuthStore.getState().profile?.country_code).toBe('DE');
    expect(updateProfileIdentityMock).toHaveBeenCalledWith('u1', { country_code: 'DE' });
  });

  it('updateSpotterEmoji optimistically updates Zustand', async () => {
    useAuthStore.setState({
      profile: makeProfile({ spotter_emoji: null }),
      session: makeSession(),
      user: makeSession().user,
    });
    await useAuthStore.getState().updateSpotterEmoji('train_steam');
    expect(useAuthStore.getState().profile?.spotter_emoji).toBe('train_steam');
    expect(updateProfileIdentityMock).toHaveBeenCalledWith('u1', { spotter_emoji: 'train_steam' });
  });

  it('markIdentityOnboardingComplete sets the flag', async () => {
    useAuthStore.setState({
      profile: makeProfile({ has_completed_identity_onboarding: false }),
      session: makeSession(),
      user: makeSession().user,
    });
    await useAuthStore.getState().markIdentityOnboardingComplete();
    expect(useAuthStore.getState().profile?.has_completed_identity_onboarding).toBe(true);
    expect(updateProfileIdentityMock).toHaveBeenCalledWith('u1', {
      has_completed_identity_onboarding: true,
    });
  });

  it('updateCountryCode falls back to AsyncStorage when no session', async () => {
    useAuthStore.setState({ profile: null, session: null, user: null });
    await useAuthStore.getState().updateCountryCode('PL');
    expect(updateProfileIdentityMock).not.toHaveBeenCalled();
    // AsyncStorage write happens regardless of session
    const stored = await AsyncStorage.getItem('locosnap_anonymous_identity_country');
    expect(stored).toBe('PL');
  });

  it('updateSpotterEmoji falls back to AsyncStorage when no session', async () => {
    useAuthStore.setState({ profile: null, session: null, user: null });
    await useAuthStore.getState().updateSpotterEmoji('tram');
    expect(updateProfileIdentityMock).not.toHaveBeenCalled();
    const stored = await AsyncStorage.getItem('locosnap_anonymous_identity_emoji');
    expect(stored).toBe('tram');
  });

  it('markIdentityOnboardingComplete falls back to AsyncStorage when no session', async () => {
    useAuthStore.setState({ profile: null, session: null, user: null });
    await useAuthStore.getState().markIdentityOnboardingComplete();
    expect(updateProfileIdentityMock).not.toHaveBeenCalled();
    const stored = await AsyncStorage.getItem('locosnap_identity_onboarding_completed');
    expect(stored).toBe('true');
  });
});
