// ============================================================
// LocoSnap — Paywall soft-prompt
//
// Non-blocking banner shown on the results AND camera screens. With the
// 3-scan free tier (2026-06-02), the ladder is: gentle €1 nudge after
// scan 1 (2 left), urgent "1 free scan left" after scan 2, locked wall
// at scan 3+. The variant KEYS are kept as scan_2/scan_5/scan_6 so the
// existing tested copy maps without a rewrite — scan_5 already reads
// "1 free scan left" (correct at 2 used) and scan_6 is the lockout. The
// scan_6 variant is non-dismissable because it reflects the actual
// lockout state, not an ignorable nudge.
//
// Routes to /paywall with a source param tagging variant + surface
// for per-touch analytics.
//
// v1.0.35 Phase H — scan_2 title pulls the live monthly intro price
// from RevenueCat offerings (replaces hardcoded "£1" / "1 €" /
// "5,19 zł"). Permanent fix for the price-drift bug surfaced when
// the Play intro was tuned from 5,19 zł → 4,49 zł on 2026-05-26 —
// the static softprompt copy quietly went out of sync with the
// actual store charge. The truthful-intro pattern matches the Phase
// A paywall tile mechanism, so the in-app numbers always reflect
// what the user is about to pay.
//
// If the SDK can't return an introPrice (no intro live in market,
// RevenueCat not initialised, network failure), the component falls
// back to a generic title with no specific number ("Try Pro").
// ============================================================

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { track } from "../services/analytics";
import { getOfferings } from "../services/purchases";
import { getPackageKind } from "../app/paywall-helpers";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

const TEAL = "#00D4AA";
const TEAL_SUBTLE = "rgba(0, 212, 170, 0.08)";

type Variant = "scan_2" | "scan_4" | "scan_5" | "scan_6" | "default";
type Surface = "results" | "camera";

// 3-scan free tier ladder (2026-06-02). Variant keys retained for copy
// reuse: scan_2 = gentle €1 nudge (1 used, 2 left), scan_5 = urgent
// "1 free scan left" (2 used, 1 left), scan_6 = locked wall (3+ used).
// scan_4 is no longer reachable; its locale copy is left in place, dead.
function variantFor(scansUsed: number): Variant {
  if (scansUsed === 1) return "scan_2";
  if (scansUsed === 2) return "scan_5";
  if (scansUsed >= 3) return "scan_6";
  return "default";
}

export function PaywallSoftPrompt({
  scansUsed,
  surface = "results",
}: {
  scansUsed: number;
  surface?: Surface;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  // Live monthly intro price from RC offerings. Initialised null so
  // the first frame renders the generic fallback title; once the
  // async fetch resolves, the component re-renders with the real
  // price interpolated into the scan_2 title. ~50-200ms delay; users
  // briefly see "Try Pro" before "Try Pro from €0.99/month" lands.
  const [introPriceString, setIntroPriceString] = useState<string | null>(null);
  const variant = variantFor(scansUsed);
  const isUrgent = variant === "scan_5";
  const isLocked = variant === "scan_6";

  // Reset dismissed state when the variant escalates so a dismiss at
  // scan 2 does not silence the scan_5 urgent banner or the scan_6
  // lockout on a persistent surface (the camera tab stays mounted
  // across scans).
  useEffect(() => {
    setDismissed(false);
  }, [variant]);

  useEffect(() => {
    track("paywall_softprompt_shown", { variant, scansUsed, surface });
  }, [variant, scansUsed, surface]);

  // Fetch live monthly intro price once per mount. Only the scan_2
  // variant interpolates the price, but we fetch on every mount so
  // the price is ready if the user dwells past scan 2; the cost is
  // a single RC offerings round-trip (which is also cached). Fails
  // silently — null state falls back to the generic title.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const offerings = await getOfferings();
      if (cancelled) return;
      const packages = offerings?.current?.availablePackages ?? [];
      const monthly = packages.find((p) => getPackageKind(p) === "monthly");
      const intro = (monthly?.product as any)?.introPrice;
      if (intro?.priceString) setIntroPriceString(intro.priceString);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed) return null;

  const onTap = () => {
    track("paywall_softprompt_tapped", { variant, scansUsed, surface });
    router.push(`/paywall?source=softprompt_${variant}_${surface}` as any);
  };

  const onDismiss = () => {
    track("paywall_softprompt_dismissed", { variant, scansUsed, surface });
    setDismissed(true);
  };

  return (
    <View
      style={[
        styles.container,
        isUrgent && styles.containerUrgent,
        isLocked && styles.containerLocked,
      ]}
    >
      <TouchableOpacity
        style={styles.content}
        onPress={onTap}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.iconCircle,
            isUrgent && styles.iconCircleUrgent,
            isLocked && styles.iconCircleLocked,
          ]}
        >
          <Ionicons
            name={
              isLocked ? "lock-closed" : isUrgent ? "alert-circle" : "sparkles"
            }
            size={20}
            color={isLocked ? "#FF6B35" : isUrgent ? colors.warning : TEAL}
          />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>
            {variant === "scan_2" && introPriceString
              ? t("paywall.softPrompt.scan_2.titleWithPrice", {
                  price: introPriceString,
                })
              : variant === "scan_2"
                ? t("paywall.softPrompt.scan_2.titleGeneric")
                : t(`paywall.softPrompt.${variant}.title`)}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {t(`paywall.softPrompt.${variant}.body`)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>
      {!isLocked && (
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={8}
          style={styles.dismiss}
          accessibilityLabel="Dismiss"
        >
          <Ionicons name="close" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL_SUBTLE,
    borderColor: "rgba(0, 212, 170, 0.20)",
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    marginBottom: spacing.lg,
  },
  containerUrgent: {
    backgroundColor: "rgba(234, 179, 8, 0.08)",
    borderColor: "rgba(234, 179, 8, 0.25)",
  },
  containerLocked: {
    backgroundColor: "rgba(255, 107, 53, 0.10)",
    borderColor: "rgba(255, 107, 53, 0.35)",
    borderWidth: 1.5,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 212, 170, 0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircleUrgent: {
    backgroundColor: "rgba(234, 179, 8, 0.14)",
  },
  iconCircleLocked: {
    backgroundColor: "rgba(255, 107, 53, 0.16)",
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  body: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  dismiss: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
});
