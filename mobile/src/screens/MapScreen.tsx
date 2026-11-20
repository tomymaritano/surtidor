import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, errorMessage } from "../api";
import { FuelChips } from "../components/FuelChips";
import { LocateIcon, SearchIcon, SlidersIcon } from "../components/Icons";
import { StationCard } from "../components/StationCard";
import { StationMap } from "../components/StationMap";
import { colors, fonts } from "../theme";
import {
  FALLBACK_CENTER,
  FUEL_LABEL,
  RADII,
  type Fuel,
  type LatLng,
  type StationList,
} from "../types";

export function MapScreen({
  fuel,
  onFuel,
  radius,
  onRadius,
  user,
  locationStatus,
  onOpen,
  revision,
}: {
  fuel: Fuel;
  onFuel: (fuel: Fuel) => void;
  radius: number;
  onRadius: (radius: number) => void;
  user: LatLng | null;
  locationStatus: "pending" | "granted" | "denied";
  onOpen: (id: string) => void;
  revision: number;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [anchor, setAnchor] = useState<LatLng>(FALLBACK_CENTER);
  const [place, setPlace] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [data, setData] = useState<StationList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const followedUser = useRef(false);
  const listFuel: Fuel = fuel === "gasoil3" ? "gasoil" : fuel;

  useEffect(() => {
    if (!user || followedUser.current) return;
    followedUser.current = true;
    setAnchor(user);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .stations({ ...anchor, radius_m: radius, fuel: listFuel })
      .then((next) => {
        if (!cancelled) {
          setData(next);
          setError(null);
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [anchor.lat, anchor.lng, radius, listFuel, reload, revision]);

  async function search() {
    const text = query.trim();
    if (text.length < 2) return;
    setLoading(true);
    setFiltersOpen(false);
    try {
      const named = await api.stations({ ...anchor, radius_m: radius, fuel: listFuel, q: text });
      const nearest = named.stations.reduce<(typeof named.stations)[number] | null>(
        (best, station) =>
          best == null || (station.distance_m ?? Infinity) < (best.distance_m ?? Infinity) ? station : best,
        null,
      );
      if (nearest) {
        setData(named);
        setPlace(text);
        setAnchor({ lat: nearest.lat, lng: nearest.lng });
        setFocusToken((token) => token + 1);
        setError(null);
        return;
      }
      const geo = await api.geocode(text);
      if (!geo.result) {
        setError("No encontré esa zona ni esa estación.");
        return;
      }
      const around = await api.stations({
        lat: geo.result.lat,
        lng: geo.result.lng,
        radius_m: radius,
        fuel: listFuel,
      });
      setData(around);
      setPlace(geo.result.label.split(",")[0] ?? text);
      setAnchor({ lat: geo.result.lat, lng: geo.result.lng });
      setFocusToken((token) => token + 1);
      setError(null);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  function locate() {
    if (!user) return;
    setPlace(null);
    setQuery("");
    setAnchor(user);
    setFocusToken((token) => token + 1);
  }

  const titlePlace = place ?? (locationStatus === "granted" ? "Cerca tuyo" : "Recoleta");
  const fuelName = FUEL_LABEL[fuel === "gasoil3" ? "gasoil" : fuel];
  const radiusLabel = RADII.find((item) => item.meters === radius)?.label ?? "3 km";

  return (
    <View style={styles.fill}>
      <StationMap
        stations={data?.stations ?? []}
        user={user}
        center={anchor}
        radius={radius}
        focusToken={focusToken}
        onSelect={onOpen}
      />
      <View pointerEvents="box-none" style={styles.overlay}>
        <View style={{ paddingTop: insets.top + 8 }} pointerEvents="box-none">
          <View style={styles.searchRow}>
            <View style={styles.search}>
              <SearchIcon />
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={search}
                placeholder="Buscar zona o estación"
                placeholderTextColor={colors.faint}
                returnKeyType="search"
                style={styles.input}
              />
            </View>
            <Pressable style={styles.circle} onPress={() => setFiltersOpen((open) => !open)}>
              <SlidersIcon />
            </Pressable>
          </View>
          <View style={{ marginTop: 12 }}>
            <FuelChips fuel={fuel === "gasoil3" ? "gasoil" : fuel} onChange={onFuel} />
          </View>
          {locationStatus === "denied" ? (
            <Text style={styles.banner}>Ubicación desactivada · mostrando Recoleta</Text>
          ) : null}
        </View>

        <View style={styles.flex} pointerEvents="none" />

        <Pressable
          style={[styles.circle, styles.locate, { bottom: 332 + insets.bottom }]}
          onPress={locate}
        >
          <LocateIcon color={user ? colors.ink : colors.faint} />
        </Pressable>

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text numberOfLines={1} style={styles.sheetTitle}>
              {titlePlace} · {fuelName}
            </Text>
            <Text style={styles.radius}>Radio {radiusLabel}</Text>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading && !data ? (
            <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              style={styles.listFlex}
              data={data?.stations ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              refreshing={loading}
              onRefresh={() => setReload((value) => value + 1)}
              ListEmptyComponent={
                error ? (
                  <View />
                ) : (
                  <Text style={styles.empty}>No hay estaciones con este combustible en el radio.</Text>
                )
              }
              renderItem={({ item }) => <StationCard station={item} onPress={() => onOpen(item.id)} />}
            />
          )}
        </View>
      </View>

      {filtersOpen ? (
        <Pressable style={styles.filterScrim} onPress={() => setFiltersOpen(false)}>
          <View style={[styles.filterCard, { top: insets.top + 64 }]}>
            <Text style={styles.filterTitle}>Radio de búsqueda</Text>
            {RADII.map((item) => {
              const selected = item.meters === radius;
              return (
                <Pressable
                  key={item.meters}
                  style={styles.filterRow}
                  onPress={() => {
                    onRadius(item.meters);
                    setFiltersOpen(false);
                  }}
                >
                  <Text style={[styles.filterLabel, selected && styles.filterSelected]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.canvas },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: "flex-end" },
  flex: { flex: 1 },
  searchRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16 },
  search: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  locate: { position: "absolute", right: 16 },
  banner: {
    marginTop: 10,
    marginHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
  },
  sheet: {
    height: 320,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E4E7EC",
    marginBottom: 12,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 12,
  },
  sheetTitle: { flex: 1, fontFamily: fonts.extrabold, fontSize: 18, color: colors.ink },
  radius: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  listFlex: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 12 },
  empty: { fontFamily: fonts.medium, fontSize: 14, color: colors.muted, paddingVertical: 16 },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.orangeDeep, paddingHorizontal: 16, marginBottom: 8 },
  filterScrim: { ...StyleSheet.absoluteFill },
  filterCard: {
    position: "absolute",
    right: 16,
    width: 210,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  filterTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.muted,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterRow: { paddingHorizontal: 14, paddingVertical: 10 },
  filterLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  filterSelected: { color: colors.green },
});
