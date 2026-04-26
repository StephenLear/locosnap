# Card v2 — Implementation Plan
Date: 2026-04-24
Status: draft / pre-build (awaiting phase 1 scope sign-off)

> Companion docs:
> - Research brief: `docs/design/cards-v2-research-brief.md` (patterns from eBird/iNat/TCG Pocket/Strava/Letterboxd/Untappd)
> - Earlier narrow scope (shipped 2026-03-28): `docs/plans/2026-03-28-shareable-card-design.md` — fixed the broken Share button. This plan extends from there.
> - Backlog source: `memory/frontend_backlog.md` items 10/11/12

---

## 0. Goal

Make the train card a first-class collectable object — not just a reveal moment — with trust tiers that prevent internet-photo abuse. Personal provenance (YOUR photo, YOUR location, YOUR date, YOUR serial) is the social core; the AI blueprint is secondary.

**Three UX gaps closed by one feature:**
- Tap a history tile → opens a full detail card (not the scan-result screen)
- Persistent share action from detail (today share only exists at reveal moment)
- Trading-card feel — flip for specs/rarity, compare view

**One product gap closed:** Verified vs Unverified tiers prevent leaderboard + collection-count abuse from internet-photo scans.

---

## 1. Product decisions (signed off 2026-04-24)

| # | Decision | Value |
|---|---|---|
| 1 | Gallery-scan recency window for Verified tier | **7 days** (server-side constant, tunable post-launch) |
| 2 | Verified/Unverified split visibility on profile | **Public** (Letterboxd/iNat pattern) |
| 3 | Unverified card deletable? Convertible? | **Deletable yes, never convertible to Verified retroactively** |
| 4 | Unverified cards still generate AI blueprint? | **Yes always** (denying it reads as punishment, hurts retention) |
| 5 | Sighting serial scope | **Country-scoped** (UK/DE focus), global rank shown only on tap |
| 6 | Android mock-location response | **Soft-flag** (Strava pattern) — Unverified + internal risk score, not hard ban |

---

## 2. Non-goals (this plan)

- **Community Verified tier** (3rd tier via 2-user cross-confirmation at same station). Design noted in research brief §2.3 edge cases. Medium effort, not phase 1.
- **Card flip physics with gyroscope parallax.** Nice emotional polish, Pokémon TCG Pocket pattern. Phase 3.
- **Image-hash matching against known internet photos.** Requires third-party service (e.g. TinEye API) or a self-hosted pHash index. Not in scope — soft-flag + provenance-first design carries the anti-abuse weight for v1.
- **Admin dashboard for risk scores.** Logged internally, reviewed via Supabase SQL editor until a dashboard is justified.

---

## 3. Phasing

Three phases. Each can ship independently and is individually useful.

### Phase 0 — Prerequisites (1-2 sessions)
Non-breaking groundwork. No user-visible changes.

- **P0.1** Backend i18n refactor: `GERMAN_INSTRUCTION` → `LANGUAGE_INSTRUCTIONS[lang]` lookup across `trainFacts.ts`, `trainSpecs.ts`, `rarity.ts`. Stub PL/FR/NL/FI/CS entries. Remove `language === "de" ? X : ""` ternaries. Ship standalone commit; Render auto-deploy.
- **P0.2** Supabase migration: add new columns to `spots` (or equivalent table) — `capture_source` (enum: camera/gallery), `exif_timestamp` (timestamptz nullable), `verified` (bool), `photo_accuracy_m` (int nullable), `risk_flags` (jsonb — mock_location, stripped_exif, etc.). All with sensible defaults so existing rows default to Unverified.
- **P0.3** Frontend `HistoryItem` type extension (`types/index.ts`) to match. Non-breaking — existing cards default to Unverified.
- **P0.4** Scan-time capture: modify `app/(tabs)/index.tsx` to record `captureSource` + EXIF timestamp + GPS accuracy when scanning. No UI change.
- **P0.5** Backend endpoint: `POST /api/identify` accepts + persists the new fields. Client-computed `verified` flag validated server-side (cheap re-check against the 7-day rule + GPS presence + mock-location flag).

### Phase 1 — Card v2 MVP (2-3 sessions)
The minimum shippable feature. Closes backlog items 10/11.

- **P1.1** New screen: `app/card-detail.tsx`. Route: `/card-detail?id={historyItemId}`. Renders the full card front + back structure from the research brief §3.
- **P1.2** Tap handler on `history.tsx` tiles routes to card-detail (not to the scan-results screen as today).
- **P1.3** Verified/Unverified badge rendering on card front. Localised string via i18next.
- **P1.4** Provenance block on card front: username, station name (reverse-geocoded with user's language), date + time (Intl.DateTimeFormat).
- **P1.5** Persistent Share button on card-detail that reuses the existing `captureRef` capture path from card-reveal.tsx (don't reinvent — the 2026-03-28 static-card pattern works).
- **P1.6** Reverse-geocoding passes `settingsStore.language` through to the geocoding API (2-line change per call site).
- **P1.7** All new strings in `locales/en.json` + `locales/de.json`. Plural-safe via ICU interpolation. No hardcoded EN.

**Ship gate (signed off 2026-04-24):** phase 1 ships with **"Your Nth sighting of this class"** only — derivable client-side from existing history, no backend dependency. The country-scoped "27th spotter of this fleet number" social hook is deferred to phase 2 (P2.2) when the backend endpoint + country resolution land together. This keeps phase 1 shippable on the next build cycle without waiting for a backend-aggregate rollout.

### Phase 2 — Social surfaces (2-3 sessions)
Closes backlog item 12 (trading-card energy) + competitive surfaces.

- **P2.1** Card back: AI blueprint as hero + specs. Tap-to-flip (simple spring animation, no gyroscope yet). `Animated.View` with `rotateY` interpolation — existing pattern in card-reveal.tsx works.
- **P2.2** Sighting serial backend endpoint: `GET /api/sighting-serial?class=X&fleet=Y&country=GB` → returns `{ serial: 27, totalInCountry: 104 }`. Supabase aggregate query on `spots` table. Country from user's settings or IP geoip fallback.
- **P2.3** Server-side share-card rendering. New endpoint `POST /api/share-card` → returns PNG (1080×1350 portrait, 1080×1920 Stories). Use `satori` + `resvg-js` (lightweight, no headless browser). Text in user's language from backend locale mirror. User photo + username + station + date burned in. Watermark: `locosnap.app`.
- **P2.4** Leaderboard queries filter to `verified = true` only. Profile "collected" count splits into "X verified · Y personal" with an explainer tap.
- **P2.5** First-sighting "NEW!" animation on card-detail (iNat/TCG Pocket reveal pattern — we already have ParticleEffect component).
- **P2.6** Compare button on card back → existing `compare.tsx` screen. Already works — just needs the entry point.

### Phase 3 — Nice-to-haves (separate roadmap)
Not scoped in this plan.

- Community Verified tier (cross-confirmation).
- Gyroscope-parallax card flip (Pokémon TCG Pocket polish).
- Badge-based soft leaderboard (Untappd pattern) as an alternative to ranked leaderboard — feeds into the separate leaderboard revamp the product lead flagged.
- Mock-location risk score admin dashboard.
- Station as first-class entity ("Frankfurt Hbf · your 12th sighting here").
- Image-hash matching against known internet photos.

---

## 4. Data model changes

### 4.1 Supabase

Migration `009_card_v2_provenance.sql`:

```sql
ALTER TABLE spots
  ADD COLUMN capture_source TEXT CHECK (capture_source IN ('camera', 'gallery')) DEFAULT 'gallery',
  ADD COLUMN exif_timestamp TIMESTAMPTZ,
  ADD COLUMN verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN photo_accuracy_m INT,
  ADD COLUMN risk_flags JSONB DEFAULT '{}'::jsonb;

CREATE INDEX idx_spots_verified_user ON spots(user_id, verified);
CREATE INDEX idx_spots_class_country_created ON spots(train_class, country, created_at) WHERE verified = TRUE;
-- second index supports sighting-serial queries; only verified rows count
```

All existing spots default to `verified = FALSE`. No retroactive promotion — this is deliberate per decision #3.

### 4.2 Frontend types

`frontend/types/index.ts`:

```typescript
export type CaptureSource = "camera" | "gallery";

export interface HistoryItem {
  // ... existing fields ...
  captureSource: CaptureSource;
  exifTimestamp: string | null;   // ISO date string
  verified: boolean;
  photoAccuracyM: number | null;
  riskFlags: Record<string, boolean>;  // e.g. { mockLocation: true, strippedExif: false }
  sightingSerial: number | null;       // populated by /api/sighting-serial on card-detail open
  sightingSerialCountry: string | null;
}
```

### 4.3 Backend types

Mirror in `backend/src/types/index.ts`. `POST /api/identify` request schema extended.

---

## 5. Backend work

| File | Change |
|---|---|
| `services/trainFacts.ts` | P0.1 — `GERMAN_INSTRUCTION` → `LANGUAGE_INSTRUCTIONS[lang]` lookup |
| `services/trainSpecs.ts` | P0.1 — same |
| `services/rarity.ts` | P0.1 — same |
| `routes/identify.ts` | P0.5 — accept + persist new provenance fields; server-side re-validate `verified` flag |
| `routes/sightingSerial.ts` (new) | P2.2 — `GET /api/sighting-serial?class=X&fleet=Y&country=GB` |
| `routes/shareCard.ts` (new) | P2.3 — server-side PNG rendering via satori + resvg |
| `services/verification.ts` (new) | P0.5 — centralised function: given captureSource + EXIF + GPS + mockLocation flag → returns `verified: boolean`. Single source of truth, testable in isolation. |
| `locales/en.json` + `de.json` (new, backend-side) | P2.3 — mirror frontend share-card strings server-side. Keep in sync via a small sync script or a shared package. |

---

## 6. Frontend work

| File | Change |
|---|---|
| `types/index.ts` | P0.3 — extend `HistoryItem` |
| `app/(tabs)/index.tsx` | P0.4 — capture captureSource + EXIF at scan time |
| `app/(tabs)/history.tsx` | P1.2 — tap handler routes to card-detail; optional grid polish |
| `app/card-detail.tsx` (new) | P1.1 — main new screen |
| `app/card-reveal.tsx` | P1.3 — add Verified badge to the reveal (small addition) |
| `app/results.tsx` | P1.3 — add Verified badge; keep the detailed-results flow unchanged |
| `services/api.ts` | P2.2, P2.3 — new API calls for sighting serial + share card |
| `store/trainStore.ts` | P0.3, P2.2 — carry provenance through, cache sighting serial |
| `locales/en.json` + `locales/de.json` | P1.7 — all new strings |
| `i18n/index.ts` | (review only) — confirm plural interpolation is wired |

**Expected new LOC:** ~600-900 total across phases 1+2. New screen is the biggest chunk. No major refactors of existing screens (card-reveal and results stay largely untouched — they just get one extra badge).

---

## 7. i18n/language headroom (baked into every phase)

Per decisions from the 2026-04-24 session:

- **Every new string in locale files from day 1.** Hard rule. Lint or PR-check enforces.
- **Plurals via i18next ICU interpolation.** `t('sightings_count', { count: n })`. Critical for the sighting-serial phrasing in Polish (4 plural forms) and Finnish (partitive case).
- **Dates/numbers via `Intl.DateTimeFormat` + `Intl.NumberFormat`.** User locale from `settingsStore.language`. No manual formatting.
- **Reverse-geocoding passes user language** to the geocoding API. 2-line change.
- **Server-side share card renders in user's language.** Backend locale files mirror frontend.
- **Backend `LANGUAGE_INSTRUCTIONS[lang]` refactor ships in phase 0** — unblocks PL/FI/CS/FR/NL drop-in at Android launch with no code change.
- **Polish copy QA before PL ships.** Use tester Jan Kaczorkowski (krawiec.jr69) — confirmed Polish, already on tester list. Polish ordinals agree in gender + case; "27th spotter" has non-trivial edge cases. Don't trust GPT-4o for socially-facing copy.

---

## 8. Anti-abuse logic (centralised)

Single file: `backend/src/services/verification.ts`.

```typescript
type VerificationInput = {
  captureSource: 'camera' | 'gallery';
  exifTimestamp: Date | null;
  hasGps: boolean;
  photoAccuracyM: number | null;
  mockLocationFlag: boolean;
  now: Date;
};

type VerificationResult = {
  verified: boolean;
  tier: 'verified-live' | 'verified-recent-gallery' | 'unverified';
  riskFlags: Record<string, boolean>;
};

export function computeVerification(input: VerificationInput): VerificationResult {
  // Rules from research brief §2.1 and product decisions:
  //   live camera + GPS fix + accuracy <50m + no mock   => verified-live
  //   recent gallery (<=7d EXIF) + GPS + accuracy <100m => verified-recent-gallery
  //   else                                              => unverified
  // Always log risk flags (mockLocation, strippedExif, staleExif, lowAccuracy) for server-side review.
}
```

- Constants (7-day window, 50m/100m accuracy thresholds) in `backend/src/config/verification.ts` — tunable without client release.
- Unit-tested in isolation: `verification.test.ts`. Covers every edge case from research brief §2.3 table.
- Client re-runs the same logic (shared via small utility) to render the Verified badge optimistically before the server confirms — matches Strava's pattern.

---

## 9. Rollout + risk

### 9.1 Risk: existing spots all become Unverified overnight

All 18,640 XP worth of Steph's sightings (and everyone else's) will default to `verified = FALSE` after migration 009. Acceptable per decision #3 (no retroactive promotion), but needs **user-facing messaging** on first open of the new build:

> "LocoSnap now distinguishes Verified sightings (photos taken with location) from Personal ones (gallery-only). Your existing collection is preserved — all past sightings keep their XP and stay in your history. New sightings will show a Verified badge when they meet the criteria."

Show once as a modal on first launch of the v2 build, never again. Wording goes through locale files.

### 9.2 Risk: server-side share-card rendering failure

If satori/resvg blows up at load, fall back to the existing client-side `captureRef` flow (from the 2026-03-28 work). Users still get a share card, just without the burned-in provenance watermark. PostHog event `share_card_fallback` for monitoring.

### 9.3 Risk: GPS accuracy thresholds wrong

50m / 100m thresholds are educated guesses. Run a 2-week silent A/B on the threshold post-phase-1-launch — log what would have been Verified at 50m vs 100m vs 200m, see where real trainspotter photos cluster. Adjust constants, no code change.

### 9.4 Rollback

- Phase 0 is fully non-breaking — keep.
- Phase 1 breakage: feature-flag the card-detail route. On blow-up, flag off → history tiles go back to opening results.tsx. (Needs a tiny remote-config or Supabase-key check. Alternatively: in-app minimum-version check in the existing settings sync.)
- Phase 2 breakage: share-card endpoint failure is invisible to user thanks to §9.2 fallback. Sighting serial failure → field stays null, UI hides the line. Leaderboard-filter failure → revert the one-line SQL filter.

---

## 10. Testing

- **Unit:** `verification.test.ts` — all edge cases from research brief §2.3.
- **Integration:** `identify.test.ts` — extend with verified=true / verified=false fixtures.
- **Manual QA checklist (pre-v1.0.21 submit):**
  - Scan with camera → Verified badge shown.
  - Gallery photo <7 days old with GPS → Verified badge shown.
  - Gallery photo 30 days old with GPS → Unverified badge shown.
  - Gallery photo with GPS stripped → Unverified.
  - Screenshot from Photos app → Unverified.
  - Location permission off → Unverified, app still functions fully.
  - Tap history tile → opens card-detail (not results).
  - Share from card-detail → produces PNG with burned-in username + station + date.
  - Share card in DE → German strings, German date format, German station name.
  - Profile count shows "X verified · Y personal" correctly.
  - First-launch-of-v2 modal appears once, then never again.

---

## 11. Phase 0 scope sign-off

Before I start any code, confirm:

- [ ] Phase 0.1 (`LANGUAGE_INSTRUCTIONS[lang]` refactor) ships as its own commit this session or next.
- [ ] Migration 009 can run against production Supabase when ready (not tonight — needs a build-freeze window).
- [ ] Phase 1 target build: v1.0.21 (next Android submit, after current v1.0.20 approves).
- [ ] No EAS build triggers without explicit user approval in-session.
- [ ] When Phase 1 is ready to ship, language QA: confirm DE copy with German-speaking tester (we have plenty); don't add PL/FI/FR/NL strings until a native speaker has QA'd them.

---

**End of plan.**
