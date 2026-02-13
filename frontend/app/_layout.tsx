// ============================================================
// LocoSnap — Root Layout
// Handles auth state gating and app initialisation
// ============================================================

import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTrainStore } from "../store/trainStore";
import { useAuthStore } from "../store/authStore";
import { colors } from "../constants/theme";
import {
  registerForPushNotifications,
  scheduleStreakReminder,
} from "../services/notifications";

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, isGuest, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;

    const isAuthenticated = session !== null || isGuest;
    const isOnSignIn = segments[0] === "sign-in";

    if (!isAuthenticated && !isOnSignIn) {
      // Not signed in — redirect to sign-in
      router.replace("/sign-in");
    } else if (isAuthenticated && isOnSignIn) {
      // Signed in — redirect to home
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

export default function RootLayout() {
  const loadHistory = useTrainStore((state) => state.loadHistory);
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
    loadHistory();

    // Register for push notifications + schedule streak reminder
    registerForPushNotifications().catch(() => {});
    scheduleStreakReminder().catch(() => {});
  }, []);

  return (
    <>
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
        </Stack>
      </AuthGate>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});
