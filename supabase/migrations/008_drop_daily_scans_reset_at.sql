-- ============================================================
-- Migration 008: Drop dead column daily_scans_reset_at
--
-- Context: On 2026-04-14 the backend scan-gate was flipped
-- from MAX_FREE_MONTHLY_SCANS=10 (monthly reset) to a lifetime
-- MAX_FREE_SCANS=3. The isNewMonth check and the
-- daily_scans_reset_at column were dropped from the backend's
-- profile SELECT (commit 8c4cb7c). The column has been unused
-- since then; daily_scans_used is now a lifetime counter
-- despite the legacy name.
--
-- This migration removes the dead column from the schema.
-- The frontend Profile type is updated in the same session.
-- ============================================================

alter table public.profiles
  drop column if exists daily_scans_reset_at;
