import { StyleSheet, Text, View } from "react-native";

import { colors, fonts } from "../theme";

export type BubbleTone = "cheap" | "fresh" | "stale" | "empty";

const PALETTE: Record<BubbleTone, { bg: string; text: string; border: string }> = {
  cheap: { bg: colors.green, text: colors.white, border: colors.green },
  fresh: { bg: colors.white, text: colors.ink, border: "transparent" },
  stale: { bg: colors.orangeSoft, text: colors.orangeDeep, border: "transparent" },
  empty: { bg: colors.white, text: colors.faint, border: "#D0D5DD" },
};

export function PriceBubble({ label, tone }: { label: string; tone: BubbleTone }) {
  const palette = PALETTE[tone];
  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            borderStyle: tone === "empty" ? "dashed" : "solid",
            borderWidth: tone === "empty" ? 1.5 : 0,
          },
        ]}
      >
        <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
      </View>
      <View style={[styles.tail, { backgroundColor: palette.bg, borderColor: palette.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  label: { fontFamily: fonts.extrabold, fontSize: 13 },
  tail: {
    width: 10,
    height: 10,
    marginTop: -6,
    transform: [{ rotate: "45deg" }],
  },
});
