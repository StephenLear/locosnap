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
  class_key           text not null,
  week_start_utc      timestamptz not null,
  base_xp             int  not null,
  diminished_xp       int  not null,
  themed_multiplier   numeric(3,2) not null default 1.00,
  boost_card_applied  text,
  final_xp            int  not null,
  verification_tier   text not null check (verification_tier in ('verified-live', 'verified-recent-gallery')),
  created_at          timestamptz not null default now()
);

create index if not exists idx_weekly_xp_events_user_week
  on public.weekly_xp_events(user_id, week_start_utc);

-- Diminishing-returns lookup: "did this user already earn XP for this
-- class this week?" Used by leagues.ts computeWeeklyXp.
create index if not exists idx_weekly_xp_events_dim_returns
  on public.weekly_xp_events(user_id, week_start_utc, class_key);


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


-- ─── 9. Manual UNVERIFIED → PERSONAL promotion RPC + telemetry ─
-- "I took this photo myself" honor-system override. Owner-only.
-- Bumps profiles.manual_overrides_count for abuse telemetry — Sentry
-- breadcrumb wired post-launch when count > 50 for any single user.
-- Idempotent: PERSONAL spots stay PERSONAL (no double-bump); only
-- UNVERIFIED → PERSONAL fires the counter.

alter table public.profiles
  add column if not exists manual_overrides_count int not null default 0;

create or replace function public.promote_unverified_to_personal(p_spot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_tier  text;
begin
  select user_id, verification_tier
    into v_owner, v_tier
    from public.spots
   where id = p_spot_id;

  if v_owner is null then
    raise exception 'spot not found' using errcode = 'P0002';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'not your spot' using errcode = '42501';
  end if;

  if v_tier <> 'unverified' then
    -- No-op: already PERSONAL or VERIFIED. Idempotent return.
    return;
  end if;

  update public.spots
     set verification_tier = 'personal'
   where id = p_spot_id;

  update public.profiles
     set manual_overrides_count = manual_overrides_count + 1
   where id = auth.uid();
end;
$$;

revoke all on function public.promote_unverified_to_personal(uuid) from public;
grant execute on function public.promote_unverified_to_personal(uuid) to authenticated;


-- ─── 10. Weekly XP increment RPC (atomic) ─────────────────────
-- Avoids the read-modify-write race when two scans for the same user
-- land in the same instant. Authenticated callers only — service
-- role bypasses this entirely; the cron resets weekly_xp via direct
-- update.

create or replace function public.increment_weekly_xp(
  p_user_id    uuid,
  p_week_start timestamptz,
  p_xp_delta   int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id <> auth.uid() then
    raise exception 'not your row' using errcode = '42501';
  end if;

  update public.league_membership
     set weekly_xp = weekly_xp + p_xp_delta,
         updated_at = now()
   where user_id = p_user_id
     and week_start_utc = p_week_start;
end;
$$;

revoke all on function public.increment_weekly_xp(uuid, timestamptz, int) from public;
grant execute on function public.increment_weekly_xp(uuid, timestamptz, int) to authenticated;


-- ─── 11. Award weekly XP for a spot (C.8 server-side wiring) ──
-- Single round-trip from the frontend after saveSpot succeeds.
-- Reads the spot row directly so the client cannot fake XP values.
-- Mirrors backend/src/services/leagues.ts logic in PL/pgSQL.
--
-- Returns:
--   final_xp        — XP credited (0 for non-VERIFIED, dim, or already-awarded)
--   diminished_xp   — XP after the per-class diminishing-returns mod
--   themed_multiplier — 1.00 normally, 2.00 on Tuesdays for rare+
--   week_start_utc  — ISO Monday of the credited week
--
-- Rules (must stay in sync with leagues.ts):
--   - Only verified-live and verified-recent-gallery scans earn XP.
--   - Per-class diminishing returns: second+ scan of same class in
--     the same week earns 25% of base.
--   - Tuesday rare-tier bonus: rare/epic/legendary scans on UTC
--     weekday=2 earn 2x (compounds with diminishing returns).
--   - Idempotent: if a weekly_xp_events row already exists for this
--     spot, returns it without double-bumping league_membership.

create or replace function public.award_weekly_xp_for_spot(p_spot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner            uuid;
  v_class_key        text;
  v_rarity_tier      text;
  v_verification_tier text;
  v_scan_date        timestamptz;
  v_week_start       timestamptz;
  v_base_xp          int;
  v_has_prior        boolean;
  v_themed_mult      numeric(3,2) := 1.00;
  v_diminished_xp    int;
  v_final_xp         int;
  v_existing_event   record;
begin
  -- Read spot row.
  select user_id, class, rarity_tier, verification_tier, created_at
    into v_owner, v_class_key, v_rarity_tier, v_verification_tier, v_scan_date
    from public.spots
   where id = p_spot_id;

  if v_owner is null then
    raise exception 'spot not found' using errcode = 'P0002';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'not your spot' using errcode = '42501';
  end if;

  -- Idempotency: if a weekly_xp_events row already exists for this
  -- spot, return that instead of double-bumping.
  select base_xp, diminished_xp, themed_multiplier, final_xp, week_start_utc
    into v_existing_event
    from public.weekly_xp_events
   where spot_id = p_spot_id;

  if v_existing_event.base_xp is not null then
    return jsonb_build_object(
      'final_xp',         v_existing_event.final_xp,
      'diminished_xp',    v_existing_event.diminished_xp,
      'themed_multiplier', v_existing_event.themed_multiplier,
      'week_start_utc',   v_existing_event.week_start_utc,
      'already_awarded',  true
    );
  end if;

  -- Verification gate: only VERIFIED scans earn XP. PERSONAL and
  -- UNVERIFIED return zeroed output without writing an event row.
  if v_verification_tier not in ('verified-live', 'verified-recent-gallery') then
    return jsonb_build_object(
      'final_xp',         0,
      'diminished_xp',    0,
      'themed_multiplier', 1.00,
      'week_start_utc',   date_trunc('week', v_scan_date at time zone 'UTC'),
      'reason',           'not_verified'
    );
  end if;

  -- Base XP from rarity (mirrors BASE_XP_BY_RARITY in leagues.ts).
  v_base_xp := case v_rarity_tier
    when 'common'    then 10
    when 'uncommon'  then 25
    when 'rare'      then 50
    when 'epic'      then 100
    when 'legendary' then 250
    else 0
  end;

  if v_base_xp = 0 then
    return jsonb_build_object(
      'final_xp',         0,
      'diminished_xp',    0,
      'themed_multiplier', 1.00,
      'week_start_utc',   date_trunc('week', v_scan_date at time zone 'UTC'),
      'reason',           'unknown_rarity'
    );
  end if;

  v_week_start := date_trunc('week', v_scan_date at time zone 'UTC');

  -- Per-class diminishing-returns lookup.
  select exists (
    select 1
      from public.weekly_xp_events
     where user_id = v_owner
       and class_key = v_class_key
       and week_start_utc = v_week_start
  ) into v_has_prior;

  v_diminished_xp := case
    when v_has_prior then floor(v_base_xp * 0.25)::int
    else v_base_xp
  end;

  -- Tuesday rare-tier themed bonus (UTC weekday 2 = Tuesday).
  if extract(dow from v_scan_date at time zone 'UTC') = 2
     and v_rarity_tier in ('rare', 'epic', 'legendary') then
    v_themed_mult := 2.00;
  end if;

  v_final_xp := floor(v_diminished_xp * v_themed_mult)::int;

  -- Audit row + atomic XP increment.
  insert into public.weekly_xp_events (
    user_id, spot_id, class_key, week_start_utc,
    base_xp, diminished_xp, themed_multiplier,
    boost_card_applied, final_xp, verification_tier
  ) values (
    v_owner, p_spot_id, v_class_key, v_week_start,
    v_base_xp, v_diminished_xp, v_themed_mult,
    null, v_final_xp, v_verification_tier
  );

  update public.league_membership
     set weekly_xp = weekly_xp + v_final_xp,
         weekly_unique_classes = case
           when v_has_prior then weekly_unique_classes
           else weekly_unique_classes + 1
         end,
         updated_at = now()
   where user_id = v_owner
     and week_start_utc = v_week_start;

  return jsonb_build_object(
    'final_xp',         v_final_xp,
    'diminished_xp',    v_diminished_xp,
    'themed_multiplier', v_themed_mult,
    'week_start_utc',   v_week_start,
    'already_awarded',  false
  );
end;
$$;

revoke all on function public.award_weekly_xp_for_spot(uuid) from public;
grant execute on function public.award_weekly_xp_for_spot(uuid) to authenticated;


-- ─── 12. Apply boost card (C.6) ──────────────────────────────
-- flat_100: instantly adds 100 XP to the user's current-week
-- league_membership.weekly_xp + marks the inventory row used.
-- Owner-validated, idempotent (already-used cards no-op silently),
-- atomic (single transaction).
--
-- next_scan_2x is deferred — it requires queued-state machinery
-- (pending_boost_card_id on profiles, consumed by the next
-- award_weekly_xp_for_spot call). Will land in v1.0.26 follow-up
-- once flat_100 is proven in production.

create or replace function public.apply_boost_card(p_card_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner       uuid;
  v_card_type   text;
  v_used_at     timestamptz;
  v_week_start  timestamptz;
begin
  select user_id, card_type, used_at
    into v_owner, v_card_type, v_used_at
    from public.user_boost_inventory
   where id = p_card_id;

  if v_owner is null then
    raise exception 'card not found' using errcode = 'P0002';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'not your card' using errcode = '42501';
  end if;

  if v_used_at is not null then
    -- Idempotent no-op for already-used cards.
    return jsonb_build_object(
      'applied',    false,
      'reason',     'already_used',
      'card_type',  v_card_type
    );
  end if;

  if v_card_type = 'flat_100' then
    v_week_start := date_trunc('week', now() at time zone 'UTC');

    update public.user_boost_inventory
       set used_at = now()
     where id = p_card_id;

    update public.league_membership
       set weekly_xp = weekly_xp + 100,
           updated_at = now()
     where user_id = v_owner
       and week_start_utc = v_week_start;

    return jsonb_build_object(
      'applied',   true,
      'card_type', v_card_type,
      'xp_added',  100
    );
  end if;

  if v_card_type = 'next_scan_2x' then
    -- Deferred to v1.0.26 — requires queued-state machinery on
    -- profiles. Return without consuming the card so users don't
    -- lose inventory while the feature is dark.
    return jsonb_build_object(
      'applied',  false,
      'reason',   'next_scan_2x_not_yet_implemented',
      'card_type', v_card_type
    );
  end if;

  raise exception 'unknown card_type %', v_card_type using errcode = '22023';
end;
$$;

revoke all on function public.apply_boost_card(bigint) from public;
grant execute on function public.apply_boost_card(bigint) to authenticated;
