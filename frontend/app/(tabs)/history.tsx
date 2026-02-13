// ============================================================
// LocoSnap — Collection Screen
// Shows previously spotted trains with rarity badges
// ============================================================

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTrainStore } from "../../store/trainStore";
import { HistoryItem, RarityTier } from "../../types";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";

const rarityColors: Record<RarityTier, string> = {
  common: "#94a3b8",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

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

function HistoryCard({
  item,
  onPress,
  onDelete,
}: {
  item: HistoryItem;
  onPress: () => void;
  onDelete: () => void;
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
          <Text style={styles.cardDate}>{formatDate(item.spottedAt)}</Text>
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

export default function HistoryScreen() {
  const router = useRouter();
  const { history, removeFromHistory, viewHistoryItem } = useTrainStore();

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
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoryCard
            item={item}
            onPress={() => handlePress(item)}
            onDelete={() => handleDelete(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.lg,
  },
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
  cardDate: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    marginTop: 2,
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
