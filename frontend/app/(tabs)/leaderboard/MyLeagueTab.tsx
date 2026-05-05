// ============================================================
// LocoSnap — My League tab (Phase 2 E.2)
//
// Shows the user's current tier, weekly XP, and the top 100 of
// their league shard. Renders promotion zone separator at the top
// 10% slot and demotion zone separator at the bottom 10% slot
// (hidden for Bronze, the floor).
//
// Countdown timer + streak freeze counter are Section G work —
// stubbed here as static placeholders so the tab is functional
// against migration 013 today.
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../../store/authStore";
import {
  fetchLeagueRankings,
  fetchMyLeagueMembership,
  fetchSpotPhotoUrls,
  type LeagueMembership,
  type LeagueRankingRow,
} from "../../../services/supabase";
import {
  BRONZE_TIER,
  VECTRON_TIER,
  demotionSlots,
  getTier,
  promotionSlots,
} from "../../../constants/leagues";
import { colors, fonts, spacing, borderRadius } from "../../../constants/theme";
import { IdentityBadge } from "../../../components/IdentityBadge";
import { FreezeCounter } from "../../../components/FreezeCounter";
import { ThemedDayBanner } from "../../../components/ThemedDayBanner";
import { BoostInventory } from "../../../components/BoostInventory";

export function MyLeagueTab() {
  const { t } = useTranslation();
  const { user, profile } = useAuthStore();
  const freezeCount =
    (profile as { streak_freezes_available?: number } | null)?.streak_freezes_available ?? 0;
  const [membership, setMembership] = useState<LeagueMembership | null>(null);
  const [rankings, setRankings] = useState<LeagueRankingRow[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!user) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const myMembership = await fetchMyLeagueMembership(user.id);
        setMembership(myMembership);

        if (myMembership) {
          const rows = await fetchLeagueRankings(
            myMembership.tierIndex,
            myMembership.leagueShardId
          );
          setRankings(rows);

          const featuredIds = rows
            .map((r) => r.featuredSpotId)
            .filter((id): id is string => id != null);
          if (featuredIds.length > 0) {
            const urls = await fetchSpotPhotoUrls(featuredIds);
            setPhotoUrls(urls);
          } else {
            setPhotoUrls({});
          }
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user]
  );

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.bodyText}>{t("leaderboard.league.signInPrompt")}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!membership) {
    return (
      <View style={styles.center}>
        <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
        <Text style={styles.bodyText}>{t("leaderboard.league.notReady")}</Text>
      </View>
    );
  }

  const tier = getTier(membership.tierIndex);
  const promoCount = promotionSlots(membership.tierIndex, rankings.length);
  const demoCount = demotionSlots(membership.tierIndex, rankings.length);
  const promoteIndex = promoCount > 0 ? promoCount - 1 : -1; // last index inside promote zone
  const demoteIndex =
    demoCount > 0 ? rankings.length - demoCount : rankings.length;

  return (
    <FlatList
      data={rankings}
      keyExtractor={(row, index) => row.userId || `row-${index}`}
      ListHeaderComponent={
        <View>
          <LeagueHeader
            tierKey={tier.key}
            tierColor={tier.color}
            membership={membership}
            freezeCount={freezeCount}
            t={t}
          />
          <ThemedDayBanner />
          {user && <BoostInventory userId={user.id} />}
        </View>
      }
      renderItem={({ item, index }) => {
        const rank = index + 1;
        const isMe = item.userId === user.id;
        const showPromoteSeparatorAfter =
          membership.tierIndex < VECTRON_TIER && index === promoteIndex;
        const showDemoteSeparatorBefore =
          membership.tierIndex > BRONZE_TIER && index === demoteIndex;
        const photoUrl = item.featuredSpotId
          ? photoUrls[item.featuredSpotId] ?? null
          : null;
        return (
          <>
            {showDemoteSeparatorBefore && (
              <ZoneSeparator
                label={t("leaderboard.league.demotionZone")}
                color={colors.danger}
              />
            )}
            <LeagueRow
              row={item}
              rank={rank}
              isMe={isMe}
              featuredPhotoUrl={photoUrl}
            />
            {showPromoteSeparatorAfter && (
              <ZoneSeparator
                label={t("leaderboard.league.promotionZone")}
                color={colors.success}
              />
            )}
          </>
        );
      }}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.bodyText}>{t("leaderboard.league.empty")}</Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadData(true)}
          tintColor={colors.accent}
        />
      }
      contentContainerStyle={styles.listContent}
    />
  );
}

// ── Sub-components ───────────────────────────────────────────

function LeagueHeader({
  tierKey,
  tierColor,
  membership,
  freezeCount,
  t,
}: {
  tierKey: string;
  tierColor: string;
  membership: LeagueMembership;
  freezeCount: number;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  return (
    <View style={styles.header}>
      <View style={[styles.tierBadge, { borderColor: tierColor }]}>
        <Text style={[styles.tierLabel, { color: tierColor }]}>
          {t(`leaderboard.league.tier.${tierKey}`)}
        </Text>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.weeklyXp}>
          {membership.weeklyXp} {t("leaderboard.league.weeklyXp")}
        </Text>
        <FreezeCounter count={freezeCount} />
      </View>
    </View>
  );
}

function ZoneSeparator({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.zoneSeparator, { borderColor: color }]}>
      <Text style={[styles.zoneLabel, { color }]}>{label}</Text>
    </View>
  );
}

function LeagueRow({
  row,
  rank,
  isMe,
  featuredPhotoUrl,
}: {
  row: LeagueRankingRow;
  rank: number;
  isMe: boolean;
  featuredPhotoUrl: string | null;
}) {
  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <Text style={[styles.rank, isMe && styles.rankMe]}>{rank}</Text>
      <View style={styles.rowMeta}>
        <View style={styles.usernameLine}>
          <Text style={[styles.username, isMe && styles.usernameMe]} numberOfLines={1}>
            {row.username}
          </Text>
          <IdentityBadge
            countryCode={row.countryCode}
            emojiId={row.spotterEmoji}
            size="sm"
          />
        </View>
        <Text style={styles.rowXp}>{row.weeklyXp} XP</Text>
      </View>
      {featuredPhotoUrl ? (
        <Image
          source={{ uri: featuredPhotoUrl }}
          style={styles.featuredThumb}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.featuredThumb, styles.featuredThumbEmpty]}>
          <Ionicons name="image-outline" size={18} color={colors.textMuted} />
        </View>
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    textAlign: "center",
  },
  listContent: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  tierBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 2,
    borderRadius: borderRadius.md,
  },
  tierLabel: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  weeklyXp: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
  },
  zoneSeparator: {
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderStyle: "dashed",
    marginVertical: spacing.sm,
    paddingVertical: spacing.xs,
    alignItems: "center",
  },
  zoneLabel: {
    fontSize: fonts.sizes.xs,
    fontWeight: fonts.weights.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  rowMe: {
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  rank: {
    color: colors.textMuted,
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    minWidth: 32,
    textAlign: "center",
  },
  rankMe: {
    color: colors.accent,
  },
  rowMeta: {
    flex: 1,
  },
  usernameLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  username: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    flexShrink: 1,
  },
  usernameMe: {
    color: colors.accent,
  },
  rowXp: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginTop: 2,
  },
  featuredThumb: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceLight,
  },
  featuredThumbEmpty: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default MyLeagueTab;
