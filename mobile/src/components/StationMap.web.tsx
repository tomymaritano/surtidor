import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { bubbleLabel, priceTone } from "../format";
import { colors, fonts } from "../theme";
import type { LatLng, Station } from "../types";
import { PriceBubble } from "./PriceBubble";

const TILE = 256;

function zoomFor(radius: number) {
  if (radius <= 1200) return 15;
  if (radius <= 3500) return 14;
  if (radius <= 7000) return 13;
  return 12;
}

function project(lat: number, lng: number, zoom: number) {
  const scale = TILE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const sine = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function unproject(x: number, y: number, zoom: number): LatLng {
  const scale = TILE * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
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
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [view, setView] = useState({ ...center, zoom: zoomFor(radius) });
  const viewRef = useRef(view);
  const grant = useRef(view);
  const interactiveRef = useRef(interactive);
  viewRef.current = view;
  interactiveRef.current = interactive;

  useEffect(() => {
    setView({ ...center, zoom: zoomFor(radius) });
  }, [center.lat, center.lng, radius, focusToken]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        interactiveRef.current && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
      onPanResponderGrant: () => {
        grant.current = viewRef.current;
      },
      onPanResponderMove: (_event, gesture) => {
        const start = project(grant.current.lat, grant.current.lng, grant.current.zoom);
        setView({
          ...unproject(start.x - gesture.dx, start.y - gesture.dy, grant.current.zoom),
          zoom: grant.current.zoom,
        });
      },
    }),
  ).current;

  const origin = project(view.lat, view.lng, view.zoom);
  const left = origin.x - size.width / 2;
  const top = origin.y - size.height / 2;
  const tileCount = 2 ** view.zoom;
  const x0 = Math.floor(left / TILE) - 1;
  const x1 = Math.floor((left + size.width) / TILE) + 1;
  const y0 = Math.max(0, Math.floor(top / TILE) - 1);
  const y1 = Math.min(tileCount - 1, Math.floor((top + size.height) / TILE) + 1);
  const tiles = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      const wrapped = ((x % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${view.zoom}-${x}-${y}`,
        left: x * TILE - left,
        top: y * TILE - top,
        uri: `https://tile.openstreetmap.org/${view.zoom}/${wrapped}/${y}.png`,
      });
    }
  }

  function place(point: LatLng) {
    const projected = project(point.lat, point.lng, view.zoom);
    return { left: projected.x - left, top: projected.y - top };
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) =>
        setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })
      }
      {...pan.panHandlers}
    >
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          source={{ uri: tile.uri }}
          style={[styles.tile, { left: tile.left, top: tile.top }]}
        />
      ))}
      {user ? <View style={[styles.user, place(user)]} /> : null}
      {stations.map((station) => {
        const point = place(station);
        return (
          <AnchoredPin key={station.id} left={point.left} top={point.top} onPress={() => onSelect(station.id)}>
            <PriceBubble label={bubbleLabel(station)} tone={priceTone(station)} />
          </AnchoredPin>
        );
      })}
      <Text
        pointerEvents="none"
        style={[styles.credit, { bottom: interactive ? 348 : 40 }]}
      >
        © OpenStreetMap
      </Text>
    </View>
  );
}

function AnchoredPin({
  left,
  top,
  onPress,
  children,
}: {
  left: number;
  top: number;
  onPress: () => void;
  children: ReactNode;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  return (
    <Pressable
      onPress={onPress}
      onLayout={(event) =>
        setBox({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })
      }
      style={{ position: "absolute", left: left - box.width / 2, top: top - box.height }}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { position: "absolute", width: TILE, height: TILE },
  user: {
    position: "absolute",
    width: 16,
    height: 16,
    marginLeft: -8,
    marginTop: -8,
    borderRadius: 8,
    backgroundColor: "#2F80ED",
    borderWidth: 2,
    borderColor: "#fff",
  },
  credit: {
    position: "absolute",
    left: 8,
    bottom: 8,
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.muted,
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingHorizontal: 4,
  },
});
