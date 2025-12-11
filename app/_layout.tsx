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
import useBudgetStore from "./store/useBudgetStore";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { settings } = useBudgetStore();
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;

  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

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
        <Stack.Screen name="+not-found" />
      </Stack>
      {/* <StatusBar style="auto" /> */}
      <StatusBar
        style={settings?.theme === "dark" ? "light" : "dark"}
      />
    </ThemeProvider>
  );
}
