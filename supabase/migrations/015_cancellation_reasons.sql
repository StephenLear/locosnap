-- ============================================================
-- Migration 015: cancellation_reasons table
--
-- Logs RevenueCat CANCELLATION webhook events for save-rate
-- measurement on Apple Retention Messaging + Play Win-back.
--
-- We do NOT revoke access on CANCELLATION (EXPIRATION handles
-- that when the period ends). This table is purely an analytics
-- log for closed-loop measurement on the v1.0.29 retention layer.
--
-- Server-write only via service role; no client RLS policies.
-- ============================================================

create table if not exists public.cancellation_reasons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  rc_event_id text unique not null,
  product_id text not null,
  cancellation_reason text,
  store text not null check (store in ('app_store', 'play_store')),
  was_in_trial boolean not null default false,
  hours_since_purchase numeric,
  hours_since_trial_start numeric,
  retention_offer_shown boolean default false,
  retention_offer_redeemed boolean default false,
  raw_event jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_cancellation_reasons_user
  on public.cancellation_reasons(user_id);

create index if not exists idx_cancellation_reasons_created
  on public.cancellation_reasons(created_at desc);

alter table public.cancellation_reasons enable row level security;

-- No RLS policies: service role bypasses RLS, no client access.

comment on table public.cancellation_reasons is
  'RevenueCat CANCELLATION webhook events captured for save-rate measurement. Server-write only.';
