-- ============================================================
-- Migration 023: Spotting Atlas heatmap — verified spots only
--
-- Phase 1 (migration 022) counted EVERY spot with a lat/lng,
-- including `personal`/`unverified` tiers. The problem: a GALLERY
-- scan of a photo with no EXIF GPS records the user's CURRENT
-- device location (their home/sofa), not where the train was —
-- so those spots dropped false hotspots at users' homes and
-- polluted the "where can I spot trains" map.
--
-- Fix: restrict the heatmap to the two TRUSTWORTHY verification
-- tiers — exactly the filter the leaderboard RPCs (013/014)
-- already use:
--   * verified-live           = camera + GPS lock (user was there)
--   * verified-recent-gallery = gallery photo w/ valid recent EXIF
-- This excludes `personal` (gallery-without-EXIF at the device
-- location, camera-without-GPS, pre-Card-v2 rows) and
-- `unverified`. The map gets cleaner; cell counts drop vs the
-- Phase 1 figures (which were measured pre-filter) — re-validate
-- top cells after applying.
--
-- Signature unchanged from 022, so existing grants persist; the
-- revoke/grant are repeated for clarity/idempotency.
-- ============================================================

create or replace function public.get_spot_heatmap(
  p_grid       numeric default 0.1,
  p_min_users  integer default 2
)
returns table (
  cell_lat         numeric,
  cell_lng         numeric,
  spot_count       bigint,
  rarity_score     bigint,
  top_rarity       text,
  distinct_classes bigint
)
language sql
security definer
set search_path = public
as $$
  with scored as (
    select
      round((s.latitude  / p_grid)::numeric, 0) * p_grid as cell_lat,
      round((s.longitude / p_grid)::numeric, 0) * p_grid as cell_lng,
      s.user_id,
      t.class as class_key,
      t.rarity_tier,
      case t.rarity_tier
        when 'legendary' then 5
        when 'epic'      then 4
        when 'rare'      then 3
        when 'uncommon'  then 2
        else 1
      end as rarity_weight
    from public.spots s
    join public.trains t on t.id = s.train_id
    where s.latitude is not null
      and s.longitude is not null
      -- Only count spots whose location is trustworthy (see header).
      and s.verification_tier in ('verified-live', 'verified-recent-gallery')
  )
  select
    cell_lat,
    cell_lng,
    count(*)::bigint                                       as spot_count,
    sum(rarity_weight)::bigint                             as rarity_score,
    (array_agg(rarity_tier order by rarity_weight desc))[1] as top_rarity,
    count(distinct class_key)::bigint                      as distinct_classes
  from scored
  group by cell_lat, cell_lng
  having count(distinct user_id) >= greatest(p_min_users, 1)
  order by spot_count desc;
$$;

revoke all on function public.get_spot_heatmap(numeric, integer) from public;
grant execute on function public.get_spot_heatmap(numeric, integer) to authenticated;
