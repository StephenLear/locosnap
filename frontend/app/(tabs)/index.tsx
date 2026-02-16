// ============================================================
// LocoSnap — Home / Spot Screen
// High-tech scanner interface for train identification
// Viewfinder aesthetic matching the app icon's blue-teal DNA
// ============================================================

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Alert,
  Platform,
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

// Scanner brand colors (matching the app icon)
const SCANNER = {
  teal: "#00D4AA",
  tealDim: "rgba(0, 212, 170, 0.15)",
  tealGlow: "rgba(0, 212, 170, 0.4)",
  blue: "#0066FF",
  blueDim: "rgba(0, 102, 255, 0.12)",
};

// Scanning progress stages for the cinematic overlay
const SCAN_STAGES = [
  "Capturing image data...",
  "Analysing locomotive features...",
  "Identifying class & operator...",
  "Fetching specs & rarity...",
];

export default function HomeScreen() {
  const router = useRouter();
  const [cameraMode, setCameraMode] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanStage, setScanStage] = useState(0);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const heroFade = useRef(new Animated.Value(1)).current;

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

  // ── Ambient glow pulse (always running, subtle) ──────────
  useEffect(() => {
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.6,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.3,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    );
    glow.start();
    return () => glow.stop();
  }, []);

  // ── Scanning animations ──────────────────────────────────
  useEffect(() => {
    if (!isScanning) {
      setScanStage(0);
      scanLineAnim.setValue(0);
      ringRotate.setValue(0);
      return;
    }

    // Scanning line sweep
    const scanLine = Animated.loop(
      Animated.timing(scanLineAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    scanLine.start();

    // Outer ring rotation
    const ring = Animated.loop(
      Animated.timing(ringRotate, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    );
    ring.start();

    // Pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Progress stages every 3 seconds
    const stageInterval = setInterval(() => {
      setScanStage((prev) => Math.min(prev + 1, SCAN_STAGES.length - 1));
    }, 3000);

    return () => {
      scanLine.stop();
      ring.stop();
      pulse.stop();
      clearInterval(stageInterval);
    };
  }, [isScanning]);

  const ringSpin = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const scanLineY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_WIDTH - 80],
  });

  // ── Business Logic (unchanged) ───────────────────────────

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

    // Capture GPS location (non-blocking)
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
      setLocation(null);
    }

    try {
      const { selectedBlueprintStyle } = useTrainStore.getState();
      const { profile } = useAuthStore.getState();
      const isPro = profile?.is_pro ?? false;
      const result = await identifyTrain(imageUri, selectedBlueprintStyle, isPro);

      if (!result.success || !result.data) {
        track("scan_failed", { error: result.error || "unknown" });
        setScanError(
          result.error || "Could not identify the train. Try a different photo."
        );
        return;
      }

      const { train, specs, facts, rarity, blueprint } = result.data;

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
      router.push("/card-reveal");
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
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        console.log("[PICKER] Raw file:", file.name, file.size, "bytes");
        const objectUrl = URL.createObjectURL(file);
        setPreviewUri(objectUrl);
        handleScan(objectUrl);
      };
      input.click();
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setPreviewUri(result.assets[0].uri);
      handleScan(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
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
          <View style={styles.viewfinder}>
            {/* Viewfinder corners (L-shaped brackets like the icon) */}
            <View style={styles.viewfinderFrame}>
              <View style={[styles.vfCorner, styles.vfTopLeft]} />
              <View style={[styles.vfCorner, styles.vfTopRight]} />
              <View style={[styles.vfCorner, styles.vfBottomLeft]} />
              <View style={[styles.vfCorner, styles.vfBottomRight]} />
            </View>
            <Text style={styles.viewfinderText}>
              Align the train in the frame
            </Text>
          </View>

          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={styles.cameraCancelBtn}
              onPress={() => setCameraMode(false)}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.shutterBtn} onPress={takePhoto}>
              <View style={styles.shutterRing}>
                <View style={styles.shutterBtnInner} />
              </View>
            </TouchableOpacity>

            <View style={{ width: 48 }} />
          </View>
        </CameraView>
      </View>
    );
  }

  // ── Main Home Screen ────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Header bar ── */}
      <View style={styles.header}>
        <Text style={styles.logoText}>LOCOSNAP</Text>
        {scansRemaining !== null && (
          <View style={styles.scanBadge}>
            <View
              style={[
                styles.scanDot,
                { backgroundColor: scansRemaining > 0 ? SCANNER.teal : colors.danger },
              ]}
            />
            <Text
              style={[
                styles.scanBadgeText,
                scansRemaining === 0 && { color: colors.danger },
              ]}
            >
              {scansRemaining > 0
                ? `${scansRemaining} scan${scansRemaining !== 1 ? "s" : ""}`
                : "No scans left"}
            </Text>
          </View>
        )}
      </View>

      {/* ── Guest badge ── */}
      {isGuest && (
        <TouchableOpacity
          style={styles.guestBadge}
          onPress={() => {
            useAuthStore.getState().clearGuest();
            router.push("/sign-in");
          }}
        >
          <Ionicons name="cloud-offline-outline" size={13} color={colors.warning} />
          <Text style={styles.guestBadgeText}>
            Guest mode — sign in to save
          </Text>
          <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* ── Scanner Hero ── */}
      <View style={styles.hero}>
        {previewUri && isScanning ? (
          /* ── Scanning State: cinematic overlay ── */
          <View style={styles.scannerFrame}>
            <Image source={{ uri: previewUri }} style={styles.previewImage} />

            {/* Dark overlay */}
            <View style={styles.scanOverlay} />

            {/* Viewfinder corners on the preview */}
            <View style={styles.scanCorners}>
              <View style={[styles.scanCorner, styles.scTopLeft]} />
              <View style={[styles.scanCorner, styles.scTopRight]} />
              <View style={[styles.scanCorner, styles.scBottomLeft]} />
              <View style={[styles.scanCorner, styles.scBottomRight]} />
            </View>

            {/* Animated scanning line */}
            <Animated.View
              style={[
                styles.scanLine,
                { transform: [{ translateY: scanLineY }] },
              ]}
            />

            {/* Centre indicator */}
            <View style={styles.scanCentre}>
              <Animated.View
                style={[
                  styles.scanRingOuter,
                  { transform: [{ rotate: ringSpin }] },
                ]}
              />
              <Animated.View
                style={[
                  styles.scanPulse,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <Ionicons name="scan" size={32} color={SCANNER.teal} />
              </Animated.View>
            </View>

            {/* Progress text */}
            <View style={styles.scanProgress}>
              <Text style={styles.scanStageText}>
                {SCAN_STAGES[scanStage]}
              </Text>
              <View style={styles.progressDots}>
                {SCAN_STAGES.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.progressDot,
                      i <= scanStage && styles.progressDotActive,
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
        ) : (
          /* ── Default State: scanner ready ── */
          <View style={styles.readyState}>
            {/* Ambient glow behind the viewfinder */}
            <Animated.View
              style={[styles.ambientGlow, { opacity: glowAnim }]}
            />

            {/* Viewfinder frame */}
            <View style={styles.viewfinderReady}>
              <View style={[styles.readyCorner, styles.rcTopLeft]} />
              <View style={[styles.readyCorner, styles.rcTopRight]} />
              <View style={[styles.readyCorner, styles.rcBottomLeft]} />
              <View style={[styles.readyCorner, styles.rcBottomRight]} />

              {/* Centre icon */}
              <View style={styles.centreIcon}>
                <Ionicons name="train" size={48} color={SCANNER.teal} />
              </View>

              {/* Cross-hair lines */}
              <View style={styles.crossH} />
              <View style={styles.crossV} />
            </View>

            <Text style={styles.heroTitle}>Identify Any Train</Text>
            <Text style={styles.heroSub}>
              Point your camera or choose a photo{"\n"}to unlock specs, facts & rarity
            </Text>
          </View>
        )}
      </View>

      {/* ── Error display ── */}
      {scanError && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{scanError}</Text>
        </View>
      )}

      {/* ── Action Buttons ── */}
      <View style={styles.actions}>
        {/* Primary: Camera */}
        <TouchableOpacity
          style={styles.cameraBtn}
          onPress={openCamera}
          disabled={isScanning}
          activeOpacity={0.8}
        >
          <View style={styles.cameraBtnGlow} />
          <Ionicons name="camera" size={26} color="#fff" />
          <Text style={styles.cameraBtnLabel}>Scan with Camera</Text>
        </TouchableOpacity>

        {/* Secondary: Library */}
        <TouchableOpacity
          style={styles.libraryBtn}
          onPress={pickImage}
          disabled={isScanning}
          activeOpacity={0.7}
        >
          <Ionicons name="images-outline" size={20} color={SCANNER.teal} />
          <Text style={styles.libraryBtnLabel}>Choose from Library</Text>
        </TouchableOpacity>
      </View>

      {/* ── Subtle footer ── */}
      <View style={styles.footer}>
        <View style={styles.footerDot} />
        <Text style={styles.footerText}>AI-powered identification</Text>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────
const FRAME_SIZE = SCREEN_WIDTH * 0.55;
const CORNER_LEN = 24;
const CORNER_W = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  logoText: {
    fontSize: 13,
    fontWeight: "700",
    color: SCANNER.teal,
    letterSpacing: 3,
  },
  scanBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: SCANNER.blueDim,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  scanDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scanBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  // ── Guest badge ──
  guestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(234, 179, 8, 0.08)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.15)",
  },
  guestBadgeText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: "500",
    flex: 1,
  },

  // ── Hero ──
  hero: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Ready state (default) ──
  readyState: {
    alignItems: "center",
  },
  ambientGlow: {
    position: "absolute",
    width: FRAME_SIZE + 80,
    height: FRAME_SIZE + 80,
    borderRadius: (FRAME_SIZE + 80) / 2,
    backgroundColor: SCANNER.teal,
  },
  viewfinderReady: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  centreIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 212, 170, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 212, 170, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Cross-hair lines
  crossH: {
    position: "absolute",
    width: FRAME_SIZE * 0.35,
    height: 1,
    backgroundColor: "rgba(0, 212, 170, 0.15)",
  },
  crossV: {
    position: "absolute",
    width: 1,
    height: FRAME_SIZE * 0.35,
    backgroundColor: "rgba(0, 212, 170, 0.15)",
  },

  // Ready viewfinder corners (L-shaped brackets)
  readyCorner: {
    position: "absolute",
    width: CORNER_LEN,
    height: CORNER_LEN,
  },
  rcTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderColor: SCANNER.teal,
  },
  rcTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderColor: SCANNER.teal,
  },
  rcBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderColor: SCANNER.teal,
  },
  rcBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderColor: SCANNER.teal,
  },

  heroTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },

  // ── Scanning state ──
  scannerFrame: {
    width: SCREEN_WIDTH - 48,
    height: SCREEN_WIDTH - 48,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(10, 15, 26, 0.65)",
  },

  // Scanning viewfinder corners
  scanCorners: {
    ...StyleSheet.absoluteFillObject,
    margin: 16,
  },
  scanCorner: {
    position: "absolute",
    width: 28,
    height: 28,
  },
  scTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: SCANNER.teal,
  },
  scTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: SCANNER.teal,
  },
  scBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: SCANNER.teal,
  },
  scBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: SCANNER.teal,
  },

  // Animated scan line
  scanLine: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 2,
    backgroundColor: SCANNER.teal,
    shadowColor: SCANNER.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    top: 16,
  },

  // Centre scan indicator
  scanCentre: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  scanRingOuter: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "transparent",
    borderTopColor: SCANNER.teal,
    borderRightColor: "rgba(0, 212, 170, 0.3)",
  },
  scanPulse: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(0, 212, 170, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Scan progress
  scanProgress: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  scanStageText: {
    fontSize: 13,
    fontWeight: "600",
    color: SCANNER.teal,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  progressDots: {
    flexDirection: "row",
    gap: 6,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  progressDotActive: {
    backgroundColor: SCANNER.teal,
  },

  // ── Error ──
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: colors.danger,
    lineHeight: 18,
  },

  // ── Action Buttons ──
  actions: {
    gap: 10,
    marginBottom: 20,
  },
  cameraBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: SCANNER.teal,
    overflow: "hidden",
  },
  cameraBtnGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  cameraBtnLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a0f1a",
    letterSpacing: 0.2,
  },
  libraryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(0, 212, 170, 0.25)",
  },
  libraryBtnLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: SCANNER.teal,
  },

  // ── Footer ──
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 14,
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: SCANNER.teal,
    opacity: 0.5,
  },
  footerText: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },

  // ── Camera mode ──
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
  viewfinderFrame: {
    width: SCREEN_WIDTH * 0.72,
    height: SCREEN_WIDTH * 0.72,
  },
  // Camera viewfinder L-shaped corners
  vfCorner: {
    position: "absolute",
    width: 32,
    height: 32,
  },
  vfTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: SCANNER.teal,
  },
  vfTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: SCANNER.teal,
  },
  vfBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: SCANNER.teal,
  },
  vfBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: SCANNER.teal,
  },
  viewfinderText: {
    marginTop: 20,
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 44,
  },
  cameraCancelBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  shutterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: SCANNER.teal,
    justifyContent: "center",
    alignItems: "center",
  },
  shutterBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
});
