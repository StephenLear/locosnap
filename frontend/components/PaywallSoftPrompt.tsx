// ============================================================
// LocoSnap — Paywall soft-prompt
//
// Non-blocking banner shown on the results screen at scan counts
// 2, 4, and 5. Replaces the previous static "Grow your collection"
// banner with scan-aware copy that escalates as the user approaches
// the hard wall at scan 6. Dismissable per render; routes to the
// existing /paywall screen with a source param for per-touch
// analytics.
// ============================================================

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { track } from "../services/analytics";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

const TEAL = "#00D4AA";
const TEAL_SUBTLE = "rgba(0, 212, 170, 0.08)";

type Variant = "scan_2" | "scan_4" | "scan_5" | "default";

function variantFor(scansUsed: number): Variant {
  if (scansUsed === 2) return "scan_2";
  if (scansUsed === 4) return "scan_4";
  if (scansUsed === 5) return "scan_5";
  return "default";
}

type Surface = "results" | "camera";

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
  const variant = variantFor(scansUsed);
  const isUrgent = variant === "scan_5";

  // Reset dismissed state when the variant escalates so a dismiss at
  // scan 2 does not silence the scan_5 urgent banner on a persistent
  // surface (the camera tab stays mounted across scans).
  useEffect(() => {
    setDismissed(false);
  }, [variant]);

  useEffect(() => {
    track("paywall_softprompt_shown", { variant, scansUsed, surface });
  }, [variant, scansUsed, surface]);

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
    <View style={[styles.container, isUrgent && styles.containerUrgent]}>
      <TouchableOpacity
        style={styles.content}
        onPress={onTap}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.iconCircle,
            isUrgent && styles.iconCircleUrgent,
          ]}
        >
          <Ionicons
            name={isUrgent ? "alert-circle" : "sparkles"}
            size={20}
            color={isUrgent ? colors.warning : TEAL}
          />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.title}>
            {t(`paywall.softPrompt.${variant}.title`)}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {t(`paywall.softPrompt.${variant}.body`)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={8}
        style={styles.dismiss}
        accessibilityLabel="Dismiss"
      >
        <Ionicons name="close" size={14} color={colors.textMuted} />
      </TouchableOpacity>
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
