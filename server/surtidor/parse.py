"""Turn the Secretaría de Energía pump-price CSV into one row per station."""

from __future__ import annotations

import csv
import hashlib
import unicodedata
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from surtidor.brands import brand_key

AR = ZoneInfo("America/Argentina/Buenos_Aires")

PRODUCT_TO_FUEL = {
    "Gas Oil Grado 2": "gasoil",
    "Gas Oil Grado 3": "gasoil3",
    "Nafta (súper) entre 92 y 95 Ron": "super",
    "Nafta (premium) de más de 95 Ron": "premium",
    "GNC": "gnc",
}

FUELS = ("super", "premium", "gasoil", "gasoil3", "gnc")


def fold(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value.casefold())
    return "".join(char for char in decomposed if unicodedata.category(char) != "Mn")


def station_id(lat: float, lng: float, address: str) -> str:
    raw = f"{lat:.4f}|{lng:.4f}|{address.strip().casefold()}"
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def parse_vigencia(value: str) -> datetime | None:
    value = (value or "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=AR)
        except ValueError:
            continue
    return None


def parse_price(value: str) -> float | None:
    text = (value or "").strip().replace(",", ".")
    if not text:
        return None
    try:
        price = float(text)
    except ValueError:
        return None
    if price <= 0:
        return None
    return price


def _in_argentina(lat: float, lng: float) -> bool:
    return -60 <= lat <= -20 and -75 <= lng <= -25


def parse_csv(path: Path) -> dict[str, dict]:
    stations: dict[str, dict] = {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            fuel = PRODUCT_TO_FUEL.get((row.get("producto") or "").strip())
            price = parse_price(row.get("precio") or "")
            vigencia = parse_vigencia(row.get("fecha_vigencia") or "")
            if not fuel or price is None or vigencia is None:
                continue
            try:
                lat = float((row.get("latitud") or "").replace(",", "."))
                lng = float((row.get("longitud") or "").replace(",", "."))
            except ValueError:
                continue
            if not _in_argentina(lat, lng):
                continue
            address = (row.get("direccion") or "").strip()
            city = (row.get("localidad") or "").strip()
            if not address:
                continue
            key = station_id(lat, lng, address)
            station = stations.get(key)
            if station is None:
                brand = brand_key(row.get("empresabandera") or "")
                legal = (row.get("empresa") or "").strip()
                province = (row.get("provincia") or "").strip()
                station = {
                    "id": key,
                    "legal_name": legal,
                    "brand_key": brand,
                    "address": address,
                    "city": city,
                    "province": province,
                    "lat": lat,
                    "lng": lng,
                    "search_text": fold(" ".join([brand, legal, address, city, province])),
                    "prices": {},
                }
                stations[key] = station
            current = station["prices"].get(fuel)
            diurno = (row.get("tipohorario") or "").strip().lower() == "diurno"
            candidate = {"price": price, "vigencia": vigencia, "diurno": diurno}
            if current is None or _prefer(candidate, current):
                station["prices"][fuel] = candidate
    return stations


def _prefer(candidate: dict, current: dict) -> bool:
    if candidate["vigencia"] > current["vigencia"]:
        return True
    if candidate["vigencia"] == current["vigencia"] and candidate["diurno"] and not current["diurno"]:
        return True
    return False


