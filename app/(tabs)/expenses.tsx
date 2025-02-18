import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  SetStateAction,
} from "react";
import {
  View,
  FlatList,
  Alert,
  Text,
  Button,
  KeyboardAvoidingView,
  StyleSheet,
  Platform,
  TextInput,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { MaterialIcons } from "@expo/vector-icons";
import { debounce } from "lodash";

import { ExpenseInterface } from "../../types/expense";
import FinancialForm from "../../components/FinancialForm";
import ListItem from "../../components/ListItem";
import useBudgetStore from "../../app/store/useBudgetStore";

const Expenses: React.FC = React.memo(() => {
  const expenses = useBudgetStore((state) => state.expenses);
  const addOrUpdateExpense = useBudgetStore(
    (state) => state.addOrUpdateExpense
  );
  const deleteExpense = useBudgetStore((state) => state.deleteExpense);
  const loadExpenses = useBudgetStore((state) => state.loadExpenses);

  const [expenseForm, setExpenseForm] = useState<Partial<ExpenseInterface>>({});
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filterOption, setFilterOption] = useState<"date" | "name">("date");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>("");

  const memoizedLoadExpenses = useCallback(
    () => loadExpenses(),
    [loadExpenses]
  );

  useEffect(() => {
    const load = async () => {
      try {
        await memoizedLoadExpenses();
      } catch (e) {
        setError("Failed to load expenses. Please try again later.");
      }
    };
    load();
  }, [memoizedLoadExpenses]);

  // Debounce the search term
  const handleSearchChange = debounce((text: string) => {
    setDebouncedSearchTerm(text);
  }, 300);

  const handleAddOrUpdateExpense = useCallback(() => {
    if (
      !expenseForm.name ||
      !expenseForm.date ||
      expenseForm.amount === undefined
    ) {
      Alert.alert("Error", "Please fill in the required fields.");
      return;
    }

    let frequency = undefined;
    if (expenseForm.frequency?.value && expenseForm.frequency?.unit) {
      frequency = {
        value: expenseForm.frequency?.value,
        unit: expenseForm.frequency?.unit,
      };
    }

    addOrUpdateExpense(expenseForm, frequency, isEditing);
    resetForm();
  }, [expenseForm, isEditing, addOrUpdateExpense]);

  const resetForm = useCallback(() => {
    setExpenseForm({});
    setIsEditing(false);
    setShowForm(false);
  }, []);

  const handleDateChange = useCallback((event: any, date?: Date) => {
    if (event.type === "set" && date) {
      setExpenseForm((prevForm) => ({ ...prevForm, date }));
    }
    setShowDatePicker(false);
  }, []);

  const handleEdit = useCallback((expense: ExpenseInterface) => {
    setExpenseForm(expense);
    setIsEditing(true);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert(
        "Confirm Delete",
        "Are you sure you want to delete this expense?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteExpense(id),
          },
        ]
      );
    },
    [deleteExpense]
  );

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
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Retry" onPress={memoizedLoadExpenses} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
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
          <View style={styles.buttonContainer}>
            <Button
              title="Add Expense"
              onPress={() => setShowForm(true)}
              accessibilityLabel="Add a new expense"
            />
          </View>

          <View style={styles.searchFilterContainer}>
            <View style={styles.searchInputWrapper}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search expenses..."
                placeholderTextColor="#666"
                value={searchTerm}
                onChangeText={(text) => {
                  setSearchTerm(text);
                  handleSearchChange(text);
                }}
              />
            </View>
            <View style={styles.pickerWrapper}>
              <MaterialIcons
                name={filterOption === "date" ? "event" : "sort-by-alpha"}
                size={24}
                color="#333"
                style={styles.pickerIcon}
              />
              <Picker
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
  buttonContainer: {
    marginBottom: 10,
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
    backgroundColor: "#333",
    color: "#FFF",
  },
  pickerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 0.2,
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#333",
    paddingHorizontal: 8,
  },
  pickerIcon: {
    marginRight: 4,
    color: "#FFF",
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
