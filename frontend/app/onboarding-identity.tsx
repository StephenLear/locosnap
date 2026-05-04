// ============================================================
// LocoSnap — Identity Onboarding
// One-time post-install (or post-update) flow:
//   Step 1: Welcome
//   Step 2: Country flag picker
//   Step 3: Spotter emoji picker
//   Step 4 (anonymous only): email signup or skip
// Triggered from _layout.tsx when has_completed_identity_onboarding=false.
// ============================================================

import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";
import { CountryFlagPicker } from "../components/CountryFlagPicker";
import { EmojiPicker } from "../components/EmojiPicker";
import { getDefaultCountryCodeForLocale, getCountryByCode } from "../data/countries";
import { UK_REGIONS } from "../services/supabase";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

type Step = 1 | 2 | 3 | 4;

const UK_REGION_KEYS = new Set(UK_REGIONS.map((r) => r.key));

/**
 * Resolve the initial country code for the country picker.
 * Order:
 *   1. Existing user-saved country_code (covers re-entry mid-onboarding).
 *   2. profile.region — only when it matches a known UK region key (in which
 *      case the country is GB).
 *   3. Device locale (Intl) — when its region matches a known ISO country.
 *   4. Settings language: de → DE, anything else → GB.
 */
function deriveInitialCountry(
  savedCountryCode: string | null,
  profileRegion: string | null,
  language: string
): string {
  if (savedCountryCode && getCountryByCode(savedCountryCode)) {
    return savedCountryCode;
  }

  if (profileRegion && UK_REGION_KEYS.has(profileRegion)) {
    return "GB";
  }

  // Device locale via Intl — works in Hermes without an extra dep.
  try {
    const deviceLocale = Intl.DateTimeFormat().resolvedOptions().locale;
    const region = deviceLocale.split("-")[1]?.toUpperCase();
    if (region && getCountryByCode(region)) return region;
  } catch {
    // Intl unavailable — fall through to language fallback
  }

  if (language === "de") return getDefaultCountryCodeForLocale("de-DE");
  return getDefaultCountryCodeForLocale(language);
}

export default function OnboardingIdentityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const updateCountryCode = useAuthStore((s) => s.updateCountryCode);
  const updateSpotterEmoji = useAuthStore((s) => s.updateSpotterEmoji);
  const markIdentityOnboardingComplete = useAuthStore((s) => s.markIdentityOnboardingComplete);
  const language = useSettingsStore((s) => s.language);

  const isAnonymous = session === null;
  const isPro = profile?.is_pro ?? false;

  const initialCountryCode = useMemo(
    () => deriveInitialCountry(
      profile?.country_code ?? null,
      profile?.region ?? null,
      language
    ),
    [profile?.country_code, profile?.region, language]
  );

  const [step, setStep] = useState<Step>(1);
  const [countryCode, setCountryCode] = useState<string>(initialCountryCode);
  const [emojiId, setEmojiId] = useState<string | null>(profile?.spotter_emoji ?? null);
  const [email, setEmail] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  // The identity actions persist locally (Zustand + AsyncStorage) synchronously
  // and fire-and-forget the Supabase sync. We still defensively try/catch each
  // handler so an unexpected throw can't strand the user mid-flow.
  const finish = async () => {
    try {
      await markIdentityOnboardingComplete();
    } catch {
      // Local persistence handled inside the action; Supabase sync is non-blocking.
    }
    router.replace("/(tabs)/");
  };

  const handleConfirmCountry = async () => {
    try {
      await updateCountryCode(countryCode);
    } catch {
      // Continue to next step regardless — local state is already updated.
    }
    setStep(3);
  };

  const handleConfirmEmoji = async () => {
    if (!emojiId) return;
    try {
      await updateSpotterEmoji(emojiId);
    } catch {
      // Continue to next step regardless — local state is already updated.
    }
    if (isAnonymous) {
      setStep(4);
    } else {
      await finish();
    }
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      Alert.alert(
        t("onboardingIdentity.emailErrorTitle"),
        t("onboardingIdentity.emailInvalid")
      );
      return;
    }
    setEmailSubmitting(true);
    try {
      // Mark onboarding complete locally — the gate must NOT re-fire when the
      // user returns from /sign-in. The anon-to-signed-in migration in
      // fetchProfile will lift this flag (and country/emoji) onto the
      // server-side profile after OTP verification.
      await markIdentityOnboardingComplete();
      // Hand off to /sign-in for the actual OTP send + verify. autoSend=true
      // triggers handleSendOtp on /sign-in mount, so the user only ever sees
      // the OTP-entry view, not the empty email form.
      router.replace({
        pathname: "/sign-in",
        params: { mode: "signup", email: trimmed, autoSend: "true" },
      });
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleSkipEmail = async () => {
    await finish();
  };

  const handleProLockTapped = () => {
    Alert.alert(
      t("onboardingIdentity.emojiProLockTitle"),
      t("onboardingIdentity.emojiProLockBody"),
      [{ text: t("onboardingIdentity.emojiProLockOk") }]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.progressBar}>
        {[1, 2, 3, ...(isAnonymous ? [4] : [])].map((n) => (
          <View
            key={n}
            style={[styles.progressDot, n <= step && styles.progressDotActive]}
          />
        ))}
      </View>

      {step === 1 && (
        <ScrollView contentContainerStyle={styles.welcomeContainer}>
          <Text style={styles.title}>{t("onboardingIdentity.welcomeTitle")}</Text>
          <Text style={styles.body}>{t("onboardingIdentity.welcomeBody")}</Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => setStep(2)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {t("onboardingIdentity.continueCta")}
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {step === 2 && (
        <View style={styles.stepContainer}>
          <Text style={styles.title}>{t("onboardingIdentity.countryTitle")}</Text>
          <Text style={styles.subtitle}>{t("onboardingIdentity.countrySubtitle")}</Text>
          <CountryFlagPicker
            mode="compact"
            selectedCode={countryCode}
            onSelect={(code) => setCountryCode(code)}
          />
          <Pressable
            style={styles.primaryButton}
            onPress={handleConfirmCountry}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {t("onboardingIdentity.confirmCta")} {getCountryByCode(countryCode)?.glyph ?? ""}
            </Text>
          </Pressable>
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepContainer}>
          <Text style={styles.title}>{t("onboardingIdentity.emojiTitle")}</Text>
          {!isPro && (
            <Text style={styles.subtitle}>
              {t("onboardingIdentity.emojiProSubtitle")}
            </Text>
          )}
          <View style={styles.emojiGrid}>
            <EmojiPicker
              selectedId={emojiId}
              isPro={isPro}
              onSelect={setEmojiId}
              onProLockTapped={handleProLockTapped}
            />
          </View>
          <Pressable
            style={[styles.primaryButton, !emojiId && styles.buttonDisabled]}
            onPress={handleConfirmEmoji}
            disabled={!emojiId}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {isAnonymous
                ? t("onboardingIdentity.continueCta")
                : t("onboardingIdentity.doneCta")}
            </Text>
          </Pressable>
        </View>
      )}

      {step === 4 && (
        <ScrollView contentContainerStyle={styles.stepContainer}>
          <Text style={styles.title}>{t("onboardingIdentity.emailTitle")}</Text>
          <Text style={styles.subtitle}>{t("onboardingIdentity.emailSubtitle")}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("onboardingIdentity.emailPlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={styles.emailInput}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={[
              styles.primaryButton,
              (emailSubmitting || email.trim() === "") && styles.buttonDisabled,
            ]}
            onPress={handleSendCode}
            disabled={emailSubmitting || email.trim() === ""}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {emailSubmitting
                ? t("onboardingIdentity.emailSending")
                : t("onboardingIdentity.emailSendCode")}
            </Text>
          </Pressable>
          <Pressable
            style={styles.skipButton}
            onPress={handleSkipEmail}
            accessibilityRole="button"
          >
            <Text style={styles.skipButtonText}>
              {t("onboardingIdentity.emailSkip")}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.xxl,
  },
  progressBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  welcomeContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: fonts.sizes.xxl,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  body: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  emojiGrid: {
    flex: 1,
    minHeight: 240,
  },
  emailInput: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    fontSize: fonts.sizes.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: fonts.sizes.md,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  skipButton: {
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  skipButtonText: {
    color: colors.textMuted,
    fontSize: fonts.sizes.sm,
  },
});
