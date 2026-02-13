// ============================================================
// LocoSnap — Collection Screen
// Shows previously spotted trains with filters, sorting,
// stats header, and duplicate spot counter
// ============================================================

import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTrainStore } from "../../store/trainStore";
import { HistoryItem, RarityTier } from "../../types";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";

// ── Rarity colour map ─────────────────────────────────────────

const rarityColors: Record<RarityTier, string> = {
  common: "#94a3b8",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

const RARITY_ORDER: RarityTier[] = [
  "legendary",
  "epic",
  "rare",
  "uncommon",
  "common",
];

// ── Sort options ──────────────────────────────────────────────

type SortOption = "date" | "rarity" | "name";

const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
  { key: "date", label: "Recent", icon: "time" },
  { key: "rarity", label: "Rarity", icon: "diamond" },
  { key: "name", label: "Name", icon: "text" },
];

// ── Helpers ───────────────────────────────────────────────────

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-GB", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function rarityRank(tier: RarityTier): number {
  return RARITY_ORDER.indexOf(tier);
}

// ── Stats Header ──────────────────────────────────────────────

function StatsHeader({
  history,
  spotCounts,
}: {
  history: HistoryItem[];
  spotCounts: Map<string, number>;
}) {
  const uniqueClasses = spotCounts.size;
  const totalSpots = history.length;

  // Rarity breakdown
  const rarityBreakdown = useMemo(() => {
    const counts: Record<RarityTier, number> = {
      legendary: 0,
      epic: 0,
      rare: 0,
      uncommon: 0,
      common: 0,
    };
    // Count unique classes per rarity (not total spots)
    const seen = new Set<string>();
    for (const item of history) {
      const key = `${item.train.class}::${item.train.operator}`;
      if (!seen.has(key)) {
        seen.add(key);
        counts[item.rarity.tier]++;
      }
    }
    return counts;
  }, [history]);

  return (
    <View style={styles.statsHeader}>
      {/* Top row: unique + total */}
      <View style={styles.statsTopRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{uniqueClasses}</Text>
          <Text style={styles.statLabel}>Unique Classes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{totalSpots}</Text>
          <Text style={styles.statLabel}>Total Spots</Text>
        </View>
      </View>

      {/* Rarity pills */}
      <View style={styles.rarityRow}>
        {RARITY_ORDER.map((tier) =>
          rarityBreakdown[tier] > 0 ? (
            <View
              key={tier}
              style={[
                styles.rarityPill,
                { backgroundColor: rarityColors[tier] + "20" },
              ]}
            >
              <Ionicons
                name="diamond"
                size={10}
                color={rarityColors[tier]}
              />
              <Text
                style={[styles.rarityPillText, { color: rarityColors[tier] }]}
              >
                {rarityBreakdown[tier]}
              </Text>
              <Text
                style={[
                  styles.rarityPillLabel,
                  { color: rarityColors[tier] },
                ]}
              >
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </Text>
            </View>
          ) : null
        )}
      </View>
    </View>
  );
}

// ── Filter Chip ───────────────────────────────────────────────

function FilterChip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        active && {
          backgroundColor: (color || colors.accent) + "25",
          borderColor: color || colors.accent,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.filterChipText,
          active && { color: color || colors.accent },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── History Card ──────────────────────────────────────────────

function HistoryCard({
  item,
  onPress,
  onDelete,
  spotCount,
}: {
  item: HistoryItem;
  onPress: () => void;
  onDelete: () => void;
  spotCount: number;
}) {
  const rarityColor = rarityColors[item.rarity.tier];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardContent}>
        {/* Train icon with rarity glow */}
        <View style={[styles.cardIcon, { borderColor: rarityColor }]}>
          <Ionicons name="train" size={28} color={rarityColor} />
        </View>

        {/* Train info */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>{item.train.class}</Text>
          <Text style={styles.cardSubtitle}>
            {item.train.operator} · {item.train.type}
            {item.train.name ? ` · "${item.train.name}"` : ""}
          </Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardDate}>{formatDate(item.spottedAt)}</Text>
            {spotCount > 1 && (
              <View style={styles.spotCountBadge}>
                <Ionicons name="camera" size={10} color={colors.textMuted} />
                <Text style={styles.spotCountText}>
                  ×{spotCount}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Rarity tier */}
        <View style={styles.cardRarity}>
          <Ionicons name="diamond" size={14} color={rarityColor} />
          <Text style={[styles.cardRarityText, { color: rarityColor }]}>
            {item.rarity.tier.toUpperCase()}
          </Text>
        </View>

        {/* Blueprint indicator */}
        {item.blueprintUrl && (
          <Ionicons
            name="image"
            size={16}
            color={colors.accent}
            style={styles.blueprintIcon}
          />
        )}
      </View>

      {/* Delete button */}
      <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
        <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────

export default function HistoryScreen() {
  const router = useRouter();
  const { history, removeFromHistory, viewHistoryItem } = useTrainStore();

  // Filter state
  const [activeRarityFilter, setActiveRarityFilter] =
    useState<RarityTier | null>(null);
  const [activeOperatorFilter, setActiveOperatorFilter] = useState<
    string | null
  >(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState<SortOption>("date");
  const [showFilters, setShowFilters] = useState(false);

  // Compute unique operators and types from history
  const { operators, trainTypes } = useMemo(() => {
    const opSet = new Set<string>();
    const typeSet = new Set<string>();
    for (const item of history) {
      opSet.add(item.train.operator);
      typeSet.add(item.train.type);
    }
    return {
      operators: Array.from(opSet).sort(),
      trainTypes: Array.from(typeSet).sort(),
    };
  }, [history]);

  // Compute spot counts per unique class (class::operator)
  const spotCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of history) {
      const key = `${item.train.class}::${item.train.operator}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }, [history]);

  // Filter + sort the history
  const filteredHistory = useMemo(() => {
    let filtered = [...history];

    // Apply rarity filter
    if (activeRarityFilter) {
      filtered = filtered.filter(
        (item) => item.rarity.tier === activeRarityFilter
      );
    }

    // Apply operator filter
    if (activeOperatorFilter) {
      filtered = filtered.filter(
        (item) => item.train.operator === activeOperatorFilter
      );
    }

    // Apply type filter
    if (activeTypeFilter) {
      filtered = filtered.filter(
        (item) => item.train.type === activeTypeFilter
      );
    }

    // Sort
    switch (activeSort) {
      case "rarity":
        filtered.sort(
          (a, b) => rarityRank(a.rarity.tier) - rarityRank(b.rarity.tier)
        );
        break;
      case "name":
        filtered.sort((a, b) => a.train.class.localeCompare(b.train.class));
        break;
      case "date":
      default:
        filtered.sort(
          (a, b) =>
            new Date(b.spottedAt).getTime() - new Date(a.spottedAt).getTime()
        );
        break;
    }

    return filtered;
  }, [
    history,
    activeRarityFilter,
    activeOperatorFilter,
    activeTypeFilter,
    activeSort,
  ]);

  const activeFilterCount = [
    activeRarityFilter,
    activeOperatorFilter,
    activeTypeFilter,
  ].filter(Boolean).length;

  const handlePress = (item: HistoryItem) => {
    viewHistoryItem(item);
    router.push("/results");
  };

  const handleDelete = (item: HistoryItem) => {
    Alert.alert(
      "Remove from Collection",
      `Remove ${item.train.class}${item.train.name ? ` "${item.train.name}"` : ""} (${item.train.operator})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeFromHistory(item.id),
        },
      ]
    );
  };

  const clearFilters = () => {
    setActiveRarityFilter(null);
    setActiveOperatorFilter(null);
    setActiveTypeFilter(null);
  };

  // Empty state
  if (history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="albums-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No Spots Yet</Text>
        <Text style={styles.emptySubtitle}>
          Trains you spot will appear here so you can build your collection
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Stats Header ─────────────────────────────────── */}
      <StatsHeader history={history} spotCounts={spotCounts} />

      {/* ── Sort + Filter toolbar ────────────────────────── */}
      <View style={styles.toolbar}>
        {/* Sort pills */}
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.sortPill,
                activeSort === opt.key && styles.sortPillActive,
              ]}
              onPress={() => setActiveSort(opt.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={opt.icon as any}
                size={12}
                color={
                  activeSort === opt.key ? colors.accent : colors.textMuted
                }
              />
              <Text
                style={[
                  styles.sortPillText,
                  activeSort === opt.key && styles.sortPillTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filter toggle */}
        <TouchableOpacity
          style={[
            styles.filterToggle,
            (showFilters || activeFilterCount > 0) &&
              styles.filterToggleActive,
          ]}
          onPress={() => setShowFilters(!showFilters)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="funnel"
            size={14}
            color={
              showFilters || activeFilterCount > 0
                ? colors.accent
                : colors.textMuted
            }
          />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Expandable filter panel ──────────────────────── */}
      {showFilters && (
        <View style={styles.filterPanel}>
          {/* Rarity filters */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionLabel}>Rarity</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChipsRow}
            >
              {RARITY_ORDER.map((tier) => (
                <FilterChip
                  key={tier}
                  label={tier.charAt(0).toUpperCase() + tier.slice(1)}
                  active={activeRarityFilter === tier}
                  color={rarityColors[tier]}
                  onPress={() =>
                    setActiveRarityFilter(
                      activeRarityFilter === tier ? null : tier
                    )
                  }
                />
              ))}
            </ScrollView>
          </View>

          {/* Operator filters */}
          {operators.length > 1 && (
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionLabel}>Operator</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipsRow}
              >
                {operators.map((op) => (
                  <FilterChip
                    key={op}
                    label={op}
                    active={activeOperatorFilter === op}
                    onPress={() =>
                      setActiveOperatorFilter(
                        activeOperatorFilter === op ? null : op
                      )
                    }
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Type filters */}
          {trainTypes.length > 1 && (
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionLabel}>Type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterChipsRow}
              >
                {trainTypes.map((type) => (
                  <FilterChip
                    key={type}
                    label={type}
                    active={activeTypeFilter === type}
                    onPress={() =>
                      setActiveTypeFilter(
                        activeTypeFilter === type ? null : type
                      )
                    }
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={styles.clearFiltersBtn}
              onPress={clearFilters}
            >
              <Ionicons name="close-circle" size={14} color={colors.danger} />
              <Text style={styles.clearFiltersText}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Results count ────────────────────────────────── */}
      {activeFilterCount > 0 && (
        <View style={styles.resultsBar}>
          <Text style={styles.resultsText}>
            {filteredHistory.length} of {history.length} spots
          </Text>
        </View>
      )}

      {/* ── Collection list ──────────────────────────────── */}
      {filteredHistory.length === 0 ? (
        <View style={styles.emptyFilterContainer}>
          <Ionicons name="search" size={40} color={colors.textMuted} />
          <Text style={styles.emptyFilterTitle}>No matches</Text>
          <Text style={styles.emptyFilterSubtitle}>
            Try adjusting your filters
          </Text>
          <TouchableOpacity
            style={styles.clearFiltersBtnLarge}
            onPress={clearFilters}
          >
            <Text style={styles.clearFiltersBtnLargeText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const key = `${item.train.class}::${item.train.operator}`;
            return (
              <HistoryCard
                item={item}
                onPress={() => handlePress(item)}
                onDelete={() => handleDelete(item)}
                spotCount={spotCounts.get(key) || 1}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },

  // Stats header
  statsHeader: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statsTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  rarityRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  rarityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  rarityPillText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
  },
  rarityPillLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.medium,
  },

  // Toolbar (sort + filter toggle)
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  sortRow: {
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
  },
  sortPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
  },
  sortPillActive: {
    backgroundColor: colors.accent + "20",
  },
  sortPillText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.medium,
    color: colors.textMuted,
  },
  sortPillTextActive: {
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },
  filterToggle: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  filterToggleActive: {
    backgroundColor: colors.accent + "15",
  },
  filterBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: fonts.weights.bold,
    color: "#fff",
  },

  // Filter panel
  filterPanel: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  filterSection: {
    gap: spacing.xs,
  },
  filterSectionLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  filterChipsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceLight,
  },
  filterChipText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.medium,
    color: colors.textSecondary,
  },
  clearFiltersBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
  },
  clearFiltersText: {
    fontSize: fonts.sizes.xs,
    color: colors.danger,
    fontWeight: fonts.weights.medium,
  },

  // Results bar
  resultsBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceLight,
  },
  resultsText: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
  },

  // Empty filter state
  emptyFilterContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  emptyFilterTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
  },
  emptyFilterSubtitle: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
  },
  clearFiltersBtnLarge: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
  },
  clearFiltersBtnLargeText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.accent,
  },

  // Card styles
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
    borderWidth: 1,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
  cardDate: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
  },
  spotCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  spotCountText: {
    fontSize: 10,
    fontWeight: fonts.weights.semibold,
    color: colors.textMuted,
  },
  cardRarity: {
    flexDirection: "column",
    alignItems: "center",
    marginLeft: spacing.sm,
    gap: 2,
  },
  cardRarityText: {
    fontSize: 9,
    fontWeight: fonts.weights.bold,
    letterSpacing: 1,
  },
  blueprintIcon: {
    marginLeft: spacing.sm,
  },
  deleteBtn: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.xs,
  },
});
