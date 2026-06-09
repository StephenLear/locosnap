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
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/authStore";
import {
  getOfferings,
  purchasePro,
  purchaseBlueprintCredits,
  restorePurchases,
  syncProStatus,
  getWinBackAnnualOption,
  isLapsedProEligible,
  purchaseWinBackAnnual,
  PurchasesPackage,
  SubscriptionOption,
} from "../services/purchases";
import { track } from "../services/analytics";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";
import { useLocalSearchParams } from "expo-router";
import {
  getPackageKind,
  sortPaywallPackages,
  findDefaultIndex,
  formatPerWeek,
  describeIntroOffer,
  computeAnnualSavingsPct,
  PaywallLocale,
} from "./paywall-helpers";
import {
  decideWinBackVisibility,
  getWinBackPriceString,
} from "./paywall-winback-helpers";

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
// Order intentionally leads with "Unlimited scans" then "Your whole
// collection" — the two most-cited benefits in paywall research.
// Labels + descriptions resolved via i18n at render time.

const PRO_FEATURE_KEYS = [
  { icon: "infinite", key: "unlimitedScans" },
  { icon: "albums", key: "collection" },
  { icon: "construct", key: "blueprints" },
] as const;

// Map i18next current language to the locale subset our helpers handle.
// Anything outside en/de/pl falls back to 'en' for number formatting.
function resolveHelperLocale(lng: string | undefined): PaywallLocale {
  const base = (lng || "en").toLowerCase().split("-")[0];
  if (base === "de") return "de";
  if (base === "pl") return "pl";
  return "en";
}

// Phase D — wall-aware hero. Sources that arrive because the user
// hit the 6/6 free-scan cap get a different headline that kills the
// "I thought it refreshes" misunderstanding pattern (multiple TikTok
// + Play review signals in May 2026). All other sources keep the
// generic "Go Pro" headline.
function isWallSource(source: string | undefined): boolean {
  if (!source) return false;
  return (
    source === "auto_wall" ||
    source === "home_persistent_locked" ||
    source.includes("scan_6")
  );
}

export default function PaywallScreen() {
  const { t, i18n } = useTranslation();
  const helperLocale = resolveHelperLocale(i18n.language);
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const { user, fetchProfile } = useAuthStore();
  const session = useAuthStore((s) => s.session);
  const isSignedIn = session !== null;
  const isWallEntry = isWallSource(source);

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [creditPrice, setCreditPrice] = useState<string | null>(null);
  // Android-only Play win-back tile. Set only for an eligible lapsed user
  // when the tagged annual subscriptionOption is found; null otherwise →
  // tile hidden, paywall behaves normally.
  const [winBackOption, setWinBackOption] = useState<SubscriptionOption | null>(
    null
  );
  const [winBackPurchasing, setWinBackPurchasing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [purchasingCredits, setPurchasingCredits] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isBlueprintSource = source === "blueprint_credit";
  // Live annual-vs-monthly savings for the "SAVE X%" badge (null until
  // packages load or if annual isn't actually cheaper → falls back to
  // the generic "Best Value" badge).
  const annualSavingsPct = computeAnnualSavingsPct(packages);

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
      // Sort: annual (anchor) → monthly → lifetime. Lifetime last because it's
      // a high-commitment alternative; we want the eye to land on annual first.
      const sorted = sortPaywallPackages(offerings.current.availablePackages);
      setPackages(sorted);
      setSelectedIndex(findDefaultIndex(sorted));

      // Capture blueprint credit price from RevenueCat
      const creditPkg = offerings?.all?.["blueprint_credits"]?.availablePackages?.[0];
      if (creditPkg) setCreditPrice(creditPkg.product.priceString);
    } else {
      setError("Unable to load subscription options. Please try again later.");
    }

    // Android-only Play win-back: surface the discounted annual tile for an
    // eligible lapsed user. Both checks already self-gate to Android and fail
    // closed (null/false) so any error leaves the normal paywall intact.
    const [option, lapsed] = await Promise.all([
      getWinBackAnnualOption(),
      isLapsedProEligible(),
    ]);
    const showWinBack = decideWinBackVisibility({
      platform: Platform.OS,
      lapsed,
      hasOption: option !== null,
    });
    if (showWinBack && option) {
      setWinBackOption(option);
      track("winback_offer_shown", {
        priceString: getWinBackPriceString(option) ?? "",
      });
    } else if (lapsed && Platform.OS === "android") {
      // Eligible but the offer couldn't be found — user falls through to
      // the full-price plans. Track so we can spot a misconfigured offer.
      track("winback_fallback_to_full_price");
    }

    setLoading(false);
  };

  // ── Win-back purchase ──────────────────────────────────────
  const handleWinBackPurchase = async () => {
    if (!winBackOption) return;
    if (!requireSignInElseRoute("winback")) return;

    track("winback_offer_tapped");
    setWinBackPurchasing(true);
    setError(null);

    try {
      const result = await purchaseWinBackAnnual(winBackOption);

      if (result === "pending") {
        Alert.alert(t("paywall.pendingTitle"), t("paywall.pendingBody"), [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else if (result === true) {
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
      // Leave the full-price plans available so the user can still subscribe.
      setError("Purchase failed. Please try again.");
    } finally {
      setWinBackPurchasing(false);
    }
  };

  // Anonymous purchases create orphan RevenueCat customers we can't reconcile
  // to a Supabase profile (no email, no leaderboard, no winback path). Force
  // sign-in before any real-money flow — Restore, Pro purchase, credit purchase.
  // After OTP verifies the user lands back here via /sign-in?returnTo=paywall.
  const requireSignInElseRoute = (intent: string): boolean => {
    if (isSignedIn) return true;
    track("paywall_signin_gate_triggered", {
      source: source || "unknown",
      intent,
    });
    router.push(
      `/sign-in?mode=signup&returnTo=paywall&intent=${intent}` as any
    );
    return false;
  };

  const handlePurchase = async () => {
    if (packages.length === 0) return;
    if (!requireSignInElseRoute("subscribe")) return;

    const selectedPackage = packages[selectedIndex];
    if (!selectedPackage) return;

    setPurchasing(true);
    setError(null);

    try {
      const result = await purchasePro(selectedPackage);

      if (result === "pending") {
        Alert.alert(t("paywall.pendingTitle"), t("paywall.pendingBody"), [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else if (result === true) {
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
    if (!requireSignInElseRoute("restore")) return;

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
    if (!requireSignInElseRoute("credits")) return;

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
      const result = await purchaseBlueprintCredits(creditPackage);

      if (result === "pending") {
        Alert.alert(t("paywall.pendingTitle"), t("paywall.pendingBody"), [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else if (result === true) {
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

          <Text style={styles.heroTitle}>
            {isWallEntry ? t("paywall.wallTitle") : t("paywall.title")}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isWallEntry
              ? t("paywall.wallSubtitle")
              : t("paywall.heroSubtitle")}
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
          {PRO_FEATURE_KEYS.map((feature) => (
            <View key={feature.key} style={styles.featureRow}>
              <View style={styles.featureIconCircle}>
                <Ionicons
                  name={feature.icon as any}
                  size={18}
                  color={SCANNER.teal}
                />
              </View>
              <View style={styles.featureInfo}>
                <Text style={styles.featureLabel}>
                  {t(`paywall.features.${feature.key}.label`)}
                </Text>
                <Text style={styles.featureDesc}>
                  {t(`paywall.features.${feature.key}.desc`)}
                </Text>
              </View>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={SCANNER.teal}
              />
            </View>
          ))}
        </View>

        {/* ── Win-back offer (Android, lapsed users only) ───── */}
        {winBackOption && (
          <View style={styles.winBackSection}>
            <TouchableOpacity
              style={[
                styles.winBackCard,
                (winBackPurchasing || purchasing) && { opacity: 0.6 },
              ]}
              onPress={handleWinBackPurchase}
              disabled={winBackPurchasing || purchasing}
              activeOpacity={0.7}
            >
              <View style={styles.winBackIconCircle}>
                <Ionicons name="gift" size={20} color={SCANNER.teal} />
              </View>
              <View style={styles.winBackInfo}>
                <Text style={styles.winBackTitle}>
                  {t("pro.winback.title")}
                </Text>
                <Text style={styles.winBackBody}>
                  {t("pro.winback.body", {
                    price: getWinBackPriceString(winBackOption) ?? "",
                  })}
                </Text>
              </View>
              {winBackPurchasing ? (
                <ActivityIndicator size="small" color={SCANNER.teal} />
              ) : (
                <View style={styles.winBackCta}>
                  <Text style={styles.winBackCtaText}>
                    {t("pro.winback.cta")}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

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
              const kind = getPackageKind(pkg);
              const isAnnual = kind === "annual";
              const isLifetime = kind === "lifetime";

              // Truthful intro copy: read the real introPrice from RevenueCat
              // and render structured i18n. Shown on whichever tile actually
              // has a current intro offer (annual OR monthly) — the legacy
              // hardcoded "30% off 3 months" wording is gone.
              const introDescriptor = describeIntroOffer(
                (pkg.product as any).introPrice
              );

              const title =
                pkg.product.title ||
                (isLifetime
                  ? t("paywall.lifetimeTitle")
                  : isAnnual
                    ? "Annual"
                    : "Monthly");

              const priceSuffix = isLifetime
                ? ""
                : isAnnual
                  ? `/${t("paywall.period.year")}`
                  : `/${t("paywall.period.month")}`;

              // Weekly equivalent — only on annual, only when we have a
              // numeric price + currency code. Sub-coffee anchor; way
              // stronger psychological pull than per-month equivalent
              // (which collapses to a few cents' delta vs the monthly tier).
              const perWeekText =
                isAnnual &&
                typeof (pkg.product as any).price === "number" &&
                (pkg.product as any).currencyCode
                  ? formatPerWeek(
                      (pkg.product as any).price,
                      (pkg.product as any).currencyCode,
                      helperLocale
                    )
                  : "";

              // Compose intro copy via singular/plural i18n templates.
              const introCopy = introDescriptor
                ? t(
                    introDescriptor.count === 1
                      ? "paywall.introOffer.singular"
                      : "paywall.introOffer.plural",
                    {
                      introPriceString: introDescriptor.introPriceString,
                      count: introDescriptor.count,
                      unitLabel: t(
                        `paywall.unit.${introDescriptor.unit}.${
                          introDescriptor.count === 1 ? "singular" : "plural"
                        }`
                      ),
                      regularPriceString: pkg.product.priceString,
                      regularPeriod: t(
                        `paywall.period.${isAnnual ? "year" : "month"}`
                      ),
                    }
                  )
                : "";

              const badgeText = introDescriptor
                ? t("paywall.introOfferBadge")
                : isAnnual
                  ? annualSavingsPct !== null
                    ? t("paywall.savePercent", { pct: annualSavingsPct })
                    : t("paywall.bestValue")
                  : "";

              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[
                    styles.packageCard,
                    isAnnual && styles.packageCardAnnual,
                    isSelected && styles.packageCardSelected,
                  ]}
                  onPress={() => setSelectedIndex(index)}
                  activeOpacity={0.7}
                >
                  {/* Tile badge — INTRO OFFER when this tile has one,
                      BEST VALUE on annual otherwise, nothing on others. */}
                  {badgeText !== "" && (
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>{badgeText}</Text>
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
                      {title}
                    </Text>
                    <Text style={styles.packagePrice}>
                      {pkg.product.priceString}
                      {priceSuffix}
                    </Text>
                    {/* Weekly equivalent for annual — coffee anchor */}
                    {perWeekText !== "" && (
                      <Text style={styles.packagePerWeek}>
                        {t("paywall.perWeekEquivalent", { price: perWeekText })}
                      </Text>
                    )}
                    {/* Truthful intro copy — dynamic from the store */}
                    {introCopy !== "" && (
                      <Text style={styles.packageIntroLine}>{introCopy}</Text>
                    )}
                    {isLifetime && (
                      <Text style={styles.packageSubtitle}>
                        {t("paywall.lifetimeSubtitle")}
                      </Text>
                    )}
                  </View>
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
              <Text style={styles.creditPrice}>{creditPrice ?? "—"}</Text>
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

        {/* ── Sign-in gate banner (anonymous users only) ───── */}
        {!isSignedIn && (
          <View style={styles.signInGate}>
            <View style={styles.signInGateIcon}>
              <Ionicons name="mail" size={16} color={SCANNER.teal} />
            </View>
            <View style={styles.signInGateText}>
              <Text style={styles.signInGateTitle}>
                {t("paywall.signInGateTitle")}
              </Text>
              <Text style={styles.signInGateBody}>
                {t("paywall.signInGateBody")}
              </Text>
            </View>
          </View>
        )}

        {/* ── CTA ───────────────────────────────────────────── */}
        <TouchableOpacity
          style={[
            styles.primaryBtn,
            (purchasing || winBackPurchasing || packages.length === 0) &&
              styles.primaryBtnDisabled,
          ]}
          onPress={handlePurchase}
          disabled={purchasing || winBackPurchasing || packages.length === 0}
        >
          {purchasing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons
                name={isSignedIn ? "flash" : "mail"}
                size={20}
                color="#fff"
              />
              <Text style={styles.primaryBtnText}>
                {isSignedIn
                  ? t("paywall.subscribe")
                  : t("paywall.subscribeSignedOut")}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Safety triggers ───────────────────────────────── */}
        <View style={styles.safetyRow}>
          <View style={styles.safetyItem}>
            <Ionicons name="close-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.safetyText}>{t("paywall.cancelAnytime")}</Text>
          </View>
          <View style={styles.safetyDot} />
          <View style={styles.safetyItem}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
            <Text style={styles.safetyText}>{t("paywall.noCommitment")}</Text>
          </View>
        </View>

        {/* ── Trust line (Phase D — bakery reframe) ─────────────
            Always-visible single-line trust statement. Mechanism-first
            framing per feedback_paywall_reframe_no_apology.md: Pro is
            what funds the app, not ads / data-selling. Replaces nothing
            — sits between safety triggers and the restore-purchases
            button, reinforces the cancel-anytime / no-commitment row. */}
        <View style={styles.trustRow}>
          <Ionicons name="heart-outline" size={14} color={SCANNER.teal} />
          <Text style={styles.trustText}>{t("paywall.fundedTrust")}</Text>
        </View>

        {/* ── Restore ───────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.restoreBtn}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Text style={styles.restoreText}>{t("paywall.restorePurchases")}</Text>
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
  // Annual card sits above the others visually: taller padding, always-on
  // teal border (even when unselected) so the eye lands here first.
  packageCardAnnual: {
    paddingVertical: spacing.lg + spacing.xs,
    borderColor: "rgba(0, 212, 170, 0.45)",
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
  packageSubtitle: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Per-week equivalent under annual price — secondary line, teal accent so
  // it reads as the "coffee anchor" without competing with the headline price.
  packagePerWeek: {
    fontSize: fonts.sizes.xs,
    color: SCANNER.teal,
    fontWeight: fonts.weights.semibold,
    marginTop: 2,
  },
  // Truthful intro-offer copy rendered from RevenueCat introPrice. Italicised
  // small text under the headline price; Apple 3.1.2-compliant disclosure.
  packageIntroLine: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: "italic",
    lineHeight: 16,
  },

  // Win-back offer (Android, lapsed users)
  winBackSection: {
    marginBottom: spacing.lg,
  },
  winBackCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SCANNER.tealSubtle,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: "rgba(0, 212, 170, 0.45)",
  },
  winBackIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 212, 170, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  winBackInfo: {
    flex: 1,
  },
  winBackTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  winBackBody: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  winBackCta: {
    backgroundColor: SCANNER.teal,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginLeft: spacing.sm,
  },
  winBackCtaText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: colors.background,
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

  // Sign-in gate (shown above CTA for anonymous users)
  signInGate: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: SCANNER.tealSubtle,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0, 212, 170, 0.2)",
  },
  signInGateIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 212, 170, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  signInGateText: {
    flex: 1,
  },
  signInGateTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  signInGateBody: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
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

  // Safety triggers
  safetyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  safetyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  safetyText: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
  },
  safetyDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textMuted,
  },

  // Trust line — funded-by-subscriptions reframe
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  trustText: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    textAlign: "center",
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
