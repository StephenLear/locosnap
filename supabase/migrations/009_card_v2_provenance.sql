-- ============================================================
-- Migration 009: Card v2 provenance + Verified tier
--
-- Context: Phase 0.2 of the card v2 implementation plan
-- (docs/plans/2026-04-24-card-v2-implementation.md).
--
-- Adds the provenance fields needed to classify each spot
-- as Verified or Unverified. Existing spots all default to
-- Unverified (verified = false) — deliberate per product
-- decision #3 (no retroactive promotion).
--
-- Staged 2026-04-24. DO NOT RUN against production until
-- frontend + backend code that writes these fields is ready
-- to ship in v1.0.21. Schema-first-then-client is the rule;
-- running this early just means existing spots stay
-- Unverified (which they would anyway) — no harm, but
-- pointless friction until the client catches up.
-- ============================================================

alter table public.spots
  add column if not exists capture_source   text
    check (capture_source in ('camera', 'gallery'))
    default 'gallery',
  add column if not exists exif_timestamp   timestamptz,
  add column if not exists verified         boolean not null default false,
  add column if not exists photo_accuracy_m integer,
  add column if not exists risk_flags       jsonb not null default '{}'::jsonb;

-- Supports the "verified count" queries on profile + leaderboard.
create index if not exists idx_spots_user_verified
  on public.spots(user_id, verified);

-- Partial index supporting future per-class sighting-serial queries
-- in Phase 2 (P2.2). Only verified rows count toward the serial.
-- Uses train_id (not a class string) because `spots` joins to
-- `trains` for the class designation.
create index if not exists idx_spots_train_verified_created
  on public.spots(train_id, created_at)
  where verified = true;

-- ── Notes for Phase 2 (not in this migration) ──────────────
-- When Phase 2 ships country-scoped sighting serial, a
-- migration will likely add spots.country (ISO 3166-1 alpha-2)
-- populated from reverse-geocoding at scan time. The index
-- above will be superseded by one keyed on (train_id, country,
-- created_at) at that point.
