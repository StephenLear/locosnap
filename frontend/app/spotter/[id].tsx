// ============================================================
// LocoSnap — Public Spotter screen (Social Phase 1, read-only)
//
// Reached by tapping a spotter on any leaderboard row. Shows that
// spotter's PUBLIC collection (classes / rarity / blueprints) ONLY if
// they opted in (profiles.is_public). Privacy posture P-A: NO location,
// NO user photos — the RPCs never return those fields.
//
// Cards are non-interactive previews (they do NOT open card-reveal,
// which is owner-gated by migration 018). States: loading, self-view
// (redirect to own Profile), private, empty, error, loaded.
// ============================================================

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import {
  fetchPublicProfile,
  fetchPublicCollection,
} from "../../services/supabase";
import { PublicProfile, PublicCollectionItem, RarityTier } from "../../types";
import { IdentityBadge } from "../../components/IdentityBadge";
import { localiseClassName } from "../../utils/classDisplay";
import { colors, fonts, spacing, borderRadius } from "../../constants/theme";

const rarityColors: Record<RarityTier, string> = {
  common: "#94a3b8",
  uncommon: "#22c55e",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

type ScreenState = "loading" | "loaded" | "private" | "error";

export default function SpotterScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const currentUserId = useAuthStore((s) => s.user?.id);

  const [state, setState] = useState<ScreenState>("loading");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [items, setItems] = useState<PublicCollectionItem[]>([]);

  // Self-view → send to own Profile (Phase 1 has no "preview how others
  // see me" view). Redirect before any fetch.
  const isSelf = !!id && !!currentUserId && id === currentUserId;

  useEffect(() => {
    if (isSelf) router.replace("/(tabs)/profile");
  }, [isSelf, router]);

  const load = useCallback(async () => {
    if (!id || isSelf) return;
    setState("loading");
    try {
      const prof = await fetchPublicProfile(id);
      if (!prof) {
        // Null = private, not found, or RPC not yet deployed. All read
        // as "private" to the viewer (the safe default).
        setState("private");
        return;
      }
      const collection = await fetchPublicCollection(id, 100, 0);
      setProfile(prof);
      setItems(collection);
      setState("loaded");
    } catch {
      setState("error");
    }
  }, [id, isSelf]);

  useEffect(() => {
    load();
  }, [load]);

  const title = profile?.username ?? t("spotter.title");

  // Don't flash content while redirecting a self-view.
  if (isSelf) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: "" }} />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title }} />

      {state === "loading" ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : state === "private" ? (
        <View style={styles.center}>
          <Ionicons name="lock-closed" size={40} color={colors.textSecondary} />
          <Text style={styles.stateText}>{t("spotter.private")}</Text>
        </View>
      ) : state === "error" ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline" size={40} color={colors.textSecondary} />
          <Text style={styles.stateText}>{t("spotter.error")}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, i) => item.spotId || `s-${i}`}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={profile ? <ProfileHeader profile={profile} /> : null}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.stateText}>{t("spotter.empty")}</Text>
            </View>
          }
          renderItem={({ item }) => <SpotterCard item={item} />}
        />
      )}
    </View>
  );
}

function ProfileHeader({ profile }: { profile: PublicProfile }) {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <View style={styles.headerIdentity}>
        <IdentityBadge
          countryCode={profile.countryCode}
          emojiId={profile.spotterEmoji}
          size="lg"
        />
        <Text style={styles.headerName} numberOfLines={1}>
          {profile.username}
        </Text>
      </View>
      <View style={styles.statRow}>
        <Stat value={profile.totalSpots} label={t("spotter.spots")} />
        <Stat value={profile.uniqueClasses} label={t("spotter.classes")} />
        <Stat value={profile.rareCount} label={t("spotter.rare")} color={rarityColors.rare} />
        <Stat value={profile.epicCount} label={t("spotter.epic")} color={rarityColors.epic} />
        <Stat
          value={profile.legendaryCount}
          label={t("spotter.legendary")}
          color={rarityColors.legendary}
        />
      </View>
    </View>
  );
}

function Stat({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SpotterCard({ item }: { item: PublicCollectionItem }) {
  const { t, i18n } = useTranslation();
  const tierColor = rarityColors[item.rarityTier] ?? rarityColors.common;
  return (
    <View style={[styles.card, { borderColor: tierColor }]}>
      <View style={styles.cardThumb}>
        {item.blueprintUrl ? (
          <Image
            source={{ uri: item.blueprintUrl }}
            style={styles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="train" size={32} color={tierColor} />
        )}
      </View>
      <Text style={styles.cardClass} numberOfLines={1}>
        {localiseClassName(item.class, i18n.language)}
      </Text>
      {item.name ? (
        <Text style={styles.cardName} numberOfLines={1}>
          "{item.name}"
        </Text>
      ) : null}
      <Text style={styles.cardOperator} numberOfLines={1}>
        {item.operator}
      </Text>
      <View style={[styles.rarityPill, { backgroundColor: tierColor + "20", borderColor: tierColor }]}>
        <Text style={[styles.rarityText, { color: tierColor }]}>
          {t(`rarity.${item.rarityTier}`).toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    textAlign: "center",
  },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  header: { paddingVertical: spacing.lg, gap: spacing.md },
  headerIdentity: { alignItems: "center", gap: spacing.sm },
  headerName: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.xl,
    fontWeight: "700",
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
  },
  stat: { alignItems: "center" },
  statValue: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.lg,
    fontWeight: "700",
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
    marginTop: 2,
  },
  gridRow: { gap: spacing.md },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  cardThumb: {
    width: "100%",
    height: 90,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
    overflow: "hidden",
  },
  cardImage: { width: "100%", height: "100%" },
  cardClass: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.md,
    fontWeight: "600",
    textAlign: "center",
  },
  cardName: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    fontStyle: "italic",
    textAlign: "center",
  },
  cardOperator: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.xs,
    textAlign: "center",
  },
  rarityPill: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  rarityText: { fontSize: fonts.sizes.xs, fontWeight: "700" },
});
