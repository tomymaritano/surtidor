import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { colors, fonts } from "../theme";
import { FUEL_CHOICES, type Fuel } from "../types";

export function FuelChips({ fuel, onChange }: { fuel: Fuel; onChange: (fuel: Fuel) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {FUEL_CHOICES.map((choice) => {
        const selected = choice.id === fuel;
        return (
          <Pressable
            key={choice.id}
            onPress={() => onChange(choice.id)}
            style={[styles.chip, selected ? styles.selected : styles.idle]}
          >
            <Text style={[styles.label, selected && styles.selectedLabel]}>{choice.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { backgroundColor: colors.navy },
  idle: {
    backgroundColor: colors.white,
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  label: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  selectedLabel: { color: colors.white },
});
