-- ============================================================
-- Migration 007: Auto-generate usernames for leaderboard
--
-- Problem: Leaderboard views filter WHERE username IS NOT NULL,
-- but profiles are created with username = NULL and there is
-- no UI to set one. Result: dead leaderboard.
--
-- Fix: Generate "TrainFan_XXXX" usernames automatically on
-- signup and backfill all existing NULL usernames.
-- ============================================================

-- Function to generate a unique TrainFan_XXXX username
create or replace function public.generate_trainfan_username()
returns text as $$
declare
  candidate text;
  attempts int := 0;
begin
  loop
    candidate := 'TrainFan_' || lpad(floor(random() * 10000)::text, 4, '0');
    -- Check uniqueness
    if not exists (select 1 from public.profiles where username = candidate) then
      return candidate;
    end if;
    attempts := attempts + 1;
    if attempts > 100 then
      -- Fallback: use longer random suffix
      candidate := 'TrainFan_' || lpad(floor(random() * 1000000)::text, 6, '0');
      if not exists (select 1 from public.profiles where username = candidate) then
        return candidate;
      end if;
    end if;
    if attempts > 200 then
      raise exception 'Could not generate unique username after 200 attempts';
    end if;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

-- Update the trigger function to auto-assign a username on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, public.generate_trainfan_username());
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Backfill: assign usernames to all existing profiles that have NULL
do $$
declare
  profile_row record;
begin
  for profile_row in
    select id from public.profiles where username is null
  loop
    update public.profiles
    set username = public.generate_trainfan_username()
    where id = profile_row.id;
  end loop;
end;
$$;
