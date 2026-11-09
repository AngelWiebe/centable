import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import useBudgetStore from "../../store/useBudgetStore";
import FinancialForm from "../../components/FinancialForm";
import ListItem from "../../components/ListItem";
import { Colors } from "../../constants/Colors";
import { IncomeInterface } from "../../types/income";
import { normalizeFrequency } from "../../utils/normalizeFrequency";

const Incomes: React.FC = React.memo(() => {
  const { incomes, addOrUpdateIncome, deleteIncome, settings } =
    useBudgetStore();
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;

  const [incomeForm, setIncomeForm] = useState<Partial<IncomeInterface>>({});
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  const resetForm = useCallback(() => {
    setIncomeForm({});
    setIsEditing(false);
    setShowForm(false);
  }, []);

  const handleAddOrUpdateIncome = useCallback(
    async (data: Partial<IncomeInterface>) => {
      if (!data.name || !data.date || data.amount === undefined) {
        Alert.alert("Error", "Please fill in the required fields.");
        return;
      }

      await addOrUpdateIncome({
        ...data,
        frequency: normalizeFrequency(data.frequency),
      });

      resetForm();
    },
    [addOrUpdateIncome, resetForm]
  );

  const handleDateChange = useCallback((event: any, date?: Date) => {
    if (event.type === "set" && date) {
      setIncomeForm((prevForm) => ({ ...prevForm, date }));
    }
    setShowDatePicker(false);
  }, []);

  const handleEdit = useCallback((income: IncomeInterface) => {
    setIncomeForm(income);
    setIsEditing(true);
    setShowForm(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert(
        "Confirm Delete",
        "Are you sure you want to delete this income?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await deleteIncome(id);
            },
          },
        ]
      );
    },
    [deleteIncome]
  );

  const renderIncomeItem = useCallback(
    ({ item }: { item: IncomeInterface }) => (
      <ListItem
        item={item}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
      />
    ),
    [handleEdit, handleDelete]
  );

  const memoizedIncomes = useMemo(() => incomes, [incomes]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colorScheme.cardBackground },
      ]}
    >
      {showForm ? (
        <FinancialForm
          formData={incomeForm}
          setFormData={setIncomeForm}
          isEditing={isEditing}
          handleSubmit={handleAddOrUpdateIncome}
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
            accessibilityLabel="Add a new income"
          >
            <Text style={[styles.addButtonText, { color: colorScheme.buttonText }]}>
              Add Income
            </Text>
          </TouchableOpacity>

          <FlatList
            data={memoizedIncomes}
            renderItem={renderIncomeItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            accessibilityLabel="Income List"
            accessibilityHint="Displays a list of incomes with edit and delete options"
          />
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  addButton: {
    marginBottom: 5,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  listContent: {
    marginTop: 10,
    paddingBottom: 20,
  },
});

export default Incomes;
