"""Station queries, official sync, and geofenced price reports."""

from __future__ import annotations

import json
import logging
import shutil
import sqlite3
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

from surtidor.brands import brand_view, pretty, street_label
from surtidor.db import csv_path, migrate
from surtidor.geo import REPORT_RADIUS_M, bounding_box, haversine_m
from surtidor.parse import AR, FUELS, fold, parse_csv

log = logging.getLogger("surtidor")

OFFICIAL_CSV = (
    "http://datos.energia.gob.ar/dataset/1c181390-5045-475e-94dc-410429be4b17/"
    "resource/80ac25de-a44a-4445-9215-090cf55cfda5/download/"
    "precios-en-surtidor-resolucin-3142016.csv"
)
USER_AGENT = "Surtidor/0.1 (local fuel-price app; contacto local)"
STALE_AFTER = timedelta(days=7)
DROP_AFTER = timedelta(days=180)
FUEL_LABELS = {
    "super": "Nafta súper",
    "premium": "Nafta premium",
    "gasoil": "Gasoil",
    "gasoil3": "Gasoil grado 3",
    "gnc": "GNC",
}
MIN_PRICE = 50
MAX_PRICE = 100_000


class ApiError(Exception):
    def __init__(self, status: int, code: str, **extra):
        super().__init__(code)
        self.status = status
        self.payload = {"error": code, **extra}


def now_ar() -> datetime:
    return datetime.now(AR)


def load_official(conn: sqlite3.Connection, path: Path) -> int:
    stations = parse_csv(path)
    migrate(conn)
    with conn:
        conn.execute("DELETE FROM official_prices")
        for station in stations.values():
            conn.execute(
                """
                INSERT INTO stations (
                  id, legal_name, brand_key, address, city, province, lat, lng, search_text
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  legal_name = excluded.legal_name,
                  brand_key = excluded.brand_key,
                  address = excluded.address,
                  city = excluded.city,
                  province = excluded.province,
                  lat = excluded.lat,
                  lng = excluded.lng,
                  search_text = excluded.search_text
                """,
                (
                    station["id"],
                    station["legal_name"],
                    station["brand_key"],
                    station["address"],
                    station["city"],
                    station["province"],
                    station["lat"],
                    station["lng"],
                    station["search_text"],
                ),
            )
            for fuel, price in station["prices"].items():
                conn.execute(
                    """
                    INSERT INTO official_prices (station_id, fuel, price, vigencia)
                    VALUES (?, ?, ?, ?)
                    """,
                    (station["id"], fuel, price["price"], price["vigencia"].isoformat()),
                )
        conn.execute(
            """
            DELETE FROM stations
            WHERE id NOT IN (SELECT station_id FROM official_prices)
              AND id NOT IN (SELECT station_id FROM reports)
              AND id NOT IN (SELECT station_id FROM confirmations)
            """
        )
        conn.execute(
            "INSERT INTO meta (key, value) VALUES ('synced_at', ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (now_ar().isoformat(),),
        )
    log.info("loaded %s stations from %s", len(stations), path.name)
    return len(stations)


def download_csv(destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    tmp = destination.with_suffix(".csv.tmp")
    request = urllib.request.Request(OFFICIAL_CSV, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response, tmp.open("wb") as handle:
        shutil.copyfileobj(response, handle)
    tmp.replace(destination)


def sync_once() -> int | None:
    path = csv_path()
    count = _load_if_present(path)
    age = time.time() - path.stat().st_mtime if path.exists() else 10**12
    if count and age < 60 * 60:
        log.info("official file is fresh (%s stations)", count)
        return count
    try:
        download_csv(path)
    except Exception:
        log.exception("official csv download failed")
        return count
    return _load_if_present(path)


def _load_if_present(path: Path) -> int | None:
    if not path.exists() or path.stat().st_size == 0:
        return None
    conn = _connect_migrated()
    try:
        return load_official(conn, path)
    finally:
        conn.close()


def _connect_migrated():
    from surtidor.db import connect

    conn = connect()
    migrate(conn)
    return conn


def list_stations(
    conn: sqlite3.Connection,
    *,
    lat: float | None,
    lng: float | None,
    radius_m: int,
    fuel: str,
    q: str,
    moment: datetime | None = None,
) -> dict:
    _check_fuel(fuel, allow_grade3=False)
    moment = moment or now_ar()
    radius_m = min(max(radius_m, 500), 50_000)
    query = q.strip()
    if query:
        if lat is None or lng is None:
            raise ApiError(400, "location_required")
        rows = _search_rows(conn, query)
    else:
        if lat is None or lng is None:
            raise ApiError(400, "location_required")
        south, north, west, east = bounding_box(lat, lng, radius_m)
        rows = conn.execute(
            """
            SELECT * FROM stations
            WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
            """,
            (south, north, west, east),
        ).fetchall()

    nearby: list[tuple[sqlite3.Row, float]] = []
    for row in rows:
        distance = haversine_m(lat, lng, row["lat"], row["lng"])
        if query or distance <= radius_m:
            nearby.append((row, distance))
    nearby.sort(key=lambda item: item[1])
    if query:
        nearby = nearby[:40]
    prices = _prices_for(conn, [row["id"] for row, _ in nearby], [fuel], moment)
    cards = []
    for row, distance in nearby:
        price = prices.get((row["id"], fuel))
        cards.append(_card(row, distance, price, cheapest=False))
    ranked = [card for card in cards if card["price"] and not card["price"]["stale"]]
    cheapest_id = None
    if ranked:
        winner = min(ranked, key=lambda card: (card["price"]["amount"], card["distance_m"]))
        cheapest_id = winner["id"]
        for card in cards:
            card["cheapest"] = card["id"] == cheapest_id
    if query:
        cards.sort(key=lambda card: card["distance_m"] or 0)
    else:
        cards.sort(key=lambda card: _sort_key(card))
        cards = cards[:100]
    return {
        "synced_at": _synced_at(conn),
        "fuel": fuel,
        "radius_m": radius_m,
        "cheapest_id": cheapest_id,
        "stations": cards,
    }


def get_station(
    conn: sqlite3.Connection,
    station_id: str,
    *,
    lat: float | None,
    lng: float | None,
    moment: datetime | None = None,
) -> dict:
    moment = moment or now_ar()
    row = conn.execute("SELECT * FROM stations WHERE id = ?", (station_id,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found")
    distance = None
    if lat is not None and lng is not None:
        distance = haversine_m(lat, lng, row["lat"], row["lng"])
    prices = _prices_for(conn, [station_id], FUELS, moment)
    card = _card(row, distance, None, cheapest=False)
    card["prices"] = {fuel: prices.get((station_id, fuel)) for fuel in FUELS}
    card["can_report"] = distance is not None and distance <= REPORT_RADIUS_M
    card["report_radius_m"] = REPORT_RADIUS_M
    return card


def add_report(
    conn: sqlite3.Connection,
    station_id: str,
    *,
    fuel: str,
    price: float,
    lat: float,
    lng: float,
    photo: str | None,
    moment: datetime | None = None,
) -> dict:
    _check_fuel(fuel)
    _check_price(price)
    moment = moment or now_ar()
    distance = _require_nearby(conn, station_id, lat, lng)
    with conn:
        conn.execute(
            """
            INSERT INTO reports (station_id, fuel, price, created_at, photo)
            VALUES (?, ?, ?, ?, ?)
            """,
            (station_id, fuel, price, moment.isoformat(), photo),
        )
    detail = get_station(conn, station_id, lat=lat, lng=lng, moment=moment)
    detail["distance_m"] = distance
    return detail


def add_confirmation(
    conn: sqlite3.Connection,
    station_id: str,
    *,
    fuel: str,
    lat: float,
    lng: float,
    moment: datetime | None = None,
) -> dict:
    _check_fuel(fuel)
    moment = moment or now_ar()
    _require_nearby(conn, station_id, lat, lng)
    current = _prices_for(conn, [station_id], [fuel], moment).get((station_id, fuel))
    if current is None:
        raise ApiError(400, "no_price")
    with conn:
        conn.execute(
            """
            INSERT INTO confirmations (station_id, fuel, price, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (station_id, fuel, current["amount"], moment.isoformat()),
        )
    return get_station(conn, station_id, lat=lat, lng=lng, moment=moment)


def geocode(query: str) -> dict | None:
    text = query.strip()
    if len(text) < 2:
        return None
    params = urllib.parse.urlencode(
        {"q": f"{text}, Argentina", "format": "jsonv2", "limit": 1, "countrycodes": "ar"}
    )
    request = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{params}",
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode())
    if not payload:
        return None
    hit = payload[0]
    return {
        "lat": float(hit["lat"]),
        "lng": float(hit["lon"]),
        "label": hit.get("display_name") or text,
    }


def _require_nearby(conn: sqlite3.Connection, station_id: str, lat: float, lng: float) -> float:
    row = conn.execute("SELECT lat, lng FROM stations WHERE id = ?", (station_id,)).fetchone()
    if row is None:
        raise ApiError(404, "not_found")
    distance = haversine_m(lat, lng, row["lat"], row["lng"])
    if distance > REPORT_RADIUS_M:
        raise ApiError(403, "too_far", distance_m=round(distance), max_m=REPORT_RADIUS_M)
    return distance


def _check_fuel(fuel: str, allow_grade3: bool = True) -> None:
    allowed = FUELS if allow_grade3 else tuple(item for item in FUELS if item != "gasoil3")
    if fuel not in allowed:
        raise ApiError(400, "bad_fuel")


def _check_price(price: float) -> None:
    if price != price or price < MIN_PRICE or price > MAX_PRICE:
        raise ApiError(400, "bad_price", min=MIN_PRICE, max=MAX_PRICE)


def _search_rows(conn: sqlite3.Connection, query: str) -> list[sqlite3.Row]:
    needle = f"%{fold(query).replace('%', '').replace('_', '')}%"
    return conn.execute(
        "SELECT * FROM stations WHERE search_text LIKE ?",
        (needle,),
    ).fetchall()


def _prices_for(
    conn: sqlite3.Connection,
    station_ids: list[str],
    fuels: tuple[str, ...] | list[str],
    moment: datetime,
) -> dict[tuple[str, str], dict]:
    if not station_ids:
        return {}
    marks = ",".join("?" for _ in station_ids)
    fuel_marks = ",".join("?" for _ in fuels)
    official = conn.execute(
        f"""
        SELECT station_id, fuel, price, vigencia
        FROM official_prices
        WHERE station_id IN ({marks}) AND fuel IN ({fuel_marks})
        """,
        (*station_ids, *fuels),
    ).fetchall()
    reports = conn.execute(
        f"""
        SELECT station_id, fuel, price, created_at
        FROM reports
        WHERE station_id IN ({marks}) AND fuel IN ({fuel_marks})
        ORDER BY created_at DESC, id DESC
        """,
        (*station_ids, *fuels),
    ).fetchall()
    confirmations = conn.execute(
        f"""
        SELECT station_id, fuel, price, created_at
        FROM confirmations
        WHERE station_id IN ({marks}) AND fuel IN ({fuel_marks})
        """,
        (*station_ids, *fuels),
    ).fetchall()
    latest_report: dict[tuple[str, str], sqlite3.Row] = {}
    for row in reports:
        key = (row["station_id"], row["fuel"])
        latest_report.setdefault(key, row)
    grouped_confirmations: dict[tuple[str, str], list[sqlite3.Row]] = {}
    for row in confirmations:
        grouped_confirmations.setdefault((row["station_id"], row["fuel"]), []).append(row)
    found: dict[tuple[str, str], dict] = {}
    for row in official:
        key = (row["station_id"], row["fuel"])
        found[key] = _effective(
            official_price=row["price"],
            official_at=_parse_iso(row["vigencia"]),
            report=latest_report.get(key),
            confirmations=grouped_confirmations.get(key, []),
            moment=moment,
            fuel=row["fuel"],
        )
    for key, report in latest_report.items():
        if key not in found:
            found[key] = _effective(
                official_price=None,
                official_at=None,
                report=report,
                confirmations=grouped_confirmations.get(key, []),
                moment=moment,
                fuel=key[1],
            )
    return {key: value for key, value in found.items() if value is not None}


def _effective(
    *,
    official_price: float | None,
    official_at: datetime | None,
    report: sqlite3.Row | None,
    confirmations: list[sqlite3.Row],
    moment: datetime,
    fuel: str,
) -> dict | None:
    source = None
    amount = None
    at = None
    report_at = _parse_iso(report["created_at"]) if report is not None else None
    if report is not None and (official_at is None or report_at >= official_at):
        source = "usuarios"
        amount = float(report["price"])
        at = report_at
    elif official_price is not None and official_at is not None:
        source = "oficial"
        amount = float(official_price)
        at = official_at
    if source is None or at is None or amount is None:
        return None
    age = moment - at
    if age > DROP_AFTER:
        return None
    confirms = 0
    for row in confirmations:
        confirmed_at = _parse_iso(row["created_at"])
        if confirmed_at >= at and abs(float(row["price"]) - amount) < 0.02:
            confirms += 1
    return {
        "fuel": fuel,
        "label": FUEL_LABELS[fuel],
        "amount": amount,
        "source": source,
        "at": at.isoformat(),
        "stale": age > STALE_AFTER,
        "confirmations": confirms,
    }


def _card(row: sqlite3.Row, distance: float | None, price: dict | None, cheapest: bool) -> dict:
    view = brand_view(row["brand_key"])
    address = pretty(row["address"])
    street = street_label(row["address"])
    title = f"{view['brand']} {street}".strip()
    return {
        "id": row["id"],
        "title": title,
        "list_name": f"{view['brand']} · {address}",
        "legal_name": row["legal_name"],
        **view,
        "address": address,
        "city": pretty(row["city"]),
        "province": pretty(row["province"]),
        "lat": row["lat"],
        "lng": row["lng"],
        "distance_m": None if distance is None else round(distance),
        "price": price,
        "cheapest": cheapest,
    }


def _sort_key(card: dict) -> tuple:
    price = card["price"]
    if price is None:
        return (2, 0, card["distance_m"] or 0)
    if price["stale"]:
        return (1, price["amount"], card["distance_m"] or 0)
    return (0, price["amount"], card["distance_m"] or 0)


def _synced_at(conn: sqlite3.Connection) -> str | None:
    row = conn.execute("SELECT value FROM meta WHERE key = 'synced_at'").fetchone()
    return None if row is None else row["value"]


def _parse_iso(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=AR)
    return parsed.astimezone(AR)
