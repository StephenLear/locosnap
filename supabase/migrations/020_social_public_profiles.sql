-- ============================================================
-- Migration 020: Social Phase 1 — opt-in public profiles
--
-- Lets a signed-in user view ANOTHER spotter's public collection
-- (classes / rarity / blueprints) — ONLY if that spotter has opted
-- in (profiles.is_public). Privacy posture P-A (locked 2026-06-03):
-- precise location is NEVER exposed to other users. The latent
-- spots-location exposure was already closed in migration 018
-- (spots SELECT is owner-only); these RPCs are SECURITY DEFINER and
-- return ONLY public-safe fields — explicitly NO latitude/longitude,
-- NO photo_url. Mirrors the SECURITY DEFINER + pinned search_path
-- pattern of get_weekly_rarity_champion (014) / migration 006.
--
-- Counts use TRUE totals (NOT the leaderboard_rarity view's
-- epic/legendary-only inner join, which would under-report a
-- profile's totals). rare/epic/legendary are distinct-class counts,
-- consistent with rarity being a class property (class-anchored
-- rarity, 2026-06-05).
--
-- profiles already carries Data API grants (migrations 001/010), so
-- the new is_public column needs no extra table grant. The two
-- functions are granted execute to anon + authenticated.
-- ============================================================

begin;

-- a. Opt-in flag — strictly off by default.
alter table public.profiles
  add column if not exists is_public boolean not null default false;

-- b. Public profile header + aggregate counts (one row, or none if not public).
create or replace function public.get_public_profile(target_user_id uuid)
returns table (
  user_id         uuid,
  username        text,
  country_code    text,
  spotter_emoji   text,
  level           int,
  total_spots     bigint,
  unique_classes  bigint,
  rare_count      bigint,
  epic_count      bigint,
  legendary_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.country_code,
    p.spotter_emoji,
    p.level,
    count(s.id)                                                                as total_spots,
    count(distinct s.train_id)                                                 as unique_classes,
    count(distinct case when t.rarity_tier = 'rare'      then s.train_id end)  as rare_count,
    count(distinct case when t.rarity_tier = 'epic'      then s.train_id end)  as epic_count,
    count(distinct case when t.rarity_tier = 'legendary' then s.train_id end)  as legendary_count
  from public.profiles p
  left join public.spots  s on s.user_id  = p.id
  left join public.trains t on t.id       = s.train_id
  where p.id = target_user_id
    and coalesce(p.is_public, false) = true
  group by p.id, p.username, p.country_code, p.spotter_emoji, p.level;
$$;

-- c. Public collection — card list, newest first. NO location, NO photo.
create or replace function public.get_public_collection(
  target_user_id uuid,
  p_limit        int default 50,
  p_offset       int default 0
)
returns table (
  spot_id      uuid,
  train_id     uuid,
  class        text,
  name         text,
  operator     text,
  type         text,
  designation  text,
  rarity_tier  text,
  blueprint_url text,
  spotted_at   timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.train_id,
    t.class,
    t.name,
    t.operator,
    t.type,
    t.designation,
    t.rarity_tier,
    s.blueprint_url,
    s.spotted_at
  from public.spots s
  join public.trains   t on t.id = s.train_id
  join public.profiles p on p.id = s.user_id
  where s.user_id = target_user_id
    and coalesce(p.is_public, false) = true
  order by s.spotted_at desc
  limit  greatest(0, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.get_public_profile(uuid)             to anon, authenticated;
grant execute on function public.get_public_collection(uuid, int, int) to anon, authenticated;

commit;

-- ── Verification (run after apply) ──────────────────────────
-- As any authenticated user (non-owner):
--   update public.profiles set is_public = true where id = '<a-user>';
--   select * from public.get_public_profile('<a-user>');        -- one row, counts populated
--   select * from public.get_public_collection('<a-user>');     -- rows, NO lat/lng/photo columns
--   update public.profiles set is_public = false where id = '<a-user>';
--   select * from public.get_public_profile('<a-user>');        -- ZERO rows
--   select * from public.get_public_collection('<a-user>');     -- ZERO rows
-- Confirm definer + pinned search_path:
--   \df+ public.get_public_collection   -- "Security: definer", "Config: search_path=public"

-- ── Rollback ────────────────────────────────────────────────
--   drop function if exists public.get_public_collection(uuid, int, int);
--   drop function if exists public.get_public_profile(uuid);
--   alter table public.profiles drop column if exists is_public;
