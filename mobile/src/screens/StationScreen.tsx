import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, errorMessage } from "../api";
import { BrandMark } from "../components/BrandMark";
import { BackIcon, BookmarkIcon, DirectionsIcon } from "../components/Icons";
import { StationMap } from "../components/StationMap";
import { formatAgo, formatDistance, formatMoney } from "../format";
import { colors, fonts } from "../theme";
import { DETAIL_FUELS, FUEL_LABEL, type Fuel, type LatLng, type Price, type Station } from "../types";

const savedIds = new Set<string>();

export function StationScreen({
  id,
  fuel,
  user,
  onBack,
  onReport,
}: {
  id: string;
  fuel: Fuel;
  user: LatLng | null;
  onBack: () => void;
  onReport: (fuel: Fuel) => void;
}) {
  const insets = useSafeAreaInsets();
  const [station, setStation] = useState<Station | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(savedIds.has(id));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .station(id, user)
      .then((next) => {
        if (!cancelled) setStation(next);
      })
      .catch((reason) => {
        if (!cancelled) setError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
  }, [id, user?.lat, user?.lng]);

  async function confirm() {
    if (!user) {
      setError("Activá la ubicación para confirmar un precio.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setStation(await api.confirm(id, { fuel, ...user }));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function toggleSaved() {
    if (savedIds.has(id)) savedIds.delete(id);
    else savedIds.add(id);
    setSaved(savedIds.has(id));
  }

  const selected = station?.prices?.[fuel];
  const distance = station?.distance_m != null ? formatDistance(station.distance_m) : null;

  return (
    <View style={styles.fill}>
      <View style={styles.map}>
        {station ? (
          <StationMap
            stations={[{ ...station, price: selected ?? null, cheapest: false }]}
            user={user}
            center={{ lat: station.lat, lng: station.lng }}
            radius={450}
            focusToken={1}
            onSelect={() => undefined}
            interactive={false}
          />
        ) : (
          <View style={styles.mapFallback} />
        )}
        <View style={[styles.mapActions, { top: insets.top + 8 }]}>
          <Pressable style={styles.round} onPress={onBack}>
            <BackIcon />
          </Pressable>
          <Pressable style={styles.round} onPress={toggleSaved}>
            <BookmarkIcon filled={saved} color={saved ? colors.green : colors.ink} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.sheet} contentContainerStyle={{ paddingBottom: 28 }}>
        {!station && !error ? <ActivityIndicator color={colors.green} style={{ margin: 24 }} /> : null}
        {station ? (
          <>
            <View style={styles.identity}>
              <BrandMark code={station.brand_code} color={station.brand_color} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{station.title}</Text>
                <Text style={styles.subtitle}>
                  {[station.address, distance, station.city].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </View>
            <Text style={styles.section}>PRECIOS</Text>
            {DETAIL_FUELS.map((key) => (
              <PriceLine
                key={key}
                fuel={key}
                price={station.prices?.[key] ?? null}
                onAdd={() => onReport(key)}
              />
            ))}
            <View style={styles.confirmBox}>
              <Text style={styles.question}>¿Los precios están bien?</Text>
              <Text style={styles.questionMeta}>
                {selected
                  ? `${FUEL_LABEL[fuel]} · ${formatMoney(selected.amount, fuel)}`
                  : `${FUEL_LABEL[fuel]} · sin dato`}
              </Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.actions}>
                <Pressable
                  style={[styles.primary, (!selected || busy) && styles.disabled]}
                  disabled={!selected || busy}
                  onPress={confirm}
                >
                  <Text style={styles.primaryLabel}>{busy ? "Enviando" : "Sí, confirmar"}</Text>
                </Pressable>
                <Pressable style={styles.secondary} onPress={() => onReport(fuel)}>
                  <Text style={styles.secondaryLabel}>Corregir</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : null}
        {error && !station ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {station ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={styles.directions}
            onPress={() => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lng}`;
              Linking.openURL(url);
            }}
          >
            <DirectionsIcon />
            <Text style={styles.directionsLabel}>Cómo llegar</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function PriceLine({ fuel, price, onAdd }: { fuel: Fuel; price: Price | null; onAdd: () => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.fuel}>{FUEL_LABEL[fuel]}</Text>
        {price ? (
          <View style={styles.metaRow}>
            <Badge price={price} />
            <Text style={styles.when}>
              {formatAgo(price.at)}
              {price.confirmations > 0
                ? ` · ${price.confirmations} ${price.confirmations === 1 ? "confirmación" : "confirmaciones"}`
                : ""}
            </Text>
          </View>
        ) : (
          <Text style={styles.missing}>Sin dato todavía</Text>
        )}
      </View>
      {price ? (
        <Text style={[styles.amount, price.stale && styles.stale]}>
          {formatMoney(price.amount, fuel)}
        </Text>
      ) : (
        <Pressable onPress={onAdd}>
          <Text style={styles.add}>Agregar precio</Text>
        </Pressable>
      )}
    </View>
  );
}

function Badge({ price }: { price: Price }) {
  const palette = price.stale
    ? { bg: colors.orangeSoft, fg: colors.orangeDeep, label: "Desactualizado" }
    : price.source === "usuarios"
      ? { bg: colors.purpleSoft, fg: colors.purple, label: "Usuarios" }
      : { bg: colors.blueSoft, fg: colors.blue, label: "Oficial" };
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeLabel, { color: palette.fg }]}>{palette.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.white },
  map: { height: 230, backgroundColor: colors.canvas },
  mapFallback: { flex: 1, backgroundColor: "#E7EBE4" },
  mapActions: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sheet: {
    flex: 1,
    minHeight: 0,
    marginTop: -28,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  identity: { flexDirection: "row", gap: 12, alignItems: "center" },
  title: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.ink },
  subtitle: { marginTop: 2, fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  section: {
    marginTop: 22,
    marginBottom: 4,
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  fuel: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  when: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  missing: { marginTop: 4, fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  amount: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.green },
  stale: { color: colors.orange },
  add: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeLabel: { fontFamily: fonts.bold, fontSize: 11 },
  confirmBox: { marginTop: 18, backgroundColor: "#F4F6F8", borderRadius: 20, padding: 14 },
  question: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  questionMeta: { marginTop: 4, fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  primary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.white },
  secondary: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  disabled: { opacity: 0.45 },
  error: { marginTop: 10, fontFamily: fonts.medium, fontSize: 13, color: colors.orangeDeep },
  footer: { paddingHorizontal: 16, paddingTop: 8, backgroundColor: colors.white },
  directions: {
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.navy,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  directionsLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
});
