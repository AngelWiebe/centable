import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import RNPickerSelect from "react-native-picker-select";

import useBudgetStore from "../app/store/useBudgetStore";
import { Colors } from "../constants/Colors";

const BudgetFilter: React.FC<{}> = ({}) => {
  const {
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    settings,
    refreshBudgets,
  } = useBudgetStore();

  const [loading, setLoading] = useState(false);
  const theme = settings?.theme ?? "dark";
  const colorScheme = Colors[theme];

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const options = Array.from({ length: 4 }, (_, i) => {
    const date = new Date(currentYear, currentMonth - 2 + i);
    return {
      label: `${date.toLocaleString("default", {
        month: "long",
      })} ${date.getFullYear()}`,
      value: { month: date.getMonth() + 1, year: date.getFullYear() },
    };
  });

  const handleValueChange = (value: { month: number; year: number } | null) => {
    if (value) {
      setSelectedMonth(value.month);
      setSelectedYear(value.year);
      AccessibilityInfo.announceForAccessibility(
        `Selected ${
          options.find(
            (option) =>
              option.value.month === value.month &&
              option.value.year === value.year
          )?.label
        }`
      );
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await refreshBudgets();
      AccessibilityInfo.announceForAccessibility("Budgets recalculated.");
    } catch (error) {
      console.error("Recalculation error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.pickerContainer}>
        <RNPickerSelect
          value={{ month: selectedMonth, year: selectedYear }}
          onValueChange={handleValueChange}
          items={options}
          placeholder={{
            label: "Select a month",
            value: null,
            color: colorScheme.submitButton,
          }}
          style={{
            inputIOS: {
              color: colorScheme.text,
              backgroundColor: colorScheme.pickerBackground,
              padding: 10,
              borderRadius: 5,
              fontSize: 16,
            },
            inputAndroid: {
              color: colorScheme.text,
              backgroundColor: colorScheme.pickerBackground,
              padding: 10,
              borderRadius: 5,
              fontSize: 16,
            },
            placeholder: {
              color: colorScheme.tint,
            },
          }}
          useNativeAndroidPickerStyle={false}
        />
      </View>
      <TouchableOpacity
        onPress={handleRefresh}
        style={[
          styles.refreshButton,
          { backgroundColor: colorScheme.submitButton },
        ]}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colorScheme.text} />
        ) : (
          <MaterialIcons name="refresh" size={24} color={colorScheme.text} />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  pickerContainer: {
    flex: 1,
    marginRight: 10,
  },
  refreshButton: {
    padding: 10,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default BudgetFilter;
