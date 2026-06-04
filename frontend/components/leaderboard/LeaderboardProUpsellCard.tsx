// ============================================================
// LocoSnap — Leaderboard Pro upsell card (v1.0.38)
//
// Contextual upsell for the Leaderboard tab, which previously had
// NO upgrade entry point at all. Tied to the leaderboard context:
// Pro = unlimited scans = more spots count toward your rank, so the
// framing is "climb faster" rather than a generic banner. Mirrors
// the self-gating pattern of HomeProUpsellCard — the parent mounts
// <LeaderboardProUpsellCard /> with no props and the card decides
// whether to render.
//
// Gating matches HomeProUpsellCard: signed-in free users only. Pro
// users and unauthenticated guests render nothing — keeps the
// leaderboard clean for everyone who shouldn't see an upsell.
// ============================================================

import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authStore";
import { track } from "../../services/analytics";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";

const TEAL = "#00D4AA";
const TEAL_SUBTLE = "rgba(0, 212, 170, 0.08)";

export function LeaderboardProUpsellCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, session } = useAuthStore();

  // Self-gate: signed-in free users only (same rule as HomeProUpsellCard).
  const eligible = !!session && profile?.is_pro === false;

  useEffect(() => {
    if (eligible) {
      track("leaderboard_pro_upsell_shown", {});
    }
  }, [eligible]);

  if (!eligible) return null;

  const onTap = () => {
    track("leaderboard_pro_upsell_tapped", {});
    router.push("/paywall?source=leaderboard" as any);
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onTap}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t("leaderboard.proUpsell.title")}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="trending-up" size={20} color={TEAL} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{t("leaderboard.proUpsell.title")}</Text>
        <Text style={styles.body} numberOfLines={2}>
          {t("leaderboard.proUpsell.body")}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL_SUBTLE,
    borderColor: "rgba(0, 212, 170, 0.20)",
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 212, 170, 0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  body: {
    fontSize: fonts.sizes.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
