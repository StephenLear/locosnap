-- Add identity layer columns to profiles
-- See docs/plans/2026-04-29-leaderboard-phase1-design.md
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country_code TEXT NULL,
  ADD COLUMN IF NOT EXISTS spotter_emoji TEXT NULL,
  ADD COLUMN IF NOT EXISTS has_completed_identity_onboarding BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional index for leaderboard country filter (Phase 3 will use this)
CREATE INDEX IF NOT EXISTS idx_profiles_country_code ON profiles(country_code) WHERE country_code IS NOT NULL;

COMMENT ON COLUMN profiles.country_code IS 'ISO 3166-1 alpha-2 country code, user-selectable, default NULL';
COMMENT ON COLUMN profiles.spotter_emoji IS 'Identifier from spotterEmojis.ts (not the glyph)';
COMMENT ON COLUMN profiles.has_completed_identity_onboarding IS 'True after user completes the v1.0.22 identity onboarding flow';
