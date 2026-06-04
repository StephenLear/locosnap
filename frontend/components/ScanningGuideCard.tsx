// ============================================================
// LocoSnap — Scanning guide card (v1.0.38)
//
// Dismissable tips card shown on the scan screen to brand-new users
// (no spots logged yet) to help them take a photo that identifies
// accurately. Requested by tester Oula; validated 2026-06-04 by the
// "how to scan loco" TikTok search query. Mirrors the ProRescuePrompt
// self-gating pattern: the parent mounts <ScanningGuideCard /> with no
// props and the card decides whether to render.
//
// Shows until the user logs their first spot (history.length > 0) OR
// dismisses it (AsyncStorage). No backend.
// ============================================================

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTrainStore } from "../store/trainStore";
import { track } from "../services/analytics";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

const TEAL = "#00D4AA";
const TEAL_SUBTLE = "rgba(0, 212, 170, 0.08)";
const DISMISSED_KEY = "locosnap_scanning_guide_dismissed";

const TIPS: Array<{ icon: keyof typeof Ionicons.glyphMap; key: string }> = [
  { icon: "scan-outline", key: "tip1" },
  { icon: "sunny-outline", key: "tip2" },
  { icon: "pricetag-outline", key: "tip3" },
];

export function ScanningGuideCard() {
  const { t } = useTranslation();
  const history = useTrainStore((s) => s.history);
  const historyLoaded = useTrainStore((s) => s.historyLoaded);
  // Default-hide while the AsyncStorage dismissal read is in flight.
  const [dismissed, setDismissed] = useState(true);

  // New users only: shown until the first spot is logged, or dismissed.
  const eligible = historyLoaded && history.length === 0;

  useEffect(() => {
    if (!eligible) return;
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((v) => setDismissed(v === "true"))
      .catch(() => setDismissed(false));
  }, [eligible]);

  useEffect(() => {
    if (eligible && !dismissed) track("scanning_guide_shown");
  }, [eligible, dismissed]);

  if (!eligible || dismissed) return null;

  const onDismiss = () => {
    track("scanning_guide_dismissed");
    setDismissed(true);
    AsyncStorage.setItem(DISMISSED_KEY, "true").catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="bulb-outline" size={18} color={TEAL} />
        </View>
        <Text style={styles.title}>{t("scan.scanningGuide.title")}</Text>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={8}
          style={styles.dismiss}
          accessibilityLabel={t("scan.scanningGuide.dismissA11y")}
        >
          <Ionicons name="close" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      {TIPS.map((tip) => (
        <View key={tip.key} style={styles.tipRow}>
          <Ionicons
            name={tip.icon}
            size={14}
            color={TEAL}
            style={styles.tipIcon}
          />
          <Text style={styles.tipText}>
            {t(`scan.scanningGuide.${tip.key}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: TEAL_SUBTLE,
    borderColor: "rgba(0, 212, 170, 0.20)",
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 212, 170, 0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
  },
  dismiss: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  tipIcon: {
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
