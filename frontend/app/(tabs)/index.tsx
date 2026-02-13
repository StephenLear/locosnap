// ============================================================
// CarSnap — Home / Camera Screen
// The main scan screen where users take or select car photos
// ============================================================

import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCarStore } from "../../store/carStore";
import { identifyCar, pollInfographicStatus } from "../../services/api";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();
  const [cameraMode, setCameraMode] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const {
    isScanning,
    scanError,
    startScan,
    setScanResults,
    setScanError,
    setInfographicStatus,
    saveToHistory,
  } = useCarStore();

  // Pulse animation for the scan button
  React.useEffect(() => {
    if (!isScanning) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isScanning]);

  const handleScan = async (imageUri: string) => {
    startScan();

    try {
      const result = await identifyCar(imageUri);

      if (!result.success || !result.data) {
        setScanError(
          result.error || "Could not identify the car. Try a different photo."
        );
        return;
      }

      const { car, specs, reviews, infographic } = result.data;
      setScanResults(car, specs, reviews);
      saveToHistory();

      // Navigate to results
      router.push("/results");

      // Start polling for infographic in background
      if (infographic?.taskId) {
        const { promise } = pollInfographicStatus(
          infographic.taskId,
          (status) => {
            setInfographicStatus(status);
          }
        );
        promise.then(() => {
          // Infographic complete or failed — status already updated via callback
        });
      }
    } catch (error) {
      setScanError(
        (error as Error).message || "Something went wrong. Please try again."
      );
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      setPreviewUri(result.assets[0].uri);
      handleScan(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;

    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.8,
    });

    if (photo) {
      setCameraMode(false);
      setPreviewUri(photo.uri);
      handleScan(photo.uri);
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Camera Permission Required",
          "CarSnap needs camera access to identify cars. Please enable it in your device settings.",
          [{ text: "OK" }]
        );
        return;
      }
    }
    setCameraMode(true);
  };

  // ── Camera Mode ─────────────────────────────────────────
  if (cameraMode) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          {/* Viewfinder overlay */}
          <View style={styles.viewfinder}>
            <View style={styles.viewfinderCorner} />
            <Text style={styles.viewfinderText}>
              Point at a car and tap the shutter
            </Text>
          </View>

          {/* Camera controls */}
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cameraCancelBtn}
              onPress={() => setCameraMode(false)}
            >
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shutterBtn}
              onPress={takePhoto}
            >
              <View style={styles.shutterBtnInner} />
            </TouchableOpacity>

            <View style={{ width: 44 }} />
          </View>
        </CameraView>
      </View>
    );
  }

  // ── Main Home Screen ────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Hero area */}
      <View style={styles.hero}>
        {previewUri && isScanning ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: previewUri }} style={styles.previewImage} />
            <View style={styles.scanningOverlay}>
              <Animated.View
                style={[styles.scanRing, { transform: [{ scale: pulseAnim }] }]}
              >
                <ActivityIndicator size="large" color={colors.accent} />
              </Animated.View>
              <Text style={styles.scanningText}>Identifying car...</Text>
              <Text style={styles.scanningSubtext}>
                Analyzing make, model, and year
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <View style={styles.iconCircle}>
              <Ionicons
                name="car-sport"
                size={64}
                color={colors.accent}
              />
            </View>
            <Text style={styles.heroTitle}>Snap a Car</Text>
            <Text style={styles.heroSubtitle}>
              Take a photo or pick one from your library to instantly identify
              any car and get reviews + a technical infographic
            </Text>
          </View>
        )}
      </View>

      {/* Error display */}
      {scanError && (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle"
            size={20}
            color={colors.danger}
          />
          <Text style={styles.errorText}>{scanError}</Text>
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.cameraBtn]}
          onPress={openCamera}
          disabled={isScanning}
        >
          <Ionicons name="camera" size={28} color={colors.textPrimary} />
          <Text style={styles.actionBtnText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.galleryBtn]}
          onPress={pickImage}
          disabled={isScanning}
        >
          <Ionicons name="images" size={28} color={colors.textPrimary} />
          <Text style={styles.actionBtnText}>From Library</Text>
        </TouchableOpacity>
      </View>

      {/* Powered by badge */}
      <View style={styles.poweredBy}>
        <Text style={styles.poweredByText}>
          Powered by Claude Vision AI
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderContainer: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  heroTitle: {
    fontSize: fonts.sizes.hero,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  heroSubtitle: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  previewContainer: {
    width: SCREEN_WIDTH - 48,
    height: SCREEN_WIDTH - 48,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 15, 26, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  scanningText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  scanningSubtext: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorText: {
    flex: 1,
    fontSize: fonts.sizes.sm,
    color: colors.danger,
    marginLeft: spacing.sm,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  cameraBtn: {
    backgroundColor: colors.accent,
  },
  galleryBtn: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  actionBtnText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
  },
  poweredBy: {
    alignItems: "center",
    paddingBottom: spacing.lg,
  },
  poweredByText: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
  },

  // Camera mode
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
    justifyContent: "space-between",
  },
  viewfinder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  viewfinderCorner: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    borderWidth: 2,
    borderColor: "rgba(255, 107, 0, 0.6)",
    borderRadius: borderRadius.lg,
  },
  viewfinderText: {
    marginTop: spacing.lg,
    fontSize: fonts.sizes.sm,
    color: "rgba(255, 255, 255, 0.7)",
  },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingBottom: 40,
  },
  cameraCancelBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
});
