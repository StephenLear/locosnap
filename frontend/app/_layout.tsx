// ============================================================
// LocoSnap — Root Layout
// Handles auth state gating and app initialisation
// ============================================================

import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack, Redirect, useRouter, useSegments, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import { useTrainStore } from "../store/trainStore";
import { useAuthStore } from "../store/authStore";
import { useSettingsStore } from "../store/settingsStore";
import { supabase } from "../services/supabase";
import { colors } from "../constants/theme";
import {
  registerForPushNotifications,
  scheduleStreakReminder,
} from "../services/notifications";
import {
  initAnalytics,
  trackScreen,
  ErrorBoundary,
  wrap,
} from "../services/analytics";
import { initPurchases } from "../services/purchases";
import { initI18n } from "../i18n";

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const isOnSignIn = segments[0] === "sign-in";

    // If signed in and on sign-in screen, go home
    if (session !== null && isOnSignIn) {
      router.replace("/");
    }
    // Unauthenticated users can access the main app —
    // the scan screen handles the 3-trial-scan gate itself
  }, [session, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return <>{children}</>;
}

function CrashFallback() {
  return (
    <View style={styles.loadingContainer}>
      <Text style={styles.crashText}>Something went wrong</Text>
      <Text style={styles.crashSubtext}>Please restart the app</Text>
    </View>
  );
}

function RootLayout() {
  const loadHistory = useTrainStore((state) => state.loadHistory);
  const initialize = useAuthStore((state) => state.initialize);
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();

  const initializeSettings = useSettingsStore((state) => state.initialize);
  const languageChosen = useSettingsStore((state) => state.languageChosen);
  const settingsLoading = useSettingsStore((state) => state.isLoading);

  // Initialise i18n then settings store on mount.
  // initI18n() must run before initializeSettings() because settingsStore.initialize()
  // calls i18n.changeLanguage() — which requires i18n to already be initialised.
  // Previously `import "../i18n"` ran init as a module-level side effect, which could
  // crash on Android 16 (Samsung) where the JS bundle is evaluated in interpreted mode.
  useEffect(() => {
    initI18n();
    initializeSettings();
  }, [initializeSettings]);

  // Handle magic link deep link callbacks (locosnap://auth/callback)
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url.includes("auth/callback")) return;

      // Implicit flow: tokens arrive in URL hash
      // e.g. locosnap://auth/callback#access_token=xxx&refresh_token=xxx
      const hashIndex = url.indexOf("#");
      if (hashIndex !== -1) {
        const params = new URLSearchParams(url.slice(hashIndex + 1));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          return;
        }
      }

      // PKCE flow: auth code arrives as query param
      // e.g. locosnap://auth/callback?code=xxx
      const queryIndex = url.indexOf("?");
      if (queryIndex !== -1) {
        const params = new URLSearchParams(url.slice(queryIndex + 1));
        if (params.get("code")) {
          await supabase.auth.exchangeCodeForSession(url);
        }
      }
    };

    // App opened from closed state via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // App already running when deep link fires
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    initAnalytics();
    initPurchases();
    initialize();
    loadHistory();

    // Register for push notifications, then schedule streak reminder only if granted
    registerForPushNotifications()
      .then((token) => {
        if (token) scheduleStreakReminder().catch(() => {});
      })
      .catch(() => {});
  }, []);

  // Re-load history from Supabase when user signs in
  // This fixes the race condition where loadHistory() runs before initialize() completes
  // Also clears stale history when switching between accounts so collections don't cross-contaminate
  const prevUserIdRef = React.useRef<string | null>(null);
  const clearHistory = useTrainStore((state) => state.clearHistory);
  useEffect(() => {
    const prevId = prevUserIdRef.current;
    const currentId = user?.id ?? null;
    if (currentId && currentId !== prevId) {
      // If there was a previous user, clear their history before loading the new user's
      if (prevId !== null) {
        clearHistory().then(() => loadHistory());
      } else {
        loadHistory();
      }
    }
    prevUserIdRef.current = currentId;
  }, [user?.id]);

  // Auto-track screen views
  useEffect(() => {
    if (pathname) trackScreen(pathname);
  }, [pathname]);

  // While settings are loading, show a blank screen (no spinner — avoids flash)
  if (settingsLoading) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  // First-launch user — language not yet chosen: gate before auth
  if (!languageChosen) {
    return <Redirect href="/language-picker" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ErrorBoundary fallback={<CrashFallback />}>
      <StatusBar style="light" />
      <AuthGate>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerTitleStyle: { fontWeight: "600" },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen
            name="language-picker"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="sign-in"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="card-reveal"
            options={{
              title: "",
              presentation: "fullScreenModal",
              headerShown: false,
              animation: "fade",
            }}
          />
          <Stack.Screen
            name="results"
            options={{
              title: "Results",
              presentation: "modal",
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="blueprint"
            options={{
              title: "Blueprint",
              presentation: "fullScreenModal",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="compare"
            options={{
              title: "Compare",
              presentation: "modal",
              headerBackTitle: "Back",
            }}
          />
          <Stack.Screen
            name="paywall"
            options={{
              presentation: "modal",
              headerShown: false,
              animation: "slide_from_bottom",
            }}
          />
        </Stack>
      </AuthGate>
    </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default wrap(RootLayout);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  crashText: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  crashSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
