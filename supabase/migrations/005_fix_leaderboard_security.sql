-- ============================================================
-- LocoSnap — Fix leaderboard view security
-- Recreates all 4 leaderboard views with SECURITY INVOKER so
-- they respect RLS policies of the querying user rather than
-- running as the view owner (superuser).
-- ============================================================

-- Drop and recreate all 4 views (CREATE OR REPLACE cannot change column ordering)
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
  count(DISTINCT s.train_id) AS unique_classes,
  count(s.id) AS total_spots,
  count(DISTINCT CASE WHEN t.rarity_tier IN ('epic', 'legendary') THEN t.id END) AS rare_count,
  max(s.spotted_at) AS last_active
FROM public.profiles p
LEFT JOIN public.spots s ON s.user_id = p.id
LEFT JOIN public.trains t ON t.id = s.train_id
WHERE p.username IS NOT NULL
GROUP BY p.id, p.username, p.avatar_url, p.level
ORDER BY unique_classes DESC, total_spots DESC;

-- Weekly leaderboard
CREATE VIEW public.leaderboard_weekly WITH (security_invoker = on) AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  count(s.id) AS weekly_spots,
  count(DISTINCT s.train_id) AS weekly_unique,
  count(DISTINCT CASE WHEN t.rarity_tier IN ('epic', 'legendary') THEN t.id END) AS rare_count
FROM public.profiles p
INNER JOIN public.spots s ON s.user_id = p.id
  AND s.spotted_at >= now() - INTERVAL '7 days'
LEFT JOIN public.trains t ON t.id = s.train_id
WHERE p.username IS NOT NULL
GROUP BY p.id, p.username, p.avatar_url, p.level
ORDER BY weekly_spots DESC, weekly_unique DESC;

-- Rarity leaderboard
CREATE VIEW public.leaderboard_rarity WITH (security_invoker = on) AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  count(DISTINCT CASE WHEN t.rarity_tier = 'legendary' THEN t.id END) AS legendary_count,
  count(DISTINCT CASE WHEN t.rarity_tier = 'epic' THEN t.id END) AS epic_count,
  count(DISTINCT CASE WHEN t.rarity_tier IN ('epic', 'legendary') THEN t.id END) AS rare_count,
  count(s.id) AS total_spots
FROM public.profiles p
INNER JOIN public.spots s ON s.user_id = p.id
INNER JOIN public.trains t ON t.id = s.train_id
  AND t.rarity_tier IN ('epic', 'legendary')
WHERE p.username IS NOT NULL
GROUP BY p.id, p.username, p.avatar_url, p.level
ORDER BY legendary_count DESC, epic_count DESC, total_spots DESC;

-- Regional leaderboard
CREATE VIEW public.leaderboard_regional WITH (security_invoker = on) AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  p.region,
  count(DISTINCT s.train_id) AS unique_classes,
  count(s.id) AS total_spots,
  count(DISTINCT CASE WHEN t.rarity_tier IN ('epic', 'legendary') THEN t.id END) AS rare_count,
  max(s.spotted_at) AS last_active
FROM public.profiles p
LEFT JOIN public.spots s ON s.user_id = p.id
LEFT JOIN public.trains t ON t.id = s.train_id
WHERE p.username IS NOT NULL
  AND p.region IS NOT NULL
GROUP BY p.id, p.username, p.avatar_url, p.level, p.region
ORDER BY unique_classes DESC, total_spots DESC;
