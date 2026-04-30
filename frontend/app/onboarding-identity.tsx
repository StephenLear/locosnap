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
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";
import { CountryFlagPicker } from "../components/CountryFlagPicker";
import { EmojiPicker } from "../components/EmojiPicker";
import { getDefaultCountryCodeForLocale, getCountryByCode } from "../data/countries";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

type Step = 1 | 2 | 3 | 4;

function deriveInitialCountry(profileRegion: string | null, language: string): string {
  // Prefer existing profile region (UK regions are stored there)
  if (profileRegion) {
    // Existing region values are UK regions like "london" — these should map to GB
    return "GB";
  }
  // Fall back to settings language → locale guess
  if (language === "de") return getDefaultCountryCodeForLocale("de-DE");
  return getDefaultCountryCodeForLocale(language);
}

export default function OnboardingIdentityScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const updateCountryCode = useAuthStore((s) => s.updateCountryCode);
  const updateSpotterEmoji = useAuthStore((s) => s.updateSpotterEmoji);
  const markIdentityOnboardingComplete = useAuthStore((s) => s.markIdentityOnboardingComplete);
  const signInWithMagicLink = useAuthStore((s) => s.signInWithMagicLink);
  const language = useSettingsStore((s) => s.language);

  const isAnonymous = session === null;
  const isPro = profile?.is_pro ?? false;

  const initialCountryCode = useMemo(
    () => deriveInitialCountry(profile?.region ?? null, language),
    [profile?.region, language]
  );

  const [step, setStep] = useState<Step>(1);
  const [countryCode, setCountryCode] = useState<string>(initialCountryCode);
  const [emojiId, setEmojiId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailSubmitting, setEmailSubmitting] = useState(false);

  const finish = async () => {
    await markIdentityOnboardingComplete();
    router.replace("/(tabs)/");
  };

  const handleConfirmCountry = async () => {
    await updateCountryCode(countryCode);
    setStep(3);
  };

  const handleConfirmEmoji = async () => {
    if (!emojiId) return;
    await updateSpotterEmoji(emojiId);
    if (isAnonymous) {
      setStep(4);
    } else {
      await finish();
    }
  };

  const handleSendCode = async () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    setEmailSubmitting(true);
    try {
      await signInWithMagicLink(trimmed);
      // Mark onboarding complete locally so the gate doesn't fire again on
      // return; the OTP completion flow will sync identity to the new profile.
      await markIdentityOnboardingComplete();
      router.replace({ pathname: "/sign-in", params: { mode: "otp", email: trimmed } });
    } catch (err) {
      Alert.alert("Could not send code", (err as Error).message);
    } finally {
      setEmailSubmitting(false);
    }
  };

  const handleSkipEmail = async () => {
    await finish();
  };

  const handleProLockTapped = () => {
    Alert.alert(
      "Pro emoji",
      "This emoji is exclusive to LocoSnap Pro. You can pick a free emoji for now and upgrade any time.",
      [{ text: "OK" }]
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
          <Text style={styles.title}>Set up your spotter identity</Text>
          <Text style={styles.body}>
            We've added country flags, achievements, and a new leaderboard. Set
            up your identity in 30 seconds.
          </Text>
          <Pressable
            style={styles.primaryButton}
            onPress={() => setStep(2)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </Pressable>
        </ScrollView>
      )}

      {step === 2 && (
        <View style={styles.stepContainer}>
          <Text style={styles.title}>Pick your country</Text>
          <Text style={styles.subtitle}>Looks right? Confirm.</Text>
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
              Confirm {getCountryByCode(countryCode)?.glyph ?? ""}
            </Text>
          </Pressable>
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepContainer}>
          <Text style={styles.title}>Pick your spotter emoji</Text>
          {!isPro && (
            <Text style={styles.subtitle}>
              Unlock more options with LocoSnap Pro.
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
              {isAnonymous ? "Continue" : "Done"}
            </Text>
          </Pressable>
        </View>
      )}

      {step === 4 && (
        <ScrollView contentContainerStyle={styles.stepContainer}>
          <Text style={styles.title}>
            Save your spots and join the leaderboard
          </Text>
          <Text style={styles.subtitle}>
            We'll email you a code. No password needed.
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
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
              {emailSubmitting ? "Sending..." : "Send code"}
            </Text>
          </Pressable>
          <Pressable
            style={styles.skipButton}
            onPress={handleSkipEmail}
            accessibilityRole="button"
          >
            <Text style={styles.skipButtonText}>Continue without account</Text>
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
