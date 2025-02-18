import React from "react";
import { View, StyleSheet } from "react-native";

import BudgetList from "../../components/BudgetList";
import BudgetFilter from "../../components/BudgetFilter";

const Budget: React.FC = () => {
  return (
    <View style={styles.container} accessible={true}>
      <BudgetFilter />
      <BudgetList />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: "#333",
  },
});

export default Budget;
