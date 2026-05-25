# Open work roadmap — 2026-05-23 (audited 2026-05-25)

Living inventory of what's open, when to do it, and where the context lives. Captured at the end of the 2026-05-23 launch-ad + ÖBB-4020-correction session so nothing falls through. Re-read at session start before picking up new work; keep updated as items ship or get scoped down.

**Audit pass 2026-05-25**: After the Lifetime Pro entry (§3.7) was flagged stale, full audit of Horizons 0-4. Significant shrinkage of the real backlog — most Horizon 0 items shipped 2026-05-23, Horizon 2 cost re-measurement shipped early 2026-05-24, Lifetime Pro was already shipped 2026-05-14, Sentry-capture mostly shipped in v1.0.30, pricing localisation mostly shipped 2026-05-17, Phase A facts-layer fix shipped 2026-05-25 and partially obsoletes Lever 1E (§3.2). Real remaining backlog is much smaller than the original roadmap suggested. See edits inline below.

Format: most-blocking first within each horizon, with effort estimates, triggers, and cross-references to existing memory / changelog / plan docs. Effort is rough and assumes a focused session with no context-switching.

---

## Horizon 0 — In-flight, this hour / this evening — ALL CLOSED 2026-05-23 (audit confirmed 2026-05-25)

All five Horizon 0 items shipped same session 2026-05-23. Kept for reference only — do not re-treat as open.

### 0.1 Post the 2nd ÖBB 4020 reply (after Render confirms deploy)
- **Action**: Watch `https://locosnap-render.onrender.com/api/health` (or whichever Render URL is current) until the timestamp refreshes past the 2026-05-23 ~19:00 push of `2b22dac`. Then post the prepared follow-up reply in the thread:
  > Update: 4020 jetzt korrekt — SGP/ELIN/Siemens, 120 km/h, 1.200 kW, 120 Sets, ÖBB-only, Inbetriebnahme 1978. Bitte nochmal scannen, dauerhaft gefixt.
- **Effort**: 5 min. Just waiting on Render.
- **Why it matters now**: Closes the public correction loop in the same window the comment is still visible. Matches the established pattern (Steph LSWR T3, Trainpics MUC R2.2, Trainvibez SU46) — fan correction → same-session fix → "fix is live" follow-up.
- **Reference**: `memory/backend_backlog_corrections.md` top entry; commit `2b22dac`.

### 0.2 Verify Render auto-deploy actually succeeded
- **Action**: Confirm sharp's native build completed on Render. If it failed, the cost-reduction hotfix from earlier today (`76660c3`) and the ÖBB 4020 fix (`2b22dac`) both need a manual intervention.
- **Effort**: 5 min once the build log is visible.
- **Trigger**: Now. Backend is already pushed.
- **Reference**: `docs/handoffs/HANDOVER-2026-05-23.md` next-step #1.

### 0.3 Update `docs/CHANGELOG.md` (DONE this session — verify before close)
- `2026-05-23` block has two entries now: cost-reduction hotfix + ÖBB 4020 fix. Both committed.

### 0.4 Update `docs/ARCHITECTURE.md` (PENDING this session)
- **Action**: Update the AI-provider section to record (a) ÖBB 4020 KNOWN_SPECS + facts override + cache invalidation, (b) launch-ad pipeline as a documented content workflow, (c) bump the "last updated" date.
- **Effort**: 15-20 min.
- **Why it matters now**: CLAUDE.md mandatory rule — architecture doc must be in sync at session close.

### 0.5 Run `/handover` at session close
- **Action**: Capture today's session — launch-ad build (DE + PL), ÖBB 4020 two-stage correction, Austrian coverage gap logged, public commitment "mehr Österreich-Inhalt folgt" made, backend pushed.
- **Effort**: 10-15 min (the skill drives the doc).
- **Why it matters now**: CLAUDE.md mandatory rule.

---

## Horizon 1 — Tomorrow / next 7 days

### 1.1 Post the PL launch ad (Tuesday 2026-05-24)
- **Action**: Post `~/Desktop/locosnap_launch_pl.mp4` (10s, 720×1280, 2.2 MB) to TikTok + Instagram with the PL caption + 5-hashtag tail. CapCut music added before post.
- **Effort**: 15-30 min including music.
- **Reference**: This session's draft above; locked plan: DE Mon / PL Tue, do NOT unpin BR 101 v2.

### 1.2 ~~24h stats capture for DE launch ad~~ — DONE
### 1.3 ~~24h stats capture for PL launch ad~~ — DONE
### 1.4 ~~Decide on the EN launch cut~~ — DONE — launched 2026-05-25
- **Status (audit 2026-05-25)**: All three launch ads (DE / PL / EN) now launched. EN cut was completed and posted same week. Stats now form a 3-cut launch readout in `tiktok_stats.md` for the 2026-05-22 → 2026-05-25 launch window.

### 1.5 Comment thread monitoring (rolling, 3-5 days)
- **What to watch**: any more Austrian-class corrections on the launch ad threads. If a second AT correction lands, promotes `memory/backend_austrian_coverage_gap.md` from logged-backlog to next-session priority (per the promotion-trigger criterion in that file).
- **Other patterns to watch**: "wo ist der Club" / "where do I join" — these are the leading signal for v1.0.35 Club readiness. Reply pattern is the "Erstmal die App selbst..." holding answer.

---

## Horizon 2 — Next 7-14 days

### 2.1 ~~7-day cost re-measurement~~ — DONE EARLY 2026-05-24 evening
- **Status**: SHIPPED. Re-measurement was done 2026-05-24 evening instead of waiting until 2026-05-30 because day-1-post-hotfix data was already useful. Result: 365 spots at $26.43 = $0.072/scan blended. Linear regression across May 11-24 decomposes that into **marginal ~$0.06/scan + ~$4-5/day fixed overhead**. Marginal target hit. Apr 28 "$0.015/scan" figure formally retired.
- **Downstream decision**: v1.0.35 Pro soft fair-use cap (Lever 2) can be descoped per the original "if hit" branch — marginal $0.06/scan covers Pro economics at current volume. Confirmed.
- **Remaining sub-item**: investigate the $4-5/day fixed Anthropic overhead (failed-vision retries / anonymous pre-spot Vision calls / Render warmup pings). Diagnostic on a low-volume day (May 20 or May 21). 1-2h.
- **Reference**: `memory/project_ai_cost_baseline.md` 2026-05-24 evening entry.

### 2.2 v1.0.35 Phase 0 — store config (USER-ONLY, blocks implementation)
- **Action**: Create `club_membership` €1 IAP in App Store Connect + Play Console + RevenueCat. No code involved. User has to do these — Claude can't.
- **Effort**: 1-2 hours of clicking through three dashboards.
- **Trigger**: After 2.1 lands. Don't start before the cost decision because Phase 0 is the same regardless of whether Lever 2 (Pro cap) is kept or descoped.
- **Reference**: `docs/plans/2026-05-22-v1.0.35-monetisation-plan.md`.

### 2.3 ~~Launch-ad cross-post to Reels carousel~~ — DONE (closed 2026-05-25, not relevant)
- **Status**: launch ads are all live across the planned surfaces (DE TikTok + PL TikTok + PL Instagram + EN cut). Carousel cross-post is no longer relevant — the multi-cut launch covers the audience reach the carousel would have unlocked.

---

## Horizon 3 — Logged backlog, no fixed trigger

### 3.1 ~~Austrian (ÖBB) coverage audit~~ — CLOSED 2026-05-25 (re-open on signal)
- **Status**: CLOSED for now per user direction 2026-05-25. No 2nd Austrian correction has landed; @martinhacker3 "44er am RJ" candidate never confirmed a scan. Public "mehr Österreich-Inhalt folgt" commitment timer is approaching the proactive-window edge (~3 weeks from 2026-05-23) but no concrete pull.
- **Re-open trigger**: any new Austrian correction in TikTok / Play / Instagram comments, OR sustained >10% AT viewer-share in TikTok analytics, OR an explicit DM ask for an Austrian class.
- **Scope (preserved for re-open)**: pre-seed top 10 ÖBB classes — Taurus (1116/1216), 1144, 1142/1042, Cityjet (4744/4746), KISS Cityjet (4010), 1043/1044, Railjet, Desiro VT (5022), legacy electrics (1010/1110/1020), heritage steam (310, 109). 6-8h for Tier 1+2 as one batch PR. Pattern: `SGP / ELIN / Siemens` consortium across 4 of 10.
- **Reference**: `memory/backend_austrian_coverage_gap.md`.

### 3.2 ~~Lever 1E — move per-class overrides to Supabase~~ — DEMOTED 2026-05-25 (largely no longer needed)
- **Status**: DEMOTED. Trigger was "if Lever 1B per-class cache invalidation + image downscale don't bring per-scan cost below $0.06". The 2026-05-24 evening re-measurement showed **marginal $0.06/scan is being hit** — Lever 1E is no longer urgent.
- **Phase A (2026-05-25) also partially obsoletes this**: the original motivation for moving overrides to Supabase was (a) prompt token reduction and (b) easier per-class correction without deploy. Phase A's VERIFIED FACTS block injection means most facts-layer bugs are now structurally caught WITHOUT needing per-class prose bullets — so the prompt-token motivation is also weaker now (fewer hand-written bullets needed going forward).
- **Real remaining motivation**: backend admin tool to edit class overrides without a code deploy. Still worth doing eventually but no longer a cost-driven priority. Multi-day workstream.
- **Reference**: `memory/project_ai_cost_baseline.md` 2026-05-24 evening entry; Phase A in 2026-05-25 CHANGELOG.

### 3.3 ~~Blueprint generation hang fix~~ — CLOSED 2026-05-25 (cold for 20 days)
- **Status**: CLOSED per user direction 2026-05-25. Single tester report 2026-05-05; no recurrence in the 20 days since across launch-ad-driven traffic. Either rare enough not to be worth chasing or self-resolved via Replicate-side improvements.
- **Re-open trigger**: any new tester report of stuck blueprint spinner.
- **Scope (preserved for re-open)**: (a) Replicate log review on the 2026-05-05 task, (b) frontend poll timeout in `pollBlueprintStatus` with user-facing fallback message after 30-60s.
- **Reference**: `memory/backend_blueprint_generation_hang.md`.

### 3.4 ~~Rarity classifier — livery-uniqueness signal~~ — CLOSED 2026-05-25
- **Status**: CLOSED per user direction 2026-05-25. Single signal logged 2026-05-19; no progression in the 6 days since. Threshold was ≥3 independent signals — never reached, none in flight.
- **Re-open trigger**: any new tester ask for livery-based rarity uplift (Werbeloks, heritage repaints, anniversary liveries, private-operator one-offs).
- **Scope (preserved for re-open)**: extend `rarity.ts` to bump tier for visually unique liveries. Prompt-only path 1-2 days; hardcoded-list path a couple of weeks.
- **Reference**: `memory/backend_backlog_corrections.md` "Anonymous Google Play reviewer — rarity classifier..." entry.

### 3.5 Sentry-capture for silent Supabase write failures — MOSTLY SHIPPED in v1.0.30 (audit 2026-05-25)
- **Status**: PARTIALLY SHIPPED. v1.0.30 (commit `56acf08`, live 2026-05-11) added Sentry capture in 4 supabase write paths + explicit `verification_tier` in payload + `loadHistory` merge instead of cloud-replace.
- **Remaining sub-items**: (a) offline-write queue flushed on connectivity return — would handle the transient saveSpot Network-request-failed pattern at root, (b) idempotency-onConflict on cancellation insert. Current saveSpot rate (5 events / 3 users / 13 days) is below the >20/wk escalation threshold so this is not urgent.
- **Effort**: ~1 day for offline-write queue. Lower priority sub-items.
- **Reference**: `memory/feedback_supabase_silent_persistence_failures.md`.

### 3.6 ~~Pricing localisation — final round~~ — COMPLETE 2026-05-25
- **Status**: COMPLETE per user direction 2026-05-25. All planned pricing changes shipped (PL annual 89.99 zł, CZ 499 Kč, DE €34.99, IT/ES €24.99, NL/FR €32.99, FI €34.99, UK held; Lifetime SKU live across markets). The "remaining gaps" in `pricing_localisation.md` (UK monthly, PL intro existence, FI/NL/FR/IT/ES/CZ monthly tiers) are documentation-completeness items only, not real pricing decisions. The canonical live-prices section in `pricing_localisation.md` will be filled in opportunistically on next storefront visit.
- **Reference**: `memory/pricing_localisation.md` (canonical live-prices section).

### 3.7 ~~Lifetime Pro SKU — threshold-based ship decision~~ — CLOSED 2026-05-25 (already shipped 2026-05-14)
- **Status**: ENTRY WAS STALE in this roadmap. Lifetime Pro shipped end-to-end on 2026-05-14: Apple `pro_lifetime` IAP live, Play `pro_lifetime` live, RevenueCat `$rc_lifetime` package wired into `autorenew_v1` offering, paywall UI renders it as the 3rd tile (`paywall.tsx:184`, sorted last by design). Pricing per `pricing_localisation.md` (DE €89.99, PL 229 zł, CZ 1,299 Kč, etc).
- **Demand tracker (archival)**: cold since 2026-05-01 — only one DE thread (aurel) ever asked. Original "5-10 asks across 2 platforms" threshold was never close to being hit; SKU shipped as part of the broader v1.0.29 monetisation expansion, not because demand justified it on its own.
- **Re-open trigger**: now only "should lifetime get more visual weight in the paywall sort order?" — would need paywall-analytics evidence of conversion volume that justifies elevating it above the annual anchor.
- **Reference**: `memory/project_lifetime_pro_demand.md` (rewritten 2026-05-25).

### 3.8 ~~Frontend backlog (camera toggle, language picker, gamification)~~ — CLOSED COMPLETE 2026-05-25
- **Status**: CLOSED COMPLETE per user direction 2026-05-25. The titled items (camera toggle, language picker) shipped in v1.0.8. Gamification (achievements, leaderboard Phases 1-3) shipped in v1.0.21-25. Remaining items still tracked in `memory/frontend_backlog.md` (device-locale auto-detection poison rule, zero-engagement rescue push, Pro expiring soon banner, PL-annual-default in paywall) — those are individual items tied to their own triggers, not a single "frontend backlog" entry.
- **Reference**: `memory/frontend_backlog.md`.

---

## Horizon 4 — Strategic, multi-month

### 4.1 Leaderboard redesign (Duolingo-modelled) — PHASES 1-3 SHIPPED, 4-5 DEFERRED
- **Status**: PARTIALLY SHIPPED. Phase 1 identity layer + Phase 2 named leagues (Bronze → Vectron) + weekly reset + promotion/demotion zones + freeze counter + boost inventory + Phase 3 country/station/collection tabs all shipped 2026-05-05 in the v1.0.22-23 ship cycle. Migration 013 applied to production Supabase. Render cron `locosnap-league-cron` scheduled.
- **Phase 4** (named-league polish, season banners, visual treatment) — not yet started.
- **Phase 5** (friends graph) — DEFERRED until 1k+ DAU per friend-graph viability research. Listed in `frontend_backlog.md` Item #25.
- **Reference**: `memory/project_leaderboard_redesign.md`.

### 4.2 v1.0.35 "The Club" full release
- **Status**: design + implementation plan done. Phase 0 store config blocks code work.
- **Effort**: 2-4 weeks of focused frontend + backend work.
- **Reference**: `docs/plans/2026-05-22-v1.0.35-monetisation-plan.md`.

### 4.3 v1.0.36+ ideas captured during 2026-05-23 launch session
- "Mehr Österreich-Inhalt" public commitment — see 3.1.
- Community/identity layer in the app to make "Spotter Club" framing real (badges, profile, leaderboards). Connects to 4.1.
- Possible "creator tier" for prolific spotters who hit X classes — would slot into the v1.0.35 Club tier as a stretch goal.

---

## Doc-hygiene reminders (every session close)

Per CLAUDE.md mandatory workflow rules:

1. `docs/CHANGELOG.md` updated with all file edits + reasoning. Format: date block, newest first within block.
2. `docs/ARCHITECTURE.md` updated for any state changes (build versions, scan limits, distribution status, infrastructure, monetisation, AI provider config). Bump the "last updated" date.
3. `/handover` run — captures session context to `docs/handoffs/HANDOVER-YYYY-MM-DD.md`.
4. `git log origin/main..main` empty before session close (no in-flight unpushed commits, unless deliberately held).
5. Memory files current (per `feedback_memory_hygiene.md`) — not deferred to end-of-session sweep.

---

## How to use this doc

- **At session start**: read this + the latest handover + audit any "PENDING" items against actual git state (don't trust the doc cold — verify per `feedback_play_billing_diagnosis.md` and the project-status-memory pattern).
- **When picking work**: walk Horizon 0 → 1 → 2 → 3 in order. Take the first item where the trigger condition is met and effort budget matches available time.
- **When something ships**: cross it off here AND update the cross-referenced memory file in the same session. Don't leave the roadmap stale.
- **When something new gets logged**: add it to the right horizon here as well as its dedicated memory file, so this doc remains the single inventory point.
- **When a horizon-2+ item gets triggered**: promote it inline (don't just move it — re-scope effort + trigger based on what changed).
