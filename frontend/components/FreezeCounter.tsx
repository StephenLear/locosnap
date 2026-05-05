// ============================================================
// LocoSnap — Freeze counter (Phase 2 G.1)
//
// Small inline badge on the league header showing how many streak
// freezes the user has banked. Tapping opens an explainer modal.
// Pulls live from profiles.streak_freezes_available via authStore.
// ============================================================

import React, { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

interface Props {
  count: number;
}

export function FreezeCounter({ count }: Props) {
  const { t } = useTranslation();
  const [explainerOpen, setExplainerOpen] = useState(false);

  return (
    <>
      <Pressable
        style={styles.counter}
        onPress={() => setExplainerOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("leaderboard.freeze.a11yLabel", { count })}
      >
        <Ionicons name="snow" size={14} color={colors.accent} />
        <Text style={styles.count}>{count}</Text>
      </Pressable>

      <Modal
        visible={explainerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setExplainerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setExplainerOpen(false)}>
          <Pressable style={styles.modalBody} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Ionicons name="snow" size={20} color={colors.accent} />
              <Text style={styles.modalTitle}>{t("leaderboard.freeze.title")}</Text>
            </View>
            <Text style={styles.modalText}>{t("leaderboard.freeze.body")}</Text>
            <Pressable
              style={styles.modalDismiss}
              onPress={() => setExplainerOpen(false)}
            >
              <Text style={styles.modalDismissText}>
                {t("leaderboard.freeze.dismiss")}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  counter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  count: {
    color: colors.accent,
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.bold,
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
  },
  modalText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  modalDismiss: {
    alignSelf: "flex-end",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalDismissText: {
    color: colors.accent,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },
});

export default FreezeCounter;
