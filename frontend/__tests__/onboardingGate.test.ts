import { shouldShowOnboarding } from '../app/_layout-helpers';
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

describe('shouldShowOnboarding', () => {
  it('returns true for signed-in user with has_completed_identity_onboarding=false', () => {
    expect(
      shouldShowOnboarding({
        profile: profile({ has_completed_identity_onboarding: false }),
        anonymousFlag: null,
      })
    ).toBe(true);
  });

  it('returns false for signed-in user with has_completed_identity_onboarding=true', () => {
    expect(
      shouldShowOnboarding({
        profile: profile({ has_completed_identity_onboarding: true }),
        anonymousFlag: null,
      })
    ).toBe(false);
  });

  it('returns true for anonymous user with no flag', () => {
    expect(
      shouldShowOnboarding({ profile: null, anonymousFlag: null })
    ).toBe(true);
  });

  it('returns false for anonymous user with flag set to "true"', () => {
    expect(
      shouldShowOnboarding({ profile: null, anonymousFlag: 'true' })
    ).toBe(false);
  });

  it('returns true for anonymous user with malformed flag value', () => {
    expect(
      shouldShowOnboarding({ profile: null, anonymousFlag: 'false' })
    ).toBe(true);
  });
});
