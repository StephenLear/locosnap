// ============================================================
// LocoSnap — Train Comparison Screen
// Side-by-side spec comparison of two trains from the collection
// ============================================================

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTrainStore } from "../store/trainStore";
import { RarityTier } from "../types";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

// ── Rarity colours ──────────────────────────────────────────
const rarityColors: Record<RarityTier, string> = {
  common: "#94a3b8",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

// ── Helpers ─────────────────────────────────────────────────

function parseNumeric(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/[\d,.]+/);
  if (!match) return null;
  return parseFloat(match[0].replace(/,/g, ""));
}

type Winner = "left" | "right" | "tie" | "none";

function compareValues(
  leftVal: string | null,
  rightVal: string | null,
  higherIsBetter: boolean = true
): Winner {
  const leftNum = parseNumeric(leftVal);
  const rightNum = parseNumeric(rightVal);
  if (leftNum === null || rightNum === null) return "none";
  if (leftNum === rightNum) return "tie";
  if (higherIsBetter) {
    return leftNum > rightNum ? "left" : "right";
  }
  return leftNum < rightNum ? "left" : "right";
}

// ── Comparison Row ──────────────────────────────────────────

function CompRow({
  label,
  leftVal,
  rightVal,
  higherIsBetter = true,
}: {
  label: string;
  leftVal: string | null;
  rightVal: string | null;
  higherIsBetter?: boolean;
}) {
  const winner = compareValues(leftVal, rightVal, higherIsBetter);

  return (
    <View style={styles.compRow}>
      <Text
        style={[
          styles.compValue,
          styles.compValueLeft,
          winner === "left" && styles.compValueWinner,
        ]}
      >
        {leftVal || "—"}
      </Text>
      <Text style={styles.compLabel}>{label}</Text>
      <Text
        style={[
          styles.compValue,
          styles.compValueRight,
          winner === "right" && styles.compValueWinner,
        ]}
      >
        {rightVal || "—"}
      </Text>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────

export default function CompareScreen() {
  const router = useRouter();
  const { compareItems } = useTrainStore();

  if (!compareItems || compareItems.length < 2) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="swap-horizontal" size={64} color={colors.textMuted} />
        <Text style={styles.emptyText}>No trains selected for comparison</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.emptyLink}>Go back and select trains</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const [left, right] = compareItems;
  const leftColor = rarityColors[left.rarity.tier];
  const rightColor = rarityColors[right.rarity.tier];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* ── Train Headers ────────────────────────────── */}
      <View style={styles.headerRow}>
        <View style={styles.headerCol}>
          <View style={[styles.rarityDot, { backgroundColor: leftColor }]} />
          <Text style={styles.headerClass} numberOfLines={1}>
            {left.train.class}
          </Text>
          {left.train.name && (
            <Text style={styles.headerName} numberOfLines={1}>
              "{left.train.name}"
            </Text>
          )}
          <Text style={styles.headerMeta} numberOfLines={1}>
            {left.train.operator}
          </Text>
          <Text style={styles.headerType}>{left.train.type}</Text>
        </View>

        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        <View style={[styles.headerCol, styles.headerColRight]}>
          <View style={[styles.rarityDot, { backgroundColor: rightColor }]} />
          <Text style={styles.headerClass} numberOfLines={1}>
            {right.train.class}
          </Text>
          {right.train.name && (
            <Text style={styles.headerName} numberOfLines={1}>
              "{right.train.name}"
            </Text>
          )}
          <Text style={styles.headerMeta} numberOfLines={1}>
            {right.train.operator}
          </Text>
          <Text style={styles.headerType}>{right.train.type}</Text>
        </View>
      </View>

      {/* ── Rarity Comparison ────────────────────────── */}
      <View style={styles.rarityRow}>
        <View
          style={[
            styles.rarityBadge,
            { backgroundColor: leftColor + "20", borderColor: leftColor },
          ]}
        >
          <Ionicons name="diamond" size={12} color={leftColor} />
          <Text style={[styles.rarityText, { color: leftColor }]}>
            {left.rarity.tier.toUpperCase()}
          </Text>
        </View>
        <View
          style={[
            styles.rarityBadge,
            { backgroundColor: rightColor + "20", borderColor: rightColor },
          ]}
        >
          <Ionicons name="diamond" size={12} color={rightColor} />
          <Text style={[styles.rarityText, { color: rightColor }]}>
            {right.rarity.tier.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ── Spec Comparison Table ─────────────────────── */}
      <View style={styles.compTable}>
        <Text style={styles.compTableTitle}>Specifications</Text>

        <CompRow
          label="Max Speed"
          leftVal={left.specs.maxSpeed}
          rightVal={right.specs.maxSpeed}
        />
        <CompRow
          label="Power"
          leftVal={left.specs.power}
          rightVal={right.specs.power}
        />
        <CompRow
          label="Weight"
          leftVal={left.specs.weight}
          rightVal={right.specs.weight}
          higherIsBetter={false}
        />
        <CompRow
          label="Length"
          leftVal={left.specs.length}
          rightVal={right.specs.length}
        />
        <CompRow
          label="Builder"
          leftVal={left.specs.builder}
          rightVal={right.specs.builder}
        />
        <CompRow
          label="Year Built"
          leftVal={left.train.yearBuilt?.toString() || null}
          rightVal={right.train.yearBuilt?.toString() || null}
        />
        <CompRow
          label="Gauge"
          leftVal={left.specs.gauge}
          rightVal={right.specs.gauge}
        />
        <CompRow
          label="Fuel"
          leftVal={left.specs.fuelType}
          rightVal={right.specs.fuelType}
        />
        <CompRow
          label="Built"
          leftVal={
            left.specs.numberBuilt ? `${left.specs.numberBuilt} units` : null
          }
          rightVal={
            right.specs.numberBuilt ? `${right.specs.numberBuilt} units` : null
          }
        />
        <CompRow
          label="Surviving"
          leftVal={
            left.specs.numberSurviving
              ? `${left.specs.numberSurviving} units`
              : null
          }
          rightVal={
            right.specs.numberSurviving
              ? `${right.specs.numberSurviving} units`
              : null
          }
        />
        <CompRow
          label="Status"
          leftVal={left.specs.status}
          rightVal={right.specs.status}
        />
      </View>

      {/* Bottom spacing */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    padding: spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  emptyText: {
    fontSize: fonts.sizes.lg,
    color: colors.textSecondary,
  },
  emptyLink: {
    fontSize: fonts.sizes.md,
    color: colors.primary,
  },

  // Header row
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  headerCol: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  headerColRight: {
    alignItems: "center",
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  headerClass: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
  },
  headerName: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.accent,
    textAlign: "center",
  },
  headerMeta: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    textAlign: "center",
  },
  headerType: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    textAlign: "center",
  },
  vsContainer: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.lg,
  },
  vsText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.bold,
    color: colors.textMuted,
    letterSpacing: 2,
  },

  // Rarity badges
  rarityRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: spacing.xl,
  },
  rarityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  rarityText: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    letterSpacing: 1,
  },

  // Comparison table
  compTable: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compTableTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  compRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  compLabel: {
    width: 80,
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.semibold,
    color: colors.textMuted,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  compValue: {
    flex: 1,
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    fontWeight: fonts.weights.medium,
  },
  compValueLeft: {
    textAlign: "right",
    paddingRight: spacing.sm,
  },
  compValueRight: {
    textAlign: "left",
    paddingLeft: spacing.sm,
  },
  compValueWinner: {
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },
});
