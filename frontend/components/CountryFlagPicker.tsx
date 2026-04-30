// ============================================================
// LocoSnap — CountryFlagPicker
// Reusable picker with compact (preview) + full (search) modes.
// Used by onboarding-identity.tsx and the Profile edit modal.
// ============================================================

import { useState } from "react";
import { View, Text, FlatList, TextInput, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { COUNTRIES, getCountryByCode, Country } from "../data/countries";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

interface Props {
  selectedCode: string | null;
  mode: "compact" | "full";
  onSelect: (code: string) => void;
}

export function CountryFlagPicker({ selectedCode, mode, onSelect }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [internalMode, setInternalMode] = useState<"compact" | "full">(mode);

  const selected = selectedCode ? getCountryByCode(selectedCode) : undefined;

  const filtered: Country[] = search.trim() === ""
    ? COUNTRIES
    : COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase() === search.toLowerCase().trim()
      );

  if (internalMode === "compact") {
    return (
      <View style={styles.compactContainer}>
        {selected ? (
          <Text style={styles.compactGlyph}>{selected.glyph}</Text>
        ) : (
          // White flag glyph as the no-selection placeholder. This is in-app
          // iconography (data, like the country glyphs in COUNTRIES) and
          // therefore does not fall under the project "no emojis in output"
          // rule, which targets communication content.
          <Text style={styles.compactGlyph}>{"\u{1F3F3}\u{FE0F}"}</Text>
        )}
        <Text style={styles.compactName}>
          {selected?.name ?? t("onboardingIdentity.countryNoneSelected")}
        </Text>
        <Pressable
          onPress={() => setInternalMode("full")}
          style={styles.changeButton}
          accessibilityRole="button"
          accessibilityLabel={t("onboardingIdentity.countryChange")}
        >
          <Text style={styles.changeButtonText}>
            {t("onboardingIdentity.countryChange")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.fullContainer}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t("onboardingIdentity.countrySearchPlaceholder")}
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.code}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item.code)}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={item.name}
          >
            <Text style={styles.rowGlyph}>{item.glyph}</Text>
            <Text style={styles.rowName}>{item.name}</Text>
            {selectedCode === item.code && (
              <Text style={styles.rowCheck}>✓</Text>
            )}
          </Pressable>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {t("onboardingIdentity.countryNoMatch", { query: search })}
            </Text>
          </View>
        )}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  compactContainer: {
    alignItems: "center",
    padding: spacing.lg,
  },
  compactGlyph: {
    fontSize: 80,
  },
  compactName: {
    fontSize: fonts.sizes.lg,
    color: colors.textPrimary,
    marginTop: spacing.sm,
    fontWeight: "600",
  },
  changeButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  changeButtonText: {
    color: colors.primary,
    fontSize: fonts.sizes.md,
    fontWeight: "600",
  },
  fullContainer: {
    flex: 1,
  },
  searchInput: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    fontSize: fonts.sizes.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowGlyph: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  rowName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fonts.sizes.md,
  },
  rowCheck: {
    color: colors.primary,
    fontSize: fonts.sizes.lg,
    fontWeight: "700",
  },
  emptyContainer: {
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: fonts.sizes.md,
  },
});
