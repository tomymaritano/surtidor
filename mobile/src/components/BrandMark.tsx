import { StyleSheet, Text, View } from "react-native";

import { fonts } from "../theme";

export function BrandMark({ code, color, size = 44 }: { code: string; color: string; size?: number }) {
  return (
    <View style={[styles.mark, { backgroundColor: color, width: size, height: size, borderRadius: size * 0.28 }]}>
      <Text style={[styles.code, { fontSize: size * 0.32 }]}>{code}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: "center", justifyContent: "center" },
  code: { color: "#fff", fontFamily: fonts.extrabold, letterSpacing: 0.3 },
});
