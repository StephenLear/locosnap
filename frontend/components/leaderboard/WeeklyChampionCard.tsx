// ============================================================
// LocoSnap — Weekly rarity champion card (Phase 2 enhancement)
//
// Renders above the Country tab list when the current country has
// a verified rare/epic/legendary scan this week. Hidden when no
// qualifying scan exists yet (most countries early in the week).
// Pulls from fetchWeeklyRarityChampion which calls the SECURITY
// DEFINER RPC `get_weekly_rarity_champion`.
// ============================================================

import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  fetchWeeklyRarityChampion,
  type WeeklyRarityChampion,
} from "../../services/supabase";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";

const RARITY_COLORS: Record<WeeklyRarityChampion["rarityTier"], string> = {
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

export function WeeklyChampionCard({ countryCode }: { countryCode: string }) {
  const { t } = useTranslation();
  const [champion, setChampion] = useState<WeeklyRarityChampion | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    fetchWeeklyRarityChampion(countryCode)
      .then((c) => {
        if (!cancelled) {
          setChampion(c);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  if (!loaded || !champion) return null;

  const tierColor = RARITY_COLORS[champion.rarityTier];

  return (
    <View style={[styles.card, { borderColor: tierColor }]}>
      <View style={styles.headerRow}>
        <Ionicons name="trophy" size={16} color={tierColor} />
        <Text style={[styles.headerText, { color: tierColor }]}>
          {t("leaderboard.weeklyChampion.heading")}
        </Text>
      </View>
      <View style={styles.bodyRow}>
        <Text style={styles.username} numberOfLines={1}>
          {champion.username}
          {champion.spotterEmoji ? ` ${champion.spotterEmoji}` : ""}
        </Text>
      </View>
      <Text style={styles.findText}>
        {t("leaderboard.weeklyChampion.find", {
          class: champion.classKey,
          tier: t(`leaderboard.weeklyChampion.tier.${champion.rarityTier}`),
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bodyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  username: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    flexShrink: 1,
  },
  findText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
  },
});

export default WeeklyChampionCard;
