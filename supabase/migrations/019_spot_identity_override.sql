-- ============================================================
-- 019_spot_identity_override.sql
--
-- Manual card-edit / user correction layer (v1.0.38).
--
-- Lets a user correct the identified class/name on THEIR OWN spot when
-- the AI misidentifies a train, WITHOUT mutating the shared `trains` row
-- (which is deduped across all users by class+operator — a direct UPDATE
-- there would corrupt every other user's card of that class and skew the
-- leaderboard unique-class counts).
--
-- DESIGN: a per-spot JSONB override that shadows the joined train.* fields
-- at DISPLAY time only. The override is:
--   - display-only — it does NOT change leaderboard counts or rarity
--     (those still read the AI-identified `trains` row), so a correction
--     can never mint a "legendary" spot or move someone up the board.
--   - owner-scoped — spots already have an owner-only UPDATE policy
--     (migration 001: `using (auth.uid() = user_id)`), which covers this
--     new column. No new policy or grant is needed; `public.spots` already
--     carries its Data API grants from migration 001.
--
-- Shape of the JSON (all keys optional; null column = no override):
--   { "class": "Class 74", "name": "Stadler FLIRT", "operator": "Vy", "type": "EMU" }
--
-- The frontend renders identity_override.class ?? train.class, etc. Every
-- correction ALSO writes a public.wrong_id_reports row (existing telemetry,
-- migration 012) so corrections keep feeding our model tuning.
-- ============================================================

begin;

alter table public.spots
  add column if not exists identity_override jsonb default null;

comment on column public.spots.identity_override is
  'Per-spot, owner-only display override for AI misIDs (v1.0.38). Shadows the joined trains.* identity fields at render time. Display-only: never affects leaderboard counts or rarity. Keys: class, name, operator, type (all optional).';

commit;

-- ── Verification (run after applying) ────────────────────────
-- As the owner of a spot:
--   update public.spots set identity_override = '{"class":"Class 74","name":"Stadler FLIRT"}'::jsonb
--     where id = '<your-spot-id>';            -- expect: success (owner UPDATE policy)
--   select id, identity_override from public.spots where id = '<your-spot-id>';
-- As a NON-owner: the same update affects 0 rows (RLS), and the column is
-- only ever read via the owner-scoped fetchSpots path.
--
-- ── Rollback (if needed) ─────────────────────────────────────
--   alter table public.spots drop column if exists identity_override;
