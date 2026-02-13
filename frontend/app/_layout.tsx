// ============================================================
// LocoSnap — Root Layout
// ============================================================

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTrainStore } from "../store/trainStore";
import { colors } from "../constants/theme";

export default function RootLayout() {
  const loadHistory = useTrainStore((state) => state.loadHistory);

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
          name="blueprint"
          options={{
            title: "Blueprint",
            presentation: "fullScreenModal",
            headerBackTitle: "Close",
          }}
        />
      </Stack>
    </>
  );
}
