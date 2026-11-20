import csv
import os
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from surtidor.db import connect, migrate
from surtidor.parse import parse_csv
from surtidor.service import (
    ApiError,
    add_confirmation,
    add_report,
    get_station,
    list_stations,
    load_official,
)
from surtidor.parse import AR


HEADER = [
    "indice_tiempo",
    "idempresa",
    "cuit",
    "empresa",
    "direccion",
    "localidad",
    "provincia",
    "region",
    "idproducto",
    "producto",
    "idtipohorario",
    "tipohorario",
    "precio",
    "fecha_vigencia",
    "idempresabandera",
    "empresabandera",
    "latitud",
    "longitud",
    "geojson",
]


def row(address, product, price, when, brand="AXION", lat="-34.5800", lng="-58.4200", hour="Diurno"):
    return {
        "indice_tiempo": "2026-11",
        "idempresa": "1",
        "cuit": "30",
        "empresa": "DEMO S.A.",
        "direccion": address,
        "localidad": "CABA",
        "provincia": "BUENOS AIRES",
        "region": "PAMPEANA",
        "idproducto": "2",
        "producto": product,
        "idtipohorario": "2" if hour == "Diurno" else "3",
        "tipohorario": hour,
        "precio": price,
        "fecha_vigencia": when,
        "idempresabandera": "1",
        "empresabandera": brand,
        "latitud": lat,
        "longitud": lng,
        "geojson": "",
    }


class ServiceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db_path = Path(self.tmp.name) / "test.db"
        self.conn = connect(self.db_path)
        migrate(self.conn)
        self.moment = datetime(2026, 11, 20, 15, 0, tzinfo=AR)

    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()

    def load(self, rows):
        path = Path(self.tmp.name) / "precios.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=HEADER)
            writer.writeheader()
            writer.writerows(rows)
        load_official(self.conn, path)

    def test_parse_prefers_diurno_and_latest_date(self):
        path = Path(self.tmp.name) / "one.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=HEADER)
            writer.writeheader()
            writer.writerow(
                row("Av. Libertador 1240", "Nafta (súper) entre 92 y 95 Ron", "1000", "2026-11-20 10:00:00", hour="Nocturno")
            )
            writer.writerow(
                row("Av. Libertador 1240", "Nafta (súper) entre 92 y 95 Ron", "1100", "2026-11-20 10:00:00", hour="Diurno")
            )
            writer.writerow(
                row("Av. Libertador 1240", "GNC", "700", "2026-11-01 08:00:00")
            )
        stations = parse_csv(path)
        self.assertEqual(len(stations), 1)
        station = next(iter(stations.values()))
        self.assertEqual(station["prices"]["super"]["price"], 1100)
        self.assertEqual(station["brand_key"], "AXION")

    def test_list_marks_cheapest_and_hides_ancient_prices(self):
        self.load(
            [
                row("Av. Libertador 1240", "Nafta (súper) entre 92 y 95 Ron", "1500", "2026-11-20 12:00:00", lat="-34.5800", lng="-58.4200"),
                row("Av. Maipu 2033", "Nafta (súper) entre 92 y 95 Ron", "1700", "2026-11-20 12:00:00", brand="SHELL C.A.P.S.A.", lat="-34.5900", lng="-58.4300"),
                row("Ruta 8 100", "Nafta (súper) entre 92 y 95 Ron", "500", "2024-01-01 00:00:00", brand="YPF", lat="-34.5810", lng="-58.4210"),
            ]
        )
        payload = list_stations(
            self.conn,
            lat=-34.58,
            lng=-58.42,
            radius_m=5000,
            fuel="super",
            q="",
            moment=self.moment,
        )
        amounts = [item["price"]["amount"] for item in payload["stations"] if item["price"]]
        self.assertEqual(amounts, [1500, 1700])
        self.assertTrue(payload["stations"][0]["cheapest"])
        self.assertEqual(payload["stations"][0]["brand"], "Axion")
        self.assertIn("Libertador", payload["stations"][0]["title"])

    def test_week_old_price_is_stale_and_does_not_win(self):
        self.load(
            [
                row("Av. Libertador 1240", "Nafta (súper) entre 92 y 95 Ron", "1000", "2026-11-10 12:00:00"),
                row("Av. Maipu 2033", "Nafta (súper) entre 92 y 95 Ron", "1800", "2026-11-20 12:00:00", brand="SHELL C.A.P.S.A.", lat="-34.5900", lng="-58.4300"),
            ]
        )
        payload = list_stations(
            self.conn,
            lat=-34.58,
            lng=-58.42,
            radius_m=5000,
            fuel="super",
            q="",
            moment=self.moment,
        )
        stale = next(item for item in payload["stations"] if item["brand"] == "Axion")
        fresh = next(item for item in payload["stations"] if item["brand"] == "Shell")
        self.assertTrue(stale["price"]["stale"])
        self.assertEqual(payload["cheapest_id"], fresh["id"])

    def test_user_report_overrides_older_official_price(self):
        self.load(
            [row("Av. Libertador 1240", "Nafta (súper) entre 92 y 95 Ron", "1500", "2026-11-20 08:00:00")]
        )
        station_id = list_stations(
            self.conn, lat=-34.58, lng=-58.42, radius_m=1000, fuel="super", q="", moment=self.moment
        )["stations"][0]["id"]
        updated = add_report(
            self.conn,
            station_id,
            fuel="super",
            price=1410,
            lat=-34.5801,
            lng=-58.4201,
            photo=None,
            moment=self.moment,
        )
        self.assertEqual(updated["prices"]["super"]["source"], "usuarios")
        self.assertEqual(updated["prices"]["super"]["amount"], 1410)

    def test_report_and_confirm_require_being_nearby(self):
        self.load(
            [row("Av. Libertador 1240", "Gas Oil Grado 2", "1600", "2026-11-20 08:00:00")]
        )
        station_id = get_id(self)
        with self.assertRaises(ApiError) as raised:
            add_report(
                self.conn,
                station_id,
                fuel="gasoil",
                price=1610,
                lat=-34.60,
                lng=-58.50,
                photo=None,
                moment=self.moment,
            )
        self.assertEqual(raised.exception.status, 403)
        add_confirmation(
            self.conn,
            station_id,
            fuel="gasoil",
            lat=-34.5800,
            lng=-58.4200,
            moment=self.moment,
        )
        detail = get_station(self.conn, station_id, lat=-34.58, lng=-58.42, moment=self.moment)
        self.assertEqual(detail["prices"]["gasoil"]["confirmations"], 1)
        self.assertTrue(detail["can_report"])

    def test_search_finds_a_station_by_street(self):
        self.load(
            [
                row("Av. Libertador 1240", "Nafta (súper) entre 92 y 95 Ron", "1500", "2026-11-20 12:00:00"),
                row("Av. Maipu 2033", "Nafta (súper) entre 92 y 95 Ron", "1700", "2026-11-20 12:00:00", brand="YPF", lat="-31.4200", lng="-64.1800"),
            ]
        )
        payload = list_stations(
            self.conn,
            lat=-34.60,
            lng=-58.40,
            radius_m=1000,
            fuel="super",
            q="maipu",
            moment=self.moment,
        )
        self.assertEqual(len(payload["stations"]), 1)
        self.assertEqual(payload["stations"][0]["brand"], "YPF")


def get_id(test: ServiceTest) -> str:
    row = test.conn.execute("SELECT id FROM stations").fetchone()
    return row["id"]


if __name__ == "__main__":
    unittest.main()
