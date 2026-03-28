# Shareable Train Card — Design Document
Date: 2026-03-28

## Problem

The Share button on the card-reveal screen fails silently on device. `captureRef` cannot reliably capture the animated card because the target View is wrapped in nested `Animated.View` layers with `position: absolute`. The fallback fires instead: a text-only share containing an emoji, which violates project rules and provides no visual value to the recipient.

There is also no way to save the card to the device camera roll.

## Solution

Three changes to `card-reveal.tsx`:

### 1. Hidden static card component for export

A second render of the card front, positioned off-screen at `left: -9999`. Fixed 400x580px. No animation wrappers. Visually identical to the on-screen card front: photo area, rarity badge, class name, operator, stats row (speed, power, surviving count), LocoSnap watermark bottom-right.

`collapsable={false}` on the root View so react-native-view-shot can locate it reliably.

This component is never visible to the user. It exists solely as the capture target.

### 2. Reliable share function

`captureRef` targets the static card ref (not the animated card). Captured as PNG at quality 1. Saved to cache directory with filename `locosnap-[class]-[operator].png`. Shared via `expo-sharing`.

Share text (no emoji):
- With location: `"Guess what I just spotted and added to my collection near [CITY]. Identified with LocoSnap."`
- Without location: `"Guess what I just spotted and added to my collection. Identified with LocoSnap."`

The card image is the hook. No class name, no operator, no rarity in the text — the recipient has to look at the card to find out what was spotted. The text creates curiosity; the card delivers the answer.

Location is resolved via `Location.reverseGeocodeAsync()` on mount using stored lat/lng from `currentLocation`. Result cached in local state. If reverse geocoding fails or times out (2s), falls back to no-location text silently.

No emoji anywhere.

Tracks `card_shared` event to PostHog.

### 3. Save to Gallery

Same static card captured via `captureRef`. Uses `expo-media-library` (already installed). Requests `WRITE` permission if not granted. Saves to device library with filename `LocoSnap_[CLASS]_[OPERATOR].png`.

Tracks `card_saved` event to PostHog.

## UI Changes

Action button row changes from two buttons to three:

| Before | After |
|--------|-------|
| [Share] [Full Details] | [Save] [Share] [Full Details] |

All three equal flex in the row. Save uses `download-outline` icon. Share keeps `share-outline`. Full Details unchanged.

## Data Flow

```
On mount:
  if currentLocation has lat/lng
    reverseGeocodeAsync() -> city name -> setState(locationName)
  else
    locationName = null

On Save tap:
  captureRef(staticCardRef) -> uri
  MediaLibrary.saveToLibraryAsync(uri)
  track("card_saved")

On Share tap:
  captureRef(staticCardRef) -> uri
  move to cache with clean filename
  Sharing.shareAsync(uri, { dialogTitle: shareText })
  track("card_shared")
```

## Files Changed

- `frontend/app/card-reveal.tsx` — all changes contained here

## Files Unchanged

- No backend changes
- No new dependencies
- No navigation changes
- All animation, particle, and flip behaviour untouched

## What This Is Not

This is not a redesign of the card. The static export card is visually identical to the existing card front. The goal is reliability and a working share image, not a new visual design.

Premium card styles (blueprint-style export card) are out of scope for this implementation. That is a separate feature.

## Success Criteria

- Share produces a PNG image of the card in the share sheet, not text
- Save writes a PNG to the camera roll
- Share text matches the approved format with no emoji
- Location appears in share text when available, silently omitted when not
- All existing card behaviour (flip, glow, particles, close) unchanged
- `card_shared` and `card_saved` events visible in PostHog
