// ============================================================
// LocoSnap — IdentityBadge
// Small flag + spotter-emoji cluster shown on profile, leaderboard
// rows, etc. Renders nothing if both fields are null.
// ============================================================

import { View, Text, StyleSheet } from "react-native";
import { getCountryByCode } from "../data/countries";
import { getEmojiById } from "../data/spotterEmojis";
import { colors, borderRadius } from "../constants/theme";

interface Props {
  countryCode: string | null;
  emojiId: string | null;
  size?: "sm" | "md" | "lg";
}

export function IdentityBadge({ countryCode, emojiId, size = "md" }: Props) {
  const country = countryCode ? getCountryByCode(countryCode) : undefined;
  const emoji = emojiId ? getEmojiById(emojiId) : undefined;

  if (!country && !emoji) return null;

  const flagSize = size === "sm" ? 14 : size === "md" ? 18 : 24;
  const emojiSize = size === "sm" ? 16 : size === "md" ? 22 : 28;
  const placeholderSize = emojiSize - 2;

  return (
    <View style={styles.row}>
      {country && <Text style={[styles.glyph, { fontSize: flagSize }]}>{country.glyph}</Text>}
      {emoji?.source === "unicode" && emoji.glyph && (
        <Text style={[styles.glyph, { fontSize: emojiSize }]}>{emoji.glyph}</Text>
      )}
      {emoji?.source === "svg" && (
        <View
          style={[
            styles.svgPlaceholder,
            { width: placeholderSize, height: placeholderSize },
          ]}
        >
          <Text style={styles.svgPlaceholderText}>{emoji.label.charAt(0)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  glyph: {
    lineHeight: undefined,
  },
  svgPlaceholder: {
    borderRadius: borderRadius.sm,
    backgroundColor: colors.surfaceHighlight,
    alignItems: "center",
    justifyContent: "center",
  },
  svgPlaceholderText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: "700",
  },
});
