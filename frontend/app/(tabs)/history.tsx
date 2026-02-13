// ============================================================
// CarSnap — History Screen
// Shows previously scanned cars
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
import { useCarStore } from "../../store/carStore";
import { HistoryItem } from "../../types";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";

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

  return date.toLocaleDateString("en-US", {
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
  const scoreColor =
    item.reviews.overallScore >= 7.5
      ? colors.success
      : item.reviews.overallScore >= 5
        ? colors.warning
        : colors.danger;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardContent}>
        {/* Car icon or infographic thumbnail */}
        <View style={styles.cardIcon}>
          <Ionicons name="car-sport" size={28} color={colors.accent} />
        </View>

        {/* Car info */}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle}>
            {item.car.make} {item.car.model}
          </Text>
          <Text style={styles.cardSubtitle}>
            {item.car.year} · {item.car.trim} · {item.car.color}
          </Text>
          <Text style={styles.cardDate}>{formatDate(item.scannedAt)}</Text>
        </View>

        {/* Score */}
        <View style={styles.cardScore}>
          <Text style={[styles.cardScoreValue, { color: scoreColor }]}>
            {item.reviews.overallScore.toFixed(1)}
          </Text>
          <Text style={styles.cardScoreLabel}>/10</Text>
        </View>

        {/* Infographic indicator */}
        {item.infographicUrl && (
          <Ionicons
            name="image"
            size={16}
            color={colors.accent}
            style={styles.infographicIcon}
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
  const { history, removeFromHistory, viewHistoryItem } = useCarStore();

  const handlePress = (item: HistoryItem) => {
    viewHistoryItem(item);
    router.push("/results");
  };

  const handleDelete = (item: HistoryItem) => {
    Alert.alert(
      "Remove from History",
      `Remove ${item.car.year} ${item.car.make} ${item.car.model}?`,
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
        <Ionicons name="time-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No Scans Yet</Text>
        <Text style={styles.emptySubtitle}>
          Cars you scan will appear here so you can revisit them anytime
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
  cardScore: {
    flexDirection: "row",
    alignItems: "baseline",
    marginLeft: spacing.sm,
  },
  cardScoreValue: {
    fontSize: fonts.sizes.xl,
    fontWeight: fonts.weights.bold,
  },
  cardScoreLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    marginLeft: 2,
  },
  infographicIcon: {
    marginLeft: spacing.sm,
  },
  deleteBtn: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    padding: spacing.xs,
  },
});
