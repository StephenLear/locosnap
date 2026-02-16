// ============================================================
// LocoSnap — Sign-In Screen
// Premium teal/blue design with email OTP, OAuth, and Guest
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
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/authStore";
import { colors, fonts, spacing, borderRadius } from "../constants/theme";

// ── Local palette (matches home screen scanner) ──────────────
const TEAL = "#00D4AA";
const BLUE = "#0066FF";
const TEAL_GLOW = "rgba(0, 212, 170, 0.15)";
const TEAL_BORDER = "rgba(0, 212, 170, 0.25)";
const BLUE_GLOW = "rgba(0, 102, 255, 0.12)";

export default function SignInScreen() {
  const [loading, setLoading] = useState<"email" | "otp" | null>(null);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const { continueAsGuest } = useAuthStore();
  const { supabase } = require("../config/supabase");
  const pendingAutoVerify = useRef(false);

  // Supabase OTP codes can be 6-8 digits depending on project config
  const OTP_LENGTH = 7;

  // ── Animations ──────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance fade
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Subtle pulse on logo glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ── Handlers ────────────────────────────────────────────────
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
  };

  // ── Render ──────────────────────────────────────────────────
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
        <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
          {/* ── Brand hero ─────────────────────────────────── */}
          <View style={styles.brandContainer}>
            <View style={styles.logoWrapper}>
              <Animated.View
                style={[
                  styles.logoGlow,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              />
              <View style={styles.logoCircle}>
                <Ionicons name="train" size={44} color={TEAL} />
              </View>
            </View>

            <Text style={styles.appName}>LocoSnap</Text>
            <Text style={styles.tagline}>Snap. Identify. Collect.</Text>
            <Text style={styles.subtitle}>
              The trainspotter's Pokedex — identify any{"\n"}locomotive instantly with AI
            </Text>
          </View>

          {/* ── Auth section ───────────────────────────────── */}
          <View style={styles.authContainer}>
            {/* ── Email OTP ───────────────────────────────── */}
            {otpSent ? (
              <View style={styles.otpContainer}>
                <View style={styles.otpIconRow}>
                  <View style={styles.otpIconCircle}>
                    <Ionicons name="mail-open" size={22} color={TEAL} />
                  </View>
                </View>
                <Text style={styles.otpTitle}>Enter your code</Text>
                <Text style={styles.otpSubtitle}>
                  We sent a code to{" "}
                  <Text style={{ color: TEAL }}>{email.trim().toLowerCase()}</Text>
                </Text>
                <TextInput
                  style={styles.otpInput}
                  placeholder="0000000"
                  placeholderTextColor={colors.textMuted}
                  value={otpCode}
                  onChangeText={(text) =>
                    setOtpCode(text.replace(/[^0-9]/g, "").slice(0, OTP_LENGTH))
                  }
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  autoFocus
                  editable={loading === null}
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyOtp}
                />
                <TouchableOpacity
                  style={[
                    styles.ctaBtn,
                    (otpCode.trim().length < 6 || loading !== null) && styles.ctaBtnDisabled,
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={otpCode.trim().length < 6 || loading !== null}
                  activeOpacity={0.8}
                >
                  {loading === "otp" ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.ctaBtnText}>Verify & Sign In</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setOtpSent(false);
                    setOtpCode("");
                  }}
                >
                  <Text style={styles.linkText}>Try a different email</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emailContainer}>
                <View style={styles.emailInputRow}>
                  <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                  <TextInput
                    style={styles.emailInput}
                    placeholder="Email address"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={loading === null}
                    onSubmitEditing={handleSendOtp}
                    returnKeyType="send"
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.ctaBtn,
                    (!email.trim() || loading !== null) && styles.ctaBtnDisabled,
                  ]}
                  onPress={handleSendOtp}
                  disabled={!email.trim() || loading !== null}
                  activeOpacity={0.8}
                >
                  {loading === "email" ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#fff" />
                      <Text style={styles.ctaBtnText}>Send Sign-In Code</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ── Guest ───────────────────────────────────── */}
            <TouchableOpacity
              style={styles.guestBtn}
              onPress={handleGuest}
              disabled={loading !== null}
              activeOpacity={0.8}
            >
              <Ionicons name="eye-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.guestBtnText}>Continue as Guest</Text>
            </TouchableOpacity>

            <Text style={styles.guestNote}>
              5 free scans per day • Sign in to save your collection
            </Text>
          </View>

          {/* ── Footer ─────────────────────────────────────── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>AI-powered train identification</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  inner: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: "space-between",
  },

  // ── Brand ──────────────────────────────────────────────────
  brandContainer: {
    alignItems: "center",
    paddingTop: 72,
    paddingBottom: spacing.xl,
  },
  logoWrapper: {
    width: 96,
    height: 96,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  logoGlow: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: TEAL_GLOW,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: TEAL_BORDER,
  },
  appName: {
    fontSize: 34,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  tagline: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: TEAL,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  // ── Auth ───────────────────────────────────────────────────
  authContainer: {
    paddingBottom: spacing.lg,
  },
  // ── Email input ────────────────────────────────────────────
  emailContainer: {
    marginBottom: spacing.md,
  },
  emailInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  emailInput: {
    flex: 1,
    fontSize: fonts.sizes.md,
    color: colors.textPrimary,
    paddingVertical: 14,
    marginLeft: spacing.sm,
  },

  // ── CTA button (teal gradient feel) ────────────────────────
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    backgroundColor: TEAL,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: spacing.sm,
  },
  ctaBtnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
  },
  ctaBtnText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
    color: "#fff",
  },

  // ── OTP entry ──────────────────────────────────────────────
  otpContainer: {
    alignItems: "center",
    backgroundColor: BLUE_GLOW,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0, 102, 255, 0.2)",
  },
  otpIconRow: {
    marginBottom: spacing.sm,
  },
  otpIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: TEAL_GLOW,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: TEAL_BORDER,
  },
  otpTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  otpSubtitle: {
    fontSize: fonts.sizes.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  otpInput: {
    fontSize: 28,
    fontWeight: fonts.weights.bold,
    color: colors.textPrimary,
    textAlign: "center",
    letterSpacing: 10,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: TEAL_BORDER,
    width: "100%",
    marginBottom: spacing.md,
  },
  linkText: {
    fontSize: fonts.sizes.sm,
    color: TEAL,
    fontWeight: fonts.weights.medium,
    marginTop: spacing.xs,
  },

  // ── Guest ──────────────────────────────────────────────────
  guestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  guestBtnText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
    color: colors.textSecondary,
  },
  guestNote: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },

  // ── Footer ─────────────────────────────────────────────────
  footer: {
    alignItems: "center",
    paddingBottom: 36,
    paddingTop: spacing.sm,
  },
  footerText: {
    fontSize: fonts.sizes.xs,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
});
