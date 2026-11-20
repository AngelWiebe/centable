import { useShallow } from "zustand/react/shallow";
import { buildReportHtml } from "../../utils/reportHtml";
import { groupReportExpenses, summarizeReportExpenses, summarizeReportIncome } from "../../utils/reportExpenses";
import DateTimePicker from "@react-native-community/datetimepicker";
import { printToFileAsync } from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useState } from "react";
import {
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, PieChart } from "react-native-chart-kit";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { Colors } from "../../constants/Colors";
import { currencySettings } from "../../types/settings";
import { generateRandomColor } from "../../utils/generateRandomColor";
import { getFirstAndLastDayOfMonth } from "../../utils/getFirstAndLast";
import { toLocalDay } from "../../utils/occurrenceDates";
import useBudgetStore from "../../store/useBudgetStore";

async function loadExportModules() {
  try {
    const FileSystem = await import("expo-file-system/legacy");
    const IntentLauncher = await import("expo-intent-launcher");
    return { FileSystem, IntentLauncher };
  } catch {
    return { FileSystem: null, IntentLauncher: null };
  }
}

const screenWidth = Dimensions.get("window").width;

const Reports: React.FC = () => {
  const { budgets, unfundedExpenses, settings } = useBudgetStore(
    useShallow(state => ({
      budgets: state.budgets,
      unfundedExpenses: state.unfundedExpenses,
      settings: state.settings,
    }))
  );
  const { symbol, decimals } = currencySettings[settings?.currency || "CAD"];
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;

  const { firstDay, lastDay } = getFirstAndLastDayOfMonth();
  const [startDate, setStartDate] = useState<Date | null>(firstDay);
  const [endDate, setEndDate] = useState<Date | null>(lastDay);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const filtersApplied = startDate !== null && endDate !== null;

  const filteredBudgets = budgets.filter((budget) => {
    const budgetDay = toLocalDay(budget.date).getTime();
    const startDay = startDate ? toLocalDay(startDate).getTime() : null;
    const endDay = endDate ? toLocalDay(endDate).getTime() : null;
    return (
      (startDay === null || budgetDay >= startDay) &&
      (endDay === null || budgetDay <= endDay)
    );
  });

  const { totalIncome, incomeBreakdown } = summarizeReportIncome(filteredBudgets);

  const { unfunded, expenseCount, totalUnfunded, totalExpenses, expenseBreakdown } = summarizeReportExpenses(
    budgets, unfundedExpenses, startDate, endDate
  );

  const incomeChartData = {
    labels: Object.keys(incomeBreakdown),
    datasets: [{ data: Object.values(incomeBreakdown) }],
  };

  const groupedExpenseBreakdown = groupReportExpenses(expenseBreakdown);

  // Create chart data for pie chart
  const chartEntries = Object.entries(groupedExpenseBreakdown);
  const filteredEntries = chartEntries.map(([name, amount]) => ({
    name,
    amount,
    color: generateRandomColor(),
    legendFontColor: colorScheme.text,
    legendFontSize: 14,
  }));

  const expenseChartData = filteredEntries;

  const totalRemainingBalance = filteredBudgets.reduce(
    (sum, budget) => sum + budget.remainingBalance,
    0
  );

  const downloadReportAsPDF = async () => {
    try {
      const { FileSystem, IntentLauncher } = await loadExportModules();
      if (!FileSystem || !FileSystem.documentDirectory) {
        Alert.alert(
          "Not Available",
          "PDF export requires a development build. Please rebuild the app with 'npx expo run:android' or 'npx expo run:ios'."
        );
        return;
      }

      const formattedStartDate = startDate
        ? startDate.toLocaleDateString()
        : "N/A";
      const formattedEndDate = endDate ? endDate.toLocaleDateString() : "N/A";

      const html = buildReportHtml({ formattedStartDate, formattedEndDate, symbol, decimals,
        totalIncome, incomeBreakdown, totalExpenses, totalUnfunded, unfunded,
        groupedExpenseBreakdown, totalRemainingBalance, filteredBudgets });

      const file = await printToFileAsync({ html, base64: false });

      if (!FileSystem || !FileSystem.documentDirectory) {
        Alert.alert(
          "Not Available",
          "PDF export requires a development build. Please rebuild the app with 'npx expo run:android' or 'npx expo run:ios'."
        );
        return;
      }

      const fileName = `Budget_Report_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      const newPath = `${FileSystem.documentDirectory}${fileName}`;

      // Copy file to a permanent location
      await FileSystem.copyAsync({ from: file.uri, to: newPath });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        // Share/download the PDF
        await Sharing.shareAsync(newPath, {
          mimeType: "application/pdf",
          dialogTitle: "Save Budget Report",
          UTI: "com.adobe.pdf",
        });
      } else if (Platform.OS === "android" && IntentLauncher) {
        // Fallback for Android: open with intent
        try {
          const contentUri = await FileSystem.getContentUriAsync(newPath);
          await IntentLauncher.startActivityAsync(
            "android.intent.action.VIEW",
            {
              data: contentUri,
              flags: 1,
              type: "application/pdf",
            }
          );
        } catch (intentError) {
          console.error("Intent launcher error:", intentError);
          Alert.alert(
            "Success",
            `Report saved to:\n${newPath}\n\nYou can find it in your device's file manager.`
          );
        }
      } else {
        Alert.alert(
          "Success",
          `Report saved to:\n${newPath}\n\nYou can find it in your device's file manager.`
        );
      }
    } catch (e) {
      console.error("PDF generation error", e);
      Alert.alert(
        "Error",
        `Failed to generate PDF: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  return (
    <KeyboardAwareScrollView
      contentContainerStyle={[
        styles.scrollContainer,
        { backgroundColor: colorScheme.cardBackground },
      ]}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid={true}
      extraScrollHeight={20}
    >
      <View style={styles.filterContainer}>
        <TouchableOpacity
          onPress={() => setShowStartPicker(true)}
          style={[
            styles.filterButton,
            { backgroundColor: colorScheme.pickerBackground },
          ]}
        >
          <Text
            style={[styles.filterText, { color: colorScheme.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Start: {startDate ? startDate.toLocaleDateString() : "Select"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowEndPicker(true)}
          style={[
            styles.filterButton,
            { backgroundColor: colorScheme.pickerBackground },
          ]}
        >
          <Text
            style={[styles.filterText, { color: colorScheme.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            End: {endDate ? endDate.toLocaleDateString() : "Select"}
          </Text>
        </TouchableOpacity>
      </View>

      {showStartPicker && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowStartPicker(false);
            if (date) setStartDate(date);
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowEndPicker(false);
            if (date) setEndDate(date);
          }}
        />
      )}

      {filtersApplied ? (
        filteredBudgets.length > 0 || expenseCount > 0 ? (
          <View style={styles.summaryContainer}>
            <Text style={[styles.sectionTitle, { color: colorScheme.text }]}>
              Income Summary
            </Text>
            <Text
              style={[styles.summaryText, { color: colorScheme.summaryAmount }]}
            >
              Total Income: {symbol}
              {totalIncome.toFixed(decimals)}
            </Text>

            {incomeChartData.labels.length > 0 && <BarChart
              data={incomeChartData}
              width={screenWidth - 32}
              height={220}
              chartConfig={{
                style: { borderRadius: 16 },
                backgroundGradientFrom: colorScheme.background,
                backgroundGradientTo: colorScheme.background,
                color: (opacity = 1) => colorScheme.expenseAmount,
                labelColor: () => colorScheme.text,
              }}
              fromZero={true}
              style={{ marginVertical: 8, borderRadius: 16 }}
              yAxisLabel={symbol}
              yAxisSuffix={symbol}
              yAxisInterval={100}
            />}

            <Text
              style={[
                styles.sectionTitle,
                { marginTop: 20, color: colorScheme.text },
              ]}
            >
              Expense Summary
            </Text>

            <Text
              style={[styles.summaryText, { color: colorScheme.summaryAmount }]}
            >
              Total Expenses: {symbol}
              {totalExpenses.toFixed(decimals)}
            </Text>

            {unfunded.length > 0 && <View>
              <Text style={[styles.summaryText, { color: colorScheme.negativeBalance }]}>
                Unfunded expenses: {symbol}{totalUnfunded.toFixed(decimals)}
              </Text>
              {unfunded.map(item => <Text key={item.id} style={{ color: colorScheme.text }}>
                {item.expense.name}: {symbol}{item.amount.toFixed(decimals)} · Needs {symbol}{item.shortfall.toFixed(decimals)} more in one earlier budget.
              </Text>)}
            </View>}

            <PieChart
              data={expenseChartData}
              width={screenWidth - 32}
              height={220}
              chartConfig={{
                backgroundGradientFrom: "#ffffff",
                backgroundGradientTo: "#ffffff",
                color: () => colorScheme.expenseAmount,
                labelColor: () => colorScheme.text,
              }}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="15"
              style={{ marginVertical: 8 }}
            />

            <View
              style={[
                styles.expenseBreakdownContainer,
                { backgroundColor: colorScheme.cardBackground },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colorScheme.text }]}>
                Full Expense Breakdown
              </Text>
              {Object.entries(groupedExpenseBreakdown).map(([name, amount]) => (
                <View
                  key={name}
                  style={[
                    styles.expenseItem,
                    { borderBottomColor: colorScheme.borderBottomColor },
                  ]}
                >
                  <Text
                    style={[styles.expenseName, { color: colorScheme.text }]}
                  >
                    {name}
                  </Text>
                  <Text
                    style={[
                      styles.expenseAmount,
                      { color: colorScheme.expenseAmount },
                    ]}
                  >
                    {symbol}
                    {amount.toFixed(decimals)}
                  </Text>
                </View>
              ))}
            </View>
            <View
              style={[
                styles.remainingBalanceContainer,
                { backgroundColor: colorScheme.cardBackground },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colorScheme.text }]}>
                Remaining Balances
              </Text>
              <Text
                style={[
                  styles.summaryText,
                  { color: colorScheme.summaryAmount },
                ]}
              >
                Remaining in allocated budgets: {symbol}
                {totalRemainingBalance.toFixed(decimals)}
              </Text>
              {filteredBudgets.map((budget) => (
                <View
                  key={budget.id}
                  style={[
                    styles.remainingBalanceItem,
                    { borderBottomColor: colorScheme.borderBottomColor },
                  ]}
                >
                  <Text
                    style={[styles.budgetName, { color: colorScheme.text }]}
                  >
                    {budget.income.name}
                  </Text>
                  <Text
                    style={[
                      styles.budgetAmount,
                      { color: colorScheme.summaryAmount },
                    ]}
                  >
                    {symbol}
                    {budget.remainingBalance.toFixed(decimals)}
                  </Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={[
                styles.downloadButton,
                { backgroundColor: colorScheme.submitButton },
              ]}
              onPress={downloadReportAsPDF}
            >
              <Text
                style={[styles.downloadText, { color: colorScheme.buttonText }]}
              >
                Download Report as PDF
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.noDataText, { color: colorScheme.text }]}>
            No budgets available for the selected date range.
          </Text>
        )
      ) : (
        <Text style={[styles.noDataText, { color: colorScheme.text }]}>
          Select a date range and apply filters to see reports.
        </Text>
      )}
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 10,
    flexGrow: 1,
  },
  filterContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    marginHorizontal: 4,
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
  },
  filterText: {
    fontSize: 14,
    textAlign: "center",
  },
  summaryContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 20,
  },
  downloadButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#00FF7F",
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 10,
  },
  downloadText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  expenseBreakdownContainer: {
    marginTop: 20,
    padding: 10,
    borderRadius: 8,
  },
  expenseItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
  },
  expenseName: {
    fontSize: 16,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
  remainingBalanceContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#444",
    borderRadius: 8,
  },
  remainingBalanceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
  },
  budgetName: {
    fontSize: 16,
  },
  budgetAmount: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default Reports;
