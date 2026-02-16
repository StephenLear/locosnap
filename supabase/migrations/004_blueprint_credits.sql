-- ============================================================
-- LocoSnap — Blueprint Credits (Consumable IAP)
-- Adds credit balance to profiles and a transaction log.
-- Free/guest users can buy individual blueprints (~50p each).
-- Pro users get unlimited blueprints via subscription.
-- ============================================================

-- Add credit balance to profiles
alter table public.profiles
  add column blueprint_credits int not null default 0;

-- Transaction log for credit purchases and usage
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,          -- positive = purchase, negative = usage
  reason text not null,         -- 'purchase', 'blueprint_generation', 'refund'
  product_id text,              -- RevenueCat product ID (for purchases)
  blueprint_task_id text,       -- blueprint task ID (for usage)
  created_at timestamptz not null default now()
);

create index idx_credit_tx_user on credit_transactions(user_id);
create index idx_credit_tx_created on credit_transactions(created_at desc);

-- RLS: service role inserts, users read their own
alter table public.credit_transactions enable row level security;

create policy "Users can view own credit transactions"
  on credit_transactions for select
  using (auth.uid() = user_id);
