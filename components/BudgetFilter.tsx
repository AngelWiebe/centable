import React, { useState } from "react";
import {
  View,
  StyleSheet,
  AccessibilityInfo,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import RNPickerSelect from "react-native-picker-select";
import { MaterialIcons } from "@expo/vector-icons";
import useBudgetStore from "../app/store/useBudgetStore";

const BudgetFilter: React.FC<{}> = ({}) => {
  const {
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    recalculateBudgets,
  } = useBudgetStore();

  const [loading, setLoading] = useState(false);

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
      await recalculateBudgets();
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
            color: "#AAAAAA",
          }}
          style={pickerSelectStyles}
          useNativeAndroidPickerStyle={false}
        />
      </View>
      <TouchableOpacity
        onPress={handleRefresh}
        style={styles.refreshButton}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <MaterialIcons name="refresh" size={24} color="#FFFFFF" />
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
    paddingHorizontal: 10,
  },
  pickerContainer: {
    flex: 1,
    marginRight: 10,
  },
  refreshButton: {
    backgroundColor: "#4CAF50",
    padding: 10,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
});

const pickerSelectStyles = {
  inputIOS: {
    color: "#FFFFFF",
    padding: 10,
    backgroundColor: "#4A4A4A",
    borderRadius: 5,
    fontSize: 16,
  },
  inputAndroid: {
    color: "#FFFFFF",
    padding: 10,
    backgroundColor: "#4A4A4A",
    borderRadius: 5,
    fontSize: 16,
  },
  placeholder: {
    color: "#AAAAAA",
  },
};

export default BudgetFilter;
