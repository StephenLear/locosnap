-- ============================================================
-- 021_canonicalise_operators.sql
--
-- Retro-fix for operator-string fragmentation in public.trains.
--
-- BACKGROUND: public.trains is deduped by (class, operator). Vision
-- historically emitted the same operator under several spellings
-- ("DB Fernverkehr" / "DB Fernverkehr AG" / "Deutsche Bahn (DB Fernverkehr)"),
-- so the SAME physical train was stored as multiple rows — one per spelling.
-- The backend now canonicalises operators at scan time (services/operatorNames.ts,
-- shipped 2026-06-09), so NEW scans are clean; this migration cleans up the
-- EXISTING rows to match.
--
-- This migration mirrors the operatorNames.ts allowlist EXACTLY. Like the code,
-- it is conservative: it ONLY collapses spellings that provably denote the same
-- operator, NEVER merges DB Cargo / Fernverkehr / Regio (distinct operators),
-- and LEAVES the ambiguous bare "DB (Deutsche Bahn)" / "Deutsche Bahn" untouched.
-- It does NOT touch class-string fragmentation (e.g. "DB BR 232" vs "BR 232") —
-- that is a separate concern handled by canonicaliseClass() at scan time.
--
-- ⚠️  CONSEQUENCE — READ BEFORE APPLYING: the leaderboard counts
-- `count(distinct s.train_id) as unique_classes` (see migrations 001/005/011/013).
-- Merging two fragmented rows of the SAME train into one therefore REDUCES the
-- unique-class count of any user who held both spellings, and can shift league
-- standings. This is correct de-duplication, but it is user-visible. Run the
-- DIAGNOSTIC block first to see the blast radius, then decide.
--
-- This is DESTRUCTIVE (re-points spots, deletes duplicate trains rows) and
-- NOT cleanly reversible (deleted rows cannot be restored). Take a DB backup /
-- note the diagnostic counts before running the transaction.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- DIAGNOSTIC — run these SELECTs FIRST (read-only, no changes).
-- ────────────────────────────────────────────────────────────
--
-- (a) Which rows would be canonicalised, and to what:
--
-- select operator as current_spelling, count(*) as rows
-- from public.trains
-- where lower(btrim(operator)) in (
--   'db fernverkehr ag','deutsche bahn (db fernverkehr)','db fernverkehr (deutsche bahn)',
--   'db cargo ag','deutsche bahn (db cargo)','db cargo (deutsche bahn)','db schenker rail','railion',
--   'db regio ag','deutsche bahn (db regio)','db regio (deutsche bahn)'
-- )
-- group by operator order by rows desc;
--
-- (b) How many trains rows would be DELETED (merged away) and how many spots
--     re-pointed, after canonicalisation:
--
-- with norm as (
--   select id, class, created_at,
--     case
--       when lower(btrim(operator)) in ('db fernverkehr ag','deutsche bahn (db fernverkehr)','db fernverkehr (deutsche bahn)') then 'DB Fernverkehr'
--       when lower(btrim(operator)) in ('db cargo ag','deutsche bahn (db cargo)','db cargo (deutsche bahn)','db schenker rail','railion') then 'DB Cargo'
--       when lower(btrim(operator)) in ('db regio ag','deutsche bahn (db regio)','db regio (deutsche bahn)') then 'DB Regio'
--       else operator
--     end as op
--   from public.trains
-- ),
-- keepers as (select distinct on (class, op) id from norm order by class, op, created_at asc, id asc)
-- select
--   (select count(*) from norm) - (select count(*) from keepers) as trains_rows_to_delete,
--   (select count(*) from public.spots s join norm n on n.id = s.train_id
--      where n.id not in (select id from keepers))               as spots_to_repoint;
--
-- ────────────────────────────────────────────────────────────

begin;

-- Step 1 — canonicalise operator spellings (mirrors operatorNames.ts EXACTLY).
update public.trains set operator = 'DB Fernverkehr'
  where lower(btrim(operator)) in (
    'db fernverkehr ag', 'deutsche bahn (db fernverkehr)', 'db fernverkehr (deutsche bahn)'
  );

update public.trains set operator = 'DB Cargo'
  where lower(btrim(operator)) in (
    'db cargo ag', 'deutsche bahn (db cargo)', 'db cargo (deutsche bahn)', 'db schenker rail', 'railion'
  );

update public.trains set operator = 'DB Regio'
  where lower(btrim(operator)) in (
    'db regio ag', 'deutsche bahn (db regio)', 'db regio (deutsche bahn)'
  );

-- Step 2 — re-point spots from duplicate (class, operator) rows to the keeper.
-- Keeper = earliest-created row per (class, operator), deterministic tiebreak on id.
with keepers as (
  select distinct on (class, operator) id as keep_id, class, operator
  from public.trains
  order by class, operator, created_at asc, id asc
),
dupes as (
  select t.id as dup_id, k.keep_id
  from public.trains t
  join keepers k on k.class = t.class and k.operator = t.operator
  where t.id <> k.keep_id
)
update public.spots s
  set train_id = d.keep_id
  from dupes d
  where s.train_id = d.dup_id;

-- Step 3 — delete the now-orphaned duplicate trains rows (no spots reference them).
-- Keeper set is recomputed identically; the trains table is unchanged since step 2.
with keepers as (
  select distinct on (class, operator) id as keep_id, class, operator
  from public.trains
  order by class, operator, created_at asc, id asc
)
delete from public.trains t
  using keepers k
  where k.class = t.class and k.operator = t.operator
    and t.id <> k.keep_id;

commit;

-- ── Verification (run after applying) ────────────────────────
-- (1) No fragmented spellings remain:
--   select count(*) from public.trains where lower(btrim(operator)) in (
--     'db fernverkehr ag','deutsche bahn (db fernverkehr)','db fernverkehr (deutsche bahn)',
--     'db cargo ag','deutsche bahn (db cargo)','db cargo (deutsche bahn)','db schenker rail','railion',
--     'db regio ag','deutsche bahn (db regio)','db regio (deutsche bahn)');   -- expect 0
-- (2) No duplicate (class, operator) rows remain:
--   select class, operator, count(*) from public.trains
--     group by class, operator having count(*) > 1;                            -- expect 0 rows
-- (3) No orphaned spots:
--   select count(*) from public.spots s left join public.trains t on t.id = s.train_id
--     where t.id is null;                                                       -- expect 0
--
-- ── Rollback ─────────────────────────────────────────────────
-- NOT cleanly reversible: deleted duplicate trains rows cannot be restored and
-- the spots re-point is one-way. Restore from a pre-migration backup if needed.
