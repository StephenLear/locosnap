// ============================================================
// LocoSnap — Paywall Screen
// Premium full-screen modal for Pro subscription purchase.
// Fetches packages from RevenueCat and handles purchase flow.
// ============================================================

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Animated,
  Dimensions,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/authStore";
import {
  getOfferings,
  purchasePro,
  purchaseBlueprintCredits,
  restorePurchases,
  syncProStatus,
  PurchasesPackage,
} from "../services/purchases";
import { track } from "../services/analytics";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";
import { useLocalSearchParams } from "expo-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH * 0.58;
const CARD_GAP = 12;

// ── Scanner palette (consistent with home screen) ────────────
const SCANNER = {
  teal: "#00D4AA",
  tealGlow: "rgba(0, 212, 170, 0.15)",
  tealSubtle: "rgba(0, 212, 170, 0.06)",
  blue: "#0066FF",
  blueGlow: "rgba(0, 102, 255, 0.12)",
};

// ── Blueprint demo images ────────────────────────────────────
const BLUEPRINT_PREVIEWS = [
  {
    key: "technical",
    label: "Technical",
    image: require("../assets/blueprints/demo-technical.jpg"),
  },
  {
    key: "vintage",
    label: "Vintage",
    image: require("../assets/blueprints/demo-vintage.jpg"),
  },
  {
    key: "schematic",
    label: "Schematic",
    image: require("../assets/blueprints/demo-schematic.jpg"),
  },
  {
    key: "cinematic",
    label: "Cinematic",
    image: require("../assets/blueprints/demo-cinematic.jpg"),
  },
];

// ── Feature list ─────────────────────────────────────────────

const PRO_FEATURES = [
  {
    icon: "infinite",
    label: "Unlimited daily scans",
    desc: "No more waiting — scan every train you see",
  },
  {
    icon: "construct",
    label: "Premium technical blueprints",
    desc: "Detailed engineering diagrams for your collection",
  },
  {
    icon: "color-palette",
    label: "Exclusive card frames",
    desc: "Stand out with rare collector card designs",
  },
  {
    icon: "heart",
    label: "Support indie development",
    desc: "Help keep LocoSnap running and improving",
  },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const { isGuest, user, fetchProfile } = useAuthStore();

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(1); // Default to annual
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [purchasingCredits, setPurchasingCredits] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBlueprintSource = source === "blueprint_credit";

  // ── Animations ────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse on the hero icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Ambient glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 2500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Track paywall view + fetch offerings on mount
  useEffect(() => {
    track("paywall_viewed", { source: source || "unknown" });
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    setLoading(true);
    setError(null);

    const offerings = await getOfferings();

    if (offerings?.current?.availablePackages) {
      // Sort: monthly first, then annual
      const sorted = [...offerings.current.availablePackages].sort((a, b) => {
        if (a.packageType === "MONTHLY") return -1;
        if (b.packageType === "MONTHLY") return 1;
        return 0;
      });
      setPackages(sorted);
    } else {
      setError("Unable to load subscription options. Please try again later.");
    }

    setLoading(false);
  };

  const handlePurchase = async () => {
    if (packages.length === 0) return;

    const selectedPackage = packages[selectedIndex];
    if (!selectedPackage) return;

    setPurchasing(true);
    setError(null);

    try {
      const success = await purchasePro(selectedPackage);

      if (success) {
        // Sync pro status with Supabase
        if (user) {
          await syncProStatus(user.id);
          await fetchProfile();
        }

        Alert.alert(
          "Welcome to Pro!",
          "You now have unlimited scans and premium blueprints.",
          [{ text: "Let's Go!", onPress: () => router.back() }]
        );
      }
    } catch (err) {
      setError("Purchase failed. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);

    try {
      const restored = await restorePurchases();

      if (restored) {
        if (user) {
          await syncProStatus(user.id);
          await fetchProfile();
        }

        Alert.alert("Restored!", "Your Pro subscription has been restored.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(
          "No Purchases Found",
          "We couldn't find any previous purchases to restore."
        );
      }
    } catch {
      setError("Restore failed. Please try again.");
    } finally {
      setRestoring(false);
    }
  };

  const handleCreditPurchase = async () => {
    // Find the blueprint credit package from offerings
    const offerings = await getOfferings();
    const creditPackage = offerings?.all?.["blueprint_credits"]?.availablePackages?.[0];

    if (!creditPackage) {
      Alert.alert(
        "Not Available",
        "Blueprint credits are not available yet. Check back soon!"
      );
      return;
    }

    setPurchasingCredits(true);
    setError(null);

    try {
      const success = await purchaseBlueprintCredits(creditPackage);

      if (success) {
        if (user) {
          await fetchProfile();
        }
        Alert.alert(
          "Credits Added!",
          "You can now generate a blueprint for this train.",
          [{ text: "Let's Go!", onPress: () => router.back() }]
        );
      }
    } catch (err) {
      setError("Credit purchase failed. Please try again.");
    } finally {
      setPurchasingCredits(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Ionicons name="close" size={24} color={colors.textPrimary} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ──────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.heroSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* PRO badge */}
          <View style={styles.proBadgeRow}>
            <View style={styles.proBadge}>
              <Ionicons name="diamond" size={10} color={SCANNER.teal} />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </View>

          {/* Animated icon */}
          <View style={styles.heroIconOuter}>
            <Animated.View
              style={[styles.heroGlow, { opacity: glowAnim }]}
            />
            <Animated.View
              style={[
                styles.heroIcon,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Ionicons name="rocket" size={36} color={SCANNER.teal} />
            </Animated.View>
          </View>

          <Text style={styles.heroTitle}>Unlock LocoSnap Pro</Text>
          <Text style={styles.heroSubtitle}>
            Take your trainspotting to the next level
          </Text>
        </Animated.View>

        {/* ── Blueprint preview ────────────────────────────── */}
        <View style={styles.blueprintSection}>
          <Text style={styles.blueprintSectionLabel}>PREMIUM BLUEPRINT STYLES</Text>
          <Text style={styles.blueprintSectionDesc}>
            Generate stunning engineering blueprints for every train
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.blueprintScrollMain}
          snapToInterval={CARD_WIDTH + CARD_GAP}
          decelerationRate="fast"
          style={styles.blueprintList}
        >
          {BLUEPRINT_PREVIEWS.map((item) => (
            <View key={item.key} style={styles.blueprintCard}>
              <Image source={item.image} style={styles.blueprintImage} />
              <View style={styles.blueprintLabelRow}>
                <View style={styles.blueprintLabelDot} />
                <Text style={styles.blueprintLabel}>{item.label}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* ── Feature list ──────────────────────────────────── */}
        <View style={styles.featuresSection}>
          {PRO_FEATURES.map((feature, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIconCircle}>
                <Ionicons
                  name={feature.icon as any}
                  size={18}
                  color={SCANNER.teal}
                />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureLabel}>{feature.label}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </View>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={SCANNER.teal}
              />
            </View>
          ))}
        </View>

        {/* ── Packages ──────────────────────────────────────── */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={SCANNER.teal} />
            <Text style={styles.loadingText}>Loading plans...</Text>
          </View>
        ) : packages.length > 0 ? (
          <View style={styles.packagesSection}>
            <Text style={styles.sectionLabel}>CHOOSE YOUR PLAN</Text>
            {packages.map((pkg, index) => {
              const isSelected = index === selectedIndex;
              const isAnnual =
                pkg.packageType === "ANNUAL" ||
                pkg.identifier.includes("annual");

              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.packageCard,
                    isSelected && styles.packageCardSelected,
                  ]}
                  onPress={() => setSelectedIndex(index)}
                  activeOpacity={0.7}
                >
                  {/* Best value badge */}
                  {isAnnual && (
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>BEST VALUE</Text>
                    </View>
                  )}

                  {/* Selection indicator */}
                  <View
                    style={[
                      styles.packageRadio,
                      isSelected && styles.packageRadioSelected,
                    ]}
                  >
                    {isSelected && (
                      <View style={styles.packageRadioInner} />
                    )}
                  </View>

                  <View style={styles.packageInfo}>
                    <Text
                      style={[
                        styles.packageTitle,
                        isSelected && styles.packageTitleSelected,
                      ]}
                    >
                      {pkg.product.title || (isAnnual ? "Annual" : "Monthly")}
                    </Text>
                    <Text style={styles.packagePrice}>
                      {pkg.product.priceString}
                      {isAnnual ? "/year" : "/month"}
                    </Text>
                  </View>

                  {/* Savings badge */}
                  {isAnnual && (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsBadgeText}>Save 25%</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* ── Blueprint Credit Purchase (when source=blueprint_credit) */}
        {isBlueprintSource && (
          <View style={styles.creditSection}>
            <Text style={styles.sectionLabel}>OR BUY A SINGLE BLUEPRINT</Text>
            <TouchableOpacity
              style={[
                styles.creditCard,
                purchasingCredits && { opacity: 0.6 },
              ]}
              onPress={handleCreditPurchase}
              disabled={purchasingCredits}
              activeOpacity={0.7}
            >
              <View style={styles.creditIconCircle}>
                <Ionicons name="sparkles" size={20} color={SCANNER.teal} />
              </View>
              <View style={styles.creditInfo}>
                <Text style={styles.creditTitle}>1 Blueprint Credit</Text>
                <Text style={styles.creditDesc}>
                  Generate one blueprint for any train
                </Text>
              </View>
              <Text style={styles.creditPrice}>£0.99</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Error message ─────────────────────────────────── */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── CTA ───────────────────────────────────────────── */}
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            (purchasing || packages.length === 0) && styles.primaryBtnDisabled,
          ]}
          onPress={handlePurchase}
          disabled={purchasing || packages.length === 0}
        >
          {purchasing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="flash" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>
                Upgrade to Pro
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Restore ───────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Text style={styles.restoreText}>Restore Purchases</Text>
          )}
        </TouchableOpacity>

        {/* ── Legal ─────────────────────────────────────────── */}
        <Text style={styles.legalText}>
          Payment will be charged to your{" "}
          {Platform.OS === "ios" ? "Apple" : "Google"} account. Subscription
          auto-renews unless cancelled at least 24 hours before the end of the
          current period.{"\n\n"}
          <Text style={styles.legalLink}>Terms of Service</Text>
          {"  ·  "}
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 60,
    paddingTop: 60,
  },
  closeBtn: {
    position: "absolute",
    top: 56,
    left: spacing.lg,
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

  // Guest guard
  guestScrollContent: {
    paddingBottom: 60,
  },
  guestContainer: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: 80,
    paddingBottom: spacing.lg,
  },
  guestBottomSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  blueprintSectionGuest: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  blueprintScrollGuest: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  guestProBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: SCANNER.teal,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  guestProBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: "#fff",
    letterSpacing: 1.5,
  },
  guestDesc: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  guestFeatures: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.md,
  },
  guestFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  guestFeatureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 212, 170, 0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  guestFeatureText: {
    fontSize: fonts.sizes.md,
    color: colors.textPrimary,
    fontWeight: fonts.weights.medium,
  },
  guestLaterText: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },

  // Blueprint preview carousel
  blueprintSection: {
    marginBottom: spacing.md,
  },
  blueprintSectionLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  blueprintSectionDesc: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  blueprintScroll: {
    paddingRight: spacing.xl,
  },
  blueprintScrollMain: {
    paddingLeft: spacing.xl,
    paddingRight: spacing.xl,
  },
  blueprintList: {
    marginHorizontal: -spacing.xl,
    marginBottom: spacing.xl,
  },
  blueprintCard: {
    width: CARD_WIDTH,
    marginRight: CARD_GAP,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  blueprintImage: {
    width: "100%",
    height: CARD_WIDTH * 1.35,
    resizeMode: "cover",
  },
  blueprintLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  blueprintLabelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SCANNER.teal,
  },
  blueprintLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },

  // Hero
  heroSection: {
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  proBadgeRow: {
    marginBottom: spacing.lg,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: SCANNER.tealSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: "rgba(0, 212, 170, 0.15)",
  },
  proBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: SCANNER.teal,
    letterSpacing: 2,
  },
  heroIconOuter: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  heroGlow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: SCANNER.teal,
    shadowColor: SCANNER.teal,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: SCANNER.tealSubtle,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(0, 212, 170, 0.25)",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
    letterSpacing: 0.3,
  },
  heroSubtitle: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },

  // Features
  featuresSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  featureIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SCANNER.tealSubtle,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 212, 170, 0.12)",
  },
  featureInfo: {
    flex: 1,
  },
  featureLabel: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
  },
  featureDesc: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    marginTop: 1,
  },

  // Loading
  loadingContainer: {
    alignItems: "center",
    padding: spacing.xxl,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
  },

  // Section label
  sectionLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },

  // Packages
  packagesSection: {
    marginBottom: spacing.xl,
  },
  packageCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    position: "relative",
    overflow: "hidden",
  },
  packageCardSelected: {
    borderColor: SCANNER.teal,
    backgroundColor: SCANNER.tealSubtle,
  },
  bestValueBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: SCANNER.teal,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderBottomLeftRadius: borderRadius.sm,
  },
  bestValueText: {
    fontSize: 9,
    fontWeight: fonts.weights.bold,
    color: colors.background,
    letterSpacing: 1,
  },
  packageRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  packageRadioSelected: {
    borderColor: SCANNER.teal,
  },
  packageRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SCANNER.teal,
  },
  packageInfo: {
    flex: 1,
  },
  packageTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  packageTitleSelected: {
    color: SCANNER.teal,
  },
  packagePrice: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
  },
  savingsBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  savingsBadgeText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: "#fff",
  },

  // Credit purchase
  creditSection: {
    marginBottom: spacing.xl,
  },
  creditCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SCANNER.tealSubtle,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: "rgba(0, 212, 170, 0.2)",
  },
  creditIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 212, 170, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  creditInfo: {
    flex: 1,
  },
  creditTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  creditDesc: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
  },
  creditPrice: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    color: SCANNER.teal,
  },

  // Error
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
  },
  errorText: {
    fontSize: fonts.sizes.sm,
    color: colors.danger,
    flex: 1,
  },

  // Primary CTA
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: SCANNER.teal,
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    shadowColor: SCANNER.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  primaryBtnText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: "#fff",
    letterSpacing: 0.3,
  },

  // Restore
  restoreBtn: {
    alignItems: "center",
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  restoreText: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
    fontWeight: fonts.weights.medium,
  },

  // Legal
  legalText: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 17,
  },
  legalLink: {
    color: colors.textSecondary,
    textDecorationLine: "underline",
  },
});
