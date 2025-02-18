import { StyleSheet } from "react-native";

import { ThemedView } from "../../components/ThemedView";
import { ThemedText } from "../../components/ThemedText";

export default function TabOneScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Disclaimers</ThemedText>
      <ThemedText
        style={styles.disclaimerText}
        accessibilityLabel="Data storage disclaimer"
      >
        - All data entered is stored locally on your device. Clearing the cache
        or cookies will result in the need to re-enter all data.
      </ThemedText>
      <ThemedText
        style={styles.disclaimerText}
        accessibilityLabel="Budgeting tip"
      >
        - For best results, estimate expenses high and incomes low.
      </ThemedText>
      <ThemedText style={styles.disclaimerText} accessibilityLabel="Saving tip">
        - Recommendation: add an "expense" for weekly spending. The leftover
        funds become your savings. Alternatively, add an "expense" for the
        amount you want to save, and the remaining funds are for spending.
      </ThemedText>
      <ThemedText
        style={styles.disclaimerText}
        accessibilityLabel="Expense management advice"
      >
        - It is advisable to keep expense-related funds in a separate account
        from spending money to prevent overspending.
      </ThemedText>
      <ThemedView style={styles.separator} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
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
    backgroundColor: "#ccc",
  },
  button: {
    backgroundColor: "#1E90FF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});
