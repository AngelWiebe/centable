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
  Alert,
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
import { normalizeFrequency } from "../../utils/normalizeFrequency";

const Expenses: React.FC = React.memo(() => {
  const { expenses, settings } = useBudgetStore();
  const addOrUpdateExpense = useBudgetStore(
    (state) => state.addOrUpdateExpense
  );
  const deleteExpense = useBudgetStore((state) => state.deleteExpense);
  const loadExpenses = useBudgetStore((state) => state.getExpenses);
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;

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

  const resetForm = useCallback(() => {
    setExpenseForm({});
    setIsEditing(false);
    setShowForm(false);
  }, []);

  const handleAddOrUpdateExpense = useCallback(
    async (data: Partial<ExpenseInterface>) => {
      if (!data.name || !data.date || data.amount === undefined) {
        Alert.alert("Error", "Please fill in the required fields.");
        return;
      }

      await addOrUpdateExpense({
        ...data,
        frequency: normalizeFrequency(data.frequency),
      });
      resetForm();
    },
    [addOrUpdateExpense, resetForm]
  );

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
