// ============================================================
// LocoSnap — Leaderboard router (Phase 2 E.5)
//
// Top-level tab bar selects between three sub-screens powered by
// useLeaderboardStore.activeTab. Replaces the previous 4-tab
// (Global / Weekly / Rarity / Regional) implementation. The old
// content is preserved inside the new tabs:
//   - MyLeague: weekly XP race against your tier shard (Phase 2 core)
//   - Country: scoped to country_code, This week / All-time
//   - Collection: scoped by your collection depth (classes / rarity / streak)
// ============================================================

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  useLeaderboardStore,
  type LeaderboardTab,
} from "../../store/leaderboardStore";
import { MyLeagueTab } from "./leaderboard/MyLeagueTab";
import { CountryTab } from "./leaderboard/CountryTab";
import { CollectionTab } from "./leaderboard/CollectionTab";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";

const TABS: ReadonlyArray<{ key: LeaderboardTab; i18nKey: string }> = [
  { key: "my_league", i18nKey: "leaderboard.tabs.myLeague" },
  { key: "country", i18nKey: "leaderboard.tabs.country" },
  { key: "collection", i18nKey: "leaderboard.tabs.collection" },
];

export default function LeaderboardScreen() {
  const { t } = useTranslation();
  const activeTab = useLeaderboardStore((s) => s.activeTab);
  const setActiveTab = useLeaderboardStore((s) => s.setActiveTab);

  return (
    <View style={styles.root}>
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tabButton, active && styles.tabButtonActive]}
            >
              <Text
                style={[styles.tabLabel, active && styles.tabLabelActive]}
                numberOfLines={1}
              >
                {t(tab.i18nKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.content}>
        {activeTab === "my_league" && <MyLeagueTab />}
        {activeTab === "country" && <CountryTab />}
        {activeTab === "collection" && <CollectionTab />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  tabButtonActive: {
    backgroundColor: colors.surfaceHighlight,
    borderColor: colors.accent,
  },
  tabLabel: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },
  tabLabelActive: {
    color: colors.accent,
  },
  content: {
    flex: 1,
  },
});
