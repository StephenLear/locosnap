// ============================================================
// LocoSnap — Blueprint Viewer Screen
// Full-screen view of the generated engineering blueprint
// Supports portrait and landscape with pinch-to-zoom and pan
// ============================================================

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import * as ScreenOrientation from "expo-screen-orientation";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTrainStore } from "../store/trainStore";
import { useAuthStore } from "../store/authStore";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";
import { track } from "../services/analytics";

export default function BlueprintScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { blueprintStatus, currentTrain } = useTrainStore();
  const { profile, isGuest } = useAuthStore();
  const isPro = profile?.is_pro ?? false;
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageUrl = blueprintStatus?.imageUrl;

  // ── Pinch-to-zoom + pan shared values ──────────────────────
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset zoom/pan when orientation changes
  useEffect(() => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [width, height]);

  // Unlock rotation when this screen mounts, lock back to portrait on unmount
  useEffect(() => {
    ScreenOrientation.unlockAsync();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // Track blueprint view on mount
  useEffect(() => {
    if (imageUrl && currentTrain) {
      track("blueprint_viewed", { train_class: currentTrain.class });
    }
  }, []);

  // ── Gesture handlers ───────────────────────────────────────
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1.05) {
        // Snap back to 1x if barely zoomed
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      if (scale.value > 1.05) {
        // Zoom out to 1x
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in to 2.5x
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // ── Calculate image dimensions to fit available space ──────
  // Reserve space for label bar (~40px) and action bar (~70px)
  const bottomBarsHeight = 110;
  const availableWidth = width;
  const availableHeight = height - insets.top - bottomBarsHeight;

  // Image is 9:16 aspect ratio — fit it within the available space
  const imageAspect = 9 / 16;
  let imageWidth: number;
  let imageHeight: number;

  if (availableWidth / availableHeight < imageAspect) {
    // Available space is narrower than image — fit to width
    imageWidth = availableWidth;
    imageHeight = availableWidth / imageAspect;
  } else {
    // Available space is wider than image — fit to height
    imageHeight = availableHeight;
    imageWidth = availableHeight * imageAspect;
  }

  // Pro gate: block non-Pro users UNLESS they have a blueprint ready (credit purchase)
  const hasBlueprintReady = blueprintStatus?.status === "completed" && blueprintStatus?.imageUrl;
  if (!isPro && !isGuest && !hasBlueprintReady) {
    return (
      <View style={styles.emptyContainer}>
        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 10 }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.proGateBadge}>
          <Ionicons name="lock-closed" size={28} color="#f59e0b" />
          <Text style={styles.proGateTitle}>Pro Feature</Text>
        </View>
        <Text style={styles.proGateText}>
          Technical blueprints are available with LocoSnap Pro.
          Upgrade for unlimited scans and engineering-style drawings.
        </Text>
        <TouchableOpacity
          style={[styles.proGateBtn, { backgroundColor: colors.accent, marginBottom: spacing.md }]}
          onPress={() => router.push("/paywall?source=blueprint")}
        >
          <Text style={styles.proGateBtnText}>Upgrade to Pro</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.proGateBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.proGateBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!imageUrl || !currentTrain) {
    return (
      <View style={styles.emptyContainer}>
        <TouchableOpacity
          style={[styles.closeBtnLight, { top: insets.top + 10 }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Ionicons name="image-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyText}>No blueprint available</Text>
      </View>
    );
  }

  const trainLabel = `${currentTrain.class}${currentTrain.name ? ` "${currentTrain.name}"` : ""} — ${currentTrain.operator}`;

  const saveToGallery = async () => {
    try {
      setSaving(true);

      // Request permission
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to save images to your photo library."
        );
        return;
      }

      // Download the image
      const filename = `LocoSnap_${currentTrain.class.replace(/\s+/g, "_")}_${currentTrain.operator.replace(/\s+/g, "_")}.png`;
      const fileUri = FileSystem.documentDirectory + filename;

      const download = await FileSystem.downloadAsync(imageUrl, fileUri);

      // Save to gallery
      await MediaLibrary.saveToLibraryAsync(download.uri);
      track("blueprint_saved", { train_class: currentTrain.class });

      Alert.alert("Saved!", "Blueprint saved to your photo library.");
    } catch (error) {
      Alert.alert("Error", "Could not save the image. Please try again.");
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  const shareBlueprint = async () => {
    try {
      const filename = `LocoSnap_${currentTrain.class.replace(/\s+/g, "_")}_${currentTrain.operator.replace(/\s+/g, "_")}.png`;
      const fileUri = FileSystem.documentDirectory + filename;

      // Download first
      await FileSystem.downloadAsync(imageUrl, fileUri);

      // Share
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "image/png",
          dialogTitle: `${currentTrain.class} — LocoSnap Blueprint`,
        });
        track("blueprint_shared", { train_class: currentTrain.class });
      }
    } catch (error) {
      Alert.alert("Error", "Could not share the image.");
      console.error("Share error:", error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Close button — uses safe area insets so it's always visible */}
      <TouchableOpacity
        style={[styles.closeBtn, { top: insets.top + 10 }]}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={24} color="#000" />
      </TouchableOpacity>

      {/* Zoomable/pannable image — pinch to zoom, drag to pan, double-tap to toggle */}
      <View style={[styles.imageArea, { paddingTop: insets.top }]}>
        {!imageLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading blueprint...</Text>
          </View>
        )}
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.imageWrapper, animatedImageStyle]}>
            <Image
              source={{ uri: imageUrl }}
              style={{
                width: imageWidth,
                height: imageHeight,
              }}
              resizeMode="contain"
              onLoad={() => setImageLoaded(true)}
            />
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Train label */}
      <View style={styles.labelBar}>
        <Text style={styles.labelText} numberOfLines={1}>{trainLabel}</Text>
      </View>

      {/* Action buttons */}
      <View style={[
        styles.actionsBar,
        { paddingBottom: Math.max(insets.bottom, 16) },
      ]}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={saveToGallery}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <Ionicons
              name="download-outline"
              size={22}
              color={colors.textPrimary}
            />
          )}
          <Text style={styles.actionBtnText}>
            {saving ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={shareBlueprint}>
          <Ionicons
            name="share-outline"
            size={22}
            color={colors.textPrimary}
          />
          <Text style={styles.actionBtnText}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  emptyText: {
    fontSize: fonts.sizes.lg,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
  proGateBadge: {
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  proGateTitle: {
    fontSize: fonts.sizes.xl,
    fontWeight: "700",
    color: "#f59e0b",
    letterSpacing: 1,
  },
  proGateText: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.xl,
  },
  proGateBtn: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  proGateBtnText: {
    fontSize: fonts.sizes.md,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  closeBtn: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnLight: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  imageWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  loadingText: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  labelBar: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: "rgba(26, 37, 64, 0.9)",
  },
  labelText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
    textAlign: "center",
  },
  actionsBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xxl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  actionBtn: {
    alignItems: "center",
    gap: 4,
  },
  actionBtnText: {
    fontSize: fonts.sizes.xs,
    color: colors.textPrimary,
    fontWeight: fonts.weights.medium,
  },
});
