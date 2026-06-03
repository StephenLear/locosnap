# Spec — Sharing & viewing spots (social/discovery, first step)

> Written 2026-06-03. Status: SPEC ONLY — no code. Decision-gated on the privacy posture (Section 4),
> which is the user's call. Grounds the long-deferred Phase 5 social direction in
> `project_leaderboard_redesign` memory + `frontend_backlog` #25.

## Context — why now

Three independent signals now point at social/discovery, the third from inside the team:
1. **2026-05-19** — Play reviewer: "look at others' profiles, what they hunted, connect in groups/clans."
2. **2026-05-31** — straw-poll evangelist: "more discovery/community features."
3. **2026-06-03** — Stephen: "you cannot view other people's spots — would be good to share views as well as cards."

This meets the documented "2 independent external requests" half of the Phase-5 revisit threshold; the founder
signal pushes it over. But the memory's standing guidance is: do NOT jump straight to the full ~20-30h
friends/clans graph — there is a cheaper intermediate. This spec scopes the first real step.

## Current state (verified in code)

- **Cards already share outbound** — `app/results.tsx`, `app/blueprint.tsx`, `app/card-reveal.tsx`.
- **Spots are private in the UI only** — the app queries spots by the current `user_id`; there is no
  browse-someone-else UI.
- **Leaderboards already expose aggregate public data** (username, country flag, spotter emoji, per-tier
  counts) via Supabase views — precedent for controlled public exposure.
- **Spots carry location** — `public.spots.latitude` / `longitude` (nullable; INTEGER per migration 009),
  set from `expo-location` when granted.

## 4. PRIVACY FINDING — read this first (load-bearing)

The spots table SELECT policy is wide open:

```sql
-- supabase/migration.sql:200
CREATE POLICY "Spots are viewable by everyone" ON public.spots FOR SELECT USING (true);
```

**Every spot row — including `latitude`/`longitude` and `user_id` — is already readable by any client
holding the app's Supabase anon key** (which ships in the binary and is trivially extractable). This was
opened up "for leaderboard counts," but it exposes raw per-user sighting coordinates today, independent of
any new feature. Implications:

- **This is a current latent exposure, not a future one.** A motivated party can already reconstruct where
  any user was and when. In a trainspotting app that may have minors, that is a real safety issue and a
  GDPR data-minimisation problem (location is being exposed beyond what the product surface uses).
- Building a *visible* "view others' spots" UI on top of this would take a latent exposure and make it a
  product feature — multiplying the risk and turning an invisible gap into something Apple/Google review and
  users will judge.
- **Therefore the privacy decision comes first, and likely means tightening the data layer regardless of
  which feature we build.** The leaderboard counts can be served by a view/RPC that aggregates without
  exposing the raw `spots` table; the raw table's `USING (true)` SELECT should be narrowed.

### Privacy posture options (USER DECISION — pick one as the baseline)
- **P-A (strictest, recommended baseline): never expose precise location to other users.** Browse features
  show *what* someone collected (classes, rarity, cards) but not *where*. Coordinates stay owner-only.
  Requires: a public-read view/RPC that omits lat/lng; narrow the raw-table SELECT policy to owner-only (or
  to the aggregate columns the leaderboard needs).
- **P-B: city/region-fuzzed location, opt-in.** Spots can show an approximate area (snap to city or a
  coarse grid), only if the owner opted into a public profile. Requires fuzzing on write or in the view.
- **P-C: precise location, opt-in per spot.** Heaviest privacy burden; not recommended for a first step.

Default stance for everything below: **public profiles are OPT-IN**, and **precise coordinates are never
shown to others** (P-A) unless the user explicitly chooses otherwise later.

## The two features, disentangled

### Feature A — Outbound "share a spot/view" (cheap, low-risk)
Mirror the existing card-share: let a user export/share *their own* spot image (the photo + ID overlay).
No backend, no new exposure (they're sharing their own content, like a card). Could fold into 1.0.37 if a
quick win is wanted. The only care item: don't embed coordinates/EXIF in the shared image.

### Feature B — View others' spots / profiles (the real social step; needs the privacy work)
Browse another spotter's public collection in-app. At the data layer the RLS already allows it — so this is
mostly frontend + a privacy-safe read path. Concretely needs:
- A **public-profile opt-in** flag on `profiles` (default off).
- A **privacy-safe read path** (view/RPC) returning only public-allowed fields (username, flag, emoji,
  collection: classes/rarity/cards) — and, per P-A, NO coordinates.
- A **profile-browse UI** (entry from leaderboard rows → tap a spotter → see their collection).
- **Tightening the raw `spots` SELECT policy** so the only public path is the safe view.

## Phased plan (smallest valuable step first)

| Phase | Scope | Effort | Privacy work |
|---|---|---|---|
| **0 (optional, 1.0.37-able)** | Feature A — outbound spot-share | ~2-4h | strip EXIF/coords from the image |
| **1 (recommended first real step)** | Public-profile opt-in + tap-a-leaderboard-row → view their collection (classes/rarity/cards, NO location) | ~8-12h | **the P-A data-layer fix is the gate** |
| **2** | "Recently spotted" discovery feed (global / near-you, location-fuzzed, read-only) — the Untappd-style intermediate | ~6-10h | depends on P-A/P-B decision |
| **3 (deferred ~1k active users)** | Friends graph / groups / clans (requests, social accounts) | ~20-30h | full social infra |

Independent of all of the above: **the latent-exposure fix (narrow the `spots` SELECT policy + an aggregate
view for leaderboard counts) is worth doing on its own**, even if no social feature ships — it closes a real
data-minimisation gap. Recommend doing it as the first concrete piece.

## Backend / RLS changes (Phase 1, P-A baseline)
- New migration (follow the post-2026-10-30 GRANT+RLS template in `feedback_supabase_grant_after_2026_10_30`):
  - `profiles.is_public boolean not null default false` (opt-in).
  - A `public_collection` view/RPC: per-public-profile aggregates + card list, **excluding lat/lng**.
  - Replace `spots … USING (true)` with either owner-only SELECT + a `SECURITY DEFINER` aggregate function
    for leaderboard counts, or a column-limited view. Audit every existing leaderboard view/query first so
    nothing breaks (per `feedback_migration_column_audit`).
- Single prod Supabase project, migrations go straight to prod (`project_supabase_topology`) — review
  schema + the policy change carefully before applying.

## Open decisions for the user (before any build)
1. **Privacy posture P-A / P-B / P-C** (Section 4). Recommended: **P-A** (never show others your location).
2. **Fix the latent spots exposure now, regardless?** Recommended: **yes** — it's a standalone privacy win.
3. **Which phase to commit to first.** Recommended: the latent-exposure fix + Phase 1 (opt-in public profile
   browse, no location). Phase 0 spot-share only if you want a quick 1.0.37 add.
4. **Keep 1.0.37 lean?** Recommended: yes — ship win-back + SAVE% badge + leaderboard explainer as-is; this
   social work is its own build.

## Recommendation (one line)
Don't cram this into 1.0.37. Treat the **`spots` location exposure as a privacy fix to do first**, then build
**Phase 1 (opt-in public profiles, collection-only, no location)** as the first real social step; defer the
friends-graph. Decide the privacy posture (P-A recommended) before writing the migration.
