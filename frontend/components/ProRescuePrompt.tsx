// ============================================================
// LocoSnap — Pro rescue prompt
//
// One-time, dismissable card shown on the scan screen to Pro
// users who have subscribed but never logged a spot
// (is_pro === true && last_spot_date == null). Nudges them to
// make their first scan — addresses the "subscribed within
// minutes, never used the product" cohort surfaced in the
// 2026-05-17 Supabase / RevenueCat audit. Dismissal persists
// across launches; the prompt also stops naturally once the
// user's first spot sets last_spot_date.
// ============================================================

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../store/authStore";
import { track } from "../services/analytics";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

const TEAL = "#00D4AA";
const TEAL_SUBTLE = "rgba(0, 212, 170, 0.08)";
const DISMISSED_KEY = "locosnap_pro_rescue_dismissed";

export function ProRescuePrompt() {
  const { t } = useTranslation();
  const { profile, session } = useAuthStore();
  // Default-hide while the AsyncStorage dismissal read is in flight.
  const [dismissed, setDismissed] = useState(true);

  const eligible =
    !!session && profile?.is_pro === true && !profile?.last_spot_date;

  useEffect(() => {
    if (!eligible) return;
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((v) => setDismissed(v === "true"))
      .catch(() => setDismissed(false));
  }, [eligible]);

  useEffect(() => {
    if (eligible && !dismissed) track("pro_rescue_prompt_shown");
  }, [eligible, dismissed]);

  if (!eligible || dismissed) return null;

  const onDismiss = () => {
    track("pro_rescue_prompt_dismissed");
    setDismissed(true);
    AsyncStorage.setItem(DISMISSED_KEY, "true").catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="sparkles" size={20} color={TEAL} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{t("scan.proRescue.title")}</Text>
        <Text style={styles.body}>{t("scan.proRescue.body")}</Text>
      </View>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={8}
        style={styles.dismiss}
        accessibilityLabel={t("scan.proRescue.dismissA11y")}
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
  },
});
