-- ============================================================
-- Migration 013: Leaderboard Phase 2-5 schema
--
-- Context: Phase 2-5 of the leaderboard redesign per design doc
-- docs/plans/2026-05-03-leaderboard-phase2-5-design.md and
-- implementation plan
-- docs/plans/2026-05-03-leaderboard-phase2-5-implementation.md
--
-- Adds: weekly league system, persisted verification tier,
-- featured-card field on profiles, streak-freeze inventory,
-- boost-card inventory, friends-graph stub (Phase 5 future
-- activation), and weekly cycle coordinator state.
--
-- NAMING NOTE: design doc Section 3 used VERIFIED/PERSONAL/
-- UNVERIFIED tier names. Codebase already uses
-- 'verified-live' / 'verified-recent-gallery' / 'unverified'
-- (see frontend/types/index.ts VerificationTier). This
-- migration uses the codebase names — design doc terminology
-- was a brainstorm draft that should be reconciled to match.
-- Mapping:
--   design "VERIFIED"   -> 'verified-live'
--   design "PERSONAL"   -> 'verified-recent-gallery'
--   design "UNVERIFIED" -> 'unverified'
--
-- Staged 2026-05-03. DO NOT RUN against production until the
-- frontend + backend code that writes verification_tier on
-- new scans + reads league_membership for tab rendering is
-- ready to ship in v1.0.25.
-- ============================================================


-- ─── 1. Verification tier persistence ─────────────────────────
-- Spots already has boolean `verified` column from migration 009.
-- Frontend already computes a 3-tier `VerificationTier` value
-- but doesn't persist it. Add the column + backfill from existing
-- `verified` + `capture_source` data.

-- Tier semantics (matches the design doc):
--   verified-live            : camera capture, GPS valid, recent — counts for League XP
--   verified-recent-gallery  : gallery upload with intact recent EXIF + GPS — counts for League XP
--   personal                 : legit gallery upload, no recency proof — visible everywhere, NO League XP
--   unverified               : stripped EXIF or implausible date — private to user, NO League XP
alter table public.spots
  add column if not exists verification_tier text
    check (verification_tier in ('verified-live', 'verified-recent-gallery', 'personal', 'unverified'));

-- Backfill historical spots based on the heuristic:
--   verified=true  AND capture_source='camera'  -> verified-live
--   verified=true  AND capture_source='gallery' -> verified-recent-gallery
--   verified=false AND capture_source='gallery' -> personal (grandfather: keep visibility)
--   verified=false AND capture_source='camera'  -> personal (camera scans without GPS lock)
--   capture_source NULL                         -> personal (very old rows pre-Card-v2)
update public.spots
set verification_tier = case
  when verified = true and capture_source = 'camera'  then 'verified-live'
  when verified = true and capture_source = 'gallery' then 'verified-recent-gallery'
  else 'personal'
end
where verification_tier is null;

-- After backfill, make column not-null and add indices for league XP cron + personal/unverified gate
alter table public.spots
  alter column verification_tier set not null;

create index if not exists idx_spots_verification_tier_created
  on public.spots(verification_tier, created_at)
  where verification_tier = 'verified-live';


-- ─── 2. Profiles — featured card + streak freezes ─────────────

alter table public.profiles
  add column if not exists featured_spot_id uuid references public.spots(id) on delete set null,
  add column if not exists streak_freezes_available int not null default 0;

-- Backfill featured_spot_id from each user's highest-rarity
-- verified-live or verified-recent-gallery spot (UNVERIFIED never
-- eligible to be featured — privacy-by-default for stripped-EXIF
-- imports). Deterministic tiebreaker: created_at asc so re-runs
-- are idempotent.
update public.profiles p
set featured_spot_id = (
  select s.id
  from public.spots s
  where s.user_id = p.id
    and s.verification_tier in ('verified-live', 'verified-recent-gallery')
  order by
    case s.rarity_tier
      when 'legendary' then 5
      when 'epic'      then 4
      when 'rare'      then 3
      when 'uncommon'  then 2
      when 'common'    then 1
      else 0
    end desc,
    s.created_at asc
  limit 1
)
where featured_spot_id is null;


-- ─── 3. League membership (Phase 2 core table) ────────────────
-- One row per profile. tier_index 1=Bronze through 8=Vectron.
-- weekly_xp resets every Sunday 23:59 UTC via the league cron.

create table if not exists public.league_membership (
  user_id                       uuid primary key references public.profiles(id) on delete cascade,
  tier_index                    int  not null default 1 check (tier_index between 1 and 8),
  league_shard_id               int  not null default 0,
  weekly_xp                     int  not null default 0,
  weekly_unique_classes         int  not null default 0,
  week_start_utc                timestamptz not null,
  week_end_utc                  timestamptz not null,
  consecutive_inactive_weeks    int  not null default 0,
  consecutive_active_weeks      int  not null default 0,
  last_promotion_at             timestamptz,
  last_demotion_at              timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index if not exists idx_league_membership_tier_shard_xp
  on public.league_membership(tier_index, league_shard_id, weekly_xp desc);

-- Backfill: every existing profile starts in tier_1 (Bronze) for
-- the current week. Idempotent — won't re-insert on re-run.
insert into public.league_membership (user_id, tier_index, week_start_utc, week_end_utc)
select
  p.id,
  1,
  date_trunc('week', now() at time zone 'UTC'),
  date_trunc('week', now() at time zone 'UTC') + interval '6 days 23 hours 59 minutes 59 seconds'
from public.profiles p
where p.id not in (select user_id from public.league_membership);


-- ─── 4. Weekly XP events — append-only audit trail ────────────
-- Every scan that contributes to weekly XP writes one row here.
-- Drives audit, replay, dispute resolution, and analytics.

create table if not exists public.weekly_xp_events (
  id                  bigserial primary key,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  spot_id             uuid not null references public.spots(id) on delete cascade,
  week_start_utc      timestamptz not null,
  base_xp             int  not null,
  diminished_xp       int  not null,
  themed_multiplier   numeric(3,2) not null default 1.00,
  boost_card_applied  text,
  final_xp            int  not null,
  verification_tier   text not null check (verification_tier in ('verified-live', 'verified-recent-gallery', 'unverified')),
  created_at          timestamptz not null default now()
);

create index if not exists idx_weekly_xp_events_user_week
  on public.weekly_xp_events(user_id, week_start_utc);


-- ─── 5. Boost card inventory ──────────────────────────────────

create table if not exists public.user_boost_inventory (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  card_type     text not null check (card_type in ('flat_100', 'next_scan_2x')),
  earned_at     timestamptz not null default now(),
  earned_reason text not null check (earned_reason in ('league_promotion', 'four_week_streak')),
  used_at       timestamptz,
  used_on_spot  uuid references public.spots(id) on delete set null
);

create index if not exists idx_user_boost_inventory_active
  on public.user_boost_inventory(user_id) where used_at is null;


-- ─── 6. Friends graph stub (Phase 5 future) ───────────────────
-- Sits unused in v1.0.25; activated by Phase 5 frontend code later
-- once active user count exceeds the deferred-feature threshold.

create table if not exists public.friendships (
  user_id       uuid references public.profiles(id) on delete cascade,
  friend_id     uuid references public.profiles(id) on delete cascade,
  status        text check (status in ('pending', 'accepted', 'blocked')) default 'pending',
  initiated_by  uuid references public.profiles(id) on delete cascade,
  created_at    timestamptz default now(),
  primary key (user_id, friend_id)
);

create index if not exists idx_friendships_user_accepted
  on public.friendships(user_id) where status = 'accepted';
create index if not exists idx_friendships_friend_accepted
  on public.friendships(friend_id) where status = 'accepted';


-- ─── 7. League cycle coordinator (singleton) ──────────────────
-- One row tracking the active week boundaries for the cron.

create table if not exists public.league_cycle_state (
  id                 int primary key default 1 check (id = 1),
  current_week_start timestamptz not null,
  current_week_end   timestamptz not null,
  last_reset_at      timestamptz,
  last_reset_status  text check (last_reset_status in ('pending', 'in_progress', 'completed', 'failed'))
);

insert into public.league_cycle_state (id, current_week_start, current_week_end)
values (
  1,
  date_trunc('week', now() at time zone 'UTC'),
  date_trunc('week', now() at time zone 'UTC') + interval '6 days 23 hours 59 minutes 59 seconds'
)
on conflict (id) do nothing;


-- ─── 8. Row Level Security ────────────────────────────────────

-- league_membership: users select their own row; leaderboard reads
-- go through a SECURITY DEFINER function (mirrors fetchLeaderboard
-- pattern in services/supabase.ts).
alter table public.league_membership enable row level security;

drop policy if exists league_membership_self_select on public.league_membership;
create policy league_membership_self_select on public.league_membership
  for select using (user_id = auth.uid());

drop policy if exists league_membership_self_update on public.league_membership;
create policy league_membership_self_update on public.league_membership
  for update using (user_id = auth.uid());

-- SECURITY DEFINER function for league rankings — avoids exposing
-- all league_membership rows via RLS while still letting clients
-- read the current league standings.
create or replace function public.get_my_league_rankings(
  target_tier int,
  target_shard int default 0
)
returns table (
  user_id           uuid,
  username          text,
  country_code      text,
  spotter_emoji     text,
  weekly_xp         int,
  featured_spot_id  uuid,
  is_pro            boolean
)
language sql security definer
set search_path = public
as $$
  select
    lm.user_id, p.username, p.country_code, p.spotter_emoji,
    lm.weekly_xp, p.featured_spot_id, p.is_pro
  from public.league_membership lm
  join public.profiles p on p.id = lm.user_id
  where lm.tier_index = target_tier
    and lm.league_shard_id = target_shard
  order by lm.weekly_xp desc, lm.updated_at asc
  limit 100;
$$;

-- weekly_xp_events: users see their own; only service-role writes
alter table public.weekly_xp_events enable row level security;

drop policy if exists weekly_xp_events_self_select on public.weekly_xp_events;
create policy weekly_xp_events_self_select on public.weekly_xp_events
  for select using (user_id = auth.uid());

-- user_boost_inventory: user owns their inventory
alter table public.user_boost_inventory enable row level security;

drop policy if exists boost_inventory_self_all on public.user_boost_inventory;
create policy boost_inventory_self_all on public.user_boost_inventory
  for all using (user_id = auth.uid());

-- friendships: standard friend-graph RLS (matches Phase 5 needs
-- even though unused in v1.0.25)
alter table public.friendships enable row level security;

drop policy if exists friendships_self_or_friend_select on public.friendships;
create policy friendships_self_or_friend_select on public.friendships
  for select using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists friendships_self_initiate on public.friendships;
create policy friendships_self_initiate on public.friendships
  for insert with check (initiated_by = auth.uid());

drop policy if exists friendships_self_or_friend_update on public.friendships;
create policy friendships_self_or_friend_update on public.friendships
  for update using (user_id = auth.uid() or friend_id = auth.uid());

-- league_cycle_state: read-only to authenticated; only service
-- role writes (the weekly cron).
alter table public.league_cycle_state enable row level security;

drop policy if exists league_cycle_state_read on public.league_cycle_state;
create policy league_cycle_state_read on public.league_cycle_state
  for select using (auth.role() = 'authenticated');
