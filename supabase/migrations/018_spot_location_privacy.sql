-- ============================================================
-- 018_spot_location_privacy.sql
--
-- P-A privacy fix (decided 2026-06-03): stop exposing raw spot
-- coordinates (and per-user sighting rows) to other users.
--
-- BEFORE: the public.spots SELECT policy was `USING (true)` — every
-- spot row, including latitude/longitude and user_id, was readable by
-- ANY client holding the app's anon key (it was opened up "for
-- leaderboard counts"). That is a latent location-privacy / GDPR
-- data-minimisation exposure that exists independently of any feature.
--
-- AFTER: spots SELECT is owner-only. The four leaderboard aggregate
-- views were created with `security_invoker = on` in migration 011, so
-- they ran with the *client's* RLS and relied on the permissive policy
-- to count across users. They are switched to definer rights here. They
-- select ONLY aggregate counts + public identity (username / avatar /
-- level / country_code / spotter_emoji / region) — never latitude,
-- longitude, or raw spot rows — so leaderboards keep working with NO
-- client change and NO new exposure. League / weekly-champion data
-- already flows through SECURITY DEFINER functions (migrations 013/014),
-- which bypass RLS and are unaffected.
--
-- Audited 2026-06-03: every frontend read of public.spots is own-user
-- scoped (fetchHistory `.eq("user_id", …)`, count `.eq("user_id", …)`,
-- insert/update/delete by own id), so owner-only SELECT breaks no client
-- path. The backend uses the service_role key, which bypasses RLS.
-- ============================================================

begin;

-- 1. Restrict raw spot reads to the owner. RLS is already enabled on
--    public.spots; this only replaces the over-permissive SELECT policy.
drop policy if exists "Spots are viewable by everyone" on public.spots;

create policy "Users can read own spots"
  on public.spots for select
  using (auth.uid() = user_id);

-- 2. Keep cross-user leaderboard aggregates working now that the base
--    table no longer grants cross-user SELECT. These views expose only
--    counts + public identity (no coordinates), so definer rights are
--    safe and intentional.
alter view public.leaderboard          set (security_invoker = off);
alter view public.leaderboard_weekly   set (security_invoker = off);
alter view public.leaderboard_rarity   set (security_invoker = off);
alter view public.leaderboard_regional set (security_invoker = off);

commit;

-- ── Verification (run after applying) ────────────────────────
-- As an authenticated NON-owner session:
--   select count(*) from public.spots;            -- expect: only your own rows
--   select id, latitude, longitude from public.spots limit 1; -- only your own
-- Leaderboards still aggregate across users:
--   select username, unique_classes from public.leaderboard limit 5;  -- many users
--   select username, legendary_count from public.leaderboard_rarity limit 5;
-- In-app: Collection / Country / This Week tabs still populate; your own
-- History (Profile) still loads.
--
-- ── Rollback (if needed) ─────────────────────────────────────
--   drop policy if exists "Users can read own spots" on public.spots;
--   create policy "Spots are viewable by everyone" on public.spots
--     for select using (true);
--   alter view public.leaderboard          set (security_invoker = on);
--   alter view public.leaderboard_weekly   set (security_invoker = on);
--   alter view public.leaderboard_rarity   set (security_invoker = on);
--   alter view public.leaderboard_regional set (security_invoker = on);
