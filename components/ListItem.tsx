import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AccessibilityInfo,
} from "react-native";

import { IncomeInterface } from "../types/income";
import { ExpenseInterface } from "../types/expense";
import { FrequencyUnit } from "../types/frequency";

interface ListItemInterface {
  item: IncomeInterface | ExpenseInterface;
  handleEdit: (item: ExpenseInterface | IncomeInterface) => void;
  handleDelete: (id: string) => void;
}

const getNextOccurrenceDate = (
  date: Date,
  frequency: { value: number; unit: FrequencyUnit }
): Date => {
  const currentDate = new Date();
  const nextDate = new Date(date);

  if (nextDate >= currentDate) {
    return nextDate; // Return the original date if it hasn't yet passed
  }

  switch (frequency.unit) {
    case "days":
      nextDate.setDate(nextDate.getDate() + frequency.value);
      break;
    case "weeks":
      nextDate.setDate(nextDate.getDate() + frequency.value * 7);
      break;
    case "months":
      nextDate.setMonth(nextDate.getMonth() + frequency.value);
      break;
    case "semi-monthly":
      if (nextDate.getDate() <= 15) {
        nextDate.setDate(15);
      } else {
        nextDate.setMonth(nextDate.getMonth() + 1);
        nextDate.setDate(1);
      }
      break;
    default:
      break;
  }

  return nextDate;
};

const ListItem: React.FC<ListItemInterface> = ({
  item,
  handleEdit,
  handleDelete,
}) => {
  const nextOccurrenceDate = item.frequency
    ? getNextOccurrenceDate(new Date(item.date), item.frequency)
    : new Date(item.date);

  const handleDeletePress = (id: string) => {
    handleDelete(id);
    AccessibilityInfo.announceForAccessibility("Item deleted");
  };

  return (
    <View style={styles.card} accessible={true} accessibilityRole="list">
      <View style={styles.row}>
        <Text
          style={styles.name}
          accessibilityLabel={`Item name: ${item.name}`}
          accessibilityRole="text"
        >
          {item.name}
        </Text>
        <Text
          style={styles.amount}
          accessibilityLabel={`Amount: $${item.amount.toFixed(2)}`}
          accessibilityRole="text"
        >
          ${item.amount.toFixed(2)}
        </Text>
      </View>
      {item.frequency && (
        <Text
          style={styles.frequency}
          accessibilityLabel={`Frequency: Every ${item.frequency.value} ${item.frequency.unit}`}
          accessibilityRole="text"
        >
          Every {item.frequency.value} {item.frequency.unit}
        </Text>
      )}
      {nextOccurrenceDate && (
        <Text
          style={styles.date}
          accessibilityLabel={`Next occurrence date: ${nextOccurrenceDate.toDateString()}`}
          accessibilityRole="text"
        >
          Next: {nextOccurrenceDate.toDateString()}
        </Text>
      )}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => handleEdit(item)}
          style={styles.editButton}
          accessible={true}
          accessibilityLabel="Edit item"
          accessibilityHint={`Edit details for ${item.name}`}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeletePress(item.id)}
          style={styles.deleteButton}
          accessible={true}
          accessibilityLabel="Delete item"
          accessibilityHint={`Delete ${item.name}`}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#333",
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
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  amount: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  frequency: {
    color: "#AAAAAA",
    marginBottom: 5,
  },
  date: {
    color: "#AAAAAA",
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editButton: {
    backgroundColor: "#007BFF",
    padding: 8,
    borderRadius: 5,
  },
  deleteButton: {
    backgroundColor: "#FF5555",
    padding: 8,
    borderRadius: 5,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
});

export default ListItem;
