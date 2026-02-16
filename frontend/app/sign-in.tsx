// ============================================================
// LocoSnap — Sign-In Screen
// Apple/Google OAuth + Continue as Guest
// ============================================================

import React, { useState, useRef, useEffect } from "react";
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
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/authStore";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

export default function SignInScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<"apple" | "google" | "email" | "otp" | null>(null);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const { signInWithApple, signInWithGoogle, signInWithMagicLink, continueAsGuest } = useAuthStore();
  const { supabase } = require("../config/supabase");
  const pendingAutoVerify = useRef(false);

  // Supabase OTP codes can be 6-8 digits depending on project config
  const OTP_LENGTH = 7;

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

  const handleSendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    Keyboard.dismiss();
    setLoading("email");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setOtpSent(true);
    } catch (error) {
      Alert.alert(
        "Send Failed",
        (error as Error).message || "Could not send code. Please try again."
      );
    } finally {
      setLoading(null);
    }
  };

  // Auto-verify when all digits entered
  useEffect(() => {
    if (otpCode.length === OTP_LENGTH && otpSent && !loading && !pendingAutoVerify.current) {
      pendingAutoVerify.current = true;
      setTimeout(() => {
        handleVerifyOtp();
        pendingAutoVerify.current = false;
      }, 300);
    }
  }, [otpCode]);

  const handleVerifyOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    const code = otpCode.trim();
    if (code.length < 6) {
      Alert.alert("Invalid Code", "Please enter the code from your email.");
      return;
    }

    Keyboard.dismiss();
    setLoading("otp");
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: trimmed,
        token: code,
        type: "email",
      });
      if (error) throw error;
      // Auth state listener in root layout will handle navigation
    } catch (error) {
      Alert.alert(
        "Verification Failed",
        (error as Error).message || "Invalid or expired code. Please try again."
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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

        {/* Email OTP sign-in */}
        {otpSent ? (
          <View style={styles.magicLinkSent}>
            <Ionicons name="mail-open" size={24} color={colors.success} />
            <Text style={styles.magicLinkSentTitle}>Enter your code</Text>
            <Text style={styles.magicLinkSentText}>
              We sent a code to {email.trim().toLowerCase()}
            </Text>
            <TextInput
              style={styles.otpInput}
              placeholder="000000"
              placeholderTextColor={colors.textMuted}
              value={otpCode}
              onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, "").slice(0, OTP_LENGTH))}
              keyboardType="number-pad"
              maxLength={OTP_LENGTH}
              autoFocus
              editable={loading === null}
              returnKeyType="done"
              onSubmitEditing={handleVerifyOtp}
            />
            <TouchableOpacity
              style={[
                styles.authBtn,
                styles.emailBtn,
                { width: "100%" },
                (otpCode.trim().length < 6 || loading !== null) && styles.emailBtnDisabled,
              ]}
              onPress={handleVerifyOtp}
              disabled={otpCode.trim().length < 6 || loading !== null}
            >
              {loading === "otp" ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={colors.textPrimary} />
                  <Text style={styles.authBtnText}>Verify & Sign In</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setOtpSent(false); setOtpCode(""); }}>
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
              onPress={handleSendOtp}
              disabled={!email.trim() || loading !== null}
            >
              {loading === "email" ? (
                <ActivityIndicator size="small" color={colors.textPrimary} />
              ) : (
                <>
                  <Ionicons name="send" size={18} color={colors.textPrimary} />
                  <Text style={styles.authBtnText}>Send Sign-In Code</Text>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
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
  otpInput: {
    fontSize: 32,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
    letterSpacing: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    width: "100%",
    marginVertical: spacing.sm,
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
