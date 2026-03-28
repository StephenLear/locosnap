# Shareable Train Card — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the broken Share button on card-reveal so it produces a real card image, add a Save to Gallery button, and use a share text that makes the card the hook.

**Architecture:** A hidden off-screen static View renders the card front at fixed dimensions. `captureRef` targets that static view — not the animated card — so image capture is reliable regardless of animation state. The existing animated card is untouched.

**Tech Stack:** react-native-view-shot (`captureRef`), expo-sharing, expo-media-library, expo-location (`reverseGeocodeAsync`), Zustand store for train/location data.

---

### Task 1: Add missing imports to card-reveal.tsx

**Files:**
- Modify: `frontend/app/card-reveal.tsx` (top of file, lines 1-30)

**Context:** `expo-media-library` is already installed (used in `blueprint.tsx`) but not imported in `card-reveal.tsx`. `expo-location` is already installed (used in `(tabs)/index.tsx`) but also not imported here.

**Step 1: Add the two missing imports**

Find this block at the top of `card-reveal.tsx`:
```typescript
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import ParticleEffect from "../components/ParticleEffect";
import * as FileSystem from "expo-file-system/legacy";
import { track } from "../services/analytics";
```

Replace with:
```typescript
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import ParticleEffect from "../components/ParticleEffect";
import * as FileSystem from "expo-file-system/legacy";
import { track } from "../services/analytics";
```

**Step 2: Verify the file still compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to the new imports.

**Step 3: Commit**

```bash
git add frontend/app/card-reveal.tsx
git commit -m "feat(card-share): add MediaLibrary and Location imports"
```

---

### Task 2: Add shareCardRef, locationName state, and reverse geocoding effect

**Files:**
- Modify: `frontend/app/card-reveal.tsx` (inside `CardRevealScreen`, after existing refs and state)

**Context:** The existing refs are `cardRef`, `flipAnim`, `slideAnim`, `scaleAnim`, `glowAnim`. The existing state is `isFlipped` and `revealComplete`. `currentLocation` is already pulled from `useTrainStore()` — it has `latitude` and `longitude` or is null.

**Step 1: Add shareCardRef and new state**

Find this block (around line 73):
```typescript
const cardRef = useRef<View>(null);
```

Replace with:
```typescript
const cardRef = useRef<View>(null);
const shareCardRef = useRef<View>(null);
```

Then find this block (around line 100):
```typescript
const [isFlipped, setIsFlipped] = useState(false);
const [revealComplete, setRevealComplete] = useState(false);
```

Replace with:
```typescript
const [isFlipped, setIsFlipped] = useState(false);
const [revealComplete, setRevealComplete] = useState(false);
const [locationName, setLocationName] = useState<string | null>(null);
const [isSaving, setIsSaving] = useState(false);
const [isSharing, setIsSharing] = useState(false);
```

**Step 2: Add reverse geocoding effect**

Add this new `useEffect` directly after the existing `track("card_revealed")` useEffect (around line 112):

```typescript
// Reverse-geocode stored location to a readable city name for share text
useEffect(() => {
  if (!currentLocation) return;

  const timeout = setTimeout(() => setLocationName(null), 2000);

  Location.reverseGeocodeAsync([
    { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
  ])
    .then((results) => {
      clearTimeout(timeout);
      const place = results[0];
      const name = place?.city || place?.district || place?.region || null;
      setLocationName(name);
    })
    .catch(() => {
      clearTimeout(timeout);
      setLocationName(null);
    });

  return () => clearTimeout(timeout);
}, []);
```

**Step 3: Verify the file still compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 4: Commit**

```bash
git add frontend/app/card-reveal.tsx
git commit -m "feat(card-share): add shareCardRef, locationName state, reverse geocoding"
```

---

### Task 3: Replace handleShare with a working implementation

**Files:**
- Modify: `frontend/app/card-reveal.tsx` (the `handleShare` function, around lines 171-219)

**Context:** The current `handleShare` captures `cardRef` which is inside nested `Animated.View` layers — this fails on device, triggering the text fallback. The new implementation captures `shareCardRef` (the hidden static card built in Task 4). Also removes the emoji from the share text.

**Step 1: Replace the entire handleShare function**

Find and replace the full `handleShare` function (lines 171-219):

```typescript
// Share card as image
const handleShare = async () => {
  if (isSharing || !shareCardRef.current) return;
  setIsSharing(true);

  try {
    const uri = await captureRef(shareCardRef, {
      format: "png",
      quality: 1,
    });

    const slug = (currentTrain?.class || "train")
      .replace(/\s+/g, "-")
      .toLowerCase();
    const destPath = `${FileSystem.cacheDirectory}locosnap-${slug}.png`;
    await FileSystem.moveAsync({ from: uri, to: destPath });

    const shareText = locationName
      ? `Guess what I just spotted and added to my collection near ${locationName}. Identified with LocoSnap.`
      : "Guess what I just spotted and added to my collection. Identified with LocoSnap.";

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(destPath, {
        mimeType: "image/png",
        dialogTitle: shareText,
      });
    }

    track("card_shared", {
      train_class: currentTrain?.class,
      has_location: !!locationName,
    });
  } catch (error) {
    console.warn("Share failed:", (error as Error).message);
  } finally {
    setIsSharing(false);
  }
};
```

**Step 2: Verify the file still compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 3: Commit**

```bash
git add frontend/app/card-reveal.tsx
git commit -m "feat(card-share): fix handleShare — capture static card ref, remove emoji"
```

---

### Task 4: Add handleSave function

**Files:**
- Modify: `frontend/app/card-reveal.tsx` (add new function after handleShare)

**Context:** Uses the same pattern as `blueprint.tsx` lines 231-262. `expo-media-library` is now imported. Captures the same `shareCardRef`.

**Step 1: Add handleSave immediately after handleShare**

```typescript
// Save card image to device gallery
const handleSave = async () => {
  if (isSaving || !shareCardRef.current) return;
  setIsSaving(true);

  try {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      console.warn("Media library permission denied");
      setIsSaving(false);
      return;
    }

    const uri = await captureRef(shareCardRef, {
      format: "png",
      quality: 1,
    });

    const slug = (currentTrain?.class || "train")
      .replace(/\s+/g, "-")
      .toLowerCase();
    const destPath = `${FileSystem.cacheDirectory}locosnap-save-${slug}.png`;
    await FileSystem.moveAsync({ from: uri, to: destPath });

    await MediaLibrary.saveToLibraryAsync(destPath);

    track("card_saved", {
      train_class: currentTrain?.class,
    });
  } catch (error) {
    console.warn("Save failed:", (error as Error).message);
  } finally {
    setIsSaving(false);
  }
};
```

**Step 2: Verify the file still compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 3: Commit**

```bash
git add frontend/app/card-reveal.tsx
git commit -m "feat(card-share): add handleSave — save card PNG to device gallery"
```

---

### Task 5: Add the hidden static ShareCard component to the JSX

**Files:**
- Modify: `frontend/app/card-reveal.tsx` (JSX section of CardRevealScreen, and StyleSheet)

**Context:** This is the off-screen View that `captureRef` will actually capture. It must be rendered in the component tree at all times (not conditional) so the ref is always populated. It is positioned at `left: -9999` so the user never sees it. It mirrors the front face of the animated card exactly: photo area, rarity badge, NEW/duplicate badge, class name, operator·type, stats row, LocoSnap branding.

**Step 1: Add the hidden card to JSX**

Find this line near the bottom of the return statement (around line 520-521):
```tsx
      {/* Tap to flip hint */}
```

Add the hidden static card immediately BEFORE that line:

```tsx
      {/* Hidden static card — captured by captureRef for Share and Save */}
      <View
        ref={shareCardRef}
        collapsable={false}
        style={styles.shareCard}
      >
        {/* Photo area */}
        <View style={styles.shareCardPhotoArea}>
          {currentPhotoUri ? (
            <Image
              source={{ uri: currentPhotoUri }}
              style={styles.shareCardPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.shareCardPhotoPlaceholder}>
              <Ionicons name="train" size={64} color={rarityColor} />
            </View>
          )}

          {/* Rarity badge */}
          <View style={[styles.shareCardRarityBadge, { backgroundColor: rarityColor }]}>
            <Ionicons name="diamond" size={12} color="#fff" />
            <Text style={styles.shareCardRarityText}>
              {rarityLabels[currentRarity.tier]}
            </Text>
          </View>

          {/* NEW badge */}
          {isNewClass && (
            <View style={styles.shareCardNewBadge}>
              <Ionicons name="sparkles" size={12} color="#fff" />
              <Text style={styles.shareCardNewText}>NEW!</Text>
            </View>
          )}

          {/* Duplicate badge */}
          {!isNewClass && existingSpotCount > 1 && (
            <View style={styles.shareCardDuplicateBadge}>
              <Ionicons name="camera" size={12} color="#fff" />
              <Text style={styles.shareCardDuplicateText}>
                Spotted x{existingSpotCount}
              </Text>
            </View>
          )}
        </View>

        {/* Info area */}
        <View style={styles.shareCardInfoArea}>
          <Text style={styles.shareCardClass} numberOfLines={1}>
            {currentTrain.class}
          </Text>
          {currentTrain.name && (
            <Text style={[styles.shareCardName, { color: rarityColor }]} numberOfLines={1}>
              "{currentTrain.name}"
            </Text>
          )}
          <Text style={styles.shareCardMeta} numberOfLines={1}>
            {currentTrain.operator} · {currentTrain.type}
          </Text>

          {/* Stats row */}
          <View style={styles.shareCardStatsRow}>
            {currentSpecs?.maxSpeed && (
              <View style={styles.shareCardStat}>
                <Ionicons name="speedometer" size={12} color={colors.accent} />
                <Text style={styles.shareCardStatText}>{currentSpecs.maxSpeed}</Text>
              </View>
            )}
            {currentSpecs?.power && (
              <View style={styles.shareCardStat}>
                <Ionicons name="flash" size={12} color={colors.accent} />
                <Text style={styles.shareCardStatText}>{currentSpecs.power}</Text>
              </View>
            )}
            {currentRarity.survivingCount && (
              <View style={styles.shareCardStat}>
                <Ionicons name="heart" size={12} color={colors.danger} />
                <Text style={styles.shareCardStatText}>
                  {currentRarity.survivingCount} left
                </Text>
              </View>
            )}
          </View>

          {/* Branding */}
          <View style={styles.shareCardBranding}>
            <Text style={styles.shareCardBrandingText}>LocoSnap</Text>
          </View>
        </View>
      </View>
```

**Step 2: Add styles for the hidden card**

Add these styles to the `StyleSheet.create({})` block at the bottom of the file:

```typescript
  // Hidden static card — used only for image export (Share + Save)
  shareCard: {
    position: "absolute",
    left: -9999,
    top: 0,
    width: 400,
    height: 580,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  shareCardPhotoArea: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
  },
  shareCardPhoto: {
    width: "100%",
    height: "100%",
  },
  shareCardPhotoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceLight,
  },
  shareCardRarityBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  shareCardRarityText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#fff",
    letterSpacing: 1,
  },
  shareCardNewBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#22c55e",
  },
  shareCardNewText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#fff",
    letterSpacing: 1,
  },
  shareCardDuplicateBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#0066FF",
  },
  shareCardDuplicateText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#fff",
  },
  shareCardInfoArea: {
    padding: 16,
    paddingTop: 12,
  },
  shareCardClass: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: colors.textPrimary,
  },
  shareCardName: {
    fontSize: 18,
    fontWeight: "600" as const,
    marginTop: 2,
  },
  shareCardMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  shareCardStatsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
  shareCardStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  shareCardStatText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500" as const,
  },
  shareCardBranding: {
    position: "absolute",
    bottom: 12,
    right: 16,
  },
  shareCardBrandingText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600" as const,
    letterSpacing: 1,
  },
```

**Step 3: Verify the file still compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 4: Commit**

```bash
git add frontend/app/card-reveal.tsx
git commit -m "feat(card-share): add hidden static ShareCard component for reliable image capture"
```

---

### Task 6: Update the action buttons row to three buttons

**Files:**
- Modify: `frontend/app/card-reveal.tsx` (action buttons JSX, around lines 530-548)
- Modify: `frontend/app/card-reveal.tsx` (StyleSheet — update `actionButtons` padding)

**Context:** Currently two buttons: [Share] [Full Details]. Becomes three: [Save] [Share] [Full Details]. All equal flex. Save uses `download-outline` icon. Loading states disable the buttons and swap icons.

**Step 1: Replace the action buttons JSX**

Find this block (around lines 530-548):
```tsx
      {/* Action buttons */}
      {revealComplete && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: rarityColor }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={() => router.push("/results")}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.actionBtnText}>Full Details</Text>
          </TouchableOpacity>
        </View>
      )}
```

Replace with:
```tsx
      {/* Action buttons */}
      {revealComplete && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: rarityColor }, isSaving && styles.actionBtnDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSaving ? "hourglass-outline" : "download-outline"}
              size={20}
              color={colors.textPrimary}
            />
            <Text style={styles.actionBtnText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: rarityColor }, isSharing && styles.actionBtnDisabled]}
            onPress={handleShare}
            disabled={isSharing}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSharing ? "hourglass-outline" : "share-outline"}
              size={20}
              color={colors.textPrimary}
            />
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={() => router.push("/results")}
            activeOpacity={0.7}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.actionBtnText}>Details</Text>
          </TouchableOpacity>
        </View>
      )}
```

**Step 2: Add actionBtnDisabled style**

Find the `actionBtn` style in `StyleSheet.create` and add after it:

```typescript
  actionBtnDisabled: {
    opacity: 0.5,
  },
```

**Step 3: Tighten the actionButtons padding** (three buttons need less horizontal padding than two)

Find:
```typescript
  actionButtons: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xxl,
  },
```

Replace with:
```typescript
  actionButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
```

**Step 4: Verify the file still compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

**Step 5: Commit**

```bash
git add frontend/app/card-reveal.tsx
git commit -m "feat(card-share): three-button action row — Save, Share, Details"
```

---

### Task 7: Run existing tests and verify nothing is broken

**Files:** No changes — verification only.

**Step 1: Run frontend tests**

```bash
cd frontend && npm test -- --passWithNoTests 2>&1 | tail -20
```

Expected: all existing tests pass. The new code is not unit-tested (it is UI/device behaviour) but the existing store and utility tests must still pass.

**Step 2: Run TypeScript check across the whole frontend**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Expected: no errors.

**Step 3: Manual verification checklist**

On a real device (not Expo Go — Expo Go cannot reliably use view-shot):

- [ ] Scan a train, arrive at card-reveal
- [ ] Three buttons visible: Save, Share, Details
- [ ] Tap Share — native share sheet opens with a PNG card image, not a .txt file
- [ ] Share text reads "Guess what I just spotted..." with location if GPS was on
- [ ] No emoji anywhere in share sheet
- [ ] Tap Save — permission prompt appears (first time), then card saves to Photos
- [ ] Tap Details — navigates to results screen as before
- [ ] Flip animation still works
- [ ] Particle effects still fire for rare+ trains
- [ ] Glow still pulses for rare+ trains
- [ ] Close button still goes to tabs home

**Step 4: Final commit**

```bash
git add frontend/app/card-reveal.tsx
git commit -m "feat(card-share): shareable card — reliable image export, save to gallery, location in share text"
```

---

## Summary of Changes

All changes are in one file: `frontend/app/card-reveal.tsx`

| Change | Why |
|--------|-----|
| Add `MediaLibrary` + `Location` imports | Required for save and reverse geocoding |
| Add `shareCardRef`, `locationName`, `isSaving`, `isSharing` state | Refs and state for new functions |
| Add reverse geocoding `useEffect` | City name for share text, 2s timeout |
| Replace `handleShare` | Fix broken capture — target static ref, no emoji, new text |
| Add `handleSave` | New save to gallery capability |
| Add hidden `ShareCard` JSX + styles | The actual reliable capture target |
| Update action buttons row | Three buttons, loading states, tighter padding |

No backend changes. No new dependencies. No navigation changes.
