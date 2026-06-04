# Scoping — Tester feature requests (one-month straw poll)

> Written 2026-06-04. Status: **SCOPING ONLY — no code.** Grounded by a full code exploration on 2026-06-04.
> Source requests logged in `frontend_backlog` memory (2026-05-31 straw-poll batch). Four items scoped below,
> with effort, approach, open decisions, and a recommendation each.

## TL;DR prioritisation

| Item | Real effort | Signal | Verdict |
|---|---|---|---|
| **Scanning / onboarding guide** | Low (~2-3h, no backend) | 1 (Oula) | **Do it** — cheap, plausibly high new-user retention. v1.0.38. |
| **Loco length spec field** | Tiny (~1-2h, backend data only) | 1 (R3) | **Already shipped** — reframe as a per-class hardcode correction, not a feature. |
| **Manual card-edit / correction** | Medium (~6-10h) | **Strongest** (R1/R3/R6/R7 — #1 gap) | **Spec properly next** — needs one product decision first (leaderboard/rarity coupling). |
| **Custom profile photo** | Med-high code, **high moderation cost** | 1 (R3) | **Defer/decline** — moderation-blocked in an app that may serve minors. Revisit only with a moderation plan or stronger demand. |

---

## 1. Scanning / onboarding guide

**Request (Oula, R5):** no guidance on how to scan for the most accurate result; would help new users.

**Current state (verified):**
- Scan screen is `app/(tabs)/index.tsx`; natural slot is after `ProRescuePrompt` (L753), before the hero.
- There is a **battle-tested dismissible-card pattern to reuse**: `components/ProRescuePrompt.tsx` — AsyncStorage
  flag (`locosnap_*_dismissed`), default-hide while the async read is in flight, `track()` on show/dismiss.
  Also mirrored by the country-flag banner in `profile.tsx` (`locosnap_country_banner_dismissed`).
- Low-confidence handling already exists (`index.tsx` L382-423, `lowConfidence.*` i18n: "Hmm, this one's
  tricky… try another angle") — the guide should reinforce the same themes (square framing, daylight/no glare,
  steady/sharp, show class number or livery).
- i18n: `locales/{en,de,pl}.json`, `scan.*` namespace.

**Approach:** new `components/ScanningGuideCard.tsx` mirroring `ProRescuePrompt` (dismissible, AsyncStorage
`locosnap_scanning_guide_dismissed`, `scanning_guide_shown` / `_dismissed` analytics). 3 tips. Mount in
`index.tsx` after `ProRescuePrompt`. Add `scan.scanningGuide.*` to en/de/pl.

**Open decisions:** (a) show to everyone until dismissed, or only first N sessions / until first successful
scan? (recommend: until first successful scan OR dismissed). (b) inline tips card vs. a "?" that opens a modal
(recommend: inline card — discoverable, matches existing banners).

**Recommendation:** build in v1.0.38. Lowest risk, no backend, plausible retention win. ~2-3h.

---

## 2. Locomotive length spec field

**Request (R3, BR159 driver-in-training):** the spec card has no length field.

**Current state (verified — the request is mostly already satisfied):**
- `length` is **fully implemented end-to-end**: it's in `TrainSpecs` (backend + frontend types), **rendered on
  the spec card** (`app/results.tsx:494`, icon `resize`, label `t("results.length")`), and the label is
  translated in all three locales (`en` "Length" / `de` "Länge" / `pl` "Długość").
- It's populated by **Wikidata P2043** (`wikidataSpecs.ts`) with **AI fallback**; merge at
  `trainSpecs.ts:1616` (`wiki.length ?? ai.length`).
- So R3 most likely hit a train where **both Wikidata and the AI returned null** (e.g. BR 159 / Stadler
  EuroDual), not a missing UI field.
- The `SpecsOverride` type (`trainSpecs.ts:245`) does **not** include `length`, so we currently can't hardcode
  a verified length for a class.

**Approach (data correction, not a feature):**
1. Extend `SpecsOverride` to include `"length"` (`trainSpecs.ts:245`).
2. Add verified `length` to the high-value classes where it's missing — starting with the 7 BR 159 keys
   (L603-615). **Verify the real figure first** (Stadler EuroDual Co-Co ≈ 20.5 m, but confirm — per
   `feedback_verify_premise_before_overriding_expert`, R3 is a domain source on this class).
3. Add a per-class `CLASS_INVALIDATIONS` entry (`trainCache.ts`) for each class we hardcode, so the 30-day
   Redis cache picks it up — **one line per class, never a global cache bump** (per
   `backend_cache_invalidation_pattern`).
4. Backend test for the BR 159 length override.

**Recommendation:** this isn't a feature — it's the existing `backend_backlog_corrections` workflow. Fold the
`SpecsOverride` `length` extension + BR 159 into the next correction pass. ~1-2h. No frontend change.

---

## 3. Manual card-edit / user correction layer

**Request (Josh R7 + the recurring #1 gap across R1/R3/R6/R7):** let a user fix a card's class/name/info when
the AI misidentifies, giving them agency over scan errors. Distinct from the existing wrong-ID *report*.

**Current state (verified — the load-bearing finding):**
- **Train identity (class/name/operator/type/designation/rarity_tier) lives on a SHARED `trains` row**, not on
  the spot. Spots reference it by FK (`train_id`), and `upsertTrain()` dedupes by `class + operator`, so many
  users' spots point at the **same** `trains.id`. **A naive UPDATE to `trains` would corrupt every other
  user's card of that class and skew leaderboard unique-class counts.** (`001_initial_schema.sql:40-84`,
  `supabase.ts:60-90`.)
- **Specs/facts are NOT persisted in the DB** — they're generated fresh per scan and live only in the client
  `trainStore` / AsyncStorage `HistoryItem`. Rarity is a denormalised copy on `trains`.
- The **wrong-ID report flow is write-only telemetry** (`012_wrong_id_reports.sql`, `card-reveal.tsx:446-573`)
  — it logs the AI's answer + the user's guess for our review; it does **not** change the user's card.
- RLS today: a user **can** UPDATE their own `spots` row (owner-only policy); they **cannot** update `trains`
  (no policy). So the correct layer to write to is the spot.

**Cleanest data model — per-spot identity override (recommended):**
```sql
-- migration: spots gets an optional override that shadows the joined train fields at display time
alter table public.spots add column if not exists identity_override jsonb default null;
-- { class?, name?, operator?, type?, designation? }
```
At read time, `fetchSpots` returns both the joined `train.*` and `identity_override`; the UI renders
`identity_override.class ?? train.class`, etc. Each user's edit is isolated; the shared `trains` row and the
AI dedup/cache are untouched. (Alternative: a dedicated `spot_corrections` table, one row per spot — more
schema, same effect. JSONB column is simpler.)

**Open product decisions (MUST resolve before building — they touch the moat):**
1. **Leaderboard + rarity coupling.** When a user overrides the class, does it change their unique-class count
   and rarity breakdown (which feed the leaderboard / the rarity-score moat), or is the override **display-only**?
   - *Recommend:* **display-only in v1** (the card shows the corrected class, but leaderboard/rarity stay on the
     AI-identified `trains` row). Letting users freely rewrite their own rarity/class would let anyone mint
     "legendary" spots and corrupt the leaderboard — directly undermining the collection-as-moat positioning.
2. **Specs/facts after an edit.** They're class-derived. Options: (a) leave the original (clearly stale), (b)
   blank them with "specs unavailable for your correction", (c) re-fetch from the backend for the new class.
   - *Recommend:* (b) for v1 — cheapest, honest; (c) is a follow-up.
3. **Free-text vs. constrained.** Allow any string, or only let the user pick from known classes? Free-text is
   easier but messy; a class picker enables future "your correction improved the model" loops.
   - *Recommend:* free-text in v1, with the edit ALSO writing a `wrong_id_reports` row (we already have the
     table) so corrections still feed our tuning.

**Recommendation:** highest-signal tester item and aligned with the community-contribution moat, but it needs
decision #1 locked first (it's a leaderboard-integrity call). **Write a dedicated implementation spec next**
(like the Social Phase 1 doc), defaulting to: per-spot `identity_override` JSONB, display-only, specs blanked,
free-text + a telemetry report row. ~6-10h.

---

## 4. Custom profile photo (own-photo avatar)

**Request (R3):** set an own-photo avatar; couldn't find the function.

**Current state (verified):**
- `avatar_url` **already exists** on `profiles` (migration 001) and is selected into the leaderboard views —
  but it is **never rendered anywhere**. `IdentityBadge` shows flag + emoji only. So the column is structural
  debt; lighting it up touches `IdentityBadge` + the profile header.
- **Image upload infra is ready to reuse:** `uploadPhoto()` (`supabase.ts:752-785`), `expo-image-picker`
  already used in the scan flow, existing public buckets (`spot-photos`, `blueprints`). A `profile-avatars`
  bucket + RLS policies would be a small migration 019.
- **The blocker is moderation, not code.** There is **no content moderation anywhere** in the app (not even on
  train photos). User-uploaded **profile photos (likely real faces) in an app with no age gate** is a genuine
  safety / COPPA / GDPR exposure. The current emoji + flag identity is "safe by design."

**Approach if ever greenlit:** new `profile-avatars` bucket + policies (own-folder write/delete, public read);
photo picker in the identity modal; `IdentityBadge` renders `avatar_url` when present (falls back to
flag+emoji); plus a moderation gate — AI vision moderation at upload (~$0.01/image) **or** a manual approval
queue **or** an age gate. Without one of these, do not ship.

**Recommendation:** **defer / decline at 1 signal.** The moderation liability and the "safe by design" value of
the emoji+flag system outweigh a single request. Revisit only if (a) demand reaches ~3 independent signals, or
(b) we decide to add content moderation for another reason. If we ever want a cheap middle ground: let users
pick from a **curated set of train/loco illustration avatars** (no upload, no moderation) — satisfies the
"personalise my avatar" urge without the user-photo risk.

---

## Suggested sequencing

1. **v1.0.38 batch:** scanning guide (item 1) + the BR 159 length hardcode (item 2, folded into the normal
   correction pass) + the already-built Social Phase 1 (separate plan) + the Pro-upsell placement (already
   committed).
2. **Next spec:** manual card-edit (item 3) — write its own implementation doc once decision #1 (leaderboard
   coupling) is confirmed.
3. **Park:** custom profile photo (item 4) until a moderation decision or stronger demand; offer curated
   illustration avatars as the low-risk alternative if the personalise-my-avatar urge recurs.
