import { useEffect } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { ThemedText } from "../../components/ThemedText";
import { ThemedView } from "../../components/ThemedView";
import { Colors } from "../../constants/Colors";
import useBudgetStore from "../../store/useBudgetStore";

export default function TabOneScreen() {
  const { fetchAndCleanBudgets, settings } = useBudgetStore();
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;

  useEffect(() => {
    fetchAndCleanBudgets().catch((error) =>
      console.error("❌ Failed to load budgets:", error)
    );
  }, []);

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: colorScheme.cardBackground }]}
      contentContainerStyle={styles.container}
    >
      <ThemedView
        style={[
          styles.content,
          { backgroundColor: colorScheme.cardBackground },
        ]}
      >
        <ThemedText
          style={[styles.disclaimerText, { color: colorScheme.text }]}
          accessibilityLabel="Budgeting strategy"
        >
          - To build a sustainable budget, **overestimate expenses and
          underestimate income** to create a buffer for unexpected costs.
        </ThemedText>

        <ThemedText
          style={[styles.disclaimerText, { color: colorScheme.text }]}
          accessibilityLabel="Savings recommendation"
        >
          - **Pay yourself first**: Treat savings as a fixed expense. Set aside
          a percentage of your income (e.g., 20%) before spending.
        </ThemedText>

        <ThemedText
          style={[styles.disclaimerText, { color: colorScheme.text }]}
          accessibilityLabel="Spending management"
        >
          - Consider adding an "expense" for **weekly discretionary spending**.
          Any leftover funds can be allocated toward **savings or investments**.
        </ThemedText>

        <ThemedText
          style={[styles.disclaimerText, { color: colorScheme.text }]}
          accessibilityLabel="Expense tracking tip"
        >
          - Separate your **fixed expenses (e.g., rent, insurance) from variable
          expenses** (e.g., dining, shopping) to identify areas to cut costs.
        </ThemedText>

        <ThemedText
          style={[styles.disclaimerText, { color: colorScheme.text }]}
          accessibilityLabel="Financial discipline advice"
        >
          - **Use separate accounts**: Keep savings and emergency funds in
          separate accounts from daily spending to **prevent overspending**.
        </ThemedText>

        <ThemedText
          style={[styles.disclaimerText, { color: colorScheme.text }]}
          accessibilityLabel="Debt management tip"
        >
          - If you have **debt**, prioritize paying high-interest loans first.
          Consider the **debt snowball (smallest to largest) or avalanche
          (highest interest first) method**.
        </ThemedText>

        <ThemedView
          style={[
            styles.separator,
            { backgroundColor: colorScheme.borderBottomColor },
          ]}
        />
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  disclaimerText: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: "center",
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: "80%",
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
