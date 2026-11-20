import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useUserLocation } from "./src/location";
import { MapScreen } from "./src/screens/MapScreen";
import { ReportScreen } from "./src/screens/ReportScreen";
import { StationScreen } from "./src/screens/StationScreen";
import type { Fuel } from "./src/types";

type Route =
  | { name: "map" }
  | { name: "station"; id: string }
  | { name: "report"; id: string; fuel: Fuel };

export default function App() {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const location = useUserLocation();
  const [fuel, setFuel] = useState<Fuel>("super");
  const [radius, setRadius] = useState(3000);
  const [route, setRoute] = useState<Route>({ name: "map" });
  const [revision, setRevision] = useState(0);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.fill}>
        <View style={[styles.fill, route.name !== "map" && styles.hidden]}>
          <MapScreen
            fuel={fuel}
            onFuel={setFuel}
            radius={radius}
            onRadius={setRadius}
            user={location.user}
            locationStatus={location.status}
            revision={revision}
            onOpen={(id) => setRoute({ name: "station", id })}
          />
        </View>
        {route.name === "station" ? (
          <StationScreen
            id={route.id}
            fuel={fuel}
            user={location.user}
            onBack={() => {
              setRevision((value) => value + 1);
              setRoute({ name: "map" });
            }}
            onReport={(next) => setRoute({ name: "report", id: route.id, fuel: next })}
          />
        ) : null}
        {route.name === "report" ? (
          <ReportScreen
            id={route.id}
            initialFuel={route.fuel}
            user={location.user}
            onBack={() => setRoute({ name: "station", id: route.id })}
            onSaved={() => setRoute({ name: "station", id: route.id })}
          />
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: "none" },
});
