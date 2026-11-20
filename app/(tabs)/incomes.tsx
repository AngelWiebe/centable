import { useShallow } from "zustand/react/shallow";
import React, { useCallback } from "react";
import {
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
import { useFinancialEntryForm } from "../../hooks/useFinancialEntryForm";

const Incomes: React.FC = React.memo(function Incomes() {
  const { incomes, addOrUpdateIncome, deleteIncome, settings } = useBudgetStore(
    useShallow(state => ({
      incomes: state.incomes,
      addOrUpdateIncome: state.addOrUpdateIncome,
      deleteIncome: state.deleteIncome,
      settings: state.settings,
    }))
  );
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;

  const { formData: incomeForm, setFormData: setIncomeForm, isEditing,
    showForm, setShowForm, showDatePicker, setShowDatePicker, resetForm,
    handleSubmit: handleAddOrUpdateIncome, handleDateChange, handleEdit, handleDelete,
  } = useFinancialEntryForm("income", addOrUpdateIncome, deleteIncome);

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
            data={incomes}
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
