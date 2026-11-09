import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Colors } from "../../constants/Colors";
import useBudgetStore from "../../store/useBudgetStore";

const currencies = ["USD", "EUR", "GBP", "JPY", "CAD"] as const;
type CurrencyType = (typeof currencies)[number];

const Settings: React.FC = () => {
  const { settings, saveCurrency, saveTheme } = useBudgetStore();
  const colorScheme = settings?.theme === "dark" ? Colors.dark : Colors.light;

  const [currency, setCurrency] = useState("CAD");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (settings?.currency) {
      setCurrency(settings.currency);
    }
    if (settings?.theme) {
      setTheme(settings.theme);
    }
  }, [settings]);

  const handleCurrencyChange = async (newCurrency: CurrencyType) => {
    setCurrency(newCurrency);
    await saveCurrency(newCurrency);
  };

  const toggleTheme = async () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    await saveTheme(newTheme);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colorScheme.cardBackground },
      ]}
    >
      <Text style={[styles.label, { color: colorScheme.text }]}>
        Select Currency:
      </Text>
      <View style={styles.currencyContainer}>
        {currencies.map((curr) => (
          <TouchableOpacity
            key={curr}
            style={[
              styles.currencyButton,
              {
                backgroundColor:
                  currency === curr
                    ? colorScheme.submitButton
                    : colorScheme.background,
                borderColor:
                  currency === curr
                    ? colorScheme.submitButton
                    : colorScheme.buttonBorder,
                borderWidth: 2,
              },
            ]}
            onPress={() => handleCurrencyChange(curr)}
          >
            <Text
              style={[
                styles.currencyText,
                {
                  color:
                    currency === curr
                      ? colorScheme.buttonText
                      : colorScheme.text,
                },
              ]}
            >
              {curr}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.label, { color: colorScheme.text }]}>Theme:</Text>
      <TouchableOpacity
        style={[
          styles.themeButton,
          { backgroundColor: colorScheme.submitButton },
        ]}
        onPress={toggleTheme}
      >
        <Text style={[styles.themeText, { color: colorScheme.buttonText }]}>
          {theme === "light" ? "🌞 Light Mode" : "🌙 Dark Mode"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginTop: 10,
  },
  currencyContainer: {
    flexDirection: "row",
    marginTop: 10,
  },
  currencyButton: {
    padding: 10,
    margin: 5,
    borderRadius: 5,
    borderWidth: 2,
  },
  currencyText: {
    fontWeight: "bold",
  },
  themeButton: {
    marginTop: 20,
    padding: 15,
    borderRadius: 5,
  },
  themeText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default Settings;
