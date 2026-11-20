import { useCallback, useState } from "react";
import { AccessibilityInfo, Alert } from "react-native";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import type { FinancialEntry, FinancialEntryDraft } from "../types/financialEntry";
import { normalizeFrequency } from "../utils/normalizeFrequency";

export function useFinancialEntryForm(
  kind: "income" | "expense",
  save: (entry: Partial<FinancialEntry>) => Promise<void>,
  remove: (id: string) => Promise<void>
) {
  const [formData, setFormData] = useState<FinancialEntryDraft>({});
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const resetForm = useCallback(() => {
    setFormData({});
    setIsEditing(false);
    setShowForm(false);
  }, []);
  const handleSubmit = useCallback(async (data: Partial<FinancialEntry>) => {
    if (!data.name || !data.date || data.amount === undefined) {
      Alert.alert("Error", "Please fill in the required fields.");
      return;
    }
    await save({ ...data, frequency: normalizeFrequency(data.frequency) });
    resetForm();
  }, [save, resetForm]);
  const handleDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (event.type === "set" && date) setFormData(previous => ({ ...previous, date }));
    setShowDatePicker(false);
  }, []);
  const handleEdit = useCallback((entry: FinancialEntry) => {
    setFormData(entry);
    setIsEditing(true);
    setShowForm(true);
  }, []);
  const handleDelete = useCallback((id: string) => {
    Alert.alert("Confirm Delete", `Are you sure you want to delete this ${kind}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await remove(id);
          AccessibilityInfo.announceForAccessibility("Item deleted");
        }
        catch { Alert.alert(`Unable to delete ${kind}`, "Your saved data is unchanged. Please try again."); }
      } },
    ]);
  }, [kind, remove]);
  return { formData, setFormData, isEditing, showForm, setShowForm, showDatePicker,
    setShowDatePicker, resetForm, handleSubmit, handleDateChange, handleEdit, handleDelete };
}
