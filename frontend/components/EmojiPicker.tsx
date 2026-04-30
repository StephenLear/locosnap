// ============================================================
// LocoSnap — EmojiPicker
// Grid of spotter emojis. Free entries are always selectable;
// Pro entries show a lock and trigger the upsell tap-handler.
// ============================================================

import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { SPOTTER_EMOJIS, canSelectEmoji } from "../data/spotterEmojis";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

interface Props {
  selectedId: string | null;
  isPro: boolean;
  onSelect: (id: string) => void;
  onProLockTapped: () => void;
}

const COLUMNS = 5;

export function EmojiPicker({ selectedId, isPro, onSelect, onProLockTapped }: Props) {
  const { t } = useTranslation();
  return (
    <FlatList
      data={SPOTTER_EMOJIS}
      keyExtractor={(e) => e.id}
      numColumns={COLUMNS}
      contentContainerStyle={styles.gridContent}
      renderItem={({ item }) => {
        const selectable = canSelectEmoji(item.id, isPro);
        const isSelected = selectedId === item.id;
        const isLocked = item.isPro && !isPro;

        return (
          <Pressable
            onPress={() => {
              if (isLocked) {
                onProLockTapped();
              } else if (selectable) {
                onSelect(item.id);
              }
            }}
            style={[
              styles.tile,
              isSelected && styles.tileSelected,
              isLocked && styles.tileLocked,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              isLocked
                ? t("onboardingIdentity.emojiLocked", { label: item.label })
                : item.label
            }
          >
            {item.source === "unicode" && item.glyph ? (
              <Text style={styles.tileGlyph}>{item.glyph}</Text>
            ) : (
              // SVG placeholder — assets pending. Show label initial as a
              // temporary visual until the SVG asset set lands.
              <View style={styles.svgPlaceholder}>
                <Text style={styles.svgPlaceholderText}>
                  {item.label.charAt(0)}
                </Text>
              </View>
            )}
            {isLocked && (
              <Ionicons
                name="lock-closed"
                size={12}
                color={colors.textMuted}
                style={styles.lockIcon}
              />
            )}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  gridContent: {
    padding: spacing.sm,
  },
  tile: {
    flex: 1 / COLUMNS,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    margin: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  tileSelected: {
    backgroundColor: colors.primary,
  },
  tileLocked: {
    opacity: 0.4,
  },
  tileGlyph: {
    fontSize: 32,
  },
  svgPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
  },
  svgPlaceholderText: {
    color: colors.textPrimary,
    fontSize: fonts.sizes.lg,
    fontWeight: "700",
  },
  lockIcon: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
  },
});
