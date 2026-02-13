// ============================================================
// LocoSnap — Paywall Screen
// Full-screen modal for Pro subscription purchase.
// Fetches packages from RevenueCat and handles purchase flow.
// ============================================================

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/authStore";
import {
  getOfferings,
  purchasePro,
  restorePurchases,
  syncProStatus,
  PurchasesPackage,
} from "../services/purchases";
import { track } from "../services/analytics";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";
import { useLocalSearchParams } from "expo-router";

// ── Feature list ─────────────────────────────────────────────

const PRO_FEATURES = [
  { icon: "infinite", label: "Unlimited daily scans" },
  { icon: "construct", label: "Premium technical blueprints" },
  { icon: "color-palette", label: "Exclusive card frames (coming soon)" },
  { icon: "heart", label: "Support indie development" },
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
  const [error, setError] = useState<string | null>(null);

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

  // ── Guest guard ────────────────────────────────────────────
  if (isGuest) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.guestContainer}>
          <View style={styles.heroIcon}>
            <Ionicons name="person-circle-outline" size={64} color={colors.accent} />
          </View>
          <Text style={styles.heroTitle}>Sign In to Unlock Pro</Text>
          <Text style={styles.heroSubtitle}>
            Create an account first, then upgrade to Pro for unlimited scans and
            premium blueprints.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              router.back();
              setTimeout(() => router.push("/sign-in"), 300);
            }}
          >
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Ionicons name="rocket" size={48} color={colors.accent} />
          </View>
          <Text style={styles.heroTitle}>Unlock LocoSnap Pro</Text>
          <Text style={styles.heroSubtitle}>
            Take your trainspotting to the next level
          </Text>
        </View>

        {/* Feature list */}
        <View style={styles.featuresSection}>
          {PRO_FEATURES.map((feature, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIconCircle}>
                <Ionicons
                  name={feature.icon as any}
                  size={18}
                  color={colors.accent}
                />
              </View>
              <Text style={styles.featureText}>{feature.label}</Text>
            </View>
          ))}
        </View>

        {/* Packages */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.loadingText}>Loading plans...</Text>
          </View>
        ) : packages.length > 0 ? (
          <View style={styles.packagesSection}>
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

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* CTA */}
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
            <Text style={styles.primaryBtnText}>Continue</Text>
          )}
        </TouchableOpacity>

        {/* Restore */}
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

        {/* Legal */}
        <Text style={styles.legalText}>
          Payment will be charged to your {Platform.OS === "ios" ? "Apple" : "Google"}{" "}
          account. Subscription auto-renews unless cancelled at least 24 hours
          before the end of the current period.{"\n"}
          Terms of Service · Privacy Policy
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },

  // Guest guard
  guestContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
  },

  // Hero
  heroSection: {
    alignItems: "center",
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255, 107, 0, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: fonts.sizes.hero,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: "center",
  },

  // Features
  featuresSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  featureIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 107, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  featureText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
    color: colors.textPrimary,
    flex: 1,
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

  // Packages
  packagesSection: {
    gap: spacing.md,
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
  },
  packageCardSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(255, 107, 0, 0.06)",
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
    borderColor: colors.accent,
  },
  packageRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
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
    color: colors.accent,
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

  // Error
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorText: {
    fontSize: fonts.sizes.sm,
    color: colors.danger,
    flex: 1,
  },

  // Primary CTA
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: "#fff",
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
    lineHeight: 16,
  },
});
