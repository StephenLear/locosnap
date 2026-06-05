# Implementation Plan — Social Phase 1 (opt-in public profiles)

> Written 2026-06-04. Extends and supersedes the open-decisions section of
> `docs/plans/2026-06-03-social-spots-sharing-and-viewing.md`. All privacy decisions LOCKED (see below).
>
> **STATUS 2026-06-05 — PAUSED mid-build (user out of time; resume when free):**
> - **Migration `supabase/migrations/020_social_public_profiles.sql` is WRITTEN but NOT YET APPLIED to prod.**
>   It adds `profiles.is_public` (default false) + two SECURITY DEFINER RPCs `get_public_profile(uuid)` and
>   `get_public_collection(uuid,int,int)` — both `is_public`-guarded, both explicitly exclude lat/lng + photo_url.
>   Column-audited against live schema (spots has blueprint_url/photo_url/lat/lng/spotted_at; profiles has
>   country_code/spotter_emoji from 010). **TO RESUME: paste the file into the Supabase SQL editor, run it, then
>   run the verification block at its bottom.** It is committed to the repo but is NOT auto-applied (Render does
>   not run Supabase migrations).
> - **Design decision made during the build (do not re-litigate without reason):** the RPC counts use TRUE totals
>   (all spots, all distinct classes, true per-tier rare/epic/legendary distinct-class counts) — NOT the
>   `leaderboard_rarity` view's epic/legendary-only inner join (which under-reports a profile's totals and
>   mislabels rare_count). Per-spot `identity_override` is NOT applied in the public view (shows canonical class) —
>   fine for Phase 1.
> - **REMAINING WORK = the frontend only** (steps 1-8 in "Frontend changes" below): `is_public` toggle in Profile,
>   pressable leaderboard rows, NEW `app/spotter/[id].tsx` grid screen, two RPC fetchers in `services/supabase.ts`,
>   `PublicProfile`/`PublicCollectionItem` types, en/de/pl i18n, pure-logic tests. Ships in the next EAS build.
> - Code map below was grounded 2026-06-04 — re-verify the cited line numbers before editing (files may have moved).

## What Phase 1 delivers

A signed-in user can tap a spotter on any leaderboard row and view that spotter's **public collection** —
their train classes, rarity breakdown, and AI blueprints — only if that spotter has opted in. **No location,
ever. No user photos in the public view** (see locked decisions). Read-only grid; no friends, no DMs, no feed.

## Locked decisions (do not re-litigate)

1. **Privacy posture P-A** — precise location is never shown to other users. (Decided 2026-06-03.)
2. **The latent `spots` exposure is already fixed** — migration 018 is APPLIED to prod (spots SELECT is
   owner-only; leaderboard views are definer). Phase 1 is unblocked.
3. **Public cards show class / rarity / blueprint ONLY — NO user photos.** (Decided 2026-06-04.) Rationale:
   stored user photos may carry EXIF GPS; excluding them removes the last location-leak vector with zero
   extra work. Photos stay private to the owner. (If photos are ever wanted later, gate behind a verified
   EXIF-strip-on-upload step — a separate decision.)
4. **Read path = two `SECURITY DEFINER` RPCs**, not a view — easier to gate on `is_public` and to audit for
   "no lat/lng". Mirrors the existing `get_my_league_rankings` / `get_weekly_rarity_champion` pattern.
5. **`is_public` defaults to FALSE** — strictly opt-in.
6. **Discovery in Phase 1 is leaderboard-tap only** — no global directory/search.
7. **Public cards are read-only previews** — they do NOT tap through to `card-reveal.tsx`, which is
   owner-gated by migration 018. Phase 1 is a grid view only.

## Backend — Migration (next available number, prod Supabase, no staging — review before applying)

> Note: 019 is taken by the card-edit feature (`019_spot_identity_override.sql`, 2026-06-04). This migration is the next free number (020+) when Social Phase 1 is built.

Follow the `begin … commit` + post-2026-10-30 GRANT template. Column-audit every reference against the real
schema before applying (per `feedback_migration_column_audit`). Apply via the Supabase SQL editor like 018,
then run the verification block.

**a. Opt-in column** (existing `profiles` table already has Data API grants — no new column grant needed):
```sql
alter table public.profiles
  add column if not exists is_public boolean not null default false;
```

**b. `get_public_profile(target_user_id uuid)`** — `SECURITY DEFINER`, pinned `search_path` (per migration 006).
Returns ONE row of public identity + aggregate counts, or no rows if the target is not public:
- `username, country_code, spotter_emoji, level`
- `total_spots, unique_classes, rare_count, epic_count, legendary_count` (aggregated from spots⨝trains,
  same expressions as the `leaderboard_rarity` view — rare/epic/legendary only, no uncommon, to stay
  consistent with the existing rarity score invariant).
- Body guards: `if (select is_public from profiles where id = target_user_id) is not true then return; end if;`
- `grant execute on function public.get_public_profile(uuid) to anon, authenticated;`

**c. `get_public_collection(target_user_id uuid, p_limit int default 50, p_offset int default 0)`** —
`SECURITY DEFINER`, pinned `search_path`. Returns the card list (newest first), or no rows if not public:
- `spot_id, train_id, class, name, operator, type, designation, rarity_tier, blueprint_url, spotted_at`
- **EXPLICITLY NO `latitude`, `longitude`, `photo_url`, `photo_accuracy_m`.**
- Same `is_public` guard as (b).
- `grant execute on function public.get_public_collection(uuid, int, int) to anon, authenticated;`

**Verification block (in the migration, run after apply):**
- As authenticated non-owner: `select * from get_public_collection('<a-public-user>')` returns rows with no
  coordinate/photo columns; `select * from get_public_collection('<a-private-user>')` returns nothing.
- Confirm `\df+ get_public_collection` shows `SECURITY DEFINER` and the pinned search_path.

**Rollback:** `drop function get_public_collection(uuid,int,int); drop function get_public_profile(uuid);
alter table public.profiles drop column is_public;`

## Frontend changes

| # | File | Change |
|---|------|--------|
| 1 | `store/authStore.ts` (~L20-38) | Add `is_public: boolean` to the `Profile` type; add `updateProfilePublicity(value: boolean)` (optimistic local set + `.from("profiles").update({ is_public }).eq("id", uid)`, mirroring `updateSpotterEmoji`). |
| 2 | `types/index.ts` | New `PublicProfile` (identity + counts) and `PublicCollectionItem` (class/name/operator/type/designation/rarity_tier/blueprint_url/spotted_at — and nothing else). Define them fresh; do NOT extend `HistoryItem` (which carries lat/lng). |
| 3 | `services/supabase.ts` | `fetchPublicProfile(userId)` → `.rpc("get_public_profile", { target_user_id })`; `fetchPublicCollection(userId, limit, offset)` → `.rpc("get_public_collection", {...})`. Map snake_case → camelCase like existing fetchers. |
| 4 | `app/(tabs)/profile.tsx` (~L770 modal) | Add an "Make my collection public" `Switch` in the identity-edit modal; draft state + wire into `handleSaveIdentity` via `updateProfilePublicity`. Add a one-line helper text ("Others can see your classes & rarity — never your location"). |
| 5 | `components/leaderboard/{MyLeagueTab,CountryTab,CollectionTab}.tsx` row components | Wrap each row (`LeagueRow` L240, `CountryRow` L186, `CollectionRow` L184) in `Pressable` → `router.push({ pathname: "/spotter/[id]", params: { id: row.userId } })`. Each row already carries `userId`. |
| 6 | `app/spotter/[id].tsx` (NEW) | `useLocalSearchParams<{ id }>`; fetch profile + collection; render header (flag + emoji + username + stat row) and a rarity-coloured card grid. States: loading, **private** ("This spotter's collection is private"), empty, error, and self-view (redirect to `/(tabs)/profile`). Cards are non-interactive previews. |
| 7 | `locales/{en,de,pl}.json` | Toggle label + helper text; spotter-screen strings (private/empty/error/header stat labels). Verify DE umlauts + PL diacritics. |
| 8 | `__tests__/` | Pure-logic tests only (ts-jest convention): the snake→camel mappers in (3) and any visibility/self-view helper. RPC behaviour is DB-side, not jest-testable. |

## Scope boundaries (Phase 1 is NOT)

No friends/clans graph (Phase 3, deferred ~1k users), no discovery feed (Phase 2), no DMs/contact, no
location at any fidelity, no outbound spot-share image (that's the optional Phase 0 in the parent spec), no
public photos.

## Deferred / open for later phases

- **Public photos** — only if EXIF-strip-on-upload is verified/added first.
- **Block/report a spotter** — low risk in Phase 1 (no contact, no location, username already public via
  leaderboard), but revisit if a public directory/feed lands in Phase 2.
- **Self-tap behaviour** — Phase 1 just redirects to own Profile; a richer "preview how others see me" view
  can come later.

## Verification & rollout checklist (for the build session)

1. Write the migration (next free number, 020+); column-audit; review with user; apply via Supabase SQL editor; run verification block.
2. Frontend changes 1-7; `tsc --noEmit` clean; `npm test` green.
3. Manual: User A toggles public → User B taps A on a leaderboard → sees classes/rarity/blueprints, **no
   photos, no location**; confirm the network tab shows no lat/lng/photo columns; toggle A back to private →
   B sees the private state.
4. `/changelog` + update `docs/ARCHITECTURE.md` (new monetisation-adjacent surface: opt-in public profiles +
   the migration + the two RPCs) in the same session.
5. Ships in the next EAS build (v1.0.38 candidate) — no standalone deploy.

## Effort

~8-12h (matches the parent spec's Phase 1 estimate). Migration + RPCs ~2-3h, services/store/types ~1-2h,
modal toggle ~1h, pressable rows ~1h, new screen ~2-3h, i18n + tests + docs ~1-2h.
