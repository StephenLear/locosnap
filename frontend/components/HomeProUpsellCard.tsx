// ============================================================
// LocoSnap — Home Pro upsell card (v1.0.35 Phase B)
//
// Persistent, non-dismissable card shown near the top of the
// scan screen to signed-in free users. Replaces the discrete
// scan_2 / scan_4 / scan_5 / scan_6 PaywallSoftPrompt variants
// on the home surface — Pro users see nothing, unauthenticated
// trial users see the existing guest banner instead.
//
// Two states driven by daily_scans_used:
//   - persistent: counter, taps through to /paywall
//   - locked   : when scansUsed >= MAX_FREE_SCANS, swaps copy +
//                visual treatment to mirror the old scan_6
//                lockout (no dismiss, urgent colour).
//
// Self-gating follows the ProRescuePrompt pattern: the parent
// just mounts <HomeProUpsellCard /> with no props; the card
// decides whether to render. Keeps app/(tabs)/index.tsx clean.
// ============================================================

import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/authStore";
import { track } from "../services/analytics";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

const TEAL = "#00D4AA";
const TEAL_SUBTLE = "rgba(0, 212, 170, 0.08)";
const LOCKED_ORANGE = "#FF6B35";

// Keep in sync with backend MAX_FREE_SCANS. The 3-lifetime number is
// referenced in three places (this card, the backend identify route,
// and the scan_6 paywall headline) — a future cleanup could centralise
// this in a shared constants module.
const MAX_FREE_SCANS = 3;

export function HomeProUpsellCard() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile, session } = useAuthStore();

  // Self-gate: signed-in free users only. Pro users + unauthenticated
  // trial users render nothing (their respective banners cover them).
  const eligible = !!session && profile?.is_pro === false;

  const scansUsed = profile?.daily_scans_used ?? 0;
  const isLocked = scansUsed >= MAX_FREE_SCANS;
  const remaining = Math.max(0, MAX_FREE_SCANS - scansUsed);

  useEffect(() => {
    if (eligible) {
      track("home_pro_upsell_shown", { scansUsed, isLocked });
    }
  }, [eligible, scansUsed, isLocked]);

  if (!eligible) return null;

  const onTap = () => {
    track("home_pro_upsell_tapped", { scansUsed, isLocked });
    router.push(
      `/paywall?source=home_persistent${isLocked ? "_locked" : ""}` as any
    );
  };

  const titleKey = isLocked
    ? "scan.proUpsell.locked.title"
    : "scan.proUpsell.persistent.title";
  const bodyKey = isLocked
    ? "scan.proUpsell.locked.body"
    : "scan.proUpsell.persistent.body";

  return (
    <TouchableOpacity
      style={[styles.container, isLocked && styles.containerLocked]}
      onPress={onTap}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t(titleKey)}
    >
      <View style={[styles.iconCircle, isLocked && styles.iconCircleLocked]}>
        <Ionicons
          name={isLocked ? "lock-closed" : "diamond-outline"}
          size={20}
          color={isLocked ? LOCKED_ORANGE : TEAL}
        />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{t(titleKey)}</Text>
        <Text style={styles.body} numberOfLines={2}>
          {t(bodyKey, { count: remaining, remaining })}
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
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  containerLocked: {
    backgroundColor: "rgba(255, 107, 53, 0.10)",
    borderColor: "rgba(255, 107, 53, 0.35)",
    borderWidth: 1.5,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 212, 170, 0.14)",
    justifyContent: "center",
    alignItems: "center",
  },
  iconCircleLocked: {
    backgroundColor: "rgba(255, 107, 53, 0.16)",
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
