import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Switch,
  Alert,
  Keyboard,
  AccessibilityInfo,
} from "react-native";

import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { FrequencyInterface } from "../types/frequency";

interface FinancialFormProps<T> {
  formData: any;
  setFormData: (data: Partial<T>) => void;
  isEditing: boolean;
  handleSubmit: () => void;
  showDatePicker: boolean;
  setShowDatePicker: (show: boolean) => void;
  resetForm: () => void;
  handleDateChange: (event: any, date?: Date) => void;
}

const FinancialForm = <T extends { id: string; date: Date }>({
  formData,
  setFormData,
  isEditing,
  handleSubmit,
  showDatePicker,
  setShowDatePicker,
  resetForm,
  handleDateChange,
}: FinancialFormProps<T>) => {
  const [rawAmount, setRawAmount] = useState<string>(
    formData.amount?.toString() || ""
  );
  const [isOneTime, setIsOneTime] = useState<boolean>(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

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
    if (formData.amount) {
      setIsOneTime(!formData.frequency || !formData.frequency.unit);
    }
  }, []);

  const handleAmountChange = (text: string) => {
    const sanitizedText = text.replace(/[^0-9.]/g, "");
    const parsedAmount = parseFloat(sanitizedText) || 0;

    setRawAmount(sanitizedText);
    setFormData({ ...formData, amount: parsedAmount });
  };

  const handleAmountBlur = () => {
    setRawAmount(formData.amount?.toFixed(2) || "");
  };

  const handleFrequencyChange = (text: string) => {
    if (/^\d*$/.test(text)) {
      setFormData({
        ...formData,
        frequency: {
          value: text === "" ? "" : parseInt(text, 10),
          unit: formData.frequency?.unit || "months",
        },
      });
    }
  };

  const validateAndSubmit = () => {
    if (isOneTime || (formData.frequency && formData.frequency.unit)) {
      AccessibilityInfo.announceForAccessibility(
        isEditing ? "Updating financial entry" : "Adding financial entry"
      );
      handleSubmit();
    } else {
      Alert.alert(
        "Validation Error",
        "Either select 'One-Time Occurrence' or set a valid frequency."
      );
      AccessibilityInfo.announceForAccessibility(
        "Validation error: Either select 'One-Time Occurrence' or set a valid frequency."
      );
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        isKeyboardOpen && Platform.OS === "android" ? styles.keyboardOpen : {},
      ]}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={0}
        enableResetScrollToCoords={true}
      >
        <Text style={styles.label}>Name</Text>
        <TextInput
          placeholder="Enter name"
          value={formData.name || ""}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          style={styles.input}
          placeholderTextColor="#AAAAAA"
        />
        <Text style={styles.label}>Date</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={styles.dateButton}
        >
          <Text style={styles.dateButtonText}>
            {formData.date ? formData.date.toDateString() : "Select Date"}
          </Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={formData.date || new Date()}
            onChange={handleDateChange}
          />
        )}

        <Text style={styles.label}>Amount</Text>
        <TextInput
          placeholder="Enter amount"
          value={rawAmount}
          onChangeText={handleAmountChange}
          onBlur={handleAmountBlur}
          style={styles.input}
          keyboardType="decimal-pad"
          placeholderTextColor="#AAAAAA"
        />

        <View style={styles.oneTimeContainer}>
          <Text style={styles.label}>One-Time Occurrence</Text>
          <Switch
            value={isOneTime}
            onValueChange={(value) => {
              setIsOneTime(value);
              setFormData({
                ...formData,
                frequency: value ? undefined : { value: 1, unit: "months" },
              });
            }}
          />
        </View>

        {!isOneTime && (
          <>
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.frequencyContainer}>
              <TextInput
                placeholder="1"
                value={formData.frequency?.value?.toString() || ""}
                onChangeText={handleFrequencyChange}
                style={styles.frequencyInput}
                keyboardType="numeric"
                placeholderTextColor="#AAAAAA"
              />
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={formData.frequency?.unit || "months"}
                  onValueChange={(itemValue) =>
                    setFormData({
                      ...formData,
                      frequency: {
                        value: formData.frequency?.value || 1,
                        unit: itemValue as FrequencyInterface["unit"],
                      },
                    })
                  }
                  style={styles.picker}
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
          style={styles.submitButton}
        >
          <Text style={styles.buttonText}>{isEditing ? "Update" : "Add"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={resetForm} style={styles.resetButton}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  formContainer: {
    padding: 20,
    backgroundColor: "#222",
    borderRadius: 10,
    margin: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    justifyContent: "flex-start",
    paddingBottom: 20,
  },
  keyboardOpen: {
    paddingBottom: -10,
    marginBottom: -100,
  },
  label: {
    marginBottom: 5,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  dateButton: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    padding: 10,
    backgroundColor: "#333",
    marginBottom: 15,
  },
  dateButtonText: {
    color: "#CCCCCC",
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
    backgroundColor: "#007BFF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  resetButton: {
    backgroundColor: "#FF5555",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
    color: "#FFFFFF",
    backgroundColor: "#333",
  },
  frequencyInput: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    padding: 10,
    flex: 0.3,
    marginRight: 10,
    color: "#FFFFFF",
    backgroundColor: "#333",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 8,
    backgroundColor: "#333",
    overflow: "hidden",
    flex: 0.7,
    height: 42,
    justifyContent: "center",
  },
  picker: {
    color: "#FFFFFF",
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
