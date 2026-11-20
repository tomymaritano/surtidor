# Surtidor

Mobile map of Argentine fuel stations. Official pump prices come from the Secretaría de Energía open dataset (Resolución 314/2016, CC-BY-4.0). People can confirm or correct a price when they are within 300 meters of the station.

The phone app is Expo (Android and iOS). The API is a Python standard-library server.

## Run

```bash
cd server
python3 -m surtidor
```

```bash
cd mobile
npx expo start
```

The API listens on `http://127.0.0.1:8791`. Port 8787 is Wrangler's default, so this app stays off it. A phone on the same Wi-Fi reaches the API through the Expo host. Set `EXPO_PUBLIC_API_URL` if that host is wrong.

`npx expo start --web` previews the same screens in a browser. That preview draws OpenStreetMap tiles. It is not Google Maps. Android uses Google Maps. iOS in Expo Go uses Apple Maps until a development build includes `GOOGLE_MAPS_API_KEY`.

## Maps

Android uses Google Maps. iOS in Expo Go uses Apple Maps, because Google Maps on iOS needs a key baked into the app binary.

For a development build with Google Maps on both platforms:

```bash
export GOOGLE_MAPS_API_KEY=your-key
export EXPO_PUBLIC_GOOGLE_MAPS=1
npx expo run:ios
npx expo run:android
```

"Cómo llegar" always opens Google Maps directions.

## Prices

The server reads `server/data/precios.csv`. On startup it reuses that file when it is less than an hour old, then refreshes from:

http://datos.energia.gob.ar/dataset/1c181390-5045-475e-94dc-410429be4b17/resource/80ac25de-a44a-4445-9215-090cf55cfda5/download/precios-en-surtidor-resolucin-3142016.csv

Prices older than 7 days are marked stale and cannot win "más barata". Prices older than 180 days are hidden. A newer user report replaces the official price for that fuel until a newer official declaration arrives.

Reports and confirmations are stored in `server/data/surtidor.db`. There are no accounts. The 300 meter check uses the coordinates the phone sends, so a spoofed location can pass it.
