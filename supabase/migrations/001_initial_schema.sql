-- ============================================================
-- LocoSnap — Initial Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ── Profiles (extends Supabase Auth users) ──────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  level int not null default 1,
  xp int not null default 0,
  streak_current int not null default 0,
  streak_best int not null default 0,
  last_spot_date date,
  daily_scans_used int not null default 0,
  daily_scans_reset_at timestamptz not null default now(),
  is_pro boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Trains (reference table — populated from AI) ────────────
create table public.trains (
  id uuid primary key default uuid_generate_v4(),
  class text not null,
  name text,
  operator text not null,
  type text not null,
  designation text not null default '',
  rarity_tier text not null default 'common'
    check (rarity_tier in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  max_speed text,
  power text,
  weight text,
  length text,
  gauge text,
  builder text,
  number_built int,
  number_surviving int,
  status text,
  fuel_type text,
  summary text,
  historical_significance text,
  fun_facts jsonb default '[]'::jsonb,
  notable_events jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Index for deduplication lookups
create index idx_trains_class_operator on public.trains (class, operator);

-- ── Spots (user's collection) ───────────────────────────────
create table public.spots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  train_id uuid not null references public.trains(id) on delete cascade,
  photo_url text,
  blueprint_url text,
  blueprint_status text not null default 'queued'
    check (blueprint_status in ('queued', 'processing', 'completed', 'failed')),
  confidence float not null default 0,
  latitude float,
  longitude float,
  spotted_at timestamptz not null default now(),
  is_first_spot boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_spots_user_id on public.spots (user_id);
create index idx_spots_spotted_at on public.spots (spotted_at desc);

-- ── Achievements ────────────────────────────────────────────
create table public.achievements (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_type text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_type)
);

create index idx_achievements_user_id on public.achievements (user_id);

-- ── Row Level Security ──────────────────────────────────────

-- Profiles: users can read all, update own
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trains: readable by everyone (reference data)
alter table public.trains enable row level security;

create policy "Trains are viewable by everyone"
  on public.trains for select
  using (true);

create policy "Service role can insert trains"
  on public.trains for insert
  with check (true);

-- Spots: users can CRUD own spots, read others (for leaderboards)
alter table public.spots enable row level security;

create policy "Users can view all spots"
  on public.spots for select
  using (true);

create policy "Users can insert own spots"
  on public.spots for insert
  with check (auth.uid() = user_id);

create policy "Users can update own spots"
  on public.spots for update
  using (auth.uid() = user_id);

create policy "Users can delete own spots"
  on public.spots for delete
  using (auth.uid() = user_id);

-- Achievements: users can read all, system inserts
alter table public.achievements enable row level security;

create policy "Achievements are viewable by everyone"
  on public.achievements for select
  using (true);

create policy "Users can earn achievements"
  on public.achievements for insert
  with check (auth.uid() = user_id);

-- ── Storage Buckets ─────────────────────────────────────────

-- Spot photos (user uploads)
insert into storage.buckets (id, name, public) values ('spot-photos', 'spot-photos', true);

create policy "Anyone can view spot photos"
  on storage.objects for select
  using (bucket_id = 'spot-photos');

create policy "Authenticated users can upload spot photos"
  on storage.objects for insert
  with check (bucket_id = 'spot-photos' and auth.role() = 'authenticated');

-- Blueprints (generated images)
insert into storage.buckets (id, name, public) values ('blueprints', 'blueprints', true);

create policy "Anyone can view blueprints"
  on storage.objects for select
  using (bucket_id = 'blueprints');

create policy "Service role can upload blueprints"
  on storage.objects for insert
  with check (bucket_id = 'blueprints');

-- ── Useful Views ────────────────────────────────────────────

-- Leaderboard: top spotters by unique classes
create or replace view public.leaderboard as
select
  p.id as user_id,
  p.username,
  p.avatar_url,
  p.level,
  count(distinct s.train_id) as unique_classes,
  count(s.id) as total_spots,
  count(distinct case when t.rarity_tier in ('epic', 'legendary') then t.id end) as rare_count,
  max(s.spotted_at) as last_active
from public.profiles p
left join public.spots s on s.user_id = p.id
left join public.trains t on t.id = s.train_id
where p.username is not null
group by p.id, p.username, p.avatar_url, p.level
order by unique_classes desc, total_spots desc;
