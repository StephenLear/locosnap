// ============================================================
// LocoSnap — Collection tab (Phase 2 E.4)
//
// Three sub-toggles: Unique classes / Rarity score / Streak days.
// - unique_classes: existing `leaderboard` view ranked by unique_classes
// - rarity_score: computed from `leaderboard_rarity` view via
//   computeRarityScore(epic, legendary, ...)
// - streak_days: deferred — Phase 2 schema doesn't yet expose a
//   streak_days field on profiles. Falls back to unique_classes
//   with a "Coming soon" footer until v1.0.27 wires it up.
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../../store/authStore";
import { useLeaderboardStore } from "../../../store/leaderboardStore";
import {
  fetchLeaderboard,
  fetchRarityLeaderboard,
  type LeaderboardEntry,
} from "../../../services/supabase";
import { computeRarityScore } from "../../../constants/rarityScore";
import { colors, fonts, spacing, borderRadius } from "../../../constants/theme";
import { IdentityBadge } from "../../../components/IdentityBadge";

type SubToggle = "unique_classes" | "rarity_score" | "streak_days";

interface ScoredEntry extends LeaderboardEntry {
  score: number;
}

export function CollectionTab() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const subToggle = useLeaderboardStore((s) => s.collectionSubToggle);
  const setSubToggle = useLeaderboardStore((s) => s.setCollectionSubToggle);

  const [entries, setEntries] = useState<ScoredEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadEntries = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        let scored: ScoredEntry[] = [];
        if (subToggle === "rarity_score") {
          const raw = await fetchRarityLeaderboard(100);
          scored = raw
            .map((row) => ({
              ...row,
              score: computeRarityScore({
                epicCount: row.epicCount,
                legendaryCount: row.legendaryCount,
                rareCount: row.rareCount,
              }),
            }))
            .sort((a, b) => b.score - a.score);
        } else {
          // unique_classes path also serves the streak_days fallback.
          const raw = await fetchLeaderboard(100);
          scored = raw.map((row) => ({ ...row, score: row.uniqueTrains }));
        }
        setEntries(scored);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [subToggle]
  );

  useEffect(() => {
    void loadEntries(false);
  }, [loadEntries]);

  const statLabel = useMemo(() => {
    if (subToggle === "rarity_score") return t("leaderboard.collection.score");
    return t("leaderboard.collection.classes");
  }, [subToggle, t]);

  return (
    <View style={styles.root}>
      {/* Sub-toggle */}
      <View style={styles.subToggle}>
        {(["unique_classes", "rarity_score", "streak_days"] as SubToggle[]).map(
          (mode) => {
            const active = subToggle === mode;
            return (
              <Pressable
                key={mode}
                style={[styles.subToggleButton, active && styles.subToggleButtonActive]}
                onPress={() => setSubToggle(mode)}
              >
                <Text
                  style={[
                    styles.subToggleLabel,
                    active && styles.subToggleLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {t(`leaderboard.collection.${mode}`)}
                </Text>
              </Pressable>
            );
          }
        )}
      </View>

      {subToggle === "streak_days" && (
        <Text style={styles.deferNotice}>
          {t("leaderboard.collection.streakSoon")}
        </Text>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.bodyText}>{t("leaderboard.collection.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(row, i) => row.id || `cl-${i}`}
          renderItem={({ item, index }) => (
            <CollectionRow
              row={item}
              rank={index + 1}
              isMe={item.id === user?.id}
              statValue={item.score}
              statLabel={statLabel}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadEntries(true)}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

function CollectionRow({
  row,
  rank,
  isMe,
  statValue,
  statLabel,
}: {
  row: ScoredEntry;
  rank: number;
  isMe: boolean;
  statValue: number;
  statLabel: string;
}) {
  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <Text style={[styles.rank, isMe && styles.rankMe]}>{rank}</Text>
      <View style={styles.rowMeta}>
        <View style={styles.usernameLine}>
          <Text style={[styles.username, isMe && styles.usernameMe]} numberOfLines={1}>
            {row.username}
          </Text>
          <IdentityBadge
            countryCode={row.countryCode}
            emojiId={row.spotterEmoji}
            size="sm"
          />
        </View>
        <Text style={styles.rowStat}>
          {statValue} {statLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  subToggle: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  subToggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  subToggleButtonActive: {
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  subToggleLabel: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    textAlign: "center",
  },
  subToggleLabelActive: {
    color: colors.accent,
  },
  deferNotice: {
    color: colors.warning,
    fontSize: fonts.sizes.xs,
    textAlign: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    fontStyle: "italic",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  rowMe: {
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  rank: {
    color: colors.textMuted,
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    minWidth: 32,
    textAlign: "center",
  },
  rankMe: {
    color: colors.accent,
  },
  rowMeta: {
    flex: 1,
  },
  usernameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  username: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    flexShrink: 1,
  },
  usernameMe: {
    color: colors.accent,
  },
  rowStat: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginTop: 2,
  },
});

export default CollectionTab;
