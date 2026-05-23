# Open work roadmap — 2026-05-23

Living inventory of what's open, when to do it, and where the context lives. Captured at the end of the 2026-05-23 launch-ad + ÖBB-4020-correction session so nothing falls through. Re-read at session start before picking up new work; keep updated as items ship or get scoped down.

Format: most-blocking first within each horizon, with effort estimates, triggers, and cross-references to existing memory / changelog / plan docs. Effort is rough and assumes a focused session with no context-switching.

---

## Horizon 0 — In-flight, this hour / this evening

These are open right now from the 2026-05-23 session and shouldn't carry over into a separate session if avoidable.

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

### 1.2 24h stats capture for DE launch ad
- **Action**: 2026-05-24 evening (~24h post). Capture TikTok Studio + IG Reels insights; log to `memory/tiktok_stats.md` with the standard fields (views, avg watch, full-watch %, traffic source, geography, age, gender, new followers). Compare against the locked benchmarks: TikTok full-watch ≥15%, DE viewer share ≥60%, new followers ≥5.
- **Effort**: 30 min.
- **What we learn**: whether the community-pitch hook (`Von Spottern, für Spotter.` at beat 1, no scarcity stat) holds retention vs the BR 101 v2 visual-paradox anchor (21% full-watch). Single-data-point caveat applies.

### 1.3 24h stats capture for PL launch ad
- **Action**: 2026-05-25 evening. Same template. Compare against the SU46 PL ad (just-posted 2026-05-22 — first read 86.4% PL share, awaiting full read) and the all-time-best 3/4 ET22 (23% full-watch / 86.4% PL share).
- **Effort**: 30 min.
- **What we learn**: whether PL community-pitch reaches >50% PL viewer share (the lock-to-PL-audience threshold).

### 1.4 Decide on the EN launch cut
- **Status**: half-built. `endcard_en.mp4` was built this session (logo + "Identify every train." + "Now on the App Store / + Google Play"). Beat 1-4 not built.
- **Options**:
  - (a) Build it — same footage as DE (BR 101 + BR 151 + BR 120 + BR 110 scan), EN overlays. ~1h ffmpeg work. Routes algorithmically to PL not UK (per `feedback_de_ad_default_and_uk_pivot_cost.md`); still worth doing for the brand-search signal building on TikTok.
  - (b) Skip — DE + PL covers 60-65% of viewers; EN doesn't unlock new audience per the channel's algo profile.
- **Recommendation**: (a). The 2026-05-17 evening "LocoSnap" first brand-search query suggests brand-pull is starting; an EN cut at this moment compounds. Cost is 1h, downside is low.
- **Trigger**: After DE 24h read lands and shows the community-pitch hook works at all.

### 1.5 Comment thread monitoring (rolling, 3-5 days)
- **What to watch**: any more Austrian-class corrections on the launch ad threads. If a second AT correction lands, promotes `memory/backend_austrian_coverage_gap.md` from logged-backlog to next-session priority (per the promotion-trigger criterion in that file).
- **Other patterns to watch**: "wo ist der Club" / "where do I join" — these are the leading signal for v1.0.35 Club readiness. Reply pattern is the "Erstmal die App selbst..." holding answer.

---

## Horizon 2 — Next 7-14 days

### 2.1 7-day cost re-measurement (~2026-05-30)
- **Action**: Re-run the Anthropic Cost MTD ÷ Supabase spots(7d) analysis. Target: ≤ $0.06/scan average (from the $0.20/scan baseline measured today).
- **Effort**: 30-45 min.
- **Triggers downstream decisions**:
  - If hit: descope the v1.0.35 Pro soft fair-use cap (Lever 2) and ship the original "Club" design.
  - If missed: dig into anonymous-taster + wrong-ID pre-spot calls as the next gap.
- **Reference**: `docs/handoffs/HANDOVER-2026-05-23.md` next-step #2.

### 2.2 v1.0.35 Phase 0 — store config (USER-ONLY, blocks implementation)
- **Action**: Create `club_membership` €1 IAP in App Store Connect + Play Console + RevenueCat. No code involved. User has to do these — Claude can't.
- **Effort**: 1-2 hours of clicking through three dashboards.
- **Trigger**: After 2.1 lands. Don't start before the cost decision because Phase 0 is the same regardless of whether Lever 2 (Pro cap) is kept or descoped.
- **Reference**: `docs/plans/2026-05-22-v1.0.35-monetisation-plan.md`.

### 2.3 Launch-ad cross-post to Reels carousel (optional)
- **Action**: If DE + PL reads are strong (≥15% full-watch, ≥50% local-language share), consider repackaging the launch into an IG carousel post (still image card with the community-pitch overlay + the four loco frames + CTA). Different IG surface, low marginal effort, IG Reels skip-rate baseline is 44-60% so still images sometimes outperform in saves/shares.
- **Effort**: 1-2 hours.
- **Trigger**: post 24h reads.

---

## Horizon 3 — Logged backlog, no fixed trigger

### 3.1 Austrian (ÖBB) coverage audit
- **Status**: just logged today (`memory/backend_austrian_coverage_gap.md`).
- **Scope**: pre-seed top 10 ÖBB classes — Taurus (1116/1216), 1144, 1142/1042, Cityjet (4744/4746), KISS Cityjet (4010), 1043/1044, Railjet, Desiro VT (5022), legacy electrics (1010/1110/1020), heritage steam (310, 109).
- **Effort**: 6-8h for Tier 1+2 (8 classes) as one batch PR. 10-12h for full Tier 1-3 (10 classes).
- **Approach**: single batch PR using the `SGP / ELIN / Siemens` consortium pattern across 4 of the 10 classes.
- **Promotion trigger**: 2nd Austrian correction in comments, or sustained >10% AT viewer share, OR proactive choice in the next 2-4 weeks while the public "mehr Österreich-Inhalt folgt" commitment is fresh.

### 3.2 Lever 1E — move per-class overrides to Supabase
- **Status**: deferred from today's cost-reduction work.
- **Scope**: per-class overrides for BR 151, BR 101, BR 110, BR 120, BR 412, BR 648, IC1, IC2, BR 247, R2.2, ČD 753/754, etc currently inline in `trainFacts.ts` (~20K tokens) and `rarity.ts` (~25K tokens). Moving to a `train_overrides` Supabase table keyed by class would (a) shrink prompts from ~55K to ~5K tokens (huge per-scan cost saving) and (b) make per-class corrections a database edit instead of a deploy.
- **Effort**: multi-day workstream. Schema design + migration + service refactor + tests + backfill of all existing overrides + frontend admin tool to edit entries.
- **Trigger**: if Lever 1B (per-class cache invalidation, shipped today) doesn't bring per-scan cost below $0.06 measured in 7 days.
- **Reference**: `docs/handoffs/HANDOVER-2026-05-23.md` next-step #4.

### 3.3 Blueprint generation hang fix
- **Status**: filed 2026-05-05 (BR 247 scan).
- **Scope**: Replicate occasionally hangs indefinitely on the spinner with no timeout/error. Caused 3-min stuck state + iOS WatchdogTermination once. Needs (a) Replicate log review to find the failure mode, (b) frontend poll timeout with user-facing fallback message after ~30-60s.
- **Effort**: 2-3h.
- **Trigger**: when a tester reports it again, OR opportunistically during a frontend release window.
- **Reference**: `memory/backend_blueprint_generation_hang.md`.

### 3.4 Rarity classifier — livery-uniqueness signal
- **Status**: single signal logged 2026-05-19. Threshold for promotion = 3 independent external requests for the same concept.
- **Scope**: extend `rarity.ts` to bump tier (Common → Rare/Epic) for Werbeloks, heritage repaints, anniversary liveries, private-operator one-offs.
- **Effort**: 1-2 days (prompt-only path) to a couple of weeks (hardcoded-list path).
- **Trigger**: 2 more independent signals.
- **Reference**: `memory/backend_backlog_corrections.md` "Anonymous Google Play reviewer — rarity classifier..." entry.

### 3.5 Sentry-capture for silent Supabase write failures
- **Status**: identified during the 2026-05-10 `verification_tier` NOT NULL incident.
- **Scope**: frontend Supabase write failures currently swallow errors. Add Sentry capture + retry queue + explicit `verification_tier` defaults in payload.
- **Effort**: 1 day frontend work.
- **Trigger**: queued for v1.0.30+ backlog (already partially handled in v1.0.30; remaining items are merge-loadHistory + retry queue + Sentry hook).
- **Reference**: `memory/feedback_supabase_silent_persistence_failures.md`.

### 3.6 Pricing localisation — final round
- **Status**: research done 2026-05-17; partial rollout.
- **Scope**: drop PL annual to 89 zł + CZ to 499 Kč; raise DE annual to €34.99; introduce lifetime SKU at 2× annual per country. No code change — store-config only.
- **Effort**: 1-2h across App Store Connect + Play Console.
- **Trigger**: opportunistic, ideally before next 7-day cost measurement so any conversion bump shows in the same window.
- **Reference**: `memory/pricing_localisation.md`.

### 3.7 Lifetime Pro SKU — threshold-based ship decision
- **Status**: 1 inbound signal as of 2026-04-30 DE TikTok comment.
- **Scope**: introduce a Lifetime Pro IAP at ~2× annual. Tracker memory file defines the threshold.
- **Effort**: store config + 2-3h RevenueCat wiring + 2-3h frontend paywall layout.
- **Trigger**: per the memory file's threshold.
- **Reference**: `memory/project_lifetime_pro_demand.md`.

### 3.8 Frontend backlog (camera toggle, language picker, gamification)
- **Status**: items deferred to next frontend release.
- **Reference**: `memory/frontend_backlog.md`.

---

## Horizon 4 — Strategic, multi-month

### 4.1 Leaderboard redesign (Duolingo-modelled, complement not replace)
- **Status**: 5-phase plan brainstormed 2026-04-29.
- **Scope**: Phase 1 identity layer.
- **Effort**: weeks per phase.
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
