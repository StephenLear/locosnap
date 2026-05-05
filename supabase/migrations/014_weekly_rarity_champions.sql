-- ============================================================
-- Migration 014: Weekly rarity champions per country (Phase 2 idea)
--
-- Adds a SECURITY DEFINER function that returns the top user per
-- country_code based on the highest single rare/epic/legendary
-- verified scan recorded this week. Drives the "Weekly Rare-Find
-- Champion" card on the Country tab and (optionally) a banner on
-- My League.
--
-- Verification gate: only verified-live + verified-recent-gallery
-- count. PERSONAL spots have intact EXIF but are user-attested
-- only — they don't compete (matches the league XP gate).
-- UNVERIFIED is excluded server-side via the existing leagues
-- gate; this function applies the same filter explicitly for
-- defense in depth.
--
-- Rarity tier mapping for "best find" ordering:
--   legendary > epic > rare > uncommon > common
-- We return the highest-rarity scan per user per country, then
-- pick the top user per country, with a deterministic tiebreaker
-- (earliest scan_date asc — first to find that rarity wins).
-- ============================================================

create or replace function public.get_weekly_rarity_champion(
  p_country_code text
)
returns table (
  user_id           uuid,
  username          text,
  spotter_emoji     text,
  spot_id           uuid,
  class_key         text,
  rarity_tier       text,
  scan_date         timestamptz
)
language sql
security definer
set search_path = public
as $$
  with week_bounds as (
    select date_trunc('week', now() at time zone 'UTC') as week_start
  ),
  scored as (
    select
      s.user_id,
      p.username,
      p.spotter_emoji,
      s.id as spot_id,
      t.class as class_key,
      t.rarity_tier,
      s.created_at as scan_date,
      -- Numeric rank for ordering (higher = better find)
      case t.rarity_tier
        when 'legendary' then 5
        when 'epic'      then 4
        when 'rare'      then 3
        else 0
      end as rarity_rank
    from public.spots s
    join public.trains t   on t.id = s.train_id
    join public.profiles p on p.id = s.user_id
    cross join week_bounds wb
    where s.created_at >= wb.week_start
      and t.rarity_tier in ('rare', 'epic', 'legendary')
      and s.verification_tier in ('verified-live', 'verified-recent-gallery')
      and p.country_code = p_country_code
  ),
  -- Highest-rarity scan per user this week
  best_per_user as (
    select distinct on (user_id)
      user_id, username, spotter_emoji, spot_id, class_key, rarity_tier, scan_date, rarity_rank
    from scored
    order by user_id, rarity_rank desc, scan_date asc
  )
  -- Top user (best rarity, earliest scan as tiebreaker)
  select user_id, username, spotter_emoji, spot_id, class_key, rarity_tier, scan_date
  from best_per_user
  order by rarity_rank desc, scan_date asc
  limit 1;
$$;

revoke all on function public.get_weekly_rarity_champion(text) from public;
grant execute on function public.get_weekly_rarity_champion(text) to authenticated;
