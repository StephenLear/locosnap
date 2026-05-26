-- ============================================================
-- LocoSnap — Migration 016: engagement push tracking
--
-- Adds two columns to public.profiles:
--   - push_token              text  null  (Expo push token, captured
--                                          at notification-permission
--                                          grant on the frontend)
--   - engagement_push_sent_at timestamptz null  (last time the zero-
--                                          engagement rescue push was
--                                          sent by the backend cron)
--
-- Migration safety: ADD COLUMN on an existing table. Default GRANTs
-- on public.profiles were established when the table was created
-- pre-2026-10-30, so the
-- feedback_supabase_grant_after_2026_10_30.md rule does NOT apply
-- here (the rule covers CREATE TABLE only; ADD COLUMN inherits
-- table-level grants).
--
-- No RLS changes needed — profiles already has the right policies
-- and these are server-side / self-only fields.
--
-- Frontend impact: services/notifications.ts savePushToken already
-- writes to push_token (silent fail on column-missing pre-migration).
-- Post-migration the writes start landing. No frontend change
-- required for the persistence side.
-- ============================================================

alter table public.profiles
  add column if not exists push_token text,
  add column if not exists engagement_push_sent_at timestamptz;

comment on column public.profiles.push_token is
  'Expo push token captured at notification permission grant. Nullable — null for users who declined notifications, never granted, or pre-v1.0.36 clients.';

comment on column public.profiles.engagement_push_sent_at is
  'Last time the zero-engagement rescue push was sent by backend cron runZeroEngagementRescuePush. Nullable — null for users who never received the push. Cron skips users where this is within the last 7 days.';
