# Plan — Skip Vision on warm pHash matches

> Written 2026-05-24 evening. Status: **proposal, not approved**. Pre-implementation. Requires measurement before commitment.

## Goal

Reduce per-scan Anthropic cost by skipping the Claude Vision call (`Sonnet 4.6`, ~50% of per-scan cost = ~$0.030/scan) when the incoming image is a perceptual-hash near-match for a previously identified train. The identification result is returned from a perceptual-hash → `{class, operator}` lookup cached in Redis; specs/facts/rarity then resolve through the existing `getCachedTrainData` path exactly as today.

## Why this lever specifically

From the 2026-05-24 cost analysis:
- Marginal cost per scan: ~$0.059 (regression on May 11-24 daily data)
- Per-call breakdown (estimate): Vision Sonnet 4.6 ~$0.030 / Specs Haiku ~$0.005 / Facts Haiku ~$0.015 / Rarity Haiku ~$0.005 = ~$0.055
- **Vision is the single largest cost component per scan.** The other three are Haiku and already cached.
- Cache (text-results) hit rate is at the asymptote (96-99%) so squeezing the Haiku side further has diminishing returns.
- Vision currently runs unconditionally at [`backend/src/routes/identify.ts:278`](backend/src/routes/identify.ts:278) — there is no path that skips it.

This is the only lever that **eliminates a call** rather than **shrinks a call**. Elimination compounds with cache hits (a Vision-skip + cache-hit scan costs essentially zero); shrinks do not.

## Approach

Compute a perceptual hash (pHash) of the downscaled image before the Vision call. Look up `phash → {class, operator, confidence, capturedAt}` in Redis. If a near match exists (Hamming distance ≤ N, recency ≤ M days), return that identification and skip the Vision API call entirely. Otherwise, run Vision as today and write the new `phash → identification` entry to Redis.

```
incoming image
    ↓
downscaleForVision()  (already happening)
    ↓
computePHash()        (new — ~10ms via sharp)
    ↓
phashLookup(hash)     (new — Redis GET)
    ↓
   hit?  ─yes─→ return cached identification (skip Vision)
    │
    no
    ↓
identifyTrainFromImage()  (today's path)
    ↓
phashStore(hash, identification)  (new — Redis SET with TTL)
    ↓
return identification
```

## Open questions (must answer before shipping)

1. **What's the actual hit rate on real production scans?** Unknown. Could be 5% (mostly fresh photos) or 40% (lots of repeat scans). The whole economic case hinges on this.
2. **What Hamming-distance threshold gives <1% false-positive rate on the LocoSnap photo distribution?** Different operators with the same livery (e.g. DB Rotlinge vs. ÖBB red, multiple SU46 in PKP Cargo green) are the worst-case false-positive seeds.
3. **What recency window?** 24h is safe but narrow. 30 days matches the existing Redis TTL and would capture more hits but increases false-positive risk if the same train was repainted / re-numbered.
4. **Cross-user matching: yes or no?** Cross-user gives much higher hit rate but means a user's incorrect scan can pollute another user's result. Same-user-only is safer but cuts hit rate ~80%.
5. **Cost of pHash itself.** Computing a pHash on a 1280px image with sharp is ~10ms CPU. Redis GET is ~2ms. Net overhead per scan: ~15ms. Negligible vs the ~2-4s of a Vision call, but worth measuring to confirm.

## Implementation sketch (if approved)

### Phase 0 — Measurement (no code change to prod)

**Goal:** establish actual hit-rate distribution on real traffic before committing.

- Add a `pHashes` table in Supabase (no Redis writes yet — just observability).
- New `backend/src/services/imageHash.ts` exporting `computePHash(buffer): Promise<string>` (16-character hex from `sharp`'s 64-bit dHash or pHash variant — TBD by library).
- Add a non-blocking write at the end of the identify route: log `{user_id, computed_phash, identified_class, identified_operator, captured_at}` to the new table.
- Run for **7 days** to collect ~5000-10000 hashes.
- Query: for each new pHash, what % had a prior near-match (Hamming ≤ 4, ≤ 8, ≤ 12)? Cross-user vs same-user split.
- Decision gate: if same-user hit rate < 5% AND cross-user hit rate < 15%, abandon this lever and pick a different one. If above either threshold, proceed to Phase 1.

### Phase 1 — Shadow mode (no behaviour change, just instrumentation)

- Add the Redis lookup but ignore the result. Log `[VISION] phash-shadow: would_skip=true/false, recorded_class=X, vision_returned_class=Y` after the Vision call completes.
- Run for **3-5 days** to measure false-positive rate empirically. Every divergence between the would-have-been-cached result and the actual Vision result is a false positive.
- Decision gate: if false-positive rate > 2% AND those false-positives concentrate on identifiable patterns (specific liveries, specific Hamming bands), tune the threshold and re-run shadow mode. Repeat until ≤ 1% false-positive rate.

### Phase 2 — Live, with kill switch

- Promote shadow to live. Add `VISION_PHASH_SKIP_ENABLED` env flag defaulting to `false` so the kill switch is local config, not code-deploy.
- Track and emit `cache_hit_phash` (skipped vision) and `cache_miss_phash` (ran vision) metrics on `/api/health`.
- Re-measure $/scan after 7 days. If marginal cost has not dropped by at least 30% (target: $0.059 → $0.04), the implementation is sound but the hit rate is too low for this lever to be worth keeping — disable and remove.

## Risks

- **False positives are silently wrong.** A pHash collision between two different trains returns the wrong identification with no obvious user-visible failure. The user assumes the app is wrong rather than realising the system skipped the actual identification step. Mitigation: phash-skip only when prior identification confidence was ≥ 90%, and only when Hamming distance is very tight (≤ 3 on 64-bit hashes).
- **Image-quality variance kills the hit rate.** Same train at slightly different angle / time of day / weather → different pHash. Real-world hit rate may be much lower than naive intuition.
- **Library choice locks in the hash algorithm.** pHash, dHash, and aHash all behave differently on locomotive photos (lots of horizontal lines, similar colour palettes). Wrong choice = high false positive rate that can't be tuned away. `sharp-phash` is a candidate; needs evaluation against `image-hash` and a quick spike to test on a known-confused-pairs corpus.
- **Cross-user pollution.** If a wrong identification is cached and another user scans the same train, both get the wrong answer. Mitigation: pHash entries expire when the source identification gets corrected via a `CLASS_INVALIDATIONS` write, OR pHash skip only on same-user matches (sacrifices most of the hit rate).
- **Phase 0 measurement adds Supabase write load.** ~365 scans/day × pHash row = trivial volume, but worth keeping in mind.

## Success criteria

- Marginal $/scan drops from $0.059 to ≤ $0.045 (≥ 25% reduction) after 14 days of live operation.
- False-positive rate on identification ≤ 0.5% measured on tester-reported wrong-ID volume.
- No regression in p50/p95 latency of the `/api/identify` endpoint (the pHash lookup must not add measurable delay).

## What this plan does NOT cover

- The **$4-5/day fixed Anthropic overhead** investigation. Separate work, separate diagnostic path (Anthropic Logs on a low-volume day to identify retry/anonymous/warmup calls).
- The other three levers from the cost analysis (vision prompt trim, image downscale further, common-operator-to-Haiku-vision). Those are smaller in expected impact and orthogonal to this lever — can ship independently if this one fails.
- v1.0.35 monetisation work (separate plan).

## Recommended decision

**Start Phase 0 (measurement only) in the next implementation session.** Phase 0 is ~3 hours of code (new table migration + hash service + non-blocking write at identify-route end + a one-shot query script) and produces the data that determines whether Phase 1+2 are worth doing. Going straight to Phase 1 without the Phase 0 hit-rate data risks 2-3 days of work on a lever that doesn't deliver.

The full Phase 0+1+2 cycle is **~10-14 calendar days** end-to-end given the measurement windows. If the goal is faster cost reduction, the **vision prompt trim** (smaller, deterministic saving — no measurement phase needed) is the better starting point.
