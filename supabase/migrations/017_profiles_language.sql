-- ============================================================
-- LocoSnap — Migration 017: profiles.language column
--
-- The proper fix for the v1.0.35 Phase G rescue-push cron that
-- shipped with a SELECT against a non-existent profiles.language
-- column. Today's hotfix (commit a71fdd5) mapped country_code to
-- language at runtime as a stopgap; this migration retires that
-- hack by giving profiles a real, explicit language column synced
-- from the frontend settingsStore.
--
-- Why a column over the country_code mapping:
--   - Truthful — the cron + future server-side messaging (emails,
--     notifications) read what the user actually chose, not a
--     country-code guess that's wrong for travellers / migrants /
--     anyone who picked a non-default language at the picker
--   - Centralises language state — backend can read it once
--     instead of every consumer re-doing the country→language map
--   - Forward-compatible — adding a new language (e.g. cs, fi) is
--     a CHECK-constraint update + an i18n key dump, not a code
--     change in every consumer
--
-- Safety: backfilled BEFORE NOT NULL is set so no row is left null.
-- Backfill uses country_code as the heuristic (same mapping the
-- hotfix used), defaulting to 'en' when country_code is null /
-- unrecognised. Frontend overwrites this with the user's actual
-- AsyncStorage choice on next app open (settingsStore.setLanguage
-- now also writes to profiles).
--
-- Audit against feedback_supabase_silent_persistence_failures.md:
--   - NOT NULL added AFTER backfill — no row will fail the constraint
--   - DEFAULT 'en' covers any future INSERT path that omits language
--     (e.g. Supabase Auth trigger that creates profile rows)
--   - CHECK constraint blocks bad client writes (typos like 'EN' or
--     unsupported languages) at the database layer
-- ============================================================

-- 1. Add the column nullable so the backfill can run
alter table public.profiles
  add column if not exists language text;

-- 2. Backfill every row from country_code. Idempotent: skip rows
--    already populated (in case this migration is re-run after a
--    partial apply or after some rows were written via the new
--    settingsStore sync path between deploy and migration).
update public.profiles
set language = case
  when language is not null then language
  when upper(country_code) in ('DE', 'AT', 'CH') then 'de'
  when upper(country_code) = 'PL' then 'pl'
  else 'en'
end
where language is null;

-- 3. Lock down the column: default for future inserts, NOT NULL
--    so the cron query never sees null, and CHECK constraint so
--    a frontend bug can't poison the column with a typo.
alter table public.profiles
  alter column language set default 'en';

alter table public.profiles
  alter column language set not null;

alter table public.profiles
  add constraint profiles_language_valid
  check (language in ('en', 'de', 'pl'));

comment on column public.profiles.language is
  'User-selected app language code (en/de/pl). Synced from frontend settingsStore on every language change AND on profile fetch when the stored value diverges from the AsyncStorage value. Default ''en''. Backfilled 2026-05-26 from country_code heuristic for pre-migration rows (DE/AT/CH → de, PL → pl, else en).';
