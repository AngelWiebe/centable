import React from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import useBudgetStore from "../app/store/useBudgetStore";
import { Colors } from "../constants/Colors";
import { ExpenseInterface } from "../types/expense";
import { IncomeInterface } from "../types/income";
import { currencySettings } from "../types/settings";
import { getNextOccurrenceDate } from "../utils/getNext";

interface ListItemInterface {
  item: IncomeInterface | ExpenseInterface;
  handleEdit: (item: ExpenseInterface | IncomeInterface) => void;
  handleDelete: (id: string) => void;
}

const ListItem: React.FC<ListItemInterface> = ({
  item,
  handleEdit,
  handleDelete,
}) => {
  const { settings } = useBudgetStore();
  const theme = settings?.theme ?? "dark";
  const colorScheme = Colors[theme];
  const { symbol, decimals } = currencySettings[settings?.currency || "CAD"];

  const nextOccurrenceDate = item.frequency
    ? getNextOccurrenceDate(new Date(item.date), item.frequency)
    : new Date(item.date);

  const handleDeletePress = (id: string) => {
    handleDelete(id);
    AccessibilityInfo.announceForAccessibility("Item deleted");
  };

  return (
    <View
      style={[styles.card, { backgroundColor: colorScheme.background }]}
      accessible={true}
      accessibilityRole="list"
    >
      <View style={styles.row}>
        <Text
          style={[styles.name, { color: colorScheme.text }]}
          accessibilityLabel={`Item name: ${item.name}`}
          accessibilityRole="text"
        >
          {item.name}
        </Text>
        <Text
          style={[styles.amount, { color: colorScheme.text }]}
          accessibilityLabel={`Amount: ${symbol}${item.amount.toFixed(decimals)}`}
          accessibilityRole="text"
        >
          {symbol}{item.amount.toFixed(decimals)}
        </Text>
      </View>
      {item.frequency && (
        <Text
          style={[styles.frequency, { color: colorScheme.text }]}
          accessibilityLabel={`Frequency: Every ${item.frequency.value} ${item.frequency.unit}`}
          accessibilityRole="text"
        >
          Every {item.frequency.value} {item.frequency.unit}
        </Text>
      )}
      {nextOccurrenceDate && (
        <Text
          style={[styles.date, { color: colorScheme.text }]}
          accessibilityLabel={`Next occurrence date: ${nextOccurrenceDate.toDateString()}`}
          accessibilityRole="text"
        >
          Next: {nextOccurrenceDate.toDateString()}
        </Text>
      )}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => handleEdit(item)}
          style={[
            styles.editButton,
            { backgroundColor: colorScheme.submitButton },
          ]}
          accessible={true}
          accessibilityLabel="Edit item"
          accessibilityHint={`Edit details for ${item.name}`}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, { color: colorScheme.buttonText }]}>
            Edit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeletePress(item.id)}
          style={[
            styles.deleteButton,
            { backgroundColor: colorScheme.resetButton },
          ]}
          accessible={true}
          accessibilityLabel="Delete item"
          accessibilityHint={`Delete ${item.name}`}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, { color: colorScheme.buttonText }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  name: {
    fontWeight: "bold",
    fontSize: 16,
  },
  amount: {
    fontSize: 16,
  },
  frequency: {
    marginBottom: 5,
  },
  date: {
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editButton: {
    padding: 8,
    borderRadius: 5,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 5,
  },
  buttonText: {
    fontWeight: "bold",
  },
});

export default ListItem;
