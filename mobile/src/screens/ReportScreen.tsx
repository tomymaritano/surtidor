import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, errorMessage } from "../api";
import { CameraIcon, CloseIcon } from "../components/Icons";
import { formatAgo, formatDistance, formatMoney } from "../format";
import { colors, fonts } from "../theme";
import { FUEL_CHOICES, FUEL_LABEL, type Fuel, type LatLng, type Station } from "../types";

export function ReportScreen({
  id,
  initialFuel,
  user,
  onBack,
  onSaved,
}: {
  id: string;
  initialFuel: Fuel;
  user: LatLng | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [station, setStation] = useState<Station | null>(null);
  const [fuel, setFuel] = useState<Fuel>(initialFuel);
  const [raw, setRaw] = useState("");
  const [dirty, setDirty] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.station(id, user).then((next) => {
      if (!cancelled) setStation(next);
    });
    return () => {
      cancelled = true;
    };
  }, [id, user?.lat, user?.lng]);

  useEffect(() => {
    if (dirty) return;
    const amount = station?.prices?.[fuel]?.amount;
    if (amount == null) {
      setRaw("");
      return;
    }
    setRaw(String(amount).replace(".", ","));
  }, [station, fuel, dirty]);

  const known = station?.prices?.[fuel] ?? null;
  const price = Number(raw.replace(",", "."));
  const near = Boolean(station?.can_report && user);
  const distance = station?.distance_m != null ? formatDistance(station.distance_m) : null;

  async function takePhoto() {
    const camera = await ImagePicker.requestCameraPermissionsAsync();
    const launch = camera.granted ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    if (!camera.granted) {
      const library = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!library.granted) return;
    }
    const result = await launch({ mediaTypes: "images", quality: 0.3, base64: true });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setPhoto(asset.base64 ?? null);
    setPhotoUri(asset.uri);
  }

  async function send() {
    if (!user || !near || !Number.isFinite(price)) return;
    setSending(true);
    setError(null);
    try {
      await api.report(id, {
        fuel,
        price,
        lat: user.lat,
        lng: user.lng,
        ...(photo ? { photo_base64: photo } : {}),
      });
      onSaved();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSending(false);
    }
  }

  const choices = fuel === "gasoil3" ? [...FUEL_CHOICES, { id: "gasoil3" as const, label: "Gasoil grado 3", long: "Gasoil grado 3" }] : FUEL_CHOICES;

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Pressable style={styles.close} onPress={onBack}>
            <CloseIcon />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Reportar precio</Text>
            <Text style={styles.subtitle}>
              {station ? station.title : "Estación"}
              {distance ? ` · estás a ${distance}` : ""}
            </Text>
          </View>
        </View>

        <Text style={styles.label}>COMBUSTIBLE</Text>
        <View style={styles.grid}>
          {choices.map((choice) => {
            const selected = choice.id === fuel;
            return (
              <Pressable
                key={choice.id}
                style={[styles.choice, selected && styles.choiceOn]}
                onPress={() => {
                  setFuel(choice.id);
                  setDirty(false);
                }}
              >
                <Text style={[styles.choiceLabel, selected && styles.choiceLabelOn]}>{choice.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>{fuel === "gnc" ? "PRECIO POR M³" : "PRECIO POR LITRO"}</Text>
        <View style={styles.priceBox}>
          <TextInput
            value={raw ? formatMoney(Number(raw.replace(",", ".")) || 0, fuel) : ""}
            onChangeText={(text) => {
              setDirty(true);
              const cleaned = text.replace(/[^\d,]/g, "");
              const parts = cleaned.split(",");
              if (parts.length > 2) return;
              setRaw(parts[1] === undefined ? parts[0] : `${parts[0]},${parts[1].slice(0, 1)}`);
            }}
            keyboardType="decimal-pad"
            placeholder="$0"
            placeholderTextColor={colors.faint}
            style={styles.priceInput}
          />
        </View>
        <Text style={styles.known}>
          {known
            ? `Último precio conocido: ${formatMoney(known.amount, fuel)} (${known.source}, ${formatAgo(known.at)})`
            : "No hay un precio conocido para este combustible."}
        </Text>

        <Pressable style={styles.photo} onPress={takePhoto}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.preview} />
          ) : (
            <View style={styles.camera}>
              <CameraIcon />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.photoTitle}>Sacale foto al cartel</Text>
            <Text style={styles.photoCopy}>Opcional · suma confianza al precio</Text>
          </View>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!near ? (
          <Text style={styles.hint}>
            {user
              ? "Solo podés reportar si estás a menos de 300 m de la estación."
              : "Activá la ubicación. Solo podés reportar si estás en la estación."}
          </Text>
        ) : null}

        <Pressable
          style={[styles.send, (!near || !raw || sending) && styles.disabled]}
          disabled={!near || !raw || sending || !Number.isFinite(price)}
          onPress={send}
        >
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendLabel}>Enviar precio</Text>}
        </Pressable>
        <Text style={styles.footer}>Solo podés reportar si estás cerca de la estación</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.white },
  top: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.ink },
  subtitle: { marginTop: 2, fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  label: {
    marginTop: 22,
    marginBottom: 10,
    marginHorizontal: 20,
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
    paddingHorizontal: 20,
  },
  choice: {
    width: "48%",
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  choiceOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  choiceLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  choiceLabelOn: { color: colors.white },
  priceBox: {
    marginHorizontal: 20,
    borderWidth: 1.5,
    borderColor: "#E4E7EC",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  priceInput: { fontFamily: fonts.extrabold, fontSize: 40, color: colors.ink, padding: 0 },
  known: { marginTop: 8, marginHorizontal: 20, fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  photo: {
    marginTop: 18,
    marginHorizontal: 20,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#D0D5DD",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  camera: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
  },
  preview: { width: 42, height: 42, borderRadius: 12 },
  photoTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  photoCopy: { marginTop: 2, fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  error: { marginTop: 12, marginHorizontal: 20, fontFamily: fonts.medium, fontSize: 13, color: colors.orangeDeep },
  hint: { marginTop: 12, marginHorizontal: 20, fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  send: {
    marginTop: 18,
    marginHorizontal: 20,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  sendLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.white },
  disabled: { opacity: 0.45 },
  footer: {
    marginTop: 10,
    textAlign: "center",
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.faint,
  },
});
