import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from "react-native-maps";

import { bubbleLabel, priceTone } from "../format";
import type { LatLng, Station } from "../types";
import { PriceBubble } from "./PriceBubble";

const provider =
  Platform.OS === "android" || process.env.EXPO_PUBLIC_GOOGLE_MAPS === "1"
    ? PROVIDER_GOOGLE
    : PROVIDER_DEFAULT;

const lightMap = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "water", stylers: [{ color: "#d7e6f5" }] },
  { featureType: "landscape.man_made", stylers: [{ color: "#f3f4f6" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#d9ead3" }] },
];

function regionFor(center: LatLng, radius: number) {
  const latitudeDelta = (radius * 2.6) / 111_320;
  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta,
    longitudeDelta: latitudeDelta * 0.72,
  };
}

export function StationMap({
  stations,
  user,
  center,
  radius,
  focusToken,
  onSelect,
  interactive = true,
}: {
  stations: Station[];
  user: LatLng | null;
  center: LatLng;
  radius: number;
  focusToken: number;
  onSelect: (id: string) => void;
  interactive?: boolean;
}) {
  const mapRef = useRef<MapView>(null);
  const [track, setTrack] = useState(true);

  useEffect(() => {
    setTrack(true);
    const timer = setTimeout(() => setTrack(false), 700);
    return () => clearTimeout(timer);
  }, [stations, focusToken]);

  useEffect(() => {
    mapRef.current?.animateToRegion(regionFor(center, radius), focusToken === 0 ? 0 : 450);
  }, [center, radius, focusToken]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      provider={provider}
      initialRegion={regionFor(center, radius)}
      showsUserLocation={user != null}
      showsMyLocationButton={false}
      showsCompass={false}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      rotateEnabled={false}
      pitchEnabled={false}
      customMapStyle={provider === PROVIDER_GOOGLE ? lightMap : undefined}
      mapPadding={{ top: 130, right: 16, bottom: interactive ? 300 : 24, left: 16 }}
    >
      {stations.map((station) => (
        <Marker
          key={station.id}
          coordinate={{ latitude: station.lat, longitude: station.lng }}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={track}
          onPress={() => onSelect(station.id)}
        >
          <PriceBubble label={bubbleLabel(station)} tone={priceTone(station)} />
        </Marker>
      ))}
    </MapView>
  );
}
