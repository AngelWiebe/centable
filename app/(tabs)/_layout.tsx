import { MaterialIcons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { Image, Platform, TouchableOpacity } from "react-native";

import { HapticTab } from "../../components/HapticTab";
import TabBarBackground from "../../components/ui/TabBarBackground";
import { Colors } from "../../constants/Colors";
import useBudgetStore from "../../store/useBudgetStore";

export default function TabLayout() {
  const { settings } = useBudgetStore();
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colorScheme.tabIconSelected,
        tabBarInactiveTintColor: colorScheme.tabIconDefault,
        tabBarButton: HapticTab,
        tabBarBackground: Platform.OS === "ios" ? TabBarBackground : undefined,
        tabBarStyle: {
          backgroundColor: colorScheme.background,
          borderTopColor: colorScheme.borderBottomColor,
          ...Platform.select({
            ios: {
              position: "absolute",
            },
            default: {},
          }),
        },
        headerShown: true,
        headerTintColor: colorScheme.text,
        headerTitleAlign: "center",
        headerStyle: {
          backgroundColor: colorScheme.background,
          shadowColor: colorScheme.shadowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.6,
          shadowRadius: 7,
          elevation: 15,
        },
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.push("/")}
            style={{ marginLeft: 15 }}
          >
            <Image
              source={require("../../assets/images/icon.png")}
              style={{ width: 30, height: 30 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={{ marginRight: 15 }}
          >
            <MaterialIcons name="settings" size={28} color={colorScheme.text} />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Recommendations",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expense Tracker",
          tabBarLabel: "Expenses",
          tabBarIcon: ({ color }) => (
            <MaterialIcons
              name="remove-circle"
              size={28}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="incomes"
        options={{
          tabBarLabel: "Incomes",
          title: "Income Tracker",
          tabBarIcon: ({ color }) => (
            <MaterialIcons
              name="add-circle"
              size={28}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="budget"
        options={{
          title: "Budgets",
          tabBarIcon: ({ color }) => (
            <MaterialIcons
              name="pie-chart"
              size={28}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ color }) => (
            <MaterialIcons
              name="insert-chart"
              size={28}
              color={typeof color === "string" ? color : undefined}
            />
          ),
        }}
      />
    </Tabs>
  );
}
