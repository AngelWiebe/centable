import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, FlatList, Alert, Text, Button, StyleSheet } from "react-native";

import { IncomeInterface } from "../../types/income";
import FinancialForm from "../../components/FinancialForm";
import ListItem from "../../components/ListItem";
import useBudgetStore from "../../app/store/useBudgetStore";

const Incomes: React.FC = React.memo(() => {
  const incomes = useBudgetStore((state) => state.incomes);
  const addOrUpdateIncome = useBudgetStore((state) => state.addOrUpdateIncome);
  const deleteIncome = useBudgetStore((state) => state.deleteIncome);
  const loadIncomes = useBudgetStore((state) => state.loadIncomes);

  const [incomeForm, setIncomeForm] = useState<Partial<IncomeInterface>>({});
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        await loadIncomes();
      } catch (e) {
        setError("Failed to load incomes. Please try again later.");
      }
    };
    load();
  }, [loadIncomes]);

  const handleAddOrUpdateIncome = useCallback(async () => {
    if (
      !incomeForm.name ||
      !incomeForm.date ||
      incomeForm.amount === undefined
    ) {
      Alert.alert("Error", "Please fill in the required fields.");
      return;
    }

    let frequency = undefined;
    if (incomeForm.frequency?.value && incomeForm.frequency?.unit) {
      frequency = {
        value: incomeForm.frequency?.value,
        unit: incomeForm.frequency?.unit,
      };
    }

    await addOrUpdateIncome(incomeForm, frequency, isEditing);
    resetForm();
  }, [incomeForm, isEditing, addOrUpdateIncome]);

  const resetForm = useCallback(() => {
    setIncomeForm({});
    setIsEditing(false);
    setShowForm(false);
  }, []);

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

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Retry" onPress={loadIncomes} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
          <View style={styles.buttonContainer}>
            <Button
              title="Add Income"
              onPress={() => setShowForm(true)}
              accessibilityLabel="Add a new income"
            />
          </View>

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
  buttonContainer: {
    marginBottom: 5,
  },
  listContent: {
    marginTop: 10,
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
});

export default Incomes;
