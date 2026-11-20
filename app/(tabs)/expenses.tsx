import { useShallow } from "zustand/react/shallow";
import { MaterialIcons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { debounce } from "lodash";
import React, {
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import useBudgetStore from "../../store/useBudgetStore";
import FinancialForm from "../../components/FinancialForm";
import ListItem from "../../components/ListItem";
import { Colors } from "../../constants/Colors";
import { ExpenseInterface } from "../../types/expense";
import { useFinancialEntryForm } from "../../hooks/useFinancialEntryForm";

const Expenses: React.FC = React.memo(function Expenses() {
  const { expenses, settings } = useBudgetStore(
    useShallow(state => ({
      expenses: state.expenses,
      settings: state.settings,
    }))
  );
  const addOrUpdateExpense = useBudgetStore(
    (state) => state.addOrUpdateExpense
  );
  const deleteExpense = useBudgetStore((state) => state.deleteExpense);
  const loadExpenses = useBudgetStore((state) => state.getExpenses);
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;

  const { formData: expenseForm, setFormData: setExpenseForm, isEditing,
    showForm, setShowForm, showDatePicker, setShowDatePicker, resetForm,
    handleSubmit: handleAddOrUpdateExpense, handleDateChange, handleEdit, handleDelete,
  } = useFinancialEntryForm("expense", addOrUpdateExpense, deleteExpense);

  const [error, setError] = useState<string | null>(null);
  const [filterOption, setFilterOption] = useState<"date" | "name">("date");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");

  const memoizedLoadExpenses = useCallback(() => loadExpenses().then(
    () => setError(null),
    () => setError("Failed to load expenses. Please try again later.")
  ), [loadExpenses]);

  useEffect(() => {
    void memoizedLoadExpenses();
  }, [memoizedLoadExpenses]);

  const handleSearchChange = useMemo(() => debounce((text: string) => {
    setDebouncedSearchTerm(text);
  }, 300), []);

  useEffect(() => () => handleSearchChange.cancel(), [handleSearchChange]);

  const renderExpenseItem = useCallback(
    ({ item }: { item: ExpenseInterface }) => (
      <ListItem
        item={item}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
      />
    ),
    [handleEdit, handleDelete]
  );

  const filteredExpenses = useMemo(() => {
    let filtered = expenses.filter((expense) =>
      expense.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );

    if (filterOption === "date") {
      filtered.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    } else if (filterOption === "name") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    return filtered;
  }, [expenses, filterOption, debouncedSearchTerm]);

  if (error) {
    return (
      <View
        style={[
          styles.errorContainer,
          { backgroundColor: colorScheme.background },
        ]}
      >
        <Text style={[styles.errorText, { color: colorScheme.text }]}>
          {error}
        </Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colorScheme.submitButton }]}
          onPress={memoizedLoadExpenses}
        >
          <Text style={[styles.addButtonText, { color: colorScheme.buttonText }]}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[
        styles.container,
        { backgroundColor: colorScheme.cardBackground },
      ]}
    >
      {showForm ? (
        <FinancialForm
          formData={expenseForm}
          setFormData={setExpenseForm}
          isEditing={isEditing}
          handleSubmit={handleAddOrUpdateExpense}
          showDatePicker={showDatePicker}
          setShowDatePicker={setShowDatePicker}
          resetForm={resetForm}
          handleDateChange={handleDateChange}
        />
      ) : (
        <>
          <TouchableOpacity
            style={[
              styles.addButton,
              { backgroundColor: colorScheme.submitButton },
            ]}
            onPress={() => setShowForm(true)}
            accessibilityLabel="Add a new expense"
          >
            <Text style={[styles.addButtonText, { color: colorScheme.buttonText }]}>
              Add Expense
            </Text>
          </TouchableOpacity>

          <View style={styles.searchFilterContainer}>
            <View style={styles.searchInputWrapper}>
              <TextInput
                style={[
                  styles.searchInput,
                  {
                    backgroundColor: colorScheme.pickerBackground,
                    color: colorScheme.text,
                    borderColor: colorScheme.borderBottomColor,
                  },
                ]}
                placeholder="Search expenses..."
                accessibilityLabel="Search expenses"
                placeholderTextColor={colorScheme.text}
                value={searchTerm}
                onChangeText={(text) => {
                  setSearchTerm(text);
                  handleSearchChange(text);
                }}
              />
            </View>
            <View
              style={[
                styles.pickerWrapper,
                {
                  backgroundColor: colorScheme.pickerBackground,
                  borderColor: colorScheme.buttonBorder,
                },
              ]}
            >
              <MaterialIcons
                name={filterOption === "date" ? "event" : "sort-by-alpha"}
                size={24}
                color={colorScheme.text}
                style={styles.pickerIcon}
              />
              <Picker
                accessibilityLabel="Sort expenses"
                selectedValue={filterOption}
                onValueChange={(itemValue: SetStateAction<"name" | "date">) =>
                  setFilterOption(itemValue)
                }
                style={styles.hiddenPicker} // Hide the text but keep functionality
                mode="dropdown"
              >
                <Picker.Item label="Next Date" value="date" />
                <Picker.Item label="Alphabetical" value="name" />
              </Picker>
            </View>
          </View>

          <FlatList
            data={filteredExpenses}
            renderItem={renderExpenseItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            accessibilityLabel="Expenses List"
            accessibilityHint="Displays a list of expenses with edit and delete options"
          />
        </>
      )}
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  addButton: {
    marginBottom: 10,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  filterContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  filterLabel: {
    marginRight: 10,
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "red",
    textAlign: "center",
    marginBottom: 10,
  },
  searchFilterContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  searchInputWrapper: {
    flex: 1,
    marginRight: 8,
  },
  searchInput: {
    height: 42,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  pickerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 0.2,
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  pickerIcon: {
    marginRight: 4,
  },
  hiddenPicker: {
    flex: 1,
    opacity: 0,
    position: "absolute",
    width: "100%",
    height: "100%",
  },
});

export default function ExpensesScreen() {
  return <Expenses />;
}
