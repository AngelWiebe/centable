import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Alert,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BarChart, PieChart } from "react-native-chart-kit";
import ViewShot from "react-native-view-shot";
import { captureRef } from "react-native-view-shot";
import { printToFileAsync } from "expo-print";
import { shareAsync } from "expo-sharing";

import useBudgetStore from "../store/useBudgetStore";

const screenWidth = Dimensions.get("window").width;

const Reports: React.FC = () => {
  const { budgets } = useBudgetStore();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const viewShotRef = useRef(null);

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

  const expenseChartData = Object.entries(expenseBreakdown).map(
    ([name, amount]) => ({
      name,
      amount,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      legendFontColor: "#FFFFFF",
      legendFontSize: 14,
    })
  );

  const downloadReportAsPDF = async () => {
    try {
      if (!viewShotRef.current) return;

      const uri = await captureRef(viewShotRef, {
        format: "png",
        quality: 0.8,
      });

      const htmlContent = `
        <html>
        <head>
          <title>Budget Report</title>
        </head>
        <body style="font-family: Arial, sans-serif;">
          <h2 style="text-align:center;">Budget Report</h2>
          <p><strong>Total Income:</strong> $${totalIncome.toFixed(2)}</p>
          <p><strong>Total Expenses:</strong> $${totalExpenses.toFixed(2)}</p>
          <img src="${uri}" style="width:100%;" />
        </body>
        </html>
      `;

      const file = await printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      await shareAsync(file.uri);
      Alert.alert("Success", "Report saved and ready to share!");
    } catch (error) {
      console.error("Error generating report:", error);
      Alert.alert("Error", "Could not generate the report.");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.filterContainer}>
        <TouchableOpacity
          onPress={() => setShowStartPicker(true)}
          style={styles.filterButton}
        >
          <Text
            style={styles.filterText}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Start: {startDate ? startDate.toLocaleDateString() : "Select"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowEndPicker(true)}
          style={styles.filterButton}
        >
          <Text
            style={styles.filterText}
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
          <ViewShot ref={viewShotRef} style={styles.summaryContainer}>
            <Text style={styles.sectionTitle}>Income Summary</Text>
            <Text style={styles.summaryText}>
              Total Income: ${totalIncome.toFixed(2)}
            </Text>

            <BarChart
              data={incomeChartData}
              width={screenWidth - 32}
              height={220}
              chartConfig={{
                backgroundGradientFrom: "#1E1E1E",
                backgroundGradientTo: "#1E1E1E",
                color: (opacity = 1) => `rgba(0, 255, 127, ${opacity})`,
                labelColor: () => "#FFFFFF",
                style: { borderRadius: 16 },
              }}
              style={{ marginVertical: 8, borderRadius: 16 }}
              yAxisSuffix="$"
              yAxisLabel="$"
            />

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
              Expense Summary
            </Text>
            <Text style={styles.summaryText}>
              Total Expenses: ${totalExpenses.toFixed(2)}
            </Text>

            <PieChart
              data={expenseChartData}
              width={screenWidth - 32}
              height={220}
              chartConfig={{
                color: (opacity = 1) => `rgba(255, 165, 0, ${opacity})`,
                labelColor: () => "#FFFFFF",
              }}
              accessor="amount"
              backgroundColor="transparent"
              paddingLeft="15"
              style={{ marginVertical: 8 }}
            />
          </ViewShot>
        ) : (
          <Text style={styles.noDataText}>
            No budgets available for the selected date range.
          </Text>
        )
      ) : (
        <Text style={styles.noDataText}>
          Select a date range and apply filters to see reports.
        </Text>
      )}
      <TouchableOpacity
        style={styles.downloadButton}
        onPress={downloadReportAsPDF}
      >
        <Text style={styles.downloadText}>Download Report as PDF</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 16,
    backgroundColor: "#1E1E1E",
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
    backgroundColor: "#2E2E2E",
    borderRadius: 5,
    alignItems: "center",
  },
  filterText: {
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "center",
  },
  summaryContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#00FF7F",
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 16,
    color: "#FF6347",
    textAlign: "center",
    marginTop: 20,
  },
  downloadButton: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#00FF7F",
    borderRadius: 5,
    alignItems: "center",
  },
  downloadText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
  },
});

export default Reports;
