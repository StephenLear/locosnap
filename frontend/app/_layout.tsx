// ============================================================
// CarSnap — Root Layout
// ============================================================

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCarStore } from "../store/carStore";
import { colors } from "../constants/theme";

export default function RootLayout() {
  const loadHistory = useCarStore((state) => state.loadHistory);

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: "600" },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
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
          name="infographic"
          options={{
            title: "Infographic",
            presentation: "fullScreenModal",
            headerBackTitle: "Close",
          }}
        />
      </Stack>
    </>
  );
}
