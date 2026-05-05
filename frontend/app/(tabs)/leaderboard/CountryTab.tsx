// ============================================================
// LocoSnap — Country tab (Phase 2 E.3)
//
// Country selector pill row + sub-toggle (This week / All-time).
// Default selection: user's own country_code if set, else "DE"
// (the project's #1 market). Sub-toggle persisted via
// useLeaderboardStore.countrySubToggle.
// ============================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../../store/authStore";
import { useLeaderboardStore } from "../../../store/leaderboardStore";
import {
  fetchCountryLeaderboard,
  fetchKnownCountryCodes,
  type LeaderboardEntry,
} from "../../../services/supabase";
import { getCountryByCode } from "../../../data/countries";
import { colors, fonts, spacing, borderRadius } from "../../../constants/theme";
import { IdentityBadge } from "../../../components/IdentityBadge";

const FALLBACK_COUNTRY = "DE"; // project's #1 market

export function CountryTab() {
  const { t } = useTranslation();
  const { user, profile } = useAuthStore();
  const subToggle = useLeaderboardStore((s) => s.countrySubToggle);
  const setSubToggle = useLeaderboardStore((s) => s.setCountrySubToggle);
  const selected = useLeaderboardStore((s) => s.selectedCountry);
  const setSelected = useLeaderboardStore((s) => s.setSelectedCountry);

  const [knownCodes, setKnownCodes] = useState<string[]>([]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Default-select the user's country (or fallback) on first mount.
  useEffect(() => {
    if (selected) return;
    const fromProfile = (profile as { country_code?: string } | null)?.country_code;
    setSelected(fromProfile || FALLBACK_COUNTRY);
  }, [selected, profile, setSelected]);

  // Load the list of known country codes once.
  useEffect(() => {
    void fetchKnownCountryCodes().then(setKnownCodes);
  }, []);

  const activeCode = selected || FALLBACK_COUNTRY;

  const loadEntries = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const rows = await fetchCountryLeaderboard(activeCode, subToggle);
        setEntries(rows);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeCode, subToggle]
  );

  useEffect(() => {
    void loadEntries(false);
  }, [loadEntries]);

  // Sort the country pill list — selected first, then user's own country,
  // then by alphabetical code. Limits to 16 visible to keep the row scannable.
  const orderedCountries = useMemo(() => {
    const codes = new Set<string>([activeCode, ...knownCodes]);
    return Array.from(codes)
      .slice(0, 24)
      .map((code) => {
        const c = getCountryByCode(code);
        return c ?? { code, name: code, glyph: "" };
      });
  }, [activeCode, knownCodes]);

  return (
    <View style={styles.root}>
      {/* Country selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        {orderedCountries.map((c) => {
          const isActive = c.code === activeCode;
          return (
            <Pressable
              key={c.code}
              onPress={() => setSelected(c.code)}
              style={[styles.pill, isActive && styles.pillActive]}
            >
              <Text style={styles.pillFlag}>{c.glyph}</Text>
              <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>
                {c.code}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sub-toggle */}
      <View style={styles.subToggle}>
        {(["this_week", "all_time"] as const).map((mode) => {
          const active = subToggle === mode;
          return (
            <Pressable
              key={mode}
              style={[styles.subToggleButton, active && styles.subToggleButtonActive]}
              onPress={() => setSubToggle(mode)}
            >
              <Text
                style={[
                  styles.subToggleLabel,
                  active && styles.subToggleLabelActive,
                ]}
              >
                {t(`leaderboard.country.${mode}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.bodyText}>{t("leaderboard.country.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(row, i) => row.id || `c-${i}`}
          renderItem={({ item, index }) => (
            <CountryRow
              row={item}
              rank={index + 1}
              isMe={item.id === user?.id}
              statValue={
                subToggle === "this_week"
                  ? item.weeklyUnique ?? 0
                  : item.uniqueTrains
              }
              statLabel={t("leaderboard.country.classes")}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadEntries(true)}
              tintColor={colors.accent}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

function CountryRow({
  row,
  rank,
  isMe,
  statValue,
  statLabel,
}: {
  row: LeaderboardEntry;
  rank: number;
  isMe: boolean;
  statValue: number;
  statLabel: string;
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
        <Text style={styles.rowStat}>
          {statValue} {statLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pillRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  pillActive: {
    backgroundColor: colors.surfaceHighlight,
    borderColor: colors.accent,
  },
  pillFlag: {
    fontSize: fonts.sizes.md,
  },
  pillLabel: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },
  pillLabelActive: {
    color: colors.accent,
  },
  subToggle: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  subToggleButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  subToggleButtonActive: {
    backgroundColor: colors.surfaceHighlight,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  subToggleLabel: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
  },
  subToggleLabelActive: {
    color: colors.accent,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.md,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
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
  rowStat: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginTop: 2,
  },
});

export default CountryTab;
