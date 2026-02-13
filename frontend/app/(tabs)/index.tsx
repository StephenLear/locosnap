// ============================================================
// LocoSnap — Home / Camera Screen
// The main spot screen where users take or select train photos
// Includes daily scan limit check + photo URI tracking
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
import * as Location from "expo-location";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTrainStore } from "../../store/trainStore";
import { useAuthStore } from "../../store/authStore";
import { identifyTrain, pollBlueprintStatus } from "../../services/api";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";
import { track, captureError, addBreadcrumb } from "../../services/analytics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MAX_DAILY_SCANS = 5;

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
    setBlueprintStatus,
    setPhotoUri,
    setLocation,
    saveToHistory,
  } = useTrainStore();

  const { canScan, profile, isGuest, user } = useAuthStore();

  const scansRemaining = isGuest || profile?.is_pro
    ? null
    : MAX_DAILY_SCANS - (profile?.daily_scans_used ?? 0);

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

  const startBlueprintPoll = (taskId?: string) => {
    if (taskId) {
      const { promise } = pollBlueprintStatus(taskId, (status) => {
        setBlueprintStatus(status);
      });
      promise.then(() => {
        // Blueprint complete or failed — status already updated via callback
      });
    }
  };

  const handleScan = async (imageUri: string) => {
    // Check daily scan limit
    if (!canScan()) {
      track("daily_limit_hit");
      Alert.alert(
        "Daily Limit Reached",
        "You've used all 5 free scans today. Upgrade to Pro for unlimited scans!",
        [
          { text: "Maybe Later", style: "cancel" },
          { text: "Upgrade to Pro", onPress: () => router.push("/paywall?source=daily_limit") },
        ]
      );
      return;
    }

    startScan();
    track("scan_started");
    addBreadcrumb("scan", "Scan started");
    setPhotoUri(imageUri);

    // Capture GPS location (non-blocking — don't fail scan if location unavailable)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    } catch {
      // Location unavailable — continue without it
      setLocation(null);
    }

    try {
      const { selectedBlueprintStyle } = useTrainStore.getState();
      const result = await identifyTrain(imageUri, selectedBlueprintStyle);

      if (!result.success || !result.data) {
        track("scan_failed", { error: result.error || "unknown" });
        setScanError(
          result.error || "Could not identify the train. Try a different photo."
        );
        return;
      }

      const { train, specs, facts, rarity, blueprint } = result.data;

      // Low confidence: ask user to confirm before saving
      if (train.confidence < 70) {
        Alert.alert(
          "Not 100% Sure",
          `Is this a ${train.class} (${train.operator})?\n\nConfidence: ${train.confidence}%`,
          [
            {
              text: "No, retry",
              style: "cancel",
              onPress: () => {
                setScanError("Try a clearer photo or different angle");
              },
            },
            {
              text: "Yes, that's right",
              onPress: () => {
                setScanResults(train, specs, facts, rarity);
                saveToHistory();
                router.push("/card-reveal");
                startBlueprintPoll(blueprint?.taskId);
              },
            },
          ]
        );
        return;
      }

      setScanResults(train, specs, facts, rarity);
      track("scan_completed", {
        train_class: train.class,
        operator: train.operator,
        rarity: rarity.tier,
        confidence: train.confidence,
      });
      saveToHistory();

      // Navigate to card reveal (animated collectible card)
      router.push("/card-reveal");

      // Start polling for blueprint in background
      startBlueprintPoll(blueprint?.taskId);
    } catch (error) {
      track("scan_failed", { error: (error as Error).message });
      captureError(error as Error, { context: "handleScan" });
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
          "LocoSnap needs camera access to identify trains. Please enable it in your device settings.",
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
              Point at a train and tap the shutter
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
      {/* Daily scan counter */}
      {scansRemaining !== null && (
        <View style={styles.scanCounter}>
          <Ionicons
            name="flash"
            size={14}
            color={scansRemaining > 0 ? colors.accent : colors.danger}
          />
          <Text
            style={[
              styles.scanCounterText,
              scansRemaining === 0 && styles.scanCounterExhausted,
            ]}
          >
            {scansRemaining > 0
              ? `${scansRemaining} scan${scansRemaining !== 1 ? "s" : ""} remaining today`
              : "No scans remaining today"}
          </Text>
        </View>
      )}

      {/* Guest mode badge */}
      {isGuest && (
        <TouchableOpacity
          style={styles.guestBadge}
          onPress={() => router.push("/sign-in")}
        >
          <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
          <Text style={styles.guestBadgeText}>
            Guest mode — sign in to save to cloud
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      )}

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
              <Text style={styles.scanningText}>Identifying train...</Text>
              <Text style={styles.scanningSubtext}>
                Analysing class, operator, and rarity
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <View style={styles.iconCircle}>
              <Ionicons
                name="train"
                size={64}
                color={colors.accent}
              />
            </View>
            <Text style={styles.heroTitle}>Spot a Train</Text>
            <Text style={styles.heroSubtitle}>
              Take a photo or pick one from your library to instantly identify
              any train and get specs, facts + a technical blueprint
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
  scanCounter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  scanCounterText: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    fontWeight: fonts.weights.medium,
  },
  scanCounterExhausted: {
    color: colors.danger,
  },
  guestBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(234, 179, 8, 0.1)",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.2)",
  },
  guestBadgeText: {
    fontSize: fonts.sizes.xs,
    color: colors.warning,
    fontWeight: fonts.weights.medium,
    flex: 1,
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
