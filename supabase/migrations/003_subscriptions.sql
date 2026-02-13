-- ============================================================
-- LocoSnap — Subscription Events Table
-- Logs all RevenueCat webhook events for audit trail.
-- The backend webhook handler uses service role to insert.
-- ============================================================

create table public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  product_id text,
  rc_event_id text,
  raw_payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Indexes for querying
create index idx_sub_events_user on subscription_events(user_id);
create index idx_sub_events_created on subscription_events(created_at desc);

-- RLS: only service role can insert (webhook), users can read their own
alter table public.subscription_events enable row level security;

create policy "Users can view own subscription events"
  on subscription_events for select
  using (auth.uid() = user_id);
