import Constants from "expo-constants";

import type { Fuel, LatLng, Station, StationList } from "./types";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "too_far") return "Tenés que estar a menos de 300 m de la estación.";
    if (error.code === "bad_price") return "Ese precio no entra en un rango creíble.";
    if (error.code === "no_price") return "No hay un precio para confirmar. Cargá uno.";
    if (error.code === "photo_too_large") return "La foto es muy pesada. Probá con otra.";
    if (error.code === "bad_fuel") return "Ese combustible no está en el listado.";
  }
  return "No pudimos hablar con el servidor de precios.";
}

function apiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") return `http://${host}:8791`;
  return "http://127.0.0.1:8791";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "offline");
  }
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new ApiError(response.status, payload.error ?? "request_failed");
  return payload;
}

export const api = {
  stations(input: LatLng & { radius_m: number; fuel: Fuel; q?: string }) {
    const params = new URLSearchParams({
      lat: String(input.lat),
      lng: String(input.lng),
      radius_m: String(input.radius_m),
      fuel: input.fuel,
    });
    if (input.q) params.set("q", input.q);
    return request<StationList>(`/stations?${params}`);
  },
  station(id: string, user: LatLng | null) {
    const params = new URLSearchParams();
    if (user) {
      params.set("lat", String(user.lat));
      params.set("lng", String(user.lng));
    }
    const query = params.toString();
    return request<Station>(`/stations/${id}${query ? `?${query}` : ""}`);
  },
  geocode(q: string) {
    return request<{ result: (LatLng & { label: string }) | null }>(
      `/geocode?q=${encodeURIComponent(q)}`,
    );
  },
  report(id: string, body: { fuel: Fuel; price: number; lat: number; lng: number; photo_base64?: string }) {
    return request<Station>(`/stations/${id}/reports`, { method: "POST", body: JSON.stringify(body) });
  },
  confirm(id: string, body: { fuel: Fuel; lat: number; lng: number }) {
    return request<Station>(`/stations/${id}/confirm`, { method: "POST", body: JSON.stringify(body) });
  },
};
