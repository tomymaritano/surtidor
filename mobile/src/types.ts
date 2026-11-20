export type Fuel = "super" | "premium" | "gasoil" | "gasoil3" | "gnc";

export type PriceSource = "oficial" | "usuarios";

export type Price = {
  fuel: Fuel;
  label: string;
  amount: number;
  source: PriceSource;
  at: string;
  stale: boolean;
  confirmations: number;
};

export type Station = {
  id: string;
  title: string;
  list_name: string;
  legal_name: string;
  brand: string;
  brand_code: string;
  brand_color: string;
  address: string;
  city: string;
  province: string;
  lat: number;
  lng: number;
  distance_m: number | null;
  price: Price | null;
  cheapest: boolean;
  prices?: Partial<Record<Fuel, Price | null>>;
  can_report?: boolean;
  report_radius_m?: number;
};

export type StationList = {
  synced_at: string | null;
  fuel: Fuel;
  radius_m: number;
  cheapest_id: string | null;
  stations: Station[];
};

export type LatLng = { lat: number; lng: number };

export const FUEL_CHOICES: { id: Exclude<Fuel, "gasoil3">; label: string; long: string }[] = [
  { id: "super", label: "Súper", long: "Nafta súper" },
  { id: "premium", label: "Premium", long: "Nafta premium" },
  { id: "gasoil", label: "Gasoil", long: "Gasoil" },
  { id: "gnc", label: "GNC", long: "GNC" },
];

export const DETAIL_FUELS: Fuel[] = ["super", "premium", "gasoil", "gasoil3", "gnc"];

export const FUEL_LABEL: Record<Fuel, string> = {
  super: "Nafta súper",
  premium: "Nafta premium",
  gasoil: "Gasoil",
  gasoil3: "Gasoil grado 3",
  gnc: "GNC",
};

export const RADII = [
  { meters: 1000, label: "1 km" },
  { meters: 3000, label: "3 km" },
  { meters: 5000, label: "5 km" },
  { meters: 10000, label: "10 km" },
];

export const FALLBACK_CENTER: LatLng = { lat: -34.5878, lng: -58.3972 };
