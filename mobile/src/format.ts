import type { Fuel, Station } from "./types";

export function formatMoney(amount: number, fuel: Fuel | string): string {
  const digits = fuel === "gnc" && !Number.isInteger(amount) ? 1 : 0;
  const negative = amount < 0;
  const [whole, frac] = Math.abs(amount).toFixed(digits).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const body = digits ? `${grouped},${frac}` : grouped;
  return `${negative ? "-" : ""}$${body}`;
}

export function formatDistance(meters: number): string {
  if (meters < 950) return `${Math.max(0, Math.round(meters))} m`;
  const km = meters / 1000;
  const text = (km >= 10 ? km.toFixed(0) : km.toFixed(1)).replace(".", ",");
  return `${text} km`;
}

export function formatAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "sin fecha";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "hace 1 día";
  if (days < 60) return `hace ${days} días`;
  return `hace ${Math.round(days / 30)} meses`;
}

export function listMeta(station: Station): string {
  const parts: string[] = [];
  if (station.distance_m != null) parts.push(formatDistance(station.distance_m));
  if (!station.price) {
    parts.push("Sin dato");
    return parts.join(" · ");
  }
  const who = station.price.stale
    ? "Desactualizado"
    : station.price.source === "oficial"
      ? "Oficial"
      : "Usuario";
  let tail = `${who}, ${formatAgo(station.price.at)}`;
  if (station.price.confirmations > 0) {
    const count = station.price.confirmations;
    tail += ` · ${count} ${count === 1 ? "confirmación" : "confirmaciones"}`;
  }
  parts.push(tail);
  return parts.join(" · ");
}

export function priceTone(station: Station): "cheap" | "fresh" | "stale" | "empty" {
  if (!station.price) return "empty";
  if (station.cheapest && !station.price.stale) return "cheap";
  if (station.price.stale) return "stale";
  return "fresh";
}

export function bubbleLabel(station: Station): string {
  if (!station.price) return "—";
  const money = formatMoney(station.price.amount, station.price.fuel);
  return station.cheapest && !station.price.stale ? `↓ ${money}` : money;
}
