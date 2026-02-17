// ============================================================
// LocoSnap — Blueprint Viewer Screen
// Full-screen view of the generated engineering blueprint
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
  Dimensions,
} from "react-native";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTrainStore } from "../store/trainStore";
import { useAuthStore } from "../store/authStore";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";
import { track } from "../services/analytics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function BlueprintScreen() {
  const router = useRouter();
  const { blueprintStatus, currentTrain } = useTrainStore();
  const { profile, isGuest } = useAuthStore();
  const isPro = profile?.is_pro ?? false;
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageUrl = blueprintStatus?.imageUrl;

  // Track blueprint view on mount
  useEffect(() => {
    if (imageUrl && currentTrain) {
      track("blueprint_viewed", { train_class: currentTrain.class });
    }
  }, []);

  // Pro gate: block non-Pro users UNLESS they have a blueprint ready (credit purchase)
  const hasBlueprintReady = blueprintStatus?.status === "completed" && blueprintStatus?.imageUrl;
  if (!isPro && !isGuest && !hasBlueprintReady) {
    return (
      <View style={styles.emptyContainer}>
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
          style={styles.closeBtnLight}
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
      {/* Close button */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={24} color={colors.textPrimary} />
      </TouchableOpacity>

      {/* Image container with loading state */}
      <View style={styles.imageContainer}>
        {!imageLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading blueprint...</Text>
          </View>
        )}
        <Image
          source={{ uri: imageUrl }}
          style={styles.blueprintImage}
          resizeMode="contain"
          onLoad={() => setImageLoaded(true)}
        />
      </View>

      {/* Train label */}
      <View style={styles.labelBar}>
        <Text style={styles.labelText}>{trainLabel}</Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsBar}>
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
    top: 54,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnLight: {
    position: "absolute",
    top: 54,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageContainer: {
    flex: 1,
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
  blueprintImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
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
    paddingVertical: spacing.lg,
    paddingBottom: 40,
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
