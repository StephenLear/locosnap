// ============================================================
// LocoSnap — Pro expiring-soon banner (v1.0.35 Phase F)
//
// Persistent card shown to Pro subscribers whose entitlement
// expires within 7 days AND won't auto-renew. Replaces the manual
// email-recovery loop (Luis + Wojciech batch sent 2026-05-24) —
// users now see the re-subscribe surface in-app before their Pro
// lapses, without needing Stephen to manually email each one.
//
// Hide conditions (all evaluated by decideBannerVisibility):
//   - Not Pro
//   - No entitlement (legacy manually-granted Pro users)
//   - Lifetime Pro (no expirationDate)
//   - Auto-renewing (willRenew=true) — RC will handle it
//   - Expiration > 7 days out OR already expired
//
// Self-gating per the ProRescuePrompt / HomeProUpsellCard
// pattern: parent just mounts <ProExpiringBanner /> with no
// props. Pure-logic decision is in
// components/ProExpiringBanner-helpers.ts (ts-jest tested).
// ============================================================

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/authStore";
import {
  getProEntitlementInfo,
  type ProEntitlementInfo,
} from "../services/purchases";
import { track } from "../services/analytics";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";
import { decideBannerVisibility } from "./ProExpiringBanner-helpers";

const WARNING_ORANGE = "#FF8C42";
const WARNING_SUBTLE = "rgba(255, 140, 66, 0.10)";

export function ProExpiringBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const [entitlement, setEntitlement] = useState<ProEntitlementInfo | null>(
    null
  );

  // Refresh RC entitlement state. Called on mount, on profile.is_pro
  // change, and on every AppState transition to "active" so a user
  // who renewed in the App Store / Play Store sees the banner clear
  // on next foreground without a hard restart.
  const refresh = useCallback(async () => {
    if (profile?.is_pro !== true) {
      setEntitlement(null);
      return;
    }
    try {
      const info = await getProEntitlementInfo();
      setEntitlement(info);
    } catch {
      // getProEntitlementInfo already swallows errors; defence in depth
      setEntitlement(null);
    }
  }, [profile?.is_pro]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const decision = decideBannerVisibility({
    isPro: profile?.is_pro === true,
    entitlement: entitlement
      ? {
          expirationDate: entitlement.expirationDate,
          willRenew: entitlement.willRenew,
        }
      : null,
    now: new Date().toISOString(),
  });

  useEffect(() => {
    if (decision.show) {
      track("pro_expiring_banner_shown", {
        daysRemaining: decision.daysRemaining,
      });
    }
  }, [decision.show, decision.show ? decision.daysRemaining : 0]);

  if (!decision.show) return null;

  const onTap = () => {
    track("pro_expiring_banner_tapped", {
      daysRemaining: decision.daysRemaining,
    });
    router.push("/paywall?source=expiring_banner" as any);
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onTap}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t("pro.expiring.title")}
    >
      <View style={styles.iconCircle}>
        <Ionicons name="time-outline" size={20} color={WARNING_ORANGE} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{t("pro.expiring.title")}</Text>
        <Text style={styles.body} numberOfLines={2}>
          {t("pro.expiring.body", {
            count: decision.daysRemaining,
            days: decision.daysRemaining,
          })}
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
    backgroundColor: WARNING_SUBTLE,
    borderColor: "rgba(255, 140, 66, 0.35)",
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 140, 66, 0.16)",
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
