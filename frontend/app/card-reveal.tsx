// ============================================================
// LocoSnap — Card Reveal Screen
// Animated collectible card with flip animation
// Front: photo + class + rarity. Back: specs + fun fact.
// Shows "NEW!" badge for first-of-class or "Spotted again!"
// for duplicates with existing spot count.
// ============================================================

import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTrainStore } from "../store/trainStore";
import { RarityTier } from "../types";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import ParticleEffect from "../components/ParticleEffect";
import * as FileSystem from "expo-file-system/legacy";
import { track } from "../services/analytics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// Cap card width on web/desktop to avoid a massive pixelated card
const MAX_CARD_WIDTH = 380;
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 64, MAX_CARD_WIDTH);
const CARD_HEIGHT = CARD_WIDTH * 1.45;

// ── Rarity config ───────────────────────────────────────
const rarityColors: Record<RarityTier, string> = {
  common: "#94a3b8",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

const rarityLabels: Record<RarityTier, string> = {
  common: "COMMON",
  uncommon: "UNCOMMON",
  rare: "RARE",
  epic: "EPIC",
  legendary: "LEGENDARY",
};

const rarityEmoji: Record<RarityTier, string> = {
  common: "",
  uncommon: "",
  rare: "",
  epic: "",
  legendary: "",
};

export default function CardRevealScreen() {
  const router = useRouter();
  const {
    currentTrain,
    currentSpecs,
    currentFacts,
    currentRarity,
    currentPhotoUri,
    currentLocation,
    history,
  } = useTrainStore();

  const cardRef = useRef<View>(null);
  const shareCardRef = useRef<View>(null);

  // Check if this is a new class or a duplicate
  const { isNewClass, existingSpotCount } = useMemo(() => {
    if (!currentTrain) return { isNewClass: true, existingSpotCount: 0 };

    const matchingSpots = history.filter(
      (h) =>
        h.train.class === currentTrain.class &&
        h.train.operator === currentTrain.operator
    );
    // If the train was just saved (spot count includes current), subtract 1
    // to get the "previous" count — but if 0, this is genuinely new
    const count = matchingSpots.length;
    return {
      isNewClass: count <= 1, // 0 or 1 (just the current spot)
      existingSpotCount: count,
    };
  }, [currentTrain, history]);

  // Animations
  const flipAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;


  const [isFlipped, setIsFlipped] = useState(false);
  const [revealComplete, setRevealComplete] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  // Track card reveal on mount
  useEffect(() => {
    if (currentTrain && currentRarity) {
      track("card_revealed", {
        train_class: currentTrain.class,
        rarity: currentRarity.tier,
        is_new_class: isNewClass,
      });
    }
  }, []);

  // Reverse-geocode stored location to a readable city name for share text
  useEffect(() => {
    if (!currentLocation) return;

    const timeout = setTimeout(() => setLocationName(null), 2000);

    Location.reverseGeocodeAsync(
      { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
    )
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

  // Entrance animation
  useEffect(() => {
    // Stage 1: Slide up + scale in
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setRevealComplete(true);

      // Stage 2: Glow pulse for rare+
      if (
        currentRarity &&
        ["rare", "epic", "legendary"].includes(currentRarity.tier)
      ) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: false,
            }),
            Animated.timing(glowAnim, {
              toValue: 0,
              duration: 1500,
              useNativeDriver: false,
            }),
          ])
        ).start();
      }

    });
  }, []);

  // Flip animation
  const handleFlip = () => {
    const toValue = isFlipped ? 0 : 1;
    track("card_flipped");
    Animated.spring(flipAnim, {
      toValue,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
  };

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

  if (!currentTrain || !currentRarity) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No train data</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.emptyLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rarityColor = rarityColors[currentRarity.tier];

  // Interpolations for flip
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "90deg", "180deg"],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["180deg", "270deg", "360deg"],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  // Glow interpolation
  const glowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <View style={styles.container}>
      {/* Close / back button */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => router.replace("/(tabs)")}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={28} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Particle effects for Rare+ */}
      <ParticleEffect tier={currentRarity.tier} trigger={revealComplete} />

      {/* Rarity tier announcement */}
      {revealComplete && (
        <Animated.View
          style={[
            styles.tierAnnouncement,
            { opacity: scaleAnim },
          ]}
        >
          <Text style={[styles.tierText, { color: rarityColor }]}>
            {rarityEmoji[currentRarity.tier]} {rarityLabels[currentRarity.tier]} {rarityEmoji[currentRarity.tier]}
          </Text>
          {isNewClass ? (
            <Text style={styles.tierSubtext}>New class added to your shed!</Text>
          ) : existingSpotCount > 1 ? (
            <Text style={styles.tierSubtextDuplicate}>
              Spotted again! ×{existingSpotCount} total
            </Text>
          ) : null}
        </Animated.View>
      )}

      {/* Card with flip animation */}
      <Animated.View
        style={[
          styles.cardWrapper,
          {
            transform: [
              { translateY: slideAnim },
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={handleFlip}
          style={styles.cardTouchable}
        >
          {/* FRONT of card */}
          {/* Outer Animated.View: flip transform only (native driver) */}
          <Animated.View
            style={[
              styles.cardGlowWrapper,
              {
                transform: [{ rotateY: frontInterpolate }],
                opacity: frontOpacity,
              },
            ]}
          >
            {/* Inner Animated.View: glow only (JS driver) */}
            <Animated.View
              style={{
                shadowColor: rarityColor,
                shadowRadius: glowRadius as any,
                shadowOpacity: glowOpacity as any,
                shadowOffset: { width: 0, height: 8 },
                elevation: 12,
              }}
            >
              <View
                ref={cardRef}
                style={[
                  styles.card,
                  styles.cardFront,
                  { borderColor: rarityColor },
                ]}
                collapsable={false}
              >
              {/* Photo area */}
              <View style={styles.cardPhotoArea}>
                {currentPhotoUri ? (
                  <Image
                    source={{ uri: currentPhotoUri }}
                    style={styles.cardPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.cardPhotoPlaceholder}>
                    <Ionicons name="train" size={64} color={rarityColor} />
                  </View>
                )}

                {/* Rarity badge overlay */}
                <View
                  style={[
                    styles.rarityOverlay,
                    { backgroundColor: rarityColor },
                  ]}
                >
                  <Ionicons name="diamond" size={12} color="#fff" />
                  <Text style={styles.rarityOverlayText}>
                    {rarityLabels[currentRarity.tier]}
                  </Text>
                </View>

                {/* NEW! badge for first-of-class */}
                {isNewClass && (
                  <View style={styles.newBadge}>
                    <Ionicons name="sparkles" size={12} color="#fff" />
                    <Text style={styles.newBadgeText}>NEW!</Text>
                  </View>
                )}

                {/* Duplicate badge */}
                {!isNewClass && existingSpotCount > 1 && (
                  <View style={styles.duplicateBadge}>
                    <Ionicons name="camera" size={12} color="#fff" />
                    <Text style={styles.duplicateBadgeText}>
                      Spotted ×{existingSpotCount}
                    </Text>
                  </View>
                )}
              </View>

              {/* Card info area */}
              <View style={styles.cardInfoArea}>
                <Text style={styles.cardClass} numberOfLines={1}>
                  {currentTrain.class}
                </Text>
                {currentTrain.name && (
                  <Text style={[styles.cardName, { color: rarityColor }]} numberOfLines={1}>
                    "{currentTrain.name}"
                  </Text>
                )}
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {currentTrain.operator} · {currentTrain.type}
                </Text>

                {/* Mini stats row */}
                <View style={styles.cardStatsRow}>
                  {currentSpecs?.maxSpeed && (
                    <View style={styles.cardStat}>
                      <Ionicons name="speedometer" size={12} color={colors.accent} />
                      <Text style={styles.cardStatText}>{currentSpecs.maxSpeed}</Text>
                    </View>
                  )}
                  {currentSpecs?.power && (
                    <View style={styles.cardStat}>
                      <Ionicons name="flash" size={12} color={colors.accent} />
                      <Text style={styles.cardStatText}>{currentSpecs.power}</Text>
                    </View>
                  )}
                  {currentRarity.survivingCount && (
                    <View style={styles.cardStat}>
                      <Ionicons name="heart" size={12} color={colors.danger} />
                      <Text style={styles.cardStatText}>
                        {currentRarity.survivingCount} left
                      </Text>
                    </View>
                  )}
                </View>

                {/* LocoSnap branding */}
                <View style={styles.cardBranding}>
                  <Text style={styles.cardBrandingText}>LocoSnap</Text>
                </View>
              </View>
              </View>
            </Animated.View>
          </Animated.View>

          {/* BACK of card */}
          {/* Outer Animated.View: flip transform only (native driver) */}
          <Animated.View
            style={[
              styles.cardGlowWrapper,
              {
                transform: [{ rotateY: backInterpolate }],
                opacity: backOpacity,
              },
            ]}
          >
            {/* Inner Animated.View: glow only (JS driver) */}
            <Animated.View
              style={{
                shadowColor: rarityColor,
                shadowRadius: glowRadius as any,
                shadowOpacity: glowOpacity as any,
                shadowOffset: { width: 0, height: 8 },
                elevation: 12,
              }}
            >
              <View
                style={[
                  styles.card,
                  styles.cardBack,
                  { borderColor: rarityColor },
                ]}
              >
              <View style={styles.cardBackContent}>
                {/* Specs */}
                <Text style={[styles.backTitle, { color: rarityColor }]}>
                  Specifications
                </Text>

                <View style={styles.backSpecsGrid}>
                  {currentSpecs?.maxSpeed && (
                    <BackSpec label="Max Speed" value={currentSpecs.maxSpeed} />
                  )}
                  {currentSpecs?.power && (
                    <BackSpec label="Power" value={currentSpecs.power} />
                  )}
                  {currentSpecs?.weight && (
                    <BackSpec label="Weight" value={currentSpecs.weight} />
                  )}
                  {currentSpecs?.builder && (
                    <BackSpec label="Builder" value={currentSpecs.builder} />
                  )}
                  {currentSpecs?.gauge && (
                    <BackSpec label="Gauge" value={currentSpecs.gauge} />
                  )}
                  {currentSpecs?.fuelType && (
                    <BackSpec label="Fuel" value={currentSpecs.fuelType} />
                  )}
                </View>

                {/* Summary */}
                {currentFacts?.summary && (
                  <View style={styles.backSummary}>
                    <Text style={styles.backSummaryText} numberOfLines={3}>
                      {currentFacts.summary}
                    </Text>
                  </View>
                )}

                {/* Fun fact */}
                {currentFacts?.funFacts[0] && (
                  <View style={styles.backFunFact}>
                    <Ionicons name="bulb" size={14} color={colors.accent} />
                    <Text style={styles.backFunFactText} numberOfLines={3}>
                      {currentFacts.funFacts[0]}
                    </Text>
                  </View>
                )}

                {/* LocoSnap branding */}
                <View style={styles.cardBranding}>
                  <Text style={styles.cardBrandingText}>LocoSnap</Text>
                </View>
              </View>
              </View>
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

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

      {/* Tap to flip hint */}
      {revealComplete && (
        <Text style={styles.flipHint}>
          {isFlipped ? "Tap to see front" : "Tap to flip"}
        </Text>
      )}

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
    </View>
  );
}

// ── Back spec helper ────────────────────────────────────
function BackSpec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.backSpecItem}>
      <Text style={styles.backSpecLabel}>{label}</Text>
      <Text style={styles.backSpecValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    position: "absolute",
    top: 54,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: fonts.sizes.lg,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  emptyLink: {
    fontSize: fonts.sizes.md,
    color: colors.primary,
  },

  // Tier announcement
  tierAnnouncement: {
    position: "absolute",
    top: 60,
    alignItems: "center",
  },
  tierText: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    letterSpacing: 4,
  },
  tierSubtext: {
    fontSize: fonts.sizes.sm,
    color: colors.success,
    fontWeight: fonts.weights.semibold,
    marginTop: spacing.xs,
  },
  tierSubtextDuplicate: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    fontWeight: fonts.weights.medium,
    marginTop: spacing.xs,
  },

  // Card wrapper
  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  cardTouchable: {
    width: "100%",
    height: "100%",
    transform: [{ perspective: 1000 }],
  },

  // Card base
  cardGlowWrapper: {
    position: "absolute",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
  },
  cardFront: {
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  cardBack: {
    backgroundColor: colors.surface,
    overflow: "hidden",
  },

  // Front — Photo area
  cardPhotoArea: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
  },
  cardPhoto: {
    width: "100%",
    height: "100%",
  },
  cardPhotoPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceLight,
  },
  rarityOverlay: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  rarityOverlayText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: "#fff",
    letterSpacing: 1,
  },
  newBadge: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.success,
  },
  newBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: "#fff",
    letterSpacing: 1,
  },
  duplicateBadge: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  duplicateBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: "#fff",
  },

  // Front — Info area
  cardInfoArea: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  cardClass: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
  },
  cardName: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.semibold,
    marginTop: 2,
  },
  cardMeta: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  cardStatsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  cardStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardStatText: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    fontWeight: fonts.weights.medium,
  },
  cardBranding: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.lg,
  },
  cardBrandingText: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    fontWeight: fonts.weights.semibold,
    letterSpacing: 1,
  },

  // Back content
  cardBackContent: {
    flex: 1,
    padding: spacing.xl,
  },
  backTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  backSpecsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  backSpecItem: {
    width: "47%",
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
  },
  backSpecLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: fonts.weights.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  backSpecValue: {
    fontSize: fonts.sizes.sm,
    color: colors.textPrimary,
    fontWeight: fonts.weights.semibold,
    marginTop: 2,
  },
  backSummary: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  backSummaryText: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  backFunFact: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: "rgba(0, 212, 170, 0.08)",
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0, 212, 170, 0.15)",
  },
  backFunFactText: {
    fontSize: fonts.sizes.sm,
    color: colors.textPrimary,
    lineHeight: 20,
    flex: 1,
  },

  // Flip hint
  flipHint: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },

  // Action buttons
  actionButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actionBtnText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
  },

  // Hidden static card — used only for image export (Share + Save)
  shareCard: {
    position: "absolute",
    top: 0,
    left: 0,
    transform: [{ translateX: -9999 }],
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
});
