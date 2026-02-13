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
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/authStore";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

export default function SignInScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<"apple" | "google" | null>(null);
  const { signInWithApple, signInWithGoogle, continueAsGuest } = useAuthStore();

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
