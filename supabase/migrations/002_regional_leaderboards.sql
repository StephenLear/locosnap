-- ============================================================
-- LocoSnap — Regional Leaderboards Migration
-- Adds region to profiles and a regional leaderboard view
-- ============================================================

-- UK regions for initial launch
-- Users can optionally set their region to appear on regional boards

alter table public.profiles
  add column region text default null
  check (region is null or region in (
    'london',
    'south-east',
    'south-west',
    'east-anglia',
    'east-midlands',
    'west-midlands',
    'yorkshire',
    'north-west',
    'north-east',
    'scotland',
    'wales',
    'northern-ireland'
  ));

create index idx_profiles_region on public.profiles (region) where region is not null;

-- Regional leaderboard: top spotters by unique classes, filtered by region
create or replace view public.leaderboard_regional as
select
  p.id,
  p.username,
  p.avatar_url,
  p.level,
  p.region,
  count(distinct s.train_id) as unique_classes,
  count(s.id) as total_spots,
  count(distinct case when t.rarity_tier in ('epic', 'legendary') then t.id end) as rare_count,
  max(s.spotted_at) as last_active
from public.profiles p
left join public.spots s on s.user_id = p.id
left join public.trains t on t.id = s.train_id
where p.username is not null
  and p.region is not null
group by p.id, p.username, p.avatar_url, p.level, p.region
order by unique_classes desc, total_spots desc;
