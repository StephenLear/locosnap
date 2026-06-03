// ============================================================
// LocoSnap — Rarity score explainer (v1.0.37)
//
// Shown on the Collection tab's "Rarity" sub-view. A VISIBLE,
// labelled banner (deliberately not a bare info-icon — the v1.0.30
// LeagueAboutButton icon was undiscoverable; Steph flagged the
// scoring as opaque three times: 2026-04-24 / 05-09 / 05-31, the
// last being specifically "I have 552 points but don't know how").
//
// Tapping opens a modal that (a) states the weights in plain words,
// (b) clarifies commons/uncommons don't count, and (c) decomposes
// the user's OWN score so the total matches the number on their row.
// ============================================================

import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  buildRarityScoreBreakdown,
  type RarityCounts,
} from "../../constants/rarityScore";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";

export function RarityScoreInfo({
  myCounts,
}: {
  // The current user's own rare/epic/legendary counts, or null when
  // they aren't on the board yet. Drives the personal breakdown.
  myCounts: RarityCounts | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const breakdown = myCounts ? buildRarityScoreBreakdown(myCounts) : null;
  const hasScore = !!breakdown && breakdown.total > 0;

  return (
    <>
      <Pressable
        style={styles.banner}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("leaderboard.scoring.banner")}
      >
        <Ionicons name="calculator-outline" size={16} color={colors.accent} />
        <Text style={styles.bannerText} numberOfLines={1}>
          {hasScore
            ? t("leaderboard.scoring.bannerWithTotal", {
                total: breakdown!.total,
              })
            : t("leaderboard.scoring.banner")}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.modalBody} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Ionicons
                name="calculator-outline"
                size={20}
                color={colors.accent}
              />
              <Text style={styles.modalTitle}>
                {t("leaderboard.scoring.title")}
              </Text>
            </View>

            <Text style={styles.modalText}>
              {t("leaderboard.scoring.intro")}
            </Text>
            <Text style={styles.weights}>
              {t("leaderboard.scoring.weights")}
            </Text>
            <Text style={styles.notCounted}>
              {t("leaderboard.scoring.notCounted")}
            </Text>

            {hasScore ? (
              <View style={styles.breakdownBox}>
                <Text style={styles.breakdownTitle}>
                  {t("leaderboard.scoring.yourScoreTitle")}
                </Text>
                {breakdown!.lines.map((line) => (
                  <Text key={line.tier} style={styles.breakdownLine}>
                    {t("leaderboard.scoring.line", {
                      count: line.count,
                      tier: t(`rarity.${line.tier}`),
                      weight: line.weight,
                      subtotal: line.subtotal,
                    })}
                  </Text>
                ))}
                <View style={styles.totalDivider} />
                <Text style={styles.breakdownTotal}>
                  {t("leaderboard.scoring.total", { total: breakdown!.total })}
                </Text>
              </View>
            ) : (
              <Text style={styles.emptyState}>
                {t("leaderboard.scoring.empty")}
              </Text>
            )}

            <Pressable
              style={styles.modalDismiss}
              onPress={() => setOpen(false)}
            >
              <Text style={styles.modalDismissText}>
                {t("leaderboard.scoring.dismiss")}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalBody: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    flexShrink: 1,
  },
  modalText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  weights: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    marginBottom: spacing.xs,
  },
  notCounted: {
    color: colors.textMuted,
    fontSize: fonts.sizes.sm,
    fontStyle: "italic",
    marginBottom: spacing.md,
  },
  breakdownBox: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  breakdownTitle: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    marginBottom: spacing.xs,
  },
  breakdownLine: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    lineHeight: 22,
  },
  totalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  breakdownTotal: {
    color: colors.accent,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
  },
  emptyState: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  modalDismiss: {
    alignSelf: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  modalDismissText: {
    color: colors.accent,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },
});

export default RarityScoreInfo;
