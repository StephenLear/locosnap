// ============================================================
// LocoSnap — "How this works" info button + modal (v1.0.30)
//
// Sits in the LeagueHeader on the This Week tab. Tapping opens a
// modal that maps the weekly-XP / league concepts back to Steph's
// 2026-05-09 mental model ("by how many trains you spot then the
// different classes") — explicitly points users at the Country
// and Collection tabs for the simpler total-spots / unique-classes
// rankings without a weekly reset.
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
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";

export function LeagueAboutButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={styles.iconButton}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t("leaderboard.league.aboutA11y")}
        hitSlop={8}
      >
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={colors.textSecondary}
        />
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
                name="information-circle-outline"
                size={20}
                color={colors.accent}
              />
              <Text style={styles.modalTitle}>
                {t("leaderboard.league.about.title")}
              </Text>
            </View>
            <Text style={styles.modalText}>
              {t("leaderboard.league.about.intro")}
            </Text>
            <Text style={styles.modalSubheading}>
              {t("leaderboard.league.about.earnTitle")}
            </Text>
            <Text style={styles.modalText}>
              {t("leaderboard.league.about.earnBody")}
            </Text>
            <Text style={styles.modalSubheading}>
              {t("leaderboard.league.about.tiersTitle")}
            </Text>
            <Text style={styles.modalText}>
              {t("leaderboard.league.about.tiersBody")}
            </Text>
            <Pressable style={styles.modalDismiss} onPress={() => setOpen(false)}>
              <Text style={styles.modalDismissText}>
                {t("leaderboard.league.about.dismiss")}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    padding: 4,
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
  modalSubheading: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  modalText: {
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

export default LeagueAboutButton;
