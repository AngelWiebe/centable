import React from "react";
import { StyleSheet, View } from "react-native";

import useBudgetStore from "../../store/useBudgetStore";
import BudgetFilter from "../../components/BudgetFilter";
import BudgetList from "../../components/BudgetList";
import { Colors } from "../../constants/Colors";

const Budget: React.FC = () => {
  const theme = useBudgetStore((state) => state.settings?.theme ?? "dark");
  const colorScheme = theme === "dark" ? Colors.dark : Colors.light;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colorScheme.cardBackground },
      ]}
      accessible={true}
    >
      <BudgetFilter />
      <BudgetList />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
});

export default Budget;
