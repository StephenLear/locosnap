// ============================================================
// LocoSnap — Root Layout
// Handles auth state gating and app initialisation
// ============================================================

import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTrainStore } from "../store/trainStore";
import { useAuthStore } from "../store/authStore";
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

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, isGuest, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const isFullyAuthenticated = session !== null;
    const isOnSignIn = segments[0] === "sign-in";

    if (!isFullyAuthenticated && !isGuest && !isOnSignIn) {
      // Not signed in and not a guest — redirect to sign-in
      router.replace("/sign-in");
    } else if ((isFullyAuthenticated || isGuest) && isOnSignIn) {
      // Signed in or guest — no reason to stay on sign-in, go home
      router.replace("/");
    }
  }, [session, isGuest, isLoading, segments]);

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
  const pathname = usePathname();

  useEffect(() => {
    initAnalytics();
    initPurchases();
    initialize();
    loadHistory();

    // Register for push notifications + schedule streak reminder
    registerForPushNotifications().catch(() => {});
    scheduleStreakReminder().catch(() => {});
  }, []);

  // Auto-track screen views
  useEffect(() => {
    if (pathname) trackScreen(pathname);
  }, [pathname]);

  return (
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
              headerBackTitle: "Close",
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
