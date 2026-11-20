import { useShallow } from "zustand/react/shallow";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Keyboard,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";

import useBudgetStore from "../store/useBudgetStore";
import { Colors } from "../constants/Colors";
import { parseMoneyInput } from "../utils/money";
import { currencySettings } from "../types/settings";
import { FinancialEntry, FinancialEntryDraft } from "../types/financialEntry";
import { FrequencyInterface } from "../types/frequency";

interface FinancialFormProps {
  formData: FinancialEntryDraft;
  setFormData: (data: FinancialEntryDraft) => void;
  isEditing: boolean;
  handleSubmit: (data: Partial<FinancialEntry>) => Promise<void>;
  showDatePicker: boolean;
  setShowDatePicker: (show: boolean) => void;
  resetForm: () => void;
  handleDateChange: (event: DateTimePickerEvent, date?: Date) => void;
}

const FinancialForm = ({
  formData,
  setFormData,
  isEditing,
  handleSubmit,
  showDatePicker,
  setShowDatePicker,
  resetForm,
  handleDateChange,
}: FinancialFormProps) => {
  const saving = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rawAmount, setRawAmount] = useState<string>(
    formData.amount?.toString() || ""
  );
  // Default to recurring (false) - only true if explicitly one-time
  // For new entries, default to recurring. For edits, check if frequency exists
  const [isOneTime, setIsOneTime] = useState<boolean>(() => {
    // If editing and frequency is explicitly null/undefined, it's one-time
    if (
      isEditing &&
      (formData.frequency === null || formData.frequency === undefined)
    ) {
      return true;
    }
    // If frequency exists but has no unit, it's one-time
    if (formData.frequency && !formData.frequency.unit) {
      return true;
    }
    // Default to recurring (false)
    return false;
  });
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const { settings } = useBudgetStore(
    useShallow(state => ({
      settings: state.settings,
    }))
  );
  const decimals = currencySettings[settings?.currency ?? "CAD"]?.decimals ?? 2;
  const theme = settings?.theme ?? "dark";
  const colorScheme = Colors[theme];

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setIsKeyboardOpen(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setIsKeyboardOpen(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    // Initialize frequency to 1 month on first load if not set and not one-time
    const hasFrequency = formData.frequency && formData.frequency.unit;

    // If no frequency is set and it's not one-time, default to 1 month
    if (!hasFrequency && !isOneTime) {
      setFormData({
        ...formData,
        frequency: { value: 1, unit: "months" },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAmountChange = (text: string) => {
    setRawAmount(text);
    setFormData({ ...formData, amount: parseMoneyInput(text, decimals) ?? undefined });
  };

  const handleAmountBlur = () => {
    const amount = parseMoneyInput(rawAmount, decimals);
    if (amount === null) return;
    setRawAmount(amount.toFixed(decimals));
    setFormData({ ...formData, amount });
  };

  const handleFrequencyChange = (text: string) => {
    if (/^\d*$/.test(text)) {
      setFormData({
        ...formData,
        frequency: {
          value: text === "" ? undefined : parseInt(text, 10),
          unit: formData.frequency?.unit || "months",
        },
      });
    }
  };

  const validateAndSubmit = async () => {
    if (saving.current) return;
    const amount = parseMoneyInput(rawAmount, decimals);
    if (amount === null) {
      Alert.alert("Invalid amount", `Enter a complete number with no more than ${decimals} decimal places.`);
      return;
    }
    if (!formData.name?.trim() || !(formData.date instanceof Date) || !Number.isFinite(formData.date.getTime())) {
      Alert.alert("Missing details", "Enter a name and a valid date.");
      return;
    }
    const frequency = isOneTime
      ? undefined
      : {
          value:
            formData.frequency?.unit === "semi-monthly"
              ? 1
              : formData.frequency?.value || 1,
          unit: formData.frequency?.unit || "months",
        };

    if (!isOneTime && !frequency?.unit) {
      Alert.alert(
        "Validation Error",
        "Either select 'One-Time Occurrence' or set a valid frequency."
      );
      AccessibilityInfo.announceForAccessibility(
        "Validation error: Either select 'One-Time Occurrence' or set a valid frequency."
      );
      return;
    }

    const payload = { ...formData, name: formData.name.trim(), amount, frequency };
    setFormData(payload);
    AccessibilityInfo.announceForAccessibility(
      isEditing ? "Updating financial entry" : "Adding financial entry"
    );
    saving.current = true;
    setIsSubmitting(true);
    try {
      await handleSubmit(payload);
    } catch {
      Alert.alert("Unable to save entry", "Your entry was not saved. Please try again.");
      AccessibilityInfo.announceForAccessibility("Entry was not saved. Please try again.");
    } finally {
      saving.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        isKeyboardOpen && Platform.OS === "android" ? styles.keyboardOpen : {},
      ]}
      pointerEvents="box-none"
    >
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.formContainer,
          { backgroundColor: colorScheme.background },
        ]}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={0}
        enableResetScrollToCoords={true}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        <Text style={[styles.label, { color: colorScheme.text }]}>Name</Text>
        <TextInput
          placeholder="Enter name"
          accessibilityLabel="Name"
          value={formData.name || ""}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          style={[
            styles.input,
            {
              backgroundColor: colorScheme.cardBackground,
              color: colorScheme.text,
              borderColor: colorScheme.borderBottomColor,
            },
          ]}
          placeholderTextColor={colorScheme.text}
        />
        <Text style={[styles.label, { color: colorScheme.text }]}>Date</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`Date: ${formData.date ? formData.date.toLocaleDateString() : "Select date"}`}
          style={[
            styles.input,
            {
              backgroundColor: colorScheme.cardBackground,
              borderColor: colorScheme.borderBottomColor,
            },
          ]}
        >
          <Text
            style={[
              {
                color: colorScheme.text,
              },
            ]}
          >
            {formData.date ? formData.date.toDateString() : "Select Date"}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={formData.date || new Date()}
            onChange={handleDateChange}
          />
        )}

        <Text style={[styles.label, { color: colorScheme.text }]}>Amount</Text>
        <TextInput
          placeholder="Enter amount"
          accessibilityLabel="Amount"
          value={rawAmount}
          onChangeText={handleAmountChange}
          onBlur={handleAmountBlur}
          style={[
            styles.input,
            {
              backgroundColor: colorScheme.cardBackground,
              color: colorScheme.text,
              borderColor: colorScheme.borderBottomColor,
            },
          ]}
          keyboardType="decimal-pad"
          placeholderTextColor={colorScheme.tint}
        />

        <View style={styles.oneTimeContainer}>
          <Text style={[styles.label, { color: colorScheme.text }]}>
            One-Time Occurrence
          </Text>
          <Switch
            accessibilityRole="switch"
            accessibilityLabel="One-Time Occurrence"
            accessibilityState={{ checked: isOneTime }}
            value={isOneTime}
            onValueChange={(value) => {
              setIsOneTime(value);
              if (!value) {
                // When switching to recurring, ensure frequency is set to 1 month
                setFormData({
                  ...formData,
                  frequency: { value: 1, unit: "months" },
                });
              } else {
                // When switching to one-time, remove frequency
                setFormData({
                  ...formData,
                  frequency: undefined,
                });
              }
            }}
          />
        </View>

        {!isOneTime && (
          <>
            <Text style={[styles.label, { color: colorScheme.text }]}>
              Frequency
            </Text>
            <View style={styles.frequencyContainer}>
              <TextInput
                placeholder="1"
                accessibilityLabel="Repeat every"
                value={
                  formData.frequency?.unit === "semi-monthly"
                    ? "1"
                    : formData.frequency?.value?.toString() || ""
                }
                onChangeText={handleFrequencyChange}
                editable={formData.frequency?.unit !== "semi-monthly"}
                style={[
                  styles.frequencyInput,
                  {
                    backgroundColor: colorScheme.cardBackground,
                    color: colorScheme.text,
                    borderColor: colorScheme.borderBottomColor,
                    opacity:
                      formData.frequency?.unit === "semi-monthly" ? 0.5 : 1,
                  },
                ]}
                keyboardType="numeric"
                placeholderTextColor={colorScheme.tint}
              />
              <View
                style={[
                  styles.pickerWrapper,
                  {
                    backgroundColor: colorScheme.cardBackground,
                    borderColor: colorScheme.borderBottomColor,
                  },
                ]}
              >
                <Picker
                  accessibilityLabel="Frequency unit"
                  selectedValue={formData.frequency?.unit || "months"}
                  onValueChange={(itemValue) => {
                    const isSemiMonthly = itemValue === "semi-monthly";
                    setFormData({
                      ...formData,
                      frequency: {
                        value: isSemiMonthly
                          ? 1
                          : formData.frequency?.value || 1,
                        unit: itemValue as FrequencyInterface["unit"],
                      },
                    });
                  }}
                  style={[styles.picker, { color: colorScheme.text }]}
                >
                  <Picker.Item label="Days" value="days" />
                  <Picker.Item label="Weeks" value="weeks" />
                  <Picker.Item label="Months" value="months" />
                  <Picker.Item label="Semi-monthly" value="semi-monthly" />
                </Picker>
              </View>
            </View>
          </>
        )}

        <TouchableOpacity
          onPress={validateAndSubmit}
          disabled={isSubmitting}
          accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
          style={[
            styles.submitButton,
            { backgroundColor: colorScheme.submitButton },
          ]}
        >
          <Text style={[styles.buttonText, { color: colorScheme.buttonText }]}>
            {isSubmitting ? "Saving…" : isEditing ? "Update" : "Add"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={resetForm}
          disabled={isSubmitting}
          style={[
            styles.resetButton,
            { backgroundColor: colorScheme.resetButton },
          ]}
        >
          <Text style={[styles.buttonText, { color: colorScheme.buttonText }]}>
            Cancel
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
    borderRadius: 10,
    margin: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    justifyContent: "flex-start",
  },
  keyboardOpen: {
    paddingBottom: -10,
    marginBottom: -100,
  },
  label: {
    marginBottom: 5,
    fontWeight: "bold",
  },
  dateButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  frequencyContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  oneTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  submitButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  resetButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 25,
  },
  buttonText: {
    fontWeight: "bold",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  frequencyInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    flex: 0.3,
    marginRight: 10,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    flex: 0.7,
    height: 42,
    justifyContent: "center",
  },
  picker: {
    ...Platform.select({
      android: {
        paddingVertical: 0,
      },
      ios: {
        height: 42,
      },
    }),
  },
});

export default FinancialForm;
