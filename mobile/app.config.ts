import type { ConfigContext, ExpoConfig } from "expo/config";

const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? "";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Surtidor",
  slug: "surtidor",
  scheme: "surtidor",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  ios: {
    supportsTablet: false,
    bundleIdentifier: "app.surtidor.mobile",
    config: { googleMapsApiKey },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Usamos tu ubicación para mostrar las estaciones cerca tuyo y para comprobar que estás en la estación cuando reportás un precio.",
      NSCameraUsageDescription:
        "Podés sacarle una foto al cartel para acompañar el precio que reportás.",
      NSPhotoLibraryUsageDescription:
        "Podés adjuntar una foto del cartel para acompañar el precio que reportás.",
    },
  },
  android: {
    ...config.android,
    package: "app.surtidor.mobile",
    predictiveBackGestureEnabled: false,
    config: { googleMaps: { apiKey: googleMapsApiKey } },
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION", "CAMERA"],
  },
  plugins: [
    "expo-font",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Usamos tu ubicación para mostrar las estaciones cerca tuyo y para comprobar que estás en la estación cuando reportás un precio.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Podés adjuntar una foto del cartel para acompañar el precio que reportás.",
        cameraPermission: "Podés sacarle una foto al cartel para acompañar el precio que reportás.",
      },
    ],
  ],
});
