import { useEffect, useState } from "react";
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

import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";

import useBudgetStore from "../app/store/useBudgetStore";
import { Colors } from "../constants/Colors";
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
  const { settings } = useBudgetStore();
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
        contentContainerStyle={[
          styles.formContainer,
          { backgroundColor: colorScheme.background },
        ]}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={0}
        enableResetScrollToCoords={true}
      >
        <Text style={[styles.label, { color: colorScheme.text }]}>Name</Text>
        <TextInput
          placeholder="Enter name"
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
            <Text style={[styles.label, { color: colorScheme.text }]}>
              Frequency
            </Text>
            <View style={styles.frequencyContainer}>
              <TextInput
                placeholder="1"
                value={formData.frequency?.value?.toString() || ""}
                onChangeText={handleFrequencyChange}
                style={[
                  styles.frequencyInput,
                  {
                    backgroundColor: colorScheme.cardBackground,
                    color: colorScheme.text,
                    borderColor: colorScheme.borderBottomColor,
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
          style={[
            styles.submitButton,
            { backgroundColor: colorScheme.submitButton },
          ]}
        >
          <Text style={[styles.buttonText, { color: colorScheme.buttonText }]}>
            {isEditing ? "Update" : "Add"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={resetForm}
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
