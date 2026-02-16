// ============================================================
// LocoSnap — Leaderboard Screen
// Three tabs: Global (all-time), Weekly (last 7 days), Rarity (Epic+)
// ============================================================

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import {
  fetchLeaderboard,
  fetchWeeklyLeaderboard,
  fetchRarityLeaderboard,
  fetchRegionalLeaderboard,
  LeaderboardEntry,
  LeaderboardTab,
  UK_REGIONS,
} from "../../services/supabase";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";
import { track } from "../../services/analytics";

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

// ── Tab config ───────────────────────────────────────────────

const TABS: { key: LeaderboardTab; label: string; icon: string }[] = [
  { key: "global", label: "All-Time", icon: "globe" },
  { key: "weekly", label: "This Week", icon: "calendar" },
  { key: "rarity", label: "Rarity", icon: "star" },
  { key: "regional", label: "Region", icon: "map" },
];

export default function LeaderboardScreen() {
  const { user, isGuest, profile } = useAuthStore();
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("global");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(
    profile?.region ?? null
  );

  const loadLeaderboard = useCallback(
    async (tab: LeaderboardTab, region?: string | null) => {
      try {
        let data: LeaderboardEntry[];
        switch (tab) {
          case "weekly":
            data = await fetchWeeklyLeaderboard(50);
            break;
          case "rarity":
            data = await fetchRarityLeaderboard(50);
            break;
          case "regional":
            if (region) {
              data = await fetchRegionalLeaderboard(region, 50);
            } else {
              data = [];
            }
            break;
          default:
            data = await fetchLeaderboard(50);
        }
        setEntries(data);
      } catch {
        console.warn("Failed to load leaderboard");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    setLoading(true);
    loadLeaderboard(activeTab, selectedRegion);
  }, [activeTab, loadLeaderboard, selectedRegion]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadLeaderboard(activeTab, selectedRegion);
  };

  const handleTabChange = (tab: LeaderboardTab) => {
    if (tab === activeTab) return;
    track("leaderboard_viewed", { tab });
    setActiveTab(tab);
  };

  // Find current user's position
  const userRank = user
    ? entries.findIndex((e) => e.id === user.id) + 1
    : 0;

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

  return (
    <View style={styles.container}>
      {/* ── Tab switcher ──────────────────────────────── */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive,
            ]}
            onPress={() => handleTabChange(tab.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={
                activeTab === tab.key ? colors.accent : colors.textMuted
              }
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Region picker (regional tab only) ─────────── */}
      {activeTab === "regional" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.regionPicker}
        >
          {UK_REGIONS.map((region) => (
            <TouchableOpacity
              key={region.key}
              style={[
                styles.regionChip,
                selectedRegion === region.key && styles.regionChipActive,
              ]}
              onPress={() => setSelectedRegion(region.key)}
            >
              <Text
                style={[
                  styles.regionChipText,
                  selectedRegion === region.key && styles.regionChipTextActive,
                ]}
              >
                {region.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Your rank banner ────────────────────────────── */}
      {userRank > 0 && !loading && (
        <View style={styles.yourRankBanner}>
          <Ionicons name="person" size={18} color={colors.accent} />
          <Text style={styles.yourRankText}>
            Your rank: #{userRank} of {entries.length}
          </Text>
        </View>
      )}

      {/* ── Loading ─────────────────────────────────────── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Loading rankings...</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyInlineContainer}>
          <Ionicons name="podium-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyInlineTitle}>
            {activeTab === "weekly"
              ? "No spots this week yet"
              : activeTab === "rarity"
              ? "No rare finds yet"
              : activeTab === "regional" && !selectedRegion
              ? "Select your region"
              : activeTab === "regional"
              ? "No spotters in this region yet"
              : "No spotters yet"}
          </Text>
          <Text style={styles.emptyInlineSubtitle}>
            {activeTab === "weekly"
              ? "Spot a train to appear on the weekly board!"
              : activeTab === "rarity"
              ? "Spot an Epic or Legendary train to compete here."
              : activeTab === "regional" && !selectedRegion
              ? "Pick a UK region above to see local rankings."
              : activeTab === "regional"
              ? "Be the first spotter in your region!"
              : "Be the first to spot a train and claim the top spot!"}
          </Text>
        </View>
      ) : (
        /* ── Leaderboard list ────────────────────────────── */
        <FlatList
          data={entries}
          keyExtractor={(item, index) => `${activeTab}-${item.id || index}`}
          renderItem={({ item, index }) => (
            <LeaderboardRow
              entry={item}
              rank={index + 1}
              isCurrentUser={user?.id === item.id}
              tab={activeTab}
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
      )}
    </View>
  );
}

// ── Leaderboard row component ────────────────────────────────

function LeaderboardRow({
  entry,
  rank,
  isCurrentUser,
  tab,
}: {
  entry: LeaderboardEntry;
  rank: number;
  isCurrentUser: boolean;
  tab: LeaderboardTab;
}) {
  const isTop3 = rank <= 3;
  const medalColor = isTop3 ? MEDAL_COLORS[rank - 1] : undefined;

  // Pick the primary stat based on tab
  const primaryStat =
    tab === "weekly"
      ? { icon: "camera", value: entry.weeklySpots ?? 0, color: colors.primary, label: "spots" }
      : tab === "rarity"
      ? { icon: "star", value: entry.rareCount, color: "#f59e0b", label: "rare" }
      : { icon: "layers", value: entry.uniqueTrains, color: colors.primary, label: "classes" };

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

      {/* Stats — varies by tab */}
      <View style={styles.statsSection}>
        {/* Primary stat (always shown) */}
        <View style={[styles.statPill, { backgroundColor: primaryStat.color + "18" }]}>
          <Ionicons name={primaryStat.icon as any} size={12} color={primaryStat.color} />
          <Text style={[styles.statPillText, { color: primaryStat.color }]}>
            {primaryStat.value}
          </Text>
        </View>

        {/* Secondary stats */}
        {tab === "global" && (
          <View style={styles.statPill}>
            <Ionicons name="camera" size={12} color={colors.textMuted} />
            <Text style={styles.statPillMuted}>{entry.totalSpots}</Text>
          </View>
        )}

        {tab === "weekly" && (entry.weeklyUnique ?? 0) > 0 && (
          <View style={styles.statPill}>
            <Ionicons name="layers" size={12} color={colors.textMuted} />
            <Text style={styles.statPillMuted}>{entry.weeklyUnique}</Text>
          </View>
        )}

        {tab === "rarity" && (
          <>
            {(entry.legendaryCount ?? 0) > 0 && (
              <View style={[styles.statPill, styles.statPillLegendary]}>
                <Ionicons name="diamond" size={11} color="#f59e0b" />
                <Text style={styles.statPillLegendaryText}>
                  {entry.legendaryCount}
                </Text>
              </View>
            )}
            {(entry.epicCount ?? 0) > 0 && (
              <View style={[styles.statPill, styles.statPillEpic]}>
                <Ionicons name="sparkles" size={11} color="#a855f7" />
                <Text style={styles.statPillEpicText}>{entry.epicCount}</Text>
              </View>
            )}
          </>
        )}

        {/* Rare badge on global/weekly if they have rare finds */}
        {tab !== "rarity" && entry.rareCount > 0 && (
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

  // Tab bar
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: "transparent",
  },
  tabActive: {
    backgroundColor: colors.surfaceLight,
  },
  tabLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.medium,
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },

  // Region picker
  regionPicker: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  regionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  regionChipActive: {
    backgroundColor: "rgba(0, 212, 170, 0.12)",
    borderColor: colors.accent,
  },
  regionChipText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.medium,
    color: colors.textMuted,
  },
  regionChipTextActive: {
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  emptyInlineContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
    gap: spacing.md,
  },
  emptyInlineTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptyInlineSubtitle: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  // Your rank banner
  yourRankBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    paddingVertical: spacing.sm,
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
  statPillLegendary: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  statPillLegendaryText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: "#f59e0b",
  },
  statPillEpic: {
    backgroundColor: "rgba(168, 85, 247, 0.15)",
  },
  statPillEpicText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    color: "#a855f7",
  },
});
