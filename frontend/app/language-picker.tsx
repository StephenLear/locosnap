// ============================================================
// LocoSnap — Language Picker Screen
// Shown once on first launch before any language is set.
// Text is hardcoded in English — no i18n needed here.
// ============================================================

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSettingsStore } from "../store/settingsStore";
import i18n from "../i18n";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

export default function LanguagePickerScreen() {
  const router = useRouter();
  const { setLanguage, markLanguageChosen } = useSettingsStore();
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectLanguage = async (lang: "en" | "de") => {
    if (isSelecting) return;
    setIsSelecting(true);
    await setLanguage(lang);
    await i18n.changeLanguage(lang);
    await markLanguageChosen();
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/icon.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityElementsHidden={true}
            importantForAccessibility="no"
          />
        </View>

        {/* Heading */}
        <View style={styles.headingContainer}>
          <Text style={styles.title}>Choose your language</Text>
          <Text style={styles.subtitle}>Select the language for the app</Text>
        </View>

        {/* Language Buttons */}
        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.languageBtn}
            onPress={() => handleSelectLanguage("en")}
            activeOpacity={0.8}
            disabled={isSelecting}
            accessibilityRole="button"
            accessibilityLabel="Select English as the app language"
          >
            <Text style={styles.languageBtnLabel}>English</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.languageBtn, styles.languageBtnSecondary]}
            onPress={() => handleSelectLanguage("de")}
            activeOpacity={0.8}
            disabled={isSelecting}
            accessibilityRole="button"
            accessibilityLabel="Deutsch als App-Sprache auswaehlen"
          >
            <Text style={[styles.languageBtnLabel, styles.languageBtnLabelSecondary]}>
              Deutsch
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
    alignItems: "center",
  },

  // Logo
  logoContainer: {
    marginBottom: spacing.xxl,
    alignItems: "center",
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.xl,
  },

  // Heading
  headingContainer: {
    alignItems: "center",
    marginBottom: spacing.xxl * 1.5,
  },
  title: {
    fontSize: fonts.sizes.hero,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: "center",
  },

  // Buttons
  buttons: {
    width: "100%",
    gap: spacing.md,
  },
  languageBtn: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  languageBtnSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: `rgba(0, 212, 170, 0.35)`,
  },
  languageBtnLabel: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.background,
    letterSpacing: 0.2,
  },
  languageBtnLabelSecondary: {
    color: colors.accent,
  },
});
