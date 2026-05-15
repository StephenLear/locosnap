# Scan-aware camera-screen banner — design

**Date:** 2026-05-15
**Target build:** v1.0.32
**Risk:** Low
**Estimate:** ~30 LOC, ~45 min including manual QA

## Problem

The `PaywallSoftPrompt` urgency frame currently only renders on the **results screen** — i.e. *after* the user completes a scan. At free-tier scan 5 ("1 scan left") the urgent amber banner is shown post-results, but the user's next action — returning to the camera screen and tapping the shutter — happens without any reminder. The hard wall at scan 6 then arrives without the urgency banner immediately preceding it.

Mirroring the soft-prompt onto the camera screen fires the urgency frame *before* the scan-6 attempt, at the moment of highest conversion intent.

## Decisions (from brainstorming 2026-05-15)

1. **Variant ladder:** full ladder — scan_2, scan_4, scan_5 (consistent with results screen, not just scan_5).
2. **Dismiss behaviour:** reset on variant change. Dismissing at scan 2 must not silence the scan 5 urgent banner.
3. **Placement:** below the LOCOSNAP header + scans-remaining badge, above the scanner hero frame.
4. **Audience:** signed-in free users only. Pre-signup trial users keep their existing trial-badge UI. Pro users see nothing. Matches results-screen gating.

## Approach

Reuse the existing component with two small modifications. No new component, no new i18n keys.

### Component changes — `frontend/components/PaywallSoftPrompt.tsx`

1. **Variant-reset effect.** Add `useEffect(() => setDismissed(false), [variant])`. Solves the persistent-tab issue on camera screen. No behaviour change on results screen — each result is a fresh mount.
2. **`surface` prop.** Type `"results" | "camera"`, defaults to `"results"` so the existing results-screen caller is non-breaking. Threaded into all three analytics events and the paywall router source param.
3. **Bail out for `default` variant.** Return `null` from the component when `variant === "default"`. Removes a stale code path that would otherwise show a generic banner at scan 0/1/3 if the camera-screen mount is unconditional. Safe on results screen because the wrapper there is already gated.

### Camera screen mount — `frontend/app/(tabs)/index.tsx`

Insert between header and hero (line ~672 → ~675):

```tsx
{session && !profile?.is_pro && (
  <PaywallSoftPrompt
    scansUsed={profile?.daily_scans_used ?? 0}
    surface="camera"
  />
)}
```

Gating: signed-in free users only. The `default`-variant null-bailout in the component handles the "scansUsed is 0/1/3" case so the banner only paints when one of the three scan-count variants is active.

### Analytics

All three events gain a `surface` field:

```
paywall_softprompt_shown      { variant, scansUsed, surface }
paywall_softprompt_tapped     { variant, scansUsed, surface }
paywall_softprompt_dismissed  { variant, scansUsed, surface }
```

Paywall route source param becomes `softprompt_${variant}_${surface}` so RC purchase attribution can split by surface.

### i18n

No new keys. Reuses existing `paywall.softPrompt.scan_2/4/5.title|body` in EN + DE.

## Testing

Unit tests on this component are thin (pure-i18n + click-handler). Manual QA via Expo Go on iOS + Android:

- Sign in as free user, scansUsed=2 → camera screen → teal sparkles banner appears.
- Tap dismiss → banner gone → tap shutter → results screen shows same banner → return to camera → banner still dismissed (variant unchanged).
- Force scansUsed=4 (via test account or DB) → camera banner re-appears (variant changed → dismiss reset).
- Force scansUsed=5 → camera banner re-appears in amber urgent state with alert-circle icon.
- Tap banner → routes to `/paywall?source=softprompt_scan_5_camera`.
- Sign out → camera screen → no banner (pre-signup gate).
- Upgrade to Pro → camera screen → no banner.
- DE locale → same flow, titles/body render in German.

## Rollout

- Single commit to `main` after review (no migration, no backend change, no Render redeploy).
- Will ship with the next v1.0.32 EAS build alongside any other queued items.
- v1.0.32 build not triggered as part of this work — `feedback_build_approval` rule applies.

## Risk

Low. The `surface` prop has a sensible default so the existing results-screen caller is unchanged. The `default`-variant null-bailout could theoretically remove banner exposure if a future caller relies on showing the "Grow your collection" copy at scan 0/1/3 — none currently do (`results.tsx` is the only caller and it's gated). The variant-reset effect runs on string equality so it's stable.

## Out of scope

- Pre-signup trial-user variant ladder (different scan domain 0..3, would need its own copy).
- Banner on history / collection / profile tabs.
- A/B testing surface (results-only vs results+camera). Could be added later via a feature flag if v1.0.32 read is ambiguous.
- Paywall-screen copy or pricing changes.
