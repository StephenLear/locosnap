import { Profile } from '../store/authStore';

describe('Profile interface — identity fields', () => {
  it('has country_code, spotter_emoji, has_completed_identity_onboarding', () => {
    const sample: Profile = {
      id: 'x', username: null, avatar_url: null, level: 1, xp: 0,
      streak_current: 0, streak_best: 0, last_spot_date: null,
      daily_scans_used: 0, is_pro: false, blueprint_credits: 0, region: null,
      country_code: 'DE',
      spotter_emoji: 'train_steam',
      has_completed_identity_onboarding: true,
    };
    expect(sample.country_code).toBe('DE');
    expect(sample.spotter_emoji).toBe('train_steam');
    expect(sample.has_completed_identity_onboarding).toBe(true);
  });
});
