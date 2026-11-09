import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import useBudgetStore from "../store/useBudgetStore";
import { Colors } from "../constants/Colors";
import { VISIBLE_BUDGET_MONTHS } from "../utils/buildBudgets";

function monthValue(month: number, year: number): string {
  return `${year}-${month}`;
}

function parseMonthValue(
  value: string | null
): { month: number; year: number } | null {
  if (!value) {
    return null;
  }
  const [yearText, monthText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) {
    return null;
  }
  return { month, year };
}

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
  const [monthListOpen, setMonthListOpen] = useState(false);
  const theme = settings?.theme ?? "dark";
  const colorScheme = Colors[theme];

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();

  const options = useMemo(
    () =>
      Array.from({ length: VISIBLE_BUDGET_MONTHS }, (_, i) => {
        const date = new Date(currentYear, currentMonth - 2 + i);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        return {
          label: `${date.toLocaleString("default", {
            month: "long",
          })} ${year}`,
          value: monthValue(month, year),
        };
      }),
    [currentMonth, currentYear]
  );
  const selectedValue = monthValue(selectedMonth, selectedYear);

  const selectedLabel =
    options.find((option) => option.value === selectedValue)?.label ??
    "Select a month";

  const handleValueChange = (value: string | null) => {
    const selected = parseMonthValue(value);
    if (selected) {
      setSelectedMonth(selected.month);
      setSelectedYear(selected.year);
      AccessibilityInfo.announceForAccessibility(
        `Selected ${
          options.find((option) => option.value === value)?.label
        }`
      );
    }
    setMonthListOpen(false);
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
      <View
        style={[
          styles.pickerContainer,
          { backgroundColor: colorScheme.pickerBackground },
        ]}
      >
        <TouchableOpacity
          style={styles.monthButton}
          onPress={() => setMonthListOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Selected month ${selectedLabel}`}
        >
          <Text style={[styles.monthLabel, { color: colorScheme.text }]}>
            {selectedLabel}
          </Text>
          <MaterialIcons
            name="arrow-drop-down"
            size={24}
            color={colorScheme.text}
          />
        </TouchableOpacity>
        <Modal
          visible={monthListOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMonthListOpen(false)}
        >
          <View style={styles.backdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setMonthListOpen(false)}
            />
            <View
              style={[
                styles.monthList,
                { backgroundColor: colorScheme.background },
              ]}
            >
              {options.map((option) => {
                const selected = option.value === selectedValue;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => handleValueChange(option.value)}
                    style={[
                      styles.monthOption,
                      selected && {
                        backgroundColor: colorScheme.submitButton,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.monthOptionLabel,
                        { color: selected ? "#FFFFFF" : colorScheme.text },
                        selected && styles.monthOptionLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Modal>
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
    borderRadius: 5,
    overflow: "hidden",
    justifyContent: "center",
  },
  monthButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  monthLabel: {
    fontSize: 16,
  },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  monthList: {
    borderRadius: 8,
    overflow: "hidden",
  },
  monthOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  monthOptionLabel: {
    fontSize: 16,
  },
  monthOptionLabelSelected: {
    fontWeight: "700",
  },
  refreshButton: {
    padding: 10,
    borderRadius: 5,
    justifyContent: "center",
    alignItems: "center",
  },
});

export default BudgetFilter;
