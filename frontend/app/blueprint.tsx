// ============================================================
// LocoSnap — Blueprint Viewer Screen
// Full-screen view of the generated engineering blueprint
// ============================================================

import React, { useState } from "react";
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
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Ionicons } from "@expo/vector-icons";
import { useTrainStore } from "../store/trainStore";
import { colors, fonts, spacing } from "../constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function BlueprintScreen() {
  const { blueprintStatus, currentTrain } = useTrainStore();
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const imageUrl = blueprintStatus?.imageUrl;

  if (!imageUrl || !currentTrain) {
    return (
      <View style={styles.emptyContainer}>
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
      }
    } catch (error) {
      Alert.alert("Error", "Could not share the image.");
      console.error("Share error:", error);
    }
  };

  return (
    <View style={styles.container}>
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
