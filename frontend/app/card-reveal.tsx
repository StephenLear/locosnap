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
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useTrainStore } from "../store/trainStore";
import { useAuthStore } from "../store/authStore";
import { RarityTier } from "../types";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import ParticleEffect from "../components/ParticleEffect";
import { track } from "../services/analytics";
import { submitWrongIdReport } from "../services/supabase";

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

// Card v2 — trading-card visual polish (frontend_backlog #12 — Steph
// 2026-04-24: "would be a bit better if it did look like a proper
// trading card and i would share it"). Thicker borders and stronger
// drop shadows on rarer tiers give the card the physical-collectable
// feel without needing a full holo/foil shader implementation.
const rarityBorderWidth: Record<RarityTier, number> = {
  common: 2,
  uncommon: 2,
  rare: 3,
  epic: 3.5,
  legendary: 4,
};
const rarityShadowIntensity: Record<RarityTier, { radius: number; opacity: number; elevation: number }> = {
  common: { radius: 6, opacity: 0.15, elevation: 4 },
  uncommon: { radius: 8, opacity: 0.2, elevation: 5 },
  rare: { radius: 12, opacity: 0.35, elevation: 8 },
  epic: { radius: 16, opacity: 0.45, elevation: 10 },
  legendary: { radius: 20, opacity: 0.55, elevation: 14 },
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
  const { t } = useTranslation();

  // History mode: when navigated with a `historyId` param, the card-reveal
  // screen renders an existing spot instead of the most-recent fresh scan.
  // Used by the history tab tap-to-open flow (frontend_backlog #10/#11).
  const { historyId } = useLocalSearchParams<{ historyId?: string }>();

  const {
    currentTrain: scanTrain,
    currentSpecs: scanSpecs,
    currentFacts: scanFacts,
    currentRarity: scanRarity,
    currentPhotoUri: scanPhotoUri,
    currentLocation: scanLocation,
    currentVerification: scanVerification,
    history,
  } = useTrainStore();

  const historyItem = useMemo(() => {
    if (!historyId) return null;
    return history.find((h) => h.id === historyId) ?? null;
  }, [historyId, history]);

  const isHistoryMode = !!historyItem;

  // Display source: history item if in history mode, fresh scan otherwise.
  // Aliased to the original names so the existing render code is unchanged.
  const currentTrain = historyItem?.train ?? scanTrain;
  const currentSpecs = historyItem?.specs ?? scanSpecs;
  const currentFacts = historyItem?.facts ?? scanFacts;
  const currentRarity = historyItem?.rarity ?? scanRarity;
  const currentPhotoUri = historyItem?.photoUri ?? scanPhotoUri;
  const currentLocation = isHistoryMode
    ? historyItem?.latitude != null && historyItem?.longitude != null
      ? { latitude: historyItem.latitude, longitude: historyItem.longitude }
      : null
    : scanLocation;

  // Card v2 P1.3 + P1.4 — verification tier + spottedAt for badge +
  // provenance block. History items preserve verificationTier / spottedAt
  // from when the spot was first scanned (per c289441). Fresh scans pull
  // from currentVerification; spottedAt = now.
  const displayVerificationTier = isHistoryMode
    ? historyItem?.verificationTier ?? null
    : scanVerification?.tier ?? null;
  const displaySpottedAt = isHistoryMode
    ? historyItem?.spottedAt ?? null
    : null; // Fresh scan — render relative "Just now" instead of a date

  const cardRef = useRef<View>(null);
  const cardBackRef = useRef<View>(null);

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
  const [saveConfirm, setSaveConfirm] = useState<string | null>(null);

  // Wrong-ID flow state. The "Wrong ID?" tap silently submits a report
  // and shows a confirmation Alert; "Help us fix this" opens a modal
  // for an optional user-supplied correct-class string.
  const session = useAuthStore((s) => s.session);
  const [wrongIdReported, setWrongIdReported] = useState(false);
  const [correctionModalVisible, setCorrectionModalVisible] = useState(false);
  const [correctionInput, setCorrectionInput] = useState("");
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);

  // Track card reveal on mount — distinct event for fresh scan vs history view.
  useEffect(() => {
    if (currentTrain && currentRarity) {
      track(isHistoryMode ? "history_card_viewed" : "card_revealed", {
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

  // Entrance animation — skipped in history mode (the card has already been
  // revealed once when it was originally scanned; replaying the slide/scale
  // intro on every re-open would feel repetitive).
  useEffect(() => {
    if (isHistoryMode) {
      slideAnim.setValue(0);
      scaleAnim.setValue(1);
      setRevealComplete(true);
      // Skip the rare+ glow pulse too — keep history view static.
      return;
    }

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

  // Prevent concurrent flips — native-driver animation + re-render can crash
  const flipInProgress = useRef(false);

  // Flip animation
  const handleFlip = () => {
    if (flipInProgress.current) return;
    flipInProgress.current = true;
    const toValue = isFlipped ? 0 : 1;
    track("card_flipped");
    Animated.spring(flipAnim, {
      toValue,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start(() => {
      flipInProgress.current = false;
    });
    setIsFlipped(!isFlipped);
  };

  // Capture whichever face is currently showing
  const captureCurrentFace = async (): Promise<string> => {
    const ref = isFlipped ? cardBackRef : cardRef;
    if (!ref.current) throw new Error("Card not ready");
    return captureRef(ref, { format: "png", quality: 1 });
  };

  // Share whichever card face is showing
  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);

    try {
      const uri = await captureCurrentFace();
      const shareText = locationName
        ? `Guess what I just spotted and added to my collection near ${locationName}. Identified with LocoSnap.`
        : "Guess what I just spotted and added to my collection. Identified with LocoSnap.";

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: shareText,
        });
      }

      track("card_shared", {
        train_class: currentTrain?.class,
        has_location: !!locationName,
        face: isFlipped ? "back" : "front",
      });
    } catch (error) {
      const msg = (error as Error).message ?? String(error);
      console.warn("Share failed:", msg);
      Alert.alert("Share failed", msg);
    } finally {
      setIsSharing(false);
    }
  };

  // Save whichever card face is showing to device gallery
  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Allow LocoSnap to save photos in Settings > Privacy > Photos.");
        setIsSaving(false);
        return;
      }

      const uri = await captureCurrentFace();
      await MediaLibrary.saveToLibraryAsync(uri);

      const label = isFlipped ? "Back card saved to Photos" : "Front card saved to Photos";
      setSaveConfirm(label);
      setTimeout(() => setSaveConfirm(null), 2500);

      track("card_saved", {
        train_class: currentTrain?.class,
        face: isFlipped ? "back" : "front",
      });
    } catch (error) {
      const msg = (error as Error).message ?? String(error);
      console.warn("Save failed:", msg);
      Alert.alert("Save failed", msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Wrong-ID flow handlers (#18).
  // First tap: silently log the report, then show a confirmation Alert
  // offering an optional secondary "Help us fix this" tap which opens
  // the correction modal.
  const handleWrongIdTap = () => {
    if (!currentTrain || wrongIdReported) return;
    setWrongIdReported(true);
    track("wrong_id_reported", {
      train_class: currentTrain.class,
      from: isHistoryMode ? "history" : "fresh-scan",
    });
    submitWrongIdReport({
      source: "card-wrong-id",
      returnedClass: currentTrain.class,
      returnedOperator: currentTrain.operator,
      returnedConfidence: currentTrain.confidence,
      spotId: historyItem?.id,
      userId: session?.user?.id,
    }).catch(() => {});
    Alert.alert(
      t("wrongId.loggedTitle"),
      t("wrongId.loggedBody"),
      [
        { text: "OK", style: "cancel" },
        {
          text: t("wrongId.helpFix"),
          onPress: () => {
            setCorrectionInput("");
            setCorrectionModalVisible(true);
          },
        },
      ]
    );
  };

  const handleSubmitCorrection = async () => {
    if (!currentTrain) return;
    const corrected = correctionInput.trim();
    if (!corrected) {
      setCorrectionModalVisible(false);
      return;
    }
    setCorrectionSubmitting(true);
    try {
      await submitWrongIdReport({
        source: "card-wrong-id",
        returnedClass: currentTrain.class,
        returnedOperator: currentTrain.operator,
        returnedConfidence: currentTrain.confidence,
        userCorrection: corrected,
        spotId: historyItem?.id,
        userId: session?.user?.id,
      });
      track("wrong_id_correction_submitted", {
        train_class: currentTrain.class,
        correction_length: corrected.length,
      });
    } finally {
      setCorrectionSubmitting(false);
      setCorrectionModalVisible(false);
      setSaveConfirm(t("wrongId.correctionThanks"));
      setTimeout(() => setSaveConfirm(null), 2500);
    }
  };

  // Interpolations for flip — memoised so they are not recreated on every
  // re-render (e.g. when setIsFlipped fires mid-animation). Recreating
  // interpolation objects while a native-driver animation is in flight
  // can cause a crash on Android.
  // IMPORTANT: these must stay above the early return below — hooks cannot
  // be called conditionally or after an early return (Rules of Hooks).
  const frontInterpolate = useMemo(() => flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "90deg", "180deg"],
  }), []);
  const backInterpolate = useMemo(() => flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["180deg", "270deg", "360deg"],
  }), []);
  const frontOpacity = useMemo(() => flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  }), []);
  const backOpacity = useMemo(() => flipAnim.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  }), []);

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
      <ParticleEffect
        tier={currentRarity.tier}
        trigger={revealComplete}
        firstOfClass={isNewClass}
      />

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
                  {
                    borderColor: rarityColor,
                    borderWidth: rarityBorderWidth[currentRarity.tier],
                    shadowColor: rarityColor,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: rarityShadowIntensity[currentRarity.tier].opacity,
                    shadowRadius: rarityShadowIntensity[currentRarity.tier].radius,
                    elevation: rarityShadowIntensity[currentRarity.tier].elevation,
                  },
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

                {/* Card v2 P1.3 — Verified / Personal badge.
                    Only renders when displayVerificationTier is non-null
                    (older clients pre-v1.0.21 get no badge). Positioned
                    bottom-left of the photo area to balance the rarity
                    badge top-right. */}
                {displayVerificationTier && (
                  <View
                    style={[
                      styles.verifiedBadge,
                      displayVerificationTier === "unverified"
                        ? styles.verifiedBadgePersonal
                        : styles.verifiedBadgeVerified,
                    ]}
                  >
                    <Ionicons
                      name={
                        displayVerificationTier === "unverified"
                          ? "image-outline"
                          : "checkmark-circle"
                      }
                      size={12}
                      color="#fff"
                    />
                    <Text style={styles.verifiedBadgeText}>
                      {displayVerificationTier === "unverified"
                        ? t("card.badge.personal")
                        : t("card.badge.verified")}
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

                {/* Card v2 P1.4 — Provenance row.
                    Renders {locationName ?? "Unknown location"} · {date}
                    when displaySpottedAt is set (history mode), or "Just now"
                    on a fresh scan. Reverse-geocoded place name from
                    locationName state (set in the existing useEffect at the
                    top of the component); falls back to coords or empty
                    string. Skipped entirely when neither is available. */}
                {(displaySpottedAt || locationName || currentLocation) && (
                  <Text style={styles.cardProvenance} numberOfLines={1}>
                    {locationName ?? (currentLocation
                      ? `${currentLocation.latitude.toFixed(2)}, ${currentLocation.longitude.toFixed(2)}`
                      : null)}
                    {(locationName || currentLocation) && (displaySpottedAt || !isHistoryMode) ? " · " : ""}
                    {displaySpottedAt
                      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(displaySpottedAt))
                      : !isHistoryMode
                      ? t("card.provenance.justNow")
                      : ""}
                  </Text>
                )}

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
                ref={cardBackRef}
                collapsable={false}
                style={[
                  styles.card,
                  styles.cardBack,
                  {
                    borderColor: rarityColor,
                    borderWidth: rarityBorderWidth[currentRarity.tier],
                    shadowColor: rarityColor,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: rarityShadowIntensity[currentRarity.tier].opacity,
                    shadowRadius: rarityShadowIntensity[currentRarity.tier].radius,
                    elevation: rarityShadowIntensity[currentRarity.tier].elevation,
                  },
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
                    <Text style={styles.backSummaryText} numberOfLines={2}>
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

                {/* Card v2 P2.6 — Compare button.
                    Navigates to the history tab where the user can use
                    the existing compare-mode toggle to pick a second
                    card. The just-scanned card sits at the top of
                    history so the picking flow is short. */}
                <TouchableOpacity
                  style={styles.cardCompareBtn}
                  onPress={() => {
                    track("compare_button_tapped", { source: "card_back" });
                    router.push("/(tabs)/history");
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="swap-horizontal" size={14} color={colors.accent} />
                  <Text style={styles.cardCompareBtnText}>
                    Compare with another
                  </Text>
                </TouchableOpacity>

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

      {/* Tap to flip hint / save confirmation */}
      {revealComplete && (
        <Text style={[styles.flipHint, saveConfirm ? styles.saveConfirmText : null]}>
          {saveConfirm ?? (isFlipped ? "Tap to see front" : "Tap to flip")}
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
            <Text style={styles.actionBtnText}>{isFlipped ? "Save back" : "Save front"}</Text>
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

      {/* Wrong-ID report link — discreet text-only button below the main
          actions. Becomes a muted "Reported" label after the user taps it
          to prevent duplicate submissions in the same screen view. */}
      {revealComplete && (
        <TouchableOpacity
          style={styles.wrongIdLink}
          onPress={handleWrongIdTap}
          disabled={wrongIdReported}
          activeOpacity={0.6}
          accessibilityLabel={t("wrongId.button")}
        >
          <Text
            style={[
              styles.wrongIdLinkText,
              wrongIdReported && styles.wrongIdLinkTextReported,
            ]}
          >
            {wrongIdReported ? t("wrongId.loggedTitle") : t("wrongId.button")}
          </Text>
        </TouchableOpacity>
      )}

      {/* Correction modal — opens from the "Help us fix this" button on the
          confirmation Alert. Optional input. Empty submission is treated as
          a skip (modal closes without a second insert). */}
      <Modal
        visible={correctionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCorrectionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t("wrongId.helpFix")}</Text>
            <TextInput
              style={styles.modalInput}
              value={correctionInput}
              onChangeText={setCorrectionInput}
              placeholder={t("wrongId.correctionPlaceholder")}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={60}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setCorrectionModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>{t("wrongId.correctionCancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, correctionSubmitting && styles.modalSaveBtnDisabled]}
                onPress={handleSubmitCorrection}
                disabled={correctionSubmitting}
              >
                {correctionSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSaveText}>{t("wrongId.correctionSubmit")}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  // Card v2 P1.3 — Verified / Personal badge styles
  verifiedBadge: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  verifiedBadgeVerified: {
    backgroundColor: colors.success,
  },
  verifiedBadgePersonal: {
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  verifiedBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: "#fff",
    letterSpacing: 1,
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
  cardProvenance: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: "italic",
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
  cardCompareBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: "auto",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  cardCompareBtnText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    color: colors.accent,
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
  saveConfirmText: {
    color: colors.accent,
    fontWeight: fonts.weights.semibold,
  },
  // Wrong-ID flow
  wrongIdLink: {
    alignSelf: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  wrongIdLinkText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    textDecorationLine: "underline",
  },
  wrongIdLinkTextReported: {
    textDecorationLine: "none",
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    marginBottom: spacing.md,
  },
  modalInput: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(255, 255, 255, 0.12)",
    borderWidth: 1,
    borderRadius: borderRadius.md,
    color: colors.textPrimary,
    fontSize: fonts.sizes.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  modalCancelBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },
  modalSaveBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent,
  },
  modalSaveBtnDisabled: {
    opacity: 0.6,
  },
  modalSaveText: {
    color: "#fff",
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },

});
