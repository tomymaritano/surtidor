import * as Location from "expo-location";
import { useEffect, useState } from "react";

import { FALLBACK_CENTER, type LatLng } from "./types";

export type LocationStatus = "pending" | "granted" | "denied";

export function useUserLocation() {
  const [user, setUser] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<LocationStatus>("pending");

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let active = true;

    const timer = setTimeout(() => {
      if (active) {
        setStatus((current) => (current === "pending" ? "denied" : current));
      }
    }, 5000);

    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (permission.status !== "granted") {
          setStatus("denied");
          return;
        }
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) return;
        setUser({ lat: current.coords.latitude, lng: current.coords.longitude });
        setStatus("granted");
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 40 },
          (position) => {
            setUser({ lat: position.coords.latitude, lng: position.coords.longitude });
          },
        );
      } catch {
        if (active) setStatus("denied");
      }
    })();

    return () => {
      active = false;
      clearTimeout(timer);
      subscription?.remove();
    };
  }, []);

  return {
    user,
    status,
    center: status === "granted" && user ? user : FALLBACK_CENTER,
  };
}
