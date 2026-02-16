-- ============================================================
-- LocoSnap — Supabase Database Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── 1. Profiles table ────────────────────────────────────────
-- Stores user profiles with XP, levels, streaks, and daily scan limits.
-- Linked to auth.users via id (foreign key).

CREATE TABLE IF NOT EXISTS public.profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      text,
  avatar_url    text,
  level         integer NOT NULL DEFAULT 1,
  xp            integer NOT NULL DEFAULT 0,
  streak_current integer NOT NULL DEFAULT 0,
  streak_best   integer NOT NULL DEFAULT 0,
  last_spot_date date,
  daily_scans_used integer NOT NULL DEFAULT 0,
  daily_scans_reset_at timestamptz NOT NULL DEFAULT now(),
  is_pro        boolean NOT NULL DEFAULT false,
  region        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if present, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 2. Trains table ──────────────────────────────────────────
-- Master table of all identified train classes.

CREATE TABLE IF NOT EXISTS public.trains (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class       text NOT NULL,
  name        text,
  operator    text NOT NULL,
  type        text NOT NULL DEFAULT 'unknown',
  designation text NOT NULL DEFAULT '',
  rarity_tier text NOT NULL DEFAULT 'common',
  specs       jsonb NOT NULL DEFAULT '{}',
  facts       jsonb NOT NULL DEFAULT '{"summary":"","funFacts":[],"notableEvents":[]}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookup by class + operator (used by upsertTrain)
CREATE INDEX IF NOT EXISTS idx_trains_class_operator ON public.trains(class, operator);

-- ── 3. Spots table ───────────────────────────────────────────
-- Each row = one train spotting event by a user.

CREATE TABLE IF NOT EXISTS public.spots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  train_id      uuid REFERENCES public.trains(id) ON DELETE SET NULL,
  photo_url     text,
  blueprint_url text,
  confidence    real NOT NULL DEFAULT 0,
  latitude      double precision,
  longitude     double precision,
  is_first_spot boolean NOT NULL DEFAULT false,
  spotted_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spots_user_id ON public.spots(user_id);
CREATE INDEX IF NOT EXISTS idx_spots_train_id ON public.spots(train_id);
CREATE INDEX IF NOT EXISTS idx_spots_created_at ON public.spots(created_at DESC);

-- ── 4. Achievements table ────────────────────────────────────
-- Tracks which achievements each user has unlocked.

CREATE TABLE IF NOT EXISTS public.achievements (
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_type text NOT NULL,
  unlocked_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_type)
);

CREATE INDEX IF NOT EXISTS idx_achievements_user_id ON public.achievements(user_id);

-- ── 5. Leaderboard views ────────────────────────────────────
-- These are database views so the frontend can query them like tables.

-- Global leaderboard: ranked by unique train classes spotted
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  COUNT(s.id)                             AS total_spots,
  COUNT(DISTINCT s.train_id)              AS unique_classes,
  COUNT(s.id) FILTER (WHERE t.rarity_tier IN ('rare', 'epic', 'legendary')) AS rare_count,
  MAX(s.created_at)                       AS last_active
FROM public.profiles p
LEFT JOIN public.spots s ON s.user_id = p.id
LEFT JOIN public.trains t ON t.id = s.train_id
GROUP BY p.id
ORDER BY unique_classes DESC, total_spots DESC;

-- Weekly leaderboard: most spots in the last 7 days
CREATE OR REPLACE VIEW public.leaderboard_weekly AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  COUNT(s.id)                AS weekly_spots,
  COUNT(DISTINCT s.train_id) AS weekly_unique,
  COUNT(s.id) FILTER (WHERE t.rarity_tier IN ('rare', 'epic', 'legendary')) AS rare_count
FROM public.profiles p
LEFT JOIN public.spots s ON s.user_id = p.id AND s.created_at >= now() - interval '7 days'
LEFT JOIN public.trains t ON t.id = s.train_id
GROUP BY p.id
ORDER BY weekly_spots DESC, weekly_unique DESC;

-- Rarity leaderboard: most epic + legendary spots
CREATE OR REPLACE VIEW public.leaderboard_rarity AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  COUNT(s.id)                            AS total_spots,
  COUNT(s.id) FILTER (WHERE t.rarity_tier IN ('rare', 'epic', 'legendary')) AS rare_count,
  COUNT(s.id) FILTER (WHERE t.rarity_tier = 'legendary')                    AS legendary_count,
  COUNT(s.id) FILTER (WHERE t.rarity_tier = 'epic')                         AS epic_count
FROM public.profiles p
LEFT JOIN public.spots s ON s.user_id = p.id
LEFT JOIN public.trains t ON t.id = s.train_id
GROUP BY p.id
ORDER BY legendary_count DESC, epic_count DESC, rare_count DESC;

-- Regional leaderboard: by region, ranked by unique classes
CREATE OR REPLACE VIEW public.leaderboard_regional AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  p.region,
  COUNT(s.id)                AS total_spots,
  COUNT(DISTINCT s.train_id) AS unique_classes,
  COUNT(s.id) FILTER (WHERE t.rarity_tier IN ('rare', 'epic', 'legendary')) AS rare_count,
  MAX(s.created_at)          AS last_active
FROM public.profiles p
LEFT JOIN public.spots s ON s.user_id = p.id
LEFT JOIN public.trains t ON t.id = s.train_id
WHERE p.region IS NOT NULL
GROUP BY p.id
ORDER BY unique_classes DESC, total_spots DESC;

-- ── 6. Row Level Security (RLS) ─────────────────────────────
-- Enable RLS on all tables so users can only access their own data.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all (for leaderboard), but only update their own
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Trains: everyone can read, authenticated users can insert
CREATE POLICY "Trains are viewable by everyone"
  ON public.trains FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert trains"
  ON public.trains FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Spots: users can read all (for leaderboard counts), but only modify their own
CREATE POLICY "Spots are viewable by everyone"
  ON public.spots FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own spots"
  ON public.spots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own spots"
  ON public.spots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own spots"
  ON public.spots FOR DELETE
  USING (auth.uid() = user_id);

-- Achievements: users can read all (for profile views), insert/update their own
CREATE POLICY "Achievements are viewable by everyone"
  ON public.achievements FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own achievements"
  ON public.achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements"
  ON public.achievements FOR UPDATE
  USING (auth.uid() = user_id);

-- ── 7. Storage buckets ──────────────────────────────────────
-- Create buckets for spot photos and blueprints.

INSERT INTO storage.buckets (id, name, public)
VALUES ('spot-photos', 'spot-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('blueprints', 'blueprints', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload to their own folder
CREATE POLICY "Users can upload own photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'spot-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload own blueprints"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'blueprints'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read access for both buckets (photos/blueprints are shown in cards)
CREATE POLICY "Public read access for spot photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'spot-photos');

CREATE POLICY "Public read access for blueprints"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blueprints');

-- Users can overwrite their own photos (upsert)
CREATE POLICY "Users can update own photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'spot-photos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own blueprints"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'blueprints'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Done! ───────────────────────────────────────────────────
-- All tables, views, RLS policies, and storage buckets are set up.
-- The trigger will auto-create a profile when a user signs up via magic link.
