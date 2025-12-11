import DateTimePicker from "@react-native-community/datetimepicker";
import { printToFileAsync } from "expo-print";
import React, { useEffect, useState } from "react";
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

let FileSystem: any = null;
let IntentLauncher: any = null;

try {
  // @ts-ignore - Native modules may not be available in all environments
  FileSystem = require("expo-file-system");
  // @ts-ignore
  IntentLauncher = require("expo-intent-launcher");
} catch (e) {
  // Native modules not available (e.g., in Expo Go)
  FileSystem = null;
  IntentLauncher = null;
}

import { Colors } from "../../constants/Colors";
import { currencySettings } from "../../types/settings";
import { generateRandomColor } from "../../utils/generateRandomColor";
import { getFirstAndLastDayOfMonth } from "../../utils/getFirstAndLast";
import useBudgetStore from "../store/useBudgetStore";

const screenWidth = Dimensions.get("window").width;

const Reports: React.FC = () => {
  const { budgets, settings } = useBudgetStore();
  const { symbol, decimals } = currencySettings[settings?.currency || "CAD"];
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;

  const { firstDay, lastDay } = getFirstAndLastDayOfMonth();
  const [startDate, setStartDate] = useState<Date | null>(firstDay);
  const [endDate, setEndDate] = useState<Date | null>(lastDay);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);

  const filteredBudgets = budgets.filter((budget) => {
    const budgetDate = new Date(budget.date);
    return (
      (!startDate || budgetDate >= startDate) &&
      (!endDate || budgetDate <= endDate)
    );
  });

  useEffect(() => {
    if (startDate && endDate) {
      setFiltersApplied(true);
    }
  }, [startDate, endDate]);

  const totalIncome = filteredBudgets.reduce(
    (sum, budget) => sum + budget.income.amount,
    0
  );

  const incomeBreakdown = filteredBudgets.reduce((acc, budget) => {
    acc[budget.income.name] =
      (acc[budget.income.name] || 0) + budget.income.amount;
    return acc;
  }, {} as Record<string, number>);

  const totalExpenses = filteredBudgets.reduce(
    (sum, budget) =>
      sum +
      budget.bills.reduce((billSum, bill) => billSum + bill.expense.amount, 0),
    0
  );

  const expenseBreakdown = filteredBudgets.reduce((acc, budget) => {
    budget.bills.forEach(({ expense }) => {
      acc[expense.name] = (acc[expense.name] || 0) + expense.amount;
    });
    return acc;
  }, {} as Record<string, number>);

  const incomeChartData = {
    labels: Object.keys(incomeBreakdown),
    datasets: [{ data: Object.values(incomeBreakdown) }],
  };

  const totalAmount = Object.values(expenseBreakdown).reduce(
    (sum, val) => sum + val,
    0
  );

  // Group expenses: combine those below 5% into "Other"
  const groupedExpenseBreakdown: Record<string, number> = {};
  let otherTotal = 0;

  for (const [name, amount] of Object.entries(expenseBreakdown)) {
    const percentage = totalAmount > 0 ? amount / totalAmount : 0;
    if (percentage < 0.05) {
      otherTotal += amount;
    } else {
      groupedExpenseBreakdown[name] = amount;
    }
  }

  if (otherTotal > 0) {
    groupedExpenseBreakdown["Other"] = otherTotal;
  }

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

      const html = `
        <html>
          <head>
            <style>
              body { font-family: Arial; padding: 24px; color: #333; }
              h2, h3 { color: #222; }
              .section { margin-bottom: 24px; }
              .item-row { display: flex; justify-content: space-between; padding: 4px 0; }
              .label { font-weight: bold; }
              img { max-width: 100%; margin-top: 10px; }
            </style>
          </head>
          <body>
            <h2>Budget Report</h2>
            <p><strong>Start:</strong> ${formattedStartDate}</p>
            <p><strong>End:</strong> ${formattedEndDate}</p>
  
            <div class="section">
              <h3>Income Summary</h3>
              <p>Total Income: ${symbol}${totalIncome.toFixed(decimals)}</p>
              ${Object.entries(incomeBreakdown)
                .map(
                  ([name, amount]) =>
                    `<div class="item-row"><span>${name}</span><span>${symbol}${amount.toFixed(
                      decimals
                    )}</span></div>`
                )
                .join("")}
            </div>
  
            <div class="section">
              <h3>Expense Summary</h3>
              <p>Total Expenses: ${symbol}${totalExpenses.toFixed(decimals)}</p>
              ${Object.entries(groupedExpenseBreakdown)
                .map(
                  ([name, amount]) =>
                    `<div class="item-row"><span>${name}</span><span>${symbol}${amount.toFixed(
                      decimals
                    )}</span></div>`
                )
                .join("")}
            </div>
  
            <div class="section">
              <h3>Remaining Balances</h3>
              <p>Total: ${symbol}${totalRemainingBalance.toFixed(decimals)}</p>
              ${filteredBudgets
                .map(
                  (b) =>
                    `<div class="item-row"><span>${
                      b.income.name
                    }</span><span>${symbol}${b.remainingBalance.toFixed(
                      decimals
                    )}</span></div>`
                )
                .join("")}
            </div>
          </body>
        </html>
      `;

      const file = await printToFileAsync({ html, base64: false });
      const newPath = `${FileSystem.documentDirectory}Budget_Report.pdf`;

      await FileSystem.moveAsync({ from: file.uri, to: newPath });

      Alert.alert("Success", `Report saved to:\n${newPath}`);

      if (Platform.OS === "android" && IntentLauncher) {
        const contentUri = await FileSystem.getContentUriAsync(newPath);
        await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
          data: contentUri,
          flags: 1,
          type: "application/pdf",
        });
      }
    } catch (e) {
      console.error("PDF generation error", e);
      Alert.alert("Error", "Failed to generate PDF.");
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
        filteredBudgets.length > 0 ? (
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

            <BarChart
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
            />

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
                Total Remaining Balance: {symbol}
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
