-- ============================================================
-- LocoSnap — Add country_code + spotter_emoji to leaderboard views
-- See docs/plans/2026-04-29-leaderboard-phase1-design.md
-- Depends on migration 010_identity_layer.sql (adds the two columns
-- to public.profiles).
--
-- Wrapped in a single transaction so the DROP/RECREATE pair is atomic.
-- Without this wrapper, in-flight SELECTs against the leaderboard views
-- between DROP and CREATE could observe "relation does not exist"
-- errors. Inside a transaction the DDL is invisible to other sessions
-- until COMMIT, so they either see the old views or block on the lock,
-- never the missing-relation window.
-- ============================================================

BEGIN;

-- Hard guard against running 011 before 010. If country_code is missing
-- from public.profiles, the view recreations below would silently succeed
-- without the new columns. Fail fast instead.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'country_code'
  ) THEN
    RAISE EXCEPTION 'Migration 011 requires migration 010 to be applied first (profiles.country_code missing)';
  END IF;
END$$;

DROP VIEW IF EXISTS public.leaderboard_regional;
DROP VIEW IF EXISTS public.leaderboard_rarity;
DROP VIEW IF EXISTS public.leaderboard_weekly;
DROP VIEW IF EXISTS public.leaderboard;

-- All-time leaderboard
CREATE VIEW public.leaderboard WITH (security_invoker = on) AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  p.country_code,
  p.spotter_emoji,
  count(DISTINCT s.train_id) AS unique_classes,
  count(s.id) AS total_spots,
  count(DISTINCT CASE WHEN t.rarity_tier IN ('epic', 'legendary') THEN t.id END) AS rare_count,
  max(s.spotted_at) AS last_active
FROM public.profiles p
LEFT JOIN public.spots s ON s.user_id = p.id
LEFT JOIN public.trains t ON t.id = s.train_id
WHERE p.username IS NOT NULL
GROUP BY p.id, p.username, p.avatar_url, p.level, p.country_code, p.spotter_emoji
ORDER BY unique_classes DESC, total_spots DESC;

-- Weekly leaderboard
CREATE VIEW public.leaderboard_weekly WITH (security_invoker = on) AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  p.country_code,
  p.spotter_emoji,
  count(s.id) AS weekly_spots,
  count(DISTINCT s.train_id) AS weekly_unique,
  count(DISTINCT CASE WHEN t.rarity_tier IN ('epic', 'legendary') THEN t.id END) AS rare_count
FROM public.profiles p
INNER JOIN public.spots s ON s.user_id = p.id
  AND s.spotted_at >= now() - INTERVAL '7 days'
LEFT JOIN public.trains t ON t.id = s.train_id
WHERE p.username IS NOT NULL
GROUP BY p.id, p.username, p.avatar_url, p.level, p.country_code, p.spotter_emoji
ORDER BY weekly_spots DESC, weekly_unique DESC;

-- Rarity leaderboard
CREATE VIEW public.leaderboard_rarity WITH (security_invoker = on) AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  p.country_code,
  p.spotter_emoji,
  count(DISTINCT CASE WHEN t.rarity_tier = 'legendary' THEN t.id END) AS legendary_count,
  count(DISTINCT CASE WHEN t.rarity_tier = 'epic' THEN t.id END) AS epic_count,
  count(DISTINCT CASE WHEN t.rarity_tier IN ('epic', 'legendary') THEN t.id END) AS rare_count,
  count(s.id) AS total_spots
FROM public.profiles p
INNER JOIN public.spots s ON s.user_id = p.id
INNER JOIN public.trains t ON t.id = s.train_id
  AND t.rarity_tier IN ('epic', 'legendary')
WHERE p.username IS NOT NULL
GROUP BY p.id, p.username, p.avatar_url, p.level, p.country_code, p.spotter_emoji
ORDER BY legendary_count DESC, epic_count DESC, total_spots DESC;

-- Regional leaderboard
CREATE VIEW public.leaderboard_regional WITH (security_invoker = on) AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  p.region,
  p.country_code,
  p.spotter_emoji,
  count(DISTINCT s.train_id) AS unique_classes,
  count(s.id) AS total_spots,
  count(DISTINCT CASE WHEN t.rarity_tier IN ('epic', 'legendary') THEN t.id END) AS rare_count,
  max(s.spotted_at) AS last_active
FROM public.profiles p
LEFT JOIN public.spots s ON s.user_id = p.id
LEFT JOIN public.trains t ON t.id = s.train_id
WHERE p.username IS NOT NULL
  AND p.region IS NOT NULL
GROUP BY p.id, p.username, p.avatar_url, p.level, p.region, p.country_code, p.spotter_emoji
ORDER BY unique_classes DESC, total_spots DESC;

COMMIT;
