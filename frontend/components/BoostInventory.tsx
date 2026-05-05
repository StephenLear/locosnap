// ============================================================
// LocoSnap — Boost card inventory (Phase 2 G.3)
//
// Renders the user's available (un-used) boost cards. flat_100 cards
// can be redeemed inline via apply_boost_card RPC; next_scan_2x cards
// are deferred (queued-state machinery lands in v1.0.27).
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { applyBoostCard } from "../services/supabase";
import { supabase } from "../config/supabase";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

interface BoostCard {
  id: number;
  cardType: "flat_100" | "next_scan_2x";
  earnedAt: string;
  earnedReason: "league_promotion" | "four_week_streak";
}

interface Props {
  userId: string;
  onApplied?: (xpAdded: number) => void;
}

export function BoostInventory({ userId, onApplied }: Props) {
  const { t } = useTranslation();
  const [cards, setCards] = useState<BoostCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_boost_inventory")
        .select("id, card_type, earned_at, earned_reason")
        .eq("user_id", userId)
        .is("used_at", null)
        .order("earned_at", { ascending: false });
      if (error) {
        if (error.code !== "42P01" && error.code !== "PGRST205") {
          console.warn("Failed to fetch boost inventory:", error.message);
        }
        setCards([]);
        return;
      }
      setCards(
        (data ?? []).map((c: any) => ({
          id: c.id,
          cardType: c.card_type,
          earnedAt: c.earned_at,
          earnedReason: c.earned_reason,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApply = (card: BoostCard) => {
    if (card.cardType !== "flat_100") {
      Alert.alert(t("leaderboard.boost.notReadyTitle"), t("leaderboard.boost.notReadyBody"));
      return;
    }
    Alert.alert(
      t("leaderboard.boost.confirmTitle"),
      t("leaderboard.boost.confirmBody"),
      [
        { text: t("leaderboard.boost.confirmCancel"), style: "cancel" },
        {
          text: t("leaderboard.boost.confirmCta"),
          onPress: async () => {
            setApplyingId(card.id);
            const result = await applyBoostCard(card.id);
            setApplyingId(null);
            if (result?.applied) {
              onApplied?.(result.xpAdded ?? 0);
              void load();
            } else {
              Alert.alert(t("leaderboard.boost.applyFailed"));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  if (cards.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t("leaderboard.boost.heading")}</Text>
      {cards.map((card) => {
        const isApplying = applyingId === card.id;
        const isReady = card.cardType === "flat_100";
        return (
          <View key={card.id} style={styles.card}>
            <Ionicons
              name={card.cardType === "flat_100" ? "flash" : "rocket"}
              size={18}
              color={colors.accent}
            />
            <View style={styles.cardMeta}>
              <Text style={styles.cardTitle}>
                {t(`leaderboard.boost.types.${card.cardType}.title`)}
              </Text>
              <Text style={styles.cardDescription}>
                {t(`leaderboard.boost.types.${card.cardType}.description`)}
              </Text>
            </View>
            <Pressable
              style={[
                styles.applyBtn,
                (isApplying || !isReady) && styles.applyBtnDisabled,
              ]}
              onPress={() => handleApply(card)}
              disabled={isApplying || !isReady}
            >
              {isApplying ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={styles.applyBtnText}>
                  {isReady
                    ? t("leaderboard.boost.useCta")
                    : t("leaderboard.boost.queuedCta")}
                </Text>
              )}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  heading: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  loadingRow: {
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardMeta: {
    flex: 1,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },
  cardDescription: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
    marginTop: 2,
  },
  applyBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  applyBtnDisabled: {
    opacity: 0.5,
  },
  applyBtnText: {
    color: colors.accent,
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.bold,
  },
});

export default BoostInventory;
