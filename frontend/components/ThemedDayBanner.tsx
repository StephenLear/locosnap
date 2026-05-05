// ============================================================
// LocoSnap — Themed day banner (Phase 2 G.2)
//
// Renders a banner at the top of My League when today is a themed
// day (matches the THEMED_DAYS definition from leagues.ts on the
// backend). Hidden on non-themed days.
//
// Themed days (UTC weekday):
//   - Tuesday (2): Rare-Tier-Tuesday → 2× XP for rare/epic/legendary
//   - Saturday (6): Heritage-Saturday → 1.5× XP for country-match
//     (deferred to v1.0.27 per design doc — needs operator-country
//     introspection at scan time)
// ============================================================

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";
import { todaysThemedDay } from "../constants/themedDay";

export function ThemedDayBanner({ now }: { now?: Date }) {
  const { t } = useTranslation();
  const themed = todaysThemedDay(now);
  if (!themed) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="flash" size={16} color={colors.warning} />
      <Text style={styles.text}>
        {t(`leaderboard.themedDay.${themed.kind}`, {
          multiplier: themed.multiplier,
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  text: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },
});

export default ThemedDayBanner;
