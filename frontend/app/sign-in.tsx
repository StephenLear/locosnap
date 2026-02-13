// ============================================================
// LocoSnap — Sign-In Screen
// Apple/Google OAuth + Continue as Guest
// ============================================================

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Keyboard,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/authStore";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

export default function SignInScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<"apple" | "google" | "email" | null>(null);
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const { signInWithApple, signInWithGoogle, signInWithMagicLink, continueAsGuest } = useAuthStore();

  const handleAppleSignIn = async () => {
    setLoading("apple");
    try {
      await signInWithApple();
      // Auth state listener in root layout will handle navigation
    } catch (error) {
      Alert.alert(
        "Sign In Failed",
        (error as Error).message || "Could not sign in with Apple. Please try again."
      );
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading("google");
    try {
      await signInWithGoogle();
    } catch (error) {
      Alert.alert(
        "Sign In Failed",
        (error as Error).message || "Could not sign in with Google. Please try again."
      );
    } finally {
      setLoading(null);
    }
  };

  const handleMagicLink = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    Keyboard.dismiss();
    setLoading("email");
    try {
      await signInWithMagicLink(trimmed);
      setMagicLinkSent(true);
    } catch (error) {
      Alert.alert(
        "Send Failed",
        (error as Error).message || "Could not send magic link. Please try again."
      );
    } finally {
      setLoading(null);
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    // Auth state change will handle navigation
  };

  return (
    <View style={styles.container}>
      {/* Logo / Brand */}
      <View style={styles.brandContainer}>
        <View style={styles.logoCircle}>
          <Ionicons name="train" size={48} color={colors.accent} />
        </View>
        <Text style={styles.appName}>LocoSnap</Text>
        <Text style={styles.tagline}>
          Snap. Identify. Collect.
        </Text>
        <Text style={styles.subtitle}>
          The trainspotter's Pokedex — identify any locomotive instantly with AI
        </Text>
      </View>

      {/* Auth buttons */}
      <View style={styles.authContainer}>
        {/* Apple Sign-In (iOS only) */}
        {Platform.OS === "ios" && (
          <TouchableOpacity
            style={[styles.authBtn, styles.appleBtn]}
            onPress={handleAppleSignIn}
            disabled={loading !== null}
          >
            {loading === "apple" ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="logo-apple" size={22} color="#000" />
                <Text style={[styles.authBtnText, styles.appleBtnText]}>
                  Continue with Apple
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Google Sign-In */}
        <TouchableOpacity
          style={[styles.authBtn, styles.googleBtn]}
          onPress={handleGoogleSignIn}
          disabled={loading !== null}
        >
          {loading === "google" ? (
            <ActivityIndicator size="small" color={colors.textPrimary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
              <Text style={styles.authBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Magic link email */}
        {magicLinkSent ? (
          <View style={styles.magicLinkSent}>
            <Ionicons name="mail-open" size={24} color={colors.success} />
            <Text style={styles.magicLinkSentTitle}>Check your email!</Text>
            <Text style={styles.magicLinkSentText}>
              We sent a sign-in link to {email.trim().toLowerCase()}.{"\n"}
              Tap the link to sign in — no password needed.
            </Text>
            <TouchableOpacity onPress={() => setMagicLinkSent(false)}>
              <Text style={styles.magicLinkResend}>Try a different email</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.magicLinkContainer}>
            <View style={styles.magicLinkInputRow}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.magicLinkInput}
                placeholder="Email address"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={loading === null}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.authBtn,
                styles.emailBtn,
                (!email.trim() || loading !== null) && styles.emailBtnDisabled,
              ]}
              onPress={handleMagicLink}
              disabled={!email.trim() || loading !== null}
            >
              {loading === "email" ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={colors.textPrimary} />
                  <Text style={styles.authBtnText}>Send Magic Link</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Guest mode */}
        <TouchableOpacity
          style={[styles.authBtn, styles.guestBtn]}
          onPress={handleGuest}
          disabled={loading !== null}
        >
          <Ionicons name="eye-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.authBtnText, styles.guestBtnText]}>
            Continue as Guest
          </Text>
        </TouchableOpacity>

        <Text style={styles.guestNote}>
          5 free scans per day. Sign in to save your collection to the cloud.
        </Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Powered by Claude Vision AI
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    justifyContent: "space-between",
  },
  brandContainer: {
    alignItems: "center",
    paddingTop: 80,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  appName: {
    fontSize: 36,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.semibold,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: fonts.sizes.md,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  authContainer: {
    paddingBottom: spacing.xl,
  },
  authBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  appleBtn: {
    backgroundColor: "#fff",
  },
  appleBtnText: {
    color: "#000",
  },
  googleBtn: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  authBtnText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.textPrimary,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: fonts.sizes.sm,
    color: colors.textMuted,
    paddingHorizontal: spacing.lg,
  },
  magicLinkContainer: {
    marginBottom: spacing.sm,
  },
  magicLinkInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  magicLinkInput: {
    flex: 1,
    fontSize: fonts.sizes.md,
    color: colors.textPrimary,
    paddingVertical: 14,
    marginLeft: spacing.sm,
  },
  emailBtn: {
    backgroundColor: colors.primary,
  },
  emailBtnDisabled: {
    opacity: 0.5,
  },
  magicLinkSent: {
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.25)",
    gap: spacing.sm,
  },
  magicLinkSentTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.success,
  },
  magicLinkSentText: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  magicLinkResend: {
    fontSize: fonts.sizes.sm,
    color: colors.primary,
    fontWeight: fonts.weights.medium,
    marginTop: spacing.xs,
  },
  guestBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  guestBtnText: {
    color: colors.textSecondary,
  },
  guestNote: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  footer: {
    alignItems: "center",
    paddingBottom: 40,
  },
  footerText: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
  },
});
