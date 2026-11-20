import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatMoney, listMeta } from "../format";
import { colors, fonts } from "../theme";
import type { Station } from "../types";
import { BrandMark } from "./BrandMark";

export function StationCard({ station, onPress }: { station: Station; onPress: () => void }) {
  const stale = station.price?.stale;
  return (
    <Pressable onPress={onPress} style={[styles.card, station.cheapest && styles.cheap]}>
      <BrandMark code={station.brand_code} color={station.brand_color} />
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>
          {station.list_name}
        </Text>
        <Text numberOfLines={2} style={styles.meta}>
          {listMeta(station)}
        </Text>
      </View>
      <View style={styles.priceCol}>
        <Text style={[styles.price, stale && styles.stalePrice]}>
          {station.price ? formatMoney(station.price.amount, station.price.fuel) : "—"}
        </Text>
        {station.cheapest ? <Text style={styles.best}>MÁS BARATA</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#F7F8FA",
    marginBottom: 8,
  },
  cheap: { backgroundColor: colors.greenSoft },
  copy: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.muted },
  priceCol: { alignItems: "flex-end", marginLeft: 4 },
  price: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.green },
  stalePrice: { color: colors.orange },
  best: {
    marginTop: 2,
    fontFamily: fonts.extrabold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.green,
  },
});
