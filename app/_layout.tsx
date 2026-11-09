import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { Colors } from "../constants/Colors";
import useBudgetStore from "../store/useBudgetStore";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { settings, fetchAndCleanBudgets } = useBudgetStore();
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;

  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    // Load settings and data on app startup
    fetchAndCleanBudgets().catch((error) =>
      console.error("❌ Failed to load data:", error)
    );
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider
      value={settings?.theme === "dark" ? DarkTheme : DefaultTheme}
    >
      <Stack
        screenOptions={{
          headerShown: true,
          headerTintColor: colorScheme.text,
          headerTitleStyle: { fontWeight: "bold" },
          headerTitleAlign: "center",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {/* <StatusBar style="auto" /> */}
      <StatusBar
        style={settings?.theme === "dark" ? "light" : "dark"}
      />
    </ThemeProvider>
  );
}
