// ============================================================
// LocoSnap — Leaderboard Screen
// Global rankings: top spotters by unique classes collected
// ============================================================

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { fetchLeaderboard, LeaderboardEntry } from "../../services/supabase";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";

// ── Level names (same as profile) ────────────────────────────

const LEVEL_NAMES = [
  "",
  "Platform Newbie",
  "Casual Spotter",
  "Basher",
  "Grinder",
  "Copping Legend",
];

// ── Medal colours for top 3 ──────────────────────────────────

const MEDAL_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32"]; // Gold, Silver, Bronze

export default function LeaderboardScreen() {
  const { user, isGuest } = useAuthStore();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await fetchLeaderboard(50);
      setEntries(data);
    } catch {
      console.warn("Failed to load leaderboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadLeaderboard();
  };

  // Find current user's position
  const userRank = user
    ? entries.findIndex((e) => e.id === user.id) + 1
    : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
      </View>
    );
  }

  if (isGuest) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="podium-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>Sign in to compete</Text>
        <Text style={styles.emptySubtitle}>
          Create an account to appear on the leaderboard and track your ranking.
        </Text>
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="podium-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No spotters yet</Text>
        <Text style={styles.emptySubtitle}>
          Be the first to spot a train and claim the top spot!
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Your rank banner ────────────────────────────── */}
      {userRank > 0 && (
        <View style={styles.yourRankBanner}>
          <Ionicons name="person" size={18} color={colors.accent} />
          <Text style={styles.yourRankText}>
            Your rank: #{userRank} of {entries.length}
          </Text>
        </View>
      )}

      {/* ── Leaderboard list ────────────────────────────── */}
      <FlatList
        data={entries}
        keyExtractor={(item, index) => item.id || index.toString()}
        renderItem={({ item, index }) => (
          <LeaderboardRow
            entry={item}
            rank={index + 1}
            isCurrentUser={user?.id === item.id}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// ── Leaderboard row component ────────────────────────────────

function LeaderboardRow({
  entry,
  rank,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  rank: number;
  isCurrentUser: boolean;
}) {
  const isTop3 = rank <= 3;
  const medalColor = isTop3 ? MEDAL_COLORS[rank - 1] : undefined;

  return (
    <View
      style={[
        styles.row,
        isCurrentUser && styles.rowCurrentUser,
      ]}
    >
      {/* Rank */}
      <View style={styles.rankContainer}>
        {isTop3 ? (
          <View style={[styles.medalCircle, { backgroundColor: medalColor }]}>
            <Text style={styles.medalText}>{rank}</Text>
          </View>
        ) : (
          <Text style={styles.rankText}>{rank}</Text>
        )}
      </View>

      {/* User info */}
      <View style={styles.userSection}>
        <View style={styles.rowAvatar}>
          <Ionicons
            name="person"
            size={16}
            color={isCurrentUser ? colors.accent : colors.textMuted}
          />
        </View>
        <View style={styles.userMeta}>
          <Text
            style={[
              styles.rowUsername,
              isCurrentUser && styles.rowUsernameHighlight,
            ]}
            numberOfLines={1}
          >
            {entry.username}
            {isCurrentUser ? " (You)" : ""}
          </Text>
          <Text style={styles.rowLevel}>
            {LEVEL_NAMES[entry.level] || `Level ${entry.level}`}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsSection}>
        <View style={styles.statPill}>
          <Ionicons name="layers" size={12} color={colors.primary} />
          <Text style={styles.statPillText}>{entry.uniqueTrains}</Text>
        </View>
        <View style={styles.statPill}>
          <Ionicons name="camera" size={12} color={colors.textMuted} />
          <Text style={styles.statPillMuted}>{entry.totalSpots}</Text>
        </View>
        {entry.rareCount > 0 && (
          <View style={[styles.statPill, styles.statPillRare]}>
            <Ionicons name="star" size={12} color="#f59e0b" />
            <Text style={styles.statPillRareText}>{entry.rareCount}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 40,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
  },

  // Empty states
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },

  // Your rank banner
  yourRankBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  yourRankText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.accent,
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  rowCurrentUser: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 56,
  },

  // Rank
  rankContainer: {
    width: 36,
    alignItems: "center",
  },
  rankText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textMuted,
  },
  medalCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  medalText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.bold,
    color: "#fff",
  },

  // User section
  userSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: spacing.sm,
  },
  rowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
  },
  userMeta: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  rowUsername: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
  },
  rowUsernameHighlight: {
    color: colors.accent,
  },
  rowLevel: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    marginTop: 1,
  },

  // Stats
  statsSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  statPillText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: colors.primary,
  },
  statPillMuted: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.medium,
    color: colors.textMuted,
  },
  statPillRare: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  statPillRareText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: "#f59e0b",
  },
});
