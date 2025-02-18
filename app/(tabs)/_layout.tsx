import { Tabs, useRouter } from "expo-router";
import React from "react";
import { Image, Platform, TouchableOpacity } from "react-native";

import { HapticTab } from "../../components/HapticTab";
import { IconSymbol } from "../../components/ui/IconSymbol";
import TabBarBackground from "../../components/ui/TabBarBackground";
import { Colors } from "../../constants/Colors";
import { useColorScheme } from "../../hooks/useColorScheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            position: "absolute", // Transparent background for blur effect on iOS
          },
          default: {},
        }),
        headerShown: true,
        headerTintColor: "#FFF",
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: "#151718" },
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.push("/")} // Navigate back to Home tab
            style={{ marginLeft: 15 }}
          >
            <Image
              source={require("../../assets/images/icon.png")} // Load icon from assets
              style={{ width: 30, height: 30 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expense Tracker",
          tabBarLabel: "Expenses",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="minus.circle.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="incomes"
        options={{
          title: "Incomes",
          tabBarLabel: "Income Tracker",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="plus.circle.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: "Budgets",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="chart.pie.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="doc.text.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
