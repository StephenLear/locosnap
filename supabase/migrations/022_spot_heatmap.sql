-- ============================================================
-- Migration 022: Spot heatmap aggregate (Train Radar — Phase 1)
--
-- Adds a SECURITY DEFINER function that returns a PRIVACY-SAFE
-- aggregate "heatmap" of spotting activity for the Train Radar
-- feature: where trains (of any rarity) have been spotted, as
-- coarse grid cells with counts and a rarity weight — NEVER raw
-- coordinates and NEVER user ids.
--
-- Why SECURITY DEFINER: migration 018 locked raw spot
-- latitude/longitude to the owning user via RLS (GDPR/location
-- privacy). Like the leaderboard functions (013/014), this needs
-- definer rights to aggregate across all users, but it exposes
-- ONLY cell-level aggregates, so no individual location is ever
-- revealed.
--
-- Privacy guarantees baked in:
--   * Coordinates are rounded to a coarse grid (p_grid degrees) —
--     output is the CELL CENTRE, never a real spot coordinate.
--   * k-anonymity: a cell is only returned when >= p_min_users
--     DISTINCT users have spotted there (default 2). A lone
--     spotter's local patch is suppressed.
--   * No user_id, no spot id, no raw lat/lng leave the function.
--
-- "Unusual spots" layer: rarity_score sums a per-spot rarity
-- weight (legendary 5 ... common 1) so the client can colour
-- cells with rare sightings hotter; top_rarity is the rarest
-- tier seen in the cell.
--
-- Defaults (validated 2026-06-21 against prod data): 0.1 deg grid
-- + k>=2 yields ~80 cells (715 spots); 0.25 deg yields ~103.
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
